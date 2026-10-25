// 고른 사진 내려받아 게임에 넣기
//  NODE_USE_ENV_PROXY=1 node scripts/photo-finalize.mjs <후보 폴더>
//  node scripts/photo-finalize.mjs --index-only   (index.json의 출처만 고쳤을 때)
//  <후보 폴더>/candidates.json (photo-candidates.mjs) + scripts/photo-picks.json ({ id: 후보 번호 | { n, crop: [x0, y0, x1, y1] } | null })
//  crop은 0~1 비율 — 사람보다 장비가 크게 보이도록 잘라 낼 때 쓴다
//  결과: src/game/photos/<id>.jpg (가로 640px) + src/game/photos/index.json + index.js (data URL + 출처 표기)
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// --index-only: 사진은 그대로 두고 index.json의 출처 표기만 다시 써서 index.js를 만든다
const INDEX_ONLY = process.argv[2] === '--index-only';
const CAND = process.argv[2];
const cands = INDEX_ONLY ? {} : JSON.parse(readFileSync(join(CAND, 'candidates.json'), 'utf8'));
const picks = INDEX_ONLY ? {} : JSON.parse(readFileSync(new URL('./photo-picks.json', import.meta.url), 'utf8'));
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
// 라이선스 원문 주소 (출처 표기에 링크로 단다)
function licenseUrl(name) {
  const m = /^CC (BY(?:-SA)?) (\d\.\d)$/.exec(name ?? '');
  if (m) return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`;
  if (name === 'CC0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/public domain/i.test(name ?? '')) return 'https://creativecommons.org/publicdomain/mark/1.0/';
  return null;
}

const indexFile = new URL('index.json', dir);
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : {};
for (const [id, pick] of INDEX_ONLY ? [] : Object.entries(picks)) {
  const n = typeof pick === 'object' && pick ? pick.n : pick;
  const crop = typeof pick === 'object' && pick ? pick.crop ?? null : null;
  const c = n == null ? null : cands[id]?.[n];
  if (!c) { delete index[id]; continue; }
  if (index[id]?.title === c.title && JSON.stringify(index[id]?.crop ?? null) === JSON.stringify(crop) && existsSync(new URL(`${id}.jpg`, dir))) continue;
  try {
    const raw = new URL(`${id}.src`, dir), out = new URL(`${id}.jpg`, dir);
    writeFileSync(raw, await get(c.thumb.replace(/\/640px-/, '/500px-')));
    const cut = crop ? `crop=iw*${crop[2] - crop[0]}:ih*${crop[3] - crop[1]}:iw*${crop[0]}:ih*${crop[1]},` : '';
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw.pathname, '-vf', `${cut}scale='min(640,iw)':-2`, '-q:v', '6', out.pathname]);
    unlinkSync(raw);
    index[id] = { file: `${id}.jpg`, title: c.title, author: c.author, license: c.license, url: c.page, ...(crop ? { crop } : {}) };
    console.log(`+ ${id}: ${c.title} (${c.license})`);
  } catch (e) { console.log(`! ${id}: ${e.message}`); }
  await sleep(1200);
}
if (!INDEX_ONLY) writeFileSync(indexFile, JSON.stringify(index, null, 1));
const lines = Object.entries(index).filter(([, x]) => existsSync(new URL(x.file, dir))).map(([id, x]) => {
  const b64 = readFileSync(new URL(x.file, dir)).toString('base64');
  // 작자 미상(빈 칸·"Unknown author")은 그렇게 쓰고, 잘라 낸 사진은 고쳤다고 밝힌다 (CC BY·BY-SA 조건)
  const raw = String(x.author ?? '').trim();
  const known = raw && !/^(unknown author\s*)+$/i.test(raw);
  const author = !known ? '작자 미상' : raw.length > 60 ? `${raw.slice(0, 57)}…` : raw;
  const edited = x.crop || x.derived ? '일부 잘라냄' : null;
  const credit = [author, x.license, '위키미디어 공용', edited].filter(Boolean).join(' · ');
  const meta = { credit, author, license: x.license, licenseUrl: licenseUrl(x.license), url: x.url, ...(edited ? { edited } : {}) };
  const fields = Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  return `  ${JSON.stringify(id)}: { src: 'data:image/jpeg;base64,${b64}', ${fields} },`;
});
writeFileSync(new URL('index.js', dir), `/* 자동 생성 파일 (scripts/photo-finalize.mjs) — 받은 사진과 출처 표기. 직접 고치지 마세요. */\nexport const PHOTO_FILES = {\n${lines.join('\n')}\n};\n`);
console.log(`${lines.length} photos`);
