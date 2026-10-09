// 실물 사진 받기 (위키미디어 공용, 자유 라이선스만): node scripts/fetch-photos.mjs [id ...]
//  - 네트워크에서 commons.wikimedia.org 와 upload.wikimedia.org 에 접속할 수 있어야 한다
//  - scripts/photo-picks.json 에 { id: "File:정확한 파일 이름.jpg" } 를 적으면 검색 대신 그 파일을 쓴다
//  - 결과: src/game/photos/<id>.jpg (가로 640px) + src/game/photos/index.js (data URL + 출처 표기)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PHOTOS } from '../src/game/data/photos.js';
import { QUERY } from './photo-queries.mjs';

const OK_LICENSE = /^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY(-SA)?)/i;
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'BroadcastMasterEdu/1.0 (educational game; photo fetch script)' };
const dir = new URL('../src/game/photos/', import.meta.url);
mkdirSync(dir, { recursive: true });
const picksFile = new URL('./photo-picks.json', import.meta.url);
const picks = existsSync(picksFile) ? JSON.parse(readFileSync(picksFile, 'utf8')) : {};
const strip = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function info(params) {
  const q = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '640', ...params });
  const r = await fetch(`${API}?${q}`, { headers: UA });
  if (!r.ok) throw new Error(`commons ${r.status}`);
  return Object.values((await r.json()).query?.pages ?? {});
}
async function pick(id) {
  const pages = picks[id]
    ? await info({ titles: picks[id] })
    : await info({ generator: 'search', gsrsearch: `${QUERY[id] ?? PHOTOS[id].alt} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '12' });
  const ok = pages
    .map((p) => ({ p, ii: p.imageinfo?.[0] }))
    .filter(({ ii }) => ii && /jpeg|png/.test(ii.mime) && ii.width >= 500 && OK_LICENSE.test(strip(ii.extmetadata?.LicenseShortName?.value)))
    .sort((a, b) => (a.p.index ?? 0) - (b.p.index ?? 0));
  return ok[0] ?? null;
}

const only = process.argv.slice(2);
const index = existsSync(new URL('index.json', dir)) ? JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')) : {};
for (const id of Object.keys(PHOTOS)) {
  if (only.length && !only.includes(id)) continue;
  try {
    const hit = await pick(id);
    if (!hit) { console.log(`- ${id}: 알맞은 자유 라이선스 사진 없음`); continue; }
    const { p, ii } = hit;
    const img = Buffer.from(await (await fetch(ii.thumburl, { headers: UA })).arrayBuffer());
    const raw = new URL(`${id}.src`, dir), out = new URL(`${id}.jpg`, dir);
    writeFileSync(raw, img);
    // 640px JPEG로 다시 압축 (용량 줄이기)
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw.pathname, '-vf', 'scale=640:-2', '-q:v', '6', out.pathname]);
    const m = ii.extmetadata ?? {};
    index[id] = { file: `${id}.jpg`, title: p.title, author: strip(m.Artist?.value) || '작자 미상', license: strip(m.LicenseShortName?.value), url: ii.descriptionurl };
    console.log(`+ ${id}: ${p.title} (${index[id].license})`);
  } catch (e) { console.log(`! ${id}: ${e.message}`); }
}
writeFileSync(new URL('index.json', dir), JSON.stringify(index, null, 1));
// 게임이 읽는 모듈: data URL + 출처 한 줄
const lines = Object.entries(index).filter(([id, x]) => existsSync(new URL(x.file, dir))).map(([id, x]) => {
  const b64 = readFileSync(new URL(x.file, dir)).toString('base64');
  return `  ${JSON.stringify(id)}: { src: 'data:image/jpeg;base64,${b64}', credit: ${JSON.stringify(`${x.author} · ${x.license} · 위키미디어 공용`)} },`;
});
writeFileSync(new URL('index.js', dir), `/* 자동 생성 파일 (scripts/fetch-photos.mjs) — 받은 사진과 출처 표기. 직접 고치지 마세요. */\nexport const PHOTO_FILES = {\n${lines.join('\n')}\n};\n`);
console.log(`${lines.length} photos in src/game/photos/index.js`);
