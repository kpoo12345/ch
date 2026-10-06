/* =====================================================================
 * 오디오 엔진 (Web Audio)
 *  - 배경음악(BGM): 메뉴·게임용 로파이 음악을 실시간으로 합성 (외부 파일 없음)
 *  - 무대 소리: 기타·키보드·드럼·노트북 BGM을 시뮬레이션 결과대로 "듣는 위치"에 들려 준다
 *    (험·얇은 소리·클리핑 왜곡·리버브까지 반영)
 *  - 효과음: 하울링, 험, 지직거림
 * 첫 클릭(사용자 제스처) 뒤에 unlock()을 호출해야 소리가 난다.
 * ===================================================================== */

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI → Hz
// 코드 진행 (C장조): Cmaj7 · Am7 · Fmaj7 · G7  (MIDI 음)
const CHORDS = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 53, 59]];
const BASS = [36, 33, 29, 31];
const MELODY = [76, null, 74, 72, null, 67, 69, null, 72, null, 71, 67, null, 64, 67, null];

let engine = null;
export function getAudio() {
  if (!engine) engine = new AudioEngine();
  return engine;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.bgmVol = 0.5; this.bgmOn = true; this.sfxOn = true; this.duck = 1;
    this.song = 'menu';
    this.stage = { guitar: 0, keys: 0, drums: 0, laptop: 0, hum: 0, thin: 0, clip: 0, reverb: 0, feedback: 0 };
    this.step = 0; this.nextTime = 0; this.timer = null;
  }
  unlock() {
    if (!this.ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
      this.bgmBus = ctx.createGain(); this.bgmBus.gain.value = 0; this.bgmBus.connect(this.master);
      this.stageBus = ctx.createGain(); this.stageBus.gain.value = 1;
      // 무대 소리: 얇은 소리(하이패스) → 왜곡(클리핑) → 메인 + 리버브
      this.stageHP = ctx.createBiquadFilter(); this.stageHP.type = 'highpass'; this.stageHP.frequency.value = 20;
      this.shaper = ctx.createWaveShaper(); this.setDrive(0);
      this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0;
      this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.4);
      this.stageBus.connect(this.stageHP).connect(this.shaper).connect(this.master);
      this.shaper.connect(this.verbSend).connect(this.verb).connect(this.master);
      // 트랙별 게인
      this.tracks = {};
      ['guitar', 'keys', 'drums', 'laptop'].forEach((k) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.stageBus); this.tracks[k] = g; });
      // 험 (60Hz + 배음)
      this.humGain = ctx.createGain(); this.humGain.gain.value = 0; this.humGain.connect(this.master);
      [60, 120, 180, 240].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = [0.5, 0.3, 0.18, 0.1][i]; o.connect(g).connect(this.humGain); o.start(); });
      // 하울링
      this.fbGain = ctx.createGain(); this.fbGain.gain.value = 0; this.fbGain.connect(this.master);
      const fo = ctx.createOscillator(); fo.frequency.value = 2480; const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 22;
      lfo.connect(lg).connect(fo.frequency); fo.connect(this.fbGain); fo.start(); lfo.start();
      this.noise = this.noiseBuffer();
      this.nextTime = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 25);
      this.applyBgm();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  impulse(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) { const d = b.getChannelData(c); for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    return b;
  }
  noiseBuffer() {
    const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return b;
  }
  setDrive(amount) {
    const n = 1024, curve = new Float32Array(n), k = amount * 60;
    for (let i = 0; i < n; i += 1) { const x = (i * 2) / n - 1; curve[i] = k > 0 ? ((1 + k) * x) / (1 + k * Math.abs(x)) : x; }
    if (this.shaper) this.shaper.curve = curve;
  }

  /* ----- 설정 ----- */
  setBgm({ on, volume } = {}) { if (on != null) this.bgmOn = on; if (volume != null) this.bgmVol = volume; this.applyBgm(); }
  setSong(song) { this.song = song; }
  setSfx(on) { this.sfxOn = on; if (!on) this.setStage({}); }
  applyBgm() {
    if (!this.ctx) return;
    const v = this.bgmOn ? this.bgmVol * 0.32 * this.duck : 0;
    this.bgmBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  }
  // 무대 소리 상태 (0~1). 값이 있으면 BGM은 자동으로 줄어든다
  setStage(s) {
    this.stage = { guitar: 0, keys: 0, drums: 0, laptop: 0, hum: 0, thin: 0, clip: 0, reverb: 0, feedback: 0, ...s };
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = this.sfxOn;
    Object.entries(this.tracks).forEach(([k, g]) => g.gain.setTargetAtTime(on ? (this.stage[k] ?? 0) * 0.5 : 0, t, 0.08));
    this.humGain.gain.setTargetAtTime(on ? this.stage.hum * 0.06 : 0, t, 0.1);
    this.fbGain.gain.setTargetAtTime(on ? this.stage.feedback * 0.05 : 0, t, 0.15);
    this.stageHP.frequency.setTargetAtTime(this.stage.thin > 0 ? 900 : 20, t, 0.1);
    this.verbSend.gain.setTargetAtTime(this.stage.reverb * 0.8, t, 0.1);
    this.setDrive(on ? this.stage.clip : 0);
    const loud = Math.max(this.stage.guitar, this.stage.keys, this.stage.drums, this.stage.laptop);
    this.duck = loud > 0.05 ? 0.25 : 1;
    this.applyBgm();
  }

  /* ----- 시퀀서 ----- */
  schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const bpm = 86, spb = 60 / bpm / 4; // 16분음표
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }
  playStep(step, t, spb) {
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const chord = CHORDS[bar];
    // ---- BGM (배경음악) ----
    const bgm = this.bgmBus;
    if (this.song === 'menu' || this.song === 'game') {
      if (s === 0 || s === 8) chord.forEach((n, i) => this.pad(bgm, NOTE(n + 12), t + i * 0.012, spb * 7.5, 0.035));
      if (s % 4 === 0) this.bassNote(bgm, NOTE(BASS[bar]), t, spb * 3, 0.12);
      if (s === 0 || s === 10) this.kick(bgm, t, 0.5);
      if (s === 4 || s === 12) this.snare(bgm, t, 0.18);
      if (s % 2 === 0) this.hat(bgm, t, s % 4 === 2 ? 0.05 : 0.03);
      const m = MELODY[s];
      if (this.song === 'menu' && m && (bar % 2 === 0)) this.pluck(bgm, NOTE(m), t, spb * 2, 0.05, 'triangle');
      if (this.song === 'game' && m && bar === 3 && s < 8) this.pluck(bgm, NOTE(m - 12), t, spb * 2, 0.035, 'triangle');
    }
    // ---- 무대 악기 (시뮬레이션 레벨로 볼륨 조절) ----
    if (this.stage.drums > 0 || this.stage.guitar > 0 || this.stage.keys > 0) {
      if (s === 0 || s === 6 || s === 8) this.kick(this.tracks.drums, t, 0.9);
      if (s === 4 || s === 12) this.snare(this.tracks.drums, t, 0.5);
      if (s % 2 === 0) this.hat(this.tracks.drums, t, 0.12);
      if (s % 2 === 0) this.pluck(this.tracks.guitar, NOTE(chord[s % 4 === 0 ? 1 : 2] + 12), t, spb * 1.6, 0.16, 'sawtooth', 1800);
      if (s === 0 || s === 8) chord.forEach((n, i) => this.pad(this.tracks.keys, NOTE(n + 12), t + i * 0.01, spb * 7, 0.09, 'triangle'));
    }
    if (this.stage.laptop > 0) {
      if (s === 0) chord.forEach((n) => this.pad(this.tracks.laptop, NOTE(n + 24), t, spb * 15, 0.05, 'sine'));
      const m = MELODY[s];
      if (m) this.pluck(this.tracks.laptop, NOTE(m), t, spb * 2.5, 0.12, 'sine');
    }
  }
  env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  pad(out, f, t, dur, vol, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  pluck(out, f, t, dur, vol, type = 'triangle', cutoff = 3000) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(400, t + dur);
    this.env(g, t, 0.005, dur, vol);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  bassNote(out, f, t, dur, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 380;
    this.env(g, t, 0.01, dur, vol);
    o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  kick(out, t, vol) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.003, 0.22, vol);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
  }
  snare(out, t, vol) {
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), bp = ctx.createBiquadFilter();
    src.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    this.env(g, t, 0.002, 0.16, vol);
    src.connect(bp).connect(g).connect(out); src.start(t, Math.random() * 0.5, 0.2);
  }
  hat(out, t, vol) {
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    src.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 7000;
    this.env(g, t, 0.001, 0.05, vol);
    src.connect(hp).connect(g).connect(out); src.start(t, Math.random() * 0.5, 0.08);
  }

  /* ----- 효과음 ----- */
  blip(freq, dur = 0.1, type = 'sine', vol = 0.08, when = 0) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; this.env(g, t, 0.01, dur, vol);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  ok() { this.blip(880, 0.1); this.blip(1320, 0.16, 'sine', 0.08, 0.08); }
  error() { this.blip(130, 0.22, 'square', 0.04); }
  plug() { this.blip(70, 0.12, 'sine', 0.3); this.blip(2400, 0.02, 'square', 0.03, 0.02); }
  click() { this.blip(1800, 0.03, 'square', 0.02); }
  clear() { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.28, 'triangle', 0.08, i * 0.12)); }
  star() { [784, 988, 1175].forEach((f, i) => this.blip(f, 0.18, 'triangle', 0.07, i * 0.09)); }
}
