import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, CheckCircle2, XCircle, Lightbulb, AlertTriangle, MapPin, Cpu, Plug, Play,
  Mic, SlidersHorizontal, Speaker, Video, MonitorPlay, Cable, GraduationCap, ArrowRight,
} from 'lucide-react';
import { DEVICE_TYPES, PORT_KIND_LABEL, PORT_COLOR, CABLES, MIXER_DEFAULT, MIC_LEVEL, faderDb, fmtDb } from './engine.js';
import { EquipmentViewer, CableShowcase } from './Studio3D.jsx';
import { Meter, Slider, ToggleBtn, Scene, loadProgress, saveProgress } from './ui.jsx';
import { EDU_CATEGORIES, EDU_ITEMS } from './eduContent.js';

/* =====================================================================
 * 교육 모드 — 장비를 3D로 돌려 보고, 직접 만져 보고, 퀴즈로 확인한다
 * ===================================================================== */

const CAT_ICON = { 마이크: Mic, 믹서: SlidersHorizontal, 스피커: Speaker, 영상: Video, 송출: MonitorPlay, 케이블: Cable, '기초 개념': GraduationCap };

const DEMO_DEFAULT = {
  talking: true,
  mixer: { ...MIXER_DEFAULT, gain: 28, phantom: true },
  power: true, feedback: false, tally: 'pgm',
  atem: { program: 1, preview: 2, transitioning: false },
  obsVideo: 'cam1', streaming: true,
};

/* ---------------------------- 체험 컨트롤 ---------------------------- */
function DemoControls({ type, demo, set }) {
  const mix = (k, v) => set({ ...demo, mixer: { ...demo.mixer, [k]: v } });
  const talk = (
    <ToggleBtn on={demo.talking} color="green" onClick={() => set({ ...demo, talking: !demo.talking })}>
      {demo.talking ? '말하는 중' : '말하기'}
    </ToggleBtn>
  );
  switch (type) {
    case 'dynamic_mic':
      return <div className="flex flex-wrap gap-2 items-center">{talk}<span className="text-xs text-slate-400">말하면 마이크 머리(그릴)가 신호를 받아 빛납니다.</span></div>;
    case 'condenser_mic':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {talk}
          <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>+48V 팬텀</ToggleBtn>
          <span className="text-xs text-slate-400">팬텀 전원을 끄면 말해도 신호가 나오지 않습니다.</span>
        </div>
      );
    case 'analog_mixer':
    case 'digital_mixer':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {talk}
            <ToggleBtn on={demo.mixer.chMute} onClick={() => mix('chMute', !demo.mixer.chMute)}>MUTE</ToggleBtn>
            <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>48V</ToggleBtn>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Slider id="edu-gain" label="GAIN" value={demo.mixer.gain} min={0} max={60} onChange={(v) => mix('gain', v)} display={`+${demo.mixer.gain} dB`} accent="accent-red-400" />
            {type === 'analog_mixer'
              ? <Slider id="edu-eq" label="EQ MID" value={demo.mixer.eqMid} min={-15} max={15} onChange={(v) => mix('eqMid', v)} display={`${demo.mixer.eqMid > 0 ? '+' : ''}${demo.mixer.eqMid}`} accent="accent-amber-300" />
              : (
                <label htmlFor="edu-route" className="text-xs text-slate-400">USB 출력 라우팅
                  <select id="edu-route" value={demo.mixer.usbOut} onChange={(e) => mix('usbOut', e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100">
                    <option value="main">Main L/R</option><option value="bus1">Mix Bus 1</option><option value="off">Off</option>
                  </select>
                </label>
              )}
            <Slider id="edu-chf" label="채널 페이더" value={demo.mixer.chFader} min={0} max={100} onChange={(v) => mix('chFader', v)} display={fmtDb(faderDb(demo.mixer.chFader))} />
            <Slider id="edu-mainf" label="메인 페이더" value={demo.mixer.mainFader} min={0} max={100} onChange={(v) => mix('mainFader', v)} display={fmtDb(faderDb(demo.mixer.mainFader))} />
          </div>
          <p className="text-xs text-slate-400">슬라이더를 움직이면 3D 믹서의 노브와 페이더, LED 미터가 함께 움직입니다.</p>
        </div>
      );
    case 'speaker':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleBtn on={demo.power} color="green" onClick={() => set({ ...demo, power: !demo.power })}>POWER</ToggleBtn>
          {talk}
          <ToggleBtn on={demo.feedback} onClick={() => set({ ...demo, feedback: !demo.feedback })}>하울링 재현</ToggleBtn>
          <span className="text-xs text-slate-400">소리가 나면 콘(우퍼)이 떨리고 음파가 퍼집니다.</span>
        </div>
      );
    case 'camera':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {[[null, '탈리 꺼짐'], ['pvw', 'PVW (초록)'], ['pgm', 'PGM (빨강)']].map(([v, t]) => (
            <button key={t} type="button" onClick={() => set({ ...demo, tally: v })}
              className={`px-3 py-1.5 rounded border text-xs font-bold ${demo.tally === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
          ))}
        </div>
      );
    case 'atem':
      return (
        <div className="space-y-2">
          {[['PGM', 'program', 'bg-red-600 border-red-400'], ['PVW', 'preview', 'bg-green-600 border-green-400']].map(([lbl, key, onCls]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-9 text-[11px] font-bold text-slate-400">{lbl}</span>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => set({ ...demo, atem: { ...demo.atem, [key]: n } })}
                  className={`w-9 h-9 rounded border text-sm font-bold ${demo.atem[key] === n ? onCls : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>{n}</button>
              ))}
              {key === 'program' && (
                <button type="button" onClick={() => set({ ...demo, atem: { ...demo.atem, program: demo.atem.preview, preview: demo.atem.program } })}
                  className="ml-2 px-4 h-9 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
              )}
            </div>
          ))}
        </div>
      );
    case 'pc':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {[['cam1', '카메라 1'], ['cam2', '카메라 2'], ['nosignal', '신호 없음'], ['black', '블랙']].map(([v, t]) => (
            <button key={v} type="button" onClick={() => set({ ...demo, obsVideo: v })}
              className={`px-3 py-1.5 rounded border text-xs font-bold ${demo.obsVideo === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
          ))}
          <ToggleBtn on={demo.streaming} onClick={() => set({ ...demo, streaming: !demo.streaming })}>LIVE</ToggleBtn>
          {talk}
        </div>
      );
    default: return null;
  }
}

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

const CONCEPT = { flow: FlowVisual, gain: GainVisual, feedback: FeedbackVisual, pgmpvw: PgmPvwVisual };

/* ---------------------------- 퀴즈 ---------------------------- */
function Quiz({ item, solved, onSolve }) {
  const [pick, setPick] = useState(null);
  useEffect(() => { setPick(null); }, [item.id]);
  const { q, options, answer, explain } = item.quiz;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{q}</p>
      <div className="grid gap-1.5">
        {options.map((o, i) => {
          const chosen = pick === i;
          const show = pick != null;
          const cls = show && i === answer ? 'border-green-500 bg-green-950' : chosen ? 'border-red-500 bg-red-950' : 'border-slate-600 bg-slate-900 hover:bg-slate-800';
          return (
            <button key={o} type="button" onClick={() => { setPick(i); if (i === answer) onSolve(item.id); }}
              className={`text-left text-sm px-3 py-2 rounded border ${cls}`}>{o}</button>
          );
        })}
      </div>
      {pick != null && (
        <p className={`text-sm flex gap-1.5 ${pick === answer ? 'text-green-300' : 'text-red-300'}`}>
          {pick === answer ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
          <span>{pick === answer ? '정답! ' : '다시 생각해 보세요. '}{explain}</span>
        </p>
      )}
      {solved && pick == null && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={13} /> 이미 맞힌 문제입니다.</p>}
    </div>
  );
}

/* =====================================================================
 * EduMode
 * ===================================================================== */
export default function EduMode({ onExit, onNavigate }) {
  const [currentId, setCurrentId] = useState(EDU_ITEMS[0].id);
  const [demo, setDemo] = useState(DEMO_DEFAULT);
  const [jitter, setJitter] = useState(0);
  const [solved, setSolved] = useState(() => loadProgress('bm-edu-quiz', []));
  const idx = EDU_ITEMS.findIndex((x) => x.id === currentId);
  const item = EDU_ITEMS[idx];

  useEffect(() => { saveProgress('bm-edu-quiz', solved); }, [solved]);
  useEffect(() => { setDemo(DEMO_DEFAULT); }, [currentId]);
  useEffect(() => {
    if (!demo.talking) return undefined;
    const t = setInterval(() => setJitter(-(Math.random() ** 1.5) * 12), 120);
    return () => clearInterval(t);
  }, [demo.talking]);

  // 체험용 레벨 계산
  const levels = useMemo(() => {
    const m = demo.mixer;
    const needsPhantom = item.type === 'condenser_mic';
    if (!demo.talking || (needsPhantom && !m.phantom)) return { chLevel: null, mainLevel: null };
    const ch = MIC_LEVEL + m.gain + jitter;
    const post = m.chMute || m.chFader <= 0 ? null : ch + faderDb(m.chFader);
    const main = post == null || m.mainMute || m.mainFader <= 0 ? null : post + faderDb(m.mainFader);
    return { chLevel: ch, mainLevel: main };
  }, [demo, jitter, item.type]);
  const viewDemo = { ...demo, ...levels, talking: levels.chLevel != null, level: demo.talking ? -14 + jitter : null };

  const go = (d) => setCurrentId(EDU_ITEMS[(idx + d + EDU_ITEMS.length) % EDU_ITEMS.length].id);
  const def = item.type ? DEVICE_TYPES[item.type] : null;
  const Concept = item.concept ? CONCEPT[item.concept] : null;

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-4 sm:px-6 font-sans">
      <style>{`
        @keyframes bm-travel { 0% { left: 1.5rem; } 100% { left: calc(100% - 2.25rem); } }
        .bm-travel { animation: bm-travel 2.4s linear infinite; }
        @keyframes bm-flow { to { stroke-dashoffset: -24; } }
        .bm-flow { animation: bm-flow .6s linear infinite; }
        .bm-noevents { pointer-events: none !important; }
        @media (prefers-reduced-motion: reduce) { .bm-travel, .bm-flow, .animate-pulse { animation: none !important; } }
      `}</style>

      <header className="flex flex-wrap gap-3 justify-between items-center bg-slate-800 p-4 rounded-lg shadow-lg mb-4 border-b-4 border-slate-700">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={onExit} className="px-2.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm flex items-center gap-1">
            <ChevronLeft size={16} /> 메뉴
          </button>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2"><BookOpen size={24} /> 교육 모드</h1>
          <span className="text-slate-400 text-sm">방송장비 백과 · 3D로 돌려 보고 직접 만져 보세요</span>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400">이해도 체크</div>
          <div className="font-mono font-bold text-lg text-emerald-300">{solved.length}/{EDU_ITEMS.length}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-4">
        {/* 목록 */}
        {/* 작은 화면: 드롭다운 */}
        <div className="lg:hidden flex gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="이전 항목" className="px-3 rounded bg-slate-700 border border-slate-600"><ChevronLeft size={18} /></button>
          <select aria-label="장비 선택" value={currentId} onChange={(e) => setCurrentId(e.target.value)}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded px-3 py-2.5 text-base text-slate-100">
            {EDU_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {EDU_ITEMS.filter((x) => x.cat === cat).map((x) => <option key={x.id} value={x.id}>{solved.includes(x.id) ? '✓ ' : ''}{x.title}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={() => go(1)} aria-label="다음 항목" className="px-3 rounded bg-slate-700 border border-slate-600"><ChevronRight size={18} /></button>
        </div>
        <nav aria-label="장비 목록" className="hidden lg:block bg-slate-800 rounded-lg p-3 border-2 border-slate-700 lg:self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] overflow-y-auto">
          {EDU_CATEGORIES.map((cat) => {
            const Icon = CAT_ICON[cat] ?? BookOpen;
            return (
              <div key={cat} className="mb-3 last:mb-0">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1"><Icon size={13} /> {cat}</div>
                <div className="flex flex-wrap lg:flex-col gap-1">
                  {EDU_ITEMS.filter((x) => x.cat === cat).map((x) => (
                    <button key={x.id} type="button" onClick={() => setCurrentId(x.id)}
                      className={`text-left text-sm px-2.5 py-1.5 rounded flex items-center gap-1.5 ${x.id === currentId ? 'bg-emerald-700 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
                      {solved.includes(x.id) && <CheckCircle2 size={13} className="text-emerald-300 shrink-0" />}
                      <span className="truncate">{x.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* 본문 */}
        <main className="min-w-0 space-y-4">
          <div className="bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden">
            <div className="h-[360px] sm:h-[440px] bg-[#131a27] relative">
              {item.kind === 'device' && <EquipmentViewer key={item.type} type={item.type} demo={viewDemo} />}
              {item.kind === 'cable' && <CableShowcase key={item.cable} kind={item.cable} />}
              {item.kind === 'concept' && <div className="h-full overflow-y-auto flex items-center"><div className="w-full">{Concept && <Concept />}</div></div>}
              {item.kind !== 'concept' && (
                <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">드래그로 돌려 보기 · 휠/핀치로 확대</div>
              )}
            </div>
            {item.kind === 'device' && (
              <div className="p-3 border-t border-slate-700 bg-slate-900/60">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Play size={12} /> 직접 만져 보기</div>
                <DemoControls type={item.type} demo={demo} set={setDemo} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="bg-slate-800 rounded-lg p-5 border-2 border-slate-700 space-y-4 min-w-0">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">{item.cat}</div>
                <h2 className="text-2xl font-bold mt-0.5">{item.title}</h2>
                <p className="text-sm text-slate-400">{item.subtitle}</p>
              </div>
              <p className="text-slate-200 leading-relaxed">{item.summary}</p>
              <div>
                <h3 className="text-sm font-bold text-sky-300 mb-1.5 flex items-center gap-1.5"><Cpu size={15} /> 작동 원리</h3>
                <ul className="space-y-1.5 text-sm text-slate-300 leading-relaxed list-disc pl-5">{item.how.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              {item.specs && (
                <table className="w-full text-sm">
                  <tbody>
                    {item.specs.map(([k, v]) => (
                      <tr key={k} className="border-t border-slate-700"><th scope="row" className="text-left font-normal text-slate-400 py-1.5 pr-3 w-28 align-top">{k}</th><td className="py-1.5 text-slate-200">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {def && (
                <div>
                  <h3 className="text-sm font-bold text-sky-300 mb-1.5 flex items-center gap-1.5"><Plug size={15} /> 단자</h3>
                  <ul className="space-y-1 text-sm">
                    {[...def.ins.map((p) => ({ ...p, dir: '입력' })), ...def.outs.map((p) => ({ ...p, dir: '출력' }))].map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PORT_COLOR[p.kind] }} />
                        <span className="font-mono text-slate-200">{p.label}</span>
                        <span className="text-slate-400">· {p.dir} · {PORT_KIND_LABEL[p.kind]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.cable && (
                <p className="text-sm flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: CABLES[item.cable].stroke }} /> 게임 안에서는 이 색의 케이블로 표시됩니다.</p>
              )}
            </section>

            <section className="space-y-4 min-w-0">
              <div className="bg-slate-800 rounded-lg p-5 border-2 border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5"><Lightbulb size={15} /> 실무 팁</h3>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">{item.tips.map((t) => <li key={t}>{t}</li>)}</ul>
                <h3 className="text-sm font-bold text-red-300 flex items-center gap-1.5 pt-1"><AlertTriangle size={15} /> 자주 하는 실수</h3>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">{item.mistakes.map((t) => <li key={t}>{t}</li>)}</ul>
                {item.where && <p className="text-sm text-slate-300 flex gap-1.5 pt-1"><MapPin size={15} className="text-sky-300 shrink-0 mt-0.5" /> <span><b className="text-slate-200">쓰이는 곳</b> · {item.where}</span></p>}
              </div>
              <div className="bg-slate-800 rounded-lg p-5 border-2 border-emerald-800">
                <h3 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-1.5"><GraduationCap size={15} /> 이해도 체크</h3>
                <Quiz item={item} solved={solved.includes(item.id)} onSolve={(id) => setSolved((s) => (s.includes(id) ? s : [...s, id]))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => go(-1)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm flex items-center gap-1"><ChevronLeft size={16} /> 이전</button>
                <button type="button" onClick={() => go(1)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm flex items-center gap-1">다음 <ChevronRight size={16} /></button>
                <button type="button" onClick={() => onNavigate('studio')} className="ml-auto px-3 py-2 rounded bg-sky-700 hover:bg-sky-600 text-sm font-bold flex items-center gap-1">
                  스튜디오에서 직접 설치해 보기 <ArrowRight size={15} />
                </button>
                {item.stage && (
                  <button type="button" onClick={() => onNavigate('story', item.stage)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">스토리 스테이지 {item.stage}에서 실습</button>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
