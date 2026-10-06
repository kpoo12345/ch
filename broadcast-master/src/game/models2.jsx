import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { noRaycast, Lamp, useCanvasTexture, FONT } from './kit3d.jsx';

/* =====================================================================
 * 공연장 3D 추가 모델 — 기타·키보드·노트북·모니터 스피커·공유기, 사람과 무대 소품
 * 원점 = 바닥(또는 책상 위) 접점, 앞면 = +z
 * 소품·사람은 클릭을 가로채지 않도록 모든 메시에 raycast={noRaycast}
 * ===================================================================== */

const NR = { raycast: noRaycast };
const SKIN = ['#e0b896', '#c99a74', '#f1d0b0', '#a87a58', '#d9ad84'];
const SHIRTS = ['#3b5b8f', '#7c2d12', '#065f46', '#6b21a8', '#9a3412', '#1f2937', '#be185d', '#0e7490', '#4d7c0f', '#e2e8f0'];
const HAIR = ['#2b1d14', '#111111', '#4a3426', '#6b4f3a', '#1c1917'];

/* ---------------------------- 사람 ---------------------------- */
// hands: 'down' | 'pulpit' | 'mic' | 'guitar' | 'keys'
export function Person({ position, rotation = 0, pose = 'stand', shirt = '#3b5b8f', pants = '#1f2937', skin = '#e0b896', hair = '#2b1d14', talking = false, singing = false, playing = false, hands = 'down', scale = 1 }) {
  const head = useRef();
  const body = useRef();
  const armR = useRef();
  const armL = useRef();
  const sit = pose === 'sit';
  const hipY = sit ? 0.47 : 0.88;
  const seed = useMemo(() => (position?.[0] ?? 0) * 3.1 + (position?.[2] ?? 0) * 1.7, [position]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    if (head.current) {
      head.current.rotation.x = talking ? Math.sin(t * 7) * 0.05 : singing ? Math.sin(t * 3.2) * 0.08 : 0;
      head.current.rotation.y = talking ? Math.sin(t * 1.3) * 0.12 : singing ? Math.sin(t * 1.6) * 0.15 : 0;
    }
    if (body.current) body.current.rotation.z = singing ? Math.sin(t * 1.6) * 0.03 : 0;
    if (armR.current) {
      if (hands === 'guitar') armR.current.rotation.x = -0.9 + (playing ? Math.sin(t * 16) * 0.25 : 0);
      if (hands === 'keys') armR.current.rotation.x = -1.2 + (playing ? Math.sin(t * 9) * 0.08 : 0);
    }
    if (armL.current && hands === 'keys') armL.current.rotation.x = -1.2 + (playing ? Math.sin(t * 7 + 1) * 0.08 : 0);
  });
  const torsoY = hipY + 0.3;
  const shoulderY = hipY + 0.5;
  // 팔 자세: [x 회전, z 회전]
  const armPose = {
    down: { r: [0, 0.12], l: [0, -0.12] },
    pulpit: { r: [-1.0, 0.15], l: [-1.0, -0.15] },
    mic: { r: [-2.2, 0.35], l: [0, -0.12] },
    guitar: { r: [-0.9, 0.35], l: [-1.1, -0.9] },
    keys: { r: [-1.2, 0.1], l: [-1.2, -0.1] },
  }[hands] ?? { r: [0, 0.12], l: [0, -0.12] };
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {/* 다리 */}
      {[-0.09, 0.09].map((x) => (
        sit ? (
          <group key={x}>
            <mesh {...NR} position={[x, hipY, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.07, 0.065, 0.42, 12]} /><meshStandardMaterial color={pants} roughness={0.8} /></mesh>
            <mesh {...NR} position={[x, hipY / 2, 0.4]} castShadow><cylinderGeometry args={[0.06, 0.055, hipY, 12]} /><meshStandardMaterial color={pants} roughness={0.8} /></mesh>
            <mesh {...NR} position={[x, 0.03, 0.45]}><boxGeometry args={[0.1, 0.06, 0.22]} /><meshStandardMaterial color="#0b0b0b" /></mesh>
          </group>
        ) : (
          <group key={x}>
            <mesh {...NR} position={[x, hipY / 2, 0]} castShadow><cylinderGeometry args={[0.065, 0.055, hipY, 12]} /><meshStandardMaterial color={pants} roughness={0.8} /></mesh>
            <mesh {...NR} position={[x, 0.03, 0.04]}><boxGeometry args={[0.1, 0.06, 0.22]} /><meshStandardMaterial color="#0b0b0b" /></mesh>
          </group>
        )
      ))}
      <group ref={body}>
        <mesh {...NR} position={[0, torsoY, 0]} castShadow><capsuleGeometry args={[0.17, 0.34, 8, 16]} /><meshStandardMaterial color={shirt} roughness={0.75} /></mesh>
        {/* 팔: 어깨에서 내려오는 캡슐 (어깨 피벗) */}
        <group ref={armR} position={[0.23, shoulderY, 0.0]} rotation={[armPose.r[0], 0, armPose.r[1]]}>
          <mesh {...NR} position={[0, -0.23, 0]} castShadow><capsuleGeometry args={[0.05, 0.36, 6, 10]} /><meshStandardMaterial color={shirt} roughness={0.75} /></mesh>
          <mesh {...NR} position={[0, -0.45, 0]}><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color={skin} /></mesh>
        </group>
        <group ref={armL} position={[-0.23, shoulderY, 0.0]} rotation={[armPose.l[0], 0, armPose.l[1]]}>
          <mesh {...NR} position={[0, -0.23, 0]} castShadow><capsuleGeometry args={[0.05, 0.36, 6, 10]} /><meshStandardMaterial color={shirt} roughness={0.75} /></mesh>
          <mesh {...NR} position={[0, -0.45, 0]}><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color={skin} /></mesh>
        </group>
        <mesh {...NR} position={[0, shoulderY + 0.06, 0]}><cylinderGeometry args={[0.05, 0.06, 0.08, 12]} /><meshStandardMaterial color={skin} /></mesh>
        <group ref={head} position={[0, shoulderY + 0.19, 0]}>
          <mesh {...NR} castShadow><sphereGeometry args={[0.115, 24, 20]} /><meshStandardMaterial color={skin} roughness={0.7} /></mesh>
          <mesh {...NR} position={[0, 0.035, -0.012]}><sphereGeometry args={[0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.9} /></mesh>
          {[-0.04, 0.04].map((x) => <mesh {...NR} key={x} position={[x, 0.01, 0.105]}><sphereGeometry args={[0.012, 10, 8]} /><meshStandardMaterial color="#111" /></mesh>)}
        </group>
      </group>
    </group>
  );
}

// 관객 (인스턴스 메시): seats = [[x, y, z, rotY], ...], 기본은 +z를 바라본다
export function Audience({ seats, seated = true }) {
  const n = seats.length;
  const torso = useRef();
  const heads = useRef();
  const legs = useRef();
  const geo = useMemo(() => ({
    torso: new THREE.CapsuleGeometry(0.16, 0.3, 6, 12),
    head: new THREE.SphereGeometry(0.11, 16, 12),
    legs: new THREE.BoxGeometry(0.3, 0.86, 0.16),
  }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const base = seated ? 0.47 : 0.88;
  useEffect(() => {
    const c = new THREE.Color();
    seats.forEach(([x, y, z, r], i) => {
      dummy.position.set(x, y + base + 0.3, z); dummy.rotation.set(0, r, 0); dummy.updateMatrix();
      torso.current?.setMatrixAt(i, dummy.matrix);
      torso.current?.setColorAt(i, c.set(SHIRTS[(i * 7) % SHIRTS.length]));
      dummy.position.set(x, y + base + 0.69, z); dummy.updateMatrix();
      heads.current?.setMatrixAt(i, dummy.matrix);
      heads.current?.setColorAt(i, c.set(i % 4 === 0 ? HAIR[i % HAIR.length] : SKIN[i % SKIN.length]));
      if (!seated) {
        dummy.position.set(x, y + 0.43, z); dummy.updateMatrix();
        legs.current?.setMatrixAt(i, dummy.matrix);
      }
    });
    [torso, heads, legs].forEach((m) => { if (m.current) { m.current.instanceMatrix.needsUpdate = true; if (m.current.instanceColor) m.current.instanceColor.needsUpdate = true; } });
  }, [seats, seated]); // eslint-disable-line react-hooks/exhaustive-deps
  // 머리를 조금씩 움직여 살아 있는 느낌
  useFrame(({ clock }) => {
    if (!heads.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < n; i += 1) {
      const [x, y, z, r] = seats[i];
      dummy.position.set(x + Math.sin(t * 0.7 + i) * 0.01, y + base + 0.69 + (seated ? 0 : Math.max(0, Math.sin(t * 4 + i * 1.3)) * 0.02), z);
      dummy.rotation.set(0, r + Math.sin(t * 0.5 + i * 2.1) * 0.15, 0);
      dummy.updateMatrix();
      heads.current.setMatrixAt(i, dummy.matrix);
    }
    heads.current.instanceMatrix.needsUpdate = true;
  });
  if (!n) return null;
  return (
    <group>
      <instancedMesh ref={torso} args={[geo.torso, undefined, n]} castShadow raycast={noRaycast}><meshStandardMaterial roughness={0.8} /></instancedMesh>
      <instancedMesh ref={heads} args={[geo.head, undefined, n]} castShadow raycast={noRaycast}><meshStandardMaterial roughness={0.75} /></instancedMesh>
      {!seated && <instancedMesh ref={legs} args={[geo.legs, undefined, n]} raycast={noRaycast}><meshStandardMaterial color="#1f2937" roughness={0.85} /></instancedMesh>}
    </group>
  );
}

/* ---------------------------- 가구·소품 ---------------------------- */
// 교회 장의자: 회중은 -z(강단)를 바라보므로 등받이는 +z 쪽
export function Pew({ width = 2.2 }) {
  const wood = <meshStandardMaterial color="#5b3a26" roughness={0.7} />;
  return (
    <group>
      <mesh {...NR} position={[0, 0.44, 0]} castShadow receiveShadow><boxGeometry args={[width, 0.05, 0.4]} />{wood}</mesh>
      <mesh {...NR} position={[0, 0.72, 0.19]} castShadow><boxGeometry args={[width, 0.5, 0.05]} />{wood}</mesh>
      {[-1, 1].map((s) => <mesh {...NR} key={s} position={[s * (width / 2 - 0.02), 0.45, 0.02]} castShadow><boxGeometry args={[0.05, 0.9, 0.46]} />{wood}</mesh>)}
    </group>
  );
}

// 의자 (앉는 사람은 -z를 바라본다)
export function Chair() {
  return (
    <group>
      <mesh {...NR} position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.44, 0.04, 0.42]} /><meshStandardMaterial color="#334155" roughness={0.7} /></mesh>
      <mesh {...NR} position={[0, 0.72, 0.2]} castShadow><boxGeometry args={[0.44, 0.5, 0.03]} /><meshStandardMaterial color="#334155" roughness={0.7} /></mesh>
      {[[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].map(([x, z]) => (
        <mesh {...NR} key={`${x}${z}`} position={[x, 0.22, z]}><cylinderGeometry args={[0.012, 0.012, 0.45, 6]} /><meshStandardMaterial color="#94a3b8" metalness={0.6} /></mesh>
      ))}
    </group>
  );
}

// 강대상 (앞면 +z, 기울어진 윗면은 -z의 설교자 쪽)
export function Lectern({ height = 1.05 }) {
  return (
    <group>
      <mesh {...NR} position={[0, (height - 0.08) / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.62, height - 0.08, 0.42]} /><meshStandardMaterial color="#6b4423" roughness={0.6} /></mesh>
      <mesh {...NR} position={[0, height - 0.03, -0.02]} rotation={[-0.25, 0, 0]} castShadow><boxGeometry args={[0.7, 0.04, 0.5]} /><meshStandardMaterial color="#7c4f2a" roughness={0.55} /></mesh>
      <mesh {...NR} position={[0, height * 0.55, 0.212]}><boxGeometry args={[0.05, 0.3, 0.01]} /><meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} /></mesh>
      <mesh {...NR} position={[0, height * 0.6, 0.212]}><boxGeometry args={[0.18, 0.05, 0.01]} /><meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

export function StagePlatform({ width, depth, height, color = '#2a2320', edge = '#c08a3e' }) {
  return (
    <group>
      <mesh {...NR} position={[0, height / 2, 0]} castShadow receiveShadow><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>
      <mesh {...NR} position={[0, height - 0.01, depth / 2 + 0.005]}><boxGeometry args={[width, 0.03, 0.012]} /><meshStandardMaterial color={edge} metalness={0.4} roughness={0.4} /></mesh>
      {[0, 1].map((i) => (
        <mesh {...NR} key={i} position={[-width / 2 + 0.5, (height * (i + 1)) / 3 / 2 + 0.0, depth / 2 + 0.3 - i * 0.15]} castShadow receiveShadow>
          <boxGeometry args={[0.7, (height * (i + 1)) / 3, 0.3]} /><meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function DrumKit({ performing }) {
  const sticks = useRef([]);
  const cym = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sticks.current.forEach((m, i) => { if (m) m.rotation.x = -0.6 + (performing ? Math.abs(Math.sin(t * 9 + i * 1.7)) * 0.6 : 0); });
    cym.current.forEach((m, i) => { if (m) m.rotation.z = performing ? Math.sin(t * 12 + i) * 0.06 : 0; });
  });
  const shell = (c = '#7f1d1d') => <meshStandardMaterial color={c} metalness={0.3} roughness={0.4} />;
  const head = <meshStandardMaterial color="#f1f5f9" roughness={0.6} />;
  return (
    <group>
      {/* 킥 */}
      <group position={[0, 0.27, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh {...NR} castShadow><cylinderGeometry args={[0.27, 0.27, 0.4, 28]} />{shell()}</mesh>
        <mesh {...NR} position={[0, 0.201, 0]}><cylinderGeometry args={[0.25, 0.25, 0.005, 28]} />{head}</mesh>
      </group>
      {/* 스네어·탐 */}
      {[[-0.38, 0.62, 0.1, 0.17, 0.14], [-0.13, 0.82, 0.12, 0.13, 0.12], [0.15, 0.82, 0.12, 0.14, 0.13], [0.45, 0.5, 0.0, 0.2, 0.36]].map(([x, y, z, r, h], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh {...NR} castShadow><cylinderGeometry args={[r, r, h, 24]} />{shell(i === 0 ? '#cbd5e1' : '#7f1d1d')}</mesh>
          <mesh {...NR} position={[0, h / 2 + 0.002, 0]}><cylinderGeometry args={[r * 0.95, r * 0.95, 0.004, 24]} />{head}</mesh>
          {i === 3 && <mesh {...NR} position={[0, -h / 2 - 0.12, 0]}><cylinderGeometry args={[0.01, 0.01, 0.24, 6]} /><meshStandardMaterial color="#94a3b8" /></mesh>}
        </group>
      ))}
      {/* 심벌·하이햇 */}
      {[[-0.62, 0.95, 0.05, 0.17], [-0.45, 1.25, -0.05, 0.22], [0.55, 1.3, -0.05, 0.24]].map(([x, y, z, r], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh {...NR} position={[0, y / 2, 0]}><cylinderGeometry args={[0.01, 0.01, y, 6]} /><meshStandardMaterial color="#94a3b8" metalness={0.7} /></mesh>
          <mesh {...NR} ref={(el) => { cym.current[i] = el; }} position={[0, y, 0]} castShadow><cylinderGeometry args={[r, r * 0.98, 0.006, 28]} /><meshStandardMaterial color="#d4a017" metalness={0.85} roughness={0.25} /></mesh>
        </group>
      ))}
      <group position={[0, 0, -0.55]}>
        <mesh {...NR} position={[0, 0.25, 0]}><cylinderGeometry args={[0.18, 0.2, 0.5, 16]} /><meshStandardMaterial color="#111" /></mesh>
        <Person position={[0, 0, 0]} pose="sit" shirt="#1e293b" singing={performing} />
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * 0.24, 0.98, 0.1]}>
            <mesh {...NR} ref={(el) => { sticks.current[i] = el; }} position={[0, 0, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.4, 6]} /><meshStandardMaterial color="#e7cfa0" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function LightTruss({ width = 7, height = 3.2, live = false, lights = true, colors = ['#f472b6', '#60a5fa', '#facc15', '#34d399'] }) {
  const heads = useRef([]);
  const count = 8;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    heads.current.forEach((m, i) => {
      if (!m) return;
      m.rotation.x = 0.6 + (live ? Math.sin(t * 0.8 + i) * 0.35 : 0);
      m.rotation.z = live ? Math.sin(t * 0.6 + i * 0.7) * 0.4 : 0;
    });
  });
  const truss = <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.35} />;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * width / 2, 0, 0]}>
          <mesh {...NR} position={[0, height / 2, 0]} castShadow><boxGeometry args={[0.25, height, 0.25]} /><meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} wireframe /></mesh>
          <mesh {...NR} position={[0, 0.02, 0]}><boxGeometry args={[0.6, 0.04, 0.6]} />{truss}</mesh>
        </group>
      ))}
      <mesh {...NR} position={[0, height, 0]}><boxGeometry args={[width, 0.25, 0.25]} /><meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.4} wireframe /></mesh>
      {lights && Array.from({ length: count }, (_, i) => {
        const x = -width / 2 + 0.6 + (i * (width - 1.2)) / (count - 1);
        const c = colors[i % colors.length];
        return (
          <group key={i} position={[x, height - 0.18, 0.05]}>
            <group ref={(el) => { heads.current[i] = el; }}>
              <mesh {...NR}><cylinderGeometry args={[0.08, 0.1, 0.18, 14]} /><meshStandardMaterial color="#111" /></mesh>
              <mesh {...NR} position={[0, -0.091, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.075, 16]} /><meshBasicMaterial color={live ? c : '#1f2937'} toneMapped={false} side={THREE.DoubleSide} /></mesh>
              {live && (
                <mesh {...NR} position={[0, -1.2, 0]}>
                  <coneGeometry args={[0.5, 2.2, 16, 1, true]} />
                  <meshBasicMaterial color={c} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
              )}
            </group>
          </group>
        );
      })}
      {live && <spotLight position={[-width / 4, height, 0.5]} target-position={[0, 0.5, -1]} angle={0.5} penumbra={0.8} intensity={22} color={colors[0]} decay={1.4} />}
      {live && <spotLight position={[width / 4, height, 0.5]} angle={0.5} penumbra={0.8} intensity={22} color={colors[1]} decay={1.4} />}
    </group>
  );
}

export function ProjectionScreen({ width = 2.4, height = 1.35, tex }) {
  return (
    <group>
      <mesh {...NR} position={[0, height / 2, 0]}><boxGeometry args={[width + 0.08, height + 0.08, 0.03]} /><meshStandardMaterial color="#111827" /></mesh>
      <mesh {...NR} position={[0, height / 2, 0.017]}>
        <planeGeometry args={[width, height]} />
        {tex ? <meshBasicMaterial map={tex} toneMapped={false} /> : <SlideMaterial />}
      </mesh>
    </group>
  );
}
function SlideMaterial() {
  const tex = useCanvasTexture(512, 288, (ctx, w, h) => {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0, 0, w, 46);
    ctx.fillStyle = '#fff'; ctx.font = `700 26px ${FONT}`; ctx.fillText('오늘의 세미나', 18, 32);
    ctx.fillStyle = '#cbd5e1'; [80, 115, 150, 185].forEach((y, i) => ctx.fillRect(30, y, 300 - i * 40, 16));
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(360, 80, 120, 120);
  }, []);
  return <meshBasicMaterial map={tex} toneMapped={false} />;
}

export function ChurchWall({ width = 9, height = 4.5 }) {
  const glass = useCanvasTexture(128, 256, (ctx, w, h) => {
    const cols = ['#1d4ed8', '#b91c1c', '#ca8a04', '#15803d', '#7e22ce'];
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { ctx.fillStyle = cols[((x + y) / 32) % cols.length]; ctx.fillRect(x, y, 32, 32); }
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  }, []);
  return (
    <group>
      <mesh {...NR} position={[0, height / 2, 0]} receiveShadow><planeGeometry args={[width * 2, height]} /><meshStandardMaterial color="#e7dcc8" roughness={0.95} /></mesh>
      <mesh {...NR} position={[0, 0.5, 0.02]}><boxGeometry args={[width * 2, 1.0, 0.04]} /><meshStandardMaterial color="#6b4423" roughness={0.7} /></mesh>
      <group position={[0, 2.6, 0.06]}>
        <mesh {...NR} castShadow><boxGeometry args={[0.16, 1.7, 0.1]} /><meshStandardMaterial color="#7c4f2a" roughness={0.6} /></mesh>
        <mesh {...NR} position={[0, 0.35, 0]} castShadow><boxGeometry args={[0.9, 0.16, 0.1]} /><meshStandardMaterial color="#7c4f2a" roughness={0.6} /></mesh>
        <pointLight color="#fde68a" intensity={1.2} distance={3} position={[0, 0, 0.4]} />
      </group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.4, 2.5, 0.03]}>
          <mesh {...NR}><planeGeometry args={[0.7, 1.8]} /><meshStandardMaterial map={glass} emissive="#ffffff" emissiveMap={glass} emissiveIntensity={0.6} toneMapped={false} /></mesh>
          <mesh {...NR} position={[0, 0.9, 0]}><circleGeometry args={[0.35, 24, 0, Math.PI]} /><meshStandardMaterial map={glass} emissive="#ffffff" emissiveMap={glass} emissiveIntensity={0.6} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function StageBackdrop({ width = 9, height = 4.5, live }) {
  const banner = useCanvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = live ? '#f472b6' : '#4b5563'; ctx.font = `900 120px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LIVE CLUB 무대', w / 2, h / 2 + 6);
  }, [live]);
  const folds = 24;
  return (
    <group>
      {Array.from({ length: folds }, (_, i) => (
        <mesh {...NR} key={i} position={[-width / 2 + (i + 0.5) * (width / folds), height / 2, (i % 2) * 0.05]} receiveShadow>
          <boxGeometry args={[width / folds + 0.01, height, 0.04]} /><meshStandardMaterial color={i % 2 ? '#111114' : '#18181c'} roughness={1} />
        </mesh>
      ))}
      <mesh {...NR} position={[0, height - 0.75, 0.1]}><planeGeometry args={[3.2, 0.8]} /><meshStandardMaterial map={banner} emissive="#ffffff" emissiveMap={banner} emissiveIntensity={live ? 0.9 : 0.25} toneMapped={false} /></mesh>
    </group>
  );
}

export function AcousticWall({ width = 6, height = 3 }) {
  const neon = useCanvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 18; ctx.fillStyle = '#fbcfe8'; ctx.font = `800 64px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ON AIR ♪', w / 2, h / 2);
  }, []);
  const panels = [];
  for (let r = 0; r < 4; r += 1) for (let c = 0; c < 8; c += 1) panels.push([-width / 2 + 0.45 + c * ((width - 0.9) / 7), 0.6 + r * 0.55, (r + c) % 2]);
  return (
    <group>
      <mesh {...NR} position={[0, height / 2, 0]} receiveShadow><planeGeometry args={[width * 2, height + 1]} /><meshStandardMaterial color="#1f2430" roughness={1} /></mesh>
      {panels.map(([x, y, alt]) => (
        <mesh {...NR} key={`${x}-${y}`} position={[x, y, 0.035]} rotation={[0, 0, alt ? Math.PI / 4 : 0]}>
          <boxGeometry args={[0.42, 0.42, alt ? 0.05 : 0.07]} /><meshStandardMaterial color={alt ? '#3b2a4a' : '#2a3150'} roughness={1} />
        </mesh>
      ))}
      <mesh {...NR} position={[0, 2.35, 0.1]}><planeGeometry args={[1.4, 0.35]} /><meshBasicMaterial map={neon} transparent toneMapped={false} /></mesh>
      <pointLight color="#f472b6" intensity={1.2} distance={2.5} position={[0, 2.3, 0.5]} />
    </group>
  );
}

export function Table({ w, d, h = 0.75, color = '#6b4f3a' }) {
  return (
    <group>
      <RoundedBox args={[w, 0.04, d]} radius={0.01} position={[0, h - 0.02, 0]} castShadow receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={color} roughness={0.6} />
      </RoundedBox>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh {...NR} key={`${sx}${sz}`} position={[sx * (w / 2 - 0.06), (h - 0.04) / 2, sz * (d / 2 - 0.06)]} castShadow>
          <boxGeometry args={[0.05, h - 0.04, 0.05]} /><meshStandardMaterial color="#1a1c20" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// 장비 랙/로드 케이스: 윗면 높이 h
export function Rack({ h = 0.75 }) {
  return (
    <group>
      <mesh {...NR} position={[0, h / 2, 0]} castShadow receiveShadow><boxGeometry args={[0.55, h, 0.5]} /><meshStandardMaterial color="#1c1f24" roughness={0.6} metalness={0.3} /></mesh>
      {[0.25, 0.5].map((y) => <mesh {...NR} key={y} position={[0, h * y, 0.251]}><boxGeometry args={[0.5, 0.01, 0.002]} /><meshStandardMaterial color="#9ca3af" metalness={0.8} /></mesh>)}
      {[-1, 1].map((s) => <mesh {...NR} key={s} position={[s * 0.27, h / 2, 0.24]}><boxGeometry args={[0.02, h, 0.03]} /><meshStandardMaterial color="#9ca3af" metalness={0.8} /></mesh>)}
    </group>
  );
}

export function TallTripod({ height = 1.15 }) {
  return (
    <group>
      {[0, 2.094, 4.188].map((a) => (
        <mesh {...NR} key={a} position={[Math.sin(a) * 0.17, height * 0.45, Math.cos(a) * 0.17]} rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]} castShadow>
          <cylinderGeometry args={[0.011, 0.008, height * 0.95, 8]} /><meshStandardMaterial color="#1c1f24" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh {...NR} position={[0, height - 0.02, 0]}><cylinderGeometry args={[0.04, 0.035, 0.04, 16]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

export function Plant() {
  return (
    <group>
      <mesh {...NR} position={[0, 0.18, 0]} castShadow><cylinderGeometry args={[0.16, 0.12, 0.36, 16]} /><meshStandardMaterial color="#e7e5e4" roughness={0.6} /></mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh {...NR} key={i} position={[Math.sin(i * 1.3) * 0.1, 0.55 + i * 0.07, Math.cos(i * 1.3) * 0.1]} castShadow>
          <sphereGeometry args={[0.16 - i * 0.015, 10, 8]} /><meshStandardMaterial color={i % 2 ? '#15803d' : '#166534'} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------------------- 장비: 일렉 기타 (연주자 포함) ---------------------------- */
export function GuitarModel({ performing }) {
  return (
    <group>
      <Person position={[0, 0, -0.08]} shirt="#7f1d1d" hands="guitar" playing={performing} singing={performing} />
      {/* 기타: 허리 높이에 비스듬히 */}
      <group position={[0.02, 0.98, 0.1]} rotation={[0, 0, 0.45]}>
        <mesh castShadow position={[0.06, -0.03, 0]}><cylinderGeometry args={[0.15, 0.15, 0.045, 28]} /><meshStandardMaterial color="#b91c1c" metalness={0.3} roughness={0.35} /></mesh>
        <mesh castShadow position={[-0.08, 0.06, 0]}><cylinderGeometry args={[0.115, 0.115, 0.045, 28]} /><meshStandardMaterial color="#b91c1c" metalness={0.3} roughness={0.35} /></mesh>
        <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.024]}>
          <mesh position={[0.0, 0.0, 0]}><boxGeometry args={[0.07, 0.02, 0.002]} /><meshStandardMaterial color="#e5e7eb" metalness={0.8} /></mesh>
          <mesh position={[0.07, 0.0, 0]}><boxGeometry args={[0.07, 0.02, 0.002]} /><meshStandardMaterial color="#e5e7eb" metalness={0.8} /></mesh>
        </group>
        <mesh position={[-0.42, 0.0, 0.0]} rotation={[0, 0, Math.PI / 2]} castShadow><boxGeometry args={[0.05, 0.5, 0.025]} /><meshStandardMaterial color="#3f2a1d" roughness={0.6} /></mesh>
        <mesh position={[-0.71, 0.0, 0.0]}><boxGeometry args={[0.1, 0.07, 0.02]} /><meshStandardMaterial color="#111" /></mesh>
        {[0.1, 0.13].map((x) => <mesh key={x} position={[x, -0.1, 0.025]}><cylinderGeometry args={[0.01, 0.01, 0.012, 10]} /><meshStandardMaterial color="#d4af37" metalness={0.8} /></mesh>)}
      </group>
      {/* 출력 잭 (몸통 아래쪽 가장자리) */}
      <mesh position={[0.2, 0.88, 0.12]}><cylinderGeometry args={[0.009, 0.009, 0.014, 12]} /><meshStandardMaterial color="#cfd5dc" metalness={0.9} /></mesh>
    </group>
  );
}

/* ---------------------------- 장비: 키보드 ---------------------------- */
export function KeyboardModel({ performing, player = true }) {
  const black = useRef();
  const blackGeo = useMemo(() => new THREE.BoxGeometry(0.009, 0.012, 0.075), []);
  useEffect(() => () => blackGeo.dispose(), [blackGeo]);
  useEffect(() => {
    if (!black.current) return;
    const d = new THREE.Object3D();
    let k = 0;
    for (let oct = 0; oct < 7; oct += 1) {
      [0, 1, 3, 4, 5].forEach((j) => {
        const x = -0.6 + oct * 0.168 + (j + 0.7) * 0.024;
        d.position.set(x, 0.966, 0.03); d.updateMatrix();
        if (k < 35) black.current.setMatrixAt(k, d.matrix);
        k += 1;
      });
    }
    black.current.count = Math.min(k, 35);
    black.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      {/* X 스탠드 */}
      {[-0.45, 0.45].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-1, 1].map((s) => <mesh key={s} position={[0, 0.44, 0]} rotation={[s * 0.62, 0, 0]} castShadow><boxGeometry args={[0.03, 1.02, 0.03]} /><meshStandardMaterial color="#111" metalness={0.6} /></mesh>)}
        </group>
      ))}
      {[-0.4, 0.4].map((z) => <mesh key={z} position={[0, 0.86, z * 0.25]}><boxGeometry args={[1.0, 0.025, 0.025]} /><meshStandardMaterial color="#111" metalness={0.6} /></mesh>)}
      <RoundedBox args={[1.32, 0.09, 0.32]} radius={0.015} position={[0, 0.92, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1c1d21" roughness={0.45} metalness={0.2} />
      </RoundedBox>
      <mesh position={[0, 0.957, 0.045]}><boxGeometry args={[1.2, 0.012, 0.15]} /><meshStandardMaterial color="#f8fafc" roughness={0.4} /></mesh>
      <instancedMesh ref={black} args={[blackGeo, undefined, 35]} castShadow><meshStandardMaterial color="#0b0b0b" roughness={0.4} /></instancedMesh>
      <mesh position={[-0.2, 0.966, -0.1]}><planeGeometry args={[0.18, 0.04]} /><meshBasicMaterial color="#0ea5e9" toneMapped={false} /></mesh>
      <Lamp position={[0.5, 0.967, -0.1]} on color="#22c55e" size={[0.01, 0.004, 0.01]} />
      {player && <Person position={[0, 0, -0.48]} shirt="#065f46" hands="keys" playing={performing} singing={performing} />}
    </group>
  );
}

/* ---------------------------- 장비: 노트북 ---------------------------- */
export function LaptopModel({ playing, screenTex }) {
  return (
    <group>
      <RoundedBox args={[0.32, 0.018, 0.22]} radius={0.006} position={[0, 0.009, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.0185, 0.02]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.28, 0.1]} /><meshStandardMaterial color="#1f2937" /></mesh>
      <group position={[0, 0.018, -0.105]} rotation={[-0.26, 0, 0]}>
        <mesh position={[0, 0.105, -0.004]} castShadow><boxGeometry args={[0.32, 0.21, 0.008]} /><meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} /></mesh>
        <mesh position={[0, 0.105, 0.0005]}>
          <planeGeometry args={[0.3, 0.19]} />
          {screenTex ? <meshBasicMaterial map={screenTex} toneMapped={false} /> : <meshBasicMaterial color={playing ? '#1e293b' : '#0f172a'} />}
        </mesh>
      </group>
      <mesh position={[-0.1605, 0.009, 0.03]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.004, 0.004, 0.002, 10]} /><meshStandardMaterial color="#111" /></mesh>
    </group>
  );
}

/* ---------------------------- 장비: 모니터 스피커 (웨지) ---------------------------- */
const WEDGE_FACE = { z: 0.085, y: 0.21, tilt: -0.85 }; // 기울어진 앞면 중심과 기울기
export function WedgeModel({ power, level, feedback }) {
  const cone = useRef();
  const cab = useRef();
  const light = useRef();
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.21, 0); s.lineTo(0.21, 0); s.lineTo(0.21, 0.1); s.lineTo(-0.04, 0.32); s.lineTo(-0.21, 0.32); s.lineTo(-0.21, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
    g.translate(0, 0, -0.275);
    g.rotateY(-Math.PI / 2);
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const amp = feedback ? 0.01 : level != null ? Math.max(0, (level + 45) / 45) * 0.007 : 0;
    if (cone.current) cone.current.position.z = 0.004 + Math.sin(t * 55) * amp;
    if (cab.current) cab.current.position.x = feedback ? Math.sin(t * 70) * 0.005 : 0;
    if (light.current) light.current.intensity = feedback ? 1.4 + Math.sin(t * 20) * 1.0 : 0;
  });
  return (
    <group ref={cab}>
      <mesh geometry={geo} castShadow receiveShadow><meshStandardMaterial color="#17191d" roughness={0.75} /></mesh>
      <group position={[0, WEDGE_FACE.y, WEDGE_FACE.z]} rotation={[WEDGE_FACE.tilt, 0, 0]}>
        <mesh position={[0, 0, 0.012]}><planeGeometry args={[0.5, 0.3]} /><meshStandardMaterial color="#0a0b0d" roughness={0.9} /></mesh>
        <group ref={cone} position={[-0.08, 0, 0.004]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.03, 0.03, 32, 1, true]} /><meshStandardMaterial color="#202226" side={THREE.DoubleSide} /></mesh>
        </group>
        <mesh position={[0.15, 0, 0.012]}><boxGeometry args={[0.1, 0.07, 0.01]} /><meshStandardMaterial color="#0c0d0f" /></mesh>
        <pointLight ref={light} color="#ef4444" distance={2} intensity={0} position={[0, 0, 0.3]} />
      </group>
      <Lamp position={[-0.12, 0.25, -0.217]} on={power} color="#22c55e" size={[0.012, 0.012, 0.004]} />
    </group>
  );
}

/* ---------------------------- 장비: 공유기 ---------------------------- */
export function RouterModel({ linked }) {
  const leds = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    leds.current.forEach((m, i) => { if (m) m.emissiveIntensity = i === 0 ? 1.6 : linked && Math.sin(t * (9 + i * 3)) > 0 ? 2 : 0.1; });
  });
  return (
    <group>
      <RoundedBox args={[0.22, 0.035, 0.15]} radius={0.008} position={[0, 0.0175, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
      </RoundedBox>
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={x} position={[x, 0.11, -0.07]} rotation={[i === 1 ? 0 : 0.1, 0, (i - 1) * -0.25]} castShadow>
          <cylinderGeometry args={[0.006, 0.008, 0.17, 8]} /><meshStandardMaterial color="#e5e7eb" />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.06 + i * 0.04, 0.025, 0.0755]}>
          <boxGeometry args={[0.01, 0.006, 0.002]} />
          <meshStandardMaterial ref={(el) => { leds.current[i] = el; }} color={i === 0 ? '#22c55e' : '#38bdf8'} emissive={i === 0 ? '#22c55e' : '#38bdf8'} emissiveIntensity={0.2} />
        </mesh>
      ))}
      {[-0.03, 0.03].map((x) => <mesh key={x} position={[x, 0.016, -0.0755]}><boxGeometry args={[0.018, 0.014, 0.002]} /><meshStandardMaterial color="#111" /></mesh>)}
    </group>
  );
}

/* ---------------------------- 단자·크기 정보 ---------------------------- */
export const PORTS_EXTRA = {
  e_guitar: { out: { p: [0.2, 0.88, 0.12], n: [0.55, -0.8, 0.2] } },
  keyboard: { out: { p: [0.55, 0.93, -0.162], n: [0, -0.2, -1] } },
  laptop: { out: { p: [-0.162, 0.009, 0.03], n: [-1, 0, 0] } },
  monitor: { in: { p: [0.12, 0.16, -0.218], n: [0, 0, -1] } },
  router: { lan1: { p: [-0.03, 0.016, -0.077], n: [0, 0, -1] }, lan2: { p: [0.03, 0.016, -0.077], n: [0, 0, -1] } },
};
export const GHOST_EXTRA = {
  e_guitar: [0.6, 1.8, 0.5], keyboard: [1.35, 1.0, 0.45], laptop: [0.34, 0.24, 0.26], monitor: [0.58, 0.34, 0.45], router: [0.24, 0.2, 0.16],
};
export const FOCUS_EXTRA = {
  e_guitar: { y: 1.0, dist: 1.5 }, keyboard: { y: 0.95, dist: 1.5 }, laptop: { y: 0.1, dist: 0.6 }, monitor: { y: 0.2, dist: 1.0 }, router: { y: 0.05, dist: 0.5 },
};
export const SELECT_RADIUS_EXTRA = { e_guitar: 0.4, keyboard: 0.75, laptop: 0.22, monitor: 0.38, router: 0.16 };
