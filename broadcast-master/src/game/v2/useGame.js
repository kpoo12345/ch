import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { buildRuntime, computeSim, checkObjective, FAULT_TEXT, voiceSources, CHANNELS, CH_DEFAULT, MASTER_DEFAULT } from '../sim.js';
import { applyOp, opToAction, noteOnAirMove, getPath } from '../ops.js';
import { getAudio } from '../audio.js';
import { MISMATCH_TIP, DEVICE_TYPES, CABLES } from '../engine.js';
import { narrate, stopNarration, speechOk } from '../speech.js';

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
  const apply = useCallback((op, { visual = true, prev, speed, quiet } = {}) => {
    const cur = stRef.current;
    if (op.op === 'talk') { setScriptTalk(op.on ? true : null); return true; }
    if (op.op === 'perform') { setPerforming(!!op.on); return true; }
    if (op.op === 'wait' || op.op === 'say') return true;
    const lat = new Set();
    if (noteOnAirMove(cur, op, lat)) {
      // 드래그 중 계속 경고가 쌓이지 않게 처음 한 번만 알린다
      const fresh = [...lat].some((k) => !latchedRef.current.has(k));
      setLatched((s) => new Set([...s, ...lat]));
      if (fresh) notify('err', '방송 중(PGM, 빨간 탈리)인 카메라를 움직였습니다! 시청자에게 흔들리는 화면이 나갔어요.');
    }
    const next = applyOp(cur, op);
    if (next.lastError) {
      const e = next.lastError;
      const text = e.reason ?? `${MISMATCH_TIP[e.mismatch] ?? '이 단자에는 맞지 않는 케이블입니다.'}`;
      notify('err', text);
      getAudio().error();
      return false;
    }
    stRef.current = next;
    setSt(next);
    if (visual) {
      actKey.current += 1;
      const a = opToAction(cur, op, actKey.current);
      if (a) {
        if (prev != null && a.ctl) a.ctl.prev = prev;
        a.speed = speed;
        setAction(a);
      }
    }
    const au = getAudio();
    if (op.op === 'connect') { au.plug(); if (!quiet) notify('ok', `${CABLES[op.cable]?.name ?? op.cable} 연결: ${label(cur, op.from)} → ${label(cur, op.to)}`); }
    else if (op.op === 'disconnect') { au.click(); if (!quiet) notify('info', `케이블 분리: ${label(cur, op.from)} ↔ ${label(cur, op.to)}`); }
    else if (op.op === 'place') { au.click(); if (!quiet) notify('ok', `${cur.devices[op.device]?.name ?? DEVICE_TYPES[cur.devices[op.device]?.type]?.name} 배치`); }
    else au.click();
    return true;
  }, [notify]);

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
    const next = { ...base, ...saved, devices, dev: saved.dev ?? {}, connections, channels, master: { ...MASTER_DEFAULT, ...(saved.master ?? {}) }, cables: {}, unlimited: true, faults: [],
      mixerId: pick(['analog_mixer', 'digital_mixer']), switcherId: pick(['atem', 'atem_pro']) };
    stRef.current = next; setSt(next);
  }, [spec]);

  const reset = useCallback(() => {
    const s0 = buildRuntime(spec);
    stRef.current = s0; setSt(s0); setLatched(new Set()); clearedRef.current = false; setPending(null); setScriptTalk(null);
  }, [spec]);

  return {
    st, setSt, stRef, nominal, actual, talking, ptt, setPtt, autoTalk, setAutoTalk, performing, setPerforming, setScriptTalk,
    latched, objectives, allDone, action, setAction, toast, setToast, log, notify, apply, pending, setPending, cable, setCable,
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
  const [script, setScript] = useState(null); // { steps, i, playing, speed, practice, auto, done, awaitNext }
  const [narration, setNarration] = useState(null);
  const [waiting, setWaiting] = useState(null); // 연습 대기 중인 단계
  const timers = useRef([]);
  const run = useRef(0); // 단계마다 바뀌는 번호: 이전 단계의 늦게 도착한 콜백 무시
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const next = () => setScript((s) => (s ? { ...s, i: s.i + 1, awaitNext: false } : s));

  const start = useCallback((steps, opts = {}) => {
    clear();
    setWaiting(null);
    setScript({ steps, i: 0, playing: true, speed: opts.speed ?? 1, practice: !!opts.practice, auto: opts.auto ?? true, done: false, awaitNext: false, onDone: opts.onDone, onStep: opts.onStep });
  }, []);
  const stop = useCallback(() => { clear(); run.current += 1; setScript(null); setNarration(null); setWaiting(null); game.setScriptTalk(null); stopNarration(); }, [game]);
  const pause = useCallback(() => { clear(); run.current += 1; setScript((s) => (s ? { ...s, playing: false } : s)); stopNarration(); }, []);
  const resume = useCallback(() => setScript((s) => (s ? { ...s, playing: true, awaitNext: false } : s)), []);
  const setSpeed = useCallback((speed) => setScript((s) => (s ? { ...s, speed } : s)), []);
  const setPractice = useCallback((practice) => setScript((s) => (s ? { ...s, practice } : s)), []);
  const setAuto = useCallback((auto) => setScript((s) => (s ? { ...s, auto, awaitNext: auto ? false : s.awaitNext } : s)), []);
  const jump = useCallback((delta) => { clear(); run.current += 1; stopNarration(); setWaiting(null); setScript((s) => (s ? { ...s, i: Math.max(0, Math.min(s.steps.length, s.i + delta)), playing: true, awaitNext: false } : s)); }, []);

  // 단계 실행: 내레이션이 끝나고 + 손 동작이 끝난 뒤에야 다음 단계로 넘어간다
  useEffect(() => {
    if (!script || !script.playing) return undefined;
    const { steps, i, speed } = script;
    if (i >= steps.length) {
      setNarration(null);
      if (!script.done) { setScript((s) => ({ ...s, done: true, playing: false })); script.onDone?.(); }
      return undefined;
    }
    const token = ++run.current;
    const alive = () => run.current === token;
    const step = steps[i];
    script.onStep?.(step, i);
    const text = step.say ?? null;
    setNarration(text ? { text, i, n: steps.length } : null);
    const est = speechMs(text, speed);
    const hasOp = !!step.op && step.op !== 'say';
    let speechDone = !text, actionDone = !hasOp;
    const finish = () => {
      if (!alive() || !speechDone || !actionDone) return;
      if (script.auto === false) { setScript((s) => (s ? { ...s, awaitNext: true } : s)); return; }
      later(() => { if (alive()) next(); }, 700 / speed);
    };
    const speechEnd = () => { if (!alive() || speechDone) return; speechDone = true; finish(); };
    if (text) {
      if (voiceOn && speechOk()) {
        narrate(text, { rate: Math.max(0.6, Math.min(2, speed)), onEnd: speechEnd });
        later(speechEnd, est * 1.8 + 2500); // 음성 합성이 끝 신호를 안 줄 때 대비
      } else later(speechEnd, est);
    }
    if (hasOp && script.practice && step.practice) {
      // 연습: 플레이어가 직접 할 때까지 대기 (설명은 계속 들림)
      setWaiting(step);
      return clear;
    }
    if (hasOp) {
      if (step.op === 'wait') later(() => { if (alive()) { actionDone = true; finish(); } }, (step.ms ?? 1000) / speed);
      else {
        // 설명을 어느 정도 들은 뒤(약 40%) 손이 움직이기 시작
        const startAt = text ? Math.max(900 / speed, est * 0.4) : 250 / speed;
        later(() => {
          if (!alive()) return;
          game.apply(step, { speed, quiet: true });
          later(() => { if (alive()) { actionDone = true; finish(); } }, (ACTION_MS[step.op] ?? 1400) / speed);
        }, startAt);
      }
    }
    finish();
    return clear;
  }, [script?.i, script?.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // 연습 단계 완료 감지
  useEffect(() => {
    if (!waiting || !script) return;
    if (opSatisfied(game.stRef.current, waiting, game)) {
      setWaiting(null);
      getAudio().ok();
      const token = run.current;
      later(() => { if (run.current === token) next(); }, 900);
    }
  }, [game.st, game.talking, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clear(); stopNarration(); }, []);
  return { script, narration, waiting, start, stop, pause, resume, setSpeed, setPractice, setAuto, jump };
}

// 연습 단계: 플레이어가 그 조작을 했는지 (수치는 근처면 인정)
export function opSatisfied(st, op, game) {
  const near = (a, b, tol) => (typeof b === 'number' ? Math.abs((a ?? -999) - b) <= tol : a === b);
  switch (op.op) {
    case 'place': return !!st.devices[op.device]?.placed;
    case 'move': return st.devices[op.device]?.slot === op.slot;
    case 'connect': {
      const [fd, fp] = op.from.split('.'), [td, tp] = op.to.split('.');
      return st.connections.some((c) => (c.from.d === fd && c.from.p === fp && c.to.d === td && c.to.p === tp) || (c.from.d === td && c.from.p === tp && c.to.d === fd && c.to.p === fp));
    }
    case 'disconnect': {
      const [fd, fp] = op.from.split('.');
      return !st.connections.some((c) => c.from.d === fd && c.from.p === fp);
    }
    case 'ch': return near(st.channels[op.ch - 1]?.[op.key], op.value, op.key === 'gain' ? 6 : op.key === 'fader' ? 6 : 3);
    case 'master': return near(st.master[op.key], op.value, 6);
    case 'dev': {
      const v = getPath(st.dev[op.device], op.key);
      return Array.isArray(op.value) ? JSON.stringify(v) === JSON.stringify(op.value) : near(v, op.value, op.key.includes('gain') ? 6 : 5);
    }
    case 'atem': return op.key === 'cut' || op.key === 'auto' ? true : st.atem[op.key] === op.value;
    case 'obs': return st.obs[op.key] === op.value;
    case 'talk': return game ? game.talking === !!op.on || !op.on : true;
    default: return true;
  }
}

export { kindLabel, VOICE_TYPES };
export const faultText = (f) => FAULT_TEXT[f.type]?.(f) ?? f.type;
