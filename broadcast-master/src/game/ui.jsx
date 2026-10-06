import React, { useRef, useMemo, useCallback } from 'react';
import { AlertCircle, Monitor, User, Users } from 'lucide-react';
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
  return useMemo(() => ({
    ensure,
    setFeedback,
    ok: () => { tone(880, 0.1); tone(1320, 0.16, 'sine', 0.08, 0.08); },
    error: () => tone(130, 0.22, 'square', 0.04),
    pop: () => tone(55, 0.18, 'sine', 0.35),
    click: () => tone(1800, 0.03, 'square', 0.02),
    clear: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.08, i * 0.12)),
  }), [tone, ensure, setFeedback]);
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
    black: { cls: 'bg-black', icon: null, text: 'PGM: BLACK' },
    nosignal: { cls: 'bg-slate-950', icon: AlertCircle, text: 'NO SIGNAL' },
    none: { cls: 'bg-slate-950', icon: null, text: '영상 소스 없음' },
  };
  const s = scenes[src] ?? scenes.none;
  const Icon = s.icon;
  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center ${s.cls} transition-opacity duration-500 ${fade ? 'opacity-40' : 'opacity-100'}`}>
      {Icon && <Icon className="text-white/80" size={label ? 28 : 16} />}
      {label && <span className="text-[10px] text-white/70 mt-1">{s.text}</span>}
      {src === 'cam1' || src === 'cam2' ? <span className="absolute bottom-1 left-1.5 text-[8px] text-white/60 font-mono">● REC</span> : null}
    </div>
  );
}

/* =====================================================================
 * 메인 컴포넌트
 * ===================================================================== */

// 진도 저장 (브라우저 저장소, 실패해도 게임은 정상 동작)
export const loadProgress = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
export const saveProgress = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 무시 */ } };
