/* =====================================================================
 * 화면 ↔ 주소 (history)
 *  화면을 history에 쌓아 휴대폰 '뒤로' 버튼이 게임 안에서 이전 화면으로 가게 한다
 *  주소로 바로 가기: ?stage=light-2 (?auto=1 이면 정답 자동 진행) · ?story · ?tutorial=1 · ?tutorial · ?dict=dynamic_mic · ?dict · ?studio
 *  게임이 쓰는 주소 키만 바꾸고, 다른 쿼리·해시(호스팅 쪽에서 붙인 것)는 그대로 둔다 (메뉴 = 게임 키가 없는 주소)
 * ===================================================================== */
const OUR_KEYS = ['dict', 'tutorial', 'stage', 'story', 'studio', 'auto'];

// 주소 → 화면 { mode, part?, stage?, entry?, auto? }
export function screenFromUrl(search) {
  const q = new URLSearchParams(search ?? '');
  const stage = q.get('stage');
  if (q.has('tutorial')) { const n = Number(q.get('tutorial')); return { mode: 'tutorial', part: n >= 1 ? n - 1 : undefined }; }
  if (q.has('dict')) return { mode: 'dict', entry: q.get('dict') || null };
  if (q.has('studio')) return { mode: 'studio' };
  if (stage || q.has('story')) return { mode: 'story', stage: stage || null, auto: q.get('auto') === '1' };
  return { mode: 'menu' };
}

// 화면 → 주소 (loc: { pathname, search, hash })
export function urlOf(s, loc) {
  const q = new URLSearchParams(loc.search);
  OUR_KEYS.forEach((k) => q.delete(k));
  if (s.mode === 'dict') q.set('dict', s.entry ?? '');
  else if (s.mode === 'tutorial') q.set('tutorial', s.part != null ? String(s.part + 1) : '');
  else if (s.mode === 'story') { if (s.stage) q.set('stage', s.stage); else q.set('story', ''); }
  else if (s.mode === 'studio') q.set('studio', '');
  const str = q.toString().replace(/=(?=&|$)/g, ''); // ?dict= → ?dict
  return `${loc.pathname}${str ? `?${str}` : ''}${loc.hash}`;
}

export function writeHistory(s, replace) {
  const state = { bm: 1, mode: s.mode, part: s.part ?? null, stage: s.stage ?? null, entry: s.entry ?? null, back: s.back ?? null, depth: s.depth ?? 0 };
  const fn = replace ? 'replaceState' : 'pushState';
  // 주소를 바꿀 수 없는 환경(샌드박스 iframe 등)이면 상태만 쌓는다
  try { window.history[fn](state, '', urlOf(s, window.location)); } catch { try { window.history[fn](state, ''); } catch { /* history 없음 */ } }
}

export const sameScreen = (a, b) => !!a && !!b && a.mode === b.mode && (a.entry ?? null) === (b.entry ?? null) && (a.part ?? null) === (b.part ?? null) && (a.stage ?? null) === (b.stage ?? null);
// 한 단계 위 화면: 백과사전 항목 → 목록, 스토리 미션 → 미션 목록, 튜토리얼 파트 → 파트 목록
export const parentOf = (s) => (s.mode === 'dict' && s.entry ? { mode: 'dict' } : s.mode === 'story' && s.stage ? { mode: 'story' } : s.mode === 'tutorial' && s.part != null ? { mode: 'tutorial' } : null);
// 같은 화면 안에서 항목·미션·파트만 바뀌면 다시 만들지 않는다 (검색어·체크 상태가 남게)
export const KEEP = new Set(['dict', 'story', 'tutorial']);
