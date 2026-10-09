import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, CheckCircle2, XCircle, Lightbulb, AlertTriangle, MapPin, Cpu, Plug, Play,
  Mic, SlidersHorizontal, Camera, Tv, MonitorPlay, Cable, GraduationCap, ArrowRight, AudioLines, Workflow, Check, Lightbulb as LightIcon, Clapperboard,
} from 'lucide-react';
import { CLIPS } from './scenes.js';
import { DEVICE_TYPES, PORT_KIND_LABEL, PORT_COLOR, CABLES, MIXER_DEFAULT, MIC_LEVEL, faderDb, fmtDb } from './engine.js';
import { EquipmentViewer, CableShowcase, MixerSizeViewer } from './Studio3D.jsx';
import AudioLab from './AudioLab.jsx';
import FadeLab from './FadeLab.jsx';
import { Meter, Slider, ToggleBtn, Scene, loadProgress, saveProgress } from './ui.jsx';
import { EDU_CATEGORIES, EDU_ITEMS } from './eduContent.js';
import { CONCEPT, MixerSizes } from './eduVisuals.jsx';

/* =====================================================================
 * 교육 모드 — 장비를 3D로 돌려 보고, 직접 만져 보고, 퀴즈로 확인한다
 * ===================================================================== */

const CAT_ICON = { '기초 개념': Workflow, 마이크: Mic, '음향 장비': SlidersHorizontal, '소리 다루기': AudioLines, 카메라: Camera, 'ATEM · 스위처': Tv, 송출: MonitorPlay, 조명: LightIcon, '영상 연출': Clapperboard, 케이블: Cable };
const STAGE_TITLE = { 'live-2': '4장 모니터 믹스', 'ptz-1': '8장 PTZ 조이스틱', 'ptz-2': '8장 탈리 운용', 'light-1': '6장 설교 조명', 'light-2': '6장 무빙 큐', 'light-3': '6장 조명 사고', 'vj-1': '7장 가사 띄우기', 'vj-2': '7장 LED와 송출' };

const DEMO_DEFAULT = {
  talking: true,
  mixer: { ...MIXER_DEFAULT, gain: 28, phantom: true },
  power: true, feedback: false, tally: 'pgm',
  atem: { program: 1, preview: 2, transitioning: false },
  obsVideo: 'cam1', streaming: true,
  // 오디오 인터페이스
  inst: false, air: false, monitor: 60, direct: true,
  // 무선 마이크
  txPower: true, rf: 80, battery: 70, channel: 3,
  // DI 박스
  groundLift: false, pad: false,
  // 카메라 (미러리스 / PTZ)
  clean: false, rec: true, zoom: 0.3, pan: 0, tilt: 0,
  // ATEM Mini Pro
  pip: false, recording: false,
  // 조명
  light: { intensity: 0.85, color: '#2563eb', pan: 20, tilt: 15, flicker: false },
  cs: { gm: 100, blackout: false, patch: [{ n: 1, label: 'FRONT L', type: 'par_led', address: 1 }, { n: 2, label: 'FRONT R', type: 'par_led', address: 9 }, { n: 3, label: 'MOVER 1', type: 'moving_head', address: 17 }],
    playbacks: [{ label: '프론트 워시', level: 80, cue: { fixtures: [1, 2], intensity: 85, color: '#fff1d6' } }, { label: '찬양 블루', level: 0, cue: { fixtures: [3], intensity: 100, color: '#2563eb' } }], programmer: { sel: [], intensity: null, color: null, pan: null, tilt: null } },
  // 미디어 서버 / 화면
  vj: { layers: [{ clip: 'concert', opacity: 100 }, { clip: 'lyrics', opacity: 0 }, { clip: 'logo', opacity: 100 }], master: 100, out1: 'comp', out2: 'comp', playing: true, compRes: '1920x1080' },
  screenOn: true,
  // 모니터 / 조이스틱
  wedgeFeedback: false, joySel: 0,
};
const LIGHT_COLORS = [['#ffffff', '흰색'], ['#fff1d6', '따뜻한 흰색'], ['#ef4444', '빨강'], ['#facc15', '노랑'], ['#22c55e', '초록'], ['#2563eb', '파랑'], ['#a855f7', '보라'], ['#ec4899', '분홍']];
const PTZ_PRESETS = { 1: { pan: 0, tilt: 0, zoom: 0.2, name: '정면 와이드' }, 2: { pan: -35, tilt: 8, zoom: 0.8, name: '진행자 클로즈업' }, 3: { pan: 40, tilt: -6, zoom: 0.5, name: '객석' } };

/* ---------------------------- 체험 컨트롤 ---------------------------- */
function DemoControls({ type, demo, set }) {
  const mix = (k, v) => set({ ...demo, mixer: { ...demo.mixer, [k]: v } });
  const talk = (
    <ToggleBtn on={demo.talking} color="green" onClick={() => set({ ...demo, talking: !demo.talking })}>
      {demo.talking ? '말하는 중' : '말하기'}
    </ToggleBtn>
  );
  switch (type) {
    case 'dynamic_mic':
      return <div className="flex flex-wrap gap-2 items-center">{talk}<span className="text-xs text-slate-400">말하면 마이크 머리(그릴)가 신호를 받아 빛납니다.</span></div>;
    case 'condenser_mic':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {talk}
          <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>+48V 팬텀</ToggleBtn>
          <span className="text-xs text-slate-400">팬텀 전원을 끄면 말해도 신호가 나오지 않습니다.</span>
        </div>
      );
    case 'analog_mixer':
    case 'digital_mixer':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {talk}
            <ToggleBtn on={demo.mixer.chMute} onClick={() => mix('chMute', !demo.mixer.chMute)}>MUTE</ToggleBtn>
            <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>48V</ToggleBtn>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Slider id="edu-gain" label="GAIN" value={demo.mixer.gain} min={0} max={60} onChange={(v) => mix('gain', v)} display={`+${demo.mixer.gain} dB`} accent="accent-red-400" />
            {type === 'analog_mixer'
              ? <Slider id="edu-eq" label="EQ MID" value={demo.mixer.eqMid} min={-15} max={15} onChange={(v) => mix('eqMid', v)} display={`${demo.mixer.eqMid > 0 ? '+' : ''}${demo.mixer.eqMid}`} accent="accent-amber-300" />
              : (
                <label htmlFor="edu-route" className="text-xs text-slate-400">USB 출력 라우팅
                  <select id="edu-route" value={demo.mixer.usbOut} onChange={(e) => mix('usbOut', e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100">
                    <option value="main">Main L/R</option><option value="bus1">Mix Bus 1</option><option value="off">Off</option>
                  </select>
                </label>
              )}
            <Slider id="edu-chf" label="채널 페이더" value={demo.mixer.chFader} min={0} max={100} onChange={(v) => mix('chFader', v)} display={fmtDb(faderDb(demo.mixer.chFader))} />
            <Slider id="edu-mainf" label="메인 페이더" value={demo.mixer.mainFader} min={0} max={100} onChange={(v) => mix('mainFader', v)} display={fmtDb(faderDb(demo.mixer.mainFader))} />
          </div>
          <p className="text-xs text-slate-400">슬라이더를 움직이면 3D 믹서의 노브와 페이더, LED 미터가 함께 움직입니다.</p>
        </div>
      );
    case 'speaker':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleBtn on={demo.power} color="green" onClick={() => set({ ...demo, power: !demo.power })}>POWER</ToggleBtn>
          {talk}
          <ToggleBtn on={demo.feedback} onClick={() => set({ ...demo, feedback: !demo.feedback })}>하울링 재현</ToggleBtn>
          <span className="text-xs text-slate-400">소리가 나면 콘(우퍼)이 떨리고 음파가 퍼집니다.</span>
        </div>
      );
    case 'camera':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {[[null, '탈리 꺼짐'], ['pvw', 'PVW (초록)'], ['pgm', 'PGM (빨강)']].map(([v, t]) => (
            <button key={t} type="button" onClick={() => set({ ...demo, tally: v })}
              className={`px-3 py-1.5 rounded border text-xs font-bold ${demo.tally === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
          ))}
        </div>
      );
    case 'atem':
      return (
        <div className="space-y-2">
          {[['PGM', 'program', 'bg-red-600 border-red-400'], ['PVW', 'preview', 'bg-green-600 border-green-400']].map(([lbl, key, onCls]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-9 text-[11px] font-bold text-slate-400">{lbl}</span>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => set({ ...demo, atem: { ...demo.atem, [key]: n } })}
                  className={`w-9 h-9 rounded border text-sm font-bold ${demo.atem[key] === n ? onCls : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>{n}</button>
              ))}
              {key === 'program' && (
                <button type="button" onClick={() => set({ ...demo, atem: { ...demo.atem, program: demo.atem.preview, preview: demo.atem.program } })}
                  className="ml-2 px-4 h-9 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
              )}
            </div>
          ))}
        </div>
      );
    case 'pc':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {[['cam1', '카메라 1'], ['cam2', '카메라 2'], ['nosignal', '신호 없음'], ['black', '블랙']].map(([v, t]) => (
            <button key={v} type="button" onClick={() => set({ ...demo, obsVideo: v })}
              className={`px-3 py-1.5 rounded border text-xs font-bold ${demo.obsVideo === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
          ))}
          <ToggleBtn on={demo.streaming} onClick={() => set({ ...demo, streaming: !demo.streaming })}>LIVE</ToggleBtn>
          {talk}
        </div>
      );
    case 'audio_interface':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {talk}
            <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>+48V</ToggleBtn>
            <ToggleBtn on={demo.inst} onClick={() => set({ ...demo, inst: !demo.inst })}>INST (악기)</ToggleBtn>
            <ToggleBtn on={demo.air} color="amber" onClick={() => set({ ...demo, air: !demo.air })}>AIR</ToggleBtn>
            <ToggleBtn on={demo.direct} color="green" onClick={() => set({ ...demo, direct: !demo.direct })}>다이렉트 모니터</ToggleBtn>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Slider id="edu-ai-gain" label="GAIN (링 색이 바뀝니다)" value={demo.mixer.gain} min={0} max={60} onChange={(v) => mix('gain', v)} display={`+${demo.mixer.gain} dB`} accent="accent-red-400" />
            <Slider id="edu-ai-mon" label="MONITOR (스피커/헤드폰 볼륨)" value={demo.monitor} min={0} max={100} onChange={(v) => set({ ...demo, monitor: v })} display={`${demo.monitor}%`} />
          </div>
          <p className="text-xs text-slate-400">GAIN 링: <span className="text-green-400">초록 = 적당</span> · <span className="text-amber-300">주황 = 큼</span> · <span className="text-red-400">빨강 = 클리핑</span></p>
        </div>
      );
    case 'wireless_mic':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <ToggleBtn on={demo.txPower} color="green" onClick={() => set({ ...demo, txPower: !demo.txPower })}>송신기 전원</ToggleBtn>
            {talk}
            <label htmlFor="edu-ch" className="text-xs text-slate-400 flex items-center gap-1.5">채널
              <select id="edu-ch" value={demo.channel} onChange={(e) => set({ ...demo, channel: Number(e.target.value) })}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-100">
                {[1, 2, 3, 4].map((c) => <option key={c} value={c}>CH {c}</option>)}
              </select>
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Slider id="edu-rf" label="전파 세기 (거리·장애물)" value={demo.rf} min={0} max={100} onChange={(v) => set({ ...demo, rf: v })} display={`${demo.rf}%`} />
            <Slider id="edu-bat" label="송신기 배터리" value={demo.battery} min={0} max={100} onChange={(v) => set({ ...demo, battery: v })} display={`${demo.battery}%`} accent="accent-green-400" />
          </div>
          <p className="text-xs text-slate-400">수신기 화면(LCD)에 채널·주파수, RF(전파)·AF(소리) 막대, 배터리가 표시됩니다. 전파가 15% 아래로 떨어지면 소리가 끊깁니다.</p>
        </div>
      );
    case 'di_box':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleBtn on={demo.groundLift} onClick={() => set({ ...demo, groundLift: !demo.groundLift })}>GROUND LIFT</ToggleBtn>
          <ToggleBtn on={demo.pad} color="amber" onClick={() => set({ ...demo, pad: !demo.pad })}>PAD -20dB</ToggleBtn>
          <span className="text-xs text-slate-400">{demo.groundLift ? '접지를 끊어 "웅—" 하는 험 잡음을 없앱니다.' : demo.pad ? '입력 신호를 20dB 줄여 큰 신호의 찌그러짐을 막습니다.' : '스위치를 눌러 레버가 움직이는 것을 확인하세요.'}</span>
        </div>
      );
    case 'headphones':
      return <p className="text-xs text-slate-400">드래그로 돌려 보면 6.3mm TRS 플러그와 밀폐형 이어컵 구조를 볼 수 있습니다.</p>;
    case 'mirrorless':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ToggleBtn on={demo.clean} color="green" onClick={() => set({ ...demo, clean: !demo.clean })}>클린 HDMI</ToggleBtn>
            <ToggleBtn on={demo.rec} onClick={() => set({ ...demo, rec: !demo.rec })}>REC</ToggleBtn>
          </div>
          <Slider id="edu-zoom" label="줌 (렌즈가 길어집니다)" value={Math.round(demo.zoom * 100)} min={0} max={100} onChange={(v) => set({ ...demo, zoom: v / 100 })} display={`${Math.round(24 + demo.zoom * 46)}mm`} />
          <p className="text-xs text-slate-400">옆으로 펼친 액정을 보세요. 클린 HDMI를 켜면 배터리·ISO 같은 촬영 정보가 사라진 깨끗한 화면이 출력됩니다.</p>
        </div>
      );
    case 'ptz':
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400">프리셋:</span>
            {Object.entries(PTZ_PRESETS).map(([n, pr]) => (
              <button key={n} type="button" onClick={() => set({ ...demo, pan: pr.pan, tilt: pr.tilt, zoom: pr.zoom })}
                className="px-3 py-1.5 rounded border text-xs font-bold bg-slate-800 border-slate-600 hover:bg-slate-700">{n}. {pr.name}</button>
            ))}
            {[[null, '탈리 끔'], ['pvw', 'PVW'], ['pgm', 'PGM']].map(([v, t]) => (
              <button key={t} type="button" onClick={() => set({ ...demo, tally: v })}
                className={`px-2.5 py-1.5 rounded border text-xs font-bold ${demo.tally === v ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Slider id="edu-pan" label="Pan (좌우)" value={demo.pan} min={-90} max={90} onChange={(v) => set({ ...demo, pan: v })} display={`${demo.pan}°`} />
            <Slider id="edu-tilt" label="Tilt (상하)" value={demo.tilt} min={-30} max={30} onChange={(v) => set({ ...demo, tilt: v })} display={`${demo.tilt}°`} />
            <Slider id="edu-pzoom" label="Zoom" value={Math.round(demo.zoom * 100)} min={0} max={100} onChange={(v) => set({ ...demo, zoom: v / 100 })} display={`×${(1 + demo.zoom * 19).toFixed(0)}`} />
          </div>
        </div>
      );
    case 'atem_pro':
      return (
        <div className="space-y-2">
          {[['PGM', 'program', 'bg-red-600 border-red-400'], ['PVW', 'preview', 'bg-green-600 border-green-400']].map(([lbl, key, onCls]) => (
            <div key={key} className="flex items-center gap-1.5 flex-wrap">
              <span className="w-9 text-[11px] font-bold text-slate-400">{lbl}</span>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => set({ ...demo, atem: { ...demo.atem, [key]: n } })}
                  className={`w-9 h-9 rounded border text-sm font-bold ${demo.atem[key] === n ? onCls : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>{n}</button>
              ))}
              {key === 'program' && (
                <button type="button" onClick={() => set({ ...demo, atem: { ...demo.atem, program: demo.atem.preview, preview: demo.atem.program } })}
                  className="ml-2 px-4 h-9 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <ToggleBtn on={demo.streaming} onClick={() => set({ ...demo, streaming: !demo.streaming })}>ON AIR (스트리밍)</ToggleBtn>
            <ToggleBtn on={demo.recording} onClick={() => set({ ...demo, recording: !demo.recording })}>REC (USB 녹화)</ToggleBtn>
            <ToggleBtn on={demo.pip} color="green" onClick={() => set({ ...demo, pip: !demo.pip })}>PIP</ToggleBtn>
          </div>
          <p className="text-xs text-slate-400">뒤쪽 모니터가 HDMI OUT의 멀티뷰 화면입니다. 입력 3은 PC 슬라이드, 4는 신호 없음입니다.</p>
        </div>
      );
    case 'monitor':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {talk}
          <ToggleBtn on={demo.power} color="green" onClick={() => set({ ...demo, power: !demo.power })}>전원 {demo.power ? 'ON' : 'OFF'}</ToggleBtn>
          <ToggleBtn on={demo.wedgeFeedback} onClick={() => set({ ...demo, wedgeFeedback: !demo.wedgeFeedback })}>AUX 과다 → 하울링</ToggleBtn>
          <p className="text-xs text-slate-400 w-full">웨지는 마이크 바로 앞에 있어 AUX를 너무 올리면 가장 먼저 하울링이 납니다.</p>
        </div>
      );
    case 'par_led':
    case 'moving_head':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">{LIGHT_COLORS.map(([c, n]) => <button key={c} type="button" title={n} aria-label={n} onClick={() => set({ ...demo, light: { ...demo.light, color: c } })} className={`w-8 h-8 rounded-full border-2 ${demo.light.color === c ? 'border-white' : 'border-slate-600'}`} style={{ background: c }} />)}</div>
          <Slider id="edu-int" label="밝기 (Intensity)" value={Math.round(demo.light.intensity * 100)} min={0} max={100} onChange={(v) => set({ ...demo, light: { ...demo.light, intensity: v / 100 } })} display={`${Math.round(demo.light.intensity * 100)}%`} />
          {type === 'moving_head' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Slider id="edu-lpan" label="PAN (좌우)" value={demo.light.pan} min={-90} max={90} onChange={(v) => set({ ...demo, light: { ...demo.light, pan: v } })} display={`${demo.light.pan}°`} />
              <Slider id="edu-ltilt" label="TILT (상하)" value={demo.light.tilt} min={-60} max={60} onChange={(v) => set({ ...demo, light: { ...demo.light, tilt: v } })} display={`${demo.light.tilt}°`} />
            </div>
          )}
          <ToggleBtn on={demo.light.flicker} onClick={() => set({ ...demo, light: { ...demo.light, flicker: !demo.light.flicker } })}>마이크 케이블로 연결 (깜빡임 체험)</ToggleBtn>
        </div>
      );
    case 'lighting_console': {
      const cs = demo.cs;
      const setCs = (c) => set({ ...demo, cs: { ...cs, ...c } });
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-3 items-end">
            {cs.playbacks.map((pb, i) => (
              <label key={i} className="flex flex-col items-center text-[11px] text-slate-300 gap-1">
                <input type="range" min={0} max={100} value={pb.level} onChange={(e) => setCs({ playbacks: cs.playbacks.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)) })} className="h-20 accent-orange-500" style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
                PB{i + 1} {pb.label}
              </label>
            ))}
            <label className="flex flex-col items-center text-[11px] text-rose-300 gap-1">
              <input type="range" min={0} max={100} value={cs.gm} onChange={(e) => setCs({ gm: Number(e.target.value) })} className="h-20 accent-rose-500" style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />GM
            </label>
            <ToggleBtn on={cs.blackout} onClick={() => setCs({ blackout: !cs.blackout })}>BLACKOUT</ToggleBtn>
          </div>
          <p className="text-xs text-slate-400">플레이백 페이더는 저장된 장면(큐)의 밝기, GM은 전체 밝기입니다. 화면에서 패치 표와 플레이백 레벨이 함께 바뀝니다.</p>
        </div>
      );
    }
    case 'media_server':
    case 'led_wall':
    case 'projector': {
      const vj = demo.vj;
      return (
        <div className="space-y-2">
          {[2, 1, 0].map((li) => (
            <div key={li} className="flex flex-wrap items-center gap-1">
              <span className="text-[11px] font-bold text-rose-300 w-14">Layer {li + 1}</span>
              {Object.keys(CLIPS).map((c) => <button key={c} type="button" onClick={() => set({ ...demo, vj: { ...vj, layers: vj.layers.map((l, j) => (j === li ? { ...l, clip: l.clip === c ? null : c } : l)) } })}
                className={`px-1.5 py-0.5 rounded text-[10px] ${vj.layers[li].clip === c ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{CLIPS[c].name}</button>)}
              <input type="range" min={0} max={100} value={vj.layers[li].opacity} aria-label={`레이어 ${li + 1} 투명도`} onChange={(e) => set({ ...demo, vj: { ...vj, layers: vj.layers.map((l, j) => (j === li ? { ...l, opacity: Number(e.target.value) } : l)) } })} className="w-24 accent-rose-500" />
            </div>
          ))}
          {type !== 'media_server' && <ToggleBtn on={demo.screenOn} color="green" onClick={() => set({ ...demo, screenOn: !demo.screenOn })}>전원 {demo.screenOn ? 'ON' : 'OFF'}</ToggleBtn>}
          <p className="text-xs text-slate-400">레이어 1이 맨 아래, 3이 맨 위입니다. 가사(Layer 2)의 투명도를 올려 보세요.</p>
        </div>
      );
    }
    case 'ptz_controller':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          {[0, 1, 2, 3].map((i) => <button key={i} type="button" onClick={() => set({ ...demo, joySel: i })} className={`px-3 py-1.5 rounded text-xs font-bold ${demo.joySel === i ? 'bg-sky-600 text-white' : 'bg-slate-700'}`}>CAM {i + 1}</button>)}
          <p className="text-xs text-slate-400 w-full">CAM 1 = 빨간 탈리(방송 중), CAM 2 = 초록 탈리(PVW). 방송 중인 카메라는 움직이지 않습니다.</p>
        </div>
      );
    default: return null;
  }
}


/* ---------------------------- 퀴즈 ---------------------------- */
function Quiz({ item, solved, onSolve }) {
  const [pick, setPick] = useState(null);
  useEffect(() => { setPick(null); }, [item.id]);
  const { q, options, answer, explain } = item.quiz;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{q}</p>
      <div className="grid gap-1.5">
        {options.map((o, i) => {
          const chosen = pick === i;
          const show = pick != null;
          const cls = show && i === answer ? 'border-green-500 bg-green-950' : chosen ? 'border-red-500 bg-red-950' : 'border-slate-600 bg-slate-900 hover:bg-slate-800';
          return (
            <button key={o} type="button" onClick={() => { setPick(i); if (i === answer) onSolve(item.id); }}
              className={`text-left text-sm px-3 py-2 rounded border ${cls}`}>{o}</button>
          );
        })}
      </div>
      {pick != null && (
        <p className={`text-sm flex gap-1.5 ${pick === answer ? 'text-green-300' : 'text-red-300'}`}>
          {pick === answer ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
          <span>{pick === answer ? '정답! ' : '다시 생각해 보세요. '}{explain}</span>
        </p>
      )}
      {solved && pick == null && <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 size={13} /> 이미 맞힌 문제입니다.</p>}
    </div>
  );
}

/* =====================================================================
 * EduMode
 * ===================================================================== */
export default function EduMode({ onExit, onNavigate }) {
  const [currentId, setCurrentId] = useState(EDU_ITEMS[0].id);
  const [demo, setDemo] = useState(DEMO_DEFAULT);
  const [jitter, setJitter] = useState(0);
  const [solved, setSolved] = useState(() => loadProgress('bm-edu-quiz', []));
  const idx = EDU_ITEMS.findIndex((x) => x.id === currentId);
  const item = EDU_ITEMS[idx];

  useEffect(() => { saveProgress('bm-edu-quiz', solved); }, [solved]);
  useEffect(() => { setDemo(DEMO_DEFAULT); }, [currentId]);
  useEffect(() => {
    if (!demo.talking) return undefined;
    const t = setInterval(() => setJitter(-(Math.random() ** 1.5) * 12), 120);
    return () => clearInterval(t);
  }, [demo.talking]);

  // 체험용 레벨 계산
  const levels = useMemo(() => {
    const m = demo.mixer;
    const needsPhantom = item.type === 'condenser_mic';
    const rfDown = item.type === 'wireless_mic' && (!demo.txPower || demo.rf <= 15);
    if (!demo.talking || (needsPhantom && !m.phantom) || rfDown) return { chLevel: null, mainLevel: null };
    const ch = MIC_LEVEL + m.gain + jitter;
    const post = m.chMute || m.chFader <= 0 ? null : ch + faderDb(m.chFader);
    const main = post == null || m.mainMute || m.mainFader <= 0 ? null : post + faderDb(m.mainFader);
    return { chLevel: ch, mainLevel: main };
  }, [demo, jitter, item.type]);
  const viewDemo = { ...demo, ...levels, talking: levels.chLevel != null, level: demo.talking ? -14 + jitter : null };

  const go = (d) => setCurrentId(EDU_ITEMS[(idx + d + EDU_ITEMS.length) % EDU_ITEMS.length].id);
  const def = item.type ? DEVICE_TYPES[item.type] : null;
  const Concept = item.concept ? CONCEPT[item.concept] : null;

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 py-4 sm:px-6 font-sans">
      <style>{`
        @keyframes bm-travel { 0% { left: 1.5rem; } 100% { left: calc(100% - 2.25rem); } }
        .bm-travel { animation: bm-travel 2.4s linear infinite; }
        @keyframes bm-flow { to { stroke-dashoffset: -24; } }
        .bm-flow { animation: bm-flow .6s linear infinite; }
        .bm-noevents { pointer-events: none !important; }
        @media (prefers-reduced-motion: reduce) { .bm-travel, .bm-flow, .animate-pulse { animation: none !important; } }
      `}</style>

      <header className="flex flex-wrap gap-3 justify-between items-center bg-slate-800 p-4 rounded-lg shadow-lg mb-4 border-b-4 border-slate-700">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={onExit} className="px-2.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm flex items-center gap-1">
            <ChevronLeft size={16} /> 메뉴
          </button>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2"><BookOpen size={24} /> 교육 모드</h1>
          <span className="text-slate-400 text-sm">방송장비 백과 · 3D로 돌려 보고 직접 만져 보세요</span>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400">이해도 체크</div>
          <div className="font-mono font-bold text-lg text-emerald-300">{solved.length}/{EDU_ITEMS.length}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-4">
        {/* 목록 */}
        {/* 작은 화면: 드롭다운 */}
        <div className="lg:hidden flex gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="이전 항목" className="px-3 rounded bg-slate-700 border border-slate-600"><ChevronLeft size={18} /></button>
          <select aria-label="장비 선택" value={currentId} onChange={(e) => setCurrentId(e.target.value)}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded px-3 py-2.5 text-base text-slate-100">
            {EDU_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {EDU_ITEMS.filter((x) => x.cat === cat).map((x) => <option key={x.id} value={x.id}>{solved.includes(x.id) ? '✓ ' : ''}{x.title}</option>)}
              </optgroup>
            ))}
          </select>
          <button type="button" onClick={() => go(1)} aria-label="다음 항목" className="px-3 rounded bg-slate-700 border border-slate-600"><ChevronRight size={18} /></button>
        </div>
        <nav aria-label="장비 목록" className="hidden lg:block bg-slate-800 rounded-lg p-3 border-2 border-slate-700 lg:self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] overflow-y-auto">
          {EDU_CATEGORIES.map((cat) => {
            const Icon = CAT_ICON[cat] ?? BookOpen;
            return (
              <div key={cat} className="mb-3 last:mb-0">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-1"><Icon size={13} /> {cat}</div>
                <div className="flex flex-wrap lg:flex-col gap-1">
                  {EDU_ITEMS.filter((x) => x.cat === cat).map((x) => (
                    <button key={x.id} type="button" onClick={() => setCurrentId(x.id)}
                      className={`text-left text-sm px-2.5 py-1.5 rounded flex items-center gap-1.5 ${x.id === currentId ? 'bg-emerald-700 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
                      {solved.includes(x.id) && <CheckCircle2 size={13} className="text-emerald-300 shrink-0" />}
                      <span className="truncate">{x.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* 본문 */}
        <main className="min-w-0 space-y-4">
          <div className="bg-slate-800 rounded-lg border-2 border-slate-700 overflow-hidden">
            {(item.kind === 'device' || item.kind === 'cable') && (
              <div className="h-[360px] sm:h-[440px] bg-[#131a27] relative">
                {item.kind === 'device' && <EquipmentViewer key={item.type} type={item.type} demo={viewDemo} />}
                {item.kind === 'cable' && <CableShowcase key={item.cable} kind={item.cable} color={item.color} />}
                <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">드래그로 돌려 보기 · 휠/핀치로 확대</div>
              </div>
            )}
            {item.kind === 'concept' && <div className="min-h-[300px] bg-[#131a27] flex items-center"><div className="w-full">{Concept && <Concept onOpen={setCurrentId} />}</div></div>}
            {item.kind === 'audiolab' && <div className="bg-[#131a27]"><AudioLab key={item.id} focus={item.lab} /></div>}
            {item.kind === 'fadelab' && <div className="bg-[#131a27]"><FadeLab key={item.id} /></div>}
            {item.kind === 'mixersizes' && <MixerSizes item={item} />}
            {item.kind === 'device' && (
              <div className="p-3 border-t border-slate-700 bg-slate-900/60">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Play size={12} /> 직접 만져 보기</div>
                <DemoControls type={item.type} demo={demo} set={setDemo} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="bg-slate-800 rounded-lg p-5 border-2 border-slate-700 space-y-4 min-w-0">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-400">{item.cat}</div>
                <h2 className="text-2xl font-bold mt-0.5">{item.title}</h2>
                <p className="text-sm text-slate-400">{item.subtitle}</p>
              </div>
              <p className="text-slate-200 leading-relaxed">{item.summary}</p>
              <div>
                <h3 className="text-sm font-bold text-sky-300 mb-1.5 flex items-center gap-1.5"><Cpu size={15} /> 작동 원리</h3>
                <ul className="space-y-1.5 text-sm text-slate-300 leading-relaxed list-disc pl-5">{item.how.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              {item.specs && (
                <table className="w-full text-sm">
                  <tbody>
                    {item.specs.map(([k, v]) => (
                      <tr key={k} className="border-t border-slate-700"><th scope="row" className="text-left font-normal text-slate-400 py-1.5 pr-3 w-28 align-top">{k}</th><td className="py-1.5 text-slate-200">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              {def && (
                <div>
                  <h3 className="text-sm font-bold text-sky-300 mb-1.5 flex items-center gap-1.5"><Plug size={15} /> 단자</h3>
                  <ul className="space-y-1 text-sm">
                    {[...def.ins.map((p) => ({ ...p, dir: '입력' })), ...def.outs.map((p) => ({ ...p, dir: '출력' }))].map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PORT_COLOR[p.kind] }} />
                        <span className="font-mono text-slate-200">{p.label}</span>
                        <span className="text-slate-400">· {p.dir} · {PORT_KIND_LABEL[p.kind]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.cable && CABLES[item.cable] && (
                <p className="text-sm flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: CABLES[item.cable].stroke }} /> 게임 안에서는 이 색의 케이블로 표시됩니다.</p>
              )}
            </section>

            <section className="space-y-4 min-w-0">
              <div className="bg-slate-800 rounded-lg p-5 border-2 border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5"><Lightbulb size={15} /> 실무 팁</h3>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">{item.tips.map((t) => <li key={t}>{t}</li>)}</ul>
                <h3 className="text-sm font-bold text-red-300 flex items-center gap-1.5 pt-1"><AlertTriangle size={15} /> 자주 하는 실수</h3>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">{item.mistakes.map((t) => <li key={t}>{t}</li>)}</ul>
                {item.where && <p className="text-sm text-slate-300 flex gap-1.5 pt-1"><MapPin size={15} className="text-sky-300 shrink-0 mt-0.5" /> <span><b className="text-slate-200">쓰이는 곳</b> · {item.where}</span></p>}
              </div>
              <div className="bg-slate-800 rounded-lg p-5 border-2 border-emerald-800">
                <h3 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-1.5"><GraduationCap size={15} /> 이해도 체크</h3>
                <Quiz item={item} solved={solved.includes(item.id)} onSolve={(id) => setSolved((s) => (s.includes(id) ? s : [...s, id]))} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => go(-1)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm flex items-center gap-1"><ChevronLeft size={16} /> 이전</button>
                <button type="button" onClick={() => go(1)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm flex items-center gap-1">다음 <ChevronRight size={16} /></button>
                <button type="button" onClick={() => onNavigate('studio')} className="ml-auto px-3 py-2 rounded bg-sky-700 hover:bg-sky-600 text-sm font-bold flex items-center gap-1">
                  스튜디오에서 직접 설치해 보기 <ArrowRight size={15} />
                </button>
                {item.stage && (
                  <button type="button" onClick={() => onNavigate('story', item.stage)} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm">스토리 {typeof item.stage === 'string' ? (STAGE_TITLE[item.stage] ?? item.stage) : `스테이지 ${item.stage}`}에서 실습</button>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
