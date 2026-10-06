/* =====================================================================
 * 방송장비 마스터 (Broadcast Equipment Master)
 * 방송·음향·조명·영상 장비를 3D로 직접 설치하고 조작하며 배우는 시뮬레이션 게임
 *
 *  - 튜토리얼  : 게임이 스스로 진행하며 기초 장비를 보여 줌 (유령 손 + 내레이션) → game/v2/TutorialMode.jsx
 *  - 교육 모드 : 장비 백과 (3D 뷰어, 체험, 퀴즈)                                 → game/EduMode.jsx
 *  - 스토리 모드: 9개 장 · 26개 현장 미션                                         → game/v2/StoryMode.jsx
 *  - 스튜디오 모드: 장비를 마음대로 추가·배치·배선하는 자유 모드                  → game/v2/Sandbox.jsx
 * ===================================================================== */
import React, { useState } from 'react';
import MainMenu from './game/MainMenu.jsx';
import EduMode from './game/EduMode.jsx';
import TutorialMode from './game/v2/TutorialMode.jsx';
import StoryMode from './game/v2/StoryMode.jsx';
import Sandbox from './game/v2/Sandbox.jsx';
import { getAudio } from './game/audio.js';

export default function BroadcastMasterGame() {
  // 주소에 ?stage=light-2 처럼 주면 그 스테이지로 바로 (?auto=1 이면 정답 자동 진행)
  const [screen, setScreen] = useState(() => {
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const stage = q?.get('stage');
    return stage ? { mode: 'story', stage, auto: q.get('auto') === '1', key: 0 } : { mode: 'menu', key: 0 };
  });
  const open = (mode, stage) => {
    window.scrollTo(0, 0);
    getAudio().setSong(mode === 'menu' || mode === 'edu' ? 'menu' : 'game');
    setScreen((s) => ({ mode, stage, key: s.key + 1 }));
  };
  const toMenu = () => open('menu');

  if (screen.mode === 'edu') return <EduMode key={screen.key} onExit={toMenu} onNavigate={(m, st) => open(m === 'studio' ? 'studio' : m, st)} />;
  if (screen.mode === 'tutorial') return <TutorialMode key={screen.key} onExit={toMenu} onStory={() => open('story')} />;
  // 교육 모드의 "실습" 버튼은 예전 스테이지 번호(1~4)를 넘긴다
  const V1_STAGE = { 1: 'seminar-1', 2: 'seminar-3', 3: 'lecture-1', 4: 'crisis-2' };
  if (screen.mode === 'story') return <StoryMode key={screen.key} onExit={toMenu} startStage={typeof screen.stage === 'number' ? V1_STAGE[screen.stage] : screen.stage ?? null} autoStart={screen.auto} />;
  if (screen.mode === 'studio') return <Sandbox key={screen.key} onExit={toMenu} />;
  return <MainMenu key={screen.key} onSelect={(m) => open(m)} />;
}
