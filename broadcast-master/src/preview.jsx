// 개발용 미리보기: /preview.html?stage=church-4&solve=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Venue3D from './game/Venue3D.jsx';
import { CanvasShell } from './game/kit3d.jsx';
import { OrbitControls } from '@react-three/drei';
import { AnalogConsole, CONSOLE_PORTS } from './game/consoles.jsx';
import { Plug } from './game/Studio3D.jsx';
import { CABLES } from './game/engine.js';
import STORY from './game/data/story.json';
import { SOLUTIONS } from './game/data/solutions.js';
import { buildRuntime, computeSim } from './game/sim.js';
import { runOps } from './game/ops.js';

const q = new URLSearchParams(location.search);
const spec = STORY.chapters.flatMap((c) => c.stages).find((s) => s.id === (q.get('stage') ?? 'seminar-1'));
let st = buildRuntime(spec);
if (q.get('solve')) st = runOps(st, SOLUTIONS[spec.id].filter((x) => x.op)).st;
if (q.get('placeall')) Object.values(st.devices).forEach((d) => { d.placed = true; });
const sim = computeSim(st, { talking: true, performing: true });
window.__BM_TEST = {};
function App() {
  const [focus, setFocus] = React.useState(null);
  React.useEffect(() => { if (q.get('focus')) setTimeout(() => setFocus({ id: q.get('focus'), zoom: Number(q.get('zoom') ?? 1), key: 1 }), 1500); }, []);
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
createRoot(document.getElementById('root')).render(q.get('console') ? <ConsoleOnly /> : <App />);
