// 개발용 미리보기: /preview.html?stage=church-4&solve=1
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Venue3D from './game/Venue3D.jsx';
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
  return <div style={{ width: '100vw', height: '100vh' }}><Venue3D st={st} sim={sim} venueId={spec.venue} talking performing labels={!!q.get('labels')} /></div>;
}
createRoot(document.getElementById('root')).render(<App />);
