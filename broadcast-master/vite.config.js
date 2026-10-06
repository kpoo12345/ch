import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → dist/index.html 하나에 JS·CSS가 모두 인라인된 단일 파일 생성
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
});
