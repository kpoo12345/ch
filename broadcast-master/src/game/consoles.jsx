import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { Fader, Lamp, LedMeter, useCanvasTexture, FONT } from './kit3d.jsx';

/* =====================================================================
 * 8채널 믹서 3D 모델 (아날로그 / 디지털)
 * 채널마다 GAIN·LOW CUT·EQ·FX·AUX·MUTE·페이더가 게임 상태를 그대로 보여 주고,
 * 값이 바뀌면 노브와 페이더가 부드럽게 움직인다.
 * 원점 = 책상 위 접점 중심, 조작면(페이더)은 +z(조작자) 쪽, 입력 단자는 뒤쪽(-z).
 * ===================================================================== */

export const CONSOLE_CHANNELS = 8;
export const CH_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#22d3ee', '#94a3b8'];

// 값이 바뀌면 목표 각도로 부드럽게 돌아가는 노브
export function SmoothKnob({ position, value = 0, min = -1, max = 1, color = '#d1d5db', size = 0.012, axis = 'y' }) {
  const g = useRef();
  const target = ((value - min) / (max - min) - 0.5) * 1.5 * Math.PI;
  useFrame((_, dt) => {
    if (!g.current) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    g.current.rotation.y += (-target - g.current.rotation.y) * k;
  });
  return (
    <group position={position} rotation={axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <group ref={g}>
        <mesh castShadow><cylinderGeometry args={[size, size * 1.15, size * 1.3, 20]} /><meshStandardMaterial color="#111317" roughness={0.55} /></mesh>
        <mesh position={[0, size * 0.66, 0]}><cylinderGeometry args={[size * 0.82, size * 0.82, 0.002, 20]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
        <mesh position={[0, size * 0.7, -size * 0.45]}><boxGeometry args={[size * 0.2, 0.002, size * 0.85]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} /></mesh>
      </group>
    </group>
  );
}

// 눌리는 버튼 (켜지면 불이 들어오고 살짝 눌린다)
function Btn({ position, on, color, size = [0.018, 0.007, 0.012], offColor = '#3a3f47' }) {
  return (
    <mesh position={[position[0], position[1] - (on ? 0.002 : 0), position[2]]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={on ? color : offColor} emissive={on ? color : '#000000'} emissiveIntensity={on ? 1.8 : 0} roughness={0.4} />
    </mesh>
  );
}

function Socket({ position, kind = 'combo' }) {
  const r = kind === 'trs' ? 0.011 : kind === 'usb' ? 0.008 : 0.016;
  return (
    <group position={position} rotation={[-0.71, 0, 0]}>
      <mesh><cylinderGeometry args={[r, r, 0.012, 18]} /><meshStandardMaterial color="#050608" /></mesh>
      <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r + 0.002, 0.0026, 8, 20]} /><meshStandardMaterial color="#64748b" /></mesh>
    </group>
  );
}

/* ---------------------------- 아날로그 콘솔 ---------------------------- */
const A = {
  pitch: 0.055, top: 0.071, depth: 0.5,
  z: { phantom: -0.192, gain: -0.165, lowCut: -0.139, eqHigh: -0.114, eqMid: -0.09, eqLow: -0.066, aux: -0.04, fx: -0.015, mute: 0.017, fader: 0.13, tape: 0.226 },
  faderLen: 0.15,
};
A.W = CONSOLE_CHANNELS * A.pitch + 0.19;
A.x = (i) => -A.W / 2 + 0.02 + A.pitch / 2 + i * A.pitch;
A.mx = { main: A.W / 2 - 0.14, aux1: A.W / 2 - 0.09, phones: A.W / 2 - 0.04 };

/* ---------------------------- 디지털 콘솔 ---------------------------- */
const D = {
  W: 0.86, depth: 0.56, top: 0.091, rail: 0.166,
  x: (i) => -0.355 + i * 0.07,
  z: { scribble: -0.122, sel: -0.094, mute: 0.022, fader: 0.15 },
  faderLen: 0.17,
  // 선택 채널 섹션 (뒤쪽 높은 판 위)
  sel: { phantom: -0.395, gain: -0.355, lowCut: -0.315, eqHigh: -0.275, eqMid: -0.24, eqLow: -0.205, fx: -0.165, aux: -0.125 },
  selZ: -0.205,
  masterX: 0.335,
  inX: (k) => -0.385 + (k - 1) * 0.056,
  outX: { main: 0.13, aux1: 0.19, usb: 0.27 },
};

// 단자 위치 (장비 기준 로컬 좌표) — 공연장 3D와 교육 뷰어가 함께 쓴다
export const CONSOLE_PORTS = {
  analog_mixer: {
    ...Object.fromEntries(Array.from({ length: CONSOLE_CHANNELS }, (_, i) => [`in${i + 1}`, { p: [A.x(i), 0.12, -0.24], n: [0, 0.75, -0.65] }])),
    main: { p: [A.mx.main, 0.12, -0.24], n: [0, 0.75, -0.65] },
    aux1: { p: [A.mx.aux1, 0.12, -0.24], n: [0, 0.75, -0.65] },
    phones: { p: [A.mx.phones, 0.12, -0.24], n: [0, 0.75, -0.65] },
  },
  digital_mixer: {
    ...Object.fromEntries(Array.from({ length: CONSOLE_CHANNELS }, (_, i) => [`local${i + 1}`, { p: [D.inX(i + 1), D.rail, -0.272], n: [0, 0.75, -0.65] }])),
    main: { p: [D.outX.main, D.rail, -0.272], n: [0, 0.75, -0.65] },
    aux1: { p: [D.outX.aux1, D.rail, -0.272], n: [0, 0.75, -0.65] },
    usb: { p: [D.outX.usb, D.rail, -0.272], n: [0, 0.75, -0.65] },
  },
};
export const CONSOLE_SIZE = { analog_mixer: [A.W + 0.05, 0.13, A.depth], digital_mixer: [D.W, 0.18, D.depth] };

// 조작 손이 향할 위치 (로컬 좌표). key: gain/lowCut/eqHigh/.../fader/mute/phantom/select, 또는 master.*
export function consoleControl(type, key, ch, value) {
  if (type === 'analog_mixer') {
    if (key === 'mainFader') return [A.mx.aux1 - 0.012, A.top + 0.012, A.z.fader + A.faderLen / 2 - ((value ?? 75) / 100) * A.faderLen];
    if (key === 'mainMute') return [A.mx.aux1, A.top + 0.01, A.z.mute];
    if (key === 'auxMaster') return [A.mx.main + 0.005, A.top + 0.015, A.z.gain];
    if (key === 'fxReturn') return [A.mx.phones - 0.005, A.top + 0.015, A.z.gain];
    const x = A.x((ch ?? 1) - 1);
    if (key === 'fader') return [x, A.top + 0.012, A.z.fader + A.faderLen / 2 - ((value ?? 75) / 100) * A.faderLen];
    if (key === 'select') return [x, A.top + 0.01, A.z.tape];
    return [x, A.top + 0.015, A.z[key] ?? A.z.gain];
  }
  if (key === 'mainFader') return [D.masterX, D.top + 0.012, D.z.fader + D.faderLen / 2 - ((value ?? 75) / 100) * D.faderLen];
  if (key === 'mainMute') return [D.masterX, D.top + 0.01, D.z.mute];
  if (key === 'auxMaster' || key === 'fxReturn' || key === 'usbOut') return [0.1, 0.13, -0.15];
  const x = D.x((ch ?? 1) - 1);
  if (key === 'fader') return [x, D.top + 0.012, D.z.fader + D.faderLen / 2 - ((value ?? 75) / 100) * D.faderLen];
  if (key === 'mute') return [x, D.top + 0.01, D.z.mute];
  if (key === 'select' || key === 'patch') return [x, D.top + 0.01, D.z.sel];
  if (D.sel[key] != null) return [D.sel[key], D.rail + 0.012, D.selZ];
  return [x, D.top + 0.01, D.z.sel];
}

// 채널 이름표 텍스처 (아날로그: 마스킹 테이프 / 디지털: 컬러 스크리블 스트립)
function useNameStrip(names, style, mutes) {
  return useCanvasTexture(1024, 64, (ctx, w, h) => {
    const cw = w / CONSOLE_CHANNELS;
    names.forEach((n, i) => {
      const x = i * cw;
      if (style === 'tape') {
        ctx.fillStyle = '#efe6cf'; ctx.fillRect(x + 4, 6, cw - 8, h - 12);
        ctx.fillStyle = '#1f2937'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n || '—', x + cw / 2, h / 2 + 1, cw - 14);
      } else {
        const c = CH_COLORS[i];
        ctx.fillStyle = mutes?.[i] ? '#111827' : c; ctx.fillRect(x + 3, 3, cw - 6, h - 6);
        ctx.fillStyle = mutes?.[i] ? c : '#0b0d10'; ctx.font = `800 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n || `CH ${String(i + 1).padStart(2, '0')}`, x + cw / 2, h / 2 + 1, cw - 12);
      }
    });
  }, [names.join('|'), style, (mutes ?? []).join()]);
}

export function AnalogConsole({ channels, master, meters, names }) {
  const tape = useNameStrip(names, 'tape');
  const { W } = A;
  return (
    <group>
      <RoundedBox args={[W, 0.07, A.depth]} radius={0.012} position={[0, 0.035, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2e333b" roughness={0.6} metalness={0.2} />
      </RoundedBox>
      {[-W / 2 - 0.012, W / 2 + 0.012].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]} castShadow><boxGeometry args={[0.025, 0.085, A.depth + 0.01]} /><meshStandardMaterial color="#3a2a1f" roughness={0.8} /></mesh>
      ))}
      {/* 뒤쪽 단자 레일 */}
      <mesh position={[0, 0.095, -0.225]} castShadow><boxGeometry args={[W - 0.02, 0.05, 0.05]} /><meshStandardMaterial color="#1a1d22" /></mesh>
      {Array.from({ length: CONSOLE_CHANNELS }, (_, i) => <Socket key={i} position={[A.x(i), 0.12, -0.24]} />)}
      <Socket position={[A.mx.main, 0.12, -0.24]} kind="xlr" />
      <Socket position={[A.mx.aux1, 0.12, -0.24]} kind="trs" />
      <Socket position={[A.mx.phones, 0.12, -0.24]} kind="trs" />
      {/* 채널 구분선 */}
      {Array.from({ length: CONSOLE_CHANNELS + 1 }, (_, i) => (
        <mesh key={`l${i}`} position={[A.x(i) - A.pitch / 2, A.top + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.0012, A.depth - 0.06]} /><meshBasicMaterial color="#4b5563" />
        </mesh>
      ))}
      {channels.map((ch, i) => {
        const x = A.x(i);
        const lv = meters?.ch?.[i];
        return (
          <group key={i} position={[x, A.top, 0]}>
            <Btn position={[0, 0.003, A.z.phantom]} on={ch.phantom} color="#f59e0b" size={[0.014, 0.006, 0.009]} />
            <SmoothKnob position={[0, 0, A.z.gain]} value={ch.gain} min={0} max={60} color="#ef4444" size={0.0125} />
            <Lamp position={[0.021, 0.003, A.z.gain]} on={lv != null} color={lv != null && lv > 0 ? '#ef4444' : lv != null && lv > -6 ? '#facc15' : '#22c55e'} size={[0.006, 0.004, 0.006]} offColor="#15181d" />
            <Btn position={[0, 0.003, A.z.lowCut]} on={ch.lowCut} color="#22d3ee" size={[0.016, 0.006, 0.009]} />
            <SmoothKnob position={[0, 0, A.z.eqHigh]} value={ch.eqHigh} min={-15} max={15} color="#60a5fa" size={0.0105} />
            <SmoothKnob position={[0, 0, A.z.eqMid]} value={ch.eqMid} min={-15} max={15} color="#34d399" size={0.0105} />
            <SmoothKnob position={[0, 0, A.z.eqLow]} value={ch.eqLow} min={-15} max={15} color="#fbbf24" size={0.0105} />
            <SmoothKnob position={[0, 0, A.z.aux]} value={ch.aux} min={0} max={100} color="#c084fc" size={0.0105} />
            <SmoothKnob position={[0, 0, A.z.fx]} value={ch.fx} min={0} max={100} color="#2dd4bf" size={0.0105} />
            <Btn position={[0, 0.004, A.z.mute]} on={ch.mute} color="#ef4444" size={[0.024, 0.008, 0.014]} offColor="#40454d" />
            <Fader position={[0, 0.002, A.z.fader]} value={ch.fader} length={A.faderLen} />
          </group>
        );
      })}
      {/* 이름표 테이프 */}
      <mesh position={[(A.x(0) + A.x(CONSOLE_CHANNELS - 1)) / 2, A.top + 0.001, A.z.tape]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CONSOLE_CHANNELS * A.pitch, 0.022]} /><meshBasicMaterial map={tape} toneMapped={false} />
      </mesh>
      {/* 마스터 섹션 */}
      <group position={[0, A.top, 0]}>
        <SmoothKnob position={[A.mx.main + 0.005, 0, A.z.gain]} value={master.auxMaster} min={0} max={100} color="#c084fc" size={0.011} />
        <SmoothKnob position={[A.mx.phones - 0.005, 0, A.z.gain]} value={master.fxReturn} min={0} max={100} color="#2dd4bf" size={0.011} />
        <LedMeter position={[A.mx.main - 0.01, 0.003, -0.005]} level={meters?.main} step={0.009} />
        <LedMeter position={[A.mx.main + 0.005, 0.003, -0.005]} level={meters?.main == null ? null : meters.main - 1.5} step={0.009} />
        <LedMeter position={[A.mx.phones, 0.003, -0.005]} level={meters?.aux} step={0.009} />
        <Btn position={[A.mx.aux1, 0.004, A.z.mute]} on={master.mainMute} color="#ef4444" size={[0.03, 0.008, 0.014]} offColor="#40454d" />
        <Fader position={[A.mx.aux1 - 0.018, 0.002, A.z.fader]} value={master.mainFader} length={A.faderLen} color="#f87171" />
        <Fader position={[A.mx.aux1 + 0.012, 0.002, A.z.fader]} value={master.mainFader} length={A.faderLen} color="#f87171" />
        <Lamp position={[A.mx.phones + 0.01, 0.003, A.z.tape]} on color="#22c55e" size={[0.008, 0.005, 0.008]} />
      </group>
    </group>
  );
}

// 디지털 믹서 화면: 선택한 채널의 설정과 라우팅
function drawDigitalScreen(ctx, w, h, { ch, idx, name, level, usbOut, mainLevel }) {
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h);
  const c = CH_COLORS[idx] ?? '#38bdf8';
  ctx.fillStyle = c; ctx.fillRect(0, 0, w, 46);
  ctx.fillStyle = '#05070a'; ctx.font = `800 30px ${FONT}`;
  ctx.fillText(`CH ${String(idx + 1).padStart(2, '0')}  ${name || ''}`, 16, 34);
  const patch = ch.patch ?? `local${idx + 1}`;
  const rows = [
    ['입력', patch === 'off' ? 'OFF' : `Local ${patch.replace('local', '')}`, patch !== 'off'],
    ['GAIN', `${ch.gain > 0 ? '+' : ''}${ch.gain} dB`, true],
    ['+48V', ch.phantom ? 'ON' : 'OFF', true],
    ['LOW CUT', ch.lowCut ? '100Hz' : 'OFF', true],
  ];
  rows.forEach(([k, v, ok], i) => {
    const y = 84 + i * 40;
    ctx.fillStyle = '#94a3b8'; ctx.font = `500 24px ${FONT}`; ctx.fillText(k, 16, y);
    ctx.fillStyle = ok ? '#e2e8f0' : '#f87171'; ctx.font = `700 26px ${FONT}`; ctx.fillText(v, 130, y);
  });
  // EQ 곡선
  const ex = 330, ey = 60, ew = 330, eh = 150;
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.strokeRect(ex, ey, ew, eh);
  ctx.beginPath(); ctx.moveTo(ex, ey + eh / 2); ctx.lineTo(ex + ew, ey + eh / 2); ctx.stroke();
  ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const t = i / 60;
    let g = ch.eqLow * Math.exp(-((t - 0.1) ** 2) / 0.03) + ch.eqMid * Math.exp(-((t - 0.5) ** 2) / 0.02) + ch.eqHigh * Math.exp(-((t - 0.9) ** 2) / 0.03);
    if (ch.lowCut) g -= 18 * Math.max(0, 1 - t / 0.18) ** 2;
    const y = ey + eh / 2 - (g / 18) * (eh / 2);
    if (i === 0) ctx.moveTo(ex + t * ew, y); else ctx.lineTo(ex + t * ew, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#64748b'; ctx.font = `500 18px ${FONT}`; ctx.fillText('LOW', ex + 6, ey + eh + 22); ctx.fillText('MID', ex + ew / 2 - 16, ey + eh + 22); ctx.fillText('HIGH', ex + ew - 46, ey + eh + 22);
  // 센드
  ctx.fillStyle = '#94a3b8'; ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`FX ${ch.fx}`, 690, 84); ctx.fillText(`AUX ${ch.aux}`, 690, 124);
  ctx.fillText(`USB → ${usbOut === 'main' ? 'Main L/R' : usbOut === 'aux1' ? 'Bus 1' : 'OFF'}`, 690, 164);
  const bar = (y, lv) => {
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(690, y, 300, 18);
    if (lv == null) return;
    const p = Math.max(0, Math.min(1, (lv + 60) / 66));
    ctx.fillStyle = lv > 0 ? '#ef4444' : lv > -6 ? '#eab308' : '#22c55e'; ctx.fillRect(690, y, 300 * p, 18);
  };
  bar(190, level); bar(222, mainLevel);
  ctx.fillStyle = '#64748b'; ctx.font = `500 16px ${FONT}`; ctx.fillText('IN', 660, 205); ctx.fillText('MAIN', 640, 237);
  if (ch.mute) { ctx.fillStyle = '#dc2626'; ctx.fillRect(w - 150, 6, 140, 34); ctx.fillStyle = '#fff'; ctx.font = `800 24px ${FONT}`; ctx.fillText('MUTE', w - 122, 32); }
}

export function DigitalConsole({ channels, master, meters, names, selected = 0 }) {
  const mutes = channels.map((c) => c.mute);
  const scribble = useNameStrip(names, 'scribble', mutes);
  const sel = channels[selected] ?? channels[0];
  const selLv = meters?.ch?.[selected];
  const screen = useCanvasTexture(1024, 256, (ctx, w, h) => drawDigitalScreen(ctx, w, h, {
    ch: sel, idx: selected, name: names[selected], level: selLv, usbOut: master.usbOut, mainLevel: meters?.main,
  }), [JSON.stringify(sel), selected, names[selected], master.usbOut, Math.round((selLv ?? -99) / 3), Math.round((meters?.main ?? -99) / 3)]);
  return (
    <group>
      <RoundedBox args={[D.W, 0.09, D.depth]} radius={0.015} position={[0, 0.045, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1d2026" roughness={0.55} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0.125, -0.215]} castShadow><boxGeometry args={[D.W, 0.08, 0.13]} /><meshStandardMaterial color="#23272e" roughness={0.5} /></mesh>
      {Array.from({ length: CONSOLE_CHANNELS }, (_, k) => <Socket key={k} position={[D.inX(k + 1), D.rail, -0.272]} kind="xlr" />)}
      <Socket position={[D.outX.main, D.rail, -0.272]} kind="xlr" />
      <Socket position={[D.outX.aux1, D.rail, -0.272]} kind="xlr" />
      <Socket position={[D.outX.usb, D.rail, -0.272]} kind="usb" />
      {/* 화면 */}
      <mesh position={[0.17, 0.128, -0.149]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.3, 0.075]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* 선택 채널 섹션: 디지털 믹서는 채널을 선택(SEL)한 뒤 이 노브들로 설정한다 */}
      <group position={[0, D.rail, D.selZ]}>
        <Btn position={[D.sel.phantom, 0.003, 0]} on={sel.phantom} color="#f59e0b" size={[0.022, 0.006, 0.014]} />
        <SmoothKnob position={[D.sel.gain, 0, 0]} value={sel.gain} min={0} max={60} color="#ef4444" size={0.013} />
        <Btn position={[D.sel.lowCut, 0.003, 0]} on={sel.lowCut} color="#22d3ee" size={[0.022, 0.006, 0.014]} />
        <SmoothKnob position={[D.sel.eqHigh, 0, 0]} value={sel.eqHigh} min={-15} max={15} color="#60a5fa" size={0.012} />
        <SmoothKnob position={[D.sel.eqMid, 0, 0]} value={sel.eqMid} min={-15} max={15} color="#34d399" size={0.012} />
        <SmoothKnob position={[D.sel.eqLow, 0, 0]} value={sel.eqLow} min={-15} max={15} color="#fbbf24" size={0.012} />
        <SmoothKnob position={[D.sel.fx, 0, 0]} value={sel.fx} min={0} max={100} color="#2dd4bf" size={0.012} />
        <SmoothKnob position={[D.sel.aux, 0, 0]} value={sel.aux} min={0} max={100} color="#c084fc" size={0.012} />
      </group>
      {/* 스크리블 스트립 */}
      <mesh position={[(D.x(0) + D.x(CONSOLE_CHANNELS - 1)) / 2, D.top + 0.001, D.z.scribble]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CONSOLE_CHANNELS * 0.07, 0.026]} /><meshBasicMaterial map={scribble} toneMapped={false} />
      </mesh>
      {channels.map((ch, i) => {
        const lv = meters?.ch?.[i];
        return (
          <group key={i} position={[D.x(i), D.top, 0]}>
            <Btn position={[0, 0.003, D.z.sel]} on={i === selected} color="#38bdf8" size={[0.03, 0.007, 0.014]} />
            <LedMeter position={[0.024, 0.003, 0.0]} level={lv} step={0.0075} />
            <Btn position={[0, 0.004, D.z.mute]} on={ch.mute} color="#ef4444" size={[0.03, 0.008, 0.015]} />
            <Fader position={[0, 0.002, D.z.fader]} value={ch.fader} length={D.faderLen} />
          </group>
        );
      })}
      <group position={[D.masterX, D.top, 0]}>
        <mesh position={[0, 0.001, D.z.scribble]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.06, 0.024]} /><meshBasicMaterial color="#f8fafc" toneMapped={false} /></mesh>
        <LedMeter position={[-0.024, 0.003, 0.0]} level={meters?.main} step={0.0075} />
        <LedMeter position={[0.024, 0.003, 0.0]} level={meters?.main == null ? null : meters.main - 1.2} step={0.0075} />
        <Btn position={[0, 0.004, D.z.mute]} on={master.mainMute} color="#ef4444" size={[0.034, 0.008, 0.015]} />
        <Fader position={[0, 0.002, D.z.fader]} value={master.mainFader} length={D.faderLen} color="#f87171" />
      </group>
      <group position={[0.235, D.top, 0]}>
        <SmoothKnob position={[0, 0, -0.09]} value={master.auxMaster} min={0} max={100} color="#c084fc" size={0.012} />
        <SmoothKnob position={[0, 0, -0.04]} value={master.fxReturn} min={0} max={100} color="#2dd4bf" size={0.012} />
        <LedMeter position={[0.03, 0.003, 0.0]} level={meters?.aux} step={0.0075} />
        <Lamp position={[0, 0.003, 0.03]} on={master.usbOut !== 'off'} color="#4ade80" size={[0.02, 0.006, 0.012]} />
      </group>
    </group>
  );
}

// 교육 뷰어 등에서 1채널 상태만 있을 때 8채널 배열로 바꿔 준다
export function demoChannels(first, n = CONSOLE_CHANNELS) {
  const decor = [0, 62, 55, 0, 70, 48, 0, 66];
  return Array.from({ length: n }, (_, i) => (i === 0 ? first : {
    gain: 18 + ((i * 7) % 20), lowCut: i % 3 === 1, eqHigh: 0, eqMid: 0, eqLow: 0, fx: i % 2 ? 20 : 0, aux: i % 4 === 1 ? 40 : 0, mute: false, fader: decor[i], phantom: false, patch: null,
  }));
}

