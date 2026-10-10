import React, { useEffect } from 'react';
import { Ear, Radio, X, Users } from 'lucide-react';
import { DEVICE_TYPES } from '../engine.js';
import { AUDIBLE } from '../sim.js';

/* =====================================================================
 * 현장 vs 방송 비교 (A/B)
 *  현장(객석)에서 들리는 소리와 방송(시청자)으로 나가는 소리는 다르다.
 *  - 드럼 같은 생소리는 객석에선 크게 들려도, 마이크로 잡지 않으면 방송엔 없다
 *  - 방송 믹스는 따로 만든다 (USB·AUX 라우팅, 페이더 균형)
 *  A/B 버튼(키보드 A·B)으로 듣는 위치를 빠르게 바꿔 들으며 차이를 찾는다.
 * ===================================================================== */
const pct = (lv) => (lv == null ? 0 : Math.max(0, Math.min(100, ((lv + 50) / 50) * 100)));

export default function ListenCompare({ st, sim, listen, setListen, onClose }) {
  const room = sim.heard.main ?? {};
  const air = sim.heard.stream ?? {};
  const hasStream = !!sim.stream.pcId || sim.video.isPro;
  const name = (src) => {
    if (src === 'drums_acoustic') return '드럼 세트 (생소리)';
    const d = st.devices[src];
    if (!d) return src === 'pc_builtin' ? 'PC 내장 마이크' : src;
    return `${d.name ?? DEVICE_TYPES[d.type]?.name ?? src}${d.type === 'drum_kit' ? ' (생소리)' : ''}`;
  };
  const srcs = [...new Set([...Object.keys(room), ...Object.keys(air)])]
    .filter((k) => (room[k]?.level ?? -99) > AUDIBLE || (air[k]?.level ?? -99) > AUDIBLE);
  const loud = (o) => Object.entries(o).filter(([, h]) => h.level > AUDIBLE).sort((a, b) => b[1].level - a[1].level)[0]?.[0];

  // 차이 설명
  const notes = [];
  const onlyRoom = srcs.filter((k) => (room[k]?.level ?? -99) > AUDIBLE && !((air[k]?.level ?? -99) > AUDIBLE));
  const onlyAir = srcs.filter((k) => (air[k]?.level ?? -99) > AUDIBLE && !((room[k]?.level ?? -99) > AUDIBLE));
  if (!hasStream) notes.push('이 현장에는 방송(송출) 장비가 없어요. 방송이 있는 현장에서 비교해 보세요.');
  else if (!Object.values(air).some((h) => h.level > AUDIBLE)) notes.push('방송으로 나가는 소리가 하나도 없어요! 시청자는 무음 방송을 보고 있습니다. OBS 오디오 소스·믹서 USB 출력·ATEM MIC 입력을 확인하세요.');
  onlyRoom.forEach((k) => {
    const h = room[k];
    if (h.acoustic) notes.push(`${name(k)}: 객석에선 크게 들리지만 방송엔 없습니다. 생소리는 마이크로 잡아 믹서로 보내야 방송에 실립니다.`);
    else if (hasStream) notes.push(`${name(k)}: 현장 스피커로만 나가고 방송엔 빠져 있어요. 방송 믹스(USB·AUX)에도 보내야 합니다.`);
  });
  onlyAir.forEach((k) => notes.push(`${name(k)}: 방송에만 나가고 객석 스피커에선 안 들립니다. 의도한 것인지 확인하세요 (예: 방송용 BGM).`));
  const lr = loud(room), la = loud(air);
  if (hasStream && lr && la && lr !== la) notes.push(`가장 크게 들리는 소리가 달라요 — 현장: ${name(lr)}, 방송: ${name(la)}. 방송 믹스의 균형을 따로 잡아야 합니다.`);
  const anyHum = Object.values(air).some((h) => h.hum && h.level > AUDIBLE);
  if (anyHum) notes.push('방송에 "웅—" 하는 험이 섞여 있어요. 시청자는 이어폰으로 들어서 현장보다 잡음이 더 잘 들립니다.');
  if (!notes.length && hasStream) notes.push('현장과 방송의 구성이 비슷합니다. 그래도 방송은 꼭 헤드폰으로 직접 들어 보며 확인하세요.');

  // 키보드 A / B
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'a' || e.key === 'A') setListen('main');
      if ((e.key === 'b' || e.key === 'B') && hasStream) setListen('stream');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasStream, setListen]);

  return (
    <div className="absolute right-12 top-2 z-30 w-[min(86%,380px)] rounded-xl border border-sky-400/50 bg-slate-950/95 backdrop-blur shadow-2xl p-2.5 text-slate-100">
      <div className="flex items-center gap-1.5 mb-2">
        <Ear size={16} className="text-sky-300" />
        <b className="text-sm">현장 vs 방송 비교</b>
        <button type="button" onClick={onClose} className="ml-auto p-1 rounded hover:bg-slate-800" aria-label="닫기"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <button type="button" onClick={() => setListen('main')}
          className={`rounded-lg px-2 py-1.5 text-left border ${listen === 'main' ? 'border-amber-300 bg-amber-500/20' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
          <div className="text-[10px] font-black text-amber-300">A<span className="hidden sm:inline font-bold text-amber-300/70"> · 단축키 A</span></div>
          <div className="text-sm font-bold flex items-center gap-1"><Users size={14} /> 현장 (객석)</div>
        </button>
        <button type="button" onClick={() => hasStream && setListen('stream')} disabled={!hasStream}
          className={`rounded-lg px-2 py-1.5 text-left border disabled:opacity-40 ${listen === 'stream' ? 'border-red-300 bg-red-500/20' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
          <div className="text-[10px] font-black text-red-300">B<span className="hidden sm:inline font-bold text-red-300/70"> · 단축키 B</span></div>
          <div className="text-sm font-bold flex items-center gap-1"><Radio size={14} /> 방송 (시청자)</div>
        </button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {srcs.length === 0 && <div className="text-xs text-slate-400">지금 들리는 소리가 없어요. 말하기·연주를 켜 보세요.</div>}
        {srcs.map((k) => (
          <div key={k} className="grid grid-cols-[1fr_70px_70px] items-center gap-1.5 text-[11px]">
            <span className="truncate text-slate-200" title={name(k)}>{name(k)}</span>
            <div className="h-2 rounded bg-slate-800 overflow-hidden" title={`현장 ${room[k] ? room[k].level.toFixed(0) : '—'} dB`}><div className="h-full bg-amber-400" style={{ width: `${pct(room[k]?.level)}%` }} /></div>
            <div className="h-2 rounded bg-slate-800 overflow-hidden" title={`방송 ${air[k] ? air[k].level.toFixed(0) : '—'} dB`}><div className="h-full bg-red-400" style={{ width: `${pct(air[k]?.level)}%` }} /></div>
          </div>
        ))}
        {srcs.length > 0 && <div className="grid grid-cols-[1fr_70px_70px] gap-1.5 text-[9px] text-slate-500"><span /><span className="text-center">현장</span><span className="text-center">방송</span></div>}
      </div>
      <ul className="mt-2 space-y-1 text-[12px] leading-snug text-slate-300 list-disc pl-4">
        {notes.slice(0, 4).map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}
