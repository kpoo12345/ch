// 웹사이트판 사진 나누기: HTML에 data URL로 넣던 실물 사진·3D 스틸을 따로 된 파일로 뺀다 (첫 화면이 빨리 뜨게)
//  결과: .split/photos.js · .split/thumbs.js (vite.config.js가 BM_VOICE_SPLIT=1일 때 원래 목록 대신 쓴다)
//        .split/media/photos/<id>.jpg · .split/media/thumbs/<key>.jpg (make-pages.mjs가 docs/media로 옮긴다)
//  브라우저는 <img src="media/...">를 화면에 나올 때 받으므로 따로 불러오는 코드가 필요 없다
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { PHOTO_FILES } from '../src/game/photos/index.js';
import { THUMBS } from '../src/game/thumbs/index.js';

const out = new URL('../.split/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(new URL('media/photos/', out), { recursive: true });
mkdirSync(new URL('media/thumbs/', out), { recursive: true });
const decode = (dataUrl) => {
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error(`data URL이 아닙니다: ${String(dataUrl).slice(0, 40)}`);
  return { ext: m[1] === 'jpeg' ? 'jpg' : m[1], buf: Buffer.from(m[2], 'base64') };
};
// 파일 이름: model:dynamic_mic → model-dynamic_mic, connector:xlr:f → connector-xlr-f
const fileName = (k) => k.replace(/[^a-z0-9_]+/gi, '-');
let bytes = 0;
const photos = {};
for (const [id, p] of Object.entries(PHOTO_FILES)) {
  const { ext, buf } = decode(p.src);
  const path = `media/photos/${fileName(id)}.${ext}`;
  writeFileSync(new URL(path, out), buf);
  bytes += buf.length;
  photos[id] = { ...p, src: path };
}
const thumbs = {};
for (const [k, src] of Object.entries(THUMBS)) {
  const { ext, buf } = decode(src);
  const path = `media/thumbs/${fileName(k)}.${ext}`;
  writeFileSync(new URL(path, out), buf);
  bytes += buf.length;
  thumbs[k] = path;
}
const head = '/* 자동 생성 (scripts/make-media-split.mjs) — 웹사이트판: 사진은 media/ 파일로 따로 받는다 */\n';
writeFileSync(new URL('photos.js', out), `${head}export const PHOTO_FILES = ${JSON.stringify(photos, null, 1)};\n`);
writeFileSync(new URL('thumbs.js', out), `${head}export const THUMBS = ${JSON.stringify(thumbs, null, 1)};\n`);
console.log(`media: ${Object.keys(photos).length} photos + ${Object.keys(thumbs).length} thumbs, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
