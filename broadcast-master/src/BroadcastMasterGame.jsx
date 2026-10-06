/* =====================================================================
 * 방송장비 마스터 (Broadcast Equipment Master)
 * 신호 흐름(Signal Flow)·게인 스테이징·송출·트러블슈팅을 익히는 시뮬레이션 게임
 *
 *  - 교육 모드  : 장비 백과 (3D 뷰어, 체험, 퀴즈)          → game/EduMode.jsx
 *  - 스토리 모드: 스테이지 1~4 미션 게임                    → game/PlayScreen.jsx (mode="story")
 *  - 스튜디오 모드: 자유 설치·배선, 도전 과제, 돌발 상황 훈련 → game/PlayScreen.jsx (mode="studio")
 * ===================================================================== */
import React, { useState } from 'react';
import MainMenu from './game/MainMenu.jsx';
import PlayScreen from './game/PlayScreen.jsx';
import EduMode from './game/EduMode.jsx';

export default function BroadcastMasterGame() {
  const [screen, setScreen] = useState({ mode: 'menu', key: 0 });
  const open = (mode, stage) => {
    window.scrollTo(0, 0);
    setScreen((s) => ({ mode, stage, key: s.key + 1 }));
  };
  const toMenu = () => open('menu');

  if (screen.mode === 'edu') return <EduMode key={screen.key} onExit={toMenu} onNavigate={open} />;
  if (screen.mode === 'story' || screen.mode === 'studio') {
    return <PlayScreen key={screen.key} mode={screen.mode} startStage={screen.stage ?? 1} onExit={toMenu} />;
  }
  return <MainMenu key={screen.key} onSelect={(m) => open(m)} />;
}
