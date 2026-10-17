import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { buildRuntime, computeSim } from '../src/game/sim.js';
import { applyOp } from '../src/game/ops.js';
import { TUTORIAL } from '../src/game/data/tutorial.js';
import { connectGuide } from '../src/game/v2/connectGuide.js';
import { DEVICE_TYPES } from '../src/game/engine.js';

/* 튜토리얼 "직접 해 보기" 검사 — 안내(케이블 → 첫 단자 → 둘째 단자)와 연습 판정(tol · until)이 대본과 맞는지 */
process.noDeprecation = true;
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());
const { opSatisfied } = await server.ssrLoadModule('/src/game/v2/useGame.js');

// 대본을 i번째 단계 직전까지 실행한 상태 (유령 손이 하는 것과 같은 순서로)
const STEP_OPS = new Set(['place', 'connect', 'disconnect', 'ch', 'master', 'dev', 'atem', 'obs', 'move', 'ptz']);
const stateBefore = (part, i) => {
  let st = buildRuntime(part);
  for (let k = 0; k < i; k += 1) {
    const s = part.steps[k];
    if (s.op === 'fade') st = applyOp(st, s.ch ? { op: 'ch', ch: s.ch, key: 'fader', value: s.to } : { op: 'master', key: 'mainFader', value: s.to });
    else if (STEP_OPS.has(s.op)) { const n = applyOp(st, s); if (!n.lastError) st = n; }
  }
  return st;
};
const talkBefore = (part, i) => !!part.steps.slice(0, i).reverse().find((s) => s.op === 'talk')?.on;

test('every cable practice step has a guide: both devices placed, real port labels, cable in the bag', () => {
  const bad = [];
  TUTORIAL.forEach((part) => part.steps.forEach((s, i) => {
    if (s.op !== 'connect' || !s.practice) return;
    const st = stateBefore(part, i);
    const g = connectGuide(s, st, null, null);
    if (!g) { bad.push(`${part.id}#${i} no guide (device not placed?)`); return; }
    if (g.stage !== 'cable' || g.steps.length !== 3) bad.push(`${part.id}#${i} stage ${g.steps.length}`);
    if (!st.unlimited && !(st.cables[s.cable] > 0)) bad.push(`${part.id}#${i} no ${s.cable} cable in the bag`);
    if (g.steps.some((x) => /undefined/.test(x.text))) bad.push(`${part.id}#${i} label ${g.steps.map((x) => x.text).join(' / ')}`);
    // 두 끝 모두 그 장비에 실제로 있는 단자여야 한다 (없으면 이름표 대신 내부 id가 보인다)
    [s.from, s.to].forEach((e) => {
      const [d, p] = e.split('.');
      const def = DEVICE_TYPES[st.devices[d]?.type];
      if (!def || ![...def.ins, ...def.outs].some((x) => x.id === p)) bad.push(`${part.id}#${i} unknown port ${e}`);
    });
  }));
  assert.deepEqual(bad, []);
});

test('connect guide walks cable → first jack → second jack, from either end, and flags a wrong first jack', () => {
  const part = TUTORIAL.find((p) => p.id === 'tut-sound');
  const i = part.steps.findIndex((s) => s.op === 'connect' && s.practice);
  const s = part.steps[i];
  const st = stateBefore(part, i);
  const [fd, fp] = s.from.split('.');
  const [td, tp] = s.to.split('.');
  assert.equal(connectGuide(s, st, null, null).stage, 'cable');
  const g1 = connectGuide(s, st, s.cable, null);
  assert.equal(g1.stage, 'first');
  assert.deepEqual(g1.target, { d: fd, p: fp });
  const g2 = connectGuide(s, st, s.cable, { d: fd, p: fp });
  assert.equal(g2.stage, 'second');
  assert.deepEqual(g2.target, { d: td, p: tp });
  // 반대쪽 끝부터 눌러도 된다
  const g3 = connectGuide(s, st, s.cable, { d: td, p: tp });
  assert.deepEqual(g3.target, { d: fd, p: fp });
  // 엉뚱한 단자를 먼저 골랐으면 풀어 주라고 알린다
  assert.equal(connectGuide(s, st, s.cable, { d: td, p: 'line2' }).wrongPending, true);
  // 케이블 잇기가 아니면 안내 없음
  assert.equal(connectGuide({ op: 'ch', ch: 1, key: 'gain', value: 30 }, st, null, null), null);
});

test('practice tolerance: per-step tol overrides the knob default', () => {
  const st = buildRuntime(TUTORIAL[0]);
  const ch = (v) => ({ ...st, channels: st.channels.map((c, k) => (k === 0 ? { ...c, gain: v } : c)) });
  assert.equal(opSatisfied(ch(35), { op: 'ch', ch: 1, key: 'gain', value: 30 }, null), true); // 기본 ±6
  assert.equal(opSatisfied(ch(35), { op: 'ch', ch: 1, key: 'gain', value: 30, tol: 1 }, null), false);
  assert.equal(opSatisfied(ch(31), { op: 'ch', ch: 1, key: 'gain', value: 30, tol: 1 }, null), true);
});

test("until:'noFeedback' practice steps only pass once the howl has stopped, and the scripted value stops it", () => {
  const checked = [];
  TUTORIAL.forEach((part) => part.steps.forEach((s, i) => {
    if (s.until !== 'noFeedback') return;
    const before = stateBefore(part, i);
    const talking = talkBefore(part, i) || true;
    // 대본 값대로 하면 하울링이 멎어야 한다 (연습을 통과할 수 있어야 한다)
    const after = applyOp(before, s);
    const nominal = computeSim(after, { talking, performing: true });
    assert.equal(nominal.feedback || nominal.ringing, false, `${part.id}#${i} still howls with the scripted value`);
    assert.equal(opSatisfied(after, s, { nominal }), true, `${part.id}#${i}`);
    // 하울링이 남아 있으면 값이 맞아도 통과시키지 않는다
    assert.equal(opSatisfied(after, s, { nominal: { feedback: true } }), false, `${part.id}#${i}`);
    checked.push(`${part.id}#${i}`);
  }));
  assert.ok(checked.length >= 1, 'at least one noFeedback step exists');
});

test('quiz steps have a valid answer and no op (they wait for the player)', () => {
  const bad = [];
  TUTORIAL.forEach((part) => part.steps.forEach((s, i) => {
    if (!s.quiz) return;
    const { options, answer, q, explain } = s.quiz;
    if (!q || !explain || !Array.isArray(options) || options.length < 2 || !(answer >= 0 && answer < options.length)) bad.push(`${part.id}#${i}`);
    if (s.op || s.practice) bad.push(`${part.id}#${i} has an op`);
  }));
  assert.deepEqual(bad, []);
});
