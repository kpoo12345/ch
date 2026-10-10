import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Copy, Inbox, ExternalLink } from 'lucide-react';

/* =====================================================================
 * 의견 모아보기 — 게임 주인(편집 권한)만. 테스터가 보낸 의견을 한곳에서 읽는다
 *  저장 구조: feedback/<테스터 id> (마지막 보낸 때) · feedback/<테스터 id>/items/<자동 id> (의견 하나)
 *  규칙상 feedback 아래는 주인·편집자만 전부 읽을 수 있고, 테스터는 자기 것만 본다
 * ===================================================================== */
const KIND = { bug: ['버그·오류', 'bg-red-500/20 text-red-200 border-red-500/50'], hard: ['어려워요', 'bg-amber-500/20 text-amber-100 border-amber-400/50'], idea: ['제안', 'bg-sky-500/20 text-sky-100 border-sky-400/50'], good: ['좋았어요', 'bg-green-500/20 text-green-100 border-green-400/50'] };
const ISSUES = 'https://github.com/kpoo12345/ch/issues?q=is%3Aissue+%22%5B%EB%B2%A0%ED%83%80%5D%22';
const fmt = (iso) => { try { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return iso ?? ''; } };

async function cap(name) {
  try { return (await window.claude?.use?.(name)) ?? null; } catch { return null; }
}
// 이 화면을 볼 수 있는 사람인지 (주인·편집자)
export async function canReadFeedback() {
  const user = await cap('user');
  try { return !!(user && ((await user.isOwner()) || (await user.canEdit()))); } catch { return false; }
}

export default function FeedbackInbox({ onClose }) {
  const [state, setState] = useState('loading'); // loading | ready | nodb | error
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const load = async () => {
    setState('loading');
    const db = await cap('db');
    if (!db) { setState('nodb'); return; }
    try {
      const people = await db.collection('feedback').get();
      const all = [];
      let n = 0;
      for (const p of people.docs) {
        n += 1;
        const snap = await db.collection(`feedback/${p.id}/items`).get();
        snap.docs.forEach((d) => { const v = d.data() ?? {}; all.push({ id: d.id, who: `테스터 ${n}`, ...v }); });
      }
      all.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')));
      setItems(all);
      setState('ready');
    } catch { setState('error'); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = items.filter((x) => filter === 'all' || x.kind === filter);
  const counts = Object.fromEntries(Object.keys(KIND).map((k) => [k, items.filter((x) => x.kind === k).length]));
  const copyAll = async () => {
    const txt = shown.map((x) => `[${KIND[x.kind]?.[0] ?? x.kind}] ${x.where ?? ''} · ${x.who} · ${x.device ?? ''} ${x.viewport ?? ''} · ${x.version ?? ''} · ${fmt(x.at)}\n${x.text ?? ''}${x.error ? `\n(오류: ${x.error})` : ''}`).join('\n\n');
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-stretch sm:items-center justify-center bg-black/70 p-0 sm:p-4" onClick={onClose}>
      <div className="flex w-full max-w-2xl flex-col sm:max-h-[90dvh] rounded-none sm:rounded-2xl border border-slate-600 bg-slate-950 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="베타 의견 모아보기">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <Inbox size={18} className="text-amber-300" />
          <b>베타 의견 모아보기</b>
          <span className="text-xs text-slate-400">{state === 'ready' ? `${items.length}건` : ''}</span>
          <button type="button" onClick={load} className="ml-auto rounded p-1.5 hover:bg-slate-800" aria-label="새로 고침" title="새로 고침"><RefreshCw size={16} /></button>
          <button type="button" onClick={onClose} className="rounded p-1.5 hover:bg-slate-800" aria-label="닫기"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 px-4 py-2">
          {[['all', `전체 ${items.length}`], ...Object.entries(KIND).map(([k, [label]]) => [k, `${label} ${counts[k]}`])].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${filter === k ? 'border-amber-300 bg-amber-400 text-slate-900' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>{label}</button>
          ))}
          <button type="button" onClick={copyAll} disabled={!shown.length} className="ml-auto flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-bold disabled:opacity-40"><Copy size={12} /> {copied ? '복사됐어요' : '보이는 의견 복사'}</button>
        </div>
        <div className="min-h-[40dvh] flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {state === 'loading' && <p className="text-sm text-slate-400">불러오는 중…</p>}
          {state === 'nodb' && <p className="text-sm text-slate-300">claude.ai에서 게임을 열었을 때만 볼 수 있어요.</p>}
          {state === 'error' && <p className="text-sm text-red-300">불러오지 못했어요. 새로 고침을 눌러 주세요.</p>}
          {state === 'ready' && !shown.length && <p className="text-sm text-slate-400">아직 들어온 의견이 없어요.</p>}
          {state === 'ready' && shown.map((x) => (
            <article key={`${x.who}-${x.id}`} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className={`rounded-full border px-2 py-0.5 font-bold ${KIND[x.kind]?.[1] ?? 'border-slate-600'}`}>{KIND[x.kind]?.[0] ?? x.kind}</span>
                <span className="font-bold text-slate-200">{x.where}</span>
                <span className="ml-auto">{x.who} · {fmt(x.at)}</span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{x.text}</p>
              <div className="mt-1.5 text-[10px] text-slate-500">{[x.device, x.viewport, x.webgl === false ? '3D 불가' : null, x.audio ? `소리: ${x.audio}` : null, x.version].filter(Boolean).join(' · ')}{x.error ? <span className="block text-red-300/80">마지막 오류: {x.error}</span> : null}</div>
            </article>
          ))}
        </div>
        <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
          <span>공개 링크로 들어온 테스터는 GitHub나 글 복사로 보내요.</span>
          <a href={ISSUES} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 font-bold text-sky-300 hover:text-sky-200">GitHub로 온 의견 <ExternalLink size={12} /></a>
        </div>
      </div>
    </div>
  );
}
