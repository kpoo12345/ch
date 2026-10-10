/* 튜토리얼 파트 — 형식은 src/game/data/tutorial.js 머리말 참고
 * 파트 8 · 빛과 화면 (교회 예배당). 조명 콘솔과 DMX(데이지 체인·주소) → 플레이백·그랜드 마스터·큐 저장
 * → 미디어 서버 레이어와 프로젝터 → PTZ 카메라 조이스틱·프리셋 → 스토리 모드로.
 * 앞 조명 R은 주소를 일부러 005로 틀어 놔서, 페이더를 올리면 엉뚱한 색이 나오고 009로 고치면 맞게 켜진다.
 * 프로젝터는 꺼 둔 채로 시작해서, HDMI를 꽂아도 화면이 안 나오다가 전원을 켜면 레이어가 보인다. */
export default {
  id: 'tut-show', venue: 'church', title: '파트 8 · 빛과 화면',
  summary: '조명 콘솔과 DMX 주소, 플레이백과 큐, 미디어 서버 레이어와 프로젝터, PTZ 카메라 프리셋까지.',
  mission: '예배당 앞 조명을 켜고, 스크린에 가사를 띄우고, PTZ 카메라로 설교자를 잡아 봅니다.',
  devices: [
    { id: 'desk', type: 'lighting_console', slot: 'foh2', name: '조명 콘솔 (Tiger Touch)' },
    { id: 'p1', type: 'par_led', slot: 'light_front_l', name: '앞 조명 L', role: 'front' },
    { id: 'p2', type: 'par_led', slot: 'light_front_r', name: '앞 조명 R', role: 'front' },
    { id: 'vj', type: 'media_server', slot: 'foh3', name: '미디어 서버 (Resolume)' },
    { id: 'proj', type: 'projector', slot: 'proj_ceiling', name: '프로젝터' },
    { id: 'ptz1', type: 'ptz', slot: 'ptz_side', name: 'PTZ 카메라' },
    { id: 'joy', type: 'ptz_controller', slot: 'foh4', name: 'PTZ 조이스틱' },
    { id: 'net', type: 'router', slot: 'router_foh', name: '공유기' },
  ],
  connections: [{ from: 'ptz1.lan', to: 'net.lan1', cable: 'eth' }, { from: 'joy.lan', to: 'net.lan2', cable: 'eth' }],
  inventory: { dmx: 2, hdmi: 1 },
  state: { devices: {
    p1: { address: 1 }, p2: { address: 5 },
    desk: { patch: [{ n: 1, label: 'FRONT L', type: 'par_led', address: 1 }, { n: 2, label: 'FRONT R', type: 'par_led', address: 9 }], playbacks: [{ label: '설교 조명', level: 0, cue: { fixtures: [1, 2], intensity: 90, color: '#fff1d6' } }] },
    vj: { layers: [{ clip: 'worship_bg', opacity: 100 }, { clip: 'lyrics', opacity: 100 }, { clip: null, opacity: 100 }], out1: 'comp' },
    proj: { power: false }, ptz1: { ip: '192.168.1.21', pan: 0, tilt: 0, zoom: 0.2 },
  } },
  objectives: [], talk: 'auto', performing: false,
  steps: [
    // 오늘 할 일
    { say: '예배당 앞쪽이 좀 어둡죠? 조명부터 켜고, 스크린이랑 카메라까지 차례로 만져 볼게요.' },
    { who: 'junior', say: '조명은 그냥 벽에 있는 스위치로 켜는 거 아니에요?' },
    { say: '객석 등은 그렇죠. 무대 조명은 방송실에 있는 이 콘솔 하나로 밝기랑 색을 다 정해요.', focus: 'desk', show: { photo: 'lighting_console' } },
    { say: '천장에 달린 건 LED 파 조명이에요. 빨강, 초록, 파랑, 흰색을 섞어서 어떤 색이든 내죠.', focus: 'p1', show: { photo: 'par_led' } },

    // DMX: 케이블과 데이지 체인
    { say: '조명 전기는 따로 받고, 명령은 DMX라는 선으로 보내요. 몇 번 채널을 얼마나 밝게, 이런 숫자를 계속 쏘는 거죠.', show: { concept: 'dmx' } },
    { who: 'junior', say: '어, 단자가 마이크 XLR이랑 똑같이 생겼네요. 마이크 선 써도 되겠다!' },
    { say: '꽂히긴 해요. 근데 마이크 선을 쓰면 조명이 파르르 떨거든요. DMX 선으로 콘솔에서 앞 조명 L까지 이어 봐요.', show: { connector: 'dmx' }, op: 'connect', from: 'desk.dmx1', to: 'p1.dmxIn', cable: 'dmx', practice: 'DMX를 고르고 콘솔 DMX A, 앞 조명 L DMX IN을 눌러 보세요.' },
    { who: 'junior', say: '조명이 열 개면 콘솔에서 선을 열 줄 뽑아요?' },
    { say: '아니요, 조명 뒤에 OUT이 또 있어요. 거기서 다음 조명 IN으로 줄줄이 잇죠. 이걸 데이지 체인이라고 해요.', op: 'connect', from: 'p1.dmxOut', to: 'p2.dmxIn', cable: 'dmx', practice: '앞 조명 L DMX OUT과 앞 조명 R DMX IN을 이어 보세요.' },
    { quiz: { q: '조명 세 대를 콘솔 하나에 물리려면 어떻게 이을까요?', options: ['콘솔 → 1번 → 2번 → 3번으로 줄줄이', '콘솔에서 세 줄을 따로 뽑는다', '마이크 선으로 아무 데나 꽂는다'], answer: 0, explain: '조명 OUT에서 다음 조명 IN으로 이어 가요. 선 하나로 수십 대도 갈 수 있거든요.' } },

    // 주소: 틀린 주소 → 엉뚱한 색 → 고치면 정상
    { say: '선 하나로 따로 움직이려면 주소가 있어야 해요. 이 조명은 8채널이라 L이 1번부터 8번, R은 9번부터 써야 안 겹치죠.' },
    { say: '콘솔엔 저장해 둔 장면이 페이더에 걸려 있어요. 이걸 플레이백이라고 해요. 설교 조명을 올려 볼까요?', focus: 'desk', op: 'dev', device: 'desk', key: 'playbacks.0.level', value: 100, practice: '조명 콘솔을 클릭하고 설교 조명 페이더를 올려 보세요.' },
    { who: 'junior', say: '왼쪽은 따뜻한 흰색인데, 오른쪽은 왜 이상한 연두색이에요?', focus: 'p2' },
    { say: 'R 주소가 005로 돼 있네요. L 자리를 반쯤 겹쳐 읽으니까 엉뚱한 숫자를 받는 거예요. 009로 고쳐 봐요.', op: 'dev', device: 'p2', key: 'address', value: 9, practice: '앞 조명 R을 클릭하고 DMX 주소를 009로 맞춰 보세요.' },
    { who: 'junior', say: '오, 이제 양쪽 색이 똑같아요!' },
    { quiz: { q: '8채널 조명을 1번 주소에 놨어요. 바로 다음 조명은 몇 번에 둘까요?', options: ['9번', '2번', '8번'], answer: 0, explain: '첫 대가 1번부터 8번까지 쓰니까 다음은 9번이에요. 겹치면 서로 남의 숫자를 읽어요.' } },

    // 그랜드 마스터: 전체 출구
    { say: '오른쪽 끝 GRAND MASTER는 모든 조명의 출구예요. 믹서의 STEREO 마스터 같은 거죠. 끝까지 내려 볼까요?', op: 'dev', device: 'desk', key: 'gm', value: 0, practice: '콘솔에서 GRAND MASTER를 맨 아래로 내려 보세요.' },
    { who: 'junior', say: '진짜 다 꺼졌네요. 공연 끝날 때 이거 쓰면 되겠어요.' },
    { say: '맞아요. 다시 올려 둘게요. 급하게 한 번에 끄는 BLACKOUT 버튼도 따로 있고요.', op: 'dev', device: 'desk', key: 'gm', value: 100 },

    // 큐 만들기: 고르고, 색 만들고, 저장하고, 바꿔 올리기
    { who: 'junior', say: '찬양 시간엔 다른 색이 좋을 것 같은데, 그런 장면은 어떻게 만들어요?' },
    { say: '프로그래머 화면에서 만들어요. 먼저 바꿀 조명을 골라요. 1번 2번 둘 다요.', op: 'dev', device: 'desk', key: 'programmer.sel', value: [1, 2], practice: '프로그래머 탭에서 1번과 2번 조명을 골라 보세요.' },
    { say: '색은 파랑으로 가 보죠. 고른 조명이 바로 파랗게 바뀌는 거 보이죠?', op: 'dev', device: 'desk', key: 'programmer.color', value: '#2563eb', practice: '색 버튼에서 파랑을 눌러 보세요.' },
    { say: '이 상태를 2번 플레이백에 저장해요. 이렇게 저장한 장면 하나를 큐라고 불러요.', op: 'lightRecord', device: 'desk', index: 2, label: '찬양 조명' },
    { say: '설교가 끝났다 치고 설교 조명을 내려요.', op: 'dev', device: 'desk', key: 'playbacks.0.level', value: 0 },
    { say: '이제 찬양 조명 페이더를 올려 봐요. 버튼 하나 없이 페이더로 장면이 바뀌죠.', op: 'dev', device: 'desk', key: 'playbacks.1.level', value: 100, practice: '플레이백 탭에서 찬양 조명 페이더를 올려 보세요.' },

    // 화면: 미디어 서버 · 레이어 · 프로젝터
    { say: '이번엔 화면이에요. 가사랑 배경은 이 미디어 서버에서 나가요. 레이어를 쌓는데, 위에 있는 게 앞에 보이죠.', focus: 'vj', show: { concept: 'layers' } },
    { say: '스크린은 천장 프로젝터가 비춰요. 큰 행사장에선 LED 전광판을 쓰기도 하고요.', show: { items: [{ photo: 'projector', label: '프로젝터' }, { photo: 'led_wall', label: 'LED 전광판' }] } },
    { say: '미디어 서버 HDMI OUT 1을 프로젝터에 꽂아요.', op: 'connect', from: 'vj.out1', to: 'proj.hdmi', cable: 'hdmi', practice: 'HDMI로 미디어 서버 OUT 1과 프로젝터를 이어 보세요.' },
    { who: 'junior', say: '꽂았는데 스크린이 그대로 하얘요. 이번엔 뭘 빠뜨렸죠?', focus: 'proj' },
    { say: '천장을 봐요. 프로젝터가 아직 꺼져 있잖아요. 전원부터 켜 봐요.', op: 'dev', device: 'proj', key: 'power', value: true, practice: '프로젝터를 클릭하고 전원을 ON으로 켜 보세요.' },
    { who: 'junior', say: '나왔다! 배경 위에 가사가 겹쳐 보여요.' },
    { say: '3번 레이어가 비었죠? 교회 로고를 올려 볼까요. 가사 위로 로고가 얹혀요.', focus: 'vj', op: 'dev', device: 'vj', key: 'layers.2.clip', value: 'logo', practice: '미디어 서버 Layer 3에서 교회 로고를 골라 보세요.' },
    { say: '찬양이 끝나면 가사는 빼야죠. 2번 레이어 불투명도를 0으로 내려요. 배경이랑 로고만 남아요.', op: 'dev', device: 'vj', key: 'layers.1.opacity', value: 0, practice: 'Layer 2 불투명도를 맨 왼쪽으로 내려 보세요.' },
    { quiz: { q: '배경 영상이 가사를 덮어서 가사가 안 보여요. 어떻게 쌓여 있을까요?', options: ['배경이 가사보다 위 레이어에 있다', '프로젝터가 꺼져 있다', '가사 레이어가 너무 밝다'], answer: 0, explain: '위 레이어가 앞에 보이거든요. 가사를 배경보다 위 레이어로 올리면 돼요.' } },

    // PTZ 카메라 · 조이스틱 · 프리셋
    { say: '마지막은 옆벽에 달린 PTZ 카메라예요. 좌우, 위아래, 줌을 원격으로 움직이죠.', focus: 'ptz1', show: { photo: 'ptz_camera' } },
    { who: 'junior', say: '카메라맨이 없는데 저걸 누가 돌려요?' },
    { say: '방송실 조이스틱이요. 카메라랑 조이스틱이 같은 공유기에 랜선으로 물려 있어서 말이 통해요. 1번 카메라를 골라 보죠.', focus: 'joy', show: { concept: 'ipnet' }, op: 'ptz', device: 'joy', act: 'select', value: 0 },
    { say: '방향을 돌리고 줌을 당겨서 설교자를 크게 잡아요. 화면에 구도가 설교자 클로즈업으로 바뀌죠.', op: 'ptz', device: 'joy', act: 'aim', pan: 32, tilt: -8, zoom: 0.7 },
    { say: '이 구도를 STORE 누르고 1번에 저장해요. 이게 프리셋이에요.', op: 'ptz', device: 'joy', act: 'store', value: 1 },
    { who: 'junior', say: '저장하면 뭐가 좋아요? 그때그때 돌리면 되잖아요.' },
    { say: '보여 줄게요. 일부러 강단 전체로 넓게 빼 볼게요.', op: 'ptz', device: 'joy', act: 'aim', pan: 30, tilt: -6, zoom: 0.1 },
    { say: '이제 1번 버튼만 눌러 봐요. 설교자 클로즈업으로 바로 돌아오죠. 그래서 혼자서도 여러 대를 돌려요.', op: 'ptz', device: 'joy', act: 'recall', value: 1 },
    { say: '대신 조심할 게 있어요. 버튼이 빨간불이면 지금 방송에 나가는 카메라예요. 그건 절대 건드리면 안 돼요.' },
    { quiz: { q: '조이스틱의 2번 카메라 버튼이 빨간불이에요. 지금 2번 프리셋을 불러도 될까요?', options: ['안 된다, 방송 중인 화면이 움직인다', '된다, 프리셋은 순식간이라 괜찮다', '된다, 빨간불은 배터리 부족이다'], answer: 0, explain: '빨간불은 지금 방송에 나가는 카메라예요. 다른 카메라로 넘긴 다음에 움직여요.' } },

    // 마무리
    { say: '여기까지 따라오느라 수고 많았어요! 큐 만들기는 스토리 6장, 화면은 7장, PTZ 운용은 8장에서 현장처럼 해 봐요.' },
  ],
};
