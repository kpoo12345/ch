/* 튜토리얼 파트 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 파트 7 · 방송의 길 (강의 중계 스튜디오). 카메라 → ATEM 스위처 → 송출 PC(OBS), 소리는 디지털 믹서 USB로 따로 와서 OBS에서 만난다.
 * PVW/PGM과 탈리 → CUT → ATEM USB = 웹캠 → OBS 영상 소스 → PC 내장 마이크(얇은 소리) → 믹서 USB(처음엔 USB 출력 OFF라 무음) → 라우팅
 * → 방송 시작 → 현장/방송 A/B → 헤드폰 습관 → AUTO 전환.
 * 스위처는 처음에 PGM 0(까만 화면)·PVW 1. 와이드(2번)로 방송을 열고, 나중에 클로즈업(1번)으로 AUTO 전환한다. */
export default {
  id: 'tut-stream', venue: 'lecture_hall', title: '파트 7 · 방송의 길',
  summary: '카메라 → 스위처 → OBS로 가는 영상, 믹서 USB로 따로 오는 소리. PVW와 PGM, 탈리, CUT과 AUTO, 방송 소리 듣는 습관까지.',
  mission: '카메라 두 대와 ATEM, OBS로 강의 생중계를 시작해 봅니다.',
  devices: [
    { id: 'host', type: 'dynamic_mic', slot: 'host_mic', name: '진행자 마이크' },
    { id: 'mixer', type: 'digital_mixer', slot: 'desk1', name: '디지털 믹서 X32' },
    { id: 'atem', type: 'atem', slot: 'desk2', name: 'ATEM Mini' },
    { id: 'pc', type: 'pc', slot: 'desk3', name: '송출 PC (OBS)' },
    { id: 'spk', type: 'speaker', slot: 'pa_main', name: '강의실 스피커' },
    { id: 'cam1', type: 'camera', slot: 'cam1', placed: false, name: '카메라 1 (클로즈업)' },
    { id: 'cam2', type: 'camera', slot: 'cam2', placed: false, name: '카메라 2 (와이드)' },
  ],
  connections: [
    { from: 'host.out', to: 'mixer.local1', cable: 'xlr' },
    { from: 'mixer.main', to: 'spk.in', cable: 'xlr' },
  ],
  inventory: { hdmi: 2, usb: 2 },
  state: {
    channels: { 1: { gain: 30, fader: 75, lowCut: true } },
    master: { mainFader: 75, usbOut: 'off' },
    atem: { program: 0, preview: 1 },
    obs: { video: 'none', audio: 'none' },
  },
  objectives: [], talk: 'ptt', performing: false,
  steps: [
    // 오늘 할 일 · 큰 그림
    { say: '강의 시작까지 30분 남았어요. 카메라 두 대로 이 강의를 인터넷에 생중계해 볼게요.' },
    { who: 'junior', say: '방송이면 카메라를 컴퓨터에 바로 꽂으면 되는 거 아니에요?' },
    { say: '웹캠이면 USB로 바로 돼요. 근데 이 카메라는 HDMI로 나오고, PC의 HDMI는 화면이 나가는 구멍이라 못 받아요.' },
    { say: '그래서 사이에 스위처를 둬요. 카메라가 여러 대여도 그중 하나를 골라서 PC로 넘겨 주죠.', show: { items: [{ photo: 'camcorder', label: '카메라' }, { photo: 'atem_mini', label: '스위처' }, { model: 'pc', label: '송출 PC' }], caption: '영상은 이 순서로 흘러가요' } },
    { who: 'junior', say: '송출 PC에는 OBS라고 떠 있네요. 이건 뭐예요?' },
    { say: '화면이랑 소리를 하나로 합쳐서 유튜브 같은 데로 보내 주는 프로그램이에요. 소리는 믹서에서 따로 와서 여기서 만나죠.', focus: 'pc', show: { model: 'pc' } },

    // 카메라 배치
    { say: '카메라부터 세워요. 1번은 진행자 얼굴을 가까이 잡는 클로즈업이에요.', show: { photo: 'camcorder' }, op: 'place', device: 'cam1', practice: '+ 카메라 1 (클로즈업) 배치를 눌러 보세요.' },
    { say: '2번은 강의실 전체를 넓게 보여 주는 와이드예요. 이건 제가 세울게요.', op: 'place', device: 'cam2' },

    // 스위처 · HDMI
    { who: 'junior', say: '카메라 선은 어디로 가요? 저 작은 상자요?' },
    { say: '네, 그게 ATEM Mini예요. 아까 말한 스위처죠. 이 작은 게 카메라를 네 대까지 받아요.', focus: 'atem', show: { photo: 'atem_mini' } },
    { say: '카메라 1은 HDMI로 1번 입력에 꽂아요. 카메라 번호랑 입력 번호를 맞추면 나중에 안 헷갈려요.', op: 'connect', from: 'cam1.hdmi', to: 'atem.in1', cable: 'hdmi', practice: 'HDMI를 고르고 카메라 1 HDMI OUT, ATEM HDMI IN 1을 눌러 보세요.' },
    { say: '카메라 2는 2번 입력으로 가고요.', op: 'connect', from: 'cam2.hdmi', to: 'atem.in2', cable: 'hdmi' },

    // PVW / PGM · 탈리 · CUT
    { say: '스위처엔 화면이 두 줄 있어요. PVW는 다음에 내보낼 화면, PGM은 지금 시청자가 보는 화면이에요.', show: { concept: 'pgmpvw' } },
    { say: '지금 PGM은 아무것도 안 골라서 까만 화면이에요. 방송은 보통 와이드로 여니까 PVW에 2번을 올려 볼까요?', op: 'atem', key: 'preview', value: 2, practice: 'ATEM을 클릭하고 PREVIEW 줄의 2를 눌러 보세요.' },
    { say: '카메라 2 위에 초록 불 들어왔죠? 다음 차례라는 표시예요. 이 불을 탈리라고 불러요.', focus: 'cam2' },
    { who: 'junior', say: '불은 왜 켜 줘요? 스위처 앞에 앉은 사람만 알면 되잖아요.' },
    { say: '진행자도 봐야 하거든요. 빨간 불 켜진 카메라를 보고 말해야 시청자랑 눈이 마주쳐요.' },
    { say: 'CUT을 눌러요. PVW랑 PGM이 맞바뀌면서 와이드가 바로 나가요.', op: 'atem', key: 'cut', practice: 'ATEM 패널의 CUT 버튼을 눌러 보세요.' },
    { say: '이제 카메라 2가 빨간 불이죠? 방송에 나가는 중이라 이 카메라는 함부로 움직이면 안 돼요.', focus: 'cam2' },
    { quiz: { q: '카메라 위에 초록 불이 켜져 있어요. 무슨 뜻일까요?', options: ['다음에 나갈 준비 중이다', '지금 방송에 나가는 중이다', '배터리가 꽉 찼다'], answer: 0, explain: '초록은 PVW, 대기 중이에요. 빨강이 PGM, 지금 시청자가 보고 있는 카메라고요.' } },

    // ATEM USB = 웹캠 → OBS 영상 소스
    { say: '이제 PC로 보내요. ATEM을 USB로 꽂으면 PC는 이걸 그냥 웹캠으로 알아봐요.', op: 'connect', from: 'atem.usb', to: 'pc.usb1', cable: 'usb', practice: 'USB를 고르고 ATEM USB WEBCAM, PC USB 1을 눌러 보세요.' },
    { who: 'junior', say: '노트북 화상회의 카메라처럼요? 그럼 설치할 것도 없겠네요.' },
    { say: '맞아요. OBS 영상 소스에서 ATEM만 골라 주면 돼요.', focus: 'pc', op: 'obs', key: 'video', value: 'atem', practice: '송출 PC를 클릭하고 영상 소스를 ATEM으로 골라 보세요.' },

    // 소리: 내장 마이크 → 믹서 USB → 라우팅
    { say: 'OBS에 와이드가 떴죠? 근데 소리는 아직 하나도 없어요. 진행자분이 한마디 해 주실 거예요.', focus: 'host', op: 'talk', on: true },
    { who: 'junior', say: 'PC에도 마이크 구멍이 있던데요. 그걸로 받으면 안 돼요?' },
    { say: '직접 들어 볼까요? OBS 오디오를 PC 내장 마이크로 바꿔 볼게요.', op: 'obs', key: 'audio', value: 'builtin' },
    { who: 'junior', say: '목소리가 멀고 웅웅 울려요. 동굴에서 말하는 것 같아요.' },
    { say: '방 전체 소리를 멀리서 주워 담으니까 그래요. 진행자 마이크 소리는 이미 믹서에 깨끗하게 들어와 있잖아요.' },
    { say: '이건 디지털 믹서예요. USB 단자 하나로 소리를 PC에 바로 보낼 수 있죠.', focus: 'mixer', show: { photo: 'mixer_digital' }, op: 'connect', from: 'mixer.usb', to: 'pc.usb2', cable: 'usb', practice: 'USB로 믹서 USB AUDIO와 PC USB 2를 이어 보세요.' },
    { say: '그럼 OBS 오디오 소스를 믹서 USB로 바꿔요.', op: 'obs', key: 'audio', value: 'mixer', practice: '송출 PC 패널에서 오디오 소스를 믹서 USB로 골라 보세요.' },
    { who: 'junior', say: '어? 이번엔 OBS 미터가 아예 안 움직여요. 꽂긴 제대로 꽂았는데요.' },
    { say: '꽂은 건 맞아요. 디지털 믹서는 USB로 뭘 보낼지 정해 줘야 하는데, 지금은 OFF로 돼 있거든요.' },
    { say: '메인을 보내요. 마스터 페이더, 전체 소리가 나가는 출구였죠? 그 소리를 그대로 PC에 주는 거예요.', show: { concept: 'strip', focus: 'master' }, op: 'master', key: 'usbOut', value: 'main', practice: '믹서 콘솔 MASTER에서 USB 출력을 Main L/R로 바꿔 보세요.' },
    { who: 'junior', say: '들어와요! 아까보다 훨씬 가깝고 또렷하네요.' },
    { quiz: { q: 'OBS 화면은 잘 나오는데 소리 미터만 꿈쩍 안 해요. 디지털 믹서에서 먼저 볼 곳은?', options: ['USB 출력 설정', '카메라 HDMI 케이블', 'ATEM의 CUT 버튼'], answer: 0, explain: '디지털 믹서는 꽂기만 해선 소리가 안 가요. USB로 뭘 내보내는지부터 확인해요.' } },

    // 방송 시작
    { say: '화면도 소리도 들어왔으니 방송 시작을 눌러요. 뒤쪽 벽에 ON AIR 불 들어오는 거 보세요.', op: 'obs', key: 'streaming', value: true, practice: '송출 PC 패널에서 방송 시작을 눌러 보세요.' },

    // 현장 vs 방송 · 헤드폰
    { say: '그럼 시청자 귀로 들어 봐요. 아래 A/B 비교를 열고 A 현장, B 방송을 번갈아 눌러 보세요.', op: 'wait', ms: 1500 },
    { who: 'junior', say: '같은 목소리인데 B가 더 가깝고 건조하게 들려요.' },
    { say: '현장은 스피커 소리에 강의실 울림까지 섞이잖아요. 방송은 마이크 소리만 바로 받으니 작은 잡음도 더 잘 들리죠.' },
    { say: '시청자는 대부분 이어폰으로 들어요. 그래서 방송 중엔 헤드폰을 쓰고 방송 소리를 직접 들어야 해요.', show: { photo: 'headphones' } },
    { say: '지난달 어느 교회 온라인 예배는 한 시간 내내 소리가 한쪽만 나갔대요. 헤드폰 쓴 사람이 아무도 없었거든요.' },

    // AUTO 전환
    { say: '이제 진행자 얼굴로 넘어가 볼까요? PVW에 카메라 1을 올려요.', op: 'atem', key: 'preview', value: 1, practice: 'ATEM 패널에서 PREVIEW 줄의 1을 눌러 보세요.' },
    { say: '이번엔 CUT 말고 AUTO를 써 봐요. CUT은 툭 바뀌고, AUTO는 두 화면이 살짝 겹치면서 넘어가거든요.', show: { concept: 'transitions' } },
    { say: '눌러 보세요. 화면이 스르륵 바뀌는 게 보일 거예요.', focus: 'cam1', op: 'atem', key: 'auto', practice: 'ATEM 패널의 AUTO 버튼을 눌러 보세요.' },
    { quiz: { q: '방송 중인 카메라 위치를 옮겨야 해요. 어떻게 할까요?', options: ['다른 카메라로 먼저 넘기고 옮긴다', '빨리만 옮기면 괜찮다', 'PGM에 그대로 둔 채 천천히 옮긴다'], answer: 0, explain: '빨간 불 카메라를 움직이면 흔들리는 화면이 그대로 나가요. 다른 카메라로 넘긴 뒤 옮기고, PVW에서 확인하고 다시 올려요.' } },
    { say: '방송은 이대로 강의 끝까지 쭉 가요. 다음엔 소리 말고 조명이랑 큰 화면을 다뤄 봐요.', op: 'talk', on: false },
  ],
};
