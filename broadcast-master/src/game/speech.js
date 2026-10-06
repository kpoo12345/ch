/* =====================================================================
 * 음성 합성 관리 — 내레이션(튜토리얼·정답 해설)과 무대 위 사람의 말소리(마이크 테스트)
 * 브라우저 speechSynthesis는 한 줄로만 말할 수 있으므로 여기서 순서를 정한다.
 * 내레이션이 우선이고, 내레이션이 끝나면 말소리가 다시 이어진다.
 * ===================================================================== */
export const speechOk = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voice = null;
// 한국어 목소리 중 가장 자연스러운 것을 고른다 (Edge의 Natural/Online, Chrome의 Google, Safari의 Yuna 등)
const voiceScore = (v) => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/yuna|sora|heami|sunhi|injoon|hyunsu/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
const pickVoice = () => {
  if (!speechOk()) return;
  const ko = window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('ko'));
  voice = ko.sort((a, b) => voiceScore(b) - voiceScore(a))[0] ?? null;
};
if (speechOk()) { pickVoice(); window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

const state = { narrating: false, talk: null, talkTimer: null, narrTimer: null, idx: 0, current: null };

function utter(text, { rate = 1.05, volume = 1, pitch = 1 } = {}) {
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = rate; u.volume = volume; u.pitch = pitch;
  if (voice) u.voice = voice;
  return u;
}

// onBoundary(charIndex): 단어를 읽기 시작할 때마다 (지원하는 목소리만) — 글자 표시를 음성에 맞추는 데 쓴다
// onError: 목소리가 없거나 합성이 실패했을 때 (이때는 onEnd를 부르지 않는다 — 부르는 쪽이 시간으로 대신 끝낸다)
export function narrate(text, { rate = 1, onEnd, onBoundary, onError } = {}) {
  if (!speechOk() || !text) { onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  clearTimeout(state.talkTimer);
  clearTimeout(state.narrTimer);
  state.narrating = true;
  const u = utter(text, { rate, volume: 1, pitch: 1 });
  const done = () => { if (state.current === u) { state.narrating = false; state.current = null; onEnd?.(); scheduleTalk(400); } };
  u.onend = done;
  u.onerror = (e) => {
    if (state.current !== u) return;
    if (e?.error === 'interrupted' || e?.error === 'canceled') { done(); return; }
    state.narrating = false; state.current = null;
    if (onError) onError(); else onEnd?.();
    scheduleTalk(400);
  };
  u.onboundary = (e) => { if (state.current === u && typeof e.charIndex === 'number') onBoundary?.(e.charIndex); };
  state.current = u;
  // 일부 브라우저는 cancel 직후 바로 speak하면 말을 시작하지 않는다 → 아주 잠깐 뒤에
  state.narrTimer = setTimeout(() => { if (state.current === u) synth.speak(u); }, 80);
}
export function stopNarration() {
  if (!speechOk()) return;
  if (state.narrating) { state.narrating = false; state.current = null; window.speechSynthesis.cancel(); scheduleTalk(200); }
}

// 무대 위 사람의 말소리: phrases를 돌아가며 말한다. volume 0이면 멈춤
export function setTalk(talk) {
  if (!speechOk()) return;
  const prev = state.talk;
  state.talk = talk && talk.volume > 0.02 ? talk : null;
  const audibleChanged = !!prev !== !!state.talk;
  if (!state.talk) {
    clearTimeout(state.talkTimer);
    if (!state.narrating && state.current?.isTalk) { window.speechSynthesis.cancel(); state.current = null; }
    return;
  }
  if (audibleChanged) scheduleTalk(60);
}
function scheduleTalk(ms) {
  clearTimeout(state.talkTimer);
  state.talkTimer = setTimeout(speakTalk, ms);
}
function speakTalk() {
  const t = state.talk;
  if (!t || state.narrating || !speechOk()) return;
  if (state.current?.isTalk && window.speechSynthesis.speaking) return;
  const phrases = t.phrases ?? ['아, 아, 마이크 테스트.'];
  const u = utter(phrases[state.idx % phrases.length], { rate: 1.05, volume: Math.min(1, t.volume), pitch: t.pitch ?? 1 });
  u.isTalk = true;
  state.idx += 1;
  const next = () => { if (state.current === u) state.current = null; if (state.talk && !state.narrating) scheduleTalk(350); };
  u.onend = next; u.onerror = next;
  state.current = u;
  window.speechSynthesis.speak(u);
}
export function stopAllSpeech() {
  state.talk = null; state.narrating = false; state.current = null; clearTimeout(state.talkTimer);
  if (speechOk()) window.speechSynthesis.cancel();
}
