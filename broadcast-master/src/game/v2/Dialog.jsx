import React, { useEffect, useRef, useState } from 'react';
import { Hand, ChevronLeft, ChevronRight, Pause, Play, X, Headphones, Wand2, CheckCircle2, FastForward, Sprout, FlaskConical, XCircle } from 'lucide-react';
import { Seg, Toggle } from './controls.jsx';
import { saveProgress } from '../ui.jsx';
import { SPEAKERS } from '../data/tutorial.js';
import VisualCard from './VisualCard.jsx';

/* =====================================================================
 * 대화 장면 상자 — 튜토리얼·정답 보기의 진행 화면
 *  한 줄 설명 → (직접 해 보기 / 보여 주세요) → "다음" 클릭 → 다음 장면
 *  - 말하는 동안 글자가 한 글자씩 나타나고, 상자를 누르면 바로 전부 보인다
 *  - Enter·→ = 다음, ← = 이전
 * ===================================================================== */
const SPEEDS = [1, 1.5, 2];

const LAB_NAME = { fade: '페이드 실습실', eq: 'EQ 실습실', fx: '울림(리버브) 실습실' };

export default function Dialog({ player, tutorial, speaker = '선배 엔지니어', onLab }) {
  const { script, narration, waiting, speaking, praised, quiz } = player;
  const [shown, setShown] = useState(0);
  const seqRef = useRef(null);
  const text = narration?.text ?? '';
  // 글자 나타내기: 지금 읽는 부분(offset부터)을 음성 길이에 맞춰. 음성이 단어 위치를 알려 주면(pos) 그만큼은 바로 보인다.
  // 속도를 바꾸면 읽던 곳부터 새 속도로 다시 계산된다
  useEffect(() => {
    if (!text) { setShown(0); return undefined; }
    if (!speaking) { setShown(text.length); return undefined; }
    const from = narration?.offset ?? 0;
    const t0 = narration?.t0 ?? Date.now();
    const total = Math.max(400, (narration?.ms ?? 2000) * 0.92);
    const tick = () => {
      // 녹음 목소리면 재생 위치를 그대로 따라간다
      const k = narration?.audio
        ? Math.min(text.length, Math.ceil((player.progress?.current ?? 0) * text.length * 1.04))
        : Math.min(text.length, from + Math.ceil(((Date.now() - t0) / total) * (text.length - from)));
      setShown((prev) => Math.max(prev, k));
      return k >= text.length;
    };
    // 새 대사(또는 같은 대사를 처음부터 다시)면 처음부터, 속도만 바뀌었으면 이미 보인 글자는 그대로
    if (narration?.seq !== seqRef.current) { seqRef.current = narration?.seq; setShown(0); }
    tick();
    const id = setInterval(() => { if (tick()) clearInterval(id); }, 35);
    return () => clearInterval(id);
  }, [text, narration?.seq, narration?.offset, narration?.t0, narration?.audio, speaking]); // eslint-disable-line react-hooks/exhaustive-deps
  // 음성이 알려 준 단어 위치까지는 바로 보이게
  useEffect(() => { if (narration?.pos) setShown((v) => Math.max(v, Math.min(text.length, narration.pos))); }, [narration?.pos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!speaking && text) setShown(text.length); }, [speaking, text]);

  const ready = !!script?.ready;
  const speed = SPEEDS.includes(script?.speed) ? script.speed : 1;
  const setSpeed = (v) => { player.setSpeed(v); saveProgress('bm2-speed', v); };
  const full = shown >= text.length;
  const q = narration?.quiz;
  const quizOn = !!q && quiz?.i === narration?.i && !quiz.solved;
  const advance = () => {
    if (!full) { setShown(text.length); return; }
    if (waiting || quizOn) return; // 직접 해야 하는 단계·퀴즈는 해내야(또는 "보여 주세요"·건너뛰기) 넘어간다
    player.next();
  };
  // 키보드: Enter/→ 다음, ← 이전
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); player.jump(-1); }
      if (quizOn && /^[1-4]$/.test(e.key)) { e.preventDefault(); player.pick(Number(e.key) - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!script || (!narration && !waiting)) return null;
  const n = narration?.n ?? script.steps.length;
  const i = narration?.i ?? script.i;
  const who = narration?.who === 'junior' ? 'junior' : 'senior';
  const sp = tutorial ? SPEAKERS[who] : { name: speaker };
  const junior = who === 'junior';
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[min(97%,720px)] z-20">
      {/* 설명 카드 (사진·3D 모형·그림) */}
      {narration?.show && <div key={narration.seq} className="mb-1.5 flex bm-pop"><VisualCard show={narration.show} /></div>}
      <div className={`rounded-2xl border ${junior ? 'border-emerald-400/50' : 'border-violet-400/50'} bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden`}>
        {/* 진행 막대 */}
        <div className="h-1 bg-slate-800"><div className="h-full bg-violet-400 transition-all" style={{ width: `${((i + (ready ? 1 : 0.4)) / n) * 100}%` }} /></div>
        <div className="flex gap-3 px-3 pt-2.5 pb-2 cursor-pointer select-none" onClick={advance} role="button" tabIndex={-1} aria-label="다음 대사">
          <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
            <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${junior ? 'from-emerald-400 to-amber-400' : 'from-violet-500 to-sky-500'} flex items-center justify-center ring-2 ${speaking ? (junior ? 'ring-emerald-200 animate-pulse' : 'ring-violet-300 animate-pulse') : 'ring-slate-700'}`} title={sp.role}>
              {junior ? <Sprout size={22} className="text-white" /> : <Headphones size={22} className="text-white" />}
            </div>
            <span className={`text-[9px] font-bold whitespace-nowrap ${junior ? 'text-emerald-200' : 'text-violet-200'}`}>{sp.name}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-relaxed text-slate-50 min-h-[3em]">
              {text.slice(0, shown)}<span className="text-transparent">{text.slice(shown)}</span>
            </p>
            {waiting && full && (
              <div className="mt-1.5 rounded-lg border border-amber-400/60 bg-amber-500/10 px-2.5 py-1.5 text-sm font-bold text-amber-200 flex items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Hand size={16} className="mt-0.5 shrink-0 animate-bounce" />
                <span className="flex-1">직접 해 보세요: {waiting.practice}</span>
                <button type="button" onClick={player.showMe} className="shrink-0 rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[12px] text-slate-200 flex items-center gap-1" title="유령 손이 대신 보여 줍니다">
                  <Wand2 size={13} /> 보여 주세요
                </button>
              </div>
            )}
            {q && quiz?.i === narration?.i && full && (
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2" onClick={(e) => e.stopPropagation()} role="group" aria-label="퀴즈 보기">
                {q.options.map((o, k) => {
                  const wrong = quiz.wrong.includes(k);
                  const right = quiz.solved && k === q.answer;
                  return (
                    <button key={k} type="button" disabled={quiz.solved || wrong} onClick={() => player.pick(k)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-sm font-bold transition ${right ? 'border-green-400 bg-green-600/25 text-green-100' : wrong ? 'border-red-500/60 bg-red-900/20 text-red-300 line-through' : quiz.solved ? 'border-slate-700 text-slate-500' : 'border-sky-500/60 bg-sky-900/20 text-sky-50 hover:bg-sky-800/40'}`}>
                      <span className="shrink-0 h-5 w-5 rounded-full bg-slate-800 text-[11px] flex items-center justify-center">{right ? <CheckCircle2 size={14} className="text-green-300" /> : wrong ? <XCircle size={14} /> : k + 1}</span>
                      <span>{o}</span>
                    </button>
                  );
                })}
                {quiz.solved && q.explain && (
                  <p className="sm:col-span-2 text-[13px] text-slate-200 leading-relaxed">
                    {quiz.by === 'auto' && <>정답은 <b className="text-green-300">{q.options[q.answer]}</b>. </>}{q.explain}
                  </p>
                )}
              </div>
            )}
            {narration?.lab && full && onLab && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onLab(narration.lab); }} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/60 bg-cyan-900/30 px-2.5 py-1.5 text-sm font-bold text-cyan-100 hover:bg-cyan-800/40">
                <FlaskConical size={15} /> {LAB_NAME[narration.lab.lab] ?? '실습실'} 열기
              </button>
            )}
            {praised && (
              <div className="mt-1.5 text-sm font-bold text-green-300 flex items-center gap-1"><CheckCircle2 size={16} /> 좋아요, 잘했어요!</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap border-t border-slate-800 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => player.jump(-1)} disabled={i === 0} className="flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30" aria-label="이전 장면"><ChevronLeft size={15} /><span className="hidden sm:inline">이전</span></button>
          {script.playing
            ? <button type="button" onClick={player.pause} className="p-1 rounded hover:bg-slate-800 text-slate-300" aria-label="일시정지"><Pause size={15} /></button>
            : <button type="button" onClick={player.resume} className="p-1 rounded hover:bg-slate-800 text-slate-300" aria-label="다시 재생"><Play size={15} /></button>}
          <Toggle small on={!!script.auto} color="sky" onClick={() => player.setAuto(!script.auto)} title="켜면 다음 장면으로 저절로 넘어갑니다">
            <span className="inline-flex items-center gap-0.5"><FastForward size={11} /> 자동</span>
          </Toggle>
          {tutorial && <Toggle small on={!!script.practice} color="amber" onClick={() => player.setPractice(!script.practice)} title="켜면 조작을 여러분이 직접 합니다"><span className="sm:hidden">직접</span><span className="hidden sm:inline">직접 해보기</span></Toggle>}
          {/* 속도: 넓은 화면은 세 칸, 휴대폰은 누를 때마다 1x→1.5x→2x로 바뀌는 단추 하나 (줄바꿈 방지) */}
          <span className="hidden sm:block"><Seg small value={speed} options={SPEEDS.map((v) => [v, `${v}x`])} onChange={setSpeed} /></span>
          <button type="button" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            className="sm:hidden rounded-md bg-slate-800 px-1.5 py-1 text-[11px] font-bold text-slate-200 tabular-nums" aria-label={`말하기 속도 ${speed}배 (눌러서 바꾸기)`}>{speed}x</button>
          <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{Math.min(i + 1, n)} / {n}</span>
          {!tutorial && <button type="button" onClick={player.stop} className="p-1 rounded hover:bg-slate-800 text-slate-400" aria-label="자동 진행 끄기"><X size={15} /></button>}
          <button type="button" onClick={() => player.next()}
            className={`flex items-center gap-0.5 rounded-lg px-3 py-1.5 text-sm font-black transition ${ready && !waiting && !quizOn ? 'bg-violet-500 text-white shadow-[0_0_14px_rgba(167,139,250,.7)] animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            title={waiting ? '이 단계는 대신 처리하고 넘어갑니다' : quizOn ? '퀴즈를 건너뜁니다' : '다음 장면 (Enter)'}>
            {waiting || quizOn ? '건너뛰기' : '다음'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
