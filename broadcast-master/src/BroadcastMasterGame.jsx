/* =====================================================================
 * 방송장비 마스터 (Broadcast Equipment Master)
 * 신호 흐름(Signal Flow)·게인 스테이징·송출·트러블슈팅을 익히는 시뮬레이션 게임
 * ===================================================================== */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic, Monitor, Power, AlertCircle, Radio, Video, Cable, SlidersHorizontal, Lightbulb, Volume2, VolumeX, CheckCircle2, Circle, Trophy, RotateCcw, ChevronRight, Info, Zap, X, Activity, Users, MessageSquare, Tv, Hand, Wrench, MonitorPlay, Award, User, Package, Play, Box, Network, Tag,
} from 'lucide-react';
import {
  CANVAS_W, CANVAS_H, HEADER_H, ROW_H, CABLES, PORT_ACCEPTS, PORT_KIND_LABEL, PORT_COLOR, MISMATCH_TIP, DEVICE_TYPES, deviceRows, deviceHeight, portPos, findPort, faderDb, fmtDb, clamp, conn, FAULTS, buildStage, computeSignal, buildTrace, faultFixed, STAGES, CHAT_BAD, CHAT_GOOD, CHAT_NAMES,
} from './game/engine.js';
import Studio3D from './game/Studio3D.jsx';

/* ---------------------------- 효과음 (Web Audio) ---------------------------- */
function useSfx(enabled) {
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
function Meter({ level, target, className = '', thin }) {
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

function Slider({ id, label, value, min, max, step = 1, onChange, display, accent = 'accent-sky-400', hint }) {
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

function ToggleBtn({ on, onClick, children, color = 'red', title }) {
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

function Section({ title, children, icon: Icon }) {
  return (
    <div className="bg-slate-900/60 rounded-md p-3 border border-slate-700 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon size={13} />} {title}
      </div>
      {children}
    </div>
  );
}

function Scene({ src, label = true, fade }) {
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
export default function BroadcastMasterGame() {
  const initial = useMemo(() => buildStage(1), []);
  const [currentStage, setCurrentStage] = useState(1);
  const [devices, setDevices] = useState(initial.devices);
  const [connections, setConnections] = useState(initial.connections);
  const [cables, setCables] = useState(initial.cables);
  const [mixer, setMixer] = useState(initial.mixer);
  const [speaker, setSpeaker] = useState(initial.speaker);
  const [atem, setAtem] = useState(initial.atem);
  const [obs, setObs] = useState(initial.obs);
  const [faults, setFaults] = useState(initial.faults);

  const [selectedCable, setSelectedCable] = useState('xlr');
  const [selectedDevice, setSelectedDevice] = useState('mixer');
  const [pending, setPending] = useState(null); // { d, p, dir }
  const [pointer, setPointer] = useState(null);
  const [talkHeld, setTalkHeld] = useState(false);
  const [jitter, setJitter] = useState(0);
  const [latched, setLatched] = useState([]);
  const [systemLog, setSystemLog] = useState([{ id: 0, time: '', type: 'info', msg: '시스템이 시작되었습니다. 스테이지 1 미션을 확인하세요.' }]);
  const [meta, setMeta] = useState({ start: Date.now(), penalty: 0, hintsUsed: 0 });
  const [cleared, setCleared] = useState(false);
  const [stageScores, setStageScores] = useState({});
  const [modal, setModal] = useState({ type: 'briefing' });
  const [soundOn, setSoundOn] = useState(false);
  const [tracerOn, setTracerOn] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [chat, setChat] = useState([]);
  const [scale, setScale] = useState(0.8);
  const [view, setView] = useState('3d');
  const [showLabels, setShowLabels] = useState(true);
  const [camReset, setCamReset] = useState(0);
  const [focusReq, setFocusReq] = useState(null);

  const stage = STAGES[currentStage];
  const talking = talkHeld || stage.autoTalk;
  const isLive = obs.streaming;
  const sfx = useSfx(soundOn);

  const logId = useRef(1);
  const warnAt = useRef({});
  const logEndRef = useRef(null);
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const dragRef = useRef(null);
  const pendingMoved = useRef(false);
  const prev = useRef({});

  /* ---------- 로그 ---------- */
  const addLog = useCallback((msg, type = 'info') => {
    const d = new Date();
    const time = [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':');
    setSystemLog((prev) => [...prev.slice(-150), { id: logId.current++, time, type, msg }]);
  }, []);
  const addLogThrottled = useCallback((key, msg, type = 'warn', ms = 4000) => {
    const now = Date.now();
    if (warnAt.current[key] && now - warnAt.current[key] < ms) return;
    warnAt.current[key] = now;
    addLog(msg, type);
  }, [addLog]);
  const penalize = useCallback((pts, reason) => {
    setMeta((m) => ({ ...m, penalty: m.penalty + pts }));
    addLog(`${reason} (-${pts}점)`, 'error');
  }, [addLog]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [systemLog]);

  /* ---------- 신호 계산 ---------- */
  const st = { devices, connections, mixer, speaker, atem, obs, faults };
  const actual = computeSignal(st, talking); // 지금 이 순간의 신호
  const nominal = computeSignal(st, true); // "말하고 있다면" 신호 (미션 판정용)
  const trace = buildTrace(st, nominal);
  const fixedList = faults.filter((f) => faultFixed(f, st, nominal));
  const ctx = { st, n: nominal, a: actual, fixedCount: fixedList.length };

  const objectiveStatus = stage.objectives.map((o) => ({
    id: o.id,
    label: typeof o.label === 'function' ? o.label(ctx) : o.label,
    done: o.latch ? latched.includes(o.id) : o.check(ctx),
  }));
  const allDone = objectiveStatus.every((o) => o.done);

  /* ---------- 스테이지 로드 ---------- */
  const loadStage = useCallback((id) => {
    const s = buildStage(id);
    setCurrentStage(id);
    setDevices(s.devices);
    setConnections(s.connections);
    setCables(s.cables);
    setMixer(s.mixer);
    setSpeaker(s.speaker);
    setAtem(s.atem);
    setObs(s.obs);
    setFaults(s.faults);
    setSelectedCable(Object.keys(s.cables)[0]);
    setSelectedDevice(STAGES[id].focus);
    setPending(null);
    setLatched([]);
    setCleared(false);
    setMeta({ start: Date.now(), penalty: 0, hintsUsed: 0 });
    setTracerOn(id !== 4);
    setViewers(id === 4 ? 1240 : 0);
    setChat(id === 4 ? [{ id: 1, name: 'pd_lee', text: '방송에 소리가 안 나요!!' }] : []);
    setModal({ type: 'briefing' });
    warnAt.current = {};
    prev.current = {};
    addLog(`━━ ${STAGES[id].title} 시작 ━━`, 'stage');
    if (id === 4) addLog('경고: 송출 오디오 신호 없음! 시청자들이 소리가 안 들린다고 합니다.', 'error');
  }, [addLog]);

  /* ---------- 캔버스 스케일 ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setScale(Math.max(0.56, e.contentRect.width / CANVAS_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  /* ---------- 미터 지터 & 시청자 시뮬레이션 ---------- */
  useEffect(() => {
    const t = setInterval(() => setJitter(-(Math.random() ** 1.5) * 12), 110);
    return () => clearInterval(t);
  }, []);

  const audioOkRef = useRef(false);
  audioOkRef.current = actual.audioOk && actual.videoOk;
  useEffect(() => {
    if (currentStage < 3 || !obs.streaming) return undefined;
    const t = setInterval(() => {
      const good = audioOkRef.current;
      setViewers((v) => Math.max(0, v + (good ? Math.round(Math.random() * 14 + 3) : -Math.round(Math.random() * 22 + 6))));
      if (Math.random() < 0.55) {
        const pool = good ? CHAT_GOOD : CHAT_BAD;
        setChat((c) => [...c.slice(-5), {
          id: Date.now(), name: CHAT_NAMES[Math.floor(Math.random() * CHAT_NAMES.length)],
          text: pool[Math.floor(Math.random() * pool.length)],
        }]);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [currentStage, obs.streaming]);

  /* ---------- 상태 변화 감시 → 로그/효과음 ---------- */
  useEffect(() => {
    const p = prev.current;
    if (actual.feedback && !p.feedback) { addLog('⚠ 경고: 하울링(피드백) 발생! 삐이이이——', 'error'); }
    if (!actual.feedback && p.feedback) addLog('하울링이 멈췄습니다.', 'ok');
    if (actual.ringing && !p.ringing && !actual.feedback) addLogThrottled('ring', '주의: 하울링 직전(링잉)입니다. 소리가 웅웅 울립니다.', 'warn', 6000);
    if (talking && actual.chIn != null && actual.chIn > 0) addLogThrottled('clip', '경고: 입력 신호가 너무 큽니다! (클리핑 · 소리가 찌그러짐)');
    if (talking && actual.chIn != null && actual.chIn < -30) addLogThrottled('low', '입력 신호가 너무 작습니다. GAIN을 올리세요 (잡음 대비 신호가 약함).', 'warn', 6000);
    if (talkHeld && !p.talkHeld && actual.micConn && !actual.micAtCh && !actual.isDigital) addLog('믹서에 신호가 들어오지 않습니다. 마이크가 어느 단자에 꽂혀 있는지 확인하세요.', 'warn');
    if (talkHeld && !p.talkHeld && actual.speakerOnPhones) addLog('PHONES 단자는 헤드폰 모니터링용입니다. 스피커는 MAIN OUT에 연결하세요.', 'warn');
    if (talkHeld && !p.talkHeld && actual.mainOut != null && actual.speakerLinked && !actual.spkOn) addLog('신호는 스피커까지 가는데 소리가 안 납니다. 스피커 전원을 확인하세요.', 'warn');
    if (currentStage >= 3 && obs.streaming) {
      const ok = actual.audioOk;
      if (!ok && p.audioOk) addLog('경고: 송출 오디오 신호 없음!', 'error');
      if (ok && p.audioOk === false) addLog('✔ 송출 오디오가 정상입니다. 시청자에게 소리가 전달됩니다.', 'ok');
    }
    prev.current = { feedback: actual.feedback, ringing: actual.ringing, talkHeld, audioOk: obs.streaming ? actual.audioOk : undefined };
  });

  useEffect(() => { sfx.setFeedback(actual.feedback); }, [actual.feedback, sfx]);
  useEffect(() => () => sfx.setFeedback(false), [sfx]);

  // 래치 미션 (예: 마이크 테스트)
  useEffect(() => {
    stage.objectives.forEach((o) => {
      if (o.latch && !latched.includes(o.id) && o.latch(ctx)) {
        setLatched((l) => [...l, o.id]);
        addLog(`✔ ${o.label} 성공! "아, 아— 마이크 테스트" 소리가 또렷하게 들립니다.`, 'ok');
        sfx.ok();
      }
    });
  });

  // 스테이지 4: 원인 해결 감지
  const fixedKey = `${faults.join(',')}|${fixedList.join(',')}`;
  const prevFixed = useRef(null);
  useEffect(() => {
    const key = faults.join(',');
    if (currentStage !== 4) { prevFixed.current = null; return; }
    if (prevFixed.current && prevFixed.current.key === key) {
      fixedList.filter((f) => !prevFixed.current.list.includes(f)).forEach((f) => {
        addLog(`🔧 원인 발견 [${FAULTS[f].title}]: ${FAULTS[f].desc}`, 'ok');
        sfx.ok();
      });
    }
    prevFixed.current = { key, list: fixedList };
  }, [fixedKey, currentStage]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스테이지 클리어
  useEffect(() => {
    if (!allDone || cleared) return;
    const elapsed = Math.round((Date.now() - meta.start) / 1000);
    const timeBonus = Math.max(0, 300 - elapsed);
    const score = Math.max(200, 1000 + timeBonus - meta.penalty);
    setCleared(true);
    setStageScores((s) => (s[currentStage] ? s : { ...s, [currentStage]: score }));
    setModal({ type: 'clear', score, timeBonus, penalty: meta.penalty, elapsed });
    addLog(`🏆 ${stage.title} 클리어! (+${score}점)`, 'ok');
    sfx.clear();
  }, [allDone, cleared]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 키보드 ---------- */
  useEffect(() => {
    const isField = (e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    const down = (e) => {
      if (e.code === 'Space' && !isField(e) && !modal) { e.preventDefault(); if (!e.repeat) setTalkHeld(true); }
      if (e.key === 'Escape') setPending(null);
    };
    const up = (e) => { if (e.code === 'Space' && !isField(e)) { e.preventDefault(); setTalkHeld(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [modal]);

  /* ---------- 장비 연결 로직 ---------- */
  const portName = (d, p) => `${devices[d].name ?? DEVICE_TYPES[devices[d].type].name} ${p.label}`;
  const isPortUsed = (d, p) => connections.some((c) => (c.from.d === d && c.from.p === p) || (c.to.d === d && c.to.p === p));

  const tryConnect = (a, b) => {
    const defA = DEVICE_TYPES[devices[a.d].type];
    const defB = DEVICE_TYPES[devices[b.d].type];
    const pa = findPort(defA, a.p);
    const pb = findPort(defB, b.p);
    if (a.d === b.d) { addLog('같은 장비의 단자끼리는 연결할 수 없습니다.', 'warn'); sfx.error(); return; }
    if (pa.dir === pb.dir) {
      addLog(`${pa.dir === 'out' ? '출력 ↔ 출력' : '입력 ↔ 입력'}은 연결할 수 없습니다. 신호는 항상 출력(OUT) → 입력(IN)으로 흐릅니다.`, 'warn');
      sfx.error(); return;
    }
    const [from, to, pf, pt] = pa.dir === 'out' ? [a, b, pa, pb] : [b, a, pb, pa];
    if (isPortUsed(to.d, to.p) || isPortUsed(from.d, from.p)) { addLog('이미 케이블이 꽂혀 있는 단자입니다. 기존 케이블을 클릭해 먼저 분리하세요.', 'warn'); sfx.error(); return; }
    if (!selectedCable) { addLog('먼저 하단 인벤토리에서 사용할 케이블을 선택하세요.', 'warn'); sfx.error(); return; }
    if (!cables[selectedCable]) { addLog(`${CABLES[selectedCable].name}이(가) 남아 있지 않습니다. 기존 연결을 분리하면 회수됩니다.`, 'warn'); sfx.error(); return; }
    const bad = [pf, pt].find((p) => !PORT_ACCEPTS[p.kind].includes(selectedCable));
    if (bad) {
      sfx.error();
      penalize(50, `✖ 케이블 불일치: ${CABLES[selectedCable].name}은(는) ${PORT_KIND_LABEL[bad.kind]}에 꽂을 수 없습니다. ${MISMATCH_TIP[bad.kind]}`);
      return;
    }
    const c = conn(from.d, from.p, to.d, to.p, selectedCable);
    setConnections((cs) => [...cs, c]);
    setCables((cb) => ({ ...cb, [selectedCable]: cb[selectedCable] - 1 }));
    addLog(`🔌 ${portName(from.d, pf)} → ${portName(to.d, pt)} 연결 (${CABLES[selectedCable].short})`, 'ok');
    sfx.click();
    if (to.d === 'speaker' && speaker.power) { sfx.pop(); penalize(30, '💥 펑! 스피커 전원이 켜진 채 케이블을 꽂아 팝 노이즈가 났습니다. 연결 작업은 스피커를 끄고 하세요'); }
    if (from.d === 'mixer' && from.p === 'phones') addLog('참고: PHONES는 헤드폰 모니터링 출력입니다. 스피커에는 보통 MAIN OUT을 씁니다.', 'warn');
    if (from.d === 'mic' && mixer.phantom && devices.mic.type === 'condenser_mic') addLog('팁: 팬텀 전원이 켜진 상태에서 꽂으면 "툭" 소리가 날 수 있으니 페이더를 내리고 작업하세요.', 'info');
  };

  const disconnect = (c) => {
    setConnections((cs) => cs.filter((x) => x.id !== c.id));
    setCables((cb) => ({ ...cb, [c.cable]: (cb[c.cable] ?? 0) + 1 }));
    addLog(`케이블 분리: ${c.from.d}.${c.from.p} → ${c.to.d}.${c.to.p} (${CABLES[c.cable].short} 회수)`, 'info');
    if (c.to.d === 'speaker' && speaker.power) { sfx.pop(); addLog('💥 스피커가 켜진 채로 케이블을 뽑아 팝 노이즈가 났습니다.', 'warn'); }
    if (currentStage >= 3 && obs.streaming) addLog('주의: 방송 중에 케이블을 뽑았습니다!', 'warn');
  };

  const toCanvas = (e) => {
    const r = innerRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  // 3D 스튜디오: 단자 클릭으로 연결 (첫 클릭 = 시작, 두 번째 클릭 = 완료)
  // (렌더링이 느려도 연속 클릭이 꼬이지 않도록 ref로 최신 대기 상태를 읽는다)
  const pendingRef = useRef(null);
  pendingRef.current = pending;
  const handlePortClick = (d, portId) => {
    const cur = pendingRef.current;
    if (cur && !(cur.d === d && cur.p === portId)) {
      tryConnect(cur, { d, p: portId });
      pendingRef.current = null;
      setPending(null);
      return;
    }
    if (cur) { pendingRef.current = null; setPending(null); return; }
    const next = { d, p: portId, dir: findPort(DEVICE_TYPES[devices[d].type], portId).dir };
    pendingRef.current = next;
    setPending(next);
  };

  const onPortDown = (e, d, port, dir) => {
    e.stopPropagation();
    e.preventDefault();
    if (pending && !(pending.d === d && pending.p === port.id)) {
      tryConnect(pending, { d, p: port.id });
      setPending(null);
      return;
    }
    if (pending) { setPending(null); return; }
    pendingMoved.current = false;
    setPending({ d, p: port.id, dir });
    setPointer(toCanvas(e));
  };

  const onCanvasMove = (e) => {
    if (dragRef.current) {
      const { id, ox, oy } = dragRef.current;
      const p = toCanvas(e);
      const def = DEVICE_TYPES[devices[id].type];
      setDevices((ds) => ({
        ...ds,
        [id]: { ...ds[id], x: clamp(p.x - ox, 10, CANVAS_W - def.w - 10), y: clamp(p.y - oy, 6, CANVAS_H - deviceHeight(def) - 6) },
      }));
      return;
    }
    if (pending) { setPointer(toCanvas(e)); pendingMoved.current = true; }
  };

  const onCanvasUp = (e) => {
    if (dragRef.current) { dragRef.current = null; return; }
    if (!pending || !pendingMoved.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-port]');
    if (!el) return;
    const [d, p] = el.dataset.port.split(':');
    if (d === pending.d && p === pending.p) return;
    tryConnect(pending, { d, p });
    setPending(null);
  };

  const onHeaderDown = (e, id) => {
    e.stopPropagation();
    setSelectedDevice(id);
    if (pending) setPending(null);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toCanvas(e);
    dragRef.current = { id, ox: p.x - devices[id].x, oy: p.y - devices[id].y };
  };

  const placeDevice = (id) => {
    setDevices((ds) => ({ ...ds, [id]: { ...ds[id], placed: true } }));
    setSelectedDevice(id);
    const d = devices[id];
    addLog(`📦 ${d.name ?? DEVICE_TYPES[d.type].name}을(를) 작업 공간에 배치했습니다.`, 'info');
    sfx.click();
  };

  /* ---------- 장비 제어 ---------- */
  const setMix = (k, v) => setMixer((m) => ({ ...m, [k]: v }));

  const toggleSpeakerPower = () => {
    const on = !speaker.power;
    setSpeaker((s) => ({ ...s, power: on }));
    if (on) {
      if (mixer.mainFader > 10 && nominal.speakerLinked) {
        sfx.pop();
        penalize(30, '💥 펑! 메인 페이더가 올라간 상태로 스피커를 켜서 팝 노이즈가 났습니다. 페이더를 내리고 스피커를 마지막에 켜세요');
      } else addLog('스피커 전원 ON. 앰프가 예열되었습니다.', 'ok');
    } else addLog('스피커 전원 OFF.', 'info');
  };

  const atemSetProgram = (n) => {
    setAtem((a) => ({ ...a, program: n }));
    addLog(`ATEM: PGM → ${n === 0 ? 'BLACK' : `입력 ${n}`} (핫컷)`, 'info');
  };
  const atemCut = () => {
    setAtem((a) => ({ ...a, program: a.preview, preview: a.program || a.preview }));
    addLog(`ATEM: CUT! PGM ← 입력 ${atem.preview}`, 'info');
    sfx.click();
  };
  const atemAuto = () => {
    if (atem.transitioning) return;
    setAtem((a) => ({ ...a, transitioning: true }));
    addLog(`ATEM: AUTO 디졸브 전환 중… (PGM ← 입력 ${atem.preview})`, 'info');
    setTimeout(() => setAtem((a) => ({ ...a, program: a.preview, preview: a.program || a.preview, transitioning: false })), 900);
  };

  const toggleStream = () => {
    if (!obs.streaming) {
      setObs((o) => ({ ...o, streaming: true }));
      setViewers((v) => (v > 0 ? v : 35));
      addLog('● 방송 시작! ON AIR', 'ok');
      if (!nominal.videoOk) addLog(`경고: 영상이 정상이 아닙니다 (${nominal.obsVideo === 'black' ? '검은 화면 송출 중' : '영상 소스 확인'}).`, 'error');
      if (!nominal.audioOk) addLog('경고: 송출 오디오 신호가 없습니다!', 'error');
      sfx.ok();
    } else {
      setObs((o) => ({ ...o, streaming: false }));
      addLog('■ 방송 종료 (OFFLINE)', 'warn');
      if (currentStage === 4) addLog('방송을 끊으면 시청자가 이탈합니다. 송출을 유지한 채로 문제를 해결하세요.', 'warn');
    }
  };

  /* ---------- 힌트 ---------- */
  const hintsAvail = stage.hints.length + (currentStage === 4 ? 1 : 0);
  const revealHint = () => {
    const level = meta.hintsUsed;
    let text;
    if (level < stage.hints.length) text = stage.hints[level];
    else {
      const left = faults.filter((f) => !faultFixed(f, st, nominal));
      if (!left.length) return;
      text = `남은 원인 중 하나: ${FAULTS[left[0]].title}. ${FAULTS[left[0]].desc.replace('있었습니다', '있습니다')}`;
    }
    setMeta((m) => ({ ...m, hintsUsed: m.hintsUsed + 1, penalty: m.penalty + 100, revealed: [...(m.revealed ?? []), text] }));
    if (currentStage === 4 && level === 1) setTracerOn(true);
    addLog(`💡 힌트 ${level + 1}: ${text} (-100점)`, 'hint');
  };

  /* ---------- 점수 ---------- */
  const totalScore = Object.values(stageScores).reduce((a, b) => a + b, 0);
  const goNext = () => {
    if (currentStage < 4) loadStage(currentStage + 1);
    else setModal({ type: 'final' });
  };
  const restartAll = () => { setStageScores({}); loadStage(1); };

  /* ---------- 렌더 헬퍼 ---------- */
  const lv = (x) => (x == null ? null : x + (talking ? jitter : 0));
  const camTally = (id) => {
    const n = Object.entries(nominal.camAt).find(([, c]) => c === id)?.[0];
    if (!n) return null;
    if (Number(n) === atem.program) return 'pgm';
    if (Number(n) === atem.preview) return 'pvw';
    return null;
  };

  const connLive = (c) => {
    if (c.from.d === 'mic') return actual.chIn != null;
    if (c.from.d === 'mixer' && c.from.p === 'main') return actual.mainOut != null;
    if (c.from.d === 'mixer' && c.from.p === 'usb') return actual.usbSignal != null;
    if (c.from.d.startsWith('cam') || c.from.d === 'atem') return true;
    return false;
  };

  const renderStatus = (d) => {
    switch (d.type) {
      case 'dynamic_mic':
      case 'condenser_mic':
        return (
          <div className="flex items-center gap-2 text-[11px]">
            {actual.chIn != null
              ? <span className="flex items-center gap-1 text-green-400"><Activity size={14} className="animate-pulse" />신호 전송 중</span>
              : <span className="text-slate-500">{talking ? '신호 없음' : '대기 중'}</span>}
            {d.type === 'condenser_mic' && (
              <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${nominal.micPowered ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>48V</span>
            )}
          </div>
        );
      case 'analog_mixer':
      case 'digital_mixer':
        return (
          <div className="space-y-1.5 text-[10px] text-slate-400">
            <div className="flex items-center gap-2"><span className="w-9">{d.type === 'digital_mixer' ? 'CH01' : 'CH1'}</span><Meter thin level={lv(actual.chIn)} />
              {mixer.chMute && <span className="text-red-400 font-bold">M</span>}</div>
            <div className="flex items-center gap-2"><span className="w-9">MAIN</span><Meter thin level={lv(actual.mainOut)} />
              {mixer.mainMute && <span className="text-red-400 font-bold">M</span>}</div>
          </div>
        );
      case 'speaker':
        return (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-2.5 h-2.5 rounded-full ${speaker.power ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-600'}`} />
            {actual.feedback
              ? <span className="text-red-400 font-bold animate-pulse">삐이이이——!!</span>
              : actual.audible
                ? <span className="flex items-center gap-1 text-sky-300"><Volume2 size={14} className="animate-pulse" />소리 출력 중</span>
                : <span className="text-slate-500">{speaker.power ? '무음' : '전원 꺼짐'}</span>}
            {currentStage === 2 && <span className="ml-auto text-[10px] text-slate-400">{speaker.position === 'front' ? '마이크 정면' : '마이크 뒤쪽'}</span>}
          </div>
        );
      case 'camera': {
        const t = camTally(d.id);
        return (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-3 h-3 rounded-full ${t === 'pgm' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : t === 'pvw' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-600'}`} />
            <span className={t === 'pgm' ? 'text-red-400 font-bold' : t === 'pvw' ? 'text-green-400' : 'text-slate-500'}>
              {t === 'pgm' ? 'TALLY · 송출 중' : t === 'pvw' ? 'TALLY · 대기(PVW)' : '탈리 꺼짐'}
            </span>
          </div>
        );
      }
      case 'atem':
        return (
          <div className="flex gap-2 text-[10px] font-mono">
            <span className="px-2 py-1 rounded bg-red-900/60 text-red-300 border border-red-700">PGM {atem.program || 'BLK'}</span>
            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 border border-green-700">PVW {atem.preview}</span>
            {atem.transitioning && <span className="text-amber-300 animate-pulse self-center">AUTO…</span>}
          </div>
        );
      case 'pc':
        return (
          <div className="flex gap-2 items-stretch">
            <div className="w-[118px] aspect-video rounded overflow-hidden border border-slate-600 shrink-0">
              <Scene src={nominal.obsVideo} label={false} fade={atem.transitioning} />
            </div>
            <div className="flex-1 flex flex-col justify-between text-[10px] min-w-0">
              <span className={`self-start px-1.5 py-0.5 rounded font-bold ${obs.streaming ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                {obs.streaming ? '● LIVE' : 'OFFLINE'}
              </span>
              <span className="text-slate-400">오디오</span>
              <Meter thin level={lv(actual.obsAudio)} />
              {obs.streaming && <span className="text-slate-300 flex items-center gap-1"><Users size={11} />{viewers.toLocaleString()}</span>}
            </div>
          </div>
        );
      default: return null;
    }
  };

  /* ---------- 장비 제어 패널 ---------- */
  const renderPanel = () => {
    const d = devices[selectedDevice];
    if (!d) return <p className="text-sm text-slate-400">캔버스에서 장비를 클릭하면 제어 패널이 열립니다.</p>;
    const def = DEVICE_TYPES[d.type];
    const Icon = def.icon;
    const head = (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-sky-300" />
          <span className="font-bold">{d.name ?? def.name}</span>
          <span className="text-xs text-slate-400">{def.model}</span>
        </div>
        <details className="group text-xs text-slate-300 bg-sky-950/40 border border-sky-900 rounded p-2">
          <summary className="cursor-pointer select-none text-sky-300 flex items-center gap-1"><Info size={13} /> 기초 원리</summary>
          <p className="mt-1.5 leading-relaxed">{def.info}</p>
        </details>
      </div>
    );
    if (!d.placed) {
      return <div className="space-y-3">{head}<p className="text-sm text-amber-300">아직 배치되지 않았습니다. 하단 인벤토리에서 배치하세요.</p></div>;
    }
    switch (d.type) {
      case 'analog_mixer':
      case 'digital_mixer': {
        const digital = d.type === 'digital_mixer';
        return (
          <div className="space-y-3">
            {head}
            {digital && (
              <Section title="라우팅 (ROUTING)" icon={Cable}>
                <label htmlFor="ch1src" className="block text-xs text-slate-400">CH01 입력 패치 (Input Source)
                  <select id="ch1src" value={mixer.ch1Source}
                    onChange={(e) => { setMix('ch1Source', e.target.value); addLog(`X32: CH01 입력 소스 → ${e.target.selectedOptions[0].text}`, 'info'); }}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                    <option value="local1">Local In 1 (아날로그 XLR)</option>
                    <option value="local2">Local In 2 (아날로그 XLR)</option>
                    <option value="aes50a1">AES50 A-1 (디지털 스테이지박스)</option>
                    <option value="off">Off</option>
                  </select>
                </label>
                <label htmlFor="usbout" className="block text-xs text-slate-400">USB(Card) 출력 1-2 소스
                  <select id="usbout" value={mixer.usbOut}
                    onChange={(e) => { setMix('usbOut', e.target.value); addLog(`X32: USB 출력 1-2 → ${e.target.selectedOptions[0].text}`, 'info'); }}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                    <option value="main">Main L/R (메인 믹스)</option>
                    <option value="bus1">Mix Bus 1 (비어 있음)</option>
                    <option value="off">Off</option>
                  </select>
                </label>
              </Section>
            )}
            <Section title={digital ? 'CH01 채널 스트립' : 'CH1 채널 스트립'} icon={SlidersHorizontal}>
              <div className="flex flex-wrap gap-2">
                <ToggleBtn on={mixer.phantom} color="amber" title="콘덴서 마이크용 +48V 전원"
                  onClick={() => {
                    const on = !mixer.phantom;
                    setMix('phantom', on);
                    addLog(`+48V 팬텀 전원 ${on ? 'ON' : 'OFF'}`, 'info');
                    if (on && devices.mic?.type === 'dynamic_mic') addLog('참고: 다이나믹 마이크는 팬텀 전원이 필요 없습니다 (대부분 무해하지만 불필요).', 'info');
                  }}>
                  <Zap size={12} className="inline -mt-0.5" /> 48V
                </ToggleBtn>
                <ToggleBtn on={mixer.chMute} onClick={() => { setMix('chMute', !mixer.chMute); addLog(`CH1 MUTE ${!mixer.chMute ? 'ON' : 'OFF'}`, 'info'); }}>MUTE</ToggleBtn>
              </div>
              <Slider id="gain" label="GAIN (프리앰프)" value={mixer.gain} min={0} max={60} onChange={(v) => setMix('gain', v)} display={`+${mixer.gain} dB`} accent="accent-red-400" />
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>입력 미터 {talking ? '' : '(말하기 시 표시)'}</span><span className="font-mono tabular-nums text-slate-200">{fmtDb(actual.chIn)}</span></div>
                <Meter level={lv(actual.chIn)} target={currentStage === 2 ? [-20, -6] : null} />
                {currentStage === 2 && <div className="text-[11px] text-slate-500 mt-0.5">흰 테두리 = 목표 구간 (-20 ~ -6 dB)</div>}
              </div>
              {!digital && (
                <div className="grid grid-cols-3 gap-2">
                  <Slider id="eqh" label="HIGH" value={mixer.eqHigh} min={-15} max={15} onChange={(v) => setMix('eqHigh', v)} display={`${mixer.eqHigh > 0 ? '+' : ''}${mixer.eqHigh}`} accent="accent-amber-300" />
                  <Slider id="eqm" label="MID 2.5k" value={mixer.eqMid} min={-15} max={15} onChange={(v) => setMix('eqMid', v)} display={`${mixer.eqMid > 0 ? '+' : ''}${mixer.eqMid}`} accent="accent-amber-300" />
                  <Slider id="eql" label="LOW" value={mixer.eqLow} min={-15} max={15} onChange={(v) => setMix('eqLow', v)} display={`${mixer.eqLow > 0 ? '+' : ''}${mixer.eqLow}`} accent="accent-amber-300" />
                </div>
              )}
              <Slider id="chf" label="채널 페이더" value={mixer.chFader} min={0} max={100} onChange={(v) => setMix('chFader', v)} display={fmtDb(faderDb(mixer.chFader))} />
            </Section>
            <Section title={digital ? 'MAIN L/R 버스' : 'MAIN 마스터'} icon={Volume2}>
              <div className="flex gap-2">
                <ToggleBtn on={mixer.mainMute} onClick={() => { setMix('mainMute', !mixer.mainMute); addLog(`MAIN MUTE ${!mixer.mainMute ? 'ON' : 'OFF'}`, 'info'); }}>MAIN MUTE</ToggleBtn>
              </div>
              <Slider id="mainf" label="메인 페이더" value={mixer.mainFader} min={0} max={100} onChange={(v) => setMix('mainFader', v)} display={fmtDb(faderDb(mixer.mainFader))} />
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>MAIN 출력 미터</span><span className="font-mono tabular-nums text-slate-200">{fmtDb(actual.mainOut)}</span></div>
                <Meter level={lv(actual.mainOut)} />
              </div>
            </Section>
          </div>
        );
      }
      case 'speaker':
        return (
          <div className="space-y-3">
            {head}
            <Section title="전원 / 배치" icon={Power}>
              <ToggleBtn on={speaker.power} color="green" onClick={toggleSpeakerPower}><Power size={12} className="inline -mt-0.5" /> POWER {speaker.power ? 'ON' : 'OFF'}</ToggleBtn>
              {currentStage === 2 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400">스피커 위치</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['front', '마이크 정면 (마이크를 향함)'], ['behind', '마이크 뒤쪽 (객석을 향함)']].map(([v, t]) => (
                      <button key={v} type="button"
                        onClick={() => { setSpeaker((s) => ({ ...s, position: v })); addLog(`스피커를 ${t}으로 옮겼습니다.`, 'info'); }}
                        className={`text-xs p-2 rounded border ${speaker.position === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>스피커 출력</span><span className="font-mono tabular-nums">{actual.feedback ? '하울링!' : fmtDb(actual.speakerLevel)}</span></div>
                <Meter level={actual.feedback ? 6 : lv(actual.speakerLevel)} />
              </div>
            </Section>
          </div>
        );
      case 'atem':
        return (
          <div className="space-y-3">
            {head}
            <Section title="스위처 컨트롤" icon={Tv}>
              <div className="grid grid-cols-2 gap-2">
                <div className="aspect-video rounded overflow-hidden border-2 border-green-600 relative">
                  <Scene src={nominal.previewCam ?? 'black'} />
                  <span className="absolute top-1 left-1 text-[10px] font-bold bg-green-700 px-1 rounded">PVW</span>
                </div>
                <div className="aspect-video rounded overflow-hidden border-2 border-red-600 relative">
                  <Scene src={nominal.programCam ?? 'black'} fade={atem.transitioning} />
                  <span className="absolute top-1 left-1 text-[10px] font-bold bg-red-700 px-1 rounded">PGM</span>
                </div>
              </div>
              {[['PGM', 'program', 'bg-red-600 border-red-400', atemSetProgram], ['PVW', 'preview', 'bg-green-600 border-green-400', (n) => { setAtem((a) => ({ ...a, preview: n })); }]].map(([lbl, key, onCls, fn]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-9 text-[11px] font-bold text-slate-400">{lbl}</span>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} type="button" onClick={() => fn(n)}
                      title={nominal.camAt[n] ? devices[nominal.camAt[n]].name : '입력 없음'}
                      className={`w-9 h-9 rounded border text-sm font-bold ${atem[key] === n ? onCls : 'bg-slate-700 border-slate-600 hover:bg-slate-600'} ${nominal.camAt[n] ? '' : 'opacity-50'}`}>{n}</button>
                  ))}
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={atemCut} className="flex-1 py-2 rounded bg-slate-200 text-slate-900 font-black hover:bg-white">CUT</button>
                <button type="button" onClick={atemAuto} className={`flex-1 py-2 rounded font-black ${atem.transitioning ? 'bg-amber-400 text-slate-900' : 'bg-amber-600 hover:bg-amber-500'}`}>AUTO</button>
              </div>
              <p className="text-[11px] text-slate-500">PVW에서 다음 화면을 고르고 CUT(즉시) 또는 AUTO(디졸브)로 PGM에 송출합니다.</p>
            </Section>
          </div>
        );
      case 'pc':
        return (
          <div className="space-y-3">
            {head}
            <Section title="OBS Studio" icon={MonitorPlay}>
              <div className="aspect-video rounded overflow-hidden border border-slate-600 relative">
                <Scene src={nominal.obsVideo} fade={atem.transitioning} />
                {obs.streaming && <span className="absolute top-1.5 right-1.5 text-[10px] font-bold bg-red-600 px-1.5 rounded animate-pulse">● LIVE</span>}
              </div>
              <label htmlFor="obsv" className="block text-xs text-slate-400">영상 소스 (Video Capture Device)
                <select id="obsv" value={obs.videoSource}
                  onChange={(e) => { setObs((o) => ({ ...o, videoSource: e.target.value })); addLog(`OBS: 영상 소스 → ${e.target.selectedOptions[0].text}`, 'info'); }}
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                  <option value="none">선택 안 함</option>
                  <option value="atem">Blackmagic ATEM Mini (USB)</option>
                  <option value="facecam">PC 내장 웹캠</option>
                </select>
              </label>
              <label htmlFor="obsa" className="block text-xs text-slate-400">오디오 소스 (Audio Input)
                <select id="obsa" value={obs.audioSource}
                  onChange={(e) => {
                    setObs((o) => ({ ...o, audioSource: e.target.value }));
                    addLog(`OBS: 오디오 소스 → ${e.target.selectedOptions[0].text}`, 'info');
                    if (e.target.value === 'builtin') addLog('PC 내장 마이크는 방송 품질이 아니고 진행자 마이크 소리를 받지 못합니다.', 'warn');
                  }}
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                  <option value="none">선택 안 함</option>
                  <option value="x32">X32 USB Audio (Ch 1-2)</option>
                  <option value="builtin">PC 내장 마이크</option>
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button type="button" title={obs.audioMuted ? '음소거 해제' : '음소거'}
                  onClick={() => { setObs((o) => ({ ...o, audioMuted: !o.audioMuted })); addLog(`OBS 오디오 ${obs.audioMuted ? '음소거 해제' : '음소거'}`, 'info'); }}
                  className={`p-1.5 rounded border ${obs.audioMuted ? 'bg-red-700 border-red-400' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>
                  {obs.audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <div className="flex-1"><Meter level={lv(actual.obsAudio)} /></div>
              </div>
              <button type="button" onClick={toggleStream}
                className={`w-full py-2.5 rounded font-bold flex items-center justify-center gap-2 ${obs.streaming ? 'bg-slate-200 text-slate-900 hover:bg-white' : 'bg-red-600 hover:bg-red-500'}`}>
                <Radio size={16} /> {obs.streaming ? '방송 중지' : '방송 시작'}
              </button>
            </Section>
            {obs.streaming && (
              <Section title={`라이브 채팅 · 시청자 ${viewers.toLocaleString()}명`} icon={MessageSquare}>
                <div className="space-y-1 text-xs min-h-[60px]">
                  {chat.map((m) => <div key={m.id}><span className="text-sky-300">{m.name}</span> <span className="text-slate-200">{m.text}</span></div>)}
                </div>
              </Section>
            )}
          </div>
        );
      case 'camera': {
        const t = camTally(d.id);
        const at = Object.entries(nominal.camAt).find(([, c]) => c === d.id)?.[0];
        return (
          <div className="space-y-3">
            {head}
            <div className="aspect-video rounded overflow-hidden border border-slate-600"><Scene src={d.id} /></div>
            <p className="text-sm text-slate-300">{at ? `ATEM 입력 ${at}에 연결됨 · ${t === 'pgm' ? '송출 중(PGM)' : t === 'pvw' ? '대기 중(PVW)' : '대기'}` : 'ATEM에 연결되지 않았습니다.'}</p>
          </div>
        );
      }
      default:
        return (
          <div className="space-y-3">
            {head}
            <p className="text-sm text-slate-300">
              {nominal.micAtCh ? '믹서 채널에 연결되어 있습니다.' : nominal.micConn ? '믹서에 꽂혀 있지만 채널로 신호가 가지 않습니다.' : '믹서에 연결되지 않았습니다.'}
              {d.type === 'condenser_mic' && (nominal.micPowered ? ' 48V 팬텀 전원 공급 중.' : ' 48V 팬텀 전원이 공급되지 않고 있습니다!')}
            </p>
          </div>
        );
    }
  };

  /* ---------- 캔버스 렌더 ---------- */
  const placedDevices = Object.values(devices).filter((d) => d.placed);
  const unplaced = Object.values(devices).filter((d) => !d.placed);
  const pendingPos = pending ? portPos(devices[pending.d], DEVICE_TYPES[devices[pending.d].type], pending.p) : null;
  const cablePath = (a, b) => {
    const dx = Math.max(50, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const LOG_COLORS = { info: 'text-slate-300', ok: 'text-green-400', warn: 'text-amber-300', error: 'text-red-400', hint: 'text-sky-300', stage: 'text-fuchsia-300 font-bold' };
  const elapsedLabel = () => {
    const s = Math.round((Date.now() - meta.start) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const liveBroken = isLive && !(nominal.audioOk && nominal.videoOk);

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-4 sm:px-6 font-sans">
      <style>{`
        @keyframes bm-flow { to { stroke-dashoffset: -24; } }
        .bm-flow { stroke-dasharray: 8 6; animation: bm-flow .6s linear infinite; }
        .bm-noevents { pointer-events: none !important; }
        @keyframes bm-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
        .bm-shake { animation: bm-shake .12s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .bm-flow, .bm-shake, .animate-pulse { animation: none !important; } }
      `}</style>

      {/* Header */}
      <header className="flex flex-wrap gap-4 justify-between items-center bg-slate-800 p-4 rounded-lg shadow-lg mb-4 border-b-4 border-slate-700">
        <div className="min-w-0 flex-1 basis-[320px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-blue-400">방송장비 마스터 🎛️</h1>
            <nav className="flex gap-1" aria-label="스테이지 선택">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => loadStage(n)} title={STAGES[n].title}
                  className={`w-8 h-8 rounded text-sm font-bold border ${n === currentStage ? 'bg-blue-600 border-blue-400' : stageScores[n] ? 'bg-green-800 border-green-600 text-green-200' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>
                  {n}
                </button>
              ))}
            </nav>
          </div>
          <p className="text-slate-400 mt-1"><span className="text-slate-200 font-semibold">{stage.title}</span> <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 ml-1">{stage.tag}</span></p>
          <p className="text-slate-300 text-sm mt-1">{stage.mission}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-right mr-1">
            <div className="text-[11px] text-slate-400">총점</div>
            <div className="font-mono font-bold text-lg tabular-nums text-amber-300">{totalScore.toLocaleString()}</div>
          </div>
          <button type="button" onClick={() => setModal({ type: 'hint' })}
            className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold flex items-center gap-1.5 hover:bg-amber-400">
            <Lightbulb size={18} /> 힌트 <span className="text-xs">({meta.hintsUsed}/{hintsAvail})</span>
          </button>
          <button type="button" onClick={() => { const on = !soundOn; setSoundOn(on); if (on) sfx.ensure(); }}
            title={soundOn ? '효과음 끄기' : '효과음 켜기 (하울링 소리 포함)'}
            className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600">
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} className="text-slate-400" />}
          </button>
          <button type="button" onClick={() => loadStage(currentStage)} title="스테이지 다시 시작"
            className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600"><RotateCcw size={18} /></button>
          <div className={`px-5 py-2 rounded-full font-bold flex items-center gap-2 border-2 ${isLive ? (liveBroken ? 'bg-amber-600 border-amber-300 animate-pulse' : 'bg-red-600 border-red-300 animate-pulse shadow-[0_0_20px_rgba(239,68,68,.7)]') : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
            <Radio size={20} />
            {isLive ? (liveBroken ? 'ON AIR · 이상' : 'ON AIR') : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 lg:self-start bg-slate-800 rounded-lg p-3 border-2 border-slate-700 min-w-0 flex flex-col gap-3">
          {/* 툴바 */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400 flex items-center gap-1"><Cable size={15} /> 선택한 케이블:</span>
            {selectedCable
              ? <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-600"><span className={`w-2.5 h-2.5 rounded-full ${CABLES[selectedCable].dot}`} />{CABLES[selectedCable].name} ×{cables[selectedCable] ?? 0}</span>
              : <span className="text-amber-300">없음</span>}
            {pending && <span className="text-sky-300 animate-pulse">→ 연결할 반대쪽 단자를 클릭하세요 (Esc 취소)</span>}
            <div className="ml-auto flex items-center gap-2">
              {stage.autoTalk
                ? <span className="flex items-center gap-1.5 text-xs text-green-300 px-2 py-1 rounded bg-green-950 border border-green-800"><Mic size={14} className="animate-pulse" /> 진행자 발언 중</span>
                : (
                  <button type="button"
                    onPointerDown={(e) => { e.preventDefault(); setTalkHeld(true); }}
                    onPointerUp={() => setTalkHeld(false)} onPointerLeave={() => setTalkHeld(false)} onPointerCancel={() => setTalkHeld(false)}
                    className={`touch-none select-none px-4 py-2 rounded-md font-bold flex items-center gap-2 border ${talkHeld ? 'bg-green-600 border-green-300' : 'bg-slate-700 border-slate-500 hover:bg-slate-600'}`}>
                    <Hand size={16} /> {talkHeld ? '"아, 아— 마이크 테스트"' : '말하기 (누르고 있기 · Space)'}
                  </button>
                )}
            </div>
          </div>

          {/* 보기 전환 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex rounded-md overflow-hidden border border-slate-600" role="tablist" aria-label="보기 전환">
              {[['3d', '3D 스튜디오', Box], ['2d', '배선도', Network]].map(([v, t, Ic]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); setPending(null); }}
                  className={`px-3 py-1.5 flex items-center gap-1.5 font-bold ${view === v ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`}>
                  <Ic size={14} /> {t}
                </button>
              ))}
            </div>
            {view === '3d' && (
              <>
                <button type="button" onClick={() => setShowLabels((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1 ${showLabels ? 'bg-slate-700 border-slate-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                  <Tag size={13} /> 단자 이름 {showLabels ? 'ON' : 'OFF'}
                </button>
                <button type="button" onClick={() => setCamReset((n) => n + 1)}
                  className="px-2.5 py-1.5 rounded-md border bg-slate-900 border-slate-700 hover:bg-slate-700 flex items-center gap-1">
                  <RotateCcw size={13} /> 전체 보기
                </button>
                <span className="text-slate-500 ml-1">가까이 보기:</span>
                {Object.values(devices).filter((d) => d.placed).map((d) => (
                  <button key={d.id} type="button" onClick={() => setFocusReq({ id: d.id, key: Date.now() })}
                    className={`px-2 py-1 rounded border ${selectedDevice === d.id ? 'border-sky-400 bg-sky-900/60' : 'border-slate-700 bg-slate-900 hover:bg-slate-700'}`}>
                    {(d.name ?? DEVICE_TYPES[d.type].name).split(' · ')[0]}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* 장비 배치 영역 (Canvas) */}
          {view === '3d' ? (
            <div className="relative w-full h-[440px] sm:h-[min(64vh,580px)] sm:min-h-[340px] rounded-md overflow-hidden border border-slate-700 bg-[#0b1018]">
              <Studio3D
                stageId={currentStage} devices={devices} connections={connections} mixer={mixer} speaker={speaker}
                atem={atem} obs={obs} actual={actual} nominal={nominal} talking={talking} jitter={jitter} viewers={viewers}
                pending={pending} selectedCable={selectedCable} selectedDevice={selectedDevice} labels={showLabels} resetKey={`${currentStage}-${camReset}`} focusRequest={focusReq}
                onPortClick={handlePortClick} onSelectDevice={setSelectedDevice} onDisconnect={disconnect}
                onPlace={placeDevice} onCancelPending={() => setPending(null)}
              />
              <div className="pointer-events-none absolute bottom-2 left-3 right-3 text-[11px] text-slate-400 drop-shadow">
                드래그: 회전 · 휠/핀치: 확대 · 장비 더블클릭: 가까이 보기 · 단자 클릭 → 반대쪽 단자 클릭: 연결 · 케이블 클릭: 분리
              </div>
            </div>
          ) : (
          <div ref={wrapRef} className="w-full overflow-x-auto rounded-md">
            <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
              <div
                ref={innerRef}
                className={`relative origin-top-left rounded-md border border-slate-700 ${actual.feedback ? 'bm-shake' : ''}`}
                style={{
                  width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`,
                  backgroundColor: '#0b1220',
                  backgroundImage: 'radial-gradient(circle, rgba(148,163,184,.14) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
                onPointerMove={onCanvasMove}
                onPointerUp={onCanvasUp}
                onPointerDown={() => { if (pending) setPending(null); }}
              >
                {/* 케이블 레이어 */}
                <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} style={{ overflow: 'visible' }}>
                  {connections.map((c) => {
                    const a = portPos(devices[c.from.d], DEVICE_TYPES[devices[c.from.d].type], c.from.p);
                    const b = portPos(devices[c.to.d], DEVICE_TYPES[devices[c.to.d].type], c.to.p);
                    const path = cablePath(a, b);
                    const live = connLive(c);
                    return (
                      <g key={c.id} className="cursor-pointer group" onPointerDown={(e) => { e.stopPropagation(); disconnect(c); }}>
                        <title>{CABLES[c.cable].name} · 클릭하면 분리</title>
                        <path d={path} stroke="transparent" strokeWidth={16} fill="none" />
                        <path d={path} stroke="#020617" strokeWidth={7} fill="none" strokeLinecap="round" />
                        <path d={path} stroke={CABLES[c.cable].stroke} strokeWidth={4} fill="none" strokeLinecap="round" className="group-hover:opacity-60" />
                        {live && <path d={path} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={2} fill="none" className="bm-flow" />}
                      </g>
                    );
                  })}
                  {actual.feedback && devices.speaker?.placed && devices.mic?.placed && (
                    <path
                      d={`M ${devices.speaker.x} ${devices.speaker.y + 10} Q ${(devices.speaker.x + devices.mic.x) / 2} ${devices.mic.y - 120}, ${devices.mic.x + 80} ${devices.mic.y}`}
                      stroke="#ef4444" strokeWidth={3} fill="none" className="bm-flow" opacity={0.8}
                    />
                  )}
                  {pending && pendingPos && pointer && (
                    <path d={pending.dir === 'out' ? cablePath(pendingPos, pointer) : cablePath(pointer, pendingPos)}
                      stroke={selectedCable ? CABLES[selectedCable].stroke : '#94a3b8'} strokeWidth={3} strokeDasharray="6 5" fill="none" pointerEvents="none" />
                  )}
                </svg>

                {placedDevices.map((d) => {
                  const def = DEVICE_TYPES[d.type];
                  const Icon = def.icon;
                  const h = deviceHeight(def);
                  const selected = selectedDevice === d.id;
                  const ports = [...def.ins.map((p, i) => ({ ...p, dir: 'in', i })), ...def.outs.map((p, i) => ({ ...p, dir: 'out', i }))];
                  return (
                    <div key={d.id}
                      className={`absolute rounded-lg bg-slate-800 border-2 shadow-xl ${selected ? 'border-sky-400' : 'border-slate-600'} ${d.id === 'speaker' && actual.feedback ? 'ring-4 ring-red-500/70' : ''}`}
                      style={{ left: d.x, top: d.y, width: def.w, height: h }}
                      onPointerDown={(e) => { e.stopPropagation(); setSelectedDevice(d.id); if (pending) setPending(null); }}
                    >
                      <div
                        className="flex items-center gap-2 px-2.5 rounded-t-md bg-slate-700 cursor-grab active:cursor-grabbing touch-none select-none"
                        style={{ height: HEADER_H - 6 }}
                        onPointerDown={(e) => onHeaderDown(e, d.id)}
                        title="드래그하여 이동 · 클릭하여 제어 패널 열기"
                      >
                        <Icon size={18} className={d.id === 'speaker' && actual.audible ? 'text-sky-300' : 'text-gray-300'} />
                        <div className="leading-tight min-w-0">
                          <div className="text-[13px] font-bold truncate">{d.name ?? def.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{def.model}</div>
                        </div>
                      </div>
                      {ports.map((p) => {
                        const used = isPortUsed(d.id, p.id);
                        const isPending = pending && pending.d === d.id && pending.p === p.id;
                        const candidate = pending && !isPending && pending.dir !== p.dir && pending.d !== d.id && !used;
                        const top = HEADER_H + p.i * ROW_H;
                        return (
                          <React.Fragment key={p.id}>
                            <span className={`absolute text-[10px] font-mono text-slate-300 ${p.dir === 'in' ? 'left-4' : 'right-4 text-right'}`}
                              style={{ top: top + 6 }}>{p.label}</span>
                            <div
                              data-port={`${d.id}:${p.id}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`${d.name ?? def.name} ${p.label} (${PORT_KIND_LABEL[p.kind]})`}
                              title={`${p.label} · ${PORT_KIND_LABEL[p.kind]} · ${p.dir === 'in' ? '입력' : '출력'}`}
                              onPointerDown={(e) => onPortDown(e, d.id, p, p.dir)}
                              onKeyDown={(e) => { if (e.key === 'Enter') onPortDown(e, d.id, p, p.dir); }}
                              className="absolute touch-none cursor-crosshair rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                              style={{ left: p.dir === 'in' ? -10 : def.w - 14, top: top + ROW_H / 2 - 10, width: 20, height: 20 }}
                            >
                              <div className={`w-full h-full rounded-full border-[3px] transition ${isPending ? 'scale-125 bg-white' : used ? '' : 'bg-slate-950'} ${candidate ? 'ring-4 ring-sky-400/60 animate-pulse' : ''} hover:scale-125`}
                                style={{ borderColor: PORT_COLOR[p.kind], backgroundColor: used && !isPending ? PORT_COLOR[p.kind] : undefined }} />
                            </div>
                          </React.Fragment>
                        );
                      })}
                      <div className="absolute left-2.5 right-2.5" style={{ top: HEADER_H + deviceRows(def) * ROW_H + 4 }}>
                        {renderStatus(d)}
                      </div>
                    </div>
                  );
                })}

                {placedDevices.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 pointer-events-none">
                    <Package size={42} />
                    <p>하단 인벤토리에서 장비를 꺼내 배치하세요.</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-3 text-[11px] text-slate-500 pointer-events-none">
                  ● 오른쪽 = 출력(OUT) · 왼쪽 = 입력(IN) · 단자 클릭 또는 드래그로 연결 · 케이블 클릭 시 분리 · 장비 상단을 드래그해 이동
                </div>
              </div>
            </div>
          </div>

          )}

          {/* 신호 추적기 */}
          <div className="bg-slate-900 rounded-md p-3 border border-slate-700">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Activity size={13} /> 신호 흐름 추적기 (Signal Flow)</div>
            {tracerOn ? (
              <div className="space-y-2">
                {[['오디오', trace.audio], ...(trace.video ? [['비디오', trace.video]] : [])].map(([name, steps]) => (
                  <div key={name} className="flex items-center gap-1 flex-wrap text-[11px]">
                    <span className="w-12 text-slate-400 shrink-0">{name}</span>
                    {steps.map((s, i) => (
                      <React.Fragment key={s.label}>
                        {i > 0 && <ChevronRight size={12} className={s.status === 'idle' ? 'text-slate-700' : 'text-slate-500'} />}
                        <span className={`px-1.5 py-0.5 rounded border ${{
                          ok: 'bg-green-950 border-green-700 text-green-300',
                          warn: 'bg-amber-950 border-amber-600 text-amber-300',
                          fail: 'bg-red-950 border-red-500 text-red-300 animate-pulse',
                          idle: 'bg-slate-900 border-slate-800 text-slate-600',
                        }[s.status]}`}>
                          {s.label}{s.status === 'warn' ? ` · ${s.warn}` : ''}{s.status === 'fail' ? ' ✖' : ''}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><Wrench size={13} /> 돌발 상황에서는 신호 추적기가 꺼져 있습니다. 직접 장비를 점검하거나 힌트 2단계에서 켤 수 있습니다.</p>
            )}
          </div>
        </div>

        {/* 미션 + 장비 제어 */}
        <aside className="flex flex-col gap-4 min-w-0">
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-2">
              <h2 className="text-lg font-semibold">미션</h2>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {objectiveStatus.filter((o) => o.done).length}/{objectiveStatus.length}
                {currentStage >= 3 && obs.streaming && ` · 시청자 ${viewers.toLocaleString()}`}
                {meta.penalty > 0 && ` · 감점 ${meta.penalty}`}
              </span>
            </div>
            <ul className="space-y-1.5">
              {objectiveStatus.map((o) => (
                <li key={o.id} className={`flex items-start gap-2 text-sm ${o.done ? 'text-green-300' : 'text-slate-300'}`}>
                  {o.done ? <CheckCircle2 size={17} className="shrink-0 mt-0.5" /> : <Circle size={17} className="shrink-0 mt-0.5 text-slate-500" />}
                  <span>{o.label}</span>
                </li>
              ))}
            </ul>
            {cleared && (
              <button type="button" onClick={goNext} className="mt-3 w-full py-2 rounded bg-green-600 hover:bg-green-500 font-bold flex items-center justify-center gap-1">
                {currentStage < 4 ? '다음 스테이지' : '최종 결과'} <ChevronRight size={16} />
              </button>
            )}
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-slate-700 lg:max-h-[640px] lg:overflow-y-auto">
            <h2 className="text-lg font-semibold border-b border-slate-600 pb-2 mb-3">장비 제어 패널</h2>
            {renderPanel()}
          </div>
        </aside>
      </div>

      {/* Inventory & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-4 border-2 border-slate-700">
          <div>
            <h2 className="text-lg font-semibold border-b border-slate-600 pb-2 mb-2">인벤토리 · 장비</h2>
            {unplaced.length ? (
              <div className="flex flex-col gap-2">
                {unplaced.map((d) => {
                  const def = DEVICE_TYPES[d.type];
                  const Icon = def.icon;
                  return (
                    <div key={d.id} className="flex items-center gap-2 bg-slate-900 rounded p-2 border border-slate-700">
                      <Icon size={18} className="text-slate-300" />
                      <div className="text-sm leading-tight flex-1 min-w-0"><div className="truncate">{d.name ?? def.name}</div><div className="text-[11px] text-slate-500">{def.model}</div></div>
                      <button type="button" onClick={() => placeDevice(d.id)} className="text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 font-bold">배치</button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-500">모든 장비가 작업 공간에 배치되었습니다.</p>}
          </div>
          <div>
            <h2 className="text-lg font-semibold border-b border-slate-600 pb-2 mb-2">인벤토리 · 케이블</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(cables).map(([k, n]) => (
                <button key={k} type="button" onClick={() => setSelectedCable(k)} title={CABLES[k].desc}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 border transition ${selectedCable === k ? 'bg-blue-800 border-blue-300 text-white' : 'bg-blue-950 border-blue-900 text-blue-200 hover:bg-blue-900'} ${n === 0 ? 'opacity-50' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${CABLES[k].dot}`} />
                  {CABLES[k].name} <span className="font-mono text-xs">×{n}</span>
                </button>
              ))}
            </div>
            {selectedCable && <p className="text-xs text-slate-400 mt-2">{CABLES[selectedCable].name}: {CABLES[selectedCable].desc}</p>}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 rounded-lg p-4 border-2 border-slate-700 flex flex-col min-w-0">
          <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-2">
            <h2 className="text-lg font-semibold">시스템 로그</h2>
            <span className="text-xs text-slate-500 font-mono">경과 {elapsedLabel()}</span>
          </div>
          <div className="h-56 bg-black rounded-lg p-3 overflow-y-auto font-mono text-sm space-y-0.5">
            {systemLog.map((log) => (
              <div key={log.id} className={LOG_COLORS[log.type] ?? 'text-green-400'}>
                <span className="text-slate-600">{log.time ? `[${log.time}] ` : ''}</span>{`> ${log.msg}`}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onPointerDown={(e) => { if (e.target === e.currentTarget && modal.type === 'hint') setModal(null); }}>
          <div className="bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative">
            {modal.type === 'briefing' && (
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-widest text-sky-400">STAGE {currentStage} · {stage.tag}</div>
                <h2 className="text-2xl font-bold">{stage.title.split(': ')[1]}</h2>
                {stage.briefing.map((p) => <p key={p} className="text-slate-300 leading-relaxed">{p}</p>)}
                <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-amber-300 font-bold mb-1">MISSION</div>
                  <p className="text-sm">{stage.mission}</p>
                </div>
                {currentStage === 1 && (
                  <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                    <li>인벤토리에서 장비를 <b className="text-slate-200">배치</b>하고 케이블 종류를 고릅니다.</li>
                    <li>장비의 <b className="text-slate-200">출력 단자(오른쪽 ●)</b>를 누른 뒤 <b className="text-slate-200">입력 단자(왼쪽 ●)</b>를 누르면 연결됩니다. 드래그도 됩니다.</li>
                    <li>장비를 클릭하면 오른쪽 패널에서 GAIN·페이더·전원 등을 조작할 수 있습니다.</li>
                    <li>막히면 <b className="text-amber-300">힌트</b>를 쓰세요 (감점 -100).</li>
                  </ul>
                )}
                <button type="button" onClick={() => { setModal(null); setMeta((m) => ({ ...m, start: Date.now() })); }} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold flex items-center justify-center gap-2">
                  <Play size={18} /> 작업 시작
                </button>
              </div>
            )}
            {modal.type === 'hint' && (
              <div className="space-y-4">
                <button type="button" onClick={() => setModal(null)} className="absolute top-3 right-3 p-1 rounded hover:bg-slate-700" aria-label="닫기"><X size={18} /></button>
                <h2 className="text-xl font-bold flex items-center gap-2"><Lightbulb className="text-amber-400" /> 선배 엔지니어의 힌트</h2>
                {(meta.revealed ?? []).length === 0 && <p className="text-slate-400 text-sm">아직 확인한 힌트가 없습니다. 힌트마다 100점이 감점됩니다.</p>}
                <ol className="space-y-2">
                  {(meta.revealed ?? []).map((h, i) => (
                    <li key={h} className="bg-slate-900 border border-slate-700 rounded p-3 text-sm leading-relaxed"><span className="text-amber-300 font-bold mr-1">#{i + 1}</span>{h}</li>
                  ))}
                </ol>
                {meta.hintsUsed < hintsAvail && !cleared ? (
                  <button type="button" onClick={revealHint} className="w-full py-2.5 rounded-lg bg-amber-500 text-slate-900 font-bold hover:bg-amber-400">
                    힌트 {meta.hintsUsed + 1} 보기 (-100점)
                  </button>
                ) : <p className="text-xs text-slate-500">더 이상 볼 수 있는 힌트가 없습니다.</p>}
              </div>
            )}
            {modal.type === 'clear' && (
              <div className="space-y-4 text-center">
                <Trophy size={52} className="mx-auto text-amber-400" />
                <h2 className="text-2xl font-bold">스테이지 {currentStage} 클리어!</h2>
                {currentStage === 4 && (
                  <div className="text-left bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-1 text-sm">
                    <div className="text-xs text-sky-300 font-bold mb-1">찾아낸 원인</div>
                    {faults.map((f) => <div key={f} className="flex gap-2"><Wrench size={14} className="text-green-400 shrink-0 mt-0.5" /><span><b>{FAULTS[f].title}</b> · {FAULTS[f].desc}</span></div>)}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">기본</div><div className="font-mono">1000</div></div>
                  <div className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">시간 보너스 ({modal.elapsed}초)</div><div className="font-mono text-green-400">+{modal.timeBonus}</div></div>
                  <div className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">감점</div><div className="font-mono text-red-400">-{modal.penalty}</div></div>
                </div>
                <div className="text-3xl font-black font-mono text-amber-300">{modal.score.toLocaleString()}점</div>
                {stageScores[currentStage] !== modal.score && <p className="text-xs text-slate-400">재도전 기록은 총점에 반영되지 않습니다 (첫 클리어 점수 유지).</p>}
                <div className="text-left bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-sky-300 font-bold mb-1.5">이번 스테이지에서 배운 것</div>
                  <ul className="space-y-1 text-sm text-slate-300 list-disc pl-4">{stage.lessons.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600">더 둘러보기</button>
                  <button type="button" onClick={goNext} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 font-bold flex items-center justify-center gap-1">
                    {currentStage < 4 ? '다음 스테이지' : '최종 결과'} <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
            {modal.type === 'final' && (() => {
              const max = 4 * 1300;
              const ratio = totalScore / max;
              const [rank, title] = ratio >= 0.85 ? ['S', '방송장비 마스터'] : ratio >= 0.7 ? ['A', '시니어 방송 엔지니어'] : ratio >= 0.5 ? ['B', '주니어 방송 엔지니어'] : ['C', '수습 방송 스태프'];
              return (
                <div className="space-y-4 text-center">
                  <Award size={56} className="mx-auto text-amber-400" />
                  <div className="text-xs font-bold uppercase tracking-widest text-sky-400">Certificate of Completion</div>
                  <h2 className="text-2xl font-bold">수료를 축하합니다!</h2>
                  <div className="text-7xl font-black text-amber-300">{rank}</div>
                  <div className="text-lg font-semibold">{title}</div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">STAGE {n}</div><div className="font-mono">{stageScores[n] ?? '—'}</div></div>
                    ))}
                  </div>
                  <div className="text-2xl font-mono font-bold">총점 {totalScore.toLocaleString()}</div>
                  <p className="text-sm text-slate-400">신호 흐름, 케이블 규격, 게인 스테이징, 디지털 라우팅, 스위칭, 송출, 트러블슈팅까지 모두 경험했습니다.</p>
                  <button type="button" onClick={restartAll} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold flex items-center justify-center gap-2">
                    <RotateCcw size={18} /> 처음부터 다시 도전
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
