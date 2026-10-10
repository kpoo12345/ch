/* 베타 의견에 함께 보낼 "지금 어디에 있었는지" — 화면들이 바뀔 때마다 적어 둔다 */
/* global __BUILD__ */
// 빌드 표시 (vite.config.js가 날짜·커밋으로 채운다) — 어느 판에서 나온 의견인지 알 수 있게
export const BETA_VERSION = `beta-1${typeof __BUILD__ !== 'undefined' ? ` · ${__BUILD__}` : ''}`;
let ctx = { screen: '메인 메뉴' };
export function setBetaContext(next) { ctx = { ...next }; }
export function patchBetaContext(part) { ctx = { ...ctx, ...part }; }
export function getBetaContext() { return ctx; }

/* 의견 창 열기·열림 상태 — 게임 화면은 머리말 단추로 열고, 열려 있는 동안 제한 시간을 멈춘다 */
const listeners = new Set();
const ui = { open: false, inGame: 0, request: 0 };
const emit = () => listeners.forEach((fn) => fn({ ...ui }));
export function subscribeBeta(fn) { listeners.add(fn); fn({ ...ui }); return () => listeners.delete(fn); }
export function openFeedback() { ui.request += 1; emit(); }
export function setFeedbackOpen(open) { if (ui.open !== open) { ui.open = open; emit(); } }
export function isFeedbackOpen() { return ui.open; }
// 게임 화면이 떠 있는 동안은 왼쪽 가장자리 탭을 숨긴다 (휴대폰에서 조작 단추를 가리지 않게)
export function enterGameScreen() { ui.inGame += 1; emit(); return () => { ui.inGame = Math.max(0, ui.inGame - 1); emit(); }; }

// 마지막 오류 — 의견에 함께 실어 보낸다
let lastError = null;
export function noteError(err) { lastError = String(err?.message ?? err ?? '').slice(0, 300) || null; }
export function getLastError() { return lastError; }
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => noteError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => noteError(e.reason));
}
