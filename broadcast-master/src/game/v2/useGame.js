import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { buildRuntime, computeSim, checkObjective, FAULT_TEXT, voiceSources, CHANNELS, CH_DEFAULT, MASTER_DEFAULT, portKind, mixerStateOf, ATEM_DEFAULT } from '../sim.js';
import { applyOp, opToAction, noteOnAirMove, notePop, getPath } from '../ops.js';
import { getAudio } from '../audio.js';
import { MISMATCH_TIP, DEVICE_TYPES, CABLES } from '../engine.js';
import { narrate, stopNarration, speechOk, hasClip, setNarrationRate, clipStatus } from '../speech.js';
import { STOCK } from '../data/tutorial.js';

/* =====================================================================
 * 게임 상태 훅 — 스토리·튜토리얼·자유 모드가 함께 쓴다
 *  - st: 엔진 상태, nominal: "소리가 날 때" 기준 계산(목표 판정), actual: 지금 실제 계산(화면·소리)
 *  - apply(op): 모든 조작은 op로 → 3D 유령 손 동작(action)도 같이 만든다
 *  - 대본 재생기: 정답 자동 진행 / 튜토리얼 (내레이션 + 유령 손 + 연습 모드)
 * ===================================================================== */

const VOICE_TYPES = new Set(['dynamic_mic', 'condenser_mic', 'wireless_mic']);
const kindLabel = { voice: '목소리', inst: '악기', line: '라인' };

export function useGame(spec, { onClear } = {}) {
  const [st, setSt] = useState(() => buildRuntime(spec));
  const stRef = useRef(st);
  stRef.current = st;
  const [ptt, setPtt] = useState(false);
  const [autoTalk, setAutoTalk] = useState(spec.talk === 'auto');
  const [phase, setPhase] = useState(0);
  const [performing, setPerforming] = useState(spec.performing !== false);
  const [scriptTalk, setScriptTalk] = useState(null);
  const [latched, setLatched] = useState(() => new Set());
  const latchedRef = useRef(latched);
  latchedRef.current = latched;
  const [action, setAction] = useState(null);
  const [toast, setToast] = useState(null);
  const [log, setLog] = useState([]);
  const [pending, setPending] = useState(null);
  const [cable, setCable] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selCh, setSelCh] = useState(0);
  const actKey = useRef(0);

  // 자동 말하기: 4초 말하고 1.5초 쉬기
  useEffect(() => {
    if (!autoTalk) return undefined;
    const id = setInterval(() => setPhase((p) => (p + 1) % 11), 500);
    return () => clearInterval(id);
  }, [autoTalk]);
  const talking = scriptTalk ?? (ptt || (autoTalk && phase < 8));

  const nominal = useMemo(() => computeSim(st, { talking: true, performing: true }), [st]);
  const actual = useMemo(() => computeSim(st, { talking, performing }), [st, talking, performing]);

  // 말하기 테스트 기록
  useEffect(() => {
    if (!talking || actual.feedback) return;
    const voices = voiceSources(st);
    const add = ['main', 'monitor', 'stream', 'headphones'].filter((at) => voices.some((v) => actual.reaches(v, at)) && !latched.has(`talk:${at}`));
    if (add.length) setLatched((s) => new Set([...s, ...add.map((a) => `talk:${a}`)]));
  }, [actual, talking]); // eslint-disable-line react-hooks/exhaustive-deps

  const objectives = useMemo(() => (spec.objectives ?? []).map((o) => ({ ...o, ok: checkObjective(o.check, st, nominal, { latched: [...latched] }) })), [spec, st, nominal, latched]);
  const allDone = objectives.length > 0 && objectives.every((o) => o.ok);
  const clearedRef = useRef(false);
  useEffect(() => {
    if (allDone && !clearedRef.current) { clearedRef.current = true; getAudio().clear(); onClear?.(); }
  }, [allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const notify = useCallback((kind, text) => {
    setToast({ kind, text, key: Date.now() });
    setLog((l) => [...l.slice(-60), { kind, text, t: Date.now() }]);
  }, []);

  /* ----- 조작 적용 ----- */
  // 페이더 움직임 기록: 천천히 내렸는지(페이드) 한 번에 내렸는지(CUT) 판정
  const faderMoves = useRef({});
  const noteFader = (key, before, value) => {
    const now = Date.now();
    let g = faderMoves.current[key];
    if (!g || now - g.tLast > 1500) g = { t0: now, v0: before }; // 손을 1.5초 넘게 떼면 새 동작
    g.tLast = now; g.v = value;
    faderMoves.current[key] = g;
    const dt = now - g.t0;
    const add = [];
    if (g.v0 >= 35 && value <= 3) add.push(dt >= 1500 ? `fadeOut:${key}` : dt < 600 ? `cutOut:${key}` : null);
    if (g.v0 <= 3 && value >= 50) add.push(dt >= 1500 ? `fadeIn:${key}` : null);
    const fresh = add.filter(Boolean).filter((k) => !latchedRef.current.has(k));
    // 다시 천천히 내리면 앞서 뚝 끊었던 기록은 지운다 (다시 해 볼 수 있게)
    if (fresh.length) setLatched((s0) => { const n0 = new Set([...s0, ...fresh]); if (fresh.includes(`fadeOut:${key}`)) n0.delete(`cutOut:${key}`); return n0; });
  };
  const applyRef = useRef(null);
  // 진행 중인 페이드 타이머 — 이전·다시·나가기 때 멈춘다 (되돌린 상태를 덮어쓰지 않게)
  const fadeTimers = useRef([]);
  const cancelFades = useCallback(() => { fadeTimers.current.forEach(clearTimeout); fadeTimers.current = []; }, []);
  useEffect(() => cancelFades, [cancelFades]);
  const lastClick = useRef(0);
  const apply = useCallback((op, { visual = true, prev, speed, quiet } = {}) => {
    const cur = stRef.current;
    if (op.op === 'fade') {
      // { op:'fade', ch | (없으면 메인), to, ms } — 페이더를 ms 동안 일정한 속도로 움직인다
      const key = op.ch ? 'fader' : 'mainFader';
      const S = mixerStateOf(cur, op.mixer);
      const from = op.ch ? S.channels[op.ch - 1]?.fader ?? 0 : S.master.mainFader;
      const ms = op.ms ?? 3000;
      const n = Math.max(10, Math.round(ms / 60));
      const step = (k) => ({ ...(op.ch ? { op: 'ch', ch: op.ch } : { op: 'master' }), ...(op.mixer ? { mixer: op.mixer } : {}), key, value: Math.round(from + ((op.to - from) * k) / n) });
      if (visual) {
        actKey.current += 1;
        const a = opToAction(cur, step(n), actKey.current);
        if (a) { if (a.ctl) a.ctl.prev = from; a.speed = speed; a.durMs = ms; a.byScript = true; setAction(a); }
      }
      for (let k = 1; k <= n; k += 1) fadeTimers.current.push(setTimeout(() => applyRef.current?.(step(k), { visual: false, quiet: true }), (ms * k) / n));
      // 대본의 페이드는 화면이 느려 단계 사이가 벌어져도 페이드로 인정 (끝난 뒤 기록)
      const fk = (!op.mixer || op.mixer === cur.mixerId) ? (op.ch ? `ch${op.ch}` : 'main') : null;
      if (fk && ms >= 1500) {
        fadeTimers.current.push(setTimeout(() => {
          const tag = from >= 35 && op.to <= 3 ? `fadeOut:${fk}` : from <= 3 && op.to >= 50 ? `fadeIn:${fk}` : null;
          if (tag) setLatched((s0) => { const n0 = new Set(s0); n0.add(tag); n0.delete(`cutOut:${fk}`); return n0; });
        }, ms + 80));
      }
      return true;
    }
    if (op.op === 'talk') { setScriptTalk(op.on ? true : null); return true; }
    if (op.op === 'perform') { setPerforming(!!op.on); return true; }
    if (op.op === 'wait' || op.op === 'say') return true;
    const next = applyOp(cur, op);
    if (next.lastError) {
      const e = next.lastError;
      const text = e.reason ?? `${MISMATCH_TIP[e.mismatch] ?? '이 단자에는 맞지 않는 케이블입니다.'}`;
      notify('err', text);
      getAudio().error();
      return false;
    }
    // 실제로 바뀐 조작만 판정한다 (거절된 연결은 퍽 소리도, 방송 사고도 아니다)
    const lat = new Set();
    // 팝 노이즈: 켜진 스피커 경로를 건드리면 기록, 스피커를 끄면 다시 할 수 있게 지운다
    const popSet = new Set(latchedRef.current);
    const popped = notePop(cur, op, popSet);
    if (op.op === 'dev' && op.key === 'power' && op.value === false && latchedRef.current.has(`pop:${op.device}`)) setLatched((s0) => { const n = new Set(s0); n.delete(`pop:${op.device}`); return n; });
    if (popped) {
      setLatched((s0) => new Set([...s0, ...popped.map((id) => `pop:${id}`)]));
      getAudio().pop?.();
      const amp = popped.some((id) => cur.devices[id]?.type === 'power_amp');
      notify('err', `퍽! ${amp ? '파워 앰프' : '스피커'}가 켜진 채로 케이블을 꽂거나 +48V를 바꿨어요. ${amp ? '앰프' : '스피커'} 전원은 연결을 다 마친 뒤 맨 마지막에 켭니다. (껐다가 다시 순서대로 하면 됩니다)`);
    }
    if (noteOnAirMove(cur, op, lat)) {
      // 드래그 중 계속 경고가 쌓이지 않게 처음 한 번만 알린다
      const fresh = [...lat].some((k) => !latchedRef.current.has(k));
      setLatched((s) => new Set([...s, ...lat]));
      if (fresh) notify('err', '방송 중(PGM, 빨간 탈리)인 카메라를 움직였습니다! 시청자에게 흔들리는 화면이 나갔어요.');
    }
    const primary = !op.mixer || op.mixer === cur.mixerId;
    if (primary && op.op === 'ch' && op.key === 'fader') noteFader(`ch${op.ch}`, cur.channels[op.ch - 1]?.fader ?? 0, op.value);
    if (primary && op.op === 'master' && op.key === 'mainFader') noteFader('main', cur.master.mainFader, op.value);
    stRef.current = next;
    setSt(next);
    // 채널을 조작하면 그 채널이 선택된다 (디지털 믹서의 SEL처럼, 2D·3D 콘솔이 같은 채널을 보여 준다)
    if (op.op === 'ch' && primary && visual) setSelCh(op.ch - 1);
    if (visual) {
      actKey.current += 1;
      const a = opToAction(cur, op, actKey.current);
      if (a) {
        if (prev != null && a.ctl) a.ctl.prev = prev;
        a.speed = speed;
        a.byScript = !!quiet; // 대본(유령 손)이 한 동작인지 — 플레이어가 직접 한 연결로 탭이 바뀌지 않게
        setAction(a);
      }
    }
    const au = getAudio();
    if (op.op === 'connect') { au.plug(); if (!quiet) notify('ok', `${CABLES[op.cable]?.name ?? op.cable} 연결: ${label(cur, op.from)} → ${label(cur, op.to)}`); }
    else if (op.op === 'disconnect') { au.click(); if (!quiet) notify('info', `케이블 분리: ${label(cur, op.from)} ↔ ${label(cur, op.to)}`); }
    else if (op.op === 'place') { au.click(); if (!quiet) notify('ok', `${cur.devices[op.device]?.name ?? DEVICE_TYPES[cur.devices[op.device]?.type]?.name} 배치`); }
    else if (visual || !quiet) {
      // 페이드처럼 화면 없이 이어지는 단계는 조용히, 노브·페이더 드래그는 딸깍을 띄엄띄엄
      const now = Date.now();
      if (typeof op.value !== 'number' || now - lastClick.current > 180) { lastClick.current = now; au.click(); }
    }
    return true;
  }, [notify]);
  applyRef.current = apply;

  /* ----- 단자 클릭 (케이블 연결) ----- */
  const clickPort = useCallback((d, p) => {
    const cur = stRef.current;
    const type = cur.devices[d]?.type;
    const def = DEVICE_TYPES[type];
    if (!def) return;
    const dir = def.ins.some((x) => x.id === p) ? 'in' : 'out';
    const used = cur.connections.find((c) => (c.from.d === d && c.from.p === p) || (c.to.d === d && c.to.p === p));
    if (!pending) {
      if (used) { notify('info', '이미 케이블이 꽂힌 단자입니다. 케이블을 클릭하면 분리됩니다.'); return; }
      setPending({ d, p, dir });
      if (!cable) notify('info', '아래에서 케이블 종류를 고른 뒤, 연결할 다른 단자를 클릭하세요.');
      return;
    }
    if (pending.d === d && pending.p === p) { setPending(null); return; }
    if (!cable) { notify('err', '먼저 사용할 케이블 종류를 고르세요.'); return; }
    const ok = apply({ op: 'connect', from: `${pending.d}.${pending.p}`, to: `${d}.${p}`, cable });
    if (ok) setPending(null);
  }, [pending, cable, apply, notify]);

  // 드래그로 이미 바뀐 값에 대해 손 동작만 보여 주기 (손을 뗄 때)
  const show = useCallback((op, prev) => {
    actKey.current += 1;
    const a = opToAction(stRef.current, op, actKey.current);
    if (a) { if (a.ctl) a.ctl.prev = prev; setAction(a); }
  }, []);

  const disconnect = useCallback((c) => {
    apply({ op: 'disconnect', from: `${c.from.d}.${c.from.p}`, to: `${c.to.d}.${c.to.p}` });
  }, [apply]);

  // 저장된 상태 불러오기 (스튜디오 모드)
  const load = useCallback((saved) => {
    const base = buildRuntime(spec);
    const devices = saved.devices ?? {};
    const pick = (types) => Object.values(devices).find((d) => types.includes(d.type))?.id ?? null;
    // 예전 저장본: 8채널 → 10채널, 아날로그 믹서 IN(콤보)에 꽂았던 TRS는 이제 LINE 단자로
    const channels = Array.from({ length: CHANNELS }, (_, i) => ({ ...CH_DEFAULT, ...(saved.channels?.[i] ?? {}) }));
    const connections = (saved.connections ?? []).map((c) => {
      const m = /^in(\d)$/.exec(c.to.p);
      if (!m || devices[c.to.d]?.type !== 'analog_mixer' || c.cable !== 'trs') return c;
      const to = { ...c.to, p: `line${m[1]}` };
      return { ...c, to, id: `${c.from.d}.${c.from.p}>${to.d}.${to.p}` };
    });
    const mixers = Object.fromEntries(Object.entries(saved.mixers ?? {}).map(([id, m]) => [id, { channels: Array.from({ length: CHANNELS }, (_, i) => ({ ...CH_DEFAULT, ...(m.channels?.[i] ?? {}) })), master: { ...MASTER_DEFAULT, ...(m.master ?? {}) } }]));
    const atems = Object.fromEntries(Object.entries(saved.atems ?? {}).map(([id, a]) => [id, { ...ATEM_DEFAULT, ...a }]));
    const next = { ...base, ...saved, devices, dev: saved.dev ?? {}, connections, channels, mixers, atems, master: { ...MASTER_DEFAULT, ...(saved.master ?? {}) }, cables: {}, unlimited: true, faults: [],
      mixerId: pick(['analog_mixer', 'digital_mixer']), switcherId: pick(['atem', 'atem_pro']) };
    stRef.current = next; setSt(next);
  }, [spec]);

  const reset = useCallback(() => {
    const s0 = buildRuntime(spec);
    cancelFades();
    stRef.current = s0; setSt(s0); setLatched(new Set()); clearedRef.current = false; setPending(null); setScriptTalk(null);
  }, [spec, cancelFades]);

  return {
    st, setSt, stRef, nominal, actual, talking, ptt, setPtt, autoTalk, setAutoTalk, performing, setPerforming, setScriptTalk,
    latched, setLatched, cancelFades, objectives, allDone, action, setAction, toast, setToast, log, notify, apply, pending, setPending, cable, setCable,
    clickPort, disconnect, selected, setSelected, selCh, setSelCh, reset, show, load,
  };
}

const label = (st, end) => {
  const [d, p] = String(end).split('.');
  const dv = st.devices[d];
  const def = DEVICE_TYPES[dv?.type];
  const port = def ? [...def.ins, ...def.outs].find((x) => x.id === p) : null;
  return `${dv?.name ?? def?.name ?? d}${port ? ` ${port.label}` : ''}`;
};

/* =====================================================================
 * 대본 재생기 (정답 자동 진행 · 튜토리얼)
 *  steps: [{ say, op..., practice?, focus? }]
 *  practice가 켜져 있고 단계에 practice 문구가 있으면 플레이어가 직접 할 때까지 기다린다
 * ===================================================================== */
// 한국어 TTS로 읽는 데 걸리는 대략적인 시간 (글자당 약 0.16초 + 문장 사이 쉼)
export const speechMs = (text, speed = 1) => {
  if (!text) return 0;
  const chars = text.replace(/\s/g, '').length;
  const pauses = (text.match(/[.,?!…]/g) ?? []).length;
  return (chars * 160 + pauses * 260 + 600) / speed;
};
// 손 동작이 끝나기까지 걸리는 시간
const ACTION_MS = { connect: 2500, place: 1600, move: 1700, addDevice: 1600, ptz: 1700, talk: 300, perform: 300 };

export function useScriptPlayer(game, { voiceOn = true } = {}) {
  // script: { steps, i, playing, speed, practice, auto, done, ready, restart, onDone, onStep }
  //  - ready: 이 단계의 설명과 동작이 모두 끝나 "다음"을 기다리는 중 (auto면 잠깐 뒤 저절로 넘어감)
  //  - restart: 바뀌면 지금 단계를 처음부터 다시 시작 (재생·이전·다음)
  const [script, setScriptState] = useState(null);
  const scriptRef = useRef(null);
  const setScript = (fn) => setScriptState((s) => { const n = typeof fn === 'function' ? fn(s) : fn; scriptRef.current = n; return n; });
  const [narration, setNarration] = useState(null);
  const [waiting, setWaiting] = useState(null); // 연습: 플레이어가 직접 해야 하는 단계
  const [speaking, setSpeaking] = useState(false);
  const [praised, setPraised] = useState(false); // 연습 단계를 해냈을 때 잠깐 칭찬
  const [quiz, setQuiz] = useState(null); // 퀴즈 장면: { i, wrong: [고른 오답], solved, by: 'me' | 'auto' }
  const progress = useRef(0); // 녹음 재생 위치 (0~1) — 글자 표시가 소리를 따라간다
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const timers = useRef([]);
  const cur = useRef({ i: -1, speech: true, action: true }); // 지금 단계의 진행 상황
  const applied = useRef(new Set()); // 동작을 이미 적용한 단계 (같은 동작이 두 번 적용되지 않게)
  const snaps = useRef({}); // 단계를 시작하기 직전의 상태 (이전 단계로 되돌리기)
  const idx = useRef(0); // 지금(또는 막 넘어가기로 한) 단계 번호 — 빠르게 두 번 눌러도 단계를 건너뛰지 않게 바로 바뀐다
  const metaSnaps = useRef({}); // 같은 때의 판정 기록·연주 여부 (이전으로 가면 함께 되돌린다)
  const [hold, setHoldState] = useState(false); // 실습실처럼 화면을 쓰는 동안 자동 넘김을 멈춘다
  const holdRef = useRef(false);
  const setHold = useCallback((h) => { holdRef.current = !!h; setHoldState(!!h); }, []);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const hasOp = (step) => !!step?.op && step.op !== 'say';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const start = useCallback((steps, opts = {}) => {
    clear(); stopNarration();
    applied.current = new Set(); snaps.current = {}; metaSnaps.current = {}; cur.current = { i: -1, speech: true, action: true }; idx.current = 0;
    holdRef.current = false; setHoldState(false);
    setWaiting(null); setPraised(false); setNarration(null);
    // 이어 보기: 앞 장면들의 동작을 조용히 한꺼번에 적용하고 그 장면부터
    const from = Math.max(0, Math.min(steps.length - 1, opts.from ?? 0));
    for (let k = 0; k < from; k += 1) {
      const st0 = steps[k];
      if (!hasOp(st0) || st0.op === 'wait') continue;
      const op = st0.op === 'fade' ? (st0.ch ? { op: 'ch', ch: st0.ch, key: 'fader', value: st0.to, ...(st0.mixer ? { mixer: st0.mixer } : {}) } : { op: 'master', key: 'mainFader', value: st0.to, ...(st0.mixer ? { mixer: st0.mixer } : {}) }) : st0;
      game.apply(op, { visual: false, quiet: true });
      applied.current.add(k);
    }
    idx.current = from;
    setScript({ steps, i: from, playing: true, speed: opts.speed ?? 1, practice: !!opts.practice, auto: opts.auto ?? true, done: false, ready: false, restart: 0, onDone: opts.onDone, onStep: opts.onStep });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 읽던 대사 정리 (끝 타이머까지) — 일시정지·건너뛰기·멈춤 뒤에 옛 대사가 단계를 끝내지 않게
  const dropSpeech = () => { if (speech.current?.timer) clearTimeout(speech.current.timer); speech.current = null; };
  const stop = useCallback(() => { clear(); dropSpeech(); game.cancelFades?.(); cur.current = { i: -1 }; setScript(null); setNarration(null); setWaiting(null); setSpeaking(false); game.setScriptTalk(null); stopNarration(); }, [game]); // eslint-disable-line react-hooks/exhaustive-deps
  const pause = useCallback(() => { clear(); dropSpeech(); stopNarration(); setSpeaking(false); setScript((s) => (s ? { ...s, playing: false } : s)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const resume = useCallback(() => setScript((s) => (s ? { ...s, playing: true, restart: s.restart + 1 } : s)), []); // eslint-disable-line react-hooks/exhaustive-deps
  // 지금 읽는 대사: 속도를 바꾸면 읽던 곳부터 새 속도로 이어 읽는다
  const speech = useRef(null); // { c, text, from, t0, ms, speed, pos, bound, timer, end }
  const lineSeq = useRef(0); // 새 대사가 시작될 때마다 1씩 (속도만 바꾼 재낭독과 구별)
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn; // 화면에서 음성을 껐다 켰다 하면 바로 반영 (콜백이 옛 값을 쥐지 않게)
  const speak = (c, text, from, speed, end, who = 'senior') => {
    const sp = speech.current;
    if (sp?.timer) clearTimeout(sp.timer);
    const part = text.slice(from);
    const ms = speechMs(part, speed);
    const t0 = Date.now();
    const s1 = { c, text, from, t0, ms, speed, pos: from, bound: false, end, timer: null, who, audio: false };
    speech.current = s1;
    const endIfCurrent = () => { if (speech.current === s1) end(); };
    // 미리 녹음한 목소리가 있으면 그걸 튼다 (처음부터 읽을 때만 — 중간부터는 합성 음성)
    if (voiceRef.current && from === 0 && hasClip(who, text)) {
      s1.audio = true;
      progress.current = 0;
      setNarration((n) => (n && n.text === text ? { ...n, ms, offset: 0, t0, pos: 0, audio: true } : n));
      narrate(text, {
        who, rate: speed,
        onEnd: endIfCurrent,
        onStart: () => { if (speech.current !== s1) return; s1.t0 = Date.now(); },
        onProgress: (f) => { if (speech.current === s1) { progress.current = f; s1.pos = Math.floor(f * text.length); s1.bound = true; } },
        // 녹음을 못 틀면 같은 대사를 합성 음성으로 (그것도 안 되면 글자 속도대로)
        onError: () => {
          if (speech.current !== s1) return;
          clearTimeout(s1.timer);
          speakSynth(s1, part, ms, endIfCurrent);
        },
      });
      s1.timer = setTimeout(endIfCurrent, ms * 2.2 + 4000); // 끝 신호가 안 올 때 대비
      return;
    }
    speakSynth(s1, part, ms, endIfCurrent);
  };
  // 합성 음성(또는 소리 없이 글자 속도대로)으로 읽기
  const speakSynth = (s1, part, ms, endIfCurrent) => {
    const { text, from, who, speed } = s1;
    s1.audio = false; s1.t0 = Date.now();
    const t0 = s1.t0;
    setNarration((n) => (n && n.text === text ? { ...n, ms, offset: from, t0, pos: from, audio: false } : n));
    if (voiceRef.current && speechOk()) {
      narrate(part, {
        who,
        rate: Math.max(0.6, Math.min(2, speed)),
        onEnd: endIfCurrent,
        // 소리가 실제로 나기 시작한 때부터 글자·위치를 잰다
        onStart: () => { if (speech.current !== s1) return; s1.t0 = Date.now(); setNarration((n) => (n && n.text === text ? { ...n, t0: s1.t0 } : n)); },
        onBoundary: (ci) => { if (speech.current === s1) { s1.pos = from + ci; s1.bound = true; setNarration((n) => (n && n.text === text ? { ...n, pos: from + ci } : n)); } },
        // 목소리가 없으면(합성 실패) 글자 속도대로 시간이 지나면 끝낸다
        onError: () => { if (speech.current !== s1) return; clearTimeout(s1.timer); s1.timer = setTimeout(endIfCurrent, Math.max(0, ms - (Date.now() - s1.t0))); },
      });
      s1.timer = setTimeout(endIfCurrent, ms * 1.8 + 2500); // 음성 합성이 끝 신호를 안 줄 때 대비
    } else { stopNarration(); s1.timer = setTimeout(endIfCurrent, ms); }
  };
  // 지금 읽고 있는 위치: 음성이 단어 위치를 알려 주면 그 단어의 처음, 아니면 시간으로 짐작해 한 단어 앞 (건너뛰는 것보다 한 단어 다시 듣는 게 낫다)
  const spokenPos = (sp) => {
    if (sp.bound) return sp.pos;
    const byTime = sp.from + Math.floor(((Date.now() - sp.t0) / sp.ms) * (sp.text.length - sp.from));
    let pos = Math.min(sp.text.length, Math.max(sp.from, byTime));
    for (let k = 0; k < 2; k += 1) { const cut = sp.text.lastIndexOf(' ', pos - 1); pos = cut >= sp.from ? cut : sp.from; }
    return pos > sp.from ? pos + 1 : sp.from;
  };
  const setSpeed = useCallback((speed) => {
    setScript((s) => (s ? { ...s, speed } : s));
    const sp = speech.current;
    // 일시정지 중이면 속도만 바꾼다 (다시 재생할 때 새 속도로 읽는다)
    if (!scriptRef.current?.playing || !sp || sp.c !== cur.current || sp.c.speech || sp.speed === speed) return;
    // 녹음이면 빠르기만 바꾼다 (끝 대비 타이머만 다시)
    if (sp.audio && setNarrationRate(speed)) {
      sp.speed = speed;
      const left = clipStatus()?.remainMs ?? sp.ms;
      clearTimeout(sp.timer); sp.timer = setTimeout(() => { if (speech.current === sp) sp.end(); }, left * 1.6 + 3000);
      return;
    }
    const pos = spokenPos(sp);
    if (sp.text.length - pos < 3) return;
    speak(sp.c, sp.text, pos, speed, sp.end, sp.who);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 대사 도중 음성을 끄면 바로 조용히, 남은 글자는 글자 속도대로
  useEffect(() => {
    if (voiceOn) return;
    stopNarration();
    const sp = speech.current;
    if (!sp || !scriptRef.current?.playing || sp.c !== cur.current || sp.c.speech) return;
    speak(sp.c, sp.text, spokenPos(sp), sp.speed, sp.end, sp.who);
  }, [voiceOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const setAuto = useCallback((auto) => setScript((s) => (s ? { ...s, auto } : s)), []); // eslint-disable-line react-hooks/exhaustive-deps

  // 유령 손이 지금 단계의 동작을 대신 한다
  const ghostDo = (i, visual = true) => {
    const s = scriptRef.current;
    const step = s?.steps[i];
    if (!step || !hasOp(step) || applied.current.has(i)) return false;
    applied.current.add(i);
    game.apply(step, { speed: s.speed, quiet: true, visual });
    return true;
  };
  // 다음/이전: 건너뛰어도 그 단계의 동작은 적용, 뒤로 가면 그 단계를 시작하기 전 상태로 되돌린다
  const jump = useCallback((delta) => {
    const s = scriptRef.current;
    if (!s) return;
    clear(); dropSpeech(); stopNarration(); setWaiting(null); setPraised(false); setSpeaking(false); setQuiz(null);
    const from = idx.current;
    if (delta > 0) {
      // 건너뛴 단계의 동작은 적용하고 한 칸만 (두 번 눌러도 동작 없이 두 칸 넘어가지 않게, 번호는 절댓값으로)
      if (from < s.steps.length) ghostDo(from, false);
      const to = Math.min(s.steps.length, from + 1);
      idx.current = to;
      setScript((x) => (x ? { ...x, i: to, playing: true, ready: false, restart: x.restart + 1 } : x));
      return;
    }
    const target = Math.max(0, from - 1);
    idx.current = target;
    game.cancelFades?.();
    if (snaps.current[target]) { const s1 = clone(snaps.current[target]); game.stRef.current = s1; game.setSt(s1); }
    const meta = metaSnaps.current[target];
    if (meta) { game.setLatched?.(new Set(meta.latched)); game.setPerforming(meta.performing); }
    [...applied.current].forEach((k) => { if (k >= target) applied.current.delete(k); });
    // 그 단계 앞까지의 마지막 "말하기" 지시를 다시 적용 (이전을 눌러도 강연자가 계속 말한다)
    const talkOp = s.steps.slice(0, target).reverse().find((x) => x.op === 'talk');
    game.setScriptTalk(talkOp?.on ? true : null);
    setScript((x) => (x ? { ...x, i: target, playing: true, ready: false, done: false, restart: x.restart + 1 } : x));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const next = useCallback(() => jump(1), [jump]);
  // 연습 중 "보여 주세요"
  const showMe = useCallback(() => {
    const s = scriptRef.current;
    if (!s) return;
    const i = s.i;
    setWaiting(null);
    if (ghostDo(i)) later(() => { if (cur.current.i === i) { cur.current.action = true; bump(); } }, (ACTION_MS[s.steps[i].op] ?? 1400) / s.speed);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setPractice = useCallback((practice) => {
    const s = scriptRef.current;
    if (!s) return;
    setScript((x) => (x ? { ...x, practice } : x));
    // 기다리던 단계가 있으면: 끄면 유령 손이 대신 해 준다
    if (!practice && waitingRef.current) showMe();
  }, [showMe]); // eslint-disable-line react-hooks/exhaustive-deps
  const waitingRef = useRef(null);
  waitingRef.current = waiting;

  // 단계 시작: 설명(음성)을 시작하고, 동작은 유령 손이 하거나(보기) 플레이어를 기다린다(연습)
  useEffect(() => {
    const sc = scriptRef.current;
    if (!sc || !sc.playing) return undefined;
    const { steps, i, speed } = sc;
    idx.current = i;
    if (i >= steps.length) {
      setNarration(null); setWaiting(null);
      if (!sc.done) { setScript((x) => ({ ...x, done: true, playing: false })); sc.onDone?.(); }
      return undefined;
    }
    const step = steps[i];
    if (!snaps.current[i]) { snaps.current[i] = clone(game.stRef.current); metaSnaps.current[i] = { latched: [...game.latched], performing: game.performing }; }
    sc.onStep?.(step, i);
    const text = step.say ?? step.quiz?.q ?? null;
    const who = step.quiz ? 'senior' : step.who ?? 'senior';
    const est = speechMs(text, speed);
    // 대사가 없는 단계에서는 앞 대사를 그대로 띄워 둔다 (상자가 깜빡이지 않게)
    if (text) setNarration({ text, who, i, n: steps.length, ms: est, offset: 0, t0: Date.now(), pos: 0, seq: (lineSeq.current += 1), show: step.show ?? null, quiz: step.quiz ?? null, lab: step.lab ?? null, focus: step.focus ?? null });
    setPraised(false);
    setQuiz(step.quiz ? { i, wrong: [], solved: applied.current.has(i), by: null } : null);
    const c = { i, speech: !text, action: (!hasOp(step) || applied.current.has(i)) && (!step.quiz || applied.current.has(i)) };
    cur.current = c;
    const speechEnd = () => {
      if (cur.current !== c || c.speech) return; c.speech = true; setSpeaking(false); bump();
      // 퀴즈는 직접 고를 때까지 기다린다. "자동 넘김"을 켜 둔 경우에만 생각할 시간을 준 뒤 답을 보여 준다
      if (step.quiz && !c.action && scriptRef.current?.auto) later(() => { if (cur.current === c && !c.action && scriptRef.current?.auto) answerRef.current(step.quiz.answer, 'auto'); }, 6000 / (scriptRef.current?.speed ?? 1));
    };
    if (text) {
      setSpeaking(true);
      speak(c, text, 0, speed, speechEnd, who);
    } else { setSpeaking(false); if (speech.current?.timer) clearTimeout(speech.current.timer); speech.current = null; }
    if (!c.action) {
      if (sc.practice && step.practice) setWaiting({ ...step, index: i });
      else if (step.op === 'wait') later(() => { if (cur.current === c) { applied.current.add(i); c.action = true; bump(); } }, (step.ms ?? 1000) / (scriptRef.current?.speed ?? speed));
      // 퀴즈: 플레이어가 고를 때까지 기다린다 (자동 넘김일 때만 speechEnd가 잠시 뒤 답을 보여 준다)
      else if (step.quiz) setWaiting(null);
      else {
        setWaiting(null);
        // 설명을 어느 정도 들은 뒤(약 40%) 손이 움직이기 시작
        const startAt = text ? Math.max(900 / speed, est * 0.4) : 250 / speed;
        later(() => {
          if (cur.current !== c) return;
          ghostDo(i);
          // 손 동작이 끝나는 시간은 지금 속도로 (도중에 배속을 바꿔도 맞게)
          later(() => { if (cur.current === c) { c.action = true; bump(); } }, step.op === 'fade' ? (step.ms ?? 3000) + 300 : (ACTION_MS[step.op] ?? 1400) / (scriptRef.current?.speed ?? speed));
        }, startAt);
      }
    } else setWaiting(null);
    bump();
    return clear;
  }, [script?.i, script?.playing, script?.restart]); // eslint-disable-line react-hooks/exhaustive-deps

  // 설명과 동작이 모두 끝나면 ready
  useEffect(() => {
    const sc = scriptRef.current;
    const c = cur.current;
    if (!sc || !sc.playing || sc.ready || c.i !== sc.i || !c.speech || !c.action) return;
    setScript((x) => (x && x.i === c.i ? { ...x, ready: true } : x));
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  // 자동 진행이면 잠깐 쉬고 다음 단계로
  useEffect(() => {
    // 대사가 없는 연결 단계(말하기 시작·잠깐 기다리기)는 수동 모드에서도 저절로 넘어간다
    // 퀴즈도 대사처럼 "다음"을 기다린다. 실습실이 열려 있는 동안은 자동으로 넘기지 않는다
    if (!script?.ready || !script.playing || hold || (!script.auto && (script.steps[script.i]?.say || script.steps[script.i]?.quiz))) return undefined;
    const i = script.i;
    const t = setTimeout(() => { if (scriptRef.current?.i === i && scriptRef.current.ready && idx.current === i) { idx.current = i + 1; setScript((x) => ({ ...x, i: i + 1, ready: false })); } }, (praised ? 1100 : 700) / script.speed);
    return () => clearTimeout(t);
  }, [script?.ready, script?.auto, script?.i, script?.playing, hold]); // eslint-disable-line react-hooks/exhaustive-deps

  // 짧은 한마디 (칭찬·아쉬움) — 단계 진행을 막지 않는다
  const quip = (list) => {
    // 지금 대사를 읽는 중이면 끊지 않는다
    if (!voiceRef.current || !list?.length || (speech.current && !cur.current.speech)) return;
    const line = list[Math.floor(Math.random() * list.length)];
    if (hasClip('senior', line)) narrate(line, { who: 'senior', rate: scriptRef.current?.speed ?? 1 });
  };
  // 퀴즈 답 고르기: 맞으면 설명을 들려주고 다음으로, 틀리면 다시 (두 번 틀리면 정답을 알려 준다)
  const answer = (k, by = 'me') => {
    const s = scriptRef.current;
    const c = cur.current;
    const step = s?.steps[c.i];
    if (!step?.quiz || c.action) return;
    const q = step.quiz;
    // 이미 고른 오답을 또 누른 건 한 번으로 친다
    if (k !== q.answer && quizRef.current?.wrong?.includes(k)) return;
    if (k !== q.answer) {
      getAudio().error();
      setQuiz((x) => (x && x.i === c.i ? { ...x, wrong: [...new Set([...x.wrong, k])] } : x));
      const wrongs = (quizRef.current?.wrong?.length ?? 0) + 1;
      if (wrongs < 2) { quip(STOCK.wrong); return; }
    } else getAudio().ok();
    applied.current.add(c.i);
    c.action = true;
    setQuiz((x) => (x && x.i === c.i ? { ...x, solved: true, by } : x));
    if (k === q.answer && by === 'me') setPraised(true);
    // 설명을 다 듣고 나서 ready
    if (q.explain) {
      c.speech = false; setSpeaking(true);
      speak(c, q.explain, 0, s.speed, () => { if (cur.current !== c) return; c.speech = true; setSpeaking(false); bump(); }, 'senior');
    }
    bump();
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const quizRef = useRef(null);
  quizRef.current = quiz;
  const pick = useCallback((k) => answerRef.current(k, 'me'), []);

  // 연습 단계 완료 감지
  useEffect(() => {
    if (!waiting || !scriptRef.current) return;
    if (opSatisfied(game.stRef.current, waiting, game, snaps.current[waiting.index])) {
      const i = waiting.index;
      applied.current.add(i);
      setWaiting(null);
      setPraised(true);
      getAudio().ok();
      quip(STOCK.praise);
      if (cur.current.i === i) { cur.current.action = true; bump(); }
    }
  }, [game.st, game.talking, game.latched, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clear(); stopNarration(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { script, narration, waiting, speaking, praised, quiz, pick, progress, start, stop, pause, resume, setSpeed, setPractice, setAuto, jump, next, showMe, hold, setHold };
}

// 연습 단계: 플레이어가 그 조작을 했는지 (수치는 근처면 인정)
export function opSatisfied(st, op, game, before) {
  // until: 'noFeedback' — 값만 맞추는 게 아니라 하울링이 실제로 멎어야 인정 (계산은 말하는 중 기준)
  if (op.until === 'noFeedback' && game?.nominal && (game.nominal.feedback || game.nominal.ringing)) return false;
  // tol: 단계마다 허용 오차를 정할 수 있다 (기본은 아래 손잡이별 값)
  const near = (a, b, tol) => (typeof b === 'number' ? Math.abs((a ?? -999) - b) <= (op.tol ?? tol) : a === b);
  switch (op.op) {
    case 'place': return !!st.devices[op.device]?.placed;
    case 'move': return st.devices[op.device]?.slot === op.slot;
    case 'connect': {
      const [fd, fp] = op.from.split('.'), [td, tp] = op.to.split('.');
      // 같은 두 장비를 같은 종류의 단자로 이었으면 인정 (예: PC USB 1 대신 USB 2)
      // 번호가 있는 단자(채널·스네이크·ATEM 입력 등)는 정확히 그 단자여야 한다. 번호 없는 같은 종류 단자(PC USB 1/2)만 서로 인정
      const numbered = (p) => /\d/.test(p);
      const ok = (e, d, p) => e.d === d && (e.p === p || (!numbered(p) && !numbered(e.p) && portKind(st.devices[d]?.type, e.p) === portKind(st.devices[d]?.type, p)));
      return st.connections.some((c) => (ok(c.from, fd, fp) && ok(c.to, td, tp)) || (ok(c.from, td, tp) && ok(c.to, fd, fp)));
    }
    case 'disconnect': {
      const [fd, fp] = op.from.split('.');
      return !st.connections.some((c) => c.from.d === fd && c.from.p === fp);
    }
    case 'ch': return near(st.channels[op.ch - 1]?.[op.key] ?? (op.key === 'lowCutFreq' ? 100 : undefined), op.value, op.key === 'gain' ? 6 : op.key === 'fader' ? 6 : op.key === 'lowCutFreq' ? 30 : 3);
    case 'master': return near(st.master[op.key], op.value, 6);
    case 'dev': {
      const v = getPath(st.dev[op.device], op.key);
      if (Array.isArray(op.value)) return JSON.stringify(v) === JSON.stringify(op.value);
      // 채널·주소·프리셋 번호는 정확히 같아야 한다 (근처 값은 다른 채널이다)
      if (/channel|address|preset|ip/i.test(op.key)) return v === op.value;
      return near(v, op.value, op.key.includes('gain') ? 6 : 5);
    }
    // CUT/AUTO: 단계를 시작할 때와 PGM이 바뀌었어야 인정
    case 'atem': return op.key === 'cut' || op.key === 'auto' ? !!before && st.atem.program !== before.atem.program : st.atem[op.key] === op.value;
    case 'obs': return st.obs[op.key] === op.value;
    case 'fade': { const k = op.ch ? `ch${op.ch}` : 'main'; return !!game?.latched?.has(`${op.to <= 3 ? 'fadeOut' : 'fadeIn'}:${k}`); }
    case 'talk': return game ? game.talking === !!op.on || !op.on : true;
    default: return true;
  }
}

export { kindLabel, VOICE_TYPES };
export const faultText = (f) => FAULT_TEXT[f.type]?.(f) ?? f.type;
