import React, { useState } from 'react';
import { ArrowLeft, PlayCircle, Hand, CheckCircle2 } from 'lucide-react';
import { TUTORIAL } from '../data/tutorial.js';
import { loadProgress, saveProgress } from '../ui.jsx';
import { getAudio } from '../audio.js';
import GameScreen from './GameScreen.jsx';

/* =====================================================================
 * 튜토리얼 — 파트 선택 → 자동 진행(유령 손 + 내레이션), "직접 해보기"로 따라 하기
 * ===================================================================== */
export default function TutorialMode({ onExit, onStory }) {
  const [part, setPart] = useState(null);
  const [practice, setPractice] = useState(false);
  const [doneOverlay, setDoneOverlay] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const done = loadProgress('bm2-tutorial', []);
  if (part != null) {
    const p = TUTORIAL[part];
    const next = TUTORIAL[part + 1];
    return (
      <>
        <GameScreen key={`${p.id}-${runKey}`} spec={p} mode="tutorial" heading={`튜토리얼 ${part + 1}/${TUTORIAL.length}`}
          tutorial={{ steps: p.steps, practice, key: `${p.id}-${runKey}`, onDone: () => { const d = new Set(loadProgress('bm2-tutorial', [])); d.add(p.id); saveProgress('bm2-tutorial', [...d]); setDoneOverlay(true); } }}
          onExit={() => { setPart(null); setDoneOverlay(false); }} />
        {doneOverlay && (
          <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-3">
            <div className="rounded-2xl border border-green-500/50 bg-slate-900/95 p-4 shadow-2xl flex flex-wrap items-center gap-2">
              <CheckCircle2 className="text-green-400" /> <b className="text-green-200">{p.title} 완료!</b>
              {next && <button type="button" onClick={() => { setDoneOverlay(false); setPart(part + 1); setRunKey((k) => k + 1); }} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white font-bold">다음 파트 →</button>}
              <button type="button" onClick={() => { setDoneOverlay(false); setRunKey((k) => k + 1); }} className="px-3 py-1.5 rounded-lg bg-slate-700 font-bold text-sm">다시 보기</button>
              {!next && <button type="button" onClick={onStory} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-bold">스토리 모드 시작 →</button>}
              <button type="button" onClick={() => { setDoneOverlay(false); setPart(null); }} className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm">목록</button>
            </div>
          </div>
        )}
      </>
    );
  }
  return (
    <div className="min-h-[100dvh] bg-[#0b1220] text-slate-100" onPointerDown={() => getAudio().unlock()}>
      <header className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <button type="button" onClick={onExit} className="p-1.5 rounded hover:bg-slate-800" aria-label="메인 메뉴"><ArrowLeft size={18} /></button>
        <div className="font-black">튜토리얼</div>
      </header>
      <main className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4">
        <p className="text-sm text-slate-300 leading-relaxed">게임이 스스로 진행하며 기초 장비를 보여 줍니다. <b>유령 손</b>이 케이블을 꽂고 노브를 돌리는 모습을 보며 내레이션으로 개념을 익히세요. 보기만 해도 되고, <b>직접 해보기</b>를 켜면 각 단계를 여러분이 따라 할 때까지 기다립니다.</p>
        <label className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2 text-sm cursor-pointer">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} className="accent-amber-400 w-4 h-4" />
          <Hand size={16} className="text-amber-300" /> 직접 해보기 모드로 시작 (진행 중에도 바꿀 수 있어요)
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {TUTORIAL.map((p, i) => (
            <button key={p.id} type="button" onClick={() => { setPart(i); setRunKey((k) => k + 1); }}
              className="text-left rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-sky-400 p-4 space-y-2 transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between"><span className="text-xs font-bold text-sky-300">PART {i + 1}</span>{done.includes(p.id) && <CheckCircle2 size={16} className="text-green-400" />}</div>
              <div className="font-black leading-snug">{p.title.replace(/^파트 \d · /, '')}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{p.summary}</p>
              <div className="flex items-center gap-1 text-sm font-bold text-sky-300"><PlayCircle size={16} /> 시작 · {p.steps.length}단계</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
