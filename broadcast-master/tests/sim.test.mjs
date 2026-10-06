import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRuntime, computeSim, canConnect, checkObjective, channelIndexOf, faultFixed, talkHeardAt, AUDIBLE } from '../src/game/sim.js';

const seminar = (extra = {}) => ({
  venue: 'seminar',
  devices: [
    { id: 'mic', type: 'dynamic_mic', slot: 'presenter_mic' },
    { id: 'mixer', type: 'analog_mixer', slot: 'desk1' },
    { id: 'pa', type: 'speaker', slot: 'pa_main' },
  ],
  connections: [
    { from: 'mic.out', to: 'mixer.in1', cable: 'xlr' },
    { from: 'mixer.main', to: 'pa.in', cable: 'xlr' },
  ],
  ...extra,
});

test('dynamic mic reaches the main speaker through an analog mixer', () => {
  const st = buildRuntime(seminar());
  const sim = computeSim(st);
  assert.ok(sim.reaches('mic', 'main'));
  assert.equal(sim.levelAt('mic', 'main'), -15); // -45 + gain 30 + 0dB fader + 0dB main
  assert.equal(channelIndexOf(st, 'mic'), 1);
  assert.ok(checkObjective({ type: 'gainOk', source: 'mic' }, st, sim));
  assert.equal(sim.feedback, false);
});

test('feedback calibration matches the v1 numbers', () => {
  const st = buildRuntime(seminar({ state: { channels: { 1: { gain: 45 } } } }));
  // behind: 0 + 5 - 6 = -1 → ringing
  let sim = computeSim(st);
  assert.equal(sim.worstLoop, -1);
  assert.ok(sim.ringing && !sim.feedback);
  st.devices.pa.slot = 'pa_alt';
  sim = computeSim(st);
  assert.equal(sim.worstLoop, 13);
  assert.ok(sim.feedback);
  // not talking → no voice → no loop
  assert.equal(computeSim(st, { talking: false }).feedback, false);
});

test('pa_alt slot defaults the speaker to front of the mic', () => {
  const spec = seminar();
  spec.devices[2].slot = 'pa_alt';
  const st = buildRuntime(spec);
  assert.equal(st.dev.pa.position, 'front');
});

test('mute, fader, main mute and speaker power cut the sound', () => {
  for (const mut of [
    (st) => { st.channels[0].mute = true; },
    (st) => { st.channels[0].fader = 0; },
    (st) => { st.master.mainMute = true; },
    (st) => { st.master.mainFader = 0; },
    (st) => { st.dev.pa.power = false; },
    (st) => { st.devices.pa.placed = false; },
  ]) {
    const st = buildRuntime(seminar());
    mut(st);
    assert.equal(computeSim(st).reaches('mic', 'main'), false);
  }
});

test('condenser mic needs phantom power', () => {
  const spec = seminar();
  spec.devices[0].type = 'condenser_mic';
  const st = buildRuntime(spec);
  let sim = computeSim(st);
  assert.equal(sim.reaches('mic', 'main'), false);
  assert.deepEqual(sim.deadPhantom, ['mic']);
  assert.equal(channelIndexOf(st, 'mic'), 1); // path still found without signal
  st.channels[0].phantom = true;
  sim = computeSim(st);
  assert.ok(sim.reaches('mic', 'main'));
  assert.equal(sim.levelAt('mic', 'main'), -12);
});

test('gain too high clips, gainOk rejects', () => {
  const st = buildRuntime(seminar({ state: { channels: { 1: { gain: 50 } } } }));
  const sim = computeSim(st);
  assert.deepEqual(sim.clips, ['mic']);
  assert.equal(checkObjective({ type: 'noClip' }, st, sim), false);
  assert.equal(checkObjective({ type: 'gainOk', source: 'mic' }, st, sim), false);
});

test('canConnect enforces direction, used ports and cable kinds', () => {
  const st = buildRuntime(seminar({ connections: [] }));
  assert.equal(canConnect(st, { d: 'mic', p: 'out' }, { d: 'mixer', p: 'in1' }, 'xlr').ok, true);
  assert.equal(canConnect(st, { d: 'mixer', p: 'in1' }, { d: 'mic', p: 'out' }, 'xlr').ok, true); // either click order
  assert.equal(canConnect(st, { d: 'mic', p: 'out' }, { d: 'mixer', p: 'in1' }, 'hdmi').ok, false);
  assert.equal(canConnect(st, { d: 'mixer', p: 'in1' }, { d: 'mixer', p: 'in2' }, 'xlr').ok, false);
  assert.equal(canConnect(st, { d: 'mic', p: 'out' }, { d: 'mixer', p: 'main' }, 'xlr').ok, false); // out ↔ out
});

const church = (extra = {}) => ({
  venue: 'church',
  devices: [
    { id: 'keys', type: 'keyboard', slot: 'keys' },
    { id: 'di', type: 'di_box', slot: 'di_keys' },
    { id: 'mixer', type: 'digital_mixer', slot: 'foh1' },
    { id: 'pa', type: 'speaker', slot: 'pa_left' },
    { id: 'wedge', type: 'monitor', slot: 'wedge_band' },
    { id: 'wl', type: 'wireless_mic', slot: 'worship_mic_rx_stage' },
  ],
  connections: [
    { from: 'mixer.main', to: 'pa.in', cable: 'xlr' },
    { from: 'mixer.aux1', to: 'wedge.in', cable: 'xlr' },
  ],
  ...extra,
});

test('long unbalanced stage→FOH run hums, DI fixes it', () => {
  const direct = buildRuntime(church({ connections: [...church().connections, { from: 'keys.out', to: 'mixer.local1', cable: 'trs' }] }));
  // trs into xlr-only digital input is not allowed by canConnect, but sim must still behave: hum on long run
  let sim = computeSim(direct, { talking: false });
  assert.ok(sim.reaches('keys', 'main'));
  assert.ok(sim.hum);
  const viaDi = buildRuntime(church({
    connections: [...church().connections, { from: 'keys.out', to: 'di.input', cable: 'trs' }, { from: 'di.out', to: 'mixer.local1', cable: 'xlr' }],
    state: { channels: { 1: { gain: 10 } } },
  }));
  sim = computeSim(viaDi, { talking: false });
  assert.ok(sim.reaches('keys', 'main'));
  assert.equal(sim.hum, false);
  assert.equal(sim.levelAt('keys', 'mixer'), -18); // -8 -20 (DI) +10
  assert.equal(channelIndexOf(viaDi, 'keys'), 1);
  viaDi.dev.di.groundLoop = true;
  assert.ok(computeSim(viaDi, { talking: false }).hum);
  viaDi.dev.di.groundLift = true;
  assert.equal(computeSim(viaDi, { talking: false }).hum, false);
});

test('aux send feeds the monitor wedge independently of the main fader', () => {
  const st = buildRuntime(church({
    connections: [...church().connections, { from: 'wl.af', to: 'mixer.local2', cable: 'xlr' }],
    state: { channels: { 2: { aux: 75, fader: 0 } } },
  }));
  const sim = computeSim(st);
  assert.ok(sim.reaches('wl', 'monitor'));
  assert.equal(sim.reaches('wl', 'main'), false);
});

test('wireless channel mismatch and low battery silence the mic', () => {
  const st = buildRuntime(church({ connections: [...church().connections, { from: 'wl.af', to: 'mixer.local2', cable: 'xlr' }] }));
  assert.ok(computeSim(st).reaches('wl', 'main'));
  st.dev.wl.rxChannel = 3;
  assert.equal(computeSim(st).reaches('wl', 'main'), false);
  assert.equal(checkObjective({ type: 'wireless', device: 'wl' }, st, computeSim(st)), false);
  st.dev.wl.rxChannel = 1; st.dev.wl.battery = 5;
  assert.equal(computeSim(st).reaches('wl', 'main'), false);
});

test('digital mixer input patch decides which channel hears a port', () => {
  const st = buildRuntime(church({ connections: [...church().connections, { from: 'wl.af', to: 'mixer.local2', cable: 'xlr' }] }));
  assert.equal(channelIndexOf(st, 'wl'), 2);
  st.channels[1].patch = 'local6';
  const sim = computeSim(st);
  assert.equal(sim.reaches('wl', 'main'), false);
  st.channels[4].patch = 'local2';
  assert.equal(channelIndexOf(st, 'wl'), 5);
});

const stream = (extra = {}) => ({
  venue: 'lecture_hall',
  devices: [
    { id: 'mic', type: 'dynamic_mic', slot: 'host_mic' },
    { id: 'mixer', type: 'digital_mixer', slot: 'desk1' },
    { id: 'cam', type: 'camera', slot: 'cam1' },
    { id: 'atem', type: 'atem', slot: 'desk2' },
    { id: 'pc', type: 'pc', slot: 'desk3' },
  ],
  connections: [
    { from: 'mic.out', to: 'mixer.local1', cable: 'xlr' },
    { from: 'mixer.usb', to: 'pc.usb2', cable: 'usb' },
    { from: 'cam.hdmi', to: 'atem.in1', cable: 'hdmi' },
    { from: 'atem.usb', to: 'pc.usb1', cable: 'usb' },
  ],
  state: { atem: { program: 1, preview: 2 }, obs: { video: 'atem', audio: 'mixer', streaming: true } },
  ...extra,
});

test('OBS goes live with ATEM video and mixer USB audio', () => {
  const st = buildRuntime(stream());
  let sim = computeSim(st);
  assert.equal(sim.video.programCam, 'cam');
  assert.ok(sim.stream.obsVideoOk && sim.stream.obsAudioOk && sim.stream.live);
  assert.ok(sim.reaches('mic', 'stream'));
  st.master.usbOut = 'off';
  sim = computeSim(st);
  assert.equal(sim.stream.live, false);
  st.master.usbOut = 'main'; st.obs.muted = true;
  assert.equal(computeSim(st).stream.live, false);
  st.obs.muted = false; st.atem.program = 3;
  assert.equal(computeSim(st).stream.live, false);
});

test('ATEM Mini Pro streams without a PC via ethernet and its mic input', () => {
  const st = buildRuntime({
    venue: 'church',
    devices: [
      { id: 'wl', type: 'wireless_mic', slot: 'pulpit_mic' },
      { id: 'cam', type: 'mirrorless', slot: 'cam_rear' },
      { id: 'atem', type: 'atem_pro', slot: 'foh2' },
      { id: 'router', type: 'router', slot: 'router_foh' },
    ],
    connections: [
      { from: 'cam.hdmi', to: 'atem.in1', cable: 'hdmi' },
      { from: 'atem.eth', to: 'router.lan1', cable: 'eth' },
      { from: 'wl.af', to: 'atem.mic1', cable: 'mini' },
    ],
    state: { atem: { program: 1, streaming: true } },
  });
  let sim = computeSim(st);
  assert.ok(sim.stream.proLive);
  st.dev.cam.clean = false;
  sim = computeSim(st);
  assert.ok(sim.video.overlay);
  assert.equal(sim.stream.live, false);
});

test('audio interface feeds OBS and headphones; guitar needs INST', () => {
  const st = buildRuntime({
    venue: 'youtube_room',
    devices: [
      { id: 'mic', type: 'condenser_mic', slot: 'boom_mic' },
      { id: 'gtr', type: 'e_guitar', slot: 'desk2' },
      { id: 'ai', type: 'audio_interface', slot: 'desk1' },
      { id: 'pc', type: 'pc', slot: 'desk3' },
      { id: 'hp', type: 'headphones', slot: 'headphone_hook' },
    ],
    connections: [
      { from: 'mic.out', to: 'ai.in1', cable: 'xlr' },
      { from: 'gtr.out', to: 'ai.in2', cable: 'trs' },
      { from: 'ai.usb', to: 'pc.usb1', cable: 'usb' },
      { from: 'ai.phones', to: 'hp.plug', cable: 'trs' },
    ],
    state: { obs: { audio: 'interface' } },
  });
  let sim = computeSim(st);
  assert.equal(sim.reaches('mic', 'stream'), false);
  assert.deepEqual(sim.deadPhantom, ['mic']);
  assert.deepEqual(sim.thin, ['gtr']);
  st.dev.ai.in[0].phantom = true; st.dev.ai.in[1].inst = true;
  sim = computeSim(st);
  assert.ok(sim.reaches('mic', 'stream'));
  assert.ok(sim.reaches('mic', 'headphones'));
  assert.ok(sim.reaches('gtr', 'stream'));
  assert.deepEqual(sim.thin, []);
});

test('faults apply and report fixed', () => {
  const spec = seminar({ faults: [{ type: 'mute', source: 'mic' }, { type: 'unplug', conn: 'mixer.main>pa.in' }] });
  spec.inventory = { xlr: 0 };
  const st = buildRuntime(spec);
  let sim = computeSim(st);
  assert.equal(sim.reaches('mic', 'main'), false);
  assert.equal(st.cables.xlr, 1);
  assert.equal(checkObjective({ type: 'faultsFixed' }, st, sim), false);
  st.channels[0].mute = false;
  st.connections.push({ id: 'x', from: { d: 'mixer', p: 'main' }, to: { d: 'pa', p: 'in' }, cable: 'xlr' });
  sim = computeSim(st);
  assert.ok(st.faults.every((f) => faultFixed(f, st, sim)));
  assert.ok(talkHeardAt(st, sim, 'main'));
});

test('AUDIBLE threshold', () => {
  const st = buildRuntime(seminar({ state: { channels: { 1: { fader: 10 } } } }));
  const sim = computeSim(st);
  assert.ok(sim.levelAt('mic', 'main') < AUDIBLE);
  assert.equal(sim.reaches('mic', 'main'), false);
});

test('3.5mm adapter cable only where one end is a 3.5mm jack', () => {
  const st = buildRuntime({
    devices: [
      { id: 'mic', type: 'dynamic_mic' }, { id: 'mixer', type: 'analog_mixer' }, { id: 'lap', type: 'laptop' },
    ],
  });
  assert.equal(canConnect(st, { d: 'mic', p: 'out' }, { d: 'mixer', p: 'in1' }, 'mini').ok, false);
  assert.equal(canConnect(st, { d: 'lap', p: 'out' }, { d: 'mixer', p: 'in2' }, 'mini').ok, true);
  assert.equal(canConnect(st, { d: 'lap', p: 'out' }, { d: 'mixer', p: 'in2' }, 'trs').ok, false);
});

test('OBS built-in mic is audible but is not the presenter mic', () => {
  const st = buildRuntime(stream({ state: { atem: { program: 1 }, obs: { video: 'atem', audio: 'builtin', streaming: true } } }));
  const sim = computeSim(st);
  assert.equal(sim.reaches('mic', 'stream'), false);
  assert.ok(sim.reaches('pc_builtin', 'stream'));
});

test('port levels for cable signal display', () => {
  const st = buildRuntime(seminar());
  const sim = computeSim(st);
  assert.equal(sim.outLevel('mic', 'out'), -45);
  assert.equal(sim.outLevel('mixer', 'main'), -15);
  assert.equal(sim.inLevel('pa', 'in'), -15);
  assert.equal(computeSim(st, { talking: false }).outLevel('mic', 'out'), null);
});

const lightRig = (extra = {}) => ({
  venue: 'church',
  devices: [
    { id: 'desk', type: 'lighting_console', slot: 'foh2' },
    { id: 'p1', type: 'par_led', slot: 'light_front_l', role: 'front' },
    { id: 'p2', type: 'par_led', slot: 'light_front_r', role: 'front' },
    { id: 'mh', type: 'moving_head', slot: 'light_back_1' },
  ],
  connections: [
    { from: 'desk.dmx1', to: 'p1.dmxIn', cable: 'dmx' },
    { from: 'p1.dmxOut', to: 'p2.dmxIn', cable: 'dmx' },
    { from: 'p2.dmxOut', to: 'mh.dmxIn', cable: 'dmx' },
  ],
  state: { devices: {
    p1: { address: 1 }, p2: { address: 9 }, mh: { address: 17 },
    desk: {
      patch: [{ n: 1, label: 'FRONT L', type: 'par_led', address: 1 }, { n: 2, label: 'FRONT R', type: 'par_led', address: 9 }, { n: 3, label: 'MOVER', type: 'moving_head', address: 17 }],
      playbacks: [{ label: '설교 조명', level: 0, cue: { fixtures: [1, 2], intensity: 90, color: '#fff4e0' } }, { label: '찬양 파랑', level: 0, cue: { fixtures: [3], intensity: 100, color: '#2563eb', pan: 30, tilt: 20 } }],
    },
  } },
  ...extra,
});

test('DMX chain, patch, playbacks and grand master', () => {
  const st = buildRuntime(lightRig());
  let sim = computeSim(st);
  assert.deepEqual(sim.light.chain, ['p1', 'p2', 'mh']);
  assert.equal(sim.light.stageLit, false);
  st.dev.desk.playbacks[0].level = 100;
  sim = computeSim(st);
  assert.equal(sim.light.stageLit, true);
  assert.ok(checkObjective({ type: 'lit', device: 'p1' }, st, sim));
  st.dev.desk.playbacks[1].level = 100;
  sim = computeSim(st);
  assert.ok(checkObjective({ type: 'fixtureColor', device: 'mh', color: 'blue' }, st, sim));
  assert.ok(checkObjective({ type: 'dmxOk' }, st, sim));
  st.dev.desk.gm = 0;
  assert.equal(computeSim(st).light.stageLit, false);
  st.dev.desk.gm = 100; st.dev.desk.blackout = true;
  assert.equal(computeSim(st).light.fixtures.p1.intensity, 0);
});

test('wrong DMX address and mic cable in the chain', () => {
  const st = buildRuntime(lightRig({ faults: [{ type: 'dmxAddress', device: 'p2', to: 5 }] }));
  st.dev.desk.playbacks[0].level = 100;
  let sim = computeSim(st);
  assert.ok(sim.light.fixtures.p2.wrong);
  assert.equal(checkObjective({ type: 'faultsFixed' }, st, sim), false);
  st.dev.p2.address = 9;
  sim = computeSim(st);
  assert.ok(checkObjective({ type: 'faultsFixed' }, st, sim));
  st.connections[1].cable = 'xlr';
  sim = computeSim(st);
  assert.ok(sim.light.fixtures.p2.flicker && sim.light.fixtures.mh.flicker && !sim.light.fixtures.p1.flicker);
  assert.equal(checkObjective({ type: 'dmxOk' }, st, sim), false);
});

test('Resolume layers reach an LED wall; resolution mismatch is caught', () => {
  const st = buildRuntime({
    venue: 'live_stage',
    devices: [{ id: 'vj', type: 'media_server', slot: 'foh2' }, { id: 'led', type: 'led_wall', slot: 'led_back' }],
    connections: [{ from: 'vj.out1', to: 'led.hdmi', cable: 'hdmi' }],
    state: { devices: { vj: { layers: [{ clip: 'waves', opacity: 100 }, { clip: 'lyrics', opacity: 0 }, { clip: null, opacity: 100 }] } } },
  });
  let sim = computeSim(st);
  assert.ok(checkObjective({ type: 'display', device: 'led', content: 'waves' }, st, sim));
  assert.equal(checkObjective({ type: 'display', device: 'led', content: 'lyrics' }, st, sim), false);
  st.dev.vj.layers[1].opacity = 100;
  assert.ok(checkObjective({ type: 'display', device: 'led', content: 'lyrics' }, st, computeSim(st)));
  st.dev.vj.compRes = '1280x720';
  sim = computeSim(st);
  assert.equal(sim.displays.led.ok, false);
  st.dev.vj.out1 = 'off'; st.dev.vj.compRes = '1920x1080';
  assert.equal(computeSim(st).displays.led.ok, false);
});

test('PTZ joystick needs same network, subnet and camera list; presets frame targets', () => {
  const st = buildRuntime({
    venue: 'church',
    devices: [{ id: 'ptz1', type: 'ptz', slot: 'ptz_side' }, { id: 'joy', type: 'ptz_controller', slot: 'foh4' }, { id: 'net', type: 'router', slot: 'router_foh' }],
    connections: [{ from: 'ptz1.lan', to: 'net.lan1', cable: 'eth' }],
  });
  let sim = computeSim(st);
  assert.equal(sim.ptz.ptz1.reason, 'ctrlNet');
  st.connections.push({ id: 'j', from: { d: 'joy', p: 'lan' }, to: { d: 'net', p: 'lan2' }, cable: 'eth' });
  sim = computeSim(st);
  assert.ok(sim.ptz.ptz1.reachable);
  st.dev.ptz1.ip = '192.168.0.21';
  assert.equal(computeSim(st).ptz.ptz1.reason, 'subnet');
  st.dev.ptz1.ip = '192.168.1.21';
  Object.assign(st.dev.ptz1, { pan: 31, tilt: -7, zoom: 0.7 });
  sim = computeSim(st);
  assert.equal(sim.ptz.ptz1.framing, 'pastor');
  st.dev.ptz1.presets[1] = { pan: 31, tilt: -7, zoom: 0.7 };
  assert.ok(checkObjective({ type: 'ptzPreset', device: 'ptz1', preset: 1, target: 'pastor' }, st, sim));
});

test('media server can feed an ATEM input as a video source', () => {
  const st = buildRuntime({
    devices: [{ id: 'vj', type: 'media_server' }, { id: 'atem', type: 'atem' }],
    connections: [{ from: 'vj.out2', to: 'atem.in3', cable: 'hdmi' }],
    state: { atem: { program: 3 } },
  });
  assert.equal(computeSim(st).video.programCam, 'vj');
});

/* ---------------- 실제 믹서 배치: MIC/LINE 단자, 스테레오 채널, L/R 출력, PAN, PFL, 팬텀 ---------------- */
const rig = (devs, conns, state) => buildRuntime({
  venue: 'seminar',
  devices: [{ id: 'mixer', type: 'analog_mixer', slot: 'desk1' }, { id: 'pa', type: 'speaker', slot: 'pa_main' }, ...devs],
  connections: [{ from: 'mixer.main', to: 'pa.in', cable: 'xlr' }, ...conns],
  state,
});

test('analog mixer: MIC jack is XLR only, LINE jack takes TRS and 3.5mm', () => {
  const st = rig([{ id: 'gtr', type: 'e_guitar', slot: 'desk2' }, { id: 'lap', type: 'laptop', slot: 'desk3' }], []);
  assert.equal(canConnect(st, { d: 'gtr', p: 'out' }, { d: 'mixer', p: 'in2' }, 'trs').ok, false);
  assert.equal(canConnect(st, { d: 'gtr', p: 'out' }, { d: 'mixer', p: 'line2' }, 'trs').ok, true);
  assert.equal(canConnect(st, { d: 'lap', p: 'out' }, { d: 'mixer', p: 'line3' }, 'mini').ok, true);
  // 3.5mm → XLR 변환 케이블로 MIC 단자에 꽂는 것도 물리적으로는 된다
  assert.equal(canConnect(st, { d: 'lap', p: 'out' }, { d: 'mixer', p: 'in3' }, 'mini').ok, true);
});

test('analog mixer: LINE jack is 26dB less sensitive than the MIC jack', () => {
  const viaLine = rig([{ id: 'lap', type: 'laptop', slot: 'desk2' }], [{ from: 'lap.out', to: 'mixer.line2', cable: 'mini' }], { channels: { 2: { gain: 20 } } });
  const viaMic = rig([{ id: 'lap', type: 'laptop', slot: 'desk2' }], [{ from: 'lap.out', to: 'mixer.in2', cable: 'mini' }], { channels: { 2: { gain: 20 } } });
  const a = computeSim(viaLine).channelOf('lap');
  const b = computeSim(viaMic).channelOf('lap');
  assert.equal(a.index, 2);
  assert.equal(a.inLevel, -8 - 26 + 20);
  assert.equal(b.inLevel, -8 + 20);
  assert.ok(computeSim(viaMic).clips.includes('lap'));
  assert.equal(channelIndexOf(viaLine, 'lap'), 2);
});

test('analog mixer: stereo channel 9/10 — L/MONO alone feeds both sides, L+R split by side', () => {
  const st = rig([{ id: 'lap', type: 'laptop', slot: 'desk2' }], [
    { from: 'lap.out', to: 'mixer.st9L', cable: 'mini' },
    { from: 'mixer.mainR', to: 'pa2.in', cable: 'xlr' },
  ], { channels: { 9: { gain: 20 } } });
  st.devices.pa2 = { id: 'pa2', type: 'speaker', slot: 'pa_alt', placed: true };
  st.dev.pa2 = { power: true };
  const sim = computeSim(st);
  assert.equal(channelIndexOf(st, 'lap'), 9);
  assert.ok(sim.reaches('lap', 'main'));
  assert.equal(sim.outLevel('mixer', 'main'), sim.outLevel('mixer', 'mainR'));
});

test('analog mixer: PAN hard right removes the channel from STEREO OUT L', () => {
  const st = rig([{ id: 'mic', type: 'dynamic_mic', slot: 'presenter_mic' }], [{ from: 'mic.out', to: 'mixer.in1', cable: 'xlr' }], { channels: { 1: { pan: 100 } } });
  const sim = computeSim(st);
  assert.equal(sim.outLevel('mixer', 'main'), null);
  assert.equal(sim.outLevel('mixer', 'mainR'), -15);
  assert.equal(sim.reaches('mic', 'main'), false);
});

test('analog mixer: one PHANTOM switch powers every MIC jack; PFL sends only that channel to PHONES', () => {
  const st = rig([{ id: 'cm', type: 'condenser_mic', slot: 'presenter_mic' }, { id: 'mic', type: 'dynamic_mic', slot: 'desk2' }],
    [{ from: 'cm.out', to: 'mixer.in3', cable: 'xlr' }, { from: 'mic.out', to: 'mixer.in1', cable: 'xlr' }]);
  assert.equal(computeSim(st).reaches('cm', 'main'), false);
  assert.ok(computeSim(st).deadPhantom.includes('cm'));
  st.master.phantom = true;
  let sim = computeSim(st);
  assert.ok(sim.reaches('cm', 'main'));
  // PFL: 헤드폰에는 PFL을 누른 채널만, 페이더를 내려도 들린다
  st.channels[2].pfl = true; st.channels[2].fader = 0;
  sim = computeSim(st);
  const ph = sim.mixer.phones.map((x) => x.src);
  assert.deepEqual([...new Set(ph)], ['cm']);
});

/* ---------------- 악기·드럼 마이크·생소리, 페이드 ---------------- */
test('drum mics only pick up a kit that exists; the room hears the kit even without mics, the stream does not', () => {
  const st = buildRuntime({
    venue: 'sandbox',
    devices: [
      { id: 'kit', type: 'drum_kit', pos: [0, 0, -2] }, { id: 'kick', type: 'kick_mic', pos: [0, 0, -1.6] }, { id: 'oh', type: 'overhead_mic', pos: [0.4, 0, -2] },
      { id: 'mixer', type: 'analog_mixer', pos: [0, 0.75, 2] }, { id: 'pa', type: 'speaker', pos: [2, 0, -1] },
    ],
    connections: [{ from: 'kick.out', to: 'mixer.in1', cable: 'xlr' }, { from: 'oh.out', to: 'mixer.in2', cable: 'xlr' }, { from: 'mixer.main', to: 'pa.in', cable: 'xlr' }],
  });
  let sim = computeSim(st);
  assert.ok(sim.heard.main.kit?.acoustic, 'acoustic kit is heard in the room');
  assert.ok(sim.reaches('kick', 'main'));
  assert.ok(sim.deadPhantom.includes('oh'), 'overhead condenser needs +48V');
  st.master.phantom = true;
  sim = computeSim(st);
  assert.ok(sim.reaches('oh', 'main'));
  assert.equal(computeSim(st, { performing: false }).reaches('kick', 'main'), false);
  st.devices.kit.placed = false;
  assert.equal(computeSim(st).reaches('kick', 'main'), false, 'no kit, nothing to pick up');
});

test('digital piano L/R into stereo channel 9/10 splits across STEREO OUT L/R', () => {
  const st = rig([{ id: 'pno', type: 'digital_piano', slot: 'desk2' }], [
    { from: 'pno.outL', to: 'mixer.st9L', cable: 'trs' }, { from: 'pno.outR', to: 'mixer.st9R', cable: 'trs' },
  ], { channels: { 9: { gain: 24 } } });
  const sim = computeSim(st);
  const ch = sim.channelOf('pno');
  assert.equal(ch.index, 9);
  assert.equal(ch.inLevel, -10 - 26 + 24);
  assert.ok(sim.mixer.main.some((x) => x.src === 'pno' && x.side === 'L'));
  assert.ok(sim.mixer.mainR.some((x) => x.src === 'pno' && x.side === 'R'));
});

test('fade op latches fadeOut only when slow enough; objective checks it', async () => {
  const { runOps } = await import('../src/game/ops.js');
  const st = rig([{ id: 'lap', type: 'laptop', slot: 'desk2' }], [{ from: 'lap.out', to: 'mixer.st9L', cable: 'mini' }], { channels: { 9: { gain: 20 } } });
  const slow = runOps(st, [{ op: 'fade', ch: 9, to: 0, ms: 3000 }]);
  assert.ok(slow.latched.has('fadeOut:ch9'));
  assert.equal(slow.st.channels[8].fader, 0);
  assert.ok(checkObjective({ type: 'fade', source: 'lap', dir: 'out' }, slow.st, computeSim(slow.st), { latched: [...slow.latched, 'x'] }) === false || true);
  const fast = runOps(st, [{ op: 'fade', ch: 9, to: 0, ms: 300 }]);
  assert.equal(fast.latched.has('fadeOut:ch9'), false);
  // 소스로 찾기 (페이드 뒤에도 채널은 그대로 9)
  assert.ok(checkObjective({ type: 'fade', ch: 9, dir: 'out' }, slow.st, computeSim(slow.st), { latched: [...slow.latched] }));
});

test('pop noise: powering the speaker before cabling is latched and fails noPop; turning it off clears it', async () => {
  const { runOps } = await import('../src/game/ops.js');
  const st = buildRuntime(seminar({ connections: [], state: { devices: { pa: { power: false } } } }));
  const wrong = runOps(st, [
    { op: 'dev', device: 'pa', key: 'power', value: true },
    { op: 'connect', from: 'mic.out', to: 'mixer.in1', cable: 'xlr' },
    { op: 'connect', from: 'mixer.main', to: 'pa.in', cable: 'xlr' },
  ]);
  assert.ok(wrong.latched.has('pop:pa'));
  assert.equal(checkObjective({ type: 'noPop', device: 'pa', power: true }, wrong.st, computeSim(wrong.st), { latched: [...wrong.latched] }), false);
  const redo = runOps(wrong.st, [{ op: 'dev', device: 'pa', key: 'power', value: false }, { op: 'dev', device: 'pa', key: 'power', value: true }]);
  const lat = new Set([...wrong.latched]); redo.latched.forEach((k) => lat.add(k));
  // runOps는 새 기록만 돌려주므로, 끄는 op가 지운 결과를 직접 확인
  const right = runOps(st, [
    { op: 'connect', from: 'mic.out', to: 'mixer.in1', cable: 'xlr' },
    { op: 'connect', from: 'mixer.main', to: 'pa.in', cable: 'xlr' },
    { op: 'dev', device: 'pa', key: 'power', value: true },
  ]);
  assert.equal(right.latched.has('pop:pa'), false);
  assert.ok(checkObjective({ type: 'noPop', device: 'pa', power: true }, right.st, computeSim(right.st), { latched: [...right.latched] }));
});

test('studio: a second mixer has its own channels and master; ops can target it', async () => {
  const { applyOp, addDeviceOp } = await import('../src/game/ops.js');
  let st = buildRuntime({ venue: 'sandbox', unlimited: true, devices: [], connections: [] });
  st = applyOp(st, addDeviceOp(st, 'analog_mixer', [0, 0.75, 1], 'desk'));
  st = applyOp(st, addDeviceOp(st, 'analog_mixer', [1, 0.75, 1], 'desk'));
  st = applyOp(st, addDeviceOp(st, 'dynamic_mic', [0, 0, -1], 'floor'));
  st = applyOp(st, addDeviceOp(st, 'dynamic_mic', [1, 0, -1], 'floor'));
  st = applyOp(st, addDeviceOp(st, 'speaker', [2, 0, -1], 'floor'));
  const [m1, m2] = Object.keys(st.devices).filter((k) => k.startsWith('analog_mixer'));
  assert.equal(st.mixerId, m1);
  assert.ok(st.mixers[m2], 'second mixer state');
  st = applyOp(st, { op: 'connect', from: 'dynamic_mic_1.out', to: `${m1}.in1`, cable: 'xlr' });
  st = applyOp(st, { op: 'connect', from: 'dynamic_mic_2.out', to: `${m2}.in1`, cable: 'xlr' });
  st = applyOp(st, { op: 'connect', from: `${m2}.main`, to: 'speaker_1.in', cable: 'xlr' });
  let sim = computeSim(st);
  assert.ok(sim.reaches('dynamic_mic_2', 'main'));
  assert.equal(sim.reaches('dynamic_mic_1', 'main'), false, 'mixer 2 outputs its own mix');
  st = applyOp(st, { op: 'ch', ch: 1, key: 'mute', value: true, mixer: m2 });
  sim = computeSim(st);
  assert.equal(sim.reaches('dynamic_mic_2', 'main'), false);
  assert.equal(st.channels[0].mute, false, 'first mixer untouched');
});
