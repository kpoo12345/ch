// 녹음 파일을 묶어 src/game/voice/pack.js 만들기: node scripts/voice/pack.mjs <lines.json> <캐시 폴더>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const VOICES = JSON.parse(readFileSync(new URL('./voices.json', import.meta.url), 'utf8'));
const tag = (who) => `s${VOICES[who].sid}-v${VOICES[who].speed}-n${VOICES.steps}`;
const [linesPath, cache] = process.argv.slice(2);
const lines = JSON.parse(readFileSync(linesPath, 'utf8'));
const entries = [];
let bytes = 0, missing = 0;
for (const x of lines) {
  const f = join(cache, `${x.key}-${tag(x.who)}-b${x.br ?? 18}-${createHash('md5').update(x.tts).digest('hex').slice(0, 6)}.webm`);
  if (!existsSync(f)) { missing += 1; continue; }
  const buf = readFileSync(f);
  const ms = Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim()) * 1000);
  bytes += buf.length;
  entries.push(`  ${JSON.stringify(x.key)}: [${JSON.stringify(buf.toString('base64'))}, ${ms}],`);
}
writeFileSync(new URL('../../src/game/voice/pack.js', import.meta.url), `/* 자동 생성 파일 (scripts/voice/pack.mjs) — 미리 녹음한 내레이션. 직접 고치지 마세요. */
export const VOICE_MIME = 'audio/webm; codecs=opus';
export const VOICE_CREDIT = '음성: Supertonic 3 (Supertone, OpenRAIL-M) · sherpa-onnx로 생성';
export const VOICE_PACK = {
${entries.join('\n')}
};
`);
console.log(`${entries.length} clips, ${(bytes / 1024 / 1024).toFixed(2)} MB (base64 ${(bytes * 4 / 3 / 1024 / 1024).toFixed(2)} MB), missing ${missing}`);
