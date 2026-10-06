import React, { useEffect, useState } from 'react';
import { Hand, ChevronLeft, ChevronRight, Pause, Play, X, Headphones, Wand2, CheckCircle2, FastForward } from 'lucide-react';
import { Seg, Toggle } from './controls.jsx';

/* =====================================================================
 * 대화 장면 상자 — 튜토리얼·정답 보기의 진행 화면
 *  한 줄 설명 → (직접 해 보기 / 보여 주세요) → "다음" 클릭 → 다음 장면
 *  - 말하는 동안 글자가 한 글자씩 나타나고, 상자를 누르면 바로 전부 보인다
 *  - Enter·→ = 다음, ← = 이전
 * ===================================================================== */
export default function Dialog({ player, tutorial, speaker = '선배 엔지니어' }) {
  const { script, narration, waiting, speaking, praised } = player;
  const [shown, setShown] = useState(0);
  const text = narration?.text ?? '';
  // 글자 나타내기: 음성 길이에 맞춰
  useEffect(() => {
    if (!text) { setShown(0); return undefined; }
    if (!speaking) { setShown(text.length); return undefined; }
    setShown(0);
    const t0 = performance.now();
    const total = Math.max(600, (narration?.ms ?? 2000) * 0.9);
    const id = setInterval(() => {
      const k = Math.min(text.length, Math.ceil(((performance.now() - t0) / total) * text.length));
      setShown(k);
      if (k >= text.length) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [text, narration?.i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!speaking && text) setShown(text.length); }, [speaking, text]);

  const ready = !!script?.ready;
  const full = shown >= text.length;
  const advance = () => {
    if (!full) { setShown(text.length); return; }
    if (waiting) return; // 직접 해야 하는 단계는 해내야(또는 "보여 주세요") 넘어간다
    player.next();
  };
  // 키보드: Enter/→ 다음, ← 이전
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); player.jump(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!script || (!narration && !waiting)) return null;
  const n = narration?.n ?? script.steps.length;
  const i = narration?.i ?? script.i;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-2 w-[min(97%,720px)] z-20">
      <div className="rounded-2xl border border-violet-400/50 bg-slate-950/95 backdrop-blur shadow-2xl overflow-hidden">
        {/* 진행 막대 */}
        <div className="h-1 bg-slate-800"><div className="h-full bg-violet-400 transition-all" style={{ width: `${((i + (ready ? 1 : 0.4)) / n) * 100}%` }} /></div>
        <div className="flex gap-3 px-3 pt-2.5 pb-2 cursor-pointer select-none" onClick={advance} role="button" tabIndex={-1} aria-label="다음 대사">
          <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
            <div className={`h-11 w-11 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center ring-2 ${speaking ? 'ring-violet-300 animate-pulse' : 'ring-slate-700'}`}>
              <Headphones size={22} className="text-white" />
            </div>
            <span className="text-[9px] font-bold text-violet-200 whitespace-nowrap">{speaker}</span>
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
            {praised && (
              <div className="mt-1.5 text-sm font-bold text-green-300 flex items-center gap-1"><CheckCircle2 size={16} /> 좋아요, 잘했어요!</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 border-t border-slate-800 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => player.jump(-1)} disabled={i === 0} className="flex items-center gap-0.5 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-30" aria-label="이전 장면"><ChevronLeft size={15} /> 이전</button>
          {script.playing
            ? <button type="button" onClick={player.pause} className="p-1 rounded hover:bg-slate-800 text-slate-300" aria-label="일시정지"><Pause size={15} /></button>
            : <button type="button" onClick={player.resume} className="p-1 rounded hover:bg-slate-800 text-slate-300" aria-label="다시 재생"><Play size={15} /></button>}
          <Toggle small on={!!script.auto} color="sky" onClick={() => player.setAuto(!script.auto)} title="켜면 다음 장면으로 저절로 넘어갑니다">
            <span className="inline-flex items-center gap-0.5"><FastForward size={11} /> 자동</span>
          </Toggle>
          {tutorial && <Toggle small on={!!script.practice} color="amber" onClick={() => player.setPractice(!script.practice)} title="켜면 조작을 여러분이 직접 합니다">직접 해보기</Toggle>}
          <div className="hidden sm:block"><Seg small value={script.speed ?? 1} options={[[1, '1x'], [1.5, '1.5x'], [2, '2x']]} onChange={player.setSpeed} /></div>
          <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{Math.min(i + 1, n)} / {n}</span>
          {!tutorial && <button type="button" onClick={player.stop} className="p-1 rounded hover:bg-slate-800 text-slate-400" aria-label="자동 진행 끄기"><X size={15} /></button>}
          <button type="button" onClick={() => player.next()}
            className={`flex items-center gap-0.5 rounded-lg px-3 py-1.5 text-sm font-black transition ${ready && !waiting ? 'bg-violet-500 text-white shadow-[0_0_14px_rgba(167,139,250,.7)] animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            title={waiting ? '이 단계는 대신 처리하고 넘어갑니다' : '다음 장면 (Enter)'}>
            {waiting ? '건너뛰기' : '다음'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
