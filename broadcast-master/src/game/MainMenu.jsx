import React, { useMemo } from 'react';
import { BookOpen, Gamepad2, Wrench, ChevronRight } from 'lucide-react';
import Studio3D from './Studio3D.jsx';
import { buildFullSystem, computeSignal, STAGES } from './engine.js';
import { EDU_ITEMS } from './eduContent.js';
import { loadProgress } from './ui.jsx';

/* =====================================================================
 * 메인 메뉴 — 완성된 3D 스튜디오가 천천히 도는 배경 위에서 모드를 고른다
 * ===================================================================== */
const noop = () => {};

function MenuBackdrop() {
  const sys = useMemo(() => buildFullSystem(), []);
  const st = { ...sys };
  const sig = useMemo(() => computeSignal(st, true), []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Studio3D
      stageId="studio" layoutKey="sandbox" interactive={false} autoRotate fallback={null}
      devices={sys.devices} connections={sys.connections} mixer={sys.mixer} speaker={sys.speaker} atem={sys.atem} obs={sys.obs}
      actual={sig} nominal={sig} talking jitter={-4} viewers={1280}
      pending={null} selectedCable={null} selectedDevice={null} labels={false} resetKey="menu"
      onPortClick={noop} onSelectDevice={noop} onDisconnect={noop} onPlace={noop} onCancelPending={noop}
    />
  );
}

export default function MainMenu({ onSelect }) {
  const story = loadProgress('bm-story-scores', {});
  const storyDone = Object.keys(story).length;
  const storyTotal = Object.values(story).reduce((a, b) => a + b, 0);
  const quiz = loadProgress('bm-edu-quiz', []).length;
  const ach = loadProgress('bm-studio-ach', []).length;
  const achTotal = STAGES.studio.objectives.length;

  const modes = [
    {
      key: 'edu', step: 1, icon: BookOpen, title: '교육 모드', tag: '장비 백과',
      desc: '마이크·오디오 인터페이스·믹서부터 미러리스·PTZ 카메라, ATEM 스위처, 케이블까지 3D로 돌려 보고 원리와 단자를 배웁니다. 직접 만져 보고 퀴즈로 확인하세요.',
      progress: `이해도 체크 ${quiz}/${EDU_ITEMS.length}`, cls: 'from-emerald-600/90 to-emerald-900/90 border-emerald-400', btn: 'bg-emerald-500 text-slate-950',
    },
    {
      key: 'story', step: 2, icon: Gamepad2, title: '스토리 모드', tag: '기본 게임',
      desc: '신입 방송 엔지니어가 되어 세미나실 PA 설치부터 하울링 제어, 유튜브 라이브 송출, 방송 사고 해결까지 4개의 스테이지를 해결합니다.',
      progress: storyDone ? `${storyDone}/4 스테이지 클리어 · ${storyTotal.toLocaleString()}점` : '4개 스테이지 · 점수와 등급', cls: 'from-sky-600/90 to-indigo-900/90 border-sky-400', btn: 'bg-sky-400 text-slate-950',
    },
    {
      key: 'studio', step: 3, icon: Wrench, title: '스튜디오 모드', tag: '마스터',
      desc: '정답 없이 내 손으로 스튜디오를 꾸밉니다. 장비를 골라 설치하고 배선해 PA와 라이브 송출을 동시에 돌려 보세요. 돌발 상황 훈련으로 실력을 시험할 수 있습니다.',
      progress: `도전 과제 ${ach}/${achTotal}`, cls: 'from-amber-500/90 to-orange-900/90 border-amber-300', btn: 'bg-amber-400 text-slate-950',
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#0b1018] text-white overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-70" aria-hidden="true"><MenuBackdrop /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1018]/40 via-[#0b1018]/30 to-[#0b1018]/95 pointer-events-none" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col min-h-screen pointer-events-none">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-red-300 bg-red-950/70 border border-red-700 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> ON AIR · BROADCAST EQUIPMENT MASTER
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight" style={{ textWrap: 'balance' }}>방송장비 마스터</h1>
          <p className="mt-3 text-slate-300 text-base sm:text-lg max-w-xl">마이크 한 대에서 라이브 송출까지. 신호가 어디로 흐르는지 눈으로 보고 손으로 연결하며 배우는 방송장비 시뮬레이션.</p>
        </div>
        <div className="flex-1 min-h-[80px]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pointer-events-auto">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.key} type="button" onClick={() => onSelect(m.key)}
                className={`group text-left rounded-xl border-2 bg-gradient-to-br ${m.cls} p-5 shadow-2xl backdrop-blur-sm transition hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60 flex flex-col`}>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-lg bg-black/30 flex items-center justify-center"><Icon size={24} /></span>
                  <div>
                    <div className="text-[11px] font-bold tracking-widest text-white/70">STEP {m.step} · {m.tag}</div>
                    <div className="text-xl font-bold">{m.title}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-white/85 leading-relaxed flex-1">{m.desc}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-white/80">{m.progress}</span>
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 ${m.btn}`}>시작 <ChevronRight size={16} className="transition group-hover:translate-x-0.5" /></span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-slate-500 text-center">추천 순서: 교육 모드로 장비를 익히고 → 스토리 모드로 실전 → 스튜디오 모드에서 마스터하기</p>
      </div>
    </div>
  );
}
