// 미리 녹음할 대사 목록 만들기: node scripts/voice/lines.mjs <출력.json>
//  튜토리얼 대사(말하는 사람별) + 퀴즈 질문·설명 + 짧은 한마디
import { writeFileSync } from 'node:fs';
import { TUTORIAL, STOCK } from '../../src/game/data/tutorial.js';
import { ttsText, lineKey } from '../../src/game/voice/pronounce.js';
import { PHRASES, TALK_VOICE } from '../../src/game/data/phrases.js';
import { SOLUTIONS } from '../../src/game/data/solutions.js';

const out = new Map();
// br: Opus 비트레이트(kbps) — 튜토리얼은 18, 스토리 정답 해설은 14 (전체 용량 16MB 안에 맞추려고)
const add = (who, text, br = 18) => { if (!text) return; const key = lineKey(who, text); if (!out.has(key)) out.set(key, { key, who, text, tts: ttsText(text), br }); };
for (const part of TUTORIAL) {
  for (const s of part.steps) {
    if (s.say) add(s.quiz ? 'senior' : s.who ?? 'senior', s.say);
    if (s.quiz) { add('senior', s.quiz.q); add('senior', s.quiz.explain); }
  }
}
Object.values(STOCK).flat().forEach((t) => add('senior', t));
Object.values(SOLUTIONS).forEach((steps) => steps.forEach((s) => { if (s.say) add(s.who ?? 'senior', s.say, 14); }));
Object.entries(PHRASES).forEach(([venue, list]) => list.forEach((t) => add(TALK_VOICE[venue] ?? 'talk_m', t)));
const list = [...out.values()];
writeFileSync(process.argv[2] ?? 'voice-lines.json', JSON.stringify(list, null, 1));
console.log(`${list.length} lines, ${list.reduce((a, x) => a + x.text.length, 0)} chars`);
