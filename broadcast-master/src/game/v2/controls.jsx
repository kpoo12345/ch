import React, { useRef } from 'react';
import { clamp } from '../engine.js';

/* =====================================================================
 * 조작 부품: 회전 노브, 토글, 단계 버튼, 세그먼트 선택
 * 노브·페이더는 드래그 중에는 onChange, 손을 뗄 때 onCommit(이전값, 새값)
 * ===================================================================== */

export function Knob({ label, value, min = 0, max = 100, step = 1, onChange, onCommit, color = '#38bdf8', size = 40, display, def, disabled, title, ctl, ariaLabel }) {
  const start = useRef(null);
  const frac = (value - min) / (max - min);
  const ang = -135 + frac * 270;
  const set = (v) => onChange?.(clamp(Math.round(v / step) * step, min, max));
  return (
    <div className={`flex flex-col items-center select-none rounded-md ${disabled ? 'opacity-40' : ''}`} title={title} data-ctl={ctl}>
      <div
        role="slider" tabIndex={disabled ? -1 : 0} aria-label={ariaLabel ?? label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        className="relative touch-none cursor-ns-resize rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        style={{ width: size, height: size }}
        onPointerDown={(e) => { if (disabled) return; e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); start.current = { y: e.clientY, x: e.clientX, v: value }; }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const d = (start.current.y - e.clientY) + (e.clientX - start.current.x) * 0.5;
          set(start.current.v + (d / 120) * (max - min));
        }}
        onPointerUp={() => { if (start.current) { onCommit?.(start.current.v, value); start.current = null; } }}
        onPointerCancel={() => { start.current = null; }}
        onDoubleClick={() => { if (def != null && !disabled) { onChange?.(def); onCommit?.(value, def); } }}
        onKeyDown={(e) => {
          if (disabled) return;
          const k = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step }[e.key];
          if (k) { e.preventDefault(); const nv = clamp(value + k * (e.shiftKey ? 5 : 1), min, max); onChange?.(nv); onCommit?.(value, nv); }
        }}
      >
        <svg viewBox="0 0 40 40" width={size} height={size}>
          <circle cx="20" cy="20" r="17" fill="#0b0f17" stroke="#334155" strokeWidth="2" />
          <path d={arc(20, 20, 17, -135, ang)} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="20" cy="20" r="11" fill="#1e293b" />
          <line x1="20" y1="20" x2={20 + 9 * Math.sin((ang * Math.PI) / 180)} y2={20 - 9 * Math.cos((ang * Math.PI) / 180)} stroke="#f8fafc" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
      {label && <span className="text-[9px] font-bold text-slate-400 leading-tight mt-0.5 whitespace-nowrap">{label}</span>}
      <span className="text-[9px] font-mono text-slate-200 tabular-nums leading-tight">{display ?? value}</span>
    </div>
  );
}
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export function Toggle({ on, onClick, children, color = 'red', title, small, disabled, ctl }) {
  const onCls = {
    red: 'bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(239,68,68,.55)]',
    amber: 'bg-amber-500 border-amber-300 text-slate-900 shadow-[0_0_10px_rgba(245,158,11,.55)]',
    green: 'bg-green-600 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,.5)]',
    sky: 'bg-sky-500 border-sky-300 text-white shadow-[0_0_10px_rgba(56,189,248,.5)]',
    cyan: 'bg-cyan-500 border-cyan-300 text-slate-900 shadow-[0_0_10px_rgba(34,211,238,.5)]',
  }[color];
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} aria-pressed={!!on} data-ctl={ctl}
      className={`${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs'} rounded border font-bold tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40 ${on ? onCls : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
      {children}
    </button>
  );
}

export function Seg({ value, options, onChange, small }) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-slate-600 overflow-hidden">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={`${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} font-semibold border-r border-slate-700 last:border-r-0 ${value === v ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, width = 'w-14', fmt = (v) => v, label }) {
  return (
    <div className="inline-flex items-center gap-1" aria-label={label}>
      <button type="button" className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold" onClick={() => onChange(clamp(value - 1, min, max))} aria-label={`${label ?? ''} 감소`}>−</button>
      <span className={`${width} text-center font-mono text-sm bg-slate-950 border border-slate-700 rounded py-1 text-slate-100 tabular-nums`}>{fmt(value)}</span>
      <button type="button" className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold" onClick={() => onChange(clamp(value + 1, min, max))} aria-label={`${label ?? ''} 증가`}>+</button>
    </div>
  );
}

export function Row({ label, children, hint }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1">
      <div className="text-xs text-slate-300">{label}{hint && <div className="text-[10px] text-slate-500">{hint}</div>}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function Card({ title, icon: Icon, children, right }) {
  return (
    <div className="bg-slate-900/70 rounded-lg p-3 border border-slate-700/80 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">{Icon && <Icon size={13} />} {title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

// 가로 슬라이더 (드래그 끝에서 onCommit)
export function HSlider({ label, value, min = 0, max = 100, step = 1, onChange, onCommit, display, accent = 'accent-sky-400' }) {
  const startRef = useRef(null);
  return (
    <label className="block">
      <div className="flex justify-between text-[11px] text-slate-400 mb-0.5"><span>{label}</span><span className="font-mono text-slate-200 tabular-nums">{display ?? value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value}
        onPointerDown={() => { startRef.current = value; }}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => { onCommit?.(startRef.current ?? value, Number(e.currentTarget.value)); startRef.current = null; }}
        onKeyUp={(e) => onCommit?.(value, Number(e.currentTarget.value))}
        className={`w-full ${accent} cursor-pointer`} />
    </label>
  );
}
