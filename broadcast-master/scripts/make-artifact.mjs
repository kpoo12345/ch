// dist/index.html(단일 파일 빌드)을 claude.ai Artifact 형식(doctype/html/head/body 없이 본문만)으로 변환한다.
// 주의: 정규식으로 <meta…>를 지우면 three.js 셰이더의 `#include <metalnessmap_fragment>` 같은 코드까지
// 지워져 3D 재질이 깨진다. 그래서 정확한 문자열만 잘라낸다.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input = 'dist/index.html', output = 'dist/artifact.html'] = process.argv;
const src = readFileSync(input, 'utf8');
const between = (s, a, b) => {
  const i = s.indexOf(a);
  const j = s.lastIndexOf(b);
  if (i < 0 || j < 0) throw new Error(`${a} … ${b} 를 찾을 수 없습니다`);
  return s.slice(i + a.length, j);
};
let head = between(src, '<head>', '</head>');
const body = between(src, '<body>', '</body>');
for (const tag of ['<meta charset="UTF-8" />', '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />']) {
  if (!head.includes(tag)) throw new Error(`메타 태그를 찾을 수 없습니다: ${tag}`);
  head = head.replace(tag, '');
}
// 큰 스크립트(13MB)는 맨 뒤로: 받는 동안 "불러오는 중" 화면과 스타일이 먼저 보이게
const si = head.indexOf('<script type="module"');
if (si < 0) throw new Error('모듈 스크립트를 찾을 수 없습니다');
const se = head.indexOf('</script>', si) + '</script>'.length;
const script = head.slice(si, se);
head = head.slice(0, si) + head.slice(se);
const out = `${head.trim()}\n${body.trim()}\n${script}\n`;
if (!out.includes('#include <metalnessmap_fragment>')) throw new Error('셰이더 코드가 손상되었습니다');
if (out.indexOf('<title>') > 8000) throw new Error('<title>이 앞쪽 8KB 안에 없습니다');
writeFileSync(output, out);
console.log(`${output} (${(out.length / 1024).toFixed(0)} KB)`);
