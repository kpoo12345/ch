// 사진 후보 모으기 (위키미디어 공용, 자유 라이선스만) — 천천히, 429면 기다렸다 다시
//  NODE_USE_ENV_PROXY=1 node scripts/photo-candidates.mjs <출력 폴더> [id ...]
//  결과: <출력 폴더>/candidates.json + <출력 폴더>/<id>-<n>.jpg (고르기용 작은 그림)
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHOTOS } from '../src/game/data/photos.js';
import { QUERY } from './photo-queries.mjs';

const OUT = process.argv[2];
const only = process.argv.slice(3);
mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'BroadcastMasterEdu/1.0 (https://github.com/kpoo12345/ch; educational broadcast-equipment game)' };
const OK_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)?( [0-9.]+)?)/i;
const strip = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, binary = false) {
  for (let k = 0; k < 8; k += 1) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) {
      const wait = (Number(r.headers.get('retry-after')) || 20) * 1000 + 2000;
      console.log(`  ${r.status}, ${Math.round(wait / 1000)}초 기다림`);
      await sleep(wait);
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
  }
  throw new Error('too many retries');
}

const file = join(OUT, 'candidates.json');
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
for (const id of Object.keys(PHOTOS)) {
  if (only.length && !only.includes(id)) continue;
  if (all[id]?.length) continue;
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `${QUERY[id] ?? PHOTOS[id].alt} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '10',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '640',
  });
  try {
    const d = await get(`https://commons.wikimedia.org/w/api.php?${q}`);
    const pages = Object.values(d.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const cands = pages.map((p) => ({ p, ii: p.imageinfo?.[0] }))
      .filter(({ ii }) => ii && /jpeg|png/.test(ii.mime) && ii.width >= 500 && OK_LICENSE.test(strip(ii.extmetadata?.LicenseShortName?.value)))
      .slice(0, 4)
      .map(({ p, ii }) => ({ title: p.title, thumb: ii.thumburl, page: ii.descriptionurl, license: strip(ii.extmetadata?.LicenseShortName?.value), author: strip(ii.extmetadata?.Artist?.value) || '작자 미상', desc: strip(ii.extmetadata?.ImageDescription?.value).slice(0, 200) }));
    for (let n = 0; n < cands.length; n += 1) {
      const small = cands[n].thumb.replace(/\/640px-/, '/320px-');
      try { writeFileSync(join(OUT, `${id}-${n}.jpg`), await get(small, true)); } catch { writeFileSync(join(OUT, `${id}-${n}.jpg`), await get(cands[n].thumb, true)); }
      await sleep(1500);
    }
    all[id] = cands;
    console.log(`${id}: ${cands.length}개 (${cands.map((c) => c.title.slice(5, 45)).join(' | ')})`);
  } catch (e) { console.log(`! ${id}: ${e.message}`); }
  writeFileSync(file, JSON.stringify(all, null, 1));
  await sleep(6000);
}
console.log('done');
