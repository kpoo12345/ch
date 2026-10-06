import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Html, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { CABLES, PORT_COLOR, DEVICE_TYPES } from './engine.js';

/* =====================================================================
 * 3D 스튜디오 — 장비를 입체로 모델링하고 게임 상태(페이더·LED·탈리·
 * 스피커 진동·하울링·신호 흐름)를 실시간으로 반영한다.
 * 좌표계: x = 오른쪽, y = 위, z = 관객(화면) 쪽. 단위는 대략 미터.
 * ===================================================================== */

const DESK_TOP = 0.75;
const faceTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

const LAYOUTS = {
  pa: {
    desk: { x: 0.3, z: 0, w: 1.4, d: 0.8 },
    presenter: [-1.9, 0, -0.45],
    slots: {
      mic: { pos: [-1.9, 0, -0.02], rot: 0 },
      mixer: { pos: [0.3, DESK_TOP, 0.0], rot: 0 },
      speaker: { pos: [1.9, 0, 0.6], rot: -0.3 },
    },
    speakerFront: { pos: [-0.85, 0, 0.75], rot: faceTo([-0.85, 0, 0.75], [-1.9, 0, -0.02]) },
    camera: { pos: [0.0, 2.25, 3.9], target: [0.0, 0.95, 0.15], halfW: 2.85 },
  },
  studio: {
    desk: { x: 0.85, z: 0.15, w: 2.9, d: 0.85 },
    presenter: [-2.3, 0, -0.75],
    slots: {
      mic: { pos: [-2.3, 0, -0.3], rot: 0 },
      mixer: { pos: [0.0, DESK_TOP, 0.2], rot: 0 },
      atem: { pos: [0.85, DESK_TOP, 0.38], rot: 0 },
      pc: { pos: [1.72, DESK_TOP, 0.05], rot: -0.15 },
      cam1: { pos: [-1.15, 0, 1.0], rot: faceTo([-1.15, 0, 1.0], [-2.3, 0, -0.75]) },
      cam2: { pos: [-3.25, 0, 1.45], rot: faceTo([-3.25, 0, 1.45], [-2.3, 0, -0.75]) },
    },
    camera: { pos: [-0.6, 2.5, 4.6], target: [-0.65, 0.9, 0.3], halfW: 3.75 },
  },
};

// 장비별 단자 위치(장비 기준 로컬 좌표)와 케이블이 빠져나가는 방향
const PORTS3D = {
  dynamic_mic: { out: { p: [0, 1.42, 0.13], n: [0, -0.35, 1] } },
  condenser_mic: { out: { p: [0, 1.36, 0], n: [0, -1, 0.15] } },
  analog_mixer: {
    ch1: { p: [-0.2, 0.118, -0.19], n: [0, 0.75, -0.65] },
    ch2: { p: [-0.13, 0.118, -0.19], n: [0, 0.75, -0.65] },
    main: { p: [0.13, 0.118, -0.19], n: [0, 0.75, -0.65] },
    phones: { p: [0.2, 0.118, -0.19], n: [0, 0.75, -0.65] },
  },
  digital_mixer: {
    local1: { p: [-0.33, 0.175, -0.255], n: [0, 0.75, -0.65] },
    local2: { p: [-0.26, 0.175, -0.255], n: [0, 0.75, -0.65] },
    main: { p: [0.25, 0.175, -0.255], n: [0, 0.75, -0.65] },
    usb: { p: [0.33, 0.175, -0.255], n: [0, 0.75, -0.65] },
  },
  speaker: { in: { p: [-0.172, 1.33, -0.04], n: [-1, -0.2, 0] } },
  camera: { hdmi: { p: [0.035, 1.31, -0.153], n: [0, -0.25, -1] } }, // 카메라 뒷면 (관찰 시점 쪽)
  atem: {
    in1: { p: [-0.17, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in2: { p: [-0.12, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in3: { p: [-0.07, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in4: { p: [-0.02, 0.05, -0.088], n: [0, 0.6, -0.8] },
    usb: { p: [0.09, 0.05, -0.088], n: [0, 0.6, -0.8] },
    hdmiout: { p: [0.16, 0.05, -0.088], n: [0, 0.6, -0.8] },
  },
  pc: {
    usb1: { p: [-0.5, 0.13, 0.105], n: [0, 0, 1] },
    usb2: { p: [-0.44, 0.13, 0.105], n: [0, 0, 1] },
  },
};

const GHOST = {
  dynamic_mic: [0.34, 1.5, 0.34], condenser_mic: [0.34, 1.6, 0.34], analog_mixer: [0.54, 0.1, 0.44],
  speaker: [0.5, 1.75, 0.5], digital_mixer: [0.84, 0.18, 0.58], camera: [0.7, 1.5, 0.7],
  atem: [0.44, 0.06, 0.2], pc: [0.9, 0.5, 0.25],
};
// "가까이 보기" 시점: 바라볼 높이와 거리
const FOCUS = {
  dynamic_mic: { y: 1.3, dist: 1.3 }, condenser_mic: { y: 1.35, dist: 1.3 }, speaker: { y: 1.3, dist: 1.8 },
  camera: { y: 1.33, dist: 1.25 }, analog_mixer: { y: 0.07, dist: 0.95 }, digital_mixer: { y: 0.1, dist: 1.2 },
  atem: { y: 0.04, dist: 0.75 }, pc: { y: 0.33, dist: 1.5 },
};
// 책상 위 장비는 단자를 가리지 않도록 이름표를 앞쪽에 둔다
const FRONT_LABEL = new Set(['analog_mixer', 'digital_mixer', 'atem']);
const SELECT_RADIUS = { dynamic_mic: 0.25, condenser_mic: 0.25, speaker: 0.42, camera: 0.5, analog_mixer: 0.36, digital_mixer: 0.52, atem: 0.27, pc: 0.55 };

const MAT = { body: '#262b33', dark: '#14171c', panel: '#30363f', metal: '#a3acb7', black: '#08090b' };
const UP = new THREE.Vector3(0, 1, 0);
const noRaycast = () => null; // 장식용 메시는 클릭 판정에서 제외

function rotY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function quatFromNormal(n) {
  return new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...n).normalize());
}

/* ---------------------------- 공용 부품 ---------------------------- */
function Knob({ position, value = 0, min = -1, max = 1, color = '#d1d5db', size = 0.014 }) {
  const ang = ((value - min) / (max - min) - 0.5) * 1.5 * Math.PI;
  return (
    <group position={position} rotation={[0, -ang, 0]}>
      <mesh castShadow><cylinderGeometry args={[size, size * 1.15, size * 1.3, 20]} /><meshStandardMaterial color="#111317" roughness={0.55} /></mesh>
      <mesh position={[0, size * 0.66, 0]}><cylinderGeometry args={[size * 0.82, size * 0.82, 0.002, 20]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
      <mesh position={[0, size * 0.7, -size * 0.45]}><boxGeometry args={[size * 0.2, 0.002, size * 0.85]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} /></mesh>
    </group>
  );
}

// 모터 페이더처럼 부드럽게 움직이는 페이더 캡
function Fader({ position, value, length = 0.11, color = '#e5e7eb' }) {
  const cap = useRef();
  const target = length / 2 - (value / 100) * length;
  useFrame(() => { if (cap.current) cap.current.position.z += (target - cap.current.position.z) * 0.2; });
  return (
    <group position={position}>
      <mesh><boxGeometry args={[0.004, 0.002, length + 0.012]} /><meshStandardMaterial color="#020203" /></mesh>
      <mesh ref={cap} position={[0, 0.008, target]} castShadow>
        <boxGeometry args={[0.02, 0.014, 0.011]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Lamp({ position, on, color, size = [0.014, 0.006, 0.01], offColor = '#2b2f36', intensity = 2.2 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={on ? color : offColor} emissive={on ? color : '#000000'} emissiveIntensity={on ? intensity : 0} />
    </mesh>
  );
}

const LED_THR = [-48, -40, -32, -26, -20, -15, -10, -6, -3, 0, 3];
function LedMeter({ position, level, step = 0.0105, dir = [0, 0, -1] }) {
  return (
    <group position={position}>
      {LED_THR.map((thr, i) => {
        const on = level != null && level >= thr;
        const color = thr >= 0 ? '#ef4444' : thr >= -6 ? '#facc15' : '#22c55e';
        return <Lamp key={thr} position={[dir[0] * i * step, 0, dir[2] * i * step]} on={on} color={color} size={[0.009, 0.004, 0.007]} offColor="#15181d" intensity={1.8} />;
      })}
    </group>
  );
}

// 음파 링 (스피커 출력 / 하울링 / 말소리)
function Waves({ active, color, position, rotation, speed = 1.1, travel = 0.7, radius = 0.12, count = 3 }) {
  const refs = useRef([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * speed + i / count) % 1;
      m.scale.setScalar(0.4 + t * 2.2);
      m.position.z = t * travel;
      m.material.opacity = active ? (1 - t) * 0.55 : 0;
    });
  });
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} raycast={noRaycast}>
          <torusGeometry args={[radius, 0.005, 6, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function useCanvasTexture(w, h, draw, deps) {
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }, [w, h]);
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);
  useEffect(() => { draw(canvas.getContext('2d'), w, h); tex.needsUpdate = true; }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/* ---------------------------- 화면 그리기 (Canvas 2D) ---------------------------- */
const FONT = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

function drawScene(ctx, src, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (src === 'cam1' || src === 'cam2') {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, src === 'cam1' ? '#1e3a8a' : '#065f46');
    g.addColorStop(1, src === 'cam1' ? '#0f172a' : '#022c22');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // 흡음재 벽
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 8; i += 1) ctx.fillRect(x + i * (w / 8) + 4, y + 6, w / 8 - 8, h * 0.45);
    if (src === 'cam1') {
      ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * 1.02, w * 0.28, h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0b896'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.42, h * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f2a1d'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.36, h * 0.16, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x + w / 2 - 6, y + h * 0.62, 12, h * 0.4);
      ctx.fillStyle = '#d1d5db'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.62, 11, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#3f3a33'; ctx.fillRect(x + w * 0.45, y + h * 0.62, w * 0.5, h * 0.06);
      ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.ellipse(x + w * 0.25, y + h * 0.82, w * 0.07, h * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0b896'; ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.53, h * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9ca3af'; ctx.fillRect(x + w * 0.25 - 2, y + h * 0.6, 4, h * 0.4);
    }
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `600 ${Math.round(h * 0.07)}px ${FONT}`;
    ctx.fillText(src === 'cam1' ? 'CAM 1 · 진행자 클로즈업' : 'CAM 2 · 스튜디오 와이드', x + 10, y + h - 10);
  } else if (src === 'nosignal') {
    const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + (i * w) / 7, y, w / 7 + 1, h * 0.75); });
    ctx.fillStyle = '#111'; ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(h * 0.09)}px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('NO SIGNAL', x + w / 2, y + h * 0.92); ctx.textAlign = 'left';
  } else if (src === 'facecam') {
    ctx.fillStyle = '#57534e'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#d6d3d1'; ctx.font = `600 ${Math.round(h * 0.08)}px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText('PC 내장 웹캠 (저화질)', x + w / 2, y + h / 2); ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#64748b'; ctx.font = `600 ${Math.round(h * 0.08)}px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(src === 'black' ? 'PGM: BLACK' : '영상 소스 없음', x + w / 2, y + h / 2); ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawMeterBar(ctx, x, y, w, h, level) {
  ctx.fillStyle = '#0b0d10'; ctx.fillRect(x, y, w, h);
  if (level == null) return;
  const pct = Math.max(0, Math.min(1, (level + 60) / 66));
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#16a34a'); g.addColorStop(0.81, '#22c55e'); g.addColorStop(0.82, '#eab308'); g.addColorStop(0.9, '#eab308'); g.addColorStop(0.91, '#ef4444');
  ctx.fillStyle = g; ctx.fillRect(x, y, w * pct, h);
}

/* ---------------------------- 장비 모델 ---------------------------- */
function MicModel({ type, live, phantomOk }) {
  const grille = useRef();
  useFrame(({ clock }) => {
    if (grille.current) grille.current.emissiveIntensity = live ? 0.5 + Math.sin(clock.elapsedTime * 14) * 0.3 : 0;
  });
  return (
    <group>
      <mesh position={[0, 0.015, 0]} receiveShadow castShadow><cylinderGeometry args={[0.16, 0.17, 0.03, 32]} /><meshStandardMaterial color={MAT.dark} metalness={0.6} roughness={0.35} /></mesh>
      <mesh position={[0, 0.69, 0]} castShadow><cylinderGeometry args={[0.011, 0.011, 1.32, 12]} /><meshStandardMaterial color={MAT.metal} metalness={0.85} roughness={0.25} /></mesh>
      <mesh position={[0, 0.8, 0]}><cylinderGeometry args={[0.018, 0.018, 0.04, 12]} /><meshStandardMaterial color={MAT.dark} /></mesh>
      {type === 'dynamic_mic' ? (
        <group position={[0, 1.42, 0]}>
          <mesh position={[0, -0.03, 0.02]}><boxGeometry args={[0.03, 0.04, 0.05]} /><meshStandardMaterial color={MAT.dark} /></mesh>
          <mesh position={[0, 0, 0.035]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.021, 0.015, 0.17, 24]} />
            <meshStandardMaterial color="#1b1d21" metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, -0.055]}><torusGeometry args={[0.022, 0.004, 8, 24]} /><meshStandardMaterial color={MAT.metal} metalness={0.9} roughness={0.2} /></mesh>
          <mesh position={[0, 0, -0.085]}>
            <sphereGeometry args={[0.033, 24, 18]} />
            <meshStandardMaterial ref={grille} color="#9ca3af" metalness={0.8} roughness={0.35} emissive="#22c55e" emissiveIntensity={0} />
          </mesh>
          <mesh position={[0, 0, -0.085]}><sphereGeometry args={[0.0345, 16, 10]} /><meshBasicMaterial color="#4b5563" wireframe /></mesh>
        </group>
      ) : (
        <group position={[0, 1.5, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.055, 0.004, 8, 32]} /><meshStandardMaterial color={MAT.dark} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.055, 0.004, 8, 32]} /><meshStandardMaterial color={MAT.dark} /></mesh>
          <mesh castShadow><cylinderGeometry args={[0.032, 0.03, 0.2, 24]} /><meshStandardMaterial color="#c9b37e" metalness={0.75} roughness={0.3} /></mesh>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.0335, 0.0335, 0.09, 24]} />
            <meshStandardMaterial ref={grille} color="#d6c79a" metalness={0.7} roughness={0.45} emissive="#22c55e" emissiveIntensity={0} />
          </mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.035, 0.035, 0.09, 16, 4, true]} /><meshBasicMaterial color="#6b5d3a" wireframe /></mesh>
          <mesh position={[0, 0.116, 0]}><sphereGeometry args={[0.0335, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#d6c79a" metalness={0.7} roughness={0.45} /></mesh>
          <mesh position={[0, -0.13, 0]}><cylinderGeometry args={[0.012, 0.012, 0.06, 12]} /><meshStandardMaterial color={MAT.dark} /></mesh>
          <Lamp position={[0, -0.02, 0.033]} on={phantomOk} color="#ef4444" size={[0.008, 0.008, 0.004]} />
        </group>
      )}
    </group>
  );
}

function Presenter({ position, talking, captured }) {
  const head = useRef();
  useFrame(({ clock }) => {
    if (!head.current) return;
    const t = clock.elapsedTime;
    head.current.rotation.x = talking ? Math.sin(t * 7) * 0.05 : 0;
    head.current.rotation.y = talking ? Math.sin(t * 1.3) * 0.12 : 0;
  });
  return (
    <group position={position}>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.43, 0]} castShadow><cylinderGeometry args={[0.065, 0.055, 0.86, 14]} /><meshStandardMaterial color="#1f2937" roughness={0.8} /></mesh>
      ))}
      {[-0.09, 0.09].map((x) => (
        <mesh key={`s${x}`} position={[x, 0.03, 0.04]}><boxGeometry args={[0.1, 0.06, 0.22]} /><meshStandardMaterial color="#0b0b0b" /></mesh>
      ))}
      <mesh position={[0, 1.17, 0]} castShadow><capsuleGeometry args={[0.17, 0.36, 8, 16]} /><meshStandardMaterial color="#3b5b8f" roughness={0.75} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.22, 1.12, 0.02]} rotation={[0, 0, s * 0.12]} castShadow>
          <capsuleGeometry args={[0.05, 0.42, 6, 10]} /><meshStandardMaterial color="#3b5b8f" roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[0, 1.44, 0]}><cylinderGeometry args={[0.05, 0.06, 0.08, 12]} /><meshStandardMaterial color="#d9ae86" /></mesh>
      <group ref={head} position={[0, 1.57, 0]}>
        <mesh castShadow><sphereGeometry args={[0.115, 24, 20]} /><meshStandardMaterial color="#e0b896" roughness={0.7} /></mesh>
        <mesh position={[0, 0.035, -0.012]}><sphereGeometry args={[0.12, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2b1d14" roughness={0.9} /></mesh>
        {[-0.04, 0.04].map((x) => (
          <mesh key={x} position={[x, 0.01, 0.105]}><sphereGeometry args={[0.012, 10, 8]} /><meshStandardMaterial color="#111" /></mesh>
        ))}
      </group>
      <Waves active={talking} color={captured ? '#4ade80' : '#94a3b8'} position={[0, 1.53, 0.14]} radius={0.05} travel={0.25} speed={1.6} />
    </group>
  );
}

function AnalogMixerModel({ mixer, chLevel, mainLevel }) {
  const xs = [-0.19, -0.12, -0.05, 0.02];
  return (
    <group>
      <RoundedBox args={[0.52, 0.07, 0.42]} radius={0.012} position={[0, 0.035, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2e333b" roughness={0.6} metalness={0.2} />
      </RoundedBox>
      {[-0.27, 0.27].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]} castShadow><boxGeometry args={[0.025, 0.085, 0.43]} /><meshStandardMaterial color="#3a2a1f" roughness={0.8} /></mesh>
      ))}
      <mesh position={[0, 0.09, -0.19]} castShadow><boxGeometry args={[0.5, 0.05, 0.05]} /><meshStandardMaterial color="#1a1d22" /></mesh>
      {xs.map((x, i) => {
        const ch1 = i === 0;
        return (
          <group key={x} position={[x, 0.071, 0]}>
            <Knob position={[0, 0, -0.135]} value={ch1 ? mixer.gain : 20} min={0} max={60} color="#ef4444" />
            <Knob position={[0, 0, -0.095]} value={ch1 ? mixer.eqHigh : 0} min={-15} max={15} color="#60a5fa" size={0.012} />
            <Knob position={[0, 0, -0.06]} value={ch1 ? mixer.eqMid : 0} min={-15} max={15} color="#34d399" size={0.012} />
            <Knob position={[0, 0, -0.025]} value={ch1 ? mixer.eqLow : 0} min={-15} max={15} color="#fbbf24" size={0.012} />
            <Lamp position={[0, 0.004, 0.012]} on={ch1 && mixer.chMute} color="#ef4444" size={[0.022, 0.008, 0.014]} offColor="#40454d" />
            <Fader position={[0, 0.002, 0.11]} value={ch1 ? mixer.chFader : 0} />
          </group>
        );
      })}
      <group position={[0, 0.071, 0]}>
        <LedMeter position={[0.125, 0.003, -0.02]} level={mainLevel} />
        <LedMeter position={[0.145, 0.003, -0.02]} level={mainLevel == null ? null : mainLevel - 1.5} />
        <LedMeter position={[0.17, 0.003, -0.02]} level={chLevel} />
        <Lamp position={[0.21, 0.004, 0.012]} on={mixer.mainMute} color="#ef4444" size={[0.022, 0.008, 0.014]} offColor="#40454d" />
        <Lamp position={[0.21, 0.004, -0.13]} on={mixer.phantom} color="#f59e0b" size={[0.012, 0.006, 0.008]} />
        <Lamp position={[0.21, 0.004, -0.1]} on color="#22c55e" size={[0.008, 0.006, 0.008]} />
        <Fader position={[0.21, 0.002, 0.11]} value={mixer.mainFader} color="#f87171" />
      </group>
    </group>
  );
}

function DigitalMixerModel({ mixer, chLevel, mainLevel, screenTex }) {
  const xs = [-0.33, -0.255, -0.18, -0.105, -0.03, 0.045, 0.12, 0.195];
  const decor = [0, 62, 55, 70, 0, 48, 66, 0];
  const strip = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#22d3ee', '#94a3b8'];
  return (
    <group>
      <RoundedBox args={[0.82, 0.09, 0.56]} radius={0.015} position={[0, 0.045, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1d2026" roughness={0.55} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0.125, -0.215]} castShadow><boxGeometry args={[0.82, 0.08, 0.13]} /><meshStandardMaterial color="#23272e" roughness={0.5} /></mesh>
      <mesh position={[0.0, 0.127, -0.149]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.3, 0.075]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.168, -0.255]}><boxGeometry args={[0.8, 0.006, 0.04]} /><meshStandardMaterial color="#121418" /></mesh>
      {xs.map((x, i) => {
        const ch1 = i === 0;
        return (
          <group key={x} position={[x, 0.091, 0]}>
            <mesh position={[0, 0.001, -0.005]}><planeGeometry args={[0.055, 0.022]} /><meshBasicMaterial color={strip[i]} toneMapped={false} transparent opacity={ch1 ? 1 : 0.55} /></mesh>
            <Lamp position={[0, 0.003, 0.025]} on={ch1 ? mixer.chMute : false} color="#ef4444" size={[0.03, 0.007, 0.014]} offColor="#3a3f47" />
            <LedMeter position={[0.022, 0.003, -0.03]} level={ch1 ? chLevel : null} step={0.008} />
            <Fader position={[0, 0.002, 0.15]} value={ch1 ? mixer.chFader : decor[i]} length={0.15} />
          </group>
        );
      })}
      <group position={[-0.33, 0.091, -0.11]}>
        <Lamp position={[0, 0.003, 0]} on={mixer.phantom} color="#f59e0b" size={[0.026, 0.007, 0.013]} offColor="#3a3f47" />
        <Knob position={[0.05, 0, 0]} value={mixer.gain} min={0} max={60} color="#ef4444" />
      </group>
      <group position={[0.33, 0.091, 0]}>
        <mesh position={[0, 0.001, -0.005]}><planeGeometry args={[0.055, 0.022]} /><meshBasicMaterial color="#f8fafc" toneMapped={false} /></mesh>
        <Lamp position={[0, 0.003, 0.025]} on={mixer.mainMute} color="#ef4444" size={[0.03, 0.007, 0.014]} offColor="#3a3f47" />
        <LedMeter position={[-0.024, 0.003, -0.03]} level={mainLevel} step={0.008} />
        <LedMeter position={[0.024, 0.003, -0.03]} level={mainLevel == null ? null : mainLevel - 1.2} step={0.008} />
        <Fader position={[0, 0.002, 0.15]} value={mixer.mainFader} length={0.15} color="#f87171" />
      </group>
    </group>
  );
}

function SpeakerModel({ power, level, feedback }) {
  const cone = useRef();
  const cab = useRef();
  const light = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const amp = feedback ? 0.012 : level != null ? Math.max(0, (level + 45) / 45) * 0.008 : 0;
    if (cone.current) cone.current.position.z = 0.135 + Math.sin(t * 55) * amp;
    if (cab.current) {
      cab.current.position.x = feedback ? Math.sin(t * 70) * 0.006 : 0;
      cab.current.rotation.z = feedback ? Math.sin(t * 43) * 0.012 : 0;
    }
    if (light.current) light.current.intensity = feedback ? 1.5 + Math.sin(t * 20) * 1.2 : 0;
  });
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
          <meshStandardMaterial color="#17191d" roughness={0.75} />
        </RoundedBox>
        <mesh position={[0, -0.07, 0.151]}><circleGeometry args={[0.135, 40]} /><meshStandardMaterial color="#0a0b0d" /></mesh>
        <mesh position={[0, -0.07, 0.152]}><torusGeometry args={[0.128, 0.008, 10, 40]} /><meshStandardMaterial color="#3a3f47" metalness={0.5} /></mesh>
        <group ref={cone} position={[0, -0.07, 0.135]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.115, 0.035, 0.04, 40, 1, true]} /><meshStandardMaterial color="#202226" side={THREE.DoubleSide} roughness={0.9} /></mesh>
          <mesh position={[0, 0, -0.012]}><sphereGeometry args={[0.035, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2a2c31" /></mesh>
        </group>
        <mesh position={[0, 0.17, 0.14]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.07, 0.03, 0.04, 4, 1, true]} /><meshStandardMaterial color="#0c0d0f" side={THREE.DoubleSide} /></mesh>
        <Lamp position={[0.12, -0.25, 0.152]} on={power} color="#22c55e" size={[0.012, 0.012, 0.004]} />
        <mesh position={[-0.11, -0.25, 0.152]}><planeGeometry args={[0.08, 0.016]} /><meshBasicMaterial color="#64748b" /></mesh>
        <mesh position={[-0.171, -0.12, -0.04]}><boxGeometry args={[0.004, 0.1, 0.12]} /><meshStandardMaterial color="#2a2e35" /></mesh>
        <pointLight ref={light} color="#ef4444" distance={2.5} intensity={0} position={[0, 0, 0.4]} />
      </group>
      <Waves active={(level != null && level > -40) || feedback} color={feedback ? '#ef4444' : '#38bdf8'} position={[0, 1.38, 0.17]} radius={0.12} travel={0.9} speed={feedback ? 2.2 : 1} />
    </group>
  );
}

function CameraModel({ tally }) {
  const lamp = useRef();
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.intensity = tally === 'pgm' ? 0.8 + Math.sin(clock.elapsedTime * 3) * 0.15 : 0;
  });
  return (
    <group>
      {[0, 2.094, 4.188].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.2, 0.6, Math.cos(a) * 0.2]} rotation={[Math.cos(a) * 0.33, 0, -Math.sin(a) * 0.33]} castShadow>
          <cylinderGeometry args={[0.012, 0.009, 1.27, 8]} /><meshStandardMaterial color="#1c1f24" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.22, 0]}><cylinderGeometry args={[0.04, 0.035, 0.08, 16]} /><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0, 1.27, -0.18]} rotation={[0.9, 0, 0]}><cylinderGeometry args={[0.007, 0.007, 0.3, 8]} /><meshStandardMaterial color="#111" /></mesh>
      <group position={[0, 1.36, 0]}>
        <RoundedBox args={[0.13, 0.15, 0.3]} radius={0.015} castShadow><meshStandardMaterial color="#25282e" roughness={0.5} metalness={0.3} /></RoundedBox>
        <mesh position={[0, -0.005, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.052, 0.048, 0.13, 28]} /><meshStandardMaterial color="#111317" roughness={0.4} /></mesh>
        <mesh position={[0, -0.005, 0.266]}><circleGeometry args={[0.042, 28]} /><meshStandardMaterial color="#0b1d3a" metalness={0.9} roughness={0.05} /></mesh>
        <mesh position={[0, -0.005, 0.25]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.051, 0.004, 8, 28]} /><meshStandardMaterial color="#b91c1c" /></mesh>
        <mesh position={[-0.05, 0.1, -0.08]}><boxGeometry args={[0.05, 0.05, 0.08]} /><meshStandardMaterial color="#16181c" /></mesh>
        <mesh position={[0, 0.09, 0.02]}><boxGeometry args={[0.02, 0.025, 0.16]} /><meshStandardMaterial color="#16181c" /></mesh>
        <Lamp position={[0.035, 0.083, 0.13]} on={!!tally} color={tally === 'pgm' ? '#ef4444' : '#22c55e'} size={[0.025, 0.012, 0.02]} intensity={3} />
        <Lamp position={[0, 0.03, -0.152]} on={!!tally} color={tally === 'pgm' ? '#ef4444' : '#22c55e'} size={[0.04, 0.015, 0.004]} intensity={3} />
        <pointLight ref={lamp} color="#ef4444" distance={1} intensity={0} position={[0.035, 0.15, 0.13]} />
      </group>
    </group>
  );
}

function AtemModel({ atem, camAt }) {
  return (
    <group>
      <RoundedBox args={[0.42, 0.04, 0.19]} radius={0.01} position={[0, 0.02, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2c3036" roughness={0.45} metalness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.042, -0.088]}><boxGeometry args={[0.4, 0.008, 0.012]} /><meshStandardMaterial color="#15171b" /></mesh>
      {[1, 2, 3, 4].map((n, i) => {
        const x = -0.16 + i * 0.045;
        return (
          <group key={n}>
            <Lamp position={[x, 0.043, 0.0]} on={atem.program === n} color="#ef4444" size={[0.034, 0.008, 0.034]} offColor={camAt[n] ? '#4b5058' : '#33363c'} />
            <Lamp position={[x, 0.043, 0.05]} on={atem.preview === n} color="#22c55e" size={[0.034, 0.008, 0.034]} offColor={camAt[n] ? '#4b5058' : '#33363c'} />
          </group>
        );
      })}
      <Lamp position={[0.08, 0.043, 0.025]} on={false} color="#ffffff" size={[0.045, 0.01, 0.045]} offColor="#d4d4d8" />
      <Lamp position={[0.14, 0.043, 0.025]} on={atem.transitioning} color="#f59e0b" size={[0.045, 0.01, 0.045]} offColor="#7c5a1e" />
      <Knob position={[0.185, 0.04, -0.04]} value={0} color="#94a3b8" size={0.01} />
    </group>
  );
}

function PcModel({ screenTex, streaming }) {
  return (
    <group>
      <mesh position={[0, 0.01, -0.02]} receiveShadow castShadow><boxGeometry args={[0.24, 0.02, 0.16]} /><meshStandardMaterial color="#1b1d21" metalness={0.5} /></mesh>
      <mesh position={[0, 0.16, -0.04]} castShadow><boxGeometry args={[0.04, 0.3, 0.025]} /><meshStandardMaterial color="#1b1d21" metalness={0.5} /></mesh>
      <group position={[0, 0.42, 0]}>
        <RoundedBox args={[0.72, 0.43, 0.03]} radius={0.008} castShadow><meshStandardMaterial color="#0d0f12" roughness={0.4} /></RoundedBox>
        <mesh position={[0, 0.006, 0.0155]}><planeGeometry args={[0.69, 0.388]} /><meshBasicMaterial map={screenTex} toneMapped={false} /></mesh>
      </group>
      <group position={[-0.47, 0, 0.0]}>
        <RoundedBox args={[0.18, 0.21, 0.21]} radius={0.01} position={[0, 0.105, 0]} castShadow receiveShadow><meshStandardMaterial color="#2a2e35" metalness={0.4} roughness={0.4} /></RoundedBox>
        <Lamp position={[0.06, 0.18, 0.106]} on color="#38bdf8" size={[0.012, 0.012, 0.003]} />
      </group>
      <mesh position={[0.02, 0.008, 0.22]} castShadow><boxGeometry args={[0.42, 0.016, 0.13]} /><meshStandardMaterial color="#202328" /></mesh>
      <mesh position={[0.3, 0.012, 0.22]}><boxGeometry args={[0.06, 0.02, 0.09]} /><meshStandardMaterial color="#202328" /></mesh>
      {streaming && <pointLight color="#ef4444" distance={0.8} intensity={0.6} position={[0, 0.5, 0.3]} />}
    </group>
  );
}

/* ---------------------------- 방 / 책상 ---------------------------- */
function Room({ layout, live, studio }) {
  const sign = useCanvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = live ? '#7f1d1d' : '#1f1414'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = live ? '#fecaca' : '#3f2a2a'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = live ? '#ffffff' : '#4b3535'; ctx.font = `800 96px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ON AIR', w / 2, h / 2 + 4);
  }, [live]);
  const { desk } = layout;
  const tiles = [];
  for (let r = 0; r < 4; r += 1) for (let c = 0; c < 14; c += 1) tiles.push([-4.3 + c * 0.62, 0.5 + r * 0.62, (r + c) % 2]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 30]} /><meshStandardMaterial color="#232b3a" roughness={0.85} /></mesh>
      <Grid position={[0, 0.002, 0]} args={[30, 30]} cellSize={0.25} cellThickness={0.6} cellColor="#2c3850" sectionSize={1} sectionThickness={1} sectionColor="#3b4a68" fadeDistance={16} infiniteGrid />
      <mesh position={[0, 2, -2.3]} receiveShadow><planeGeometry args={[30, 6]} /><meshStandardMaterial color="#262f40" roughness={0.95} /></mesh>
      {tiles.map(([x, y, alt]) => (
        <mesh key={`${x}-${y}`} position={[x, y, -2.27]} rotation={[0, 0, alt ? Math.PI / 2 : 0]} receiveShadow>
          <boxGeometry args={[0.58, 0.58, alt ? 0.05 : 0.07]} />
          <meshStandardMaterial color={alt ? '#34405a' : '#2d384f'} roughness={1} />
        </mesh>
      ))}
      {studio && (
        <group position={[studio ? -0.6 : 0.3, 2.45, -2.2]}>
          <mesh><boxGeometry args={[1.05, 0.34, 0.06]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
          <mesh position={[0, 0, 0.032]}>
            <planeGeometry args={[1.0, 0.31]} />
            <meshStandardMaterial map={sign} emissive={live ? '#ff3b3b' : '#000000'} emissiveMap={sign} emissiveIntensity={live ? 1.4 : 0} toneMapped={false} />
          </mesh>
          {live && <pointLight color="#ff2a2a" intensity={2.2} distance={3} position={[0, 0, 0.4]} />}
        </group>
      )}
      <group position={[desk.x, 0, desk.z]}>
        <RoundedBox args={[desk.w, 0.04, desk.d]} radius={0.01} position={[0, DESK_TOP - 0.02, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#6b4f3a" roughness={0.6} />
        </RoundedBox>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[sx * (desk.w / 2 - 0.06), (DESK_TOP - 0.04) / 2, sz * (desk.d / 2 - 0.06)]} castShadow>
            <boxGeometry args={[0.05, DESK_TOP - 0.04, 0.05]} /><meshStandardMaterial color="#1a1c20" metalness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------------------------- 케이블 ---------------------------- */
function routePoints(A, B, layout) {
  const v = (a) => new THREE.Vector3(...a);
  const a = v(A.p), b = v(B.p);
  const an = v(A.n).normalize(), bn = v(B.n).normalize();
  const a1 = a.clone().addScaledVector(an, 0.07);
  const b1 = b.clone().addScaledVector(bn, 0.07);
  const deskBack = layout.desk.z - layout.desk.d / 2;
  const descend = (E, e1, en) => {
    if (E.onDesk) {
      return [
        new THREE.Vector3(e1.x, DESK_TOP + 0.012, Math.min(e1.z, deskBack + 0.03)),
        new THREE.Vector3(e1.x, DESK_TOP - 0.12, deskBack - 0.05),
        new THREE.Vector3(e1.x, 0.012, deskBack - 0.25),
      ];
    }
    return [
      new THREE.Vector3(e1.x + en.x * 0.04, Math.max(0.3, e1.y * 0.5), e1.z + en.z * 0.04 + 0.03),
      new THREE.Vector3(e1.x + en.x * 0.08, 0.012, e1.z + en.z * 0.08 + 0.12),
    ];
  };
  let mid;
  if (A.onDesk && B.onDesk) {
    const m = a1.clone().lerp(b1, 0.5);
    m.y = DESK_TOP + 0.012;
    const q1 = a1.clone().lerp(b1, 0.2); q1.y = Math.max(DESK_TOP + 0.02, q1.y - 0.03);
    const q2 = a1.clone().lerp(b1, 0.8); q2.y = Math.max(DESK_TOP + 0.02, q2.y - 0.03);
    mid = [q1, m, q2];
  } else {
    mid = [...descend(A, a1, an), ...descend(B, b1, bn).reverse()];
  }
  return [a, a1, ...mid, b1, b];
}

function Plug({ p, n, color }) {
  const q = useMemo(() => quatFromNormal(n), [n]);
  const pos = useMemo(() => new THREE.Vector3(...p).addScaledVector(new THREE.Vector3(...n).normalize(), 0.022), [p, n]);
  return (
    <group position={pos} quaternion={q}>
      <mesh castShadow><cylinderGeometry args={[0.014, 0.012, 0.045, 14]} /><meshStandardMaterial color="#121418" metalness={0.5} roughness={0.35} /></mesh>
      <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.0145, 0.0145, 0.008, 14]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}

function Cable3D({ A, B, layout, cable, live, onDisconnect }) {
  const color = CABLES[cable].stroke;
  const key = `${A.p.join()}|${B.p.join()}|${A.n.join()}|${B.n.join()}`;
  const curve = useMemo(() => new THREE.CatmullRomCurve3(routePoints(A, B, layout), false, 'centripetal'), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 160, 0.0095, 8, false), [curve]);
  useEffect(() => () => geo.dispose(), [geo]);
  const [hover, setHover] = useState(false);
  const pulses = useRef([]);
  useFrame(({ clock }) => {
    pulses.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.35 + i / 4) % 1;
      m.position.copy(curve.getPointAt(t));
    });
  });
  return (
    <group>
      <mesh
        geometry={geo} castShadow
        onClick={(e) => { e.stopPropagation(); if (e.delta < 6) onDisconnect(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        <meshStandardMaterial color={color} roughness={0.5} emissive={color} emissiveIntensity={hover ? 0.6 : live ? 0.18 : 0} />
      </mesh>
      {live && [0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { pulses.current[i] = el; }} raycast={noRaycast}>
          <sphereGeometry args={[0.017, 12, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      <Plug p={A.p} n={A.n} color={color} />
      <Plug p={B.p} n={B.n} color={color} />
      {hover && (
        <Html position={curve.getPointAt(0.5)} center wrapperClass="bm-noevents">
          <div className="whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[11px] text-white">{CABLES[cable].name} · 클릭하면 분리</div>
        </Html>
      )}
    </group>
  );
}

function PendingCable({ from, pointerRef, color }) {
  const mesh = useRef();
  useFrame(() => {
    const target = pointerRef.current;
    if (!mesh.current || !target) return;
    const a = new THREE.Vector3(...from.p);
    const a1 = a.clone().addScaledVector(new THREE.Vector3(...from.n).normalize(), 0.1);
    const m = a1.clone().lerp(target, 0.5);
    m.y = Math.max(0.02, Math.min(a1.y, target.y) - 0.15);
    const curve = new THREE.CatmullRomCurve3([a, a1, m, target.clone().setY(target.y + 0.02)], false, 'centripetal');
    const old = mesh.current.geometry;
    mesh.current.geometry = new THREE.TubeGeometry(curve, 48, 0.008, 6, false);
    old.dispose();
  });
  return (
    <mesh ref={mesh} raycast={noRaycast}>
      <bufferGeometry />
      <meshBasicMaterial color={color} transparent opacity={0.75} toneMapped={false} />
    </mesh>
  );
}

/* ---------------------------- 단자 ---------------------------- */
// 3D에서 단자가 촘촘한 장비는 짧은 이름을 쓴다
const SHORT_LABEL = {
  'analog_mixer:ch2': 'CH2 LINE', 'analog_mixer:ch1': 'CH1 MIC', 'analog_mixer:main': 'MAIN', 'analog_mixer:phones': 'PHONES',
  'digital_mixer:local1': 'IN 1', 'digital_mixer:local2': 'IN 2', 'digital_mixer:main': 'MAIN', 'digital_mixer:usb': 'USB',
  'atem:in1': '1', 'atem:in2': '2', 'atem:in3': '3', 'atem:in4': '4', 'atem:usb': 'USB', 'atem:hdmiout': 'OUT',
};

const SOCKET_R = { xlr: 0.017, combo: 0.018, trs: 0.011, hdmi: 0.012, sdi: 0.011, usb: 0.009 };

function Port3D({ p, n, port, label, lift = 0, used, isPending, candidate, labels, onClick }) {
  const q = useMemo(() => quatFromNormal(n), [n]);
  const ring = useRef();
  const [hover, setHover] = useState(false);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const pulse = candidate ? 1 + Math.sin(clock.elapsedTime * 8) * 0.25 : 1;
    ring.current.scale.setScalar((hover || isPending ? 1.35 : 1) * pulse);
  });
  const r = SOCKET_R[port.kind] ?? 0.014;
  const color = PORT_COLOR[port.kind];
  const nv = new THREE.Vector3(...n).normalize();
  const labelPos = new THREE.Vector3(...p).addScaledVector(nv, 0.05).add(new THREE.Vector3(0, 0.03 + lift, 0));
  return (
    <group>
      <group position={p} quaternion={q}>
        <mesh><cylinderGeometry args={[r, r, 0.012, 20]} /><meshStandardMaterial color="#050608" roughness={0.3} /></mesh>
        <mesh ref={ring} position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r + 0.003, 0.0035, 8, 24]} />
          <meshStandardMaterial
            color={isPending ? '#ffffff' : color}
            emissive={isPending || candidate || hover ? (isPending ? '#ffffff' : color) : '#000000'}
            emissiveIntensity={isPending ? 2 : candidate || hover ? 1.4 : 0}
          />
        </mesh>
        {/* 클릭 판정용 투명 구 */}
        <mesh
          onClick={(e) => { e.stopPropagation(); if (e.delta < 6) onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'crosshair'; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        >
          <sphereGeometry args={[0.042, 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {(labels || hover || isPending || candidate) && (
        <Html position={labelPos} center zIndexRange={[20, 0]} wrapperClass="bm-noevents">
          <div className={`whitespace-nowrap rounded px-1 py-[1px] font-mono text-[10px] leading-tight ${isPending ? 'bg-white text-slate-900' : candidate ? 'bg-sky-500 text-white' : 'bg-black/75 text-slate-100'} ${used ? 'opacity-70' : ''}`}
            style={{ borderLeft: `3px solid ${color}` }}>
            {isPending || hover || candidate ? port.label : label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ---------------------------- 배치 연출 / 선택 표시 ---------------------------- */
function DropIn({ children }) {
  const g = useRef();
  const started = useRef(false);
  useFrame((_, dt) => {
    if (!g.current) return;
    if (!started.current) { g.current.position.y = 0.9; started.current = true; }
    g.current.position.y *= Math.exp(-Math.min(dt, 0.1) * 9);
  });
  return <group ref={g}>{children}</group>;
}

function SelectRing({ radius }) {
  const m = useRef();
  useFrame(({ clock }) => { if (m.current) m.current.material.opacity = 0.55 + Math.sin(clock.elapsedTime * 4) * 0.25; });
  return (
    <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} raycast={noRaycast}>
      <ringGeometry args={[radius, radius + 0.025, 48]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function FeedbackArc({ from, to }) {
  const m = useRef();
  const geo = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const c = a.clone().lerp(b, 0.5); c.y += 0.9;
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), 60, 0.012, 6, false);
  }, [from.join(), to.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }) => { if (m.current) m.current.material.opacity = 0.35 + Math.sin(clock.elapsedTime * 12) * 0.3; });
  return (
    <mesh ref={m} geometry={geo} raycast={noRaycast}>
      <meshBasicMaterial color="#ef4444" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function CameraRig({ layout, resetKey, shake, portWorld, focus }) {
  const { camera, controls, gl, size } = useThree();
  // 자동 테스트용 훅: window.__BM_TEST가 있을 때만 단자의 화면 좌표를 계산해 준다
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__BM_TEST) return;
    window.__BM_TEST.project = (d, p) => {
      const v = new THREE.Vector3(...portWorld(d, p).p).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
  });
  // 화면 비율에 맞춰 모든 장비가 보이도록 카메라 거리를 자동 조정
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    const target = new THREE.Vector3(...layout.camera.target);
    const dir = new THREE.Vector3(...layout.camera.pos).sub(target);
    const base = dir.length();
    const fit = (layout.camera.halfW * (aspect < 1 ? 0.78 : 1)) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    const dist = Math.min(11, Math.max(base, fit * 1.05));
    camera.position.copy(target).addScaledVector(dir.normalize(), dist);
    if (controls) { controls.target.copy(target); controls.update(); }
  }, [layout, resetKey, controls, camera, Math.round(aspect * 20)]); // eslint-disable-line react-hooks/exhaustive-deps
  // 더블클릭한 장비로 부드럽게 다가가기
  const anim = useRef(null);
  useEffect(() => {
    if (!focus) return;
    const target = new THREE.Vector3(...focus.target);
    const dir = camera.position.clone().sub(controls ? controls.target : target).normalize();
    dir.y = Math.max(dir.y, 0.45); dir.normalize();
    anim.current = { target, pos: target.clone().addScaledVector(dir, focus.dist), t: 0 };
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame(({ clock }, dt) => {
    const a = anim.current;
    if (a && controls) {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 5);
      controls.target.lerp(a.target, k);
      camera.position.lerp(a.pos, k);
      controls.update();
      a.t += dt;
      if (a.t > 1.6 || camera.position.distanceTo(a.pos) < 0.01) anim.current = null;
    }
    if (shake) camera.position.x += Math.sin(clock.elapsedTime * 90) * 0.0025;
  });
  return null;
}

// 첫 프레임이 그려진 뒤에 자식을 렌더링한다.
// (drei <Html>이 캔버스 준비 전에 만들어지면 첫 라벨이 비어 버리는 문제 회피)
function AfterFirstFrame({ children }) {
  const [ready, setReady] = useState(false);
  useFrame(() => { if (!ready) setReady(true); });
  return ready ? children : null;
}

/* =====================================================================
 * Studio3D
 * ===================================================================== */
export default function Studio3D({
  stageId, devices, connections, mixer, speaker, atem, obs, actual, nominal, talking, jitter, viewers,
  pending, selectedCable, selectedDevice, labels, resetKey, focusRequest,
  onPortClick, onSelectDevice, onDisconnect, onPlace, onCancelPending,
}) {
  const studio = stageId >= 3;
  const layout = studio ? LAYOUTS.studio : LAYOUTS.pa;
  const pointerRef = useRef(null);
  const [focus, setFocus] = useState(null);
  useEffect(() => { setFocus(null); }, [resetKey]);
  const lv = (x) => (x == null ? null : x + (talking ? jitter : 0));

  const slotOf = (id) => {
    if (id === 'speaker' && !studio && speaker.position === 'front') return layout.speakerFront;
    return layout.slots[id];
  };
  const portWorld = (d, portId) => {
    const slot = slotOf(d);
    const def = PORTS3D[devices[d].type][portId];
    const lp = rotY(def.p, slot.rot);
    return {
      p: [slot.pos[0] + lp[0], slot.pos[1] + lp[1], slot.pos[2] + lp[2]],
      n: rotY(def.n, slot.rot),
      onDesk: slot.pos[1] > 0.5,
    };
  };
  const isUsed = (d, p) => connections.some((c) => (c.from.d === d && c.from.p === p) || (c.to.d === d && c.to.p === p));
  const camTally = (id) => {
    const n = Object.entries(nominal.camAt).find(([, c]) => c === id)?.[0];
    if (!n) return null;
    if (Number(n) === atem.program) return 'pgm';
    if (Number(n) === atem.preview) return 'pvw';
    return null;
  };
  const connLive = (c) => {
    if (c.from.d === 'mic') return actual.chIn != null;
    if (c.from.d === 'mixer' && c.from.p === 'main') return actual.mainOut != null;
    if (c.from.d === 'mixer' && c.from.p === 'usb') return actual.usbSignal != null;
    if (c.from.d.startsWith('cam')) return true;
    if (c.from.d === 'atem') return c.from.p === 'usb' ? !!nominal.programCam : true;
    return false;
  };

  // 화면 텍스처: OBS 모니터, X32 스크린
  const obsAudioLv = lv(actual.obsAudio);
  const obsTex = useCanvasTexture(1024, 576, (ctx, w, h) => {
    ctx.fillStyle = '#1b1c22'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a2c35'; ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#cbd5e1'; ctx.font = `600 18px ${FONT}`;
    ctx.fillText('OBS Studio  —  장면: 메인 라이브', 14, 23);
    const px = 24, py = 46, pw = w - 48, ph = 360;
    ctx.fillStyle = '#000'; ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    drawScene(ctx, nominal.obsVideo, px, py, pw, ph);
    if (atem.transitioning && obs.videoSource === 'atem') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px, py, pw, ph); }
    if (obs.streaming) {
      ctx.fillStyle = '#dc2626'; ctx.fillRect(px + pw - 120, py + 12, 106, 36);
      ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText('● LIVE', px + pw - 108, py + 38);
    }
    const ay = py + ph + 22;
    ctx.fillStyle = '#23252d'; ctx.fillRect(px, ay, pw * 0.62, h - ay - 16);
    ctx.fillStyle = '#94a3b8'; ctx.font = `600 17px ${FONT}`; ctx.fillText('오디오 믹서', px + 14, ay + 26);
    ctx.fillStyle = '#e2e8f0'; ctx.font = `500 16px ${FONT}`;
    ctx.fillText(obs.audioSource === 'x32' ? 'X32 USB Audio' : obs.audioSource === 'builtin' ? 'PC 내장 마이크' : '오디오 소스 없음', px + 14, ay + 58);
    drawMeterBar(ctx, px + 14, ay + 70, pw * 0.62 - 90, 22, obsAudioLv);
    ctx.fillStyle = obs.audioMuted ? '#dc2626' : '#475569'; ctx.fillRect(px + pw * 0.62 - 64, ay + 66, 50, 30);
    ctx.fillStyle = '#fff'; ctx.font = `700 14px ${FONT}`; ctx.fillText(obs.audioMuted ? 'MUTE' : 'ON', px + pw * 0.62 - 58, ay + 86);
    const bx = px + pw * 0.62 + 16, bw = pw * 0.38 - 16;
    ctx.fillStyle = obs.streaming ? '#e2e8f0' : '#dc2626'; ctx.fillRect(bx, ay, bw, 50);
    ctx.fillStyle = obs.streaming ? '#0f172a' : '#fff'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(obs.streaming ? '방송 중지' : '방송 시작', bx + bw / 2, ay + 33);
    ctx.fillStyle = '#94a3b8'; ctx.font = `500 16px ${FONT}`;
    ctx.fillText(obs.streaming ? `시청자 ${viewers.toLocaleString()}명` : 'OFFLINE', bx + bw / 2, ay + 86);
    ctx.textAlign = 'left';
  }, [nominal.obsVideo, obs.streaming, obs.audioSource, obs.audioMuted, obs.videoSource, atem.transitioning, Math.round((obsAudioLv ?? -99) / 2), viewers]);

  const chLv = lv(actual.chIn);
  const mainLv = lv(actual.mainOut);
  const x32Tex = useCanvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0ea5e9'; ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = '#fff'; ctx.font = `700 28px ${FONT}`; ctx.fillText('X32  ROUTING / METERS', 16, 32);
    const srcName = { local1: 'Local In 1', local2: 'Local In 2', aes50a1: 'AES50 A-1', off: 'Off' }[mixer.ch1Source];
    const usbName = { main: 'Main L/R', bus1: 'Mix Bus 1', off: 'Off' }[mixer.usbOut];
    const rows = [
      ['CH01 입력', srcName, nominal.micAtCh],
      ['USB 출력', usbName, mixer.usbOut === 'main'],
      ['+48V', mixer.phantom ? 'ON' : 'OFF', mixer.phantom || devices.mic?.type !== 'condenser_mic'],
    ];
    rows.forEach(([k, v, ok], i) => {
      const y = 92 + i * 56;
      ctx.fillStyle = '#94a3b8'; ctx.font = `500 28px ${FONT}`; ctx.fillText(k, 16, y);
      ctx.fillStyle = ok ? '#4ade80' : '#f87171'; ctx.font = `700 32px ${FONT}`; ctx.fillText(v, 190, y);
    });
    ctx.fillStyle = '#94a3b8'; ctx.font = `500 26px ${FONT}`;
    ctx.fillText('CH01', 520, 110); drawMeterBar(ctx, 600, 88, w - 620, 30, chLv);
    ctx.fillText('MAIN', 520, 180); drawMeterBar(ctx, 600, 158, w - 620, 30, mainLv);
    if (mixer.chMute || mixer.mainMute) {
      ctx.fillStyle = '#dc2626'; ctx.fillRect(600, 206, 260, 38);
      ctx.fillStyle = '#fff'; ctx.font = `700 24px ${FONT}`;
      ctx.fillText(mixer.chMute && mixer.mainMute ? 'CH01 + MAIN MUTE' : mixer.chMute ? 'CH01 MUTE' : 'MAIN MUTE', 612, 234);
    }
  }, [mixer.ch1Source, mixer.usbOut, mixer.phantom, mixer.chMute, mixer.mainMute, nominal.micAtCh, Math.round((chLv ?? -99) / 3), Math.round((mainLv ?? -99) / 3)]);

  const focusDevice = (id) => {
    const slot = slotOf(id);
    const f = FOCUS[devices[id].type] ?? { y: 0.5, dist: 1.5 };
    setFocus({ target: [slot.pos[0], slot.pos[1] + f.y, slot.pos[2]], dist: f.dist, key: Date.now() });
    onSelectDevice(id);
  };

  useEffect(() => {
    if (focusRequest && devices[focusRequest.id]?.placed) focusDevice(focusRequest.id);
  }, [focusRequest?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const micSlot = layout.slots.mic;
  const spkSlot = slotOf('speaker');
  const placed = Object.values(devices).filter((d) => d.placed);
  const ghosts = Object.values(devices).filter((d) => !d.placed);
  const pendingWorld = pending ? portWorld(pending.d, pending.p) : null;

  const renderModel = (d) => {
    switch (d.type) {
      case 'dynamic_mic':
      case 'condenser_mic':
        return <MicModel type={d.type} live={actual.chIn != null} phantomOk={nominal.micPowered && d.type === 'condenser_mic' && mixer.phantom} />;
      case 'analog_mixer': return <AnalogMixerModel mixer={mixer} chLevel={chLv} mainLevel={mainLv} />;
      case 'digital_mixer': return <DigitalMixerModel mixer={mixer} chLevel={chLv} mainLevel={mainLv} screenTex={x32Tex} />;
      case 'speaker': return <SpeakerModel power={speaker.power} level={lv(actual.speakerLevel)} feedback={actual.feedback} />;
      case 'camera': return <CameraModel tally={camTally(d.id)} />;
      case 'atem': return <AtemModel atem={atem} camAt={nominal.camAt} />;
      case 'pc': return <PcModel screenTex={obsTex} streaming={obs.streaming} />;
      default: return null;
    }
  };

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 40, position: layout.camera.pos, near: 0.05, far: 60 }}
      onPointerMissed={() => onCancelPending()}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#131a27']} />
      <fog attach="fog" args={['#131a27', 10, 24]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#d6e2f5', '#2a2622', 1.0]} />
      <directionalLight
        position={[3.5, 6, 4]} intensity={2.4} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5}
        shadow-bias={-0.0004}
      />
      <spotLight position={[-2.5, 4.2, 2.5]} angle={0.55} penumbra={0.7} intensity={30} decay={1.4} color="#ffe4c4" />
      <spotLight position={[1.2, 3.6, 2.2]} angle={0.6} penumbra={0.8} intensity={22} decay={1.4} color="#f1f5ff" />
      <pointLight position={[1, 2.6, 1.2]} intensity={2.2} distance={6} color="#a5c8ff" />

      <CameraRig layout={layout} resetKey={resetKey} shake={actual.feedback} portWorld={portWorld} focus={focus} />
      <OrbitControls
        makeDefault enableDamping dampingFactor={0.08}
        minDistance={1.2} maxDistance={12} maxPolarAngle={Math.PI / 2.08}
      />

      <group onPointerMove={(e) => { if (pending) pointerRef.current = e.point.clone(); }}>
        <Room layout={layout} live={obs.streaming} studio={studio} />
        <Presenter position={layout.presenter} talking={talking} captured={actual.chIn != null} />
        <AfterFirstFrame>

        {placed.map((d) => {
          const slot = slotOf(d.id);
          const selected = selectedDevice === d.id;
          const ports = PORTS3D[d.type];
          const def = DEVICE_TYPES[d.type];
          return (
            <group key={d.id}>
              <group
                position={slot.pos} rotation={[0, slot.rot, 0]}
                onClick={(e) => { e.stopPropagation(); if (e.delta < 6) onSelectDevice(d.id); }}
                onDoubleClick={(e) => { e.stopPropagation(); focusDevice(d.id); }}
              >
                <DropIn>{renderModel(d)}</DropIn>
                {selected && <SelectRing radius={SELECT_RADIUS[d.type] ?? 0.3} />}
                <Html position={FRONT_LABEL.has(d.type) ? [0, 0.03, GHOST[d.type][2] / 2 + 0.09] : [0, GHOST[d.type][1] + 0.16, 0]} center zIndexRange={[30, 0]}>
                  <button type="button" onClick={() => onSelectDevice(d.id)} onDoubleClick={() => focusDevice(d.id)} data-device-label={d.id}
                    title="클릭: 제어 패널 · 더블클릭: 확대해서 보기"
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${selected ? 'bg-sky-500 text-white' : 'bg-slate-900/80 text-slate-200 hover:bg-slate-700'}`}>
                    {d.name ?? def.name}
                  </button>
                </Html>
              </group>
              {Object.keys(ports).map((pid, idx) => {
                const port = [...def.ins, ...def.outs].find((pp) => pp.id === pid);
                const dir = def.ins.some((pp) => pp.id === pid) ? 'in' : 'out';
                const w = portWorld(d.id, pid);
                const used = isUsed(d.id, pid);
                const isPending = pending && pending.d === d.id && pending.p === pid;
                const candidate = pending && !isPending && pending.dir !== dir && pending.d !== d.id && !used;
                return (
                  <Port3D key={pid} p={w.p} n={w.n} port={port} label={SHORT_LABEL[`${d.type}:${pid}`] ?? port.label}
                    lift={FRONT_LABEL.has(d.type) && idx % 2 ? 0.035 : 0} used={used} isPending={isPending} candidate={candidate}
                    labels={labels} onClick={() => onPortClick(d.id, pid)} />
                );
              })}
            </group>
          );
        })}

        {ghosts.map((d) => {
          const slot = slotOf(d.id);
          const size = GHOST[d.type] ?? [0.4, 0.4, 0.4];
          return (
            <group key={d.id} position={slot.pos} rotation={[0, slot.rot, 0]}>
              <mesh position={[0, size[1] / 2, 0]}>
                <boxGeometry args={size} />
                <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.35} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
                <circleGeometry args={[Math.max(size[0], size[2]) * 0.7, 40]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} depthWrite={false} />
              </mesh>
              <Html position={[0, size[1] + 0.15, 0]} center zIndexRange={[40, 0]}>
                <button type="button" onClick={() => onPlace(d.id)}
                  className="whitespace-nowrap rounded-full border border-sky-300 bg-sky-600/90 px-3 py-1 text-[12px] font-bold text-white shadow-lg hover:bg-sky-500">
                  + {d.name ?? DEVICE_TYPES[d.type].name} 배치
                </button>
              </Html>
            </group>
          );
        })}

        {connections.map((c) => (
          <Cable3D key={c.id} A={portWorld(c.from.d, c.from.p)} B={portWorld(c.to.d, c.to.p)} layout={layout}
            cable={c.cable} live={connLive(c)} onDisconnect={() => onDisconnect(c)} />
        ))}

        {pendingWorld && <PendingCable from={pendingWorld} pointerRef={pointerRef} color={selectedCable ? CABLES[selectedCable].stroke : '#94a3b8'} />}

        {actual.feedback && devices.speaker?.placed && devices.mic?.placed && (
          <FeedbackArc from={[spkSlot.pos[0], 1.45, spkSlot.pos[2]]} to={[micSlot.pos[0], 1.42, micSlot.pos[2]]} />
        )}
        </AfterFirstFrame>
      </group>
    </Canvas>
  );
}
