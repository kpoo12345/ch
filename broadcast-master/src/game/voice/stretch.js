/* =====================================================================
 * 음 높이는 그대로 두고 빠르기만 바꾸기 (WSOLA) — 오디오 요소를 못 쓰는 환경에서 1.5배·2배 재생용
 *  x: Float32Array(모노), rate > 1 이면 빨라진다
 * ===================================================================== */
export function timeStretch(x, sr, rate) {
  if (Math.abs(rate - 1) < 0.01) return x;
  const N = Math.round(sr * 0.04) & ~1; // 40ms 창
  const Hs = N / 2; // 합성 간격
  const Ha = Hs * rate; // 분석 간격
  const tol = Math.round(sr * 0.012); // 맞춰 볼 범위 ±12ms
  const win = new Float32Array(N);
  for (let i = 0; i < N; i += 1) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const outLen = Math.ceil(x.length / rate) + N;
  const y = new Float32Array(outLen);
  const norm = new Float32Array(outLen);
  let prev = 0; // 앞 창이 실제로 쓴 분석 위치
  const step = 4; // 비교는 4샘플마다 (빠르게)
  for (let k = 0; ; k += 1) {
    const ideal = Math.round(k * Ha);
    if (ideal + N >= x.length) break;
    let best = ideal;
    if (k > 0) {
      // 앞 창의 자연스러운 다음 부분(prev + Hs)과 가장 닮은 위치를 고른다
      const nat = prev + Hs;
      let bestC = -Infinity;
      for (let d = -tol; d <= tol; d += 2) {
        const p = ideal + d;
        if (p < 0 || p + N >= x.length || nat + Hs >= x.length) continue;
        let c = 0;
        for (let i = 0; i < Hs; i += step) c += x[nat + i] * x[p + i];
        if (c > bestC) { bestC = c; best = p; }
      }
    }
    const o = k * Hs;
    for (let i = 0; i < N; i += 1) { y[o + i] += x[best + i] * win[i]; norm[o + i] += win[i]; }
    prev = best;
  }
  for (let i = 0; i < outLen; i += 1) if (norm[i] > 1e-3) y[i] /= norm[i];
  // 끝의 빈 부분 잘라내기
  let end = outLen;
  while (end > 0 && norm[end - 1] <= 1e-3) end -= 1;
  return y.subarray(0, end);
}
