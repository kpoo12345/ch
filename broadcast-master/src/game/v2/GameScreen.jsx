import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Lightbulb, Wand2, Music, Volume2, VolumeX, Mic, Tag, Lock, Unlock, Video, RotateCcw, CheckCircle2, Circle, XCircle, Star, ChevronRight,
  SlidersHorizontal, Cable, ListChecks, Cpu, ScrollText, Ear, Guitar, MessageSquare, MessageSquarePlus, Compass, X, Hand,
} from 'lucide-react';
import Venue3D from '../Venue3D.jsx';
import { hasWebGL, NoWebGL } from '../kit3d.jsx';
import { CABLES, DEVICE_TYPES } from '../engine.js';
import { stuckAtMixer, buildRuntime } from '../sim.js';
import { getAudio } from '../audio.js';
import { setTalk, stopAllSpeech, loadVoice, loadVoiceWithin } from '../speech.js';
import { loadProgress, saveProgress } from '../ui.jsx';
import { useGame, useScriptPlayer, faultText, waitingFor } from './useGame.js';
import { planOf, skipDone, guideText, advanceGuide, unblockStep } from './storyGuide.js';
import Console from './Console.jsx';
import { DevicePanel } from './DevicePanels.jsx';
import PortBoard from './PortBoard.jsx';
import { Seg, Toggle } from './controls.jsx';
import { addDeviceOp } from '../ops.js';
import Dialog from './Dialog.jsx';
import ListenCompare from './ListenCompare.jsx';
import LabOverlay from './LabOverlay.jsx';
import { PHRASES, TALK_VOICE } from '../data/phrases.js';
import { patchBetaContext, openFeedback, subscribeBeta, enterGameScreen } from '../betaContext.js';
import { connectGuide } from './connectGuide.js';
import { panelDeviceOf, findPracticeTarget, practiceMiss } from './practiceTarget.js';

/* =====================================================================
 * 게임 화면 — 3D 장소 + 미션/장비/연결 패널 + 믹서 콘솔 + 케이블 가방
 * 스토리 · 튜토리얼 · 자유 모드가 모두 이 화면을 쓴다
 * ===================================================================== */

const LISTEN = [['main', '객석 스피커'], ['monitor', '무대 모니터'], ['headphones', '헤드폰'], ['stream', '방송(시청자)']];
const noWatch = () => null;
const INSTRUMENTS = new Set(['e_guitar', 'keyboard', 'digital_piano', 'bass_guitar', 'drum_kit', 'kick_mic', 'snare_mic', 'overhead_mic']);
const lvToVol = (lv) => (lv == null ? 0 : Math.max(0, Math.min(1, (lv + 42) / 32)));
// 좁은 화면(휴대폰·세로 태블릿)인지 — 대화 상자를 3D 위가 아니라 아래에 둔다
const NARROW = '(max-width: 1023px)';
function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return undefined;
    const on = () => setN(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return n;
}

export default function GameScreen({
  spec, mode = 'story', heading, onExit, onNext, onRestart, tutorial, sandbox, restore, initialAuto = false,
}) {
  const [cleared, setCleared] = useState(false);
  const game = useGame(spec, { onClear: () => setCleared(true), popMode: mode === 'tutorial' ? 'optIn' : 'all' });
  const { st, nominal, actual, talking } = game;
  // 내레이션·현장 소리 켜고 끈 것은 배경음악처럼 기억한다
  const [voiceOn, setVoiceOn] = useState(() => loadProgress('bm2-voice', true));
  useEffect(() => { saveProgress('bm2-voice', voiceOn); }, [voiceOn]);
  const player = useScriptPlayer(game, { voiceOn });
  const [tab, setTab] = useState(mode === 'sandbox' ? 'add' : 'mission');
  const defaultListen = useMemo(() => {
    const at = (spec.objectives ?? []).map((o) => o.check.at).filter(Boolean);
    if (at.includes('main')) return 'main';
    return at[0] ?? (Object.values(st.devices).some((d) => d.type === 'speaker' || d.type === 'passive_speaker') ? 'main' : 'stream');
  }, [spec]); // eslint-disable-line react-hooks/exhaustive-deps
  const [listen, setListen] = useState(defaultListen);
  // 플레이어가 직접 고른 뒤에는 듣는 곳을 저절로 바꾸지 않는다
  const listenPicked = useRef(false);
  const chooseListen = (v) => { listenPicked.current = true; setListen(v); };
  const [compareOpen, setCompareOpen] = useState(false);
  const [lab, setLab] = useState(null); // 튜토리얼에서 연 실습실 { lab, goal }
  const narrow = useNarrow();
  // 자유 모드: 탭과 상관없이 자동 저장·도전 과제 (훅은 화면이 살아 있는 동안 늘 같은 것이 불린다)
  const useWatch = sandbox?.useWatch ?? noWatch;
  useWatch(game);
  const [showBrief, setShowBrief] = useState(mode === 'story');
  const [hints, setHints] = useState(0);
  const [usedAuto, setUsedAuto] = useState(false);
  // 정답 보기를 누르면 지금까지 한 것이 지워진다 → 한 게 있으면 한 번 묻는다
  const [askAuto, setAskAuto] = useState(false);
  // 스토리 길잡이: 힌트를 다 봐도 막히면 정답 풀이에서 "다음 할 일" 하나를 반짝여 짚어 준다 (쓰면 ★2까지)
  const plan = useMemo(() => (mode === 'story' ? planOf(spec) : []), [spec, mode]);
  const [guideOn, setGuideOn] = useState(false);
  const [usedGuide, setUsedGuide] = useState(false);
  const [gCur, setGCur] = useState(0);
  // 지금 따라가는 할 일 목록: 처음엔 정답 계획(plan 단계), 끝까지 했는데 안 끝나면 마무리(finish 단계)
  const [gList, setGList] = useState(null);
  const [gPhase, setGPhase] = useState('plan');
  const gBefore = useRef(null);
  const startGuide = () => {
    if (!plan.length || player.script) return;
    gBefore.current = game.stRef.current;
    setGPhase('plan'); setGList(plan);
    setGCur(skipDone(plan, 0, game.stRef.current, game));
    setGuideOn(true); setUsedGuide(true); setTab('mission');
  };
  const gSteps = gList ?? plan;
  const guiding = guideOn && !player.script && !cleared;
  // 꽂을 자리를 다른 케이블이 막고 있으면 그 케이블 빼기부터 짚는다
  const gItem = guiding && gCur < gSteps.length ? gSteps[gCur] : null;
  const gBlock = gItem ? unblockStep(gItem.op, st) : null;
  const gShown = gBlock ? { ...gItem, op: gBlock, step: { ...gItem.step, say: '새 케이블을 꽂을 자리를 다른 케이블이 차지하고 있어요. 한 단자에는 케이블 하나만 꽂히니까 먼저 빼고 다시 꽂아요.' } } : gItem;
  const storyAsk = gItem ? waitingFor(gShown.op, `g${gPhase}${gCur}:${gItem.i}${gBlock ? `:unplug:${gBlock.id}` : ''}`) : null;
  // 짚을 할 일을 다 했는데도 안 끝났을 때 보여 줄 남은 목표
  const guideLeft = guiding && gCur >= gSteps.length ? game.objectives.filter((o) => !o.ok) : null;
  // 지금 짚을 단계: 튜토리얼 "직접 해 보기" 또는 스토리 길잡이
  const ask = player.waiting ?? storyAsk;
  const [labels, setLabels] = useState(false);
  const [lockView, setLockView] = useState(false);
  const [follow, setFollow] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [bgmOn, setBgmOn] = useState(() => loadProgress('bm2-bgm', true));
  const [sfxOn, setSfxOn] = useState(() => loadProgress('bm2-sfx', true));
  useEffect(() => { saveProgress('bm2-sfx', sfxOn); }, [sfxOn]);
  const [focusRequest, setFocusRequest] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  // 경과 시간 (돌발 상황 스테이지는 제한 시간)
  const [elapsed, setElapsed] = useState(0);
  const [overtime, setOvertime] = useState(false);
  // 의견 창이 열려 있거나 다른 탭을 보는 동안은 시간을 세지 않는다
  const [feedbackOpen, setFeedbackOpenState] = useState(false);
  useEffect(() => subscribeBeta((u) => setFeedbackOpenState(u.open)), []);
  useEffect(enterGameScreen, []);
  useEffect(() => {
    if (mode !== 'story' || showBrief || cleared || feedbackOpen) return undefined;
    const id = setInterval(() => { if (!document.hidden) setElapsed((e) => e + 1); }, 1000);
    return () => clearInterval(id);
  }, [mode, showBrief, cleared, feedbackOpen]);
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
  const dialogBelow = narrow && ((!!player.script && !!(player.narration || player.waiting)) || !!storyAsk || !!guideLeft?.length);
  useEffect(() => { if (cleared && mode === 'story' && !scriptRunning) { const t = setTimeout(() => setResultOpen(true), 900); return () => clearTimeout(t); } return undefined; }, [cleared, mode, scriptRunning]);

  /* ----- 오디오 ----- */
  useEffect(() => { const a = getAudio(); a.setSong('game'); a.setBgm({ on: bgmOn }); saveProgress('bm2-bgm', bgmOn); }, [bgmOn]);
  useEffect(() => { getAudio().setSfx(sfxOn); }, [sfxOn]);
  // 자유 스튜디오: 장비를 놓기 전에 정해진 듣는 곳(방송)에 머물면 제대로 이은 PA도 조용하다
  //  → 스피커가 놓여 있고 방송이 안 나가면 객석, 스피커 없이 방송만 나가면 방송 (직접 고르면 그대로)
  useEffect(() => {
    if (mode !== 'sandbox' || listenPicked.current) return;
    const speaker = Object.values(st.devices).some((d) => d.placed && (d.type === 'speaker' || d.type === 'passive_speaker'));
    const want = speaker && !actual.stream.live ? 'main' : !speaker && actual.stream.live ? 'stream' : null;
    if (want && want !== listen) setListen(want);
  }, [st, actual.stream.live, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { getAudio().setStage({}); stopAllSpeech(); }, []);
  // 스튜디오: Ctrl+Z(⌘Z)로 되돌리기 (글을 쓰는 중에는 그대로)
  useEffect(() => {
    if (mode !== 'sandbox') return undefined;
    const onKey = (e) => {
      if (e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      game.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, game.undo]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // 드럼: 생소리(객석·무대에서만) + 마이크로 잡은 부분 (킥 마이크 = 쿵, 스네어 마이크 = 딱, 오버헤드 = 심벌·전체)
    const kit = 0.7 * Math.max(0, ...Object.values(heard).filter((h) => h.acoustic && h.kind === 'drum').map((h) => lvToVol(h.level)));
    const kickM = byType(['kick_mic']), snareM = byType(['snare_mic']), ohM = byType(['overhead_mic']);
    const perf = game.performing;
    getAudio().setStage({
      guitar: perf ? byType(['e_guitar']) : 0,
      keys: perf ? byType(['keyboard']) : 0,
      piano: perf ? byType(['digital_piano']) : 0,
      bass: perf ? byType(['bass_guitar']) : 0,
      kick: perf ? Math.max(kit, kickM, ohM * 0.45) : 0,
      snare: perf ? Math.max(kit, snareM, ohM * 0.8) : 0,
      hats: perf ? Math.max(kit * 0.9, ohM, snareM * 0.35) : 0,
      laptop: byType(['laptop']),
      hum: humAmt, thin, clip, reverb,
      feedback: talking && actual.feedback && (inRoom) ? 1 : talking && actual.ringing && inRoom ? 0.25 : 0,
    });
  }, [actual, listen, game.performing, talking]); // eslint-disable-line react-hooks/exhaustive-deps
  // 사람 말소리
  useEffect(() => {
    const heard = actual.heard[listen] ?? {};
    const mics = Object.entries(heard).filter(([src]) => ['dynamic_mic', 'condenser_mic', 'wireless_mic'].includes(st.devices[src]?.type));
    const lv = Math.max(-99, ...mics.map(([, h]) => h.level));
    // 가장 크게 들리는 마이크가 꽂힌 채널의 EQ를 말소리에 그대로 건다
    const loud = mics.sort((a, b) => b[1].level - a[1].level)[0]?.[0];
    const ch = loud ? actual.channelOf(loud) : null;
    const c = ch ? st.channels[ch.index - 1] : null;
    const eq = c ? { high: c.eqHigh ?? 0, mid: c.eqMid ?? 0, freq: c.eqFreq ?? 1000, low: c.eqLow ?? 0, lowCut: !!c.lowCut, cutFreq: c.lowCutFreq ?? 100 } : null;
    setTalk(sfxOn && talking ? { volume: lvToVol(lv), phrases: PHRASES[st.venue] ?? PHRASES.sandbox, who: TALK_VOICE[st.venue] ?? 'talk_m', eq } : null);
  }, [actual, listen, talking, sfxOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // 스페이스바 = 말하기
  useEffect(() => {
    const down = (e) => {
      if (e.code !== 'Space' || e.repeat || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      // 단추·다른 창에 초점이 있으면 스페이스는 그 단추를 누르는 데 쓴다
      if (e.target.closest?.('button, a, [role=slider], [role=radio], [role=tab], [role=dialog]') || document.querySelector('[role=dialog][aria-modal=true]')) return;
      e.preventDefault(); game.setPtt(true);
    };
    const up = (e) => { if (e.code === 'Space') game.setPtt(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 튜토리얼: 그 파트 목소리를 받은 뒤 대본 자동 시작 (웹사이트판은 파트별로 따로 받는다 · 느리면 8초 뒤 그냥 시작)
  const [voiceLoading, setVoiceLoading] = useState(false);
  useEffect(() => {
    if (!tutorial?.steps) return undefined;
    let alive = true;
    const t = setTimeout(() => { if (alive) setVoiceLoading(true); }, 250);
    loadVoiceWithin([spec.id, 'common']).then(() => {
      clearTimeout(t);
      if (!alive) return;
      setVoiceLoading(false);
      player.start(tutorial.steps, { practice: tutorial.practice, auto: !!tutorial.auto, speed: loadProgress('bm2-speed', 1), onDone: tutorial.onDone, onStep: tutorial.onStep, from: tutorial.from ?? 0 });
    });
    return () => { alive = false; clearTimeout(t); };
  }, [tutorial?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  // 스토리: 정답 보기 해설 목소리는 미리 받아 둔다
  useEffect(() => { if (mode === 'story') { loadVoice('story'); loadVoice('common'); } }, [mode]);
  useEffect(() => { if (initialAuto) startAuto(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 길잡이 "대신 해 주세요": 이 한 단계만 유령 손이 한다
  const doForMe = (op) => {
    if (op.op === 'talk') { game.setAutoTalk(true); return; }
    // 페이드: 페이더가 이미 목표 자리면 반대쪽 끝에 둔 다음 천천히 (0→0은 페이드가 아니다)
    if (op.op === 'fade') {
      const now = op.ch ? game.stRef.current.channels[op.ch - 1]?.fader : game.stRef.current.master.mainFader;
      if (Math.abs((now ?? 0) - op.to) <= 3) {
        const start = op.to <= 3 ? 75 : 0;
        game.apply(op.ch ? { op: 'ch', ch: op.ch, key: 'fader', value: start } : { op: 'master', key: 'mainFader', value: start }, { visual: false });
        setTimeout(() => game.apply(op), 400);
        return;
      }
    }
    game.apply(op);
    if (op.op === 'connect' || op.op === 'disconnect') game.setPending(null);
  };
  // 처음 상태와 달라졌는지 (놓기·케이블·손잡이·장비 설정) — 누를 때만 잰다
  const touched = () => {
    const sig = (s) => JSON.stringify([Object.values(s.devices).map((d) => [d.id, d.placed, d.slot]), s.connections.map((c) => c.id), s.channels, s.master, s.dev, s.atem, s.obs]);
    return sig(game.stRef.current) !== sig(buildRuntime(spec));
  };
  const askStartAuto = () => (touched() ? setAskAuto(true) : startAuto());
  const startAuto = () => {
    setAskAuto(false);
    if (!spec.solution) return;
    setShowBrief(false); setUsedAuto(true); setGuideOn(false); game.reset(); setResetKey((k) => k + 1);
    Promise.all([loadVoiceWithin(['story'], 6000), new Promise((r) => setTimeout(r, 400))])
      .then(() => player.start(spec.solution, { speed: loadProgress('bm2-speed', 1), onDone: () => {} }));
  };

  // 선택한 장비 → 장비 탭
  useEffect(() => { if (game.selected && mode !== 'sandbox') setTab('device'); }, [game.selected]); // eslint-disable-line react-hooks/exhaustive-deps
  // 대본이 장비를 조작할 때 해당 장비 선택
  useEffect(() => {
    if (!player.script || !game.action?.byScript || !game.action?.device || !st.devices[game.action.device]) return;
    const k = game.action.ctl?.kind;
    if (k === 'mixer' || k === 'master') setConsoleOpen(true);
    else game.setSelected(game.action.device);
  }, [game.action?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const inv = Object.entries(st.cables).filter(([k]) => CABLES[k]);
  const cableChoices = st.unlimited ? Object.keys(CABLES) : inv.map(([k]) => k);
  // 케이블 잇기 연습: ① 케이블 고르기 → ② 첫 단자 → ③ 둘째 단자를 한 단계씩 짚어 준다 (카메라도 그 단자로)
  const guide = useMemo(() => connectGuide(ask, st, game.cable, game.pending), [ask?.at, st, game.cable, game.pending]); // eslint-disable-line react-hooks/exhaustive-deps
  // 큐 저장 연습인데 프로그래머가 저장할 장면과 달라졌으면(CLEAR를 잘못 누르는 등) 다시 만들라고 알린다
  const redo = player.waiting?.redo && practiceMiss(player.waiting, st) ? player.waiting.redo : null;
  const highlight = guide ? { device: guide.target.d, port: guide.target.p } : ask ? targetOf(ask, st) : null;
  // 연습 중 엉뚱한 단자를 골라 두었으면 풀어 준다 (반짝이는 단자를 누르면 바로 이어지게)
  useEffect(() => {
    if (guide?.wrongPending) { game.setPending(null); game.notify('info', '연습 중이에요. 반짝이는 단자부터 눌러 보세요.'); }
  }, [guide?.wrongPending]); // eslint-disable-line react-hooks/exhaustive-deps
  // 다음에 누를 단자가 바뀌면 카메라가 그 단자로 다가간다 (시점 고정 중이면 그대로)
  const guideKey = guide ? `${guide.stage}:${guide.target.d}.${guide.target.p}` : null;
  useEffect(() => {
    if (!guide || lockView || !st.devices[guide.target.d]?.placed) return;
    setFocusRequest({ id: guide.target.d, port: guide.target.p, key: Date.now() });
  }, [guideKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // 믹서 손잡이를 돌려야 하는 단계면 콘솔을 저절로 열고, 닫혀 있으면 단추를 반짝인다
  const mixerAsk = !!ask && ['ch', 'master', 'fade'].includes(ask.op);
  useEffect(() => {
    const w = ask;
    if (!w) return undefined;
    const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches;
    const panel = panelDeviceOf(w, st);
    if (mixerAsk) setConsoleOpen(true);
    else {
      // 좁은 화면: 콘솔을 닫아 3D·연결표·장비 패널이 보이게
      if (narrow) setConsoleOpen(false);
      // 케이블 잇기는 어느 화면이든 연결표 탭을 펼친다 (3D에서 단자가 가려져도 표에서 같은 단자가 반짝인다)
      if (w.op === 'connect') setTab('ports');
      // 장비 설정·ATEM·OBS·분리 등: 그 단추가 든 장비 패널을 열고 카메라도 그쪽으로
      else if (panel && st.devices[panel]?.placed) {
        game.setSelected(panel); setTab('device');
        if (!lockView) setFocusRequest({ id: panel, key: Date.now() });
      } else if (w.op === 'disconnect') setTab('ports');
      // 장비 놓기: 전체가 보이게 빼고, 미션 탭의 "+ 배치" 단추도 보이게
      else if (w.op === 'place') {
        setTab('mission');
        if (!lockView) setFocusRequest({ id: 'overview', key: Date.now() });
      }
    }
    // 눌러야 할 단추를 찾아 보이게 굴리고, 그 단계가 끝날 때까지 반짝인다.
    // 탭을 바꾸거나(조명 콘솔) 한 번 누를 때마다 다음 단추가 달라질 수 있어 잠깐마다 다시 찾는다.
    // 표시는 React가 건드리지 않는 data-bm-target 속성으로 (class로 하면 단추 모양이 바뀔 때 지워진다)
    let shown = null;
    let checked = null; // 마지막으로 보이는지 확인한 때의 단추 이름 + 스크롤 상자 모양
    const unmark = () => { shown?.removeAttribute('data-bm-target'); shown = null; };
    const mark = () => {
      const hit = findPracticeTarget(w, game.stRef.current);
      if (hit?.el !== shown) unmark();
      // 단추가 사라졌으면(다른 탭·다른 장비) 돌아왔을 때 다시 보이게 맞춘다
      if (!hit) { checked = null; return; }
      shown = hit.el;
      if (!shown.hasAttribute('data-bm-target')) shown.setAttribute('data-bm-target', '');
      // 단추가 바뀌었거나 스크롤 상자의 자리·높이가 바뀌었으면(휴대폰에서 "직접 해 보세요" 상자가 뜨는 등) 다시 본다.
      // 플레이어가 직접 굴린 것은 상자 모양이 그대로라 건드리지 않는다
      const sig = `${hit.key}|${scrollBoxShape(shown)}`;
      if (checked !== sig) {
        checked = sig;
        // 이미 다 보이면 그대로 두고, 가려져 있을 때만 가운데로 굴린다
        if (!fullyVisible(shown)) shown.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    };
    document.querySelectorAll('[data-bm-target]').forEach((x) => x.removeAttribute('data-bm-target'));
    const t = setTimeout(mark, mixerAsk ? 180 : 300);
    const iv = setInterval(mark, 500);
    return () => { clearTimeout(t); clearInterval(iv); unmark(); };
  }, [ask?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  // 스토리 길잡이: 짚은 단계를 해내면 다음 할 일로 (이미 해 둔 단계는 건너뛴다)
  useEffect(() => {
    if (!guiding) return;
    const r = advanceGuide({ phase: gPhase, list: gSteps, cur: gCur }, { plan, st, before: gBefore.current, game, unmet: game.objectives.filter((o) => !o.ok) });
    if (!r) return;
    gBefore.current = st;
    setGPhase(r.phase); setGList(r.phase === 'plan' ? plan : r.list); setGCur(r.cur);
    const msg = { 'back-air': '이 PTZ 카메라가 지금 방송 중이에요. 먼저 다른 카메라로 넘겨요.', 'back-aim': '구도가 풀렸어요. 다시 맞춘 다음 저장해요.', next: '좋아요! 다음 할 일을 짚어 줄게요.', finish: '거의 다 됐어요! 남은 곳을 짚어 줄게요.' }[r.note];
    if (msg) game.notify(r.note === 'back-air' ? 'err' : r.note.startsWith('back') ? 'info' : 'ok', msg, { soft: true });
  }, [st, game.talking, game.latched, storyAsk?.at, guiding, gPhase]); // eslint-disable-line react-hooks/exhaustive-deps
  // 대사가 장비를 가리키면 카메라가 그쪽으로 (시점 고정 중에는 그대로)
  useEffect(() => {
    const id = player.narration?.focus;
    // 'overview'는 전체 보기 (조명 두 대처럼 여러 곳을 같이 봐야 할 때)
    if (id && !lockView && (id === 'overview' || st.devices[id]?.placed)) setFocusRequest({ id, key: Date.now() });
  }, [player.narration?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  // 다음 장면으로 넘어가면 실습실은 닫는다
  useEffect(() => { setLab(null); player.setHold(false); }, [player.narration?.i]); // eslint-disable-line react-hooks/exhaustive-deps
  const openLab = (l) => { setLab(l); player.setHold(true); };
  const closeLab = () => { setLab(null); player.setHold(false); };
  // 베타 의견에 붙일 위치: 미션·파트 이름과 대화 장면 번호
  useEffect(() => {
    patchBetaContext({ title: spec.title, id: spec.id, step: player.narration ? `${(player.narration.i ?? 0) + 1}/${player.narration.n}` : undefined });
  }, [spec.id, player.narration?.i]); // eslint-disable-line react-hooks/exhaustive-deps
  // 이 화면을 떠나면 위치 정보를 지운다 (목록 화면에서 보낸 의견이 마지막 미션으로 적히지 않게)
  useEffect(() => () => patchBetaContext({ title: undefined, id: undefined, step: undefined }), []);
  const onePending = game.pending ? `${st.devices[game.pending.d]?.name ?? game.pending.d} · ${portLabel(st, game.pending.d, game.pending.p)}` : null;
  const doneCount = game.objectives.filter((o) => o.ok).length;

  const stars = usedAuto ? 1 : Math.max(1, (hints > 0 || usedGuide ? 2 : 3) - (overtime ? 1 : 0));
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
            <button type="button" onClick={() => { if (hints >= (spec.hints?.length ?? 0) && plan.length && !guideOn) startGuide(); else { setHints((h) => Math.min((spec.hints?.length ?? 0), h + 1)); setTab('mission'); } }} className="flex min-h-9 min-w-9 items-center justify-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs font-bold" title="글 힌트를 하나씩 보여 주고, 다 보면 다음 할 일을 짚어 줍니다" aria-label="힌트"><Lightbulb size={16} /> <span className="hidden sm:inline">힌트</span></button>
            {spec.solution && <button type="button" onClick={askStartAuto} className="ml-1 flex min-h-9 min-w-9 items-center justify-center gap-1 px-2 py-1 rounded bg-violet-500/20 text-violet-200 hover:bg-violet-500/30 text-xs font-bold" title="정답을 유령 손이 직접 보여 줍니다" aria-label="정답 보기"><Wand2 size={16} /> <span className="hidden sm:inline">정답 보기</span></button>}
          </>
        )}
        <button type="button" onClick={() => setBgmOn(!bgmOn)} className={`p-1.5 rounded ${bgmOn ? 'text-sky-300' : 'text-slate-500'} hover:bg-slate-800`} title="배경음악" aria-label="배경음악 켜기/끄기" aria-pressed={bgmOn}><Music size={17} /></button>
        <button type="button" onClick={() => setSfxOn(!sfxOn)} className={`p-1.5 rounded ${sfxOn ? 'text-sky-300' : 'text-slate-500'} hover:bg-slate-800`} title="현장 소리·효과음" aria-label="현장 소리 켜기/끄기" aria-pressed={sfxOn}>{sfxOn ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
        <button type="button" onClick={() => setVoiceOn(!voiceOn)} className={`p-1.5 rounded ${voiceOn ? 'text-sky-300' : 'text-slate-500'} hover:bg-slate-800`} title="내레이션 음성" aria-label="내레이션 음성" aria-pressed={voiceOn}><MessageSquare size={17} /></button>
        <button type="button" onClick={openFeedback} className="flex items-center gap-1 rounded bg-amber-400 px-1.5 py-1 text-[11px] font-black text-slate-900 hover:bg-amber-300" title="불편한 점이나 아이디어를 개발자에게 보내요" aria-label="베타 의견 보내기"><MessageSquarePlus size={15} /><span className="hidden sm:inline">의견</span></button>
      </header>

      {/* 가운데: 넘치면 아래 막대(케이블·말하기) 위로 덮이지 않게 안에서 자른다 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* 3D — 좁은 화면에서 대화 중이면 3D는 위쪽 일부, 대화 상자는 그 아래 (3D를 가리지 않게) */}
        {/* 좁은 화면: 3D는 정해진 높이, 옆 패널이 남은 자리를 채운다 (콘솔을 열면 3D가 남은 자리) */}
        <div className={`relative ${dialogBelow ? `flex-none ${consoleOpen ? 'h-[13vh]' : 'h-[30vh]'}` : consoleOpen ? 'flex-1 min-h-[18vh]' : 'flex-none h-[32vh]'} lg:min-h-0 lg:h-auto lg:flex-1`}>
          {gl ? (
            <Venue3D st={st} sim={actual} venueId={st.venue} talking={talking} performing={game.performing} selectedChannel={game.selCh}
              pending={game.pending} selectedCable={game.cable} selectedDevice={game.selected} labels={labels} resetKey={resetKey}
              focusRequest={focusRequest} lockView={lockView} follow={follow} action={game.action} viewers={actual.stream.live ? 1280 : 0}
              highlight={highlight} holdOnPending={!!guide} free={mode === 'sandbox'} sandboxApi={sandboxApi}
              onPortClick={game.clickPort} onSelectDevice={game.setSelected} onDisconnect={game.disconnect}
              onPlace={(id) => game.apply({ op: 'place', device: id })} onCancelPending={() => game.setPending(null)} />
          ) : <NoWebGL hint="'연결표' 탭에서 게임을 계속할 수 있어요." />}
          {/* 3D 보기 도구 */}
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <ViewBtn on={labels} onClick={() => setLabels(!labels)} icon={Tag} label="단자 이름" />
            <ViewBtn on={lockView} onClick={() => setLockView(!lockView)} icon={lockView ? Lock : Unlock} label="시점 고정" />
            <ViewBtn on={follow} onClick={() => setFollow(!follow)} icon={Video} label="조작 따라가기" />
            <ViewBtn onClick={() => { setFocusRequest({ id: 'overview', key: Date.now() }); }} icon={RotateCcw} label="전체 보기" />
          </div>
          {/* 고른 단자 안내: 아래 막대 높이가 바뀌어 3D 화면이 흔들리지 않게 화면 위에 띄운다 */}
          {onePending && (
            <div className="absolute left-1/2 -translate-x-1/2 top-2 z-20 max-w-[90%] truncate rounded-full bg-sky-600/90 px-3 py-1 text-[12px] font-bold text-white shadow-lg pointer-events-none">
              선택한 단자: {onePending} → 연결할 단자를 누르세요
            </div>
          )}
          {/* 알림 */}
          {game.toast && <Toast toast={game.toast} onDone={() => game.setToast(null)} />}
          {voiceLoading && (
            <div className="absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-full bg-slate-900/90 px-3 py-1 text-[12px] font-bold text-slate-200 shadow-lg pointer-events-none">선배 목소리 불러오는 중…</div>
          )}
          {compareOpen && <ListenCompare st={st} sim={actual} listen={listen} setListen={chooseListen} onClose={() => setCompareOpen(false)} />}
          {/* 대화 장면 (튜토리얼 · 정답 보기) */}
          {!dialogBelow && <Dialog player={player} tutorial={!!tutorial} onLab={openLab} guide={guide} redo={redo} />}
          {!dialogBelow && (storyAsk || guideLeft?.length > 0) && <StoryGuideCard item={gShown} n={gCur + 1} total={gSteps.length} finishing={gPhase === 'finish'} st={st} guide={guide} left={storyAsk ? null : guideLeft} onClose={() => setGuideOn(false)} onDo={() => doForMe(gShown.op)} onAuto={spec.solution ? askStartAuto : null} onRestart={onRestart} />}
          {lab && <LabOverlay lab={lab} onClose={closeLab} />}
        </div>
        {dialogBelow && <Dialog player={player} tutorial={!!tutorial} onLab={openLab} guide={guide} redo={redo} inline />}
        {dialogBelow && (storyAsk || guideLeft?.length > 0) && <StoryGuideCard inline item={gShown} n={gCur + 1} total={gSteps.length} finishing={gPhase === 'finish'} st={st} guide={guide} left={storyAsk ? null : guideLeft} onClose={() => setGuideOn(false)} onDo={() => doForMe(gShown.op)} onAuto={spec.solution ? askStartAuto : null} onRestart={onRestart} />}

        {/* 사이드 패널 */}
        <aside className={`lg:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/60 ${consoleOpen ? 'hidden lg:flex' : 'flex'} flex-col min-h-0 ${dialogBelow ? 'flex-1 shrink min-h-[18vh]' : 'flex-1'} lg:h-auto lg:flex-none`}>
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
              <MissionPanel spec={spec} game={game} tutorial={mode === 'tutorial'} placeAsk={player.waiting?.op === 'place' ? player.waiting.device : null} hints={hints} onHint={() => setHints((h) => Math.min(spec.hints?.length ?? 0, h + 1))}
                guideReady={plan.length > 0 && !player.script && !cleared} guideOn={guideOn} onGuide={() => (guideOn ? setGuideOn(false) : startGuide())} onRestart={onRestart} />
            )}
            {tab === 'device' && sandbox && game.selected && <sandbox.Tools game={game} id={game.selected} setPlacing={setPlacing} placing={placing} />}
            {tab === 'device' && (game.selected && st.devices[game.selected]
              ? <DevicePanel key={game.selected} game={game} id={game.selected} />
              : <DeviceList game={game} onFocus={(id) => setFocusRequest({ id, key: Date.now() })} />)}
            {tab === 'device' && game.selected && <button type="button" onClick={() => game.setSelected(null)} className="text-xs text-slate-400 hover:text-slate-200">← 장비 목록</button>}
            {tab === 'ports' && <PortBoard game={game} guide={guide} />}
            {tab === 'log' && <LogPanel log={game.log} />}
          </div>
        </aside>
      </div>

      {/* 아래: 케이블 가방 · 말하기 · 듣는 위치 · 콘솔 */}
      <div className="relative z-20 shrink-0 border-t border-slate-800 bg-slate-950">
        <div className="flex flex-wrap items-center gap-2 px-2 sm:px-3 py-1.5">
          {/* 케이블이 많으면(스튜디오) 좁은 화면에선 한 줄로 옆으로 밀어 보게 (막대가 높아지지 않게) */}
          <div className="flex max-w-full items-center gap-1 overflow-x-auto flex-nowrap sm:flex-wrap" role="radiogroup" aria-label="케이블 선택">
            <Cable size={15} className="shrink-0 text-slate-400" />
            {cableChoices.length === 0 && <span className="text-[11px] text-slate-500">가방에 케이블 없음</span>}
            {cableChoices.map((k) => {
              const n = st.unlimited ? '∞' : st.cables[k];
              const on = game.cable === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} disabled={!st.unlimited && !n} onClick={() => game.setCable(on ? null : k)} title={`${CABLES[k].name} — ${CABLES[k].desc}`}
                  className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border disabled:opacity-35 ${on ? 'bg-white text-slate-900 border-white' : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'} ${guide?.stage === 'cable' && guide.cable === k ? 'bm-target' : ''}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CABLES[k].stroke }} />{CABLES[k].short} <span className="font-mono opacity-70">×{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <button type="button" data-ctl="talk-ptt"
              onPointerDown={(e) => { e.preventDefault(); getAudio().unlock(); game.setPtt(true); }} onPointerUp={() => game.setPtt(false)} onPointerLeave={() => game.setPtt(false)} onPointerCancel={() => game.setPtt(false)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black select-none touch-none ${game.ptt ? 'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,.7)]' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
              title="누르고 있는 동안 말합니다 (스페이스바)"><Mic size={14} /> 말하기</button>
            <Toggle small ctl="talk-auto" on={game.autoTalk} color="green" onClick={() => game.setAutoTalk(!game.autoTalk)} title="진행자가 계속 말하게 하기">자동 말하기</Toggle>
            {(st.venue === 'live_stage' || Object.values(st.devices).some((d) => INSTRUMENTS.has(d.type))) && (
              <Toggle small on={game.performing} color="green" onClick={() => game.setPerforming(!game.performing)} title="밴드 연주"><Guitar size={12} className="inline" /> 연주</Toggle>
            )}
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-slate-300" title="어디서 들리는 소리를 들을지 고릅니다"><Ear size={14} /> 듣는 곳</span>
            <Seg small value={listen} options={LISTEN.filter(([k]) => k !== 'headphones' || Object.values(st.devices).some((d) => d.type === 'headphones'))} onChange={chooseListen} />
            <Toggle small on={compareOpen} color="sky" onClick={() => setCompareOpen(!compareOpen)} title="현장(객석)에서 들리는 소리와 방송으로 나가는 소리를 나란히 비교합니다">A/B 비교</Toggle>
            {st.mixerId && st.devices[st.mixerId]?.placed && (
              <button type="button" onClick={() => { if (!consoleOpen && !lockView) setFocusRequest({ id: st.mixerId, key: Date.now() }); setConsoleOpen(!consoleOpen); }} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-black ${consoleOpen ? 'bg-sky-500 text-white' : mixerAsk ? 'bg-amber-400 text-slate-900 animate-pulse ring-2 ring-amber-200' : 'bg-sky-700 text-white ring-1 ring-sky-300/60'}`}
                title="믹서의 GAIN·EQ·페이더를 크게 열어 직접 돌립니다">
                <SlidersHorizontal size={16} /> {consoleOpen ? '믹서 콘솔 닫기' : '믹서 콘솔 열기'}
              </button>
            )}
          </div>
        </div>
        {consoleOpen && st.mixerId && (
          <div className={`px-2 pb-2 ${dialogBelow ? 'max-h-[32vh]' : 'max-h-[46vh]'} overflow-y-auto`}><Console game={game} /></div>
        )}
      </div>

      {showBrief && <Briefing spec={spec} heading={heading} onStart={() => { setShowBrief(false); getAudio().unlock(); }} onAuto={spec.solution ? startAuto : null} />}
      {askAuto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={() => setAskAuto(false)}>
          <div role="alertdialog" aria-modal="true" aria-label="정답 보기 확인" className="w-full max-w-sm rounded-2xl border border-violet-400/60 bg-slate-950 p-4 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 font-black"><Wand2 size={18} className="text-violet-300" /> 정답 보기로 처음부터 볼까요?</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">지금까지 한 것이 지워지고 유령 손이 처음부터 해 보여요. 이렇게 끝내면 <b className="text-amber-200">★1</b>이에요. 다음 한 단계만 알고 싶다면 <b>다음 할 일 짚어 주기</b>(★2까지)가 있어요.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={startAuto} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500">지우고 정답 보기</button>
              {plan.length > 0 && !guideOn && <button type="button" onClick={() => { setAskAuto(false); startGuide(); setTab('mission'); }} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-slate-900 hover:bg-amber-400">다음 할 일만 짚어 주기</button>}
              <button type="button" onClick={() => setAskAuto(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">계속 직접 하기</button>
            </div>
          </div>
        </div>
      )}
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

// 스토리 길잡이 카드: 지금 할 일 한 줄(목표 값까지) + 선배가 왜 그렇게 하는지 (케이블은 순서대로)
// left: 짚을 할 일을 다 했는데도 남은 목표가 있으면 그 목록
function StoryGuideCard({ item, n, total, finishing = false, st, guide, left = null, inline = false, onClose, onDo, onAuto, onRestart }) {
  const say = item?.step?.say;
  const box = inline ? 'shrink-0 border-y border-amber-400/50 bg-slate-950 px-3 py-2' : 'absolute inset-x-2 bottom-2 z-20 mx-auto max-w-2xl rounded-xl border border-amber-400/60 bg-slate-950/95 p-3 shadow-2xl';
  return (
    <div className={box} role="status" aria-label="다음 할 일">
      <div className="flex items-center gap-2">
        <Compass size={16} className="shrink-0 text-amber-300" />
        {left
          ? <b className="text-sm text-amber-200">{left.some((o) => o.check?.type === 'noOnAirMove') ? '이번 판은 다시 해야 해요' : '거의 다 됐어요!'}</b>
          : <b className="text-sm text-amber-200">다음 할 일 <span className="font-mono text-[11px] text-amber-300/80">{finishing ? '마무리' : `${n}/${total}`}</span></b>}
        {!left && <button type="button" onClick={onDo} className="ml-auto flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[12px] font-bold text-slate-200 hover:bg-slate-700" title="이 한 단계만 유령 손이 대신 합니다"><Hand size={13} /> 대신 해 주세요</button>}
        <button type="button" onClick={onClose} className={`${left ? 'ml-auto ' : ''}rounded p-1 text-slate-400 hover:bg-slate-800`} aria-label="길잡이 끄기" title="길잡이 끄기"><X size={15} /></button>
      </div>
      {left ? (
        <>
          <p className="mt-1 text-sm text-amber-100">아직 남은 목표가 있어요. 미션 탭의 목표와 상태 칸을 확인해 보세요.</p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-slate-200">{left.map((o, k) => <li key={k} className="flex gap-1.5"><Circle size={12} className="mt-0.5 shrink-0 text-slate-500" />{o.label}</li>)}</ul>
          {/* 방송 중에 PTZ를 움직인 기록처럼 되돌릴 수 없는 실수는 다시 하기로 */}
          {left.some((o) => o.check?.type === 'noOnAirMove') && <p className="mt-1 text-[12px] font-bold text-red-200">방송 중에 카메라를 움직인 기록은 지울 수 없어요. 다시 하기로 처음부터 해 보세요. 움직이기 전에 그 카메라를 PGM에서 먼저 빼는 게 핵심이에요.</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {onRestart && <button type="button" onClick={onRestart} className="rounded-md bg-sky-600 px-2 py-1 text-[12px] font-bold text-white hover:bg-sky-500">다시 하기</button>}
            {onAuto && <button type="button" onClick={onAuto} className="rounded-md bg-violet-600/80 px-2 py-1 text-[12px] font-bold text-white hover:bg-violet-500">정답 보기로 처음부터 보기</button>}
          </div>
        </>
      ) : guide ? (
        <ol className="mt-1.5 grid gap-1 sm:grid-cols-3" aria-label="연결 순서">
          {guide.steps.map((g, k) => (
            <li key={k} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] leading-snug ${g.done ? 'bg-green-900/30 text-green-200' : g.active ? 'bg-amber-400 text-slate-900 animate-pulse' : 'bg-slate-900/60 text-slate-400'}`}>
              <span className={`shrink-0 h-4 w-4 rounded-full text-[10px] font-black flex items-center justify-center ${g.done ? 'bg-green-500 text-slate-900' : g.active ? 'bg-slate-900 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>{g.done ? '✓' : k + 1}</span>
              <span>{g.text}</span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-1 text-sm font-bold text-amber-100">{guideText(item?.op, st)}</p>}
      {!left && say && <p className="mt-1 text-[12px] leading-relaxed text-slate-300"><span className="font-bold text-violet-300">서진 선배</span> · {say}</p>}
    </div>
  );
}

function MissionPanel({ spec, game, tutorial, placeAsk, hints, onHint, guideReady, guideOn, onGuide, onRestart }) {
  const { objectives, st } = game;
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-sky-950/40 border border-sky-800/50 p-2.5 text-sm text-sky-100 leading-relaxed">{spec.mission}</div>
      {/* 튜토리얼은 선배가 "놓아 보세요" 할 때 그 장비만 */}
      {(!tutorial || placeAsk) && <Unplaced game={game} only={tutorial ? placeAsk : null} />}
      <ul className="space-y-1.5" aria-label="목표">
        {objectives.map((o, i) => {
          // 방송 중에 PTZ를 움직인 기록은 지울 수 없다 → 빈 동그라미 대신 실패 표시와 다시 하기 안내
          const lost = !o.ok && o.check?.type === 'noOnAirMove';
          return (
            <li key={i} className={`flex items-start gap-2 text-sm ${o.ok ? 'text-green-300' : lost ? 'text-red-300' : 'text-slate-200'}`}>
              {o.ok ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : lost ? <XCircle size={16} className="shrink-0 mt-0.5" /> : <Circle size={16} className="shrink-0 mt-0.5 text-slate-500" />}
              <span>{o.label}{lost && (
                <span className="block text-[11px] text-red-200/80">방송 중에 움직인 기록은 지울 수 없어요. 처음부터 다시 해 보세요.
                  {onRestart && <button type="button" onClick={onRestart} className="ml-1.5 rounded bg-sky-600 px-1.5 py-0.5 text-[11px] font-bold text-white hover:bg-sky-500">다시 하기</button>}
                </span>
              )}</span>
            </li>
          );
        })}
      </ul>
      {/* 튜토리얼에서는 선배가 직접 짚어 주므로 정답이 될 실마리는 감춘다 */}
      {!tutorial && <Status game={game} />}
      {spec.hints?.length > 0 && (
        <div className="space-y-1.5">
          {spec.hints.slice(0, hints).map((h, i) => <div key={i} className="rounded bg-amber-950/40 border border-amber-800/50 p-2 text-xs text-amber-100"><b>힌트 {i + 1}</b> · {h}</div>)}
          {hints < spec.hints.length && <button type="button" onClick={onHint} className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1"><Lightbulb size={13} /> 힌트 {hints + 1} 보기</button>}
        </div>
      )}
      {/* 글 힌트로도 막히면: 정답 풀이에서 다음 할 일 하나만 반짝여 짚어 준다 */}
      {!tutorial && (guideReady || guideOn) && (
        <button type="button" onClick={onGuide} aria-pressed={!!guideOn}
          className={`w-full flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold ${guideOn ? 'border-amber-300 bg-amber-400 text-slate-900' : 'border-amber-500/60 bg-amber-950/40 text-amber-200 hover:bg-amber-900/40'}`}>
          <Compass size={14} /> {guideOn ? '길잡이 끄기' : '다음 할 일 짚어 주기'}{!guideOn && <span className="font-normal text-amber-300/80">· 쓰면 ★2까지</span>}
        </button>
      )}
      {spec.briefing && <details className="text-xs text-slate-400"><summary className="cursor-pointer">상황 설명 다시 보기</summary>{spec.briefing.map((b, i) => <p key={i} className="mt-1 leading-relaxed">{b}</p>)}</details>}
      {st.faults.length > 0 && <div className="text-[11px] text-slate-400">이 현장에는 숨은 문제 {st.faults.length}개가 있습니다. 소리·화면이 가는 길을 따라가며 찾아보세요.</div>}
    </div>
  );
}

// 아직 놓지 않은 장비 — 3D 화면이 확대돼 "+ 배치" 단추가 안 보여도 여기서 놓을 수 있다
// 요소가 화면과 자기를 감싼 스크롤 상자 안에 (가장자리 여유를 두고) 다 보이는지
function fullyVisible(el, margin = 16) {
  const r = el.getBoundingClientRect();
  if (!r.width || r.top < margin || r.left < 0 || r.bottom > window.innerHeight - margin || r.right > window.innerWidth) return false;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    const ov = cs.overflowY + cs.overflowX;
    if (!/(auto|scroll|hidden)/.test(ov)) continue;
    // 아무것도 잘라 내지 않는 상자(묶음 단추의 테두리 등)는 건너뛴다
    if (p.scrollHeight <= p.clientHeight && p.scrollWidth <= p.clientWidth) continue;
    const inset = /(auto|scroll)/.test(ov) ? 4 : 0;
    const pr = p.getBoundingClientRect();
    if (r.top < pr.top + inset || r.bottom > pr.bottom - inset || r.left < pr.left || r.right > pr.right) return false;
  }
  return true;
}

// 요소를 감싼, 실제로 위아래로 굴러가는 상자의 자리·높이 (그 상자 자신의 스크롤로는 바뀌지 않는다)
function scrollBoxShape(el) {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(p).overflowY) || p.scrollHeight <= p.clientHeight) continue;
    const pr = p.getBoundingClientRect();
    return `${Math.round(pr.top)}:${p.clientHeight}:${window.innerHeight}`;
  }
  return `${window.innerHeight}`;
}

function Unplaced({ game, only }) {
  const left = Object.values(game.st.devices).filter((d) => !d.placed && d.slot && (!only || d.id === only));
  if (!left.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-slate-400">아직 놓지 않은 장비</span>
      {left.map((d) => (
        <button key={d.id} type="button" data-ctl={`mission-place-${d.id}`} onClick={() => game.apply({ op: 'place', device: d.id })}
          className="rounded-full border border-sky-400/70 bg-sky-900/40 px-2 py-0.5 font-bold text-sky-100 hover:bg-sky-800/60">+ {d.name ?? DEVICE_TYPES[d.type]?.name} 배치</button>
      ))}
    </div>
  );
}

// 현재 상태 요약 (무엇이 문제인지 실마리)
function Status({ game }) {
  const { actual, nominal, talking } = game;
  const items = [];
  const stuck = stuckAtMixer(game.st, nominal);
  if (stuck) items.push(['warn', stuck]);
  if (nominal.feedback) items.push(['err', '하울링 위험! (말하면 "삐—")']);
  else if (nominal.ringing) items.push(['warn', '하울링 직전 (울림이 큼)']);
  if (nominal.clips.length) items.push(['err', `클리핑(찢어짐): ${nominal.clips.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.hum) items.push(['warn', `험 잡음: ${nominal.humSources.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.deadPhantom.length) items.push(['warn', `소리 없음(팬텀 전원 필요?): ${nominal.deadPhantom.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
  if (nominal.overCut?.length) items.push(['warn', `목소리가 얇음(LOW CUT 주파수가 너무 높음): ${nominal.overCut.map((s) => game.st.devices[s]?.name ?? s).join(', ')}`]);
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

function DeviceList({ game, onFocus }) {
  const { st } = game;
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-slate-400">장비를 고르면 3D 화면이 그 장비로 확대되고 실제 버튼·노브를 조작할 수 있습니다. 3D에서 장비를 눌러도 됩니다 (한 번 더 누르면 더 가까이).</p>
      {Object.values(st.devices).map((d) => {
        const def = DEVICE_TYPES[d.type];
        const Icon = def.icon;
        return (
          <button key={d.id} type="button" onClick={() => { game.setSelected(d.id); if (d.placed) onFocus?.(d.id); }} className="w-full flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 hover:bg-slate-800 px-2 py-1.5 text-left">
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
function targetOf(op, st) {
  if (op.op === 'place' || op.op === 'dev' || op.op === 'move') return { device: op.device };
  // 믹서 조작: 믹서를 가리키고 확대한다
  if (op.op === 'ch' || op.op === 'master' || op.op === 'fade') return { device: op.mixer ?? st.mixerId, zoom: true };
  if (op.op === 'atem') return { device: st.switcherId, zoom: true };
  if (op.op === 'obs') return { device: Object.values(st.devices).find((d) => d.type === 'pc')?.id, zoom: true };
  if (op.op === 'connect') { const [d, p] = op.from.split('.'); const [d2, p2] = op.to.split('.'); return { device: d, port: p, device2: d2, port2: p2 }; }
  return null;
}
