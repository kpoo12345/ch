import React from 'react';
import { DEVICE_TYPES, PORT_COLOR, CABLES, PORT_KIND_LABEL } from '../engine.js';

/* =====================================================================
 * 연결표 (2D) — 3D에서 단자를 누르기 어려울 때(휴대폰 등) 같은 방식으로 연결
 * 단자 버튼 → 다른 단자 버튼 순서로 누르면 선택한 케이블로 연결된다.
 * ===================================================================== */
export default function PortBoard({ game }) {
  const { st, pending, clickPort, apply, setSelected, selected } = game;
  const devs = Object.values(st.devices);
  const usedBy = (d, p) => st.connections.find((c) => (c.from.d === d && c.from.p === p) || (c.to.d === d && c.to.p === p));
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400">단자를 하나 누르고 → 아래에서 케이블을 고른 뒤 → 연결할 단자를 누르세요. 신호는 OUT(출력) → IN(입력)으로 흐릅니다.</p>
      {devs.map((d) => {
        const def = DEVICE_TYPES[d.type];
        const Icon = def.icon;
        return (
          <div key={d.id} className={`rounded-md border p-2 ${selected === d.id ? 'border-sky-400 bg-slate-800/80' : 'border-slate-700 bg-slate-900/70'}`}>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setSelected(d.id)} className="flex items-center gap-1.5 text-sm font-bold text-slate-100 hover:text-sky-300 text-left">
                {Icon && <Icon size={14} />} {d.name ?? def.name}
              </button>
              {!d.placed && <button type="button" onClick={() => apply({ op: 'place', device: d.id })} className="px-2 py-0.5 rounded bg-sky-600 text-white text-xs font-bold">+ 배치</button>}
            </div>
            {d.placed && (
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {[['IN', def.ins], ['OUT', def.outs]].map(([dir, ports]) => (
                  <div key={dir} className="space-y-1">
                    {ports.length > 0 && <div className="text-[9px] font-bold text-slate-500">{dir === 'IN' ? '입력 IN' : '출력 OUT'}</div>}
                    {ports.map((p) => {
                      const used = usedBy(d.id, p.id);
                      const isPending = pending && pending.d === d.id && pending.p === p.id;
                      const candidate = pending && !isPending && pending.d !== d.id && !used && pending.dir !== (dir === 'IN' ? 'in' : 'out');
                      const other = used ? (used.from.d === d.id ? used.to : used.from) : null;
                      return (
                        <button key={p.id} type="button" onClick={() => clickPort(d.id, p.id)} title={PORT_KIND_LABEL[p.kind]}
                          className={`w-full text-left rounded px-1.5 py-1 text-[11px] border flex items-center gap-1 ${isPending ? 'bg-white text-slate-900 border-white' : candidate ? 'bg-sky-900/60 border-sky-400 text-sky-100' : 'bg-slate-950/60 border-slate-700 text-slate-200 hover:border-slate-500'}`}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PORT_COLOR[p.kind] }} />
                          <span className="truncate">{p.label}</span>
                          {used && <span className="ml-auto shrink-0 text-[9px] px-1 rounded" style={{ background: CABLES[used.cable]?.stroke, color: '#0b1220' }}>→ {st.devices[other.d]?.name?.slice(0, 6) ?? other.d}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
