import { CABLES, DEVICE_TYPES } from '../engine.js';

/* 케이블 잇기 연습 안내 — GameScreen과 테스트가 함께 쓴다 */
const portLabel = (st, d, p) => {
  const def = DEVICE_TYPES[st.devices[d]?.type];
  return [...(def?.ins ?? []), ...(def?.outs ?? [])].find((x) => x.id === p)?.label ?? p;
};

// 케이블 잇기 연습의 지금 단계: 케이블 → 첫 단자 → 둘째 단자 (어느 쪽 끝부터 눌러도 된다)
export function connectGuide(w, st, cable, pending) {
  if (!w || w.op !== 'connect') return null;
  const [fd, fp] = w.from.split('.');
  const [td, tp] = w.to.split('.');
  if (!st.devices[fd]?.placed || !st.devices[td]?.placed) return null;
  const at = (d, p) => !!pending && pending.d === d && pending.p === p;
  const swap = at(td, tp);
  const A = swap ? { d: td, p: tp } : { d: fd, p: fp };
  const B = swap ? { d: fd, p: fp } : { d: td, p: tp };
  const name = (e) => `${st.devices[e.d]?.name ?? DEVICE_TYPES[st.devices[e.d]?.type]?.name ?? e.d} ${portLabel(st, e.d, e.p)}`;
  const cableOk = cable === w.cable;
  const firstOk = at(A.d, A.p);
  const stage = !cableOk ? 'cable' : firstOk ? 'second' : 'first';
  return {
    stage, cable: w.cable,
    target: firstOk ? B : A,
    wrongPending: !!pending && !at(fd, fp) && !at(td, tp),
    steps: [
      { text: `아래 케이블 가방에서 ${CABLES[w.cable]?.short ?? w.cable} 고르기`, done: cableOk, active: stage === 'cable' },
      { text: `${name(A)} 누르기`, done: firstOk, active: stage === 'first' },
      { text: `${name(B)} 누르기`, done: false, active: stage === 'second' },
    ],
  };
}

