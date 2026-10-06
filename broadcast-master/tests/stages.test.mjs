import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEVICE_TYPES, CABLES } from '../src/game/engine.js';
import { buildRuntime, computeSim, canConnect, checkObjective } from '../src/game/sim.js';
import { VENUES } from '../src/game/venues.js';
import { runOps } from '../src/game/ops.js';

const STORY = JSON.parse(readFileSync(new URL('../src/game/data/story.json', import.meta.url)));
const { SOLUTIONS } = await import('../src/game/data/solutions.js');
const OBJ = ['placed', 'connected', 'reaches', 'absent', 'gainOk', 'noClip', 'noFeedback', 'noHum', 'lowCut', 'fx', 'eq', 'power', 'wireless', 'cleanHdmi', 'program', 'live', 'recording', 'pip', 'talkTest', 'faultsFixed', 'onChannel', 'noPop', 'fade', 'noCut',
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

const { TUTORIAL } = await import('../src/game/data/tutorial.js');
for (const part of TUTORIAL) {
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
