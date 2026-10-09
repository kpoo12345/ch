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
// 무대 트랙: 악기·드럼 부분별로 따로 크기를 조절한다 (마이크로 잡은 부분만 방송에 들린다)
const TRACKS = ['guitar', 'keys', 'kick', 'snare', 'hats', 'piano', 'bass', 'laptop'];
const STAGE0 = { guitar: 0, keys: 0, kick: 0, snare: 0, hats: 0, piano: 0, bass: 0, laptop: 0, hum: 0, thin: 0, clip: 0, reverb: 0, feedback: 0 };

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
    this.stage = { ...STAGE0 };
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
      // 무대 위 말소리(녹음): 채널 LOW CUT · LOW · MID · HIGH → 무대 체인 (클리핑·울림·얇은 소리가 그대로 들린다)
      this.vGain = ctx.createGain(); this.vGain.gain.value = 0;
      this.vHpf = ctx.createBiquadFilter(); this.vHpf.type = 'highpass'; this.vHpf.frequency.value = 20;
      this.vLow = ctx.createBiquadFilter(); this.vLow.type = 'lowshelf'; this.vLow.frequency.value = 140;
      this.vMid = ctx.createBiquadFilter(); this.vMid.type = 'peaking'; this.vMid.frequency.value = 1000; this.vMid.Q.value = 0.9;
      this.vHigh = ctx.createBiquadFilter(); this.vHigh.type = 'highshelf'; this.vHigh.frequency.value = 5500;
      this.vGain.connect(this.vHpf).connect(this.vLow).connect(this.vMid).connect(this.vHigh).connect(this.stageBus);
      this.voiceBufs = new Map(); this.voiceIdx = 0;
      this.shaper.connect(this.verbSend).connect(this.verb).connect(this.master);
      // 트랙별 게인
      this.tracks = {};
      TRACKS.forEach((k) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.stageBus); this.tracks[k] = g; });
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
  setSfx(on) { this.sfxOn = on; if (!on) this.setStage({}); if (this.voiceSpec) this.setVoice(this.voiceSpec); }
  applyBgm() {
    if (!this.ctx) return;
    const v = this.bgmOn ? this.bgmVol * 0.32 * this.duck : 0;
    this.bgmBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.4);
  }
  // 무대 소리 상태 (0~1). 값이 있으면 BGM은 자동으로 줄어든다
  setStage(s) {
    // 예전 이름: drums → 킥·스네어·하이햇 모두
    const d = s.drums ?? 0;
    this.stage = { ...STAGE0, kick: d, snare: d, hats: d, ...s };
    if (!this.ctx) return;
    const t = this.ctx.currentTime, on = this.sfxOn;
    Object.entries(this.tracks).forEach(([k, g]) => g.gain.setTargetAtTime(on ? (this.stage[k] ?? 0) * 0.5 : 0, t, 0.08));
    this.humGain.gain.setTargetAtTime(on ? this.stage.hum * 0.06 : 0, t, 0.1);
    this.fbGain.gain.setTargetAtTime(on ? this.stage.feedback * 0.05 : 0, t, 0.15);
    this.stageHP.frequency.setTargetAtTime(this.stage.thin > 0 ? 900 : 20, t, 0.1);
    this.verbSend.gain.setTargetAtTime(this.stage.reverb * 0.8, t, 0.1);
    this.setDrive(on ? this.stage.clip : 0);
    const loud = Math.max(...TRACKS.map((k) => this.stage[k] ?? 0));
    this.duck = loud > 0.05 ? 0.25 : 1;
    this.applyBgm();
  }

  /* ----- 무대 위 말소리 (녹음) ----- */
  // v: { active, volume(0~1), eq: { high, mid, freq, low, lowCut }, clips: [{ key, bytes() }] } | null
  setVoice(v) {
    this.voiceSpec = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const on = this.sfxOn && !!v?.active;
    this.vGain.gain.setTargetAtTime(on ? v.volume * (this.voiceDucked ? 0.22 : 1) * 0.95 : 0, t, 0.05);
    const eq = v?.eq ?? {};
    this.vHpf.frequency.setTargetAtTime(eq.lowCut ? 110 : 20, t, 0.05);
    this.vLow.gain.setTargetAtTime(eq.low ?? 0, t, 0.05);
    this.vMid.gain.setTargetAtTime(eq.mid ?? 0, t, 0.05);
    this.vMid.frequency.setTargetAtTime(eq.freq ?? 1000, t, 0.05);
    this.vHigh.gain.setTargetAtTime(eq.high ?? 0, t, 0.05);
    if (on && !this.voicePlaying) this.nextPhrase();
  }
  // 튜토리얼 내레이션이 나오는 동안 무대 말소리를 줄인다
  duckVoice(d) { if (this.voiceDucked === d) return; this.voiceDucked = d; if (this.voiceSpec) this.setVoice(this.voiceSpec); }
  async nextPhrase() {
    const v = this.voiceSpec;
    if (!v?.active || !v.clips?.length || !this.sfxOn || !this.ctx) { this.voicePlaying = false; return; }
    this.voicePlaying = true;
    const c = v.clips[this.voiceIdx % v.clips.length];
    this.voiceIdx += 1;
    let buf = this.voiceBufs.get(c.key);
    if (!buf) {
      try { const b = c.bytes(); buf = await this.ctx.decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); this.voiceBufs.set(c.key, buf); } catch { this.voicePlaying = false; return; }
    }
    if (!this.voiceSpec?.active) { this.voicePlaying = false; return; }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.vGain);
    src.onended = () => { setTimeout(() => this.nextPhrase(), 420); };
    src.start();
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
    // ---- 무대 악기 (시뮬레이션 레벨로 볼륨 조절) — 밴드가 같은 박자로 연주한다 ----
    const S = this.stage;
    const band = ['guitar', 'keys', 'kick', 'snare', 'hats', 'piano', 'bass'].some((k) => S[k] > 0);
    if (band) {
      if (s === 0 || s === 6 || s === 8) this.kick(this.tracks.kick, t, 0.9);
      if (s === 4 || s === 12) this.snare(this.tracks.snare, t, 0.55);
      if (s % 2 === 0) this.hat(this.tracks.hats, t, s % 4 === 2 ? 0.16 : 0.1);
      if (s === 0 && bar === 0) this.crash(this.tracks.hats, t, 0.18);
      if (s % 2 === 0) this.pluck(this.tracks.guitar, NOTE(chord[s % 4 === 0 ? 1 : 2] + 12), t, spb * 1.6, 0.16, 'sawtooth', 1800);
      if (s === 0 || s === 8) chord.forEach((n, i) => this.pad(this.tracks.keys, NOTE(n + 12), t + i * 0.01, spb * 7, 0.09, 'triangle'));
      // 피아노: 화음을 짧게 치고 멜로디를 얹는다
      if (s === 0 || s === 6 || s === 10) chord.forEach((n, i) => this.piano(this.tracks.piano, NOTE(n + 12), t + i * 0.008, spb * 6, 0.07));
      const m = MELODY[s];
      if (m && bar % 2 === 1) this.piano(this.tracks.piano, NOTE(m), t, spb * 3, 0.09);
      // 베이스: 근음을 8분음표로
      if (s % 2 === 0) this.bassNote(this.tracks.bass, NOTE(BASS[bar] + (s === 14 ? 7 : 0)), t, spb * 1.8, 0.22);
    }
    if (S.laptop > 0) {
      if (s === 0) chord.forEach((n) => this.pad(this.tracks.laptop, NOTE(n + 24), t, spb * 15, 0.05, 'sine'));
      const m = MELODY[s];
      if (m) this.pluck(this.tracks.laptop, NOTE(m), t, spb * 2.5, 0.12, 'sine');
    }
  }
  // 피아노 비슷한 소리: 빠른 어택 + 배음 두 개 + 서서히 줄어드는 소리
  piano(out, f, t, dur, vol) {
    const ctx = this.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12]].forEach(([h, type, a]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = f * h; o.detune.value = h === 1 ? 0 : 3; og.gain.value = a;
      o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    lp.connect(g).connect(out);
  }
  crash(out, t, vol) {
    const ctx = this.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), hp = ctx.createBiquadFilter();
    src.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 5000;
    this.env(g, t, 0.002, 1.2, vol);
    src.connect(hp).connect(g).connect(out); src.start(t, Math.random() * 0.3, 1.3);
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
  // 팝 노이즈: 스피커가 켜진 채로 케이블을 꽂을 때의 "퍽"
  pop() {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.35);
    this.blip(1200, 0.03, 'square', 0.05);
  }
  plug() { this.blip(70, 0.12, 'sine', 0.3); this.blip(2400, 0.02, 'square', 0.03, 0.02); }
  click() { this.blip(1800, 0.03, 'square', 0.02); }
  clear() { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.28, 'triangle', 0.08, i * 0.12)); }
  star() { [784, 988, 1175].forEach((f, i) => this.blip(f, 0.18, 'triangle', 0.07, i * 0.09)); }
}
