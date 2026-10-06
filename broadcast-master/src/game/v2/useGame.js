import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { buildRuntime, computeSim, checkObjective, FAULT_TEXT, voiceSources, CHANNELS, CH_DEFAULT, MASTER_DEFAULT, portKind, mixerStateOf } from '../sim.js';
import { applyOp, opToAction, noteOnAirMove, notePop, getPath } from '../ops.js';
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
        if (a) { if (a.ctl) a.ctl.prev = from; a.speed = speed; a.durMs = ms; setAction(a); }
      }
      for (let k = 1; k <= n; k += 1) setTimeout(() => applyRef.current?.(step(k), { visual: false, quiet: true }), (ms * k) / n);
      // 대본의 페이드는 화면이 느려 단계 사이가 벌어져도 페이드로 인정 (끝난 뒤 기록)
      const fk = (!op.mixer || op.mixer === cur.mixerId) ? (op.ch ? `ch${op.ch}` : 'main') : null;
      if (fk && ms >= 1500) {
        setTimeout(() => {
          const tag = from >= 35 && op.to <= 3 ? `fadeOut:${fk}` : from <= 3 && op.to >= 50 ? `fadeIn:${fk}` : null;
          if (tag) setLatched((s0) => { const n0 = new Set(s0); n0.add(tag); n0.delete(`cutOut:${fk}`); return n0; });
        }, ms + 80);
      }
      return true;
    }
    if (op.op === 'talk') { setScriptTalk(op.on ? true : null); return true; }
    if (op.op === 'perform') { setPerforming(!!op.on); return true; }
    if (op.op === 'wait' || op.op === 'say') return true;
    const lat = new Set();
    // 팝 노이즈: 켜진 스피커 경로를 건드리면 기록, 스피커를 끄면 다시 할 수 있게 지운다
    const popSet = new Set(latchedRef.current);
    const popped = notePop(cur, op, popSet);
    if (op.op === 'dev' && op.key === 'power' && op.value === false && latchedRef.current.has(`pop:${op.device}`)) setLatched((s0) => { const n = new Set(s0); n.delete(`pop:${op.device}`); return n; });
    if (popped) {
      setLatched((s0) => new Set([...s0, ...popped.map((id) => `pop:${id}`)]));
      getAudio().pop?.();
      notify('err', '퍽! 스피커가 켜진 채로 케이블을 꽂거나 +48V를 바꿨어요. 스피커 전원은 연결을 다 마친 뒤 마지막에 켭니다. (스피커를 껐다가 다시 순서대로 하면 됩니다)');
    }
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
    const next = { ...base, ...saved, devices, dev: saved.dev ?? {}, connections, channels, mixers, master: { ...MASTER_DEFAULT, ...(saved.master ?? {}) }, cables: {}, unlimited: true, faults: [],
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
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const timers = useRef([]);
  const cur = useRef({ i: -1, speech: true, action: true }); // 지금 단계의 진행 상황
  const applied = useRef(new Set()); // 동작을 이미 적용한 단계 (같은 동작이 두 번 적용되지 않게)
  const snaps = useRef({}); // 단계를 시작하기 직전의 상태 (이전 단계로 되돌리기)
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const hasOp = (step) => !!step?.op && step.op !== 'say';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const start = useCallback((steps, opts = {}) => {
    clear(); stopNarration();
    applied.current = new Set(); snaps.current = {}; cur.current = { i: -1, speech: true, action: true };
    setWaiting(null); setPraised(false); setNarration(null);
    setScript({ steps, i: 0, playing: true, speed: opts.speed ?? 1, practice: !!opts.practice, auto: opts.auto ?? true, done: false, ready: false, restart: 0, onDone: opts.onDone, onStep: opts.onStep });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stop = useCallback(() => { clear(); cur.current = { i: -1 }; setScript(null); setNarration(null); setWaiting(null); setSpeaking(false); game.setScriptTalk(null); stopNarration(); }, [game]); // eslint-disable-line react-hooks/exhaustive-deps
  const pause = useCallback(() => { clear(); stopNarration(); setSpeaking(false); setScript((s) => (s ? { ...s, playing: false } : s)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const resume = useCallback(() => setScript((s) => (s ? { ...s, playing: true, restart: s.restart + 1 } : s)), []); // eslint-disable-line react-hooks/exhaustive-deps
  // 지금 읽는 대사: 속도를 바꾸면 읽던 곳부터 새 속도로 이어 읽는다
  const speech = useRef(null); // { c, text, from, t0, ms, speed, pos, timer, end }
  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn; // 화면에서 음성을 껐다 켰다 하면 바로 반영 (콜백이 옛 값을 쥐지 않게)
  const speak = (c, text, from, speed, end) => {
    const sp = speech.current;
    if (sp?.timer) clearTimeout(sp.timer);
    const part = text.slice(from);
    const ms = speechMs(part, speed);
    const t0 = Date.now();
    const s1 = { c, text, from, t0, ms, speed, pos: from, end, timer: null };
    speech.current = s1;
    setNarration((n) => (n && n.text === text ? { ...n, ms, offset: from, t0, pos: from } : n));
    if (voiceRef.current && speechOk()) {
      narrate(part, {
        rate: Math.max(0.6, Math.min(2, speed)),
        onEnd: end,
        onBoundary: (ci) => { if (speech.current === s1) { s1.pos = from + ci; setNarration((n) => (n && n.text === text ? { ...n, pos: from + ci } : n)); } },
        // 목소리가 없으면(합성 실패) 글자 속도대로 시간이 지나면 끝낸다
        onError: () => { if (speech.current !== s1) return; clearTimeout(s1.timer); s1.timer = setTimeout(end, Math.max(0, ms - (Date.now() - t0))); },
      });
      s1.timer = setTimeout(end, ms * 1.8 + 2500); // 음성 합성이 끝 신호를 안 줄 때 대비
    } else s1.timer = setTimeout(end, ms);
  };
  const setSpeed = useCallback((speed) => {
    setScript((s) => (s ? { ...s, speed } : s));
    const sp = speech.current;
    if (!sp || sp.c !== cur.current || sp.c.speech || sp.speed === speed) return;
    // 지금까지 읽은 위치 (음성이 단어 위치를 알려 주면 그것, 아니면 시간으로 짐작) → 단어 앞에서 끊어 이어 읽기
    const byTime = sp.from + Math.floor(((Date.now() - sp.t0) / sp.ms) * (sp.text.length - sp.from));
    let pos = Math.min(sp.text.length, Math.max(sp.pos, byTime));
    const cut = Math.max(sp.text.lastIndexOf(' ', pos), sp.from);
    pos = cut > sp.from ? cut + 1 : sp.from;
    if (sp.text.length - pos < 3) return;
    speak(sp.c, sp.text, pos, speed, sp.end);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    clear(); stopNarration(); setWaiting(null); setPraised(false); setSpeaking(false);
    if (delta > 0) {
      if (s.i < s.steps.length) ghostDo(s.i, false);
      setScript((x) => (x ? { ...x, i: Math.min(x.steps.length, x.i + 1), playing: true, ready: false, restart: x.restart + 1 } : x));
      return;
    }
    const target = Math.max(0, s.i - 1);
    if (snaps.current[target]) { const s1 = clone(snaps.current[target]); game.stRef.current = s1; game.setSt(s1); }
    [...applied.current].forEach((k) => { if (k >= target) applied.current.delete(k); });
    game.setScriptTalk(null);
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
    if (i >= steps.length) {
      setNarration(null); setWaiting(null);
      if (!sc.done) { setScript((x) => ({ ...x, done: true, playing: false })); sc.onDone?.(); }
      return undefined;
    }
    const step = steps[i];
    if (!snaps.current[i]) snaps.current[i] = clone(game.stRef.current);
    sc.onStep?.(step, i);
    const text = step.say ?? null;
    const est = speechMs(text, speed);
    // 대사가 없는 단계에서는 앞 대사를 그대로 띄워 둔다 (상자가 깜빡이지 않게)
    if (text) setNarration({ text, i, n: steps.length, ms: est, offset: 0, t0: Date.now(), pos: 0 });
    setPraised(false);
    const c = { i, speech: !text, action: !hasOp(step) || applied.current.has(i) };
    cur.current = c;
    const speechEnd = () => { if (cur.current !== c || c.speech) return; c.speech = true; setSpeaking(false); bump(); };
    if (text) {
      setSpeaking(true);
      speak(c, text, 0, speed, speechEnd);
    } else { setSpeaking(false); if (speech.current?.timer) clearTimeout(speech.current.timer); speech.current = null; }
    if (!c.action) {
      if (sc.practice && step.practice) setWaiting({ ...step, index: i });
      else if (step.op === 'wait') later(() => { if (cur.current === c) { applied.current.add(i); c.action = true; bump(); } }, (step.ms ?? 1000) / speed);
      else {
        setWaiting(null);
        // 설명을 어느 정도 들은 뒤(약 40%) 손이 움직이기 시작
        const startAt = text ? Math.max(900 / speed, est * 0.4) : 250 / speed;
        later(() => {
          if (cur.current !== c) return;
          ghostDo(i);
          later(() => { if (cur.current === c) { c.action = true; bump(); } }, step.op === 'fade' ? (step.ms ?? 3000) + 300 : (ACTION_MS[step.op] ?? 1400) / speed);
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
    if (!script?.ready || !script.playing || (!script.auto && script.steps[script.i]?.say)) return undefined;
    const i = script.i;
    const t = setTimeout(() => { if (scriptRef.current?.i === i && scriptRef.current.ready) setScript((x) => ({ ...x, i: i + 1, ready: false })); }, (praised ? 1100 : 700) / script.speed);
    return () => clearTimeout(t);
  }, [script?.ready, script?.auto, script?.i, script?.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // 연습 단계 완료 감지
  useEffect(() => {
    if (!waiting || !scriptRef.current) return;
    if (opSatisfied(game.stRef.current, waiting, game, snaps.current[waiting.index])) {
      const i = waiting.index;
      applied.current.add(i);
      setWaiting(null);
      setPraised(true);
      getAudio().ok();
      if (cur.current.i === i) { cur.current.action = true; bump(); }
    }
  }, [game.st, game.talking, game.latched, waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clear(); stopNarration(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { script, narration, waiting, speaking, praised, start, stop, pause, resume, setSpeed, setPractice, setAuto, jump, next, showMe };
}

// 연습 단계: 플레이어가 그 조작을 했는지 (수치는 근처면 인정)
export function opSatisfied(st, op, game, before) {
  const near = (a, b, tol) => (typeof b === 'number' ? Math.abs((a ?? -999) - b) <= tol : a === b);
  switch (op.op) {
    case 'place': return !!st.devices[op.device]?.placed;
    case 'move': return st.devices[op.device]?.slot === op.slot;
    case 'connect': {
      const [fd, fp] = op.from.split('.'), [td, tp] = op.to.split('.');
      // 같은 두 장비를 같은 종류의 단자로 이었으면 인정 (예: PC USB 1 대신 USB 2)
      const ok = (e, d, p) => e.d === d && (e.p === p || portKind(st.devices[d]?.type, e.p) === portKind(st.devices[d]?.type, p));
      return st.connections.some((c) => (ok(c.from, fd, fp) && ok(c.to, td, tp)) || (ok(c.from, td, tp) && ok(c.to, fd, fp)));
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
