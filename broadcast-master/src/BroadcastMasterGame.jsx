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
import { setBetaContext, patchBetaContext, noteError, openFeedback } from './game/betaContext.js';
import { loadVoice } from './game/speech.js';
import { screenFromUrl, writeHistory, sameScreen, parentOf, KEEP } from './game/nav.js';

// 웹사이트판: 첫 화면이 뜬 뒤 짧은 한마디·무대 말소리 목소리를 조용히 받아 둔다
if (typeof window !== 'undefined') setTimeout(() => loadVoice('common'), 2500);

export default function BroadcastMasterGame() {
  // 화면에서 오류가 나도 의견 보내기는 살아 있게 (경계 밖에 둔다)
  const [crashKey, setCrashKey] = useState(0);
  return <><CrashGuard key={crashKey} onReset={() => setCrashKey((k) => k + 1)}><Screens /></CrashGuard><BetaFeedback /></>;
}

/* 화면 오류 경계 — 빈 화면 대신 "메뉴로 돌아가기"와 "의견 보내기" */
class CrashGuard extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    noteError(error);
    patchBetaContext({ crash: `${String(error?.message ?? error).slice(0, 200)}${info?.componentStack ? ` @${info.componentStack.trim().split('\n')[0].trim().slice(0, 80)}` : ''}` });
  }
  render() {
    if (!this.state.error) return this.props.children;
    const home = () => { try { window.history.replaceState(null, '', window.location.pathname); } catch { /* 주소 못 바꿈 */ } patchBetaContext({ crash: undefined }); this.props.onReset(); };
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#0b1220] p-6 text-slate-100">
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-lg font-black">앗, 화면에 문제가 생겼어요</p>
          <p className="text-sm text-slate-300">메뉴로 돌아가서 다시 해 볼 수 있어요. 어디서 그랬는지 의견으로 알려 주시면 바로 고칠게요.</p>
          <p className="break-all rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-500">{String(this.state.error?.message ?? this.state.error).slice(0, 160)}</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={home} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-bold">메뉴로 돌아가기</button>
            <button type="button" onClick={openFeedback} className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-900">의견 보내기</button>
          </div>
        </div>
      </div>
    );
  }
}

function Screens() {
  // 주소로 바로 가기 (game/nav.js): ?stage=light-2 · ?tutorial=1 · ?dict=dynamic_mic · ?story · ?studio
  const [screen, setScreen] = useState(() => ({ ...screenFromUrl(typeof window !== 'undefined' ? window.location.search : ''), key: 0, depth: 0 }));
  const screenRef = React.useRef(screen);
  screenRef.current = screen;
  // 이 탭에서 쌓은 화면들 (depth 번째) — 바로 앞 화면으로 돌아갈 때는 새로 쌓지 않고 history.back()
  const stack = React.useRef([]);
  const show = (s, cur) => {
    getAudio().setSong(s.mode === 'menu' || s.mode === 'dict' ? 'menu' : 'game');
    window.scrollTo(0, 0);
    setScreen({ ...s, key: cur.mode === s.mode && KEEP.has(s.mode) ? cur.key : cur.key + 1 });
  };
  React.useEffect(() => {
    stack.current[0] = screenRef.current;
    writeHistory(screenRef.current, true);
    const onPop = (e) => {
      const s = e.state?.bm ? e.state : { mode: 'menu', depth: 0 };
      const cur = screenRef.current;
      if (sameScreen(cur, s)) { if ((cur.depth ?? 0) !== (s.depth ?? 0)) setScreen({ ...cur, depth: s.depth ?? 0 }); return; }
      show(s, cur);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // replace: 지금 화면을 바꿔 끼운다 (다음 미션·다음 파트처럼 뒤로 갈 때 거칠 필요가 없는 곳)
  const go = (s, { replace = false } = {}) => {
    const cur = screenRef.current;
    if (sameScreen(cur, s)) return;
    const depth = cur.depth ?? 0;
    const prev = stack.current[depth - 1];
    if (depth > 0 && sameScreen(prev, s)) {
      show(prev, cur);
      try { window.history.back(); } catch { /* history 없음 */ }
      return;
    }
    // 목록으로 올라가는데 앞 기록이 그 목록이 아니면(주소로 바로 들어온 경우) 쌓지 않고 바꾼다 — 뒤로가 다시 미션을 열지 않게
    if (replace || sameScreen(parentOf(cur), s)) {
      const next = { ...s, depth };
      stack.current = [...stack.current.slice(0, depth), next];
      writeHistory(next, true);
      show(next, cur);
      return;
    }
    const next = { ...s, depth: depth + 1 };
    stack.current = [...stack.current.slice(0, depth + 1), next];
    writeHistory(next, false);
    show(next, cur);
  };
  // open(화면, 인자, 돌아갈 곳) — 인자: 튜토리얼은 파트 번호, 스토리는 스테이지 id, 백과사전은 항목 id
  // back이 있으면(백과사전에서 들어온 경우) 나갈 때 그 항목으로 돌아간다
  const open = (mode, arg, back = null) => {
    const m = mode === 'edu' ? 'dict' : mode;
    go({ mode: m, back, part: m === 'tutorial' ? arg : undefined, stage: m === 'story' ? arg : undefined, entry: m === 'dict' ? arg : undefined });
  };
  const toMenu = () => go({ mode: 'menu' });
  // 베타 의견에 붙일 현재 화면 — 화면이 바뀌는 그 렌더에서 적어 둔다 (세부 위치는 각 화면의 effect가 덧붙인다)
  const ctxKey = React.useRef(null);
  if (ctxKey.current !== screen.key) {
    ctxKey.current = screen.key;
    setBetaContext({ screen: { menu: '메인 메뉴', dict: '장비 백과사전', tutorial: '튜토리얼', story: '스토리 모드', studio: '자유 스튜디오' }[screen.mode] ?? screen.mode });
  }
  const exit = () => (screen.back ? open('dict', screen.back.entry) : toMenu());

  if (screen.mode === 'dict') {
    return <Encyclopedia key={screen.key} entry={screen.entry ?? null} onEntry={(id) => go({ mode: 'dict', entry: id })} onExit={toMenu} onNavigate={(m, arg, fromId = null) => open(m, arg, { entry: fromId })} />;
  }
  if (screen.mode === 'tutorial') {
    return <TutorialMode key={screen.key} part={screen.part ?? null} onPart={(i, o) => go({ mode: 'tutorial', part: i ?? undefined, back: screen.back }, o)} onExit={exit} onStory={() => open('story')} />;
  }
  // 예전 스테이지 번호(1~4)로 들어오면 스토리 스테이지 id로 바꾼다
  const V1_STAGE = { 1: 'seminar-1', 2: 'seminar-3', 3: 'lecture-1', 4: 'crisis-2' };
  if (screen.mode === 'story') {
    return <StoryMode key={screen.key} stage={V1_STAGE[screen.stage] ?? screen.stage ?? null} onStage={(id, o) => go({ mode: 'story', stage: id ?? undefined, back: screen.back }, o)} onExit={exit} autoStart={screen.auto} />;
  }
  if (screen.mode === 'studio') return <Sandbox key={screen.key} onExit={toMenu} />;
  return <MainMenu key={screen.key} onSelect={(m, arg) => open(m, arg)} />;
}
