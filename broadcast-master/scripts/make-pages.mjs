// 로그인 없이 누구나 여는 웹사이트(GitHub Pages)용: dist/index.html → 저장소 맨 위 docs/index.html
//  GitHub 저장소 설정 → Pages → "Deploy from a branch" → 이 브랜치 · /docs 폴더를 고르면 공개된다
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';

const src = readFileSync('dist/index.html', 'utf8');
const out = new URL('../../docs/', import.meta.url);
mkdirSync(out, { recursive: true });
// 큰 스크립트(13MB)는 본문 맨 뒤로: 받는 동안 "불러오는 중" 화면이 먼저 보이게
const si = src.indexOf('<script type="module"');
const se = src.indexOf('</script>', si) + '</script>'.length;
if (si < 0 || se < si) throw new Error('모듈 스크립트를 찾을 수 없습니다');
const script = src.slice(si, se);
let html = src.slice(0, si) + src.slice(se);
// (함수로 넘긴다: 스크립트 안의 $' 같은 글자를 replace가 특수 기호로 읽지 않게)
const end = html.lastIndexOf('</body>');
if (end < 0) throw new Error('</body>를 찾을 수 없습니다');
html = `${html.slice(0, end)}${script}\n  ${html.slice(end)}`;
// 베타 동안은 검색 엔진에 올리지 않는다
const marked = html.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta name="robots" content="noindex" />');
if (marked === html) throw new Error('charset 메타 태그를 찾을 수 없습니다');
html = marked;
if (html.indexOf('id="root"') > html.indexOf('<script type="module"')) throw new Error('스크립트가 본문 앞에 있습니다');
if (Math.abs(html.length - src.length) > 200) throw new Error(`크기가 이상하게 바뀌었습니다 (${src.length} → ${html.length})`);
writeFileSync(new URL('index.html', out), html);
writeFileSync(new URL('.nojekyll', out), '');
// 목소리 묶음 (BM_VOICE_SPLIT=1로 만든 경우): dist/voice → docs/voice
rmSync(new URL('voice/', out), { recursive: true, force: true });
if (existsSync('dist/voice')) cpSync('dist/voice', new URL('voice/', out), { recursive: true });
// 사진·3D 스틸 (make-media-split.mjs): .split/media → docs/media
rmSync(new URL('media/', out), { recursive: true, force: true });
if (existsSync('.split/media')) cpSync('.split/media', new URL('media/', out), { recursive: true });
console.log(`docs/index.html (${(html.length / 1024).toFixed(0)} KB)`);
