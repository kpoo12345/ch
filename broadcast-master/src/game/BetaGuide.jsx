import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Circle, MessageSquarePlus, Sparkles, Smartphone, Volume2, ChevronRight } from 'lucide-react';
import { loadProgress, saveProgress } from './ui.jsx';
import { BETA_VERSION, openFeedback } from './betaContext.js';

/* =====================================================================
 * 베타 테스터 안내 — 처음 들어온 테스터에게 한 번 보여 주고, 메뉴의 카드로 다시 연다
 *  15분 테스트 코스: 해 본 것은 저절로 체크된다 (각 화면이 남기는 진행 기록을 읽는다)
 * ===================================================================== */
export const WELCOME_KEY = 'bm2-beta-welcome';
const welcomeSeen = () => loadProgress(WELCOME_KEY, '') === BETA_VERSION.split(' ')[0];
export const markWelcomeSeen = () => saveProgress(WELCOME_KEY, BETA_VERSION.split(' ')[0]);
export const shouldShowWelcome = () => !welcomeSeen();

// 코스 단계와 완료 판정
export function betaCourse() {
  const tut = new Set(loadProgress('bm2-tutorial', []));
  const prog = loadProgress('bm2-progress', {});
  return [
    { id: 'tut', title: '튜토리얼 파트 1 끝까지', time: '약 8분', hint: '믹서 첫걸음. 반짝이는 곳을 직접 눌러 보세요', done: tut.has('tut-sound') },
    { id: 'story', title: "스토리 1장 첫 미션 '첫 소리 내기'", time: '약 4분', hint: '막히면 힌트 → 그래도 안 되면 정답 보기', done: !!prog['seminar-1'] },
    { id: 'dict', title: '장비 백과사전에서 장비 하나 찾아보기', time: '1분', hint: '모르는 말이 나오면 여기서 찾아요', done: !!loadProgress('bm2-dict-seen', false) },
    { id: 'feedback', title: '의견 한 번 보내기', time: '1분', hint: '불편했던 점, 좋았던 점 무엇이든', done: loadProgress('bm2-beta-sent', 0) > 0 },
  ];
}

export function BetaCourseCard({ onOpen }) {
  const course = betaCourse();
  const n = course.filter((c) => c.done).length;
  return (
    <button type="button" onClick={onOpen}
      className="group text-left rounded-xl border border-amber-300/70 bg-amber-950/70 backdrop-blur-sm p-3 flex items-center gap-2.5 transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50">
      <span className="w-9 h-9 rounded-lg bg-amber-400 text-slate-900 flex items-center justify-center shrink-0"><Sparkles size={19} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">베타 테스트 코스 {n}/{course.length}</span>
        <span className="block text-[11px] text-amber-100/80 leading-snug">{n === course.length ? '다 해 봤어요! 고마워요' : '15분이면 돼요 · 안내 보기'}</span>
      </span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-amber-200/70 transition group-hover:translate-x-0.5 hidden sm:block" />
    </button>
  );
}

export function BetaWelcome({ onClose, onGo }) {
  const [course, setCourse] = useState(betaCourse);
  useEffect(() => { markWelcomeSeen(); }, []);
  // 의견을 보내고 돌아오면 체크가 바로 바뀌게
  useEffect(() => {
    const id = setInterval(() => setCourse(betaCourse()), 1500);
    return () => clearInterval(id);
  }, []);
  const go = (c) => {
    onClose();
    if (c.id === 'tut') onGo('tutorial', 0);
    else if (c.id === 'story') onGo('story', 'seminar-1');
    else if (c.id === 'dict') onGo('dict');
    else openFeedback();
  };
  const left = course.filter((c) => !c.done).length;
  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl border border-amber-300/60 bg-slate-950 p-4 sm:p-5 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="베타 테스터 안내">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-widest text-amber-300">BETA TEST · {BETA_VERSION}</div>
            <h2 className="mt-1 text-xl font-black leading-snug">방송장비 마스터 베타에 와 줘서 고마워요!</h2>
          </div>
          <button type="button" onClick={onClose} className="ml-auto shrink-0 rounded p-1 hover:bg-slate-800" aria-label="닫기"><X size={18} /></button>
        </div>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed">마이크·믹서·스피커 같은 방송 장비를 3D 현장에서 직접 꽂고 돌려 보며 배우는 게임이에요. 아직 다듬는 중이라, 해 보다가 <b className="text-amber-200">막히거나 이상한 곳</b>을 알려 주시면 바로 고칩니다.</p>

        <h3 className="mt-4 text-sm font-black">15분 테스트 코스 {left ? <span className="text-slate-400 font-bold">· {left}개 남음</span> : <span className="text-green-300">· 다 했어요!</span>}</h3>
        <ol className="mt-2 space-y-1.5">
          {course.map((c, i) => (
            <li key={c.id}>
              <button type="button" onClick={() => go(c)}
                className={`w-full text-left flex items-start gap-2.5 rounded-xl border px-3 py-2 transition ${c.done ? 'border-green-500/40 bg-green-950/30' : 'border-slate-700 bg-slate-900 hover:border-amber-300'}`}>
                {c.done ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-400" /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-500" />}
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-bold ${c.done ? 'text-green-200' : ''}`}>{i + 1}. {c.title} <span className="font-normal text-[11px] text-slate-400">{c.time}</span></span>
                  <span className="block text-[12px] text-slate-400">{c.hint}</span>
                </span>
                {!c.done && <ChevronRight size={16} className="mt-1 shrink-0 text-slate-500" />}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-950/30 p-3 text-[13px] leading-relaxed">
          <div className="flex items-center gap-1.5 font-black text-amber-200"><MessageSquarePlus size={16} /> 의견 보내는 법</div>
          <p className="mt-1 text-slate-200">메뉴에선 왼쪽 노란 <b>의견 보내기</b> 탭, 게임 중엔 맨 위의 노란 <b>의견</b> 단추를 눌러요. 어느 화면·장면이었는지는 저절로 함께 가요.</p>
          <p className="mt-1 text-slate-400">이런 게 특히 도움이 돼요: 어디서 막혔는지 · 이해 안 된 말 · 소리·화면이 이상했던 곳 · 너무 쉽거나 어려웠던 곳</p>
        </div>

        <ul className="mt-3 space-y-1 text-[12px] text-slate-400">
          <li className="flex gap-1.5"><Volume2 size={14} className="mt-0.5 shrink-0" /> 소리가 안 나면 화면을 한 번 눌러 주세요. 아이폰은 볼륨도 확인해 주세요.</li>
          <li className="flex gap-1.5"><Smartphone size={14} className="mt-0.5 shrink-0" /> 휴대폰도 돼요. 처음 열 때 10초쯤 걸리고, 3D가 느리면 아래 <b>연결표</b> 탭으로도 할 수 있어요.</li>
        </ul>

        {/* 휴대폰에서도 시작 단추가 늘 보이게 아래에 붙여 둔다 */}
        <div className="sticky -bottom-4 sm:-bottom-5 -mx-4 sm:-mx-5 mt-4 flex flex-wrap gap-2 border-t border-slate-800 bg-slate-950 px-4 sm:px-5 pt-3 pb-4 sm:pb-5">
          <button type="button" onClick={() => go(course.find((c) => !c.done) ?? course[0])} className="flex-1 min-w-[10rem] rounded-xl bg-amber-400 py-2.5 font-black text-slate-900 hover:bg-amber-300">
            {left ? `${course.findIndex((c) => !c.done) + 1}번부터 시작하기` : '튜토리얼 다시 보기'}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold hover:bg-slate-700">둘러볼게요</button>
        </div>
      </div>
    </div>
  );
}
