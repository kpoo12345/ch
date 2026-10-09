import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, CheckCircle2, XCircle, Lightbulb, AlertTriangle, MapPin, Cpu, Plug, Play,
  Mic, SlidersHorizontal, Camera, Tv, MonitorPlay, Cable, GraduationCap, ArrowRight, AudioLines, Workflow, Check, Lightbulb as LightIcon, Clapperboard,
} from 'lucide-react';
import { CLIPS } from './scenes.js';
import { DEVICE_TYPES, PORT_KIND_LABEL, PORT_COLOR, CABLES, MIXER_DEFAULT, MIC_LEVEL, faderDb, fmtDb } from './engine.js';
import { EquipmentViewer, CableShowcase, MixerSizeViewer } from './Studio3D.jsx';
import AudioLab from './AudioLab.jsx';
import FadeLab from './FadeLab.jsx';
import { Meter, Slider, ToggleBtn, Scene, loadProgress, saveProgress } from './ui.jsx';

/* =====================================================================
 * 개념 그림 — 백과사전과 튜토리얼이 함께 쓰는 설명 그림들 (CONCEPT[key])
 * ===================================================================== */

/* ---------------------------- 기초 개념 그림 ---------------------------- */
function FlowVisual() {
  const chains = [
    ['오디오', ['마이크', '믹서', '스피커 / PC'], 'bg-sky-400'],
    ['비디오', ['카메라', '스위처', 'PC / 모니터'], 'bg-purple-400'],
  ];
  return (
    <div className="space-y-6 p-6">
      {chains.map(([name, nodes, dot]) => (
        <div key={name}>
          <div className="text-xs text-slate-400 mb-2">{name}</div>
          <div className="relative flex items-center justify-between gap-2">
            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-600" />
            <span className={`absolute top-1/2 -mt-1.5 w-3 h-3 rounded-full ${dot} bm-travel`} />
            {nodes.map((n, i) => (
              <div key={n} className="relative z-10 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-bold text-center min-w-0">
                <div className="text-[10px] text-slate-400">{['소스', '처리', '출력'][i]}</div>{n}
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400 text-center">점이 신호입니다. 출력(OUT)에서 나와 다음 장비의 입력(IN)으로 들어갑니다.</p>
    </div>
  );
}

function GainVisual() {
  const [gain, setGain] = useState(15);
  const level = MIC_LEVEL + gain;
  const state = level > 0 ? ['클리핑! 소리가 찌그러집니다', 'text-red-400'] : level > -6 ? ['너무 큼: 여유(헤드룸)가 부족합니다', 'text-amber-300'] : level >= -24 ? ['적정 레벨', 'text-green-400'] : ['너무 작음: 키우면 잡음도 커집니다', 'text-slate-300'];
  return (
    <div className="p-6 space-y-4">
      <Slider id="concept-gain" label="입력 GAIN" value={gain} min={0} max={60} onChange={setGain} display={`+${gain} dB`} accent="accent-red-400" />
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1"><span>입력 미터 (말할 때)</span><span className="font-mono">{fmtDb(level)}</span></div>
        <Meter level={level} target={[-20, -6]} />
      </div>
      <p className={`text-lg font-bold ${state[1]}`}>{state[0]}</p>
      <p className="text-xs text-slate-400">흰 테두리가 목표 구간(-20 ~ -6 dB)입니다. GAIN을 움직여 맞춰 보세요.</p>
    </div>
  );
}

function FeedbackVisual() {
  const [vol, setVol] = useState(40);
  const [front, setFront] = useState(true);
  const loop = (vol - 55) / 2 + (front ? 8 : -6);
  const howl = loop >= 0;
  return (
    <div className="p-6 space-y-4">
      <svg viewBox="0 0 360 170" className="w-full max-w-md mx-auto block" role="img" aria-label="하울링 피드백 루프 그림">
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={howl ? '#ef4444' : '#64748b'} /></marker></defs>
        {[[40, '마이크'], [180, '믹서'], [320, '스피커']].map(([x, t]) => (
          <g key={t}><rect x={x - 38} y={20} width={76} height={36} rx={8} fill="#1e293b" stroke="#475569" /><text x={x} y={43} textAnchor="middle" fill="#e2e8f0" fontSize="13">{t}</text></g>
        ))}
        <line x1={80} y1={38} x2={140} y2={38} stroke="#64748b" strokeWidth="2" markerEnd="url(#arr)" />
        <line x1={220} y1={38} x2={280} y2={38} stroke="#64748b" strokeWidth="2" markerEnd="url(#arr)" />
        <path d="M320 58 Q 180 170 40 58" fill="none" stroke={howl ? '#ef4444' : '#64748b'} strokeWidth={howl ? 4 : 2} strokeDasharray="6 5" markerEnd="url(#arr)" className={howl ? 'bm-flow' : ''} />
        <text x={180} y={150} textAnchor="middle" fill={howl ? '#f87171' : '#94a3b8'} fontSize="12">공기를 통해 다시 마이크로 ({front ? '스피커가 마이크를 향함' : '스피커가 객석을 향함'})</text>
      </svg>
      <Slider id="concept-fb" label="볼륨(루프 이득)" value={vol} min={0} max={100} onChange={setVol} display={`${vol}%`} accent="accent-red-400" />
      <div className="flex flex-wrap items-center gap-2">
        <ToggleBtn on={front} onClick={() => setFront(!front)}>스피커가 마이크 정면</ToggleBtn>
        <span className={`text-lg font-bold ${howl ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>{howl ? '삐이이— 하울링!' : '안정적'}</span>
      </div>
    </div>
  );
}

function PgmPvwVisual() {
  const [pgm, setPgm] = useState('cam1');
  const [pvw, setPvw] = useState('cam2');
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[['PVW · 다음 화면', pvw, 'border-green-500'], ['PGM · 송출 중', pgm, 'border-red-500']].map(([t, src, b]) => (
          <div key={t}>
            <div className="text-xs font-bold mb-1 text-slate-300">{t}</div>
            <div className={`aspect-video rounded overflow-hidden border-4 ${b}`}><Scene src={src} /></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400">PVW 선택:</span>
        {['cam1', 'cam2'].map((c) => (
          <button key={c} type="button" onClick={() => setPvw(c)} className={`px-3 py-1.5 rounded border text-xs font-bold ${pvw === c ? 'bg-green-700 border-green-400' : 'bg-slate-800 border-slate-600'}`}>{c === 'cam1' ? '카메라 1' : '카메라 2'}</button>
        ))}
        <button type="button" onClick={() => { setPgm(pvw); setPvw(pgm); }} className="ml-auto px-5 py-2 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
      </div>
    </div>
  );
}

const LEVEL_ROWS = [
  ['마이크 레벨', -50, '다이나믹 마이크 출력', 'bg-sky-400'],
  ['악기 레벨', -20, '전기기타·베이스 픽업', 'bg-amber-400'],
  ['라인 레벨 (가정용 -10 dBV)', -8, 'PC·스마트폰·키보드 출력', 'bg-violet-400'],
  ['라인 레벨 (프로 +4 dBu)', 4, '믹서 MAIN OUT, 오디오 장비 사이', 'bg-emerald-400'],
  ['스피커 레벨', 32, '파워앰프 → 패시브 스피커 (수십 V)', 'bg-red-400'],
];
const LEVEL_PATHS = {
  마이크: ['마이크 (마이크 레벨)', '프리앰프 GAIN: 믹서 MIC 입력 또는 오디오 인터페이스', '라인 레벨로 처리·출력'],
  전기기타: ['기타 (악기 레벨)', 'DI 박스 또는 인터페이스 INST 입력', '믹서 MIC 입력 (XLR)'],
  키보드: ['키보드 (라인, 언밸런스드)', '무대가 멀면 DI 박스로 밸런스드 변환', '믹서 입력'],
  'PC 음원': ['PC 헤드폰 출력 (가정용 라인)', '3.5mm → TRS/RCA 케이블', '믹서 LINE 입력 (GAIN 낮게)'],
};
function LevelsVisual() {
  const [src, setSrc] = useState('마이크');
  const pos = (db) => ((db + 60) / 100) * 100;
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-2.5">
        {LEVEL_ROWS.map(([name, db, ex, color]) => (
          <div key={name}>
            <div className="flex justify-between text-xs"><span className="text-slate-200 font-semibold">{name}</span><span className="text-slate-400 font-mono">{db > 0 ? '+' : ''}{db} dBu · {ex}</span></div>
            <div className="h-3 rounded bg-slate-800 overflow-hidden mt-1"><div className={`h-full ${color}`} style={{ width: `${pos(db)}%` }} /></div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs text-slate-400 mb-1.5">이 소스는 어디에 연결할까?</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.keys(LEVEL_PATHS).map((k) => (
            <button key={k} type="button" onClick={() => setSrc(k)} className={`px-3 py-1.5 rounded border text-xs font-bold ${src === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{k}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {LEVEL_PATHS[src].map((step, i) => (
            <React.Fragment key={step}>
              {i > 0 && <ArrowRight size={14} className="text-slate-500" />}
              <span className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600">{step}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

const F_STOPS = [1.8, 2.8, 4, 5.6, 8, 11, 16];
const SHUTTERS = [30, 60, 125, 250, 500, 1000];
const ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
function CamSettingsVisual() {
  const [fi, setFi] = useState(1);
  const [si, setSi] = useState(1);
  const [ii, setIi] = useState(2);
  const [wb, setWb] = useState(5600);
  const f = F_STOPS[fi], sh = SHUTTERS[si], iso = ISOS[ii];
  const ev = Math.log2(iso / 400) + Math.log2(60 / sh) + 2 * Math.log2(2.8 / f); // 0 = 적정
  const bright = Math.min(2.6, Math.max(0.12, 2 ** (ev * 0.55)));
  const bgBlur = Math.max(0, (5.6 / f - 0.6) * 3.5);
  const motionBlur = Math.max(0, (60 / sh) * 2.5 - 1);
  const noise = Math.min(0.55, Math.max(0, Math.log2(iso / 400) * 0.13));
  const wbShift = (wb - 5600) / 2400; // + 따뜻함(주황), - 차가움(파랑)
  const status = ev > 0.8 ? ['너무 밝음 (과다 노출)', 'text-amber-300'] : ev < -0.8 ? ['너무 어두움 (노출 부족)', 'text-sky-300'] : ['적정 노출', 'text-green-400'];
  return (
    <div className="p-5 space-y-4">
      <style>{`@keyframes bm-wave { 0%,100% { transform: translateX(0) } 50% { transform: translateX(46px) } } .bm-wave { animation: bm-wave 1.2s ease-in-out infinite; }`}</style>
      <div className="relative mx-auto w-full max-w-md aspect-video rounded-lg overflow-hidden border border-slate-600" style={{ filter: `brightness(${bright})` }}>
        <div className="absolute inset-0" style={{ filter: `blur(${bgBlur}px)`, background: 'linear-gradient(180deg,#334155,#1e293b 60%,#3f3a33 60%)' }}>
          {[12, 30, 52, 70, 86].map((x, i) => <span key={x} className="absolute rounded-full" style={{ left: `${x}%`, top: `${14 + (i % 2) * 10}%`, width: 18, height: 18, background: i % 2 ? '#fde68a' : '#fca5a5', opacity: 0.8 }} />)}
          <div className="absolute left-[8%] right-[8%] top-[52%] h-[8%] bg-slate-500/50" />
        </div>
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[34%] h-[78%]">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[46%] aspect-square rounded-full bg-[#e0b896]" />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[48%] h-[22%] rounded-t-full bg-[#3f2a1d]" />
          <div className="absolute bottom-0 left-0 right-0 h-[52%] rounded-t-[40%] bg-[#3b5b8f]" />
          <div className="absolute right-[-18%] top-[34%] w-[26%] aspect-square rounded-full bg-[#e0b896] bm-wave" style={{ filter: `blur(${motionBlur}px)` }} />
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: wbShift > 0 ? `rgba(255,140,30,${Math.min(0.5, wbShift * 0.45)})` : `rgba(40,120,255,${Math.min(0.5, -wbShift * 0.45)})`, mixBlendMode: 'overlay' }} />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: noise }} aria-hidden="true">
          <filter id="bm-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#bm-noise)" />
        </svg>
      </div>
      <p className={`text-center font-bold ${status[1]}`}>{status[0]}{bgBlur > 3 ? ' · 배경 흐림' : ''}{motionBlur > 2 ? ' · 손 움직임 번짐' : ''}{noise > 0.25 ? ' · 노이즈 많음' : ''}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Slider id="cs-f" label="조리개 (f값)" value={fi} min={0} max={F_STOPS.length - 1} onChange={setFi} display={`f/${f}`} />
        <Slider id="cs-s" label="셔터 속도" value={si} min={0} max={SHUTTERS.length - 1} onChange={setSi} display={`1/${sh}초`} />
        <Slider id="cs-i" label="ISO 감도" value={ii} min={0} max={ISOS.length - 1} onChange={setIi} display={`ISO ${iso}`} />
        <Slider id="cs-wb" label="화이트밸런스 (조명: 5600K)" value={wb} min={3200} max={7500} step={100} onChange={setWb} display={`${wb}K`} accent="accent-amber-300" />
      </div>
    </div>
  );
}

const MV_SRC = { 1: 'cam1', 2: 'cam2', 3: 'slides', 4: 'nosignal' };
function MultiviewVisual() {
  const [pgm, setPgm] = useState(1);
  const [pvw, setPvw] = useState(2);
  const [mix, setMix] = useState(false);
  const auto = () => { setMix(true); setTimeout(() => { setPgm(pvw); setPvw(pgm); setMix(false); }, 700); };
  return (
    <div className="p-4 space-y-3">
      <div className="bg-black rounded-lg p-1.5 grid grid-cols-2 gap-1.5 max-w-xl mx-auto">
        {[['PREVIEW', pvw, 'border-green-500'], ['PROGRAM', pgm, 'border-red-500']].map(([t, n, b]) => (
          <div key={t} className={`relative aspect-video border-4 ${b}`}>
            <Scene src={MV_SRC[n]} fade={t === 'PROGRAM' && mix} />
            <span className="absolute left-1.5 bottom-1 text-[10px] font-bold text-white drop-shadow">{t}</span>
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setPvw(n)} aria-label={`입력 ${n}을 PVW로`}
              className={`relative aspect-video border-[3px] ${n === pgm ? 'border-red-500' : n === pvw ? 'border-green-500' : 'border-slate-700'}`}>
              <Scene src={MV_SRC[n]} label={false} />
              <span className="absolute left-1 bottom-0.5 text-[9px] font-bold text-white drop-shadow">{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={() => { setPgm(pvw); setPvw(pgm); }} className="px-5 py-2 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
        <button type="button" onClick={auto} className="px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 font-black">AUTO</button>
      </div>
      <p className="text-xs text-slate-400 text-center">아래 입력 화면을 누르면 PVW로 올라갑니다. CUT/AUTO로 PGM과 맞바꿔 보세요.</p>
    </div>
  );
}

function TransitionsVisual() {
  const [cur, setCur] = useState('cam1');
  const [next, setNext] = useState('slides');
  const [anim, setAnim] = useState(null); // { type, key }
  const [pip, setPip] = useState(false);
  const run = (type) => {
    if (anim) return;
    if (type === 'CUT') { setCur(next); setNext(cur); return; }
    setAnim({ type, key: Date.now() });
    setTimeout(() => { setCur(next); setNext(cur); setAnim(null); }, 1000);
  };
  const cls = anim ? { MIX: 'bm-t-mix', DIP: 'bm-t-dipin', WIPE: 'bm-t-wipe' }[anim.type] : '';
  return (
    <div className="p-5 space-y-3">
      <style>{`
        @keyframes bm-t-mix { from { opacity: 0 } to { opacity: 1 } } .bm-t-mix { animation: bm-t-mix 1s linear forwards; }
        @keyframes bm-t-dipin { 0%,50% { opacity: 0 } 100% { opacity: 1 } } .bm-t-dipin { animation: bm-t-dipin 1s linear forwards; }
        @keyframes bm-t-dip { 0% { opacity: 0 } 50% { opacity: 1 } 100% { opacity: 0 } } .bm-t-dip { animation: bm-t-dip 1s linear forwards; }
        @keyframes bm-t-wipe { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } } .bm-t-wipe { animation: bm-t-wipe 1s ease-in-out forwards; }
      `}</style>
      <div className="relative mx-auto w-full max-w-md aspect-video rounded-lg overflow-hidden border-4 border-red-500">
        <div className="absolute inset-0"><Scene src={cur} /></div>
        {anim && <div key={anim.key} className={`absolute inset-0 ${cls}`} style={{ opacity: anim.type === 'WIPE' ? 1 : 0 }}><Scene src={next} /></div>}
        {anim?.type === 'DIP' && <div key={`d${anim.key}`} className="absolute inset-0 bg-black bm-t-dip" />}
        {pip && (
          <div className="absolute right-2 bottom-2 w-[32%] aspect-video border-2 border-white rounded overflow-hidden shadow-lg">
            <Scene src="cam1" label={false} />
          </div>
        )}
        <span className="absolute left-2 top-1.5 text-[10px] font-bold bg-red-600 px-1.5 rounded">PGM</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {['CUT', 'MIX', 'DIP', 'WIPE'].map((t) => (
          <button key={t} type="button" onClick={() => run(t)} className={`px-4 py-2 rounded font-black ${t === 'CUT' ? 'bg-slate-200 text-slate-900' : 'bg-amber-600 hover:bg-amber-500'}`}>{t}</button>
        ))}
        <ToggleBtn on={pip} color="green" onClick={() => setPip(!pip)}>PIP (진행자 작은 화면)</ToggleBtn>
      </div>
      <p className="text-xs text-slate-400 text-center">다음 화면: {next === 'slides' ? 'PC 슬라이드' : next === 'cam1' ? '진행자 클로즈업' : next}</p>
    </div>
  );
}

/* ---------------------------- 케이블 개념 그림 ---------------------------- */
function wavePath(fn, w, h, mid) {
  let d = '';
  for (let x = 0; x <= w; x += 2) d += `${x ? 'L' : 'M'}${x},${(mid - fn(x)).toFixed(1)} `;
  return d;
}
function BalancedVisual() {
  const [mode, setMode] = useState('balanced');
  const [amp, setAmp] = useState(10);
  const W = 300;
  const sig = (x) => Math.sin((x / W) * Math.PI * 4) * 16;
  const noise = (x) => (Math.sin(x * 0.9) * 0.6 + Math.sin(x * 2.3 + 1) * 0.3 + Math.sin(x * 5.1) * 0.2) * amp;
  const rows = mode === 'balanced'
    ? [['Hot (+) · 원래 신호 + 잡음', (x) => sig(x) + noise(x), '#60a5fa'], ['Cold (-) · 뒤집은 신호 + 같은 잡음', (x) => -sig(x) + noise(x), '#a78bfa'], ['받는 쪽: (Hot − Cold) ÷ 2 = 깨끗한 신호', (x) => sig(x), '#4ade80']]
    : [['보낸 신호', (x) => sig(x), '#60a5fa'], ['케이블을 지나며 잡음이 섞임', (x) => sig(x) + noise(x), '#fbbf24'], ['받은 소리: 잡음이 그대로 남음', (x) => sig(x) + noise(x), '#f87171']];
  return (
    <div className="p-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        {[['unbalanced', '언밸런스드 (TS · RCA)'], ['balanced', '밸런스드 (XLR · TRS)']].map(([k, t]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`px-3 py-1.5 rounded border text-xs font-bold ${mode === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} 210`} className="w-full max-w-xl block mx-auto bg-slate-950 rounded-lg border border-slate-700" role="img" aria-label="케이블 신호와 잡음 파형">
        {rows.map(([label, fn, color], i) => (
          <g key={label}>
            <line x1="0" x2={W} y1={40 + i * 66} y2={40 + i * 66} stroke="#1e293b" />
            <path d={wavePath(fn, W, 50, 40 + i * 66)} fill="none" stroke={color} strokeWidth="2" />
            <text x="6" y={14 + i * 66} fill="#cbd5e1" fontSize="10">{label}</text>
          </g>
        ))}
      </svg>
      <Slider id="bal-noise" label="잡음 크기 (케이블이 길수록, 주변 전원선이 많을수록)" value={amp} min={0} max={24} onChange={setAmp} display={`${amp}`} accent="accent-amber-300" />
    </div>
  );
}

const CABLE_ROWS = [
  ['XLR', 'cable_xlr', '오디오', '마이크·라인', '예', '예', '~100m', '마이크, 장비 사이'],
  ['TS 6.3mm', 'cable_trs', '오디오', '악기', '아니오', '아니오', '~5m', '기타·베이스'],
  ['TRS 6.3mm', 'cable_trs', '오디오', '라인·헤드폰', '예(모노)', '아니오', '~30m', '라인 장비, 헤드폰'],
  ['3.5mm', 'cable_mini', '오디오', '가정용 라인', '아니오', '아니오', '~3m', 'PC·폰·카메라 마이크'],
  ['RCA', 'cable_rca', '오디오', '가정용 라인', '아니오', '아니오', '~3m', 'DJ·가정용 오디오'],
  ['스피콘', 'cable_speakon', '오디오', '스피커 레벨', '-', '예', '굵기에 따라', '앰프 → 패시브 스피커'],
  ['HDMI', 'cable_hdmi', '영상', '디지털 영상+음성', '-', '아니오', '5~10m', '카메라·스위처·모니터'],
  ['SDI', 'cable_sdi', '영상', '디지털 영상+음성', '-', '예', '100m+', '방송 카메라, 장거리'],
  ['USB-C', 'cable_usb', '데이터', '데이터·오디오·영상', '-', '아니오', '3~5m', '인터페이스·웹캠 → PC'],
  ['이더넷', 'cable_eth', '데이터', '네트워크', '-', 'etherCON만', '100m', 'Dante·AES50·NDI·제어'],
];
function CableMapVisual({ onOpen }) {
  const [f, setF] = useState('전체');
  const rows = CABLE_ROWS.filter((r) => f === '전체' || r[2] === f);
  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {['전체', '오디오', '영상', '데이터'].map((k) => (
          <button key={k} type="button" onClick={() => setF(k)} className={`px-3 py-1 rounded-full border text-xs font-bold ${f === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{k}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-700">
            {['케이블', '신호', '밸런스드', '잠금', '최대 길이', '주 용도'].map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-slate-800 hover:bg-slate-800/60">
                <td className="py-1.5 pr-3"><button type="button" onClick={() => onOpen(r[1])} className="font-bold text-sky-300 hover:underline">{r[0]}</button></td>
                <td className="pr-3 text-slate-300">{r[3]}</td><td className="pr-3 text-slate-300">{r[4]}</td><td className="pr-3 text-slate-300">{r[5]}</td>
                <td className="pr-3 font-mono text-slate-200">{r[6]}</td><td className="text-slate-300">{r[7]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">케이블 이름을 누르면 자세한 설명으로 이동합니다.</p>
    </div>
  );
}

const CHECKLIST = [
  '연결할 장비와 단자 목록을 적고 필요한 케이블 수 세기',
  '종류별 예비 케이블 1개 이상 챙기기',
  '변환 젠더 챙기기 (3.5mm↔6.3mm, XLR↔TRS, HDMI↔SDI)',
  '케이블 테스터로 모든 케이블 점검하기',
  '양 끝에 같은 번호 라벨 붙이기',
  '바닥 고정용 테이프·케이블 커버 챙기기',
  '멀티탭과 전원 케이블 여유 있게 준비하기',
];
function CableCareVisual() {
  const [done, setDone] = useState([]);
  const loops = Array.from({ length: 6 });
  return (
    <div className="p-5 grid md:grid-cols-2 gap-5 items-center">
      <div>
        <svg viewBox="0 0 220 160" className="w-full max-w-xs mx-auto block" role="img" aria-label="8자 감기(오버-언더) 그림">
          {loops.map((_, i) => (
            <ellipse key={i} cx={110 + (i % 2 ? 4 : -4)} cy="80" rx={70 - i * 3} ry={55 - i * 3} fill="none"
              stroke={i % 2 ? '#60a5fa' : '#f8fafc'} strokeWidth="5" strokeDasharray={i % 2 ? '10 4' : '0'} opacity={0.9 - i * 0.08} />
          ))}
          <text x="110" y="155" textAnchor="middle" fill="#94a3b8" fontSize="11">흰색 = 바로 감기 · 파랑 = 뒤집어 감기</text>
        </svg>
        <p className="text-xs text-slate-400 text-center mt-1">한 번은 바로(오버), 한 번은 뒤집어(언더) 번갈아 감습니다.</p>
      </div>
      <div>
        <div className="text-sm font-bold mb-2">출동 전 케이블 체크리스트 <span className="text-emerald-300 font-mono">{done.length}/{CHECKLIST.length}</span></div>
        <ul className="space-y-1.5">
          {CHECKLIST.map((c) => {
            const on = done.includes(c);
            return (
              <li key={c}>
                <button type="button" onClick={() => setDone((d) => (on ? d.filter((x) => x !== c) : [...d, c]))}
                  className={`w-full text-left text-sm flex gap-2 items-start px-2 py-1.5 rounded border ${on ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-400' : 'border-slate-500'}`}>{on && <Check size={12} />}</span>{c}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function MixerSizes({ item }) {
  const [size, setSize] = useState('small');
  return (
    <div>
      <div className="h-[340px] sm:h-[420px] relative bg-[#131a27]">
        <MixerSizeViewer key={size} size={size} />
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">드래그로 돌려 보기 · 휠/핀치로 확대</div>
      </div>
      <div className="p-3 border-t border-slate-700 bg-slate-900/60 grid sm:grid-cols-3 gap-2">
        {item.sizes.map((z) => (
          <button key={z.key} type="button" onClick={() => setSize(z.key)}
            className={`text-left rounded-lg border p-3 space-y-1 ${size === z.key ? 'bg-sky-900/60 border-sky-400' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
            <div className="flex items-baseline justify-between gap-2"><span className="text-lg font-bold">{z.name}</span><span className="text-xs font-mono text-amber-300">{z.ch}</span></div>
            <div className="text-xs text-slate-300 leading-relaxed">{z.feature}</div>
            <div className="text-[11px] text-slate-400"><b className="text-slate-300">쓰이는 곳</b> · {z.where}</div>
            <div className="text-[11px] text-slate-500"><b className="text-slate-400">예시</b> · {z.examples}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DmxVisual() {
  const chain = [['콘솔', 'DMX OUT', null], ['LED 파 1', '001~008', 8], ['LED 파 2', '009~016', 8], ['무빙 1', '017~032', 16], ['무빙 2', '033~048', 16]];
  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {chain.map(([n, a, fp], i) => (
          <React.Fragment key={n}>
            <div className={`rounded-lg border px-2.5 py-2 text-center ${i ? 'border-lime-500/60 bg-lime-950/40' : 'border-orange-400/60 bg-orange-950/40'}`}>
              <div className="text-xs font-bold text-slate-100">{n}</div>
              <div className="text-[11px] font-mono text-lime-300">{a}</div>
              {fp && <div className="text-[10px] text-slate-400">{fp}채널</div>}
            </div>
            {i < chain.length - 1 && <span className="text-lime-400 text-xs font-bold">IN←OUT</span>}
          </React.Fragment>
        ))}
        <div className="rounded-full border border-lime-400 px-2 py-1 text-[10px] text-lime-200">터미네이터 120Ω</div>
      </div>
      <div className="h-6 rounded bg-slate-950 border border-slate-700 relative overflow-hidden" aria-label="512 채널 중 사용 범위">
        {[[0, 8, '#38bdf8'], [8, 8, '#22c55e'], [16, 16, '#f472b6'], [32, 16, '#a78bfa']].map(([st, len, c], i) => <div key={i} className="absolute top-0 bottom-0" style={{ left: `${(st / 64) * 100}%`, width: `${(len / 64) * 100}%`, background: c, opacity: 0.8 }} />)}
        <span className="absolute right-1 top-0.5 text-[10px] text-slate-300">채널 1 ~ 64 (유니버스 1 = 512채널)</span>
      </div>
      <p className="text-xs text-slate-400">각 조명은 자기 시작 주소부터 채널 수만큼만 읽습니다. 범위가 겹치면 두 조명이 서로의 값을 읽어 엉뚱하게 움직입니다.</p>
    </div>
  );
}
function LayersVisual() {
  const layers = [['Layer 3', '로고', '#38bdf8'], ['Layer 2', '가사', '#f8fafc'], ['Layer 1', '배경 영상', '#f59e0b']];
  return (
    <div className="p-4 grid sm:grid-cols-2 gap-4 items-center">
      <div className="space-y-1.5">
        {layers.map(([l, n, c], i) => (
          <div key={l} className="rounded border border-slate-600 px-3 py-2 flex items-center gap-2 bg-slate-900" style={{ marginLeft: i * 14 }}>
            <span className="w-3 h-3 rounded-sm" style={{ background: c }} /><b className="text-xs">{l}</b><span className="text-xs text-slate-300">{n}</span>
          </div>
        ))}
        <div className="text-[11px] text-slate-400">↑ 위 레이어가 앞에 보임</div>
      </div>
      <div className="space-y-2 text-xs">
        <div className="rounded-lg border border-rose-500/50 p-2"><b className="text-rose-300">출력 1 → LED 전광판</b><div className="text-slate-400">배경 + 가사, LED 해상도에 맞춤</div></div>
        <div className="rounded-lg border border-sky-500/50 p-2"><b className="text-sky-300">출력 2 → ATEM 입력 3</b><div className="text-slate-400">방송용 오프닝·자막 그래픽</div></div>
      </div>
    </div>
  );
}
function IpVisual() {
  const devs = [['PTZ 카메라', '192.168.1.21', true], ['PTZ 조이스틱', '192.168.1.10', true], ['ATEM Mini Pro', '192.168.1.240', true], ['다른 대역 카메라', '192.168.0.21', false]];
  return (
    <div className="p-4 space-y-3">
      <div className="mx-auto w-fit rounded-lg border border-teal-400/60 bg-teal-950/40 px-4 py-2 text-center"><div className="text-sm font-bold">공유기 / 스위치</div><div className="text-[11px] font-mono text-teal-300">192.168.1.1</div></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {devs.map(([n, ip, ok]) => (
          <div key={n} className={`rounded-lg border p-2 text-center ${ok ? 'border-green-500/50' : 'border-red-500/60'}`}>
            <div className="text-xs font-bold">{n}</div><div className="text-[11px] font-mono text-slate-300">{ip}</div>
            <div className={`text-[10px] ${ok ? 'text-green-300' : 'text-red-300'}`}>{ok ? '통신 가능' : '대역이 달라 못 찾음'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CONCEPT = {
  dmx: DmxVisual, layers: LayersVisual, ipnet: IpVisual,
  flow: FlowVisual, gain: GainVisual, feedback: FeedbackVisual, pgmpvw: PgmPvwVisual,
  levels: LevelsVisual, camsettings: CamSettingsVisual, multiview: MultiviewVisual, transitions: TransitionsVisual,
  balanced: BalancedVisual, cablemap: CableMapVisual, cablecare: CableCareVisual,
};

/* ---------------------------- 채널 스트립 한 줄 (튜토리얼: 손잡이를 하나씩 빛내며 소개) ---------------------------- */
export const STRIP_INFO = {
  input: ['MIC · LINE 단자', '채널 한 줄의 출발점이에요. 마이크는 위의 큰 동그란 구멍(XLR), 노트북·악기는 아래 작은 구멍(LINE)에 꽂아요.'],
  phantom: ['+48V 팬텀', '콘덴서 마이크에 전기를 보내 주는 스위치예요. 다이나믹 마이크는 이게 없어도 소리가 나요.'],
  pad: ['PAD', '처음부터 너무 큰 소리를 미리 깎아 줘요. 드럼처럼 큰 소리가 GAIN을 다 내려도 찌그러질 때 눌러요.'],
  gain: ['GAIN', '들어온 소리를 처음 키우는 손잡이예요. 마이크 소리는 아주 작아서 여기서 키워야 해요. 말할 때 미터가 -20~-6dB 사이면 딱 좋아요.'],
  lowcut: ['LOW CUT (HPF)', '아주 낮은 웅웅·쿵 소리를 잘라 내는 버튼이에요. 숨소리 퍽, 바닥 울림이 줄어들어서 말소리엔 거의 항상 켜요.'],
  comp: ['COMP', '갑자기 커지는 소리를 살짝 눌러서 크기를 고르게 해 줘요.'],
  high: ['HIGH (고음)', '소리의 반짝이는 부분이에요. 올리면 선명하고 쨍해지고, 너무 올리면 ㅅ·ㅊ 소리가 따가워요.'],
  mid: ['MID (중음)', '목소리의 몸통이에요. 줄이면 코맹맹이·답답함이 빠지고, 올리면 소리가 앞으로 튀어나와요. 옆의 FREQ로 어느 높이를 만질지 골라요.'],
  low: ['LOW (저음)', '소리의 두께예요. 올리면 묵직해지고, 너무 올리면 웅웅거려서 말이 잘 안 들려요.'],
  aux: ['AUX', '무대 모니터 스피커로 따로 보내는 양이에요. 메인 페이더와 따로 움직여서 연주자 귀에 들리는 소리만 바꿀 수 있어요.'],
  fx: ['FX', '리버브(울림) 같은 효과로 보내는 양이에요. 노래에 공간감을 줄 때 써요.'],
  pan: ['PAN', '이 소리를 왼쪽·오른쪽 스피커 중 어디로 보낼지 정해요. 가운데면 양쪽에 똑같이 나가요.'],
  mute: ['ON / MUTE', '이 채널을 켜고 끄는 버튼이에요. 꺼 두면 페이더가 올라가 있어도 소리가 안 나가요.'],
  pfl: ['PFL', '이 채널만 헤드폰으로 미리 들어 보는 버튼이에요. 객석에는 안 나가니까 몰래 확인할 때 써요.'],
  fader: ['FADER', '맨 아래 미끄럼 손잡이예요. 이 채널을 전체 소리에 얼마나 섞어 내보낼지 정해요. 0이라고 쓴 눈금이 원래 크기예요.'],
  master: ['STEREO 마스터', '모든 채널이 모여서 스피커로 나가는 마지막 문이에요. 이게 내려가 있으면 아무 소리도 안 나가요.'],
};
// 스트립 위아래 순서 (신호가 흐르는 순서)
const STRIP_ROWS = [
  ['input', 'jack'], ['phantom', 'btn'], ['pad', 'btn'], ['gain', 'knob', '#ef4444'], ['lowcut', 'btn'], ['comp', 'knob', '#a3a3a3'],
  ['high', 'knob', '#38bdf8'], ['mid', 'knob', '#22c55e'], ['low', 'knob', '#f59e0b'], ['aux', 'knob', '#a78bfa'], ['fx', 'knob', '#f472b6'],
  ['pan', 'knob', '#e5e7eb'], ['mute', 'btn'], ['pfl', 'btn'], ['fader', 'fader'],
];
function StripPart({ kind, color, on }) {
  if (kind === 'jack') return <div className="flex flex-col items-center gap-0.5"><span className="h-4 w-4 rounded-full border-2 border-slate-400 bg-slate-950" /><span className="h-2.5 w-2.5 rounded-full border-2 border-slate-500 bg-slate-950" /></div>;
  if (kind === 'btn') return <span className={`h-2.5 w-5 rounded-sm border ${on ? 'border-white bg-amber-300' : 'border-slate-500 bg-slate-700'}`} />;
  if (kind === 'fader') return <div className="relative h-16 w-2 rounded bg-slate-950 border border-slate-600"><span className="absolute left-1/2 -translate-x-1/2 top-5 h-2.5 w-6 rounded-sm bg-slate-200" /></div>;
  return <span className="relative h-5 w-5 rounded-full border border-slate-900" style={{ background: color }}><span className="absolute left-1/2 top-0.5 h-1.5 w-0.5 -translate-x-1/2 bg-slate-900" /></span>;
}
export function StripVisual({ focus = 'gain' }) {
  const info = STRIP_INFO[focus] ?? STRIP_INFO.gain;
  const master = focus === 'master';
  return (
    <div className="flex items-stretch gap-3 p-3">
      <div className="flex gap-1.5 shrink-0" aria-hidden="true">
        <div className="flex flex-col items-center gap-[3px] rounded-lg border border-slate-600 bg-gradient-to-b from-slate-700 to-slate-800 px-1.5 py-1.5">
          <span className="text-[8px] font-bold text-slate-300">CH 1</span>
          {STRIP_ROWS.map(([key, kind, color]) => {
            const on = key === focus;
            return (
              <div key={key} className={`flex w-12 flex-col items-center rounded px-0.5 py-[1px] transition ${on ? 'bg-amber-400/25 ring-2 ring-amber-300 shadow-[0_0_12px_rgba(252,211,77,.6)]' : focus === 'input' || master ? '' : 'opacity-45'}`}>
                <StripPart kind={kind} color={color} on={on} />
                <span className={`text-[7px] leading-tight font-bold ${on ? 'text-amber-100' : 'text-slate-400'}`}>{STRIP_INFO[key][0].split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
        <div className={`flex flex-col justify-end items-center rounded-lg border px-1.5 py-1.5 ${master ? 'border-amber-300 bg-amber-400/20 shadow-[0_0_12px_rgba(252,211,77,.6)]' : 'border-slate-700 bg-slate-800/70 opacity-60'}`}>
          <div className="relative h-16 w-2 rounded bg-slate-950 border border-slate-600"><span className="absolute left-1/2 -translate-x-1/2 top-5 h-2.5 w-6 rounded-sm bg-red-500" /></div>
          <span className="text-[7px] font-bold text-slate-300 mt-0.5">STEREO</span>
        </div>
      </div>
      <div className="min-w-0 flex flex-col justify-center gap-1.5">
        <div className="text-[10px] font-bold text-slate-400">신호는 위에서 아래로 ↓</div>
        <div className="text-base font-black text-amber-200">{info[0]}</div>
        <p className="text-[13px] leading-relaxed text-slate-200">{info[1]}</p>
      </div>
    </div>
  );
}
CONCEPT.strip = StripVisual;
