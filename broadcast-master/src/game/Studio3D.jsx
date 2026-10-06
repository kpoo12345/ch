import React, { useMemo, useRef, useEffect, useState, useContext, createContext } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Html, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { CABLES, PORT_COLOR, DEVICE_TYPES, MIXER_DEFAULT } from './engine.js';
import {
  DESK_TOP, faceTo, MAT, UP, noRaycast, rotY, quatFromNormal, PortalCtx, Label, hasWebGL, NoWebGL, CanvasShell,
  Knob, Fader, Lamp, LED_THR, LedMeter, Waves, useCanvasTexture, FONT, useHoldCamera, AfterFirstFrame, JackFace, PlugBody,
} from './kit3d.jsx';
import { AnalogConsole, DigitalConsole, CONSOLE_PORTS, demoChannels } from './consoles.jsx';
import { WedgeModel, PORTS_EXTRA } from './models2.jsx';
import { ParLedModel, MovingHeadModel, LightingConsoleModel, MediaServerModel, ProjectorModel, ProjectedScreen, LedWallModel, PtzControllerModel, drawPtzLcd, PORTS_LIGHT } from './models3.jsx';
import { drawComposition } from './scenes.js';
import { KickMicModel, SnareMicModel, OverheadMicModel, DigitalPianoModel, BassGuitarModel, DrumKitModel, PORTS_INSTR } from './models4.jsx';

export { hasWebGL, NoWebGL };

/* =====================================================================
 * 3D 스튜디오 — 장비를 입체로 모델링하고 게임 상태(페이더·LED·탈리·
 * 스피커 진동·하울링·신호 흐름)를 실시간으로 반영한다.
 * 좌표계: x = 오른쪽, y = 위, z = 관객(화면) 쪽. 단위는 대략 미터.
 * ===================================================================== */


// 장비별 단자 위치(장비 기준 로컬 좌표)와 케이블이 빠져나가는 방향
export const PORTS3D = {
  dynamic_mic: { out: { p: [0, 1.42, 0.13], n: [0, -0.35, 1] } },
  condenser_mic: { out: { p: [0, 1.36, 0], n: [0, -1, 0.15] } },
  analog_mixer: CONSOLE_PORTS.analog_mixer,
  digital_mixer: CONSOLE_PORTS.digital_mixer,
  speaker: { in: { p: [-0.172, 1.33, -0.04], n: [-1, -0.2, 0] } },
  camera: { hdmi: { p: [0.035, 1.31, -0.153], n: [0, -0.25, -1] } }, // 카메라 뒷면 (관찰 시점 쪽)
  atem: {
    in1: { p: [-0.17, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in2: { p: [-0.12, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in3: { p: [-0.07, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in4: { p: [-0.02, 0.05, -0.088], n: [0, 0.6, -0.8] },
    usb: { p: [0.09, 0.05, -0.088], n: [0, 0.6, -0.8] },
    hdmiout: { p: [0.16, 0.05, -0.088], n: [0, 0.6, -0.8] },
    mic1: { p: [0.02, 0.05, -0.088], n: [0, 0.6, -0.8] },
    mic2: { p: [0.045, 0.05, -0.088], n: [0, 0.6, -0.8] },
  },
  audio_interface: {
    in1: { p: [-0.072, 0.024, 0.052], n: [0, 0, 1] },
    in2: { p: [-0.044, 0.024, 0.052], n: [0, 0, 1] },
    phones: { p: [0.08, 0.02, 0.052], n: [0, 0, 1] },
    usb: { p: [0.065, 0.026, -0.052], n: [0, 0, -1] },
    monL: { p: [-0.03, 0.026, -0.052], n: [0, 0, -1] },
    monR: { p: [0.0, 0.026, -0.052], n: [0, 0, -1] },
  },
  wireless_mic: { af: { p: [0.02, 0.024, -0.082], n: [0, 0.2, -1] } },
  di_box: {
    input: { p: [-0.022, 0.03, 0.067], n: [0, 0, 1] },
    thru: { p: [0.022, 0.03, 0.067], n: [0, 0, 1] },
    out: { p: [0, 0.03, -0.067], n: [0, 0, -1] },
  },
  headphones: { plug: { p: [0.17, 0.008, 0.09], n: [1, 0, 0] } },
  mirrorless: { hdmi: { p: [-0.066, 0.215, -0.005], n: [-1, 0, 0] } },
  ptz: {
    hdmi: { p: [-0.045, 0.026, -0.082], n: [0, 0, -1] },
    sdi: { p: [0, 0.026, -0.082], n: [0, 0, -1] },
    lan: { p: [0.045, 0.026, -0.082], n: [0, 0, -1] },
  },
  atem_pro: {
    mic1: { p: [-0.195, 0.05, -0.088], n: [0, 0.6, -0.8] },
    mic2: { p: [-0.168, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in1: { p: [-0.13, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in2: { p: [-0.095, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in3: { p: [-0.06, 0.05, -0.088], n: [0, 0.6, -0.8] },
    in4: { p: [-0.025, 0.05, -0.088], n: [0, 0.6, -0.8] },
    usb: { p: [0.06, 0.05, -0.088], n: [0, 0.6, -0.8] },
    eth: { p: [0.11, 0.05, -0.088], n: [0, 0.6, -0.8] },
    hdmiout: { p: [0.16, 0.05, -0.088], n: [0, 0.6, -0.8] },
  },
  pc: {
    usb1: { p: [-0.5, 0.13, 0.105], n: [0, 0, 1] },
    usb2: { p: [-0.44, 0.13, 0.105], n: [0, 0, 1] },
  },
};

export const GHOST = {
  dynamic_mic: [0.34, 1.5, 0.34], condenser_mic: [0.34, 1.6, 0.34], analog_mixer: [0.63, 0.1, 0.44],
  speaker: [0.5, 1.75, 0.5], digital_mixer: [0.84, 0.18, 0.58], camera: [0.7, 1.5, 0.7],
  atem: [0.44, 0.06, 0.2], pc: [0.9, 0.5, 0.25],
};
// "가까이 보기" 시점: 바라볼 높이와 거리
export const FOCUS = {
  dynamic_mic: { y: 1.3, dist: 1.3 }, condenser_mic: { y: 1.35, dist: 1.3 }, speaker: { y: 1.3, dist: 1.8 },
  camera: { y: 1.33, dist: 1.25 }, analog_mixer: { y: 0.07, dist: 0.95 }, digital_mixer: { y: 0.1, dist: 1.2 },
  atem: { y: 0.04, dist: 0.75 }, pc: { y: 0.33, dist: 1.5 },
};
// 책상 위 장비는 단자를 가리지 않도록 이름표를 앞쪽에 둔다
export const FRONT_LABEL = new Set(['analog_mixer', 'digital_mixer', 'atem']);
// 교육 모드 뷰어에서 단자가 촘촘해 라벨을 위아래로 엇갈리게 둘 장비
export const STAGGER = new Set(['analog_mixer', 'digital_mixer', 'atem', 'atem_pro', 'audio_interface', 'ptz', 'di_box']);
// 작은 장비는 단자 표시도 작게
export const PORT_SCALE = { audio_interface: 0.55, di_box: 0.7, ptz: 0.6, mirrorless: 0.6, headphones: 0.5, atem_pro: 0.8, wireless_mic: 0.8 };
export const SELECT_RADIUS = { dynamic_mic: 0.25, condenser_mic: 0.25, speaker: 0.42, camera: 0.5, analog_mixer: 0.4, digital_mixer: 0.52, atem: 0.27, pc: 0.55 };

/* ---------------------------- 화면 그리기 (Canvas 2D) ---------------------------- */

export function drawScene(ctx, src, x, y, w, h) {
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
  } else if (src === 'slides') {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(x, y, w, h * 0.16);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(h * 0.08)}px ${FONT}`; ctx.fillText('방송장비 기초 · 신호 흐름', x + w * 0.05, y + h * 0.11);
    ctx.fillStyle = '#cbd5e1';
    [0.3, 0.42, 0.54, 0.66].forEach((r, i) => ctx.fillRect(x + w * 0.08, y + h * r, w * (0.7 - i * 0.12), h * 0.05));
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(x + w * 0.7, y + h * 0.3, w * 0.22, h * 0.4);
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

export function drawMeterBar(ctx, x, y, w, h, level) {
  ctx.fillStyle = '#0b0d10'; ctx.fillRect(x, y, w, h);
  if (level == null) return;
  const pct = Math.max(0, Math.min(1, (level + 60) / 66));
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#16a34a'); g.addColorStop(0.81, '#22c55e'); g.addColorStop(0.82, '#eab308'); g.addColorStop(0.9, '#eab308'); g.addColorStop(0.91, '#ef4444');
  ctx.fillStyle = g; ctx.fillRect(x, y, w * pct, h);
}

// OBS 모니터 화면
function drawObsScreen(ctx, w, h, { obsVideo, obs, atem, obsAudioLv, viewers }) {
  ctx.fillStyle = '#1b1c22'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2a2c35'; ctx.fillRect(0, 0, w, 34);
  ctx.fillStyle = '#cbd5e1'; ctx.font = `600 18px ${FONT}`;
  ctx.fillText('OBS Studio  —  장면: 메인 라이브', 14, 23);
  const px = 24, py = 46, pw = w - 48, ph = 360;
  ctx.fillStyle = '#000'; ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
  drawScene(ctx, obsVideo, px, py, pw, ph);
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
}

// X32 라우팅/미터 화면
function drawX32Screen(ctx, w, h, { mixer, micAtCh, condenser, chLv, mainLv }) {
  ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0ea5e9'; ctx.fillRect(0, 0, w, 44);
  ctx.fillStyle = '#fff'; ctx.font = `700 28px ${FONT}`; ctx.fillText('X32  ROUTING / METERS', 16, 32);
  const srcName = { local1: 'Local In 1', local2: 'Local In 2', aes50a1: 'AES50 A-1', off: 'Off' }[mixer.ch1Source];
  const usbName = { main: 'Main L/R', bus1: 'Mix Bus 1', off: 'Off' }[mixer.usbOut];
  const rows = [
    ['CH01 입력', srcName, micAtCh],
    ['USB 출력', usbName, mixer.usbOut === 'main'],
    ['+48V', mixer.phantom ? 'ON' : 'OFF', mixer.phantom || !condenser],
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
}

/* ---------------------------- 장비 모델 ---------------------------- */
export function MicModel({ type, live, phantomOk }) {
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

export function Presenter({ position, talking, captured }) {
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

// 아날로그 믹서: 채널 수에 따라 폭이 늘어난다. 1번 채널이 게임 상태와 연결되고 나머지는 장식용.
const ANALOG_PITCH = 0.055;
const analogWidth = (ch) => ch * ANALOG_PITCH + 0.17;
export function AnalogMixerModel({ mixer, chLevel, mainLevel, channels = 8 }) {
  const W = analogWidth(channels);
  const x0 = -W / 2 + 0.02 + ANALOG_PITCH / 2;
  const xm = W / 2 - 0.085; // 마스터 섹션 중심
  const xs = Array.from({ length: channels }, (_, i) => x0 + i * ANALOG_PITCH);
  const decorFader = (i) => [0, 0, 62, 55, 0, 70, 48, 0, 66, 0, 58, 0, 40, 0, 72, 0][i % 16];
  return (
    <group>
      <RoundedBox args={[W, 0.07, 0.42]} radius={0.012} position={[0, 0.035, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2e333b" roughness={0.6} metalness={0.2} />
      </RoundedBox>
      {[-W / 2 - 0.012, W / 2 + 0.012].map((x) => (
        <mesh key={x} position={[x, 0.04, 0]} castShadow><boxGeometry args={[0.025, 0.085, 0.43]} /><meshStandardMaterial color="#3a2a1f" roughness={0.8} /></mesh>
      ))}
      <mesh position={[0, 0.09, -0.19]} castShadow><boxGeometry args={[W - 0.02, 0.05, 0.05]} /><meshStandardMaterial color="#1a1d22" /></mesh>
      {xs.map((x, i) => {
        const ch1 = i === 0;
        return (
          <group key={x} position={[x, 0.071, 0]}>
            {/* 뒤쪽 입력 단자 (1·2번은 게임 단자, 나머지는 장식) */}
            {i >= 2 && (
              <group position={[0, 0.048, -0.19]} rotation={[-0.71, 0, 0]}>
                <mesh><cylinderGeometry args={[0.015, 0.015, 0.012, 18]} /><meshStandardMaterial color="#050608" /></mesh>
                <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.017, 0.003, 8, 20]} /><meshStandardMaterial color="#64748b" /></mesh>
              </group>
            )}
            <Knob position={[0, 0, -0.135]} value={ch1 ? mixer.gain : 18 + ((i * 7) % 20)} min={0} max={60} color="#ef4444" />
            <Knob position={[0, 0, -0.095]} value={ch1 ? mixer.eqHigh : 0} min={-15} max={15} color="#60a5fa" size={0.012} />
            <Knob position={[0, 0, -0.06]} value={ch1 ? mixer.eqMid : 0} min={-15} max={15} color="#34d399" size={0.012} />
            <Knob position={[0, 0, -0.025]} value={ch1 ? mixer.eqLow : 0} min={-15} max={15} color="#fbbf24" size={0.012} />
            <Lamp position={[0, 0.004, 0.012]} on={ch1 && mixer.chMute} color="#ef4444" size={[0.022, 0.008, 0.014]} offColor="#40454d" />
            <Fader position={[0, 0.002, 0.11]} value={ch1 ? mixer.chFader : decorFader(i)} />
          </group>
        );
      })}
      <group position={[xm, 0.071, 0]}>
        <LedMeter position={[-0.045, 0.003, -0.02]} level={mainLevel} />
        <LedMeter position={[-0.025, 0.003, -0.02]} level={mainLevel == null ? null : mainLevel - 1.5} />
        <LedMeter position={[0.0, 0.003, -0.02]} level={chLevel} />
        <Knob position={[-0.035, 0, -0.135]} value={0} color="#a78bfa" size={0.011} />
        <Knob position={[0.0, 0, -0.135]} value={0} color="#a78bfa" size={0.011} />
        <Lamp position={[0.04, 0.004, 0.012]} on={mixer.mainMute} color="#ef4444" size={[0.022, 0.008, 0.014]} offColor="#40454d" />
        <Lamp position={[0.04, 0.004, -0.13]} on={mixer.phantom} color="#f59e0b" size={[0.012, 0.006, 0.008]} />
        <Lamp position={[0.04, 0.004, -0.1]} on color="#22c55e" size={[0.008, 0.006, 0.008]} />
        <Fader position={[0.02, 0.002, 0.11]} value={mixer.mainFader} color="#f87171" />
        <Fader position={[0.05, 0.002, 0.11]} value={mixer.mainFader} color="#f87171" />
      </group>
    </group>
  );
}

// 대형 디지털 콘솔 (교육 모드 "믹서 종류"용): 페이더 뱅크 3개 + 터치스크린 2개 + 미터 브리지
export function LargeConsoleModel({ screenTex }) {
  const W = 1.5;
  const banks = [-0.5, 0.0, 0.42];
  const strip = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#22d3ee', '#94a3b8'];
  return (
    <group>
      <RoundedBox args={[W, 0.1, 0.7]} radius={0.02} position={[0, 0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1b1e24" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.17, -0.31]} rotation={[-0.25, 0, 0]} castShadow><boxGeometry args={[W, 0.16, 0.06]} /><meshStandardMaterial color="#23272e" /></mesh>
      {[-0.36, 0.36].map((x) => (
        <group key={x} position={[x, 0.18, -0.275]} rotation={[-0.25, 0, 0]}>
          <mesh><planeGeometry args={[0.5, 0.13]} /><meshBasicMaterial map={screenTex} toneMapped={false} /></mesh>
        </group>
      ))}
      {/* 미터 브리지 */}
      {Array.from({ length: 36 }).map((_, i) => (
        <LedMeter key={i} position={[-0.7 + i * 0.04, 0.255, -0.335]} level={-30 + ((i * 13) % 28)} step={0.009} dir={[0, 0, 0]} />
      ))}
      {banks.map((bx, b) => (
        <group key={bx} position={[bx, 0.101, 0.03]}>
          {Array.from({ length: b === 2 ? 6 : 12 }).map((_, i) => {
            const x = (i - (b === 2 ? 2.5 : 5.5)) * 0.036;
            return (
              <group key={i} position={[x, 0, 0]}>
                <mesh position={[0, 0.001, -0.17]}><planeGeometry args={[0.03, 0.016]} /><meshBasicMaterial color={strip[(i + b * 3) % 8]} toneMapped={false} /></mesh>
                <Knob position={[0, 0, -0.13]} value={0.2 * ((i % 5) - 2)} color="#94a3b8" size={0.009} />
                <Lamp position={[0, 0.003, -0.095]} on={i % 7 === 3} color="#ef4444" size={[0.024, 0.006, 0.012]} offColor="#3a3f47" />
                <Fader position={[0, 0.002, 0.07]} value={b === 2 && i === 5 ? 75 : 40 + ((i * 17 + b * 11) % 40)} length={0.2} color={b === 2 && i === 5 ? '#f87171' : '#e5e7eb'} />
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

export function DigitalMixerModel({ mixer, chLevel, mainLevel, screenTex }) {
  // 채널 페이더 16개 (X32 Compact 배치) + 메인
  const xs = Array.from({ length: 16 }, (_, i) => -0.37 + i * 0.043);
  const decor = [0, 62, 55, 70, 0, 48, 66, 0, 58, 72, 0, 40, 64, 0, 50, 68];
  const strip = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#22d3ee', '#94a3b8'];
  return (
    <group>
      <RoundedBox args={[0.86, 0.09, 0.56]} radius={0.015} position={[0, 0.045, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1d2026" roughness={0.55} metalness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0.125, -0.215]} castShadow><boxGeometry args={[0.86, 0.08, 0.13]} /><meshStandardMaterial color="#23272e" roughness={0.5} /></mesh>
      {/* 뒤쪽 로컬 입력 단자 (3~8번은 장식) */}
      {[-0.19, -0.12, -0.05, 0.02, 0.09, 0.16].map((x) => (
        <group key={x} position={[x, 0.175, -0.255]} rotation={[-0.71, 0, 0]}>
          <mesh><cylinderGeometry args={[0.015, 0.015, 0.012, 18]} /><meshStandardMaterial color="#050608" /></mesh>
          <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.017, 0.003, 8, 20]} /><meshStandardMaterial color="#64748b" /></mesh>
        </group>
      ))}
      <mesh position={[0.0, 0.127, -0.149]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[0.3, 0.075]} />
        <meshBasicMaterial map={screenTex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.168, -0.255]}><boxGeometry args={[0.8, 0.006, 0.04]} /><meshStandardMaterial color="#121418" /></mesh>
      {xs.map((x, i) => {
        const ch1 = i === 0;
        return (
          <group key={x} position={[x, 0.091, 0]}>
            <mesh position={[0, 0.001, -0.005]}><planeGeometry args={[0.036, 0.02]} /><meshBasicMaterial color={strip[i % 8]} toneMapped={false} transparent opacity={ch1 ? 1 : 0.55} /></mesh>
            <Lamp position={[0, 0.003, 0.025]} on={ch1 ? mixer.chMute : false} color="#ef4444" size={[0.026, 0.007, 0.013]} offColor="#3a3f47" />
            <LedMeter position={[0.016, 0.003, -0.03]} level={ch1 ? chLevel : null} step={0.008} />
            <Fader position={[0, 0.002, 0.15]} value={ch1 ? mixer.chFader : decor[i]} length={0.15} />
          </group>
        );
      })}
      <group position={[-0.37, 0.091, -0.11]}>
        <Lamp position={[0, 0.003, 0]} on={mixer.phantom} color="#f59e0b" size={[0.026, 0.007, 0.013]} offColor="#3a3f47" />
        <Knob position={[0.05, 0, 0]} value={mixer.gain} min={0} max={60} color="#ef4444" />
      </group>
      <group position={[0.37, 0.091, 0]}>
        <mesh position={[0, 0.001, -0.005]}><planeGeometry args={[0.055, 0.022]} /><meshBasicMaterial color="#f8fafc" toneMapped={false} /></mesh>
        <Lamp position={[0, 0.003, 0.025]} on={mixer.mainMute} color="#ef4444" size={[0.03, 0.007, 0.014]} offColor="#3a3f47" />
        <LedMeter position={[-0.024, 0.003, -0.03]} level={mainLevel} step={0.008} />
        <LedMeter position={[0.024, 0.003, -0.03]} level={mainLevel == null ? null : mainLevel - 1.2} step={0.008} />
        <Fader position={[0, 0.002, 0.15]} value={mixer.mainFader} length={0.15} color="#f87171" />
      </group>
    </group>
  );
}

/* ---------------------------- 장비 불빛 (고정 라이트 풀) ----------------------------
 * three.js는 장면의 라이트 개수가 바뀌면 모든 재질 셰이더를 다시 컴파일한다(장비를 놓을 때마다 멈칫).
 * 그래서 장비마다 pointLight를 두지 않고, 개수가 고정된 라이트를 빛이 필요한 장비 쪽으로 옮겨 쓴다.
 * at: 장비 기준 로컬 위치 · pulse/amp: 깜빡임 속도와 폭 */
export const GLOW = {
  tally: { at: [0.035, 1.51, 0.13], color: '#ef4444', distance: 1, intensity: 0.8, pulse: 3, amp: 0.15 }, // 카메라 PGM 탈리
  feedback: { at: [0, 1.45, 0.4], color: '#ef4444', distance: 2.5, intensity: 1.5, pulse: 20, amp: 1.2 }, // 스피커 하울링
  wedge: { at: [0, 0.435, 0.283], color: '#ef4444', distance: 2, intensity: 1.4, pulse: 20, amp: 1.0 }, // 모니터 스피커 하울링
  streaming: { at: [0, 0.5, 0.3], color: '#ef4444', distance: 0.8, intensity: 0.6 }, // PC 방송 중
  ledWall: { at: [0, 1.525, 0.8], color: '#c084fc', distance: 4, intensity: 2 }, // LED 화면 빛 번짐 (at[1] = 0.4 + 높이/2)
};
// glows: [{ ...GLOW.x, pos: 월드 좌표 }] — count개를 늘 달아 두고, 남는 라이트는 세기 0
export function GlowLights({ glows = [], count = 4 }) {
  const lights = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    lights.current.forEach((l, i) => {
      if (!l) return;
      const g = glows[i];
      if (!g) { l.intensity = 0; return; }
      l.position.set(g.pos[0], g.pos[1], g.pos[2]);
      l.color.set(g.color);
      l.distance = g.distance;
      l.intensity = g.intensity + (g.pulse ? Math.sin(t * g.pulse) * g.amp : 0);
    });
  });
  return <group>{Array.from({ length: count }, (_, i) => <pointLight key={i} ref={(el) => { lights.current[i] = el; }} intensity={0} />)}</group>;
}

export function SpeakerModel({ power, level, feedback }) {
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
      </group>
      <Waves active={(level != null && level > -40) || feedback} color={feedback ? '#ef4444' : '#38bdf8'} position={[0, 1.38, 0.17]} radius={0.12} travel={0.9} speed={feedback ? 2.2 : 1} />
    </group>
  );
}

export function CameraModel({ tally }) {
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
      </group>
    </group>
  );
}

export function AtemModel({ atem, camAt, pro = false, streaming = false, recording = false, pip = false }) {
  return (
    <group>
      {pro && (
        <group>
          {[[-0.19, '#94a3b8'], [-0.19, '#94a3b8']].map(([x], i) => <Knob key={i} position={[x, 0.04, -0.02 + i * 0.045]} value={0.2 * i} color="#94a3b8" size={0.008} />)}
          <Lamp position={[0.185, 0.043, 0.0]} on={streaming} color="#ef4444" size={[0.026, 0.008, 0.02]} offColor="#4b5058" />
          <Lamp position={[0.185, 0.043, 0.03]} on={recording} color="#ef4444" size={[0.026, 0.008, 0.02]} offColor="#4b5058" />
          <Lamp position={[0.185, 0.043, 0.06]} on={pip} color="#38bdf8" size={[0.026, 0.008, 0.02]} offColor="#4b5058" />
        </group>
      )}
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
      {!pro && <Knob position={[0.185, 0.04, -0.04]} value={0} color="#94a3b8" size={0.01} />}
    </group>
  );
}

// ATEM Mini Pro + HDMI OUT에 연결된 멀티뷰 모니터
export function AtemProModel({ atem, streaming, recording, pip, mvTex }) {
  return (
    <group>
      <AtemModel atem={atem} camAt={{ 1: 'cam1', 2: 'cam2', 3: 'slides' }} pro streaming={streaming} recording={recording} pip={pip} />
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

/* ---------------------------- 교육 모드 장비 화면 ---------------------------- */
export const MV_SRC = { 1: 'cam1', 2: 'cam2', 3: 'slides', 4: 'nosignal' };
// ATEM 멀티뷰: 위 PVW|PGM, 아래 입력 1~4 (탈리 테두리)
export function drawMultiview(ctx, w, h, { program, preview, pip, streaming, recording }) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const top = h * 0.6, half = w / 2;
  drawScene(ctx, MV_SRC[preview] ?? 'black', 4, 4, half - 8, top - 8);
  drawScene(ctx, MV_SRC[program] ?? 'black', half + 4, 4, half - 8, top - 8);
  if (pip) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; drawScene(ctx, 'cam2', w - 4 - half * 0.32, top - 4 - top * 0.32, half * 0.3, top * 0.3); ctx.strokeRect(w - 4 - half * 0.32, top - 4 - top * 0.32, half * 0.3, top * 0.3); }
  ctx.lineWidth = 6; ctx.strokeStyle = '#22c55e'; ctx.strokeRect(4, 4, half - 8, top - 8);
  ctx.strokeStyle = '#ef4444'; ctx.strokeRect(half + 4, 4, half - 8, top - 8);
  ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#fff';
  ctx.fillText('PREVIEW', 16, top - 18); ctx.fillText('PROGRAM', half + 16, top - 18);
  const cw = w / 4;
  [1, 2, 3, 4].forEach((n, i) => {
    const x = i * cw + 4, y = top + 4, ww = cw - 8, hh = h - top - 50;
    drawScene(ctx, MV_SRC[n], x, y, ww, hh);
    ctx.lineWidth = 5; ctx.strokeStyle = n === program ? '#ef4444' : n === preview ? '#22c55e' : '#334155'; ctx.strokeRect(x, y, ww, hh);
    ctx.fillStyle = '#e2e8f0'; ctx.font = `600 20px ${FONT}`; ctx.fillText(`${n}  ${['CAM 1', 'CAM 2', 'PC 슬라이드', '입력 없음'][i]}`, x + 6, h - 16);
  });
  if (streaming) { ctx.fillStyle = '#dc2626'; ctx.fillRect(w - 170, 14, 150, 34); ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText('● ON AIR', w - 156, 39); }
  if (recording) { ctx.fillStyle = '#dc2626'; ctx.fillRect(w - 330, 14, 150, 34); ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText('● REC', w - 300, 39); }
}
// 무선 마이크 수신기 LCD
export function drawWirelessLcd(ctx, w, h, { power, rf, battery, channel, talking }) {
  ctx.fillStyle = '#0c2a3a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#7dd3fc'; ctx.font = `700 34px ${FONT}`;
  const freq = { 1: '518.200', 2: '524.650', 3: '531.100', 4: '537.850' }[channel];
  ctx.fillText(`CH ${channel}  ${freq} MHz`, 14, 42);
  const linked = power && rf > 15;
  ctx.font = `600 22px ${FONT}`; ctx.fillStyle = '#bae6fd';
  ctx.fillText('RF', 14, 88); ctx.fillText('AF', 14, 120);
  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = linked && i < Math.round(rf / 10) ? '#38bdf8' : '#164e63'; ctx.fillRect(60 + i * 26, 70, 20, 20);
    ctx.fillStyle = linked && talking && i < 6 + Math.round(Math.random() * 3) ? (i > 7 ? '#f87171' : '#4ade80') : '#164e63'; ctx.fillRect(60 + i * 26, 102, 20, 20);
  }
  ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 3; ctx.strokeRect(w - 110, 70, 80, 40); ctx.fillRect(w - 30, 82, 8, 16);
  ctx.fillStyle = !power ? '#164e63' : battery < 25 ? '#f87171' : '#4ade80';
  ctx.fillRect(w - 106, 74, Math.max(0, (battery / 100) * 72), 32);
  if (!linked) { ctx.fillStyle = '#fca5a5'; ctx.font = `700 22px ${FONT}`; ctx.fillText(power ? 'RF 약함 — 끊김 위험' : '송신기 신호 없음', w - 300, 42); }
}
// 미러리스 카메라 액정: 클린 HDMI가 꺼져 있으면 촬영 정보가 화면에 겹친다
export function drawCamLcd(ctx, w, h, { clean, rec }) {
  drawScene(ctx, 'cam1', 0, 0, w, h);
  if (!clean) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, w, 40); ctx.fillRect(0, h - 40, w, 40);
    ctx.fillStyle = '#fff'; ctx.font = `600 22px ${FONT}`;
    ctx.fillText('4K 30p   ▮▮▮▯  87%', 12, 28); ctx.fillText('F2.8   1/60   ISO 800   5600K', 12, h - 12);
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.strokeRect(w / 2 - 50, h / 2 - 50, 100, 100);
  }
  if (rec) { ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(w - 60, 22, 9, 0, Math.PI * 2); ctx.fill(); ctx.font = `700 20px ${FONT}`; ctx.fillText('REC', w - 46, 29); }
}

/* ---------------------------- 교육 모드 장비 모델 ---------------------------- */
// 노브를 전면 패널에 세워 붙일 때 (노브 축을 앞쪽으로)
export function FrontKnob({ position, value, min, max, color, size = 0.008 }) {
  return <group position={position} rotation={[Math.PI / 2, 0, 0]}><Knob value={value} min={min} max={max} color={color} size={size} /></group>;
}

export function AudioInterfaceModel({ gain, level, phantom, inst, air, monitor, direct }) {
  const halo = level == null ? '#1f2937' : level > 0 ? '#ef4444' : level > -6 ? '#f59e0b' : '#22c55e';
  const ring = (x, on) => (
    <mesh position={[x, 0.024, 0.0515]}>
      <torusGeometry args={[0.0105, 0.0018, 8, 32]} />
      <meshStandardMaterial color={on ? halo : '#1f2937'} emissive={on ? halo : '#000000'} emissiveIntensity={on && level != null ? 2 : 0} />
    </mesh>
  );
  return (
    <group>
      <RoundedBox args={[0.19, 0.048, 0.1]} radius={0.006} position={[0, 0.024, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b3262d" metalness={0.55} roughness={0.32} />
      </RoundedBox>
      <mesh position={[0.008, 0.024, 0.0503]}><planeGeometry args={[0.17, 0.04]} /><meshStandardMaterial color="#141518" /></mesh>
      <FrontKnob position={[-0.014, 0.024, 0.05]} value={gain} min={0} max={60} color="#d1d5db" />
      {ring(-0.014, true)}
      <FrontKnob position={[0.012, 0.024, 0.05]} value={20} min={0} max={60} color="#d1d5db" />
      {ring(0.012, false)}
      <Lamp position={[0.032, 0.035, 0.0515]} on={phantom} color="#ef4444" size={[0.008, 0.005, 0.002]} />
      <Lamp position={[0.032, 0.024, 0.0515]} on={inst} color="#ef4444" size={[0.008, 0.005, 0.002]} />
      <Lamp position={[0.032, 0.013, 0.0515]} on={air} color="#f59e0b" size={[0.008, 0.005, 0.002]} />
      <FrontKnob position={[0.056, 0.024, 0.05]} value={monitor} min={0} max={100} color="#e5e7eb" size={0.012} />
      <Lamp position={[0.08, 0.036, 0.0515]} on={direct} color="#22c55e" size={[0.006, 0.004, 0.002]} />
      <Lamp position={[0.08, 0.04, -0.0505]} on color="#22c55e" size={[0.004, 0.004, 0.002]} />
    </group>
  );
}

export function WirelessMicModel({ power, battery, rf, lcdTex, talking }) {
  const linked = power && rf > 15;
  return (
    <group>
      <RoundedBox args={[0.21, 0.044, 0.16]} radius={0.006} position={[-0.04, 0.022, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b2f36" metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <mesh position={[-0.07, 0.025, 0.0805]}><planeGeometry args={[0.09, 0.026]} /><meshBasicMaterial map={lcdTex} toneMapped={false} /></mesh>
      <Lamp position={[0.01, 0.032, 0.081]} on={linked} color="#38bdf8" size={[0.006, 0.006, 0.002]} />
      <Lamp position={[0.01, 0.018, 0.081]} on={linked && talking} color="#22c55e" size={[0.006, 0.006, 0.002]} />
      <Knob position={[0.035, 0.044, 0.04]} value={0} color="#9ca3af" size={0.009} />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[-0.04 + sx * 0.09, 0.044, -0.07]} rotation={[0, 0, -sx * 0.35]}>
          <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.007, 0.007, 0.012, 12]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0, 0.09, 0]} castShadow><cylinderGeometry args={[0.0035, 0.005, 0.16, 10]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        </group>
      ))}
      {/* 송신기(핸드헬드)와 거치대 */}
      <group position={[0.15, 0, 0.02]}>
        <mesh position={[0, 0.006, 0]} receiveShadow><cylinderGeometry args={[0.035, 0.04, 0.012, 24]} /><meshStandardMaterial color="#1a1c20" /></mesh>
        <mesh position={[0, 0.11, 0]} castShadow><cylinderGeometry args={[0.019, 0.014, 0.2, 24]} /><meshStandardMaterial color="#202227" metalness={0.5} roughness={0.35} /></mesh>
        <mesh position={[0, 0.22, 0]}><torusGeometry args={[0.02, 0.004, 8, 24]} /><meshStandardMaterial color="#a3acb7" metalness={0.9} roughness={0.2} /></mesh>
        <mesh position={[0, 0.245, 0]}><sphereGeometry args={[0.03, 24, 18]} /><meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.35} emissive="#22c55e" emissiveIntensity={linked && talking ? 0.5 : 0} /></mesh>
        <Lamp position={[0, 0.05, 0.016]} on={power} color={battery < 25 ? '#ef4444' : '#22c55e'} size={[0.006, 0.01, 0.003]} />
      </group>
    </group>
  );
}

export function DiBoxModel({ groundLift, pad }) {
  return (
    <group>
      <RoundedBox args={[0.1, 0.056, 0.13]} radius={0.006} position={[0, 0.028, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1d4ed8" metalness={0.45} roughness={0.35} />
      </RoundedBox>
      {[0.066, -0.066].map((z) => <mesh key={z} position={[0, 0.028, z]}><boxGeometry args={[0.102, 0.058, 0.004]} /><meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} /></mesh>)}
      <mesh position={[0, 0.0565, 0.01]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.07, 0.03]} /><meshStandardMaterial color="#e5e7eb" /></mesh>
      {[[-0.025, groundLift], [0.025, pad]].map(([x, on]) => (
        <group key={x} position={[x, 0.057, -0.035]}>
          <mesh><cylinderGeometry args={[0.006, 0.006, 0.004, 12]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0, 0.008, on ? 0.004 : -0.004]} rotation={[on ? 0.5 : -0.5, 0, 0]}><cylinderGeometry args={[0.0018, 0.0018, 0.016, 8]} /><meshStandardMaterial color="#e5e7eb" metalness={0.8} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function HeadphonesModel() {
  const cable = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.07, 0.18, 0), new THREE.Vector3(-0.06, 0.04, 0.05), new THREE.Vector3(0.05, 0.008, 0.1), new THREE.Vector3(0.15, 0.008, 0.09),
  ]), 60, 0.0025, 6, false), []);
  useEffect(() => () => cable.dispose(), [cable]);
  return (
    <group>
      <mesh position={[0, 0.006, 0]} receiveShadow><cylinderGeometry args={[0.05, 0.055, 0.012, 24]} /><meshStandardMaterial color="#1a1c20" /></mesh>
      <mesh position={[0, 0.13, 0]} castShadow><cylinderGeometry args={[0.006, 0.006, 0.25, 10]} /><meshStandardMaterial color="#9ca3af" metalness={0.8} /></mesh>
      <mesh position={[0, 0.2, 0]} castShadow><torusGeometry args={[0.085, 0.009, 10, 40, Math.PI]} /><meshStandardMaterial color="#1f2125" roughness={0.6} /></mesh>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.085, 0.17, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow><cylinderGeometry args={[0.045, 0.045, 0.03, 32]} /><meshStandardMaterial color="#25272c" metalness={0.3} roughness={0.5} /></mesh>
          <mesh position={[0, sx * -0.018, 0]}><torusGeometry args={[0.034, 0.01, 10, 32]} /><meshStandardMaterial color="#111" roughness={0.9} /></mesh>
        </group>
      ))}
      <mesh geometry={cable} castShadow><meshStandardMaterial color="#111" /></mesh>
      <mesh position={[0.158, 0.008, 0.09]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 0.025, 12]} /><meshStandardMaterial color="#c9b37e" metalness={0.9} roughness={0.2} /></mesh>
    </group>
  );
}

export function MirrorlessModel({ zoom, rec, lcdTex }) {
  const len = 0.07 + zoom * 0.05;
  return (
    <group>
      {[0, 2.094, 4.188].map((a) => (
        <mesh key={a} position={[Math.sin(a) * 0.05, 0.065, Math.cos(a) * 0.05]} rotation={[Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55]} castShadow>
          <cylinderGeometry args={[0.005, 0.004, 0.15, 8]} /><meshStandardMaterial color="#1c1f24" />
        </mesh>
      ))}
      <mesh position={[0, 0.142, 0]}><cylinderGeometry args={[0.018, 0.02, 0.03, 16]} /><meshStandardMaterial color="#111" /></mesh>
      <group position={[0, 0.2, 0]}>
        <RoundedBox args={[0.13, 0.085, 0.06]} radius={0.01} castShadow><meshStandardMaterial color="#1c1d21" roughness={0.6} /></RoundedBox>
        <RoundedBox args={[0.03, 0.08, 0.075]} radius={0.01} position={[0.055, -0.002, 0.008]}><meshStandardMaterial color="#141518" roughness={0.9} /></RoundedBox>
        <RoundedBox args={[0.045, 0.03, 0.05]} radius={0.006} position={[-0.01, 0.05, -0.004]}><meshStandardMaterial color="#1c1d21" /></RoundedBox>
        <mesh position={[0.045, 0.045, 0]}><cylinderGeometry args={[0.008, 0.008, 0.008, 16]} /><meshStandardMaterial color="#a3acb7" metalness={0.8} /></mesh>
        <group position={[-0.008, 0, 0.03 + len / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.032, 0.03, len, 32]} /><meshStandardMaterial color="#0e0f11" roughness={0.5} /></mesh>
          {[0.25, -0.15].map((t) => <mesh key={t} position={[0, len * t, 0]}><cylinderGeometry args={[0.0335, 0.0335, len * 0.18, 32]} /><meshStandardMaterial color="#26282d" roughness={0.9} /></mesh>)}
        </group>
        <mesh position={[-0.008, 0, 0.031 + len]}><circleGeometry args={[0.026, 32]} /><meshStandardMaterial color="#0b1d3a" metalness={0.9} roughness={0.05} /></mesh>
        <Lamp position={[-0.05, 0.03, 0.031]} on={rec} color="#ef4444" size={[0.006, 0.006, 0.002]} intensity={3} />
        {/* 바리앵글 액정 (옆으로 펼쳐 앞쪽을 향함) */}
        <group position={[-0.1, 0, 0.0]} rotation={[0, 0.65, 0]}>
          <mesh><boxGeometry args={[0.075, 0.052, 0.006]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0, 0, 0.0035]}><planeGeometry args={[0.068, 0.045]} /><meshBasicMaterial map={lcdTex} toneMapped={false} /></mesh>
        </group>
      </group>
    </group>
  );
}

export function PtzModel({ pan, tilt, zoom, tally }) {
  const yoke = useRef();
  const head = useRef();
  const lens = useRef();
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    if (yoke.current) yoke.current.rotation.y += (THREE.MathUtils.degToRad(pan) - yoke.current.rotation.y) * k;
    if (head.current) head.current.rotation.x += (THREE.MathUtils.degToRad(-tilt) - head.current.rotation.x) * k;
    if (lens.current) lens.current.position.z += (0.066 + zoom * 0.02 - lens.current.position.z) * k;
  });
  return (
    <group>
      <RoundedBox args={[0.16, 0.05, 0.16]} radius={0.012} position={[0, 0.025, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#e5e7eb" roughness={0.45} />
      </RoundedBox>
      <Lamp position={[0, 0.04, 0.081]} on color="#38bdf8" size={[0.02, 0.004, 0.002]} />
      <group ref={yoke} position={[0, 0.05, 0]}>
        <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.06, 0.065, 0.012, 32]} /><meshStandardMaterial color="#d1d5db" /></mesh>
        {[-1, 1].map((sx) => <mesh key={sx} position={[sx * 0.065, 0.06, 0]} castShadow><boxGeometry args={[0.014, 0.11, 0.06]} /><meshStandardMaterial color="#e5e7eb" /></mesh>)}
        <group ref={head} position={[0, 0.085, 0]}>
          <RoundedBox args={[0.11, 0.095, 0.12]} radius={0.03} castShadow><meshStandardMaterial color="#f3f4f6" roughness={0.4} /></RoundedBox>
          <group ref={lens} position={[0, 0, 0.066]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.036, 0.036, 0.03, 32]} /><meshStandardMaterial color="#111" /></mesh>
            <mesh position={[0, 0, 0.016]}><circleGeometry args={[0.03, 32]} /><meshStandardMaterial color="#0b1d3a" metalness={0.9} roughness={0.05} /></mesh>
          </group>
          <Lamp position={[0, 0.05, 0.03]} on={!!tally} color={tally === 'pgm' ? '#ef4444' : '#22c55e'} size={[0.03, 0.006, 0.012]} intensity={3} />
        </group>
      </group>
    </group>
  );
}

export function PcModel({ screenTex }) {
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
    </group>
  );
}

/* ---------------------------- 방 / 책상 ---------------------------- */
/* ---------------------------- 케이블 ---------------------------- */
export function Plug({ p, n, color, cable }) {
  const q = useMemo(() => quatFromNormal(n), [n]);
  return (
    <group position={p} quaternion={q}>
      <PlugBody cable={cable} color={color} />
    </group>
  );
}

export function PendingCable({ from, pointerRef, color }) {
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

// 3D에서 단자가 촘촘한 장비는 짧은 이름을 쓴다
export const SHORT_LABEL = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`analog_mixer:in${n}`, `MIC ${n}`])),
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`analog_mixer:line${n}`, `LINE ${n}`])),
  'analog_mixer:st9L': '9/10 L', 'analog_mixer:st9R': '9/10 R', 'analog_mixer:st11L': '11/12 L', 'analog_mixer:st11R': '11/12 R',
  'analog_mixer:main': 'ST OUT L', 'analog_mixer:mainR': 'ST OUT R', 'analog_mixer:aux1': 'AUX 1', 'analog_mixer:aux2': 'AUX 2', 'analog_mixer:phones': 'PHONES',
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`digital_mixer:local${n}`, `${n}`])),
  'digital_mixer:main': 'MAIN', 'digital_mixer:aux1': 'AUX', 'digital_mixer:usb': 'USB',
  'atem:in1': '1', 'atem:in2': '2', 'atem:in3': '3', 'atem:in4': '4', 'atem:usb': 'USB', 'atem:hdmiout': 'OUT', 'atem:mic1': 'MIC1', 'atem:mic2': 'MIC2',
  'atem_pro:in1': 'IN 1', 'atem_pro:in2': 'IN 2', 'atem_pro:in3': 'IN 3', 'atem_pro:in4': 'IN 4', 'atem_pro:usb': 'USB-C', 'atem_pro:eth': 'LAN', 'atem_pro:hdmiout': 'HDMI OUT',
  'atem_pro:mic1': 'MIC1', 'atem_pro:mic2': 'MIC2',
  'audio_interface:in1': 'IN 1', 'audio_interface:in2': 'IN 2', 'audio_interface:phones': '헤드폰', 'audio_interface:usb': 'USB-C', 'audio_interface:monL': 'MON L', 'audio_interface:monR': 'MON R',
  'ptz:hdmi': 'HDMI', 'ptz:sdi': 'SDI', 'ptz:lan': 'LAN', 'di_box:input': 'IN', 'di_box:thru': 'THRU', 'di_box:out': 'XLR OUT',
  'router:lan1': 'LAN1', 'router:lan2': 'LAN2',
};

// 단자 앞면 크기(반지름) — JackFace 모양과 맞춘다
export const SOCKET_R = { xlr: 0.0108, combo: 0.0108, dmx: 0.0108, trs: 0.0068, hdmi: 0.0098, sdi: 0.0068, usb: 0.0062, eth: 0.0088, mini: 0.0042 };

export function Port3D({ p, n, port, label, lift = 0, used, isPending, candidate, labels, bare, onClick }) {
  const hold = useHoldCamera();
  const q = useMemo(() => quatFromNormal(n), [n]);
  const ring = useRef();
  const [hover, setHover] = useState(false);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const pulse = candidate ? 1 + Math.sin(clock.elapsedTime * 8) * 0.25 : 1;
    ring.current.scale.setScalar((hover || isPending ? 1.3 : 1) * pulse);
    ring.current.visible = !used || hover || isPending || candidate;
  });
  const r = SOCKET_R[port.kind] ?? 0.014;
  const color = PORT_COLOR[port.kind];
  const nv = new THREE.Vector3(...n).normalize();
  const labelPos = new THREE.Vector3(...p).addScaledVector(nv, 0.05).add(new THREE.Vector3(0, 0.03 + lift, 0));
  const glow = isPending || candidate || hover;
  return (
    <group>
      <group position={p} quaternion={q}>
        {/* 실제 단자 모양 (믹서처럼 장비 모델이 단자를 직접 그리는 경우는 생략) */}
        {!bare && <JackFace kind={port.kind} />}
        {/* 단자 종류 색 테두리 — 고를 수 있는 단자는 깜빡인다 */}
        <mesh ref={ring} position={[0, 0.0035, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r + 0.0022, glow ? 0.0024 : 0.0009, 8, 28]} />
          <meshStandardMaterial
            color={isPending ? '#ffffff' : color}
            emissive={glow ? (isPending ? '#ffffff' : color) : color}
            emissiveIntensity={isPending ? 2 : glow ? 1.4 : 0.12}
          />
        </mesh>
        {/* 클릭 판정용 투명 구 */}
        <mesh
          onPointerDown={(e) => { e.stopPropagation(); hold(); }}
          onClick={(e) => { e.stopPropagation(); if (e.delta < 10) onClick(); }}
          onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'crosshair'; }}
          onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
        >
          <sphereGeometry args={[bare ? 0.019 : 0.042, 10, 8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {(labels || hover || isPending || candidate) && (
        <Label position={labelPos} center zIndexRange={[20, 0]} wrapperClass="bm-noevents">
          <div className={`whitespace-nowrap rounded px-1 py-[1px] font-mono text-[10px] leading-tight ${isPending ? 'bg-white text-slate-900' : candidate ? 'bg-sky-500 text-white' : 'bg-black/75 text-slate-100'} ${used ? 'opacity-70' : ''}`}
            style={{ borderLeft: `3px solid ${color}` }}>
            {isPending || hover || candidate ? port.label : label}
          </div>
        </Label>
      )}
    </group>
  );
}

/* ---------------------------- 배치 연출 / 선택 표시 ---------------------------- */
export function DropIn({ children }) {
  const g = useRef();
  const started = useRef(false);
  useFrame((_, dt) => {
    if (!g.current) return;
    if (!started.current) { g.current.position.y = 0.9; started.current = true; }
    g.current.position.y *= Math.exp(-Math.min(dt, 0.1) * 9);
  });
  return <group ref={g}>{children}</group>;
}

export function SelectRing({ radius }) {
  const m = useRef();
  useFrame(({ clock }) => { if (m.current) m.current.material.opacity = 0.55 + Math.sin(clock.elapsedTime * 4) * 0.25; });
  return (
    <mesh ref={m} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} raycast={noRaycast}>
      <ringGeometry args={[radius, radius + 0.025, 48]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

export function FeedbackArc({ from, to }) {
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

/* =====================================================================
 * 교육 모드용 뷰어 — 장비 하나를 받침대 위에 올려 돌려 보며 단자를 확인한다
 * ===================================================================== */
const VIEW = {
  dynamic_mic: { target: [0, 1.25, 0], dist: 1.5 }, condenser_mic: { target: [0, 1.3, 0], dist: 1.5 },
  speaker: { target: [0, 1.15, 0], dist: 2.4 }, camera: { target: [0, 1.15, 0], dist: 2.0 },
  analog_mixer: { target: [0, DESK_TOP + 0.05, 0], dist: 1.0 }, digital_mixer: { target: [0, DESK_TOP + 0.08, 0], dist: 1.3 },
  atem: { target: [0, DESK_TOP + 0.03, 0], dist: 0.75 }, pc: { target: [0, DESK_TOP + 0.3, 0], dist: 1.5 },
  audio_interface: { target: [0, DESK_TOP + 0.025, 0], dist: 0.45 }, wireless_mic: { target: [0.03, DESK_TOP + 0.08, 0], dist: 0.7 },
  di_box: { target: [0, DESK_TOP + 0.03, 0], dist: 0.42 }, headphones: { target: [0.03, DESK_TOP + 0.12, 0], dist: 0.6 },
  mirrorless: { target: [-0.02, DESK_TOP + 0.2, 0], dist: 0.55 }, ptz: { target: [0, DESK_TOP + 0.12, 0], dist: 0.6 },
  atem_pro: { target: [0, DESK_TOP + 0.12, -0.1], dist: 1.05 },
  monitor: { target: [0, 0.2, 0], dist: 1.2 }, ptz_controller: { target: [0, DESK_TOP + 0.05, 0], dist: 0.6 },
  lighting_console: { target: [0, DESK_TOP + 0.12, 0], dist: 1.4 }, par_led: { target: [0, 1.5, 0], dist: 1.4 }, moving_head: { target: [0, 1.45, 0], dist: 1.5 },
  media_server: { target: [0.1, DESK_TOP + 0.25, 0], dist: 1.4 }, projector: { target: [0, 1.4, 0], dist: 2.6 }, led_wall: { target: [0, 1.5, 0], dist: 3.6 },
  kick_mic: { target: [0, 0.25, 0], dist: 0.8 }, snare_mic: { target: [0, 0.62, 0.1], dist: 1.1 }, overhead_mic: { target: [0, 1.25, 0.2], dist: 2.2 },
  digital_piano: { target: [0, 0.9, 0], dist: 2.0 }, bass_guitar: { target: [0, 1.0, 0], dist: 2.0 }, drum_kit: { target: [0, 0.7, 0], dist: 2.8 },
};
// 책상(받침대) 위에 올려 보여 줄 장비와 받침대 크기 [가로, 세로]
const PEDESTAL = {
  analog_mixer: [0.85, 0.65], digital_mixer: [1.3, 0.65], atem: [0.6, 0.4], pc: [1.3, 0.65], audio_interface: [0.42, 0.32],
  wireless_mic: [0.55, 0.38], di_box: [0.32, 0.32], headphones: [0.45, 0.35], mirrorless: [0.42, 0.38], ptz: [0.4, 0.4], atem_pro: [0.75, 0.75],
  ptz_controller: [0.5, 0.35], lighting_console: [1.15, 0.75], media_server: [1.3, 0.65],
};
// 매달아 보여 줄 장비 (스탠드 높이)
const HANG_H = { par_led: 1.75, moving_head: 1.8, projector: 1.75 };

function ViewerRig({ target, dist }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const t = new THREE.Vector3(...target);
    camera.position.copy(t).add(new THREE.Vector3(0.55, 0.45, 1).normalize().multiplyScalar(dist));
    if (controls) { controls.target.copy(t); controls.update(); }
  }, [target.join(), dist, controls, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function StaticPort({ p, n, port, label, lift = 0, scale = 1 }) {
  const q = useMemo(() => quatFromNormal(n), [n]);
  const r = (SOCKET_R[port.kind] ?? 0.014) * scale;
  const nv = new THREE.Vector3(...n).normalize();
  const labelPos = new THREE.Vector3(...p).addScaledVector(nv, 0.05).add(new THREE.Vector3(0, 0.03 + lift, 0));
  return (
    <group>
      <group position={p} quaternion={q}>
        <mesh><cylinderGeometry args={[r, r, 0.012, 20]} /><meshStandardMaterial color="#050608" /></mesh>
        <mesh position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r + 0.003 * scale, 0.0035 * scale, 8, 24]} />
          <meshStandardMaterial color={PORT_COLOR[port.kind]} emissive={PORT_COLOR[port.kind]} emissiveIntensity={0.8} />
        </mesh>
      </group>
      <Label position={labelPos} center zIndexRange={[20, 0]} wrapperClass="bm-noevents">
        <div className="whitespace-nowrap rounded bg-black/80 px-1.5 py-[1px] font-mono text-[11px] text-slate-100" style={{ borderLeft: `3px solid ${PORT_COLOR[port.kind]}` }}>
          {label}
        </div>
      </Label>
    </group>
  );
}

export function EquipmentViewer({ type, demo, autoRotate = true }) {
  const def = DEVICE_TYPES[type];
  const v = VIEW[type];
  const onDesk = !!PEDESTAL[type];
  const base = onDesk ? DESK_TOP : HANG_H[type] ?? 0;
  const vjTex = useCanvasTexture(640, 360, (ctx, w, h) => drawComposition(ctx, demo.vj?.playing === false ? [] : demo.vj?.layers, 0, 0, w, h, 0, { master: demo.vj?.master ?? 100 }), [JSON.stringify(demo.vj)]);
  const joyLcd = useCanvasTexture(400, 120, (ctx, w, h) => drawPtzLcd(ctx, w, h, { selected: demo.joySel ?? 0, ip: `192.168.1.2${(demo.joySel ?? 0) + 1}`, reach: true, framing: '설교자 클로즈업' }), [demo.joySel]);
  const obsTex = useCanvasTexture(1024, 576, (ctx, w, h) => drawObsScreen(ctx, w, h, {
    obsVideo: demo.obsVideo, obs: { streaming: demo.streaming, audioSource: 'x32', audioMuted: false, videoSource: 'atem' },
    atem: { transitioning: false }, obsAudioLv: demo.level, viewers: 1280,
  }), [demo.obsVideo, demo.streaming, Math.round((demo.level ?? -99) / 2)]);
  const x32Tex = useCanvasTexture(1024, 256, (ctx, w, h) => drawX32Screen(ctx, w, h, {
    mixer: demo.mixer, micAtCh: true, condenser: false, chLv: demo.chLevel, mainLv: demo.mainLevel,
  }), [demo.mixer, Math.round((demo.chLevel ?? -99) / 3), Math.round((demo.mainLevel ?? -99) / 3)]);
  const mvTex = useCanvasTexture(1024, 576, (ctx, w, h) => drawMultiview(ctx, w, h, {
    program: demo.atem.program, preview: demo.atem.preview, pip: demo.pip, streaming: demo.streaming, recording: demo.recording,
  }), [demo.atem.program, demo.atem.preview, demo.pip, demo.streaming, demo.recording]);
  const lcdTex = useCanvasTexture(512, 160, (ctx, w, h) => drawWirelessLcd(ctx, w, h, {
    power: demo.txPower, rf: demo.rf, battery: demo.battery, channel: demo.channel, talking: demo.talking,
  }), [demo.txPower, demo.rf, demo.battery, demo.channel, demo.talking, Math.round(demo.chLevel ?? 0)]);
  const camLcdTex = useCanvasTexture(480, 320, (ctx, w, h) => drawCamLcd(ctx, w, h, { clean: demo.clean, rec: demo.rec }), [demo.clean, demo.rec]);

  let model = null;
  if (type === 'dynamic_mic' || type === 'condenser_mic') model = <MicModel type={type} live={demo.talking} phantomOk={demo.mixer.phantom} />;
  if (type === 'analog_mixer' || type === 'digital_mixer') {
    const m = demo.mixer;
    const chs = demoChannels({ gain: m.gain, lowCut: !!m.lowCut, eqHigh: m.eqHigh ?? 0, eqMid: m.eqMid ?? 0, eqLow: m.eqLow ?? 0, fx: m.fx ?? 0, aux: 0, mute: !!m.chMute, fader: m.chFader, phantom: !!m.phantom, patch: null });
    const meters = { ch: chs.map((_, i) => (i === 0 ? demo.chLevel : null)), main: demo.mainLevel, aux: null };
    const master = { mainFader: m.mainFader, mainMute: !!m.mainMute, auxMaster: 75, aux2Master: 75, fxReturn: 50, phonesLevel: 75, phantom: !!m.phantom, usbOut: m.usbOut === 'main' ? 'main' : 'off' };
    const names = ['MIC 1', '', '', '', '', '', '', '', '', ''];
    model = type === 'analog_mixer'
      ? <AnalogConsole channels={chs} master={master} meters={meters} names={names} />
      : <DigitalConsole channels={chs} master={master} meters={meters} names={names} selected={0} />;
  }
  if (type === 'speaker') model = <SpeakerModel power={demo.power} level={demo.power ? demo.mainLevel : null} feedback={demo.feedback} />;
  if (type === 'camera') model = <CameraModel tally={demo.tally} />;
  if (type === 'atem') model = <AtemModel atem={demo.atem} camAt={{ 1: 'cam1', 2: 'cam2' }} />;
  if (type === 'pc') model = <PcModel screenTex={obsTex} />;
  if (type === 'audio_interface') {
    model = <AudioInterfaceModel gain={demo.mixer.gain} level={demo.chLevel} phantom={demo.mixer.phantom} inst={demo.inst} air={demo.air} monitor={demo.monitor} direct={demo.direct} />;
  }
  if (type === 'wireless_mic') model = <WirelessMicModel power={demo.txPower} battery={demo.battery} rf={demo.rf} lcdTex={lcdTex} talking={demo.talking} />;
  if (type === 'di_box') model = <DiBoxModel groundLift={demo.groundLift} pad={demo.pad} />;
  if (type === 'kick_mic') model = <KickMicModel live={demo.talking} />;
  if (type === 'snare_mic') model = <SnareMicModel live={demo.talking} />;
  if (type === 'overhead_mic') model = <OverheadMicModel live={demo.talking} phantomOk={!!demo.mixer?.phantom} />;
  if (type === 'digital_piano') model = <DigitalPianoModel performing />;
  if (type === 'bass_guitar') model = <BassGuitarModel performing />;
  if (type === 'drum_kit') model = <DrumKitModel performing />;
  if (type === 'headphones') model = <HeadphonesModel />;
  if (type === 'mirrorless') model = <MirrorlessModel zoom={demo.zoom} rec={demo.rec} lcdTex={camLcdTex} />;
  if (type === 'ptz') model = <PtzModel pan={demo.pan} tilt={demo.tilt} zoom={demo.zoom} tally={demo.tally} />;
  if (type === 'atem_pro') model = <AtemProModel atem={demo.atem} streaming={demo.streaming} recording={demo.recording} pip={demo.pip} mvTex={mvTex} />;
  if (type === 'monitor') model = <WedgeModel power={demo.power} level={demo.power && demo.talking ? -12 : null} feedback={demo.power && demo.wedgeFeedback} />;
  const L = demo.light ?? { intensity: 0.8, color: '#ffffff', pan: 0, tilt: 0 };
  if (type === 'par_led') model = <ParLedModel intensity={L.intensity} color={L.color} flicker={L.flicker} aimTilt={0.55} beamLength={2.2} />;
  if (type === 'moving_head') model = <MovingHeadModel intensity={L.intensity} color={L.color} pan={L.pan} tilt={L.tilt} flicker={L.flicker} aimTilt={0.3} beamLength={2.2} />;
  if (type === 'lighting_console') model = <LightingConsoleModel cs={demo.cs} />;
  if (type === 'media_server') model = <MediaServerModel m={demo.vj} />;
  if (type === 'projector') model = <ProjectorModel power={demo.screenOn} on={demo.screenOn} />;
  if (type === 'led_wall') model = <group scale={0.55}><LedWallModel w={4.2} h={2.25} tex={vjTex} on={demo.screenOn} power={demo.screenOn} /></group>;
  if (type === 'ptz_controller') model = <PtzControllerModel selected={demo.joySel ?? 0} tallies={['pgm', 'pvw', null, null]} lcdTex={joyLcd} />;
  const portMap = PORTS3D[type] ?? PORTS_EXTRA[type] ?? PORTS_LIGHT[type] ?? PORTS_INSTR[type] ?? {};
  const portScale = type === 'led_wall' ? 0.55 : 1;
  // 탈리·하울링·화면 불빛 (라이트 1개를 늘 달아 두고 위치·세기만 바꾼다)
  const glowKey = type === 'speaker' && demo.feedback ? 'feedback' : type === 'camera' && demo.tally === 'pgm' ? 'tally'
    : type === 'monitor' && demo.power && demo.wedgeFeedback ? 'wedge' : type === 'pc' && demo.streaming ? 'streaming' : type === 'led_wall' && demo.screenOn ? 'ledWall' : null;
  const glows = glowKey ? [{ ...GLOW[glowKey], pos: [GLOW[glowKey].at[0] * portScale, base + GLOW[glowKey].at[1] * portScale, GLOW[glowKey].at[2] * portScale] }] : [];

  return (
    <CanvasShell shadows dpr={[1, 1.75]} camera={{ fov: 38, near: 0.02, far: 40, position: [1, 1.5, 2] }} style={{ touchAction: 'none' }}>
      <color attach="background" args={['#131a27']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#d6e2f5', '#2a2622', 1.0]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <spotLight position={[-1.5, 3, 2]} angle={0.6} penumbra={0.8} intensity={14} decay={1.4} color="#ffe9d0" />
      <GlowLights glows={glows} count={1} />
      <ViewerRig target={v.target} dist={v.dist} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} autoRotate={autoRotate} autoRotateSpeed={1.2}
        minDistance={v.dist * 0.4} maxDistance={v.dist * 2.2} maxPolarAngle={Math.PI / 2.05} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[3, 64]} /><meshStandardMaterial color="#232b3a" /></mesh>
      <Grid position={[0, 0.002, 0]} args={[6, 6]} cellSize={0.25} cellColor="#2c3850" sectionSize={1} sectionColor="#3b4a68" fadeDistance={6} infiniteGrid />
      {onDesk && (
        <RoundedBox args={[PEDESTAL[type][0], DESK_TOP, PEDESTAL[type][1]]} radius={0.01} position={[type === 'pc' ? -0.1 : 0, DESK_TOP / 2, type === 'atem_pro' ? -0.1 : 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#6b4f3a" roughness={0.6} />
        </RoundedBox>
      )}
      {HANG_H[type] && (
        <group>
          <mesh position={[0, base / 2, -0.02]} castShadow><cylinderGeometry args={[0.02, 0.025, base, 10]} /><meshStandardMaterial color="#1c1f24" metalness={0.5} /></mesh>
          <mesh position={[0, base + 0.06, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.6, 8]} /><meshStandardMaterial color="#9ca3af" metalness={0.8} /></mesh>
          {[0, 2.094, 4.188].map((a) => <mesh key={a} position={[Math.sin(a) * 0.25, 0.12, Math.cos(a) * 0.25]} rotation={[Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0]}><cylinderGeometry args={[0.012, 0.012, 0.6, 6]} /><meshStandardMaterial color="#1c1f24" /></mesh>)}
        </group>
      )}
      {type === 'projector' && <group position={[0, 1.2, -2.2]}><ProjectedScreen w={2.2} h={1.24} tex={vjTex} on={demo.screenOn} /></group>}
      <group position={[0, base, 0]} rotation={[0, type === 'projector' ? Math.PI : 0, 0]}>
        {model}
        {Object.entries(portMap).map(([pid, pd], idx) => {
          const port = [...def.ins, ...def.outs].find((pp) => pp.id === pid);
          if (!port) return null;
          return (
            <StaticPort key={pid} p={pd.p.map((v) => v * portScale)} n={pd.n} port={port} label={SHORT_LABEL[`${type}:${pid}`] ?? port.label}
              lift={STAGGER.has(type) && idx % 2 ? (PORT_SCALE[type] ? 0.022 : 0.035) : 0} scale={PORT_SCALE[type] ?? 1} />
          );
        })}
      </group>
    </CanvasShell>
  );
}

/* ---------------------------- 케이블 커넥터 모델 ---------------------------- */
export function ConnectorModel({ kind, color, female = false }) {
  const metal = <meshStandardMaterial color="#cfd5dc" metalness={0.9} roughness={0.2} />;
  const body = <meshStandardMaterial color="#17191d" roughness={0.5} />;
  switch (kind) {
    case 'xlr':
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.024, 0.02, 0.1, 24]} />{body}</mesh>
          {female ? (
            <>
              <mesh position={[0, 0.104, 0]}><cylinderGeometry args={[0.021, 0.021, 0.01, 24]} /><meshStandardMaterial color="#202226" /></mesh>
              {[[-0.008, 0.004], [0.008, 0.004], [0, -0.009]].map(([x, z]) => (
                <mesh key={`${x}${z}`} position={[x, 0.1095, z]}><cylinderGeometry args={[0.0026, 0.0026, 0.002, 10]} /><meshStandardMaterial color="#000000" /></mesh>
              ))}
              <mesh position={[0.016, 0.098, 0]}><boxGeometry args={[0.006, 0.01, 0.008]} />{metal}</mesh>
            </>
          ) : (
            <>
              <mesh position={[0, 0.112, 0]}><cylinderGeometry args={[0.022, 0.022, 0.026, 24, 1, true]} />{metal}</mesh>
              {[[-0.008, 0.004], [0.008, 0.004], [0, -0.009]].map(([x, z]) => (
                <mesh key={`${x}${z}`} position={[x, 0.112, z]}><cylinderGeometry args={[0.0022, 0.0022, 0.03, 8]} />{metal}</mesh>
              ))}
            </>
          )}
          <mesh position={[0, 0.022, 0]}><cylinderGeometry args={[0.0245, 0.0245, 0.008, 24]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 'trs':
      return (
        <group>
          <mesh position={[0, 0.04, 0]} castShadow><cylinderGeometry args={[0.014, 0.012, 0.08, 20]} />{body}</mesh>
          <mesh position={[0, 0.095, 0]}><cylinderGeometry args={[0.0032, 0.0032, 0.03, 12]} />{metal}</mesh>
          <mesh position={[0, 0.103, 0]}><cylinderGeometry args={[0.0034, 0.0034, 0.002, 12]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0, 0.112, 0]}><cylinderGeometry args={[0.0034, 0.0034, 0.002, 12]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[0, 0.118, 0]}><sphereGeometry args={[0.0032, 12, 8]} />{metal}</mesh>
          <mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.0145, 0.0145, 0.006, 20]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 'hdmi':
      return (
        <group>
          <mesh position={[0, 0.03, 0]} castShadow><boxGeometry args={[0.032, 0.06, 0.013]} />{body}</mesh>
          <mesh position={[0, 0.07, 0]}><boxGeometry args={[0.021, 0.02, 0.0065]} />{metal}</mesh>
          <mesh position={[0, 0.012, 0]}><boxGeometry args={[0.0325, 0.006, 0.0135]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 'sdi':
      return (
        <group>
          <mesh position={[0, 0.035, 0]} castShadow><cylinderGeometry args={[0.009, 0.008, 0.07, 16]} />{body}</mesh>
          <mesh position={[0, 0.083, 0]}><cylinderGeometry args={[0.0085, 0.0085, 0.028, 20]} />{metal}</mesh>
          {[-1, 1].map((sx) => <mesh key={sx} position={[sx * 0.0095, 0.083, 0]}><boxGeometry args={[0.003, 0.004, 0.003]} />{metal}</mesh>)}
          <mesh position={[0, 0.1, 0]}><cylinderGeometry args={[0.001, 0.001, 0.01, 8]} /><meshStandardMaterial color="#d4af37" metalness={0.9} /></mesh>
          <mesh position={[0, 0.012, 0]}><cylinderGeometry args={[0.0095, 0.0095, 0.006, 16]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 'mini':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.006, 0.005, 0.04, 16]} />{body}</mesh>
          <mesh position={[0, 0.048, 0]}><cylinderGeometry args={[0.0018, 0.0018, 0.016, 10]} />{metal}</mesh>
          {[0.044, 0.05].map((y) => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.00185, 0.00185, 0.0012, 10]} /><meshStandardMaterial color="#111" /></mesh>)}
          <mesh position={[0, 0.057, 0]}><sphereGeometry args={[0.0018, 10, 8]} />{metal}</mesh>
          <mesh position={[0, 0.006, 0]}><cylinderGeometry args={[0.0062, 0.0062, 0.004, 16]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 'rca':
      return (
        <group>
          <mesh position={[0, 0.025, 0]} castShadow><cylinderGeometry args={[0.008, 0.007, 0.05, 18]} />{body}</mesh>
          <mesh position={[0, 0.042, 0]}><cylinderGeometry args={[0.0082, 0.0082, 0.006, 18]} /><meshStandardMaterial color={color} /></mesh>
          <mesh position={[0, 0.056, 0]}><cylinderGeometry args={[0.0048, 0.0048, 0.012, 16, 1, true]} />{metal}</mesh>
          <mesh position={[0, 0.058, 0]}><cylinderGeometry args={[0.0013, 0.0013, 0.016, 8]} /><meshStandardMaterial color="#d4af37" metalness={0.9} /></mesh>
        </group>
      );
    case 'speakon':
      return (
        <group>
          <mesh position={[0, 0.035, 0]} castShadow><cylinderGeometry args={[0.016, 0.014, 0.07, 24]} /><meshStandardMaterial color="#1f2937" roughness={0.6} /></mesh>
          <mesh position={[0, 0.074, 0]}><cylinderGeometry args={[0.017, 0.017, 0.012, 24]} /><meshStandardMaterial color="#2563eb" /></mesh>
          <mesh position={[0, 0.082, 0]}><cylinderGeometry args={[0.011, 0.011, 0.01, 20]} /><meshStandardMaterial color="#111" /></mesh>
          {[-1, 1].map((sx) => <mesh key={sx} position={[sx * 0.0115, 0.084, 0]}><boxGeometry args={[0.004, 0.008, 0.005]} /><meshStandardMaterial color="#111" /></mesh>)}
          <mesh position={[0, 0.06, 0]}><torusGeometry args={[0.0165, 0.0018, 8, 24]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
    case 'eth':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.014, 0.04, 0.01]} /><meshStandardMaterial color={color} roughness={0.5} /></mesh>
          <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.0115, 0.022, 0.0075]} /><meshStandardMaterial color="#dbeafe" transparent opacity={0.55} roughness={0.1} /></mesh>
          {Array.from({ length: 8 }).map((_, i) => <mesh key={i} position={[-0.0044 + i * 0.00126, 0.059, 0.0035]}><boxGeometry args={[0.0007, 0.004, 0.0006]} /><meshStandardMaterial color="#d4af37" metalness={0.9} /></mesh>)}
          <mesh position={[0, 0.047, -0.0055]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.005, 0.02, 0.0012]} /><meshStandardMaterial color="#dbeafe" transparent opacity={0.7} /></mesh>
        </group>
      );
    case 'usb':
    default:
      return (
        <group>
          <mesh position={[0, 0.025, 0]} castShadow><boxGeometry args={[0.016, 0.05, 0.008]} />{body}</mesh>
          <mesh position={[0, 0.058, 0]}><boxGeometry args={[0.0088, 0.016, 0.0032]} />{metal}</mesh>
          <mesh position={[0, 0.01, 0]}><boxGeometry args={[0.0165, 0.005, 0.0085]} /><meshStandardMaterial color={color} /></mesh>
        </group>
      );
  }
}

export function CableShowcase({ kind, color: colorProp }) {
  const color = colorProp ?? CABLES[kind]?.stroke ?? '#94a3b8';
  const thick = { trs: 0.0065, xlr: 0.0065, speakon: 0.008, rca: 0.004, mini: 0.0025, eth: 0.003 }[kind] ?? 0.0045;
  const tube = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0.35, 0), new THREE.Vector3(-0.2, 0.18, 0.05), new THREE.Vector3(0, 0.05, 0.12),
      new THREE.Vector3(0.2, 0.18, 0.05), new THREE.Vector3(0.12, 0.35, 0),
    ]);
    return new THREE.TubeGeometry(curve, 80, thick, 10, false);
  }, [kind, thick]);
  useEffect(() => () => tube.dispose(), [tube]);
  return (
    <CanvasShell shadows dpr={[1, 1.75]} camera={{ fov: 35, near: 0.01, far: 20, position: [0.25, 0.5, 0.75] }} style={{ touchAction: 'none' }}>
      <color attach="background" args={['#131a27']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#d6e2f5', '#2a2622', 1.0]} />
      <directionalLight position={[1, 2, 1.5]} intensity={2.4} castShadow />
      <OrbitControls makeDefault enableDamping autoRotate autoRotateSpeed={1.5} target={[0, 0.33, 0]} minDistance={0.2} maxDistance={1.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[1, 48]} /><meshStandardMaterial color="#232b3a" /></mesh>
      <mesh geometry={tube} castShadow><meshStandardMaterial color={kind === 'sdi' ? '#1e3a8a' : kind === 'eth' ? '#2563eb' : '#1f2329'} roughness={0.6} /></mesh>
      <group position={[-0.12, 0.35, 0]}><ConnectorModel kind={kind} color={kind === 'rca' ? '#ef4444' : color} /></group>
      <group position={[0.12, 0.35, 0]} rotation={[0, Math.PI / 2, 0]}><ConnectorModel kind={kind} color={kind === 'rca' ? '#f1f5f9' : color} female={kind === 'xlr'} /></group>
      {kind === 'xlr' && (
        <>
          <Label position={[-0.12, 0.5, 0]} center zIndexRange={[20, 0]} wrapperClass="bm-noevents"><div className="rounded bg-black/80 px-2 py-0.5 text-[11px] text-white whitespace-nowrap">수(Male) · 핀 3개</div></Label>
          <Label position={[0.12, 0.5, 0]} center zIndexRange={[20, 0]} wrapperClass="bm-noevents"><div className="rounded bg-black/80 px-2 py-0.5 text-[11px] text-white whitespace-nowrap">암(Female) · 구멍 3개</div></Label>
        </>
      )}
    </CanvasShell>
  );
}

/* ---------------------------- 믹서 크기 비교 (소형·중형·대형) ---------------------------- */
const MIXER_SIZE_VIEW = {
  small: { channels: 6, ped: [0.75, 0.6], target: [0, DESK_TOP + 0.05, 0], dist: 0.95 },
  medium: { channels: 16, ped: [1.35, 0.65], target: [0, DESK_TOP + 0.05, 0], dist: 1.45 },
  large: { ped: [1.95, 1.0], target: [0, DESK_TOP + 0.12, 0], dist: 1.75 },
};
const DEMO_MIX = { ...MIXER_DEFAULT, gain: 30, chFader: 70, mainFader: 75 };
export function MixerSizeViewer({ size }) {
  const v = MIXER_SIZE_VIEW[size];
  const screenTex = useCanvasTexture(1024, 256, (ctx, w, h) => drawX32Screen(ctx, w, h, { mixer: DEMO_MIX, micAtCh: true, condenser: false, chLv: -14, mainLv: -12 }), []);
  return (
    <CanvasShell shadows dpr={[1, 1.75]} camera={{ fov: 38, near: 0.02, far: 40, position: [1, 1.5, 2] }} style={{ touchAction: 'none' }}>
      <color attach="background" args={['#131a27']} />
      <ambientLight intensity={0.8} />
      <hemisphereLight args={['#d6e2f5', '#2a2622', 1.0]} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <ViewerRig target={v.target} dist={v.dist} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.2} autoRotate autoRotateSpeed={0.8} minDistance={v.dist * 0.4} maxDistance={v.dist * 2} maxPolarAngle={Math.PI / 2.05} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[4, 64]} /><meshStandardMaterial color="#232b3a" /></mesh>
      <Grid position={[0, 0.002, 0]} args={[8, 8]} cellSize={0.25} cellColor="#2c3850" sectionSize={1} sectionColor="#3b4a68" fadeDistance={8} infiniteGrid />
      <RoundedBox args={[v.ped[0], DESK_TOP, v.ped[1]]} radius={0.01} position={[0, DESK_TOP / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#6b4f3a" roughness={0.6} />
      </RoundedBox>
      <group position={[0, DESK_TOP, 0]}>
        {size === 'large' ? <LargeConsoleModel screenTex={screenTex} /> : <AnalogMixerModel mixer={DEMO_MIX} chLevel={-14} mainLevel={-12} channels={v.channels} />}
      </group>
    </CanvasShell>
  );
}
