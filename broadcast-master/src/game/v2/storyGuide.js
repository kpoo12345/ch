/* =====================================================================
 * 스토리 미션 길잡이: "다음 할 일"을 하나씩 짚어 준다 (힌트를 다 봐도 막힐 때)
 *
 * 정답 풀이(solutions.js)를 미션 처음 상태에서 차례로 실행해 본 계획(planOf)을 만들고,
 * 지금 상태에서 아직 안 된 첫 단계를 고른다. 튜토리얼 "직접 해 보기"처럼 그 단계에서 기다리다가
 * 해내면 다음으로 넘어간다 (커서). 고른 단계는 GameScreen이 튜토리얼과 같은 방법으로 반짝인다.
 *
 * 순서가 있는 단계는 "그 결과를 쓰는 단계"가 끝났으면 이미 한 것으로 본다:
 *   조명 프로그래머 값 → RECORD(큐 저장) · PTZ 방향 맞추기 → STORE(프리셋 저장) · ATEM PREVIEW → CUT/AUTO
 * CUT/AUTO는 상태만 보고는 했는지 알 수 없을 때가 있어서(넘겼다 되돌리는 미션) 기다리는 동안엔
 * "그 단계에 왔을 때보다 PGM이 바뀌었는지"로 본다. 케이블을 뺐다가 같은 단자에 다시 꽂는 단계는
 * 다시 꽂기가 끝났으면 빼기도 한 것으로 본다.
 *
 * 계획을 끝까지 했는데 미션이 안 끝났으면(마무리) 처음부터 다시 따라가지 않는다(넘겼다 되돌리는 단계가
 * 끝없이 되풀이된다). 대신 각 조작의 마지막 값만 보고 어긋난 곳(driftStep)을 짚고, 그다음 남은 목표에
 * 맞춘 할 일(finishSteps), 그래도 없으면 남은 목표를 보여 준다.
 * ===================================================================== */
import { buildRuntime, framingOf, COLOR_NAMES, colorFamily } from '../sim.js';
import { faderDb, fmtDb, CABLES, DEVICE_TYPES } from '../engine.js';
import { applyOp } from '../ops.js';
import { opSatisfied, ptzCamOf } from './useGame.js';

const ACTION = new Set(['place', 'connect', 'disconnect', 'ch', 'master', 'dev', 'atem', 'obs', 'move', 'ptz', 'lightRecord', 'patchAdd', 'patchRemove', 'fade', 'talk']);
const isCut = (op) => op.op === 'atem' && (op.key === 'cut' || op.key === 'auto');

// 계획: 플레이어가 할 단계만 (해설·기다리기·말 멈추기 빼고), 각 단계를 한 뒤의 상태(exp)와 함께
// 말하기(talk on)는 남긴다: 마이크 테스트 목표는 플레이어가 직접 말해 봐야 채워진다
export function planOf(spec, solution = spec?.solution) {
  if (!solution?.length) return [];
  let st = buildRuntime(spec);
  const plan = [];
  solution.forEach((s, i) => {
    if (!s.op || !ACTION.has(s.op) || (s.op === 'talk' && !s.on)) return;
    if (s.op !== 'talk') {
      const next = applyOp(st, s);
      if (!next.lastError) st = next;
    }
    plan.push({ i, step: s, op: s, exp: st });
  });
  return plan;
}

// 앞 단계의 결과를 쓰는 단계 (그 단계가 끝났으면 앞 단계는 이미 한 것)
const pairKey = (op) => [op.from, op.to].sort().join('|');
function consumerOf(plan, k) {
  const a = plan[k].op;
  // 같은 두 단자에 다시 꽂는 단계가 뒤에 있으면 (예: 마이크 선을 빼고 DMX 선으로 다시)
  if (a.op === 'disconnect') {
    for (let j = k + 1; j < plan.length; j += 1) if (plan[j].op.op === 'connect' && pairKey(plan[j].op) === pairKey(a)) return j;
    return -1;
  }
  const setup = (a.op === 'dev' && /^programmer\./.test(String(a.key))) || (a.op === 'ptz' && a.act === 'aim') || (a.op === 'atem' && a.key === 'preview');
  if (!setup) return -1;
  for (let j = k + 1; j < plan.length; j += 1) {
    const b = plan[j].op;
    if (a.op === 'dev' && b.op === 'lightRecord' && b.device === a.device) return j;
    if (a.op === 'ptz' && b.op === 'ptz' && b.device === a.device && b.act === 'store') return j;
    if (a.op === 'atem' && isCut(b) && (b.switcher ?? null) === (a.switcher ?? null)) return j;
  }
  return -1;
}

// 미션 목표(입력 레벨 범위 등)는 튜토리얼 연습보다 좁을 수 있다 → 길잡이는 정답 값에 더 가깝게 맞췄을 때 넘어간다
const STRICT = { fader: 3, mainFader: 3, lowCutFreq: 10 };
const strict = (op) => (op.tol == null && typeof op.value === 'number' && (op.op === 'ch' || op.op === 'master' || op.op === 'dev') ? { ...op, tol: STRICT[op.key] ?? 2 } : op);

const switcherOf = (st, op) => (op.switcher && op.switcher !== st.switcherId ? st.atems?.[op.switcher] : st.atem) ?? {};
const near = (a, b, tol) => Math.abs((a ?? 0) - (b ?? 0)) <= tol;
const sameSet = (a = [], b = []) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// 지금 상태만 보고 그 단계를 한 것으로 볼 수 있는지 (앞으로 건너뛸 때)
export function doneNow(plan, k, st, game, { noConsume = false } = {}) {
  const { op, exp } = plan[k];
  const j = noConsume ? -1 : consumerOf(plan, k);
  if (j >= 0 && doneNow(plan, j, st, game)) return true;
  if (isCut(op)) return switcherOf(st, op).program === switcherOf(exp, op).program;
  // 말하기: 지금 말하고 있거나, 이미 말해 본 적이 있으면 (마이크 테스트 기록)
  if (op.op === 'talk') return !!game?.talking || [...(game?.latched ?? [])].some((x) => String(x).startsWith('talk:'));
  if (op.op === 'lightRecord') {
    const cue = st.dev[op.device]?.playbacks?.[op.index - 1]?.cue;
    const want = exp.dev[op.device]?.playbacks?.[op.index - 1]?.cue;
    return !!cue?.fixtures?.length && !!want && sameSet(cue.fixtures, want.fixtures)
      && String(cue.color).toLowerCase() === String(want.color).toLowerCase() && near(cue.intensity, want.intensity, 5) && near(cue.tilt, want.tilt, 5) && near(cue.pan, want.pan, 5);
  }
  if (op.op === 'ptz' && (op.act === 'store' || op.act === 'aim')) {
    const id = ptzCamOf(st, op.device);
    const want = ptzCamOf(exp, op.device);
    if (!id || id !== want) return false;
    const slot = st.devices[id].slot;
    const a = op.act === 'store' ? st.dev[id].presets?.[op.value] : st.dev[id];
    const b = op.act === 'store' ? exp.dev[id].presets?.[op.value] : exp.dev[id];
    if (!a || !b) return false;
    const f = framingOf(st.venue, slot, b);
    return f ? framingOf(st.venue, slot, a) === f : near(a.pan, b.pan, 3) && near(a.tilt, b.tilt, 3) && near(a.zoom, b.zoom, 0.05);
  }
  return opSatisfied(st, strict(op), game, null);
}

// 그 단계에서 기다리는 동안: 해냈는지 (before = 그 단계에 왔을 때의 상태)
export function doneLive(plan, k, st, before, game) {
  const { op } = plan[k];
  if (isCut(op) && before && opSatisfied(st, op, game, before)) return true;
  return doneNow(plan, k, st, game);
}

// 계획을 다 했는데 미션이 안 끝났을 때 남은 목표에 맞춰 더 할 일 (그 밖의 목표는 카드에 이름만 보여 준다)
//  말하기 테스트 → 다시 말해 보기 · 퍽 소리 → 스피커(앰프)를 껐다가 마지막에 다시 켜기
export function finishSteps(unmet = [], plan = []) {
  const out = [];
  for (const o of unmet) {
    const c = o.check ?? {};
    // 페이드: 정답의 그 페이드를 다시 (페이더를 반대쪽 끝에 둔 다음 천천히)
    if (c.type === 'fade') {
      const want = c.dir === 'in' ? (t) => t >= 50 : (t) => t <= 3;
      const f = plan.find((x) => x.op.op === 'fade' && want(x.op.to) && (!c.ch || x.op.ch === c.ch));
      if (f) {
        const start = f.op.to <= 3 ? 75 : 0;
        const set = f.op.ch ? { op: 'ch', ch: f.op.ch, key: 'fader', value: start } : { op: 'master', key: 'mainFader', value: start };
        out.push({ ...set, say: `페이드는 한 번에 내리면(올리면) 안 돼요. 페이더를 먼저 ${start}에 두고요.` });
        out.push({ ...f.op, say: '이번엔 2~3초에 걸쳐 천천히 움직여요. 손을 떼지 말고 쭉.' });
      }
    }
    if (c.type === 'talkTest') out.push({ op: 'talk', on: true, say: '말하기를 켜서 목소리가 끝까지 나가는지 다시 확인해요.' });
    if (c.type === 'noPop' && c.device) {
      out.push({ op: 'dev', device: c.device, key: 'power', value: false, say: '켜진 채로 케이블을 꽂아서 퍽 소리가 났어요. 전원을 한 번 끌게요.' });
      out.push({ op: 'dev', device: c.device, key: 'power', value: true, say: '케이블을 다 꽂았으니 이제 켜요. 스피커 전원은 늘 마지막에 켜요.' });
    }
  }
  return out.map((op, k) => ({ i: -1 - k, step: op, op, exp: null }));
}

// 카드에 보여 줄 "지금 할 일" 한 줄 (손잡이·버튼은 목표 값까지)
const CH_KEY = { gain: 'GAIN', fader: '페이더', aux: 'AUX1', aux2: 'AUX2', fx: 'EFFECT', pan: 'PAN', eqHigh: 'EQ HIGH', eqMid: 'EQ MID', eqLow: 'EQ LOW', eqFreq: 'EQ FREQ', lowCutFreq: 'LOW CUT 주파수', comp: 'COMP' };
const MASTER_KEY = { auxMaster: 'AUX 마스터', aux2Master: 'AUX2 마스터', fxReturn: 'FX RETURN', phonesLevel: '헤드폰 볼륨' };
const onOff = (v) => (v ? '켜세요' : '끄세요');
// 조사: 끝소리에 받침이 있는지 — 한글은 종성, 숫자는 읽는 소리(영·일·삼·육·칠·팔), 영문은 L·M·N·R(엘·엠·엔·알)
// 끝의 괄호 설명은 빼고 읽는다: "액티브 스피커 (강연자 바로 앞)" → 스피커
const lastOf = (w) => String(w ?? '').trim().replace(/\s*\([^()]*\)$/, '').replace(/[)\]'"°%]+$/, '').slice(-1);
const batchim = (w) => {
  const c = lastOf(w);
  const n = c.charCodeAt(0) - 0xac00;
  if (n >= 0 && n < 11172) return n % 28 === 0 ? null : n % 28 === 8 ? 'ㄹ' : 'x';
  if (/[0-9]/.test(c)) return '178'.includes(c) ? 'ㄹ' : '036'.includes(c) ? 'x' : null;
  return /[lr]/i.test(c) ? 'ㄹ' : /[mn]/i.test(c) ? 'x' : null;
};
export const eul = (w) => `${w}${batchim(w) ? '을' : '를'}`;
// "(으)로": 받침이 없거나 ㄹ이면 "로", 다른 받침이면 "으로"
const ro = (w) => (batchim(w) === 'x' ? '으로' : '로');
// 페이더는 눈금(dB)으로 읽는다: 75 = 0 dB, 0 = 맨 아래(-∞) — 페이더 옆 숫자도 dB로 보인다
const faderMark = (v) => (v <= 0 ? '맨 아래(-∞)' : v === 75 ? '0 눈금(0 dB)' : fmtDb(faderDb(v)).replace('.0 dB', ' dB'));
const mainLabel = (st) => (st?.devices?.[st?.mixerId]?.type === 'digital_mixer' ? 'MAIN 페이더' : 'STEREO(메인) 페이더');
const portName = (st, d, p) => { const def = DEVICE_TYPES[st?.devices?.[d]?.type]; return [...(def?.ins ?? []), ...(def?.outs ?? [])].find((x) => x.id === p)?.label ?? p; };
const OBS_VIDEO = { none: '없음', atem: 'ATEM (USB 웹캠)' };
const OBS_AUDIO = { none: '없음', builtin: 'PC 내장 마이크', mixer: '믹서 USB', interface: '오디오 인터페이스', atem: 'ATEM (USB)' };
const MEDIA_OUT = { comp: '컴포지션', layer1: 'L1', layer2: 'L2', layer3: 'L3', off: 'OFF' };

// 장비 패널 조작(dev)을 패널에 적힌 이름으로
function devText(op, name) {
  const k = op.key, v = op.value, d = name(op.device);
  let m;
  if (k === 'power') return `${d} 전원을 ${onOff(v)}.`;
  if (k === 'address') { const a = String(v).padStart(3, '0'); return `${d}의 DMX 주소를 ${a}${ro(a)} 맞추세요.`; }
  if (k === 'ip') return `${d} IP를 ${v}${ro(v)} 바꾸세요.`;
  if (k === 'programmer') return '조명 콘솔의 CLEAR를 눌러 프로그래머를 비우세요.';
  if (k === 'programmer.sel') return `조명 콘솔 프로그래머에서 ${[].concat(v).join('·')}번 조명을 고르세요.`;
  if (k === 'programmer.intensity') return `프로그래머 밝기(Intensity)를 ${v}%로 맞추세요.`;
  if (k === 'programmer.color') { const c = COLOR_NAMES[colorFamily(v)] ?? '반짝이는 색'; return `프로그래머 색을 ${c}${ro(c)} 고르세요.`; }
  if (k === 'programmer.pan' || k === 'programmer.tilt') return `프로그래머 ${k.endsWith('pan') ? 'PAN을' : 'TILT를'} ${v}°로 맞추세요.`;
  if ((m = /^playbacks\.(\d+)\.level$/.exec(k))) return `조명 콘솔 플레이백 ${Number(m[1]) + 1}번 페이더를 ${v >= 100 ? '끝까지 올리세요' : v <= 0 ? '맨 아래로 내리세요' : `${v}%로 맞추세요`}.`;
  if (k === 'blackout') return `조명 콘솔 BLACKOUT을 ${v ? '켜세요' : '푸세요'}.`;
  if (k === 'gm') return `조명 콘솔 GM(그랜드 마스터)을 ${v}%로 맞추세요.`;
  if (k === 'terminated') return `${d}의 DMX 출력에 터미네이터를 ${v ? '꽂으세요' : '빼세요'}.`;
  if ((m = /^layers\.(\d+)\.opacity$/.exec(k))) return `${d} ${Number(m[1]) + 1}번 레이어의 불투명도(Opacity)를 ${v}${ro(v)} 맞추세요.`;
  if (k === 'out1' || k === 'out2') { const o = MEDIA_OUT[v] ?? v; return `${d} ${eul(`출력 ${k === 'out1' ? 1 : 2}`)} ${o}${ro(o)} 바꾸세요.`; }
  if (k === 'compRes') { const r = String(v).replace('x', '×'); return `${d} 컴포지션 해상도를 ${r}${ro(r)} 바꾸세요.`; }
  if ((m = /^in\.(\d+)\.(gain|phantom|inst)$/.exec(k))) {
    const inp = `INPUT ${Number(m[1]) + 1}`;
    if (m[2] === 'gain') return `${d} ${inp} GAIN을 ${v}에 맞추세요.`;
    return `${d} ${inp}의 ${m[2] === 'phantom' ? '+48V' : 'INST'}를 ${onOff(v)}.`;
  }
  if (k === 'direct') return `${d}의 DIRECT MONITOR를 ${onOff(v)}.`;
  if (k === 'rxChannel' || k === 'txChannel') return `${d} ${k === 'rxChannel' ? '수신기' : '송신기'} 채널을 ${v}번으로 맞추세요.`;
  if (k === 'txPower') return `${d} 송신기 전원을 ${onOff(v)}.`;
  if (k === 'battery') return `${d} 배터리를 새것으로 갈아 끼우세요.`;
  if (k === 'groundLift') return `${d}의 GROUND LIFT를 ${onOff(v)}.`;
  if (k === 'clean') return `${d}의 클린 HDMI를 ${onOff(v)}.`;
  if (typeof v === 'number') return `${d} 패널에서 반짝이는 값을 ${v}에 맞추세요.`;
  if (typeof v === 'boolean') return `${d} 패널에서 반짝이는 단추를 ${onOff(v)}.`;
  return null;
}

export function guideText(op, st) {
  const name = (d) => st?.devices?.[d]?.name ?? d;
  switch (op?.op) {
    case 'place': return `미션 탭에서 반짝이는 "+ ${name(op.device)} 배치"를 누르세요.`;
    case 'disconnect':
      if (op.blocker) { const [fd, fp] = op.from.split('.'), [td, tp] = op.to.split('.'); return `꽂을 자리에 다른 케이블(${name(fd)} ${portName(st, fd, fp)} → ${name(td)} ${portName(st, td, tp)})이 있어요. 반짝이는 "분리"를 눌러 먼저 빼세요.`; }
      return '반짝이는 케이블의 "분리"를 누르세요.';
    case 'connect': { const c = CABLES[op.cable]?.name ?? `${op.cable} 케이블`; return `반짝이는 단자 두 곳을 ${c}${ro(c)} 이으세요.`; }
    case 'move': return `${eul(name(op.device))} 반짝이는 자리로 옮기세요.`;
    case 'talk': return '아래 "자동 말하기"를 켜거나 "말하기"를 누르고 있어 보세요.';
    case 'fade': {
      const who = op.ch ? `CH${op.ch} 페이더` : mainLabel(st);
      const now = op.ch ? st?.channels?.[op.ch - 1]?.fader : st?.master?.mainFader;
      // 이미 목표 자리에 있으면 페이드를 할 수 없다 → 반대쪽 끝으로 먼저
      if (now != null && Math.abs(now - op.to) <= 3) return `${eul(who)} 먼저 ${op.to <= 3 ? '0 눈금(0 dB)까지 올린' : '맨 아래(-∞)로 내린'} 다음, 2~3초에 걸쳐 천천히 ${faderMark(op.to)}까지 움직이세요.`;
      return `믹서 콘솔에서 ${eul(who)} 2~3초에 걸쳐 천천히 ${faderMark(op.to)}까지 움직이세요.`;
    }
    case 'ch': {
      const k = op.key, c = `CH${op.ch}`;
      if (k === 'mute') return `믹서 콘솔 ${eul(c)} ${op.value ? '끄세요 (MUTE)' : '켜세요 (ON)'}.`;
      if (k === 'phantom') return `믹서 콘솔 ${c} +48V를 ${onOff(op.value)}.`;
      if (k === 'lowCut') return `믹서 콘솔 ${c} LOW CUT을 ${onOff(op.value)}.`;
      if (k === 'pfl') return `믹서 콘솔 ${c} PFL을 ${onOff(op.value)}.`;
      if (k === 'pad') return `믹서 콘솔 ${c} PAD를 ${onOff(op.value)}.`;
      if (k === 'patch') { const l = String(op.value).replace('local', 'LOCAL '); return `믹서 콘솔 ${c} 입력 패치를 ${l}${ro(l)} 바꾸세요.`; }
      if (k === 'fader') return `믹서 콘솔 ${c} 페이더를 ${faderMark(op.value)}에 맞추세요.`;
      if (k === 'gain') return `믹서 콘솔 ${c} GAIN을 +${op.value} dB에 맞추세요.`;
      if (k === 'pan') { const v = op.value === 0 ? '가운데(C)' : op.value < 0 ? `L${-op.value}` : `R${op.value}`; return `믹서 콘솔 ${c} PAN을 ${v}에 맞추세요.`; }
      if (/^eq(High|Mid|Low)$/.test(k)) return `믹서 콘솔 ${c} ${CH_KEY[k]}를 ${op.value > 0 ? '+' : ''}${op.value}에 맞추세요.`;
      if (k === 'eqFreq') return `믹서 콘솔 ${c} EQ FREQ를 ${op.value >= 1000 ? `${op.value / 1000}k` : op.value}에 맞추세요.`;
      if (typeof op.value === 'number') return `믹서 콘솔 ${c} ${CH_KEY[k] ?? k} 값을 ${op.value}에 맞추세요.`;
      break;
    }
    case 'master': {
      if (op.key === 'phantom') return `믹서 콘솔 MASTER의 +48V를 ${onOff(op.value)}.`;
      if (op.key === 'mainMute') return `믹서 콘솔 STEREO(메인)를 ${op.value ? '끄세요' : '켜세요 (ST ON)'}.`;
      if (op.key === 'usbOut') { const o = op.value === 'main' ? 'Main L/R' : op.value; return `믹서 콘솔 MASTER에서 USB 출력을 ${o}${ro(o)} 바꾸세요.`; }
      if (op.key === 'mainFader') return `믹서 콘솔 ${eul(mainLabel(st))} ${faderMark(op.value)}에 맞추세요.`;
      if (typeof op.value === 'number') return `믹서 콘솔 ${MASTER_KEY[op.key] ?? op.key} 값을 ${op.value}에 맞추세요.`;
      break;
    }
    case 'dev': { const t = devText(op, name); if (t) return t; break; }
    case 'atem': {
      const k = op.key;
      if (k === 'program') return `스위처 PROGRAM 줄에서 ${op.value}번을 누르세요.`;
      if (k === 'preview') return `스위처 PREVIEW 줄에서 ${op.value}번을 누르세요.`;
      if (k === 'cut') return '스위처의 CUT을 누르세요.';
      if (k === 'auto') return '스위처의 AUTO를 누르세요.';
      if (k === 'streaming') return `스위처의 ON AIR를 ${onOff(op.value)}.`;
      if (k === 'recording') return `스위처의 REC를 ${onOff(op.value)}.`;
      if (k === 'pip') return `스위처의 PIP를 ${onOff(op.value)}.`;
      break;
    }
    case 'obs': {
      const k = op.key;
      if (k === 'video') { const o = OBS_VIDEO[op.value] ?? op.value; return `PC(OBS)에서 영상 소스를 ${o}${ro(o)} 고르세요.`; }
      if (k === 'audio') { const o = OBS_AUDIO[op.value] ?? op.value; return `PC(OBS)에서 오디오 소스를 ${o}${ro(o)} 고르세요.`; }
      if (k === 'streaming') return `PC(OBS)에서 ${op.value ? '방송 시작' : '방송 중지'}을 누르세요.`;
      if (k === 'muted') return `PC(OBS) 오디오 MUTE를 ${op.value ? '켜세요' : '푸세요'}.`;
      break;
    }
    case 'lightRecord': return `프로그래머에서 장면을 만든 다음 RECORD → ${op.index}번 플레이백의 파란 버튼을 누르세요.`;
    case 'ptz':
      if (op.act === 'select') return `${name(op.device)}에서 ${eul(`CAM ${op.value + 1}`)} 고르세요.`;
      if (op.act === 'store') return `STORE를 누르고 ${op.value}번 버튼을 누르세요.`;
      if (op.act === 'recall') return `${op.value}번 프리셋 버튼을 누르세요.`;
      if (op.act === 'aim') return '조이스틱(판·화살표)과 ZOOM으로 구도를 맞추세요. 패널의 "구도" 이름을 보세요.';
      break;
    default:
  }
  return op?.op === 'ch' || op?.op === 'master' ? '믹서 콘솔에서 반짝이는 곳을 맞추세요.' : '장비 패널에서 반짝이는 곳을 맞추세요.';
}

// 꽂아야 할 단자를 다른 케이블이 차지하고 있으면(잘못 꽂은 케이블, DMX 자리의 마이크 선) 그 케이블부터 빼는 단계 (없으면 null)
//  — 그대로 두면 단자를 눌러도 "이미 케이블이 꽂힌 단자"라 길잡이가 막힌다
export function unblockStep(op, st) {
  if (op?.op !== 'connect' || !st?.connections || opSatisfied(st, op)) return null;
  const end = (x) => { const [d, p] = String(x).split('.'); return { d, p }; };
  const a = end(op.from), b = end(op.to);
  const at = (e, x) => e.d === x.d && e.p === x.p;
  const c = st.connections.find((x) => [a, b].some((e) => at(x.from, e) || at(x.to, e)));
  return c ? { op: 'disconnect', from: `${c.from.d}.${c.from.p}`, to: `${c.to.d}.${c.to.p}`, id: c.id, blocker: true } : null;
}

// 안전 · 되돌리기: 지금 단계를 하기 전에 앞 단계가 풀렸으면 그 단계로 돌아간다 (돌아갈 곳의 번호, 없으면 null)
//  - PTZ를 움직이는 단계(방향·불러오기·저장)인데, 계획에선 방송에서 빠져 있어야 할 그 카메라가 지금 PGM이면
//    → 그 카메라를 빼는 CUT으로 (방송 중에 PTZ를 움직이면 시청자에게 그대로 보인다)
//  - 프리셋 저장인데 카메라가 맞춰 둔 구도에서 벗어났으면 → 방향 맞추기로
export function guardBack(plan, k, st, game) {
  const x = plan[k];
  if (!x || x.op.op !== 'ptz' || x.op.act === 'select') return null;
  const prev = k > 0 ? plan[k - 1].exp : null;
  if (prev && (st.atem?.program !== prev.atem?.program)) {
    for (let j = k - 1; j >= 0; j -= 1) if (isCut(plan[j].op)) return j;
  }
  if (x.op.act === 'store') {
    for (let j = k - 1; j >= 0; j -= 1) {
      const a = plan[j].op;
      if (a.op === 'ptz' && a.device === x.op.device && a.act === 'aim') return doneNow(plan, j, st, game, { noConsume: true }) ? null : j;
      if (a.op === 'ptz' && a.act === 'store') break;
    }
  }
  return null;
}

// 마무리: 각 조작의 마지막 값(정답의 마지막 단계)만 보고 지금과 어긋난 첫 단계 (없으면 null)
//  조명 프로그래머·말하기처럼 중간에만 쓰는 단계는 빼고, 같은 대상을 여러 번 바꾸면 마지막 것만 본다
const targetOf = (op) => {
  switch (op.op) {
    case 'place': case 'move': return `${op.op}:${op.device}`;
    case 'connect': case 'disconnect': return `cable:${pairKey(op)}`;
    case 'ch': return `ch${op.ch}.${op.key}`;
    case 'fade': return op.ch ? `ch${op.ch}.fader` : 'master.mainFader';
    case 'master': return `master.${op.key}`;
    case 'dev': return /^programmer\./.test(String(op.key)) ? null : `${op.device}.${op.key}`;
    case 'obs': return `obs.${op.key}`;
    case 'atem': return `atem:${op.switcher ?? ''}`;
    case 'lightRecord': return `pb:${op.device}:${op.index}`;
    case 'patchAdd': return `patch:${op.device}:${op.entry?.address}`;
    case 'patchRemove': return `patchn:${op.device}:${op.n}`;
    case 'ptz': return op.act === 'select' ? `ptzsel:${op.device}` : op.act === 'store' ? `preset:${op.device}:${op.value}` : `ptzpos:${op.device}`;
    default: return null;
  }
};
export function driftStep(plan, st, game) {
  const last = new Map();
  plan.forEach((x, k) => { const t = targetOf(x.op); if (t) last.set(t, k); });
  for (let k = 0; k < plan.length; k += 1) {
    const { op } = plan[k];
    if (last.get(targetOf(op)) !== k) continue;
    if (op.op === 'fade') {
      const S = op.ch ? st.channels[op.ch - 1] : null;
      if (!near(op.ch ? S?.fader : st.master?.mainFader, op.to, 3)) return k;
      continue;
    }
    if (!doneNow(plan, k, st, game, { noConsume: true })) return k;
  }
  return null;
}

// from부터 이미 된 단계를 건너뛴 다음 할 일 번호 (다 했으면 plan.length)
export function skipDone(plan, from, st, game) {
  let k = from;
  while (k < plan.length && doneNow(plan, k, st, game)) k += 1;
  return k;
}

// 길잡이 한 걸음: 지금 상태를 보고 다음 상태를 정한다 (바뀔 게 없으면 null)
//  g = { phase: 'plan' | 'finish', list, cur }, before = 지금 할 일을 짚기 시작했을 때의 상태
//  돌려주는 note: 'back-air'(방송 중 PTZ라 CUT으로) · 'back-aim'(구도가 풀려 다시 맞추기) · 'next' · 'finish'
export function advanceGuide(g, { plan, st, before, game, unmet = [] }) {
  if (!unmet.length) return null;
  // 되돌릴 수 없는 실수(방송 중에 PTZ를 움직임)가 기록됐으면 남은 단계를 따라가도 끝낼 수 없다
  //  → 곧바로 남은 목표 카드(다시 하기)로 ("시청자는 흔들리는 화면을 못 봤죠" 같은 말을 하지 않게)
  if (unmet.some((o) => o.check?.type === 'noOnAirMove')) return g.phase === 'finish' && !g.list.length ? null : { phase: 'finish', list: [], cur: 0, note: 'left' };
  if (g.phase === 'plan') {
    if (g.cur < plan.length) {
      const back = guardBack(plan, g.cur, st, game);
      if (back != null && back !== g.cur) return { ...g, cur: back, note: plan[back].op.op === 'atem' ? 'back-air' : 'back-aim' };
      if (!doneLive(plan, g.cur, st, before, game)) return null;
      const nk = skipDone(plan, g.cur + 1, st, game);
      if (nk < plan.length) return { ...g, cur: nk, note: 'next' };
    }
    // 정답 순서를 끝까지 했는데 안 끝났다 → 마무리 (처음부터 다시 따라가면 넘겼다 되돌리는 단계가 되풀이된다)
    return advanceGuide({ phase: 'finish', list: [], cur: 0 }, { plan, st, before: st, game, unmet }) ?? { phase: 'finish', list: [], cur: 0, note: 'finish' };
  }
  // 마무리: 지금 할 일을 해냈는지 보고, 마지막 값이 어긋난 조작 → 남은 목표에 맞춘 할 일 → (없으면) 남은 목표 카드
  if (g.cur < g.list.length && !doneLive(g.list, g.cur, st, before, game)) return null;
  const d = driftStep(plan, st, game);
  const extra = d != null ? [plan[d]] : finishSteps(unmet, plan);
  const next = extra.slice(skipDone(extra, 0, st, game));
  const same = next.length === g.list.length - g.cur && next.every((x, j) => x.i === g.list[g.cur + j]?.i && JSON.stringify(x.op) === JSON.stringify(g.list[g.cur + j]?.op));
  if (same) return null;
  return { phase: 'finish', list: next, cur: 0, note: next.length ? 'finish' : 'left' };
}
