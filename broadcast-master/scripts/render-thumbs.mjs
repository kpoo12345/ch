// 3D 모델·커넥터 스틸 만들기 (실물 사진이 없을 때 카드에 대신 쓴다)
//  개발 서버가 떠 있어야 한다: npx vite --port 5199 --host 127.0.0.1 → node scripts/render-thumbs.mjs
import { writeFileSync } from 'node:fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { DEVICE_TYPES, CABLES } from '../src/game/engine.js';

const BASE = process.env.BM_URL ?? 'http://127.0.0.1:5199';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 420, height: 315 }, deviceScaleFactor: 1 });
const out = {};
const shot = async (key, url, wait = 3200) => {
  try {
    await page.goto(`${BASE}${url}`, { timeout: 45000 });
    await page.waitForTimeout(wait);
    const buf = await page.screenshot({ type: 'jpeg', quality: 66, timeout: 45000 });
    out[key] = `data:image/jpeg;base64,${buf.toString('base64')}`;
    console.log(key, Math.round(buf.length / 1024), 'KB');
  } catch (e) { console.log(key, 'FAILED', e.message.split('\n')[0]); }
};
for (const type of Object.keys(DEVICE_TYPES)) await shot(`model:${type}`, `/preview.html?viewer=${type}&rotate=0&thumb=1`);
for (const kind of Object.keys(CABLES)) {
  await shot(`connector:${kind}`, `/preview.html?connector=${kind}&thumb=1`);
}
await browser.close();
writeFileSync(new URL('../src/game/thumbs/index.js', import.meta.url), `/* 자동 생성 파일 (scripts/render-thumbs.mjs) — 3D 모델·커넥터 스틸 (실물 사진이 없을 때 대신). 직접 고치지 마세요. */\nexport const THUMBS = {\n${Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: '${v}',`).join('\n')}\n};\n`);
console.log(Object.keys(out).length, 'thumbs');
