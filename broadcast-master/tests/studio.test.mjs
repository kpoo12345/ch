import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntime, computeSim } from '../src/game/sim.js';
import { applyOp, addDeviceOp, opToAction, nextDmxAddress, nextPtzIp, discoverCams } from '../src/game/ops.js';

// 스튜디오 모드와 같은 빈 상태에서 장비를 하나씩 추가
const studio = () => buildRuntime({ venue: 'sandbox', unlimited: true, devices: [], connections: [] });
const add = (st, type) => { const op = addDeviceOp(st, type, [0, 0, 0], 'floor'); return { st: applyOp(st, op), id: op.device.id }; };
const addAll = (st, types) => { const ids = []; types.forEach((t) => { const r = add(st, t); st = r.st; ids.push(r.id); }); return { st, ids }; };
const connect = (st, from, to, cable) => applyOp(st, { op: 'connect', from, to, cable });
const chain = (st, con, fixtures) => {
  let s = connect(st, `${con}.dmx1`, `${fixtures[0]}.dmxIn`, 'dmx');
  for (let i = 1; i < fixtures.length; i += 1) s = connect(s, `${fixtures[i - 1]}.dmxOut`, `${fixtures[i]}.dmxIn`, 'dmx');
  return s;
};

test('studio: fixtures added after the console are auto-patched to the next free address', () => {
  let { st, ids: [con, p1, p2, mh] } = addAll(studio(), ['lighting_console', 'par_led', 'par_led', 'moving_head']);
  assert.deepEqual(st.dev[con].patch.map((e) => [e.n, e.type, e.address, e.fixture]), [[1, 'par_led', 1, p1], [2, 'par_led', 9, p2], [3, 'moving_head', 17, mh]]);
  assert.deepEqual([p1, p2, mh].map((f) => st.dev[f].address), [1, 9, 17]);
  assert.equal(nextDmxAddress(st.dev[con].patch), 33);
  st = chain(st, con, [p1, p2, mh]);
  st = applyOp(st, { op: 'dev', device: con, key: 'programmer', value: { sel: [1, 2, 3], intensity: 100, color: null, pan: null, tilt: null } });
  const sim = computeSim(st);
  assert.equal(sim.light.conflicts.length, 0);
  [p1, p2, mh].forEach((f) => { const r = sim.light.fixtures[f]; assert.ok(r.intensity > 0.3 && !r.wrong && !r.flicker, f); });
  assert.deepEqual([p1, p2, mh].map((f) => sim.light.fixtures[f].entry), [1, 2, 3]);
});

test('studio: a console added after the fixtures patches the ones already placed', () => {
  let { st, ids: [p1, p2, p3, con] } = addAll(studio(), ['par_led', 'par_led', 'par_led', 'lighting_console']);
  assert.deepEqual(st.dev[con].patch.map((e) => e.address), [1, 9, 17]);
  assert.deepEqual([p1, p2, p3].map((f) => st.dev[f].address), [1, 9, 17]);
  // 두 번째 콘솔은 조명 계산에 쓰이지 않으므로 자동 패치하지 않는다
  const r = add(st, 'lighting_console');
  assert.deepEqual(r.st.dev[r.id].patch, []);
  st = chain(st, con, [p1, p2, p3]);
  st = applyOp(st, { op: 'dev', device: con, key: 'programmer', value: { sel: [1, 2, 3], intensity: 80, color: null, pan: null, tilt: null } });
  st = applyOp(st, { op: 'lightRecord', device: con, index: 1, label: '전체' });
  st = applyOp(st, { op: 'dev', device: con, key: 'playbacks.0.level', value: 100 });
  const sim = computeSim(st);
  assert.equal(Object.values(sim.light.fixtures).filter((x) => x.intensity > 0.3 && !x.flicker && !x.wrong).length, 3);
});

test('studio: a fixture keeps its own address when it is free in the patch', () => {
  let st = studio();
  const a = add(st, 'par_led'); st = a.st;
  st = applyOp(st, { op: 'dev', device: a.id, key: 'address', value: 41 });
  const c = add(st, 'lighting_console'); st = c.st;
  assert.deepEqual(st.dev[c.id].patch.map((e) => e.address), [41]);
  const b = add(st, 'par_led'); st = b.st;
  assert.equal(st.dev[b.id].address, 49);
});

test('studio: removing a fixture drops its patch entry; patchRemove deletes by number', () => {
  let { st, ids: [con, p1, p2, p3] } = addAll(studio(), ['lighting_console', 'par_led', 'par_led', 'par_led']);
  st = applyOp(st, { op: 'dev', device: con, key: 'programmer.sel', value: [1, 2, 3] });
  st = applyOp(st, { op: 'lightRecord', device: con, index: 1 });
  st = applyOp(st, { op: 'dev', device: con, key: 'programmer.sel', value: [2] });
  st = applyOp(st, { op: 'removeDevice', device: p2 });
  assert.deepEqual(st.dev[con].patch.map((e) => e.n), [1, 3]);
  assert.deepEqual(st.dev[con].programmer.sel, []);
  assert.deepEqual(st.dev[con].playbacks[0].cue.fixtures, [1, 3]);
  // 새 조명은 마지막 패치 뒤 빈 주소(17 + 8 = 25)로 들어간다
  const r = add(st, 'par_led'); st = r.st;
  assert.equal(st.dev[r.id].address, 25);
  assert.equal(st.dev[con].patch.find((e) => e.fixture === r.id).n, 4);
  st = applyOp(st, { op: 'patchRemove', device: con, n: 1 });
  assert.deepEqual(st.dev[con].patch.map((e) => e.n), [3, 4]);
  assert.ok(computeSim(st).light.fixtures[p1].entry == null);
  assert.deepEqual(opToAction(st, { op: 'patchRemove', device: con, n: 3 }, 1), { key: 1, device: con, ctl: { kind: 'light', key: 'patch' } });
  // 손으로 다시 패치
  st = applyOp(st, { op: 'patchAdd', device: con, entry: { type: 'par_led', address: 1, label: '앞 왼쪽' } });
  assert.equal(st.dev[con].patch.find((e) => e.address === 1).n, 5);
  assert.ok(p3);
});

const ptzRig = (n) => {
  let { st, ids } = addAll(studio(), ['router', 'ptz_controller', ...Array(n).fill('ptz')]);
  const [net, joy, ...cams] = ids;
  st = connect(st, `${joy}.lan`, `${net}.lan1`, 'eth');
  cams.forEach((c, i) => { if (i < 3) st = connect(st, `${c}.lan`, `${net}.lan${i + 2}`, 'eth'); });
  return { st, net, joy, cams };
};

test('studio: every new PTZ gets its own IP and the joystick can drive each one', () => {
  let { st, joy, cams } = ptzRig(3);
  assert.deepEqual(cams.map((c) => st.dev[c].ip), ['192.168.1.21', '192.168.1.22', '192.168.1.23']);
  let sim = computeSim(st);
  assert.deepEqual(cams.map((c) => sim.ptz[c].index), [1, 2, 3]);
  st = applyOp(st, { op: 'ptz', device: joy, act: 'select', value: 1 });
  st = applyOp(st, { op: 'ptz', device: joy, act: 'aim', pan: 40 });
  assert.deepEqual(cams.map((c) => st.dev[c].pan), [0, 40, 0]);
  // 같은 IP로 바꾸면 두 카메라 모두 IP 충돌
  st = applyOp(st, { op: 'dev', device: cams[2], key: 'ip', value: '192.168.1.22' });
  sim = computeSim(st);
  assert.equal(sim.ptz[cams[1]].reason, 'dupIp');
  assert.equal(sim.ptz[cams[2]].reason, 'dupIp');
  assert.deepEqual(sim.ptz[cams[1]].dupWith, [cams[2]]);
  assert.ok(sim.ptz[cams[0]].reachable);
  st = applyOp(st, { op: 'ptz', device: joy, act: 'aim', pan: 10 });
  assert.ok(st.lastError);
  // 조이스틱 자신의 IP와 겹쳐도 충돌
  st = applyOp(st, { op: 'dev', device: cams[2], key: 'ip', value: '192.168.1.10' });
  sim = computeSim(st);
  assert.equal(sim.ptz[cams[2]].reason, 'dupIp');
  assert.ok(sim.ptz[cams[1]].reachable);
});

test('studio: a 5th PTZ gets .25 and is added to the joystick list', () => {
  const { st, joy, cams } = ptzRig(5);
  assert.equal(st.dev[cams[4]].ip, '192.168.1.25');
  assert.deepEqual(st.dev[joy].cams, ['192.168.1.21', '192.168.1.22', '192.168.1.23', '192.168.1.24', '192.168.1.25']);
  assert.equal(nextPtzIp(st), '192.168.1.26');
  // 목록에 없는 IP로 바꾸면 notInList → 네트워크에서 찾기로 추가
  const s2 = applyOp(st, { op: 'dev', device: cams[0], key: 'ip', value: '192.168.1.40' });
  assert.equal(computeSim(s2).ptz[cams[0]].reason, 'notInList');
  assert.ok(discoverCams(s2, joy).includes('192.168.1.40'));
  // 다른 대역은 찾지 않는다
  const s3 = applyOp(st, { op: 'dev', device: cams[0], key: 'ip', value: '192.168.0.21' });
  assert.equal(computeSim(s3).ptz[cams[0]].reason, 'subnet');
  assert.ok(!discoverCams(s3, joy).includes('192.168.0.21'));
});

test('studio: PTZs placed before the joystick still get distinct IPs', () => {
  const { st, ids } = addAll(studio(), ['ptz', 'ptz', 'ptz_controller']);
  assert.deepEqual(ids.slice(0, 2).map((c) => st.dev[c].ip), ['192.168.1.21', '192.168.1.22']);
  assert.equal(st.dev[ids[2]].cams.length, 4);
});
