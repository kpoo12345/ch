/* 튜토리얼 파트 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 파트 2 · 마이크 (교회 예배당). 다이나믹 → 콘덴서와 +48V → 무선(채널·배터리·안테나) → 사진으로 보는 마이크들 → 지향성·잡는 법.
 * 메인 스피커는 미리 연결. 2·3번 채널은 GAIN·페이더를 미리 맞춰 둬서 "소리가 안 나는" 이유가 팬텀·무선 채널뿐이게 한다.
 * 말하기(talk)는 모든 마이크에 한꺼번에 걸리므로, 다음 마이크를 들어 보기 전에 앞 채널을 ON 버튼으로 꺼 둔다. */
export default {
  id: 'tut-mic', venue: 'church', title: '파트 2 · 마이크',
  summary: '다이나믹과 콘덴서, +48V 팬텀 전원, 무선 마이크 채널과 배터리, 마이크 잡는 법까지.',
  mission: '예배당에 종류가 다른 마이크 세 개를 하나씩 이어서 소리를 내 봅니다.',
  devices: [
    { id: 'pulpit', type: 'dynamic_mic', slot: 'pulpit_mic', placed: false, name: '강대상 마이크' },
    { id: 'choir', type: 'condenser_mic', slot: 'choir_mic', name: '성가대 마이크' },
    { id: 'rx', type: 'wireless_mic', slot: 'foh2', name: '무선 마이크 수신기' },
    { id: 'mixer', type: 'analog_mixer', slot: 'foh1', name: '아날로그 믹서' },
    { id: 'paL', type: 'speaker', slot: 'pa_left', name: '왼쪽 메인 스피커' },
    { id: 'paR', type: 'speaker', slot: 'pa_right', name: '오른쪽 메인 스피커' },
  ],
  connections: [
    { from: 'mixer.main', to: 'paL.in', cable: 'xlr' },
    { from: 'mixer.mainR', to: 'paR.in', cable: 'xlr' },
  ],
  inventory: { xlr: 4 },
  state: {
    channels: { 1: { gain: 0, fader: 75 }, 2: { gain: 30, fader: 75 }, 3: { gain: 30, fader: 75 } },
    master: { mainFader: 75, phantom: false },
    devices: { rx: { txPower: true, txChannel: 4, rxChannel: 2, battery: 20 } },
  },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 오늘 할 일 · 마이크가 하는 일
    { say: '여긴 예배당이에요. 종류가 다른 마이크 세 개를 하나씩 세워 보면서 마이크만 파 볼게요.' },
    { who: 'junior', say: '마이크가 소리를 크게 키워 주는 거 아니었어요?' },
    { say: '키우는 건 믹서랑 스피커 일이에요. 마이크는 공기의 떨림을 전기 신호로 바꿔 줄 뿐이죠.', show: { concept: 'flow' } },

    // 다이나믹: 배치 → 연결 → GAIN → 말하기 → ON으로 끄기
    { say: '제일 흔한 게 이 다이나믹이에요. 안에 든 코일이랑 자석이 떨림을 바로 전기로 바꾸거든요.', show: { photo: 'mic_dynamic' } },
    { who: 'junior', say: '노래방 마이크랑 똑같이 생겼네요. 이것도 건전지 넣어요?' },
    { say: '전원이 아예 필요 없어요. 떨어뜨려도 끄떡없고요. 강대상에 하나 세워 볼까요?', op: 'place', device: 'pulpit', practice: '강대상의 + 강대상 마이크 배치를 눌러 보세요.' },
    { say: 'XLR 선으로 믹서 1번 채널 MIC 단자에 꽂아요. 구멍 세 개 뚫린 동그란 단자예요.', op: 'connect', from: 'pulpit.out', to: 'mixer.in1', cable: 'xlr', practice: 'XLR을 고르고 마이크 OUT, 믹서 CH1 MIC를 눌러 보세요.' },
    { say: '1번 GAIN이 아직 바닥이네요. 맨 위 빨간 손잡이, 마이크 소리를 처음 키우는 곳이었죠? 30쯤 올려요.', show: { concept: 'strip', focus: 'gain' }, op: 'ch', ch: 1, key: 'gain', value: 30, practice: '믹서 콘솔에서 CH1 GAIN을 30 근처로 올려 보세요.' },
    { say: '목사님이 한마디 하실 거예요. 1번 미터가 움직이는지 같이 봐요.', focus: 'pulpit', op: 'talk', on: true },
    { who: 'junior', say: '또렷하게 잘 들려요. 전기도 안 넣었는데 신기하네요.' },
    { say: '다음 마이크를 들으려면 1번은 잠깐 쉬게 해요. ON 버튼, 불을 끄면 그 채널만 조용해지는 버튼이었죠?', op: 'ch', ch: 1, key: 'mute', value: true, practice: 'CH1 ON 버튼을 눌러 불을 꺼 보세요.' },

    // 콘덴서: 소리가 안 난다 → +48V (성가대는 계속 부르고, 고치는 순간 소리가 들어온다)
    { say: '성가대는 여럿이 좀 떨어져서 부르잖아요. 그래서 저기엔 더 예민한 콘덴서를 세워 뒀어요.', focus: 'choir', show: { items: [{ photo: 'mic_dynamic', label: '다이나믹 · 튼튼함' }, { photo: 'mic_condenser', label: '콘덴서 · 예민함' }] }, op: 'talk', on: false },
    { who: 'junior', say: '아, 그럼 콘덴서가 더 좋은 마이크예요?' },
    { say: '좋다기보다 쓰는 데가 달라요. 작은 소리를 잘 잡는 대신 주변 소리도 같이 잡거든요.' },
    { say: '2번 채널 MIC에 꽂아요. 2번 GAIN이랑 페이더는 제가 미리 맞춰 놨어요.', op: 'connect', from: 'choir.out', to: 'mixer.in2', cable: 'xlr', practice: 'XLR로 성가대 마이크와 믹서 CH2 MIC를 이어 보세요.' },
    { say: '성가대가 연습 삼아 계속 불러 줄 거예요. 2번 미터 보세요.', op: 'talk', on: true },
    { who: 'junior', say: '어? 2번 미터가 꿈쩍도 안 해요. 선이 불량인가요?' },
    { say: '선은 멀쩡해요. 콘덴서는 안에 작은 회로가 있어서, 믹서가 선으로 보내 주는 팬텀 전원을 받아야 일을 하거든요.', show: { photo: 'mixer_phantom' } },
    { say: '켜기 전에 2번 페이더부터 내려요. 켜는 순간 퍽 소리가 스피커로 튈 수 있어서요.', op: 'ch', ch: 2, key: 'fader', value: 0, practice: 'CH2 페이더를 맨 아래로 내려 보세요.' },
    { say: '이제 +48V를 눌러요. 이 믹서는 버튼 하나로 MIC 단자 전부에 전기가 가요.', op: 'master', key: 'phantom', value: true, practice: '믹서 콘솔에서 +48V 버튼을 켜 보세요.' },
    { who: 'junior', say: '잠깐만요, 그럼 1번 다이나믹도 전기를 받잖아요. 괜찮아요?' },
    { say: '다이나믹은 그 전기를 그냥 무시해요. 걱정 말고 2번 페이더를 천천히 올려 볼까요?', op: 'ch', ch: 2, key: 'fader', value: 75, practice: 'CH2 페이더를 0 눈금까지 다시 올려 보세요.' },
    { who: 'junior', say: '와, 숨소리까지 들려요. 다이나믹이랑 느낌이 확 다르네요.' },

    // 예민한 만큼 하울링에 약하다: 부르는 동안 GAIN을 올려 직접 듣고, ON 버튼으로 급히 끈다
    { say: '예민한 만큼 조심할 것도 있어요. 부르는 동안 2번 GAIN을 40까지만 올려 볼게요.', op: 'ch', ch: 2, key: 'gain', value: 40 },
    { who: 'junior', say: '으악, 삐 소리! 이게 말로만 듣던 하울링이에요?' },
    { say: '맞아요. 급하면 그 채널부터 꺼요. 2번 ON 버튼이요! 어느 채널인지 모를 땐 STEREO 페이더부터 내리고요.', op: 'ch', ch: 2, key: 'mute', value: true, practice: 'CH2 ON 버튼을 눌러 하울링을 멈춰 보세요.' },
    { say: '스피커 소리가 마이크로 되돌아가 계속 커진 거예요. 멈췄으면 원인을 잡아야죠. 올려 둔 GAIN을 30으로 내려요.', op: 'ch', ch: 2, key: 'gain', value: 30, practice: 'CH2 GAIN을 30 근처로 다시 내려 보세요.' },
    { quiz: { q: '성가대 콘덴서 마이크를 새로 꽂았는데 소리가 하나도 안 나요. 먼저 볼 곳은?', options: ['믹서의 +48V 버튼', '스피커 위치', 'EQ 손잡이'], answer: 0, explain: '콘덴서는 팬텀 전원이 없으면 아예 소리를 못 내요. 켜기 전에 페이더 내리는 것도 잊지 말고요.' } },

    // 무선: 송신기·수신기, 채널, 배터리, 안테나
    { who: 'junior', say: '찬양 인도자는 무대를 막 돌아다니던데요. 선을 끌고 다녀요?', op: 'talk', on: false },
    { say: '그래서 무선을 써요. 마이크가 소리를 전파로 쏘면, 수신기가 받아서 믹서로 넘겨 주죠.', show: { items: [{ photo: 'mic_wireless', label: '송신기 · 손에 드는 쪽' }, { photo: 'mic_wireless_rx', label: '수신기 · 믹서 옆' }] } },
    { say: '수신기는 믹서 옆에 놔뒀어요. 뒤쪽 출력 단자를 믹서 3번 MIC에 꽂아요.', focus: 'rx', op: 'connect', from: 'rx.af', to: 'mixer.in3', cable: 'xlr', practice: 'XLR로 수신기 AF OUT과 믹서 CH3 MIC를 이어 보세요.' },
    { say: '인도자가 말해 볼 거예요. 이번엔 3번 미터를 보세요.', op: 'talk', on: true },
    { who: 'junior', say: '이번에도 조용해요. 무선도 +48V를 켜야 하나요?' },
    { say: '무선은 팬텀이랑 상관없어요. 송신기는 4번인데 수신기는 2번이죠? 말하는 동안 4번으로 맞춰 볼게요.', focus: 'rx', op: 'dev', device: 'rx', key: 'rxChannel', value: 4 },
    { who: 'junior', say: '나와요! 숫자 하나 차이였네요.', op: 'talk', on: false },
    { say: '배터리도 봐야죠. 20%면 위험해요. 지난 부활절엔 축도 직전에 무선이 꺼졌거든요.', op: 'dev', device: 'rx', key: 'battery', value: 100, practice: '수신기를 클릭하고 새 배터리로 교체를 눌러 보세요.' },
    { say: '안테나는 무대가 보이게 세워 둬요. 벽이나 사람이 가로막으면 소리가 뚝뚝 끊겨요.' },
    { quiz: { q: '무선 마이크가 안 들려요. 수신기 화면에 채널 불일치가 떠 있다면?', options: ['수신기 채널을 송신기와 같게 맞춘다', '+48V를 켠다', 'GAIN을 끝까지 올린다'], answer: 0, explain: '라디오처럼 송신기랑 수신기 숫자가 같아야 서로 알아들어요. 팬텀은 무선이랑 상관없고요.' } },

    // 사진으로만: 핀마이크·헤드셋·구즈넥
    { say: '설교 때 옷깃에 다는 작은 건 핀마이크예요. 춤추며 부르는 찬양팀은 입 옆에 붙는 헤드셋을 쓰고요.', show: { items: [{ photo: 'mic_lavalier', label: '핀마이크' }, { photo: 'mic_headset', label: '헤드셋' }, { photo: 'mic_gooseneck', label: '구즈넥' }], caption: '강대상에 꽂는 목 긴 마이크는 구즈넥이에요' } },

    // 지향성 · 그릴 · 거리
    { who: 'junior', say: '마이크는 사방에서 오는 소리를 다 받아요?' },
    { say: '대부분 앞은 잘 받고 뒤는 덜 받는 카디오이드예요. 하트 모양으로 소리를 받는다고 붙은 이름이죠.', show: { concept: 'feedback' } },
    { say: '그래서 스피커는 마이크보다 객석 쪽에 두고 객석을 보게 해요. 마이크의 둔감한 뒤쪽이 스피커를 향하게요.', show: { concept: 'feedback' } },
    { who: 'junior', say: '가수들은 마이크를 입에 붙이고, 머리 쪽 동그란 그물을 손으로 꽉 감싸던데요. 멋있어 보였는데.' },
    { say: '그 그물이 그릴인데, 감싸면 뒤가 막혀 하울링이 나요. 바짝 붙이면 저음이 웅웅 커지고요. 주먹 하나 거리가 딱 좋아요.' },
    { quiz: { q: '찬양 인도자가 마이크 그릴을 손으로 감싸 쥐었어요. 무슨 일이 생기기 쉬울까요?', options: ['하울링이 잘 난다', '소리가 더 또렷해진다', '배터리가 빨리 닳는다'], answer: 0, explain: '그릴을 감싸면 뒤쪽이 막혀서 스피커 소리까지 다 받아요. 손잡이를 잡게 알려 주세요.' } },
    { say: '마이크 세 개 다 소리 냈네요! 다음엔 무대에서 믹서까지 이 선들을 어떻게 끌고 가는지 봐요.' },
  ],
};
