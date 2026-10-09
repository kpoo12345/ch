// 파일 이름 목록 → 파일 페이지에서 라이선스·저작자 확인 (자유 라이선스만 남긴다, API를 쓰지 않는다)
//  NODE_USE_ENV_PROXY=1 node scripts/photo-verify.mjs <titles.json> <found.json 출력>
//  titles.json: [{ id, titles: ['File:…'] }]  →  found.json: [{ id, candidates: [{ title, author, license, why }] }]
import { readFileSync, writeFileSync } from 'node:fs';

const [inPath, outPath] = process.argv.slice(2);
const items = JSON.parse(readFileSync(inPath, 'utf8'));
const UA = { 'User-Agent': 'BroadcastMasterEdu/1.0 (https://github.com/kpoo12345/ch; educational broadcast-equipment game)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unesc = (s) => s.replace(/&#95;/g, '_').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = (h) => unesc(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
// 받아들이는 라이선스 (앞쪽이 우선)
const RANK = [/^CC0/i, /^Public domain/i, /^CC BY (\d|$)/i, /^CC BY-SA/i];
async function page(title) {
  const url = `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  for (let k = 0; k < 5; k += 1) {
    const r = await fetch(url, { headers: UA });
    if (r.status === 429 || r.status >= 500) { await sleep((Number(r.headers.get('retry-after')) || 15) * 1000 + 1500); continue; }
    if (!r.ok) return null;
    return r.text();
  }
  return null;
}
const out = [];
for (const { id, titles } of items) {
  const candidates = [];
  for (const t of titles ?? []) {
    const title = t.startsWith('File:') ? t : `File:${t}`;
    if (!/\.(jpe?g|png)$/i.test(title)) continue;
    const h = await page(title);
    await sleep(1500);
    if (!h) { console.log(`! ${id}: ${title} 페이지 없음`); continue; }
    const shorts = [...h.matchAll(/licensetpl(?:_|&#95;)short[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
    const lic = RANK.map((re) => shorts.find((x) => re.test(x))).find(Boolean);
    if (!lic) { console.log(`- ${id}: ${title} 라이선스 불가 (${shorts.join(', ') || '없음'})`); continue; }
    const am = h.match(/id="fileinfotpl(?:_|&#95;)aut"[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
    const author = am ? text(am[1]).replace(/\s*Permission.*$/, '').replace(/^No machine-readable author provided\.\s*/i, '').slice(0, 120) : '위키미디어 공용 기여자';
    candidates.push({ title, author: author || '위키미디어 공용 기여자', license: lic, why: '' });
    console.log(`+ ${id}: ${title} (${lic}, ${author.slice(0, 40)})`);
  }
  out.push({ id, candidates });
}
writeFileSync(outPath, JSON.stringify(out, null, 1));
