import { Mic, Speaker, Monitor, Settings, Video, SlidersHorizontal, Tv } from 'lucide-react';

/* =====================================================================
 * 방송장비 마스터 — 게임 데이터 & 신호 계산 엔진
 * (2D 배선도와 3D 스튜디오가 함께 사용)
 * ===================================================================== */

/* ---------------------------- 캔버스 상수 ---------------------------- */
export const CANVAS_W = 1000;
export const CANVAS_H = 560;
export const HEADER_H = 40;
export const ROW_H = 26;

/* ---------------------------- 케이블 / 단자 ---------------------------- */
export const CABLES = {
  xlr: { name: 'XLR 케이블', short: 'XLR', desc: '3핀 밸런스드 · 마이크/라인 신호', stroke: '#60a5fa', dot: 'bg-blue-400' },
  trs: { name: 'TS/TRS 케이블', short: 'TRS', desc: '6.3mm(55) 잭 · 악기/라인 신호', stroke: '#fbbf24', dot: 'bg-amber-400' },
  hdmi: { name: 'HDMI 케이블', short: 'HDMI', desc: '디지털 영상+음성 · 단거리용', stroke: '#c084fc', dot: 'bg-purple-400' },
  sdi: { name: 'SDI 케이블', short: 'SDI', desc: 'BNC 커넥터 · 방송용 장거리 영상', stroke: '#fb923c', dot: 'bg-orange-400' },
  usb: { name: 'USB-C 케이블', short: 'USB', desc: '데이터 · 오디오 인터페이스/웹캠 신호', stroke: '#4ade80', dot: 'bg-green-400' },
};

export const PORT_ACCEPTS = {
  xlr: ['xlr'], trs: ['trs'], combo: ['xlr', 'trs'], hdmi: ['hdmi'], sdi: ['sdi'], usb: ['usb'],
};
export const PORT_KIND_LABEL = {
  xlr: 'XLR 단자', trs: '6.3mm TRS 단자', combo: 'XLR/TRS 콤보 단자',
  hdmi: 'HDMI 단자', sdi: 'BNC(SDI) 단자', usb: 'USB-C 단자',
};
export const PORT_COLOR = {
  xlr: '#60a5fa', trs: '#fbbf24', combo: '#94a3b8', hdmi: '#c084fc', sdi: '#fb923c', usb: '#4ade80',
};
export const MISMATCH_TIP = {
  xlr: 'XLR 단자는 3핀 캐논 커넥터라서 XLR 케이블만 들어갑니다.',
  trs: '6.3mm 잭 단자에는 TS/TRS(55) 케이블을 씁니다.',
  combo: '콤보 단자는 XLR과 6.3mm 잭을 모두 받지만 영상 케이블은 안 됩니다.',
  hdmi: '이 장비는 HDMI 전용입니다. SDI(BNC)는 대형 방송 장비용 규격이라 변환기가 필요합니다.',
  usb: 'USB 단자에는 USB 케이블을 연결해야 PC가 장비를 오디오/웹캠으로 인식합니다.',
  sdi: 'SDI 단자에는 BNC 커넥터의 SDI 케이블이 필요합니다.',
};

/* ---------------------------- 장비 정의 ---------------------------- */
export const DEVICE_TYPES = {
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

export const deviceRows = (def) => Math.max(def.ins.length, def.outs.length, 1);
export const deviceHeight = (def) => HEADER_H + deviceRows(def) * ROW_H + (def.statusH ?? 58) + 6;
export const portPos = (dev, def, portId) => {
  const ii = def.ins.findIndex((p) => p.id === portId);
  if (ii >= 0) return { x: dev.x, y: dev.y + HEADER_H + ii * ROW_H + ROW_H / 2 };
  const oi = def.outs.findIndex((p) => p.id === portId);
  return { x: dev.x + def.w, y: dev.y + HEADER_H + oi * ROW_H + ROW_H / 2 };
};
export const findPort = (def, portId) =>
  def.ins.find((p) => p.id === portId) ? { ...def.ins.find((p) => p.id === portId), dir: 'in' }
    : { ...def.outs.find((p) => p.id === portId), dir: 'out' };

/* ---------------------------- 오디오 수학 ---------------------------- */
// 페이더 위치(0~100) → dB. 75 = 0dB(유니티), 100 = +10dB, 0 = -∞
export const faderDb = (p) => (p <= 0 ? -Infinity : p >= 75 ? ((p - 75) / 25) * 10 : (p - 75) * 0.8);
export const fmtDb = (v) => (v == null ? '—' : v === -Infinity ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`);
export const MIC_LEVEL = -45; // 말할 때 마이크 출력 레벨(기준값)
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------- 스테이지 초기 상태 ---------------------------- */
export const dev = (id, type, x, y, placed = true, name) => ({ id, type, x, y, placed, name });
export const conn = (fd, fp, td, tp, cable) => ({ id: `${fd}.${fp}>${td}.${tp}`, from: { d: fd, p: fp }, to: { d: td, p: tp }, cable });
export const toMap = (arr) => Object.fromEntries(arr.map((d) => [d.id, d]));

export const MIXER_DEFAULT = {
  gain: 30, eqHigh: 0, eqMid: 0, eqLow: 0, chMute: false, chFader: 75,
  mainFader: 75, mainMute: false, phantom: false, ch1Source: 'local1', usbOut: 'main',
};

export const FAULTS = {
  cable: { title: '케이블 분리', desc: '마이크 XLR 케이블이 X32 입력에서 빠져 있었습니다.' },
  phantom: { title: '팬텀 전원 OFF', desc: '콘덴서 마이크인데 +48V 팬텀 전원이 꺼져 있었습니다.' },
  chMute: { title: '채널 뮤트', desc: 'X32 CH01의 MUTE 버튼이 눌려 있었습니다.' },
  fader: { title: '페이더 다운', desc: 'CH01 페이더가 끝까지 내려가 있었습니다.' },
  mainMute: { title: '메인 뮤트', desc: 'Main L/R 버스의 MUTE가 눌려 있었습니다.' },
  patch: { title: '입력 패치 오류', desc: 'CH01 입력 패치가 엉뚱한 입력(Local In 2)으로 바뀌어 있었습니다.' },
  usbRoute: { title: 'USB 라우팅 오류', desc: 'USB 출력이 아무것도 없는 Mix Bus 1로 라우팅되어 있었습니다.' },
  obsMute: { title: 'OBS 음소거', desc: 'OBS 오디오 믹서에서 X32 소스가 음소거되어 있었습니다.' },
};

export function buildStage(id) {
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
export function computeSignal(st, talking) {
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

export function buildTrace(st, n) {
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

export const faultFixed = (f, st, n) => {
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
export const STAGES = {
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

export const CHAT_BAD = ['소리 안 나와요', '음소거 됐나요??', '??? 소리', '저만 안 들려요?', '소리 ㅠㅠ', '입모양만 보여요', 'PD님 소리요!!', '새로고침 해도 안 나와요'];
export const CHAT_GOOD = ['오 이제 들린다!', '소리 굿 👍', '잘 들려요~', '화질 좋네요', '오늘 강의 재밌어요', '👏👏'];
export const CHAT_NAMES = ['민준', '서연', 'audio_kim', '하늘', 'pd_lee', '도윤', '지우', 'cam_op', '수아'];
