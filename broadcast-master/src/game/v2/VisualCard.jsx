import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2 } from 'lucide-react';
import { DEVICE_TYPES, CABLES } from '../engine.js';
import { PHOTOS, photoSrc, photoCredit, photoPage } from '../data/photos.js';
import { THUMBS } from '../thumbs/index.js';
import { CONCEPT } from '../eduVisuals.jsx';

/* =====================================================================
 * 설명 카드 — 튜토리얼 대사와 함께 뜨는 사진 · 3D 스틸 · 개념 그림
 *  실물 사진이 있으면 사진, 없으면 3D 모델 스틸, 그것도 없으면 아이콘
 * ===================================================================== */
const thumbOf = (c) => {
  const p = c.photo ? PHOTOS[c.photo] : null;
  const model = c.model ?? p?.model;
  const conn = c.connector ?? p?.connector;
  const female = c.female ?? p?.female;
  if (model && THUMBS[`model:${model}`]) return THUMBS[`model:${model}`];
  if (conn && THUMBS[`connector:${conn}${female ? ':f' : ''}`]) return THUMBS[`connector:${conn}${female ? ':f' : ''}`];
  if (conn && THUMBS[`connector:${conn}`]) return THUMBS[`connector:${conn}`];
  return null;
};
export const cardLabel = (c) => c.label ?? (c.photo ? PHOTOS[c.photo]?.alt : c.model ? DEVICE_TYPES[c.model]?.name : c.connector ? CABLES[c.connector]?.name : null) ?? '';

function Picture({ c, big, onZoom }) {
  if (c.concept) {
    const Visual = CONCEPT[c.concept];
    if (!Visual) return null;
    return <div className={`${big ? '' : 'max-h-[30vh] sm:max-h-[44vh]'} overflow-auto bg-[#131a27] text-slate-100`}><Visual focus={c.focus} /></div>;
  }
  const real = c.photo ? photoSrc(c.photo) : null;
  const src = real ?? thumbOf(c);
  const label = cardLabel(c);
  if (!src) {
    const Icon = DEVICE_TYPES[c.model ?? PHOTOS[c.photo]?.model]?.icon;
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-300 ${big ? 'h-[50vh]' : 'h-24 sm:h-36'}`}>
        {Icon && <Icon size={big ? 64 : 34} />}
        <span className="text-[11px] px-2 text-center">{label}</span>
      </div>
    );
  }
  return (
    <button type="button" onClick={onZoom} className="group relative block w-full bg-black/40" aria-label={`${label} 크게 보기`}>
      <img src={src} alt={label} className={`w-full object-contain ${big ? 'max-h-[78vh]' : 'h-24 sm:h-40'}`} draggable={false} />
      {!real && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-slate-300">3D 모형</span>}
      {!big && <Maximize2 size={14} className="absolute right-1 top-1 text-white/70 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

function Credit({ c }) {
  const credit = c.photo && photoSrc(c.photo) ? photoCredit(c.photo) : null;
  if (!credit) return null;
  const page = photoPage(c.photo);
  return (
    <div className="truncate px-2 pb-1 text-[9px] text-slate-500" title={credit}>
      사진: {page ? <a href={page} target="_blank" rel="noreferrer" className="underline hover:text-slate-300" onClick={(e) => e.stopPropagation()}>{credit}</a> : credit}
    </div>
  );
}

export default function VisualCard({ show }) {
  const [zoom, setZoom] = useState(null);
  if (!show) return null;
  const items = show.items ?? [show];
  const wide = items.length === 1 && show.concept;
  return (
    <>
      <div className={`rounded-xl border border-slate-600/70 bg-slate-950/95 shadow-2xl overflow-hidden ${wide ? 'w-[min(100%,460px)]' : items.length > 1 ? 'w-[min(100%,520px)]' : 'w-[min(70%,300px)] sm:w-[min(100%,320px)]'}`}>
        <div className={`grid gap-px bg-slate-700/60 ${items.length === 3 ? 'grid-cols-3' : items.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {items.map((c, k) => (
            <figure key={k} className="min-w-0 bg-slate-950">
              <Picture c={c} onZoom={() => setZoom(c)} />
              {!c.concept && <figcaption className="px-2 pt-1 text-[11px] font-bold text-slate-100 truncate">{cardLabel(c)}</figcaption>}
              <Credit c={c} />
            </figure>
          ))}
        </div>
        {show.caption && <div className="border-t border-slate-800 px-2.5 py-1.5 text-[12px] text-slate-300">{show.caption}</div>}
      </div>
      {zoom && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setZoom(null)} role="dialog" aria-label={cardLabel(zoom)}>
          <div className="relative w-[min(96vw,900px)] rounded-xl overflow-hidden border border-slate-700 bg-slate-950" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom(null)} className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-white" aria-label="닫기"><X size={18} /></button>
            <Picture c={zoom} big />
            <div className="px-3 py-2 text-sm font-bold text-slate-100">{cardLabel(zoom)}</div>
            <Credit c={zoom} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
