/* 튜토리얼 파트 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 파트 6 · 악기 (공연장, 밴드 리허설). 마이크로 받는 악기와 선으로 받는 악기 → 드럼 생소리와 마이크가 필요한 까닭
 * → 킥(GAIN 낮게) → 스네어(하이햇 피하기) → 오버헤드(펜슬 콘덴서, +48V) → 베이스를 TS로 바로 꽂았다가 험·얇은 소리
 * → DI 박스 → THRU와 GROUND LIFT → 디지털 피아노 L/R을 DI 두 대와 PAN으로 → 인풋 리스트 → 악기별 LOW CUT.
 * 드럼 세트는 공연장 무대에 늘 있어서, 연주(perform)만 켜면 생소리가 객석에 들린다. 메인 스피커는 미리 연결.
 * 시작 상태: 오버헤드는 3·4번에 꽂혀 있지만 +48V가 꺼져 있고 페이더도 내려 둔 상태(켜는 순간의 퍽 소리 방지).
 * +48V는 MIC 채널 전체에 한꺼번에 걸리고 연주 중엔 킥·스네어 채널이 열려 있어서, STEREO를 먼저 내리고 켠 뒤 다시 올린다.
 * 1번 GAIN은 35로 높게 둬서 킥을 꽂자마자 클리핑이 나게 한다. 건반 DI 두 대는 7·8번까지 미리 이어 두고 8번 PAN은 오른쪽 끝. */
export default {
  id: 'tut-instrument', venue: 'live_stage', title: '파트 6 · 악기',
  summary: '드럼은 마이크로, 베이스와 건반은 DI 박스로. 킥·스네어·오버헤드, GROUND LIFT, 스테레오 건반과 PAN, 인풋 리스트까지.',
  mission: '리허설 중인 밴드의 드럼, 베이스, 건반을 하나씩 믹서로 받아 봅니다.',
  devices: [
    { id: 'kick', type: 'kick_mic', slot: 'kick_mic', placed: false, name: '킥 드럼 마이크' },
    { id: 'snare', type: 'snare_mic', slot: 'snare_mic', name: '스네어 마이크' },
    { id: 'ohL', type: 'overhead_mic', slot: 'oh_l', name: '오버헤드 L' },
    { id: 'ohR', type: 'overhead_mic', slot: 'oh_r', name: '오버헤드 R' },
    { id: 'bass', type: 'bass_guitar', slot: 'bass', name: '베이스' },
    { id: 'dib', type: 'di_box', slot: 'di_bass', name: '베이스 DI' },
    { id: 'pno', type: 'digital_piano', slot: 'keys', name: '디지털 피아노' },
    { id: 'dik1', type: 'di_box', slot: 'di_keys', name: '건반 DI L' },
    { id: 'dik2', type: 'di_box', slot: 'di_keys2', name: '건반 DI R' },
    { id: 'mixer', type: 'analog_mixer', slot: 'foh1', name: '아날로그 믹서' },
    { id: 'paL', type: 'speaker', slot: 'pa_left', name: '왼쪽 메인 스피커' },
    { id: 'paR', type: 'speaker', slot: 'pa_right', name: '오른쪽 메인 스피커' },
  ],
  connections: [
    { from: 'mixer.main', to: 'paL.in', cable: 'xlr' },
    { from: 'mixer.mainR', to: 'paR.in', cable: 'xlr' },
    { from: 'ohL.out', to: 'mixer.in3', cable: 'xlr' },
    { from: 'ohR.out', to: 'mixer.in4', cable: 'xlr' },
    { from: 'dik1.out', to: 'mixer.in7', cable: 'xlr' },
    { from: 'dik2.out', to: 'mixer.in8', cable: 'xlr' },
  ],
  inventory: { xlr: 4, trs: 3 },
  state: {
    channels: {
      1: { gain: 35 }, 2: { gain: 15 }, 3: { gain: 22, fader: 0 }, 4: { gain: 22, fader: 0 },
      5: { gain: 30 }, 7: { gain: 15 }, 8: { gain: 15, pan: 100 },
    },
    master: { mainFader: 75, phantom: false },
  },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 오늘 할 일 · 마이크로 받는 악기, 선으로 받는 악기
    { say: '공연장에 밴드가 와 있네요. 드럼, 베이스, 건반을 차례로 믹서에 받아 볼게요.' },
    { who: 'junior', say: '악기도 노래처럼 전부 마이크를 대요?' },
    { say: '공기를 울려서 소리 나는 악기는 마이크로, 전기로 소리가 나오는 악기는 선으로 받아요.', show: { items: [{ photo: 'drum_kit', label: '드럼 · 마이크로' }, { photo: 'bass_guitar', label: '베이스 · 선으로' }, { photo: 'digital_piano', label: '건반 · 선으로' }] } },
    { say: '마침 밴드가 리허설을 시작한대요. 일단 그냥 들어 볼까요?', op: 'perform', on: true },

    // 드럼은 생소리가 크다 · 그래도 마이크를 대는 까닭
    { who: 'junior', say: '드럼은 마이크 하나 없는데도 엄청 크게 들리는데요?' },
    { say: '드럼 생소리예요. 이만한 공연장은 그냥도 다 들리는데, 방송이나 녹음엔 마이크로 잡은 소리만 가거든요.' },
    { quiz: { q: '작은 공연장이라 드럼 생소리가 객석에 충분히 들려요. 그래도 드럼에 마이크를 대는 까닭은?', options: ['방송과 녹음엔 마이크로 잡은 소리만 나가서', '드럼 소리를 더 작게 줄이려고', '드럼 가죽을 보호하려고'], answer: 0, explain: '생소리는 그 방 안에만 있어요. 유튜브로 나가는 소리나 다른 악기와의 균형은 믹서를 거쳐야 맞출 수 있죠.' } },

    // 킥: 큰 다이나믹, 앞판 구멍 앞 · 소리가 세서 GAIN은 낮게
    { say: '발로 밟는 제일 큰 북이 킥이에요. 몸집 큰 전용 다이나믹을 앞판 구멍 앞에 세워요.', show: { photo: 'drum_kick_mic' }, op: 'place', device: 'kick', practice: '킥 드럼 앞의 + 킥 드럼 마이크를 눌러 보세요.' },
    { say: 'XLR로 믹서 1번 MIC에 꽂아요. 킥이 1번인 건 어느 공연장을 가도 거의 같아요.', focus: 'kick', op: 'connect', from: 'kick.out', to: 'mixer.in1', cable: 'xlr', practice: 'XLR을 고르고 킥 마이크 OUT, 믹서 CH1 MIC를 눌러 보세요.' },
    { who: 'junior', say: '으, 쿵 소리가 찢어져요. 1번 미터에 빨간불도 들어왔고요!' },
    { say: 'GAIN, 맨 위 손잡이죠. 마이크 소리를 처음 키우는 곳이요. 킥은 원래 소리가 세서 15쯤이면 충분해요.', focus: 'mixer', op: 'ch', ch: 1, key: 'gain', value: 15, practice: '믹서 콘솔에서 CH1 GAIN을 15 근처로 내려 보세요.' },

    // 스네어: SM57, 하이햇은 마이크 등 뒤로
    { say: '딱 하는 북은 스네어예요. 악기용 다이나믹 SM57을 테두리 위에서 비스듬히 겨눠서 2번에 꽂죠.', show: { photo: 'drum_snare_mic' }, focus: 'snare', op: 'connect', from: 'snare.out', to: 'mixer.in2', cable: 'xlr' },
    { who: 'junior', say: '스네어 바로 옆에 하이햇이 붙어 있던데, 그것도 같이 잡히지 않아요?' },

    // 오버헤드: 펜슬 콘덴서 두 대 → +48V
    { say: '그래서 마이크 등을 하이햇 쪽으로 돌려요. 심벌은 위에 세운 가는 콘덴서 두 대가 따로 잡거든요.', show: { items: [{ photo: 'drum_overheads', label: '오버헤드 · 드럼 위 좌우' }, { photo: 'mic_pencil', label: '펜슬 콘덴서' }] }, focus: 'ohL' },
    { who: 'junior', say: '3, 4번에 꽂힌 게 그거죠? 근데 그 두 개만 미터가 꿈쩍도 안 해요. 이번에도 선 불량은 아니죠?' },
    { say: '펜슬도 콘덴서라서 +48V가 있어야 일을 하죠. 근데 연주 중이니까 STEREO 페이더부터 내려요.', focus: 'mixer', op: 'master', key: 'mainFader', value: 0, tol: 0, practice: '믹서 콘솔에서 STEREO 페이더를 맨 아래로 내려 보세요.' },
    { say: '이 믹서는 +48V가 MIC 채널 전체에 한꺼번에 걸리거든요. 이제 켜도 퍽 소리가 스피커로 안 가요.', op: 'master', key: 'phantom', value: true, practice: '믹서 콘솔에서 +48V 버튼을 켜 보세요.' },
    { say: 'STEREO는 다시 제자리로 올려 둘게요.', op: 'master', key: 'mainFader', value: 75 },
    { say: '이제 3번 페이더를 0 눈금까지 천천히 올려 봐요.', op: 'ch', ch: 3, key: 'fader', value: 75, practice: 'CH3 페이더를 0 눈금까지 올려 보세요.' },
    { say: '4번도 똑같이 올리고요.', op: 'ch', ch: 4, key: 'fader', value: 75 },

    // 베이스: TS로 바로 꽂으면 험 + 얇은 소리 → DI 박스
    { who: 'junior', say: '심벌까지 반짝반짝 살아났어요! 베이스는 이 기타 선으로 믹서에 바로 꽂으면 되죠?', op: 'perform', on: false },
    { say: '베이스랑 일렉 기타는 픽업이 줄 떨림을 전기로 바꿔요. 하늘 씨 말대로 5번 LINE에 바로 꽂아 보죠.', show: { items: [{ photo: 'bass_guitar', label: '베이스' }, { photo: 'e_guitar', label: '일렉 기타' }], caption: '줄 밑의 픽업이 떨림을 전기로 바꿔요' }, op: 'connect', from: 'bass.out', to: 'mixer.line5', cable: 'trs' },
    { say: '다시 한 곡 부탁해요! 이번엔 베이스를 잘 들어 봐요.', focus: 'bass', op: 'perform', on: true },
    { who: 'junior', say: '부웅 하는 소리가 깔려요. 베이스도 종이처럼 얇고 힘이 없어요.' },
    { say: '부웅은 케이블 파트에서 들은 험이에요. 게다가 픽업 신호는 약하고 예민해서, 믹서에 바로 물리면 힘이 쭉 빠져요.' },
    { say: '그래서 DI 박스를 써요. 악기 신호를 마이크처럼 튼튼한 XLR 신호로 바꿔 주는 상자죠. 기타 선부터 빼요.', show: { photo: 'di_box' }, focus: 'dib', op: 'disconnect', from: 'bass.out', to: 'mixer.line5' },
    { say: 'DI는 베이스 옆에 놔뒀어요. 베이스 선을 DI의 INPUT에 꽂아요. 이만큼 짧으면 TS 선이어도 괜찮거든요.', op: 'connect', from: 'bass.out', to: 'dib.input', cable: 'trs', practice: '6.3mm(TS) 케이블로 베이스 OUT과 DI INPUT을 이어 보세요.' },
    { say: 'DI 출력은 XLR이에요. 마이크처럼 믹서 5번 MIC 단자까지 길게 보내요.', op: 'connect', from: 'dib.out', to: 'mixer.in5', cable: 'xlr', practice: 'XLR로 DI OUTPUT과 믹서 CH5 MIC를 이어 보세요.' },
    { who: 'junior', say: '부웅도 사라지고 소리가 꽉 찼어요! 상자 하나로 이렇게 달라져요?' },

    // THRU로 앰프 · 험이 나면 GROUND LIFT
    { say: 'DI 옆 THRU 단자는 들어온 소리를 그대로 베이스 앰프로 넘겨 줘요. 근데 앰프를 물리면 가끔 이런 일이 생겨요.', show: { photo: 'guitar_amp' }, op: 'dev', device: 'dib', key: 'groundLoop', value: true },
    { who: 'junior', say: '어? DI를 거쳤는데 또 부웅 해요!' },
    { say: '앰프랑 믹서가 각자 전기 접지로 이어져 있어서 잡음이 도는 고리가 생긴 거예요. GROUND LIFT로 그 고리를 끊어요.', focus: 'dib', op: 'dev', device: 'dib', key: 'groundLift', value: true, practice: 'DI 박스를 클릭하고 GROUND LIFT를 켜 보세요.' },
    { quiz: { q: '무대 베이스를 TS 선으로 30m 떨어진 믹서에 바로 꽂았더니, 부웅 소리에 소리까지 얇아요. 어떻게 할까요?', options: ['DI 박스를 거쳐 XLR로 보낸다', 'GAIN을 끝까지 올린다', '스피커를 더 멀리 옮긴다'], answer: 0, explain: 'DI가 악기 신호를 튼튼한 XLR 신호로 바꿔 줘요. 그래도 험이 남으면 GROUND LIFT부터 눌러 보고요.' } },

    // 디지털 피아노: L/R 두 줄 → DI 두 대 → 7·8번, PAN 양 끝
    { who: 'junior', say: '건반 뒤엔 선 꽂는 데가 두 개네요. 하나만 쓰면 안 돼요?', focus: 'pno' },
    { say: 'L이랑 R이에요. 낮은 음은 왼쪽, 높은 음은 오른쪽으로 나눠 보내서, 믹서가 옆이면 스테레오 채널 L, R에 바로 꽂죠.', show: { photo: 'digital_piano' } },
    { say: '여긴 믹서가 멀어서 DI 두 대로 7번, 8번까지 이어 놨어요. L 출력을 왼쪽 DI에 꽂아 봐요.', focus: 'dik1', op: 'connect', from: 'pno.outL', to: 'dik1.input', cable: 'trs', practice: '6.3mm(TS) 케이블로 건반 OUT L과 건반 DI L의 INPUT을 이어 보세요.' },
    { say: 'R은 오른쪽 DI로 가고요.', focus: 'dik2', op: 'connect', from: 'pno.outR', to: 'dik2.input', cable: 'trs' },
    { say: 'PAN, 소리를 왼쪽 오른쪽 어디로 보낼지 정하는 손잡이였죠? 8번은 오른쪽 끝이니까 7번은 왼쪽 끝으로 돌려요.', show: { concept: 'strip', focus: 'pan' }, focus: 'mixer', op: 'ch', ch: 7, key: 'pan', value: -100, practice: 'CH7 PAN을 왼쪽 끝까지 돌려 보세요.' },
    { who: 'junior', say: '건반이 양쪽 스피커에서 넓게 퍼져요. 진짜 피아노 앞에 앉은 것 같아요!' },

    // 인풋 리스트
    { say: '연주는 잠깐 쉬어요. 채널 순서 보세요. 킥 1, 스네어 2, 오버헤드 3·4, 베이스 5, 건반 7·8이죠.', focus: 'mixer', op: 'perform', on: false },
    { say: '이 순서를 적은 표가 인풋 리스트예요. 어딜 가도 거의 비슷해서, 처음 만난 밴드랑도 금방 맞출 수 있죠.' },
    { quiz: { q: '처음 가 본 공연장의 인풋 리스트예요. 1번 채널엔 보통 뭐가 꽂혀 있을까요?', options: ['킥 드럼', '메인 보컬', '건반 L'], answer: 0, explain: '드럼부터 번호를 매기는 게 관례라 1번은 거의 킥이에요. 보컬은 보통 뒤쪽 번호고요.' } },

    // 악기마다 LOW CUT: 오버헤드는 켜고, 베이스·킥은 끈다
    { who: 'junior', say: '말소리엔 LOW CUT을 늘 켠다고 했잖아요. 악기도 다 켜요?' },
    { say: 'LOW CUT, 아주 낮은 웅웅을 잘라 내는 버튼이었죠. 심벌만 받으면 되는 오버헤드는 켜요. 3번 눌러 볼까요?', show: { concept: 'strip', focus: 'lowcut' }, op: 'ch', ch: 3, key: 'lowCut', value: true, practice: 'CH3의 HPF 버튼을 눌러 켜 보세요.' },
    { say: '4번도 켜 두고요. 베이스랑 킥은 반대예요. 그 낮은 소리가 본업이라 꼭 꺼 둬요.', op: 'ch', ch: 4, key: 'lowCut', value: true },
    { quiz: { q: '리허설 전에 채널마다 LOW CUT을 하나씩 맞추고 있어요. 꺼 둬야 하는 채널은?', options: ['베이스', '보컬', '오버헤드'], answer: 0, explain: '베이스는 낮은 소리가 본업이라 잘라 내면 힘이 다 빠져요. 킥도 마찬가지고요.' } },
    { say: '드럼부터 건반까지 다 받았네요. 다음엔 이렇게 모은 소리가 카메라 화면이랑 만나서 방송으로 나가는 길을 따라가요.' },
  ],
};
