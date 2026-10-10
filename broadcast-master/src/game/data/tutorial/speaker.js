/* 튜토리얼 파트 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 파트 5 · 스피커와 모니터 (공연장). 메인 PA와 모니터 구분 → 액티브 vs 패시브 → 파워 앰프 배치·연결(스피콘)
 * → 전원 순서와 팝 노이즈 → 스피커는 마이크보다 객석 쪽 → 웨지 모니터와 AUX(프리 페이더), 모니터 하울링
 * → 인이어(AUX 2 → 스네이크 리턴 2 → IEM, 채널 맞추기) → 인이어 믹스는 여분 벨트팩, 채널 하나는 헤드폰+PFL → 현장 소리와 방송 소리.
 * 보컬 마이크는 스네이크(박스 IN 1 → 팬아웃 OUT 1 → 믹서 CH1)로 미리 연결, 웨지도 리턴 1로 미리 연결해 둔다 (파트 3에서 해 봤다).
 * 메인은 패시브 스피커 두 대뿐이라 앰프를 놓고 켜기 전까지는 객석이 조용하다. 앰프·웨지 전원은 꺼 둔 채로 시작 (전원 순서 실습).
 * 팝 체험: 앰프를 켠 뒤 깜빡한 오른쪽 입력(STEREO OUT R → INPUT B)을 켜진 채로 꽂는다.
 * 팝 판정은 켜진 앰프·웨지 앞쪽(믹서 포함)에 선을 꽂으면 무조건 "퍽"이라, 인이어(AUX 2 → RETURN 2 → 송신기)와 헤드폰은
 * 처음부터 꽂아 둔다. 인이어 실습은 AUX 2 올리기와 벨트팩 채널 맞추기. CH1 GAIN 34: AUX 100에서 웨지 하울링이 확실히 나는 값.
 * 1번 AUX·AUX 2는 0, IEM은 송신기 3번 / 벨트팩 1번으로 어긋나 있다. */
export default {
  id: 'tut-speaker', venue: 'live_stage', title: '파트 5 · 스피커와 모니터',
  summary: '객석용 메인 스피커와 무대 모니터. 파워 앰프와 패시브 스피커, 전원 켜는 순서, 웨지와 인이어, 헤드폰으로 확인하기까지.',
  mission: '파워 앰프로 패시브 스피커를 울리고, 보컬에게 웨지와 인이어로 따로 섞은 소리를 보내 봅니다.',
  devices: [
    { id: 'vmic', type: 'dynamic_mic', slot: 'vocal_mic', name: '보컬 마이크' },
    { id: 'box', type: 'stage_box', slot: 'stagebox', name: '스테이지 박스' },
    { id: 'fan', type: 'snake_fanout', slot: 'fanout', name: '스네이크 팬아웃' },
    { id: 'mixer', type: 'analog_mixer', slot: 'foh1', name: '아날로그 믹서' },
    { id: 'pspkL', type: 'passive_speaker', slot: 'pa_left', name: '왼쪽 메인 스피커 (패시브)' },
    { id: 'pspkR', type: 'passive_speaker', slot: 'pa_right', name: '오른쪽 메인 스피커 (패시브)' },
    { id: 'amp', type: 'power_amp', slot: 'amp_rack', placed: false, name: '파워 앰프' },
    { id: 'wedge', type: 'monitor', slot: 'wedge_vocal', name: '보컬 웨지 모니터' },
    { id: 'iem', type: 'iem', slot: 'iem_rack', name: '인이어 송신기' },
    { id: 'hp', type: 'headphones', slot: 'foh2', name: '모니터 헤드폰' },
  ],
  connections: [
    { from: 'vmic.out', to: 'box.in1', cable: 'xlr' },
    { from: 'box.multi', to: 'fan.multi', cable: 'multi' },
    { from: 'fan.out1', to: 'mixer.in1', cable: 'xlr' },
    { from: 'mixer.aux1', to: 'fan.ret1', cable: 'trs' },
    { from: 'box.ret1', to: 'wedge.in', cable: 'xlr' },
    { from: 'mixer.aux2', to: 'fan.ret2', cable: 'trs' },
    { from: 'box.ret2', to: 'iem.in', cable: 'xlr' },
    { from: 'mixer.phones', to: 'hp.plug', cable: 'trs' },
  ],
  inventory: { xlr: 2, speakon: 2 },
  state: {
    channels: { 1: { gain: 34, fader: 75, aux: 0, aux2: 0 } },
    master: { mainFader: 75 },
    devices: { amp: { power: false }, wedge: { power: false }, iem: { power: true, txChannel: 3, rxChannel: 1 } },
  },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 오늘 할 일 · 메인과 모니터
    { say: '오늘은 소리가 나가는 끝, 스피커예요. 객석으로 가는 소리랑 연주자한테 가는 소리를 따로 챙겨 볼 거예요.' },
    { who: 'junior', say: '스피커는 그냥 다 똑같은 스피커 아니에요?' },
    { say: '듣는 사람이 달라요. 객석을 보는 큰 스피커는 메인 PA, 연주자 발밑에서 위를 보는 건 모니터죠.', show: { items: [{ photo: 'speaker_active', label: '메인 PA · 관객용' }, { photo: 'monitor_wedge', label: '모니터 · 연주자용' }] } },

    // 액티브 vs 패시브 · 파워 앰프
    { say: '메인 PA도 두 종류예요. 액티브는 통 안에 앰프가 들어 있고, 패시브는 앰프가 없어요.', show: { items: [{ photo: 'speaker_active', label: '액티브 · 앰프 내장' }, { photo: 'speaker_passive', label: '패시브 · 앰프 없음' }] } },
    { who: 'junior', say: '앰프요? 기타 앰프 같은 거요?' },
    { say: '비슷해요. 믹서에서 나오는 신호는 스피커를 흔들기엔 너무 약하거든요. 그걸 힘센 전기로 키우는 게 파워 앰프예요.', show: { photo: 'power_amp' } },
    { who: 'junior', say: '그럼 앰프 든 액티브가 훨씬 편하잖아요. 패시브는 왜 써요?', focus: 'pspkL' },
    { say: '통이 가볍고 고장 날 부품이 적거든요. 큰 공연장은 앰프를 랙에 모아 한곳에서 관리하고요. 오늘 양옆 스피커가 패시브예요.' },

    // 앰프 배치 · 연결
    { say: '앰프부터 놓아 볼까요? 무대 옆 랙 자리예요. 전원은 일부러 꺼 둔 채로 둘 거예요.', op: 'place', device: 'amp', practice: '무대 옆의 + 파워 앰프 배치를 눌러 보세요.' },
    { say: '믹서 STEREO OUT, 파트 1에서 본 전체 소리의 출구죠? L을 앰프 INPUT A에 XLR로 꽂아요.', focus: 'amp', op: 'connect', from: 'mixer.main', to: 'amp.inA', cable: 'xlr', practice: 'XLR로 믹서 STEREO OUT L과 앰프 INPUT A를 이어 보세요.' },
    { say: '앰프에서 스피커로는 스피콘을 써요. 마이크 선과는 비교도 안 되는 큰 전기가 흘러서, 꽂고 돌리면 딸깍 잠겨요.', show: { photo: 'conn_speakon' } },
    { say: 'A로 들어간 소리는 OUT A로 나와요. 앰프 OUT A에서 왼쪽 스피커로 이어 볼까요?', op: 'connect', from: 'amp.spkA', to: 'pspkL.spk', cable: 'speakon', practice: '스피콘 케이블로 앰프 OUT A와 왼쪽 스피커를 이어 보세요.' },
    { say: 'OUT B는 오른쪽 스피커로 제가 이어 둘게요.', op: 'connect', from: 'amp.spkB', to: 'pspkR.spk', cable: 'speakon' },
    { quiz: { q: '패시브 스피커를 믹서 STEREO OUT에 바로 꽂으면 어떻게 될까요?', options: ['거의 안 들린다', '앰프 없이도 원래 크기로 난다', '더 깨끗하게 난다'], answer: 0, explain: '믹서 신호로는 스피커를 흔들 힘이 모자라서 아주 작게밖에 안 나요. 꼭 파워 앰프를 거쳐 스피콘으로 받아야 해요.' } },

    // 전원 순서 · 팝 노이즈
    { say: '보컬이 한 소절 불러 줄 거예요. 아래 듣는 곳에서 객석 스피커를 골라 들어 봐요.', focus: 'vmic', op: 'talk', on: true },
    { who: 'junior', say: '어, 조용한데요? 앰프가 꺼져 있어서 그런가요?' },
    { say: '맞아요. 켤 땐 믹서 같은 앞쪽부터 켜고 앰프는 맨 마지막, 끌 땐 거꾸로 앰프를 제일 먼저 꺼요. 이제 앰프 차례예요.', focus: 'amp', op: 'dev', device: 'amp', key: 'power', value: true, practice: '앰프를 클릭하고 전원을 켜 보세요.' },
    { who: 'junior', say: '나와요! 근데 왼쪽에서만 들리는 것 같은데요?' },
    { say: '오른쪽 입력을 빼먹었네요. 앰프가 켜진 채로 꽂으면 어떻게 되는지 같이 들어 봐요.', op: 'connect', from: 'mixer.mainR', to: 'amp.inB', cable: 'xlr', pop: true },
    { who: 'junior', say: '으, 퍽! 생각보다 훨씬 크네요.' },
    { say: '이런 퍽 한 번에 스피커 고음 유닛이 나가기도 해요. 선을 만질 땐 앰프부터 끄는 게 순서예요.' },
    { quiz: { q: '공연이 끝났어요. 장비를 끌 때 제일 먼저 끌 것은?', options: ['파워 앰프', '믹서', '마이크'], answer: 0, explain: '앰프는 마지막에 켜고 제일 먼저 꺼요. 그래야 다른 장비가 꺼지며 내는 퍽 소리가 스피커로 안 가요.' } },
    { say: '자리도 봐요. 메인 스피커가 마이크보다 객석 쪽에서 객석을 보고 있죠? 마이크의 둔감한 뒤쪽이 스피커를 향해서 하울링이 덜 나요.', focus: 'pspkR', show: { concept: 'feedback' } },

    // 웨지 모니터와 AUX
    { say: '보컬은 등 뒤 스피커 소리가 잘 안 들려요. 그래서 발밑에 웨지를 둬요. 웨지도 액티브라 전원은 마지막에 켜요.', focus: 'wedge', op: 'dev', device: 'wedge', key: 'power', value: true, practice: '웨지 모니터를 클릭하고 전원을 켜 보세요.' },
    { who: 'junior', say: '웨지로도 메인이랑 똑같은 소리를 보내면 되겠네요?' },
    { say: '연주자마다 듣고 싶은 게 달라요. 보컬은 자기 목소리, 드러머는 베이스를 원하죠. 그래서 AUX로 따로 섞어요.', show: { concept: 'strip', focus: 'aux' } },
    { say: '아래 듣는 곳에서 무대 모니터를 고르고, 1번 채널 AUX 1을 55쯤 돌려요. 무대로 따로 보내는 손잡이였죠?', focus: 'mixer', op: 'ch', ch: 1, key: 'aux', value: 55, practice: '믹서 콘솔에서 CH1 AUX1을 55 근처로 돌려 보세요.' },
    { who: 'junior', say: '웨지에서 목소리가 나와요!' },
    { say: '재밌는 거 하나 볼까요? 1번 페이더를 맨 아래로 내려 봐요.', op: 'ch', ch: 1, key: 'fader', value: 0, practice: 'CH1 페이더를 맨 아래로 내려 보세요.' },
    { say: '객석은 조용한데 웨지는 그대로죠? AUX는 페이더 앞에서 갈라지는 프리 페이더라서요. 페이더는 다시 올려 둘게요.', op: 'ch', ch: 1, key: 'fader', value: 75 },

    // 모니터 하울링 · 위치
    { who: 'junior', say: '보컬이 더 크게 해 달래요. 끝까지 올려 볼까요?' },
    { say: '한번 들어 봐요. 웨지는 마이크 바로 앞이라 조금만 과해도 울리거든요.', op: 'ch', ch: 1, key: 'aux', value: 100 },
    { say: '삐이 소리 들리죠? 얼른 55로 다시 내려요. 모니터 하울링은 연주자 귀 바로 앞이라 더 위험해요.', op: 'ch', ch: 1, key: 'aux', value: 55, practice: 'CH1 AUX1을 55 근처로 다시 내려 보세요.' },
    { say: '마이크의 둔감한 뒤쪽이 웨지를 향하게 놓아요. 지난주 공연에선 웨지 각도 하나 바꿨더니 하울링이 싹 잡혔어요.' },
    { quiz: { q: '보컬 웨지에서 하울링이 나요. 알맞은 대처는?', options: ['그 채널 AUX 1을 줄이고, 마이크 뒤쪽이 웨지를 향하게 한다', 'STEREO 페이더를 내린다', '웨지를 마이크 정면에 바짝 붙인다'], answer: 0, explain: '웨지로 가는 양은 AUX 1이 정해요. STEREO 페이더는 웨지랑 상관없고요. 마이크가 덜 받는 뒤쪽이 웨지를 향하면 더 좋죠.' } },

    // 인이어 모니터
    { who: 'junior', say: '요즘 가수들은 귀에 이어폰 같은 걸 끼던데요. 그것도 모니터예요?', op: 'talk', on: false },
    { say: '인이어예요. 송신기가 전파로 쏘면 허리에 찬 벨트팩이 받아서 이어폰으로 들려줘요. 무대가 조용해지고 하울링 걱정도 거의 없죠.', show: { photo: 'iem' } },
    { say: '송신기는 무대 옆에 있어요. AUX SEND 2에서 스네이크 RETURN 2를 타고 가죠. 비교하려고 웨지 AUX는 0으로 뺄게요.', focus: 'iem', op: 'ch', ch: 1, key: 'aux', value: 0 },
    { who: 'junior', say: 'AUX가 두 개였군요. 웨지는 1번, 인이어는 2번이요?' },
    { say: '맞아요. 1번 채널 AUX 2를 60쯤 돌려요. 웨지로 가는 AUX랑은 따로 노는 손잡이예요.', focus: 'mixer', op: 'ch', ch: 1, key: 'aux2', value: 60, practice: '믹서 콘솔에서 CH1 AUX2를 60 근처로 돌려 보세요.' },
    { say: '보컬이 불러 줄 거예요. 계속 무대 모니터로 들어 봐요.', focus: 'vmic', op: 'talk', on: true },
    { who: 'junior', say: '어, 아무것도 안 들려요. 선은 다 맞는데요?' },
    { say: '송신기는 3번인데 벨트팩은 1번이죠? 무선 마이크랑 똑같아요. 벨트팩을 3번으로 맞춰요.', focus: 'iem', op: 'dev', device: 'iem', key: 'rxChannel', value: 3, practice: '송신기를 클릭하고 벨트팩 채널을 3으로 맞춰 보세요.' },
    { who: 'junior', say: '들려요! 보컬 목소리만 깔끔하게요.' },
    { quiz: { q: '인이어가 웨지보다 좋은 점이 아닌 것은?', options: ['객석 스피커 소리가 커진다', '무대가 조용해진다', '하울링 걱정이 거의 없다'], answer: 0, explain: '인이어는 연주자 귀에만 들리는 모니터예요. 객석 소리랑은 상관없어요.' } },

    // 엔지니어가 확인하기: 인이어 믹스는 여분 벨트팩, 채널 하나는 헤드폰 + PFL
    { who: 'junior', say: '근데 보컬이 듣는 인이어 소리는 어떻게 확인해요? 무대까지 가 볼 수도 없잖아요.' },
    { say: '여분 벨트팩을 같은 3번 채널로 맞춰 차고 들어요. 보컬이 듣는 인이어 믹스가 그대로 들리거든요.', focus: 'iem' },
    { who: 'junior', say: '그럼 보컬 목소리 하나만 따로 들어 볼 땐요?' },
    { say: '그땐 헤드폰이에요. 귀를 꽉 덮는 밀폐형이라 시끄러운 객석에서도 잘 들리죠. 믹서 PHONES에 미리 꽂아 뒀어요.', focus: 'hp', show: { photo: 'headphones' } },
    { say: '1번 PFL을 눌러요. 그 채널만 헤드폰으로 미리 듣는 버튼이었죠? 아래 듣는 곳은 헤드폰으로요.', show: { concept: 'strip', focus: 'pfl' }, op: 'ch', ch: 1, key: 'pfl', value: true, practice: '믹서 콘솔에서 CH1 PFL을 눌러 보세요.' },
    { who: 'junior', say: '목소리만 또렷해요. 객석 스피커로 들을 때랑 느낌이 다르네요.' },
    { say: '객석에선 방 울림이 섞이니까요. 방송 소리는 또 달라서, 방송 파트에서 A/B 비교 버튼으로 나란히 들어 볼 거예요.', op: 'talk', on: false },
    { say: '스피커랑 모니터는 여기까지예요. 다음 파트에선 드럼이랑 기타 같은 악기 소리를 받아 봐요.' },
  ],
};
