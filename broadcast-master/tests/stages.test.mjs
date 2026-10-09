import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEVICE_TYPES, CABLES } from '../src/game/engine.js';
import { buildRuntime, computeSim, canConnect, checkObjective } from '../src/game/sim.js';
import { VENUES } from '../src/game/venues.js';
import { runOps } from '../src/game/ops.js';

const STORY = JSON.parse(readFileSync(new URL('../src/game/data/story.json', import.meta.url)));
const { SOLUTIONS } = await import('../src/game/data/solutions.js');
const OBJ = ['placed', 'connected', 'reaches', 'absent', 'gainOk', 'noClip', 'noFeedback', 'noHum', 'lowCut', 'fx', 'eq', 'power', 'wireless', 'cleanHdmi', 'program', 'live', 'recording', 'pip', 'talkTest', 'faultsFixed', 'onChannel', 'noPop', 'fade', 'noCut', 'chValue',
  'lit', 'dark', 'stageLit', 'dmxOk', 'fixtureColor', 'patched', 'playback', 'recorded', 'display', 'noScaling', 'ptzControl', 'ptzFrames', 'ptzPreset', 'noOnAirMove'];
const FAULTS = ['unplug', 'mute', 'faderDown', 'mainMute', 'phantomOff', 'patchWrong', 'usbRoute', 'obsMute', 'obsAudioNone', 'speakerOff', 'wirelessChannel', 'wirelessBattery', 'groundLoop', 'auxZero', 'atemBlack', 'cleanHdmiOff', 'gainHigh',
  'dmxAddress', 'blackout', 'gmZero', 'dmxMicCable', 'fixturePower', 'ptzIp', 'resolumeOutputOff', 'layerZero', 'displayOff', 'resMismatch'];

const stages = STORY.chapters.flatMap((c) => c.stages);

const allTrue = (spec, st, latched) => {
  const sim = computeSim(st, { talking: true, performing: true });
  return spec.objectives.map((o) => ({ label: o.label, ok: checkObjective(o.check, st, sim, { latched: [...latched] }) }));
};

for (const spec of stages) {
  test(`stage ${spec.id}: structure`, () => {
    assert.ok(VENUES[spec.venue], `venue ${spec.venue}`);
    const ids = new Set();
    spec.devices.forEach((d) => {
      assert.ok(DEVICE_TYPES[d.type], `type ${d.type}`);
      assert.ok(VENUES[spec.venue].slots[d.slot], `slot ${d.slot} in ${spec.venue}`);
      assert.ok(!ids.has(d.id), `dup id ${d.id}`); ids.add(d.id);
    });
    const slots = spec.devices.map((d) => d.slot);
    assert.equal(new Set(slots).size, slots.length, 'one device per slot');
    // 미리 연결된 케이블 검사
    const st = buildRuntime({ ...spec, connections: [], faults: [], unlimited: true });
    spec.connections.forEach((c) => {
      const [fd, fp] = c.from.split('.'), [td, tp] = c.to.split('.');
      assert.ok(CABLES[c.cable], `cable ${c.cable}`);
      const r = canConnect(st, { d: fd, p: fp }, { d: td, p: tp }, c.cable);
      assert.ok(r.ok, `preset ${c.from}>${c.to}: ${r.reason ?? r.mismatch}`);
      assert.equal(r.from.d, fd, `preset direction ${c.from}>${c.to}`);
      st.connections.push({ id: `${c.from}>${c.to}`, from: r.from, to: r.to, cable: c.cable });
    });
    Object.keys(spec.inventory ?? {}).forEach((k) => assert.ok(CABLES[k], `inventory ${k}`));
    spec.objectives.forEach((o) => assert.ok(OBJ.includes(o.check.type), `objective ${o.check.type}`));
    (spec.faults ?? []).forEach((f) => assert.ok(FAULTS.includes(f.type), `fault ${f.type}`));
    const refs = spec.objectives.flatMap((o) => [o.check.source, o.check.device, o.check.camera, ...(o.check.devices ?? [])].filter(Boolean));
    refs.forEach((r) => assert.ok(ids.has(r), `objective ref ${r}`));
    assert.ok(spec.hints?.length >= 2 && spec.lessons?.length >= 2 && spec.briefing?.length >= 1 && spec.mission, 'texts');
  });

  test(`stage ${spec.id}: not solved at start, solution solves it`, () => {
    const st0 = buildRuntime(spec);
    const start = allTrue(spec, st0, new Set());
    assert.ok(start.some((o) => !o.ok), 'already solved at start');
    const sol = SOLUTIONS[spec.id];
    assert.ok(sol, 'solution missing');
    const { st, latched } = runOps(st0, sol.map((s) => s.do ?? s).filter((s) => s.op));
    const end = allTrue(spec, st, latched);
    const failed = end.filter((o) => !o.ok).map((o) => o.label);
    assert.deepEqual(failed, [], `unsolved: ${failed.join(' / ')}`);
  });
}

const { TUTORIAL, CONCEPT_KEYS, LABS, STRIP_PARTS } = await import('../src/game/data/tutorial.js');
const { PHOTOS } = await import('../src/game/data/photos.js');
const checkCard = (c, where) => {
  const n = ['photo', 'model', 'connector', 'concept'].filter((k) => c[k] != null).length;
  assert.equal(n, 1, `${where}: card needs exactly one of photo/model/connector/concept`);
  if (c.photo) assert.ok(PHOTOS[c.photo], `${where}: photo ${c.photo}`);
  if (c.model) assert.ok(DEVICE_TYPES[c.model], `${where}: model ${c.model}`);
  if (c.connector) assert.ok(CABLES[c.connector], `${where}: connector ${c.connector}`);
  if (c.concept) assert.ok(CONCEPT_KEYS.includes(c.concept), `${where}: concept ${c.concept}`);
  if (c.focus) assert.ok(c.concept === 'strip' && STRIP_PARTS.includes(c.focus), `${where}: strip focus ${c.focus}`);
};
for (const part of TUTORIAL) {
  test(`tutorial ${part.id}: scene fields are valid`, () => {
    const ids = new Set(part.devices.map((d) => d.id));
    part.steps.forEach((s, i) => {
      const w = `${part.id} step ${i}`;
      if (s.who) assert.ok(['senior', 'junior'].includes(s.who), `${w}: who ${s.who}`);
      if (s.say) assert.ok(s.say.length <= 140, `${w}: line too long (${s.say.length})`);
      if (s.practice) assert.ok(s.op, `${w}: practice without op`);
      if (s.focus) assert.ok(ids.has(s.focus), `${w}: focus ${s.focus}`);
      if (s.show) { if (s.show.items) { assert.ok(s.show.items.length >= 2 && s.show.items.length <= 3, `${w}: 2~3 items`); s.show.items.forEach((c) => checkCard(c, w)); } else checkCard(s.show, w); }
      if (s.quiz) {
        assert.ok(s.quiz.q && Array.isArray(s.quiz.options) && s.quiz.options.length >= 2, `${w}: quiz shape`);
        assert.ok(Number.isInteger(s.quiz.answer) && s.quiz.answer >= 0 && s.quiz.answer < s.quiz.options.length, `${w}: quiz answer`);
        assert.ok(s.quiz.explain, `${w}: quiz explain`);
        assert.ok(!s.op, `${w}: quiz and op in one scene`);
      }
      if (s.lab) assert.ok(LABS.includes(s.lab.lab), `${w}: lab ${s.lab.lab}`);
      assert.ok(s.say || s.op || s.quiz || s.lab, `${w}: empty scene`);
    });
  });
  test(`tutorial ${part.id}: every step applies cleanly`, () => {
    assert.ok(VENUES[part.venue]);
    part.devices.forEach((d) => assert.ok(VENUES[part.venue].slots[d.slot], `slot ${d.slot}`));
    let errors = [];
    runOps(buildRuntime(part), part.steps.filter((s) => s.op), { onStep: (st, op) => { if (st.lastError) errors.push(`${op.op} ${op.from ?? ''}>${op.to ?? ''}: ${st.lastError.reason}`); } });
    assert.deepEqual(errors, []);
  });
}

test('ptz-2: moving the on-air PTZ is recorded and fails the objective', () => {
  const spec = stages.find((s) => s.id === 'ptz-2');
  const st0 = buildRuntime(spec);
  const { st, latched } = runOps(st0, [
    { op: 'ptz', device: 'joy', act: 'select', value: 0 },
    { op: 'ptz', device: 'joy', act: 'recall', value: 1 },
  ]);
  assert.ok(latched.has('onAirMove:ptz1'));
  const sim = computeSim(st, { talking: true, performing: true });
  assert.equal(checkObjective({ type: 'noOnAirMove', device: 'ptz1' }, st, sim, { latched: [...latched] }), false);
});

test('sandbox ops: add, move, remove devices keep state consistent', async () => {
  const { applyOp, addDeviceOp } = await import('../src/game/ops.js');
  let st = buildRuntime({ venue: 'sandbox', unlimited: true, devices: [], connections: [] });
  const a = addDeviceOp(st, 'dynamic_mic', [0, 0.35, -2], 'floor'); st = applyOp(st, a);
  const b = addDeviceOp(st, 'analog_mixer', [1, 0.75, 2.6], 'desk'); st = applyOp(st, b);
  const c = addDeviceOp(st, 'speaker', [3, 0, -0.5], 'floor'); st = applyOp(st, c);
  assert.equal(st.mixerId, b.device.id);
  st = applyOp(st, { op: 'connect', from: `${a.device.id}.out`, to: `${b.device.id}.in1`, cable: 'xlr' });
  st = applyOp(st, { op: 'connect', from: `${b.device.id}.main`, to: `${c.device.id}.in`, cable: 'xlr' });
  assert.ok(computeSim(st).reaches(a.device.id, 'main'));
  st = applyOp(st, { op: 'moveDevice', device: c.device.id, pos: [-3, 0, -0.5] });
  assert.deepEqual(st.devices[c.device.id].pos, [-3, 0, -0.5]);
  st = applyOp(st, { op: 'removeDevice', device: b.device.id });
  assert.equal(st.mixerId, null);
  assert.equal(st.connections.length, 0);
  const d2 = addDeviceOp(st, 'dynamic_mic', [0, 0, 0], 'floor');
  assert.notEqual(d2.device.id, a.device.id);
});
