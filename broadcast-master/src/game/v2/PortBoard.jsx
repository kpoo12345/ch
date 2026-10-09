import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, ZoomIn, ZoomOut, Scan, Cable } from 'lucide-react';
import { DEVICE_TYPES, PORT_COLOR, CABLES, PORT_KIND_LABEL } from '../engine.js';
import { canConnect } from '../sim.js';

/* =====================================================================
 * 연결표 (2D 배선도) — 처음 버전의 "그려진 배선판"을 v2 상태에 맞게 다시 만든 것
 *  - 장비 카드를 신호 흐름 순서(소스 → DI·스네이크 → 믹서·스위처 → 도착)로 자동 배치
 *  - 왼쪽 점 = 입력, 오른쪽 점 = 출력. 점 → 점 순서로 누르거나(또는 마우스로 끌어) 연결, 선을 누르면 분리
 *  - 연결은 3D와 똑같이 game.clickPort / game.disconnect 로 한다 (튜토리얼 연습 판정 그대로)
 *  - 큰 장비는 쓰는 단자만 보여 주고, 믹서 MIC/LINE 같은 번호 단자는 번호 점 묶음으로 줄인다
 * ===================================================================== */

const HELP = '왼쪽 점 = 입력, 오른쪽 점 = 출력. 점을 누르고 다른 점을 누르면 연결, 선을 누르면 분리';

/* ---------- 배치 규칙 ---------- */
// 열: 0 소스 · 1 DI/스네이크 · 2 믹서·스위처(가공) · 3 도착
const COL = {
  dynamic_mic: 0, condenser_mic: 0, wireless_mic: 0, kick_mic: 0, snare_mic: 0, overhead_mic: 0, drum_kit: 0,
  e_guitar: 0, bass_guitar: 0, keyboard: 0, digital_piano: 0, laptop: 0,
  camera: 0, mirrorless: 0, ptz: 0, media_server: 0, ptz_controller: 0, lighting_console: 0,
  di_box: 1, stage_box: 1, snake_fanout: 1,
  analog_mixer: 2, digital_mixer: 2, audio_interface: 2, atem: 2, atem_pro: 2, par_led: 2, moving_head: 2,
  speaker: 3, monitor: 3, headphones: 3, pc: 3, projector: 3, led_wall: 3, router: 3,
};
const ORDER = Object.keys(COL);
const colOf = (type) => {
  if (COL[type] != null) return COL[type];
  const def = DEVICE_TYPES[type];
  return def.ins.length && def.outs.length ? 2 : def.outs.length ? 0 : 3;
};

// 번호 단자 묶음 (번호 점 한 줄 = 4개)
const num = (pre, n) => Array.from({ length: n }, (_, i) => `${pre}${i + 1}`);
const GROUPS = {
  analog_mixer: [
    { dir: 'in', label: 'MIC (XLR) · CH 1~8', ids: num('in', 8), essential: true },
    { dir: 'in', label: 'LINE (TRS) · CH 1~8', ids: num('line', 8) },
    { dir: 'in', label: 'STEREO LINE · CH 9/10 · 11/12', ids: ['st9L', 'st9R', 'st11L', 'st11R'], dots: ['9L', '9R', '11L', '11R'] },
  ],
  digital_mixer: [{ dir: 'in', label: 'LOCAL IN 1~8 (XLR)', ids: num('local', 8), essential: true }],
  stage_box: [{ dir: 'in', label: 'INPUT 1~8 (XLR)', ids: num('in', 8), essential: true }],
  snake_fanout: [{ dir: 'out', label: 'OUT 1~8 → 믹서 CH', ids: num('out', 8), essential: true }],
  atem: [{ dir: 'in', label: 'HDMI IN 1~4', ids: num('in', 4), essential: true }, { dir: 'in', label: 'MIC (3.5mm)', ids: ['mic1', 'mic2'] }],
  atem_pro: [{ dir: 'in', label: 'HDMI IN 1~4', ids: num('in', 4), essential: true }, { dir: 'in', label: 'MIC (3.5mm)', ids: ['mic1', 'mic2'] }],
  router: [{ dir: 'in', label: 'LAN 1~4', ids: num('lan', 4), essential: true }],
};
// 단자가 많은 장비: 평소엔 이것 + 꽂힌 단자 + 지금 꽂을 수 있는 단자만
const ESSENTIAL = {
  analog_mixer: ['main', 'mainR', 'aux1'],
  audio_interface: ['in1', 'in2', 'usb', 'phones'],
};

const shortLabel = (label) => label.replace(/\s*\([^)]*\)/g, '').replace(/\s*→.*$/, '').trim();
// 카드 제목: 긴 괄호 설명은 빼고 (L)/(R) 같은 짧은 표시는 남긴다 — 전체 이름은 title·aria에
const cardName = (name) => name.replace(/\s*\(([^)]{4,})\)/g, '').trim() || name;
// 글자 폭 어림 (10px 고정폭 글꼴: 영문 6px · 한글 10px)
const textW = (t) => [...t].reduce((w, ch) => w + (/[\u3131-\uD79D]/.test(ch) ? 10 : 6), 0);

/* ---------- 크기 ---------- */
const CW = 96; // 보통 카드 (최소)
const CW_MAX = 140;
const CW_WIDE = 128; // 번호 점 묶음이 있는 카드
const HEAD = 36;
const ROW = 28;
const GL = 14; // 묶음 제목 줄
const PITCH = 28; // 번호 점 간격 (= 누르는 영역)
const FOOT = 22;
const PADB = 6;
const GAPX = 30;
const GAPY = 14;
const MX = 8;
const MTOP = 20;

const FIXTURES = new Set(['par_led', 'moving_head']);
const INSTRUMENTS = new Set(['e_guitar', 'bass_guitar', 'keyboard', 'digital_piano']);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- 신호가 흐르는 케이블 (3D 케이블 표시와 같은 판단) ---------- */
function connLive(st, sim, c) {
  if (!sim) return false;
  const { devices } = st;
  if (!devices[c.from.d]?.placed || !devices[c.to.d]?.placed) return false;
  const ft = devices[c.from.d].type;
  try {
    if (c.cable === 'eth' && (ft === 'ptz' || ft === 'ptz_controller')) return Object.values(sim.ptz ?? {}).some((r) => r.reachable);
    if (ft === 'camera' || ft === 'mirrorless' || ft === 'ptz') return c.cable !== 'eth';
    if (ft === 'atem' || ft === 'atem_pro') return c.from.p === 'eth' ? !!sim.proLiveOf(c.from.d) : !!sim.switcherOf(c.from.d)?.programCam;
    if (ft === 'lighting_console' || FIXTURES.has(ft)) return !!sim.light?.fixtures?.[c.to.d]?.receiving;
    if (ft === 'media_server') return !!st.dev[c.from.d]?.playing;
    if (ft === 'ptz_controller') return true;
    const lv = sim.outLevel(c.from.d, c.from.p);
    return lv != null && lv > -60;
  } catch {
    return false;
  }
}

/* ---------- 배선도 모델 (카드 위치 · 단자 좌표 · 케이블) ---------- */
function buildModel(st, pending, cable, expanded, sim) {
  const used = new Map();
  st.connections.forEach((c) => { used.set(`${c.from.d}.${c.from.p}`, c); used.set(`${c.to.d}.${c.to.p}`, c); });
  const pendKey = pending ? `${pending.d}.${pending.p}` : null;
  const ALL = Object.keys(CABLES);
  const fitsWith = (d, p, list) => !!pending && pending.d !== d && !used.has(`${d}.${p}`) && list.some((k) => canConnect(st, pending, { d, p }, k).ok);
  // 보이기: 어떤 케이블로든 꽂히는 단자 / 강조: 고른 케이블로 꽂히는 단자
  const canTake = (d, p) => fitsWith(d, p, ALL);
  const hot = (d, p) => fitsWith(d, p, cable ? [cable] : ALL);

  const placed = Object.values(st.devices).filter((d) => d.placed && DEVICE_TYPES[d.type]);
  const cards = placed.map((d, idx) => {
    const def = DEVICE_TYPES[d.type];
    const groups = GROUPS[d.type] ?? [];
    const groupOf = new Map();
    groups.forEach((g) => g.ids.forEach((id) => groupOf.set(id, g)));
    const ess = ESSENTIAL[d.type];
    const want = (pid) => used.has(`${d.id}.${pid}`) || pendKey === `${d.id}.${pid}` || canTake(d.id, pid);
    let hideable = 0;
    const side = (dir, list) => {
      const items = [];
      const seen = new Set();
      list.forEach((p) => {
        const g = groupOf.get(p.id);
        if (g) {
          if (seen.has(g)) return;
          seen.add(g);
          const need = g.essential || g.ids.some(want);
          if (!need) hideable += g.ids.length;
          if (need || expanded.has(d.id)) items.push({ type: 'group', g, dir });
          return;
        }
        const need = !ess || ess.includes(p.id) || want(p.id);
        if (!need) hideable += 1;
        if (need || expanded.has(d.id)) items.push({ type: 'port', p: { ...p, dir } });
      });
      return items;
    };
    const ins = side('in', def.ins);
    const outs = side('out', def.outs);
    const wide = [...ins, ...outs].some((it) => it.type === 'group');
    const lw = Math.max(0, ...ins.filter((it) => it.p).map((it) => textW(shortLabel(it.p.label))));
    const rw = Math.max(0, ...outs.filter((it) => it.p).map((it) => textW(shortLabel(it.p.label))));
    const w = wide ? CW_WIDE : clamp(Math.ceil(lw && rw ? lw + rw + 32 : lw + rw + 24), CW, CW_MAX);
    const ports = {};
    const labels = [];
    const portEntry = (p, dir, x, y, extra = {}) => {
      const key = `${d.id}.${p.id}`;
      ports[p.id] = {
        id: p.id, dir, kind: p.kind, label: p.label, x, y, ...extra,
        used: used.get(key) ?? null, pending: pendKey === key, hot: hot(d.id, p.id),
      };
    };
    let bodyH;
    if (!wide) {
      // 처음 버전처럼 한 줄에 왼쪽 IN · 오른쪽 OUT
      ins.forEach(({ p }, i) => { const y = HEAD + i * ROW + ROW / 2; portEntry(p, 'in', 0, y); labels.push({ text: shortLabel(p.label), y, align: 'left', max: outs.length ? w - 30 - rw : w - 22 }); });
      outs.forEach(({ p }, i) => { const y = HEAD + i * ROW + ROW / 2; portEntry(p, 'out', w, y); labels.push({ text: shortLabel(p.label), y, align: 'right', max: ins.length ? w - 30 - lw : w - 22 }); });
      bodyH = Math.max(ins.length, outs.length) * ROW;
    } else {
      // 묶음이 있으면 입력 → 출력 순서로 쌓는다
      let y = HEAD;
      [...ins, ...outs].forEach((it) => {
        if (it.type === 'group') {
          labels.push({ text: it.g.label, y: y + GL / 2 + 1, align: it.dir === 'in' ? 'left' : 'right', max: w - 14, group: true });
          const perRow = 4;
          it.g.ids.forEach((pid, k) => {
            const p = (it.dir === 'in' ? def.ins : def.outs).find((x) => x.id === pid);
            if (!p) return;
            const r = Math.floor(k / perRow), c = k % perRow;
            const x = it.dir === 'in' ? 8 + PITCH / 2 + c * PITCH : w - 8 - PITCH / 2 - (perRow - 1 - c) * PITCH;
            portEntry(p, it.dir, x, y + GL + r * PITCH + PITCH / 2, { dot: it.g.dots?.[k] ?? String(k + 1) });
          });
          y += GL + Math.ceil(it.g.ids.length / perRow) * PITCH + 2;
        } else {
          const py = y + ROW / 2;
          portEntry(it.p, it.dir, it.dir === 'in' ? 0 : w, py);
          labels.push({ text: shortLabel(it.p.label), y: py, align: it.dir === 'in' ? 'left' : 'right', max: w - 24 });
          y += ROW;
        }
      });
      bodyH = y - HEAD;
    }
    const empty = def.ins.length + def.outs.length === 0;
    if (empty) bodyH = 20;
    const foot = hideable > 0 ? FOOT : 0;
    return { id: d.id, d, def, idx, col: colOf(d.type), w, h: HEAD + bodyH + foot + PADB, ports, labels, hideable, foot, empty, x: 0, y: 0 };
  });

  // 열 나누기 → 빈 열은 접는다
  const byCol = [0, 1, 2, 3].map((c) => cards.filter((k) => k.col === c)
    .sort((a, b) => (ORDER.indexOf(a.d.type) - ORDER.indexOf(b.d.type)) || (a.idx - b.idx)));
  // 열마다 시작 높이: 곧게 지나가는 선이 옆 열 단자 점 위를 똑바로 지나가지 않게 반 줄씩 어긋나게 한다
  //  - DI 열: 첫 악기 카드 높이에 맞춘다 (보컬 마이크 선은 DI 위로 지나간다)
  //  - 도착 열: 첫 믹서 카드의 출력 단자 높이에 맞춘다
  const stackH = (list, n) => list.slice(0, n).reduce((h, k) => h + k.h + GAPY, 0);
  const top = [MTOP, MTOP + ROW / 2, MTOP, MTOP + ROW / 2];
  const firstInst = byCol[0].findIndex((k) => INSTRUMENTS.has(k.d.type));
  if (byCol[1].length && byCol[1].every((k) => k.d.type === 'di_box') && firstInst > 0) top[1] = MTOP + stackH(byCol[0], firstInst) + ROW / 2;
  const proc = byCol[2][0];
  if (proc && byCol[3].length) {
    const outY = Math.min(...Object.values(proc.ports).filter((p) => p.dir === 'out').map((p) => p.y));
    if (Number.isFinite(outY)) top[3] = Math.max(MTOP, MTOP + outY - HEAD - ROW / 2);
  }
  const cols = byCol.map((list, c) => ({ list, top: top[c] })).filter((c) => c.list.length);
  let x = MX;
  let H = 0;
  cols.forEach(({ list, top: y0 }, ci) => {
    const cw = Math.max(...list.map((k) => k.w));
    let y = y0;
    list.forEach((k) => { k.x = x + (cw - k.w) / 2; k.y = y; k.colIndex = ci; y += k.h + GAPY; });
    H = Math.max(H, y - GAPY);
    x += cw + GAPX;
  });
  const W = Math.max(cols.length ? x - GAPX + MX : 0, 240);
  H = Math.max(H + MX, 140);

  const byId = Object.fromEntries(cards.map((k) => [k.id, k]));
  const at = (end) => {
    const k = byId[end.d];
    const p = k?.ports[end.p];
    return p ? { x: k.x + p.x, y: k.y + p.y, card: k } : null;
  };
  const conns = st.connections.map((c) => {
    const a = at(c.from), b = at(c.to);
    if (!a || !b) return null;
    return { c, a, b, live: connLive(st, sim, c), path: cablePath(a, b) };
  }).filter(Boolean);
  const live = new Set();
  conns.forEach((k) => { if (k.live) { live.add(k.c.from.d); live.add(k.c.to.d); } });

  // 하울링: 스피커 → 마이크로 되돌아오는 빨간 호
  const loops = (sim?.loops ?? []).filter((l) => l.loop >= 0 && byId[l.src] && byId[l.spk]).map((l) => {
    const s = byId[l.spk], m = byId[l.src];
    const ax = s.x + s.w / 2, ay = s.y + 4, bx = m.x + m.w / 2, by = m.y + 4;
    return { key: `${l.src}-${l.spk}`, spk: l.spk, d: `M ${ax} ${ay} Q ${(ax + bx) / 2} ${Math.max(2, Math.min(ay, by) - 70)}, ${bx} ${by}` };
  });
  const howl = new Set(loops.map((l) => l.spk));
  return { cards, conns, W, H, at, live, loops, howl };
}

const curve = (a, b) => {
  const dx = Math.max(28, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};
// 앞으로 가는 선은 S자 곡선, 뒤로(같은 열 데이지 체인·리턴) 가는 선은 카드 사이 틈으로 돌아간다
function cablePath(a, b) {
  if (b.x > a.x + 24) return curve(a, b);
  const ca = a.card, cb = b.card;
  const yr = ca.colIndex === cb.colIndex
    ? (cb.y > ca.y ? cb.y - GAPY / 2 : ca.y - GAPY / 2)
    : Math.max(ca.y + ca.h, cb.y + cb.h) + 10;
  const ax = ca.x + ca.w, bx = cb.x;
  const r = 24;
  return `M ${a.x} ${a.y} L ${ax} ${a.y} C ${ax + r} ${a.y}, ${ax + r} ${yr}, ${ax} ${yr} L ${bx} ${yr} C ${bx - r} ${yr}, ${bx - r} ${b.y}, ${bx} ${b.y} L ${b.x} ${b.y}`;
}

const devName = (st, id) => st.devices[id]?.name ?? DEVICE_TYPES[st.devices[id]?.type]?.name ?? id;
const portName = (st, id, pid) => {
  const def = DEVICE_TYPES[st.devices[id]?.type];
  return [...(def?.ins ?? []), ...(def?.outs ?? [])].find((p) => p.id === pid)?.label ?? pid;
};

const STYLE = `
@keyframes pb-flow { to { stroke-dashoffset: -24; } }
.pb-flow { stroke-dasharray: 8 6; animation: pb-flow .6s linear infinite; }
@keyframes pb-pulse { 0%,100% { box-shadow: 0 0 0 2px rgba(125,211,252,.95), 0 0 0 5px rgba(56,189,248,.25); } 50% { box-shadow: 0 0 0 2px rgba(125,211,252,.95), 0 0 0 8px rgba(56,189,248,.05); } }
.pb-hot { animation: pb-pulse 1.1s ease-in-out infinite; }
.pb-cable:hover .pb-main, .pb-cable:focus-visible .pb-main { stroke-width: 6; }
.pb-cable:focus { outline: none; }
.pb-cable:focus-visible .pb-shadow { stroke: #e0f2fe; stroke-width: 9; }
@media (prefers-reduced-motion: reduce) { .pb-flow, .pb-hot { animation: none !important; } }
`;

/* =====================================================================
 * 내보내기: 사이드 패널의 연결표 + "크게 보기" 전체 화면
 * ===================================================================== */
export default function PortBoard({ game }) {
  const { st, pending, cable, actual } = game;
  const [big, setBig] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const bigBtn = useRef(null);
  const toggle = useCallback((id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const model = useMemo(() => buildModel(st, pending, cable, expanded, actual), [st, pending, cable, expanded, actual]);
  const close = useCallback(() => { setBig(false); requestAnimationFrame(() => bigBtn.current?.focus()); }, []);

  return (
    <div className="space-y-2">
      <style>{STYLE}</style>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-[11px] leading-snug text-slate-400">{HELP}</p>
        <button ref={bigBtn} type="button" onClick={() => setBig(true)}
          className="shrink-0 flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-bold text-slate-100 hover:bg-slate-700">
          <Maximize2 size={13} /> 크게 보기
        </button>
      </div>
      <PendingBar game={game} />
      <Tray game={game} />
      {big
        ? <div className="rounded-md border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">크게 보기 화면에서 연결표를 보고 있어요.</div>
        : <Board game={game} model={model} toggle={toggle} expanded={expanded} mode="inline" />}
      {big && typeof document !== 'undefined' && createPortal(
        <BigView game={game} model={model} toggle={toggle} expanded={expanded} onClose={close} />, document.body,
      )}
    </div>
  );
}

/* ---------- 고른 단자 안내 ---------- */
function PendingBar({ game }) {
  const { st, pending, cable } = game;
  if (!pending || !st.devices[pending.d]) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-sky-500/60 bg-sky-950/60 px-2 py-1.5 text-[11px] text-sky-100" role="status">
      <span className="min-w-0 flex-1">
        <b>{devName(st, pending.d)} · {shortLabel(portName(st, pending.d, pending.p))}</b> ({pending.dir === 'in' ? '입력' : '출력'}) 선택됨 —{' '}
        {cable ? <>{CABLES[cable]?.short} 케이블로 빛나는 점을 누르세요</> : <>먼저 케이블을 고르세요</>}
      </span>
      <button type="button" onClick={() => game.setPending(null)} className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-bold text-slate-200 hover:bg-slate-700">취소</button>
    </div>
  );
}

/* ---------- 아직 배치 안 한 장비 ---------- */
function Tray({ game }) {
  const { st } = game;
  const un = Object.values(st.devices).filter((d) => !d.placed && DEVICE_TYPES[d.type]);
  if (!un.length) return null;
  return (
    <div className="rounded-md border border-dashed border-slate-600 bg-slate-900/60 p-2">
      <div className="mb-1 text-[10px] font-bold text-slate-400">아직 배치 안 됨 · {un.length}</div>
      <div className="flex flex-wrap gap-1.5">
        {un.map((d) => {
          const Icon = DEVICE_TYPES[d.type].icon;
          const name = devName(st, d.id);
          return (
            <div key={d.id} className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 py-0.5 pl-1.5 pr-0.5 text-[11px] text-slate-200">
              {Icon && <Icon size={12} className="shrink-0 text-slate-400" />}
              <span className="max-w-[120px] truncate" title={name}>{name}</span>
              <button type="button" onClick={() => game.apply({ op: 'place', device: d.id })} aria-label={`${name} 배치`}
                className="ml-0.5 rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-sky-500">+ 배치</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 케이블 고르기 (크게 보기에서는 아래 케이블 가방이 가려지므로) ---------- */
function CablePicker({ game }) {
  const { st } = game;
  const choices = st.unlimited ? Object.keys(CABLES) : Object.keys(st.cables).filter((k) => CABLES[k]);
  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="케이블 선택">
      <Cable size={15} className="text-slate-400" />
      {choices.length === 0 && <span className="text-[11px] text-slate-500">가방에 케이블 없음</span>}
      {choices.map((k) => {
        const n = st.unlimited ? '∞' : st.cables[k];
        const on = game.cable === k;
        return (
          <button key={k} type="button" role="radio" aria-checked={on} disabled={!st.unlimited && !n} onClick={() => game.setCable(on ? null : k)} title={`${CABLES[k].name} — ${CABLES[k].desc}`}
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold disabled:opacity-35 ${on ? 'border-white bg-white text-slate-900' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CABLES[k].stroke }} />{CABLES[k].short} <span className="font-mono opacity-70">×{n}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 전체 화면 ---------- */
function BigView({ game, model, toggle, expanded, onClose }) {
  const closeBtn = useRef(null);
  useEffect(() => { closeBtn.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (game.pending) game.setPending(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, onClose]);
  const t = game.toast;
  const tcls = t?.kind === 'err' ? 'border-red-400/60 bg-red-950/95 text-red-100' : t?.kind === 'ok' ? 'border-green-400/60 bg-green-950/95 text-green-100' : 'border-sky-400/50 bg-slate-900/95 text-slate-100';
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b1220] text-slate-100" role="dialog" aria-modal="true" aria-label="연결표 크게 보기">
      <style>{STYLE}</style>
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-950/90 px-3 py-2">
        <Cable size={16} className="text-sky-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">연결표</div>
          <div className="truncate text-[11px] text-slate-400">{HELP}</div>
        </div>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="크게 보기 닫기" className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800"><X size={20} /></button>
      </header>
      <div className="shrink-0 space-y-2 border-b border-slate-800 px-3 py-2">
        <CablePicker game={game} />
        <PendingBar game={game} />
        <Tray game={game} />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col p-2">
        <Board game={game} model={model} toggle={toggle} expanded={expanded} mode="big" onSelect={onClose} />
        {t && <div role="status" className={`pointer-events-none absolute left-1/2 top-12 max-w-[90%] -translate-x-1/2 rounded-lg border px-3 py-1.5 text-xs shadow-lg sm:text-sm ${tcls}`}>{t.text}</div>}
      </div>
    </div>
  );
}

/* =====================================================================
 * 배선판 본체
 * ===================================================================== */
function Board({ game, model, toggle, expanded, mode, onSelect }) {
  const { st, pending } = game;
  const gameRef = useRef(game);
  gameRef.current = game;
  const viewRef = useRef(null);
  const innerRef = useRef(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(null); // null = 자동 맞춤
  const [ptr, setPtr] = useState(null);
  const drag = useRef(null);
  const suppress = useRef(false);
  const big = mode === 'big';

  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return undefined;
    const upd = () => setView({ w: el.clientWidth, h: el.clientHeight });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { W, H } = model;
  const fitW = view.w ? (view.w - 4) / W : 1;
  const fitH = big && view.h ? (view.h - 4) / H : Infinity;
  const fit = Math.min(fitW, fitH);
  const auto = big ? clamp(fit, 0.75, 1.35) : clamp(fitW, 0.72, 1);
  const s = zoom ?? auto;
  const step = (d) => setZoom(clamp(Math.round((s + d) * 20) / 20, 0.4, 1.8));

  // 화면 좌표 → 배선판 좌표
  const toBoard = (e) => {
    const r = innerRef.current?.getBoundingClientRect();
    return r ? { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s } : null;
  };

  const select = (id) => { onSelect?.(); game.setSelected(id); };
  const clickPort = (d, p) => {
    if (suppress.current) return;
    gameRef.current.clickPort(d, p);
  };
  // 마우스·펜: 점에서 끌어서 다른 점에 놓으면 연결 (터치는 누르기 → 누르기, 화면 스크롤을 막지 않게)
  const onPortDown = (e, d, p) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const pd = gameRef.current.pending;
    if (pd && !(pd.d === d && pd.p === p)) return; // 이미 고른 단자가 있으면 그냥 누르기로 처리
    drag.current = { d, p, cx: e.clientX, cy: e.clientY, moved: false };
  };
  const onMove = (e) => {
    if (drag.current && e.buttons === 0) drag.current = null; // 판 밖에서 버튼을 뗐다
    const dr = drag.current;
    if (dr && !dr.moved && Math.hypot(e.clientX - dr.cx, e.clientY - dr.cy) > 6) {
      dr.moved = true;
      if (!gameRef.current.pending) gameRef.current.clickPort(dr.d, dr.p);
    }
    if ((dr?.moved || gameRef.current.pending) && e.pointerType !== 'touch') setPtr(toBoard(e));
  };
  const onUp = (e) => {
    const dr = drag.current;
    drag.current = null;
    if (!dr?.moved) return;
    suppress.current = true;
    setTimeout(() => { suppress.current = false; }, 0);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-port]');
    if (!el) return;
    const [d, p] = el.dataset.port.split('|');
    if (d === dr.d && p === dr.p) return;
    if (gameRef.current.pending) gameRef.current.clickPort(d, p);
  };
  const onBgClick = (e) => {
    if (suppress.current || e.target.closest('button,[data-cable]')) return;
    if (gameRef.current.pending) gameRef.current.setPending(null);
  };
  const onKey = (e) => {
    if (e.code === 'Space') e.stopPropagation(); // 스페이스 = 말하기 단축키와 겹치지 않게
    if (e.key === 'Escape' && gameRef.current.pending && !big) { e.stopPropagation(); gameRef.current.setPending(null); }
  };

  const pendPos = pending ? model.at({ d: pending.d, p: pending.p }) : null;
  const pendStroke = game.cable ? CABLES[game.cable].stroke : '#94a3b8';
  const dim = !!pending;

  return (
    <div className={big ? 'flex min-h-0 flex-1 flex-col gap-1.5' : 'space-y-1'}>
      <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400">
        <span className="mr-auto">{model.cards.length ? `장비 ${model.cards.length} · 케이블 ${model.conns.length}` : ''}</span>
        <button type="button" onClick={() => step(-0.1)} aria-label="작게" className="rounded p-1 hover:bg-slate-800"><ZoomOut size={14} /></button>
        <span className="w-9 text-center font-mono tabular-nums">{Math.round(s * 100)}%</span>
        <button type="button" onClick={() => step(0.1)} aria-label="크게" className="rounded p-1 hover:bg-slate-800"><ZoomIn size={14} /></button>
        <button type="button" onClick={() => setZoom(clamp(fit, 0.35, 1.8))} title="배선판 전체가 한 화면에 들어오게"
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-slate-800">
          <Scan size={13} /> 맞춤
        </button>
      </div>
      <div ref={viewRef} className={`${big ? 'min-h-0 flex-1 overflow-auto' : 'overflow-x-auto overflow-y-hidden'} overscroll-contain rounded-lg`}>
        <div className="relative mx-auto" style={{ width: W * s, height: H * s }}>
          <div ref={innerRef} role="group" aria-label="연결표 배선도"
            className="absolute left-0 top-0 origin-top-left rounded-lg border border-slate-700"
            style={{
              width: W, height: H, transform: `scale(${s})`, backgroundColor: '#0b1220',
              backgroundImage: 'radial-gradient(circle, rgba(148,163,184,.16) 1px, transparent 1px)', backgroundSize: '20px 20px',
            }}
            onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (!drag.current) setPtr(null); }} onClick={onBgClick} onKeyDown={onKey}>

            {model.cards.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-slate-500">
                아직 배치한 장비가 없어요. 위의 ‘아직 배치 안 됨’에서 + 배치를 누르세요.
              </div>
            )}

            {model.cards.map((k) => (
              <CardView key={k.id} k={k} st={st} live={model.live.has(k.id)} howl={model.howl.has(k.id)} selected={game.selected === k.id}
                dim={dim} expanded={expanded.has(k.id)} onToggle={() => toggle(k.id)} onSelect={() => select(k.id)}
                onPortClick={clickPort} onPortDown={onPortDown} />
            ))}

            {/* 케이블 (카드 위 · 단자 아래) */}
            <svg className="absolute left-0 top-0" width={W} height={H} style={{ overflow: 'visible', zIndex: 2, pointerEvents: 'none' }} aria-hidden={model.conns.length ? undefined : true}>
              {model.conns.map(({ c, path, live }) => {
                const label = `${CABLES[c.cable]?.name ?? c.cable}: ${devName(st, c.from.d)} ${shortLabel(portName(st, c.from.d, c.from.p))} → ${devName(st, c.to.d)} ${shortLabel(portName(st, c.to.d, c.to.p))}${live ? ' · 신호 흐르는 중' : ''}`;
                return (
                  <g key={c.id} className="pb-cable" data-cable="1" role="button" tabIndex={0} aria-label={`${label}. 누르면 분리`} style={{ cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); if (!suppress.current) game.disconnect(c); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); game.disconnect(c); } }}>
                    <title>{label} · 누르면 분리</title>
                    <path d={path} stroke="transparent" strokeWidth={16} fill="none" pointerEvents="stroke" />
                    <path className="pb-shadow" d={path} stroke="#020617" strokeWidth={7} fill="none" strokeLinecap="round" pointerEvents="none" />
                    <path className="pb-main" d={path} stroke={CABLES[c.cable]?.stroke ?? '#94a3b8'} strokeWidth={3.5} fill="none" strokeLinecap="round" pointerEvents="none" />
                    {live && <path className="pb-flow" d={path} stroke="#ffffff" strokeOpacity={0.8} strokeWidth={1.8} fill="none" pointerEvents="none" />}
                  </g>
                );
              })}
              {model.loops.map((l) => (
                <path key={l.key} d={l.d} stroke="#ef4444" strokeWidth={3} fill="none" className="pb-flow" opacity={0.85} pointerEvents="none" />
              ))}
              {pending && pendPos && ptr && (
                <path d={pending.dir === 'out' ? curve(pendPos, ptr) : curve(ptr, pendPos)}
                  stroke={pendStroke} strokeWidth={3} strokeDasharray="6 5" fill="none" pointerEvents="none" />
              )}
            </svg>
          </div>
        </div>
      </div>
      {model.loops.length > 0 && <div className="text-[11px] font-bold text-red-300" role="status">빨간 호 = 하울링! 스피커 소리가 마이크로 다시 들어가고 있어요.</div>}
    </div>
  );
}

/* ---------- 장비 카드 ---------- */
function CardView({ k, st, live, howl, selected, dim, expanded, onToggle, onSelect, onPortClick, onPortDown }) {
  const { d, def } = k;
  const Icon = def.icon;
  const name = devName(st, d.id);
  return (
    <>
      <div className={`absolute rounded-lg border-2 bg-slate-800 shadow-xl ${selected ? 'border-sky-400' : 'border-slate-600'} ${howl ? 'ring-4 ring-red-500/70' : ''}`}
        style={{ left: k.x, top: k.y, width: k.w, height: k.h, zIndex: 1 }}>
        <button type="button" onClick={onSelect} title={`${name} — 장비 패널 열기`}
          className="flex w-full items-start gap-1.5 rounded-t-md bg-slate-700/80 px-2 pt-1.5 text-left hover:bg-slate-700"
          style={{ height: HEAD - 4 }}>
          {Icon && <Icon size={13} className={`mt-px shrink-0 ${live ? 'text-sky-300' : 'text-slate-300'}`} />}
          <span className="line-clamp-2 min-w-0 flex-1 break-keep text-[11px] font-bold leading-[13px] text-slate-100">{cardName(name)}</span>
          {live && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]" title="신호 있음" />}
        </button>
        {k.labels.map((l, i) => (
          <span key={i} className={`absolute truncate leading-none ${l.group ? 'text-[9px] font-bold text-slate-400' : 'font-mono text-[10px] text-slate-300'}`}
            style={{ top: l.y - 5, maxWidth: l.max, ...(l.align === 'left' ? { left: l.group ? 8 : 11 } : { right: l.group ? 8 : 11, textAlign: 'right' }) }}>
            {l.text}
          </span>
        ))}
        {k.empty && <span className="absolute left-2 right-2 text-[10px] leading-tight text-slate-500" style={{ top: HEAD + 2 }}>단자 없음 · 마이크로 소리를 잡아요</span>}
        {k.foot > 0 && (
          <button type="button" onClick={onToggle} aria-expanded={expanded}
            className="absolute bottom-1 left-1 right-1 rounded text-[10px] font-bold text-sky-300 hover:bg-slate-700" style={{ height: FOOT - 4 }}>
            {expanded ? '단자 접기' : `단자 모두 보기 +${k.hideable}`}
          </button>
        )}
      </div>
      {Object.values(k.ports).map((p) => (
        <PortDot key={p.id} k={k} p={p} st={st} name={name} dim={dim} onClick={onPortClick} onDown={onPortDown} />
      ))}
    </>
  );
}

/* ---------- 단자 점 (누르는 영역 28px 이상) ---------- */
function PortDot({ k, p, st, name, dim, onClick, onDown }) {
  const color = PORT_COLOR[p.kind] ?? '#94a3b8';
  const other = p.used ? (p.used.from.d === k.id && p.used.from.p === p.id ? p.used.to : p.used.from) : null;
  const state = p.pending ? ', 선택됨' : p.hot ? ', 여기에 연결 가능' : '';
  const aria = `${name} ${p.label} — ${p.dir === 'in' ? '입력' : '출력'}, ${PORT_KIND_LABEL[p.kind] ?? p.kind}${other ? `, ${devName(st, other.d)} ${shortLabel(portName(st, other.d, other.p))}에 연결됨` : ''}${state}`;
  const faded = dim && !p.pending && !p.hot && !p.used;
  const fill = p.pending ? '#ffffff' : p.used ? color : '#020617';
  const isDot = p.dot != null;
  const size = isDot ? 21 : 15;
  return (
    <button type="button" data-port={`${k.id}|${p.id}`} aria-label={aria} aria-pressed={p.pending} title={`${p.label} · ${PORT_KIND_LABEL[p.kind] ?? ''} · ${p.dir === 'in' ? '입력' : '출력'}${other ? ` → ${devName(st, other.d)}` : ''}`}
      onClick={(e) => { e.stopPropagation(); onClick(k.id, p.id); }} onPointerDown={(e) => onDown(e, k.id, p.id)}
      className="group absolute flex cursor-crosshair items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      style={{ left: k.x + p.x - 15, top: k.y + p.y - 14, width: 30, height: 28, zIndex: 3, opacity: faded ? 0.4 : 1, touchAction: 'manipulation' }}>
      <span className={`flex items-center justify-center rounded-full font-mono font-bold leading-none transition-transform group-hover:scale-125 ${p.hot ? 'pb-hot' : ''}`}
        style={{ width: size, height: size, border: `${isDot ? 2 : 3}px solid ${color}`, background: fill, color: p.used || p.pending ? '#0b1220' : '#e2e8f0', fontSize: p.dot?.length > 2 ? 7.5 : 9 }}>
        {isDot ? p.dot : null}
      </span>
    </button>
  );
}
