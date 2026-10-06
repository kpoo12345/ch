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
  st.dev.pa.position = 'front';
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
