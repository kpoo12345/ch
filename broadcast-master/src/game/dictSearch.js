/* =====================================================================
 * 장비 백과사전 검색 — 이름 · 다른 이름 · 본문 · 초성(ㄷㅇㄴㅁ → 다이나믹)
 * ===================================================================== */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const isCho = (c) => CHO.includes(c);
const syl = (c) => { const n = c.charCodeAt(0) - 0xac00; return n >= 0 && n < 11172 ? n : -1; };
const choOf = (c) => { const n = syl(c); return n < 0 ? c : CHO[Math.floor(n / 588)]; };

// 띄어쓰기·기호를 지우고 소문자로
export const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s·\-_/().,'"!?~:+→←↔=]+/g, '');

// 초성이 섞인 검색어도 찾는다 ("ㄷ이나믹", "ㄷㅇㄴㅁ")
function findIn(hay, needle) {
  if (![...needle].some(isCho)) return hay.indexOf(needle);
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length && ok; j++) {
      const n = needle[j]; const h = hay[i + j];
      ok = n === h || (isCho(n) && choOf(h) === n);
    }
    if (ok) return i;
  }
  return -1;
}

// 입력 중인 마지막 글자의 받침을 다음 글자 초성으로도 본다 ("다인" → "다이ㄴ")
function variants(t) {
  const out = [t];
  const last = t[t.length - 1];
  const n = last ? syl(last) : -1;
  if (n >= 0 && n % 28) {
    const jong = JONG[n % 28];
    if (isCho(jong)) out.push(t.slice(0, -1) + String.fromCharCode(0xac00 + n - (n % 28)) + jong);
  }
  return out;
}

const bodyOf = (x) => [
  ...(x.use ?? []), ...(x.connect ?? []), ...(x.key ?? []), ...(x.tips ?? []), ...(x.mistakes ?? []),
  ...(x.specs ?? []).map((r) => r.join(' ')), x.about, ...(x.how ?? []),
].filter(Boolean);

// 항목마다 검색용 문자열을 미리 만들어 둔다
export function buildIndex(items) {
  return items.map((x, order) => ({
    x, order,
    names: [norm(x.title), ...(x.aka ?? []).map(norm)],
    sub: norm(x.subtitle),
    def: norm(x.def),
    body: bodyOf(x).map((raw) => ({ raw, n: norm(raw) })),
  }));
}

// 낮을수록 잘 맞음: 0 제목 앞부분 · 1 제목 · 2 다른 이름 · 3 부제 · 4 정의 · 6 본문
function termRank(e, term) {
  const vs = variants(term);
  const hit = (s) => vs.some((v) => findIn(s, v) >= 0);
  if (vs.some((v) => findIn(e.names[0], v) === 0)) return { r: 0 };
  if (hit(e.names[0])) return { r: 1 };
  if (e.names.slice(1).some(hit)) return { r: 2 };
  if ([...term].some(isCho)) return null; // 초성 검색은 이름에서만
  if (hit(e.sub)) return { r: 3 };
  if (hit(e.def)) return { r: 4 };
  const b = e.body.find((s) => hit(s.n));
  return b ? { r: 6, snippet: b.raw } : null;
}

// 검색: 띄어쓴 낱말이 모두 어딘가에 있어야 한다. 결과는 [{ x, rank, snippet }]
export function searchItems(index, query) {
  const terms = String(query ?? '').trim().split(/\s+/).map(norm).filter(Boolean);
  if (!terms.length) return index.map((e) => ({ x: e.x, rank: 0, snippet: null }));
  const out = [];
  for (const e of index) {
    let rank = 0; let snippet = null; let ok = true;
    for (const t of terms) {
      const m = termRank(e, t);
      if (!m) { ok = false; break; }
      rank += m.r;
      snippet = snippet ?? m.snippet ?? null;
    }
    if (ok) out.push({ x: e.x, rank, snippet, order: e.order });
  }
  return out.sort((a, b) => a.rank - b.rank || a.order - b.order).map(({ order, ...r }) => r);
}
