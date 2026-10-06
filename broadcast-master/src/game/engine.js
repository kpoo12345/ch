import { Mic, Speaker, Monitor, Settings, Video, SlidersHorizontal, Tv, AudioLines, Radio, Headphones, Camera, Cctv, Guitar, Piano, Laptop, Router, Volume1, Lightbulb, Spotlight, PanelsTopLeft, Projector, Grid3x3, Clapperboard, Joystick, Drum } from 'lucide-react';

/* =====================================================================
 * 방송장비 마스터 — 게임 데이터 & 신호 계산 엔진
 * (2D 배선도와 3D 스튜디오가 함께 사용)
 * ===================================================================== */

/* ---------------------------- 케이블 / 단자 ---------------------------- */
export const CABLES = {
  xlr: { name: 'XLR 케이블', short: 'XLR', desc: '3핀 밸런스드 · 마이크/라인 신호', stroke: '#60a5fa', dot: 'bg-blue-400' },
  trs: { name: 'TS/TRS 케이블', short: 'TRS', desc: '6.3mm(55) 잭 · 악기/라인 신호', stroke: '#fbbf24', dot: 'bg-amber-400' },
  hdmi: { name: 'HDMI 케이블', short: 'HDMI', desc: '디지털 영상+음성 · 단거리용', stroke: '#c084fc', dot: 'bg-purple-400' },
  sdi: { name: 'SDI 케이블', short: 'SDI', desc: 'BNC 커넥터 · 방송용 장거리 영상', stroke: '#fb923c', dot: 'bg-orange-400' },
  usb: { name: 'USB-C 케이블', short: 'USB', desc: '데이터 · 오디오 인터페이스/웹캠 신호', stroke: '#4ade80', dot: 'bg-green-400' },
  mini: { name: '3.5mm 변환 케이블', short: '3.5mm', desc: '3.5mm ↔ 3.5mm/6.3mm(TRS)/XLR 변환 · 노트북·ATEM MIC', stroke: '#f472b6', dot: 'bg-pink-400' },
  eth: { name: '랜선 (이더넷)', short: 'LAN', desc: 'RJ45 · 인터넷 송출·네트워크 제어', stroke: '#2dd4bf', dot: 'bg-teal-400' },
  dmx: { name: 'DMX 케이블 (5핀)', short: 'DMX', desc: '110Ω 조명 제어 신호 · 조명끼리 줄줄이(데이지 체인) 연결', stroke: '#a3e635', dot: 'bg-lime-400' },
};

export const PORT_ACCEPTS = {
  xlr: ['xlr', 'mini'], trs: ['trs', 'mini'], combo: ['xlr', 'trs', 'mini'], hdmi: ['hdmi'], sdi: ['sdi'], usb: ['usb'], eth: ['eth'], mini: ['mini'],
  dmx: ['dmx', 'xlr'], // 마이크(XLR) 케이블도 물리적으로는 꽂힌다 — 하지만 임피던스가 달라 신호가 깨질 수 있다
};
export const PORT_KIND_LABEL = {
  xlr: 'XLR 단자', trs: '6.3mm TRS 단자', combo: 'XLR/TRS 콤보 단자',
  hdmi: 'HDMI 단자', sdi: 'BNC(SDI) 단자', usb: 'USB-C 단자', eth: 'RJ45 LAN 단자', mini: '3.5mm 미니잭', dmx: 'DMX 단자 (5핀 XLR)',
};
export const PORT_COLOR = {
  xlr: '#60a5fa', trs: '#fbbf24', combo: '#94a3b8', hdmi: '#c084fc', sdi: '#fb923c', usb: '#4ade80', eth: '#2dd4bf', mini: '#f472b6', dmx: '#a3e635',
};
export const MISMATCH_TIP = {
  xlr: 'XLR 단자는 3핀 캐논 커넥터라서 XLR 케이블만 들어갑니다.',
  trs: '6.3mm 잭 단자에는 TS/TRS(55) 케이블을 씁니다.',
  combo: '콤보 단자는 XLR과 6.3mm 잭을 모두 받지만 영상 케이블은 안 됩니다.',
  hdmi: '이 장비는 HDMI 전용입니다. SDI(BNC)는 대형 방송 장비용 규격이라 변환기가 필요합니다.',
  usb: 'USB 단자에는 USB 케이블을 연결해야 PC가 장비를 오디오/웹캠으로 인식합니다.',
  sdi: 'SDI 단자에는 BNC 커넥터의 SDI 케이블이 필요합니다.',
  eth: 'LAN(RJ45) 단자에는 랜선을 꽂습니다.',
  mini: '3.5mm 미니잭에는 3.5mm 케이블(또는 변환 케이블)을 씁니다.',
  dmx: 'DMX 단자에는 DMX 케이블을 씁니다. 오디오 케이블은 조명 신호를 보내는 용도가 아닙니다.',
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
    name: '아날로그 믹서', model: '12채널 (모노 8 + 스테레오 2)', icon: SlidersHorizontal, w: 230,
    ins: [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `in${n}`, label: `CH${n} MIC (XLR)`, kind: 'xlr' })),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `line${n}`, label: `CH${n} LINE (TRS)`, kind: 'trs' })),
      { id: 'st9L', label: 'CH9/10 LINE L/MONO', kind: 'trs' }, { id: 'st9R', label: 'CH9/10 LINE R', kind: 'trs' },
      { id: 'st11L', label: 'CH11/12 LINE L/MONO', kind: 'trs' }, { id: 'st11R', label: 'CH11/12 LINE R', kind: 'trs' },
    ],
    outs: [
      { id: 'main', label: 'STEREO OUT L', kind: 'xlr' }, { id: 'mainR', label: 'STEREO OUT R', kind: 'xlr' },
      { id: 'aux1', label: 'AUX SEND 1 (모니터)', kind: 'trs' }, { id: 'aux2', label: 'AUX SEND 2', kind: 'trs' },
      { id: 'phones', label: 'PHONES', kind: 'trs' },
    ],
    info: '여러 입력을 모아 증폭(GAIN) → 음색 보정(EQ) → 음량 조절(페이더)을 거쳐 STEREO OUT으로 내보내는 오디오의 심장입니다. 모노 채널마다 마이크용 XLR 단자와 라인용 TRS 단자가 따로 있고(라인 단자는 26dB 둔감), 스테레오 채널은 L/R 두 단자로 노트북·키보드를 받습니다. 신호는 위에서 아래로, 채널 스트립 순서대로 흐릅니다.',
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
  drum_kit: {
    name: '드럼 세트', model: '어쿠스틱 5기통', icon: Drum, w: 170,
    ins: [], outs: [],
    info: '킥(베이스 드럼)·스네어·탐·심벌로 이루어진 어쿠스틱 악기입니다. 전기 출력이 없어서 믹서·방송으로 보내려면 마이크로 잡아야 합니다. 생소리가 워낙 커서 작은 공연장에서는 마이크 없이도 객석에 크게 들리지만, 방송(송출)에는 마이크로 잡은 소리만 나갑니다.',
  },
  kick_mic: {
    name: '킥 드럼 마이크', model: 'Beta 52 타입 (다이나믹)', icon: Mic, w: 160,
    ins: [], outs: [{ id: 'out', label: 'XLR OUT', kind: 'xlr' }],
    info: '베이스 드럼의 "쿵" 하는 낮은 소리를 잡는 대형 다이나믹 마이크입니다. 아주 큰 소리를 견디고 저음이 잘 나오게 만들어졌습니다. 킥 드럼 앞 구멍(포트) 안쪽이나 바로 앞에 둡니다.',
  },
  snare_mic: {
    name: '스네어 마이크', model: 'SM57 타입 (다이나믹)', icon: Mic, w: 160,
    ins: [], outs: [{ id: 'out', label: 'XLR OUT', kind: 'xlr' }],
    info: '스네어·탐처럼 가까이에서 아주 큰 소리를 잡는 악기용 다이나믹 마이크입니다. 지향성이 좁아 옆 악기 소리를 덜 받습니다. 기타 앰프를 잡을 때도 같은 마이크를 씁니다.',
  },
  overhead_mic: {
    name: '오버헤드 마이크', model: '소형 콘덴서 (펜슬형)', icon: Mic, w: 160,
    ins: [], outs: [{ id: 'out', label: 'XLR OUT', kind: 'xlr' }],
    info: '드럼 위쪽에서 심벌과 드럼 전체를 잡는 콘덴서 마이크입니다. 콘덴서라 +48V 팬텀 전원이 필요합니다. 보통 두 대를 왼쪽·오른쪽(L/R)으로 둡니다.',
  },
  digital_piano: {
    name: '디지털 피아노', model: '88건반 스테이지 피아노', icon: Piano, w: 170,
    ins: [], outs: [{ id: 'outL', label: 'OUT L/MONO (TS)', kind: 'trs' }, { id: 'outR', label: 'OUT R (TS)', kind: 'trs' }],
    info: '스테레오(L/R) 라인 출력이 있는 전자 피아노입니다. 자체 생소리가 거의 없어서 믹서를 거쳐야 들립니다. 두 출력을 믹서 스테레오 채널의 L/R 단자에 넣는 것이 정석이고, 채널이 부족하면 L/MONO 하나만 써도 됩니다. 무대에서 멀면 스테레오 DI(또는 DI 두 대)로 보냅니다.',
  },
  bass_guitar: {
    name: '베이스 기타', model: '패시브 4현', icon: Guitar, w: 160,
    ins: [], outs: [{ id: 'out', label: 'OUT (TS)', kind: 'trs' }],
    info: '낮은 음을 맡는 현악기입니다. 일렉 기타처럼 높은 임피던스의 작은 신호를 TS로 내보내므로 DI 박스를 거쳐 믹서의 MIC(XLR) 단자로 보냅니다. 저음이 많아 LOW CUT(HPF)은 켜지 않습니다.',
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
    name: '공유기 / 네트워크 스위치', model: '유선 LAN 4포트', icon: Router, w: 160,
    ins: [1, 2, 3, 4].map((n) => ({ id: `lan${n}`, label: `LAN ${n}`, kind: 'eth' })), outs: [],
    info: '인터넷에 연결된 공유기이자 장비끼리 통신하는 네트워크 허브입니다. ATEM Mini Pro처럼 PC 없이 송출하는 장비, IP로 제어하는 PTZ 카메라와 조이스틱이 모두 여기에 랜선으로 연결됩니다. 방송 송출은 와이파이보다 유선이 안정적입니다.',
  },
  lighting_console: {
    name: '조명 콘솔', model: 'Avolites Tiger Touch II', icon: SlidersHorizontal, w: 200,
    ins: [], outs: [{ id: 'dmx1', label: 'DMX A (유니버스 1)', kind: 'dmx' }],
    info: '무대 조명을 제어하는 콘솔입니다. 조명기마다 "DMX 주소"를 정해 패치(Patch)하고, 밝기·색·위치를 만들어 큐(Cue)로 저장한 뒤 플레이백 페이더로 재생합니다. 한 개의 DMX 라인(유니버스)은 512채널이며, 조명끼리 DMX IN → OUT으로 줄줄이 연결합니다(데이지 체인).',
  },
  par_led: {
    name: 'LED 파 조명', model: 'RGBW · 8채널 모드', icon: Lightbulb, w: 170,
    ins: [{ id: 'dmxIn', label: 'DMX IN', kind: 'dmx' }], outs: [{ id: 'dmxOut', label: 'DMX OUT (THRU)', kind: 'dmx' }],
    info: '색을 섞어(빨강·초록·파랑·흰색) 원하는 색으로 무대를 비추는 조명입니다. 8채널 모드라면 시작 주소부터 8개 채널(밝기, R, G, B, W, 스트로브…)을 차지합니다. 다음 조명의 주소는 겹치지 않게 +8씩 띄웁니다.',
  },
  moving_head: {
    name: '무빙 헤드', model: 'Spot · 16채널 모드', icon: Spotlight, w: 170,
    ins: [{ id: 'dmxIn', label: 'DMX IN', kind: 'dmx' }], outs: [{ id: 'dmxOut', label: 'DMX OUT (THRU)', kind: 'dmx' }],
    info: '머리가 좌우(PAN)·상하(TILT)로 움직이며 빛을 원하는 곳으로 보내는 조명입니다. 위치·색·고보(무늬)·포커스까지 채널이 많아 16채널 이상을 차지합니다.',
  },
  media_server: {
    name: '미디어 서버', model: 'Resolume Arena PC', icon: Clapperboard, w: 200,
    ins: [], outs: [{ id: 'out1', label: 'HDMI OUT 1 (화면)', kind: 'hdmi' }, { id: 'out2', label: 'HDMI OUT 2 (송출)', kind: 'hdmi' }],
    info: 'Resolume Arena는 영상 클립을 레이어로 겹쳐(배경 + 가사 + 로고) 실시간으로 섞어 LED 전광판·프로젝터로 내보내는 VJ/미디어 서버 소프트웨어입니다. 컴포지션(전체 화면)을 출력(Advanced Output)에서 각 화면에 맞게 배치합니다.',
  },
  projector: {
    name: '프로젝터', model: '레이저 5000안시', icon: Projector, w: 160,
    ins: [{ id: 'hdmi', label: 'HDMI IN', kind: 'hdmi' }], outs: [],
    info: '영상 신호를 스크린에 크게 비춥니다. 밝은 무대 조명이 스크린을 비추면 화면이 흐려 보이므로 조명 각도와 함께 계획합니다.',
  },
  led_wall: {
    name: 'LED 전광판', model: 'LED 프로세서 + 캐비닛', icon: Grid3x3, w: 170,
    ins: [{ id: 'hdmi', label: 'HDMI IN (프로세서)', kind: 'hdmi' }], outs: [],
    info: '여러 장의 LED 캐비닛을 이어 만든 대형 화면입니다. LED 프로세서가 입력 영상을 캐비닛 배열(픽셀 수)에 맞게 잘라 보냅니다. 입력 해상도와 화면 픽셀 맵이 맞아야 깨끗하게 나옵니다.',
  },
  ptz_controller: {
    name: 'PTZ 조이스틱', model: 'IP 조이스틱 컨트롤러', icon: Joystick, w: 180,
    ins: [], outs: [{ id: 'lan', label: 'LAN (VISCA over IP)', kind: 'eth' }],
    info: '조이스틱으로 PTZ 카메라의 PAN·TILT·ZOOM을 원격으로 움직이고, 자주 쓰는 구도를 프리셋(Preset)으로 저장해 버튼 하나로 불러옵니다. 카메라와 같은 네트워크(같은 IP 대역)에 있어야 제어됩니다. ATEM의 탈리를 받아 지금 방송 중인(PGM) 카메라를 표시해 줍니다.',
  },
  pc: {
    name: '스트리밍 PC', model: 'OBS Studio', icon: Monitor, w: 230, statusH: 98,
    ins: [{ id: 'usb1', label: 'USB 1', kind: 'usb' }, { id: 'usb2', label: 'USB 2', kind: 'usb' }], outs: [],
    info: 'OBS Studio는 영상 소스와 오디오 소스를 각각 지정해 하나의 방송으로 합친 뒤 인코딩하여 플랫폼으로 송출합니다. 소스 지정이 틀리면 장비가 연결돼 있어도 방송에 나가지 않습니다.',
  },
};

/* ---------------------------- 오디오 수학 ---------------------------- */
// 페이더 위치(0~100) → dB. 75 = 0dB(유니티), 100 = +10dB, 0 = -∞
export const faderDb = (p) => (p <= 0 ? -Infinity : p >= 75 ? ((p - 75) / 25) * 10 : (p - 75) * 0.8);
export const fmtDb = (v) => (v == null ? '—' : v === -Infinity ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`);
export const MIC_LEVEL = -45; // 말할 때 마이크 출력 레벨(기준값)
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------- 믹서 기본값 (교육 모드 체험용) ---------------------------- */
export const MIXER_DEFAULT = {
  gain: 30, eqHigh: 0, eqMid: 0, eqLow: 0, lowCut: false, fx: 0, chMute: false, chFader: 75,
  mainFader: 75, mainMute: false, phantom: false, ch1Source: 'local1', usbOut: 'main',
};
