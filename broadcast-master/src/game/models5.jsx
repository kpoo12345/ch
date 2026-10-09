import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Lamp, Knob, Waves, noRaycast, useCanvasTexture, FONT, MAT } from './kit3d.jsx';

/* =====================================================================
 * 스네이크(멀티 케이블) 3D 모델
 *  - 스테이지 박스: 무대 바닥의 튼튼한 철제 박스. 앞(+z) 경사 패널에 번호 붙은 XLR 입력 8개 + 리턴 2개,
 *    왼쪽(-x) 옆면에 멀티핀 커넥터(스네이크가 FOH로 나가는 곳). 앞이 객석(카메라) 쪽이라 번호가 보인다.
 *  - 팬아웃: 믹서 옆에 두는 작은 브레이크아웃. 뒤(-z)로 멀티가 들어오고, 앞 경사 패널의 번호 붙은
 *    XLR 꼬리(OUT 1~8)가 믹서 채널로 간다. RETURN IN 2개(콤보)는 믹서 AUX를 받는다.
 * 윗면 LED: 그 번호 가닥에 신호가 있으면 켜진다 (LINK = 멀티 케이블 연결됨).
 * ===================================================================== */
const NR = { raycast: noRaycast };

// 옆모습(z, y)을 x 방향으로 밀어낸 경사 패널 상자. 경사면: (zf, yLow) → (zt, h)
function slopedBox({ w, h, d, yLow, zt }) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2, yLow); s.lineTo(zt, h); s.lineTo(-d / 2, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  g.translate(0, 0, -w / 2);
  g.rotateY(-Math.PI / 2); // 모양의 x → 장비 z, 밀어낸 방향 → 장비 x
  return g;
}
// 경사면 위 한 점 (t: 0 = 아래 앞, 1 = 위 뒤) + 면에서 띄울 거리
function slopePoint({ d, h, yLow, zt }, t, off = 0) {
  const dz = zt - d / 2, dy = h - yLow, L = Math.hypot(dz, dy);
  const n = [0, -dz / L, dy / L];
  return { p: [0, yLow + dy * t + n[1] * off, d / 2 + dz * t + n[2] * off], n, L };
}
// 경사면에 붙이는 평면의 회전 (평면 +y = 경사 위쪽, +z = 면 바깥)
function slopeQuat(n) {
  const z = new THREE.Vector3(...n), x = new THREE.Vector3(1, 0, 0);
  const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

const BOX = { w: 0.34, h: 0.15, d: 0.17, yLow: 0.04, zt: -0.02 };
const BOX_IN_X = [-0.135, -0.085, -0.035, 0.015]; // 앞에서 봐서 왼쪽부터 1·2·3·4 (아래 줄 5·6·7·8)
const BOX_RET_X = 0.11;
const BOX_ROW_T = [0.7, 0.3]; // 위 줄, 아래 줄
const MULTI_Y = 0.055, MULTI_Z = -0.02; // 왼쪽 옆면 멀티 커넥터
const FAN = { w: 0.26, h: 0.085, d: 0.13, yLow: 0.02, zt: 0.01 };
const FAN_OUT_X = [-0.1, -0.06, -0.02, 0.02];
const FAN_RET_X = 0.085;
const FAN_ROW_T = [0.74, 0.27];
const JACK_OFF = 0.0045;

// 경사 패널 인쇄 (번호·RETURN 구역) — 캔버스 좌표: u = 장비 x, v = 경사 위(0) → 아래
// side: 번호를 단자 위(above, 패널이 넓을 때) 또는 왼쪽(left)에 쓴다
function drawPanel(ctx, W, H, { spec, cols, retX, rowsT, ret, pxPerM, tTop, side = 'above' }) {
  ctx.fillStyle = '#181b20'; ctx.fillRect(0, 0, W, H);
  const u = (x) => W / 2 + x * pxPerM;
  const v = (t) => (tTop - t) * spec.L * pxPerM;
  const at = (x, t) => (side === 'above' ? [u(x), v(t) - 0.0205 * pxPerM] : [u(x - 0.0195), v(t)]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = Math.round((side === 'above' ? 0.0125 : 0.0095) * pxPerM);
  rowsT.forEach((t, r) => {
    cols.forEach((x, c) => {
      ctx.fillStyle = '#f8fafc'; ctx.font = `800 ${fs}px ${FONT}`;
      ctx.fillText(String(r * cols.length + c + 1), ...at(x, t));
    });
    ctx.fillStyle = '#fbbf24'; ctx.font = `800 ${Math.round(fs * 0.8)}px ${FONT}`;
    ctx.fillText(`R${r + 1}`, ...at(retX, t));
  });
  // RETURN 구역 테두리
  const x0 = u(retX - 0.031), x1 = u(retX + 0.03);
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = Math.max(2, pxPerM * 0.0012);
  ctx.strokeRect(x0, 3, x1 - x0, H - 6);
  if (ret) { ctx.fillStyle = '#fbbf24'; ctx.font = `700 ${Math.round(fs * 0.62)}px ${FONT}`; ctx.fillText(ret, (x0 + x1) / 2, H - fs * 0.45); }
}

// 윗면 인쇄 (이름 + LED 번호) — 앞(+z)에서 읽힌다
function drawTop(ctx, W, H, { title, sub, ledX, ledLabels, ledV, pxPerM }) {
  ctx.fillStyle = '#20252d'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc'; ctx.font = `800 ${Math.round(H * 0.2)}px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText(title, 16, H * 0.2);
  ctx.fillStyle = '#fb7185'; ctx.font = `700 ${Math.round(H * 0.13)}px ${FONT}`;
  ctx.fillText(sub, 16, H * 0.45);
  ctx.textAlign = 'center'; ctx.fillStyle = '#cbd5e1'; ctx.font = `700 ${Math.round(H * 0.12)}px ${FONT}`;
  ledX.forEach((x, i) => ctx.fillText(ledLabels[i], W / 2 + x * pxPerM, ledV - H * 0.13));
}

function PrintedPlane({ w, h, tex, position, quaternion, rotation }) {
  return (
    <mesh {...NR} position={position} quaternion={quaternion} rotation={rotation}>
      <planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

// 무대 쪽 스테이지 박스. sig: IN 1~8 신호 여부, ret: RETURN 1·2 신호 여부, link: 멀티 연결
export function StageBoxModel({ sig = [], ret = [], link = false }) {
  const geo = useMemo(() => slopedBox(BOX), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mid = slopePoint(BOX, 0.5, JACK_OFF - 0.0005);
  const q = useMemo(() => slopeQuat(mid.n), []); // eslint-disable-line react-hooks/exhaustive-deps
  const panelW = BOX.w - 0.01, panelH = mid.L - 0.008, ppm = 2000;
  const tTop = 0.5 + panelH / mid.L / 2;
  const panelTex = useCanvasTexture(Math.round(panelW * ppm), Math.round(panelH * ppm), (ctx, W, H) => drawPanel(ctx, W, H, {
    spec: mid, cols: BOX_IN_X, retX: BOX_RET_X, rowsT: BOX_ROW_T, ret: 'RETURN', pxPerM: ppm, tTop,
  }), []);
  // 윗면: z = -d/2 .. zt
  const topD = BOX.zt + BOX.d / 2 - 0.006, topZ = (BOX.zt - BOX.d / 2) / 2;
  const ledX = [...Array.from({ length: 8 }, (_, i) => -0.15 + i * 0.026), 0.075, 0.1, 0.14];
  const ledZ = BOX.zt - 0.016;
  const ledV = (ledZ - (topZ - topD / 2)) * ppm;
  const topTex = useCanvasTexture(Math.round(panelW * ppm), Math.round(topD * ppm), (ctx, W, H) => drawTop(ctx, W, H, {
    title: 'STAGE BOX  8 × 2', sub: 'MULTI 한 줄로 FOH 믹서까지', ledX, ledLabels: ['1', '2', '3', '4', '5', '6', '7', '8', 'R1', 'R2', 'LINK'], ledV, pxPerM: ppm,
  }), []);
  const sideTex = useCanvasTexture(320, 64, (ctx, W, H) => {
    ctx.fillStyle = '#20252d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fb7185'; ctx.font = `800 36px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MULTI ▸ FOH', W / 2, H / 2 + 2);
  }, []);
  const leds = [...sig.slice(0, 8), ...ret.slice(0, 2), link];
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#2d3440" metalness={0.55} roughness={0.42} />
      </mesh>
      <PrintedPlane w={panelW} h={panelH} tex={panelTex} position={mid.p} quaternion={q} />
      <PrintedPlane w={panelW} h={topD} tex={topTex} position={[0, BOX.h + 0.0032, topZ]} rotation={[-Math.PI / 2, 0, 0]} />
      {ledX.map((x, i) => (
        <Lamp key={x} position={[x, BOX.h + 0.005, ledZ]} on={!!leds[i]} color={i < 8 ? '#22c55e' : i < 10 ? '#f59e0b' : '#38bdf8'} size={[0.009, 0.004, 0.006]} offColor="#11151a" />
      ))}
      {/* 왼쪽 옆면: 멀티 커넥터 둘레 보강판 + 인쇄 (멀티 케이블이 여기서 FOH로 나간다) */}
      <mesh {...NR} position={[-BOX.w / 2 - 0.004, MULTI_Y, MULTI_Z]} castShadow><boxGeometry args={[0.006, 0.062, 0.07]} /><meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.35} /></mesh>
      <PrintedPlane w={0.075} h={0.015} tex={sideTex} position={[-BOX.w / 2 - 0.0036, 0.103, MULTI_Z]} rotation={[0, -Math.PI / 2, 0]} />
      {/* 옆 손잡이 (튼튼한 철제 박스) */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (BOX.w / 2 + 0.016), 0.128, -0.02]}>
          <mesh {...NR} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.006, 0.006, 0.1, 10]} /><meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} /></mesh>
          {[-0.045, 0.045].map((z) => <mesh key={z} {...NR} position={[-sx * 0.008, 0, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.005, 0.005, 0.018, 8]} /><meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} /></mesh>)}
        </group>
      ))}
      {/* 고무 모서리 보호대 */}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} {...NR} position={[sx * (BOX.w / 2 + 0.001), 0.02, sz * (BOX.d / 2 + 0.001)]}><boxGeometry args={[0.022, 0.04, 0.022]} /><meshStandardMaterial color="#0f1114" roughness={0.9} /></mesh>
      )))}
    </group>
  );
}

// 믹서 쪽 팬아웃. sig: OUT 1~8 신호 여부, ret: RETURN IN 1·2 신호 여부, link: 멀티 연결
export function FanoutModel({ sig = [], ret = [], link = false }) {
  const geo = useMemo(() => slopedBox(FAN), []);
  useEffect(() => () => geo.dispose(), [geo]);
  const mid = slopePoint(FAN, 0.5, JACK_OFF - 0.0005);
  const q = useMemo(() => slopeQuat(mid.n), []); // eslint-disable-line react-hooks/exhaustive-deps
  const panelW = FAN.w - 0.008, panelH = mid.L - 0.006, ppm = 2400;
  const tTop = 0.5 + panelH / mid.L / 2;
  const panelTex = useCanvasTexture(Math.round(panelW * ppm), Math.round(panelH * ppm), (ctx, W, H) => drawPanel(ctx, W, H, {
    spec: mid, cols: FAN_OUT_X, retX: FAN_RET_X, rowsT: FAN_ROW_T, pxPerM: ppm, tTop, side: 'left',
  }), []);
  const topD = FAN.zt + FAN.d / 2 - 0.006, topZ = (FAN.zt - FAN.d / 2) / 2;
  const ledX = [...Array.from({ length: 8 }, (_, i) => -0.112 + i * 0.019), 0.05, 0.07, 0.1];
  const ledZ = FAN.zt - 0.014;
  const ledV = (ledZ - (topZ - topD / 2)) * ppm;
  const topTex = useCanvasTexture(Math.round(panelW * ppm), Math.round(topD * ppm), (ctx, W, H) => drawTop(ctx, W, H, {
    title: 'SNAKE FAN-OUT', sub: 'OUT 번호 = 믹서 채널 번호', ledX, ledLabels: ['1', '2', '3', '4', '5', '6', '7', '8', 'R1', 'R2', 'LINK'], ledV, pxPerM: ppm,
  }), []);
  const leds = [...sig.slice(0, 8), ...ret.slice(0, 2), link];
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial color="#343b47" metalness={0.5} roughness={0.45} />
      </mesh>
      <PrintedPlane w={panelW} h={panelH} tex={panelTex} position={mid.p} quaternion={q} />
      <PrintedPlane w={panelW} h={topD} tex={topTex} position={[0, FAN.h + 0.0032, topZ]} rotation={[-Math.PI / 2, 0, 0]} />
      {ledX.map((x, i) => (
        <Lamp key={x} position={[x, FAN.h + 0.0045, ledZ]} on={!!leds[i]} color={i < 8 ? '#22c55e' : i < 10 ? '#f59e0b' : '#38bdf8'} size={[0.007, 0.003, 0.005]} offColor="#11151a" />
      ))}
      {/* 고무 발 */}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} {...NR} position={[sx * (FAN.w / 2 - 0.02), -0.002, sz * (FAN.d / 2 - 0.015)]}><cylinderGeometry args={[0.009, 0.009, 0.006, 12]} /><meshStandardMaterial color="#0f1114" roughness={0.9} /></mesh>
      )))}
    </group>
  );
}

// 경사 패널 단자 위치 (장비 로컬)
const rowPorts = (spec, cols, rowT, idOf) => Object.fromEntries(rowT.flatMap((t, r) => cols.map((x, c) => {
  const s = slopePoint(spec, t, JACK_OFF);
  return [idOf(r * cols.length + c), { p: [x, s.p[1], s.p[2]], n: s.n }];
})));
const retPorts = (spec, x, rowT) => Object.fromEntries(rowT.map((t, r) => { const s = slopePoint(spec, t, JACK_OFF); return [`ret${r + 1}`, { p: [x, s.p[1], s.p[2]], n: s.n }]; }));

export const PORTS_SNAKE = {
  stage_box: {
    ...rowPorts(BOX, BOX_IN_X, BOX_ROW_T, (i) => `in${i + 1}`),
    ...retPorts(BOX, BOX_RET_X, BOX_ROW_T),
    multi: { p: [-BOX.w / 2 - 0.0075, MULTI_Y, MULTI_Z], n: [-1, 0, 0] },
  },
  snake_fanout: {
    ...rowPorts(FAN, FAN_OUT_X, FAN_ROW_T, (i) => `out${i + 1}`),
    ...retPorts(FAN, FAN_RET_X, FAN_ROW_T),
    multi: { p: [0, 0.045, -FAN.d / 2 - 0.0035], n: [0, 0, -1] },
  },
};
export const GHOST_SNAKE = { stage_box: [0.4, 0.18, 0.22], snake_fanout: [0.3, 0.11, 0.16] };
export const FOCUS_SNAKE = { stage_box: { y: 0.08, dist: 0.8 }, snake_fanout: { y: 0.05, dist: 0.6 } };
export const SELECT_RADIUS_SNAKE = { stage_box: 0.27, snake_fanout: 0.2 };
export const SNAKE_TYPES = new Set(Object.keys(PORTS_SNAKE));

/* =====================================================================
 * 파워 앰프 · 패시브 스피커 · 인이어 모니터(IEM)
 *  - 파워 앰프: 19인치 2U 랙 앰프. 앞(+z)에 채널 A·B 레벨 노브, SIGNAL/CLIP LED, 전원 스위치.
 *    뒤(-z)의 위쪽 가장자리에 INPUT A·B(콤보)와 SPEAKON OUT A·B (위에서도 보이게 단자가 위-뒤를 향한다).
 *  - 패시브 스피커: 액티브 스피커와 같은 스탠드형이지만 전원 LED가 없고 옆면에 스피콘 단자.
 *  - IEM: 하프랙 송신기(채널 LCD + 뒤쪽 안테나) + 옆에 세워 둔 벨트팩 수신기와 이어폰.
 * ===================================================================== */
const AMP = { w: 0.43, h: 0.088, d: 0.3 };
const AMP_KNOB = { A: [-0.06, 0.046], B: [0.035, 0.046] }; // 앞면 [x, y]
const AMP_POWER = [0.158, 0.044];
const AMP_IN_X = { inA: -0.15, inB: -0.098 };
const AMP_OUT_X = { spkA: 0.02, spkB: 0.088 };
const REAR_Y = AMP.h - 0.013;
const REAR_N = [0, 0.6, -0.8];

function drawAmpFront(ctx, W, H) {
  const ppm = W / AMP.w;
  const u = (x) => W / 2 + x * ppm, v = (y) => H - y * ppm;
  ctx.fillStyle = '#1d2026'; ctx.fillRect(0, 0, W, H);
  // 통풍 슬롯
  ctx.fillStyle = '#07080a';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(u(-0.178), v(0.074 - i * 0.0105), 0.068 * ppm, 0.0042 * ppm);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc'; ctx.font = `800 ${Math.round(0.0085 * ppm)}px ${FONT}`;
  ctx.fillText('POWER AMP', u(-0.144), v(0.012));
  [['A', AMP_KNOB.A], ['B', AMP_KNOB.B]].forEach(([n, [x, y]]) => {
    ctx.fillStyle = '#fbbf24'; ctx.font = `800 ${Math.round(0.011 * ppm)}px ${FONT}`;
    ctx.fillText(`CH ${n}`, u(x), v(y + 0.031));
    // 눈금 (0 · 75=0dB · 100)
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = Math.max(2, 0.0007 * ppm);
    for (let k = 0; k <= 10; k += 1) {
      const a = (-0.75 + 1.5 * (k / 10)) * Math.PI;
      const r1 = 0.019 * ppm, r2 = (k === 0 || k === 10 ? 0.024 : 0.022) * ppm;
      ctx.beginPath(); ctx.moveTo(u(x) + Math.sin(a) * r1, v(y) - Math.cos(a) * r1); ctx.lineTo(u(x) + Math.sin(a) * r2, v(y) - Math.cos(a) * r2); ctx.stroke();
    }
    const a0 = 0.375 * Math.PI; // 75 = 0dB 표시
    ctx.fillStyle = '#fbbf24'; ctx.font = `700 ${Math.round(0.0058 * ppm)}px ${FONT}`;
    ctx.fillText('0dB', u(x) + Math.sin(a0) * 0.03 * ppm, v(y) - Math.cos(a0) * 0.03 * ppm);
    ctx.fillStyle = '#cbd5e1'; ctx.font = `700 ${Math.round(0.0055 * ppm)}px ${FONT}`;
    ctx.fillText('SIG', u(x + 0.035) + 0.012 * ppm, v(0.058)); ctx.fillText('CLIP', u(x + 0.035) + 0.013 * ppm, v(0.038));
  });
  ctx.fillStyle = '#cbd5e1'; ctx.font = `800 ${Math.round(0.0062 * ppm)}px ${FONT}`;
  ctx.fillText('POWER', u(AMP_POWER[0]), v(0.074));
}
function drawAmpRear(ctx, W, H) {
  const ppm = W / AMP.w;
  const u = (x) => W / 2 - x * ppm; // 뒤에서 보면 좌우가 바뀐다
  ctx.fillStyle = '#1a1d22'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e2e8f0'; ctx.font = `800 ${Math.round(0.0075 * ppm)}px ${FONT}`;
  Object.entries(AMP_IN_X).forEach(([id, x]) => ctx.fillText(id === 'inA' ? 'INPUT A' : 'INPUT B', u(x), H * 0.55));
  ctx.fillStyle = '#fca5a5';
  Object.entries(AMP_OUT_X).forEach(([id, x]) => ctx.fillText(id === 'spkA' ? 'SPEAKON A' : 'SPEAKON B', u(x), H * 0.55));
  ctx.fillStyle = '#fbbf24'; ctx.font = `700 ${Math.round(0.0058 * ppm)}px ${FONT}`;
  ctx.fillText('LINE IN (XLR/TRS)', u(-0.124), H * 0.75);
  ctx.fillText('⚠ 패시브 스피커 전용 · 8Ω', u(0.054), H * 0.75);
  ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 3; ctx.strokeRect(u(0.12), H * 0.12, (0.135) * ppm, H * 0.76);
}

// sig/clip: 채널별 신호·클립 표시
export function PowerAmpModel({ power, levelA = 75, levelB = 75, sigA, sigB, clipA, clipB }) {
  const front = useCanvasTexture(1032, 211, drawAmpFront, []);
  const rear = useCanvasTexture(1032, 211, drawAmpRear, []);
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, AMP.h / 2, 0]}><boxGeometry args={[AMP.w, AMP.h, AMP.d]} /><meshStandardMaterial color="#1f2329" metalness={0.5} roughness={0.45} /></mesh>
      {/* 랙 귀 (앞면 양옆) + 손잡이 */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh {...NR} position={[sx * (AMP.w / 2 + 0.013), AMP.h / 2, AMP.d / 2 - 0.0015]}><boxGeometry args={[0.026, AMP.h, 0.003]} /><meshStandardMaterial color="#2a2f37" metalness={0.6} roughness={0.35} /></mesh>
          {[0.022, 0.066].map((y) => <mesh {...NR} key={y} position={[sx * (AMP.w / 2 + 0.016), y, AMP.d / 2 + 0.0005]}><cylinderGeometry args={[0.0035, 0.0035, 0.002, 10]} /><meshStandardMaterial color="#0b0c0e" /></mesh>)}
          <mesh {...NR} position={[sx * (AMP.w / 2 - 0.012), AMP.h / 2, AMP.d / 2 + 0.022]} castShadow><boxGeometry args={[0.008, AMP.h - 0.012, 0.008]} /><meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} /></mesh>
          {[0.012, AMP.h - 0.012].map((y) => <mesh {...NR} key={y} position={[sx * (AMP.w / 2 - 0.012), y, AMP.d / 2 + 0.011]}><boxGeometry args={[0.008, 0.008, 0.022]} /><meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.3} /></mesh>)}
        </group>
      ))}
      <mesh {...NR} position={[0, AMP.h / 2, AMP.d / 2 + 0.0008]}><planeGeometry args={[AMP.w, AMP.h]} /><meshStandardMaterial map={front} roughness={0.6} metalness={0.15} /></mesh>
      <mesh {...NR} position={[0, AMP.h / 2, -AMP.d / 2 - 0.0008]} rotation={[0, Math.PI, 0]}><planeGeometry args={[AMP.w, AMP.h]} /><meshStandardMaterial map={rear} roughness={0.6} metalness={0.15} /></mesh>
      {/* 채널 레벨 노브 (앞면) */}
      {[['A', levelA], ['B', levelB]].map(([n, val]) => (
        <group key={n} position={[AMP_KNOB[n][0], AMP_KNOB[n][1], AMP.d / 2 + 0.001]} rotation={[Math.PI / 2, 0, 0]}>
          <Knob position={[0, 0.008, 0]} value={val} min={0} max={100} color="#e5e7eb" size={0.013} />
        </group>
      ))}
      {[['A', sigA, clipA], ['B', sigB, clipB]].map(([n, sig, clip]) => (
        <group key={n}>
          <Lamp position={[AMP_KNOB[n][0] + 0.035, 0.058, AMP.d / 2 + 0.002]} on={!!power && !!sig} color="#22c55e" size={[0.006, 0.006, 0.004]} offColor="#14181d" />
          <Lamp position={[AMP_KNOB[n][0] + 0.035, 0.038, AMP.d / 2 + 0.002]} on={!!power && !!clip} color="#ef4444" size={[0.006, 0.006, 0.004]} offColor="#14181d" />
        </group>
      ))}
      {/* 전원: 큰 로커 스위치 + 파란 LED */}
      <mesh {...NR} position={[AMP_POWER[0], AMP_POWER[1], AMP.d / 2 + 0.006]} rotation={[power ? -0.22 : 0.22, 0, 0]}><boxGeometry args={[0.022, 0.03, 0.01]} /><meshStandardMaterial color={power ? '#dc2626' : '#3f1d1d'} roughness={0.5} emissive={power ? '#dc2626' : '#000'} emissiveIntensity={power ? 0.35 : 0} /></mesh>
      <Lamp position={[AMP_POWER[0] - 0.03, 0.066, AMP.d / 2 + 0.002]} on={!!power} color="#38bdf8" size={[0.007, 0.007, 0.004]} offColor="#14181d" />
      {/* 뒷면: 전원 인렛 · 팬 */}
      <mesh {...NR} position={[-0.17, 0.04, -AMP.d / 2 - 0.006]}><boxGeometry args={[0.03, 0.024, 0.012]} /><meshStandardMaterial color="#0b0c0e" /></mesh>
      <mesh {...NR} position={[-0.04, 0.044, -AMP.d / 2 - 0.001]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.002, 24]} /><meshStandardMaterial color="#0b0c0e" /></mesh>
    </group>
  );
}

// 패시브 스피커: 스탠드 + 캐비닛 (전원 LED 없음 · 옆면 스피콘)
export function PassiveSpeakerModel({ level, feedback }) {
  const cone = useRef();
  const cab = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const amp = feedback ? 0.012 : level != null ? Math.max(0, (level + 45) / 45) * 0.008 : 0;
    if (cone.current) cone.current.position.z = 0.135 + Math.sin(t * 55) * amp;
    if (cab.current) {
      cab.current.position.x = feedback ? Math.sin(t * 70) * 0.006 : 0;
      cab.current.rotation.z = feedback ? Math.sin(t * 43) * 0.012 : 0;
    }
  });
  const badge = useCanvasTexture(256, 64, (ctx, W, H) => {
    ctx.fillStyle = '#0f1115'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e2e8f0'; ctx.font = `800 30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PASSIVE · 8Ω', W / 2, H / 2 + 1);
  }, []);
  return (
    <group>
      {[0, 2.094, 4.188].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.17, 0.27, Math.cos(a) * 0.17]} rotation={[Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.62, 8]} /><meshStandardMaterial color={MAT.dark} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0]} castShadow><cylinderGeometry args={[0.018, 0.018, 0.75, 12]} /><meshStandardMaterial color={MAT.dark} metalness={0.6} roughness={0.4} /></mesh>
      <group ref={cab} position={[0, 1.45, 0]}>
        <RoundedBox args={[0.34, 0.56, 0.3]} radius={0.02} castShadow receiveShadow>
          <meshStandardMaterial color="#25282e" roughness={0.8} />
        </RoundedBox>
        {/* 금속 그릴 뒤로 보이는 콘 */}
        <mesh position={[0, -0.07, 0.151]}><circleGeometry args={[0.135, 40]} /><meshStandardMaterial color="#0a0b0d" /></mesh>
        <group ref={cone} position={[0, -0.07, 0.135]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.115, 0.035, 0.04, 40, 1, true]} /><meshStandardMaterial color="#202226" side={THREE.DoubleSide} roughness={0.9} /></mesh>
          <mesh position={[0, 0, -0.012]}><sphereGeometry args={[0.035, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2a2c31" /></mesh>
        </group>
        <mesh {...NR} position={[0, 0.04, 0.155]}><planeGeometry args={[0.31, 0.5]} /><meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} transparent opacity={0.28} depthWrite={false} /></mesh>
        <mesh position={[0, 0.17, 0.14]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.03, 0.04, 4, 1, true]} /><meshStandardMaterial color="#0c0d0f" side={THREE.DoubleSide} /></mesh>
        <mesh {...NR} position={[0, -0.25, 0.152]}><planeGeometry args={[0.12, 0.03]} /><meshBasicMaterial map={badge} toneMapped={false} /></mesh>
        {/* 옆면 스피콘 단자 판 */}
        <mesh position={[-0.171, -0.12, -0.04]}><boxGeometry args={[0.004, 0.09, 0.09]} /><meshStandardMaterial color="#2a2e35" /></mesh>
      </group>
      <Waves active={(level != null && level > -40) || feedback} color={feedback ? '#ef4444' : '#38bdf8'} position={[0, 1.38, 0.17]} radius={0.12} travel={0.9} speed={feedback ? 2.2 : 1} />
    </group>
  );
}

// 인이어 모니터: 하프랙 송신기 + 벨트팩 수신기 + 이어폰
const IEM_TX = { w: 0.212, h: 0.044, d: 0.2, x: -0.08 };
const IEM_PACK = { w: 0.064, h: 0.092, d: 0.024, x: 0.15, z: 0.04 };
const iemFreq = (ch) => `${(518 + (ch ?? 1) * 0.6).toFixed(3)} MHz`;
function drawTxLcd(ctx, W, H, { power, tx, sig }) {
  ctx.fillStyle = power ? '#0b2a3b' : '#05070a'; ctx.fillRect(0, 0, W, H);
  if (!power) return;
  ctx.fillStyle = '#7dd3fc'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `800 ${Math.round(H * 0.42)}px ${FONT}`; ctx.fillText(`TX CH ${tx}`, W * 0.05, H * 0.32);
  ctx.font = `700 ${Math.round(H * 0.3)}px ${FONT}`; ctx.fillText(iemFreq(tx), W * 0.05, H * 0.75);
  // 오디오 레벨 막대
  for (let i = 0; i < 6; i += 1) { ctx.fillStyle = sig && i < 4 ? '#4ade80' : '#1e3a4a'; ctx.fillRect(W * (0.78 + i * 0.035), H * (0.8 - i * 0.1), W * 0.025, H * (0.1 + i * 0.1)); }
}
function drawPackLcd(ctx, W, H, { power, rx, ok, volume }) {
  ctx.fillStyle = power ? (ok ? '#0b2a3b' : '#3b0b0b') : '#05070a'; ctx.fillRect(0, 0, W, H);
  if (!power) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ok ? '#7dd3fc' : '#fca5a5';
  ctx.font = `800 ${Math.round(H * 0.3)}px ${FONT}`; ctx.fillText(`RX CH ${rx}`, W / 2, H * 0.24);
  ctx.font = `700 ${Math.round(H * 0.2)}px ${FONT}`; ctx.fillText(ok ? 'RF ▮▮▮▮' : 'NO RF', W / 2, H * 0.55);
  ctx.fillText(`VOL ${volume}`, W / 2, H * 0.82);
}
// sig: 송신기에 신호가 들어오는지
export function IemModel({ power, txChannel = 1, rxChannel = 1, volume = 75, sig }) {
  const ok = !!power && txChannel === rxChannel;
  const txLcd = useCanvasTexture(320, 96, (ctx, W, H) => drawTxLcd(ctx, W, H, { power, tx: txChannel, sig }), [power, txChannel, sig]);
  const packLcd = useCanvasTexture(160, 128, (ctx, W, H) => drawPackLcd(ctx, W, H, { power, rx: rxChannel, ok, volume }), [power, rxChannel, ok, volume]);
  const panel = useCanvasTexture(512, 106, (ctx, W, H) => {
    ctx.fillStyle = '#20252d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f8fafc'; ctx.font = `800 ${Math.round(H * 0.2)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('IEM TRANSMITTER', W * 0.04, H * 0.84);
    ctx.textAlign = 'center'; ctx.fillStyle = '#cbd5e1'; ctx.font = `700 ${Math.round(H * 0.15)}px ${FONT}`;
    ctx.fillText('SET  ▲  ▼', W * 0.69, H * 0.82); ctx.fillText('POWER', W * 0.9, H * 0.82);
  }, []);
  return (
    <group>
      {/* 송신기 (하프랙) */}
      <group position={[IEM_TX.x, 0, 0]}>
        <mesh castShadow receiveShadow position={[0, IEM_TX.h / 2, 0]}><boxGeometry args={[IEM_TX.w, IEM_TX.h, IEM_TX.d]} /><meshStandardMaterial color="#262b33" metalness={0.5} roughness={0.45} /></mesh>
        <mesh {...NR} position={[0, IEM_TX.h / 2, IEM_TX.d / 2 + 0.0008]}><planeGeometry args={[IEM_TX.w, IEM_TX.h]} /><meshStandardMaterial map={panel} roughness={0.6} /></mesh>
        <mesh {...NR} position={[-0.045, 0.026, IEM_TX.d / 2 + 0.0016]}><planeGeometry args={[0.09, 0.027]} /><meshBasicMaterial map={txLcd} toneMapped={false} /></mesh>
        {[0.03, 0.045, 0.06].map((x) => <mesh {...NR} key={x} position={[x, 0.026, IEM_TX.d / 2 + 0.003]}><boxGeometry args={[0.01, 0.008, 0.005]} /><meshStandardMaterial color="#4b5563" /></mesh>)}
        <mesh {...NR} position={[0.086, 0.026, IEM_TX.d / 2 + 0.004]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.007, 0.007, 0.007, 16]} /><meshStandardMaterial color={power ? '#22c55e' : '#3f3f46'} emissive={power ? '#22c55e' : '#000'} emissiveIntensity={power ? 0.6 : 0} /></mesh>
        {/* 뒷면 안테나 (BNC + 고무 안테나) */}
        <mesh {...NR} position={[0.075, IEM_TX.h - 0.006, -IEM_TX.d / 2 - 0.006]}><cylinderGeometry args={[0.005, 0.005, 0.014, 12]} /><meshStandardMaterial color="#c9d0d8" metalness={0.9} roughness={0.25} /></mesh>
        <mesh {...NR} position={[0.075, IEM_TX.h + 0.085, -IEM_TX.d / 2 - 0.006]} castShadow><cylinderGeometry args={[0.0045, 0.006, 0.17, 10]} /><meshStandardMaterial color="#0f1115" roughness={0.8} /></mesh>
      </group>
      {/* 벨트팩 수신기 (연주자가 허리에 차는 것) */}
      <group position={[IEM_PACK.x, 0, IEM_PACK.z]} rotation={[0, -0.25, 0]}>
        <RoundedBox args={[IEM_PACK.w, IEM_PACK.h, IEM_PACK.d]} radius={0.006} position={[0, IEM_PACK.h / 2, 0]} castShadow><meshStandardMaterial color="#1b1e23" roughness={0.6} metalness={0.3} /></RoundedBox>
        <mesh {...NR} position={[0, 0.058, IEM_PACK.d / 2 + 0.0008]}><planeGeometry args={[0.048, 0.038]} /><meshBasicMaterial map={packLcd} toneMapped={false} /></mesh>
        <Lamp position={[-0.02, 0.024, IEM_PACK.d / 2 + 0.001]} on={ok} color="#22c55e" size={[0.006, 0.006, 0.003]} offColor="#14181d" />
        <Knob position={[0.016, IEM_PACK.h + 0.004, 0]} value={volume} min={0} max={100} color="#e5e7eb" size={0.007} />
        <mesh {...NR} position={[-0.02, IEM_PACK.h + 0.03, 0]}><cylinderGeometry args={[0.003, 0.004, 0.06, 8]} /><meshStandardMaterial color="#0f1115" /></mesh>
        {/* 이어폰 줄 + 이어폰 두 개 */}
        <mesh {...NR} position={[0.06, 0.004, 0.03]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.028, 0.0018, 6, 32]} /><meshStandardMaterial color="#0f1115" /></mesh>
        {[-1, 1].map((sx) => <mesh {...NR} key={sx} position={[0.06 + sx * 0.012, 0.007, 0.065]}><sphereGeometry args={[0.0065, 12, 8]} /><meshStandardMaterial color={sx < 0 ? '#2563eb' : '#dc2626'} roughness={0.4} /></mesh>)}
      </group>
    </group>
  );
}

export const PORTS_AMP = {
  power_amp: {
    inA: { p: [AMP_IN_X.inA, REAR_Y, -AMP.d / 2 - 0.002], n: REAR_N },
    inB: { p: [AMP_IN_X.inB, REAR_Y, -AMP.d / 2 - 0.002], n: REAR_N },
    spkA: { p: [AMP_OUT_X.spkA, REAR_Y, -AMP.d / 2 - 0.002], n: REAR_N },
    spkB: { p: [AMP_OUT_X.spkB, REAR_Y, -AMP.d / 2 - 0.002], n: REAR_N },
  },
  passive_speaker: { spk: { p: [-0.172, 1.33, -0.04], n: [-1, -0.2, 0] } },
  iem: { in: { p: [IEM_TX.x - 0.04, IEM_TX.h - 0.01, -IEM_TX.d / 2 - 0.002], n: REAR_N } },
};
export const GHOST_AMP = { power_amp: [0.5, 0.11, 0.34], passive_speaker: [0.5, 1.75, 0.5], iem: [0.42, 0.24, 0.24] };
export const FOCUS_AMP = { power_amp: { y: 0.05, dist: 0.8 }, passive_speaker: { y: 1.3, dist: 1.8 }, iem: { y: 0.06, dist: 0.6 } };
export const SELECT_RADIUS_AMP = { power_amp: 0.3, passive_speaker: 0.42, iem: 0.24 };
// 유령 손이 누를 곳 (장비 로컬): 앰프 레벨 노브·전원 / IEM 송신기 채널·전원, 벨트팩 채널·볼륨
export const POINT_AMP = {
  power_amp: (c) => (c.key === 'levelA' ? [AMP_KNOB.A[0], AMP_KNOB.A[1], AMP.d / 2 + 0.02] : c.key === 'levelB' ? [AMP_KNOB.B[0], AMP_KNOB.B[1], AMP.d / 2 + 0.02] : [AMP_POWER[0], AMP_POWER[1], AMP.d / 2 + 0.015]),
  passive_speaker: () => [-0.18, 1.33, -0.04],
  iem: (c) => (c.key === 'rxChannel' || c.key === 'volume' ? [IEM_PACK.x, IEM_PACK.h + 0.01, IEM_PACK.z] : c.key === 'power' ? [IEM_TX.x + 0.086, 0.026, IEM_TX.d / 2 + 0.01] : [IEM_TX.x + 0.045, 0.026, IEM_TX.d / 2 + 0.01]),
};
export const AMP_TYPES = new Set(Object.keys(PORTS_AMP));
