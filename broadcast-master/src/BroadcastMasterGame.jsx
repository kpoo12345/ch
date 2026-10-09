/* =====================================================================
 * 방송장비 마스터 (Broadcast Equipment Master)
 * 방송·음향·조명·영상 장비를 3D로 직접 설치하고 조작하며 배우는 시뮬레이션 게임
 *
 *  배우는 순서: ① 튜토리얼(기초 과정) → ② 스토리 모드(현장 미션)
 *  - 튜토리얼    : 선배 엔지니어와 대화 장면으로 진행 (주제별 8파트)               → game/v2/TutorialMode.jsx
 *  - 스토리 모드 : 9개 장 · 28개 현장 미션                                         → game/v2/StoryMode.jsx
 *  도구 (언제든)
 *  - 장비 백과사전: 찾아보기용 참고서 (검색 · 한 줄 정의 · 연결 · 현장 팁)          → game/Encyclopedia.jsx
 *  - 자유 스튜디오: 장비를 마음대로 추가·배치·배선하는 자유 모드                  → game/v2/Sandbox.jsx
 * ===================================================================== */
import React, { useState } from 'react';
import MainMenu from './game/MainMenu.jsx';
import Encyclopedia from './game/Encyclopedia.jsx';
import TutorialMode from './game/v2/TutorialMode.jsx';
import StoryMode from './game/v2/StoryMode.jsx';
import Sandbox from './game/v2/Sandbox.jsx';
import { getAudio } from './game/audio.js';
import BetaFeedback from './game/BetaFeedback.jsx';
import { setBetaContext } from './game/betaContext.js';

export default function BroadcastMasterGame() {
  return <><Screens /><BetaFeedback /></>;
}

function Screens() {
  // 주소로 바로 가기: ?stage=light-2 (?auto=1 이면 정답 자동 진행) · ?tutorial=1 튜토리얼 파트 1 · ?dict=dynamic_mic 백과사전 항목
  const [screen, setScreen] = useState(() => {
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const stage = q?.get('stage');
    if (q?.get('tutorial')) return { mode: 'tutorial', part: Number(q.get('tutorial')) - 1, key: 0 };
    if (q?.has('dict')) return { mode: 'dict', entry: q.get('dict') || null, key: 0 };
    return stage ? { mode: 'story', stage, auto: q.get('auto') === '1', key: 0 } : { mode: 'menu', key: 0 };
  });
  // open(화면, 인자, 돌아갈 곳) — 인자: 튜토리얼은 파트 번호, 스토리는 스테이지 id, 백과사전은 항목 id
  // back이 있으면(백과사전에서 들어온 경우) 나갈 때 그 항목으로 돌아간다
  const open = (mode, arg, back = null) => {
    const m = mode === 'edu' ? 'dict' : mode;
    window.scrollTo(0, 0);
    getAudio().setSong(m === 'menu' || m === 'dict' ? 'menu' : 'game');
    setScreen((s) => ({
      mode: m, key: s.key + 1, back,
      part: m === 'tutorial' ? arg : undefined, stage: m === 'story' ? arg : undefined, entry: m === 'dict' ? arg : undefined,
    }));
  };
  const toMenu = () => open('menu');
  // 베타 의견에 붙일 현재 화면 — 화면이 바뀌는 그 렌더에서 적어 둔다 (세부 위치는 각 화면의 effect가 덧붙인다)
  const ctxKey = React.useRef(null);
  if (ctxKey.current !== screen.key) {
    ctxKey.current = screen.key;
    setBetaContext({ screen: { menu: '메인 메뉴', dict: '장비 백과사전', tutorial: '튜토리얼', story: '스토리 모드', studio: '자유 스튜디오' }[screen.mode] ?? screen.mode });
  }
  const exit = () => (screen.back ? open('dict', screen.back.entry) : toMenu());

  if (screen.mode === 'dict') {
    return <Encyclopedia key={screen.key} initialId={screen.entry} onExit={toMenu} onNavigate={(m, arg, fromId = null) => open(m, arg, { entry: fromId })} />;
  }
  if (screen.mode === 'tutorial') return <TutorialMode key={screen.key} startPart={screen.part} onExit={exit} onStory={() => open('story')} />;
  // 예전 스테이지 번호(1~4)로 들어오면 스토리 스테이지 id로 바꾼다
  const V1_STAGE = { 1: 'seminar-1', 2: 'seminar-3', 3: 'lecture-1', 4: 'crisis-2' };
  if (screen.mode === 'story') return <StoryMode key={screen.key} onExit={exit} startStage={typeof screen.stage === 'number' ? V1_STAGE[screen.stage] : screen.stage ?? null} autoStart={screen.auto} />;
  if (screen.mode === 'studio') return <Sandbox key={screen.key} onExit={toMenu} />;
  return <MainMenu key={screen.key} onSelect={(m, arg) => open(m, arg)} />;
}
