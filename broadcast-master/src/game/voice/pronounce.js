/* =====================================================================
 * 읽기용 문장 — 화면 글자는 장비에 쓰인 그대로(XLR, +48V), 음성은 사람이 읽는 대로(엑스엘알, 사십팔 볼트)
 *  미리 녹음하는 음성(scripts/voice)과 브라우저 음성이 같은 규칙을 쓴다
 * ===================================================================== */

// 긴 것부터 바꾼다 (부분 겹침 방지)
const WORDS = [
  ['Tiger Touch', '타이거 터치'], ['Resolume Arena', '레졸룸 아레나'], ['Resolume', '레졸룸'], ['ATEM Mini Pro', '에이템 미니 프로'], ['ATEM Mini', '에이템 미니'], ['ATEM', '에이템'],
  ['ON AIR', '온에어'], ['LOW CUT', '로우 컷'], ['GROUND LIFT', '그라운드 리프트'], ['STEREO OUT', '스테레오 아웃'], ['AF OUT', '에이에프 아웃'], ['L/MONO', '엘 모노'],
  ['USB-C', '유에스비 씨'], ['X32', '엑스 삼십이'], ['SM58', '에스엠 오십팔'], ['SM57', '에스엠 오십칠'], ['Beta 52', '베타 오십이'], ['OBS', '오비에스'],
  ['XLR', '엑스엘알'], ['TRS', '티알에스'], ['HDMI', '에이치디엠아이'], ['SDI', '에스디아이'], ['USB', '유에스비'], ['DMX', '디엠엑스'], ['PTZ', '피티지'], ['IEM', '아이이엠'],
  ['LED', '엘이디'], ['RGBW', '알지비더블유'], ['RGB', '알지비'], ['BGM', '비지엠'], ['PFL', '피에프엘'], ['HPF', '에이치피에프'], ['EQ', '이큐'], ['AUX', '옥스'], ['FOH', '에프오에이치'],
  ['PVW', '프리뷰'], ['PGM', '프로그램'], ['VJ', '브이제이'], ['UHF', '유에이치에프'], ['RF', '알에프'], ['DI', '디아이'], ['PA', '피에이'], ['TS', '티에스'], ['IP', '아이피'], ['NDI', '엔디아이'],
  ['LAN', '랜'], ['MIC', '마이크'], ['LINE', '라인'], ['GAIN', '게인'], ['MUTE', '뮤트'], ['PEAK', '피크'], ['MAIN', '메인'], ['STEREO', '스테레오'], ['PHANTOM', '팬텀'], ['MONO', '모노'],
  ['INPUT', '인풋'], ['OUTPUT', '아웃풋'], ['THRU', '스루'], ['RETURN', '리턴'], ['RET', '리턴'], ['SEND', '센드'], ['PAN', '팬'], ['COMP', '컴프'], ['PAD', '패드'], ['POWER', '파워'],
  ['CUT', '컷'], ['AUTO', '오토'], ['PREVIEW', '프리뷰'], ['PROGRAM', '프로그램'], ['STORE', '스토어'], ['ZOOM', '줌'], ['TILT', '틸트'], ['PHONES', '폰즈'], ['MULTI', '멀티'],
  ['BLACKOUT', '블랙아웃'], ['MASTER', '마스터'], ['RECORD', '레코드'], ['GRAND', '그랜드'], ['Opacity', '오패시티'], ['INST', '인스트'], ['PIP', '픽처 인 픽처'], ['PC', '피씨'], ['FX', '이펙트'], ['Y', '와이'], ['LOCAL', '로컬'], ['HIGH', '하이'], ['MID', '미드'], ['LOW', '로우'], ['FREQ', '프리퀀시'], ['TILT', '틸트'], ['PRESET', '프리셋'], ['MIX', '믹스'], ['BUS', '버스'], ['CAM', '캠'], ['SPK', '스피커'], ['GROUND', '그라운드'], ['LIFT', '리프트'], ['PAN', '팬'], ['ON', '온'], ['OFF', '오프'], ['IN', '인'], ['OUT', '아웃'], ['CH', '채널'], ['L', '엘'], ['R', '알'], ['A', '에이'], ['B', '비'],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// 영문 낱말 경계: 앞뒤가 영문자가 아닐 때만 (한글 조사 붙은 경우 "XLR을"도 바뀌게)
const WORD_RES = WORDS.map(([k, v]) => [new RegExp(`(?<![A-Za-z])${esc(k)}(?![A-Za-z])`, 'g'), v]);

const DIG = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
// 정수를 한자어 수사로 (0 ~ 99999)
export function sino(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return '영';
  const units = [[10000, '만'], [1000, '천'], [100, '백'], [10, '십']];
  let out = '';
  for (const [u, name] of units) {
    const q = Math.floor(n / u);
    if (q) { out += (q === 1 ? '' : DIG[q]) + name; n %= u; }
  }
  if (n) out += DIG[n];
  return out;
}
// 고유어 수사 (개·대·명처럼 세는 말 앞): 1~99
const NATIVE1 = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const NATIVE10 = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const native = (n) => (n >= 1 && n < 100 ? (n === 20 ? '스무' : NATIVE10[Math.floor(n / 10)] + NATIVE1[n % 10]) : sino(n));
const decimal = (s) => { const [a, b] = s.split('.'); return `${sino(Number(a))}점${[...b].map((d) => DIG[+d]).join('')}`; };

export function ttsText(text) {
  let t = String(text ?? '');
  // 단위가 붙은 수
  t = t.replace(/\+\s?48\s?V/gi, '플러스 사십팔 볼트');
  t = t.replace(/(-|\+|−)?(\d+(?:\.\d+)?)\s?dB/g, (_, s, n) => `${s === '-' || s === '−' ? '마이너스 ' : s === '+' ? '플러스 ' : ''}${n.includes('.') ? decimal(n) : sino(+n)} 데시벨`);
  t = t.replace(/(\d+(?:\.\d+)?)\s?mm/g, (_, n) => `${n.includes('.') ? decimal(n) : sino(+n)} 밀리`);
  t = t.replace(/(\d+(?:\.\d+)?)\s?kHz/g, (_, n) => `${n.includes('.') ? decimal(n) : sino(+n)} 킬로헤르츠`);
  t = t.replace(/(\d+)\s?Hz/g, (_, n) => `${sino(+n)} 헤르츠`);
  t = t.replace(/(\d+)\s?V(?![A-Za-z])/g, (_, n) => `${sino(+n)} 볼트`);
  t = t.replace(/(\d+)\s?W(?![A-Za-z])/g, (_, n) => `${sino(+n)} 와트`);
  t = t.replace(/(\d+)\s?m(?![A-Za-z])/g, (_, n) => `${sino(+n)} 미터`);
  t = t.replace(/(\d+(?:\.\d+)?)\s?x(?![A-Za-z])/g, (_, n) => `${n.includes('.') ? decimal(n) : sino(+n)} 배`);
  t = t.replace(/(\d+)\s?%/g, (_, n) => `${sino(+n)} 퍼센트`);
  t = t.replace(/(\d+)\s?(개|대|명|줄|가지|군데|마리|번째|시간|살|칸|장)(?![가-힣]*\d)/g, (_, n, u) => `${native(+n)} ${u}`);
  // 9/10 채널 → 구 십 채널
  t = t.replace(/(\d+)\s?\/\s?(\d+)/g, (_, a, b) => `${sino(+a)}, ${sino(+b)}`);
  // 부호 붙은 수: +4 → 플러스 사, -6 → 마이너스 육
  t = t.replace(/(^|[\s(~])\+(\d)/g, '$1플러스 $2').replace(/(^|[\s(~])[-−](\d)/g, '$1마이너스 $2');
  // 장비에 영어로 쓰인 이름 뒤 번호는 영어로 읽는다 (AUX 2 → 옥스 투, HDMI IN 1 → 인 원)
  const EN = ['', '원', '투', '쓰리', '포', '파이브', '식스', '세븐', '에잇', '나인'];
  t = t.replace(/(?<![A-Za-z])(AUX|IN|OUT|LOCAL|CAM|MIX|BUS|RET|RETURN|INPUT|OUTPUT|SEND|PRESET|MON|CH|LINE)\s?([1-9])(?!\d)/g, (_, w, d) => `${w} ${EN[+d]}`);
  for (const [re, v] of WORD_RES) t = t.replace(re, v);
  // 남은 숫자는 한자어 수사로 (1번 → 일 번, 12채널 → 십이 채널). 소수점은 "점"
  t = t.replace(/\d+\.\d+/g, (n) => decimal(n));
  t = t.replace(/\d+/g, (n) => sino(+n));
  // 남은 기호
  t = t.replace(/[·•]/g, ', ').replace(/[→]/g, ', ').replace(/[“”"「」『』]/g, '').replace(/\s{2,}/g, ' ');
  return t.trim();
}

// 미리 녹음한 음성 찾기용 열쇠 (말하는 사람 + 화면 문장)
export function lineKey(who, text) {
  const s = `${who || 'senior'}|${text}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
