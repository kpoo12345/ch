// 웹 검색으로 찾은 위키미디어 공용 파일을 미리보기로 받기 (API를 쓰지 않는다 — 이 서버는 API가 심하게 제한됨)
//  NODE_USE_ENV_PROXY=1 node scripts/photo-download.mjs <found.json> <후보 폴더>
//  found.json: [{ id, candidates: [{ title: 'File:…', author, license }] }]
//  결과: <후보 폴더>/candidates.json 에 합치고, <id>-<n>.jpg (가로 500px) 저장
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const [foundPath, OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const found = JSON.parse(readFileSync(foundPath, 'utf8'));
const file = join(OUT, 'candidates.json');
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const UA = { 'User-Agent': 'BroadcastMasterEdu/1.0 (https://github.com/kpoo12345/ch; educational broadcast-equipment game)' };
const OK_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)?( [0-9.]+)?)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 위키미디어 저장 경로: md5(파일 이름)의 앞 1·2글자. 500px는 미리 만들어 둔 표준 크기라 바로 받을 수 있다
export const thumbUrl = (title, w = 500) => {
  const name = title.replace(/^File:/, '').replace(/ /g, '_');
  const h = createHash('md5').update(name).digest('hex');
  const enc = encodeURIComponent(name).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');
  const ext = /\.png$/i.test(name) ? '' : '';
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${h[0]}/${h.slice(0, 2)}/${enc}/${w}px-${enc}${ext}`;
};
async function get(url) {
  for (let k = 0; k < 5; k += 1) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) { await sleep((Number(r.headers.get('retry-after')) || 15) * 1000 + 1500); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error('too many retries');
}
for (const { id, candidates } of found) {
  const keep = [];
  for (const c of candidates ?? []) {
    if (!OK_LICENSE.test(c.license ?? '') || !/^File:.+\.(jpe?g|png)$/i.test(c.title)) { console.log(`- ${id}: 건너뜀 ${c.title} (${c.license})`); continue; }
    const n = keep.length;
    const thumb = thumbUrl(c.title);
    try {
      writeFileSync(join(OUT, `${id}-${n}.jpg`), await get(thumb));
      keep.push({ title: c.title, thumb, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}`, license: c.license, author: c.author, desc: c.why ?? '' });
    } catch (e) { console.log(`! ${id}: ${c.title} ${e.message}`); }
    await sleep(1200);
  }
  if (keep.length) all[id] = keep;
  console.log(`${id}: ${keep.length}개`);
  writeFileSync(file, JSON.stringify(all, null, 1));
}
