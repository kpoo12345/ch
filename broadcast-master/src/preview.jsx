// 개발용 미리보기: /preview.html?stage=church-4&solve=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Venue3D from './game/Venue3D.jsx';
import { CanvasShell } from './game/kit3d.jsx';
import { OrbitControls } from '@react-three/drei';
import { AnalogConsole, CONSOLE_PORTS } from './game/consoles.jsx';
import { Plug, EquipmentViewer, CableShowcase } from './game/Studio3D.jsx';
import { CABLES, MIXER_DEFAULT } from './game/engine.js';
import STORY from './game/data/story.json';
import { SOLUTIONS } from './game/data/solutions.js';
import { buildRuntime, computeSim, connId, VENUE_ZONES } from './game/sim.js';
import { runOps } from './game/ops.js';

const q = new URLSearchParams(location.search);
const spec = STORY.chapters.flatMap((c) => c.stages).find((s) => s.id === (q.get('stage') ?? 'seminar-1'));
let st = buildRuntime(spec);
if (q.get('solve')) st = runOps(st, SOLUTIONS[spec.id].filter((x) => x.op)).st;
if (q.get('placeall')) Object.values(st.devices).forEach((d) => { d.placed = true; });
// 스네이크: &snake=1 → 무대 장비 → 스테이지 박스 → 멀티 → 팬아웃 → 믹서로 다시 꽂고, AUX → 팬아웃 RET → 박스 RET → 웨지
if (q.get('snake') && st.mixerId) {
  st.devices.box = { id: 'box', type: 'stage_box', slot: 'stagebox', placed: true };
  st.devices.fan = { id: 'fan', type: 'snake_fanout', slot: 'fanout', placed: true };
  const zones = VENUE_ZONES[spec.venue] ?? { stage: [] };
  const onStage = (id) => zones.stage.includes(st.devices[id]?.slot);
  const conns = [];
  const link = (from, to, cable) => conns.push({ id: connId(from, to), from, to, cable });
  let ret = 0;
  st.connections.forEach((c) => {
    const k = /^(?:in|local)(\d)$/.exec(c.to.p)?.[1];
    if (c.to.d === st.mixerId && k && Number(k) <= 8 && onStage(c.from.d)) { link(c.from, { d: 'box', p: `in${k}` }, c.cable); link({ d: 'fan', p: `out${k}` }, c.to, 'xlr'); }
    else if (c.from.d === st.mixerId && /^aux/.test(c.from.p) && onStage(c.to.d) && ret < 2) { ret += 1; link(c.from, { d: 'fan', p: `ret${ret}` }, c.cable); link({ d: 'box', p: `ret${ret}` }, c.to, 'xlr'); }
    else conns.push(c);
  });
  link({ d: 'box', p: 'multi' }, { d: 'fan', p: 'multi' }, 'multi');
  st.connections = conns;
}
// 파워 앰프·패시브 스피커·인이어: &amp=1 → 메인 스피커를 패시브 2대로 바꿔 앰프 랙의 SPEAKON A·B로 울리고, AUX 1 → 인이어 송신기
if (q.get('amp') && st.mixerId) {
  const mix = st.mixerId;
  const old = Object.values(st.devices).filter((d) => d.type === 'speaker').map((d) => d.id);
  old.forEach((id) => { delete st.devices[id]; delete st.dev[id]; });
  st.connections = st.connections.filter((c) => !old.includes(c.to.d) && !(c.from.d === mix && c.from.p === 'aux1'));
  const add = (id, type, slot, s) => { st.devices[id] = { id, type, slot, placed: true }; st.dev[id] = s; };
  add('amp', 'power_amp', 'amp_rack', { power: true, levelA: 75, levelB: 75 });
  add('pspkL', 'passive_speaker', 'pa_left', { position: 'behind' });
  add('pspkR', 'passive_speaker', 'pa_right', { position: 'behind' });
  add('iem', 'iem', 'iem_rack', { power: true, txChannel: 2, rxChannel: 2, volume: 70 });
  const link = (from, to, cable) => st.connections.push({ id: connId(from, to), from, to, cable });
  const digital = st.devices[mix].type === 'digital_mixer';
  link({ d: mix, p: 'main' }, { d: 'amp', p: 'inA' }, 'xlr');
  link({ d: mix, p: digital ? 'main' : 'mainR' }, { d: 'amp', p: 'inB' }, 'xlr');
  if (digital) st.connections.pop(); // 디지털 믹서 MAIN은 하나뿐 — B는 비워 둔다
  link({ d: 'amp', p: 'spkA' }, { d: 'pspkL', p: 'spk' }, 'speakon');
  link({ d: 'amp', p: 'spkB' }, { d: 'pspkR', p: 'spk' }, 'speakon');
  link({ d: mix, p: 'aux1' }, { d: 'iem', p: 'in' }, digital ? 'xlr' : 'trs');
  st.channels.forEach((ch) => { ch.aux = Math.max(ch.aux, 60); });
}
const sim = computeSim(st, { talking: true, performing: true });
window.__BM_TEST = {};
function App() {
  const [focus, setFocus] = React.useState(null);
  React.useEffect(() => { if (q.get('focus')) setTimeout(() => setFocus({ id: q.get('focus'), zoom: Number(q.get('zoom') ?? 1), key: 1 }), Number(q.get('delay') ?? 1500)); }, []);
  return <div style={{ width: '100vw', height: '100vh' }}><Venue3D st={st} sim={sim} venueId={spec.venue} talking performing labels={!!q.get('labels')} focusRequest={focus} /></div>;
}
// 믹서만 가까이: /preview.html?console=1&cam=0,0.45,0.55
function ConsoleOnly() {
  const cam = (q.get('cam') ?? '0,0.5,0.6').split(',').map(Number);
  const tgt = (q.get('tgt') ?? '0,0.05,0').split(',').map(Number);
  const names = st.channels.map((_, i) => sim.mixer.channels[i]?.comps?.[0]?.src ?? '');
  const meters = { ch: sim.mixer.channels.map((c) => c.inLevel), main: sim.outLevel(st.mixerId, 'main'), mainR: sim.outLevel(st.mixerId, 'mainR') };
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <CanvasShell camera={{ position: cam, fov: 40, near: 0.01, far: 20 }}>
        <color attach="background" args={['#1f2633']} />
        <ambientLight intensity={0.7} /><directionalLight position={[1, 3, 2]} intensity={2.2} />
        <OrbitControls target={tgt} />
        <AnalogConsole channels={st.channels} master={st.master} meters={meters} names={names} />
        {st.connections.flatMap((c) => [c.from, c.to].filter((e) => e.d === st.mixerId).map((e) => {
          const P = CONSOLE_PORTS.analog_mixer[e.p];
          return P ? <Plug key={`${c.id}${e.p}`} p={P.p} n={P.n} cable={c.cable} color={CABLES[c.cable].stroke} /> : null;
        }))}
      </CanvasShell>
    </div>
  );
}
// 장비 백과사전 3D 뷰어만: /preview.html?viewer=stage_box&rotate=0
function ViewerOnly() {
  const demo = { talking: true, mixer: { ...MIXER_DEFAULT, gain: 28, phantom: true }, power: true, tally: 'pgm', atem: { program: 1, preview: 2, transitioning: false }, chLevel: -17, mainLevel: -15, level: -14 };
  return <div style={{ width: '100vw', height: '100vh' }}><EquipmentViewer type={q.get('viewer')} demo={demo} autoRotate={q.get('rotate') !== '0'} still={!!q.get('thumb')} /></div>;
}
// 케이블 커넥터만: /preview.html?connector=xlr (튜토리얼 카드용 스틸)
function ConnectorOnly() {
  return <div style={{ width: '100vw', height: '100vh' }}><CableShowcase kind={q.get('connector')} /></div>;
}
createRoot(document.getElementById('root')).render(q.get('connector') ? <ConnectorOnly /> : q.get('viewer') ? <ViewerOnly /> : q.get('console') ? <ConsoleOnly /> : <App />);
