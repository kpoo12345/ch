// 고른 사진 내려받아 게임에 넣기
//  NODE_USE_ENV_PROXY=1 node scripts/photo-finalize.mjs <후보 폴더>
//  <후보 폴더>/candidates.json (photo-candidates.mjs) + scripts/photo-picks.json ({ id: 후보 번호 | null })
//  결과: src/game/photos/<id>.jpg (가로 640px) + src/game/photos/index.json + index.js (data URL + 출처 표기)
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const CAND = process.argv[2];
const cands = JSON.parse(readFileSync(join(CAND, 'candidates.json'), 'utf8'));
const picks = JSON.parse(readFileSync(new URL('./photo-picks.json', import.meta.url), 'utf8'));
const dir = new URL('../src/game/photos/', import.meta.url);
mkdirSync(dir, { recursive: true });
const UA = { 'User-Agent': 'BroadcastMasterEdu/1.0 (https://github.com/kpoo12345/ch; educational broadcast-equipment game)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let k = 0; k < 8; k += 1) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) { await sleep((Number(r.headers.get('retry-after')) || 20) * 1000 + 2000); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('too many retries');
}

const indexFile = new URL('index.json', dir);
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};
for (const [id, n] of Object.entries(picks)) {
  const c = n == null ? null : cands[id]?.[n];
  if (!c) { delete index[id]; continue; }
  if (index[id]?.title === c.title && existsSync(new URL(`${id}.jpg`, dir))) continue;
  try {
    const raw = new URL(`${id}.src`, dir), out = new URL(`${id}.jpg`, dir);
    writeFileSync(raw, await get(c.thumb));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw.pathname, '-vf', 'scale=640:-2', '-q:v', '7', out.pathname]);
    unlinkSync(raw);
    index[id] = { file: `${id}.jpg`, title: c.title, author: c.author, license: c.license, url: c.page };
    console.log(`+ ${id}: ${c.title} (${c.license})`);
  } catch (e) { console.log(`! ${id}: ${e.message}`); }
  await sleep(1200);
}
writeFileSync(indexFile, JSON.stringify(index, null, 1));
const lines = Object.entries(index).filter(([, x]) => existsSync(new URL(x.file, dir))).map(([id, x]) => {
  const b64 = readFileSync(new URL(x.file, dir)).toString('base64');
  const author = x.author.length > 60 ? `${x.author.slice(0, 57)}…` : x.author;
  return `  ${JSON.stringify(id)}: { src: 'data:image/jpeg;base64,${b64}', credit: ${JSON.stringify(`${author} · ${x.license} · 위키미디어 공용`)}, url: ${JSON.stringify(x.url)} },`;
});
writeFileSync(new URL('index.js', dir), `/* 자동 생성 파일 (scripts/photo-finalize.mjs) — 받은 사진과 출처 표기. 직접 고치지 마세요. */\nexport const PHOTO_FILES = {\n${lines.join('\n')}\n};\n`);
console.log(`${lines.length} photos`);
