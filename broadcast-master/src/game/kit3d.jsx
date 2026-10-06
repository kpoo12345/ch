import React, { useMemo, useRef, useEffect, useState, useContext, createContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/* =====================================================================
 * 3D 공용 부품 — 캔버스 래퍼, 라벨, 노브·페이더·램프·미터, 텍스처 도우미
 * (교육 뷰어, 공연장 3D, 믹서 모델이 함께 사용)
 * ===================================================================== */
export const DESK_TOP = 0.75;
export const faceTo = (from, to) => Math.atan2(to[0] - from[0], to[2] - from[2]);

export const MAT = { body: '#262b33', dark: '#14171c', panel: '#30363f', metal: '#a3acb7', black: '#08090b' };
export const UP = new THREE.Vector3(0, 1, 0);
export const noRaycast = () => null; // 장식용 메시는 클릭 판정에서 제외

export function rotY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
export function quatFromNormal(n) {
  return new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...n).normalize());
}


/* ---------------------------- 캔버스 / 라벨 래퍼 ----------------------------
 * drei <Html> 라벨은 캔버스가 사라질 때 붙어 있던 부모를 잃어 removeChild 오류를 낸다.
 * 캔버스 위에 고정 오버레이를 두고, 모든 라벨을 그 오버레이에 붙여 부모가 바뀌지 않게 한다. */
export const PortalCtx = createContext(null);
export function Label(props) {
  const portal = useContext(PortalCtx);
  return <Html portal={portal ?? undefined} {...props} />;
}

// WebGL 지원 여부 (하드웨어 가속이 꺼져 있거나 오래된 브라우저면 false)
let webglCache;
export function hasWebGL() {
  if (webglCache !== undefined) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { webglCache = false; }
  return webglCache;
}
// 3D가 실패해도 앱 전체가 멈추지 않도록 캔버스만 안내 화면으로 바꾼다
class GLBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn('3D 화면을 그리지 못했습니다:', err?.message); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function NoWebGL({ hint }) {
  return (
    <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-center p-6 bg-[#131a27] text-slate-300">
      <div className="text-base font-bold text-slate-100">이 브라우저에서는 3D 화면을 표시할 수 없습니다</div>
      <p className="text-sm max-w-md">브라우저 설정에서 하드웨어 가속(그래픽 가속)을 켜거나 최신 Chrome·Edge·Safari에서 열어 주세요.</p>
      {hint && <p className="text-sm text-sky-300 max-w-md">{hint}</p>}
    </div>
  );
}
export function CanvasShell({ children, fallback, ...canvasProps }) {
  const portal = useMemo(() => ({ current: null }), []);
  const fb = fallback === undefined ? <NoWebGL /> : fallback;
  if (!hasWebGL()) return fb;
  return (
    <div className="relative w-full h-full">
      <PortalCtx.Provider value={portal}>
        <GLBoundary fallback={fb}><Canvas {...canvasProps}>{children}</Canvas></GLBoundary>
      </PortalCtx.Provider>
      <div ref={(el) => { if (el) portal.current = el; }} className="absolute inset-0 pointer-events-none overflow-hidden" />
    </div>
  );
}

/* ---------------------------- 공용 부품 ---------------------------- */
export function Knob({ position, value = 0, min = -1, max = 1, color = '#d1d5db', size = 0.014 }) {
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
export function Fader({ position, value, length = 0.11, color = '#e5e7eb' }) {
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

export function Lamp({ position, on, color, size = [0.014, 0.006, 0.01], offColor = '#2b2f36', intensity = 2.2 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={on ? color : offColor} emissive={on ? color : '#000000'} emissiveIntensity={on ? intensity : 0} />
    </mesh>
  );
}

export const LED_THR = [-48, -40, -32, -26, -20, -15, -10, -6, -3, 0, 3];
export function LedMeter({ position, level, step = 0.0105, dir = [0, 0, -1] }) {
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
export function Waves({ active, color, position, rotation, speed = 1.1, travel = 0.7, radius = 0.12, count = 3 }) {
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

export function useCanvasTexture(w, h, draw, deps) {
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


export const FONT = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

/* ---------------------------- 단자 ---------------------------- */
// 단자·케이블을 누르는 동안에는 시점 회전을 멈춰, 클릭할 때 화면이 미끄러지지 않게 한다
export function useHoldCamera() {
  const controls = useThree((st) => st.controls);
  return () => {
    if (!controls) return;
    controls.enabled = false;
    const release = () => { controls.enabled = true; window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };
}

// 첫 프레임이 그려진 뒤에 자식을 렌더링한다.
// (drei <Html>이 캔버스 준비 전에 만들어지면 첫 라벨이 비어 버리는 문제 회피)
export function AfterFirstFrame({ children }) {
  const [ready, setReady] = useState(false);
  useFrame(() => { if (!ready) setReady(true); });
  return ready ? children : null;
}

