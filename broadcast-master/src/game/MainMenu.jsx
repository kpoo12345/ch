import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Gamepad2, Wrench, ChevronRight, ChevronDown, GraduationCap, Music, VolumeX, Check, Inbox } from 'lucide-react';
import Venue3D from './Venue3D.jsx';
import { LOW_END } from './kit3d.jsx';
import { buildRuntime, computeSim } from './sim.js';
import { runOps } from './ops.js';
import { EDU_ITEMS, partTitle } from './eduContent.js';
import { loadProgress, saveProgress } from './ui.jsx';
import { getAudio } from './audio.js';
import STORY from './data/story.json';
import { SOLUTIONS } from './data/solutions.js';
import { TUTORIAL } from './data/tutorial.js';
import { BetaWelcome, BetaCourseCard, shouldShowWelcome } from './BetaGuide.jsx';
import FeedbackInbox, { canReadFeedback } from './FeedbackInbox.jsx';

/* =====================================================================
 * 메인 메뉴 — 공연장 3D가 천천히 도는 배경 위에서 고른다
 *  배우는 길: ① 튜토리얼(기초 과정) → ② 스토리 모드(현장 미션)
 *  도구: 장비 백과사전(찾아보기) · 자유 스튜디오
 * ===================================================================== */
function MenuBackdrop() {
  // 휴대폰에선 장식용 3D를 돌리지 않는다 (배터리·발열, 게임 화면에서 쓸 힘을 아낀다)
  if (LOW_END) return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,#1e3a5f_0%,#0b1220_70%)]" />;
  return <MenuBackdrop3D />;
}
function MenuBackdrop3D() {
  const { st, sim } = useMemo(() => {
    const spec = STORY.chapters.flatMap((c) => c.stages).find((s) => s.id === 'light-2');
    const s1 = runOps(buildRuntime(spec), SOLUTIONS['light-2'].filter((x) => x.op)).st;
    return { st: s1, sim: computeSim(s1, { talking: true, performing: true }) };
  }, []);
  return <Venue3D st={st} sim={sim} venueId="live_stage" interactive={false} autoRotate fallback={null} talking performing />;
}

const StepNo = ({ n }) => <span className="w-9 h-9 rounded-full bg-white text-slate-900 font-black text-lg flex items-center justify-center shrink-0 shadow">{n}</span>;
const chapterNo = (c) => c.title.match(/^\d+장/)?.[0] ?? c.title;

export default function MainMenu({ onSelect }) {
  const [bgm, setBgm] = useState(() => loadProgress('bm2-bgm', true));
  const startMusic = () => { const a = getAudio(); if (a.unlock()) { a.setSong('menu'); a.setBgm({ on: bgm }); } };
  const toggleBgm = () => { const on = !bgm; setBgm(on); saveProgress('bm2-bgm', on); const a = getAudio(); a.unlock(); a.setBgm({ on }); };
  const go = (mode, arg) => { startMusic(); onSelect(mode, arg); };
  // 베타: 처음 온 테스터에겐 안내를 한 번 띄우고, 게임 주인에겐 "의견 모아보기"를 보여 준다
  const [welcome, setWelcome] = useState(shouldShowWelcome);
  const [inbox, setInbox] = useState(false);
  const [owner, setOwner] = useState(false);
  useEffect(() => { let alive = true; canReadFeedback().then((ok) => { if (alive) setOwner(ok); }); return () => { alive = false; }; }, []);

  // 진행 상황 (튜토리얼: bm2-tutorial = 마친 파트 id 목록 · 스토리: bm2-progress = { 스테이지 id: 별 })
  const done = new Set(loadProgress('bm2-tutorial', []));
  const tutDone = TUTORIAL.filter((p) => done.has(p.id)).length;
  const nextPart = TUTORIAL.findIndex((p) => !done.has(p.id));
  const prog = loadProgress('bm2-progress', {});
  const stages = STORY.chapters.flatMap((c) => c.stages.map((s) => ({ ...s, ch: c })));
  const cleared = stages.filter((s) => prog[s.id]).length;
  const stars = stages.reduce((a, s) => a + (prog[s.id] ?? 0), 0);
  const nextStage = stages.find((s) => !prog[s.id]);
  const tutAll = nextPart < 0;

  const tutTag = tutDone === 0 && cleared === 0 ? '처음이라면 여기부터' : tutAll ? '완료!' : '이어서 배우기';
  const tutBtn = tutAll ? '다시 보기' : tutDone === 0 ? '파트 1부터 시작' : `이어 하기 · 파트 ${nextPart + 1}`;

  return (
    <div className="relative min-h-[100dvh] bg-[#0b1018] text-white overflow-hidden font-sans" onPointerDown={startMusic}>
      <div className="absolute inset-0 opacity-75" aria-hidden="true"><MenuBackdrop /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1018]/50 via-[#0b1018]/20 to-[#0b1018]/95 pointer-events-none" />
      <button type="button" onClick={(e) => { e.stopPropagation(); toggleBgm(); }} className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/50 border border-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur" aria-pressed={bgm}>
        {bgm ? <Music size={14} /> : <VolumeX size={14} />} 배경음악 {bgm ? 'ON' : 'OFF'}
      </button>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col min-h-[100dvh] pointer-events-none">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold tracking-[0.2em] sm:tracking-[0.25em] text-red-300 bg-red-950/70 border border-red-700 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> ON AIR · BROADCAST EQUIPMENT MASTER
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-bold tracking-tight" style={{ textWrap: 'balance' }}>방송장비 마스터</h1>
          <p className="mt-3 text-slate-300 text-sm sm:text-lg max-w-2xl">마이크 한 대에서 콘서트 무대까지. 음향·영상·조명 장비를 3D 현장에서 직접 설치하고 조작하며, 실제 현장에서 그대로 쓸 수 있는 감각을 익히세요.</p>
        </div>
        <div className="flex-1 min-h-[40px]" />

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,15rem)] gap-3 pointer-events-auto">
          {/* STEP 1 · 튜토리얼 */}
          <section aria-labelledby="menu-tut" className="rounded-2xl border-2 border-violet-400 bg-gradient-to-br from-violet-600/90 to-violet-950/90 p-4 shadow-2xl backdrop-blur-sm flex flex-col">
            <div className="flex items-center gap-3">
              <StepNo n={1} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-widest text-white/75">STEP 1 · 기초 과정 {TUTORIAL.length}파트</div>
                <h2 id="menu-tut" className="text-xl font-bold flex items-center gap-1.5"><GraduationCap size={20} /> 튜토리얼</h2>
              </div>
              <span className="ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-300 text-slate-950 whitespace-nowrap">{tutTag}</span>
            </div>
            <p className="mt-2 text-[13px] text-white/85 leading-relaxed">선배 엔지니어와 대화하며 한 장면씩 배우고, 반짝이는 곳을 직접 조작해 봅니다. 소리의 길부터 마이크·케이블·믹서·스피커·악기·방송·조명까지.</p>
            <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${TUTORIAL.length}, minmax(0, 1fr))` }} aria-label="튜토리얼 파트">
              {TUTORIAL.map((p, i) => {
                const ok = done.has(p.id);
                const cur = i === nextPart;
                return (
                  <li key={p.id}>
                    <button type="button" disabled={p.steps.length < 3} onClick={() => go('tutorial', i)} title={`파트 ${i + 1} · ${partTitle(TUTORIAL, i)}${p.steps.length < 3 ? ' (준비 중)' : ''}`} aria-label={`파트 ${i + 1} ${partTitle(TUTORIAL, i)}${ok ? ' (완료)' : ''}`}
                      className={`w-full h-8 rounded-md text-xs font-bold border flex items-center justify-center ${ok ? 'bg-white text-violet-900 border-white' : cur ? 'bg-violet-300/40 border-white ring-2 ring-amber-300' : 'bg-black/25 border-white/25 text-white/80 hover:bg-black/40'} disabled:opacity-35 disabled:cursor-not-allowed`}>
                      {ok ? <Check size={14} /> : i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-1.5 text-[11px] text-white/75 truncate">{tutAll ? `${TUTORIAL.length}파트를 모두 마쳤어요. 이제 스토리 모드로!` : `${tutDone ? '다음' : '첫 파트'}: 파트 ${nextPart + 1} · ${partTitle(TUTORIAL, nextPart)}`}</div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-white/80">{tutDone}/{TUTORIAL.length} 파트 완료</span>
              <div className="flex gap-1.5 ml-auto">
                <button type="button" onClick={() => go('tutorial')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-black/25 border border-white/25 hover:bg-black/40">파트 목록</button>
                <button type="button" onClick={() => go('tutorial', tutAll ? undefined : nextPart)} className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 bg-violet-300 text-slate-950 hover:bg-violet-200">
                  {tutBtn} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center text-white/70 -my-1 sm:my-0" aria-hidden="true">
            <ChevronDown size={22} className="sm:hidden" /><ChevronRight size={28} className="hidden sm:block" />
          </div>

          {/* STEP 2 · 스토리 모드 */}
          <section aria-labelledby="menu-story" className="rounded-2xl border-2 border-sky-400 bg-gradient-to-br from-sky-600/90 to-indigo-950/90 p-4 shadow-2xl backdrop-blur-sm flex flex-col">
            <div className="flex items-center gap-3">
              <StepNo n={2} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-widest text-white/75">STEP 2 · 현장 미션 {STORY.chapters.length}장 · {stages.length}스테이지</div>
                <h2 id="menu-story" className="text-xl font-bold flex items-center gap-1.5"><Gamepad2 size={20} /> 스토리 모드</h2>
              </div>
              <span className="ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 bg-white/20 border border-white/30 whitespace-nowrap">{tutAll || cleared ? '실전 연습' : '튜토리얼 다음'}</span>
            </div>
            <p className="mt-2 text-[13px] text-white/85 leading-relaxed">세미나실 첫 출근부터 1인 방송, 교회, 밴드 공연, 생중계, 조명, 영상 연출, PTZ, 돌발 상황까지 장 순서대로 현장 문제를 해결합니다.</p>
            <ol className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${STORY.chapters.length}, minmax(0, 1fr))` }} aria-label="스토리 장 순서">
              {STORY.chapters.map((c, i) => {
                const all = c.stages.every((s) => prog[s.id]);
                const cur = nextStage?.ch.id === c.id;
                return (
                  <li key={c.id} title={c.title} aria-label={`${c.title}${all ? ' (완료)' : ''}`}
                    className={`h-8 rounded-md text-xs font-bold border flex items-center justify-center ${all ? 'bg-white text-sky-900 border-white' : cur ? 'bg-sky-300/40 border-white ring-2 ring-amber-300' : 'bg-black/25 border-white/25 text-white/80'}`}>
                    {all ? <Check size={14} /> : i + 1}
                  </li>
                );
              })}
            </ol>
            <div className="mt-1.5 text-[11px] text-white/75 truncate">{nextStage ? `${cleared ? '다음 미션' : '첫 미션'}: ${chapterNo(nextStage.ch)} · ${nextStage.title}` : '모든 미션 완료! 별 3개에 도전해 보세요.'}</div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-white/80">{cleared}/{stages.length} 스테이지 · ★ {stars}</span>
              <button type="button" onClick={() => go('story')} className="px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 bg-sky-300 text-slate-950 hover:bg-sky-200">
                {cleared ? '이어 하기' : '시작'} <ChevronRight size={16} />
              </button>
            </div>
          </section>

          {/* 도구 */}
          <div className="sm:col-span-3 lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-2 content-end">
            <div className="col-span-2 lg:col-span-1"><BetaCourseCard onOpen={() => setWelcome(true)} /></div>
            {owner && (
              <button type="button" onClick={() => setInbox(true)} className="col-span-2 lg:col-span-1 flex items-center gap-2 rounded-xl border border-slate-500/70 bg-slate-950/80 px-3 py-2 text-left text-sm font-bold hover:border-amber-300">
                <Inbox size={17} className="text-amber-300" /> 베타 의견 모아보기 <span className="ml-auto text-[10px] font-normal text-slate-400">나만 보여요</span>
              </button>
            )}
            <div className="col-span-2 lg:col-span-1 text-[10px] font-bold tracking-widest text-slate-300/80">도구 · 언제든 열어 보기</div>
            {[
              { key: 'dict', icon: BookOpen, title: '장비 백과사전', desc: `모르는 장비·용어 바로 찾기 · ${EDU_ITEMS.length}개`, cls: 'border-emerald-400/60 hover:border-emerald-300', ic: 'text-emerald-300' },
              { key: 'studio', icon: Wrench, title: '자유 스튜디오', desc: '정답 없이 마음대로 설치·배선', cls: 'border-amber-400/60 hover:border-amber-300', ic: 'text-amber-300' },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.key} type="button" onClick={() => go(t.key)}
                  className={`group text-left rounded-xl border bg-slate-950/75 backdrop-blur-sm p-3 flex items-center gap-2.5 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${t.cls}`}>
                  <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Icon size={19} className={t.ic} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{t.title}</span>
                    <span className="block text-[11px] text-slate-300 leading-snug">{t.desc}</span>
                  </span>
                  <ChevronRight size={16} className="ml-auto shrink-0 text-slate-400 transition group-hover:translate-x-0.5 hidden sm:block" />
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400 text-center">추천 순서: ① 튜토리얼 → ② 스토리 모드 · 막히면 언제든 장비 백과사전에서 찾아보세요</p>
      </div>
      {welcome && <BetaWelcome onClose={() => setWelcome(false)} onGo={go} />}
      {inbox && <FeedbackInbox onClose={() => setInbox(false)} />}
    </div>
  );
}
