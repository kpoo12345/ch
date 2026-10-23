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
const { opSatisfied, waitingFor } = await server.ssrLoadModule('/src/game/v2/useGame.js');

// 대본을 i번째 단계 직전까지 실행한 상태 (유령 손이 하는 것과 같은 순서로)
const STEP_OPS = new Set(['place', 'connect', 'disconnect', 'ch', 'master', 'dev', 'atem', 'obs', 'move', 'ptz', 'lightRecord', 'patchAdd', 'patchRemove']);
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

test('every non-cable practice step names a control to flash, inside a panel that is open-able', async () => {
  const { ctlKeysOf, panelDeviceOf } = await import('../src/game/v2/practiceTarget.js');
  const bad = [];
  TUTORIAL.forEach((part) => part.steps.forEach((s, i) => {
    if (!s.practice || s.op === 'connect') return;
    const st = stateBefore(part, i);
    const keys = ctlKeysOf(s, st);
    if (!keys.length || keys.some((k) => /undefined|null/.test(k))) bad.push(`${part.id}#${i} ${s.op} keys ${keys.join(',')}`);
    if (['ch', 'master', 'fade', 'place'].includes(s.op)) return; // 믹서 콘솔 · 미션 탭
    const pd = panelDeviceOf(s, st);
    if (!pd || !st.devices[pd]?.placed) bad.push(`${part.id}#${i} ${s.op} panel ${pd} not placed`);
  }));
  assert.deepEqual(bad, []);
});

test('findPracticeTarget: most specific name first, and an already-armed STORE moves on to the preset slot', async () => {
  const { findPracticeTarget } = await import('../src/game/v2/practiceTarget.js');
  const dom = (attrs) => ({ querySelector: (sel) => { const k = sel.match(/data-ctl="(.*)"\]$/)[1]; return attrs[k] ? { getAttribute: (a) => attrs[k][a] ?? null } : null; } });
  const st = { devices: { joy: { id: 'joy', type: 'ptz_controller', placed: true } }, dev: {} };
  const store = { op: 'ptz', device: 'joy', act: 'store', value: 2 };
  assert.equal(findPracticeTarget(store, st, dom({ 'joy-ptz-store': {}, 'joy-ptz-preset-2': {} })).key, 'joy-ptz-store');
  assert.equal(findPracticeTarget(store, st, dom({ 'joy-ptz-store': { 'aria-pressed': 'true' }, 'joy-ptz-preset-2': {} })).key, 'joy-ptz-preset-2');
  // 조명 콘솔: 프로그래머 탭이 닫혀 있으면 탭 단추부터
  const lc = { devices: { lc: { id: 'lc', type: 'lighting_console', placed: true } }, dev: { lc: { programmer: { sel: [] } } } };
  const color = { op: 'dev', device: 'lc', key: 'programmer.color', value: 'red' };
  assert.equal(findPracticeTarget(color, lc, dom({ 'lc-tab-prog': {} })).key, 'lc-tab-prog');
  assert.equal(findPracticeTarget(color, lc, dom({ 'lc-tab-prog': {}, 'lc-programmer.color-red': {} })).key, 'lc-programmer.color-red');
  assert.equal(findPracticeTarget(color, lc, dom({})), null);
});

// 패널을 실제로 그려 보고 (서버 렌더) 연습이 짚을 이름이 그 안에 있는지
test('the control each practice step flashes is really rendered in the panel that step opens', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ctlKeysOf, panelDeviceOf } = await import('../src/game/v2/practiceTarget.js');
  const { DevicePanel } = await server.ssrLoadModule('/src/game/v2/DevicePanels.jsx');
  const { default: Console } = await server.ssrLoadModule('/src/game/v2/Console.jsx');
  const noop = () => {};
  const bad = [];
  let checked = 0;
  TUTORIAL.forEach((part) => part.steps.forEach((s, i) => {
    if (!s.practice || s.op === 'connect' || s.op === 'place') return;
    const st = stateBefore(part, i);
    const sim = computeSim(st, { talking: true, performing: true });
    const game = { st, stRef: { current: st }, nominal: sim, actual: sim, apply: noop, show: noop, disconnect: noop, selCh: 0, setSelCh: noop };
    const mixer = ['ch', 'master', 'fade'].includes(s.op);
    const html = mixer
      ? renderToStaticMarkup(React.createElement(Console, { game }))
      : renderToStaticMarkup(React.createElement(DevicePanel, { game, id: panelDeviceOf(s, st) }));
    const has = (k) => html.includes(`data-ctl="${k.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/>/g, '&gt;')}"`);
    const keys = ctlKeysOf(waitingFor(s, i), st);
    // 조명 콘솔은 다른 탭이 열려 있을 수 있다: 그 탭 단추가 있으면 된다
    const tab = keys.find((k) => /-tab-/.test(k));
    // +/− 단추 이름은 Stepper일 때만 있다 → 그 다음 이름이 있으면 된다. 채널 줄·MASTER 통째 반짝임은 인정하지 않는다
    const named = keys.filter((k) => !/^(master|ch\d+)$/.test(k));
    const first = named.find((k) => !/-(inc|dec)$/.test(k));
    if (!has(first) && !named.some((k) => /-(inc|dec)$/.test(k) && has(k)) && !(tab && has(tab))) bad.push(`${part.id}#${i} ${first} (${s.practice})`);
    checked += 1;
  }));
  assert.ok(checked >= 40, `checked ${checked}`);
  assert.deepEqual(bad, []);
});

// 연습 판정: 하기 전엔 통과가 아니고, 대본대로 하면 통과 (판정이 없는 동작은 저절로 넘어가 버린다)
test('every practice step is not yet passed before the player acts, and passes once they do it', () => {
  const bad = [];
  TUTORIAL.forEach((part) => part.steps.forEach((s, i) => {
    if (!s.practice || s.op === 'fade') return; // fade는 실제 손 동작(래치)으로만 판정한다
    const before = stateBefore(part, i);
    const ctx = (x) => ({ nominal: computeSim(x, { talking: true, performing: true }), latched: new Set(), talking: true });
    // 게임이 기다릴 때 쓰는 것과 똑같은 모양으로 (단계 필드를 덮어쓰면 여기서 걸린다)
    const w = waitingFor(s, i);
    if (opSatisfied(before, w, ctx(before), before)) bad.push(`${part.id}#${i} ${s.op} already passes before acting`);
    const after = applyOp(before, s);
    if (after.lastError) bad.push(`${part.id}#${i} ${s.op} scripted op fails: ${after.lastError}`);
    else if (!opSatisfied(after, w, ctx(after), before)) bad.push(`${part.id}#${i} ${s.op} does not pass after the scripted op`);
  }));
  assert.deepEqual(bad, []);
});

test('the waiting step keeps the step own fields (a cue saved to playback 2 still says playback 2)', async () => {
  const { ctlKeysOf } = await import('../src/game/v2/practiceTarget.js');
  const step = { op: 'lightRecord', device: 'desk', index: 2, practice: 'x' };
  const w = waitingFor(step, 25);
  assert.equal(w.index, 2);
  assert.equal(w.at, 25);
  assert.deepEqual(ctlKeysOf(w, {}).slice(0, 2), ['desk-record', 'desk-pbsel-2']);
});

test('practiceTarget FOOTPRINT matches the sim', async () => {
  const { FOOTPRINT } = await import('../src/game/v2/practiceTarget.js');
  const sim = await import('../src/game/sim.js');
  assert.deepEqual(FOOTPRINT, sim.FOOTPRINT);
});

// 파트 8 조명 이야기: 주소를 고치면 꺼지고, 패치해도 옛 큐엔 없어서 꺼져 있고, 새 큐를 올리면 둘 다 파랗게
test('tut-show lighting story: R goes dark, stays dark after patching, and joins the new cue', () => {
  const part = TUTORIAL.find((p) => p.id === 'tut-show');
  const at = (pred) => part.steps.findIndex(pred);
  const light = (i) => computeSim(stateBefore(part, i)).light.fixtures;
  const iAddr = at((s) => s.op === 'dev' && s.key === 'address');
  const iPatch = at((s) => s.op === 'patchAdd');
  const iClear = at((s) => s.op === 'dev' && s.key === 'programmer');
  const iUp = at((s) => s.op === 'dev' && s.key === 'playbacks.1.level');
  assert.ok(iAddr > 0 && iPatch > iAddr && iClear > iPatch && iUp > iClear);
  assert.equal(light(iAddr).p2.wrong, true, 'R reads L channels at 005');
  assert.equal(light(iPatch).p2.intensity, 0, 'R is dark at 009 before the patch');
  assert.equal(light(iPatch + 1).p2.intensity, 0, 'R stays dark in the old sermon cue after patching');
  const end = light(iUp + 1);
  for (const f of ['p1', 'p2']) {
    assert.ok(end[f].intensity >= 0.9, `${f} lit by the new cue`);
    assert.equal(end[f].color.toLowerCase(), '#2563eb', `${f} blue`);
  }
  // CLEAR 뒤엔 프로그래머가 비어 있다 (안 비우면 프로그래머 값이 먼저)
  assert.deepEqual(stateBefore(part, iClear + 1).dev.desk.programmer.sel, []);
});

test('record step: an emptied programmer points back to select → brightness → colour before RECORD', async () => {
  const { ctlKeysOf, programmerMiss } = await import('../src/game/v2/practiceTarget.js');
  const step = TUTORIAL.find((p) => p.id === 'tut-show').steps.find((s) => s.op === 'lightRecord');
  const st = (pr) => ({ devices: { desk: { type: 'lighting_console' } }, dev: { desk: { programmer: { sel: [], intensity: null, color: null, ...pr } } } });
  assert.equal(programmerMiss(step, st({})), 'sel');
  assert.equal(ctlKeysOf(step, st({}))[0], 'desk-programmer.sel-1');
  assert.equal(programmerMiss(step, st({ sel: [1, 2] })), 'intensity');
  assert.equal(ctlKeysOf(step, st({ sel: [1, 2] }))[0], 'desk-programmer.intensity');
  assert.equal(programmerMiss(step, st({ sel: [1, 2], intensity: 100 })), 'color');
  assert.equal(programmerMiss(step, st({ sel: [1, 2], intensity: 100, color: '#2563eb' })), null);
  assert.equal(ctlKeysOf(step, st({ sel: [1, 2], intensity: 100, color: '#2563eb' }))[0], 'desk-record');
  assert.ok(step.redo, 'the step explains what to redo');
});
