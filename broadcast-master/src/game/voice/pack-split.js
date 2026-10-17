/* 웹사이트판(GitHub Pages)용 목소리 묶음 자리 — 처음엔 비어 있고, 파트를 열 때 voice/<묶음>.js를 받아 채운다
 *  (vite.config.js가 BM_VOICE_SPLIT=1일 때 pack.js 대신 이 파일을 쓴다 · 묶음 파일은 scripts/make-voice-split.mjs가 만든다) */
export const VOICE_MIME = 'audio/webm; codecs=opus';
export const VOICE_CREDIT = '음성: Supertonic 3 (Supertone, OpenRAIL-M) · sherpa-onnx로 생성';
export const VOICE_SPLIT = true;
export const VOICE_PACK = {};
