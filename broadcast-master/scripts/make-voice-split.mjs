// 웹사이트판 목소리 묶음 만들기: src/game/voice/pack.js(전체) → dist/voice/<묶음>.js
//  묶음: 튜토리얼 파트마다 하나(파트 id) · common(칭찬·아쉬움 한마디, 무대 위 말소리) · story(정답 보기 해설)
//  한 파트에서 쓰는 대사는 모두 그 파트 묶음에 넣는다 (다른 파트와 겹치는 대사는 양쪽에 다 들어간다)
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { VOICE_PACK } from '../src/game/voice/pack.js';
import { TUTORIAL, STOCK } from '../src/game/data/tutorial.js';
import { SOLUTIONS } from '../src/game/data/solutions.js';
import { PHRASES, TALK_VOICE } from '../src/game/data/phrases.js';
import { lineKey } from '../src/game/voice/pronounce.js';

const groups = new Map();
const add = (g, who, text) => { if (!text) return; const k = lineKey(who, text); if (!groups.has(g)) groups.set(g, new Set()); groups.get(g).add(k); };
// scripts/voice/lines.mjs와 같은 규칙으로 누가 읽는지 정한다
for (const part of TUTORIAL) {
  for (const s of part.steps) {
    if (s.say) add(part.id, s.quiz ? 'senior' : s.who ?? 'senior', s.say);
    if (s.quiz) { add(part.id, 'senior', s.quiz.q); add(part.id, 'senior', s.quiz.explain); }
  }
}
Object.values(STOCK).flat().forEach((t) => add('common', 'senior', t));
Object.entries(PHRASES).forEach(([venue, list]) => list.forEach((t) => add('common', TALK_VOICE[venue] ?? 'talk_m', t)));
Object.values(SOLUTIONS).forEach((steps) => steps.forEach((s) => { if (s.say) add('story', s.who ?? 'senior', s.say); }));

const out = new URL('../dist/voice/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let total = 0, missing = 0;
for (const [g, keys] of groups) {
  const data = {};
  for (const k of keys) { if (VOICE_PACK[k]) data[k] = VOICE_PACK[k]; else missing += 1; }
  const js = `window.__bmVoice&&window.__bmVoice(${JSON.stringify(g)},${JSON.stringify(data)});\n`;
  writeFileSync(new URL(`${g}.js`, out), js);
  total += js.length;
  console.log(`voice/${g}.js  ${Object.keys(data).length} clips  ${(js.length / 1024 / 1024).toFixed(2)} MB`);
}
console.log(`${groups.size} groups, ${(total / 1024 / 1024).toFixed(2)} MB total, missing ${missing}`);
if (missing) process.exitCode = 1;
