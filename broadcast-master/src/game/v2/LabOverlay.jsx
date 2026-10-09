import React, { Suspense, lazy } from 'react';
import { X, FlaskConical } from 'lucide-react';

/* =====================================================================
 * 튜토리얼 실습실 — 대화 도중 "실습실 열기"로 직접 만져 보고 귀로 비교한다
 * ===================================================================== */
const FadeLab = lazy(() => import('../FadeLab.jsx'));
const AudioLab = lazy(() => import('../AudioLab.jsx'));
const TITLE = { fade: '페이드 실습실', eq: 'EQ 실습실', fx: '울림(리버브) 실습실' };

export default function LabOverlay({ lab, onClose }) {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div className="w-[min(100%,820px)] rounded-2xl border border-cyan-400/50 bg-[#0f1624] shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={TITLE[lab.lab]}>
        <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
          <FlaskConical size={16} className="text-cyan-300" />
          <b className="text-sm text-cyan-100">{TITLE[lab.lab] ?? '실습실'}</b>
          {lab.goal && <span className="min-w-0 truncate text-xs text-slate-300">· {lab.goal}</span>}
          <button type="button" onClick={onClose} className="ml-auto flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-cyan-500"><X size={14} /> 다 해 봤어요</button>
        </div>
        <Suspense fallback={<div className="p-6 text-sm text-slate-400">불러오는 중…</div>}>
          {lab.lab === 'fade' ? <FadeLab /> : <AudioLab focus={lab.lab === 'fx' ? 'fx' : 'eq'} />}
        </Suspense>
      </div>
    </div>
  );
}
