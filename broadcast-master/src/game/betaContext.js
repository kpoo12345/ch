/* 베타 의견에 함께 보낼 "지금 어디에 있었는지" — 화면들이 바뀔 때마다 적어 둔다 */
export const BETA_VERSION = 'beta-1';
let ctx = { screen: '메인 메뉴' };
export function setBetaContext(next) { ctx = { ...next }; }
export function patchBetaContext(part) { ctx = { ...ctx, ...part }; }
export function getBetaContext() { return ctx; }
