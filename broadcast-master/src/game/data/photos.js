/* =====================================================================
 * 실물 사진 목록 — 튜토리얼 카드와 백과사전에서 쓰는 장비 사진
 *  id → { alt, file?, credit? }. file이 없으면 사진 대신 3D 모델/커넥터 그림을 보여 준다.
 *  사진 파일은 scripts/fetch-photos.mjs가 위키미디어 공용(자유 라이선스)에서 받아 src/game/photos/에 넣는다.
 * ===================================================================== */
import { PHOTO_FILES } from '../photos/index.js';

export const PHOTOS = {
  // 마이크
  mic_dynamic: { alt: '다이나믹 마이크 (SM58 타입)', model: 'dynamic_mic' },
  mic_condenser: { alt: '대형 진동판 콘덴서 마이크', model: 'condenser_mic' },
  mic_pencil: { alt: '소형 콘덴서 (펜슬) 마이크', model: 'overhead_mic' },
  mic_wireless: { alt: '무선 핸드헬드 마이크', model: 'wireless_mic' },
  mic_wireless_rx: { alt: '무선 마이크 수신기', model: 'wireless_mic' },
  mic_headset: { alt: '헤드셋 마이크' },
  mic_lavalier: { alt: '핀 마이크 (라발리에)' },
  mic_gooseneck: { alt: '구즈넥 마이크 (강대상·회의용)' },
  // 커넥터·케이블
  conn_xlr_male: { alt: 'XLR 수(male) 커넥터', connector: 'xlr' },
  conn_xlr_female: { alt: 'XLR 암(female) 커넥터', connector: 'xlr', female: true },
  conn_trs: { alt: '6.3mm TRS 잭 (링 2개)', connector: 'trs' },
  conn_ts: { alt: '6.3mm TS 잭 (링 1개)', connector: 'trs' },
  conn_mini: { alt: '3.5mm 미니 잭', connector: 'mini' },
  conn_speakon: { alt: '스피콘 커넥터', connector: 'speakon' },
  adapter_y: { alt: '3.5mm → 6.3mm 두 갈래 (Y) 케이블', connector: 'mini' },
  adapter_xlr_trs: { alt: 'XLR ↔ 6.3mm 변환 젠더', connector: 'xlr' },
  cable_reel: { alt: '케이블 8자 감기 (오버언더)' },
  // 스네이크
  snake_stagebox: { alt: '스테이지 박스 (멀티 케이블 무대 쪽)', model: 'stage_box' },
  snake_reel: { alt: '멀티 케이블 릴', model: 'stage_box' },
  snake_fanout: { alt: '스네이크 팬아웃 (믹서 쪽 꼬리)', model: 'snake_fanout' },
  // 믹서
  mixer_analog: { alt: '아날로그 믹서', model: 'analog_mixer' },
  mixer_digital: { alt: '디지털 믹서', model: 'digital_mixer' },
  mixer_phantom: { alt: '믹서의 +48V 팬텀 스위치', model: 'analog_mixer' },
  di_box: { alt: 'DI 박스', model: 'di_box' },
  // 스피커·모니터
  speaker_active: { alt: '액티브 PA 스피커', model: 'speaker' },
  speaker_passive: { alt: '패시브 스피커', model: 'passive_speaker' },
  power_amp: { alt: '파워 앰프', model: 'power_amp' },
  monitor_wedge: { alt: '바닥형 모니터 스피커 (웨지)', model: 'monitor' },
  iem: { alt: '인이어 모니터 (IEM)', model: 'iem' },
  headphones: { alt: '모니터 헤드폰', model: 'headphones' },
  // 악기
  drum_kit: { alt: '드럼 세트', model: 'drum_kit' },
  drum_kick_mic: { alt: '킥 드럼 마이크', model: 'kick_mic' },
  drum_snare_mic: { alt: '스네어 마이크', model: 'snare_mic' },
  drum_overheads: { alt: '드럼 오버헤드 마이크', model: 'overhead_mic' },
  bass_guitar: { alt: '베이스 기타', model: 'bass_guitar' },
  e_guitar: { alt: '일렉 기타', model: 'e_guitar' },
  guitar_amp: { alt: '기타 앰프' },
  digital_piano: { alt: '디지털 피아노', model: 'digital_piano' },
  // 영상·조명
  camcorder: { alt: '캠코더', model: 'camera' },
  ptz_camera: { alt: 'PTZ 카메라', model: 'ptz' },
  atem_mini: { alt: 'ATEM Mini 스위처', model: 'atem' },
  lighting_console: { alt: '조명 콘솔', model: 'lighting_console' },
  par_led: { alt: 'LED 파 조명', model: 'par_led' },
  moving_head: { alt: '무빙 헤드 조명', model: 'moving_head' },
  projector: { alt: '프로젝터', model: 'projector' },
  led_wall: { alt: 'LED 전광판', model: 'led_wall' },
};

// 사진 파일 주소(data URL) — 아직 받지 못한 사진은 null
export const photoSrc = (id) => PHOTO_FILES[id]?.src ?? null;
export const photoCredit = (id) => PHOTO_FILES[id]?.credit ?? null;
export const photoPage = (id) => PHOTO_FILES[id]?.url ?? null;
