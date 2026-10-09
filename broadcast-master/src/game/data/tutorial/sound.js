/* 튜토리얼 파트 1 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 믹서를 처음 보는 사람 기준. 소리의 길(마이크 → 믹서 → 스피커)을 깔고,
 * 채널 한 줄의 손잡이를 위에서 아래로 하나씩 열어 보며 첫 소리를 낸다.
 * 시작 상태: CH1 GAIN·페이더, STEREO 페이더가 모두 0 → 문을 하나씩 열어야 소리가 난다. */
export default {
  id: 'tut-sound', venue: 'seminar', title: '파트 1 · 소리의 길과 믹서 첫걸음',
  summary: '마이크 → 믹서 → 스피커. 채널 한 줄의 GAIN, 페이더, STEREO, ON, EQ, LOW CUT, PAN을 하나씩 만져 봐요.',
  mission: '마이크와 스피커를 믹서에 잇고, 손잡이를 하나씩 열어 첫 소리를 내 봅니다.',
  devices: [
    { id: 'mic', type: 'dynamic_mic', slot: 'presenter_mic', placed: false, name: '다이나믹 마이크' },
    { id: 'mixer', type: 'analog_mixer', slot: 'desk1', placed: false, name: '아날로그 믹서' },
    { id: 'pa', type: 'speaker', slot: 'pa_main', placed: false, name: '메인 스피커' },
  ],
  connections: [], inventory: { xlr: 2 },
  state: { channels: { 1: { gain: 0, fader: 0 } }, master: { mainFader: 0 } },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 인사와 오늘 할 일
    { say: '반가워요, 서진이에요. 오늘은 소리가 마이크에서 스피커까지 가는 길을 따라가면서 믹서랑 친해져 봐요.' },
    { who: 'junior', say: '잘 부탁드려요! 저 믹서는 오늘 처음 봐요. 소리가 어디서 어디로 가는 거예요?' },
    { say: '마이크가 받은 소리는 믹서를 거쳐서 스피커로 나가요. 노래방 기계도 안을 열어 보면 이 길이에요.', show: { concept: 'flow' } },

    // 장비 놓기
    { say: '소리를 받는 건 이 다이나믹 마이크예요. 강연자 앞에 한번 세워 볼까요?', show: { photo: 'mic_dynamic' }, op: 'place', device: 'mic', practice: '발표자 자리의 + 다이나믹 마이크를 눌러 보세요.' },
    { say: '믹서랑 스피커는 제가 놓을게요. 믹서는 손이 닿는 책상 위가 좋죠.', show: { items: [{ photo: 'mixer_analog', label: '아날로그 믹서' }, { photo: 'speaker_active', label: '스피커' }], caption: '소리를 다듬는 곳, 내보내는 곳' }, op: 'place', device: 'mixer' },
    { say: '스피커는 강연자보다 앞에서 청중을 보게 세워요. 이 자리가 왜 중요한지는 나중에 귀로 확인해요.', op: 'place', device: 'pa' },

    // 선 잇기
    { say: '마이크 선은 XLR이에요. 소리는 늘 OUT에서 나와 IN으로 들어가니까, 마이크 OUT에서 믹서 1번 MIC 단자로요.', op: 'connect', from: 'mic.out', to: 'mixer.in1', cable: 'xlr', practice: 'XLR을 고르고 마이크 OUT, 믹서 CH1 MIC 단자를 차례로 눌러 보세요.' },
    { say: '나가는 길도 마찬가지예요. 믹서 STEREO OUT L에서 스피커 INPUT으로 이어 볼까요?', op: 'connect', from: 'mixer.main', to: 'pa.in', cable: 'xlr', practice: 'XLR로 믹서 STEREO OUT L과 스피커 INPUT을 이어 보세요.' },

    // 첫 소리… 가 안 난다
    { say: '강연자님, 마이크 테스트 한번 부탁드려요!', focus: 'mic', op: 'talk', on: true },
    { who: 'junior', say: '어? 다 꽂았는데 스피커가 조용해요. 제가 뭘 잘못 꽂았나요?' },
    { say: '선은 잘 꽂았어요. 믹서 세로줄 하나가 채널 하나인데, 소리는 맨 위로 들어와서 아래로 흘러가요.', focus: 'mixer', show: { concept: 'strip', focus: 'input' } },

    // GAIN
    { say: '맨 위 빨간 손잡이가 GAIN이에요. 마이크 소리는 워낙 작아서, 여기서 처음 키워 줘야 하거든요.', show: { concept: 'strip', focus: 'gain' } },
    { say: '강연자가 말하는 동안 미터를 보면서 올려요. -20에서 -6 사이를 오가면 딱 좋아요.', op: 'ch', ch: 1, key: 'gain', value: 30, practice: '믹서 콘솔에서 CH 1 GAIN을 30 근처로 올려 보세요.' },
    { who: 'junior', say: '미터는 움직이는데요, 소리는 아직 안 나와요.' },

    // FADER
    { say: 'GAIN은 안으로 들이는 양이라서 그래요. 내보내는 건 맨 아래 페이더 몫이고, 0이라고 쓴 눈금이 원래 크기예요.', show: { concept: 'strip', focus: 'fader' }, op: 'ch', ch: 1, key: 'fader', value: 75, practice: 'CH 1 페이더를 0 눈금까지 올려 보세요.' },

    // STEREO 마스터
    { say: '마지막 문이 하나 더 있어요. 오른쪽 끝 빨간 STEREO 페이더, 모든 채널이 모여서 나가는 출구죠.', show: { concept: 'strip', focus: 'master' }, op: 'master', key: 'mainFader', value: 75, practice: 'STEREO 페이더도 0 눈금까지 올려 보세요.' },
    { who: 'junior', say: '와, 들려요! 강연자 목소리가 스피커로 나와요.' },
    { quiz: { q: '채널 미터는 움직이는데 스피커는 조용해요. 어디부터 볼까요?', options: ['채널 페이더와 STEREO 페이더', 'GAIN', '마이크 케이블'], answer: 0, explain: '미터가 움직이면 소리는 GAIN까지 들어온 거예요. 그다음 문인 페이더들이 닫혀 있는 거죠.' } },

    // GAIN과 페이더는 뭐가 다를까 + 클리핑 맛보기 (페이더를 먼저 내려 두어 하울링 없이 찌그러짐만 들린다)
    { who: 'junior', say: '근데 선배, GAIN이랑 페이더요. 둘 다 결국 소리 크기 아니에요?' },
    { say: '수도꼭지로 치면 GAIN은 받는 꼭지, 페이더는 내보내는 꼭지예요. 내보내는 쪽을 먼저 좀 잠가 볼게요.', op: 'ch', ch: 1, key: 'fader', value: 50 },
    { say: '작아졌죠? 이번엔 받는 꼭지를 확 열어요. 크기는 아까랑 비슷해지죠?', op: 'ch', ch: 1, key: 'gain', value: 50 },
    { who: 'junior', say: '크기는 비슷한데 소리가 지글지글 깨져요. 미터에 빨간불도 들어왔고요.' },
    { say: '들어오다가 이미 넘친 거예요. 이게 클리핑인데, 페이더로는 못 살리고 GAIN부터 내려야 해요.', op: 'ch', ch: 1, key: 'gain', value: 30 },
    { op: 'ch', ch: 1, key: 'fader', value: 75 },

    // ON (MUTE)
    { who: 'junior', say: '강연자가 잠깐 기침하면요? 그땐 페이더를 쭉 내려요?' },
    { say: '그땐 이 버튼이 편해요. 이 믹서엔 ON이라고 써 있는데, 불을 끄면 페이더는 그대로 두고 그 채널만 꺼져요.', show: { concept: 'strip', focus: 'mute' }, op: 'ch', ch: 1, key: 'mute', value: true, practice: 'CH 1의 ON 버튼을 눌러 불을 꺼 보세요.' },
    { say: '다시 켜면 아까 크기 그대로죠? 지난주 결혼식에선 이걸 깜빡해서 사회자 혼잣말이 하객들한테 다 나갔어요.', op: 'ch', ch: 1, key: 'mute', value: false },

    // EQ
    { say: '이번엔 GAIN 밑에 모여 있는 손잡이들이에요. 크기 말고 소리 색깔을 바꾸는 EQ죠.', op: 'talk', on: false },
    { who: 'junior', say: '소리에도 색깔이 있어요?' },
    { say: '직접 들어 봐요. 강연자님이 계속 말씀하실 테니까, 돌리면서 목소리가 어떻게 바뀌는지 들어 보세요.', op: 'talk', on: true },
    { say: '그럼요. HIGH는 반짝이는 쪽이라 올리면 또렷해지는데, 너무 올리면 스, 츠 소리가 귀를 찔러요.', show: { concept: 'strip', focus: 'high' }, op: 'ch', ch: 1, key: 'eqHigh', value: 6, practice: 'CH 1 HIGH를 오른쪽으로 +6 근처까지 돌려 보세요.' },
    { say: 'MID는 목소리의 몸통이에요. 코 막힌 것처럼 답답하게 들리면 여기를 살짝 깎아요.', show: { concept: 'strip', focus: 'mid' }, op: 'ch', ch: 1, key: 'eqMid', value: -6, practice: 'CH 1 MID를 왼쪽으로 -6 근처까지 돌려 보세요.' },
    { say: 'LOW는 두께예요. 올리면 묵직해지는데, 너무 많으면 웅웅거려서 말이 뭉개지더라고요.', show: { concept: 'strip', focus: 'low' }, op: 'ch', ch: 1, key: 'eqLow', value: -6, practice: 'CH 1 LOW를 왼쪽으로 -6 근처까지 돌려 보세요.' },
    { op: 'talk', on: false },
    { say: '실습실에선 음악이랑 목소리로 끝까지 돌려 볼 수 있어요. 하나씩 극단까지 가 보면 귀에 확 들어와요.', lab: { lab: 'eq', goal: 'HIGH, MID, LOW를 하나씩 끝까지 돌려 보고 소리가 어떻게 바뀌는지 들어 보세요.' } },
    { quiz: { q: '강연자 목소리가 코 막힌 것처럼 답답하게 들려요. 어느 손잡이를 살짝 깎을까요?', options: ['MID', 'HIGH', 'GAIN'], answer: 0, explain: 'MID가 목소리 몸통이라 답답함도 거기 몰려 있어요. 조금만 깎아도 한결 시원해져요.' } },

    // LOW CUT
    { who: 'junior', say: '아까 GAIN 바로 밑에 HPF라는 작은 버튼도 있던데요?' },
    { say: '그게 LOW CUT이에요. 쿵, 웅 하는 아주 낮은 소리를 싹둑 잘라 내서 컷이죠. 말소리엔 거의 늘 켜 둬요.', show: { concept: 'strip', focus: 'lowcut' }, op: 'ch', ch: 1, key: 'lowCut', value: true, practice: 'CH 1의 HPF 버튼을 눌러 켜 보세요.' },

    // PAN
    { say: 'PAN은 이 소리를 왼쪽, 오른쪽 스피커 중 어디로 보낼지 정해요. 강연자님, 다시 한번 부탁해요!', show: { concept: 'strip', focus: 'pan' }, op: 'talk', on: true },
    { who: 'junior', say: '근데 여긴 스피커가 하나뿐인데요?' },
    { say: '그래서 재밌는 걸 볼 수 있어요. PAN을 오른쪽 끝까지 돌려 볼래요?', op: 'ch', ch: 1, key: 'pan', value: 100, practice: 'CH 1 PAN을 오른쪽 끝까지 돌려 보세요.' },
    { say: '소리가 뚝 끊겼죠? 스피커가 L 출력에만 물려 있으니, 이럴 땐 PAN을 가운데에 둬야 해요.', focus: 'pa', op: 'ch', ch: 1, key: 'pan', value: 0 },

    // AUX · PFL 맛보기
    { say: 'AUX는 무대 모니터로 따로 보내는 양이에요. 연주자 귀에 들리는 소리는 스피커 파트에서 직접 만들어 봐요.', focus: 'mixer', show: { items: [{ concept: 'strip', focus: 'aux', label: 'AUX 손잡이' }, { photo: 'monitor_wedge', label: '무대 모니터' }] }, op: 'talk', on: false },
    { say: 'PFL을 누르면 그 채널만 헤드폰으로 미리 들을 수 있어요. 객석엔 안 나가니까 몰래 확인할 때 딱이죠.', show: { items: [{ concept: 'strip', focus: 'pfl', label: 'PFL 버튼' }, { photo: 'headphones', label: '모니터 헤드폰' }] } },

    // 정리 퀴즈
    { quiz: { q: '강연 중에 사회자 마이크만 잠깐 꺼야 해요. 다시 켤 땐 아까 크기 그대로 나와야 하고요.', options: ['그 채널 ON 버튼을 끈다', 'GAIN을 0까지 내린다', 'STEREO 페이더를 내린다'], answer: 0, explain: 'STEREO를 내리면 다른 채널까지 다 꺼져요. ON 버튼은 그 채널만, 크기는 그대로 두고 끄죠.' } },
    { quiz: { q: '말소리 채널에서 바닥 울림이랑 숨소리 퍽 소리가 거슬려요. 먼저 눌러 볼 버튼은?', options: ['LOW CUT', 'PFL', 'ON'], answer: 0, explain: '이 믹서에선 HPF라고 쓴 버튼이에요. 목소리 아래쪽 쿵, 웅만 잘라 내서 말소리엔 늘 켜 두죠.' } },
    { say: '파트 1은 여기까지예요. 다음 파트에선 마이크를 종류별로 꽂아 보면서, 소리가 안 날 때 어디를 볼지 익혀요.' },
  ],
};
