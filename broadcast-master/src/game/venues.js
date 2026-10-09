/* =====================================================================
 * 장소 데이터 — 자리(slot)의 위치·방향·종류, 사람, 책상, 무대
 * (3D 화면과 스테이지 검증 스크립트가 함께 사용 — JSX 없음)
 *  kind: floor(바닥) · desk(책상 위) · wall(벽 선반) · truss(천장/트러스에 매달기)
 * ===================================================================== */
const DT = 0.75; // 책상 높이 (kit3d DESK_TOP과 같음)
export const P_CH = 0.22; // 교회 강단 높이
export const P_LS = 0.5; // 공연장 무대 높이
const faceTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

export const VENUES = {
  seminar: {
    name: '세미나실',
    camera: { pos: [0.4, 2.8, 5.4], target: [0.3, 0.85, 0.0], halfW: 4.0 },
    desks: [{ x: 0.55, z: 0.15, w: 2.3, d: 0.8 }],
    slots: {
      presenter_mic: { pos: [-2.0, 0, -0.15], rot: 0, kind: 'floor', label: '발표자 마이크 자리' },
      desk1: { pos: [-0.1, DT, 0.12], rot: 0, kind: 'desk', label: '책상 1' },
      desk2: { pos: [0.72, DT, 0.22], rot: 0, kind: 'desk', label: '책상 2' },
      desk3: { pos: [1.3, DT, 0.05], rot: -0.2, kind: 'desk', label: '책상 3' },
      // 메인 스피커: 마이크보다 청중 쪽(앞)에서 청중을 향한다 → 마이크의 둔감한 뒤쪽이 스피커를 본다
      pa_main: { pos: [-3.0, 0, 0.55], rot: 0.18, kind: 'floor', label: '메인 스피커 자리' },
      // 나쁜 자리: 스피커가 마이크를 정면으로 겨눈다
      pa_alt: { pos: [-1.15, 0, 0.8], rot: faceTo([-1.15, 0, 0.8], [-2.0, 0, -0.15]), kind: 'floor', label: '마이크를 겨눈 자리' },
      cam_back: { pos: [3.1, 0, 1.7], rot: faceTo([3.1, 0, 1.7], [-2.0, 0, -0.6]), kind: 'floor', label: '뒤쪽 카메라 자리' },
      proj_ceiling: { pos: [-1.7, 2.75, 0.9], rot: Math.PI, kind: 'truss', label: '천장 프로젝터 자리', screen: { pos: [-1.7, 1.5, -2.52], rot: 0, w: 2.3, h: 1.3 } },
      light_front: { pos: [-0.6, 2.9, 0.6], rot: faceTo([-0.6, 0, 0.6], [-2.0, 0, -0.6]), kind: 'truss', label: '앞 조명 자리', aim: [-2.0, 1.3, -0.6] },
    },
    people: [{ id: 'presenter', pos: [-2.0, 0, -0.6], rot: 0, talker: true, shirt: '#3b5b8f' }],
  },
  youtube_room: {
    name: '1인 방송 스튜디오',
    camera: { pos: [0.4, 2.4, 3.8], target: [0.0, 0.95, -0.2], halfW: 2.1 },
    desks: [{ x: 0, z: -0.3, w: 2.4, d: 0.8, backFront: true }], // 장비가 진행자 쪽을 보므로 단자는 앞(+z)쪽
    slots: {
      boom_mic: { pos: [-0.12, DT, -0.5], rot: 0, kind: 'desk', deskMic: 0.4, label: '데스크 암 마이크 자리' },
      desk1: { pos: [-0.62, DT, -0.32], rot: Math.PI, kind: 'desk', label: '책상 1' },
      desk2: { pos: [0.2, DT, -0.2], rot: Math.PI, kind: 'desk', label: '책상 2' },
      desk3: { pos: [0.85, DT, -0.4], rot: -0.35, kind: 'desk', label: '책상 3' },
      cam_tripod: { pos: [1.15, 0, 0.65], rot: faceTo([1.15, 0, 0.65], [0, 0, -0.95]), kind: 'floor', label: '삼각대 자리' },
      headphone_hook: { pos: [-1.05, DT, -0.45], rot: Math.PI, kind: 'desk', label: '헤드폰 거치대' },
      light_key: { pos: [0.9, 2.3, 0.4], rot: faceTo([0.9, 0, 0.4], [0, 0, -1.0]), kind: 'truss', label: '키 라이트 자리', aim: [0, 1.15, -1.0] },
    },
    people: [{ id: 'creator', pos: [0, 0, -1.0], rot: 0, pose: 'sit', talker: true, shirt: '#be185d' }],
  },
  church: {
    name: '교회 예배당',
    camera: { pos: [0.8, 4.7, 8.6], target: [0.2, 0.8, -0.2], halfW: 5.0 },
    platform: { x: 0, z: -2.15, w: 6.8, d: 2.3, h: P_CH },
    desks: [{ x: 1.5, z: 3.15, w: 3.7, d: 0.75 }],
    trunk: { stage: [0.0, -0.95], foh: [0.6, 2.65], y: P_CH },
    slots: {
      pulpit_mic: { pos: [-0.4, P_CH + 1.02, -1.62], rot: 0, kind: 'desk', deskMic: 0.42, floorY: P_CH, onPlatform: true, label: '강대상 마이크 자리' },
      worship_mic_rx_stage: { pos: [1.2, P_CH, -1.45], rot: 0, kind: 'floor', label: '찬양 인도자 마이크 자리' },
      choir_mic: { pos: [-2.3, P_CH, -2.25], rot: Math.PI, kind: 'floor', label: '성가대 마이크 자리' },
      keys: { pos: [2.5, P_CH, -2.4], rot: 0, kind: 'floor', label: '키보드 자리' },
      di_keys: { pos: [2.0, P_CH, -1.75], rot: 0, kind: 'floor', label: 'DI 자리' },
      wedge_pulpit: { pos: [0.3, P_CH, -1.4], rot: faceTo([0.3, 0, -1.4], [-0.4, 0, -2.05]), kind: 'floor', label: '강대상 모니터 자리' },
      wedge_band: { pos: [2.05, P_CH, -1.3], rot: faceTo([2.05, 0, -1.3], [2.5, 0, -2.85]), kind: 'floor', label: '반주자 모니터 자리' },
      pa_left: { pos: [-3.15, 0, -0.7], rot: 0.22, kind: 'floor', label: '왼쪽 메인 스피커' },
      pa_right: { pos: [3.15, 0, -0.7], rot: -0.22, kind: 'floor', label: '오른쪽 메인 스피커' },
      foh1: { pos: [0.95, DT, 3.05], rot: 0, kind: 'desk', label: '방송실 1 (믹서)' },
      foh2: { pos: [1.95, DT, 3.2], rot: 0, kind: 'desk', label: '방송실 2' },
      foh3: { pos: [2.85, DT, 3.05], rot: -0.2, kind: 'desk', label: '방송실 3' },
      foh4: { pos: [0.1, DT, 3.2], rot: 0, kind: 'desk', label: '방송실 4' },
      cam_rear: { pos: [-1.3, 0, 3.4], rot: faceTo([-1.3, 0, 3.4], [-0.3, 0, -2.0]), kind: 'floor', label: '뒤쪽 카메라 자리' },
      ptz_side: { pos: [-3.75, 2.05, 0.6], rot: faceTo([-3.75, 0, 0.6], [0, 0, -2.0]), kind: 'wall', label: '옆벽 PTZ 자리' },
      router_foh: { pos: [-0.75, 0, 3.35], rot: 0, kind: 'floor', label: '공유기 자리' },
      // 스네이크: 강단 앞 가운데(강대상 모니터 옆) 바닥의 스테이지 박스 ↔ 방송실 책상 왼쪽 끝 바닥의 팬아웃
      stagebox: { pos: [0.75, P_CH, -1.25], rot: 0, kind: 'floor', label: '스테이지 박스 자리' },
      fanout: { pos: [-0.65, 0, 2.75], rot: 0.4, kind: 'floor', label: '스네이크 팬아웃 자리 (믹서 옆)' },
      // 파워 앰프 랙: 방송실 책상 오른쪽 끝 바닥 (스피커 케이블이 객석 옆을 따라 메인 스피커까지 간다)
      amp_rack: { pos: [3.7, 0, 2.45], rot: -0.5, kind: 'floor', label: '파워 앰프 랙 자리 (방송실)' },
      // 인이어 송신기 랙: 강단 오른쪽 앞 (반주자 모니터 옆)
      iem_rack: { pos: [2.75, P_CH, -1.3], rot: -0.3, kind: 'floor', label: '인이어 송신기 자리 (강단 옆)' },
      light_front_l: { pos: [-1.7, 3.5, 1.0], rot: faceTo([-1.7, 0, 1.0], [-0.4, 0, -2.0]), kind: 'truss', label: '앞 조명 L (설교자)', aim: [-0.4, 1.7, -2.0] },
      light_front_r: { pos: [1.7, 3.5, 1.0], rot: faceTo([1.7, 0, 1.0], [0.4, 0, -2.0]), kind: 'truss', label: '앞 조명 R (찬양팀)', aim: [1.0, 1.6, -1.9] },
      light_back_1: { pos: [-1.4, 3.6, -3.0], rot: 0, kind: 'truss', label: '뒤 조명 1', aim: [-0.5, P_CH, -1.4] },
      light_back_2: { pos: [1.4, 3.6, -3.0], rot: 0, kind: 'truss', label: '뒤 조명 2', aim: [0.8, P_CH, -1.4] },
      proj_ceiling: { pos: [1.9, 3.3, 1.2], rot: faceTo([1.9, 0, 1.2], [3.7, 0, -1.0]), kind: 'truss', label: '천장 프로젝터 자리', screen: { pos: [3.7, 2.3, -1.2], rot: -Math.PI / 2 + 0.5, w: 1.9, h: 1.07 } },
    },
    people: [
      { id: 'pastor', pos: [-0.4, P_CH, -2.05], rot: 0, talker: true, hands: 'pulpit', shirt: '#1f2937' },
      { id: 'leader', pos: [1.2, P_CH, -1.9], rot: 0, singer: true, shirt: '#e2e8f0' },
      ...[-2.9, -2.5, -2.1, -1.7].map((x, i) => ({ id: `choir${i}`, pos: [x, P_CH, -2.85], rot: 0, singer: true, shirt: '#7c2d12' })),
    ],
  },
  live_stage: {
    name: '밴드 공연장',
    camera: { pos: [0.6, 4.9, 8.8], target: [0.2, 1.0, -0.3], halfW: 5.1 },
    platform: { x: 0, z: -2.2, w: 7.4, d: 2.6, h: P_LS },
    desks: [{ x: 1.2, z: 3.5, w: 3.7, d: 0.75 }],
    trunk: { stage: [0.35, -0.85], foh: [0.6, 3.0], y: P_LS },
    dark: true,
    slots: {
      vocal_mic: { pos: [0, P_LS, -1.3], rot: 0, kind: 'floor', label: '보컬 마이크 자리' },
      gtr: { pos: [-1.95, P_LS, -1.95], rot: 0.15, kind: 'floor', label: '기타 자리' },
      keys: { pos: [1.95, P_LS, -2.2], rot: -0.1, kind: 'floor', label: '키보드 자리' },
      di_gtr: { pos: [-1.35, P_LS, -1.3], rot: 0, kind: 'floor', label: '기타 DI 자리' },
      di_keys: { pos: [1.35, P_LS, -1.4], rot: 0, kind: 'floor', label: '키보드 DI 자리' },
      wedge_vocal: { pos: [0, P_LS, -0.98], rot: Math.PI, kind: 'floor', label: '보컬 모니터 자리' },
      wedge_keys: { pos: [2.0, P_LS, -1.45], rot: faceTo([2.0, 0, -1.45], [1.95, 0, -2.7]), kind: 'floor', label: '키보드 모니터 자리' },
      pa_left: { pos: [-3.35, 0, -0.55], rot: 0.15, kind: 'floor', label: '왼쪽 메인 스피커' },
      pa_right: { pos: [3.35, 0, -0.55], rot: -0.15, kind: 'floor', label: '오른쪽 메인 스피커' },
      cam_stage: { pos: [-2.9, 0, 1.1], rot: faceTo([-2.9, 0, 1.1], [0, 0, -1.75]), kind: 'floor', label: '무대 카메라 자리' },
      foh1: { pos: [0.6, DT, 3.4], rot: 0, kind: 'desk', label: 'FOH 1 (믹서)' },
      foh2: { pos: [1.6, DT, 3.55], rot: 0, kind: 'desk', label: 'FOH 2' },
      foh3: { pos: [2.55, DT, 3.4], rot: -0.2, kind: 'desk', label: 'FOH 3' },
      laptop_foh: { pos: [-0.25, DT, 3.55], rot: 0, kind: 'desk', label: '노트북 자리' },
      ...Object.fromEntries([-3.0, -1.8, -0.6, 0.6, 1.8, 3.0].map((x, i) => [`truss${i + 1}`, { pos: [x, 3.45, -1.3], rot: Math.PI, kind: 'truss', label: `무대 트러스 ${i + 1}`, aim: [x * 0.4, P_LS, -1.8] }])),
      light_front_l: { pos: [-2.4, 3.4, 1.8], rot: faceTo([-2.4, 0, 1.8], [0, 0, -1.7]), kind: 'truss', label: '앞 조명 L', aim: [-0.2, 1.6, -1.7] },
      light_front_r: { pos: [2.4, 3.4, 1.8], rot: faceTo([2.4, 0, 1.8], [0, 0, -1.7]), kind: 'truss', label: '앞 조명 R', aim: [0.2, 1.6, -1.7] },
      led_back: { pos: [0, P_LS, -3.3], rot: 0, kind: 'floor', label: '무대 뒤 LED 자리', ledWall: { w: 4.2, h: 2.25 } },
      ptz_truss: { pos: [0, 3.42, -1.05], rot: Math.PI, kind: 'truss', label: '트러스 PTZ 자리' },
      router_foh: { pos: [-1.2, 0, 3.6], rot: 0, kind: 'floor', label: '공유기 자리' },
      // 드럼 세트(무대 뒤 가운데) 주변 마이크 자리
      kick_mic: { pos: [0.2, P_LS, -2.38], rot: Math.PI, kind: 'floor', label: '킥 드럼 마이크 자리' },
      snare_mic: { pos: [-0.22, P_LS, -2.5], rot: Math.PI * 0.8, kind: 'floor', label: '스네어 마이크 자리' },
      oh_l: { pos: [-0.55, P_LS, -2.55], rot: Math.PI * 0.85, kind: 'floor', label: '오버헤드 L 자리' },
      oh_r: { pos: [0.95, P_LS, -2.55], rot: -Math.PI * 0.85, kind: 'floor', label: '오버헤드 R 자리' },
      bass: { pos: [-2.75, P_LS, -2.35], rot: 0.25, kind: 'floor', label: '베이스 자리' },
      di_bass: { pos: [-2.2, P_LS, -1.3], rot: 0, kind: 'floor', label: '베이스 DI 자리' },
      di_keys2: { pos: [1.75, P_LS, -1.3], rot: 0, kind: 'floor', label: '건반 DI 2 자리' },
      // 스네이크: 무대 앞 가운데(보컬 옆)의 스테이지 박스 ↔ FOH 책상 왼쪽 끝 바닥의 팬아웃
      stagebox: { pos: [0.5, P_LS, -1.1], rot: 0, kind: 'floor', label: '스테이지 박스 자리' },
      fanout: { pos: [-0.95, 0, 3.2], rot: 0.4, kind: 'floor', label: '스네이크 팬아웃 자리 (믹서 옆)' },
      // 무대 왼쪽 옆(사이드 스테이지)의 파워 앰프 랙 · 오른쪽 옆의 인이어 송신기 랙
      amp_rack: { pos: [-3.25, P_LS, -2.95], rot: 0.5, kind: 'floor', label: '파워 앰프 랙 자리 (무대 옆)' },
      iem_rack: { pos: [3.2, P_LS, -2.75], rot: -0.5, kind: 'floor', label: '인이어 송신기 자리 (무대 옆)' },
    },
    people: [{ id: 'singer', pos: [0, P_LS, -1.75], rot: 0, singer: true, talker: true, shirt: '#111827' }],
  },
  lecture_hall: {
    name: '강의 중계 스튜디오',
    camera: { pos: [-0.3, 2.9, 5.6], target: [-0.3, 0.9, 0.25], halfW: 4.3 },
    desks: [{ x: 0.5, z: 0.15, w: 3.6, d: 0.85 }],
    onAir: true,
    slots: {
      host_mic: { pos: [-2.4, 0, -0.3], rot: 0, kind: 'floor', label: '진행자 마이크 자리' },
      desk1: { pos: [-0.05, DT, 0.2], rot: 0, kind: 'desk', label: '책상 1 (믹서)' },
      desk2: { pos: [0.75, DT, 0.38], rot: 0, kind: 'desk', label: '책상 2 (스위처)' },
      desk3: { pos: [1.75, DT, 0.05], rot: -0.15, kind: 'desk', label: '책상 3 (PC)' },
      desk4: { pos: [-0.95, DT, 0.3], rot: 0, kind: 'desk', label: '책상 4' },
      cam1: { pos: [-1.2, 0, 1.05], rot: faceTo([-1.2, 0, 1.05], [-2.4, 0, -0.75]), kind: 'floor', label: '카메라 1 자리' },
      cam2: { pos: [-3.3, 0, 1.5], rot: faceTo([-3.3, 0, 1.5], [-2.4, 0, -0.75]), kind: 'floor', label: '카메라 2 자리' },
      pa_main: { pos: [2.95, 0, 0.95], rot: -0.45, kind: 'floor', label: '스피커 자리' },
      router_rack: { pos: [2.75, 0, -1.0], rot: 0, kind: 'floor', label: '공유기(랙) 자리' },
      ptz_ceiling: { pos: [0.2, 2.35, -2.12], rot: faceTo([0.2, 0, -2.12], [-2.4, 0, -0.75]), kind: 'wall', label: '벽면 PTZ 자리' },
      light_key: { pos: [-1.1, 2.9, 0.8], rot: faceTo([-1.1, 0, 0.8], [-2.4, 0, -0.75]), kind: 'truss', label: '키 라이트', aim: [-2.4, 1.5, -0.75] },
      light_fill: { pos: [-3.7, 2.9, 0.5], rot: faceTo([-3.7, 0, 0.5], [-2.4, 0, -0.75]), kind: 'truss', label: '필 라이트', aim: [-2.4, 1.5, -0.75] },
      light_back: { pos: [-2.6, 2.9, -1.95], rot: faceTo([-2.6, 0, -1.95], [-2.4, 0, -0.75]), kind: 'truss', label: '백 라이트', aim: [-2.4, 1.6, -0.75] },
    },
    people: [{ id: 'host', pos: [-2.4, 0, -0.75], rot: 0, talker: true, shirt: '#3b5b8f' }],
  },
};


// 자유 모드(스튜디오)용 넓은 빈 무대: 자리 대신 바닥/책상 아무 곳에나 놓는다
VENUES.sandbox = {
  name: '자유 스튜디오',
  camera: { pos: [0.5, 5.2, 9.0], target: [0.3, 0.8, -0.2], halfW: 5.6 },
  desks: [{ x: 1.6, z: 2.6, w: 4.0, d: 0.9 }, { x: -3.2, z: 2.6, w: 1.8, d: 0.9 }],
  platform: { x: 0, z: -2.3, w: 9, d: 2.6, h: 0.35 },
  slots: {},
  free: true,
  people: [
    { id: 'p1', pos: [-1.6, 0.35, -2.2], rot: 0, talker: true, shirt: '#3b5b8f' },
    { id: 'p2', pos: [1.4, 0.35, -2.4], rot: 0, singer: true, shirt: '#7c2d12' },
  ],
};

// 자리 이름 목록 (검증용)
export const slotNames = (venue) => Object.keys(VENUES[venue]?.slots ?? {});
