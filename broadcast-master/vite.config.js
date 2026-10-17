import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 웹사이트판(BM_VOICE_SPLIT=1): 목소리 묶음을 HTML에 넣지 않고 파트별 파일로 따로 받는다 (첫 화면이 훨씬 빨리 뜬다)
const voiceSplit = process.env.BM_VOICE_SPLIT === '1';

// 빌드 표시: 날짜(UTC) + 커밋 — 베타 의견이 어느 판에서 왔는지 알 수 있게
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'dev'; } })();
const BUILD = `${new Date().toISOString().slice(0, 10)} ${commit}`;

// `npm run build` → dist/index.html 하나에 JS·CSS가 모두 인라인된 단일 파일 생성
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { __BUILD__: JSON.stringify(BUILD) },
  resolve: {
    alias: voiceSplit ? [{ find: /^\.\/voice\/pack\.js$/, replacement: fileURLToPath(new URL('./src/game/voice/pack-split.js', import.meta.url)) }] : [],
  },
});
