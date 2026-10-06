import React, { useMemo, useState } from 'react';
import { BookOpen, Gamepad2, Wrench, ChevronRight, GraduationCap, Music, VolumeX } from 'lucide-react';
import Venue3D from './Venue3D.jsx';
import { buildRuntime, computeSim } from './sim.js';
import { runOps } from './ops.js';
import { EDU_ITEMS } from './eduContent.js';
import { loadProgress, saveProgress } from './ui.jsx';
import { getAudio } from './audio.js';
import STORY from './data/story.json';
import { SOLUTIONS } from './data/solutions.js';
import { TUTORIAL } from './data/tutorial.js';

/* =====================================================================
 * 메인 메뉴 — 공연장 3D가 천천히 도는 배경 위에서 모드를 고른다
 * ===================================================================== */
function MenuBackdrop() {
  const { st, sim } = useMemo(() => {
    const spec = STORY.chapters.flatMap((c) => c.stages).find((s) => s.id === 'light-2');
    const s1 = runOps(buildRuntime(spec), SOLUTIONS['light-2'].filter((x) => x.op)).st;
    return { st: s1, sim: computeSim(s1, { talking: true, performing: true }) };
  }, []);
  return <Venue3D st={st} sim={sim} venueId="live_stage" interactive={false} autoRotate fallback={null} talking performing />;
}

export default function MainMenu({ onSelect }) {
  const [bgm, setBgm] = useState(() => loadProgress('bm2-bgm', true));
  const prog = loadProgress('bm2-progress', {});
  const stages = STORY.chapters.reduce((n, c) => n + c.stages.length, 0);
  const cleared = Object.keys(prog).length;
  const stars = Object.values(prog).reduce((a, b) => a + b, 0);
  const tut = loadProgress('bm2-tutorial', []).length;
  const quiz = loadProgress('bm-edu-quiz', []).length;
  const startMusic = () => { const a = getAudio(); if (a.unlock()) { a.setSong('menu'); a.setBgm({ on: bgm }); } };
  const toggleBgm = () => { const on = !bgm; setBgm(on); saveProgress('bm2-bgm', on); const a = getAudio(); a.unlock(); a.setBgm({ on }); };

  const modes = [
    {
      key: 'tutorial', step: 1, icon: GraduationCap, title: '튜토리얼', tag: '처음이라면',
      desc: '선배 엔지니어가 한 장면씩 설명하면, 다음을 누르거나 반짝이는 곳을 직접 조작하며 따라갑니다. 마이크·믹서·스피커, 카메라·스위처·OBS, 조명·미디어 서버·PTZ까지. 막히면 "보여 주세요".',
      progress: `${tut}/${TUTORIAL.length} 파트 완료`, cls: 'from-violet-600/90 to-violet-950/90 border-violet-400', btn: 'bg-violet-400 text-slate-950',
    },
    {
      key: 'edu', step: 2, icon: BookOpen, title: '교육 모드', tag: '장비 백과',
      desc: '장비를 3D로 돌려 보며 원리와 단자를 배우고, 소리 실험실에서 GAIN·EQ·리버브를 직접 들어 봅니다. 믹서 크기별 차이, 케이블 종류도 정리되어 있어요.',
      progress: `이해도 체크 ${quiz}/${EDU_ITEMS.length}`, cls: 'from-emerald-600/90 to-emerald-950/90 border-emerald-400', btn: 'bg-emerald-400 text-slate-950',
    },
    {
      key: 'story', step: 3, icon: Gamepad2, title: '스토리 모드', tag: '현장 미션',
      desc: '세미나실 첫 출근부터 1인 방송, 교회, 밴드 공연, 강의 중계, 무대 조명(Tiger Touch), 영상 연출(Resolume), PTZ 조이스틱, 돌발 상황까지 9개 장의 현장 문제를 해결합니다.',
      progress: `${cleared}/${stages} 스테이지 · ★ ${stars}`, cls: 'from-sky-600/90 to-indigo-950/90 border-sky-400', btn: 'bg-sky-400 text-slate-950',
    },
    {
      key: 'studio', step: 4, icon: Wrench, title: '스튜디오 모드', tag: '자유 설치',
      desc: '정해진 정답 없이 원하는 장비를 원하는 만큼 꺼내 원하는 곳에 놓고 배선합니다. 카메라 여러 대, 조명, LED까지 — 나만의 방송 시스템을 설계해 보세요.',
      progress: '장비 제한 없음', cls: 'from-amber-500/90 to-orange-950/90 border-amber-300', btn: 'bg-amber-400 text-slate-950',
    },
  ];

  return (
    <div className="relative min-h-[100dvh] bg-[#0b1018] text-white overflow-hidden font-sans" onPointerDown={startMusic}>
      <div className="absolute inset-0 opacity-75" aria-hidden="true"><MenuBackdrop /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1018]/50 via-[#0b1018]/20 to-[#0b1018]/95 pointer-events-none" />
      <button type="button" onClick={(e) => { e.stopPropagation(); toggleBgm(); }} className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/50 border border-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur" aria-pressed={bgm}>
        {bgm ? <Music size={14} /> : <VolumeX size={14} />} 배경음악 {bgm ? 'ON' : 'OFF'}
      </button>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col min-h-[100dvh] pointer-events-none">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-red-300 bg-red-950/70 border border-red-700 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> ON AIR · BROADCAST EQUIPMENT MASTER
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight" style={{ textWrap: 'balance' }}>방송장비 마스터</h1>
          <p className="mt-3 text-slate-300 text-base sm:text-lg max-w-2xl">마이크 한 대에서 콘서트 무대까지. 음향·영상·조명 장비를 3D 현장에서 직접 설치하고 조작하며, 실제 현장에서 그대로 쓸 수 있는 감각을 익히세요.</p>
        </div>
        <div className="flex-1 min-h-[60px]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pointer-events-auto">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.key} type="button" onClick={() => { startMusic(); onSelect(m.key); }}
                className={`group text-left rounded-xl border-2 bg-gradient-to-br ${m.cls} p-4 shadow-2xl backdrop-blur-sm transition hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 flex flex-col`}>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-black/30 flex items-center justify-center"><Icon size={22} /></span>
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-white/70">STEP {m.step} · {m.tag}</div>
                    <div className="text-lg font-bold">{m.title}</div>
                  </div>
                </div>
                <p className="mt-2 text-[13px] text-white/85 leading-relaxed flex-1">{m.desc}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-white/80">{m.progress}</span>
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 ${m.btn}`}>시작 <ChevronRight size={16} className="transition group-hover:translate-x-0.5" /></span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-xs text-slate-400 text-center">추천 순서: 튜토리얼 → 교육 모드 → 스토리 모드 → 스튜디오 모드</p>
      </div>
    </div>
  );
}
