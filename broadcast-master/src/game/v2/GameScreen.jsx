import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Lightbulb, Wand2, Music, Volume2, VolumeX, Mic, Tag, Lock, Unlock, Video, RotateCcw, CheckCircle2, Circle, Star, ChevronRight,
  Play, Pause, SkipForward, SkipBack, X, SlidersHorizontal, Cable, ListChecks, Cpu, ScrollText, Ear, Hand, Guitar, MessageSquare,
} from 'lucide-react';
import Venue3D from '../Venue3D.jsx';
import { hasWebGL, NoWebGL } from '../kit3d.jsx';
import { CABLES, DEVICE_TYPES } from '../engine.js';
import { getAudio } from '../audio.js';
import { setTalk, stopAllSpeech } from '../speech.js';
import { loadProgress, saveProgress } from '../ui.jsx';
import { useGame, useScriptPlayer, faultText } from './useGame.js';
import Console from './Console.jsx';
import { DevicePanel } from './DevicePanels.jsx';
import PortBoard from './PortBoard.jsx';
import { Seg, Toggle } from './controls.jsx';
import { addDeviceOp } from '../ops.js';

/* =====================================================================
 * 게임 화면 — 3D 장소 + 미션/장비/연결 패널 + 믹서 콘솔 + 케이블 가방
 * 스토리 · 튜토리얼 · 자유 모드가 모두 이 화면을 쓴다
 * ===================================================================== */

const LISTEN = [['main', '객석 스피커'], ['monitor', '무대 모니터'], ['headphones', '헤드폰'], ['stream', '방송(시청자)']];
const PHRASES = {
  seminar: ['아, 아, 마이크 테스트.', '안녕하십니까, 오늘 세미나를 시작하겠습니다.', '뒤에 계신 분들 잘 들리시나요?'],
  youtube_room: ['안녕하세요 여러분, 라이브 방송에 오신 걸 환영해요!', '오늘은 커버곡을 들려드릴게요.', '채팅 많이 남겨 주세요!'],
  church: ['하나님의 은혜와 평강이 함께 하시기를 바랍니다.', '오늘 말씀은 시편 23편입니다.', '다 함께 찬양하겠습니다.'],
  live_stage: ['안녕하세요! 반갑습니다!', '다음 곡 들려드릴게요!', '다 같이 손 들어 주세요!'],
  lecture_hall: ['안녕하세요, 오늘 강의를 시작하겠습니다.', '화면을 보시면서 따라와 주세요.', '질문은 채팅으로 남겨 주세요.'],
  sandbox: ['아, 아, 마이크 테스트.', '하나, 둘, 셋.', '잘 들리시나요?'],
};
const lvToVol = (lv) => (lv == null ? 0 : Math.max(0, Math.min(1, (lv + 42) / 32)));

export default function GameScreen({
  spec, mode = 'story', heading, onExit, onNext, onRestart, tutorial, sandbox, restore, initialAuto = false,
}) {
  const [cleared, setCleared] = useState(false);
  const game = useGame(spec, { onClear: () => setCleared(true) });
  const { st, nominal, actual, talking } = game;
  const [voiceOn, setVoiceOn] = useState(true);
  const player = useScriptPlayer(game, { voiceOn });
  const [tab, setTab] = useState(mode === 'sandbox' ? 'add' : 'mission');
  const defaultListen = useMemo(() => {
    const at = (spec.objectives ?? []).map((o) => o.check.at).filter(Boolean);
    if (at.includes('main')) return 'main';
    return at[0] ?? (Object.values(st.devices).some((d) => d.type === 'speaker') ? 'main' : 'stream');
  }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps
  const [listen, setListen] = useState(defaultListen);
  const [showBrief, setShowBrief] = useState(mode === 'story');
  const [hints, setHints] = useState(0);
  const [usedAuto, setUsedAuto] = useState(false);
  const [labels, setLabels] = useState(false);
  const [lockView, setLockView] = useState(false);
  const [follow, setFollow] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [bgmOn, setBgmOn] = useState(() => loadProgress('bm2-bgm', true));
  const [sfxOn, setSfxOn] = useState(true);
  const [focusRequest, setFocusRequest] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  // 경과 시간 (돌발 상황 스테이지는 제한 시간)
  const [elapsed, setElapsed] = useState(0);
  const [overtime, setOvertime] = useState(false);
  useEffect(() => {
    if (mode !== 'story' || showBrief || cleared) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [mode, showBrief, cleared]);
  useEffect(() => {
    if (spec.timeLimit && elapsed >= spec.timeLimit && !overtime && !cleared) { setOvertime(true); game.notify('err', '제한 시간이 지났습니다! 계속 해결할 수 있지만 평가가 한 단계 내려갑니다.'); }
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  const gl = useMemo(() => hasWebGL(), []);
  // 스튜디오 모드: 장비 놓기/옮기기
  const [placing, setPlacing] = useState(null);
  useEffect(() => { if (restore) game.load(restore); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sandboxApi = mode === 'sandbox' ? {
    placing,
    onPlaceAt: (p, surface) => {
      if (!placing) return;
      if (placing.moveId) game.apply({ op: 'moveDevice', device: placing.moveId, pos: p, surface });
      else {
        const op = addDeviceOp(game.stRef.current, placing.type, p, surface);
        if (game.apply(op)) game.setSelected(op.device.id);
      }
      setPlacing(null);
    },
  } : null;

  // 자동 진행 중에는 대본이 끝난 뒤에 결과 창을 띄운다
  const scriptRunning = !!player.script && !player.script.done;
  useEffect(() => { if (cleared && mode === 'story' && !scriptRunning) { const t = setTimeout(() => setResultOpen(true), 900); return () => clearTimeout(t); } return undefined; }, [cleared, mode, scriptRunning]);

  /* ----- 오디오 ----- */
  useEffect(() => { const a = getAudio(); a.setSong('game'); a.setBgm({ on: bgmOn }); saveProgress('bm2-bgm', bgmOn); }, [bgmOn]);
  useEffect(() => { getAudio().setSfx(sfxOn); }, [sfxOn]);
  useEffect(() => () => { getAudio().setStage({}); stopAllSpeech(); }, []);
  // 무대 소리: 듣는 위치에 도착한 소스별 크기
  useEffect(() => {
    const heard = actual.heard[listen] ?? {};
    const byType = (types) => Math.max(0, ...Object.entries(heard).filter(([src]) => types.includes(st.devices[src]?.type)).map(([, h]) => lvToVol(h.level)));
    const audible = Object.entries(heard).filter(([, h]) => h.level > -40);
    const humAmt = audible.some(([, h]) => h.hum) ? 0.8 : 0;
    const thin = audible.some(([src]) => actual.thin.includes(src)) ? 1 : 0;
    const clip = audible.some(([src]) => actual.clips.includes(src)) ? 0.7 : 0;
    const fxCh = audible.map(([src]) => actual.channelOf(src)).filter(Boolean).map((c) => st.channels[c.index - 1]?.fx ?? 0);
    const reverb = fxCh.length ? (Math.max(...fxCh) / 100) * (st.master.fxReturn / 100) : 0;
    const inRoom = listen === 'main' || listen === 'monitor';
    getAudio().setStage({
      guitar: game.performing ? byType(['e_guitar']) : 0,
      keys: game.performing ? byType(['keyboard']) : 0,
      drums: game.performing && st.venue === 'live_stage' && inRoom ? 0.35 : 0,
      laptop: byType(['laptop']),
      hum: humAmt, thin, clip, reverb,
      feedback: talking && actual.feedback && (inRoom) ? 1 : talking && actual.ringing && inRoom ? 0.25 : 0,
    });
  }, [actual, listen, game.performing, talking]); // eslint-disable-line react-hooks/exhaustive-deps
  // 사람 말소리
  useEffect(() => {
    const heard = actual.heard[listen] ?? {};
    const lv = Math.max(-99, ...Object.entries(heard).filter(([src]) => ['dynamic_mic', 'condenser_mic', 'wireless_mic'].includes(st.devices[src]?.type)).map(([, h]) => h.level));
    setTalk(sfxOn && talking ? { volume: lvToVol(lv), phrases: PHRASES[st.venue] ?? PHRASES.sandbox } : null);
  }, [actual, listen, talking, sfxOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스페이스바 = 말하기
  useEffect(() => {
    const down = (e) => { if (e.code === 'Space' && !e.repeat && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); game.setPtt(true); } };
    const up = (e) => { if (e.code === 'Space') game.setPtt(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 튜토리얼: 대본 자동 시작
  useEffect(() => {
    if (tutorial?.steps) player.start(tutorial.steps, { practice: tutorial.practice, onDone: tutorial.onDone, onStep: tutorial.onStep });
  }, [tutorial?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialAuto) startAuto(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startAuto = () => {
    if (!spec.solution) return;
    setShowBrief(false); setUsedAuto(true); game.reset(); setResetKey((k) => k + 1);
    setTimeout(() => player.start(spec.solution, { onDone: () => {} }), 400);
  };

  // 선택한 장비 → 장비 탭
  useEffect(() => { if (game.selected && mode !== 'sandbox') setTab('device'); }, [game.selected]); // eslint-disable-line react-hooks/exhaustive-deps
  // 대본이 장비를 조작할 때 해당 장비 선택
  useEffect(() => {
    if (!player.script || !game.action?.device || !st.devices[game.action.device]) return;
    const k = game.action.ctl?.kind;
    if (k === 'mixer' || k === 'master') setConsoleOpen(true);
    else game.setSelected(game.action.device);
  }, [game.action?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const inv = Object.entries(st.cables).filter(([k]) => CABLES[k]);
  const cableChoices = st.unlimited ? Object.keys(CABLES) : inv.map(([k]) => k);
  const highlight = player.waiting ? targetOf(player.waiting) : null;
  const onePending = game.pending ? `${st.devices[game.pending.d]?.name ?? game.pending.d} · ${portLabel(st, game.pending.d, game.pending.p)}` : null;
  const doneCount = game.objectives.filter((o) => o.ok).length;

  const stars = usedAuto ? 1 : Math.max(1, (hints > 0 ? 2 : 3) - (overtime ? 1 : 0));
  useEffect(() => {
    if (!cleared || mode !== 'story') return;
    const prog = loadProgress('bm2-progress', {});
    if ((prog[spec.id] ?? 0) < stars) { prog[spec.id] = stars; saveProgress('bm2-progress', prog); }
  }, [cleared]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0b1220] text-slate-100 overflow-hidden" onPointerDown={() => getAudio().unlock()}>
      {/* 상단 바 */}
      <header className="flex items-center gap-2 px-2 sm:px-3 py-1.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
        <button type="button" onClick={() => { player.stop(); onExit?.(); }} className="p-1.5 rounded hover:bg-slate-800" aria-label="나가기"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-sky-300 truncate">{heading}</div>
          <div className="font-bold text-sm sm:text-base truncate">{spec.title}{spec.tag && <span className="ml-2 text-[11px] font-semibold text-slate-400">#{spec.tag}</span>}</div>
        </div>
        {mode === 'story' && (
          <>
            <span className={`text-xs tabular-nums font-mono px-1.5 py-0.5 rounded ${spec.timeLimit ? (overtime ? 'bg-red-600 text-white' : spec.timeLimit - elapsed <= 30 ? 'bg-amber-500 text-slate-900 animate-pulse' : 'bg-slate-800 text-amber-200') : 'text-slate-400'}`} title={spec.timeLimit ? '남은 시간' : '경과 시간'}>
              {spec.timeLimit ? fmtTime(Math.max(0, spec.timeLimit - elapsed)) : fmtTime(elapsed)}
            </span>
            <span className="hidden sm:inline text-xs text-slate-300 tabular-nums">{doneCount}/{game.objectives.length}</span>
            <button type="button" onClick={() => { setHints((h) => Math.min((spec.hints?.length ?? 0), h + 1)); setTab('mission'); }} className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs font-bold"><Lightbulb size={14} /> <span className="hidden sm:inline">힌트</span></button>
            {spec.solution && <button type="button" onClick={startAuto} className="flex items-center gap-1 px-2 py-1 rounded bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 text-xs font-bold" title="정답을 유령 손이 직접 보여 줍니다"><Wand2 size={14} /> <span className="hidden sm:inline">정답 보기</span></button>}
          </>
        )}
        <button type="button" onClick={() => setBgmOn(!bgmOn)} className={`p-1.5 rounded ${bgmOn ? 'text-sky-300' : 'text-slate-500'} hover:bg-slate-800`} title="배경음악" aria-label="배경음악 켜기/끄기" aria-pressed={bgmOn}><Music size={17} /></button>
        <button type="button" onClick={() => setSfxOn(!sfxOn)} className={`p-1.5 rounded ${sfxOn ? 'text-sky-300' : 'text-slate-500'} hover:bg-slate-800`} title="현장 소리·효과음" aria-label="현장 소리 켜기/끄기" aria-pressed={sfxOn}>{sfxOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button type="button" onClick={() => setVoiceOn(!voiceOn)} className={`p-1.5 rounded ${voiceOn ? 'text-sky-300' : 'text-slate-500'} hover:bg-slate-800`} title="내레이션 음성" aria-label="내레이션 음성" aria-pressed={voiceOn}><MessageSquare size={17} /></button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* 3D */}
        <div className={`relative flex-1 ${consoleOpen ? 'min-h-[26vh]' : 'min-h-[40vh]'} lg:min-h-0`}>
          {gl ? (
            <Venue3D st={st} sim={actual} venueId={st.venue} talking={talking} performing={game.performing} selectedChannel={game.selCh}
              pending={game.pending} selectedCable={game.cable} selectedDevice={game.selected} labels={labels} resetKey={resetKey}
              focusRequest={focusRequest} lockView={lockView} follow={follow} action={game.action} viewers={actual.stream.live ? 1280 : 0}
              highlight={highlight} free={mode === 'sandbox'} sandboxApi={sandboxApi}
              onPortClick={game.clickPort} onSelectDevice={game.setSelected} onDisconnect={game.disconnect}
              onPlace={(id) => game.apply({ op: 'place', device: id })} onCancelPending={() => game.setPending(null)} />
          ) : <NoWebGL hint="오른쪽 '연결' 탭의 연결표로 게임을 계속할 수 있습니다." />}
          {/* 3D 보기 도구 */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <ViewBtn on={labels} onClick={() => setLabels(!labels)} icon={Tag} label="단자 이름" />
            <ViewBtn on={lockView} onClick={() => setLockView(!lockView)} icon={lockView ? Lock : Unlock} label="시점 고정" />
            <ViewBtn on={follow} onClick={() => setFollow(!follow)} icon={Video} label="조작 따라가기" />
            <ViewBtn onClick={() => { setFocusRequest({ id: 'overview', key: Date.now() }); }} icon={RotateCcw} label="전체 보기" />
          </div>
          {/* 알림 */}
          {game.toast && <Toast toast={game.toast} onDone={() => game.setToast(null)} />}
          {/* 내레이션 */}
          {(player.narration || player.waiting) && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-3 w-[min(94%,640px)] rounded-xl border border-violet-400/50 bg-slate-950/90 backdrop-blur px-3 py-2 shadow-xl">
              {player.narration && <div className="text-sm leading-relaxed text-slate-100">{player.narration.text}</div>}
              {player.waiting && <div className="mt-1 text-sm font-bold text-amber-300 flex items-center gap-1"><Hand size={15} /> 직접 해 보세요: {player.waiting.practice}</div>}
              <div className="mt-1.5 flex items-center gap-1.5">
                <button type="button" onClick={() => player.jump(-1)} className="p-1 rounded hover:bg-slate-800" aria-label="이전"><SkipBack size={15} /></button>
                {player.script?.playing ? <button type="button" onClick={player.pause} className="p-1 rounded hover:bg-slate-800" aria-label="일시정지"><Pause size={15} /></button>
                  : <button type="button" onClick={player.resume} className="p-1 rounded hover:bg-slate-800" aria-label="재생"><Play size={15} /></button>}
                <button type="button" onClick={() => player.jump(1)} className="p-1 rounded hover:bg-slate-800" aria-label="다음"><SkipForward size={15} /></button>
                <Seg small value={player.script?.speed ?? 1} options={[[1, '1x'], [1.5, '1.5x'], [2, '2x']]} onChange={player.setSpeed} />
                {tutorial && <Toggle small on={!!player.script?.practice} color="amber" onClick={() => player.setPractice(!player.script?.practice)}>직접 해보기</Toggle>}
                <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{player.narration ? `${player.narration.i + 1}/${player.narration.n}` : ''}</span>
                {!tutorial && <button type="button" onClick={player.stop} className="p-1 rounded hover:bg-slate-800" aria-label="자동 진행 끄기"><X size={15} /></button>}
              </div>
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        <aside className={`lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/60 ${consoleOpen ? 'hidden lg:flex' : 'flex'} flex-col min-h-0 h-[38vh] lg:h-auto`}>
          <nav className="flex border-b border-slate-800 shrink-0" role="tablist">
            {[
              ...(mode === 'sandbox' ? [['add', '장비 추가', Cpu]] : [['mission', '미션', ListChecks]]),
              ['device', '장비', SlidersHorizontal], ['ports', '연결표', Cable], ['log', '기록', ScrollText],
            ].map(([k, label, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold ${tab === k ? 'text-sky-300 border-b-2 border-sky-400 bg-slate-900' : 'text-slate-400 hover:text-slate-200'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 overscroll-contain">
            {tab === 'add' && sandbox && <sandbox.Panel game={game} placing={placing} setPlacing={setPlacing} />}
            {tab === 'mission' && (
              <MissionPanel spec={spec} game={game} hints={hints} onHint={() => setHints((h) => Math.min(spec.hints?.length ?? 0, h + 1))} />
            )}
            {tab === 'device' && (game.selected && st.devices[game.selected]
              ? <DevicePanel key={game.selected} game={game} id={game.selected} />
              : <DeviceList game={game} />)}
            {tab === 'device' && game.selected && <button type="button" onClick={() => game.setSelected(null)} className="text-xs text-slate-400 hover:text-slate-200">← 장비 목록</button>}
            {tab === 'ports' && <PortBoard game={game} />}
            {tab === 'log' && <LogPanel log={game.log} />}
          </div>
        </aside>
      </div>

      {/* 아래: 케이블 가방 · 말하기 · 듣는 위치 · 콘솔 */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-950/90">
        <div className="flex flex-wrap items-center gap-2 px-2 sm:px-3 py-1.5">
          <div className="flex items-center gap-1 flex-wrap" role="radiogroup" aria-label="케이블 선택">
            <Cable size={15} className="text-slate-400" />
            {cableChoices.length === 0 && <span className="text-[11px] text-slate-500">가방에 케이블 없음</span>}
            {cableChoices.map((k) => {
              const n = st.unlimited ? '∞' : st.cables[k];
              const on = game.cable === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} disabled={!st.unlimited && !n} onClick={() => game.setCable(on ? null : k)} title={`${CABLES[k].name} — ${CABLES[k].desc}`}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border disabled:opacity-35 ${on ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CABLES[k].stroke }} />{CABLES[k].short} <span className="font-mono opacity-70">×{n}</span>
                </button>
              );
            })}
            {onePending && <span className="text-[11px] text-sky-300">선택한 단자: {onePending} → 연결할 단자를 누르세요</span>}
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <button type="button"
              onPointerDown={(e) => { e.preventDefault(); getAudio().unlock(); game.setPtt(true); }} onPointerUp={() => game.setPtt(false)} onPointerLeave={() => game.setPtt(false)} onPointerCancel={() => game.setPtt(false)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black select-none touch-none ${game.ptt ? 'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,.7)]' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
              title="누르고 있는 동안 말합니다 (스페이스바)"><Mic size={14} /> 말하기</button>
            <Toggle small on={game.autoTalk} color="green" onClick={() => game.setAutoTalk(!game.autoTalk)} title="진행자가 계속 말하게 하기">자동 말하기</Toggle>
            {Object.values(st.devices).some((d) => ['e_guitar', 'keyboard'].includes(d.type)) && (
              <Toggle small on={game.performing} color="green" onClick={() => game.setPerforming(!game.performing)} title="밴드 연주"><Guitar size={12} className="inline" /> 연주</Toggle>
            )}
            <span className="flex items-center gap-1 text-[11px] text-slate-400"><Ear size={14} /></span>
            <Seg small value={listen} options={LISTEN.filter(([k]) => k !== 'headphones' || Object.values(st.devices).some((d) => d.type === 'headphones'))} onChange={setListen} />
            {st.mixerId && st.devices[st.mixerId]?.placed && (
              <button type="button" onClick={() => setConsoleOpen(!consoleOpen)} className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${consoleOpen ? 'bg-sky-500 text-white' : 'bg-slate-700 text-slate-100'}`}>
                <SlidersHorizontal size={14} /> 믹서 콘솔
              </button>
            )}
          </div>
        </div>
        {consoleOpen && st.mixerId && (
          <div className="px-2 pb-2 max-h-[46vh] overflow-y-auto"><Console game={game} /></div>
        )}
      </div>

      {showBrief && <Briefing spec={spec} heading={heading} onStart={() => { setShowBrief(false); getAudio().unlock(); }} onAuto={spec.solution ? startAuto : null} />}
      {resultOpen && (
        <Result spec={spec} stars={stars} usedAuto={usedAuto} elapsed={elapsed} onNext={onNext} onRetry={() => { setResultOpen(false); onRestart?.(); }} onExit={onExit} onClose={() => setResultOpen(false)} />
      )}
    </div>
  );
}

const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function ViewBtn({ on, onClick, icon: Icon, label }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={on}
      className={`p-1.5 rounded-md border backdrop-blur ${on ? 'bg-sky-500/80 border-sky-300 text-white' : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
      <Icon size={15} />
    </button>
  );
}

function Toast({ toast, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, toast.kind === 'err' ? 4200 : 2400); return () => clearTimeout(t); }, [toast.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const cls = toast.kind === 'err' ? 'border-red-400/60 bg-red-950/90 text-red-100' : toast.kind === 'ok' ? 'border-green-400/60 bg-green-950/90 text-green-100' : 'border-sky-400/50 bg-slate-900/90 text-slate-100';
  return <div role="status" className={`absolute top-2 left-1/2 -translate-x-1/2 max-w-[86%] rounded-lg border px-3 py-1.5 text-xs sm:text-sm shadow-lg ${cls}`}>{toast.text}</div>;
}

function MissionPanel({ spec, game, hints, onHint }) {
  const { objectives, st } = game;
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-sky-950/40 border border-sky-800/50 p-2.5 text-sm text-sky-100 leading-relaxed">{spec.mission}</div>
      <ul className="space-y-1.5" aria-label="목표">
        {objectives.map((o, i) => (
          <li key={i} className={`flex items-start gap-2 text-sm ${o.ok ? 'text-green-300' : 'text-slate-200'}`}>
            {o.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <Circle size={16} className="shrink-0 mt-0.5 text-slate-500" />}
            <span>{o.label}</span>
          </li>
        ))}
      </ul>
      <Status game={game} />
      {spec.hints?.length > 0 && (
        <div className="space-y-1.5">
          {spec.hints.slice(0, hints).map((h, i) => <div key={i} className="rounded bg-amber-950/40 border border-amber-800/50 p-2 text-xs text-amber-100"><b>힌트 {i + 1}</b> · {h}</div>)}
          {hints < spec.hints.length && <button type="button" onClick={onHint} className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1"><Lightbulb size={13} /> 힌트 {hints + 1} 보기</button>}
        </div>
      )}
      {spec.briefing && <details className="text-xs text-slate-400"><summary className="cursor-pointer">상황 설명 다시 보기</summary>{spec.briefing.map((b, i) => <p key={i} className="mt-1 leading-relaxed">{b}</p>)}</details>}
      {st.faults.length > 0 && <div className="text-[11px] text-slate-400">이 현장에는 숨은 문제 {st.faults.length}개가 있습니다. 소리·화면이 가는 길을 따라가며 찾아보세요.</div>}
    </div>
  );
}

// 현재 상태 요약 (무엇이 문제인지 실마리)
function Status({ game }) {
  const { actual, nominal, talking } = game;
  const items = [];
  if (nominal.feedback) items.push(['err', '하울링 위험! (말하면 "삐—")']);
  else if (nominal.ringing) items.push(['warn', '하울링 직전 (울림이 큼)']);
  if (nominal.clips.length) items.push(['err', `클리핑(찢어짐): ${nominal.clips.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.hum) items.push(['warn', `험 잡음: ${nominal.humSources.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.deadPhantom.length) items.push(['warn', `소리 없음(팬텀 전원 필요?): ${nominal.deadPhantom.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.thin.length) items.push(['warn', `소리가 얇음(악기 입력 임피던스): ${nominal.thin.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.stream.streamingAny && !nominal.stream.live) items.push(['warn', '방송 중이지만 시청자에게 영상/소리가 제대로 안 나갑니다']);
  if (nominal.stream.live) items.push(['ok', '생중계 정상 송출 중']);
  if (nominal.light.conflicts.length) items.push(['err', '조명 패치 주소 충돌']);
  if (Object.values(nominal.light.fixtures).some((r) => r.flicker)) items.push(['err', '조명 깜빡임 (DMX 신호 문제)']);
  if (!items.length) return null;
  void actual; void talking;
  return (
    <div className="space-y-1">
      {items.map(([k, t], i) => <div key={i} className={`text-[11px] rounded px-2 py-1 ${k === 'err' ? 'bg-red-950/60 text-red-200' : k === 'ok' ? 'bg-green-950/60 text-green-200' : 'bg-amber-950/50 text-amber-200'}`}>{t}</div>)}
    </div>
  );
}

function DeviceList({ game }) {
  const { st } = game;
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-400">장비를 고르면 실제 버튼·노브를 조작할 수 있습니다. 3D에서 장비를 클릭해도 됩니다 (더블클릭 = 확대).</p>
      {Object.values(st.devices).map((d) => {
        const def = DEVICE_TYPES[d.type];
        const Icon = def.icon;
        return (
          <button key={d.id} type="button" onClick={() => game.setSelected(d.id)} className="w-full flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 hover:bg-slate-800 px-2 py-1.5 text-left">
            {Icon && <Icon size={15} className="text-sky-300" />}
            <span className="text-sm text-slate-100 flex-1 truncate">{d.name ?? def.name}</span>
            {!d.placed && <span className="text-[10px] text-amber-300">미배치</span>}
            <ChevronRight size={14} className="text-slate-500" />
          </button>
        );
      })}
    </div>
  );
}

function LogPanel({ log }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log.length]);
  return (
    <div ref={ref} className="space-y-1 max-h-[60vh] overflow-y-auto">
      {log.length === 0 && <div className="text-xs text-slate-500">아직 기록이 없습니다.</div>}
      {log.map((l, i) => <div key={i} className={`text-xs ${l.kind === 'err' ? 'text-red-300' : l.kind === 'ok' ? 'text-green-300' : 'text-slate-300'}`}>• {l.text}</div>)}
    </div>
  );
}

function Briefing({ spec, heading, onStart, onAuto }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="미션 브리핑">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5 space-y-3 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="text-xs text-sky-300">{heading}</div>
        <h2 className="text-xl font-black">{spec.title}</h2>
        {spec.briefing?.map((b, i) => <p key={i} className="text-sm text-slate-300 leading-relaxed">{b}</p>)}
        <div className="rounded-lg bg-sky-950/50 border border-sky-800/60 p-3 text-sm text-sky-100"><b>미션</b> · {spec.mission}</div>
        {spec.timeLimit && <div className="rounded-lg bg-red-950/50 border border-red-700/60 p-2 text-sm text-red-100">⏱ 제한 시간 {fmtTime(spec.timeLimit)} — 시간 안에 해결하면 ★3까지 받을 수 있어요.</div>}
        <ul className="text-sm text-slate-300 space-y-1">{spec.objectives.map((o, i) => <li key={i} className="flex gap-2"><Circle size={14} className="mt-0.5 shrink-0 text-slate-500" />{o.label}</li>)}</ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={onStart} autoFocus className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-black">시작하기</button>
          {onAuto && <button type="button" onClick={onAuto} className="px-4 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white font-bold flex items-center gap-1"><Wand2 size={16} /> 정답 먼저 보기 (자동 진행)</button>}
        </div>
        <p className="text-[11px] text-slate-500">조작법: 단자 클릭 → 케이블 선택 → 다른 단자 클릭 · 장비 클릭 = 조작 패널 · 스페이스바 = 말하기 · 드래그 = 시점 회전</p>
      </div>
    </div>
  );
}

function Result({ spec, stars, usedAuto, elapsed, onNext, onRetry, onExit, onClose }) {
  useEffect(() => { getAudio().star(); }, []);
  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="스테이지 완료">
      <div className="w-full max-w-lg rounded-2xl border border-green-500/40 bg-slate-900 p-5 space-y-3 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="text-center">
          <div className="text-green-300 font-black text-2xl">미션 완료!</div>
          <div className="text-xs text-slate-400 mt-1 font-mono">소요 시간 {fmtTime(elapsed ?? 0)}{spec.timeLimit ? ` / 제한 ${fmtTime(spec.timeLimit)}` : ''}</div>
          <div className="flex justify-center gap-1 mt-2">{[1, 2, 3].map((n) => <Star key={n} size={30} className={n <= stars ? 'text-yellow-300 fill-yellow-300' : 'text-slate-600'} />)}</div>
          <div className="text-xs text-slate-400 mt-1">{usedAuto ? '정답 보기로 완료 (★1) — 다시 도전하면 ★3!' : stars === 3 ? '힌트 없이 완벽!' : '힌트 사용 또는 시간 초과 — 다시 도전해 ★3을 노려 보세요'}</div>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-400">오늘 배운 것</div>
          {spec.lessons?.map((l, i) => <div key={i} className="text-sm text-slate-200 rounded bg-slate-800/70 p-2 leading-relaxed">{l}</div>)}
          {spec.faults?.length > 0 && <div className="text-xs text-slate-400 pt-1">숨은 문제였던 것: {spec.faults.map((f) => faultText(f)).join(' · ')}</div>}
        </div>
        <div className="flex flex-wrap gap-2 justify-center pt-1">
          {onNext && <button type="button" onClick={onNext} autoFocus className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-black">다음 스테이지 →</button>}
          <button type="button" onClick={onRetry} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-sm">다시 하기</button>
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-bold text-sm">계속 둘러보기</button>
          <button type="button" onClick={onExit} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-bold text-sm">목록으로</button>
        </div>
      </div>
    </div>
  );
}

function portLabel(st, d, p) {
  const def = DEVICE_TYPES[st.devices[d]?.type];
  return [...(def?.ins ?? []), ...(def?.outs ?? [])].find((x) => x.id === p)?.label ?? p;
}

// 연습 단계에서 강조할 장비/단자
function targetOf(op) {
  if (op.op === 'place' || op.op === 'dev' || op.op === 'move') return { device: op.device };
  if (op.op === 'connect') { const [d, p] = op.from.split('.'); const [d2, p2] = op.to.split('.'); return { device: d, port: p, device2: d2, port2: p2 }; }
  return null;
}
