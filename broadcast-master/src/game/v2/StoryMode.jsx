import React, { useMemo, useState } from 'react';
import { ArrowLeft, Star, Play, Mic, MonitorPlay, Church, Guitar, Presentation, Lightbulb, Clapperboard, Joystick, Siren } from 'lucide-react';
import STORY from '../data/story.json';
import { SOLUTIONS } from '../data/solutions.js';
import { loadProgress } from '../ui.jsx';
import { getAudio } from '../audio.js';
import GameScreen from './GameScreen.jsx';

/* =====================================================================
 * 스토리 모드 — 장(챕터) 선택 → 스테이지 → 게임 화면
 * ===================================================================== */
const CH_ICON = { seminar: Mic, youtube: MonitorPlay, church: Church, live: Guitar, lecture: Presentation, light: Lightbulb, vj: Clapperboard, ptz: Joystick, crisis: Siren };
const CH_COLOR = { seminar: 'from-sky-600 to-sky-900', youtube: 'from-pink-600 to-fuchsia-900', church: 'from-amber-600 to-amber-900', live: 'from-violet-600 to-indigo-900', lecture: 'from-blue-600 to-slate-900', light: 'from-orange-500 to-rose-900', vj: 'from-rose-600 to-purple-900', ptz: 'from-teal-600 to-cyan-900', crisis: 'from-red-600 to-red-950' };

export const ALL_STAGES = STORY.chapters.flatMap((c) => c.stages.map((s) => ({ ...s, chapterTitle: c.title, solution: SOLUTIONS[s.id] })));

export default function StoryMode({ onExit, startStage, autoStart }) {
  const [playing, setPlaying] = useState(startStage ?? null);
  const [runKey, setRunKey] = useState(0);
  const [progress, setProgress] = useState(() => loadProgress('bm2-progress', {}));
  const refresh = () => setProgress(loadProgress('bm2-progress', {}));
  const stage = useMemo(() => ALL_STAGES.find((s) => s.id === playing), [playing]);
  if (stage) {
    const idx = ALL_STAGES.findIndex((s) => s.id === stage.id);
    const next = ALL_STAGES[idx + 1];
    return (
      <GameScreen key={`${stage.id}-${runKey}`} spec={stage} mode="story" heading={`${stage.chapterTitle} · 스테이지 ${idx + 1}/${ALL_STAGES.length}`}
        onExit={() => { refresh(); setPlaying(null); }}
        onNext={next ? () => { refresh(); setPlaying(next.id); setRunKey((k) => k + 1); } : null}
        onRestart={() => setRunKey((k) => k + 1)} initialAuto={!!autoStart && runKey === 0 && stage.id === startStage} />
    );
  }
  const total = ALL_STAGES.length;
  const starsTotal = Object.values(progress).reduce((a, b) => a + b, 0);
  // 잠금: 각 장의 첫 스테이지는 앞 장을 하나 이상 깼거나 첫 장이면 열림. 장 안에서는 앞 스테이지를 깨야 열림
  const cleared = (id) => (progress[id] ?? 0) > 0;
  return (
    <div className="min-h-[100dvh] bg-[#0b1220] text-slate-100" onPointerDown={() => getAudio().unlock()}>
      <header className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <button type="button" onClick={onExit} className="p-1.5 rounded hover:bg-slate-800" aria-label="메인 메뉴"><ArrowLeft size={18} /></button>
        <div className="font-black">스토리 모드</div>
        <div className="ml-auto flex items-center gap-1 text-sm text-yellow-300"><Star size={16} className="fill-yellow-300" /> {starsTotal} / {total * 3}</div>
      </header>
      <main className="max-w-5xl mx-auto p-3 sm:p-5 space-y-5">
        <p className="text-sm text-slate-300">첫 출근부터 대형 공연까지 — 현장의 문제를 직접 해결하며 방송·음향·조명·영상 장비를 깊게 익힙니다. 막히면 <b>힌트</b>, 그래도 어려우면 <b>정답 보기</b>로 유령 손이 직접 해 보이는 과정을 볼 수 있어요.</p>
        {STORY.chapters.map((ch) => {
          const Icon = CH_ICON[ch.id] ?? Mic;
          return (
            <section key={ch.id} className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/50">
              <div className={`bg-gradient-to-r ${CH_COLOR[ch.id] ?? 'from-slate-700 to-slate-900'} px-4 py-3 flex items-center gap-3`}>
                <Icon size={26} className="shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-black text-lg leading-tight">{ch.title}</h2>
                  <p className="text-xs text-white/80 leading-snug">{ch.summary}</p>
                </div>
              </div>
              <ul className="divide-y divide-slate-800">
                {ch.stages.map((s, si) => {
                  const st = progress[s.id] ?? 0;
                  const done = cleared(s.id);
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => setPlaying(s.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/60">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-green-700' : 'bg-slate-800'}`}>{si + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-sm">{s.title}</span>
                          <span className="block text-xs text-slate-400 truncate">#{s.tag} · {s.mission}</span>
                        </span>
                        <span className="flex gap-0.5 shrink-0">{[1, 2, 3].map((n) => <Star key={n} size={14} className={n <= st ? 'text-yellow-300 fill-yellow-300' : 'text-slate-600'} />)}</span>
                        <Play size={16} className="text-sky-300 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
