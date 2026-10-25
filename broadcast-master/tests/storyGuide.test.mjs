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
const { planOf, skipDone, doneLive, doneNow, finishSteps, guideText, advanceGuide, unblockStep } = await server.ssrLoadModule('/src/game/v2/storyGuide.js');
const { ctlKeysOf } = await server.ssrLoadModule('/src/game/v2/practiceTarget.js');
const { buildRuntime, computeSim, checkObjective } = await server.ssrLoadModule('/src/game/sim.js');
const { applyOp, noteOnAirMove, notePop, noteOffAir, latchTalk } = await server.ssrLoadModule('/src/game/ops.js');
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
      noteOffAir(st, op, next, latched);
      st = next;
    }
    latchTalk(st, talking, latched, true);
  };
  const cleared = () => {
    const sim = computeSim(st, { talking: true, performing: true });
    return spec.objectives.filter((o) => !checkObjective(o.check, st, sim, { latched: [...latched] })).map((o) => o.label);
  };
  return { act, ctx, cleared, latched, get st() { return st; } };
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
  assert.equal(guideText({ op: 'ch', ch: 2, key: 'gain', value: 0 }, st), '믹서 콘솔 CH2 GAIN을 +0 dB에 맞추세요.');
  // 페이더는 화면에 보이는 눈금(dB)으로 말한다: 75 = 0 dB, 0 = 맨 아래
  assert.equal(guideText({ op: 'master', key: 'mainFader', value: 75 }, st), '믹서 콘솔 STEREO(메인) 페이더를 0 눈금(0 dB)에 맞추세요.');
  assert.equal(guideText({ op: 'ch', ch: 3, key: 'fader', value: 60 }, st), '믹서 콘솔 CH3 페이더를 -12 dB에 맞추세요.');
  assert.match(guideText({ op: 'fade', ch: 9, to: 0 }, st), /CH9 페이더를 2~3초에 걸쳐 천천히 맨 아래\(-∞\)까지/);
  // 을/를은 끝소리로: CH1을 · CH2를 · CAM 4를 · CAM 3을
  assert.equal(guideText({ op: 'ch', ch: 1, key: 'mute', value: false }, st), '믹서 콘솔 CH1을 켜세요 (ON).');
  assert.equal(guideText({ op: 'ch', ch: 2, key: 'mute', value: true }, st), '믹서 콘솔 CH2를 끄세요 (MUTE).');
  assert.match(guideText({ op: 'ptz', device: 'joy', act: 'select', value: 3 }, st), /CAM 4를 고르세요/);
  assert.match(guideText({ op: 'ptz', device: 'joy', act: 'select', value: 2 }, st), /CAM 3을 고르세요/);
  assert.equal(guideText({ op: 'move', device: 'pa' }, { devices: { pa: { name: '액티브 스피커 (강연자 바로 앞)' } } }), '액티브 스피커 (강연자 바로 앞)를 반짝이는 자리로 옮기세요.');
  assert.equal(guideText({ op: 'dev', device: 'p2', key: 'address', value: 9 }, st), '앞 조명 R의 DMX 주소를 009로 맞추세요.');
  assert.equal(guideText({ op: 'dev', device: 'p2', key: 'address', value: 30 }, st), '앞 조명 R의 DMX 주소를 030으로 맞추세요.');
  // 정답 계획의 모든 단계가 빈 말 없이 설명된다
  // 그리고 "반짝이는 곳을 맞추세요" 같은 막연한 말 없이 무엇을 어떻게 할지 이름으로 말한다
  for (const spec of stages) {
    for (const x of planOf(spec)) {
      const t = guideText(x.op, buildRuntime(spec));
      assert.ok(!/undefined|null|NaN/.test(t), `${spec.id} ${x.i}: ${t}`);
      assert.ok(!/반짝이는 (곳을|값을|단추를) 맞추세요|반짝이는 단추를 (켜|끄)세요/.test(t), `${spec.id} ${x.i} is vague: ${t}`);
    }
  }
});

// 플레이어는 정답 값을 정확히 맞추지 않는다: 길잡이가 넘어가는 범위(손잡이 ±2, 페이더 ±3) 안에서
// 값들이 한꺼번에 조금씩 어긋나도 미션이 끝나야 한다 (정답 값이 목표의 경계에 붙어 있으면 여기서 걸린다)
test('story solutions survive every numeric value being off by the guide tolerance at once', () => {
  const TOL = { fader: 3, mainFader: 3, lowCutFreq: 10 };
  const RANGE = { gain: [0, 60], pan: [-100, 100], eqHigh: [-15, 15], eqMid: [-15, 15], eqLow: [-15, 15], lowCutFreq: [20, 400] };
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const bad = [];
  for (const spec of stages) {
    const sol = spec.solution.filter((s) => s.op);
    const num = sol.map((s, i) => [s, i]).filter(([s]) => ['ch', 'master', 'dev'].includes(s.op) && typeof s.value === 'number' && !/address|channel|preset|ip|index/i.test(s.key));
    if (!num.length) continue;
    const combos = [num.map(() => -1), num.map(() => 1), num.map((_, k) => (k % 2 ? 1 : -1)), num.map((_, k) => (k % 2 ? -1 : 1))];
    for (let r = 0; r < 12; r += 1) combos.push(num.map(() => Math.round(rnd() * 2) - 1));
    for (const c of combos) {
      const p = player(spec);
      sol.forEach((s, j) => {
        const k = num.findIndex(([, i]) => i === j);
        if (k < 0) { if (s.op !== 'wait' && s.op !== 'say' && s.op !== 'perform') p.act(s); return; }
        const [lo, hi] = RANGE[s.key] ?? [0, 100];
        p.act({ ...s, value: Math.max(lo, Math.min(hi, s.value + c[k] * (TOL[s.key] ?? 2))) });
      });
      const left = p.cleared();
      if (left.length) { bad.push(`${spec.id}: ${left.join(', ')}`); break; }
    }
  }
  assert.deepEqual(bad, []);
});

// 게임 화면과 똑같이 길잡이를 돌린다 (advanceGuide를 상태가 바뀔 때마다), 플레이어는 짚어 준 것만 한다
const unmetOf = (spec, p) => {
  const sim = computeSim(p.st, { talking: true, performing: true });
  return spec.objectives.filter((o) => !checkObjective(o.check, p.st, sim, { latched: [...p.latched] }));
};
function runGuide(spec, p, { act, limit = 200 } = {}) {
  const plan = planOf(spec);
  let g = { phase: 'plan', list: plan, cur: skipDone(plan, 0, p.st, p.ctx()) };
  let before = p.st;
  const notes = [];
  const doIt = act ?? ((x) => {
    // 페이더가 이미 목표 자리면 카드 말대로 반대쪽 끝에 둔 다음 페이드
    if (x.op.op === 'fade') {
      const now = x.op.ch ? p.st.channels[x.op.ch - 1].fader : p.st.master.mainFader;
      if (Math.abs(now - x.op.to) <= 3) p.act(x.op.ch ? { op: 'ch', ch: x.op.ch, key: 'fader', value: x.op.to <= 3 ? 75 : 0 } : { op: 'master', key: 'mainFader', value: x.op.to <= 3 ? 75 : 0 });
    }
    p.act(x.op);
  });
  for (let n = 0; n < limit; n += 1) {
    for (let s = 0; s < 30; s += 1) {
      const r = advanceGuide(g, { plan, st: p.st, before, game: p.ctx(), unmet: unmetOf(spec, p) });
      if (!r) break;
      notes.push(r.note);
      g = { phase: r.phase, list: r.phase === 'plan' ? plan : r.list, cur: r.cur };
      before = p.st;
    }
    if (!unmetOf(spec, p).length) return { cleared: true, notes, g };
    const item = g.list[g.cur];
    if (!item) return { cleared: false, left: unmetOf(spec, p).map((o) => o.check.type), notes, g };
    doIt(item, g);
  }
  return { cleared: false, timeout: true, notes, g };
}

test('story guide state machine clears every mission from the start', () => {
  const bad = [];
  for (const spec of stages) {
    const p = player(spec);
    const r = runGuide(spec, p);
    if (!r.cleared) bad.push(`${spec.id}: ${r.timeout ? 'loops' : `left ${r.left}`}`);
  }
  assert.deepEqual(bad, []);
});

test('ptz-2: moving the on-air PTZ first ends on the remaining-goals card instead of looping', () => {
  const spec = stages.find((s) => s.id === 'ptz-2');
  const p = player(spec);
  const plan = planOf(spec);
  const recall = plan.find((x) => x.op.op === 'ptz' && x.op.act === 'recall');
  p.act(plan.find((x) => x.op.op === 'ptz' && x.op.act === 'select').op);
  p.act(recall.op); // 방송 중에 움직여 버렸다
  const r = runGuide(spec, p);
  assert.equal(r.cleared, false);
  assert.ok(!r.timeout, 'the guide must not loop');
  // 남은 단계(CUT · "한 번도 못 봤죠")를 따라가지 않고 곧바로 다시 하기 카드로
  assert.deepEqual(r.notes, ['left']);
  assert.ok(r.left.includes('noOnAirMove'), `left ${r.left}`);
});

test('ptz-2: "back on PGM" is not ticked at the start; it needs the PTZ cut away and back', () => {
  const spec = stages.find((s) => s.id === 'ptz-2');
  const p = player(spec);
  assert.ok(p.cleared().some((l) => /다시 PGM/.test(l)), 'not ticked at the start');
  const plan = planOf(spec);
  for (const x of plan) p.act(x.op);
  assert.deepEqual(p.cleared(), [], 'the solution ticks everything');
});

test('ptz-2: cutting back early makes the guide return to the CUT before moving the PTZ', () => {
  const spec = stages.find((s) => s.id === 'ptz-2');
  const p = player(spec);
  let cutBack = false;
  const r = runGuide(spec, p, {
    act: (x, g) => {
      // PTZ를 움직이라고 짚은 첫 순간, 플레이어가 먼저 CUT으로 PTZ를 방송에 되돌려 놓는다
      if (!cutBack && x.op.op === 'ptz' && x.op.act === 'recall') { cutBack = true; p.act({ op: 'atem', key: 'cut' }); return; }
      p.act(x.op);
    },
  });
  assert.ok(cutBack);
  assert.ok(r.notes.includes('back-air'), `notes ${r.notes}`);
  assert.equal(r.cleared, true, 'after going back to the CUT the mission still clears');
});

test('light-3: a mic (XLR) cable on the DMX jacks does not count, and the guide does not loop', () => {
  const spec = stages.find((s) => s.id === 'light-3');
  const plan = planOf(spec);
  const k = plan.findIndex((x) => x.op.op === 'connect' && x.op.cable === 'dmx');
  assert.ok(k > 0);
  const p = player(spec);
  for (let j = 0; j < k; j += 1) p.act(plan[j].op);
  p.act({ ...plan[k].op, cable: 'xlr' });
  assert.equal(doneLive(plan, k, p.st, null, p.ctx()), false, 'XLR on DMX jacks is not the DMX step');
  const r = runGuide(spec, p);
  assert.ok(!r.timeout, 'no loop');
});

test('seminar-4: a fader yanked to 0 first is rescued by raising it and fading slowly', () => {
  const spec = stages.find((s) => s.id === 'seminar-4');
  const plan = planOf(spec);
  const fade = plan.find((x) => x.op.op === 'fade' && x.op.to <= 3);
  assert.ok(fade, 'seminar-4 has a fade-out');
  const p = player(spec);
  p.act({ op: 'ch', ch: fade.op.ch, key: 'fader', value: 0 }); // 뚝 내려 버렸다
  assert.match(guideText(fade.op, p.st), /먼저 0 눈금\(0 dB\)까지 올린 다음/);
  const r = runGuide(spec, p);
  assert.equal(r.cleared, true, `left ${r.left}`);
});

// 초보자가 엉뚱한 케이블을 먼저 꽂아 둔 자리: 길잡이는 그 케이블 빼기부터 짚고, 빼고 나면 원래 연결로 돌아온다
test('story guide unplugs a wrong cable that blocks the port it wants, then connects', () => {
  const spec = stages.find((s) => s.id === 'seminar-1');
  const plan = planOf(spec);
  const p = player(spec);
  // 놓기·마이크 연결까지 길잡이대로
  let k = skipDone(plan, 0, p.st, p.ctx());
  while (plan[k].op.op !== 'connect' || !/\.in$/.test(plan[k].op.to)) { p.act(plan[k].op); k = skipDone(plan, k + 1, p.st, p.ctx()); }
  const want = plan[k].op;
  assert.equal(unblockStep(want, p.st), null, 'nothing blocks yet');
  // 실수: AUX SEND 1을 스피커 INPUT에 (6.3mm)
  const mixer = want.from.split('.')[0];
  p.act({ op: 'connect', from: `${mixer}.aux1`, to: want.to, cable: 'trs' });
  const un = unblockStep(want, p.st);
  assert.ok(un && un.op === 'disconnect' && un.blocker, 'the wrong cable is pointed at');
  assert.match(guideText(un, p.st), /다른 케이블\(.*AUX SEND 1.*→.*INPUT\)이 있어요/);
  assert.ok(ctlKeysOf(un, p.st).length > 0, 'its unplug button can be flashed');
  p.act(un);
  assert.equal(unblockStep(want, p.st), null, 'unblocked');
  // 그다음은 원래 단계 그대로 따라가서 끝난다
  followGuide(spec, plan, p);
  assert.deepEqual(p.cleared(), [], 'objectives left');
});

test('story guide treats a mic cable in a DMX step as blocking until it is swapped', () => {
  const spec = stages.find((s) => s.id === 'light-1');
  const plan = planOf(spec);
  const want = plan.find((x) => x.op.op === 'connect' && x.op.cable === 'dmx').op;
  const p = player(spec);
  p.act({ ...want, cable: 'xlr' });
  const un = unblockStep(want, p.st);
  assert.ok(un?.blocker, 'the XLR cable in the DMX port has to come out first');
  p.act(un);
  p.act(want);
  assert.equal(unblockStep(want, p.st), null);
});
