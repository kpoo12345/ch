/* 튜토리얼 파트 4 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 믹서 실전 (세미나실). 손잡이 이름은 파트 1에서 배웠으니 "어떻게 잘 쓰나"에 집중한다. 손잡이가 나올 때마다 한 문장으로 다시 짚는다.
 * 리허설: 헤드폰 + PFL로 객석 몰래 먼저 듣기 → GAIN은 미터 흰 칸(-20~-6)으로, 클리핑은 헤드폰에서 체험 → LOW CUT(HPF) → 페이더 열기
 * → EQ는 깎는 게 먼저 → ON 버튼과 페이더 차이 → 노트북 BGM(LINE, 스테레오 채널, GAIN 낮게) → 페이드 인/아웃
 * → 하울링 체험(스피커를 마이크 정면에) → GAIN으로 급한 불 끄기 → 스피커 자리로 진짜 해결.
 * 시작 상태: 마이크·스피커는 미리 연결, CH1 GAIN·페이더는 0 (페이더를 닫아 둔 채 PFL로 먼저 듣는다).
 * 클리핑은 페이더가 닫힌 상태에서 일으켜 하울링 없이 헤드폰으로만 들리게 한다.
 * 하울링: pa_alt + GAIN 40이면 울리고(고리 > 0), GAIN 30이면 멎고, pa_main에선 GAIN 36도 넉넉하다 (sim.js 피드백 계산). */
export default {
  id: 'tut-mixer', venue: 'seminar', title: '파트 4 · 믹서 실전',
  summary: 'PFL로 먼저 듣고 GAIN 맞추기, 말소리 LOW CUT, 깎는 EQ, ON 버튼, 노트북 BGM과 페이드, 하울링 잡기.',
  mission: '세미나 리허설부터 쉬는 시간 BGM, 하울링 사고까지 믹서를 실전처럼 다뤄 봅니다.',
  devices: [
    { id: 'mic', type: 'dynamic_mic', slot: 'presenter_mic', name: '강연자 마이크' },
    { id: 'mixer', type: 'analog_mixer', slot: 'desk1', name: '아날로그 믹서' },
    { id: 'pa', type: 'speaker', slot: 'pa_main', name: '메인 스피커' },
    { id: 'hp', type: 'headphones', slot: 'desk3', placed: false, name: '모니터 헤드폰' },
    { id: 'lap', type: 'laptop', slot: 'desk2', placed: false, name: 'BGM 노트북' },
  ],
  connections: [
    { from: 'mic.out', to: 'mixer.in1', cable: 'xlr' },
    { from: 'mixer.main', to: 'pa.in', cable: 'xlr' },
  ],
  inventory: { trs: 1, mini: 1 },
  state: {
    channels: { 1: { gain: 0, fader: 0, lowCutFreq: 40 }, 9: { gain: 0, fader: 0 } },
    master: { mainFader: 75 },
    devices: { lap: { playing: true } },
  },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 오늘 할 일
    { say: '오늘은 손잡이 이름 말고, 잘 쓰는 요령을 익혀요. 한 시간 뒤에 세미나가 시작된다고 쳐 볼까요?', focus: 'mixer' },
    { who: 'junior', say: '이름은 이제 좀 알겠는데요. 막상 행사라니까 뭐부터 만질지 모르겠어요.' },

    // 헤드폰 + PFL: 객석 몰래 먼저 듣기
    { say: '손님이 들어오기 전에 마이크 소리를 내 귀로 먼저 들어 봐야 해요. 그래서 엔지니어 목엔 늘 이게 걸려 있죠.', show: { photo: 'headphones' }, op: 'place', device: 'hp' },
    { say: '헤드폰은 믹서 PHONES 단자에 꽂아요. 굵은 6.3mm 잭이라 TRS 케이블이 맞고요.', op: 'connect', from: 'mixer.phones', to: 'hp.plug', cable: 'trs', practice: 'TRS 케이블로 믹서 PHONES와 헤드폰을 이어 보세요.' },
    { say: '강연자님, 리허설 한번 부탁드려요!', focus: 'mic', op: 'talk', on: true },
    { who: 'junior', say: '어, 강연자님은 말씀하시는데 스피커가 조용해요. 또 뭘 빼먹었어요?' },
    { say: '객석으로 내보내는 페이더는 일부러 내려 뒀어요. 대신 PFL, 그 채널만 헤드폰으로 미리 듣는 버튼을 눌러 봐요.', focus: 'mixer', show: { concept: 'strip', focus: 'pfl' }, op: 'ch', ch: 1, key: 'pfl', value: true, practice: '믹서 콘솔에서 CH 1의 PFL 버튼을 눌러 보세요.' },
    { say: '화면 아래 귀 모양 옆에서 헤드폰을 골라 봐요. 이제부터 들리는 건 내 헤드폰 소리예요.' },

    // 게인 스테이징: 미터로 맞추고, 클리핑은 헤드폰에서만
    { say: '거의 안 들리죠? 맨 위 손잡이 GAIN, 마이크의 작은 소리를 처음 키우는 곳이 0이라서 그래요.', show: { concept: 'gain' } },
    { say: '눈금 숫자 말고 미터를 보면서 올려요. 말할 때 흰 칸, -20에서 -6 사이를 오가면 딱 좋아요.', op: 'ch', ch: 1, key: 'gain', value: 30, practice: '미터를 보며 CH 1 GAIN을 30 근처로 올려 보세요.' },
    { who: 'junior', say: '이제 잘 들려요. 근데 GAIN을 아예 끝까지 올리면 더 또렷하지 않을까요?' },
    { say: '궁금하면 들어 봐야죠. 헤드폰에 귀 기울여 봐요, 제가 GAIN을 확 올려 볼게요.', op: 'ch', ch: 1, key: 'gain', value: 52 },
    { who: 'junior', say: '으, 지글지글 깨져요. 미터 꼭대기에 빨간불도 켜졌고요.' },
    { say: '그게 클리핑이에요. 손님 앞이었으면 바로 사고니까, GAIN은 얼른 30으로 돌려놔요.', op: 'ch', ch: 1, key: 'gain', value: 30 },
    { quiz: { q: '말할 때마다 채널 미터 꼭대기에 빨간불이 들어와요. 어떻게 할까요?', options: ['GAIN을 내린다', '그 채널 페이더를 내린다', 'STEREO 페이더를 내린다'], answer: 0, explain: '빨간불은 입구에서 이미 넘쳤다는 뜻이에요. 뒤에 있는 페이더를 내리면 깨진 소리가 작아질 뿐이죠.' } },

    // 말소리엔 LOW CUT
    { who: 'junior', say: '근데 말 사이사이에 퍽, 퍽 하는 소리가 섞여요.' },
    { say: '숨이 마이크에 부딪히는 소리예요. 낮은 쿵, 웅을 잘라 내는 LOW CUT, 이 믹서엔 HPF라고 써 있는 버튼을 켜요.', show: { concept: 'strip', focus: 'lowcut' }, op: 'ch', ch: 1, key: 'lowCut', value: true, practice: 'CH 1의 HPF 버튼을 눌러 켜 보세요.' },
    { who: 'junior', say: '켰는데도 아직 조금 퍽퍽거려요.' },
    { say: '지금은 40Hz부터 잘리고 있어서 그래요. 버튼 옆 CUT Hz를 조금씩 올려 봐요. 퍽 소리가 사라지는 데서 멈추면 돼요.', op: 'ch', ch: 1, key: 'lowCutFreq', value: 120, practice: 'CH 1의 CUT Hz를 천천히 올려 120Hz 근처에서 멈춰 보세요.' },
    { who: 'junior', say: '사라졌어요! 그럼 아예 끝까지 올리면 더 깨끗해지겠네요?' },
    { say: '한번 들어 볼까요? 300Hz까지 올려 볼게요.', op: 'ch', ch: 1, key: 'lowCutFreq', value: 300 },
    { who: 'junior', say: '어, 목소리가 전화기처럼 얇아졌어요.' },
    { say: '목소리 몸통까지 잘려 나간 거예요. 말소리는 보통 80에서 150Hz 사이, 퍽이 없어지는 가장 낮은 곳이 정답이에요.', op: 'ch', ch: 1, key: 'lowCutFreq', value: 120 },
    { quiz: { q: 'LOW CUT 주파수는 어떻게 맞출까요?', options: ['퍽 소리가 사라지는 가장 낮은 곳까지 조금씩 올린다', '무조건 끝까지 올린다', '켜기만 하고 손대지 않는다'], answer: 0, explain: '너무 높이면 목소리가 얇아지고, 너무 낮으면 웅웅거림이 남아요. 들으면서 조금씩 올리는 게 요령이에요.' } },

    // 다 듣고 나서 페이더 열기
    { say: '귀로 다 확인했으니 이제 객석에 내보내요. 맨 아래 페이더를 0 눈금까지 올려 볼까요?', op: 'ch', ch: 1, key: 'fader', value: 75, practice: 'CH 1 페이더를 0 눈금까지 올려 보세요.' },
    { say: 'PFL은 다시 끄고, 귀 모양 옆에서 객석 스피커로 돌려 봐요. 헤드폰에서 듣던 그 소리 그대로죠?', op: 'ch', ch: 1, key: 'pfl', value: false },
    { quiz: { q: '손님이 다 앉았는데, 방금 꽂은 마이크 GAIN을 아직 못 맞췄어요. 어떻게 할까요?', options: ['페이더는 내린 채 PFL로 듣고 맞춘다', '페이더를 올리고 다 같이 들으며 맞춘다', 'GAIN을 끝까지 올리고 페이더로 줄인다'], answer: 0, explain: 'PFL은 페이더 앞에서 듣는 거라 페이더가 바닥이어도 들려요. 몰래 맞추고 나서 올리면 되죠.' } },

    // EQ는 깎는 게 먼저
    { who: 'junior', say: '선배, 목소리가 좀 먹먹해요. HIGH를 확 올리면 시원해지죠?' },
    { say: '올리기 전에 깎을 데부터 찾아요. 먹먹한 건 대개 목소리 몸통인 MID가 넘쳐서 그렇거든요.', show: { concept: 'strip', focus: 'mid' }, op: 'ch', ch: 1, key: 'eqMid', value: -4, practice: 'CH 1 MID를 왼쪽으로 조금, -4 근처까지 돌려 보세요.' },
    { say: '조금 돌렸을 뿐인데 맑아졌죠? 실습실에서 조금 깎을 때랑 조금 올릴 때를 번갈아 들어 봐요.', lab: { lab: 'eq', goal: '손잡이 하나를 조금 깎았을 때와 같은 만큼 올렸을 때를 번갈아 들어 보세요.' } },
    { quiz: { q: '강연자 목소리가 귀를 찌르게 쨍해요. 먼저 해 볼 것은?', options: ['HIGH를 살짝 깎는다', 'LOW를 크게 올려서 덮는다', 'GAIN을 끝까지 내린다'], answer: 0, explain: '거슬리는 쪽을 조금 깎는 게 먼저예요. 다른 데를 올려 덮으면 전체가 커져서 하울링만 가까워지죠.' } },

    // ON 버튼과 페이더: 강연자 마이크 잠깐 끄기
    { who: 'junior', say: '선배, 쉬는 시간인데 강연자님이 마이크 앞에서 전화를 받으세요! 페이더 내릴까요?' },
    { say: '페이더를 내리면 아까 맞춘 자리를 잃어버려요. 이럴 땐 그 채널만 끄는 ON 버튼, 불을 꺼 봐요.', show: { concept: 'strip', focus: 'mute' }, op: 'ch', ch: 1, key: 'mute', value: true, practice: 'CH 1의 ON 버튼을 눌러 불을 꺼 보세요.' },
    { who: 'junior', say: '통화 끝나서 다시 켜니까 아까 크기 그대로예요. 켜고 끄는 건 ON, 크기는 페이더네요.', op: 'ch', ch: 1, key: 'mute', value: false },

    // 노트북 BGM: LINE, 스테레오 채널, GAIN은 낮게
    { who: 'junior', say: '쉬는 시간엔 음악을 깔아 달래요. 노트북은 어디에 꽂아요?', op: 'talk', on: false },
    { say: '노트북 소리는 마이크보다 훨씬 커요. 그래서 MIC 구멍 말고, 큰 소리를 받는 LINE 쪽 9/10 스테레오 채널로 받아요.', show: { items: [{ concept: 'levels', label: '마이크 소리와 라인 소리' }, { model: 'laptop', label: 'BGM 노트북' }] }, op: 'place', device: 'lap' },
    { say: '3.5mm 변환 케이블로 노트북 이어폰 구멍과 9/10 L/MONO 단자를 이어요. 한쪽만 꽂아도 양쪽 스피커로 나가요.', show: { photo: 'conn_mini' }, op: 'connect', from: 'lap.out', to: 'mixer.st9L', cable: 'mini', practice: '3.5mm 케이블로 노트북과 믹서 9/10 L/MONO를 이어 보세요.' },
    { say: 'GAIN은 마이크만큼 안 올려도 돼요. 20쯤만 돼도 미터가 흰 칸에 들어오죠?', op: 'ch', ch: 9, key: 'gain', value: 20, practice: '9/10 채널 GAIN을 20 근처로 맞춰 보세요.' },
    { say: '아, 노트북 알림은 꼭 꺼 두세요. 지난달 행사에선 메신저 알림음이 객석 전체에 울려 퍼졌거든요.' },

    // 페이드 인 · 아웃
    { say: '음악은 페이더를 툭 올리지 않아요. 2, 3초에 걸쳐 스르르 올리는 걸 페이드 인이라고 하죠.', focus: 'mixer', op: 'fade', ch: 9, to: 75, ms: 3000 },
    { say: '슬며시 깔리니까 하나도 안 어색하죠? 실습실에서 뚝 끊는 컷이랑 나란히 들어 볼까요?', lab: { lab: 'fade', goal: 'CUT 끄기와 페이드 아웃을 번갈아 들어 보고, 페이더를 손으로 3초쯤 걸려 내려 보세요.' } },
    { say: '강연자님이 다시 나오세요. 음악을 3초쯤 걸려 내려 봐요, 끝으로 갈수록 더 천천히요.', op: 'fade', ch: 9, to: 0, ms: 3500, practice: '9/10 채널 페이더를 3초쯤 걸려 맨 아래까지 내려 보세요.' },
    { quiz: { q: '강연자가 무대로 걸어 나와요. 흐르던 BGM은 어떻게 끌까요?', options: ['2~3초에 걸쳐 페이드 아웃한다', '9/10 채널 ON 버튼을 바로 끈다', 'STEREO 페이더를 한 번에 내린다'], answer: 0, explain: '뚝 끊으면 사고처럼 들려요. 그리고 STEREO를 내리면 강연자 마이크까지 같이 꺼지죠.' } },

    // 하울링: 일부러 만들어 보고 잡기
    { who: 'junior', say: '강연자님이 마이크로 부탁하시네요. 자기 목소리가 잘 안 들린다고 스피커를 앞에 놔 달래요.', op: 'talk', on: true },
    { say: '그 부탁이 왜 위험한지 직접 들어 볼까요? 스피커를 마이크 정면으로 옮겨 봐요.', focus: 'pa', op: 'move', device: 'pa', slot: 'pa_alt' },
    { say: '목소리가 작은 분이라 치고 GAIN도 40까지 올려 보면요?', focus: 'mixer', op: 'ch', ch: 1, key: 'gain', value: 40 },
    { who: 'junior', say: '삐이익! 귀 아파요, 이게 말로만 듣던 하울링이에요?' },
    { say: '맞아요, 스피커 소리가 마이크로 다시 들어가 돌고 돌며 커지는 거죠. 급할 땐 GAIN부터 내려요.', show: { concept: 'feedback' }, op: 'ch', ch: 1, key: 'gain', value: 30, practice: 'CH 1 GAIN을 30 근처로 얼른 내려 보세요.' },
    { say: '멎긴 했지만 목소리도 작아졌죠? 진짜 해결은 스피커를 마이크보다 앞, 청중 쪽으로 빼는 거예요.', focus: 'pa', op: 'move', device: 'pa', slot: 'pa_main', practice: '스피커를 클릭하고 메인 스피커 자리로 옮겨 보세요.' },
    { say: '이 자리에선 GAIN을 36까지 올려도 조용하죠? 강연자님 귀엔 발밑 무대 모니터로 따로 들려 드리면 돼요.', show: { photo: 'monitor_wedge' }, focus: 'mixer', op: 'ch', ch: 1, key: 'gain', value: 36 },
    { quiz: { q: '강연자가 자기 목소리가 안 들린다며 스피커를 앞에 놔 달래요. 어떻게 할까요?', options: ['스피커는 마이크보다 앞에 두고, 모니터를 따로 놓는다', '부탁대로 스피커를 마이크 정면에 놓는다', '스피커는 그대로, GAIN만 끝까지 올린다'], answer: 0, explain: '스피커가 마이크를 보고 있으면 금방 삐 소리가 나요. 강연자 귀에는 발밑 모니터로 따로 들려 드리면 되죠.' } },

    { say: '믹서 실전은 여기까지예요. 다음 파트에선 그 무대 모니터랑 스피커를 직접 세워 봐요.', op: 'talk', on: false },
  ],
};
