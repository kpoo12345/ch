/* =====================================================================
 * 음성 합성 관리 — 내레이션(튜토리얼·정답 해설)과 무대 위 사람의 말소리(마이크 테스트)
 * 브라우저 speechSynthesis는 한 줄로만 말할 수 있으므로 여기서 순서를 정한다.
 * 내레이션이 우선이고, 내레이션이 끝나면 말소리가 다시 이어진다.
 * ===================================================================== */
import { VOICE_PACK, VOICE_MIME } from './voice/pack.js';
import { ttsText, lineKey } from './voice/pronounce.js';
import { timeStretch } from './voice/stretch.js';
import { getAudio } from './audio.js';

export const speechOk = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/* ---------- 미리 녹음한 내레이션 (사람 같은 목소리) ----------
 *  1순위: <audio> 요소(빠르기를 바꿔도 음 높이가 그대로)
 *  2순위: Web Audio로 직접 재생(빠르기는 WSOLA로 늘이고 줄인다)
 *  둘 다 안 되면 브라우저 음성 합성 */
const clipEntry = (who, text) => VOICE_PACK[lineKey(who, text)] ?? null;
let decodeFails = 0; // 녹음을 풀지 못한 횟수 — 두 번 실패하면 이 브라우저는 합성 음성으로만 읽는다
export const hasClip = (who, text) => decodeFails < 2 && !!clipEntry(who, text);
let elementOk = null; // <audio>로 재생이 되는지 (한 번 실패하면 Web Audio로)
// 지금 내레이션이 어떤 길로 나오는지 (베타 의견에 함께 보낸다)
export const audioPath = () => (decodeFails >= 2 ? '합성 음성' : elementOk === true ? 'audio 요소' : elementOk === false ? 'Web Audio' : '아직 안 틂');
// claude.ai 안처럼 blob: 소리를 막아 둔 곳이면 처음부터 Web Audio로 (첫 대사가 두 번 나오지 않게)
if (typeof document !== 'undefined') {
  document.addEventListener('securitypolicyviolation', (ev) => { if (/^blob/.test(ev.blockedURI ?? '') || /media-src/.test(ev.effectiveDirective ?? ev.violatedDirective ?? '')) elementOk = false; });
}
const blobUrls = new Map();
const bytesOf = (b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i); return u8; };
const urlOf = (e) => { let u = blobUrls.get(e); if (!u) { u = URL.createObjectURL(new Blob([bytesOf(e[0])], { type: VOICE_MIME.split(';')[0] })); blobUrls.set(e, u); } return u; };
// 푼 녹음은 최근 몇 개만 들고 있는다 (한 파트를 다 들으면 수십 MB라 휴대폰에서 탭이 꺼질 수 있다)
const DECODED_KEEP = 4;
const decoded = new Map(); // e → Promise<{ data: Float32Array, sr }> (오래 안 쓴 것부터 버린다)
const decodeClip = (e) => {
  let p = decoded.get(e);
  if (p) { decoded.delete(e); decoded.set(e, p); return p; }
  const au = getAudio(); au.unlock?.();
  const ctx = au.ctx;
  p = ctx ? ctx.decodeAudioData(bytesOf(e[0]).buffer).then((b) => ({ data: b.getChannelData(0), sr: b.sampleRate })) : Promise.reject(new Error('no audio context'));
  p.catch(() => { decoded.delete(e); });
  decoded.set(e, p);
  while (decoded.size > DECODED_KEEP) decoded.delete(decoded.keys().next().value);
  return p;
};

let voice = null;
// 한국어 목소리 중 가장 자연스러운 것을 고른다 (Edge의 Natural/Online, Chrome의 Google, Safari의 Yuna 등)
const voiceScore = (v) => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/yuna|sora|heami|sunhi|injoon|hyunsu/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
const pickVoice = () => {
  if (!speechOk()) return;
  const ko = window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('ko'));
  voice = ko.sort((a, b) => voiceScore(b) - voiceScore(a))[0] ?? null;
};
if (speechOk()) { pickVoice(); window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

const state = { narrating: false, talk: null, talkTimer: null, narrTimer: null, idx: 0, current: null, clip: null };
// 내레이션 중에는 무대 말소리(녹음)를 줄인다
let ducked = false;
const duck = (d) => { if (ducked === d) return; ducked = d; try { getAudio().duckVoice?.(d); } catch { /* 소리 엔진 없음 */ } };

function utter(text, { rate = 1.05, volume = 1, pitch = 1 } = {}) {
  const u = new window.SpeechSynthesisUtterance(ttsText(text));
  u.lang = 'ko-KR'; u.rate = rate; u.volume = volume; u.pitch = pitch;
  if (voice) u.voice = voice;
  return u;
}

// onBoundary(charIndex): 단어를 읽기 시작할 때마다 (지원하는 목소리만) — 글자 표시를 음성에 맞추는 데 쓴다
// onError: 목소리가 없거나 합성이 실패했을 때 (이때는 onEnd를 부르지 않는다 — 부르는 쪽이 시간으로 대신 끝낸다)
// onStart: 실제로 소리가 나기 시작할 때 (글자 표시 시간을 여기서부터 잰다)
// onProgress(frac): 녹음 재생 위치 (0~1) — 글자 표시를 소리에 정확히 맞춘다
export function narrate(text, { who = 'senior', rate = 1, onEnd, onBoundary, onError, onStart, onProgress } = {}) {
  const e = text ? clipEntry(who, text) : null;
  if (e) { stopClip(); if (speechOk()) { state.current = null; window.speechSynthesis.cancel(); } clearTimeout(state.talkTimer); clearTimeout(state.narrTimer); playClip(e, { rate, onEnd, onStart, onProgress, onError }); return; }
  stopClip();
  if (!speechOk() || !text) { onEnd?.(); return; }
  const synth = window.speechSynthesis;
  // 먼저 지금 말을 "끝난 것"으로 표시한 뒤 끊는다 — 사파리처럼 cancel 때 바로 끝 신호를 주는 브라우저에서 앞 대사가 다음 단계를 끝내지 않게
  state.current = null;
  synth.cancel();
  clearTimeout(state.talkTimer);
  clearTimeout(state.narrTimer);
  state.narrating = true; duck(true);
  const u = utter(text, { rate, volume: 1, pitch: who === 'junior' ? 1.12 : 0.98 });
  // 음성 합성은 읽기용 문장(ttsText)을 읽으므로, 글자 위치는 비율로 화면 문장에 옮긴다
  const spoken = u.text.length || 1;
  const done = () => { if (state.current === u) { state.narrating = false; duck(false); state.current = null; onEnd?.(); scheduleTalk(400); } };
  u.onend = done;
  u.onstart = () => { if (state.current === u) onStart?.(); };
  u.onerror = (e) => {
    if (state.current !== u) return;
    if (e?.error === 'interrupted' || e?.error === 'canceled') { done(); return; }
    state.narrating = false; duck(false); state.current = null;
    if (onError) onError(); else onEnd?.();
    scheduleTalk(400);
  };
  u.onboundary = (ev) => { if (state.current === u && typeof ev.charIndex === 'number') onBoundary?.(Math.round((ev.charIndex / spoken) * text.length)); };
  state.current = u;
  // 일부 브라우저는 cancel 직후 바로 speak하면 말을 시작하지 않는다 → 아주 잠깐 뒤에
  state.narrTimer = setTimeout(() => { if (state.current === u) synth.speak(u); }, 80);
}
export function stopNarration() {
  if (state.clip) { stopClip(); scheduleTalk(200); }
  if (!speechOk()) return;
  if (state.narrating) { state.narrating = false; duck(false); state.current = null; window.speechSynthesis.cancel(); scheduleTalk(200); }
}

/* 녹음 재생 */
function playClip(e, { rate, onEnd, onStart, onProgress, onError }) {
  const clip = { e, rate, onEnd, onStart, onProgress, onError, ended: false, el: null, node: null, raf: 0, pos: 0, t0: 0, buf: null };
  state.clip = clip; state.narrating = true; duck(true);
  const finish = () => { if (state.clip !== clip || clip.ended) return; clip.ended = true; onProgress?.(1); stopClip(); onEnd?.(); scheduleTalk(400); };
  clip.finish = finish;
  const tickEl = () => { if (state.clip !== clip) return; const d = clip.el.duration; if (d > 0) onProgress?.(Math.min(1, clip.el.currentTime / d)); clip.raf = requestAnimationFrame(tickEl); };
  const viaWebAudio = () => {
    // <audio> 오류와 play() 거절이 둘 다 오면 두 번 불린다 — 한 번만 (같은 대사가 겹쳐 나오지 않게)
    if (clip.wa) return;
    clip.wa = true;
    elementOk = false;
    if (clip.el) { const el = clip.el; el.onended = null; el.onerror = null; el.onplaying = null; try { el.pause(); } catch { /* 이미 멈춤 */ } clip.el = null; }
    decodeClip(e).then((b) => { if (state.clip !== clip) return; clip.buf = b; startNode(clip, 0); onStart?.(); }).catch(() => {
      decodeFails += 1;
      if (state.clip !== clip) return;
      state.clip = null; state.narrating = false; duck(false);
      if (onError) onError(); else onEnd?.();
    });
  };
  if (elementOk === false || typeof Audio === 'undefined') { viaWebAudio(); return; }
  const el = new Audio();
  clip.el = el;
  el.preservesPitch = true; el.mozPreservesPitch = true; el.webkitPreservesPitch = true;
  el.src = urlOf(e);
  el.playbackRate = rate;
  el.onended = finish;
  el.onerror = () => { if (state.clip === clip && !clip.ended && el.currentTime === 0) { el.onerror = null; el.onended = null; viaWebAudio(); } };
  el.onplaying = () => { if (state.clip !== clip) return; elementOk = true; onStart?.(); cancelAnimationFrame(clip.raf); clip.raf = requestAnimationFrame(tickEl); };
  el.play().catch((err) => {
    if (state.clip !== clip) return;
    // 자동 재생 막힘(사용자 조작 전)이면 합성 음성도 마찬가지라 시간으로 넘어간다
    if (err?.name === 'NotAllowedError') { state.clip = null; state.narrating = false; duck(false); if (onError) onError(); else onEnd?.(); return; }
    el.onerror = null; el.onended = null; viaWebAudio();
  });
}
// Web Audio: pos(원래 시간, 초)부터 지금 빠르기로
function startNode(clip, pos) {
  const au = getAudio(); const ctx = au.ctx;
  if (!ctx || !clip.buf) return;
  const { data, sr } = clip.buf;
  const from = Math.min(data.length - 1, Math.max(0, Math.round(pos * sr)));
  const y = timeStretch(data.subarray(from), sr, clip.rate);
  const b = ctx.createBuffer(1, Math.max(1, y.length), sr); b.copyToChannel(y, 0);
  const node = ctx.createBufferSource(); node.buffer = b; node.connect(ctx.destination);
  const total = data.length / sr;
  clip.node = node; clip.pos = pos; clip.t0 = ctx.currentTime;
  node.onended = () => { if (state.clip === clip && clip.node === node) clip.finish(); };
  node.start();
  const tick = () => { if (state.clip !== clip || clip.node !== node) return; clip.onProgress?.(Math.min(1, (pos + (ctx.currentTime - clip.t0) * clip.rate) / total)); clip.raf = requestAnimationFrame(tick); };
  cancelAnimationFrame(clip.raf); clip.raf = requestAnimationFrame(tick);
}
function stopClip() {
  const c = state.clip;
  if (!c) return;
  state.clip = null; state.narrating = false; duck(false);
  cancelAnimationFrame(c.raf);
  if (c.el) { c.el.onended = null; c.el.onerror = null; c.el.onplaying = null; try { c.el.pause(); } catch { /* 이미 멈춤 */ } }
  if (c.node) { c.node.onended = null; try { c.node.stop(); } catch { /* 이미 멈춤 */ } }
}
// 녹음 재생 중이면 빠르기만 바꾼다 (처음부터 다시 읽지 않는다). 녹음이 아니면 false
export function setNarrationRate(rate) {
  const c = state.clip;
  if (!c || c.ended) return false;
  if (c.el) { c.el.playbackRate = rate; c.rate = rate; return true; }
  if (c.node && c.buf) {
    const ctx = getAudio().ctx;
    const pos = c.pos + (ctx.currentTime - c.t0) * c.rate;
    const old = c.node; old.onended = null; try { old.stop(); } catch { /* 이미 멈춤 */ }
    c.rate = rate; startNode(c, pos);
    return true;
  }
  c.rate = rate; // 아직 디코딩 중: 시작할 때 이 빠르기로
  return true;
}
// 지금 녹음의 남은 시간(ms, 지금 빠르기 기준)과 진행 비율
export function clipStatus() {
  const c = state.clip;
  if (!c || c.ended) return null;
  const dur = c.e[1] / 1000;
  let t = 0;
  if (c.el) t = c.el.currentTime;
  else if (c.node) t = c.pos + (getAudio().ctx.currentTime - c.t0) * c.rate;
  return { frac: Math.min(1, t / dur), remainMs: Math.max(0, ((dur - t) * 1000) / c.rate) };
}

// 무대 위 사람의 말소리: phrases를 돌아가며 말한다. volume 0이면 멈춤
export function setTalk(talk) {
  // 녹음해 둔 말이면 무대 소리 체인으로 (채널 EQ·클리핑·울림이 실제로 들린다)
  const au = getAudio();
  const who = talk?.who ?? 'talk_m';
  if (talk?.phrases?.length && au.ctx && talk.phrases.every((p) => clipEntry(who, p))) {
    if (state.talk) { state.talk = null; clearTimeout(state.talkTimer); if (!state.narrating && state.current?.isTalk && speechOk()) { window.speechSynthesis.cancel(); state.current = null; } }
    au.setVoice({ active: talk.volume > 0.02, volume: talk.volume, eq: talk.eq, clips: talk.phrases.map((p) => ({ key: lineKey(who, p), bytes: () => bytesOf(clipEntry(who, p)[0]) })) });
    return;
  }
  au.setVoice?.(null);
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
  stopClip();
  state.talk = null; state.narrating = false; duck(false); state.current = null; clearTimeout(state.talkTimer);
  try { getAudio().setVoice?.(null); } catch { /* 소리 엔진 없음 */ }
  if (speechOk()) window.speechSynthesis.cancel();
}
