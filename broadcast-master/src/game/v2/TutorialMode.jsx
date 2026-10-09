import React, { useState } from 'react';
import { ArrowLeft, PlayCircle, Hand, CheckCircle2 } from 'lucide-react';
import { TUTORIAL } from '../data/tutorial.js';
import { loadProgress, saveProgress } from '../ui.jsx';
import { getAudio } from '../audio.js';
import GameScreen from './GameScreen.jsx';

/* =====================================================================
 * 튜토리얼 — 파트 선택 → 대화 장면(한 줄 설명 → 직접 해 보기/보여 주세요 → 다음)
 * ===================================================================== */
export default function TutorialMode({ onExit, onStory, startPart = null }) {
  const [part, setPart] = useState(startPart != null && startPart >= 0 && startPart < TUTORIAL.length ? startPart : null);
  const [practice, setPractice] = useState(() => loadProgress('bm2-tut-practice', true));
  const [auto, setAuto] = useState(() => loadProgress('bm2-tut-auto', false));
  const [doneOverlay, setDoneOverlay] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const done = loadProgress('bm2-tutorial', []);
  if (part != null) {
    const p = TUTORIAL[part];
    const nextIdx = TUTORIAL.findIndex((x, k) => k > part && x.steps.length >= 3);
    const next = nextIdx >= 0 ? TUTORIAL[nextIdx] : null;
    return (
      <>
        <GameScreen key={`${p.id}-${runKey}`} spec={p} mode="tutorial" heading={`튜토리얼 ${part + 1}/${TUTORIAL.length}`}
          tutorial={{ steps: p.steps, practice, auto, key: `${p.id}-${runKey}`, onDone: () => { const d = new Set(loadProgress('bm2-tutorial', [])); d.add(p.id); saveProgress('bm2-tutorial', [...d]); setDoneOverlay(true); } }}
          onExit={() => { setPart(null); setDoneOverlay(false); }} />
        {doneOverlay && (
          <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-3">
            <div className="rounded-2xl border border-green-500/50 bg-slate-900/95 p-4 shadow-2xl flex flex-wrap items-center gap-2">
              <CheckCircle2 className="text-green-400" /> <b className="text-green-200">{p.title} 완료!</b>
              {next && <button type="button" onClick={() => { setDoneOverlay(false); setPart(nextIdx); setRunKey((k) => k + 1); }} className="px-3 py-1.5 rounded-lg bg-sky-500 text-white font-bold">다음 파트 →</button>}
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
        <p className="text-sm text-slate-300 leading-relaxed">선배 엔지니어가 한 장면씩 설명해 줍니다. 한 줄을 듣고 <b>다음</b>을 누르면(또는 Enter) 다음 장면으로 넘어가요. 조작이 나오는 장면에서는 <b>직접 해 보세요</b> 안내와 함께 해야 할 곳이 반짝입니다. 막히면 <b>보여 주세요</b>를 누르면 유령 손이 대신 보여 줍니다.</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-950/30 px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={practice} onChange={(e) => { setPractice(e.target.checked); saveProgress('bm2-tut-practice', e.target.checked); }} className="accent-amber-400 w-4 h-4" />
            <Hand size={16} className="text-amber-300" /> 직접 해보기 (조작은 내가 한다)
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-950/30 px-3 py-2 text-sm cursor-pointer">
            <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); saveProgress('bm2-tut-auto', e.target.checked); }} className="accent-sky-400 w-4 h-4" />
            <PlayCircle size={16} className="text-sky-300" /> 자동 넘김 (보기만 하기)
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {TUTORIAL.map((p, i) => {
            const soon = p.steps.length < 3; // 아직 쓰는 중인 파트
            return (
              <button key={p.id} type="button" disabled={soon} onClick={() => { setPart(i); setRunKey((k) => k + 1); }}
                className={`text-left rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-4 space-y-2 transition ${soon ? 'opacity-50 cursor-not-allowed' : 'hover:border-sky-400 hover:-translate-y-0.5'}`}>
                <div className="flex items-center justify-between"><span className="text-xs font-bold text-sky-300">PART {i + 1}</span>{done.includes(p.id) && <CheckCircle2 size={16} className="text-green-400" />}</div>
                <div className="font-black leading-snug">{p.title.replace(/^파트 \d · /, '')}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.summary}</p>
                {soon
                  ? <div className="text-sm font-bold text-slate-400">준비 중</div>
                  : <div className="flex items-center gap-1 text-sm font-bold text-sky-300"><PlayCircle size={16} /> 시작 · {p.steps.length}단계</div>}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
