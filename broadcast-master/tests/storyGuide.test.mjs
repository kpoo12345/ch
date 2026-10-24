import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

/* 스토리 길잡이("다음 할 일 짚어 주기") 검사 — 짚어 주는 대로만 하면 모든 미션이 끝나는지,
 * 중간에 켜도 이미 한 일은 건너뛰고 이어서 끝나는지 */
process.noDeprecation = true;
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());
const { planOf, skipDone, doneLive, doneNow, finishSteps, guideText } = await server.ssrLoadModule('/src/game/v2/storyGuide.js');
const { ctlKeysOf } = await server.ssrLoadModule('/src/game/v2/practiceTarget.js');
const { buildRuntime, computeSim, checkObjective } = await server.ssrLoadModule('/src/game/sim.js');
const { applyOp, noteOnAirMove, notePop, latchTalk } = await server.ssrLoadModule('/src/game/ops.js');
const { SOLUTIONS } = await server.ssrLoadModule('/src/game/data/solutions.js');

const STORY = JSON.parse(readFileSync(new URL('../src/game/data/story.json', import.meta.url)));
const stages = STORY.chapters.flatMap((c) => c.stages).map((s) => ({ ...s, solution: SOLUTIONS[s.id] }));

// 플레이어가 한 단계를 하는 것처럼 (게임의 기록 규칙 그대로: 방송 중 PTZ 움직임 · 퍽 · 페이드 · 말하기)
function player(spec) {
  let st = buildRuntime(spec);
  const latched = new Set();
  let talking = false;
  const ctx = () => ({ nominal: computeSim(st, { talking: true, performing: true }), latched, talking });
  const act = (op) => {
    if (op.op === 'talk') talking = !!op.on;
    else {
      noteOnAirMove(st, op, latched);
      notePop(st, op, latched);
      if (op.op === 'fade') {
        const k = op.ch ? `ch${op.ch}` : 'main';
        const from = op.ch ? st.channels[op.ch - 1]?.fader : st.master.mainFader;
        if (from >= 35 && op.to <= 3) { latched.add(`fadeOut:${k}`); latched.delete(`cutOut:${k}`); }
        if (from <= 3 && op.to >= 50) latched.add(`fadeIn:${k}`);
      }
      const next = applyOp(st, op);
      assert.ok(!next.lastError, `${spec.id}: ${JSON.stringify(op)} → ${next.lastError?.reason}`);
      st = next;
    }
    latchTalk(st, talking, latched, true);
  };
  const cleared = () => {
    const sim = computeSim(st, { talking: true, performing: true });
    return spec.objectives.filter((o) => !checkObjective(o.check, st, sim, { latched: [...latched] })).map((o) => o.label);
  };
  return { act, ctx, cleared, get st() { return st; } };
}

// 길잡이를 따라간다: 짚은 단계를 하면 그 단계가 끝난 것으로 보여야 하고, 끝까지 가면 미션 완료
function followGuide(spec, plan, p) {
  let k = skipDone(plan, 0, p.st, p.ctx());
  const seen = [];
  for (let guard = 0; k < plan.length && guard < 300; guard += 1) {
    const before = p.st;
    seen.push(plan[k].i);
    p.act(plan[k].op);
    assert.ok(doneLive(plan, k, p.st, before, p.ctx()), `${spec.id}: solution step ${plan[k].i} (${plan[k].op.op}) not counted as done after doing it`);
    k = skipDone(plan, k + 1, p.st, p.ctx());
  }
  return seen;
}

for (const spec of stages) {
  test(`story guide ${spec.id}: following the guide from the start clears the mission`, () => {
    const plan = planOf(spec);
    assert.ok(plan.length > 0, 'plan');
    const p = player(spec);
    followGuide(spec, plan, p);
    assert.deepEqual(p.cleared(), [], 'objectives left');
  });

  test(`story guide ${spec.id}: switched on midway, it skips what is done and still clears`, () => {
    const plan = planOf(spec);
    for (let m = 1; m < plan.length; m += 1) {
      const p = player(spec);
      plan.slice(0, m).forEach((x) => p.act(x.op));
      const seen = followGuide(spec, plan, p);
      assert.deepEqual(p.cleared(), [], `after ${m} steps done by hand: objectives left`);
      // 이미 한 단계를 다시 시키지 않는다 (뒤 단계가 앞의 결과를 쓰는 조명·PTZ·ATEM 예외는 계획이 처리)
      assert.ok(seen.every((i) => i >= plan[0].i), 'sane order');
    }
  });

  test(`story guide ${spec.id}: every guided step names something to flash`, () => {
    const plan = planOf(spec);
    let st = buildRuntime(spec);
    const bad = [];
    for (const x of plan) {
      if (x.op.op !== 'connect' && x.op.op !== 'talk' && !ctlKeysOf(x.op, st).length) bad.push(`${x.i} ${x.op.op}`);
      if (x.op.op !== 'talk') { const n = applyOp(st, x.op); if (!n.lastError) st = n; }
    }
    assert.deepEqual(bad, []);
  });
}

test('story guide waits for values close enough for the mission goal, not just the tutorial tolerance', () => {
  const spec = stages.find((s) => s.id === 'seminar-2');
  const plan = planOf(spec);
  const k = plan.findIndex((x) => x.op.op === 'ch' && x.op.key === 'gain' && x.op.value === 0);
  assert.ok(k >= 0);
  const p = player(spec);
  p.act({ op: 'ch', ch: plan[k].op.ch, key: 'gain', value: 5 });
  assert.equal(doneNow(plan, k, p.st, p.ctx()), false, 'gain 5 is not close enough to 0 for the level goal');
  p.act({ op: 'ch', ch: plan[k].op.ch, key: 'gain', value: 1 });
  assert.equal(doneNow(plan, k, p.st, p.ctx()), true);
});

test('story guide finish steps: a pop from powering the speaker too early is fixed by switching it off and on last', () => {
  const withPop = stages.filter((s) => s.objectives.some((o) => o.check.type === 'noPop'));
  assert.ok(withPop.length > 0, 'some missions check for pops');
  let checked = 0;
  for (const spec of withPop) {
    const dev = spec.objectives.find((o) => o.check.type === 'noPop').check.device;
    const plan = planOf(spec);
    const pk = plan.findIndex((x) => x.op.op === 'dev' && x.op.device === dev && x.op.key === 'power' && x.op.value === true);
    if (pk < 0) continue;
    const p = player(spec);
    // 실수: 스피커(앰프) 전원부터 켜고 나서 케이블을 꽂는다
    p.act(plan[pk].op);
    plan.forEach((x, k) => { if (k !== pk) p.act(x.op); });
    const left = p.cleared();
    if (!left.length) continue; // 이 미션은 그 순서로도 퍽이 안 난다
    const unmet = spec.objectives.filter((o) => left.includes(o.label));
    const extra = finishSteps(unmet);
    assert.ok(extra.length > 0, `${spec.id}: no finish steps for ${left.join(', ')}`);
    extra.forEach((x) => p.act(x.op));
    assert.deepEqual(p.cleared(), [], `${spec.id}: still not cleared after the finish steps`);
    checked += 1;
  }
  assert.ok(checked >= 1, 'at least one pop scenario was exercised');
});

test('story guide text names the target value and reads naturally', () => {
  const st = { devices: { p2: { name: '앞 조명 R' } } };
  assert.equal(guideText({ op: 'ch', ch: 2, key: 'gain', value: 0 }, st), '믹서 콘솔 CH2 GAIN 값을 0에 맞추세요.');
  assert.equal(guideText({ op: 'dev', device: 'p2', key: 'address', value: 9 }, st), '앞 조명 R의 DMX 주소를 009로 맞추세요.');
  assert.equal(guideText({ op: 'dev', device: 'p2', key: 'address', value: 30 }, st), '앞 조명 R의 DMX 주소를 030으로 맞추세요.');
  // 정답 계획의 모든 단계가 빈 말 없이 설명된다
  for (const spec of stages) for (const x of planOf(spec)) assert.ok(!/undefined|null/.test(guideText(x.op, buildRuntime(spec))), `${spec.id} ${x.i}`);
});
