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
 * "그 단계에 왔을 때보다 PGM이 바뀌었는지"로 본다.
 * ===================================================================== */
import { buildRuntime, framingOf } from '../sim.js';
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
function consumerOf(plan, k) {
  const a = plan[k].op;
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
export function doneNow(plan, k, st, game) {
  const { op, exp } = plan[k];
  const j = consumerOf(plan, k);
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
export function finishSteps(unmet = []) {
  const out = [];
  for (const o of unmet) {
    const c = o.check ?? {};
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
const MASTER_KEY = { mainFader: 'STEREO(메인) 페이더', auxMaster: 'AUX 마스터', aux2Master: 'AUX2 마스터', fxReturn: 'FX RETURN', phonesLevel: '헤드폰 볼륨' };
const onOff = (v) => (v ? '켜세요' : '끄세요');
// 숫자 뒤 "(으)로": 끝자리를 읽었을 때 받침이 ㅇ·ㅁ·ㄱ이면 "으로" (영·삼·육), 나머지는 "로"
const ro = (n) => (/[036]$/.test(String(n)) ? '으로' : '로');
export function guideText(op, st) {
  const name = (d) => st?.devices?.[d]?.name ?? d;
  switch (op?.op) {
    case 'place': return `미션 탭에서 반짝이는 "+ ${name(op.device)} 배치"를 누르세요.`;
    case 'disconnect': return '반짝이는 케이블의 "분리"를 누르세요.';
    case 'move': return `${name(op.device)}를 반짝이는 자리로 옮기세요.`;
    case 'talk': return '아래 "자동 말하기"를 켜거나 "말하기"를 누르고 있어 보세요.';
    case 'fade': return `믹서 콘솔에서 ${op.ch ? `CH${op.ch}` : 'STEREO'} 페이더를 2~3초에 걸쳐 천천히 ${op.to}까지 움직이세요.`;
    case 'ch': {
      const k = op.key;
      if (k === 'mute') return `믹서 콘솔 CH${op.ch}를 ${op.value ? '끄세요 (MUTE)' : '켜세요 (ON)'}.`;
      if (k === 'phantom') return `믹서 콘솔 CH${op.ch} +48V를 ${onOff(op.value)}.`;
      if (k === 'lowCut') return `믹서 콘솔 CH${op.ch} LOW CUT을 ${onOff(op.value)}.`;
      if (k === 'pfl') return `믹서 콘솔 CH${op.ch} PFL을 ${onOff(op.value)}.`;
      if (k === 'pad') return `믹서 콘솔 CH${op.ch} PAD를 ${onOff(op.value)}.`;
      if (k === 'patch') return `믹서 콘솔 CH${op.ch} 입력 패치를 ${String(op.value).replace('local', 'LOCAL ')}로 바꾸세요.`;
      if (typeof op.value === 'number') return `믹서 콘솔 CH${op.ch} ${CH_KEY[k] ?? k} 값을 ${op.value}에 맞추세요.`;
      break;
    }
    case 'master': {
      if (op.key === 'phantom') return `믹서 콘솔 MASTER의 +48V를 ${onOff(op.value)}.`;
      if (op.key === 'mainMute') return `믹서 콘솔 STEREO(메인)를 ${op.value ? '끄세요' : '켜세요 (ST ON)'}.`;
      if (op.key === 'usbOut') return `믹서 콘솔 MASTER에서 USB 출력을 ${op.value === 'main' ? 'Main L/R' : op.value}로 바꾸세요.`;
      if (typeof op.value === 'number') return `믹서 콘솔 ${MASTER_KEY[op.key] ?? op.key} 값을 ${op.value}에 맞추세요.`;
      break;
    }
    case 'dev': {
      if (op.key === 'power') return `${name(op.device)} 전원을 ${onOff(op.value)}.`;
      if (op.key === 'address') return `${name(op.device)}의 DMX 주소를 ${String(op.value).padStart(3, '0')}${ro(op.value)} 맞추세요.`;
      if (typeof op.value === 'number') return `${name(op.device)} 패널에서 반짝이는 값을 ${op.value}에 맞추세요.`;
      if (typeof op.value === 'boolean') return `${name(op.device)} 패널에서 반짝이는 단추를 ${onOff(op.value)}.`;
      break;
    }
    case 'lightRecord': return `프로그래머에서 장면을 만든 다음 RECORD → ${op.index}번 플레이백의 파란 버튼을 누르세요.`;
    case 'ptz':
      if (op.act === 'select') return `${name(op.device)}에서 CAM ${op.value + 1}을 고르세요.`;
      if (op.act === 'store') return `STORE를 누르고 ${op.value}번 버튼을 누르세요.`;
      if (op.act === 'recall') return `${op.value}번 프리셋 버튼을 누르세요.`;
      if (op.act === 'aim') return '조이스틱(판·화살표)과 ZOOM으로 구도를 맞추세요. 패널의 "구도" 이름을 보세요.';
      break;
    default:
  }
  return op?.op === 'ch' || op?.op === 'master' ? '믹서 콘솔에서 반짝이는 곳을 맞추세요.' : '장비 패널에서 반짝이는 곳을 맞추세요.';
}

// from부터 이미 된 단계를 건너뛴 다음 할 일 번호 (다 했으면 plan.length)
export function skipDone(plan, from, st, game) {
  let k = from;
  while (k < plan.length && doneNow(plan, k, st, game)) k += 1;
  return k;
}
