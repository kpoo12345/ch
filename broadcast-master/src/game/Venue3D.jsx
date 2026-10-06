import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { CABLES, DEVICE_TYPES } from './engine.js';
import {
  DESK_TOP, faceTo, noRaycast, rotY, CanvasShell, Label, Lamp, useCanvasTexture, FONT, AfterFirstFrame, useHoldCamera,
} from './kit3d.jsx';
import {
  MicModel, SpeakerModel, CameraModel, AtemModel, WirelessMicModel, DiBoxModel, HeadphonesModel, MirrorlessModel, PtzModel, PcModel,
  Plug, PendingCable, Port3D, DropIn, SelectRing, FeedbackArc, drawScene, drawMeterBar, drawWirelessLcd, drawCamLcd,
  PORTS3D, GHOST, FOCUS, SELECT_RADIUS, SHORT_LABEL, FrontKnob,
} from './Studio3D.jsx';
import { AnalogConsole, DigitalConsole, CONSOLE_SIZE, consoleControl } from './consoles.jsx';
import { VENUES, P_CH, P_LS } from './venues.js';
export { VENUES };
import {
  GuitarModel, KeyboardModel, LaptopModel, WedgeModel, RouterModel, PORTS_EXTRA, GHOST_EXTRA, FOCUS_EXTRA, SELECT_RADIUS_EXTRA,
  Person, Audience, Pew, Chair, Lectern, StagePlatform, DrumKit, LightTruss, ProjectionScreen, ChurchWall, StageBackdrop, AcousticWall, Table, Rack, TallTripod, Plant,
} from './models2.jsx';

/* =====================================================================
 * 공연장 3D — 세미나실 · 1인 방송실 · 교회 · 밴드 공연장 · 강의 중계 스튜디오
 * 시뮬레이션 엔진 v2(sim.js)의 상태를 그대로 그린다.
 *  - 장소마다 정해진 자리(slot)에 장비가 놓이고, 케이블은 바닥과 무대 가장자리를 따라 간다.
 *  - 무대 ↔ 음향 부스처럼 먼 연결은 한 묶음(스네이크)으로 객석 통로를 따라 간다.
 *  - 조작이 일어나면 "유령 손"이 그 노브·페이더·단자로 가서 직접 조작하는 모습을 보여 준다.
 * ===================================================================== */

const DT = DESK_TOP;

/* ---------------------------- 장비 장착 방식 ---------------------------- */
const FLOOR_NATIVE = new Set(['dynamic_mic', 'condenser_mic', 'speaker', 'monitor', 'camera', 'e_guitar', 'keyboard', 'di_box']);
const MIC_TYPES = new Set(['dynamic_mic', 'condenser_mic']);
const PORTS_ALL = { ...PORTS3D, ...PORTS_EXTRA };
const GHOST_ALL = { ...GHOST, ...GHOST_EXTRA, analog_mixer: CONSOLE_SIZE.analog_mixer, digital_mixer: CONSOLE_SIZE.digital_mixer,
  audio_interface: [0.22, 0.06, 0.12], wireless_mic: [0.4, 0.3, 0.2], di_box: [0.12, 0.07, 0.15], headphones: [0.25, 0.25, 0.2],
  mirrorless: [0.25, 0.3, 0.2], ptz: [0.18, 0.25, 0.18], atem_pro: [0.46, 0.4, 0.45] };
const FOCUS_ALL = { ...FOCUS, ...FOCUS_EXTRA, analog_mixer: { y: 0.07, dist: 0.85 }, digital_mixer: { y: 0.1, dist: 1.05 },
  audio_interface: { y: 0.03, dist: 0.5 }, wireless_mic: { y: 0.08, dist: 0.7 }, di_box: { y: 0.03, dist: 0.5 }, headphones: { y: 0.12, dist: 0.6 },
  mirrorless: { y: 0.2, dist: 0.6 }, ptz: { y: 0.12, dist: 0.6 }, atem_pro: { y: 0.12, dist: 0.95 } };
const RADIUS_ALL = { ...SELECT_RADIUS, ...SELECT_RADIUS_EXTRA };

// 책상 위 마이크(데스크 암·강대상 구즈넥): 마이크 머리 높이 H
function deskMicPorts(type, H) {
  return type === 'condenser_mic'
    ? { out: { p: [0, H - 0.06, 0], n: [0, -1, 0.15] } }
    : { out: { p: [0, H, 0.13], n: [0, -0.35, 1] } };
}

// 자리 종류 × 장비 종류 → 받침(랙·삼각대) 높이와 크기
export function mountOf(slot, type) {
  if (!slot) return { y: 0, scale: 1, base: null };
  if (slot.deskMic && MIC_TYPES.has(type)) return { y: 0, scale: 1, base: 'deskMic', H: slot.deskMic };
  if (slot.kind === 'floor' && !FLOOR_NATIVE.has(type)) {
    if (type === 'mirrorless') return { y: 1.15, scale: 1, base: 'tripod' };
    if (type === 'ptz') return { y: 1.6, scale: 1, base: 'tripod', h: 1.6 };
    if (type === 'headphones') return { y: DT, scale: 1, base: 'rack' };
    return { y: DT, scale: 1, base: 'rack' };
  }
  if (slot.kind === 'wall') return { y: 0, scale: 1, base: 'shelf' };
  if (slot.kind === 'desk' && FLOOR_NATIVE.has(type) && type !== 'di_box') return { y: 0, scale: 0.5, base: null };
  return { y: 0, scale: 1, base: null };
}

const portLocal = (type, pid, mount) => (mount.base === 'deskMic' ? deskMicPorts(type, mount.H)[pid] : PORTS_ALL[type]?.[pid]);

/* ---------------------------- 책상 위 마이크 모델 ---------------------------- */
function DeskMic({ type, H, live, phantomOk }) {
  const grille = useRef();
  useFrame(({ clock }) => { if (grille.current) grille.current.emissiveIntensity = live ? 0.5 + Math.sin(clock.elapsedTime * 14) * 0.3 : 0; });
  const arm = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.0, 0.02, 0.28), new THREE.Vector3(0.0, H * 0.75, 0.24), new THREE.Vector3(0, H + 0.06, 0.12), new THREE.Vector3(0, H + 0.03, 0.05),
  ]), 40, 0.007, 8, false), [H]);
  useEffect(() => () => arm.dispose(), [arm]);
  return (
    <group>
      <mesh position={[0, 0.02, 0.28]} castShadow><boxGeometry args={[0.05, 0.04, 0.05]} /><meshStandardMaterial color="#14171c" metalness={0.6} /></mesh>
      <mesh geometry={arm} castShadow><meshStandardMaterial color="#1f2329" metalness={0.6} roughness={0.35} /></mesh>
      {type === 'dynamic_mic' ? (
        <group position={[0, H, 0]}>
          <mesh position={[0, 0, 0.035]} rotation={[-Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.021, 0.015, 0.17, 24]} /><meshStandardMaterial color="#1b1d21" metalness={0.4} roughness={0.35} /></mesh>
          <mesh position={[0, 0, -0.085]}><sphereGeometry args={[0.033, 24, 18]} /><meshStandardMaterial ref={grille} color="#9ca3af" metalness={0.8} roughness={0.35} emissive="#22c55e" emissiveIntensity={0} /></mesh>
          <mesh position={[0, 0, -0.085]}><sphereGeometry args={[0.0345, 16, 10]} /><meshBasicMaterial color="#4b5563" wireframe /></mesh>
        </group>
      ) : (
        <group position={[0, H + 0.08, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.055, 0.004, 8, 32]} /><meshStandardMaterial color="#14171c" /></mesh>
          <mesh castShadow><cylinderGeometry args={[0.032, 0.03, 0.2, 24]} /><meshStandardMaterial color="#c9b37e" metalness={0.75} roughness={0.3} /></mesh>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.0335, 0.0335, 0.09, 24]} /><meshStandardMaterial ref={grille} color="#d6c79a" metalness={0.7} roughness={0.45} emissive="#22c55e" emissiveIntensity={0} /></mesh>
          <Lamp position={[0, -0.02, 0.033]} on={phantomOk} color="#ef4444" size={[0.008, 0.008, 0.004]} />
        </group>
      )}
    </group>
  );
}

// 오디오 인터페이스 (입력 2개 각각의 상태를 보여 준다)
function Interface2({ cfg, levels }) {
  const halo = (lv) => (lv == null ? '#1f2937' : lv > 0 ? '#ef4444' : lv > -6 ? '#f59e0b' : '#22c55e');
  return (
    <group>
      <RoundedBox args={[0.19, 0.048, 0.1]} radius={0.006} position={[0, 0.024, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b3262d" metalness={0.55} roughness={0.32} />
      </RoundedBox>
      <mesh position={[0.008, 0.024, 0.0503]}><planeGeometry args={[0.17, 0.04]} /><meshStandardMaterial color="#141518" /></mesh>
      {[0, 1].map((i) => {
        const x = -0.014 + i * 0.026;
        const c = halo(levels?.[i]);
        return (
          <group key={i}>
            <FrontKnob position={[x, 0.024, 0.05]} value={cfg.in[i].gain} min={0} max={60} color="#d1d5db" />
            <mesh position={[x, 0.024, 0.0515]}>
              <torusGeometry args={[0.0105, 0.0018, 8, 32]} />
              <meshStandardMaterial color={c} emissive={levels?.[i] != null ? c : '#000000'} emissiveIntensity={levels?.[i] != null ? 2 : 0} />
            </mesh>
            <Lamp position={[x, 0.043, 0.0515]} on={cfg.in[i].phantom} color="#ef4444" size={[0.006, 0.004, 0.002]} />
            <Lamp position={[x + 0.009, 0.043, 0.0515]} on={cfg.in[i].inst} color="#f59e0b" size={[0.006, 0.004, 0.002]} />
          </group>
        );
      })}
      <FrontKnob position={[0.056, 0.024, 0.05]} value={cfg.monitor} min={0} max={100} color="#e5e7eb" size={0.012} />
      <Lamp position={[0.08, 0.036, 0.0515]} on={cfg.direct} color="#22c55e" size={[0.006, 0.004, 0.002]} />
    </group>
  );
}

function AtemPro2({ atem, camAt, mvTex }) {
  return (
    <group>
      <AtemModel atem={atem} camAt={camAt} pro streaming={atem.streaming} recording={atem.recording} pip={atem.pip} />
      <group position={[0, 0, -0.24]}>
        <mesh position={[0, 0.008, 0]} receiveShadow castShadow><boxGeometry args={[0.16, 0.016, 0.1]} /><meshStandardMaterial color="#1b1d21" /></mesh>
        <mesh position={[0, 0.1, -0.01]} castShadow><boxGeometry args={[0.03, 0.18, 0.02]} /><meshStandardMaterial color="#1b1d21" /></mesh>
        <group position={[0, 0.25, 0]}>
          <RoundedBox args={[0.46, 0.27, 0.025]} radius={0.006} castShadow><meshStandardMaterial color="#0d0f12" /></RoundedBox>
          <mesh position={[0, 0, 0.013]}><planeGeometry args={[0.44, 0.248]} /><meshBasicMaterial map={mvTex} toneMapped={false} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Shelf() {
  return (
    <group>
      <mesh position={[0, -0.015, 0]} castShadow raycast={noRaycast}><boxGeometry args={[0.3, 0.03, 0.26]} /><meshStandardMaterial color="#3f3a33" /></mesh>
      <mesh position={[0, -0.12, -0.11]} raycast={noRaycast}><boxGeometry args={[0.04, 0.2, 0.03]} /><meshStandardMaterial color="#1f2125" /></mesh>
    </group>
  );
}

/* ---------------------------- OBS 화면 (v2) ---------------------------- */
const CAM_SCENE = (type, i) => (type === 'mirrorless' ? 'cam1' : type === 'ptz' ? 'cam2' : i % 2 ? 'cam2' : 'cam1');
function drawObs2(ctx, w, h, { scene, obs, audioLv, live, viewers, overlay }) {
  ctx.fillStyle = '#1b1c22'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2a2c35'; ctx.fillRect(0, 0, w, 34);
  ctx.fillStyle = '#cbd5e1'; ctx.font = `600 18px ${FONT}`; ctx.fillText('OBS Studio  —  장면: 메인 라이브', 14, 23);
  const px = 24, py = 46, pw = w - 48, ph = 360;
  ctx.fillStyle = '#000'; ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
  drawScene(ctx, scene, px, py, pw, ph);
  if (overlay) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px, py, pw, 34); ctx.fillRect(px, py + ph - 34, pw, 34);
    ctx.fillStyle = '#fff'; ctx.font = `600 18px ${FONT}`; ctx.fillText('4K 30p  ▮▮▮▯ 87%   F2.8  1/60  ISO800', px + 10, py + 24);
  }
  if (obs.streaming) {
    ctx.fillStyle = live ? '#dc2626' : '#78350f'; ctx.fillRect(px + pw - 160, py + 12, 146, 36);
    ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText(live ? '● LIVE' : '● 문제 있음', px + pw - 148, py + 38);
  }
  const ay = py + ph + 22;
  ctx.fillStyle = '#23252d'; ctx.fillRect(px, ay, pw * 0.62, h - ay - 16);
  ctx.fillStyle = '#94a3b8'; ctx.font = `600 17px ${FONT}`; ctx.fillText('오디오 믹서', px + 14, ay + 26);
  ctx.fillStyle = '#e2e8f0'; ctx.font = `500 16px ${FONT}`;
  ctx.fillText({ mixer: '믹서 USB 오디오', interface: '오디오 인터페이스', builtin: 'PC 내장 마이크', none: '오디오 소스 없음' }[obs.audio] ?? '오디오 소스 없음', px + 14, ay + 58);
  drawMeterBar(ctx, px + 14, ay + 70, pw * 0.62 - 90, 22, audioLv);
  ctx.fillStyle = obs.muted ? '#dc2626' : '#475569'; ctx.fillRect(px + pw * 0.62 - 64, ay + 66, 50, 30);
  ctx.fillStyle = '#fff'; ctx.font = `700 14px ${FONT}`; ctx.fillText(obs.muted ? 'MUTE' : 'ON', px + pw * 0.62 - 58, ay + 86);
  const bx = px + pw * 0.62 + 16, bw = pw * 0.38 - 16;
  ctx.fillStyle = obs.streaming ? '#e2e8f0' : '#dc2626'; ctx.fillRect(bx, ay, bw, 50);
  ctx.fillStyle = obs.streaming ? '#0f172a' : '#fff'; ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(obs.streaming ? '방송 중지' : '방송 시작', bx + bw / 2, ay + 33);
  ctx.fillStyle = '#94a3b8'; ctx.font = `500 16px ${FONT}`;
  ctx.fillText(obs.streaming ? (live ? `시청자 ${viewers.toLocaleString()}명` : '시청자: 소리/영상 확인 필요') : 'OFFLINE', bx + bw / 2, ay + 86);
  ctx.textAlign = 'left';
}

function drawLaptop(ctx, w, h, { playing }) {
  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1e293b'; ctx.fillRect(20, 20, w - 40, h * 0.5);
  ctx.fillStyle = '#e2e8f0'; ctx.font = `700 26px ${FONT}`; ctx.fillText('♪ 예배 전 BGM.mp3', 40, 70);
  ctx.fillStyle = '#334155'; ctx.fillRect(40, h * 0.62, w - 80, 10);
  ctx.fillStyle = playing ? '#22c55e' : '#64748b'; ctx.fillRect(40, h * 0.62, (w - 80) * 0.4, 10);
  ctx.fillStyle = '#94a3b8'; ctx.font = `600 22px ${FONT}`; ctx.fillText(playing ? '▶ 재생 중' : '❚❚ 일시정지', 40, h * 0.85);
}

/* ---------------------------- 장소(방) ---------------------------- */
function OnAirSign({ live, position }) {
  const sign = useCanvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = live ? '#7f1d1d' : '#1f1414'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = live ? '#fecaca' : '#3f2a2a'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = live ? '#ffffff' : '#4b3535'; ctx.font = `800 96px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ON AIR', w / 2, h / 2 + 4);
  }, [live]);
  return (
    <group position={position}>
      <mesh raycast={noRaycast}><boxGeometry args={[1.05, 0.34, 0.06]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
      <mesh position={[0, 0, 0.032]} raycast={noRaycast}>
        <planeGeometry args={[1.0, 0.31]} />
        <meshStandardMaterial map={sign} emissive={live ? '#ff3b3b' : '#000000'} emissiveMap={sign} emissiveIntensity={live ? 1.4 : 0} toneMapped={false} />
      </mesh>
      {live && <pointLight color="#ff2a2a" intensity={2.2} distance={3} position={[0, 0, 0.4]} />}
    </group>
  );
}

function Floor({ color = '#232b3a', grid = '#2c3850', section = '#3b4a68' }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={noRaycast}><planeGeometry args={[40, 40]} /><meshStandardMaterial color={color} roughness={0.85} /></mesh>
      <Grid position={[0, 0.002, 0]} args={[40, 40]} cellSize={0.25} cellThickness={0.6} cellColor={grid} sectionSize={1} sectionThickness={1} sectionColor={section} fadeDistance={18} infiniteGrid />
    </group>
  );
}

function BackWall({ z, color = '#262f40', h = 5, tiles = false }) {
  const list = [];
  if (tiles) for (let r = 0; r < 4; r += 1) for (let c = 0; c < 16; c += 1) list.push([-5 + c * 0.62, 0.5 + r * 0.62, (r + c) % 2]);
  return (
    <group>
      <mesh position={[0, h / 2, z]} receiveShadow raycast={noRaycast}><planeGeometry args={[40, h]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      {list.map(([x, y, alt]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z + 0.03]} rotation={[0, 0, alt ? Math.PI / 2 : 0]} receiveShadow raycast={noRaycast}>
          <boxGeometry args={[0.58, 0.58, alt ? 0.05 : 0.07]} /><meshStandardMaterial color={alt ? '#34405a' : '#2d384f'} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function VenueRoom({ venueId, live, talking, performing }) {
  const v = VENUES[venueId];
  const people = v.people.map((p) => (
    <Person key={p.id} position={p.pos} rotation={p.rot} pose={p.pose ?? 'stand'} shirt={p.shirt}
      talking={!!p.talker && talking} singing={!!p.singer && performing} hands={p.hands ?? 'down'} />
  ));
  const desks = v.desks.map((d, i) => <group key={i} position={[d.x, 0, d.z]}><Table w={d.w} d={d.d} h={DT} /></group>);
  switch (venueId) {
    case 'seminar': {
      const seats = [];
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) seats.push([2.3 + r * 0.6, 0, -1.7 + c * 0.6, -Math.PI / 2]);
      return (
        <group>
          <Floor color="#2a2f3a" />
          <BackWall z={-2.6} color="#2b3342" />
          <group position={[-1.7, 0.85, -2.55]}><ProjectionScreen width={2.3} height={1.3} /></group>
          {seats.map(([x, y, z, r], i) => <group key={i} position={[x, y, z]} rotation={[0, r + Math.PI, 0]}><Chair /></group>)}
          <Audience seats={seats.map(([x, y, z, r]) => [x, y, z, r])} seated />
          {desks}
          <group position={[3.6, 0, -2.2]}><Plant /></group>
          {people}
        </group>
      );
    }
    case 'youtube_room':
      return (
        <group>
          <Floor color="#22252e" grid="#2b2f3a" section="#363b48" />
          <group position={[0, 0, -1.65]}><AcousticWall width={6} height={3} /></group>
          {desks}
          <group position={[0, 0, -1.05]}><Chair /></group>
          <group position={[-1.6, 0, -1.2]}><Plant /></group>
          {people}
        </group>
      );
    case 'church': {
      const seats = [];
      [-1.75, 1.75].forEach((cx) => {
        for (let r = 0; r < 5; r += 1) for (let k = 0; k < 4; k += 1) if ((r + k + (cx > 0 ? 1 : 0)) % 3 !== 0) seats.push([cx - 0.84 + k * 0.56, 0, -0.18 + r * 0.6, Math.PI]);
      });
      return (
        <group>
          <Floor color="#2b2420" grid="#3a302a" section="#4a3d34" />
          <group position={[0, 0, -3.35]}><ChurchWall width={9} height={4.8} /></group>
          <group position={[v.platform.x, 0, v.platform.z]}><StagePlatform width={v.platform.w} depth={v.platform.d} height={v.platform.h} color="#3a2a22" edge="#c08a3e" /></group>
          <group position={[-0.4, P_CH, -1.75]}><Lectern height={1.05} /></group>
          {[-1.75, 1.75].map((cx) => [0, 1, 2, 3, 4].map((r) => <group key={`${cx}-${r}`} position={[cx, 0, -0.3 + r * 0.6]}><Pew width={2.4} /></group>))}
          <Audience seats={seats} seated />
          {desks}
          {people}
        </group>
      );
    }
    case 'live_stage': {
      const crowd = [];
      for (let i = 0; i < 22; i += 1) {
        const side = i % 2 ? 1 : -1;
        crowd.push([side * (1.1 + ((i * 37) % 19) / 9), 0, 0.2 + ((i * 53) % 23) / 10, Math.PI + side * 0.1]);
      }
      return (
        <group>
          <Floor color="#15161c" grid="#20222b" section="#2a2d38" />
          <group position={[0, P_LS, -3.45]}><StageBackdrop width={7.6} height={4.2} live={performing} /></group>
          <group position={[v.platform.x, 0, v.platform.z]}><StagePlatform width={v.platform.w} depth={v.platform.d} height={v.platform.h} color="#1c1c1f" edge="#64748b" /></group>
          <group position={[0.2, P_LS, -2.9]}><DrumKit performing={performing} /></group>
          <group position={[0, 0, -1.3]}><LightTruss width={7.8} height={3.6} live={performing} /></group>
          <Audience seats={crowd} seated={false} />
          {desks}
          {people}
        </group>
      );
    }
    case 'lecture_hall':
    default:
      return (
        <group>
          <Floor />
          <BackWall z={-2.3} tiles />
          <OnAirSign live={live} position={[-0.6, 2.45, -2.2]} />
          {desks}
          {people}
        </group>
      );
  }
}

/* ---------------------------- 케이블 경로 ---------------------------- */
// 끝점: { p, n, floorY, surface(책상/랙 위), back:[x,z] 책상 뒤 가장자리, zone }
function cableRoute(A, B, venue, lane) {
  const V = (a) => new THREE.Vector3(...a);
  const a = V(A.p), b = V(B.p);
  const a1 = a.clone().addScaledVector(V(A.n).normalize(), 0.07);
  const b1 = b.clone().addScaledVector(V(B.n).normalize(), 0.07);
  const down = (E, e1) => {
    const fy = E.floorY + 0.012;
    if (E.surface) {
      const top = E.surfaceY + 0.012;
      const s = E.back?.[2] ?? -1; // 책상 뒤쪽 방향 (-z 또는 +z)
      const bz = E.back?.[1] ?? e1.z - 0.25;
      return [V([e1.x, top, s < 0 ? Math.min(e1.z, bz + 0.03) : Math.max(e1.z, bz - 0.03)]), V([e1.x, top - 0.12, bz + s * 0.04]), V([e1.x, fy, bz + s * 0.22])];
    }
    const n = V(E.n);
    return [V([e1.x + n.x * 0.04, Math.max(fy + 0.25, e1.y * 0.5), e1.z + n.z * 0.04 + 0.03]), V([e1.x + n.x * 0.08, fy, e1.z + n.z * 0.08 + 0.1])];
  };
  // 같은 책상 위 장비끼리는 책상 위로 바로 잇는다
  if (A.surface && B.surface && A.deskKey && A.deskKey === B.deskKey) {
    const m = a1.clone().lerp(b1, 0.5); m.y = A.surfaceY + 0.012;
    const q1 = a1.clone().lerp(b1, 0.2); q1.y = Math.max(A.surfaceY + 0.02, q1.y - 0.03);
    const q2 = a1.clone().lerp(b1, 0.8); q2.y = Math.max(A.surfaceY + 0.02, q2.y - 0.03);
    return [a, a1, q1, m, q2, b1, b];
  }
  const da = down(A, a1), db = down(B, b1).reverse();
  const mid = [];
  const T = venue.trunk;
  const crosses = T && A.zone !== B.zone && (A.zone === 'stage' || B.zone === 'stage');
  if (crosses) {
    // 무대 쪽 끝 → 무대 앞 가장자리 → 객석 통로(스네이크) → 음향 부스
    const [S, F] = A.zone === 'stage' ? [A, B] : [B, A];
    const off = (lane % 7) * 0.028 - 0.08;
    const pathStageToFoh = [
      V([T.stage[0] + off, T.y + 0.012, T.stage[1] - 0.25]),
      V([T.stage[0] + off, T.y + 0.012, T.stage[1] - 0.02]),
      V([T.stage[0] + off, 0.012, T.stage[1] + 0.25]),
      V([T.foh[0] + off, 0.012, T.foh[1] - 0.3]),
    ];
    const seq = S === A ? pathStageToFoh : pathStageToFoh.slice().reverse();
    mid.push(...seq);
    void F;
  } else {
    const pa = da[da.length - 1], pb = db[0];
    if (Math.abs(pa.y - pb.y) > 0.05 && venue.platform) {
      // 무대 위 ↔ 무대 아래: 무대 앞 가장자리를 타고 내려간다
      const P = venue.platform;
      const edgeZ = P.z + P.d / 2;
      const x = (pa.x + pb.x) / 2;
      const up = pa.y > pb.y ? [pa, pb] : [pb, pa];
      const seq = [V([x, up[0].y, edgeZ - 0.05]), V([x, 0.012, edgeZ + 0.2])];
      mid.push(...(pa.y > pb.y ? seq : seq.reverse()));
    } else {
      const m = pa.clone().lerp(pb, 0.5); m.y = Math.min(pa.y, pb.y);
      mid.push(m);
    }
  }
  return [a, a1, ...da, ...mid, ...db, b1, b];
}

function Cable3D({ A, B, venue, lane, cable, live, fresh, onDisconnect, interactive, tipRef }) {
  const hold = useHoldCamera();
  const color = CABLES[cable]?.stroke ?? '#94a3b8';
  const key = `${A.p.join()}|${B.p.join()}|${lane}`;
  const curve = useMemo(() => new THREE.CatmullRomCurve3(cableRoute(A, B, venue, lane), false, 'centripetal'), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const segs = Math.min(400, Math.max(80, Math.round(curve.getLength() * 60)));
  const geo = useMemo(() => new THREE.TubeGeometry(curve, segs, 0.0095, 8, false), [curve, segs]);
  useEffect(() => () => geo.dispose(), [geo]);
  const [hover, setHover] = useState(false);
  const pulses = useRef([]);
  const grow = useRef(fresh ? -0.5 : 1); // 새 케이블: 손이 첫 단자에 닿은 뒤 자라기 시작
  const plugB = useRef();
  useFrame(({ clock }, dt) => {
    if (grow.current < 1) {
      grow.current = Math.min(1, grow.current + Math.min(dt, 0.05) / 0.9);
      const g = Math.max(0, grow.current);
      const total = geo.index ? geo.index.count : 0;
      geo.setDrawRange(0, Math.floor((total * g) / 6) * 6);
      if (tipRef) tipRef.current = curve.getPointAt(g);
    } else if (geo.drawRange.count !== Infinity && geo.index && geo.drawRange.count < geo.index.count) {
      geo.setDrawRange(0, Infinity);
    }
    if (plugB.current) {
      const s = grow.current < 1 ? 0.0001 : 1;
      plugB.current.scale.setScalar(s);
    }
    pulses.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.3 + i / 5) % 1;
      m.visible = grow.current >= 1;
      m.position.copy(curve.getPointAt(t));
    });
  });
  return (
    <group>
      <mesh
        geometry={geo} castShadow
        raycast={interactive ? undefined : noRaycast}
        onPointerDown={(e) => { if (!interactive) return; e.stopPropagation(); hold(); }}
        onClick={(e) => { if (!interactive) return; e.stopPropagation(); if (e.delta < 10) onDisconnect?.(); }}
        onPointerOver={(e) => { if (!interactive) return; e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        <meshStandardMaterial color={color} roughness={0.5} emissive={color} emissiveIntensity={hover ? 0.6 : live ? 0.22 : 0} />
      </mesh>
      {live && [0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} ref={(el) => { pulses.current[i] = el; }} raycast={noRaycast}>
          <sphereGeometry args={[0.016, 10, 8]} /><meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      <Plug p={A.p} n={A.n} color={color} />
      <group ref={plugB}><Plug p={B.p} n={B.n} color={color} /></group>
      {hover && (
        <Label position={curve.getPointAt(0.5)} center wrapperClass="bm-noevents">
          <div className="whitespace-nowrap rounded bg-black/80 px-2 py-0.5 text-[11px] text-white">{CABLES[cable]?.name} · 클릭하면 분리</div>
        </Label>
      )}
    </group>
  );
}

/* ---------------------------- 유령 손 ---------------------------- */
// 조작이 일어날 때 그 위치로 날아가 누르기/돌리기/밀기/꽂기 동작을 보여 준다
const HAND_MAT = { color: '#f8fafc', emissive: '#93c5fd', emissiveIntensity: 0.35, roughness: 0.4, transparent: true };
export function GhostHand({ cue, tipRef }) {
  const g = useRef();
  const wrist = useRef();
  const mats = useRef([]);
  const st = useRef({ t: 99, from: new THREE.Vector3(0, 3, 4), cue: null });
  useEffect(() => {
    if (!cue) return;
    const s = st.current;
    if (g.current && s.t < 3) s.from.copy(g.current.position);
    else s.from.set(cue.at[0] + 0.4, cue.at[1] + 0.9, cue.at[2] + 0.7);
    s.t = 0; s.cue = cue;
  }, [cue?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const tmp3 = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const s = st.current;
    const c = s.cue;
    if (!g.current || !c) return;
    s.t += Math.min(dt, 0.05) * (c.speed ?? 1);
    const t = s.t;
    const hover = tmp.set(c.at[0], c.at[1] + 0.05, c.at[2] + 0.02);
    let opacity = 0.95;
    let press = 0, twist = 0;
    if (c.kind === 'plug' && c.from) {
      // 첫 단자로 이동 → 케이블 끝을 잡고 두 번째 단자로 → 꽂기
      const A0 = tmp2.set(c.from[0], c.from[1] + 0.05, c.from[2] + 0.02);
      if (t < 0.45) g.current.position.lerpVectors(s.from, A0, ease(t / 0.45));
      else if (t < 1.45) {
        if (tipRef?.current) g.current.position.lerp(tmp3.copy(tipRef.current).add(UPV), 0.35);
        else g.current.position.lerpVectors(A0, hover, ease((t - 0.45) / 1.0));
        press = t < 0.6 ? Math.sin(((t - 0.45) / 0.15) * Math.PI) * 0.6 : 0;
      } else { g.current.position.lerp(hover, 0.3); press = t < 1.75 ? Math.sin(((t - 1.45) / 0.3) * Math.PI) : 0; }
    } else {
      // (디지털 믹서) 먼저 채널 SEL을 누르고 → 노브로
      const off = c.via ? 0.75 : 0;
      let start = s.from;
      if (c.via) {
        const V0 = tmp2.set(c.via[0], c.via[1] + 0.05, c.via[2] + 0.02);
        if (t < 0.45) g.current.position.lerpVectors(s.from, V0, ease(t / 0.45));
        else if (t < 0.75) { g.current.position.copy(V0); press = Math.sin(((t - 0.45) / 0.3) * Math.PI); }
        start = V0;
      }
      const u = t - off;
      if (u >= 0) {
        if (u < 0.5) g.current.position.lerpVectors(start, hover, ease(u / 0.5));
        else g.current.position.lerp(hover, 0.3);
        const k = (u - 0.5) / 0.55;
        if (k > 0 && k < 1) {
          if (c.kind === 'press' || c.kind === 'point') press = Math.sin(k * Math.PI);
          if (c.kind === 'turn') { press = 0.6; twist = Math.sin(k * Math.PI) * (c.dir ?? 1) * 0.9; }
          if (c.kind === 'slide') {
            press = 0.7;
            if (c.from) { tmp3.set(c.from[0], c.from[1] + 0.05, c.from[2] + 0.02); g.current.position.lerpVectors(tmp3, hover, ease(k)); }
          }
        }
      }
    }
    const end = (c.via ? 0.75 : 0) + (c.kind === 'plug' ? 2.4 : 2.0);
    if (t > end) opacity = Math.max(0, 0.95 - (t - end) / 0.5);
    g.current.position.y -= press * 0.035;
    if (wrist.current) wrist.current.rotation.y = twist;
    g.current.visible = opacity > 0.01;
    mats.current.forEach((m) => { if (m) m.opacity = opacity; });
  });
  const M = (i) => <meshStandardMaterial ref={(el) => { mats.current[i] = el; }} {...HAND_MAT} />;
  // 집게손가락 끝이 원점에 오도록 만든 장갑 손 (손목은 위·뒤쪽)
  return (
    <group ref={g} visible={false}>
      <group ref={wrist}>
        <group rotation={[0.9, 0, 0]}>
          <mesh position={[0, 0.0, 0.0]} raycast={noRaycast}><sphereGeometry args={[0.009, 10, 8]} />{M(0)}</mesh>
          <mesh position={[0, 0.03, 0]} raycast={noRaycast}><capsuleGeometry args={[0.009, 0.045, 4, 8]} />{M(1)}</mesh>
          {[-0.022, 0.022, 0.042].map((x, i) => (
            <mesh key={x} position={[x * 0.9, 0.068, 0.012]} rotation={[0.9, 0, 0]} raycast={noRaycast}><capsuleGeometry args={[0.0085, 0.03, 4, 8]} />{M(2 + i)}</mesh>
          ))}
          <mesh position={[0.012, 0.095, 0.0]} raycast={noRaycast}><boxGeometry args={[0.075, 0.07, 0.03]} />{M(5)}</mesh>
          <mesh position={[-0.042, 0.075, 0.005]} rotation={[0, 0, 0.8]} raycast={noRaycast}><capsuleGeometry args={[0.009, 0.03, 4, 8]} />{M(6)}</mesh>
          <mesh position={[0.012, 0.15, 0.0]} raycast={noRaycast}><cylinderGeometry args={[0.028, 0.032, 0.06, 12]} />{M(7)}</mesh>
          <mesh position={[0.012, 0.185, 0.0]} raycast={noRaycast}><cylinderGeometry args={[0.034, 0.034, 0.016, 12]} /><meshStandardMaterial ref={(el) => { mats.current[8] = el; }} color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} transparent /></mesh>
        </group>
      </group>
    </group>
  );
}
const UPV = new THREE.Vector3(0, 0.05, 0.02);
const ease = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/* ---------------------------- 카메라 ---------------------------- */
function CameraRig({ venue, resetKey, focus, portWorld }) {
  const { camera, controls, gl, size } = useThree();
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__BM_TEST) return;
    window.__BM_TEST.project = (d, p) => {
      const w = portWorld(d, p);
      if (!w) return null;
      const v = new THREE.Vector3(...w.p).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
    };
  });
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    const cam = venue.camera;
    const target = new THREE.Vector3(...cam.target);
    const dir = new THREE.Vector3(...cam.pos).sub(target);
    const base = dir.length();
    const fit = (cam.halfW * (aspect < 1 ? 0.8 : 1)) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    const dist = Math.min(14, Math.max(base, fit * 1.05));
    camera.position.copy(target).addScaledVector(dir.normalize(), dist);
    if (controls) { controls.target.copy(target); controls.update(); }
    anim.current = null;
  }, [venue, resetKey, controls, camera, Math.round(aspect * 20)]); // eslint-disable-line react-hooks/exhaustive-deps
  const anim = useRef(null);
  useEffect(() => {
    if (!focus) return;
    const target = new THREE.Vector3(...focus.target);
    let pos;
    if (focus.overview) {
      const cam = venue.camera;
      const dir = new THREE.Vector3(...cam.pos).sub(new THREE.Vector3(...cam.target)).normalize();
      const fit = (cam.halfW * (aspect < 1 ? 0.8 : 1)) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
      pos = new THREE.Vector3(...cam.target).addScaledVector(dir, Math.min(14, Math.max(dir.length(), fit * 1.05)));
    } else {
      // 장비를 조작자 쪽(+z) 위에서 비스듬히 내려다본다
      const dir = focus.dir ? new THREE.Vector3(...focus.dir).normalize() : camera.position.clone().sub(controls ? controls.target : target).normalize();
      dir.y = Math.max(dir.y, 0.55); dir.normalize();
      pos = target.clone().addScaledVector(dir, focus.dist);
    }
    anim.current = { target, pos, t: 0 };
  }, [focus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const a = anim.current;
    if (a && controls) {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3.2);
      controls.target.lerp(a.target, k);
      camera.position.lerp(a.pos, k);
      controls.update();
      a.t += dt;
      if (a.t > 2.5 || camera.position.distanceTo(a.pos) < 0.01) anim.current = null;
    }
  });
  return null;
}

/* =====================================================================
 * Venue3D
 *  st/sim: 엔진 v2 상태와 계산 결과
 *  action: 최근 조작 { key, device, ctl } → 유령 손 + (follow면) 카메라 이동
 * ===================================================================== */
export default function Venue3D({
  st, sim, venueId, interactive = true, autoRotate = false, fallback, talking, performing, selectedChannel = 0,
  pending, selectedCable, selectedDevice, labels = false, resetKey, focusRequest, lockView = false, follow = false, action, viewers = 0, highlight,
  onPortClick, onSelectDevice, onDisconnect, onPlace, onCancelPending,
}) {
  const venue = VENUES[venueId] ?? VENUES.lecture_hall;
  const pointerRef = useRef(null);
  const tipRef = useRef(null);
  const [focus, setFocus] = useState(null);
  useEffect(() => { setFocus(null); }, [resetKey]);
  const devices = st.devices;
  const slotOf = (id) => venue.slots[devices[id]?.slot] ?? null;

  const deskOfSlot = (slot) => {
    if (!slot || slot.kind !== 'desk' || (slot.deskMic && slot.onPlatform)) return null;
    return venue.desks.findIndex((d) => Math.abs(slot.pos[0] - d.x) <= d.w / 2 + 0.05 && Math.abs(slot.pos[2] - d.z) <= d.d / 2 + 0.05);
  };
  const worldOf = (id) => {
    const slot = slotOf(id);
    if (!slot) return null;
    const m = mountOf(slot, devices[id].type);
    return { pos: [slot.pos[0], slot.pos[1] + m.y, slot.pos[2]], rot: slot.rot, scale: m.scale, mount: m, slot };
  };
  const portWorld = (d, pid) => {
    const w = worldOf(d);
    if (!w) return null;
    const def = portLocal(devices[d].type, pid, w.mount);
    if (!def) return null;
    const lp = rotY(def.p.map((v) => v * w.scale), w.rot);
    const p = [w.pos[0] + lp[0], w.pos[1] + lp[1], w.pos[2] + lp[2]];
    const slot = w.slot;
    const floorY = slot.floorY ?? (slot.kind === 'floor' ? slot.pos[1] : slot.kind === 'wall' ? 0 : 0);
    const deskIdx = deskOfSlot(slot);
    const desk = deskIdx != null && deskIdx >= 0 ? venue.desks[deskIdx] : null;
    const surface = (w.mount.base === 'rack' || desk || slot.kind === 'wall' || (slot.deskMic && slot.onPlatform));
    const surfaceY = w.mount.base === 'rack' ? slot.pos[1] + DT : slot.pos[1];
    const back = desk ? [p[0], desk.backFront ? desk.z + desk.d / 2 : desk.z - desk.d / 2, desk.backFront ? 1 : -1]
      : w.mount.base === 'rack' ? [p[0], slot.pos[2] - 0.25, -1] : slot.kind === 'wall' ? [p[0], p[2] - 0.15, -1] : null;
    return {
      p, n: rotY(def.n, w.rot), floorY, surface: !!surface, surfaceY: slot.kind === 'wall' ? p[1] - 0.05 : surfaceY,
      back, deskKey: desk ? `desk${deskIdx}` : null, zone: zoneOfSlot(venueId, slot, devices[d].slot),
    };
  };

  const focusDevice = (id, opts = {}) => {
    const w = worldOf(id);
    if (!w) return;
    const f = FOCUS_ALL[devices[id].type] ?? { y: 0.5, dist: 1.5 };
    const dir = rotY([0, 0.9, 1], w.rot);
    const opFront = devices[id].type === 'analog_mixer' || devices[id].type === 'digital_mixer';
    setFocus({ target: [w.pos[0], w.pos[1] + f.y * w.scale, w.pos[2]], dist: f.dist * (opts.zoom ?? 1), dir: opFront ? dir : null, key: `${id}-${Date.now()}` });
    if (!opts.silent) onSelectDevice?.(id);
  };
  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.id === 'overview') setFocus({ overview: true, target: venue.camera.target, key: `ov-${focusRequest.key}` });
    else if (devices[focusRequest.id]?.placed) focusDevice(focusRequest.id, { silent: true, zoom: focusRequest.zoom });
  }, [focusRequest?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- 조작 → 유령 손 ----- */
  const [cue, setCue] = useState(null);
  useEffect(() => {
    if (!action) return;
    const c = resolveCue(action);
    if (c) setCue({ ...c, key: action.key, speed: action.speed });
    if (follow && action.device && action.device !== 'overview' && devices[action.device]?.placed) {
      const tgt = action.ctl?.kind === 'cable' ? action.ctl.to?.d : action.device;
      if (tgt && devices[tgt]?.placed) focusDevice(tgt, { silent: true, zoom: action.zoom ?? 1 });
    }
  }, [action?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  function toWorld(id, local) {
    const w = worldOf(id);
    if (!w) return null;
    const lp = rotY(local.map((v) => v * w.scale), w.rot);
    return [w.pos[0] + lp[0], w.pos[1] + lp[1], w.pos[2] + lp[2]];
  }
  function resolveCue(a) {
    const ctl = a.ctl ?? {};
    const d = a.device ? devices[a.device] : null;
    if (ctl.kind === 'cable') {
      const A = portWorld(ctl.from.d, ctl.from.p), B = portWorld(ctl.to.d, ctl.to.p);
      if (!A || !B) return null;
      tipRef.current = null;
      return { kind: 'plug', from: A.p, at: B.p };
    }
    if (!d || !d.placed) return null;
    const type = d.type;
    if (ctl.kind === 'mixer' || ctl.kind === 'master') {
      const key = ctl.kind === 'master' ? ctl.key : ctl.key;
      const at = toWorld(a.device, consoleControl(type, key, ctl.ch, ctl.value));
      const kind = key === 'fader' || key === 'mainFader' ? 'slide' : ['mute', 'mainMute', 'lowCut', 'phantom', 'select', 'patch', 'usbOut'].includes(key) ? 'press' : 'turn';
      const from = kind === 'slide' ? toWorld(a.device, consoleControl(type, key, ctl.ch, ctl.prev ?? ctl.value)) : null;
      // 디지털 믹서의 채널 설정은 "선택 채널" 섹션에서 한다 → 먼저 SEL 버튼
      const selKeys = ['gain', 'lowCut', 'phantom', 'eqHigh', 'eqMid', 'eqLow', 'fx', 'aux'];
      const via = type === 'digital_mixer' && ctl.kind === 'mixer' && selKeys.includes(key) && ctl.needSelect ? toWorld(a.device, consoleControl(type, 'select', ctl.ch)) : null;
      return { kind, at, from, via, dir: (ctl.value ?? 0) >= (ctl.prev ?? 0) ? 1 : -1 };
    }
    const local = DEVICE_POINT[type]?.(ctl) ?? [0, (GHOST_ALL[type]?.[1] ?? 0.3) * 0.8, 0];
    const w = worldOf(a.device);
    const at = w.mount.base === 'deskMic' ? toWorld(a.device, [0, w.mount.H, 0]) : toWorld(a.device, local);
    return { kind: ctl.kind === 'turn' ? 'turn' : ctl.kind === 'place' ? 'point' : 'press', at };
  }

  /* ----- 상태 → 표시 ----- */
  const meters = useMemo(() => ({
    ch: sim.mixer.channels.map((c) => (c.inLevel == null ? null : c.inLevel)),
    main: st.mixerId ? sim.outLevel(st.mixerId, 'main') : null,
    aux: st.mixerId ? sim.outLevel(st.mixerId, 'aux1') : null,
  }), [sim]); // eslint-disable-line react-hooks/exhaustive-deps
  const chNames = useMemo(() => st.channels.map((ch, i) => {
    const c = sim.mixer.channels[i];
    const src = c?.comps?.[0]?.src;
    return src ? (devices[src]?.name ?? DEVICE_TYPES[devices[src]?.type]?.name ?? src).slice(0, 8) : '';
  }), [sim]); // eslint-disable-line react-hooks/exhaustive-deps
  const camTally = (id) => {
    const n = Object.entries(sim.video.camAt).find(([, c]) => c === id)?.[0];
    if (!n) return null;
    if (Number(n) === st.atem.program) return 'pgm';
    if (Number(n) === st.atem.preview) return 'pvw';
    return null;
  };
  const camIndex = (id) => Object.values(devices).filter((d) => ['camera', 'mirrorless', 'ptz'].includes(d.type)).findIndex((d) => d.id === id);
  const sceneOf = (camId) => (camId ? CAM_SCENE(devices[camId].type, camIndex(camId)) : 'black');
  const obsScene = sim.stream.obsVideoOk || (st.obs.video === 'atem' && sim.video.atemUsbToPc) ? sceneOf(sim.video.programCam) : 'nosignal';
  const obsLv = Object.values(sim.heard.stream).reduce((m, h) => Math.max(m, h.level), -99);
  const obsTex = useCanvasTexture(1024, 576, (ctx, w, h) => drawObs2(ctx, w, h, {
    scene: obsScene, obs: st.obs, audioLv: obsLv > -99 ? obsLv + (talking ? Math.random() * 3 : 0) : null, live: sim.stream.obsLive, viewers, overlay: sim.video.overlay,
  }), [obsScene, st.obs.streaming, st.obs.audio, st.obs.muted, st.obs.video, Math.round(obsLv / 3), sim.stream.obsLive, viewers, sim.video.overlay, talking]);
  const mvTex = useCanvasTexture(1024, 576, (ctx, w, h) => {
    // 멀티뷰: 연결된 카메라에 맞춰 장면을 그린다
    const map = { 1: 'nosignal', 2: 'nosignal', 3: 'nosignal', 4: 'nosignal' };
    Object.entries(sim.video.camAt).forEach(([n, c]) => { map[n] = sceneOf(c); });
    drawMultiviewMapped(ctx, w, h, { map, program: st.atem.program, preview: st.atem.preview, pip: st.atem.pip, streaming: sim.stream.proLive, recording: st.atem.recording });
  }, [JSON.stringify(sim.video.camAt), st.atem.program, st.atem.preview, st.atem.pip, sim.stream.proLive, st.atem.recording]);
  const laptopTex = useCanvasTexture(512, 320, (ctx, w, h) => drawLaptop(ctx, w, h, { playing: Object.values(devices).some((d) => d.type === 'laptop' && st.dev[d.id]?.playing) }),
    [Object.values(devices).some((d) => d.type === 'laptop' && st.dev[d.id]?.playing)]);

  const connLive = (c) => {
    const ft = devices[c.from.d]?.type;
    if (['camera', 'mirrorless', 'ptz'].includes(ft)) return c.cable !== 'eth';
    if (ft === 'atem' || ft === 'atem_pro') return c.from.p === 'eth' ? sim.stream.proLive : !!sim.video.programCam;
    const lv = sim.outLevel(c.from.d, c.from.p);
    return lv != null && lv > -60;
  };

  const placed = Object.values(devices).filter((d) => d.placed && slotOf(d.id));
  const ghosts = Object.values(devices).filter((d) => !d.placed && slotOf(d.id));
  const pendingWorld = pending ? portWorld(pending.d, pending.p) : null;

  // 새로 꽂힌 케이블만 자라나는 연출을 한다
  const known = useRef(null);
  if (known.current == null) known.current = new Set(st.connections.map((c) => c.id));
  const fresh = new Set(st.connections.filter((c) => !known.current.has(c.id)).map((c) => c.id));
  useEffect(() => { st.connections.forEach((c) => known.current.add(c.id)); });
  useEffect(() => { known.current = new Set(st.connections.map((c) => c.id)); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderModel = (d) => {
    const s = st.dev[d.id] ?? {};
    const w = worldOf(d.id);
    const live = (lv) => lv != null && lv > -60;
    switch (d.type) {
      case 'dynamic_mic':
      case 'condenser_mic': {
        const lv = sim.outLevel(d.id, 'out');
        const phantomOk = d.type === 'condenser_mic' && !sim.deadPhantom.includes(d.id) && !!sim.channelOf(d.id);
        if (w.mount.base === 'deskMic') return <DeskMic type={d.type} H={w.mount.H} live={live(lv) && talking} phantomOk={phantomOk} />;
        return <MicModel type={d.type} live={live(lv) && talking && !!sim.channelOf(d.id)} phantomOk={phantomOk} />;
      }
      case 'wireless_mic': {
        const ok = s.txPower && s.txChannel === s.rxChannel && s.battery > 15;
        return <WirelessLcdWrap s={s} ok={ok} talking={talking} />;
      }
      case 'analog_mixer':
        return <AnalogConsole channels={st.channels} master={st.master} meters={meters} names={chNames} />;
      case 'digital_mixer':
        return <DigitalConsole channels={st.channels} master={st.master} meters={meters} names={chNames} selected={selectedChannel} />;
      case 'speaker': {
        const lv = sim.inLevel(d.id, 'in');
        const fb = sim.loops.some((l) => l.spk === d.id && l.loop >= 0) && talking;
        return <SpeakerModel power={!!s.power} level={s.power ? lv : null} feedback={fb} />;
      }
      case 'monitor': {
        const lv = sim.inLevel(d.id, 'in');
        const fb = sim.loops.some((l) => l.spk === d.id && l.loop >= 0) && talking;
        return <WedgeModel power={!!s.power} level={s.power ? lv : null} feedback={fb} />;
      }
      case 'camera': return <CameraModel tally={camTally(d.id)} />;
      case 'mirrorless': return <CamLcdWrap s={s} tally={camTally(d.id)} />;
      case 'ptz': return <PtzModel pan={s.pan ?? 0} tilt={s.tilt ?? 0} zoom={s.zoom ?? 0.3} tally={camTally(d.id)} />;
      case 'atem': return <AtemModel atem={st.atem} camAt={sim.video.camAt} />;
      case 'atem_pro': return <AtemPro2 atem={{ ...st.atem, streaming: st.atem.streaming }} camAt={sim.video.camAt} mvTex={mvTex} />;
      case 'pc': return <PcModel screenTex={obsTex} streaming={st.obs.streaming} />;
      case 'audio_interface': {
        const lv = [0, 1].map((i) => {
          const x = sim.heard.interface ? Object.entries(sim.heard.interface).find(([src]) => st.connections.some((c) => c.to.d === d.id && c.to.p === `in${i + 1}` && (c.from.d === src || chainHas(st, c.from.d, src))))?.[1] : null;
          return x?.level ?? null;
        });
        return <Interface2 cfg={s} levels={lv} />;
      }
      case 'di_box': return <DiBoxModel groundLift={!!s.groundLift} pad={!!s.pad} />;
      case 'headphones': return <HeadphonesModel />;
      case 'e_guitar': return <GuitarModel performing={performing} />;
      case 'keyboard': return <KeyboardModel performing={performing} />;
      case 'laptop': return <LaptopModel playing={!!s.playing} screenTex={laptopTex} />;
      case 'router': return <RouterModel linked={st.connections.some((c) => c.to.d === d.id)} />;
      default: return null;
    }
  };

  const mountBase = (w) => {
    if (w.mount.base === 'rack') return <Rack h={DT} />;
    if (w.mount.base === 'tripod') return <TallTripod height={w.mount.h ?? 1.15} />;
    if (w.mount.base === 'shelf') return <Shelf />;
    return null;
  };

  // 하울링 경로: 스피커 → 마이크
  const fbArcs = talking ? sim.loops.filter((l) => l.loop >= -4).map((l) => {
    const ws = worldOf(l.spk), wm = worldOf(l.src);
    if (!ws || !wm) return null;
    const hs = devices[l.spk].type === 'monitor' ? 0.25 : 1.45;
    const hm = wm.mount.base === 'deskMic' ? wm.mount.H : 1.42;
    return { key: `${l.spk}-${l.src}`, from: [ws.pos[0], ws.pos[1] + hs, ws.pos[2]], to: [wm.pos[0], wm.pos[1] + hm, wm.pos[2]], hot: l.loop >= 0 };
  }).filter(Boolean) : [];

  // 연결 순서대로 케이블 묶음 안의 자리(lane)를 정한다
  const lanes = {};
  st.connections.forEach((c, i) => { lanes[c.id] = i; });

  return (
    <CanvasShell
      fallback={fallback}
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 40, position: venue.camera.pos, near: 0.05, far: 80 }}
      onPointerMissed={() => onCancelPending?.()}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={[venue.dark ? '#0b0d14' : '#131a27']} />
      <fog attach="fog" args={[venue.dark ? '#0b0d14' : '#131a27', 13, 30]} />
      <ambientLight intensity={venue.dark ? 0.45 : 0.75} />
      <hemisphereLight args={['#d6e2f5', '#2a2622', venue.dark ? 0.6 : 1.0]} />
      <directionalLight
        position={[3.5, 7, 5]} intensity={venue.dark ? 1.4 : 2.3} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7}
        shadow-bias={-0.0004}
      />
      <spotLight position={[-2.5, 4.5, 2.5]} angle={0.6} penumbra={0.7} intensity={30} decay={1.4} color="#ffe4c4" />
      <spotLight position={[1.5, 4, 3.5]} angle={0.6} penumbra={0.8} intensity={24} decay={1.4} color="#f1f5ff" />

      <CameraRig venue={venue} resetKey={resetKey} focus={focus} portWorld={portWorld} />
      <OrbitControls
        makeDefault enableDamping dampingFactor={0.2}
        enableRotate={interactive && !lockView && !pending} autoRotate={autoRotate} autoRotateSpeed={0.4}
        enableZoom={interactive} enablePan={interactive && !lockView && !pending}
        minDistance={0.5} maxDistance={15} maxPolarAngle={Math.PI / 2.08}
      />

      <group onPointerMove={(e) => { if (pending) pointerRef.current = e.point.clone(); }}>
        <VenueRoom venueId={venueId} live={sim.stream.live} talking={talking} performing={performing} />
        <AfterFirstFrame>
          {placed.map((d) => {
            const w = worldOf(d.id);
            const selected = selectedDevice === d.id;
            const def = DEVICE_TYPES[d.type];
            const ports = w.mount.base === 'deskMic' ? deskMicPorts(d.type, w.mount.H) : (PORTS_ALL[d.type] ?? {});
            const gh = GHOST_ALL[d.type] ?? [0.4, 0.4, 0.4];
            const labelY = w.mount.base === 'deskMic' ? w.mount.H + 0.2 : gh[1] * w.scale + 0.16;
            const hi = highlight?.device === d.id;
            return (
              <group key={d.id}>
                <group position={[w.slot.pos[0], w.slot.pos[1], w.slot.pos[2]]} rotation={[0, w.rot, 0]}>{mountBase(w)}</group>
                <group
                  position={w.pos} rotation={[0, w.rot, 0]} scale={w.scale}
                  onClick={(e) => { if (!interactive) return; e.stopPropagation(); if (e.delta < 6) onSelectDevice?.(d.id); }}
                  onDoubleClick={(e) => { if (!interactive) return; e.stopPropagation(); focusDevice(d.id); }}
                >
                  <DropIn>{renderModel(d)}</DropIn>
                  {(selected || hi) && interactive && <SelectRing radius={(RADIUS_ALL[d.type] ?? 0.3) / w.scale} />}
                </group>
                {(interactive || hi) && (
                  <Label position={[w.pos[0], w.pos[1] + labelY, w.pos[2]]} center zIndexRange={[30, 0]}>
                    <button type="button" onClick={() => onSelectDevice?.(d.id)} onDoubleClick={() => focusDevice(d.id)} data-device-label={d.id} style={{ pointerEvents: interactive ? 'auto' : 'none' }}
                      title="클릭: 제어 패널 · 더블클릭: 확대해서 보기"
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${hi ? 'bg-amber-400 text-slate-900 animate-pulse' : selected ? 'bg-sky-500 text-white' : 'bg-slate-900/80 text-slate-200 hover:bg-slate-700'}`}>
                      {d.name ?? def.name}
                    </button>
                  </Label>
                )}
                {interactive && Object.keys(ports).map((pid, idx) => {
                  const port = [...def.ins, ...def.outs].find((pp) => pp.id === pid);
                  if (!port) return null;
                  const dir = def.ins.some((pp) => pp.id === pid) ? 'in' : 'out';
                  const pw = portWorld(d.id, pid);
                  const used = st.connections.some((c) => (c.from.d === d.id && c.from.p === pid) || (c.to.d === d.id && c.to.p === pid));
                  const isPending = pending && pending.d === d.id && pending.p === pid;
                  const candidate = pending && !isPending && pending.dir !== dir && pending.d !== d.id && !used;
                  const hiPort = highlight?.port && highlight.device === d.id && highlight.port === pid;
                  return (
                    <Port3D key={pid} p={pw.p} n={pw.n} port={port} label={SHORT_LABEL[`${d.type}:${pid}`] ?? port.label}
                      lift={(d.type === 'analog_mixer' || d.type === 'digital_mixer') && idx % 2 ? 0.035 : 0} used={used} isPending={isPending} candidate={candidate || hiPort}
                      labels={labels} onClick={() => onPortClick?.(d.id, pid)} />
                  );
                })}
              </group>
            );
          })}

          {interactive && ghosts.map((d) => {
            const slot = slotOf(d.id);
            const m = mountOf(slot, d.type);
            const size = (GHOST_ALL[d.type] ?? [0.4, 0.4, 0.4]).map((v) => v * m.scale);
            const y = slot.pos[1] + m.y;
            const hi = highlight?.device === d.id;
            return (
              <group key={d.id}>
                <group position={[slot.pos[0], y, slot.pos[2]]} rotation={[0, slot.rot, 0]}>
                  <mesh position={[0, size[1] / 2, 0]} raycast={noRaycast}>
                    <boxGeometry args={size} />
                    <meshBasicMaterial color={hi ? '#fbbf24' : '#38bdf8'} wireframe transparent opacity={0.4} />
                  </mesh>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} raycast={noRaycast}>
                    <circleGeometry args={[Math.max(size[0], size[2]) * 0.7, 40]} />
                    <meshBasicMaterial color={hi ? '#fbbf24' : '#38bdf8'} transparent opacity={0.14} depthWrite={false} />
                  </mesh>
                </group>
                <Label position={[slot.pos[0], y + size[1] + 0.15, slot.pos[2]]} center zIndexRange={[40, 0]}>
                  <button type="button" onClick={() => onPlace?.(d.id)} style={{ pointerEvents: 'auto' }} data-place={d.id}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-bold text-white shadow-lg ${hi ? 'border-amber-200 bg-amber-500 animate-pulse' : 'border-sky-300 bg-sky-600/90 hover:bg-sky-500'}`}>
                    + {d.name ?? DEVICE_TYPES[d.type].name} 배치
                  </button>
                </Label>
              </group>
            );
          })}

          {st.connections.map((c) => {
            const A = portWorld(c.from.d, c.from.p), B = portWorld(c.to.d, c.to.p);
            if (!A || !B || !devices[c.from.d]?.placed || !devices[c.to.d]?.placed) return null;
            return (
              <Cable3D key={c.id} A={A} B={B} venue={venue} lane={lanes[c.id]} cable={c.cable} live={connLive(c)} fresh={fresh.has(c.id)}
                interactive={interactive} tipRef={tipRef} onDisconnect={() => onDisconnect?.(c)} />
            );
          })}

          {pendingWorld && <PendingCable from={pendingWorld} pointerRef={pointerRef} color={selectedCable ? CABLES[selectedCable].stroke : '#94a3b8'} />}
          {fbArcs.map((f) => <FeedbackArc key={f.key} from={f.from} to={f.to} />)}
          <GhostHand cue={cue} tipRef={tipRef} />
        </AfterFirstFrame>
      </group>
    </CanvasShell>
  );
}

function WirelessLcdWrap({ s, ok, talking }) {
  const rf = s.txPower && s.txChannel === s.rxChannel ? Math.min(100, s.battery + 10) : 0;
  const lcdTex = useCanvasTexture(512, 160, (ctx, w, h) => drawWirelessLcd(ctx, w, h, {
    power: s.txPower, rf, battery: s.battery, channel: s.rxChannel, talking: talking && ok,
  }), [s.txPower, rf, s.battery, s.rxChannel, talking && ok]);
  return <WirelessMicModel power={s.txPower} battery={s.battery} rf={rf} lcdTex={lcdTex} talking={talking && ok} />;
}
function CamLcdWrap({ s, tally }) {
  const lcd = useCanvasTexture(480, 320, (ctx, w, h) => drawCamLcd(ctx, w, h, { clean: s.clean, rec: false }), [s.clean]);
  return (
    <group>
      <MirrorlessModel zoom={0.4} rec={false} lcdTex={lcd} />
      {tally && <Lamp position={[0.02, 0.26, 0.0]} on color={tally === 'pgm' ? '#ef4444' : '#22c55e'} size={[0.02, 0.01, 0.02]} intensity={3} />}
    </group>
  );
}

function chainHas(st, d, src) {
  // DI 등을 거쳐 src가 d로 들어오는지
  const c = st.connections.find((x) => x.to.d === d);
  if (!c) return false;
  return c.from.d === src || chainHas(st, c.from.d, src);
}

function drawMultiviewMapped(ctx, w, h, { map, program, preview, pip, streaming, recording }) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const top = h * 0.6, half = w / 2;
  drawScene(ctx, map[preview] ?? 'black', 4, 4, half - 8, top - 8);
  drawScene(ctx, program ? map[program] ?? 'black' : 'black', half + 4, 4, half - 8, top - 8);
  if (pip) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; drawScene(ctx, 'cam2', w - 4 - half * 0.32, top - 4 - top * 0.32, half * 0.3, top * 0.3); ctx.strokeRect(w - 4 - half * 0.32, top - 4 - top * 0.32, half * 0.3, top * 0.3); }
  ctx.lineWidth = 6; ctx.strokeStyle = '#22c55e'; ctx.strokeRect(4, 4, half - 8, top - 8);
  ctx.strokeStyle = '#ef4444'; ctx.strokeRect(half + 4, 4, half - 8, top - 8);
  ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#fff';
  ctx.fillText('PREVIEW', 16, top - 18); ctx.fillText('PROGRAM', half + 16, top - 18);
  const cw = w / 4;
  [1, 2, 3, 4].forEach((n, i) => {
    const x = i * cw + 4, y = top + 4, ww = cw - 8, hh = h - top - 50;
    drawScene(ctx, map[n], x, y, ww, hh);
    ctx.lineWidth = 5; ctx.strokeStyle = n === program ? '#ef4444' : n === preview ? '#22c55e' : '#334155'; ctx.strokeRect(x, y, ww, hh);
    ctx.fillStyle = '#e2e8f0'; ctx.font = `600 20px ${FONT}`; ctx.fillText(`${n}  ${map[n] === 'nosignal' ? '입력 없음' : `CAM ${n}`}`, x + 6, h - 16);
  });
  if (streaming) { ctx.fillStyle = '#dc2626'; ctx.fillRect(w - 170, 14, 150, 34); ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText('● ON AIR', w - 156, 39); }
  if (recording) { ctx.fillStyle = '#dc2626'; ctx.fillRect(w - 330, 14, 150, 34); ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText('● REC', w - 300, 39); }
}

function zoneOfSlot(venueId, slot, slotName) {
  const STAGE = { church: ['pulpit_mic', 'worship_mic_rx_stage', 'choir_mic', 'keys', 'di_keys', 'wedge_pulpit', 'wedge_band', 'pa_left', 'pa_right'],
    live_stage: ['vocal_mic', 'gtr', 'keys', 'di_gtr', 'di_keys', 'wedge_vocal', 'wedge_keys', 'pa_left', 'pa_right', 'cam_stage'] };
  if (!STAGE[venueId]) return 'room';
  return STAGE[venueId].includes(slotName) ? 'stage' : 'foh';
}

// 장비별 "조작 지점" (전원 스위치, 버튼 등) — 유령 손이 누를 곳
const DEVICE_POINT = {
  speaker: () => [0.0, 1.2, -0.16],
  monitor: () => [0.0, 0.22, -0.15],
  wireless_mic: (c) => (c.key === 'txPower' || c.key === 'battery' || c.key === 'txChannel' ? [0.15, 0.2, 0.02] : [-0.07, 0.03, 0.08]),
  di_box: (c) => (c.key === 'pad' ? [0.025, 0.06, -0.035] : [-0.025, 0.06, -0.035]),
  audio_interface: (c) => [c.input === 2 ? 0.012 : -0.014, 0.03, 0.055],
  mirrorless: () => [-0.1, 0.2, 0.02],
  ptz: () => [0, 0.2, 0.05],
  atem: (c) => (c.key === 'program' ? [-0.16 + ((c.value ?? 1) - 1) * 0.045, 0.05, 0.0] : c.key === 'preview' ? [-0.16 + ((c.value ?? 1) - 1) * 0.045, 0.05, 0.05] : c.key === 'cut' ? [0.08, 0.05, 0.025] : [0.14, 0.05, 0.025]),
  atem_pro: (c) => (c.key === 'program' ? [-0.16 + ((c.value ?? 1) - 1) * 0.045, 0.05, 0.0] : c.key === 'preview' ? [-0.16 + ((c.value ?? 1) - 1) * 0.045, 0.05, 0.05] : c.key === 'cut' ? [0.08, 0.05, 0.025] : c.key === 'streaming' ? [0.185, 0.05, 0.0] : c.key === 'recording' ? [0.185, 0.05, 0.03] : c.key === 'pip' ? [0.185, 0.05, 0.06] : [0.14, 0.05, 0.025]),
  pc: () => [0.15, 0.3, 0.05],
  laptop: () => [0.0, 0.02, 0.1],
  camera: () => [0.0, 1.45, -0.1],
  router: () => [0, 0.04, 0.05],
  dynamic_mic: () => [0, 1.42, 0.05],
  condenser_mic: () => [0, 1.5, 0.05],
  e_guitar: () => [0, 1.0, 0.1],
  keyboard: () => [0.3, 0.97, 0.05],
};

export { DEVICE_POINT, FOCUS_ALL, GHOST_ALL };
