import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Fader, Lamp, LED_THR, useCanvasTexture, FONT, noRaycast } from './kit3d.jsx';

/* =====================================================================
 * 아날로그 믹서 3D — 실제 소형 라이브 믹서(Yamaha MG 시리즈 같은 12채널) 배치
 *
 *  - 모노 채널 1~8: 상판 뒤쪽에 MIC(XLR) · LINE(TRS) · INSERT 단자가 세로로 있고,
 *    GAIN · 26dB PAD · HPF 80Hz · COMP · HIGH · MID · FREQ · LOW · AUX1(PRE) · AUX2 · EFFECT · PAN · ON · PEAK · PFL · 페이더
 *  - 스테레오 채널 9/10, 11/12: LINE L/MONO · R 단자, GAIN · EQ 3밴드 · AUX · EFFECT · BAL · ON · PFL · 페이더
 *  - 마스터: STEREO OUT L/R(XLR) · GROUP OUT · MONITOR OUT · AUX SEND · EFFECT SEND · RETURN · PHONES · 2TR IN/REC OUT(RCA)
 *    디지털 이펙트(PROGRAM · PARAMETER), PHANTOM +48V 스위치, L/R 레벨 미터, AUX/RETURN/PHONES 레벨, GROUP · STEREO 페이더
 *
 * 상판은 앞(조작자 쪽, +z)이 낮은 경사면이다. 모든 조작부 좌표는 상판 기준 (x, 높이 h, 앞뒤 s)로 정하고
 * A.toLocal로 장비 로컬 좌표로 바꾼다.
 * ===================================================================== */

export const ANALOG_STRIPS = 10;
export const ANALOG_MONO = 8;
export const A = {
  pitch: 0.042, depth: 0.545, slope: 0.09, yc: 0.08, edge: 0.018, masterW: 0.21,
  s: {
    num: -0.262, xlr: -0.236, line: -0.201, insert: -0.171, stL: -0.229, stR: -0.194, field: -0.155,
    gain: -0.137, pad: -0.116, comp: -0.098, high: -0.079, mid: -0.061, freq: -0.043, low: -0.025,
    aux1: -0.006, aux2: 0.013, fx: 0.032, pan: 0.051, on: 0.07, pfl: 0.09, fader: 0.174, tape: 0.25,
  },
  faderLen: 0.1,
  knobR: 0.0072,
};
A.W = A.edge * 2 + ANALOG_STRIPS * A.pitch + A.masterW;
A.x = (i) => -A.W / 2 + A.edge + A.pitch / 2 + i * A.pitch;
A.m0 = -A.W / 2 + A.edge + ANALOG_STRIPS * A.pitch; // 마스터 섹션 왼쪽 끝
A.mc = (k) => A.m0 + 0.022 + k * 0.0335; // 마스터 섹션 6열
A.toLocal = ([x, h, s]) => [x, A.yc + h * Math.cos(A.slope) - s * Math.sin(A.slope), h * Math.sin(A.slope) + s * Math.cos(A.slope)];
A.n = [0, Math.cos(A.slope), Math.sin(A.slope)];

// 마스터 섹션 단자 배치: [id(게임에서 쓰는 단자면 sim 단자 id), 종류, 열, 줄, 라벨]
const MASTER_JACKS = [
  ['main', 'xlr', 0, 'xlr', 'L'], ['mainR', 'xlr', 1, 'xlr', 'R'],
  [null, 'trs', 2, 'xlr', '1'], [null, 'trs', 3, 'xlr', '2'], [null, 'trs', 4, 'xlr', 'L'], [null, 'trs', 5, 'xlr', 'R'],
  ['aux1', 'trs', 0, 'line', '1'], ['aux2', 'trs', 1, 'line', '2'], [null, 'trs', 2, 'line', 'FX'], [null, 'trs', 3, 'line', 'L'], [null, 'trs', 4, 'line', 'R'], ['phones', 'trs', 5, 'line', '☊'],
  [null, 'rcaW', 0, 'insert', 'L'], [null, 'rcaR', 1, 'insert', 'R'], [null, 'rcaW', 2, 'insert', 'L'], [null, 'rcaR', 3, 'insert', 'R'], [null, 'trs', 4, 'insert', 'FS'],
];

// 게임에서 케이블을 꽂는 단자 위치 (장비 로컬)
export const ANALOG_PORTS = (() => {
  const P = {};
  const at = (x, s) => ({ p: A.toLocal([x, 0.003, s]), n: A.n });
  for (let i = 0; i < ANALOG_MONO; i += 1) {
    P[`in${i + 1}`] = at(A.x(i), A.s.xlr);
    P[`line${i + 1}`] = at(A.x(i), A.s.line);
  }
  P.st9L = at(A.x(8), A.s.stL); P.st9R = at(A.x(8), A.s.stR);
  P.st11L = at(A.x(9), A.s.stL); P.st11R = at(A.x(9), A.s.stR);
  MASTER_JACKS.forEach(([id, , col, row]) => { if (id) P[id] = at(A.mc(col), A.s[row]); });
  return P;
})();
export const ANALOG_SIZE = [A.W + 0.01, 0.12, A.depth];

// 마스터 조작부 위치 (상판 좌표)
const MC = {
  program: [0, -0.131], parameter: [1, -0.131], fxOn: [2, -0.131], phantom: [4, -0.137],
  auxMaster: [0, -0.089], aux2Master: [1, -0.089], fxMaster: [2, -0.089],
  fxReturn: [0, -0.056], twoTr: [1, -0.056], phonesLevel: [2, -0.056],
  stOn: [4, 0.07], groupA: [1, A.s.fader], groupB: [2, A.s.fader], stereo: [4, A.s.fader],
};
const faderS = (v) => A.s.fader + A.faderLen / 2 - ((v ?? 75) / 100) * A.faderLen;

// 조작 손이 향할 위치 (장비 로컬)
export function analogControl(key, ch, value) {
  const L = (x, h, s) => A.toLocal([x, h, s]);
  const m = (k) => L(A.mc(MC[k][0]), 0.012, MC[k][1]);
  if (key === 'mainFader') return L(A.mc(MC.stereo[0]), 0.014, faderS(value));
  if (key === 'mainMute') return m('stOn');
  if (key === 'phantom') return m('phantom');
  if (MC[key]) return m(key);
  const x = A.x((ch ?? 1) - 1);
  switch (key) {
    case 'fader': return L(x, 0.014, faderS(value));
    case 'select': return L(x, 0.004, A.s.tape);
    case 'mute': return L(x, 0.008, A.s.on);
    case 'pfl': return L(x, 0.008, A.s.pfl);
    case 'pad': return L(x - 0.01, 0.008, A.s.pad);
    case 'lowCut': return L(x + 0.01, 0.008, A.s.pad);
    case 'gain': return L(x, 0.012, A.s.gain);
    case 'comp': return L(x, 0.012, A.s.comp);
    case 'eqHigh': return L(x, 0.012, A.s.high);
    case 'eqMid': return L(x, 0.012, A.s.mid);
    case 'eqFreq': return L(x, 0.012, A.s.freq);
    case 'eqLow': return L(x, 0.012, A.s.low);
    case 'aux': return L(x, 0.012, A.s.aux1);
    case 'aux2': return L(x, 0.012, A.s.aux2);
    case 'fx': return L(x, 0.012, A.s.fx);
    case 'pan': return L(x, 0.012, A.s.pan);
    default: return L(x, 0.012, A.s.gain);
  }
}

/* ---------------------------- 합친 지오메트리 (그리기 호출 줄이기) ---------------------------- */
// parts: [geometry, color, [x,y,z], [rx,ry,rz]?] → 정점 색이 들어간 하나의 지오메트리
function merged(parts) {
  const geos = parts.map(([g, color, pos, rot]) => {
    const geo = g;
    if (rot) geo.rotateX(rot[0]).rotateY(rot[1] ?? 0).rotateZ(rot[2] ?? 0);
    geo.translate(pos[0], pos[1], pos[2]);
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  });
  const out = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  return out;
}
const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
const VC_MAT = { vertexColors: true, roughness: 0.45, metalness: 0.35 };

const knobGeo = (r, cap) => cached(`knob${r}${cap}`, () => merged([
  [new THREE.CylinderGeometry(r * 1.06, r * 1.1, r * 0.3, 24), '#0c0d10', [0, r * 0.15, 0]],
  [new THREE.CylinderGeometry(r * 0.9, r * 1.0, r * 1.3, 24), '#17191d', [0, r * 0.3 + r * 0.65, 0]],
  [new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.0012, 24), cap, [0, r * 1.6 + 0.0006, 0]],
  [new THREE.BoxGeometry(r * 0.2, 0.0014, r * 0.95), '#f8fafc', [0, r * 1.6 + 0.0013, -r * 0.42]],
]));
const xlrJackGeo = () => cached('xlrJack', () => merged([
  [new THREE.BoxGeometry(0.026, 0.0016, 0.03), '#202329', [0, 0.0008, 0]],
  [new THREE.CylinderGeometry(0.0013, 0.0013, 0.0006, 8), '#aeb6bf', [-0.0095, 0.0018, -0.012]],
  [new THREE.CylinderGeometry(0.0013, 0.0013, 0.0006, 8), '#aeb6bf', [0.0095, 0.0018, 0.012]],
  [new THREE.CylinderGeometry(0.0108, 0.0108, 0.0012, 28), '#b8c0c8', [0, 0.0016, 0]],
  [new THREE.CylinderGeometry(0.0094, 0.0094, 0.0012, 28), '#26292f', [0, 0.002, 0]],
  [new THREE.CylinderGeometry(0.0012, 0.0012, 0.0004, 10), '#000000', [-0.0042, 0.0027, 0.0026]],
  [new THREE.CylinderGeometry(0.0012, 0.0012, 0.0004, 10), '#000000', [0.0042, 0.0027, 0.0026]],
  [new THREE.CylinderGeometry(0.0012, 0.0012, 0.0004, 10), '#000000', [0, 0.0027, -0.0042]],
  [new THREE.BoxGeometry(0.005, 0.0014, 0.003), '#c9d0d8', [0, 0.0022, -0.0125]],
]));
const trsJackGeo = () => cached('trsJack', () => merged([
  [new THREE.CylinderGeometry(0.0068, 0.0068, 0.0024, 6), '#b8c0c8', [0, 0.0012, 0]],
  [new THREE.CylinderGeometry(0.0053, 0.0053, 0.0012, 20), '#08090b', [0, 0.0022, 0]],
  [new THREE.CylinderGeometry(0.0034, 0.0034, 0.0004, 16), '#000000', [0, 0.0029, 0]],
]));
const rcaJackGeo = (c) => cached(`rca${c}`, () => merged([
  [new THREE.CylinderGeometry(0.0062, 0.0062, 0.0016, 18), '#1d2025', [0, 0.0008, 0]],
  [new THREE.CylinderGeometry(0.0044, 0.0044, 0.006, 18), c, [0, 0.003, 0]],
  [new THREE.CylinderGeometry(0.003, 0.003, 0.0064, 16), '#c9d0d8', [0, 0.0032, 0]],
  [new THREE.CylinderGeometry(0.0012, 0.0012, 0.0004, 10), '#000000', [0, 0.0066, 0]],
]));

// 값이 바뀌면 부드럽게 돌아가는 노브 (한 번에 그려지는 합친 메시)
function DeckKnob({ x, s, value = 0, min = -1, max = 1, cap = '#d1d5db', r = A.knobR }) {
  const ref = useRef();
  const target = ((value - min) / (max - min) - 0.5) * 1.5 * Math.PI;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    ref.current.rotation.y += (-target - ref.current.rotation.y) * k;
  });
  return (
    <mesh ref={ref} position={[x, 0, s]} geometry={knobGeo(r, cap)} raycast={noRaycast} castShadow>
      <meshStandardMaterial {...VC_MAT} />
    </mesh>
  );
}

// 불이 들어오는 사각 버튼
function DeckBtn({ x, s, on, color, w = 0.012, d = 0.008, off = '#3b4048' }) {
  return (
    <mesh position={[x, on ? 0.0022 : 0.003, s]} raycast={noRaycast}>
      <boxGeometry args={[w, 0.004, d]} />
      <meshStandardMaterial color={on ? color : off} emissive={on ? color : '#000000'} emissiveIntensity={on ? 1.6 : 0} roughness={0.4} />
    </mesh>
  );
}

function Jack({ x, s, kind }) {
  const geo = kind === 'xlr' ? xlrJackGeo() : kind === 'rcaW' ? rcaJackGeo('#f1f5f9') : kind === 'rcaR' ? rcaJackGeo('#dc2626') : trsJackGeo();
  return (
    <mesh position={[x, 0, s]} geometry={geo} raycast={noRaycast}>
      <meshStandardMaterial {...VC_MAT} metalness={0.5} />
    </mesh>
  );
}

/* ---------------------------- 상판 인쇄 (실크스크린) ---------------------------- */
const DECK_W = A.W - 0.006, DECK_D = A.depth - 0.004;
const TEX_W = 2048, TEX_H = Math.round((TEX_W * DECK_D) / DECK_W);
const px = (x) => ((x + DECK_W / 2) / DECK_W) * TEX_W;
const py = (s) => ((s + DECK_D / 2) / DECK_D) * TEX_H;
const mm = TEX_W / (DECK_W * 1000); // 1mm 당 픽셀

function drawDeck(ctx) {
  const W = TEX_W, H = TEX_H;
  ctx.fillStyle = '#3b4048'; ctx.fillRect(0, 0, W, H);
  // 단자부 (뒤쪽) — 조금 더 어두운 판
  ctx.fillStyle = '#2b2f36'; ctx.fillRect(0, 0, W, py(A.s.field));
  ctx.strokeStyle = '#5b626d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, py(A.s.field)); ctx.lineTo(W, py(A.s.field)); ctx.stroke();
  // 채널 구분선
  ctx.strokeStyle = '#4a515b'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= ANALOG_STRIPS; i += 1) {
    const x = px(A.x(i) - A.pitch / 2);
    ctx.beginPath(); ctx.moveTo(x, py(A.s.field) + 4); ctx.lineTo(x, H - 8); ctx.stroke();
  }
  // 마스터 섹션 테두리
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 2;
  ctx.strokeRect(px(A.m0 + 0.004), py(A.s.field) + 6, px(A.W / 2 - A.edge) - px(A.m0 + 0.004), H - py(A.s.field) - 14);

  const text = (t, x, y, size = 2.6, color = '#e5e7eb', weight = 700, align = 'center') => {
    ctx.fillStyle = color; ctx.font = `${weight} ${Math.round(size * 1.3 * mm)}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
  };
  // 노브 눈금 (7시 → 5시)
  const ticks = (x, s, r, center) => {
    const cx = px(x), cy = py(s), R = (r + 0.0026) * 1000 * mm;
    ctx.fillStyle = '#cbd5e1';
    for (let k = 0; k <= 10; k += 1) {
      const a = (-135 + k * 27) * (Math.PI / 180);
      const big = k === 0 || k === 10 || (center && k === 5);
      ctx.beginPath(); ctx.arc(cx + R * Math.sin(a), cy - R * Math.cos(a), big ? 2.4 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
  };
  const under = (t, x, s, r = A.knobR, size = 2.2, color = '#cbd5e1') => text(t, px(x), py(s + r + 0.0034), size, color, 700);

  for (let i = 0; i < ANALOG_STRIPS; i += 1) {
    const x = A.x(i);
    const mono = i < ANALOG_MONO;
    text(mono ? `${i + 1}` : i === 8 ? '9/10' : '11/12', px(x), py(A.s.num), 3.6, '#f8fafc', 800);
    if (mono) {
      under('MIC', x, A.s.xlr, 0.015, 2.1, '#93c5fd');
      under('LINE', x, A.s.line, 0.0072, 2.1, '#fcd34d');
      under('INSERT', x, A.s.insert, 0.0072, 1.9, '#9ca3af');
    } else {
      under('L/MONO', x, A.s.stL, 0.0072, 1.9, '#fcd34d');
      under('R', x, A.s.stR, 0.0072, 2.1, '#fcd34d');
    }
    ticks(x, A.s.gain, 0.0082, false); under('GAIN', x, A.s.gain, 0.0082, 2.1, '#fca5a5');
    if (mono) {
      text('26dB', px(x - 0.01), py(A.s.pad + 0.0072), 1.8, '#cbd5e1'); text('PAD', px(x - 0.01), py(A.s.pad - 0.0068), 1.8, '#cbd5e1');
      text('80Hz', px(x + 0.01), py(A.s.pad + 0.0072), 1.8, '#cbd5e1'); text('HPF', px(x + 0.01), py(A.s.pad - 0.0068), 1.8, '#cbd5e1');
      if (i < 6) { ticks(x, A.s.comp, A.knobR, false); under('COMP', x, A.s.comp, A.knobR, 2.0, '#fdba74'); }
    }
    ticks(x, A.s.high, A.knobR, true); under(mono ? 'HIGH 10k' : 'HIGH', x, A.s.high, A.knobR, 1.9);
    ticks(x, A.s.mid, A.knobR, true); under(mono ? 'MID' : 'MID 2.5k', x, A.s.mid, A.knobR, 1.9);
    if (mono) { ticks(x, A.s.freq, A.knobR * 0.85, false); under('FREQ', x, A.s.freq, A.knobR * 0.85, 1.9, '#86efac'); }
    ticks(x, A.s.low, A.knobR, true); under(mono ? 'LOW 100' : 'LOW', x, A.s.low, A.knobR, 1.9);
    ticks(x, A.s.aux1, A.knobR, false); under('AUX1 PRE', x, A.s.aux1, A.knobR, 1.8, '#d8b4fe');
    ticks(x, A.s.aux2, A.knobR, false); under('AUX2', x, A.s.aux2, A.knobR, 1.9, '#d8b4fe');
    ticks(x, A.s.fx, A.knobR, false); under('EFFECT', x, A.s.fx, A.knobR, 1.9, '#5eead4');
    ticks(x, A.s.pan, A.knobR, true); under(mono ? 'PAN' : 'BAL', x, A.s.pan, A.knobR, 2.0);
    text('L', px(x - 0.011), py(A.s.pan - 0.004), 1.8, '#94a3b8'); text('R', px(x + 0.011), py(A.s.pan - 0.004), 1.8, '#94a3b8');
    text('ON', px(x - 0.002), py(A.s.on + 0.0068), 1.9, '#fde68a');
    text('PEAK', px(x + 0.0135), py(A.s.on - 0.0105), 1.5, '#fca5a5');
    text('PFL', px(x), py(A.s.pfl + 0.0068), 1.9, '#fdba74');
    // 페이더 눈금
    [[10, 100], [5, 87.5], [0, 75], [5, 68.75], [10, 62.5], [20, 50], [30, 37.5], [40, 25], [60, 6], ['∞', 0]].forEach(([lab, v]) => {
      const yy = py(faderS(v));
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = lab === 0 ? 2.5 : 1.2;
      ctx.beginPath(); ctx.moveTo(px(x - 0.0145), yy); ctx.lineTo(px(x - 0.0075), yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(x + 0.0075), yy); ctx.lineTo(px(x + 0.0145), yy); ctx.stroke();
      text(String(lab), px(x - 0.0175), yy, 1.6, '#cbd5e1', 600);
    });
    text('ST', px(x + 0.0165), py(A.s.fader - 0.045), 1.6, '#94a3b8');
  }

  // ---- 마스터 섹션 ----
  const mx = (k) => px(A.mc(k));
  text('STEREO OUT', (mx(0) + mx(1)) / 2, py(A.s.num), 2.4, '#f8fafc', 800);
  text('GROUP OUT', (mx(2) + mx(3)) / 2, py(A.s.num), 2.2, '#cbd5e1');
  text('MONITOR OUT', (mx(4) + mx(5)) / 2, py(A.s.num), 2.2, '#cbd5e1');
  text('AUX SEND', (mx(0) + mx(1)) / 2, py(A.s.line - 0.0125), 2.1, '#d8b4fe');
  text('EFFECT', mx(2), py(A.s.line - 0.0125), 2.0, '#5eead4');
  text('RETURN', (mx(3) + mx(4)) / 2, py(A.s.line - 0.0125), 2.0, '#5eead4');
  text('PHONES', mx(5), py(A.s.line - 0.0125), 2.0, '#f8fafc');
  text('2TR IN', (mx(0) + mx(1)) / 2, py(A.s.insert + 0.0105), 2.0, '#cbd5e1');
  text('REC OUT', (mx(2) + mx(3)) / 2, py(A.s.insert + 0.0105), 2.0, '#cbd5e1');
  text('FOOT SW', mx(4), py(A.s.insert + 0.0105), 1.8, '#9ca3af');
  MASTER_JACKS.forEach(([, , col, row, lab]) => { if (row === 'xlr') text(lab, mx(col), py(A.s.xlr + 0.0185), 2.0, '#e5e7eb'); else text(lab, mx(col) + 0.011 * 1000 * mm, py(A.s[row]), 1.7, '#9ca3af'); });

  // 디지털 이펙트
  const [pc, ps] = MC.program;
  ticks(A.mc(pc), ps, 0.0085, false);
  text('PROGRAM', mx(pc), py(ps + 0.0085 + 0.0034), 1.9, '#5eead4');
  ['1 HALL', '2 ROOM', '3 PLATE', '4 ECHO', '5 DELAY', '6 CHORUS'].forEach((t, k) => text(t, mx(pc) - 0.013 * 1000 * mm, py(ps - 0.009 + k * 0.0036), 1.4, '#99f6e4', 600, 'right'));
  ticks(A.mc(MC.parameter[0]), MC.parameter[1], A.knobR, false); text('PARAMETER', mx(MC.parameter[0]), py(MC.parameter[1] + A.knobR + 0.0034), 1.7, '#5eead4');
  text('FX ON', mx(MC.fxOn[0]), py(MC.fxOn[1] + 0.0068), 1.8, '#5eead4');
  text('PHANTOM', mx(MC.phantom[0]), py(MC.phantom[1] - 0.0095), 2.0, '#fca5a5', 800);
  text('+48V', mx(MC.phantom[0]), py(MC.phantom[1] + 0.0085), 2.0, '#fca5a5', 800);
  text('POWER', mx(5), py(MC.phantom[1] + 0.0085), 1.8, '#86efac');
  // 미터 눈금
  LED_THR.slice().reverse().forEach((thr, k) => {
    const s = -0.03 - (LED_THR.length - 1 - k) * 0.0066;
    text(`${thr > 0 ? '+' : ''}${thr}`, px(A.mc(4) - 0.005), py(s), 1.5, thr >= 0 ? '#fca5a5' : '#cbd5e1', 600, 'right');
  });
  text('L', px(A.mc(4) + 0.002), py(-0.03 + 0.008), 1.8, '#e5e7eb'); text('R', px(A.mc(4) + 0.016), py(-0.03 + 0.008), 1.8, '#e5e7eb');
  [['AUX1', 'auxMaster', '#d8b4fe'], ['AUX2', 'aux2Master', '#d8b4fe'], ['EFFECT', 'fxMaster', '#5eead4'], ['RETURN', 'fxReturn', '#5eead4'], ['2TR IN', 'twoTr', '#cbd5e1'], ['PHONES', 'phonesLevel', '#f8fafc']].forEach(([t, k, c]) => {
    const [col, s] = MC[k];
    ticks(A.mc(col), s, A.knobR, false);
    text(t, mx(col), py(s + A.knobR + 0.0034), 1.9, c);
  });
  text('PFL', mx(2) - 0.006 * 1000 * mm, py(-0.024), 1.8, '#fdba74');
  text('ST ON', mx(MC.stOn[0]), py(MC.stOn[1] + 0.0068), 1.9, '#fde68a');
  text('GROUP 1-2', mx(MC.groupA[0]), py(A.s.fader + A.faderLen / 2 + 0.008), 1.7, '#cbd5e1');
  text('3-4', mx(MC.groupB[0]), py(A.s.fader + A.faderLen / 2 + 0.008), 1.7, '#cbd5e1');
  text('STEREO', mx(MC.stereo[0]), py(A.s.fader + A.faderLen / 2 + 0.008), 2.0, '#fca5a5', 800);
  [[10, 100], [5, 87.5], [0, 75], [10, 62.5], [20, 50], [30, 37.5], [40, 25], ['∞', 0]].forEach(([lab, v]) => {
    const yy = py(faderS(v));
    text(String(lab), mx(MC.stereo[0]) + 0.017 * 1000 * mm, yy, 1.6, '#cbd5e1', 600);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = lab === 0 ? 2.5 : 1.2;
    ctx.beginPath(); ctx.moveTo(mx(MC.stereo[0]) + 0.008 * 1000 * mm, yy); ctx.lineTo(mx(MC.stereo[0]) + 0.013 * 1000 * mm, yy); ctx.stroke();
  });
  text('MX-12', mx(0) - 0.006 * 1000 * mm, py(0.255), 3.4, '#f8fafc', 900, 'left');
  text('MIXING CONSOLE', mx(2) - 0.004 * 1000 * mm, py(0.255), 2.0, '#cbd5e1', 600, 'left');
}

// 몸통: 옆에서 보면 앞이 낮은 쐐기 모양
function useBodyGeometry(inset = 0, top = 0) {
  return useMemo(() => {
    const zf = A.depth / 2 + inset, zb = -A.depth / 2 - inset;
    const yf = A.toLocal([0, -0.006, A.depth / 2])[1] + top, yb = A.toLocal([0, -0.006, -A.depth / 2])[1] + top;
    const shape = new THREE.Shape();
    shape.moveTo(zf, 0.004); shape.lineTo(zf, yf - 0.006); shape.quadraticCurveTo(zf, yf, zf - 0.008, yf);
    shape.lineTo(zb + 0.006, yb); shape.quadraticCurveTo(zb, yb, zb, yb - 0.006); shape.lineTo(zb, 0.004);
    shape.lineTo(zf, 0.004);
    return shape;
  }, [inset, top]);
}
function Extruded({ shape, depth, x, color, rough = 0.6 }) {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 }), [shape, depth]);
  return (
    <mesh geometry={geo} position={[x, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={rough} metalness={0.15} />
    </mesh>
  );
}

// 이름표 테이프 (믹서 앞쪽에 붙인 마스킹 테이프)
function useTape(names) {
  return useCanvasTexture(1280, 64, (ctx, w, h) => {
    const cw = w / ANALOG_STRIPS;
    names.slice(0, ANALOG_STRIPS).forEach((n, i) => {
      const x = i * cw;
      ctx.fillStyle = '#efe6cf'; ctx.fillRect(x + 3, 6, cw - 6, h - 12);
      ctx.fillStyle = '#1f2937'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(n || '—', x + cw / 2, h / 2 + 1, cw - 10);
    });
  }, [names.join('|')]);
}

const LED_STEP = 0.0066;
function MeterLadder({ x, level }) {
  return (
    <group>
      {LED_THR.map((thr, i) => {
        const on = level != null && level >= thr;
        const color = thr >= 0 ? '#ef4444' : thr >= -6 ? '#facc15' : '#22c55e';
        return <Lamp key={thr} position={[x, 0.0015, -0.03 - i * LED_STEP]} on={on} color={color} size={[0.0062, 0.0025, 0.0036]} offColor="#14171b" intensity={1.5} />;
      })}
    </group>
  );
}

export function AnalogConsole({ channels, master, meters, names }) {
  const tex = useCanvasTexture(TEX_W, TEX_H, (ctx) => drawDeck(ctx), []);
  const tape = useTape(names);
  const body = useBodyGeometry(0, 0);
  const cheek = useBodyGeometry(0.004, 0.008);
  const M = master;
  const anyPfl = channels.some((c) => c.pfl);
  const phantomOn = !!M.phantom || channels.some((c) => c.phantom);
  const chs = channels.slice(0, ANALOG_STRIPS);
  return (
    <group>
      {/* 몸통과 양옆 마구리 */}
      <Extruded shape={body} depth={A.W - 0.024} x={A.W / 2 - 0.012} color="#2a2e35" />
      <Extruded shape={cheek} depth={0.012} x={A.W / 2} color="#17191d" rough={0.8} />
      <Extruded shape={cheek} depth={0.012} x={-A.W / 2 + 0.012} color="#17191d" rough={0.8} />
      {/* 앞면 손목 받침 */}
      <mesh position={[0, 0.02, A.depth / 2 + 0.006]} castShadow><boxGeometry args={[A.W - 0.024, 0.032, 0.012]} /><meshStandardMaterial color="#202328" roughness={0.7} /></mesh>

      <group position={[0, A.yc, 0]} rotation={[A.slope, 0, 0]}>
        {/* 인쇄된 상판 */}
        <mesh position={[0, -0.003, 0]} receiveShadow raycast={noRaycast}><boxGeometry args={[DECK_W, 0.006, DECK_D]} /><meshStandardMaterial color="#3b4048" roughness={0.55} metalness={0.3} /></mesh>
        <mesh position={[0, 0.0002, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[DECK_W, DECK_D]} />
          <meshStandardMaterial map={tex} roughness={0.6} metalness={0.2} />
        </mesh>

        {chs.map((ch, i) => {
          const x = A.x(i);
          const mono = i < ANALOG_MONO;
          const lv = meters?.ch?.[i];
          return (
            <group key={i}>
              {mono ? (
                <>
                  <Jack x={x} s={A.s.xlr} kind="xlr" />
                  <Jack x={x} s={A.s.line} kind="trs" />
                  <Jack x={x} s={A.s.insert} kind="trs" />
                </>
              ) : (
                <>
                  <Jack x={x} s={A.s.stL} kind="trs" />
                  <Jack x={x} s={A.s.stR} kind="trs" />
                </>
              )}
              <DeckKnob x={x} s={A.s.gain} value={ch.gain} min={0} max={60} cap="#ef4444" r={0.0082} />
              {mono && (
                <>
                  <DeckBtn x={x - 0.01} s={A.s.pad} on={ch.pad} color="#f97316" w={0.009} d={0.007} />
                  <DeckBtn x={x + 0.01} s={A.s.pad} on={ch.lowCut} color="#22d3ee" w={0.009} d={0.007} />
                  {i < 6 && <DeckKnob x={x} s={A.s.comp} value={ch.comp ?? 0} min={0} max={100} cap="#fb923c" />}
                  <DeckKnob x={x} s={A.s.freq} value={Math.log10((ch.eqFreq ?? 1000) / 250)} min={0} max={Math.log10(20)} cap="#86efac" r={A.knobR * 0.85} />
                </>
              )}
              <DeckKnob x={x} s={A.s.high} value={ch.eqHigh} min={-15} max={15} cap="#60a5fa" />
              <DeckKnob x={x} s={A.s.mid} value={ch.eqMid} min={-15} max={15} cap="#34d399" />
              <DeckKnob x={x} s={A.s.low} value={ch.eqLow} min={-15} max={15} cap="#fbbf24" />
              <DeckKnob x={x} s={A.s.aux1} value={ch.aux} min={0} max={100} cap="#c084fc" />
              <DeckKnob x={x} s={A.s.aux2} value={ch.aux2 ?? 0} min={0} max={100} cap="#a78bfa" />
              <DeckKnob x={x} s={A.s.fx} value={ch.fx} min={0} max={100} cap="#2dd4bf" />
              <DeckKnob x={x} s={A.s.pan} value={ch.pan ?? 0} min={-100} max={100} cap="#e5e7eb" />
              {/* ON(켜지면 불) · PEAK · 신호 · PFL */}
              <DeckBtn x={x - 0.002} s={A.s.on} on={!ch.mute} color="#fbbf24" w={0.016} d={0.009} />
              <Lamp position={[x + 0.0135, 0.0012, A.s.on - 0.0058]} on={lv != null && lv > -3} color="#ef4444" size={[0.0042, 0.002, 0.0042]} offColor="#2a0f10" />
              <Lamp position={[x + 0.0135, 0.0012, A.s.on + 0.002]} on={lv != null && lv > -40} color="#22c55e" size={[0.0042, 0.002, 0.0042]} offColor="#0f2a16" intensity={1.4} />
              <DeckBtn x={x} s={A.s.pfl} on={!!ch.pfl} color="#f97316" w={0.012} d={0.008} />
              <Fader position={[x, 0, A.s.fader]} value={ch.fader} length={A.faderLen} color="#d1d5db" />
            </group>
          );
        })}
        {/* 이름표 */}
        <mesh position={[(A.x(0) + A.x(ANALOG_STRIPS - 1)) / 2, 0.0006, A.s.tape]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[ANALOG_STRIPS * A.pitch - 0.004, 0.016]} /><meshBasicMaterial map={tape} toneMapped={false} />
        </mesh>

        {/* 마스터: 단자 */}
        {MASTER_JACKS.map(([id, kind, col, row]) => <Jack key={`${col}${row}`} x={A.mc(col)} s={A.s[row]} kind={kind} />)}
        {/* 이펙트 · 팬텀 · 전원 */}
        <DeckKnob x={A.mc(MC.program[0])} s={MC.program[1]} value={1} min={0} max={15} cap="#2dd4bf" r={0.0085} />
        <DeckKnob x={A.mc(MC.parameter[0])} s={MC.parameter[1]} value={50} min={0} max={100} cap="#99f6e4" />
        <DeckBtn x={A.mc(MC.fxOn[0])} s={MC.fxOn[1]} on={M.fxReturn > 0} color="#2dd4bf" w={0.012} d={0.008} />
        <DeckBtn x={A.mc(MC.phantom[0])} s={MC.phantom[1]} on={phantomOn} color="#ef4444" w={0.016} d={0.01} />
        <Lamp position={[A.mc(5), 0.0012, MC.phantom[1]]} on color="#22c55e" size={[0.005, 0.002, 0.005]} />
        {/* 레벨 미터 L/R */}
        <MeterLadder x={A.mc(4) + 0.002} level={meters?.main} />
        <MeterLadder x={A.mc(4) + 0.016} level={meters?.mainR ?? meters?.main} />
        {/* AUX · 리턴 · 헤드폰 레벨 */}
        <DeckKnob x={A.mc(MC.auxMaster[0])} s={MC.auxMaster[1]} value={M.auxMaster} min={0} max={100} cap="#c084fc" />
        <DeckKnob x={A.mc(MC.aux2Master[0])} s={MC.aux2Master[1]} value={M.aux2Master ?? 75} min={0} max={100} cap="#a78bfa" />
        <DeckKnob x={A.mc(MC.fxMaster[0])} s={MC.fxMaster[1]} value={75} min={0} max={100} cap="#2dd4bf" />
        <DeckKnob x={A.mc(MC.fxReturn[0])} s={MC.fxReturn[1]} value={M.fxReturn} min={0} max={100} cap="#2dd4bf" />
        <DeckKnob x={A.mc(MC.twoTr[0])} s={MC.twoTr[1]} value={0} min={0} max={100} cap="#e5e7eb" />
        <DeckKnob x={A.mc(MC.phonesLevel[0])} s={MC.phonesLevel[1]} value={M.phonesLevel ?? 75} min={0} max={100} cap="#f8fafc" />
        <Lamp position={[A.mc(2) + 0.006, 0.0012, -0.024]} on={anyPfl} color="#f97316" size={[0.005, 0.002, 0.005]} offColor="#2a1a0f" />
        {/* GROUP · STEREO 페이더 */}
        <DeckBtn x={A.mc(MC.stOn[0])} s={MC.stOn[1]} on={!M.mainMute} color="#fbbf24" w={0.018} d={0.009} />
        <Fader position={[A.mc(MC.groupA[0]), 0, A.s.fader]} value={0} length={A.faderLen} color="#d1d5db" />
        <Fader position={[A.mc(MC.groupB[0]), 0, A.s.fader]} value={0} length={A.faderLen} color="#d1d5db" />
        <Fader position={[A.mc(MC.stereo[0]), 0, A.s.fader]} value={M.mainFader} length={A.faderLen} color="#f87171" />
      </group>
    </group>
  );
}
