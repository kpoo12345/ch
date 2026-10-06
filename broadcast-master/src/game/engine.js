import { Mic, Speaker, Monitor, Settings, Video, SlidersHorizontal, Tv, AudioLines, Radio, Headphones, Camera, Cctv, Guitar, Piano, Laptop, Router, Volume1 } from 'lucide-react';

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
  mini: { name: '3.5mm 변환 케이블', short: '3.5mm', desc: '3.5mm ↔ 3.5mm/6.3mm/XLR 변환 · 노트북·ATEM MIC', stroke: '#f472b6', dot: 'bg-pink-400' },
  eth: { name: '랜선 (이더넷)', short: 'LAN', desc: 'RJ45 · 인터넷 송출·네트워크 제어', stroke: '#2dd4bf', dot: 'bg-teal-400' },
};

export const PORT_ACCEPTS = {
  xlr: ['xlr', 'mini'], trs: ['trs', 'mini'], combo: ['xlr', 'trs', 'mini'], hdmi: ['hdmi'], sdi: ['sdi'], usb: ['usb'], eth: ['eth'], mini: ['mini'],
};
export const PORT_KIND_LABEL = {
  xlr: 'XLR 단자', trs: '6.3mm TRS 단자', combo: 'XLR/TRS 콤보 단자',
  hdmi: 'HDMI 단자', sdi: 'BNC(SDI) 단자', usb: 'USB-C 단자', eth: 'RJ45 LAN 단자', mini: '3.5mm 미니잭',
};
export const PORT_COLOR = {
  xlr: '#60a5fa', trs: '#fbbf24', combo: '#94a3b8', hdmi: '#c084fc', sdi: '#fb923c', usb: '#4ade80', eth: '#2dd4bf', mini: '#f472b6',
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
    name: '아날로그 믹서', model: '8채널 소형', icon: SlidersHorizontal, w: 230,
    ins: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `in${n}`, label: `CH${n} IN`, kind: 'combo' })),
    outs: [{ id: 'main', label: 'MAIN OUT', kind: 'xlr' }, { id: 'aux1', label: 'AUX 1 (모니터)', kind: 'trs' }, { id: 'phones', label: 'PHONES', kind: 'trs' }],
    info: '여러 입력을 모아 증폭(GAIN) → 음색 보정(EQ) → 음량 조절(페이더)을 거쳐 MAIN OUT으로 내보내는 오디오의 심장입니다. 신호는 위에서 아래로, 채널 스트립 순서대로 흐릅니다.',
  },
  speaker: {
    name: '액티브 스피커', model: '앰프 내장형', icon: Speaker, w: 170,
    ins: [{ id: 'in', label: 'INPUT', kind: 'combo' }], outs: [],
    info: '앰프가 내장된 스피커로, 믹서의 라인 레벨 신호를 받아 큰 소리로 바꿉니다. 전원은 "가장 마지막에 켜고, 가장 먼저 끈다"가 철칙입니다. 순서를 어기면 "펑" 하는 팝 노이즈로 스피커가 상할 수 있습니다.',
  },
  digital_mixer: {
    name: '디지털 믹서', model: 'X32 / M32', icon: Settings, w: 220,
    ins: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `local${n}`, label: `LOCAL IN ${n}`, kind: 'xlr' })),
    outs: [{ id: 'main', label: 'MAIN L/R', kind: 'xlr' }, { id: 'aux1', label: 'AUX 1 (모니터)', kind: 'xlr' }, { id: 'usb', label: 'USB AUDIO', kind: 'usb' }],
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
  // ---- 교육 모드에서 다루는 장비 ----
  audio_interface: {
    name: '오디오 인터페이스', model: 'USB 2in/2out', icon: AudioLines, w: 220,
    ins: [{ id: 'in1', label: 'INPUT 1 (MIC/INST)', kind: 'combo' }, { id: 'in2', label: 'INPUT 2 (MIC/INST)', kind: 'combo' }],
    outs: [{ id: 'usb', label: 'USB-C (PC)', kind: 'usb' }, { id: 'monL', label: 'MONITOR L', kind: 'trs' }, { id: 'monR', label: 'MONITOR R', kind: 'trs' }, { id: 'phones', label: 'HEADPHONES', kind: 'trs' }],
    info: '마이크·악기 소리를 디지털로 바꿔 USB로 PC에 넣고, PC 소리를 다시 아날로그로 바꿔 스피커·헤드폰으로 내보내는 장비입니다. 마이크 프리앰프(GAIN), +48V 팬텀, 악기 입력(INST)이 들어 있는 작은 믹서 겸 사운드카드라고 보면 됩니다.',
  },
  wireless_mic: {
    name: '무선 마이크 시스템', model: 'UHF 핸드헬드 + 수신기', icon: Radio, w: 200,
    ins: [], outs: [{ id: 'af', label: 'AF OUT (XLR)', kind: 'xlr' }],
    info: '마이크(송신기)가 소리를 전파(RF)로 보내고, 수신기가 받아 XLR로 믹서에 넘깁니다. 송신기와 수신기의 주파수(채널)가 같아야 하고, 배터리와 전파 상태(RF)를 늘 확인해야 합니다.',
  },
  di_box: {
    name: 'DI 박스', model: 'Direct Injection Box', icon: Guitar, w: 170,
    ins: [{ id: 'input', label: 'INPUT (TS)', kind: 'trs' }],
    outs: [{ id: 'thru', label: 'THRU (TS)', kind: 'trs' }, { id: 'out', label: 'OUTPUT (XLR)', kind: 'xlr' }],
    info: '기타·키보드 같은 악기의 언밸런스드 신호(TS)를 밸런스드 마이크 레벨(XLR)로 바꿔, 긴 케이블로도 잡음 없이 믹서에 보낼 수 있게 해 줍니다. THRU로는 원래 신호를 앰프에 그대로 보냅니다.',
  },
  headphones: {
    name: '모니터 헤드폰', model: '밀폐형 (Closed-back)', icon: Headphones, w: 170,
    ins: [{ id: 'plug', label: 'PLUG (TRS)', kind: 'trs' }], outs: [],
    info: '운영자가 송출되는 소리를 정확히 듣는 장비입니다. 밀폐형은 바깥 소리를 막고 소리가 새지 않아 현장 모니터링에 적합합니다.',
  },
  mirrorless: {
    name: '미러리스 카메라', model: '렌즈 교환식', icon: Camera, w: 170,
    ins: [], outs: [{ id: 'hdmi', label: 'HDMI OUT', kind: 'hdmi' }],
    info: '큰 센서와 교환 렌즈로 배경이 흐려지는 고화질 영상을 만드는 카메라입니다. 방송에 쓰려면 화면 정보가 없는 "클린 HDMI" 출력, 장시간 촬영용 전원(더미 배터리), 발열 관리를 챙겨야 합니다.',
  },
  ptz: {
    name: 'PTZ 카메라', model: 'Pan · Tilt · Zoom 리모트', icon: Cctv, w: 170,
    ins: [], outs: [{ id: 'hdmi', label: 'HDMI OUT', kind: 'hdmi' }, { id: 'sdi', label: 'SDI OUT', kind: 'sdi' }, { id: 'lan', label: 'LAN (제어/NDI)', kind: 'eth' }],
    info: '카메라맨 없이 원격으로 좌우(Pan)·상하(Tilt)·확대(Zoom)를 조종하는 카메라입니다. 미리 저장한 위치(프리셋)를 불러와 한 사람이 여러 대를 운영할 수 있어 교회·강의실·회의실 중계에 많이 씁니다.',
  },
  atem_pro: {
    name: 'ATEM Mini Pro', model: '스트리밍·녹화 내장 스위처', icon: Tv, w: 230,
    ins: [1, 2, 3, 4].map((n) => ({ id: `in${n}`, label: `HDMI IN ${n}`, kind: 'hdmi' })).concat([{ id: 'mic1', label: 'MIC 1', kind: 'mini' }, { id: 'mic2', label: 'MIC 2', kind: 'mini' }]),
    outs: [{ id: 'usb', label: 'USB-C (웹캠/녹화)', kind: 'usb' }, { id: 'eth', label: 'ETHERNET (스트리밍)', kind: 'eth' }, { id: 'hdmiout', label: 'HDMI OUT (멀티뷰)', kind: 'hdmi' }],
    info: 'ATEM Mini에 인터넷 직접 송출(ETHERNET), USB 디스크 녹화, 멀티뷰 출력이 더해진 모델입니다. PC 없이도 유튜브로 바로 방송할 수 있고, HDMI OUT에 모니터를 연결하면 모든 입력과 PVW/PGM을 한 화면에서 볼 수 있습니다.',
  },
  monitor: {
    name: '모니터 스피커', model: '바닥형 웨지', icon: Volume1, w: 170,
    ins: [{ id: 'in', label: 'INPUT', kind: 'combo' }], outs: [],
    info: '무대 위 연주자·설교자가 자기 소리를 듣는 스피커입니다. 믹서의 AUX(모니터) 출력으로 따로 섞은 소리를 받아, 청중용 메인 스피커와 다른 음량·구성으로 들려줍니다.',
  },
  e_guitar: {
    name: '일렉 기타', model: '패시브 픽업', icon: Guitar, w: 160,
    ins: [], outs: [{ id: 'out', label: 'OUT (TS)', kind: 'trs' }],
    info: '픽업이 줄의 진동을 작은 전기 신호(악기 레벨, 높은 임피던스)로 바꿉니다. 언밸런스드 TS 출력이라 멀리 보내면 잡음이 생기므로 DI 박스를 거쳐 믹서로 보냅니다.',
  },
  keyboard: {
    name: '키보드', model: '스테이지 피아노', icon: Piano, w: 160,
    ins: [], outs: [{ id: 'out', label: 'OUT (TS)', kind: 'trs' }],
    info: '라인 레벨의 언밸런스드 출력을 냅니다. 무대에서 믹서까지 멀면 DI 박스로 밸런스드 XLR로 바꿔 보냅니다.',
  },
  laptop: {
    name: '노트북', model: '음원·영상 재생', icon: Laptop, w: 160,
    ins: [], outs: [{ id: 'out', label: '3.5mm OUT', kind: 'mini' }],
    info: '배경음악(BGM)이나 영상 소리를 3.5mm 헤드폰 단자로 내보냅니다. 가정용 라인 레벨이라 믹서 라인 입력에 넣고 GAIN을 낮게 씁니다.',
  },
  router: {
    name: '인터넷 공유기', model: '유선 LAN', icon: Router, w: 160,
    ins: [{ id: 'lan1', label: 'LAN 1', kind: 'eth' }, { id: 'lan2', label: 'LAN 2', kind: 'eth' }], outs: [],
    info: '인터넷에 연결된 공유기입니다. ATEM Mini Pro처럼 PC 없이 직접 송출하는 장비는 랜선으로 여기에 연결합니다. 방송 송출은 와이파이보다 유선이 안정적입니다.',
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
  gain: 30, eqHigh: 0, eqMid: 0, eqLow: 0, lowCut: false, fx: 0, chMute: false, chFader: 75,
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
  spkPower: { title: '스피커 전원 OFF', desc: '액티브 스피커의 전원이 꺼져 있었습니다.' },
};
// 스토리 4스테이지에서 무작위로 고르는 고장 (스피커가 없는 송출 시스템용)
const STAGE4_FAULTS = ['cable', 'phantom', 'chMute', 'fader', 'mainMute', 'patch', 'usbRoute', 'obsMute'];

// 스튜디오(샌드박스) 모드: 모든 장비를 직접 설치하고 연결한다
const SANDBOX_DEVICES = (placed) => toMap([
  dev('mic', 'dynamic_mic', 30, 40, placed),
  dev('mixer', 'digital_mixer', 290, 24, placed),
  dev('speaker', 'speaker', 790, 120, placed),
  dev('cam1', 'camera', 30, 215, placed, '카메라 1 · 클로즈업'),
  dev('cam2', 'camera', 30, 385, placed, '카메라 2 · 와이드'),
  dev('atem', 'atem', 290, 300, placed),
  dev('pc', 'pc', 560, 300, placed),
]);
const INF = Number.POSITIVE_INFINITY;
export const SANDBOX_CABLES = { xlr: INF, trs: INF, hdmi: INF, sdi: INF, usb: INF };

// 완성된 하이브리드 시스템 (PA + 라이브 송출): 스튜디오 모드 "완성 시스템 불러오기"와 메인 메뉴 배경에 사용
export function buildFullSystem() {
  return {
    devices: SANDBOX_DEVICES(true),
    connections: [
      conn('mic', 'out', 'mixer', 'local1', 'xlr'),
      conn('mixer', 'main', 'speaker', 'in', 'xlr'),
      conn('cam1', 'hdmi', 'atem', 'in1', 'hdmi'),
      conn('cam2', 'hdmi', 'atem', 'in2', 'hdmi'),
      conn('atem', 'usb', 'pc', 'usb1', 'usb'),
      conn('mixer', 'usb', 'pc', 'usb2', 'usb'),
    ],
    cables: { ...SANDBOX_CABLES },
    mixer: { ...MIXER_DEFAULT, gain: 28, mainFader: 70 },
    speaker: { power: true, position: 'behind' },
    atem: { program: 1, preview: 2, transitioning: false },
    obs: { videoSource: 'atem', audioSource: 'x32', audioMuted: false, streaming: true },
    faults: [],
  };
}

export function buildStage(id) {
  if (id === 'studio') {
    return {
      devices: SANDBOX_DEVICES(false),
      connections: [],
      cables: { ...SANDBOX_CABLES },
      mixer: { ...MIXER_DEFAULT, mainFader: 0, chFader: 75 },
      speaker: { power: false, position: 'behind' },
      atem: { program: 0, preview: 1, transitioning: false },
      obs: { videoSource: 'none', audioSource: 'none', audioMuted: false, streaming: false },
      faults: [],
    };
  }
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
  const pool = [...STAGE4_FAULTS].sort(() => Math.random() - 0.5).slice(0, 3);
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

// 신호 추적기: 시스템에 있는 장비에 따라 PA / 송출 오디오 / 비디오 체인을 만든다.
// 각 체인은 앞에서부터 확인해 처음 끊긴 지점을 fail, 그 뒤는 idle로 표시한다.
export function buildTrace(st, n) {
  const has = (id) => !!st.devices[id]?.placed;
  const m = st.mixer;
  const front = n.isDigital
    ? [{ label: '마이크', ok: has('mic') }, { label: 'XLR 케이블', ok: !!n.micConn }, { label: '입력 패치', ok: n.micAtCh }]
    : [{ label: '마이크', ok: has('mic') }, { label: 'XLR → CH1', ok: n.micAtCh }];
  const mixerSteps = [
    ...front,
    ...(n.condenser ? [{ label: '+48V 팬텀', ok: m.phantom }] : []),
    { label: 'GAIN', ok: n.chIn != null && n.chIn > -40, warn: n.chIn > 0 ? '클리핑' : null },
    { label: n.isDigital ? 'CH01' : '채널(뮤트·페이더)', ok: n.chPost != null },
    { label: n.isDigital ? 'MAIN L/R' : 'MAIN OUT', ok: n.mainOut != null },
  ];
  const rows = [];
  if (st.devices.speaker) {
    rows.push({
      name: st.devices.pc ? 'PA' : '오디오',
      steps: [
        ...mixerSteps,
        { label: '케이블 → 스피커', ok: n.speakerLinked },
        { label: '스피커 전원', ok: n.spkOn },
        { label: '소리 출력', ok: n.audible, warn: n.feedback ? '하울링' : null },
      ],
    });
  }
  if (st.devices.pc) {
    rows.push({
      name: st.devices.speaker ? '송출 음성' : '오디오',
      steps: [
        ...mixerSteps,
        { label: 'USB 라우팅', ok: n.isDigital && m.usbOut === 'main' },
        { label: 'USB → PC', ok: n.usbLinked },
        { label: 'OBS 오디오', ok: st.obs.audioSource === 'x32' && !st.obs.audioMuted },
        { label: '송출', ok: st.obs.streaming && n.audioOk },
      ],
    });
    rows.push({
      name: '비디오',
      steps: [
        { label: '카메라', ok: has('cam1') || has('cam2') },
        { label: 'HDMI → ATEM', ok: Object.keys(n.camAt).length > 0 },
        { label: 'PGM 선택', ok: !!n.programCam },
        { label: 'USB → PC', ok: n.atemUsbLinked },
        { label: 'OBS 영상', ok: st.obs.videoSource === 'atem' },
        { label: '송출', ok: st.obs.streaming && n.videoOk },
      ],
    });
  }
  return rows.map((r) => {
    let broken = false;
    return {
      name: r.name,
      steps: r.steps.map((x) => {
        if (broken) return { ...x, status: 'idle' };
        if (!x.ok) { broken = true; return { ...x, status: 'fail' }; }
        return { ...x, status: x.warn ? 'warn' : 'ok' };
      }),
    };
  });
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
    case 'spkPower': return st.speaker.power;
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

// 스튜디오 모드 도전 과제 (한 번 달성하면 계속 유지)
STAGES.studio = {
  title: '스튜디오 모드', tag: '마스터', focus: 'mixer', autoTalk: false, studio: true,
  mission: '장비를 직접 골라 설치하고 연결해 PA와 라이브 송출을 동시에 운영해 보세요. 도전 과제를 모두 달성하면 방송장비 마스터!',
  briefing: [
    '여기는 나만의 방송 스튜디오입니다. 정답도, 시간 제한도, 감점도 없습니다.',
    '하단 장비 카탈로그에서 장비를 골라 설치하세요. 마이크는 다이나믹/콘덴서, 믹서는 아날로그/디지털 중 선택할 수 있고 케이블은 무제한입니다. 실력이 붙으면 "돌발 상황 훈련"으로 숨겨진 고장을 찾아보세요.',
  ],
  objectives: [
    { id: 'pa', label: 'PA 완성: 스피커로 마이크 소리 내기', latch: (c) => c.a.audible },
    { id: 'gain', label: '게인 스테이징: 입력 -20 ~ -6 dB로 소리 내기', latch: (c) => c.a.audible && c.a.chIn >= -20 && c.a.chIn <= -6 },
    { id: 'clean', label: '하울링·링잉 없이 PA 운영', latch: (c) => c.a.audible && !c.a.feedback && !c.a.ringing && c.a.chIn >= -20 },
    { id: 'stream', label: '라이브 송출 성공 (영상 + 오디오)', latch: (c) => c.st.obs.streaming && c.a.videoOk && c.a.audioOk },
    { id: 'switch', label: '카메라 2대를 모두 PGM으로 송출해 보기', latch: (c) => c.pgmSeen.includes('cam1') && c.pgmSeen.includes('cam2') },
    { id: 'condenser', label: '콘덴서 마이크(+48V)로 송출하기', latch: (c) => c.n.condenser && c.st.obs.streaming && c.a.audioOk },
    { id: 'hybrid', label: 'PA와 라이브 송출 동시 운영', latch: (c) => c.a.audible && !c.a.feedback && c.st.obs.streaming && c.a.audioOk && c.a.videoOk },
    { id: 'drill', label: '돌발 상황 훈련에서 고장 찾아내기', latch: (c) => c.drillsDone > 0 },
  ],
  hints: [
    '처음이라면 "완성 시스템 불러오기"로 완성된 연결을 먼저 살펴보세요. 그다음 "모두 철거"하고 직접 다시 만들어 보면 좋습니다.',
    'PA는 마이크 → 믹서 → MAIN → 스피커, 송출은 마이크 → X32 → USB → PC(OBS), 영상은 카메라 → ATEM → USB → PC입니다. 아날로그 믹서에는 USB 출력이 없습니다.',
    '도전 과제 "콘덴서 마이크"는 마이크를 철거한 뒤 종류를 콘덴서로 바꿔 다시 설치하고, 믹서에서 48V를 켜야 합니다.',
  ],
  lessons: [],
};

export const CHAT_BAD = ['소리 안 나와요', '음소거 됐나요??', '??? 소리', '저만 안 들려요?', '소리 ㅠㅠ', '입모양만 보여요', 'PD님 소리요!!', '새로고침 해도 안 나와요'];
export const CHAT_GOOD = ['오 이제 들린다!', '소리 굿 👍', '잘 들려요~', '화질 좋네요', '오늘 강의 재밌어요', '👏👏'];
export const CHAT_NAMES = ['민준', '서연', 'audio_kim', '하늘', 'pd_lee', '도윤', '지우', 'cam_op', '수아'];
