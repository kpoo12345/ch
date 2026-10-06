/* =====================================================================
 * 음성 합성 관리 — 내레이션(튜토리얼·정답 해설)과 무대 위 사람의 말소리(마이크 테스트)
 * 브라우저 speechSynthesis는 한 줄로만 말할 수 있으므로 여기서 순서를 정한다.
 * 내레이션이 우선이고, 내레이션이 끝나면 말소리가 다시 이어진다.
 * ===================================================================== */
export const speechOk = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let voice = null;
const pickVoice = () => {
  if (!speechOk()) return;
  voice = window.speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('ko')) ?? null;
};
if (speechOk()) { pickVoice(); window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

const state = { narrating: false, talk: null, talkTimer: null, idx: 0, current: null };

function utter(text, { rate = 1.05, volume = 1, pitch = 1 } = {}) {
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = rate; u.volume = volume; u.pitch = pitch;
  if (voice) u.voice = voice;
  return u;
}

export function narrate(text, { rate = 1.08, onEnd } = {}) {
  if (!speechOk() || !text) { onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  clearTimeout(state.talkTimer);
  state.narrating = true;
  const u = utter(text, { rate, volume: 1, pitch: 1.02 });
  const done = () => { if (state.current === u) { state.narrating = false; state.current = null; onEnd?.(); scheduleTalk(400); } };
  u.onend = done; u.onerror = done;
  state.current = u;
  synth.speak(u);
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
