import React, { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, X, Send, CheckCircle2, Copy } from 'lucide-react';
import { getBetaContext, BETA_VERSION } from './betaContext.js';

/* =====================================================================
 * 베타 의견 보내기 — 어느 화면에서든 왼쪽 가장자리 탭으로 연다
 *  1순위: 이 게임의 저장 공간(db)에 의견을 남긴다 (공유 권한이 "참여자" 이상인 사람)
 *  2순위: claude.ai의 댓글 창을 연다 (댓글 권한이 있는 사람)
 *  둘 다 안 되면: 글을 복사해 링크를 보낸 사람에게 전해 달라고 안내
 * ===================================================================== */
const KINDS = [['bug', '버그·오류'], ['hard', '어려워요'], ['idea', '제안'], ['good', '좋았어요']];
const MAX = 1000;

const where = (c) => {
  const parts = [c.screen];
  if (c.title) parts.push(c.title);
  if (c.step) parts.push(`장면 ${c.step}`);
  if (c.entry) parts.push(c.entry);
  return parts.filter(Boolean).join(' · ');
};

async function capability(name) {
  try { return (await window.claude?.use?.(name)) ?? null; } catch { return null; }
}

export default function BetaFeedback() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('hard');
  const [text, setText] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | nodb | error
  const [ctx, setCtx] = useState(getBetaContext());
  const rootRef = useRef(null);
  const taRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    setCtx(getBetaContext()); setTimeout(() => taRef.current?.focus(), 50);
    // 의견을 저장할 수 없는 공유(보기·댓글 전용)라면 처음부터 댓글 안내를 보여 준다
    (async () => {
      const user = await capability('user');
      let ok = null;
      try { ok = user ? await user.can('data.write') : null; } catch { ok = null; }
      if (ok === false) setState('nodb');
    })();
  }, [open]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setState('sending');
    const db = await capability('db');
    if (!db) { setState('nodb'); return; }
    try {
      const user = await capability('user');
      let uid = null;
      try { uid = (await user?.id?.()) ?? null; } catch { uid = null; }
      await db.collection('feedback').add({
        kind, text: body.slice(0, MAX), where: where(ctx), context: ctx, version: BETA_VERSION,
        at: new Date().toISOString(), viewport: `${window.innerWidth}x${window.innerHeight}`,
        device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? '모바일' : '데스크톱', uid,
      });
      setState('sent'); setText('');
    } catch (e) {
      // 권한 없음(보기·댓글 전용 공유) 등은 댓글로 안내
      setState(['invalid_argument', 'not_granted', 'revoked', 'capability_disabled', 'capability_removed'].includes(e?.code) ? 'nodb' : 'error');
    }
  };
  const openComments = async () => {
    const c = await capability('comments');
    if (!c) { setState('nocomment'); return; }
    try { await c.openComposer({ element: rootRef.current ?? document.body }); } catch { setState('nocomment'); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(`[${KINDS.find((k) => k[0] === kind)?.[1]}] ${where(ctx)}\n${text}`); } catch { taRef.current?.select(); } };

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setState('idle'); }}
        className="fixed left-0 top-[38%] z-[70] flex items-center gap-1 rounded-r-lg border border-l-0 border-amber-300/70 bg-amber-400 px-1.5 py-2 text-[11px] font-black text-slate-900 shadow-lg [writing-mode:vertical-rl] hover:bg-amber-300"
        aria-label="베타 의견 보내기" title="불편한 점이나 아이디어를 개발자에게 보내요">
        <MessageSquarePlus size={14} className="rotate-90" /> 의견 보내기
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4" onClick={() => setOpen(false)}>
          <div ref={rootRef} className="w-full max-w-md rounded-2xl border border-amber-300/50 bg-slate-950 p-4 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="베타 의견 보내기">
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={18} className="text-amber-300" />
              <b className="text-base">베타 의견 보내기</b>
              <span className="text-[10px] text-slate-500">{BETA_VERSION}</span>
              <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded p-1 hover:bg-slate-800" aria-label="닫기"><X size={18} /></button>
            </div>
            {state === 'sent' ? (
              <div className="mt-4 space-y-3 text-center">
                <CheckCircle2 size={40} className="mx-auto text-green-400" />
                <p className="font-bold">고마워요! 의견이 전달됐어요.</p>
                <p className="text-sm text-slate-400">다음 업데이트에서 반영할게요.</p>
                <div className="flex justify-center gap-2">
                  <button type="button" onClick={() => setState('idle')} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-bold">하나 더 보내기</button>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-bold text-slate-900">게임으로 돌아가기</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="의견 종류">
                  {KINDS.map(([k, label]) => (
                    <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                      className={`rounded-full border px-3 py-1 text-sm font-bold ${kind === k ? 'border-amber-300 bg-amber-400 text-slate-900' : 'border-slate-600 text-slate-300 hover:bg-slate-800'}`}>{label}</button>
                  ))}
                </div>
                <label className="block">
                  <span className="text-xs text-slate-400">무엇이 불편했거나 좋았나요? 어디서 그랬는지 함께 적어 주면 더 좋아요.</span>
                  <textarea ref={taRef} id="beta-feedback-text" value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} rows={5}
                    className="mt-1 w-full resize-y rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-300 focus:outline-none"
                    placeholder="예) 파트 3에서 스테이지 박스 단자를 어디에 꽂는지 모르겠어요." />
                </label>
                <div className="text-[11px] text-slate-500">함께 보내는 위치: {where(ctx)} · {text.length}/{MAX}자</div>
                {state === 'nodb' && (
                  <div className="rounded-lg border border-sky-500/50 bg-sky-950/40 p-2 text-sm text-sky-100 space-y-2">
                    <p>이 링크로는 의견을 바로 저장할 수 없어요. 댓글 창으로 남겨 주세요.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={openComments} className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-bold text-white">댓글 창 열기</button>
                      <button type="button" onClick={copy} className="flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-bold"><Copy size={12} /> 글 복사</button>
                    </div>
                  </div>
                )}
                {state === 'nocomment' && (
                  <p className="rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-slate-300">여기서는 댓글도 남길 수 없어요. 글을 복사해서 링크를 보내 준 사람에게 전해 주세요. <button type="button" onClick={copy} className="ml-1 underline">글 복사</button></p>
                )}
                {state === 'error' && <p className="text-sm text-red-300">보내지 못했어요. 잠시 뒤 다시 눌러 주세요.</p>}
                <button type="button" onClick={send} disabled={!text.trim() || state === 'sending' || state === 'nodb' || state === 'nocomment'}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-400 py-2 font-black text-slate-900 disabled:opacity-40">
                  <Send size={16} /> {state === 'sending' ? '보내는 중…' : '보내기'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
