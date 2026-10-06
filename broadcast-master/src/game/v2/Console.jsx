import React from 'react';
import { DEVICE_TYPES, faderDb, fmtDb } from '../engine.js';
import { VFader, VMeter, Meter } from '../ui.jsx';
import { Knob, Toggle } from './controls.jsx';
import { CH_COLORS } from '../consoles.jsx';

/* =====================================================================
 * 믹서 콘솔 (2D) — 8채널 스트립 + 마스터
 * 위에서 아래로 신호가 흐르는 순서: 입력(패치·48V) → GAIN → LOW CUT → EQ → FX/AUX 센드 → MUTE → 페이더
 * ===================================================================== */

const gainTxt = (v) => `+${v}dB`;
const eqTxt = (v) => `${v > 0 ? '+' : ''}${v}`;

export default function Console({ game, compact }) {
  const { st, actual, nominal, apply, show, selCh, setSelCh } = game;
  const mixer = st.devices[st.mixerId];
  if (!mixer || !mixer.placed) return <div className="text-sm text-slate-400 p-3">믹서가 아직 배치되지 않았습니다.</div>;
  const digital = mixer.type === 'digital_mixer';
  const M = st.master;
  const set = (ch, key, value) => apply({ op: 'ch', ch, key, value }, { visual: false });
  const commit = (ch, key) => (prev, value) => { if (prev !== value) show({ op: 'ch', ch, key, value }, prev); };
  const tog = (ch, key) => apply({ op: 'ch', ch, key, value: !st.channels[ch - 1][key] });
  const mset = (key, value) => apply({ op: 'master', key, value }, { visual: false });
  const mcommit = (key) => (prev, value) => { if (prev !== value) show({ op: 'master', key, value }, prev); };
  const mainLv = actual.outLevel(st.mixerId, 'main');
  const auxLv = actual.outLevel(st.mixerId, 'aux1');
  const nameOf = (i) => {
    const src = nominal.mixer.channels[i]?.comps?.[0]?.src;
    return src ? (st.devices[src]?.name ?? DEVICE_TYPES[st.devices[src]?.type]?.name ?? src) : '';
  };
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="믹서 콘솔">
      {st.channels.map((ch, i) => {
        const n = i + 1;
        const c = actual.mixer.channels[i];
        const lv = c?.inLevel ?? null;
        const nm = nameOf(i);
        const sel = selCh === i;
        return (
          <div key={i} onPointerDown={() => setSelCh(i)}
            className={`shrink-0 w-[74px] rounded-md border ${sel ? 'border-sky-400 bg-slate-800/90' : 'border-slate-700 bg-slate-900/80'} p-1 flex flex-col items-center gap-1`}>
            <div className="w-full rounded px-1 py-0.5 text-center" style={{ background: digital ? CH_COLORS[i] : '#efe6cf' }}>
              <div className="text-[9px] font-black text-slate-900 leading-none">CH {n}</div>
              <div className="text-[9px] font-bold text-slate-900 truncate leading-tight" title={nm}>{nm || '—'}</div>
            </div>
            {digital && (
              <select value={ch.patch ?? `local${n}`} onChange={(e) => apply({ op: 'ch', ch: n, key: 'patch', value: e.target.value })}
                className="w-full text-[9px] bg-slate-950 border border-slate-600 rounded text-slate-200" aria-label={`CH${n} 입력 패치`}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => <option key={k} value={`local${k}`}>IN: LOCAL {k}</option>)}
                <option value="off">IN: OFF</option>
              </select>
            )}
            <Toggle small on={ch.phantom} color="amber" onClick={() => tog(n, 'phantom')} title="+48V 팬텀 전원 (콘덴서 마이크용)">+48V</Toggle>
            <Knob label="GAIN" value={ch.gain} min={0} max={60} color="#ef4444" size={36} display={gainTxt(ch.gain)} def={30}
              onChange={(v) => set(n, 'gain', v)} onCommit={commit(n, 'gain')} title="입력 증폭 — 말하면서 아래 미터가 흰 칸(-20~-6dB)에 오게" />
            <div className="w-full"><Meter level={lv} target={[-20, -6]} thin /></div>
            <Toggle small on={ch.lowCut} color="cyan" onClick={() => tog(n, 'lowCut')} title="100Hz 아래 저음 차단 (웅웅거림·진동·숨소리)">LOW CUT</Toggle>
            {!compact && (
              <>
                <Knob label="HIGH" value={ch.eqHigh} min={-15} max={15} color="#60a5fa" size={30} display={eqTxt(ch.eqHigh)} def={0} onChange={(v) => set(n, 'eqHigh', v)} onCommit={commit(n, 'eqHigh')} />
                <Knob label="MID" value={ch.eqMid} min={-15} max={15} color="#34d399" size={30} display={eqTxt(ch.eqMid)} def={0} onChange={(v) => set(n, 'eqMid', v)} onCommit={commit(n, 'eqMid')} />
                <Knob label="LOW" value={ch.eqLow} min={-15} max={15} color="#fbbf24" size={30} display={eqTxt(ch.eqLow)} def={0} onChange={(v) => set(n, 'eqLow', v)} onCommit={commit(n, 'eqLow')} />
                <div className="flex gap-0.5">
                  <Knob label="FX" value={ch.fx} min={0} max={100} color="#2dd4bf" size={28} def={0} onChange={(v) => set(n, 'fx', v)} onCommit={commit(n, 'fx')} title="리버브(에코) 보내기" />
                  <Knob label="AUX" value={ch.aux} min={0} max={100} color="#c084fc" size={28} def={0} onChange={(v) => set(n, 'aux', v)} onCommit={commit(n, 'aux')} title="모니터/방송용 AUX 보내기 (페이더 앞)" />
                </div>
              </>
            )}
            <Toggle small on={ch.mute} color="red" onClick={() => tog(n, 'mute')}>MUTE</Toggle>
            <div className="flex items-end gap-0.5">
              <VFader label="" value={ch.fader} height={compact ? 96 : 120} display={fmtDb(faderDb(ch.fader)).replace(' dB', '')}
                onChange={(v) => set(n, 'fader', v)} onCommit={commit(n, 'fader')} />
              <VMeter level={lv == null || ch.mute ? null : lv + faderDb(ch.fader)} height={compact ? 74 : 98} />
            </div>
          </div>
        );
      })}
      {/* 마스터 */}
      <div className="shrink-0 w-[118px] rounded-md border border-rose-500/60 bg-slate-900/90 p-1.5 flex flex-col items-center gap-1">
        <div className="w-full rounded bg-rose-500 text-center text-[10px] font-black text-white py-0.5">MASTER</div>
        <div className="flex gap-1">
          <Knob label="AUX MST" value={M.auxMaster} min={0} max={100} color="#c084fc" size={30} def={75} onChange={(v) => mset('auxMaster', v)} onCommit={mcommit('auxMaster')} title="AUX(모니터/방송) 전체 볼륨" />
          <Knob label="FX RTN" value={M.fxReturn} min={0} max={100} color="#2dd4bf" size={30} def={50} onChange={(v) => mset('fxReturn', v)} onCommit={mcommit('fxReturn')} title="리버브 리턴(효과 전체 양)" />
        </div>
        {digital && (
          <label className="w-full text-[9px] text-slate-400">USB 출력
            <select value={M.usbOut} onChange={(e) => apply({ op: 'master', key: 'usbOut', value: e.target.value })}
              className="w-full text-[10px] bg-slate-950 border border-slate-600 rounded text-slate-200">
              <option value="main">Main L/R</option><option value="aux1">AUX 1</option><option value="off">OFF</option>
            </select>
          </label>
        )}
        <div className="flex gap-1 items-center text-[9px] text-slate-400"><span>AUX</span><div className="w-12"><Meter level={auxLv} thin /></div></div>
        <Toggle small on={M.mainMute} color="red" onClick={() => apply({ op: 'master', key: 'mainMute', value: !M.mainMute })}>MAIN MUTE</Toggle>
        <div className="flex items-end gap-0.5">
          <VFader label="MAIN" value={M.mainFader} height={compact ? 96 : 150} cap="#fca5a5" display={fmtDb(faderDb(M.mainFader)).replace(' dB', '')}
            onChange={(v) => mset('mainFader', v)} onCommit={mcommit('mainFader')} />
          <VMeter level={mainLv} height={compact ? 74 : 128} />
          <VMeter level={mainLv == null ? null : mainLv - 1} height={compact ? 74 : 128} />
        </div>
      </div>
    </div>
  );
}
