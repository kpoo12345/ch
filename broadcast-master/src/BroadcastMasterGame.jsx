import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic, Speaker, Monitor, Power, AlertCircle, Settings, Radio, Video, Cable, SlidersHorizontal,
  Lightbulb, Volume2, VolumeX, CheckCircle2, Circle, Trophy, RotateCcw, ChevronRight, Info, Zap,
  X, Activity, Users, MessageSquare, Tv, Hand, Wrench, MonitorPlay, Award, User, Package, Play,
} from 'lucide-react';

/* =====================================================================
 * 방송장비 마스터 (Broadcast Equipment Master)
 * 신호 흐름(Signal Flow)·게인 스테이징·송출·트러블슈팅을 익히는 시뮬레이션 게임
 * ===================================================================== */

/* ---------------------------- 캔버스 상수 ---------------------------- */
const CANVAS_W = 1000;
const CANVAS_H = 560;
const HEADER_H = 40;
const ROW_H = 26;

/* ---------------------------- 케이블 / 단자 ---------------------------- */
const CABLES = {
  xlr: { name: 'XLR 케이블', short: 'XLR', desc: '3핀 밸런스드 · 마이크/라인 신호', stroke: '#60a5fa', dot: 'bg-blue-400' },
  trs: { name: 'TS/TRS 케이블', short: 'TRS', desc: '6.3mm(55) 잭 · 악기/라인 신호', stroke: '#fbbf24', dot: 'bg-amber-400' },
  hdmi: { name: 'HDMI 케이블', short: 'HDMI', desc: '디지털 영상+음성 · 단거리용', stroke: '#c084fc', dot: 'bg-purple-400' },
  sdi: { name: 'SDI 케이블', short: 'SDI', desc: 'BNC 커넥터 · 방송용 장거리 영상', stroke: '#fb923c', dot: 'bg-orange-400' },
  usb: { name: 'USB-C 케이블', short: 'USB', desc: '데이터 · 오디오 인터페이스/웹캠 신호', stroke: '#4ade80', dot: 'bg-green-400' },
};

const PORT_ACCEPTS = {
  xlr: ['xlr'], trs: ['trs'], combo: ['xlr', 'trs'], hdmi: ['hdmi'], sdi: ['sdi'], usb: ['usb'],
};
const PORT_KIND_LABEL = {
  xlr: 'XLR 단자', trs: '6.3mm TRS 단자', combo: 'XLR/TRS 콤보 단자',
  hdmi: 'HDMI 단자', sdi: 'BNC(SDI) 단자', usb: 'USB-C 단자',
};
const PORT_COLOR = {
  xlr: '#60a5fa', trs: '#fbbf24', combo: '#94a3b8', hdmi: '#c084fc', sdi: '#fb923c', usb: '#4ade80',
};
const MISMATCH_TIP = {
  xlr: 'XLR 단자는 3핀 캐논 커넥터라서 XLR 케이블만 들어갑니다.',
  trs: '6.3mm 잭 단자에는 TS/TRS(55) 케이블을 씁니다.',
  combo: '콤보 단자는 XLR과 6.3mm 잭을 모두 받지만 영상 케이블은 안 됩니다.',
  hdmi: '이 장비는 HDMI 전용입니다. SDI(BNC)는 대형 방송 장비용 규격이라 변환기가 필요합니다.',
  usb: 'USB 단자에는 USB 케이블을 연결해야 PC가 장비를 오디오/웹캠으로 인식합니다.',
  sdi: 'SDI 단자에는 BNC 커넥터의 SDI 케이블이 필요합니다.',
};

/* ---------------------------- 장비 정의 ---------------------------- */
const DEVICE_TYPES = {
  dynamic_mic: {
    name: '다이나믹 마이크', model: 'SM58 타입', icon: Mic, w: 160,
    ins: [], outs: [{ id: 'out', label: 'XLR OUT', kind: 'xlr' }],
    info: '코일과 자석(전자기 유도)으로 소리를 전기 신호로 바꿉니다. 전원이 필요 없고 튼튼하며 하울링에 강해 공연·행사의 표준 마이크입니다. 출력이 아주 작은 "마이크 레벨"이라 믹서의 프리앰프(GAIN)로 크게 증폭해야 합니다.',
  },
  condenser_mic: {
    name: '콘덴서 마이크', model: '스튜디오형', icon: Mic, w: 160,
    ins: [], outs: [{ id: 'out', label: 'XLR OUT', kind: 'xlr' }],
    info: '얇은 진동판과 축전기(콘덴서) 원리로 섬세한 소리를 잡습니다. 내부 회로가 동작하려면 믹서에서 XLR 케이블을 통해 +48V 팬텀 전원을 공급해야 합니다. 팬텀이 꺼져 있으면 소리가 전혀 나지 않습니다.',
  },
  analog_mixer: {
    name: '아날로그 믹서', model: '소형 4채널', icon: SlidersHorizontal, w: 230,
    ins: [{ id: 'ch1', label: 'CH1 MIC IN', kind: 'xlr' }, { id: 'ch2', label: 'CH2 LINE IN', kind: 'trs' }],
    outs: [{ id: 'main', label: 'MAIN OUT', kind: 'xlr' }, { id: 'phones', label: 'PHONES', kind: 'trs' }],
    info: '여러 입력을 모아 증폭(GAIN) → 음색 보정(EQ) → 음량 조절(페이더)을 거쳐 MAIN OUT으로 내보내는 오디오의 심장입니다. 신호는 위에서 아래로, 채널 스트립 순서대로 흐릅니다.',
  },
  speaker: {
    name: '액티브 스피커', model: '앰프 내장형', icon: Speaker, w: 170,
    ins: [{ id: 'in', label: 'INPUT', kind: 'combo' }], outs: [],
    info: '앰프가 내장된 스피커로, 믹서의 라인 레벨 신호를 받아 큰 소리로 바꿉니다. 전원은 "가장 마지막에 켜고, 가장 먼저 끈다"가 철칙입니다. 순서를 어기면 "펑" 하는 팝 노이즈로 스피커가 상할 수 있습니다.',
  },
  digital_mixer: {
    name: '디지털 믹서', model: 'X32 / M32', icon: Settings, w: 220,
    ins: [{ id: 'local1', label: 'LOCAL IN 1', kind: 'xlr' }, { id: 'local2', label: 'LOCAL IN 2', kind: 'xlr' }],
    outs: [{ id: 'main', label: 'MAIN L/R', kind: 'xlr' }, { id: 'usb', label: 'USB AUDIO', kind: 'usb' }],
    info: '디지털 믹서는 "물리적 입력 단자 ≠ 채널"입니다. 어느 입력을 어느 채널로 보낼지(입력 패치), 어떤 믹스를 어느 출력으로 보낼지(출력 라우팅)를 소프트웨어로 지정해야 소리가 납니다. USB 카드로 PC에 멀티채널 오디오를 보낼 수 있습니다.',
  },
  camera: {
    name: '카메라', model: '캠코더', icon: Video, w: 170,
    ins: [], outs: [{ id: 'hdmi', label: 'HDMI OUT', kind: 'hdmi' }],
    info: '촬영한 영상을 HDMI로 내보냅니다. 스위처에 연결되면 앞면의 탈리 램프가 빨간색(PGM, 송출 중) 또는 초록색(PVW, 대기 중)으로 켜져 출연자와 카메라맨에게 상태를 알려줍니다.',
  },
  atem: {
    name: '비디오 스위처', model: 'ATEM Mini', icon: Tv, w: 220,
    ins: [1, 2, 3, 4].map((n) => ({ id: `in${n}`, label: `HDMI IN ${n}`, kind: 'hdmi' })),
    outs: [{ id: 'usb', label: 'USB WEBCAM', kind: 'usb' }, { id: 'hdmiout', label: 'HDMI OUT', kind: 'hdmi' }],
    info: '여러 카메라 중 지금 송출할 화면을 고르는 장비입니다. PVW(프리뷰)에 다음 화면을 준비하고 CUT(즉시) 또는 AUTO(디졸브)로 PGM(프로그램, 실제 송출)과 맞바꿉니다. USB 출력은 PC에서 웹캠으로 인식됩니다.',
  },
  pc: {
    name: '스트리밍 PC', model: 'OBS Studio', icon: Monitor, w: 230, statusH: 98,
    ins: [{ id: 'usb1', label: 'USB 1', kind: 'usb' }, { id: 'usb2', label: 'USB 2', kind: 'usb' }], outs: [],
    info: 'OBS Studio는 영상 소스와 오디오 소스를 각각 지정해 하나의 방송으로 합친 뒤 인코딩하여 플랫폼으로 송출합니다. 소스 지정이 틀리면 장비가 연결돼 있어도 방송에 나가지 않습니다.',
  },
};

const deviceRows = (def) => Math.max(def.ins.length, def.outs.length, 1);
const deviceHeight = (def) => HEADER_H + deviceRows(def) * ROW_H + (def.statusH ?? 58) + 6;
const portPos = (dev, def, portId) => {
  const ii = def.ins.findIndex((p) => p.id === portId);
  if (ii >= 0) return { x: dev.x, y: dev.y + HEADER_H + ii * ROW_H + ROW_H / 2 };
  const oi = def.outs.findIndex((p) => p.id === portId);
  return { x: dev.x + def.w, y: dev.y + HEADER_H + oi * ROW_H + ROW_H / 2 };
};
const findPort = (def, portId) =>
  def.ins.find((p) => p.id === portId) ? { ...def.ins.find((p) => p.id === portId), dir: 'in' }
    : { ...def.outs.find((p) => p.id === portId), dir: 'out' };

/* ---------------------------- 오디오 수학 ---------------------------- */
// 페이더 위치(0~100) → dB. 75 = 0dB(유니티), 100 = +10dB, 0 = -∞
const faderDb = (p) => (p <= 0 ? -Infinity : p >= 75 ? ((p - 75) / 25) * 10 : (p - 75) * 0.8);
const fmtDb = (v) => (v == null ? '—' : v === -Infinity ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`);
const MIC_LEVEL = -45; // 말할 때 마이크 출력 레벨(기준값)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------- 스테이지 초기 상태 ---------------------------- */
const dev = (id, type, x, y, placed = true, name) => ({ id, type, x, y, placed, name });
const conn = (fd, fp, td, tp, cable) => ({ id: `${fd}.${fp}>${td}.${tp}`, from: { d: fd, p: fp }, to: { d: td, p: tp }, cable });
const toMap = (arr) => Object.fromEntries(arr.map((d) => [d.id, d]));

const MIXER_DEFAULT = {
  gain: 30, eqHigh: 0, eqMid: 0, eqLow: 0, chMute: false, chFader: 75,
  mainFader: 75, mainMute: false, phantom: false, ch1Source: 'local1', usbOut: 'main',
};

const FAULTS = {
  cable: { title: '케이블 분리', desc: '마이크 XLR 케이블이 X32 입력에서 빠져 있었습니다.' },
  phantom: { title: '팬텀 전원 OFF', desc: '콘덴서 마이크인데 +48V 팬텀 전원이 꺼져 있었습니다.' },
  chMute: { title: '채널 뮤트', desc: 'X32 CH01의 MUTE 버튼이 눌려 있었습니다.' },
  fader: { title: '페이더 다운', desc: 'CH01 페이더가 끝까지 내려가 있었습니다.' },
  mainMute: { title: '메인 뮤트', desc: 'Main L/R 버스의 MUTE가 눌려 있었습니다.' },
  patch: { title: '입력 패치 오류', desc: 'CH01 입력 패치가 엉뚱한 입력(Local In 2)으로 바뀌어 있었습니다.' },
  usbRoute: { title: 'USB 라우팅 오류', desc: 'USB 출력이 아무것도 없는 Mix Bus 1로 라우팅되어 있었습니다.' },
  obsMute: { title: 'OBS 음소거', desc: 'OBS 오디오 믹서에서 X32 소스가 음소거되어 있었습니다.' },
};

function buildStage(id) {
  const base = {
    mixer: { ...MIXER_DEFAULT },
    speaker: { power: false, position: 'behind' },
    atem: { program: 0, preview: 1, transitioning: false },
    obs: { videoSource: 'none', audioSource: 'none', audioMuted: false, streaming: false },
    faults: [],
  };
  if (id === 1) {
    return {
      ...base,
      devices: toMap([dev('mic', 'dynamic_mic', 50, 200, false), dev('mixer', 'analog_mixer', 385, 150, false), dev('speaker', 'speaker', 790, 200, false)]),
      connections: [],
      cables: { xlr: 2, trs: 1, hdmi: 1 },
      mixer: { ...MIXER_DEFAULT, mainFader: 0 },
    };
  }
  if (id === 2) {
    return {
      ...base,
      devices: toMap([dev('mic', 'dynamic_mic', 50, 200), dev('mixer', 'analog_mixer', 385, 150), dev('speaker', 'speaker', 790, 200)]),
      connections: [conn('mic', 'out', 'mixer', 'ch1', 'xlr'), conn('mixer', 'main', 'speaker', 'in', 'xlr')],
      cables: { xlr: 0, trs: 1 },
      mixer: { ...MIXER_DEFAULT, gain: 54, eqMid: 9, chFader: 75, mainFader: 88 },
      speaker: { power: true, position: 'front' },
    };
  }
  const studio = [
    dev('mic', id === 4 ? 'condenser_mic' : 'dynamic_mic', 40, 40),
    dev('mixer', 'digital_mixer', 300, 24),
    dev('cam1', 'camera', 40, 215, id === 4, '카메라 1 · 클로즈업'),
    dev('cam2', 'camera', 40, 385, id === 4, '카메라 2 · 와이드'),
    dev('atem', 'atem', 300, 300),
    dev('pc', 'pc', 735, 150),
  ];
  if (id === 3) {
    return {
      ...base,
      devices: toMap(studio),
      connections: [],
      cables: { xlr: 1, hdmi: 2, usb: 2, sdi: 1 },
      mixer: { ...MIXER_DEFAULT, gain: 28, ch1Source: 'aes50a1', usbOut: 'off' },
    };
  }
  // Stage 4 — 정상 송출 중인 시스템에 무작위 고장 3개를 심는다
  const s = {
    ...base,
    devices: toMap(studio),
    connections: [
      conn('mic', 'out', 'mixer', 'local1', 'xlr'),
      conn('cam1', 'hdmi', 'atem', 'in1', 'hdmi'),
      conn('cam2', 'hdmi', 'atem', 'in2', 'hdmi'),
      conn('atem', 'usb', 'pc', 'usb1', 'usb'),
      conn('mixer', 'usb', 'pc', 'usb2', 'usb'),
    ],
    cables: { xlr: 0, hdmi: 0, usb: 0 },
    mixer: { ...MIXER_DEFAULT, gain: 28, phantom: true },
    atem: { program: 1, preview: 2, transitioning: false },
    obs: { videoSource: 'atem', audioSource: 'x32', audioMuted: false, streaming: true },
  };
  const pool = Object.keys(FAULTS).sort(() => Math.random() - 0.5).slice(0, 3);
  pool.forEach((f) => {
    if (f === 'cable') { s.connections = s.connections.filter((c) => c.from.d !== 'mic'); s.cables = { ...s.cables, xlr: 1 }; }
    if (f === 'phantom') s.mixer.phantom = false;
    if (f === 'chMute') s.mixer.chMute = true;
    if (f === 'fader') s.mixer.chFader = 0;
    if (f === 'mainMute') s.mixer.mainMute = true;
    if (f === 'patch') s.mixer.ch1Source = 'local2';
    if (f === 'usbRoute') s.mixer.usbOut = 'bus1';
    if (f === 'obsMute') s.obs.audioMuted = true;
  });
  s.faults = pool;
  return s;
}

/* ---------------------------- 신호 계산 엔진 ---------------------------- */
function computeSignal(st, talking) {
  const { devices, connections: cs, mixer: m, speaker: sp, atem, obs } = st;
  const has = (id) => !!devices[id]?.placed;
  const isDigital = devices.mixer?.type === 'digital_mixer';
  const micConn = cs.find((c) => c.from.d === 'mic' && c.to.d === 'mixer');
  const micPort = micConn?.to.p ?? null;
  const chPort = isDigital ? m.ch1Source : 'ch1';
  const micAtCh = !!micConn && micPort === chPort;
  const condenser = devices.mic?.type === 'condenser_mic';
  const micPowered = !condenser || (micAtCh && m.phantom);
  const micLive = has('mic') && micAtCh && micPowered;

  const chIn = micLive && talking ? MIC_LEVEL + m.gain : null;
  const chOpen = !m.chMute && m.chFader > 0;
  const mainOpen = !m.mainMute && m.mainFader > 0;
  const chPost = chIn != null && chOpen ? chIn + faderDb(m.chFader) : null;
  const mainOut = chPost != null && mainOpen ? chPost + faderDb(m.mainFader) : null;

  // PA (스피커) 경로
  const speakerLinked = cs.some((c) => c.from.d === 'mixer' && c.from.p === 'main' && c.to.d === 'speaker');
  const speakerOnPhones = cs.some((c) => c.from.d === 'mixer' && c.from.p === 'phones' && c.to.d === 'speaker');
  const spkOn = has('speaker') && sp.power;
  const speakerLevel = speakerLinked && spkOn && mainOut != null ? mainOut : null;
  const audible = speakerLevel != null && speakerLevel > -40;

  // 피드백 루프: 마이크 → 믹서 → 스피커 → (공기) → 마이크
  const pathOpen = micLive && chOpen && mainOpen && speakerLinked && spkOn;
  const loop = pathOpen
    ? (m.gain - 40) + faderDb(m.chFader) + faderDb(m.mainFader) + m.eqMid + 0.4 * m.eqHigh + (sp.position === 'front' ? 8 : -6)
    : -99;
  const feedback = pathOpen && loop >= 0;
  const ringing = pathOpen && loop >= -4 && loop < 0;

  // 스트리밍 오디오 경로
  const usbLinked = cs.some((c) => c.from.d === 'mixer' && c.from.p === 'usb' && c.to.d === 'pc');
  const usbSignal = m.usbOut === 'main' ? mainOut : null;
  const obsAudioRouted = obs.audioSource === 'x32' && usbLinked && !obs.audioMuted;
  const obsAudio = obsAudioRouted ? usbSignal : null;
  const audioOk = obsAudio != null && obsAudio > -40;

  // 비디오 경로
  const camAt = {};
  cs.forEach((c) => { if (c.to.d === 'atem' && c.from.d.startsWith('cam')) camAt[Number(c.to.p.slice(2))] = c.from.d; });
  const programCam = camAt[atem.program] ?? null;
  const previewCam = camAt[atem.preview] ?? null;
  const atemUsbLinked = cs.some((c) => c.from.d === 'atem' && c.from.p === 'usb' && c.to.d === 'pc');
  let obsVideo = 'none';
  if (obs.videoSource === 'atem') obsVideo = atemUsbLinked ? (programCam ?? 'black') : 'nosignal';
  if (obs.videoSource === 'facecam') obsVideo = 'facecam';
  const videoOk = obs.videoSource === 'atem' && atemUsbLinked && !!programCam;

  return {
    isDigital, micConn, micPort, micAtCh, condenser, micPowered, micLive, chIn, chPost, mainOut,
    speakerLinked, speakerOnPhones, spkOn, speakerLevel, audible, loop, feedback, ringing,
    usbLinked, usbSignal, obsAudio, audioOk, camAt, programCam, previewCam, atemUsbLinked, obsVideo, videoOk,
  };
}

function buildTrace(st, n) {
  const has = (id) => !!st.devices[id]?.placed;
  const m = st.mixer;
  let audio;
  if (!n.isDigital) {
    audio = [
      { label: '마이크', ok: has('mic') },
      { label: 'XLR → CH1', ok: n.micAtCh },
      { label: 'GAIN', ok: n.chIn != null && n.chIn > -40, warn: n.chIn > 0 ? '클리핑' : null },
      { label: '채널(뮤트·페이더)', ok: n.chPost != null },
      { label: 'MAIN OUT', ok: n.mainOut != null },
      { label: '케이블 → 스피커', ok: n.speakerLinked },
      { label: '스피커 전원', ok: n.spkOn },
      { label: '소리 출력', ok: n.audible, warn: n.feedback ? '하울링' : null },
    ];
  } else {
    audio = [
      { label: '마이크', ok: has('mic') },
      { label: 'XLR 케이블', ok: !!n.micConn },
      { label: '입력 패치', ok: n.micAtCh },
      ...(n.condenser ? [{ label: '+48V 팬텀', ok: m.phantom }] : []),
      { label: 'GAIN', ok: n.chIn != null && n.chIn > -40, warn: n.chIn > 0 ? '클리핑' : null },
      { label: 'CH01', ok: n.chPost != null },
      { label: 'MAIN L/R', ok: n.mainOut != null },
      { label: 'USB 라우팅', ok: m.usbOut === 'main' },
      { label: 'USB → PC', ok: n.usbLinked },
      { label: 'OBS 오디오', ok: st.obs.audioSource === 'x32' && !st.obs.audioMuted },
      { label: '송출', ok: st.obs.streaming && n.audioOk },
    ];
  }
  const video = n.isDigital ? [
    { label: '카메라', ok: has('cam1') || has('cam2') },
    { label: 'HDMI → ATEM', ok: Object.keys(n.camAt).length > 0 },
    { label: 'PGM 선택', ok: !!n.programCam },
    { label: 'USB → PC', ok: n.atemUsbLinked },
    { label: 'OBS 영상', ok: st.obs.videoSource === 'atem' },
    { label: '송출', ok: st.obs.streaming && n.videoOk },
  ] : null;
  const walk = (steps) => {
    let broken = false;
    return steps.map((s) => {
      if (broken) return { ...s, status: 'idle' };
      if (!s.ok) { broken = true; return { ...s, status: 'fail' }; }
      return { ...s, status: s.warn ? 'warn' : 'ok' };
    });
  };
  return { audio: walk(audio), video: video ? walk(video) : null };
}

const faultFixed = (f, st, n) => {
  switch (f) {
    case 'cable': return !!n.micConn;
    case 'phantom': return st.mixer.phantom;
    case 'chMute': return !st.mixer.chMute;
    case 'fader': return st.mixer.chFader >= 55;
    case 'mainMute': return !st.mixer.mainMute;
    case 'patch': return n.micConn ? st.mixer.ch1Source === n.micPort : st.mixer.ch1Source === 'local1';
    case 'usbRoute': return st.mixer.usbOut === 'main';
    case 'obsMute': return !st.obs.audioMuted;
    default: return true;
  }
};

/* ---------------------------- 스테이지 정의 ---------------------------- */
const STAGES = {
  1: {
    title: '스테이지 1: 소리의 시작', tag: '기초 음향', focus: 'mixer', autoTalk: false,
    mission: '마이크 → 믹서 → 스피커를 올바른 케이블로 연결하고 마이크 테스트에 성공하세요.',
    briefing: [
      '첫 출근 날입니다. 오늘 오후 세미나실에서 강연이 있어 간단한 PA(확성) 시스템을 꾸려야 합니다.',
      '모든 음향 시스템은 소스(마이크) → 처리(믹서) → 출력(스피커) 순서로 신호가 흐릅니다. 하단 인벤토리에서 장비를 꺼내 배치하고, 케이블을 골라 단자끼리 이어 주세요.',
    ],
    objectives: [
      { id: 'placed', label: '장비 3대 배치 (마이크·믹서·스피커)', check: (c) => ['mic', 'mixer', 'speaker'].every((d) => c.st.devices[d].placed) },
      { id: 'micLink', label: '마이크 → 믹서 CH1 MIC IN 연결', check: (c) => c.n.micAtCh },
      { id: 'spkLink', label: '믹서 MAIN OUT → 스피커 INPUT 연결', check: (c) => c.n.speakerLinked },
      { id: 'power', label: '스피커 전원 ON', check: (c) => c.st.speaker.power },
      { id: 'fader', label: '메인 페이더 올리기 (0dB 부근)', check: (c) => c.st.mixer.mainFader >= 55 },
      { id: 'test', label: '마이크 테스트: "말하기"로 스피커 소리 확인', latch: (c) => c.a.audible && !c.a.feedback },
    ],
    hints: [
      '신호는 항상 소스 → 처리 → 출력 순서로 흐릅니다. 먼저 인벤토리의 "배치" 버튼으로 마이크·믹서·스피커를 꺼내세요.',
      '인벤토리에서 XLR 케이블을 고른 뒤, 마이크의 XLR OUT(오른쪽 단자) → 믹서의 CH1 MIC IN(왼쪽 단자)을 차례로 누르세요. 믹서 MAIN OUT → 스피커 INPUT도 XLR로 연결합니다.',
      '연결을 마친 뒤 스피커 전원을 켜고, 그다음 메인 페이더를 75%(0dB) 부근까지 올리세요. 마지막으로 "말하기" 버튼(또는 Space 키)을 누르고 있으면 테스트됩니다.',
    ],
    lessons: [
      '신호 흐름: 소스(마이크) → 처리(믹서) → 출력(스피커)',
      'XLR은 3핀 밸런스드 케이블로, 잡음에 강해 마이크 연결의 표준입니다.',
      '전원 순서: 켤 때는 스피커가 마지막, 끌 때는 스피커가 처음. 페이더는 내린 상태에서 시작합니다.',
    ],
  },
  2: {
    title: '스테이지 2: 피드백 제어', tag: '심화 컨트롤', focus: 'mixer', autoTalk: false,
    mission: '하울링이 발생했습니다! GAIN·페이더·EQ·스피커 위치를 조정해 하울링을 잡고 적정 레벨을 만드세요.',
    briefing: [
      '강연 직전 리허설. 전임자가 볼륨을 잔뜩 올려 둔 탓에 스피커에서 "삐이이—" 하는 하울링이 울려 퍼집니다!',
      '하울링(음향 피드백)은 스피커 소리가 다시 마이크로 들어가 무한히 증폭되는 현상입니다. 루프 전체의 이득을 줄이면 멈춥니다. 단, 소리가 아예 안 나게 줄이면 안 되겠죠?',
    ],
    objectives: [
      { id: 'noFb', label: '하울링(피드백) 제거', check: (c) => !c.n.feedback },
      { id: 'gain', label: '게인 스테이징: 말할 때 입력 미터 -20 ~ -6 dB', check: (c) => c.n.chIn != null && c.n.chIn >= -20 && c.n.chIn <= -6 },
      { id: 'test', label: '마이크 테스트: 하울링 없이 스피커 소리 확인', latch: (c) => c.a.audible && !c.a.feedback && c.a.chIn >= -20 && c.a.chIn <= -6 },
    ],
    hints: [
      '하울링은 마이크 → 믹서 → 스피커 → 마이크로 이어지는 피드백 루프입니다. 루프의 어느 지점이든 이득을 줄이면 멈춥니다. 믹서를 클릭해 제어 패널을 확인하세요.',
      '입력 GAIN이 54dB로 너무 높습니다. "말하기"를 누른 채 입력 미터가 녹색 목표 구간(-20 ~ -6 dB)에 오도록 GAIN을 낮추고, 메인 페이더도 0dB(75%) 근처로 내리세요.',
      'EQ MID(약 2.5kHz)가 +9dB로 부스트되어 하울링 주파수를 키우고 있습니다. 0 이하로 컷하세요. 스피커 패널에서 위치를 "마이크 뒤쪽"으로 옮기면 훨씬 안정적입니다.',
    ],
    lessons: [
      '게인 스테이징: 입력단(GAIN)에서 적정 레벨을 먼저 잡고, 음량은 페이더로 조절합니다.',
      '하울링 대처: GAIN/볼륨 낮추기 → 문제 주파수 EQ 컷 → 마이크와 스피커 배치 바꾸기',
      '스피커는 마이크보다 앞쪽에서 청중을 향하게 두고, 마이크가 스피커 정면을 향하지 않게 합니다.',
    ],
  },
  3: {
    title: '스테이지 3: 종합 송출', tag: '프로 방송', focus: 'mixer', autoTalk: true,
    mission: 'X32 라우팅, ATEM 화면 전환, OBS 소스 설정을 마치고 영상과 소리가 모두 나가는 상태로 ON AIR 하세요.',
    briefing: [
      '이번엔 유튜브 라이브 강연입니다. 진행자는 이미 마이크 앞에서 말하고 있고, 카메라 두 대가 준비되어 있습니다.',
      '오디오는 마이크 → X32 → USB → PC, 영상은 카메라 → ATEM → USB → PC로 각자 다른 길을 따라 OBS에서 합쳐집니다. 디지털 장비는 케이블만 꽂아서는 끝나지 않습니다. 소프트웨어 라우팅까지 확인하세요.',
    ],
    objectives: [
      { id: 'mic', label: '마이크 → X32 LOCAL IN 연결 (XLR)', check: (c) => !!c.n.micConn },
      { id: 'route', label: 'X32 라우팅: CH01 ← 마이크 입력, USB ← Main L/R', check: (c) => c.n.micAtCh && c.st.mixer.usbOut === 'main' },
      { id: 'cams', label: '카메라 2대 → ATEM 입력 연결 (HDMI)', check: (c) => Object.values(c.n.camAt).includes('cam1') && Object.values(c.n.camAt).includes('cam2') },
      { id: 'usb', label: 'ATEM과 X32 → PC 연결 (USB)', check: (c) => c.n.atemUsbLinked && c.n.usbLinked },
      { id: 'pgm', label: 'ATEM PGM(송출 화면)에 카메라 올리기', check: (c) => !!c.n.programCam },
      { id: 'obs', label: 'OBS 소스: 영상 = ATEM, 오디오 = X32', check: (c) => c.st.obs.videoSource === 'atem' && c.st.obs.audioSource === 'x32' },
      { id: 'live', label: '방송 시작: 영상과 소리 모두 정상 송출', check: (c) => c.st.obs.streaming && c.n.videoOk && c.n.audioOk },
    ],
    hints: [
      '오디오와 비디오는 서로 다른 경로로 PC에 들어갑니다. 먼저 인벤토리에서 카메라 2대를 배치하고, 케이블 종류를 확인하세요. ATEM Mini는 HDMI 입력만 있습니다.',
      'X32를 클릭해 라우팅 패널을 여세요. CH01 입력 소스를 마이크가 꽂힌 Local In으로, USB(Card) 출력을 Main L/R로 지정해야 PC로 소리가 갑니다.',
      'ATEM 패널에서 PVW로 카메라를 고른 뒤 CUT 또는 AUTO로 PGM에 올리세요. PC를 클릭해 OBS 영상 = ATEM, 오디오 = X32로 지정한 뒤 "방송 시작"을 누르세요.',
    ],
    lessons: [
      '디지털 믹서는 입력 패치와 출력 라우팅을 소프트웨어로 지정해야 소리가 납니다.',
      '스위처는 PVW에서 다음 화면을 준비하고 CUT/AUTO로 PGM에 송출합니다.',
      'OBS는 영상 소스와 오디오 소스를 각각 지정합니다. 송출 전 미리보기와 오디오 미터를 꼭 확인하세요.',
    ],
  },
  4: {
    title: '스테이지 4: 돌발 상황', tag: '트러블슈팅', focus: 'pc', autoTalk: true,
    mission: '"방송에 소리가 안 나요!" 원인 3가지를 찾아 해결하고 시청자에게 소리를 되돌려 주세요.',
    briefing: [
      '라이브 방송이 한창인데 PD가 뛰어 들어옵니다. "방송에 소리가 안 나요!!" 채팅창이 난리입니다.',
      '오늘은 콘덴서 마이크를 쓰고 있습니다. 누군가 장비를 건드리며 문제가 3개 생겼습니다. 소스(마이크)부터 출력(송출)까지 신호를 한 단계씩 따라가며 원인을 찾으세요. 시간이 갈수록 시청자가 떠납니다.',
    ],
    objectives: [
      { id: 'keep', label: '송출 유지 (ON AIR, 영상 정상)', check: (c) => c.st.obs.streaming && c.n.videoOk },
      { id: 'faults', label: (c) => `원인 찾아 해결하기 (${c.fixedCount}/${c.st.faults.length})`, check: (c) => c.fixedCount === c.st.faults.length },
      { id: 'audio', label: '시청자에게 소리 복구', check: (c) => c.st.obs.streaming && c.n.audioOk },
    ],
    hints: [
      '트러블슈팅의 철칙은 소스부터 출력까지 순서대로 확인하는 것입니다. 물리적 연결 → 전원(팬텀) → 라우팅 → 뮤트/페이더 → 소프트웨어(OBS) 순으로 점검하세요.',
      '신호 추적기를 켰습니다. 캔버스 아래 오디오 체인에서 빨간색으로 표시된 첫 지점이 신호가 끊긴 곳입니다.',
    ],
    lessons: [
      '체계적 트러블슈팅: 소스부터 출력까지 신호를 순서대로 추적합니다.',
      '자주 나오는 원인: 뮤트, 빠진 케이블, 팬텀 전원, 라우팅·패치, 소프트웨어 음소거',
      '송출 전 체크리스트를 만들어 매번 확인하는 습관이 사고를 막습니다.',
    ],
  },
};

const CHAT_BAD = ['소리 안 나와요', '음소거 됐나요??', '??? 소리', '저만 안 들려요?', '소리 ㅠㅠ', '입모양만 보여요', 'PD님 소리요!!', '새로고침 해도 안 나와요'];
const CHAT_GOOD = ['오 이제 들린다!', '소리 굿 👍', '잘 들려요~', '화질 좋네요', '오늘 강의 재밌어요', '👏👏'];
const CHAT_NAMES = ['민준', '서연', 'audio_kim', '하늘', 'pd_lee', '도윤', '지우', 'cam_op', '수아'];

/* ---------------------------- 효과음 (Web Audio) ---------------------------- */
function useSfx(enabled) {
  const ctxRef = useRef(null);
  const fbRef = useRef(null);
  const ensure = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);
  const tone = useCallback((freq, dur, type = 'sine', vol = 0.08, when = 0) => {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + when;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }, [enabled, ensure]);
  const setFeedback = useCallback((on) => {
    const ctx = enabled ? ensure() : ctxRef.current;
    if (on && enabled && ctx && !fbRef.current) {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.frequency.value = 2500;
      lfo.frequency.value = 6;
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.6);
      o.connect(g).connect(ctx.destination);
      o.start(); lfo.start();
      fbRef.current = { o, lfo, g };
    } else if ((!on || !enabled) && fbRef.current && ctx) {
      const { o, lfo, g } = fbRef.current;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
      o.stop(ctx.currentTime + 0.3); lfo.stop(ctx.currentTime + 0.3);
      fbRef.current = null;
    }
  }, [enabled, ensure]);
  return useMemo(() => ({
    ensure,
    setFeedback,
    ok: () => { tone(880, 0.1); tone(1320, 0.16, 'sine', 0.08, 0.08); },
    error: () => tone(130, 0.22, 'square', 0.04),
    pop: () => tone(55, 0.18, 'sine', 0.35),
    click: () => tone(1800, 0.03, 'square', 0.02),
    clear: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.08, i * 0.12)),
  }), [tone, ensure, setFeedback]);
}

/* ---------------------------- 작은 UI 부품 ---------------------------- */
function Meter({ level, target, className = '', thin }) {
  const pos = (db) => clamp(((db + 60) / 66) * 100, 0, 100);
  const pct = level == null ? 0 : pos(level);
  return (
    <div className={`relative w-full ${thin ? 'h-2' : 'h-3'} rounded-sm overflow-hidden bg-slate-950 ${className}`}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to right, #16a34a 0%, #22c55e ${pos(-6)}%, #eab308 ${pos(-6)}%, #eab308 ${pos(0)}%, #ef4444 ${pos(0)}%)` }}
      />
      <div className="absolute inset-y-0 right-0 bg-slate-950/90 transition-[left] duration-75" style={{ left: `${pct}%` }} />
      {target && (
        <div className="absolute inset-y-0 border-x-2 border-white/70" style={{ left: `${pos(target[0])}%`, width: `${pos(target[1]) - pos(target[0])}%` }} />
      )}
    </div>
  );
}

function Slider({ id, label, value, min, max, step = 1, onChange, display, accent = 'accent-sky-400', hint }) {
  return (
    <label htmlFor={id} className="block">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-mono text-slate-200 tabular-nums">{display ?? value}</span>
      </div>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accent} cursor-pointer`}
      />
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </label>
  );
}

function ToggleBtn({ on, onClick, children, color = 'red', title }) {
  const onCls = {
    red: 'bg-red-600 border-red-400 text-white shadow-[0_0_12px_rgba(239,68,68,.6)]',
    amber: 'bg-amber-500 border-amber-300 text-slate-900 shadow-[0_0_12px_rgba(245,158,11,.6)]',
    green: 'bg-green-600 border-green-400 text-white shadow-[0_0_12px_rgba(34,197,94,.5)]',
  }[color];
  return (
    <button
      type="button" title={title} onClick={onClick}
      className={`px-3 py-1.5 rounded border text-xs font-bold tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${on ? onCls : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}
    >
      {children}
    </button>
  );
}

function Section({ title, children, icon: Icon }) {
  return (
    <div className="bg-slate-900/60 rounded-md p-3 border border-slate-700 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
        {Icon && <Icon size={13} />} {title}
      </div>
      {children}
    </div>
  );
}

function Scene({ src, label = true, fade }) {
  const scenes = {
    cam1: { cls: 'bg-gradient-to-br from-sky-700 via-indigo-800 to-slate-900', icon: User, text: '진행자 클로즈업' },
    cam2: { cls: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900', icon: Users, text: '스튜디오 와이드샷' },
    facecam: { cls: 'bg-gradient-to-br from-stone-500 to-stone-800', icon: Monitor, text: 'PC 내장 웹캠 (저화질)' },
    black: { cls: 'bg-black', icon: null, text: 'PGM: BLACK' },
    nosignal: { cls: 'bg-slate-950', icon: AlertCircle, text: 'NO SIGNAL' },
    none: { cls: 'bg-slate-950', icon: null, text: '영상 소스 없음' },
  };
  const s = scenes[src] ?? scenes.none;
  const Icon = s.icon;
  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center ${s.cls} transition-opacity duration-500 ${fade ? 'opacity-40' : 'opacity-100'}`}>
      {Icon && <Icon className="text-white/80" size={label ? 28 : 16} />}
      {label && <span className="text-[10px] text-white/70 mt-1">{s.text}</span>}
      {src === 'cam1' || src === 'cam2' ? <span className="absolute bottom-1 left-1.5 text-[8px] text-white/60 font-mono">● REC</span> : null}
    </div>
  );
}

/* =====================================================================
 * 메인 컴포넌트
 * ===================================================================== */
export default function BroadcastMasterGame() {
  const initial = useMemo(() => buildStage(1), []);
  const [currentStage, setCurrentStage] = useState(1);
  const [devices, setDevices] = useState(initial.devices);
  const [connections, setConnections] = useState(initial.connections);
  const [cables, setCables] = useState(initial.cables);
  const [mixer, setMixer] = useState(initial.mixer);
  const [speaker, setSpeaker] = useState(initial.speaker);
  const [atem, setAtem] = useState(initial.atem);
  const [obs, setObs] = useState(initial.obs);
  const [faults, setFaults] = useState(initial.faults);

  const [selectedCable, setSelectedCable] = useState('xlr');
  const [selectedDevice, setSelectedDevice] = useState('mixer');
  const [pending, setPending] = useState(null); // { d, p, dir }
  const [pointer, setPointer] = useState(null);
  const [talkHeld, setTalkHeld] = useState(false);
  const [jitter, setJitter] = useState(0);
  const [latched, setLatched] = useState([]);
  const [systemLog, setSystemLog] = useState([{ id: 0, time: '', type: 'info', msg: '시스템이 시작되었습니다. 스테이지 1 미션을 확인하세요.' }]);
  const [meta, setMeta] = useState({ start: Date.now(), penalty: 0, hintsUsed: 0 });
  const [cleared, setCleared] = useState(false);
  const [stageScores, setStageScores] = useState({});
  const [modal, setModal] = useState({ type: 'briefing' });
  const [soundOn, setSoundOn] = useState(false);
  const [tracerOn, setTracerOn] = useState(true);
  const [viewers, setViewers] = useState(0);
  const [chat, setChat] = useState([]);
  const [scale, setScale] = useState(0.8);

  const stage = STAGES[currentStage];
  const talking = talkHeld || stage.autoTalk;
  const isLive = obs.streaming;
  const sfx = useSfx(soundOn);

  const logId = useRef(1);
  const warnAt = useRef({});
  const logEndRef = useRef(null);
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const dragRef = useRef(null);
  const pendingMoved = useRef(false);
  const prev = useRef({});

  /* ---------- 로그 ---------- */
  const addLog = useCallback((msg, type = 'info') => {
    const d = new Date();
    const time = [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, '0')).join(':');
    setSystemLog((prev) => [...prev.slice(-150), { id: logId.current++, time, type, msg }]);
  }, []);
  const addLogThrottled = useCallback((key, msg, type = 'warn', ms = 4000) => {
    const now = Date.now();
    if (warnAt.current[key] && now - warnAt.current[key] < ms) return;
    warnAt.current[key] = now;
    addLog(msg, type);
  }, [addLog]);
  const penalize = useCallback((pts, reason) => {
    setMeta((m) => ({ ...m, penalty: m.penalty + pts }));
    addLog(`${reason} (-${pts}점)`, 'error');
  }, [addLog]);

  useEffect(() => { logEndRef.current?.scrollIntoView({ block: 'nearest' }); }, [systemLog]);

  /* ---------- 신호 계산 ---------- */
  const st = { devices, connections, mixer, speaker, atem, obs, faults };
  const actual = computeSignal(st, talking); // 지금 이 순간의 신호
  const nominal = computeSignal(st, true); // "말하고 있다면" 신호 (미션 판정용)
  const trace = buildTrace(st, nominal);
  const fixedList = faults.filter((f) => faultFixed(f, st, nominal));
  const ctx = { st, n: nominal, a: actual, fixedCount: fixedList.length };

  const objectiveStatus = stage.objectives.map((o) => ({
    id: o.id,
    label: typeof o.label === 'function' ? o.label(ctx) : o.label,
    done: o.latch ? latched.includes(o.id) : o.check(ctx),
  }));
  const allDone = objectiveStatus.every((o) => o.done);

  /* ---------- 스테이지 로드 ---------- */
  const loadStage = useCallback((id) => {
    const s = buildStage(id);
    setCurrentStage(id);
    setDevices(s.devices);
    setConnections(s.connections);
    setCables(s.cables);
    setMixer(s.mixer);
    setSpeaker(s.speaker);
    setAtem(s.atem);
    setObs(s.obs);
    setFaults(s.faults);
    setSelectedCable(Object.keys(s.cables)[0]);
    setSelectedDevice(STAGES[id].focus);
    setPending(null);
    setLatched([]);
    setCleared(false);
    setMeta({ start: Date.now(), penalty: 0, hintsUsed: 0 });
    setTracerOn(id !== 4);
    setViewers(id === 4 ? 1240 : 0);
    setChat(id === 4 ? [{ id: 1, name: 'pd_lee', text: '방송에 소리가 안 나요!!' }] : []);
    setModal({ type: 'briefing' });
    warnAt.current = {};
    prev.current = {};
    addLog(`━━ ${STAGES[id].title} 시작 ━━`, 'stage');
    if (id === 4) addLog('경고: 송출 오디오 신호 없음! 시청자들이 소리가 안 들린다고 합니다.', 'error');
  }, [addLog]);

  /* ---------- 캔버스 스케일 ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setScale(Math.max(0.56, e.contentRect.width / CANVAS_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- 미터 지터 & 시청자 시뮬레이션 ---------- */
  useEffect(() => {
    const t = setInterval(() => setJitter(-(Math.random() ** 1.5) * 12), 110);
    return () => clearInterval(t);
  }, []);

  const audioOkRef = useRef(false);
  audioOkRef.current = actual.audioOk && actual.videoOk;
  useEffect(() => {
    if (currentStage < 3 || !obs.streaming) return undefined;
    const t = setInterval(() => {
      const good = audioOkRef.current;
      setViewers((v) => Math.max(0, v + (good ? Math.round(Math.random() * 14 + 3) : -Math.round(Math.random() * 22 + 6))));
      if (Math.random() < 0.55) {
        const pool = good ? CHAT_GOOD : CHAT_BAD;
        setChat((c) => [...c.slice(-5), {
          id: Date.now(), name: CHAT_NAMES[Math.floor(Math.random() * CHAT_NAMES.length)],
          text: pool[Math.floor(Math.random() * pool.length)],
        }]);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [currentStage, obs.streaming]);

  /* ---------- 상태 변화 감시 → 로그/효과음 ---------- */
  useEffect(() => {
    const p = prev.current;
    if (actual.feedback && !p.feedback) { addLog('⚠ 경고: 하울링(피드백) 발생! 삐이이이——', 'error'); }
    if (!actual.feedback && p.feedback) addLog('하울링이 멈췄습니다.', 'ok');
    if (actual.ringing && !p.ringing && !actual.feedback) addLogThrottled('ring', '주의: 하울링 직전(링잉)입니다. 소리가 웅웅 울립니다.', 'warn', 6000);
    if (talking && actual.chIn != null && actual.chIn > 0) addLogThrottled('clip', '경고: 입력 신호가 너무 큽니다! (클리핑 · 소리가 찌그러짐)');
    if (talking && actual.chIn != null && actual.chIn < -30) addLogThrottled('low', '입력 신호가 너무 작습니다. GAIN을 올리세요 (잡음 대비 신호가 약함).', 'warn', 6000);
    if (talkHeld && !p.talkHeld && actual.micConn && !actual.micAtCh && !actual.isDigital) addLog('믹서에 신호가 들어오지 않습니다. 마이크가 어느 단자에 꽂혀 있는지 확인하세요.', 'warn');
    if (talkHeld && !p.talkHeld && actual.speakerOnPhones) addLog('PHONES 단자는 헤드폰 모니터링용입니다. 스피커는 MAIN OUT에 연결하세요.', 'warn');
    if (talkHeld && !p.talkHeld && actual.mainOut != null && actual.speakerLinked && !actual.spkOn) addLog('신호는 스피커까지 가는데 소리가 안 납니다. 스피커 전원을 확인하세요.', 'warn');
    if (currentStage >= 3 && obs.streaming) {
      const ok = actual.audioOk;
      if (!ok && p.audioOk) addLog('경고: 송출 오디오 신호 없음!', 'error');
      if (ok && p.audioOk === false) addLog('✔ 송출 오디오가 정상입니다. 시청자에게 소리가 전달됩니다.', 'ok');
    }
    prev.current = { feedback: actual.feedback, ringing: actual.ringing, talkHeld, audioOk: obs.streaming ? actual.audioOk : undefined };
  });

  useEffect(() => { sfx.setFeedback(actual.feedback); }, [actual.feedback, sfx]);
  useEffect(() => () => sfx.setFeedback(false), [sfx]);

  // 래치 미션 (예: 마이크 테스트)
  useEffect(() => {
    stage.objectives.forEach((o) => {
      if (o.latch && !latched.includes(o.id) && o.latch(ctx)) {
        setLatched((l) => [...l, o.id]);
        addLog(`✔ ${o.label} 성공! "아, 아— 마이크 테스트" 소리가 또렷하게 들립니다.`, 'ok');
        sfx.ok();
      }
    });
  });

  // 스테이지 4: 원인 해결 감지
  const fixedKey = `${faults.join(',')}|${fixedList.join(',')}`;
  const prevFixed = useRef(null);
  useEffect(() => {
    const key = faults.join(',');
    if (currentStage !== 4) { prevFixed.current = null; return; }
    if (prevFixed.current && prevFixed.current.key === key) {
      fixedList.filter((f) => !prevFixed.current.list.includes(f)).forEach((f) => {
        addLog(`🔧 원인 발견 [${FAULTS[f].title}]: ${FAULTS[f].desc}`, 'ok');
        sfx.ok();
      });
    }
    prevFixed.current = { key, list: fixedList };
  }, [fixedKey, currentStage]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스테이지 클리어
  useEffect(() => {
    if (!allDone || cleared) return;
    const elapsed = Math.round((Date.now() - meta.start) / 1000);
    const timeBonus = Math.max(0, 300 - elapsed);
    const score = Math.max(200, 1000 + timeBonus - meta.penalty);
    setCleared(true);
    setStageScores((s) => (s[currentStage] ? s : { ...s, [currentStage]: score }));
    setModal({ type: 'clear', score, timeBonus, penalty: meta.penalty, elapsed });
    addLog(`🏆 ${stage.title} 클리어! (+${score}점)`, 'ok');
    sfx.clear();
  }, [allDone, cleared]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 키보드 ---------- */
  useEffect(() => {
    const isField = (e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    const down = (e) => {
      if (e.code === 'Space' && !isField(e) && !modal) { e.preventDefault(); if (!e.repeat) setTalkHeld(true); }
      if (e.key === 'Escape') setPending(null);
    };
    const up = (e) => { if (e.code === 'Space' && !isField(e)) { e.preventDefault(); setTalkHeld(false); } };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [modal]);

  /* ---------- 장비 연결 로직 ---------- */
  const portName = (d, p) => `${devices[d].name ?? DEVICE_TYPES[devices[d].type].name} ${p.label}`;
  const isPortUsed = (d, p) => connections.some((c) => (c.from.d === d && c.from.p === p) || (c.to.d === d && c.to.p === p));

  const tryConnect = (a, b) => {
    const defA = DEVICE_TYPES[devices[a.d].type];
    const defB = DEVICE_TYPES[devices[b.d].type];
    const pa = findPort(defA, a.p);
    const pb = findPort(defB, b.p);
    if (a.d === b.d) { addLog('같은 장비의 단자끼리는 연결할 수 없습니다.', 'warn'); sfx.error(); return; }
    if (pa.dir === pb.dir) {
      addLog(`${pa.dir === 'out' ? '출력 ↔ 출력' : '입력 ↔ 입력'}은 연결할 수 없습니다. 신호는 항상 출력(OUT) → 입력(IN)으로 흐릅니다.`, 'warn');
      sfx.error(); return;
    }
    const [from, to, pf, pt] = pa.dir === 'out' ? [a, b, pa, pb] : [b, a, pb, pa];
    if (isPortUsed(to.d, to.p) || isPortUsed(from.d, from.p)) { addLog('이미 케이블이 꽂혀 있는 단자입니다. 기존 케이블을 클릭해 먼저 분리하세요.', 'warn'); sfx.error(); return; }
    if (!selectedCable) { addLog('먼저 하단 인벤토리에서 사용할 케이블을 선택하세요.', 'warn'); sfx.error(); return; }
    if (!cables[selectedCable]) { addLog(`${CABLES[selectedCable].name}이(가) 남아 있지 않습니다. 기존 연결을 분리하면 회수됩니다.`, 'warn'); sfx.error(); return; }
    const bad = [pf, pt].find((p) => !PORT_ACCEPTS[p.kind].includes(selectedCable));
    if (bad) {
      sfx.error();
      penalize(50, `✖ 케이블 불일치: ${CABLES[selectedCable].name}은(는) ${PORT_KIND_LABEL[bad.kind]}에 꽂을 수 없습니다. ${MISMATCH_TIP[bad.kind]}`);
      return;
    }
    const c = conn(from.d, from.p, to.d, to.p, selectedCable);
    setConnections((cs) => [...cs, c]);
    setCables((cb) => ({ ...cb, [selectedCable]: cb[selectedCable] - 1 }));
    addLog(`🔌 ${portName(from.d, pf)} → ${portName(to.d, pt)} 연결 (${CABLES[selectedCable].short})`, 'ok');
    sfx.click();
    if (to.d === 'speaker' && speaker.power) { sfx.pop(); penalize(30, '💥 펑! 스피커 전원이 켜진 채 케이블을 꽂아 팝 노이즈가 났습니다. 연결 작업은 스피커를 끄고 하세요'); }
    if (from.d === 'mixer' && from.p === 'phones') addLog('참고: PHONES는 헤드폰 모니터링 출력입니다. 스피커에는 보통 MAIN OUT을 씁니다.', 'warn');
    if (from.d === 'mic' && mixer.phantom && devices.mic.type === 'condenser_mic') addLog('팁: 팬텀 전원이 켜진 상태에서 꽂으면 "툭" 소리가 날 수 있으니 페이더를 내리고 작업하세요.', 'info');
  };

  const disconnect = (c) => {
    setConnections((cs) => cs.filter((x) => x.id !== c.id));
    setCables((cb) => ({ ...cb, [c.cable]: (cb[c.cable] ?? 0) + 1 }));
    addLog(`케이블 분리: ${c.from.d}.${c.from.p} → ${c.to.d}.${c.to.p} (${CABLES[c.cable].short} 회수)`, 'info');
    if (c.to.d === 'speaker' && speaker.power) { sfx.pop(); addLog('💥 스피커가 켜진 채로 케이블을 뽑아 팝 노이즈가 났습니다.', 'warn'); }
    if (currentStage >= 3 && obs.streaming) addLog('주의: 방송 중에 케이블을 뽑았습니다!', 'warn');
  };

  const toCanvas = (e) => {
    const r = innerRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const onPortDown = (e, d, port, dir) => {
    e.stopPropagation();
    e.preventDefault();
    if (pending && !(pending.d === d && pending.p === port.id)) {
      tryConnect(pending, { d, p: port.id });
      setPending(null);
      return;
    }
    if (pending) { setPending(null); return; }
    pendingMoved.current = false;
    setPending({ d, p: port.id, dir });
    setPointer(toCanvas(e));
  };

  const onCanvasMove = (e) => {
    if (dragRef.current) {
      const { id, ox, oy } = dragRef.current;
      const p = toCanvas(e);
      const def = DEVICE_TYPES[devices[id].type];
      setDevices((ds) => ({
        ...ds,
        [id]: { ...ds[id], x: clamp(p.x - ox, 10, CANVAS_W - def.w - 10), y: clamp(p.y - oy, 6, CANVAS_H - deviceHeight(def) - 6) },
      }));
      return;
    }
    if (pending) { setPointer(toCanvas(e)); pendingMoved.current = true; }
  };

  const onCanvasUp = (e) => {
    if (dragRef.current) { dragRef.current = null; return; }
    if (!pending || !pendingMoved.current) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-port]');
    if (!el) return;
    const [d, p] = el.dataset.port.split(':');
    if (d === pending.d && p === pending.p) return;
    tryConnect(pending, { d, p });
    setPending(null);
  };

  const onHeaderDown = (e, id) => {
    e.stopPropagation();
    setSelectedDevice(id);
    if (pending) setPending(null);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toCanvas(e);
    dragRef.current = { id, ox: p.x - devices[id].x, oy: p.y - devices[id].y };
  };

  const placeDevice = (id) => {
    setDevices((ds) => ({ ...ds, [id]: { ...ds[id], placed: true } }));
    setSelectedDevice(id);
    const d = devices[id];
    addLog(`📦 ${d.name ?? DEVICE_TYPES[d.type].name}을(를) 작업 공간에 배치했습니다.`, 'info');
    sfx.click();
  };

  /* ---------- 장비 제어 ---------- */
  const setMix = (k, v) => setMixer((m) => ({ ...m, [k]: v }));

  const toggleSpeakerPower = () => {
    const on = !speaker.power;
    setSpeaker((s) => ({ ...s, power: on }));
    if (on) {
      if (mixer.mainFader > 10 && nominal.speakerLinked) {
        sfx.pop();
        penalize(30, '💥 펑! 메인 페이더가 올라간 상태로 스피커를 켜서 팝 노이즈가 났습니다. 페이더를 내리고 스피커를 마지막에 켜세요');
      } else addLog('스피커 전원 ON. 앰프가 예열되었습니다.', 'ok');
    } else addLog('스피커 전원 OFF.', 'info');
  };

  const atemSetProgram = (n) => {
    setAtem((a) => ({ ...a, program: n }));
    addLog(`ATEM: PGM → ${n === 0 ? 'BLACK' : `입력 ${n}`} (핫컷)`, 'info');
  };
  const atemCut = () => {
    setAtem((a) => ({ ...a, program: a.preview, preview: a.program || a.preview }));
    addLog(`ATEM: CUT! PGM ← 입력 ${atem.preview}`, 'info');
    sfx.click();
  };
  const atemAuto = () => {
    if (atem.transitioning) return;
    setAtem((a) => ({ ...a, transitioning: true }));
    addLog(`ATEM: AUTO 디졸브 전환 중… (PGM ← 입력 ${atem.preview})`, 'info');
    setTimeout(() => setAtem((a) => ({ ...a, program: a.preview, preview: a.program || a.preview, transitioning: false })), 900);
  };

  const toggleStream = () => {
    if (!obs.streaming) {
      setObs((o) => ({ ...o, streaming: true }));
      setViewers((v) => (v > 0 ? v : 35));
      addLog('● 방송 시작! ON AIR', 'ok');
      if (!nominal.videoOk) addLog(`경고: 영상이 정상이 아닙니다 (${nominal.obsVideo === 'black' ? '검은 화면 송출 중' : '영상 소스 확인'}).`, 'error');
      if (!nominal.audioOk) addLog('경고: 송출 오디오 신호가 없습니다!', 'error');
      sfx.ok();
    } else {
      setObs((o) => ({ ...o, streaming: false }));
      addLog('■ 방송 종료 (OFFLINE)', 'warn');
      if (currentStage === 4) addLog('방송을 끊으면 시청자가 이탈합니다. 송출을 유지한 채로 문제를 해결하세요.', 'warn');
    }
  };

  /* ---------- 힌트 ---------- */
  const hintsAvail = stage.hints.length + (currentStage === 4 ? 1 : 0);
  const revealHint = () => {
    const level = meta.hintsUsed;
    let text;
    if (level < stage.hints.length) text = stage.hints[level];
    else {
      const left = faults.filter((f) => !faultFixed(f, st, nominal));
      if (!left.length) return;
      text = `남은 원인 중 하나: ${FAULTS[left[0]].title}. ${FAULTS[left[0]].desc.replace('있었습니다', '있습니다')}`;
    }
    setMeta((m) => ({ ...m, hintsUsed: m.hintsUsed + 1, penalty: m.penalty + 100, revealed: [...(m.revealed ?? []), text] }));
    if (currentStage === 4 && level === 1) setTracerOn(true);
    addLog(`💡 힌트 ${level + 1}: ${text} (-100점)`, 'hint');
  };

  /* ---------- 점수 ---------- */
  const totalScore = Object.values(stageScores).reduce((a, b) => a + b, 0);
  const goNext = () => {
    if (currentStage < 4) loadStage(currentStage + 1);
    else setModal({ type: 'final' });
  };
  const restartAll = () => { setStageScores({}); loadStage(1); };

  /* ---------- 렌더 헬퍼 ---------- */
  const lv = (x) => (x == null ? null : x + (talking ? jitter : 0));
  const camTally = (id) => {
    const n = Object.entries(nominal.camAt).find(([, c]) => c === id)?.[0];
    if (!n) return null;
    if (Number(n) === atem.program) return 'pgm';
    if (Number(n) === atem.preview) return 'pvw';
    return null;
  };

  const connLive = (c) => {
    if (c.from.d === 'mic') return actual.chIn != null;
    if (c.from.d === 'mixer' && c.from.p === 'main') return actual.mainOut != null;
    if (c.from.d === 'mixer' && c.from.p === 'usb') return actual.usbSignal != null;
    if (c.from.d.startsWith('cam') || c.from.d === 'atem') return true;
    return false;
  };

  const renderStatus = (d) => {
    switch (d.type) {
      case 'dynamic_mic':
      case 'condenser_mic':
        return (
          <div className="flex items-center gap-2 text-[11px]">
            {actual.chIn != null
              ? <span className="flex items-center gap-1 text-green-400"><Activity size={14} className="animate-pulse" />신호 전송 중</span>
              : <span className="text-slate-500">{talking ? '신호 없음' : '대기 중'}</span>}
            {d.type === 'condenser_mic' && (
              <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${nominal.micPowered ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-400'}`}>48V</span>
            )}
          </div>
        );
      case 'analog_mixer':
      case 'digital_mixer':
        return (
          <div className="space-y-1.5 text-[10px] text-slate-400">
            <div className="flex items-center gap-2"><span className="w-9">{d.type === 'digital_mixer' ? 'CH01' : 'CH1'}</span><Meter thin level={lv(actual.chIn)} />
              {mixer.chMute && <span className="text-red-400 font-bold">M</span>}</div>
            <div className="flex items-center gap-2"><span className="w-9">MAIN</span><Meter thin level={lv(actual.mainOut)} />
              {mixer.mainMute && <span className="text-red-400 font-bold">M</span>}</div>
          </div>
        );
      case 'speaker':
        return (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-2.5 h-2.5 rounded-full ${speaker.power ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-slate-600'}`} />
            {actual.feedback
              ? <span className="text-red-400 font-bold animate-pulse">삐이이이——!!</span>
              : actual.audible
                ? <span className="flex items-center gap-1 text-sky-300"><Volume2 size={14} className="animate-pulse" />소리 출력 중</span>
                : <span className="text-slate-500">{speaker.power ? '무음' : '전원 꺼짐'}</span>}
            {currentStage === 2 && <span className="ml-auto text-[10px] text-slate-400">{speaker.position === 'front' ? '마이크 정면' : '마이크 뒤쪽'}</span>}
          </div>
        );
      case 'camera': {
        const t = camTally(d.id);
        return (
          <div className="flex items-center gap-2 text-[11px]">
            <span className={`w-3 h-3 rounded-full ${t === 'pgm' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : t === 'pvw' ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-600'}`} />
            <span className={t === 'pgm' ? 'text-red-400 font-bold' : t === 'pvw' ? 'text-green-400' : 'text-slate-500'}>
              {t === 'pgm' ? 'TALLY · 송출 중' : t === 'pvw' ? 'TALLY · 대기(PVW)' : '탈리 꺼짐'}
            </span>
          </div>
        );
      }
      case 'atem':
        return (
          <div className="flex gap-2 text-[10px] font-mono">
            <span className="px-2 py-1 rounded bg-red-900/60 text-red-300 border border-red-700">PGM {atem.program || 'BLK'}</span>
            <span className="px-2 py-1 rounded bg-green-900/50 text-green-300 border border-green-700">PVW {atem.preview}</span>
            {atem.transitioning && <span className="text-amber-300 animate-pulse self-center">AUTO…</span>}
          </div>
        );
      case 'pc':
        return (
          <div className="flex gap-2 items-stretch">
            <div className="w-[118px] aspect-video rounded overflow-hidden border border-slate-600 shrink-0">
              <Scene src={nominal.obsVideo} label={false} fade={atem.transitioning} />
            </div>
            <div className="flex-1 flex flex-col justify-between text-[10px] min-w-0">
              <span className={`self-start px-1.5 py-0.5 rounded font-bold ${obs.streaming ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                {obs.streaming ? '● LIVE' : 'OFFLINE'}
              </span>
              <span className="text-slate-400">오디오</span>
              <Meter thin level={lv(actual.obsAudio)} />
              {obs.streaming && <span className="text-slate-300 flex items-center gap-1"><Users size={11} />{viewers.toLocaleString()}</span>}
            </div>
          </div>
        );
      default: return null;
    }
  };

  /* ---------- 장비 제어 패널 ---------- */
  const renderPanel = () => {
    const d = devices[selectedDevice];
    if (!d) return <p className="text-sm text-slate-400">캔버스에서 장비를 클릭하면 제어 패널이 열립니다.</p>;
    const def = DEVICE_TYPES[d.type];
    const Icon = def.icon;
    const head = (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-sky-300" />
          <span className="font-bold">{d.name ?? def.name}</span>
          <span className="text-xs text-slate-400">{def.model}</span>
        </div>
        <details className="group text-xs text-slate-300 bg-sky-950/40 border border-sky-900 rounded p-2">
          <summary className="cursor-pointer select-none text-sky-300 flex items-center gap-1"><Info size={13} /> 기초 원리</summary>
          <p className="mt-1.5 leading-relaxed">{def.info}</p>
        </details>
      </div>
    );
    if (!d.placed) {
      return <div className="space-y-3">{head}<p className="text-sm text-amber-300">아직 배치되지 않았습니다. 하단 인벤토리에서 배치하세요.</p></div>;
    }
    switch (d.type) {
      case 'analog_mixer':
      case 'digital_mixer': {
        const digital = d.type === 'digital_mixer';
        return (
          <div className="space-y-3">
            {head}
            {digital && (
              <Section title="라우팅 (ROUTING)" icon={Cable}>
                <label htmlFor="ch1src" className="block text-xs text-slate-400">CH01 입력 패치 (Input Source)
                  <select id="ch1src" value={mixer.ch1Source}
                    onChange={(e) => { setMix('ch1Source', e.target.value); addLog(`X32: CH01 입력 소스 → ${e.target.selectedOptions[0].text}`, 'info'); }}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                    <option value="local1">Local In 1 (아날로그 XLR)</option>
                    <option value="local2">Local In 2 (아날로그 XLR)</option>
                    <option value="aes50a1">AES50 A-1 (디지털 스테이지박스)</option>
                    <option value="off">Off</option>
                  </select>
                </label>
                <label htmlFor="usbout" className="block text-xs text-slate-400">USB(Card) 출력 1-2 소스
                  <select id="usbout" value={mixer.usbOut}
                    onChange={(e) => { setMix('usbOut', e.target.value); addLog(`X32: USB 출력 1-2 → ${e.target.selectedOptions[0].text}`, 'info'); }}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                    <option value="main">Main L/R (메인 믹스)</option>
                    <option value="bus1">Mix Bus 1 (비어 있음)</option>
                    <option value="off">Off</option>
                  </select>
                </label>
              </Section>
            )}
            <Section title={digital ? 'CH01 채널 스트립' : 'CH1 채널 스트립'} icon={SlidersHorizontal}>
              <div className="flex flex-wrap gap-2">
                <ToggleBtn on={mixer.phantom} color="amber" title="콘덴서 마이크용 +48V 전원"
                  onClick={() => {
                    const on = !mixer.phantom;
                    setMix('phantom', on);
                    addLog(`+48V 팬텀 전원 ${on ? 'ON' : 'OFF'}`, 'info');
                    if (on && devices.mic?.type === 'dynamic_mic') addLog('참고: 다이나믹 마이크는 팬텀 전원이 필요 없습니다 (대부분 무해하지만 불필요).', 'info');
                  }}>
                  <Zap size={12} className="inline -mt-0.5" /> 48V
                </ToggleBtn>
                <ToggleBtn on={mixer.chMute} onClick={() => { setMix('chMute', !mixer.chMute); addLog(`CH1 MUTE ${!mixer.chMute ? 'ON' : 'OFF'}`, 'info'); }}>MUTE</ToggleBtn>
              </div>
              <Slider id="gain" label="GAIN (프리앰프)" value={mixer.gain} min={0} max={60} onChange={(v) => setMix('gain', v)} display={`+${mixer.gain} dB`} accent="accent-red-400" />
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>입력 미터 {talking ? '' : '(말하기 시 표시)'}</span><span className="font-mono tabular-nums text-slate-200">{fmtDb(actual.chIn)}</span></div>
                <Meter level={lv(actual.chIn)} target={currentStage === 2 ? [-20, -6] : null} />
                {currentStage === 2 && <div className="text-[11px] text-slate-500 mt-0.5">흰 테두리 = 목표 구간 (-20 ~ -6 dB)</div>}
              </div>
              {!digital && (
                <div className="grid grid-cols-3 gap-2">
                  <Slider id="eqh" label="HIGH" value={mixer.eqHigh} min={-15} max={15} onChange={(v) => setMix('eqHigh', v)} display={`${mixer.eqHigh > 0 ? '+' : ''}${mixer.eqHigh}`} accent="accent-amber-300" />
                  <Slider id="eqm" label="MID 2.5k" value={mixer.eqMid} min={-15} max={15} onChange={(v) => setMix('eqMid', v)} display={`${mixer.eqMid > 0 ? '+' : ''}${mixer.eqMid}`} accent="accent-amber-300" />
                  <Slider id="eql" label="LOW" value={mixer.eqLow} min={-15} max={15} onChange={(v) => setMix('eqLow', v)} display={`${mixer.eqLow > 0 ? '+' : ''}${mixer.eqLow}`} accent="accent-amber-300" />
                </div>
              )}
              <Slider id="chf" label="채널 페이더" value={mixer.chFader} min={0} max={100} onChange={(v) => setMix('chFader', v)} display={fmtDb(faderDb(mixer.chFader))} />
            </Section>
            <Section title={digital ? 'MAIN L/R 버스' : 'MAIN 마스터'} icon={Volume2}>
              <div className="flex gap-2">
                <ToggleBtn on={mixer.mainMute} onClick={() => { setMix('mainMute', !mixer.mainMute); addLog(`MAIN MUTE ${!mixer.mainMute ? 'ON' : 'OFF'}`, 'info'); }}>MAIN MUTE</ToggleBtn>
              </div>
              <Slider id="mainf" label="메인 페이더" value={mixer.mainFader} min={0} max={100} onChange={(v) => setMix('mainFader', v)} display={fmtDb(faderDb(mixer.mainFader))} />
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>MAIN 출력 미터</span><span className="font-mono tabular-nums text-slate-200">{fmtDb(actual.mainOut)}</span></div>
                <Meter level={lv(actual.mainOut)} />
              </div>
            </Section>
          </div>
        );
      }
      case 'speaker':
        return (
          <div className="space-y-3">
            {head}
            <Section title="전원 / 배치" icon={Power}>
              <ToggleBtn on={speaker.power} color="green" onClick={toggleSpeakerPower}><Power size={12} className="inline -mt-0.5" /> POWER {speaker.power ? 'ON' : 'OFF'}</ToggleBtn>
              {currentStage === 2 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-400">스피커 위치</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[['front', '마이크 정면 (마이크를 향함)'], ['behind', '마이크 뒤쪽 (객석을 향함)']].map(([v, t]) => (
                      <button key={v} type="button"
                        onClick={() => { setSpeaker((s) => ({ ...s, position: v })); addLog(`스피커를 ${t}으로 옮겼습니다.`, 'info'); }}
                        className={`text-xs p-2 rounded border ${speaker.position === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1"><span>스피커 출력</span><span className="font-mono tabular-nums">{actual.feedback ? '하울링!' : fmtDb(actual.speakerLevel)}</span></div>
                <Meter level={actual.feedback ? 6 : lv(actual.speakerLevel)} />
              </div>
            </Section>
          </div>
        );
      case 'atem':
        return (
          <div className="space-y-3">
            {head}
            <Section title="스위처 컨트롤" icon={Tv}>
              <div className="grid grid-cols-2 gap-2">
                <div className="aspect-video rounded overflow-hidden border-2 border-green-600 relative">
                  <Scene src={nominal.previewCam ?? 'black'} />
                  <span className="absolute top-1 left-1 text-[10px] font-bold bg-green-700 px-1 rounded">PVW</span>
                </div>
                <div className="aspect-video rounded overflow-hidden border-2 border-red-600 relative">
                  <Scene src={nominal.programCam ?? 'black'} fade={atem.transitioning} />
                  <span className="absolute top-1 left-1 text-[10px] font-bold bg-red-700 px-1 rounded">PGM</span>
                </div>
              </div>
              {[['PGM', 'program', 'bg-red-600 border-red-400', atemSetProgram], ['PVW', 'preview', 'bg-green-600 border-green-400', (n) => { setAtem((a) => ({ ...a, preview: n })); }]].map(([lbl, key, onCls, fn]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-9 text-[11px] font-bold text-slate-400">{lbl}</span>
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} type="button" onClick={() => fn(n)}
                      title={nominal.camAt[n] ? devices[nominal.camAt[n]].name : '입력 없음'}
                      className={`w-9 h-9 rounded border text-sm font-bold ${atem[key] === n ? onCls : 'bg-slate-700 border-slate-600 hover:bg-slate-600'} ${nominal.camAt[n] ? '' : 'opacity-50'}`}>{n}</button>
                  ))}
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" onClick={atemCut} className="flex-1 py-2 rounded bg-slate-200 text-slate-900 font-black hover:bg-white">CUT</button>
                <button type="button" onClick={atemAuto} className={`flex-1 py-2 rounded font-black ${atem.transitioning ? 'bg-amber-400 text-slate-900' : 'bg-amber-600 hover:bg-amber-500'}`}>AUTO</button>
              </div>
              <p className="text-[11px] text-slate-500">PVW에서 다음 화면을 고르고 CUT(즉시) 또는 AUTO(디졸브)로 PGM에 송출합니다.</p>
            </Section>
          </div>
        );
      case 'pc':
        return (
          <div className="space-y-3">
            {head}
            <Section title="OBS Studio" icon={MonitorPlay}>
              <div className="aspect-video rounded overflow-hidden border border-slate-600 relative">
                <Scene src={nominal.obsVideo} fade={atem.transitioning} />
                {obs.streaming && <span className="absolute top-1.5 right-1.5 text-[10px] font-bold bg-red-600 px-1.5 rounded animate-pulse">● LIVE</span>}
              </div>
              <label htmlFor="obsv" className="block text-xs text-slate-400">영상 소스 (Video Capture Device)
                <select id="obsv" value={obs.videoSource}
                  onChange={(e) => { setObs((o) => ({ ...o, videoSource: e.target.value })); addLog(`OBS: 영상 소스 → ${e.target.selectedOptions[0].text}`, 'info'); }}
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                  <option value="none">선택 안 함</option>
                  <option value="atem">Blackmagic ATEM Mini (USB)</option>
                  <option value="facecam">PC 내장 웹캠</option>
                </select>
              </label>
              <label htmlFor="obsa" className="block text-xs text-slate-400">오디오 소스 (Audio Input)
                <select id="obsa" value={obs.audioSource}
                  onChange={(e) => {
                    setObs((o) => ({ ...o, audioSource: e.target.value }));
                    addLog(`OBS: 오디오 소스 → ${e.target.selectedOptions[0].text}`, 'info');
                    if (e.target.value === 'builtin') addLog('PC 내장 마이크는 방송 품질이 아니고 진행자 마이크 소리를 받지 못합니다.', 'warn');
                  }}
                  className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100">
                  <option value="none">선택 안 함</option>
                  <option value="x32">X32 USB Audio (Ch 1-2)</option>
                  <option value="builtin">PC 내장 마이크</option>
                </select>
              </label>
              <div className="flex items-center gap-2">
                <button type="button" title={obs.audioMuted ? '음소거 해제' : '음소거'}
                  onClick={() => { setObs((o) => ({ ...o, audioMuted: !o.audioMuted })); addLog(`OBS 오디오 ${obs.audioMuted ? '음소거 해제' : '음소거'}`, 'info'); }}
                  className={`p-1.5 rounded border ${obs.audioMuted ? 'bg-red-700 border-red-400' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>
                  {obs.audioMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <div className="flex-1"><Meter level={lv(actual.obsAudio)} /></div>
              </div>
              <button type="button" onClick={toggleStream}
                className={`w-full py-2.5 rounded font-bold flex items-center justify-center gap-2 ${obs.streaming ? 'bg-slate-200 text-slate-900 hover:bg-white' : 'bg-red-600 hover:bg-red-500'}`}>
                <Radio size={16} /> {obs.streaming ? '방송 중지' : '방송 시작'}
              </button>
            </Section>
            {obs.streaming && (
              <Section title={`라이브 채팅 · 시청자 ${viewers.toLocaleString()}명`} icon={MessageSquare}>
                <div className="space-y-1 text-xs min-h-[60px]">
                  {chat.map((m) => <div key={m.id}><span className="text-sky-300">{m.name}</span> <span className="text-slate-200">{m.text}</span></div>)}
                </div>
              </Section>
            )}
          </div>
        );
      case 'camera': {
        const t = camTally(d.id);
        const at = Object.entries(nominal.camAt).find(([, c]) => c === d.id)?.[0];
        return (
          <div className="space-y-3">
            {head}
            <div className="aspect-video rounded overflow-hidden border border-slate-600"><Scene src={d.id} /></div>
            <p className="text-sm text-slate-300">{at ? `ATEM 입력 ${at}에 연결됨 · ${t === 'pgm' ? '송출 중(PGM)' : t === 'pvw' ? '대기 중(PVW)' : '대기'}` : 'ATEM에 연결되지 않았습니다.'}</p>
          </div>
        );
      }
      default:
        return (
          <div className="space-y-3">
            {head}
            <p className="text-sm text-slate-300">
              {nominal.micAtCh ? '믹서 채널에 연결되어 있습니다.' : nominal.micConn ? '믹서에 꽂혀 있지만 채널로 신호가 가지 않습니다.' : '믹서에 연결되지 않았습니다.'}
              {d.type === 'condenser_mic' && (nominal.micPowered ? ' 48V 팬텀 전원 공급 중.' : ' 48V 팬텀 전원이 공급되지 않고 있습니다!')}
            </p>
          </div>
        );
    }
  };

  /* ---------- 캔버스 렌더 ---------- */
  const placedDevices = Object.values(devices).filter((d) => d.placed);
  const unplaced = Object.values(devices).filter((d) => !d.placed);
  const pendingPos = pending ? portPos(devices[pending.d], DEVICE_TYPES[devices[pending.d].type], pending.p) : null;
  const cablePath = (a, b) => {
    const dx = Math.max(50, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const LOG_COLORS = { info: 'text-slate-300', ok: 'text-green-400', warn: 'text-amber-300', error: 'text-red-400', hint: 'text-sky-300', stage: 'text-fuchsia-300 font-bold' };
  const elapsedLabel = () => {
    const s = Math.round((Date.now() - meta.start) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const liveBroken = isLive && !(nominal.audioOk && nominal.videoOk);

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-4 sm:px-6 font-sans">
      <style>{`
        @keyframes bm-flow { to { stroke-dashoffset: -24; } }
        .bm-flow { stroke-dasharray: 8 6; animation: bm-flow .6s linear infinite; }
        @keyframes bm-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-2px)} 75%{transform:translateX(2px)} }
        .bm-shake { animation: bm-shake .12s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .bm-flow, .bm-shake, .animate-pulse { animation: none !important; } }
      `}</style>

      {/* Header */}
      <header className="flex flex-wrap gap-4 justify-between items-center bg-slate-800 p-4 rounded-lg shadow-lg mb-4 border-b-4 border-slate-700">
        <div className="min-w-0 flex-1 basis-[320px]">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-blue-400">방송장비 마스터 🎛️</h1>
            <nav className="flex gap-1" aria-label="스테이지 선택">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => loadStage(n)} title={STAGES[n].title}
                  className={`w-8 h-8 rounded text-sm font-bold border ${n === currentStage ? 'bg-blue-600 border-blue-400' : stageScores[n] ? 'bg-green-800 border-green-600 text-green-200' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>
                  {n}
                </button>
              ))}
            </nav>
          </div>
          <p className="text-slate-400 mt-1"><span className="text-slate-200 font-semibold">{stage.title}</span> <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 ml-1">{stage.tag}</span></p>
          <p className="text-slate-300 text-sm mt-1">{stage.mission}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-right mr-1">
            <div className="text-[11px] text-slate-400">총점</div>
            <div className="font-mono font-bold text-lg tabular-nums text-amber-300">{totalScore.toLocaleString()}</div>
          </div>
          <button type="button" onClick={() => setModal({ type: 'hint' })}
            className="px-3 py-2 rounded-md bg-amber-500 text-slate-900 font-bold flex items-center gap-1.5 hover:bg-amber-400">
            <Lightbulb size={18} /> 힌트 <span className="text-xs">({meta.hintsUsed}/{hintsAvail})</span>
          </button>
          <button type="button" onClick={() => { const on = !soundOn; setSoundOn(on); if (on) sfx.ensure(); }}
            title={soundOn ? '효과음 끄기' : '효과음 켜기 (하울링 소리 포함)'}
            className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600">
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} className="text-slate-400" />}
          </button>
          <button type="button" onClick={() => loadStage(currentStage)} title="스테이지 다시 시작"
            className="p-2 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600"><RotateCcw size={18} /></button>
          <div className={`px-5 py-2 rounded-full font-bold flex items-center gap-2 border-2 ${isLive ? (liveBroken ? 'bg-amber-600 border-amber-300 animate-pulse' : 'bg-red-600 border-red-300 animate-pulse shadow-[0_0_20px_rgba(239,68,68,.7)]') : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
            <Radio size={20} />
            {isLive ? (liveBroken ? 'ON AIR · 이상' : 'ON AIR') : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 lg:self-start bg-slate-800 rounded-lg p-3 border-2 border-slate-700 min-w-0 flex flex-col gap-3">
          {/* 툴바 */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400 flex items-center gap-1"><Cable size={15} /> 선택한 케이블:</span>
            {selectedCable
              ? <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-600"><span className={`w-2.5 h-2.5 rounded-full ${CABLES[selectedCable].dot}`} />{CABLES[selectedCable].name} ×{cables[selectedCable] ?? 0}</span>
              : <span className="text-amber-300">없음</span>}
            {pending && <span className="text-sky-300 animate-pulse">→ 연결할 반대쪽 단자를 클릭하세요 (Esc 취소)</span>}
            <div className="ml-auto flex items-center gap-2">
              {stage.autoTalk
                ? <span className="flex items-center gap-1.5 text-xs text-green-300 px-2 py-1 rounded bg-green-950 border border-green-800"><Mic size={14} className="animate-pulse" /> 진행자 발언 중</span>
                : (
                  <button type="button"
                    onPointerDown={(e) => { e.preventDefault(); setTalkHeld(true); }}
                    onPointerUp={() => setTalkHeld(false)} onPointerLeave={() => setTalkHeld(false)} onPointerCancel={() => setTalkHeld(false)}
                    className={`touch-none select-none px-4 py-2 rounded-md font-bold flex items-center gap-2 border ${talkHeld ? 'bg-green-600 border-green-300' : 'bg-slate-700 border-slate-500 hover:bg-slate-600'}`}>
                    <Hand size={16} /> {talkHeld ? '"아, 아— 마이크 테스트"' : '말하기 (누르고 있기 · Space)'}
                  </button>
                )}
            </div>
          </div>

          {/* 장비 배치 영역 (Canvas) */}
          <div ref={wrapRef} className="w-full overflow-x-auto rounded-md">
            <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale }}>
              <div
                ref={innerRef}
                className={`relative origin-top-left rounded-md border border-slate-700 ${actual.feedback ? 'bm-shake' : ''}`}
                style={{
                  width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})`,
                  backgroundColor: '#0b1220',
                  backgroundImage: 'radial-gradient(circle, rgba(148,163,184,.14) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
                onPointerMove={onCanvasMove}
                onPointerUp={onCanvasUp}
                onPointerDown={() => { if (pending) setPending(null); }}
              >
                {/* 케이블 레이어 */}
                <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} style={{ overflow: 'visible' }}>
                  {connections.map((c) => {
                    const a = portPos(devices[c.from.d], DEVICE_TYPES[devices[c.from.d].type], c.from.p);
                    const b = portPos(devices[c.to.d], DEVICE_TYPES[devices[c.to.d].type], c.to.p);
                    const path = cablePath(a, b);
                    const live = connLive(c);
                    return (
                      <g key={c.id} className="cursor-pointer group" onPointerDown={(e) => { e.stopPropagation(); disconnect(c); }}>
                        <title>{CABLES[c.cable].name} · 클릭하면 분리</title>
                        <path d={path} stroke="transparent" strokeWidth={16} fill="none" />
                        <path d={path} stroke="#020617" strokeWidth={7} fill="none" strokeLinecap="round" />
                        <path d={path} stroke={CABLES[c.cable].stroke} strokeWidth={4} fill="none" strokeLinecap="round" className="group-hover:opacity-60" />
                        {live && <path d={path} stroke="#ffffff" strokeOpacity={0.75} strokeWidth={2} fill="none" className="bm-flow" />}
                      </g>
                    );
                  })}
                  {actual.feedback && devices.speaker?.placed && devices.mic?.placed && (
                    <path
                      d={`M ${devices.speaker.x} ${devices.speaker.y + 10} Q ${(devices.speaker.x + devices.mic.x) / 2} ${devices.mic.y - 120}, ${devices.mic.x + 80} ${devices.mic.y}`}
                      stroke="#ef4444" strokeWidth={3} fill="none" className="bm-flow" opacity={0.8}
                    />
                  )}
                  {pending && pendingPos && pointer && (
                    <path d={pending.dir === 'out' ? cablePath(pendingPos, pointer) : cablePath(pointer, pendingPos)}
                      stroke={selectedCable ? CABLES[selectedCable].stroke : '#94a3b8'} strokeWidth={3} strokeDasharray="6 5" fill="none" pointerEvents="none" />
                  )}
                </svg>

                {placedDevices.map((d) => {
                  const def = DEVICE_TYPES[d.type];
                  const Icon = def.icon;
                  const h = deviceHeight(def);
                  const selected = selectedDevice === d.id;
                  const ports = [...def.ins.map((p, i) => ({ ...p, dir: 'in', i })), ...def.outs.map((p, i) => ({ ...p, dir: 'out', i }))];
                  return (
                    <div key={d.id}
                      className={`absolute rounded-lg bg-slate-800 border-2 shadow-xl ${selected ? 'border-sky-400' : 'border-slate-600'} ${d.id === 'speaker' && actual.feedback ? 'ring-4 ring-red-500/70' : ''}`}
                      style={{ left: d.x, top: d.y, width: def.w, height: h }}
                      onPointerDown={(e) => { e.stopPropagation(); setSelectedDevice(d.id); if (pending) setPending(null); }}
                    >
                      <div
                        className="flex items-center gap-2 px-2.5 rounded-t-md bg-slate-700 cursor-grab active:cursor-grabbing touch-none select-none"
                        style={{ height: HEADER_H - 6 }}
                        onPointerDown={(e) => onHeaderDown(e, d.id)}
                        title="드래그하여 이동 · 클릭하여 제어 패널 열기"
                      >
                        <Icon size={18} className={d.id === 'speaker' && actual.audible ? 'text-sky-300' : 'text-gray-300'} />
                        <div className="leading-tight min-w-0">
                          <div className="text-[13px] font-bold truncate">{d.name ?? def.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{def.model}</div>
                        </div>
                      </div>
                      {ports.map((p) => {
                        const used = isPortUsed(d.id, p.id);
                        const isPending = pending && pending.d === d.id && pending.p === p.id;
                        const candidate = pending && !isPending && pending.dir !== p.dir && pending.d !== d.id && !used;
                        const top = HEADER_H + p.i * ROW_H;
                        return (
                          <React.Fragment key={p.id}>
                            <span className={`absolute text-[10px] font-mono text-slate-300 ${p.dir === 'in' ? 'left-4' : 'right-4 text-right'}`}
                              style={{ top: top + 6 }}>{p.label}</span>
                            <div
                              data-port={`${d.id}:${p.id}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`${d.name ?? def.name} ${p.label} (${PORT_KIND_LABEL[p.kind]})`}
                              title={`${p.label} · ${PORT_KIND_LABEL[p.kind]} · ${p.dir === 'in' ? '입력' : '출력'}`}
                              onPointerDown={(e) => onPortDown(e, d.id, p, p.dir)}
                              onKeyDown={(e) => { if (e.key === 'Enter') onPortDown(e, d.id, p, p.dir); }}
                              className="absolute touch-none cursor-crosshair rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                              style={{ left: p.dir === 'in' ? -10 : def.w - 14, top: top + ROW_H / 2 - 10, width: 20, height: 20 }}
                            >
                              <div className={`w-full h-full rounded-full border-[3px] transition ${isPending ? 'scale-125 bg-white' : used ? '' : 'bg-slate-950'} ${candidate ? 'ring-4 ring-sky-400/60 animate-pulse' : ''} hover:scale-125`}
                                style={{ borderColor: PORT_COLOR[p.kind], backgroundColor: used && !isPending ? PORT_COLOR[p.kind] : undefined }} />
                            </div>
                          </React.Fragment>
                        );
                      })}
                      <div className="absolute left-2.5 right-2.5" style={{ top: HEADER_H + deviceRows(def) * ROW_H + 4 }}>
                        {renderStatus(d)}
                      </div>
                    </div>
                  );
                })}

                {placedDevices.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 pointer-events-none">
                    <Package size={42} />
                    <p>하단 인벤토리에서 장비를 꺼내 배치하세요.</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-3 text-[11px] text-slate-500 pointer-events-none">
                  ● 오른쪽 = 출력(OUT) · 왼쪽 = 입력(IN) · 단자 클릭 또는 드래그로 연결 · 케이블 클릭 시 분리 · 장비 상단을 드래그해 이동
                </div>
              </div>
            </div>
          </div>

          {/* 신호 추적기 */}
          <div className="bg-slate-900 rounded-md p-3 border border-slate-700">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Activity size={13} /> 신호 흐름 추적기 (Signal Flow)</div>
            {tracerOn ? (
              <div className="space-y-2">
                {[['오디오', trace.audio], ...(trace.video ? [['비디오', trace.video]] : [])].map(([name, steps]) => (
                  <div key={name} className="flex items-center gap-1 flex-wrap text-[11px]">
                    <span className="w-12 text-slate-400 shrink-0">{name}</span>
                    {steps.map((s, i) => (
                      <React.Fragment key={s.label}>
                        {i > 0 && <ChevronRight size={12} className={s.status === 'idle' ? 'text-slate-700' : 'text-slate-500'} />}
                        <span className={`px-1.5 py-0.5 rounded border ${{
                          ok: 'bg-green-950 border-green-700 text-green-300',
                          warn: 'bg-amber-950 border-amber-600 text-amber-300',
                          fail: 'bg-red-950 border-red-500 text-red-300 animate-pulse',
                          idle: 'bg-slate-900 border-slate-800 text-slate-600',
                        }[s.status]}`}>
                          {s.label}{s.status === 'warn' ? ` · ${s.warn}` : ''}{s.status === 'fail' ? ' ✖' : ''}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1.5"><Wrench size={13} /> 돌발 상황에서는 신호 추적기가 꺼져 있습니다. 직접 장비를 점검하거나 힌트 2단계에서 켤 수 있습니다.</p>
            )}
          </div>
        </div>

        {/* 미션 + 장비 제어 */}
        <aside className="flex flex-col gap-4 min-w-0">
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-2">
              <h2 className="text-lg font-semibold">미션</h2>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {objectiveStatus.filter((o) => o.done).length}/{objectiveStatus.length}
                {currentStage >= 3 && obs.streaming && ` · 시청자 ${viewers.toLocaleString()}`}
                {meta.penalty > 0 && ` · 감점 ${meta.penalty}`}
              </span>
            </div>
            <ul className="space-y-1.5">
              {objectiveStatus.map((o) => (
                <li key={o.id} className={`flex items-start gap-2 text-sm ${o.done ? 'text-green-300' : 'text-slate-300'}`}>
                  {o.done ? <CheckCircle2 size={17} className="shrink-0 mt-0.5" /> : <Circle size={17} className="shrink-0 mt-0.5 text-slate-500" />}
                  <span>{o.label}</span>
                </li>
              ))}
            </ul>
            {cleared && (
              <button type="button" onClick={goNext} className="mt-3 w-full py-2 rounded bg-green-600 hover:bg-green-500 font-bold flex items-center justify-center gap-1">
                {currentStage < 4 ? '다음 스테이지' : '최종 결과'} <ChevronRight size={16} />
              </button>
            )}
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-slate-700 lg:max-h-[640px] lg:overflow-y-auto">
            <h2 className="text-lg font-semibold border-b border-slate-600 pb-2 mb-3">장비 제어 패널</h2>
            {renderPanel()}
          </div>
        </aside>
      </div>

      {/* Inventory & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="bg-slate-800 rounded-lg p-4 flex flex-col gap-4 border-2 border-slate-700">
          <div>
            <h2 className="text-lg font-semibold border-b border-slate-600 pb-2 mb-2">인벤토리 · 장비</h2>
            {unplaced.length ? (
              <div className="flex flex-col gap-2">
                {unplaced.map((d) => {
                  const def = DEVICE_TYPES[d.type];
                  const Icon = def.icon;
                  return (
                    <div key={d.id} className="flex items-center gap-2 bg-slate-900 rounded p-2 border border-slate-700">
                      <Icon size={18} className="text-slate-300" />
                      <div className="text-sm leading-tight flex-1 min-w-0"><div className="truncate">{d.name ?? def.name}</div><div className="text-[11px] text-slate-500">{def.model}</div></div>
                      <button type="button" onClick={() => placeDevice(d.id)} className="text-xs px-2.5 py-1 rounded bg-blue-700 hover:bg-blue-600 font-bold">배치</button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-slate-500">모든 장비가 작업 공간에 배치되었습니다.</p>}
          </div>
          <div>
            <h2 className="text-lg font-semibold border-b border-slate-600 pb-2 mb-2">인벤토리 · 케이블</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(cables).map(([k, n]) => (
                <button key={k} type="button" onClick={() => setSelectedCable(k)} title={CABLES[k].desc}
                  className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-2 border transition ${selectedCable === k ? 'bg-blue-800 border-blue-300 text-white' : 'bg-blue-950 border-blue-900 text-blue-200 hover:bg-blue-900'} ${n === 0 ? 'opacity-50' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${CABLES[k].dot}`} />
                  {CABLES[k].name} <span className="font-mono text-xs">×{n}</span>
                </button>
              ))}
            </div>
            {selectedCable && <p className="text-xs text-slate-400 mt-2">{CABLES[selectedCable].name}: {CABLES[selectedCable].desc}</p>}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 rounded-lg p-4 border-2 border-slate-700 flex flex-col min-w-0">
          <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-2">
            <h2 className="text-lg font-semibold">시스템 로그</h2>
            <span className="text-xs text-slate-500 font-mono">경과 {elapsedLabel()}</span>
          </div>
          <div className="h-56 bg-black rounded-lg p-3 overflow-y-auto font-mono text-sm space-y-0.5">
            {systemLog.map((log) => (
              <div key={log.id} className={LOG_COLORS[log.type] ?? 'text-green-400'}>
                <span className="text-slate-600">{log.time ? `[${log.time}] ` : ''}</span>{`> ${log.msg}`}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onPointerDown={(e) => { if (e.target === e.currentTarget && modal.type === 'hint') setModal(null); }}>
          <div className="bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative">
            {modal.type === 'briefing' && (
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-widest text-sky-400">STAGE {currentStage} · {stage.tag}</div>
                <h2 className="text-2xl font-bold">{stage.title.split(': ')[1]}</h2>
                {stage.briefing.map((p) => <p key={p} className="text-slate-300 leading-relaxed">{p}</p>)}
                <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-amber-300 font-bold mb-1">MISSION</div>
                  <p className="text-sm">{stage.mission}</p>
                </div>
                {currentStage === 1 && (
                  <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                    <li>인벤토리에서 장비를 <b className="text-slate-200">배치</b>하고 케이블 종류를 고릅니다.</li>
                    <li>장비의 <b className="text-slate-200">출력 단자(오른쪽 ●)</b>를 누른 뒤 <b className="text-slate-200">입력 단자(왼쪽 ●)</b>를 누르면 연결됩니다. 드래그도 됩니다.</li>
                    <li>장비를 클릭하면 오른쪽 패널에서 GAIN·페이더·전원 등을 조작할 수 있습니다.</li>
                    <li>막히면 <b className="text-amber-300">힌트</b>를 쓰세요 (감점 -100).</li>
                  </ul>
                )}
                <button type="button" onClick={() => { setModal(null); setMeta((m) => ({ ...m, start: Date.now() })); }} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold flex items-center justify-center gap-2">
                  <Play size={18} /> 작업 시작
                </button>
              </div>
            )}
            {modal.type === 'hint' && (
              <div className="space-y-4">
                <button type="button" onClick={() => setModal(null)} className="absolute top-3 right-3 p-1 rounded hover:bg-slate-700" aria-label="닫기"><X size={18} /></button>
                <h2 className="text-xl font-bold flex items-center gap-2"><Lightbulb className="text-amber-400" /> 선배 엔지니어의 힌트</h2>
                {(meta.revealed ?? []).length === 0 && <p className="text-slate-400 text-sm">아직 확인한 힌트가 없습니다. 힌트마다 100점이 감점됩니다.</p>}
                <ol className="space-y-2">
                  {(meta.revealed ?? []).map((h, i) => (
                    <li key={h} className="bg-slate-900 border border-slate-700 rounded p-3 text-sm leading-relaxed"><span className="text-amber-300 font-bold mr-1">#{i + 1}</span>{h}</li>
                  ))}
                </ol>
                {meta.hintsUsed < hintsAvail && !cleared ? (
                  <button type="button" onClick={revealHint} className="w-full py-2.5 rounded-lg bg-amber-500 text-slate-900 font-bold hover:bg-amber-400">
                    힌트 {meta.hintsUsed + 1} 보기 (-100점)
                  </button>
                ) : <p className="text-xs text-slate-500">더 이상 볼 수 있는 힌트가 없습니다.</p>}
              </div>
            )}
            {modal.type === 'clear' && (
              <div className="space-y-4 text-center">
                <Trophy size={52} className="mx-auto text-amber-400" />
                <h2 className="text-2xl font-bold">스테이지 {currentStage} 클리어!</h2>
                {currentStage === 4 && (
                  <div className="text-left bg-slate-900 rounded-lg p-3 border border-slate-700 space-y-1 text-sm">
                    <div className="text-xs text-sky-300 font-bold mb-1">찾아낸 원인</div>
                    {faults.map((f) => <div key={f} className="flex gap-2"><Wrench size={14} className="text-green-400 shrink-0 mt-0.5" /><span><b>{FAULTS[f].title}</b> · {FAULTS[f].desc}</span></div>)}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">기본</div><div className="font-mono">1000</div></div>
                  <div className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">시간 보너스 ({modal.elapsed}초)</div><div className="font-mono text-green-400">+{modal.timeBonus}</div></div>
                  <div className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">감점</div><div className="font-mono text-red-400">-{modal.penalty}</div></div>
                </div>
                <div className="text-3xl font-black font-mono text-amber-300">{modal.score.toLocaleString()}점</div>
                {stageScores[currentStage] !== modal.score && <p className="text-xs text-slate-400">재도전 기록은 총점에 반영되지 않습니다 (첫 클리어 점수 유지).</p>}
                <div className="text-left bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-sky-300 font-bold mb-1.5">이번 스테이지에서 배운 것</div>
                  <ul className="space-y-1 text-sm text-slate-300 list-disc pl-4">{stage.lessons.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600">더 둘러보기</button>
                  <button type="button" onClick={goNext} className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 font-bold flex items-center justify-center gap-1">
                    {currentStage < 4 ? '다음 스테이지' : '최종 결과'} <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
            {modal.type === 'final' && (() => {
              const max = 4 * 1300;
              const ratio = totalScore / max;
              const [rank, title] = ratio >= 0.85 ? ['S', '방송장비 마스터'] : ratio >= 0.7 ? ['A', '시니어 방송 엔지니어'] : ratio >= 0.5 ? ['B', '주니어 방송 엔지니어'] : ['C', '수습 방송 스태프'];
              return (
                <div className="space-y-4 text-center">
                  <Award size={56} className="mx-auto text-amber-400" />
                  <div className="text-xs font-bold uppercase tracking-widest text-sky-400">Certificate of Completion</div>
                  <h2 className="text-2xl font-bold">수료를 축하합니다!</h2>
                  <div className="text-7xl font-black text-amber-300">{rank}</div>
                  <div className="text-lg font-semibold">{title}</div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="bg-slate-900 rounded p-2"><div className="text-slate-400 text-xs">STAGE {n}</div><div className="font-mono">{stageScores[n] ?? '—'}</div></div>
                    ))}
                  </div>
                  <div className="text-2xl font-mono font-bold">총점 {totalScore.toLocaleString()}</div>
                  <p className="text-sm text-slate-400">신호 흐름, 케이블 규격, 게인 스테이징, 디지털 라우팅, 스위칭, 송출, 트러블슈팅까지 모두 경험했습니다.</p>
                  <button type="button" onClick={restartAll} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold flex items-center justify-center gap-2">
                    <RotateCcw size={18} /> 처음부터 다시 도전
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
