import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { AlertCircle, Monitor, User, Users, Presentation } from 'lucide-react';
import { clamp } from './engine.js';

/* =====================================================================
 * 공용 UI 부품 (효과음, 미터, 슬라이더, 토글 버튼, 섹션, 송출 화면)
 * ===================================================================== */

/* ---------------------------- 효과음 (Web Audio) ---------------------------- */
export function useSfx(enabled) {
  const ctxRef = useRef(null);
  const fbRef = useRef(null);
  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);
  const tone = useCallback((freq, dur, type = 'sine', vol = 0.08, when = 0) => {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + when;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }, [enabled, ensure]);
  const setFeedback = useCallback((on) => {
    const ctx = enabled ? ensure() : ctxRef.current;
    if (on && enabled && ctx && !fbRef.current) {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.frequency.value = 2500;
      lfo.frequency.value = 6;
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(); lfo.start();
      fbRef.current = { o, lfo, g };
    } else if ((!on || !enabled) && fbRef.current && ctx) {
      const { o, lfo, g } = fbRef.current;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      o.stop(ctx.currentTime + 0.3); lfo.stop(ctx.currentTime + 0.3);
      fbRef.current = null;
    }
  }, [enabled, ensure]);
  // 클리핑 잡음: 드문드문 튀는 임펄스 소음("지직")을 반복 재생
  const crRef = useRef(null);
  const setCrackle = useCallback((amount) => {
    const ctx = enabled && amount > 0 ? ensure() : ctxRef.current;
    if (!ctx) return;
    if (!crRef.current && amount > 0 && enabled) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() < 0.004 ? (Math.random() * 2 - 1) : (Math.random() * 2 - 1) * 0.04;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(hp).connect(g).connect(ctx.destination); src.start();
      crRef.current = { src, g };
    }
    if (crRef.current) crRef.current.g.gain.setTargetAtTime(enabled ? Math.min(0.5, amount) * 0.35 : 0, ctx.currentTime, 0.05);
  }, [enabled, ensure]);
  useEffect(() => () => { try { crRef.current?.src.stop(); } catch { /* 무시 */ } }, []);

  return useMemo(() => ({
    ensure,
    setFeedback,
    setCrackle,
    ok: () => { tone(880, 0.1); tone(1320, 0.16, 'sine', 0.08, 0.08); },
    error: () => tone(130, 0.22, 'square', 0.04),
    pop: () => tone(55, 0.18, 'sine', 0.35),
    click: () => tone(1800, 0.03, 'square', 0.02),
    clear: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.08, i * 0.12)),
  }), [tone, ensure, setFeedback, setCrackle]);
}

/* ---------------------------- 작은 UI 부품 ---------------------------- */
export function Meter({ level, target, className = '', thin }) {
  const pos = (db) => clamp(((db + 60) / 66) * 100, 0, 100);
  const pct = level == null ? 0 : pos(level);
  return (
    <div className={`relative w-full ${thin ? 'h-2' : 'h-3'} rounded-sm overflow-hidden bg-slate-950 ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to right, #16a34a 0%, #22c55e ${pos(-6)}%, #eab308 ${pos(-6)}%, #eab308 ${pos(0)}%, #ef4444 ${pos(0)}%)` }}
      />
      <div className="absolute inset-y-0 right-0 bg-slate-950/90 transition-[left] duration-75" style={{ left: `${pct}%` }} />
      {target && (
        <div className="absolute inset-y-0 border-x-2 border-white/70" style={{ left: `${pos(target[0])}%`, width: `${pos(target[1]) - pos(target[0])}%` }} />
      )}
    </div>
  );
}

export function Slider({ id, label, value, min, max, step = 1, onChange, display, accent = 'accent-sky-400', hint }) {
  return (
    <label htmlFor={id} className="block">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-slate-200 tabular-nums">{display ?? value}</span>
      </div>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accent} cursor-pointer`}
      />
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </label>
  );
}

export function ToggleBtn({ on, onClick, children, color = 'red', title }) {
  const onCls = {
    red: 'bg-red-600 border-red-400 text-white shadow-[0_0_12px_rgba(239,68,68,.6)]',
    amber: 'bg-amber-500 border-amber-300 text-slate-900 shadow-[0_0_12px_rgba(245,158,11,.6)]',
    green: 'bg-green-600 border-green-400 text-white shadow-[0_0_12px_rgba(34,197,94,.5)]',
  }[color];
  return (
    <button
      type="button" title={title} onClick={onClick}
      className={`px-3 py-1.5 rounded border text-xs font-bold tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${on ? onCls : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
    >
      {children}
    </button>
  );
}

export function Section({ title, children, icon: Icon }) {
  return (
    <div className="bg-slate-900/60 rounded-md p-3 border border-slate-700 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon size={13} />} {title}
      </div>
      {children}
    </div>
  );
}

export function Scene({ src, label = true, fade }) {
  const scenes = {
    cam1: { cls: 'bg-gradient-to-br from-sky-700 via-indigo-800 to-slate-900', icon: User, text: '진행자 클로즈업' },
    cam2: { cls: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900', icon: Users, text: '스튜디오 와이드샷' },
    facecam: { cls: 'bg-gradient-to-br from-stone-500 to-stone-800', icon: Monitor, text: 'PC 내장 웹캠 (저화질)' },
    slides: { cls: 'bg-slate-100', icon: Presentation, text: 'PC 슬라이드', dark: true },
    black: { cls: 'bg-black', icon: null, text: 'PGM: BLACK' },
    nosignal: { cls: 'bg-slate-950', icon: AlertCircle, text: 'NO SIGNAL' },
    none: { cls: 'bg-slate-950', icon: null, text: '영상 소스 없음' },
  };
  const s = scenes[src] ?? scenes.none;
  const Icon = s.icon;
  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center ${s.cls} transition-opacity duration-500 ${fade ? 'opacity-40' : 'opacity-100'}`}>
      {Icon && <Icon className={s.dark ? 'text-blue-800' : 'text-white/80'} size={label ? 28 : 16} />}
      {label && <span className={`text-[10px] mt-1 ${s.dark ? 'text-slate-700' : 'text-white/70'}`}>{s.text}</span>}
      {src === 'cam1' || src === 'cam2' ? <span className="absolute bottom-1 left-1.5 text-[8px] text-white/60 font-mono">● REC</span> : null}
    </div>
  );
}

// 진도 저장 (브라우저 저장소, 실패해도 게임은 정상 동작)
export const loadProgress = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
export const saveProgress = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 무시 */ } };

/* ---------------------------- 음성 (마이크 테스트 / 진행자) ----------------------------
 * 브라우저 음성 합성(speechSynthesis)으로 실제 말소리를 낸다.
 * volume(0~1)은 "듣는 위치"까지 도착한 신호 크기로 정해지고, 0이면 아무것도 들리지 않는다. */
export const VOICE_TEST = ['아, 아, 마이크 테스트.', '하나, 둘, 셋. 마이크 테스트 중입니다.', '잘 들리시나요?'];
export const VOICE_HOST = [
  '안녕하세요, 방송장비 마스터 강의를 시작하겠습니다.',
  '오늘은 마이크에서 송출까지 신호가 어떻게 흐르는지 알아보겠습니다.',
  '소리는 마이크와 믹서를 거쳐 스피커와 방송으로 나갑니다.',
  '채팅으로 질문을 남겨 주시면 답변 드리겠습니다.',
];
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function useVoice({ enabled, active, volume, phrases, rate = 1.05 }) {
  const idx = useRef(0);
  const voiceRef = useRef(null);
  const ok = speechSupported();
  useEffect(() => {
    if (!ok) return undefined;
    const synth = window.speechSynthesis;
    const pick = () => { voiceRef.current = synth.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('ko')) ?? null; };
    pick();
    synth.addEventListener?.('voiceschanged', pick);
    return () => synth.removeEventListener?.('voiceschanged', pick);
  }, [ok]);
  const vb = Math.round(Math.max(0, Math.min(1, volume)) * 8) / 8; // 단계로 묶어 너무 자주 끊기지 않게
  useEffect(() => {
    if (!ok) return undefined;
    const synth = window.speechSynthesis;
    if (!enabled || !active || vb <= 0) { synth.cancel(); return undefined; }
    let alive = true;
    let timer = null;
    const speakNext = () => {
      if (!alive) return;
      const u = new window.SpeechSynthesisUtterance(phrases[idx.current % phrases.length]);
      idx.current += 1;
      u.lang = 'ko-KR';
      if (voiceRef.current) u.voice = voiceRef.current;
      u.volume = vb;
      u.rate = rate;
      u.onend = () => { if (alive) timer = setTimeout(speakNext, 300); };
      synth.speak(u);
    };
    synth.cancel();
    timer = setTimeout(speakNext, 80);
    return () => { alive = false; clearTimeout(timer); synth.cancel(); };
  }, [ok, enabled, active, vb, phrases, rate]);
  return ok;
}

/* ---------------------------- 세로 페이더 / 세로 미터 ---------------------------- */
const FADER_TICKS = [[100, '+10'], [75, '0'], [50, '-20'], [25, '-40'], [0, '-∞']];
export function VFader({ label, value, onChange, onCommit, display, cap = '#e5e7eb', height = 140 }) {
  const ref = useRef(null);
  const startRef = useRef(null);
  const CAP_H = 22;
  const setFrom = (clientY) => {
    const r = ref.current.getBoundingClientRect();
    const v = Math.round((1 - (clientY - r.top - CAP_H / 2) / (r.height - CAP_H)) * 100);
    onChange(clamp(v, 0, 100));
  };
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <span className="text-[10px] font-mono text-slate-200 tabular-nums h-3.5">{display}</span>
      <div className="flex items-stretch gap-1" style={{ height }}>
        <div className="relative w-5 text-[8px] text-slate-500 font-mono">
          {FADER_TICKS.map(([v, t]) => (
            <span key={t} className="absolute right-0 leading-none" style={{ bottom: `${(v / 100) * (height - CAP_H) + CAP_H / 2 - 4}px` }}>{t}</span>
          ))}
        </div>
        <div
          ref={ref} role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={display}
          onPointerDown={(e) => { e.preventDefault(); startRef.current = value; e.currentTarget.setPointerCapture?.(e.pointerId); setFrom(e.clientY); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture?.(e.pointerId)) setFrom(e.clientY); }}
          onPointerUp={() => { if (startRef.current != null) { onCommit?.(startRef.current, value); startRef.current = null; } }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + 2, 0, 100)); }
            if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 2, 0, 100)); }
          }}
          className="relative w-10 touch-none cursor-ns-resize rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <div className="absolute left-1/2 -translate-x-1/2 w-1.5 rounded bg-black border border-slate-700" style={{ top: CAP_H / 2, bottom: CAP_H / 2 }} />
          <div className="absolute left-1/2 -translate-x-1/2 w-4 h-px bg-slate-400" style={{ bottom: 0.75 * (height - CAP_H) + CAP_H / 2 }} />
          <div className="absolute left-0 right-0 rounded-sm border border-black/40 shadow-md"
            style={{ height: CAP_H, bottom: (value / 100) * (height - CAP_H), background: `linear-gradient(${cap}, #6b7280)` }}>
            <div className="absolute left-1 right-1 top-1/2 h-0.5 bg-black/70" />
          </div>
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-300">{label}</span>
    </div>
  );
}

export function VMeter({ level, height = 140 }) {
  const pct = level == null ? 0 : clamp(((level + 60) / 66) * 100, 0, 100);
  const pos = (db) => ((db + 60) / 66) * 100;
  return (
    <div className="relative w-2.5 rounded-sm overflow-hidden bg-slate-950" style={{ height }} aria-hidden="true">
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, #16a34a 0%, #22c55e ${pos(-6)}%, #eab308 ${pos(-6)}%, #eab308 ${pos(0)}%, #ef4444 ${pos(0)}%)` }} />
      <div className="absolute inset-x-0 top-0 bg-slate-950/90 transition-[bottom] duration-75" style={{ bottom: `${pct}%` }} />
    </div>
  );
}
