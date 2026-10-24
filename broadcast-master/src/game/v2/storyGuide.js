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
  return opSatisfied(st, op, game, null);
}

// 그 단계에서 기다리는 동안: 해냈는지 (before = 그 단계에 왔을 때의 상태)
export function doneLive(plan, k, st, before, game) {
  const { op } = plan[k];
  if (isCut(op) && before && opSatisfied(st, op, game, before)) return true;
  return doneNow(plan, k, st, game);
}

// from부터 이미 된 단계를 건너뛴 다음 할 일 번호 (다 했으면 plan.length)
export function skipDone(plan, from, st, game) {
  let k = from;
  while (k < plan.length && doneNow(plan, k, st, game)) k += 1;
  return k;
}
