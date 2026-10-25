import React from 'react';
import { photoInfo } from './data/photos.js';

// 사진 출처 한 줄 — 작가 · 라이선스(원문) · 위키미디어 공용(파일 페이지) · 잘라냈으면 그렇다고
export default function PhotoCredit({ id, className = '', prefix = null }) {
  const p = photoInfo(id);
  if (!p) return null;
  const link = 'underline hover:text-slate-300';
  const stop = (e) => e.stopPropagation();
  return (
    <span className={className} title={p.credit}>
      {prefix}
      {p.author ?? ''}
      {p.license && <> · {p.licenseUrl ? <a href={p.licenseUrl} target="_blank" rel="noreferrer license" className={link} onClick={stop}>{p.license}</a> : p.license}</>}
      {' · '}{p.url ? <a href={p.url} target="_blank" rel="noreferrer" className={link} onClick={stop}>위키미디어 공용</a> : '위키미디어 공용'}
      {p.edited && ` · ${p.edited}`}
    </span>
  );
}
