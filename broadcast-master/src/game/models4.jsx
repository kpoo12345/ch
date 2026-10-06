import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Lamp, noRaycast } from './kit3d.jsx';
import { Person, DrumKit } from './models2.jsx';

/* =====================================================================
 * 악기·드럼 마이크 3D 모델
 *  - 드럼 마이크: 킥(낮은 스탠드 + 큰 다이나믹), 스네어(짧은 붐 + SM57형), 오버헤드(긴 붐 + 펜슬 콘덴서)
 *  - 디지털 피아노(뒷면 OUT L/R), 베이스 기타, 드럼 세트(자유 모드용)
 * 장비 로컬 +z = 마이크가 향하는 쪽(소리를 받는 쪽)
 * ===================================================================== */
const NR = { raycast: noRaycast };
const METAL = <meshStandardMaterial color="#1f2329" metalness={0.65} roughness={0.35} />;

// 마이크 스탠드: 삼각 다리 + 기둥 + 붐(팔)
function BoomStand({ h, boomLen, boomTilt }) {
  const legs = [0, 2.1, 4.2];
  return (
    <group>
      {legs.map((a) => (
        <mesh key={a} {...NR} position={[Math.sin(a) * 0.1, 0.03, Math.cos(a) * 0.1]} rotation={[Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2]} castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.24, 6]} />{METAL}
        </mesh>
      ))}
      <mesh {...NR} position={[0, h / 2, 0]} castShadow><cylinderGeometry args={[0.009, 0.011, h, 8]} />{METAL}</mesh>
      {boomLen > 0 && (
        <group position={[0, h, 0]} rotation={[boomTilt, 0, 0]}>
          <mesh {...NR} position={[0, 0, boomLen / 2 - 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.007, 0.007, boomLen, 8]} />{METAL}</mesh>
        </group>
      )}
    </group>
  );
}

function useLiveGlow(live) {
  const m = useRef();
  useFrame(({ clock }) => { if (m.current) m.current.emissiveIntensity = live ? 0.35 + Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.4 : 0; });
  return m;
}

// 킥 드럼 마이크 (Beta 52 타입): 낮은 스탠드, 큰 달걀형 헤드가 킥 드럼 앞 구멍을 향한다
export function KickMicModel({ live }) {
  const g = useLiveGlow(live);
  return (
    <group>
      <BoomStand h={0.2} boomLen={0} />
      <group position={[0, 0.27, 0.02]} rotation={[0.25, 0, 0]}>
        <mesh {...NR} position={[0, -0.02, -0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.024, 0.02, 0.1, 18]} /><meshStandardMaterial color="#111317" metalness={0.4} roughness={0.4} /></mesh>
        <mesh {...NR} position={[0, -0.02, 0.03]} scale={[1, 1, 1.25]} castShadow><sphereGeometry args={[0.042, 22, 16]} /><meshStandardMaterial ref={g} color="#4b5563" metalness={0.75} roughness={0.35} emissive="#22c55e" emissiveIntensity={0} /></mesh>
        <mesh {...NR} position={[0, -0.02, 0.03]} scale={[1, 1, 1.25]}><sphereGeometry args={[0.0425, 14, 10]} /><meshBasicMaterial color="#1f2937" wireframe /></mesh>
      </group>
    </group>
  );
}

// 스네어 마이크 (SM57 타입): 짧은 붐, 가늘고 긴 몸통이 스네어 윗면을 비스듬히 본다
export function SnareMicModel({ live }) {
  const g = useLiveGlow(live);
  return (
    <group>
      <BoomStand h={0.62} boomLen={0.3} boomTilt={-0.35} />
      <group position={[0, 0.69, 0.18]} rotation={[0.75, 0, 0]}>
        <mesh {...NR} position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.012, 0.011, 0.13, 16]} /><meshStandardMaterial color="#15171b" metalness={0.4} roughness={0.35} /></mesh>
        <mesh {...NR} position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.0135, 0.012, 0.045, 16]} /><meshStandardMaterial ref={g} color="#374151" metalness={0.7} roughness={0.4} emissive="#22c55e" emissiveIntensity={0} /></mesh>
      </group>
    </group>
  );
}

// 오버헤드 (펜슬형 콘덴서): 긴 붐 스탠드 끝에서 드럼 위를 내려다본다
export function OverheadMicModel({ live, phantomOk }) {
  const g = useLiveGlow(live);
  return (
    <group>
      <BoomStand h={1.35} boomLen={0.75} boomTilt={-0.42} />
      <group position={[0, 1.6, 0.53]} rotation={[1.25, 0, 0]}>
        <mesh {...NR} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.0105, 0.0105, 0.13, 16]} /><meshStandardMaterial color="#d1d5db" metalness={0.8} roughness={0.25} /></mesh>
        <mesh {...NR} position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.011, 0.011, 0.018, 16]} /><meshStandardMaterial ref={g} color="#9ca3af" metalness={0.8} roughness={0.35} emissive="#22c55e" emissiveIntensity={0} /></mesh>
        <Lamp position={[0, 0.012, -0.02]} on={!!phantomOk} color="#ef4444" size={[0.004, 0.003, 0.004]} />
      </group>
    </group>
  );
}

// 디지털 피아노 (88건반 스테이지 피아노 + X 스탠드). 뒷면 오른쪽에 OUT L/MONO · R 단자
export function DigitalPianoModel({ performing, player = true }) {
  const black = useRef();
  const blackGeo = useMemo(() => new THREE.BoxGeometry(0.009, 0.012, 0.08), []);
  useEffect(() => () => blackGeo.dispose(), [blackGeo]);
  useEffect(() => {
    if (!black.current) return;
    const d = new THREE.Object3D();
    let k = 0;
    for (let oct = 0; oct < 7; oct += 1) {
      [0, 1, 3, 4, 5].forEach((j) => {
        d.position.set(-0.62 + oct * 0.176 + (j + 0.7) * 0.025, 0.966, 0.03); d.updateMatrix();
        black.current.setMatrixAt(k, d.matrix); k += 1;
      });
    }
    black.current.count = k;
    black.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      {[-0.48, 0.48].map((x) => [-1, 1].map((s) => (
        <mesh key={`${x}${s}`} {...NR} position={[x, 0.44, 0]} rotation={[s * 0.62, 0, 0]} castShadow><boxGeometry args={[0.03, 1.02, 0.03]} /><meshStandardMaterial color="#111" metalness={0.6} /></mesh>
      )))}
      <RoundedBox args={[1.38, 0.1, 0.34]} radius={0.02} position={[0, 0.92, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#7f1d1d" roughness={0.35} metalness={0.25} />
      </RoundedBox>
      <mesh {...NR} position={[0, 0.957, 0.045]}><boxGeometry args={[1.26, 0.012, 0.16]} /><meshStandardMaterial color="#f8fafc" roughness={0.4} /></mesh>
      <instancedMesh ref={black} args={[blackGeo, undefined, 35]} castShadow><meshStandardMaterial color="#0b0b0b" roughness={0.4} /></instancedMesh>
      {/* 볼륨 노브 · 음색 버튼 */}
      <mesh {...NR} position={[-0.55, 0.972, -0.1]}><cylinderGeometry args={[0.012, 0.012, 0.012, 16]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
      {[-0.4, -0.36, -0.32, -0.28].map((x, i) => <Lamp key={x} position={[x, 0.971, -0.1]} on={i === 0} color="#f59e0b" size={[0.022, 0.006, 0.012]} />)}
      <mesh {...NR} position={[0.0, 0.971, -0.105]}><planeGeometry args={[0.16, 0.035]} /><meshBasicMaterial color="#0ea5e9" toneMapped={false} /></mesh>
      {player && <Person position={[0, 0, -0.5]} shirt="#4c1d95" hands="keys" playing={performing} singing={false} />}
    </group>
  );
}

// 베이스 기타 (4현, 긴 넥)
export function BassGuitarModel({ performing }) {
  return (
    <group>
      <Person position={[0, 0, -0.08]} shirt="#0f766e" hands="guitar" playing={performing} />
      <group position={[0.02, 0.96, 0.1]} rotation={[0, 0, 0.5]}>
        <mesh castShadow position={[0.07, -0.03, 0]}><cylinderGeometry args={[0.16, 0.16, 0.05, 28]} /><meshStandardMaterial color="#1e3a8a" metalness={0.35} roughness={0.35} /></mesh>
        <mesh castShadow position={[-0.09, 0.07, 0]}><cylinderGeometry args={[0.12, 0.12, 0.05, 28]} /><meshStandardMaterial color="#1e3a8a" metalness={0.35} roughness={0.35} /></mesh>
        <mesh position={[0.06, -0.01, 0.026]}><boxGeometry args={[0.1, 0.035, 0.004]} /><meshStandardMaterial color="#111" /></mesh>
        <mesh position={[-0.5, 0.0, 0.0]} rotation={[0, 0, Math.PI / 2]} castShadow><boxGeometry args={[0.055, 0.66, 0.026]} /><meshStandardMaterial color="#5b3a1e" roughness={0.6} /></mesh>
        <mesh position={[-0.88, 0.0, 0.0]}><boxGeometry args={[0.13, 0.08, 0.022]} /><meshStandardMaterial color="#111" /></mesh>
        {[-0.012, -0.004, 0.004, 0.012].map((y) => <mesh key={y} {...NR} position={[-0.38, y, 0.016]}><boxGeometry args={[0.9, 0.0016, 0.0016]} /><meshStandardMaterial color="#e5e7eb" metalness={0.8} /></mesh>)}
      </group>
      <mesh position={[0.22, 0.86, 0.12]}><cylinderGeometry args={[0.009, 0.009, 0.014, 12]} /><meshStandardMaterial color="#cfd5dc" metalness={0.9} /></mesh>
    </group>
  );
}

// 자유 모드에서 놓는 드럼 세트 (공연장 무대에는 기본으로 있다)
export function DrumKitModel({ performing }) {
  return <DrumKit performing={performing} />;
}

// 단자 위치·크기·초점 (장비 로컬)
export const PORTS_INSTR = {
  kick_mic: { out: { p: [0, 0.255, -0.12], n: [0, -0.3, -1] } },
  snare_mic: { out: { p: [0, 0.73, 0.12], n: [0, 0.6, -0.8] } },
  overhead_mic: { out: { p: [0, 1.66, 0.48], n: [0, 0.8, -0.6] } },
  digital_piano: { outL: { p: [0.5, 0.93, -0.172], n: [0, -0.2, -1] }, outR: { p: [0.57, 0.93, -0.172], n: [0, -0.2, -1] } },
  bass_guitar: { out: { p: [0.22, 0.86, 0.12], n: [0.55, -0.8, 0.2] } },
  drum_kit: {},
};
export const GHOST_INSTR = {
  kick_mic: [0.3, 0.35, 0.3], snare_mic: [0.3, 0.8, 0.45], overhead_mic: [0.35, 1.7, 0.9], digital_piano: [1.4, 1.0, 0.45], bass_guitar: [0.6, 1.8, 0.5], drum_kit: [1.6, 1.4, 1.4],
};
export const FOCUS_INSTR = {
  kick_mic: { y: 0.25, dist: 0.9 }, snare_mic: { y: 0.65, dist: 1.0 }, overhead_mic: { y: 1.3, dist: 1.8 }, digital_piano: { y: 0.95, dist: 1.6 }, bass_guitar: { y: 1.0, dist: 1.5 }, drum_kit: { y: 0.8, dist: 2.6 },
};
export const SELECT_RADIUS_INSTR = { kick_mic: 0.2, snare_mic: 0.25, overhead_mic: 0.35, digital_piano: 0.75, bass_guitar: 0.4, drum_kit: 0.9 };
export const INSTR_TYPES = new Set(Object.keys(PORTS_INSTR));
