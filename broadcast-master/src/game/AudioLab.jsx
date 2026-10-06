import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Square, Info } from 'lucide-react';
import { ToggleBtn, VFader } from './ui.jsx';
import { clamp, faderDb, fmtDb } from './engine.js';

/* =====================================================================
 * 소리 실습실 — Web Audio로 실제 소리를 내고 채널 스트립(GAIN·LOW CUT·EQ·FX)을
 * 거쳐 들려준다. 스펙트럼과 EQ 곡선을 함께 그려 귀와 눈으로 비교한다.
 * ===================================================================== */

const dbToGain = (db) => 10 ** (db / 20);
const VOWELS = [[800, 1200, 2500], [300, 2300, 3000], [450, 800, 2600], [350, 900, 2400], [500, 1800, 2600]];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function noiseBuffer(ctx, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return buf;
}
function impulse(ctx, seconds = 2.4, decay = 3) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c += 1) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

// 합성 목소리: 성대(톱니파) + 모음 포먼트 필터 + 음절 리듬. 저음 잡음(험·바람·파열음)을 일부러 섞는다.
function startVoice(ctx, out) {
  const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 125;
  const vib = ctx.createOscillator(); vib.frequency.value = 5;
  const vibG = ctx.createGain(); vibG.gain.value = 3; vib.connect(vibG).connect(osc.frequency);
  const env = ctx.createGain(); env.gain.value = 0;
  const formants = [0, 1, 2].map((i) => {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [6, 9, 12][i]; f.frequency.value = VOWELS[0][i];
    const g = ctx.createGain(); g.gain.value = [1.4, 0.8, 0.45][i];
    osc.connect(f).connect(g).connect(env);
    return f;
  });
  env.connect(out);
  const hum = ctx.createOscillator(); hum.frequency.value = 60;
  const humG = ctx.createGain(); humG.gain.value = 0.1; hum.connect(humG).connect(out);
  const nz = ctx.createBufferSource(); nz.buffer = noiseBuffer(ctx); nz.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
  const nzG = ctx.createGain(); nzG.gain.value = 0.45; nz.connect(lp).connect(nzG).connect(out);
  [osc, vib, hum, nz].forEach((n) => n.start());
  const pattern = [0.22, 0.18, 0.3, 0.2, 0.26, 0.42];
  let next = ctx.currentTime + 0.1;
  let k = 0;
  const tick = () => {
    while (next < ctx.currentTime + 1) {
      const dur = pattern[k % pattern.length];
      const v = VOWELS[(k * 3 + 1) % VOWELS.length];
      formants.forEach((f, i) => f.frequency.setTargetAtTime(v[i], next, 0.02));
      osc.frequency.setValueAtTime(118 + (k % 4) * 9, next);
      env.gain.setTargetAtTime(0.55, next, 0.02);
      env.gain.setTargetAtTime(0, next + dur, 0.03);
      if (k % 3 === 0) { // 파열음 "ㅍ" 바람
        const t = ctx.createOscillator(); const tg = ctx.createGain();
        t.frequency.setValueAtTime(95, next); t.frequency.exponentialRampToValueAtTime(40, next + 0.12);
        tg.gain.setValueAtTime(0.5, next); tg.gain.exponentialRampToValueAtTime(0.001, next + 0.15);
        t.connect(tg).connect(out); t.start(next); t.stop(next + 0.2);
      }
      next += dur + (k % 6 === 5 ? 0.6 : 0.09);
      k += 1;
    }
  };
  tick();
  const id = setInterval(tick, 250);
  return () => { clearInterval(id); [osc, vib, hum, nz].forEach((n) => { try { n.stop(); } catch { /* 무시 */ } }); };
}

// 음악 루프: 킥·스네어·하이햇·베이스·멜로디
function startMusic(ctx, out) {
  const step = 60 / 104 / 4;
  const nb = noiseBuffer(ctx, 1);
  const env = (t, vol, dur) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); return g; };
  const kick = (t) => { const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15); o.connect(env(t, 0.9, 0.3)).connect(out); o.start(t); o.stop(t + 0.32); };
  const noise = (t, type, freq, vol, dur) => { const s = ctx.createBufferSource(); s.buffer = nb; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; s.connect(f).connect(env(t, vol, dur)).connect(out); s.start(t); s.stop(t + dur + 0.02); };
  const note = (t, n, dur, type, vol, cut) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = midi(n); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; o.connect(f).connect(env(t, vol, dur)).connect(out); o.start(t); o.stop(t + dur + 0.05); };
  const bass = [36, null, 36, 48, null, 36, null, 43, 41, null, 41, 53, null, 41, null, 43];
  const lead = [67, null, 71, null, 74, null, 72, 71, 69, null, 67, null, 64, null, null, null];
  let next = ctx.currentTime + 0.1;
  let i = 0;
  const tick = () => {
    while (next < ctx.currentTime + 0.4) {
      const s = i % 16;
      if (s % 4 === 0) kick(next);
      if (s === 4 || s === 12) { noise(next, 'bandpass', 1800, 0.5, 0.18); note(next, 55, 0.08, 'triangle', 0.25, 2000); }
      if (s % 2 === 1) noise(next, 'highpass', 7000, 0.18, 0.05);
      if (bass[s]) note(next, bass[s], step * 1.8, 'sawtooth', 0.32, 500);
      if (lead[s] && Math.floor(i / 16) % 2 === 0) note(next, lead[s], step * 1.6, 'triangle', 0.16, 5000);
      next += step;
      i += 1;
    }
  };
  tick();
  const id = setInterval(tick, 100);
  return () => clearInterval(id);
}

// 핑크 노이즈: EQ 곡선이 스펙트럼에 그대로 보인다
function startNoise(ctx, out) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, 3); s.loop = true;
  const pink = ctx.createBiquadFilter(); pink.type = 'lowshelf'; pink.frequency.value = 800; pink.gain.value = 6;
  const tilt = ctx.createBiquadFilter(); tilt.type = 'highshelf'; tilt.frequency.value = 3000; tilt.gain.value = -8;
  const g = ctx.createGain(); g.gain.value = 0.18;
  s.connect(pink).connect(tilt).connect(g).connect(out); s.start();
  return () => { try { s.stop(); } catch { /* 무시 */ } };
}
const SOURCES = { voice: ['목소리 (잡음 섞임)', startVoice], music: ['음악 루프', startMusic], noise: ['핑크 노이즈', startNoise] };

const DEFAULT = { gain: 30, lowCut: false, hi: 0, mid: 0, midFreq: 1500, lo: 0, reverb: 0, delay: 0, time: 0.35, fader: 75 };
const PRESETS = [
  ['원래 소리', {}],
  ['전화기 목소리', { lowCut: true, lo: -15, hi: -15, mid: 8, midFreq: 1500 }],
  ['라디오 DJ', { lowCut: true, lo: 6, mid: -4, midFreq: 400, hi: 4 }],
  ['공연장 울림', { reverb: 65 }],
  ['산울림 에코', { delay: 60, time: 0.5 }],
  ['찌그러짐(클리핑)', { gain: 56 }],
];
const TIPS = {
  gain: 'GAIN(프리앰프): 입력 신호를 키우는 첫 단계입니다. 너무 높이면 소리가 찌그러지고(클리핑), 너무 낮으면 잡음이 상대적으로 커집니다.',
  lowCut: 'LOW CUT(하이패스 필터, 보통 80~100Hz): 그 아래 저음을 깎아 웅웅거림, 바람 소리, 마이크를 쥔 손 잡음, "ㅍ" 파열음을 줄입니다. 말소리 채널은 거의 항상 켭니다.',
  hi: 'HIGH(약 5kHz 이상): 선명함과 공기감. 올리면 또렷하지만 너무 올리면 "ㅅ, ㅊ" 소리가 날카로워집니다.',
  mid: 'MID(250Hz~4kHz): 목소리의 몸통과 명료도. 답답하면 300~500Hz를 깎고, 또렷하게 하려면 2~3kHz를 살짝 올립니다.',
  midFreq: 'MID 주파수: 중음 노브가 어느 주파수를 조절할지 고릅니다(파라메트릭/세미 파라메트릭 EQ).',
  lo: 'LOW(약 200Hz 이하): 두께와 무게감. 올리면 따뜻하고 묵직해지지만 너무 올리면 웅웅거립니다.',
  reverb: '리버브(잔향): 방이나 홀의 울림을 더해 공간감을 줍니다. 노래에는 적당히, 말소리에는 아주 조금만 씁니다.',
  delay: '딜레이(에코): 소리를 일정 시간 뒤에 반복해 "안녕—안녕—안녕" 하는 메아리를 만듭니다.',
  time: '에코 시간: 반복 간격입니다. 짧으면 겹쳐 두꺼워지고, 길면 산울림처럼 들립니다.',
  fader: '페이더: 최종 음량입니다. 레벨은 GAIN으로, 다른 소리와의 음량 균형은 페이더로 맞춥니다.',
};

/* ---------------------------- 회전 노브 ---------------------------- */
function RotaryKnob({ label, value, min, max, step = 1, onChange, onTouch, display, color = '#e5e7eb', size = 46 }) {
  const drag = useRef(null);
  const t = (value - min) / (max - min);
  const ang = -135 + t * 270;
  const set = (v) => { onChange(clamp(Math.round(v / step) * step, min, max)); onTouch?.(); };
  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div
        role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={display}
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { y: e.clientY, v: value }; onTouch?.(); }}
        onPointerMove={(e) => { if (drag.current) set(drag.current.v + ((drag.current.y - e.clientY) / 140) * (max - min)); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onDoubleClick={() => set(min < 0 ? 0 : min)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(value + step * (max - min > 100 ? 5 : 1)); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(value - step * (max - min > 100 ? 5 : 1)); }
        }}
        className="relative rounded-full cursor-ns-resize touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        style={{ width: size, height: size }}
        title="위아래로 드래그 · 더블클릭: 초기화"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
          <path d="M 22 78 A 40 40 0 1 1 78 78" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="50" r="30" fill="#111827" stroke="#475569" strokeWidth="3" />
          <line x1="50" y1="50" x2="50" y2="24" stroke={color} strokeWidth="6" strokeLinecap="round" transform={`rotate(${ang} 50 50)`} />
        </svg>
      </div>
      <span className="text-[10px] font-bold text-slate-300 leading-none">{label}</span>
      <span className="text-[10px] font-mono text-slate-400 tabular-nums leading-none">{display}</span>
    </div>
  );
}

/* =====================================================================
 * AudioLab
 * ===================================================================== */
export default function AudioLab({ focus = 'eq' }) {
  const [p, setP] = useState(DEFAULT);
  const [src, setSrc] = useState('voice');
  const [playing, setPlaying] = useState(false);
  const [tip, setTip] = useState(focus === 'fx' ? 'reverb' : 'lowCut');
  const ctxRef = useRef(null);
  const nodes = useRef(null);
  const stopSrc = useRef(null);
  const canvas = useRef(null);
  const curveCtx = useRef(null);
  const raf = useRef(0);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const touch = (k) => () => setTip(k);

  const build = useCallback(() => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const n = {};
    n.input = ctx.createGain();
    n.pre = ctx.createGain();
    n.shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i += 1) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
    n.shaper.curve = curve; n.shaper.oversample = '4x';
    n.hp = ctx.createBiquadFilter(); n.hp.type = 'highpass'; n.hp.Q.value = 0.7;
    n.lo = ctx.createBiquadFilter(); n.lo.type = 'lowshelf'; n.lo.frequency.value = 200;
    n.mid = ctx.createBiquadFilter(); n.mid.type = 'peaking'; n.mid.Q.value = 1;
    n.hi = ctx.createBiquadFilter(); n.hi.type = 'highshelf'; n.hi.frequency.value = 5000;
    n.fader = ctx.createGain();
    n.master = ctx.createGain(); n.master.gain.value = 0.7;
    n.analyser = ctx.createAnalyser(); n.analyser.fftSize = 4096; n.analyser.smoothingTimeConstant = 0.82;
    n.revSend = ctx.createGain(); n.conv = ctx.createConvolver(); n.conv.buffer = impulse(ctx);
    n.dlySend = ctx.createGain(); n.delay = ctx.createDelay(1.5); n.fb = ctx.createGain(); n.fb.gain.value = 0.45;
    n.input.connect(n.pre).connect(n.shaper).connect(n.hp).connect(n.lo).connect(n.mid).connect(n.hi).connect(n.fader).connect(n.master);
    n.fader.connect(n.revSend).connect(n.conv).connect(n.master);
    n.fader.connect(n.dlySend).connect(n.delay).connect(n.master);
    n.delay.connect(n.fb).connect(n.delay);
    n.master.connect(n.analyser).connect(ctx.destination);
    ctxRef.current = ctx;
    nodes.current = n;
    return ctx;
  }, []);

  // 노브 값 → 오디오 노드
  useEffect(() => {
    const n = nodes.current;
    const ctx = ctxRef.current;
    if (!n || !ctx) return;
    const now = ctx.currentTime;
    n.pre.gain.setTargetAtTime(dbToGain(p.gain - 30), now, 0.02);
    n.hp.frequency.setTargetAtTime(p.lowCut ? 100 : 10, now, 0.02);
    n.lo.gain.setTargetAtTime(p.lo, now, 0.02);
    n.mid.gain.setTargetAtTime(p.mid, now, 0.02);
    n.mid.frequency.setTargetAtTime(p.midFreq, now, 0.02);
    n.hi.gain.setTargetAtTime(p.hi, now, 0.02);
    n.fader.gain.setTargetAtTime(p.fader <= 0 ? 0 : dbToGain(faderDb(p.fader)), now, 0.02);
    n.revSend.gain.setTargetAtTime((p.reverb / 100) * 1.6, now, 0.05);
    n.dlySend.gain.setTargetAtTime((p.delay / 100) * 0.9, now, 0.05);
    n.delay.delayTime.setTargetAtTime(p.time, now, 0.05);
  }, [p, playing]);

  const start = () => {
    const ctx = ctxRef.current ?? build();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    stopSrc.current?.();
    stopSrc.current = SOURCES[src][1](ctx, nodes.current.input);
    setPlaying(true);
  };
  const stop = () => { stopSrc.current?.(); stopSrc.current = null; setPlaying(false); };
  useEffect(() => { if (playing) start(); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { stopSrc.current?.(); try { ctxRef.current?.close(); } catch { /* 무시 */ } cancelAnimationFrame(raf.current); }, []);

  // EQ 곡선 계산용 필터 (오프라인 컨텍스트라 소리를 내지 않는다)
  const curveFilters = useRef(null);
  if (!curveFilters.current && typeof window !== 'undefined' && window.OfflineAudioContext) {
    try {
      const oc = new window.OfflineAudioContext(1, 128, 44100);
      const mk = (type, f) => { const b = oc.createBiquadFilter(); b.type = type; b.frequency.value = f; return b; };
      curveCtx.current = oc;
      curveFilters.current = { hp: mk('highpass', 10), lo: mk('lowshelf', 200), mid: mk('peaking', 1500), hi: mk('highshelf', 5000) };
      curveFilters.current.hp.Q.value = 0.7; curveFilters.current.mid.Q.value = 1;
    } catch { curveFilters.current = null; }
  }

  // 스펙트럼 + EQ 곡선 그리기
  useEffect(() => {
    const draw = () => {
      const c = canvas.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      const g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H);
      const fx = (f) => (Math.log10(f / 20) / Math.log10(1000)) * W; // 20Hz~20kHz
      // 대역 표시
      [[20, 250, 'LOW', 'rgba(251,191,36,.07)'], [250, 4000, 'MID', 'rgba(52,211,153,.07)'], [4000, 20000, 'HIGH', 'rgba(56,189,248,.07)']].forEach(([a, b, t, col]) => {
        g.fillStyle = col; g.fillRect(fx(a), 0, fx(b) - fx(a), H);
        g.fillStyle = '#64748b'; g.font = '600 11px "IBM Plex Sans KR",sans-serif'; g.fillText(t, fx(a) + 6, 14);
      });
      g.strokeStyle = '#1e293b'; g.lineWidth = 1; g.fillStyle = '#475569'; g.font = '10px "IBM Plex Mono",monospace';
      [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach((f) => { g.beginPath(); g.moveTo(fx(f), 18); g.lineTo(fx(f), H); g.stroke(); g.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, fx(f) + 2, H - 4); });
      const zeroY = H * 0.5;
      g.strokeStyle = '#334155'; g.beginPath(); g.moveTo(0, zeroY); g.lineTo(W, zeroY); g.stroke();
      // 스펙트럼
      const n = nodes.current;
      if (n && playing) {
        const data = new Uint8Array(n.analyser.frequencyBinCount);
        n.analyser.getByteFrequencyData(data);
        const sr = ctxRef.current.sampleRate;
        g.fillStyle = 'rgba(56,189,248,.55)';
        for (let x = 0; x < W; x += 3) {
          const f = 20 * 1000 ** (x / W);
          const bin = Math.min(data.length - 1, Math.round((f / (sr / 2)) * data.length));
          const h = (data[bin] / 255) * (H - 24);
          g.fillRect(x, H - 16 - h, 2, h);
        }
      }
      // EQ 곡선
      const cf = curveFilters.current;
      if (cf) {
        cf.hp.frequency.value = p.lowCut ? 100 : 10; cf.lo.gain.value = p.lo; cf.mid.gain.value = p.mid; cf.mid.frequency.value = p.midFreq; cf.hi.gain.value = p.hi;
        const N = 160;
        const freqs = new Float32Array(N);
        for (let i = 0; i < N; i += 1) freqs[i] = 20 * 1000 ** (i / (N - 1));
        const total = new Float32Array(N);
        const mag = new Float32Array(N), ph = new Float32Array(N);
        Object.values(cf).forEach((f) => { f.getFrequencyResponse(freqs, mag, ph); for (let i = 0; i < N; i += 1) total[i] += 20 * Math.log10(Math.max(1e-4, mag[i])); });
        g.strokeStyle = '#fbbf24'; g.lineWidth = 2.5; g.beginPath();
        for (let i = 0; i < N; i += 1) { const x = fx(freqs[i]); const y = zeroY - clamp(total[i], -24, 24) * ((H * 0.42) / 24); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
        g.fillStyle = '#fbbf24'; g.font = '600 11px "IBM Plex Sans KR",sans-serif'; g.fillText('EQ 곡선', W - 64, zeroY - 8);
      }
      if (playing) raf.current = requestAnimationFrame(draw);
    };
    cancelAnimationFrame(raf.current);
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [p, playing]);

  const clip = p.gain >= 46;
  const knob = (k, label, min, max, color, fmt = (v) => `${v > 0 ? '+' : ''}${v}`, step = 1) => (
    <RotaryKnob label={label} value={p[k]} min={min} max={max} step={step} color={color} onChange={(v) => set(k, v)} onTouch={touch(k)} display={fmt(p[k])} />
  );

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={playing ? stop : start}
          className={`px-4 py-2 rounded-md font-bold flex items-center gap-1.5 ${playing ? 'bg-slate-200 text-slate-900' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
          {playing ? <><Square size={15} /> 정지</> : <><Play size={15} /> 소리 재생</>}
        </button>
        {Object.entries(SOURCES).map(([k, [t]]) => (
          <button key={k} type="button" onClick={() => setSrc(k)}
            className={`px-2.5 py-1.5 rounded border text-xs font-bold ${src === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
        ))}
        <span className="text-xs text-slate-500">스피커나 헤드폰 볼륨을 적당히 낮추고 들어 보세요.</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-slate-400 self-center">들어 보기:</span>
        {PRESETS.map(([name, v]) => (
          <button key={name} type="button" onClick={() => { setP({ ...DEFAULT, ...v }); setTip(Object.keys(v)[0] ?? 'gain'); if (!playing) start(); }}
            className="px-2.5 py-1 rounded-full border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xs">{name}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-3">
        {/* 채널 스트립 */}
        <div className="bg-slate-950 rounded-lg border border-slate-700 p-3 flex md:flex-col flex-wrap items-center gap-3 md:w-[150px]">
          <div className="flex flex-col items-center gap-1">
            {knob('gain', 'GAIN', 0, 60, '#f87171', (v) => `+${v}dB`)}
            <span className={`text-[10px] font-bold px-1.5 rounded ${clip ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-500'}`}>CLIP</span>
          </div>
          <ToggleBtn on={p.lowCut} color="green" onClick={() => { set('lowCut', !p.lowCut); setTip('lowCut'); }}>LOW CUT 100Hz</ToggleBtn>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 justify-items-center">
            {knob('hi', 'HIGH', -15, 15, '#7dd3fc')}
            <span />
            {knob('mid', 'MID', -15, 15, '#6ee7b7')}
            {knob('midFreq', 'MID 주파수', 250, 5000, '#6ee7b7', (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`), 50)}
            {knob('lo', 'LOW', -15, 15, '#fcd34d')}
            <span />
            {knob('reverb', '리버브', 0, 100, '#c4b5fd', (v) => `${v}%`)}
            {knob('delay', '에코', 0, 100, '#c4b5fd', (v) => `${v}%`)}
            {knob('time', '에코 시간', 0.08, 0.8, '#c4b5fd', (v) => `${Math.round(v * 1000)}ms`, 0.02)}
          </div>
          <div onPointerDown={touch('fader')}>
            <VFader label="FADER" value={p.fader} onChange={(v) => set('fader', v)} display={fmtDb(faderDb(p.fader)).replace(' dB', '')} height={120} />
          </div>
        </div>
        {/* 스펙트럼 + 설명 */}
        <div className="flex flex-col gap-3 min-w-0">
          <canvas ref={canvas} className="w-full h-56 rounded-lg border border-slate-700" aria-label="주파수 스펙트럼과 EQ 곡선" />
          <div className="bg-slate-800 rounded-lg p-3 text-sm text-slate-200 leading-relaxed flex gap-2">
            <Info size={16} className="text-sky-300 shrink-0 mt-0.5" /><span>{TIPS[tip]}</span>
          </div>
          <p className="text-xs text-slate-500">파란 막대 = 지금 나오는 소리의 주파수 분포, 노란 선 = EQ·로우컷이 만드는 곡선. 노브는 위아래로 드래그하고, 더블클릭하면 초기화됩니다.</p>
        </div>
      </div>
    </div>
  );
}
