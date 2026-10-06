import React, { useState } from 'react';
import { DEVICE_TYPES, faderDb, fmtDb } from '../engine.js';
import { VFader, VMeter, Meter } from '../ui.jsx';
import { Knob, Toggle } from './controls.jsx';
import { CH_COLORS } from '../consoles.jsx';
import { chCountOf, chLabel, MONO_CHANNELS, mixerStateOf } from '../sim.js';

/* =====================================================================
 * 믹서 콘솔 (2D) — 실제 믹서와 같은 순서의 채널 스트립 + 마스터
 * 아날로그(MG 스타일 12채널): 입력 단자(MIC/LINE) → GAIN·PAD → HPF → COMP → EQ(HIGH·MID·FREQ·LOW)
 *   → AUX1(PRE)·AUX2·EFFECT → PAN → ON → PFL → 페이더. +48V는 마스터의 PHANTOM 스위치 하나.
 * 디지털(X32 스타일 8채널): 입력 패치 → +48V(입력마다) → GAIN → LOW CUT → EQ → FX/AUX → MUTE → 페이더
 * ===================================================================== */

const gainTxt = (v) => `+${v}dB`;
const eqTxt = (v) => `${v > 0 ? '+' : ''}${v}`;
const freqTxt = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `${v}`);
const panTxt = (v) => (v === 0 ? 'C' : v < 0 ? `L${-v}` : `R${v}`);
const FREQS = [250, 400, 630, 1000, 1600, 2500, 4000, 5000];
const JACK_BADGE = { mic: ['MIC', 'bg-sky-500/80 text-white'], line: ['LINE', 'bg-amber-400 text-slate-900'] };

export default function Console({ game, compact }) {
  const { st, actual, nominal, apply, show, selCh, setSelCh } = game;
  // 믹서가 여러 대면(자유 모드) 위에서 고른다. 기본은 첫 믹서
  const [pick, setPick] = useState(null);
  const mixers = Object.values(st.devices).filter((d) => d.placed && (d.type === 'analog_mixer' || d.type === 'digital_mixer'));
  const id = mixers.some((d) => d.id === pick) ? pick : st.mixerId;
  const mixer = st.devices[id];
  if (!mixer || !mixer.placed) return <div className="text-sm text-slate-400 p-3">믹서가 아직 배치되지 않았습니다.</div>;
  const digital = mixer.type === 'digital_mixer';
  const n = chCountOf(mixer.type);
  const S = mixerStateOf(st, id);
  const M = S.master;
  const mx = id === st.mixerId ? {} : { mixer: id };
  const set = (ch, key, value) => apply({ op: 'ch', ch, key, value, ...mx }, { visual: false });
  const commit = (ch, key) => (prev, value) => { if (prev !== value) show({ op: 'ch', ch, key, value, ...mx }, prev); };
  const tog = (ch, key) => apply({ op: 'ch', ch, key, value: !S.channels[ch - 1][key], ...mx });
  const mset = (key, value) => apply({ op: 'master', key, value, ...mx }, { visual: false });
  const mcommit = (key) => (prev, value) => { if (prev !== value) show({ op: 'master', key, value, ...mx }, prev); };
  const mapply = (key, value) => apply({ op: 'master', key, value, ...mx });
  const aMix = actual.mixerOf(id), nMix = nominal.mixerOf(id);
  const mainLv = actual.outLevel(id, 'main');
  const mainRLv = digital ? (mainLv == null ? null : mainLv - 1) : actual.outLevel(id, 'mainR');
  const auxLv = actual.outLevel(id, 'aux1');
  const nameOf = (i) => {
    const src = nMix.channels[i]?.comps?.[0]?.src;
    return src ? (st.devices[src]?.name ?? DEVICE_TYPES[st.devices[src]?.type]?.name ?? src) : '';
  };
  const phantomOn = !!M.phantom || (!digital && S.channels.some((c) => c.phantom));
  const anyPfl = !digital && S.channels.some((c) => c.pfl);
  const K = (ch, key, label, props) => (
    <Knob label={label} value={S.channels[ch - 1][key] ?? props.def} size={props.size ?? 28} {...props}
      onChange={(v) => set(ch, key, v)} onCommit={commit(ch, key)} />
  );
  return (
    <div className="space-y-1">
    {mixers.length > 1 && (
      <div className="flex gap-1 flex-wrap" role="tablist" aria-label="믹서 고르기">
        {mixers.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === id} onClick={() => setPick(d.id)}
            className={`rounded px-2 py-0.5 text-[11px] font-bold ${d.id === id ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{d.name ?? DEVICE_TYPES[d.type].name}{d.id === st.mixerId ? ' (1)' : ''}</button>
        ))}
      </div>
    )}
    <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="믹서 콘솔">
      {S.channels.slice(0, n).map((ch, i) => {
        const c = i + 1;
        const info = aMix.channels[i];
        const lv = info?.inLevel ?? null;
        const nm = nameOf(i);
        const sel = selCh === i;
        const mono = digital || i < MONO_CHANNELS;
        const jacks = [...new Set((nMix.channels[i]?.comps ?? []).map((x) => x.jack).filter(Boolean))];
        return (
          <div key={i} onPointerDown={() => setSelCh(i)}
            className={`shrink-0 ${mono ? 'w-[74px]' : 'w-[70px]'} rounded-md border ${sel ? 'border-sky-400 bg-slate-800/90' : 'border-slate-700 bg-slate-900/80'} p-1 flex flex-col items-center gap-1`}>
            <div className="w-full rounded px-1 py-0.5 text-center" style={{ background: digital ? CH_COLORS[i] : '#efe6cf' }}>
              <div className="text-[9px] font-black text-slate-900 leading-none">CH {chLabel(mixer.type, i)}{!mono && ' ST'}</div>
              <div className="text-[9px] font-bold text-slate-900 truncate leading-tight" title={nm}>{nm || '—'}</div>
            </div>
            {digital ? (
              <>
                <select value={ch.patch ?? `local${c}`} onChange={(e) => apply({ op: 'ch', ch: c, key: 'patch', value: e.target.value, ...mx })}
                  className="w-full text-[9px] bg-slate-950 border border-slate-600 rounded text-slate-200" aria-label={`CH${c} 입력 패치`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => <option key={k} value={`local${k}`}>IN: LOCAL {k}</option>)}
                  <option value="off">IN: OFF</option>
                </select>
                <Toggle small on={ch.phantom} color="amber" onClick={() => tog(c, 'phantom')} title="+48V 팬텀 전원 (콘덴서 마이크용) — 디지털 믹서는 입력마다 켭니다">+48V</Toggle>
              </>
            ) : (
              <div className="flex gap-0.5 h-[15px]" title="지금 이 채널에 꽂힌 단자: MIC = XLR(마이크 레벨), LINE = TRS(라인 레벨, 26dB 둔감)">
                {jacks.length ? jacks.map((j) => <span key={j} className={`rounded px-1 text-[8px] font-black leading-[15px] ${JACK_BADGE[j][1]}`}>{JACK_BADGE[j][0]}</span>)
                  : <span className="text-[8px] text-slate-500 leading-[15px]">{mono ? '단자 비어 있음' : 'L/R 비어 있음'}</span>}
              </div>
            )}
            <Knob label="GAIN" value={ch.gain} min={0} max={60} color="#ef4444" size={36} display={gainTxt(ch.gain)} def={30}
              onChange={(v) => set(c, 'gain', v)} onCommit={commit(c, 'gain')} title="입력 증폭 — 말하면서 아래 미터가 흰 칸(-20~-6dB)에 오게" />
            <div className="w-full"><Meter level={lv} target={[-20, -6]} thin /></div>
            {digital ? (
              <Toggle small on={ch.lowCut} color="cyan" onClick={() => tog(c, 'lowCut')} title="100Hz 아래 저음 차단 (웅웅거림·진동·숨소리)">LOW CUT</Toggle>
            ) : mono && (
              <div className="flex gap-0.5">
                <Toggle small on={ch.pad} color="amber" onClick={() => tog(c, 'pad')} title="26dB PAD: MIC 단자로 들어오는 너무 큰 신호를 26dB 줄입니다">PAD</Toggle>
                <Toggle small on={ch.lowCut} color="cyan" onClick={() => tog(c, 'lowCut')} title="HPF 80Hz: 80Hz 아래 저음 차단 (웅웅거림·진동·숨소리)">HPF</Toggle>
              </div>
            )}
            {!compact && (
              <>
                {!digital && i < 6 && K(c, 'comp', 'COMP', { min: 0, max: 100, color: '#fb923c', def: 0, title: '원 노브 컴프레서: 큰 소리를 눌러 고르게 하고 작은 소리를 끌어올립니다. 많이 올리면 하울링이 잘 납니다' })}
                {K(c, 'eqHigh', 'HIGH', { min: -15, max: 15, color: '#60a5fa', size: 30, display: eqTxt(ch.eqHigh), def: 0 })}
                {K(c, 'eqMid', 'MID', { min: -15, max: 15, color: '#34d399', size: 30, display: eqTxt(ch.eqMid), def: 0 })}
                {!digital && mono && (
                  <Knob label="FREQ" value={FREQS.indexOf(ch.eqFreq ?? 1000) < 0 ? 3 : FREQS.indexOf(ch.eqFreq ?? 1000)} min={0} max={FREQS.length - 1} size={24} color="#86efac"
                    display={freqTxt(ch.eqFreq ?? 1000)} def={3} title="MID가 다룰 주파수. 하울링·먹먹함은 보통 500Hz~4kHz"
                    onChange={(v) => set(c, 'eqFreq', FREQS[v])} onCommit={(p, v) => { if (p !== v) show({ op: 'ch', ch: c, key: 'eqFreq', value: FREQS[v], ...mx }, FREQS[p]); }} />
                )}
                {K(c, 'eqLow', 'LOW', { min: -15, max: 15, color: '#fbbf24', size: 30, display: eqTxt(ch.eqLow), def: 0 })}
                <div className="flex gap-0.5">
                  {K(c, 'aux', digital ? 'AUX' : 'AUX1', { min: 0, max: 100, color: '#c084fc', size: 26, def: 0, title: 'AUX 1: 모니터 스피커용 보내기 (페이더 앞, PRE)' })}
                  {!digital && K(c, 'aux2', 'AUX2', { min: 0, max: 100, color: '#a78bfa', size: 26, def: 0, title: 'AUX 2: 두 번째 모니터·방송용 보내기' })}
                </div>
                <div className="flex gap-0.5">
                  {K(c, 'fx', digital ? 'FX' : 'EFFECT', { min: 0, max: 100, color: '#2dd4bf', size: 26, def: 0, title: '리버브·에코 보내기' })}
                  {!digital && K(c, 'pan', mono ? 'PAN' : 'BAL', { min: -100, max: 100, color: '#e5e7eb', size: 26, def: 0, display: panTxt(ch.pan ?? 0), title: mono ? 'PAN: 왼쪽/오른쪽 스피커로 보내는 비율' : 'BAL: 왼쪽/오른쪽 균형' })}
                </div>
              </>
            )}
            {digital ? (
              <Toggle small on={ch.mute} color="red" onClick={() => tog(c, 'mute')}>MUTE</Toggle>
            ) : (
              <div className="flex gap-0.5 items-center">
                <Toggle small on={!ch.mute} color="amber" onClick={() => tog(c, 'mute')} title="ON: 불이 켜져 있어야 채널 소리가 나갑니다 (끄면 뮤트)">ON</Toggle>
                <span className={`h-2 w-2 rounded-full ${lv != null && lv > -3 ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,.9)]' : 'bg-red-950'}`} title="PEAK: 찢어지기 직전이면 켜집니다" />
                <Toggle small on={!!ch.pfl} color="amber" onClick={() => tog(c, 'pfl')} title="PFL: 이 채널만 헤드폰으로 미리 듣기 (페이더 앞)">PFL</Toggle>
              </div>
            )}
            <div className="flex items-end gap-0.5">
              <VFader label="" value={ch.fader} height={compact ? 96 : 120} display={fmtDb(faderDb(ch.fader)).replace(' dB', '')}
                onChange={(v) => set(c, 'fader', v)} onCommit={commit(c, 'fader')} />
              <VMeter level={lv == null || ch.mute ? null : lv + faderDb(ch.fader)} height={compact ? 74 : 98} />
            </div>
          </div>
        );
      })}
      {/* 마스터 */}
      <div className="shrink-0 w-[124px] rounded-md border border-rose-500/60 bg-slate-900/90 p-1.5 flex flex-col items-center gap-1">
        <div className="w-full rounded bg-rose-500 text-center text-[10px] font-black text-white py-0.5">{digital ? 'MASTER' : 'STEREO MASTER'}</div>
        {!digital && (
          <Toggle small on={phantomOn} color="red" onClick={() => mapply('phantom', !phantomOn)}
            title="PHANTOM +48V: 이 믹서는 스위치 하나로 모든 MIC(XLR) 단자에 한꺼번에 전원이 들어갑니다. 콘덴서 마이크용">PHANTOM +48V</Toggle>
        )}
        <div className="flex gap-1">
          <Knob label={digital ? 'AUX MST' : 'AUX1'} value={M.auxMaster} min={0} max={100} color="#c084fc" size={28} def={75} onChange={(v) => mset('auxMaster', v)} onCommit={mcommit('auxMaster')} title="AUX 1(모니터) 전체 볼륨" />
          {!digital && <Knob label="AUX2" value={M.aux2Master ?? 75} min={0} max={100} color="#a78bfa" size={28} def={75} onChange={(v) => mset('aux2Master', v)} onCommit={mcommit('aux2Master')} title="AUX 2 전체 볼륨" />}
        </div>
        <div className="flex gap-1">
          <Knob label={digital ? 'FX RTN' : 'RETURN'} value={M.fxReturn} min={0} max={100} color="#2dd4bf" size={28} def={50} onChange={(v) => mset('fxReturn', v)} onCommit={mcommit('fxReturn')} title="이펙트 리턴: 리버브가 메인으로 돌아오는 양" />
          {!digital && <Knob label="PHONES" value={M.phonesLevel ?? 75} min={0} max={100} color="#f8fafc" size={28} def={75} onChange={(v) => mset('phonesLevel', v)} onCommit={mcommit('phonesLevel')} title="헤드폰 볼륨" />}
        </div>
        {!digital && <div className={`text-[9px] font-bold ${anyPfl ? 'text-orange-400' : 'text-slate-500'}`}>{anyPfl ? '● PFL: 헤드폰 = 선택 채널' : '헤드폰 = STEREO'}</div>}
        {digital && (
          <label className="w-full text-[9px] text-slate-400">USB 출력
            <select value={M.usbOut} onChange={(e) => mapply('usbOut', e.target.value)}
              className="w-full text-[10px] bg-slate-950 border border-slate-600 rounded text-slate-200">
              <option value="main">Main L/R</option><option value="aux1">AUX 1</option><option value="off">OFF</option>
            </select>
          </label>
        )}
        <div className="flex gap-1 items-center text-[9px] text-slate-400"><span>AUX</span><div className="w-12"><Meter level={auxLv} thin /></div></div>
        {digital
          ? <Toggle small on={M.mainMute} color="red" onClick={() => mapply('mainMute', !M.mainMute)}>MAIN MUTE</Toggle>
          : <Toggle small on={!M.mainMute} color="amber" onClick={() => mapply('mainMute', !M.mainMute)} title="STEREO ON: 꺼지면 메인 스피커로 아무 소리도 나가지 않습니다">ST ON</Toggle>}
        <div className="flex items-end gap-0.5">
          <VFader label={digital ? 'MAIN' : 'STEREO'} value={M.mainFader} height={compact ? 96 : 150} cap="#fca5a5" display={fmtDb(faderDb(M.mainFader)).replace(' dB', '')}
            onChange={(v) => mset('mainFader', v)} onCommit={mcommit('mainFader')} />
          <VMeter level={mainLv} height={compact ? 74 : 128} />
          <VMeter level={mainRLv} height={compact ? 74 : 128} />
        </div>
      </div>
    </div>
    </div>
  );
}
