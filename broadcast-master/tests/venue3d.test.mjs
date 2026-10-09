import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { DEVICE_TYPES } from '../src/game/engine.js';
import { buildRuntime, computeSim } from '../src/game/sim.js';
import { applyOp } from '../src/game/ops.js';

/* 3D 화면(JSX) 모듈의 데이터·계산 검사 — 브라우저 없이 vite SSR로 JSX 모듈을 불러온다 */
process.noDeprecation = true; // 의존 패키지의 require("three") 경고 숨김
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());
const V = await server.ssrLoadModule('/src/game/Venue3D.jsx');

test('3D port maps cover every engine port of their device (router LAN 1~4 included)', () => {
  // 3D 단자 지도가 있는 장비는 엔진의 모든 단자 위치가 있어야 한다 (빠지면 케이블이 안 그려지고 손·카메라가 길을 잃는다)
  const missing = [];
  Object.entries(DEVICE_TYPES).filter(([type]) => V.PORTS_ALL[type]).forEach(([type, def]) => {
    [...def.ins, ...def.outs].forEach((p) => { if (!V.PORTS_ALL[type][p.id]) missing.push(`${type}.${p.id}`); });
  });
  assert.deepEqual(missing, []);
  assert.equal(new Set(['lan1', 'lan2', 'lan3', 'lan4'].map((p) => V.PORTS_ALL.router[p].p.join())).size, 4);
});

test('every cable kind has a 3D plug length and cable radius', async () => {
  const { CABLES } = await import('../src/game/engine.js');
  const K = await server.ssrLoadModule('/src/game/kit3d.jsx');
  const missing = Object.keys(CABLES).filter((c) => !K.PLUG_LEN[c] || !K.CABLE_R[c]);
  assert.deepEqual(missing, []);
});

test('ghost hand presses hanging fixtures on their body (below the clamp), not above it', () => {
  ['par_led', 'moving_head', 'projector'].forEach((t) => {
    assert.ok(V.DEVICE_POINT[t]({ key: 'address' }, null)[1] < 0, t);
    assert.ok(V.DEVICE_POINT[t]({ key: 'terminated' }, null)[1] < 0, t);
  });
  // LED 전광판은 폭에 맞춘 오른쪽 아래 프로세서
  assert.ok(V.DEVICE_POINT.led_wall({ key: 'power' }, { ledWall: { w: 6, h: 3 } })[0] > 2.4);
  ['ptz_controller', 'media_server'].forEach((t) => assert.ok(V.DEVICE_POINT[t]({ key: 'x' }, null)));
});

test('free-placed projector gets a screen in front of its lens, facing back, inside the back wall', () => {
  const sc = V.freeProjectorScreen({ pos: [1, 0, 1], rot: Math.PI }, 'sandbox');
  assert.ok(Math.abs(sc.pos[0] - 1) < 1e-9);
  assert.ok(Math.abs(sc.pos[2] - -2) < 1e-9); // 렌즈(+z → 회전 후 -z) 쪽 3m
  assert.ok(Math.abs(Math.cos(sc.rot) - 1) < 1e-9); // 스크린 앞면이 프로젝터 쪽(+z)
  assert.ok(sc.w > 0 && sc.h > 0);
  const nearWall = V.freeProjectorScreen({ pos: [0, 0.35, -3], rot: Math.PI }, 'sandbox');
  assert.ok(nearWall.pos[2] > -3.7 && nearWall.pos[2] < -3);
  const side = V.freeProjectorScreen({ pos: [0, 0, 0], rot: Math.PI / 2 }, 'sandbox');
  assert.ok(Math.abs(side.pos[0] - 3) < 1e-9);
});

const videoRig = () => buildRuntime({
  venue: 'seminar',
  devices: [
    { id: 'c1', type: 'camera', name: '카메라 1', slot: 'cam_back' }, { id: 'c2', type: 'camera', name: '카메라 2' }, { id: 'c3', type: 'camera', name: '카메라 3' },
    { id: 'atem', type: 'atem' }, { id: 'proj', type: 'projector' }, { id: 'proj2', type: 'projector' },
    { id: 'vj', type: 'media_server' }, { id: 'led', type: 'led_wall' },
  ],
  connections: [
    { from: 'c1.hdmi', to: 'atem.in1', cable: 'hdmi' }, { from: 'c2.hdmi', to: 'atem.in2', cable: 'hdmi' },
    { from: 'atem.hdmiout', to: 'proj.hdmi', cable: 'hdmi' }, { from: 'c3.hdmi', to: 'proj2.hdmi', cable: 'hdmi' },
    { from: 'vj.out1', to: 'led.hdmi', cable: 'hdmi' },
  ],
  state: { atem: { program: 1, preview: 2 }, devices: { vj: { layers: [{ clip: 'waves', opacity: 100 }, { clip: null, opacity: 100 }, { clip: null, opacity: 100 }] } } },
});

test('display picture follows ATEM CUT, the media server MASTER and a directly cabled camera', () => {
  let st = videoRig();
  let sim = computeSim(st);
  const before = V.displayPlan(st, sim, sim.displays.proj);
  assert.equal(before.cam.label, '카메라 1');
  // ATEM CUT: r.program은 그대로 true여도 그림(key)은 바뀐다
  st = applyOp(st, { op: 'atem', key: 'cut' });
  sim = computeSim(st);
  const after = V.displayPlan(st, sim, sim.displays.proj);
  assert.equal(sim.displays.proj.program, true);
  assert.equal(after.cam.label, '카메라 2');
  assert.notEqual(after.key, before.key);
  // 카메라를 프로젝터에 바로 꽂으면 ATEM PGM이 아니라 그 카메라
  assert.equal(V.displayPlan(st, sim, sim.displays.proj2).cam.label, '카메라 3');
  // MASTER를 내리면 LED 그림도 다시 그린다
  const led1 = V.displayPlan(st, sim, sim.displays.led);
  st = applyOp(st, { op: 'dev', device: 'vj', key: 'master', value: 40 });
  sim = computeSim(st);
  const led2 = V.displayPlan(st, sim, sim.displays.led);
  assert.equal(led2.master, 40);
  assert.notEqual(led2.key, led1.key);
});
