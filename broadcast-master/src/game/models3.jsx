import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { noRaycast, Lamp, Fader, useCanvasTexture } from './kit3d.jsx';
import { SmoothKnob } from './consoles.jsx';
import { FONT, CLIPS } from './scenes.js';

/* =====================================================================
 * 조명 · 영상 장비 3D 모델
 *  - 조명기는 트러스에 매달린다: 원점 = 클램프(위), 몸체는 아래로
 *  - 빔(빛줄기)은 투명 원뿔 + (밝을 때) 실제 스포트라이트
 * ===================================================================== */

const NR = { raycast: noRaycast };
const DEG = Math.PI / 180;

/* ---------------------------- 빔 ---------------------------- */
export function Beam({ color = '#ffffff', intensity = 0, flicker = false, length = 3.2, radius = 0.6, light = true }) {
  const mat = useRef();
  const spot = useRef();
  const tgt = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const f = flicker ? (Math.sin(clock.elapsedTime * 37) > 0.2 ? 1 : 0.15) * (0.6 + Math.random() * 0.4) : 1;
    if (mat.current) mat.current.opacity = Math.min(0.32, 0.2 * intensity * f);
    if (spot.current) spot.current.intensity = 26 * intensity * f;
  });
  if (intensity <= 0.01) return null;
  return (
    <group>
      <mesh {...NR} position={[0, -length / 2, 0]}>
        <cylinderGeometry args={[0.04, radius, length, 24, 1, true]} />
        <meshBasicMaterial ref={mat} color={color} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {light && (
        <>
          <primitive object={tgt} position={[0, -length, 0]} />
          <spotLight ref={spot} color={color} angle={Math.atan2(radius, length) * 1.25} penumbra={0.5} distance={length * 2.2} decay={1.3} target={tgt} />
        </>
      )}
    </group>
  );
}

/* ---------------------------- LED 파 ---------------------------- */
// aimTilt: 수직(아래)에서 앞(+z)쪽으로 기울인 각도(rad)
export function ParLedModel({ intensity = 0, color = '#ffffff', flicker, power = true, aimTilt = 0.6, terminated, beamLength = 3.5, light = true }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.06, 0.05, 0.08]} /><meshStandardMaterial color="#111" metalness={0.6} /></mesh>
      <mesh position={[0, -0.05, 0]}><boxGeometry args={[0.24, 0.015, 0.05]} /><meshStandardMaterial color="#1c1f24" metalness={0.5} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.115, -0.15, 0]}><boxGeometry args={[0.012, 0.2, 0.05]} /><meshStandardMaterial color="#1c1f24" metalness={0.5} /></mesh>)}
      {/* DMX 단자 패널 (요크 뒤) */}
      <mesh position={[0, -0.075, -0.03]}><boxGeometry args={[0.12, 0.04, 0.012]} /><meshStandardMaterial color="#0b0d10" /></mesh>
      <Lamp position={[0.05, -0.065, -0.037]} on={power} color="#22c55e" size={[0.008, 0.006, 0.003]} />
      {terminated && <mesh position={[0.035, -0.085, -0.05]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.009, 0.009, 0.03, 10]} /><meshStandardMaterial color="#a3e635" /></mesh>}
      <group position={[0, -0.2, 0]} rotation={[-aimTilt, 0, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.1, 0.09, 0.22, 24]} /><meshStandardMaterial color="#1a1c20" metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0, -0.111, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.085, 24]} />
          <meshBasicMaterial color={intensity > 0.02 ? color : '#1f2937'} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <group position={[0, -0.12, 0]}><Beam color={color} intensity={intensity} flicker={flicker} length={beamLength} radius={0.75} light={light} /></group>
      </group>
    </group>
  );
}

/* ---------------------------- 무빙 헤드 ---------------------------- */
export function MovingHeadModel({ intensity = 0, color = '#ffffff', pan = 0, tilt = 0, flicker, power = true, terminated, aimTilt = 0.4, beamLength = 3.6, light = true }) {
  const yoke = useRef();
  const head = useRef();
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
    if (yoke.current) yoke.current.rotation.y += (pan * DEG - yoke.current.rotation.y) * k;
    if (head.current) head.current.rotation.x += (-(aimTilt + tilt * DEG) - head.current.rotation.x) * k;
  });
  return (
    <group>
      <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.06, 0.05, 0.08]} /><meshStandardMaterial color="#111" metalness={0.6} /></mesh>
      <RoundedBox args={[0.32, 0.12, 0.26]} radius={0.02} position={[0, -0.07, 0]} castShadow>
        <meshStandardMaterial color="#1b1d22" metalness={0.4} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0.06, -0.07, 0.131]}><planeGeometry args={[0.08, 0.04]} /><meshBasicMaterial color={power ? '#0ea5e9' : '#0f172a'} toneMapped={false} /></mesh>
      <mesh position={[0, -0.07, -0.131]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.16, 0.05]} /><meshStandardMaterial color="#0b0d10" /></mesh>
      {terminated && <mesh position={[0.04, -0.07, -0.15]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.009, 0.009, 0.03, 10]} /><meshStandardMaterial color="#a3e635" /></mesh>}
      <group ref={yoke} position={[0, -0.13, 0]}>
        <mesh position={[0, -0.01, 0]}><cylinderGeometry args={[0.07, 0.07, 0.02, 20]} /><meshStandardMaterial color="#25282e" /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.13, -0.12, 0]} castShadow><boxGeometry args={[0.03, 0.22, 0.09]} /><meshStandardMaterial color="#1b1d22" metalness={0.4} /></mesh>)}
        <group ref={head} position={[0, -0.2, 0]}>
          <mesh castShadow rotation={[0, 0, 0]}><cylinderGeometry args={[0.1, 0.11, 0.26, 24]} /><meshStandardMaterial color="#202329" metalness={0.4} roughness={0.35} /></mesh>
          <mesh position={[0, -0.131, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.075, 24]} />
            <meshBasicMaterial color={intensity > 0.02 ? color : '#111827'} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <group position={[0, -0.14, 0]}><Beam color={color} intensity={intensity} flicker={flicker} length={beamLength} radius={0.32} light={light} /></group>
        </group>
      </group>
    </group>
  );
}

/* ---------------------------- 조명 콘솔 (Tiger Touch) ---------------------------- */
const TT = { pbX: (i) => -0.4 + i * 0.062, pbZ: 0.17, pbLen: 0.12, selX: (n) => -0.4 + (n - 1) * 0.062, selZ: 0.035, gmX: 0.42, boX: 0.42, boZ: 0.0, recX: 0.3, recZ: -0.02, encZ: -0.075 };
export function lightConsoleControl(key, value) {
  const m = /^playbacks\.(\d+)\.level$/.exec(key ?? '');
  if (m) { const i = Number(m[1]); return [TT.pbX(i), 0.12, TT.pbZ + TT.pbLen / 2 - ((value ?? 0) / 100) * TT.pbLen]; }
  if (key === 'gm') return [TT.gmX, 0.12, TT.pbZ + TT.pbLen / 2 - ((value ?? 100) / 100) * TT.pbLen];
  if (key === 'blackout') return [TT.boX, 0.12, TT.boZ];
  if (key === 'programmer.sel') return [TT.selX(Array.isArray(value) && value.length ? value[0] : 1), 0.115, TT.selZ];
  if (key === 'programmer.intensity') return [-0.2, 0.125, TT.encZ];
  if (key === 'programmer.pan') return [-0.08, 0.125, TT.encZ];
  if (key === 'programmer.tilt') return [0.04, 0.125, TT.encZ];
  if (key === 'record') return [TT.recX, 0.115, TT.recZ];
  return [0.05, 0.22, -0.2]; // 터치스크린 (색·패치)
}

function drawTigerScreen(ctx, w, h, { cs, lightRes }) {
  ctx.fillStyle = '#0a0f1a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f97316'; ctx.fillRect(0, 0, w, 40);
  ctx.fillStyle = '#0a0f1a'; ctx.font = `800 26px ${FONT}`; ctx.fillText('TITAN · PATCH / PLAYBACKS', 14, 29);
  ctx.font = `600 20px ${FONT}`;
  (cs.patch ?? []).slice(0, 6).forEach((e, i) => {
    const y = 70 + i * 30;
    ctx.fillStyle = cs.programmer?.sel?.includes(e.n) ? '#38bdf8' : '#94a3b8';
    ctx.fillText(`${e.n}. ${e.label}`, 14, y);
    ctx.fillStyle = '#e2e8f0'; ctx.fillText(`${String(e.address).padStart(3, '0')}`, 220, y);
  });
  (cs.playbacks ?? []).slice(0, 6).forEach((pb, i) => {
    const y = 70 + i * 30;
    ctx.fillStyle = '#cbd5e1'; ctx.fillText(`PB${i + 1} ${pb.label}`, 300, y);
    ctx.fillStyle = '#1e293b'; ctx.fillRect(520, y - 16, 160, 16);
    ctx.fillStyle = pb.cue?.color ?? '#fbbf24'; ctx.fillRect(520, y - 16, 160 * ((pb.level ?? 0) / 100), 16);
  });
  if (cs.blackout) { ctx.fillStyle = '#dc2626'; ctx.fillRect(w - 230, 50, 210, 40); ctx.fillStyle = '#fff'; ctx.font = `900 26px ${FONT}`; ctx.fillText('BLACKOUT', w - 200, 80); }
  ctx.fillStyle = '#94a3b8'; ctx.font = `600 20px ${FONT}`; ctx.fillText(`GM ${cs.gm ?? 100}%`, w - 160, h - 20);
  const pr = cs.programmer ?? {};
  if (pr.sel?.length) {
    ctx.fillStyle = '#38bdf8'; ctx.fillText(`선택: ${pr.sel.join(', ')}  밝기 ${pr.intensity ?? '-'}  `, 14, h - 20);
    if (pr.color) { ctx.fillStyle = pr.color; ctx.fillRect(360, h - 38, 40, 22); }
  }
  void lightRes;
}

export function LightingConsoleModel({ cs, lightRes }) {
  const tex = useCanvasTexture(1024, 300, (ctx, w, h) => drawTigerScreen(ctx, w, h, { cs, lightRes }), [JSON.stringify(cs)]);
  const pbs = cs.playbacks ?? [];
  return (
    <group>
      <RoundedBox args={[0.98, 0.1, 0.6]} radius={0.015} position={[0, 0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#202227" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.101, 0.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.96, 0.18]} /><meshStandardMaterial color="#2a2d33" /></mesh>
      {/* 터치스크린 */}
      <group position={[0.02, 0.2, -0.22]} rotation={[-0.55, 0, 0]}>
        <mesh castShadow><boxGeometry args={[0.66, 0.24, 0.025]} /><meshStandardMaterial color="#0d0f12" /></mesh>
        <mesh position={[0, 0, 0.0135]}><planeGeometry args={[0.63, 0.2]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
      {/* 플레이백 페이더 10개 */}
      {Array.from({ length: 10 }, (_, i) => (
        <group key={i} position={[TT.pbX(i), 0.101, 0]}>
          <Fader position={[0, 0.001, TT.pbZ]} value={pbs[i]?.level ?? 0} length={TT.pbLen} color={pbs[i] ? '#f8fafc' : '#6b7280'} />
          <Lamp position={[0, 0.003, TT.pbZ - 0.085]} on={(pbs[i]?.level ?? 0) > 0} color="#f97316" size={[0.03, 0.006, 0.012]} offColor="#3a3f47" />
          <Lamp position={[0, 0.003, TT.selZ]} on={!!cs.programmer?.sel?.includes(i + 1)} color="#38bdf8" size={[0.03, 0.006, 0.02]} offColor="#3a3f47" />
        </group>
      ))}
      {/* 그랜드 마스터 + 블랙아웃 */}
      <Fader position={[TT.gmX, 0.102, TT.pbZ]} value={cs.gm ?? 100} length={TT.pbLen} color="#f87171" />
      <mesh position={[TT.boX, 0.108 - (cs.blackout ? 0.003 : 0), TT.boZ]}><cylinderGeometry args={[0.022, 0.022, 0.012, 20]} /><meshStandardMaterial color={cs.blackout ? '#ef4444' : '#7f1d1d'} emissive={cs.blackout ? '#ef4444' : '#000000'} emissiveIntensity={cs.blackout ? 2 : 0} /></mesh>
      <Lamp position={[TT.recX, 0.104, TT.recZ]} on={false} color="#ef4444" size={[0.04, 0.008, 0.025]} offColor="#991b1b" />
      {[-0.2, -0.08, 0.04].map((x, i) => <SmoothKnob key={x} position={[x, 0.1, TT.encZ]} value={[cs.programmer?.intensity ?? 0, cs.programmer?.pan ?? 0, cs.programmer?.tilt ?? 0][i]} min={0} max={100} color="#e5e7eb" size={0.016} />)}
    </group>
  );
}

/* ---------------------------- 미디어 서버 (Resolume PC) ---------------------------- */
function drawResolume(ctx, w, h, { m, t }) {
  ctx.fillStyle = '#1a1a1d'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e11d48'; ctx.fillRect(0, 0, w, 30);
  ctx.fillStyle = '#fff'; ctx.font = `800 20px ${FONT}`; ctx.fillText(`Resolume Arena — 컴포지션 ${m.compRes}`, 12, 21);
  // 레이어 줄 (위가 3번)
  [2, 1, 0].forEach((li, row) => {
    const y = 40 + row * 70, l = m.layers[li];
    ctx.fillStyle = '#26262b'; ctx.fillRect(8, y, w - 16, 64);
    ctx.fillStyle = '#a1a1aa'; ctx.font = `600 16px ${FONT}`; ctx.fillText(`Layer ${li + 1}`, 14, y + 22);
    ctx.fillStyle = '#3f3f46'; ctx.fillRect(14, y + 34, 80, 10); ctx.fillStyle = '#e11d48'; ctx.fillRect(14, y + 34, 80 * (l.opacity / 100), 10);
    ['worship_bg', 'lyrics', 'logo', 'concert', 'waves', 'countdown'].forEach((c, ci) => {
      const x = 110 + ci * 125;
      ctx.fillStyle = l.clip === c ? CLIPS[c].color : '#3f3f46'; ctx.fillRect(x, y + 6, 115, 52);
      ctx.fillStyle = l.clip === c ? '#0b0b0d' : '#a1a1aa'; ctx.font = `600 13px ${FONT}`; ctx.fillText(CLIPS[c].name.slice(0, 9), x + 5, y + 36);
    });
  });
  ctx.fillStyle = '#a1a1aa'; ctx.font = `600 16px ${FONT}`;
  ctx.fillText(`OUT1: ${m.out1}   OUT2: ${m.out2}   MASTER ${m.master}%   ${m.playing ? '▶' : '❚❚'}`, 14, h - 14);
  void t;
}
export function MediaServerModel({ m }) {
  const tex = useCanvasTexture(1024, 300, (ctx, w, h) => drawResolume(ctx, w, h, { m }), [JSON.stringify(m)]);
  return (
    <group>
      <group position={[-0.05, 0, -0.05]}>
        <mesh position={[0, 0.01, 0]} castShadow><boxGeometry args={[0.24, 0.02, 0.16]} /><meshStandardMaterial color="#1b1d21" metalness={0.5} /></mesh>
        <mesh position={[0, 0.16, -0.02]}><boxGeometry args={[0.04, 0.3, 0.025]} /><meshStandardMaterial color="#1b1d21" /></mesh>
        <group position={[0, 0.36, 0]}>
          <RoundedBox args={[0.72, 0.24, 0.03]} radius={0.008} castShadow><meshStandardMaterial color="#0d0f12" /></RoundedBox>
          <mesh position={[0, 0, 0.0155]}><planeGeometry args={[0.7, 0.215]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
        </group>
      </group>
      {/* PC 본체 */}
      <RoundedBox args={[0.18, 0.4, 0.4]} radius={0.01} position={[0.42, 0.2, -0.05]} castShadow receiveShadow><meshStandardMaterial color="#111318" metalness={0.4} /></RoundedBox>
      <Lamp position={[0.42, 0.36, 0.152]} on color="#e11d48" size={[0.1, 0.006, 0.003]} />
      {/* 클립 런처 컨트롤러 */}
      <group position={[-0.05, 0, 0.17]}>
        <RoundedBox args={[0.36, 0.03, 0.15]} radius={0.006} position={[0, 0.015, 0]} castShadow><meshStandardMaterial color="#18181b" /></RoundedBox>
        {Array.from({ length: 24 }, (_, i) => (
          <Lamp key={i} position={[-0.15 + (i % 8) * 0.043, 0.032, -0.05 + Math.floor(i / 8) * 0.04]} on={m.layers[2 - Math.floor(i / 8)]?.clip && (i % 8) === ['worship_bg', 'lyrics', 'logo', 'concert', 'waves', 'countdown'].indexOf(m.layers[2 - Math.floor(i / 8)].clip)} color="#22c55e" size={[0.03, 0.006, 0.03]} offColor="#3f3f46" />
        ))}
      </group>
    </group>
  );
}

/* ---------------------------- 프로젝터 ---------------------------- */
export function ProjectorModel({ power, on }) {
  return (
    <group>
      <mesh {...NR} position={[0, 0.0, 0]}><cylinderGeometry args={[0.02, 0.02, 0.25, 8]} /><meshStandardMaterial color="#111" /></mesh>
      <RoundedBox args={[0.42, 0.14, 0.36]} radius={0.02} position={[0, -0.18, 0]} castShadow><meshStandardMaterial color="#e5e7eb" roughness={0.4} /></RoundedBox>
      <mesh position={[0.1, -0.18, 0.181]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.02, 24]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.1, -0.18, 0.192]}><circleGeometry args={[0.04, 24]} /><meshBasicMaterial color={on ? '#e0f2fe' : '#0b1d3a'} toneMapped={false} /></mesh>
      <Lamp position={[-0.12, -0.12, 0.181]} on={power} color={on ? '#22c55e' : '#f59e0b'} size={[0.012, 0.012, 0.004]} />
    </group>
  );
}
// 프로젝터가 비추는 스크린 면 (texture는 Venue3D가 그려 준다)
export function ProjectedScreen({ w, h, tex, on }) {
  return (
    <group>
      <mesh {...NR}><boxGeometry args={[w + 0.08, h + 0.08, 0.02]} /><meshStandardMaterial color="#111827" /></mesh>
      <mesh {...NR} position={[0, 0, 0.012]}>
        <planeGeometry args={[w, h]} />
        {on && tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial color="#e5e7eb" roughness={0.9} />}
      </mesh>
    </group>
  );
}

/* ---------------------------- LED 전광판 ---------------------------- */
export function LedWallModel({ w = 4, h = 2.25, tex, on, power }) {
  const cols = Math.round(w / 0.5), rows = Math.round(h / 0.5625);
  return (
    <group>
      {[-1, 1].map((s) => <mesh {...NR} key={s} position={[s * (w / 2 + 0.06), (h + 0.4) / 2, -0.05]} castShadow><boxGeometry args={[0.08, h + 0.4, 0.08]} /><meshStandardMaterial color="#6b7280" metalness={0.7} wireframe /></mesh>)}
      <mesh position={[0, 0.4 + h / 2, -0.06]} castShadow><boxGeometry args={[w, h, 0.1]} /><meshStandardMaterial color="#0b0b0d" /></mesh>
      <mesh position={[0, 0.4 + h / 2, 0.0]}>
        <planeGeometry args={[w, h]} />
        {on && tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <meshStandardMaterial color={power ? '#0f1115' : '#08090b'} roughness={0.3} />}
      </mesh>
      {Array.from({ length: cols - 1 }, (_, i) => <mesh {...NR} key={`c${i}`} position={[-w / 2 + (i + 1) * (w / cols), 0.4 + h / 2, 0.002]}><planeGeometry args={[0.006, h]} /><meshBasicMaterial color="#000" transparent opacity={0.6} /></mesh>)}
      {Array.from({ length: rows - 1 }, (_, i) => <mesh {...NR} key={`r${i}`} position={[0, 0.4 + (i + 1) * (h / rows), 0.002]}><planeGeometry args={[w, 0.006]} /><meshBasicMaterial color="#000" transparent opacity={0.6} /></mesh>)}
      {/* LED 프로세서 (아래 오른쪽) */}
      <RoundedBox args={[0.44, 0.09, 0.3]} radius={0.01} position={[w / 2 - 0.35, 0.05, 0.25]} castShadow><meshStandardMaterial color="#1f2937" metalness={0.4} /></RoundedBox>
      <Lamp position={[w / 2 - 0.45, 0.06, 0.401]} on={power} color="#22c55e" size={[0.012, 0.012, 0.004]} />
      <mesh position={[w / 2 - 0.3, 0.06, 0.401]}><planeGeometry args={[0.12, 0.04]} /><meshBasicMaterial color={on ? '#22c55e' : '#334155'} toneMapped={false} /></mesh>
      {on && <pointLight color="#c084fc" intensity={2} distance={4} position={[0, 0.4 + h / 2, 0.8]} />}
    </group>
  );
}

/* ---------------------------- PTZ 조이스틱 ---------------------------- */
export function PtzControllerModel({ selected = 0, tallies = [], lcdTex, moving }) {
  const stick = useRef();
  useFrame(({ clock }) => { if (stick.current) { stick.current.rotation.x = moving ? Math.sin(clock.elapsedTime * 3) * 0.25 : 0; stick.current.rotation.z = moving ? Math.cos(clock.elapsedTime * 2) * 0.2 : 0; } });
  return (
    <group>
      <RoundedBox args={[0.36, 0.05, 0.2]} radius={0.01} position={[0, 0.025, 0]} castShadow receiveShadow><meshStandardMaterial color="#1f2125" metalness={0.4} roughness={0.45} /></RoundedBox>
      <mesh position={[-0.08, 0.051, -0.06]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.16, 0.05]} />{lcdTex ? <meshBasicMaterial map={lcdTex} toneMapped={false} /> : <meshBasicMaterial color="#0c4a6e" />}</mesh>
      {[0, 1, 2, 3].map((i) => (
        <Lamp key={i} position={[-0.14 + i * 0.04, 0.054, 0.0]} on={tallies[i] === 'pgm' || tallies[i] === 'pvw' || i === selected}
          color={tallies[i] === 'pgm' ? '#ef4444' : tallies[i] === 'pvw' ? '#22c55e' : '#38bdf8'} size={[0.03, 0.008, 0.025]} offColor="#3a3f47" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => <Lamp key={`p${i}`} position={[-0.15 + (i % 3) * 0.04, 0.054, 0.05 + Math.floor(i / 3) * 0.035]} on={false} color="#facc15" size={[0.028, 0.008, 0.022]} offColor="#4b5058" />)}
      <group ref={stick} position={[0.1, 0.05, 0.02]}>
        <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.03, 0.035, 0.012, 20]} /><meshStandardMaterial color="#111" /></mesh>
        <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.008, 0.01, 0.08, 12]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} /></mesh>
        <mesh position={[0, 0.11, 0]} castShadow><capsuleGeometry args={[0.02, 0.05, 6, 12]} /><meshStandardMaterial color="#111" roughness={0.6} /></mesh>
      </group>
    </group>
  );
}
export function drawPtzLcd(ctx, w, h, { selected, ip, reach, framing }) {
  ctx.fillStyle = '#0c4a6e'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e0f2fe'; ctx.font = `700 34px ${FONT}`; ctx.fillText(`CAM ${selected + 1}  ${ip ?? ''}`, 12, 42);
  ctx.font = `600 28px ${FONT}`; ctx.fillStyle = reach ? '#86efac' : '#fca5a5';
  ctx.fillText(reach ? `연결됨 · ${framing ?? '구도 없음'}` : '카메라 응답 없음', 12, 92);
}

export const PORTS_LIGHT = {
  par_led: { dmxIn: { p: [-0.035, -0.075, -0.037], n: [0, 0, -1] }, dmxOut: { p: [0.035, -0.075, -0.037], n: [0, 0, -1] } },
  moving_head: { dmxIn: { p: [-0.05, -0.07, -0.132], n: [0, 0, -1] }, dmxOut: { p: [0.04, -0.07, -0.132], n: [0, 0, -1] } },
  lighting_console: { dmx1: { p: [0.38, 0.09, -0.3], n: [0, 0.3, -1] } },
  media_server: { out1: { p: [0.4, 0.3, -0.252], n: [0, 0, -1] }, out2: { p: [0.44, 0.3, -0.252], n: [0, 0, -1] } },
  projector: { hdmi: { p: [-0.1, -0.18, -0.181], n: [0, 0, -1] } },
  led_wall: { hdmi: { p: [1.65, 0.06, 0.1], n: [0, 0, -1] } },
  ptz_controller: { lan: { p: [0.12, 0.03, -0.101], n: [0, 0, -1] } },
};
export const GHOST_LIGHT = {
  par_led: [0.25, 0.42, 0.25], moving_head: [0.34, 0.5, 0.3], lighting_console: [1.0, 0.36, 0.62], media_server: [1.0, 0.5, 0.5],
  projector: [0.44, 0.3, 0.38], led_wall: [4.2, 2.7, 0.4], ptz_controller: [0.36, 0.17, 0.2],
};
export const FOCUS_LIGHT = {
  par_led: { y: -0.2, dist: 1.0 }, moving_head: { y: -0.25, dist: 1.1 }, lighting_console: { y: 0.12, dist: 1.1 }, media_server: { y: 0.25, dist: 1.2 },
  projector: { y: -0.15, dist: 1.0 }, led_wall: { y: 1.5, dist: 4.5 }, ptz_controller: { y: 0.06, dist: 0.6 },
};
