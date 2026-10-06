import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Info } from 'lucide-react';
import { VFader } from './ui.jsx';
import { faderDb, fmtDb } from './engine.js';

/* =====================================================================
 * 페이드 실습실 — "페이드(Fade)"를 귀와 눈으로 느껴 본다
 *  - CUT(뚝 끊기) vs 페이드 아웃/인 vs 크로스페이드(A → B)
 *  - 페이더를 직접 손으로 내려 보며 그래프로 확인
 *  - 영상의 디졸브(ATEM AUTO)·FTB, 조명의 페이드 타임이 같은 개념이라는 것을 화면으로 함께 보여 준다
 * ===================================================================== */

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
const gainOf = (v) => (v <= 0 ? 0 : 10 ** (faderDb(v) / 20)); // 페이더 위치 → 소리 크기
const HISTORY = 8; // 그래프에 보이는 시간(초)

// 음악 두 곡 (A: 잔잔한 BGM, B: 밝은 입장곡) — 같은 박자로 계속 연주
function startSongs(ctx, outA, outB) {
  const step = 60 / 96 / 4;
  const env = (t, vol, dur, a = 0.01) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); return g; };
  const note = (out, t, n, dur, type, vol, cut = 3000, a) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = midi(n);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut;
    o.connect(f).connect(env(t, vol, dur, a)).connect(out); o.start(t); o.stop(t + dur + 0.05);
  };
  const A = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];
  const melA = [76, null, null, 74, null, 72, null, null, 71, null, 72, null, 67, null, null, null];
  const B = [[62, 66, 69], [67, 71, 74], [64, 67, 71], [69, 73, 76]];
  const melB = [74, 76, 78, null, 81, null, 78, 76, 74, null, 71, 74, 76, null, 78, null];
  let next = ctx.currentTime + 0.1;
  let i = 0;
  const tick = () => {
    while (next < ctx.currentTime + 0.4) {
      const s = i % 16, bar = Math.floor(i / 16) % 4;
      if (s === 0 || s === 8) A[bar].forEach((n, k) => note(outA, next + k * 0.01, n, step * 7.5, 'sine', 0.08, 2200, 0.3));
      if (s % 4 === 0) note(outA, next, A[bar][0] - 24, step * 3.5, 'triangle', 0.22, 600);
      if (melA[s]) note(outA, next, melA[s], step * 3, 'triangle', 0.1, 3500);
      if (s % 2 === 0) B[bar].forEach((n, k) => note(outB, next + k * 0.005, n, step * 1.5, 'square', 0.025, 2600));
      if (s % 4 === 0) note(outB, next, B[bar][0] - 24, step * 2, 'sawtooth', 0.12, 700);
      if (melB[s]) note(outB, next, melB[s], step * 1.6, 'sawtooth', 0.05, 4500);
      next += step;
      i += 1;
    }
  };
  tick();
  const id = setInterval(tick, 100);
  return () => clearInterval(id);
}

const MODES = {
  cut: { label: 'CUT 끄기 (뚝)', desc: '페이더를 한 번에 내린 것과 같습니다. 노래가 중간에 "뚝" 끊겨 듣는 사람이 깜짝 놀라고, 방송에서는 사고처럼 들립니다.' },
  out: { label: '페이드 아웃', desc: '소리를 몇 초에 걸쳐 서서히 줄여 없애는 것. 강연자가 말을 시작하기 전 BGM, 방송 끝 음악을 이렇게 끕니다.' },
  in: { label: '페이드 인', desc: '0에서 서서히 키우는 것. 방송 시작이나 입장 음악을 자연스럽게 올릴 때 씁니다.' },
  cross: { label: '크로스페이드 A → B', desc: 'A를 줄이는 동시에 B를 올려 자연스럽게 바꾸는 것. 영상의 디졸브(ATEM AUTO·MIX), DJ 믹스, OBS 전환 효과가 모두 같은 원리입니다.' },
};

export default function FadeLab() {
  const ctxRef = useRef(null);
  const nodes = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [a, setA] = useState(75);
  const [b, setB] = useState(0);
  const [dur, setDur] = useState(3);
  const [mode, setMode] = useState(null);
  const anim = useRef(null); // { from:{a,b}, to:{a,b}, t0, dur }
  const vals = useRef({ a: 75, b: 0 });
  const hist = useRef([]);
  const canvas = useRef(null);
  const video = useRef(null);

  // 오디오 시작/정지
  const start = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const gA = ctx.createGain(), gB = ctx.createGain();
    gA.gain.value = gainOf(vals.current.a); gB.gain.value = gainOf(vals.current.b);
    gA.connect(master); gB.connect(master);
    const stopSongs = startSongs(ctx, gA, gB);
    ctxRef.current = ctx; nodes.current = { gA, gB, stopSongs };
    setPlaying(true);
  };
  const stop = () => {
    nodes.current?.stopSongs();
    ctxRef.current?.close();
    ctxRef.current = null; nodes.current = null;
    setPlaying(false);
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // 페이더 값 → 소리 (손으로 움직일 때도, 자동 페이드 중에도)
  const apply = (na, nb) => {
    vals.current = { a: na, b: nb };
    const n = nodes.current, ctx = ctxRef.current;
    if (n && ctx) {
      n.gA.gain.setTargetAtTime(gainOf(na), ctx.currentTime, 0.015);
      n.gB.gain.setTargetAtTime(gainOf(nb), ctx.currentTime, 0.015);
    }
  };
  const run = (m) => {
    setMode(m);
    const from = { ...vals.current };
    if (m === 'cut') { anim.current = null; setA(0); setB(vals.current.b); apply(0, vals.current.b); return; }
    const to = m === 'out' ? { a: 0, b: from.b } : m === 'in' ? { a: 75, b: from.b } : { a: from.a > 0 ? 0 : 75, b: from.a > 0 ? 75 : 0 };
    if (m === 'in' && from.a > 0) from.a = 0;
    anim.current = { from, to, t0: performance.now(), dur: dur * 1000 };
  };

  // 애니메이션 + 그래프 + 영상 비유 화면
  useEffect(() => {
    let raf;
    const loop = () => {
      const an = anim.current;
      if (an) {
        const k = Math.min(1, (performance.now() - an.t0) / an.dur);
        const na = an.from.a + (an.to.a - an.from.a) * k, nb = an.from.b + (an.to.b - an.from.b) * k;
        apply(na, nb); setA(Math.round(na)); setB(Math.round(nb));
        if (k >= 1) anim.current = null;
      }
      const now = performance.now() / 1000;
      hist.current.push([now, vals.current.a, vals.current.b]);
      while (hist.current.length && hist.current[0][0] < now - HISTORY) hist.current.shift();
      drawGraph(canvas.current, hist.current, now);
      drawVideo(video.current, vals.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const manual = (which) => (v) => { anim.current = null; setMode(null); if (which === 'a') { setA(v); apply(v, vals.current.b); } else { setB(v); apply(vals.current.a, v); } };

  return (
    <div className="p-3 sm:p-4 space-y-3 text-slate-100">
      <div className="flex flex-wrap items-center gap-2">
        {playing
          ? <button type="button" onClick={stop} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-bold"><Square size={15} /> 정지</button>
          : <button type="button" onClick={start} className="flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-bold text-white"><Play size={15} /> 음악 재생</button>}
        <span className="text-xs text-slate-400">페이드 시간</span>
        {[1, 3, 6].map((s) => (
          <button key={s} type="button" onClick={() => setDur(s)} className={`rounded px-2 py-1 text-xs font-bold ${dur === s ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'}`}>{s}초</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(MODES).map(([k, m]) => (
          <button key={k} type="button" onClick={() => run(k)} disabled={!playing}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-40 ${mode === k ? 'bg-violet-500 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}>{m.label}</button>
        ))}
      </div>
      {mode && <p className="text-sm text-violet-100 bg-violet-950/40 border border-violet-500/40 rounded-lg px-3 py-2">{MODES[mode].desc}</p>}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-2 items-end rounded-lg border border-slate-700 bg-slate-900/70 p-2">
          <VFader label="음악 A 페이더" value={a} onChange={manual('a')} display={fmtDb(faderDb(a)).replace(' dB', '')} cap="#fbbf24" height={170} />
          <VFader label="음악 B 페이더" value={b} onChange={manual('b')} display={fmtDb(faderDb(b)).replace(' dB', '')} cap="#38bdf8" height={170} />
          <div className="text-[10px] text-slate-400 w-16 leading-tight">손으로 직접 내려 보세요. 일정한 속도로 2~3초에 걸쳐 내리면 그게 페이드 아웃입니다.</div>
        </div>
        <div className="flex-1 min-w-[240px] space-y-1">
          <div className="text-[11px] text-slate-400">소리 크기 변화 (최근 {HISTORY}초) — <span className="text-amber-300">A</span> · <span className="text-sky-300">B</span></div>
          <canvas ref={canvas} width={560} height={150} className="w-full rounded-lg border border-slate-700 bg-[#0b1220]" />
        </div>
        <div className="space-y-1">
          <div className="text-[11px] text-slate-400">영상으로 보면 (A 화면 → B 화면)</div>
          <canvas ref={video} width={240} height={135} className="rounded-lg border border-slate-700" />
        </div>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm leading-relaxed space-y-1.5">
        <div className="flex items-center gap-1 font-bold text-sky-300"><Info size={15} /> 페이더 vs 페이드</div>
        <p><b>페이더(Fader)</b>는 밀어 올리고 내리는 <b>부품</b>(슬라이드 볼륨)이고, <b>페이드(Fade)</b>는 소리·화면·조명을 몇 초에 걸쳐 <b>서서히 바꾸는 동작</b>입니다. 페이더를 천천히 움직이면 페이드가 되고, 한 번에 내리면 CUT이 됩니다.</p>
        <p>현장에서는 이렇게 씁니다: 강연자가 걸어 나오면 BGM을 <b>3~5초 페이드 아웃</b> → 마이크 ON. 방송 시작은 음악 <b>페이드 인</b>, 끝은 음악 페이드 아웃과 함께 영상 <b>FTB(Fade To Black)</b>. 조명 콘솔의 큐에는 <b>페이드 타임</b>(예: 2초)이 들어 있어 밝기가 부드럽게 바뀝니다.</p>
        <p className="text-slate-400">요령: 페이더 눈금은 아래로 갈수록 dB 간격이 넓어집니다. 소리가 거의 안 들리는 아래쪽(-30dB 이하)에서는 조금 더 천천히 내려야 끝이 자연스럽습니다.</p>
      </div>
    </div>
  );
}

function drawGraph(cv, h, now) {
  if (!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
  for (let s = 0; s <= HISTORY; s += 1) { const x = (s / HISTORY) * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  [0.25, 0.5, 0.75].forEach((f) => { ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke(); });
  const y = (v) => H - 6 - (Math.min(100, v) / 100) * (H - 12);
  [[1, '#fbbf24'], [2, '#38bdf8']].forEach(([k, c]) => {
    ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath();
    h.forEach((p, i) => { const x = W - ((now - p[0]) / HISTORY) * W; if (i === 0) ctx.moveTo(x, y(p[k])); else ctx.lineTo(x, y(p[k])); });
    ctx.stroke();
  });
  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif'; ctx.fillText('지금', W - 26, 12); ctx.fillText(`${HISTORY}초 전`, 4, 12);
}

// A 화면(따뜻한 무대)과 B 화면(파란 화면)을 페이더 값에 따라 섞는다 = 디졸브
function drawVideo(cv, v) {
  if (!cv) return;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const ga = Math.min(1, gainOf(v.a)), gb = Math.min(1, gainOf(v.b));
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = ga;
  let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#7c2d12'); g.addColorStop(1, '#f59e0b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(W * 0.3, H * 0.55, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('A', 10, 22);
  ctx.globalAlpha = gb;
  g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1e3a8a'); g.addColorStop(1, '#38bdf8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e0f2fe'; ctx.fillRect(W * 0.55, H * 0.35, 60, 40);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('B', W - 22, 22);
  ctx.globalAlpha = 1;
  if (ga < 0.02 && gb < 0.02) { ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('FTB (검은 화면)', W / 2 - 50, H / 2 + 4); }
}
