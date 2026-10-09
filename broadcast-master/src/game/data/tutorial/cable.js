/* 튜토리얼 파트 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 파트 3 · 케이블 · 커넥터 · 스네이크 (공연장). 험 체험 → 밸런스드 → XLR 수·암 → TS·TRS → 3.5mm·젠더
 * → 스네이크(스테이지 박스·팬아웃·멀티) 실습 → 리턴으로 무대 모니터까지 → 인풋 리스트 → 케이블 감기.
 * 메인 스피커는 미리 연결. 건반은 누군가 기타 선(TS)으로 믹서까지 바로 끌어다 놓은 상태 (험 체험용).
 * 1번 AUX는 0으로 둬서, 리턴 선을 다 이어도 모니터가 조용한 이유가 AUX 하나뿐이게 한다. */
export default {
  id: 'tut-cable', venue: 'live_stage', title: '파트 3 · 케이블 · 커넥터 · 스네이크',
  summary: '부웅 하는 험은 왜 생길까? XLR·TRS·3.5mm 구별, 스네이크로 무대 마이크를 믹서까지 잇고 모니터로 돌려보내기.',
  mission: '스테이지 박스와 팬아웃을 깔고 보컬 마이크를 믹서 CH1까지, 모니터 소리는 다시 무대까지 이어 봅니다.',
  devices: [
    { id: 'vmic', type: 'dynamic_mic', slot: 'vocal_mic', name: '보컬 마이크' },
    { id: 'keys', type: 'keyboard', slot: 'keys', name: '건반' },
    { id: 'wedge', type: 'monitor', slot: 'wedge_vocal', name: '보컬 모니터' },
    { id: 'box', type: 'stage_box', slot: 'stagebox', placed: false, name: '스테이지 박스' },
    { id: 'fan', type: 'snake_fanout', slot: 'fanout', placed: false, name: '스네이크 팬아웃' },
    { id: 'mixer', type: 'analog_mixer', slot: 'foh1', name: '아날로그 믹서' },
    { id: 'paL', type: 'speaker', slot: 'pa_left', name: '왼쪽 메인 스피커' },
    { id: 'paR', type: 'speaker', slot: 'pa_right', name: '오른쪽 메인 스피커' },
  ],
  connections: [
    { from: 'mixer.main', to: 'paL.in', cable: 'xlr' },
    { from: 'mixer.mainR', to: 'paR.in', cable: 'xlr' },
    { from: 'keys.out', to: 'mixer.line2', cable: 'trs' },
  ],
  inventory: { xlr: 4, trs: 1, multi: 1 },
  state: { channels: { 2: { gain: 20 } } },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 오늘 할 일
    { say: '오늘은 케이블이에요. 믹서가 객석 맨 뒤라 무대까지 30미터쯤 되는데, 이 길을 어떻게 잇는지 볼 거예요.', focus: 'mixer' },
    { who: 'junior', say: '선은 다 거기서 거기 아니에요? 구멍에 맞는 걸로 꽂으면 끝일 것 같은데요.' },

    // 밸런스드 vs 언밸런스드: 먼저 귀로 듣는다
    { say: '그런지 아닌지 들어 보면 알아요. 마침 누가 건반을 기타 선으로 믹서까지 바로 끌어다 놨거든요.', focus: 'keys', op: 'perform', on: true },
    { who: 'junior', say: '어? 음악 밑에 부웅 하는 소리가 계속 깔려요. 이게 뭐예요?' },
    { say: '험이라는 잡음이에요. 기타 선은 언밸런스드라서, 길게 끌면 오는 길에 전기 잡음을 다 주워 오거든요.', op: 'perform', on: false },
    { say: '마이크 선 같은 밸런스드는 소리를 두 가닥에 실어요. 한 가닥은 그대로, 한 가닥은 위아래를 뒤집어서요.', show: { concept: 'balanced' } },
    { say: '믹서에 닿으면 뒤집힌 쪽을 다시 뒤집어서 합쳐요. 그림에서 잡음을 키워 봐도 맨 아래 줄은 깨끗하죠?', show: { concept: 'balanced' } },
    { who: 'junior', say: '같이 묻은 잡음끼리 지워지는 거네요. 그래서 마이크 선은 30미터를 끌어도 깨끗하구나!' },
    { say: '건반 선은 빼 두죠. 건반 소리를 밸런스드로 바꿔 주는 DI 박스가 따로 있는데, 그건 악기 파트에서 해 봐요.', op: 'disconnect', from: 'keys.out', to: 'mixer.line2', practice: '건반을 클릭하고 연결된 케이블의 분리를 눌러 보세요.' },
    { quiz: { q: '무대 건반을 기타 선으로 30m 끌어왔더니 부웅 소리가 나요. 왜 그럴까요?', options: ['건반 볼륨이 너무 커서', '언밸런스드 선이 오는 길에 잡음을 주워 와서', '스피커가 고장 나서'], answer: 1, explain: '언밸런스드 선은 길수록 잡음을 그대로 싣고 와요. 먼 길은 밸런스드로 보내야 깨끗하죠.' } },

    // XLR 수·암
    { who: 'junior', say: '그런데 마이크 선은 양쪽 끝 모양이 달라요. 한쪽은 핀이 나와 있고, 한쪽은 구멍이에요.' },
    { say: '그게 XLR이에요. 핀 나온 쪽이 수, 구멍 난 쪽이 암이죠. 소리는 늘 수에서 나와서 암으로 들어가요.', show: { items: [{ photo: 'conn_xlr_male', label: '수 · 핀 3개' }, { photo: 'conn_xlr_female', label: '암 · 구멍 3개' }], caption: '꽂으면 딸깍 잠겨서 당겨도 안 빠져요' } },

    // TS와 TRS
    { who: 'junior', say: '이 굵은 잭은 기타 선이죠? 근데 이건 끝에 줄이 하나 더 그어져 있네요.' },
    { say: '둘 다 6.3mm 잭인데, 끝의 검은 링을 세 보면 돼요. 하나면 기타용 TS, 둘이면 밸런스드로도 쓰는 TRS예요.', show: { items: [{ photo: 'conn_ts', label: 'TS · 링 1개 · 악기' }, { photo: 'conn_trs', label: 'TRS · 링 2개 · 라인과 헤드폰' }] } },
    { quiz: { q: '잭 끝에 검은 링이 두 줄 보여요. 이 케이블은 뭘까요?', options: ['TS', 'TRS', 'XLR'], answer: 1, explain: '링이 두 줄이면 TRS예요. 가닥이 하나 더 있어서 밸런스드 라인이나 헤드폰 양쪽 소리를 실을 수 있죠.' } },

    // 3.5mm와 변환 젠더 · Y 케이블
    { who: 'junior', say: '노트북에 꽂는 작은 잭은요? 믹서엔 그렇게 작은 구멍이 없던데요.' },
    { say: '그럴 땐 변환 젠더나 Y 케이블을 써요. Y 케이블은 3.5mm 하나를 6.3mm 두 개로 갈라 주죠.', show: { items: [{ photo: 'conn_mini', label: '3.5mm' }, { photo: 'adapter_y', label: 'Y 케이블' }, { photo: 'adapter_xlr_trs', label: '변환 젠더' }] } },
    { who: 'junior', say: '오, 그럼 젠더만 챙기면 뭐든 다 연결되겠네요!' },
    { say: '모양만 바뀌는 거예요. 속은 그대로 언밸런스드라 길게 끌면 잡음이 나고, 소리 크기도 그대로고요.' },
    { say: '게다가 잘 헐거워져요. 지난주 결혼식에선 젠더가 쏙 빠져서 입장곡이 뚝 끊겼다니까요.' },
    { quiz: { q: '노트북 3.5mm에 XLR 변환 젠더를 끼웠어요. 이제 30m 끌어도 깨끗할까요?', options: ['아니요, 속은 그대로 언밸런스드예요', '네, 끝이 XLR이니까 밸런스드가 돼요'], answer: 0, explain: '젠더는 모양만 바꿔 줘요. 멀리 보내려면 DI 박스로 밸런스드 신호를 만들어야 하죠.' } },

    // 왜 스네이크인가
    { who: 'junior', say: '오늘 밴드는 마이크가 여덟 개래요. 30미터짜리 선을 여덟 줄이나 객석으로 끌어요?' },
    { say: '그럼 바닥이 선밭이 되죠. 관객이 밟고 걸려 넘어지기 딱 좋고요. 그래서 스네이크를 써요.', show: { photo: 'snake_reel' } },
    { say: '굵은 피복 하나에 마이크 선 여러 가닥이 들어 있어요. 무대 쪽 끝이 스테이지 박스인데, 무대 앞에 놔 볼까요?', show: { photo: 'snake_stagebox' }, op: 'place', device: 'box', practice: '무대 앞의 + 스테이지 박스 배치를 눌러 보세요.' },
    { say: '믹서 쪽 끝은 팬아웃이에요. 번호 붙은 꼬리가 갈라져 나오니까 믹서 바로 옆에 둬요.', show: { photo: 'snake_fanout' }, op: 'place', device: 'fan', practice: '믹서 옆의 + 스네이크 팬아웃 배치를 눌러 보세요.' },
    { say: '이제 멀티 케이블 한 줄로 둘을 이어요. 객석을 건너는 선은 이거 하나면 돼요.', op: 'connect', from: 'box.multi', to: 'fan.multi', cable: 'multi', practice: 'MULTI 케이블로 박스 MULTI와 팬아웃 MULTI를 이어 보세요.' },

    // 실습: 보컬 마이크 → 박스 INPUT 1 → (멀티) → 팬아웃 OUT 1 → 믹서 CH1. 마지막 한 줄 전까지는 소리가 안 난다
    { say: '보컬 마이크는 박스 INPUT 1에 꽂아요. 무대 위라 짧은 XLR이면 충분하죠.', op: 'connect', from: 'vmic.out', to: 'box.in1', cable: 'xlr', practice: 'XLR로 보컬 마이크와 박스 INPUT 1을 이어 보세요.' },
    { say: '보컬한테 한 소절 불러 달라고 할게요. 믹서 1번 미터를 같이 봐요.', focus: 'mixer', op: 'talk', on: true },
    { who: 'junior', say: '어? 1번 미터가 꿈쩍도 안 해요. 멀티를 잘못 꽂았나 봐요.' },
    { say: '멀티는 맞아요. INPUT 1로 들어간 소리는 팬아웃 OUT 1로 나오거든요. 그걸 믹서 CH1에 꽂아야죠.', focus: 'fan', op: 'connect', from: 'fan.out1', to: 'mixer.in1', cable: 'xlr', practice: 'XLR로 팬아웃 OUT 1과 믹서 CH1 MIC를 이어 보세요.' },
    { who: 'junior', say: '나왔어요! 30미터를 건너왔는데 부웅 소리가 하나도 없네요. 스네이크 안도 다 밸런스드라서죠?' },
    { say: '맞아요. 그리고 박스 번호가 곧 믹서 채널 번호예요. 3번에 꽂으면 CH3, 5번이면 CH5죠.', op: 'talk', on: false },
    { quiz: { q: '스네어 마이크를 스테이지 박스 INPUT 2에 꽂았어요. 믹서에서는 어느 채널을 볼까요?', options: ['CH1', '비어 있는 아무 채널', 'CH2'], answer: 2, explain: '박스 2번은 팬아웃 OUT 2로 나와서 CH2에 꽂혀요. 번호만 맞추면 헤맬 일이 없죠.' } },

    // 리턴 맛보기: 믹서 AUX SEND 1 → 팬아웃 RETURN 1 → (멀티) → 박스 RETURN 1 → 보컬 모니터
    { who: 'junior', say: '그럼 보컬 앞 모니터 스피커는요? 믹서는 저 뒤에 있잖아요.', focus: 'wedge' },
    { say: '스네이크는 거꾸로도 보내요. 모니터용 소리가 나가는 믹서 AUX SEND 1을 팬아웃 RETURN 1에 꽂아요.', focus: 'fan', op: 'connect', from: 'mixer.aux1', to: 'fan.ret1', cable: 'trs', practice: 'TRS로 믹서 AUX SEND 1과 팬아웃 RETURN 1을 이어 보세요.' },
    { say: '무대에선 박스 RETURN 1에서 모니터로 가요. 여기는 XLR로 이으면 되고요.', focus: 'box', op: 'connect', from: 'box.ret1', to: 'wedge.in', cable: 'xlr', practice: 'XLR로 박스 RETURN 1과 보컬 모니터를 이어 보세요.' },
    { say: '보컬이 다시 불러 줄 거예요. 아래 귀 모양 옆을 무대 모니터로 바꿔서 들어 봐요.', focus: 'wedge', op: 'talk', on: true },
    { who: 'junior', say: '어, 모니터에선 아무것도 안 들려요. 이번엔 진짜 선이 잘못됐죠?' },
    { say: '선은 맞아요. 1번 AUX가 0이거든요. 파트 1에서 본, 무대 모니터로 따로 보내는 손잡이요.', show: { concept: 'strip', focus: 'aux' }, op: 'ch', ch: 1, key: 'aux', value: 60, practice: '믹서 콘솔에서 CH1 AUX1을 60 근처로 돌려 보세요.' },
    { who: 'junior', say: '들려요! 믹서까지 갔던 소리가 같은 선을 타고 다시 무대로 오네요.' },

    // 인풋 리스트
    { say: '선이 이렇게 오가면 헷갈리니까, 몇 번에 뭘 꽂을지 종이 한 장에 미리 적어 와요. 인풋 리스트라고 하죠.', op: 'talk', on: false },

    // 케이블 감기
    { who: 'junior', say: '공연 끝나면 이 긴 선들은 팔꿈치에 칭칭 감으면 되죠?' },
    { say: '그러면 속이 꼬여서 금방 끊겨요. 한 번은 바로, 한 번은 뒤집어 감는 오버언더로 감아요.', show: { concept: 'cablecare' } },
    { quiz: { q: '공연이 끝나고 마이크 선을 감을 차례예요. 어떻게 감을까요?', options: ['팔꿈치와 손에 빙빙 감는다', '한 번은 바로, 한 번은 뒤집어 번갈아 감는다', '대충 접어서 가방에 넣는다'], answer: 1, explain: '오버언더로 감으면 속 가닥이 안 꼬여서 오래가요. 다음 현장에서 풀 때도 이어폰 줄처럼 엉키지 않고요.' } },
    { say: '케이블은 여기까지예요. 다음 파트에선 이 선들이 다 모이는 믹서를 제대로 다뤄 봐요.' },
  ],
};
