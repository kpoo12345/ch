import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, CheckCircle2, XCircle, Lightbulb, AlertTriangle, MapPin, Cpu, Plug, Play,
  Mic, SlidersHorizontal, Camera, Tv, MonitorPlay, Cable, GraduationCap, ArrowRight, AudioLines, Workflow, Check, Lightbulb as LightIcon, Clapperboard,
} from 'lucide-react';
import { CLIPS } from './scenes.js';
import { DEVICE_TYPES, PORT_KIND_LABEL, PORT_COLOR, CABLES, MIXER_DEFAULT, MIC_LEVEL, faderDb, fmtDb } from './engine.js';
import { EquipmentViewer, CableShowcase, MixerSizeViewer } from './Studio3D.jsx';
import AudioLab from './AudioLab.jsx';
import { Meter, Slider, ToggleBtn, Scene, loadProgress, saveProgress } from './ui.jsx';
import { EDU_CATEGORIES, EDU_ITEMS } from './eduContent.js';

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

/* ---------------------------- 기초 개념 그림 ---------------------------- */
function FlowVisual() {
  const chains = [
    ['오디오', ['마이크', '믹서', '스피커 / PC'], 'bg-sky-400'],
    ['비디오', ['카메라', '스위처', 'PC / 모니터'], 'bg-purple-400'],
  ];
  return (
    <div className="space-y-6 p-6">
      {chains.map(([name, nodes, dot]) => (
        <div key={name}>
          <div className="text-xs text-slate-400 mb-2">{name}</div>
          <div className="relative flex items-center justify-between gap-2">
            <div className="absolute left-6 right-6 top-1/2 h-0.5 bg-slate-600" />
            <span className={`absolute top-1/2 -mt-1.5 w-3 h-3 rounded-full ${dot} bm-travel`} />
            {nodes.map((n, i) => (
              <div key={n} className="relative z-10 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-sm font-bold text-center min-w-0">
                <div className="text-[10px] text-slate-400">{['소스', '처리', '출력'][i]}</div>{n}
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-slate-400 text-center">점이 신호입니다. 출력(OUT)에서 나와 다음 장비의 입력(IN)으로 들어갑니다.</p>
    </div>
  );
}

function GainVisual() {
  const [gain, setGain] = useState(15);
  const level = MIC_LEVEL + gain;
  const state = level > 0 ? ['클리핑! 소리가 찌그러집니다', 'text-red-400'] : level > -6 ? ['너무 큼: 여유(헤드룸)가 부족합니다', 'text-amber-300'] : level >= -24 ? ['적정 레벨', 'text-green-400'] : ['너무 작음: 키우면 잡음도 커집니다', 'text-slate-300'];
  return (
    <div className="p-6 space-y-4">
      <Slider id="concept-gain" label="입력 GAIN" value={gain} min={0} max={60} onChange={setGain} display={`+${gain} dB`} accent="accent-red-400" />
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1"><span>입력 미터 (말할 때)</span><span className="font-mono">{fmtDb(level)}</span></div>
        <Meter level={level} target={[-20, -6]} />
      </div>
      <p className={`text-lg font-bold ${state[1]}`}>{state[0]}</p>
      <p className="text-xs text-slate-400">흰 테두리가 목표 구간(-20 ~ -6 dB)입니다. GAIN을 움직여 맞춰 보세요.</p>
    </div>
  );
}

function FeedbackVisual() {
  const [vol, setVol] = useState(40);
  const [front, setFront] = useState(true);
  const loop = (vol - 55) / 2 + (front ? 8 : -6);
  const howl = loop >= 0;
  return (
    <div className="p-6 space-y-4">
      <svg viewBox="0 0 360 170" className="w-full max-w-md mx-auto block" role="img" aria-label="하울링 피드백 루프 그림">
        <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill={howl ? '#ef4444' : '#64748b'} /></marker></defs>
        {[[40, '마이크'], [180, '믹서'], [320, '스피커']].map(([x, t]) => (
          <g key={t}><rect x={x - 38} y={20} width={76} height={36} rx={8} fill="#1e293b" stroke="#475569" /><text x={x} y={43} textAnchor="middle" fill="#e2e8f0" fontSize="13">{t}</text></g>
        ))}
        <line x1={80} y1={38} x2={140} y2={38} stroke="#64748b" strokeWidth="2" markerEnd="url(#arr)" />
        <line x1={220} y1={38} x2={280} y2={38} stroke="#64748b" strokeWidth="2" markerEnd="url(#arr)" />
        <path d="M320 58 Q 180 170 40 58" fill="none" stroke={howl ? '#ef4444' : '#64748b'} strokeWidth={howl ? 4 : 2} strokeDasharray="6 5" markerEnd="url(#arr)" className={howl ? 'bm-flow' : ''} />
        <text x={180} y={150} textAnchor="middle" fill={howl ? '#f87171' : '#94a3b8'} fontSize="12">공기를 통해 다시 마이크로 ({front ? '스피커가 마이크를 향함' : '스피커가 객석을 향함'})</text>
      </svg>
      <Slider id="concept-fb" label="볼륨(루프 이득)" value={vol} min={0} max={100} onChange={setVol} display={`${vol}%`} accent="accent-red-400" />
      <div className="flex flex-wrap items-center gap-2">
        <ToggleBtn on={front} onClick={() => setFront(!front)}>스피커가 마이크 정면</ToggleBtn>
        <span className={`text-lg font-bold ${howl ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>{howl ? '삐이이— 하울링!' : '안정적'}</span>
      </div>
    </div>
  );
}

function PgmPvwVisual() {
  const [pgm, setPgm] = useState('cam1');
  const [pvw, setPvw] = useState('cam2');
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[['PVW · 다음 화면', pvw, 'border-green-500'], ['PGM · 송출 중', pgm, 'border-red-500']].map(([t, src, b]) => (
          <div key={t}>
            <div className="text-xs font-bold mb-1 text-slate-300">{t}</div>
            <div className={`aspect-video rounded overflow-hidden border-4 ${b}`}><Scene src={src} /></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400">PVW 선택:</span>
        {['cam1', 'cam2'].map((c) => (
          <button key={c} type="button" onClick={() => setPvw(c)} className={`px-3 py-1.5 rounded border text-xs font-bold ${pvw === c ? 'bg-green-700 border-green-400' : 'bg-slate-800 border-slate-600'}`}>{c === 'cam1' ? '카메라 1' : '카메라 2'}</button>
        ))}
        <button type="button" onClick={() => { setPgm(pvw); setPvw(pgm); }} className="ml-auto px-5 py-2 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
      </div>
    </div>
  );
}

const LEVEL_ROWS = [
  ['마이크 레벨', -50, '다이나믹 마이크 출력', 'bg-sky-400'],
  ['악기 레벨', -20, '전기기타·베이스 픽업', 'bg-amber-400'],
  ['라인 레벨 (가정용 -10 dBV)', -8, 'PC·스마트폰·키보드 출력', 'bg-violet-400'],
  ['라인 레벨 (프로 +4 dBu)', 4, '믹서 MAIN OUT, 오디오 장비 사이', 'bg-emerald-400'],
  ['스피커 레벨', 32, '파워앰프 → 패시브 스피커 (수십 V)', 'bg-red-400'],
];
const LEVEL_PATHS = {
  마이크: ['마이크 (마이크 레벨)', '프리앰프 GAIN: 믹서 MIC 입력 또는 오디오 인터페이스', '라인 레벨로 처리·출력'],
  전기기타: ['기타 (악기 레벨)', 'DI 박스 또는 인터페이스 INST 입력', '믹서 MIC 입력 (XLR)'],
  키보드: ['키보드 (라인, 언밸런스드)', '무대가 멀면 DI 박스로 밸런스드 변환', '믹서 입력'],
  'PC 음원': ['PC 헤드폰 출력 (가정용 라인)', '3.5mm → TRS/RCA 케이블', '믹서 LINE 입력 (GAIN 낮게)'],
};
function LevelsVisual() {
  const [src, setSrc] = useState('마이크');
  const pos = (db) => ((db + 60) / 100) * 100;
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-2.5">
        {LEVEL_ROWS.map(([name, db, ex, color]) => (
          <div key={name}>
            <div className="flex justify-between text-xs"><span className="text-slate-200 font-semibold">{name}</span><span className="text-slate-400 font-mono">{db > 0 ? '+' : ''}{db} dBu · {ex}</span></div>
            <div className="h-3 rounded bg-slate-800 overflow-hidden mt-1"><div className={`h-full ${color}`} style={{ width: `${pos(db)}%` }} /></div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs text-slate-400 mb-1.5">이 소스는 어디에 연결할까?</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.keys(LEVEL_PATHS).map((k) => (
            <button key={k} type="button" onClick={() => setSrc(k)} className={`px-3 py-1.5 rounded border text-xs font-bold ${src === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{k}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {LEVEL_PATHS[src].map((step, i) => (
            <React.Fragment key={step}>
              {i > 0 && <ArrowRight size={14} className="text-slate-500" />}
              <span className="px-2.5 py-1.5 rounded bg-slate-800 border border-slate-600">{step}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

const F_STOPS = [1.8, 2.8, 4, 5.6, 8, 11, 16];
const SHUTTERS = [30, 60, 125, 250, 500, 1000];
const ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
function CamSettingsVisual() {
  const [fi, setFi] = useState(1);
  const [si, setSi] = useState(1);
  const [ii, setIi] = useState(2);
  const [wb, setWb] = useState(5600);
  const f = F_STOPS[fi], sh = SHUTTERS[si], iso = ISOS[ii];
  const ev = Math.log2(iso / 400) + Math.log2(60 / sh) + 2 * Math.log2(2.8 / f); // 0 = 적정
  const bright = Math.min(2.6, Math.max(0.12, 2 ** (ev * 0.55)));
  const bgBlur = Math.max(0, (5.6 / f - 0.6) * 3.5);
  const motionBlur = Math.max(0, (60 / sh) * 2.5 - 1);
  const noise = Math.min(0.55, Math.max(0, Math.log2(iso / 400) * 0.13));
  const wbShift = (wb - 5600) / 2400; // + 따뜻함(주황), - 차가움(파랑)
  const status = ev > 0.8 ? ['너무 밝음 (과다 노출)', 'text-amber-300'] : ev < -0.8 ? ['너무 어두움 (노출 부족)', 'text-sky-300'] : ['적정 노출', 'text-green-400'];
  return (
    <div className="p-5 space-y-4">
      <style>{`@keyframes bm-wave { 0%,100% { transform: translateX(0) } 50% { transform: translateX(46px) } } .bm-wave { animation: bm-wave 1.2s ease-in-out infinite; }`}</style>
      <div className="relative mx-auto w-full max-w-md aspect-video rounded-lg overflow-hidden border border-slate-600" style={{ filter: `brightness(${bright})` }}>
        <div className="absolute inset-0" style={{ filter: `blur(${bgBlur}px)`, background: 'linear-gradient(180deg,#334155,#1e293b 60%,#3f3a33 60%)' }}>
          {[12, 30, 52, 70, 86].map((x, i) => <span key={x} className="absolute rounded-full" style={{ left: `${x}%`, top: `${14 + (i % 2) * 10}%`, width: 18, height: 18, background: i % 2 ? '#fde68a' : '#fca5a5', opacity: 0.8 }} />)}
          <div className="absolute left-[8%] right-[8%] top-[52%] h-[8%] bg-slate-500/50" />
        </div>
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[34%] h-[78%]">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[46%] aspect-square rounded-full bg-[#e0b896]" />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[48%] h-[22%] rounded-t-full bg-[#3f2a1d]" />
          <div className="absolute bottom-0 left-0 right-0 h-[52%] rounded-t-[40%] bg-[#3b5b8f]" />
          <div className="absolute right-[-18%] top-[34%] w-[26%] aspect-square rounded-full bg-[#e0b896] bm-wave" style={{ filter: `blur(${motionBlur}px)` }} />
        </div>
        <div className="absolute inset-0 pointer-events-none" style={{ background: wbShift > 0 ? `rgba(255,140,30,${Math.min(0.5, wbShift * 0.45)})` : `rgba(40,120,255,${Math.min(0.5, -wbShift * 0.45)})`, mixBlendMode: 'overlay' }} />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: noise }} aria-hidden="true">
          <filter id="bm-noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#bm-noise)" />
        </svg>
      </div>
      <p className={`text-center font-bold ${status[1]}`}>{status[0]}{bgBlur > 3 ? ' · 배경 흐림' : ''}{motionBlur > 2 ? ' · 손 움직임 번짐' : ''}{noise > 0.25 ? ' · 노이즈 많음' : ''}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Slider id="cs-f" label="조리개 (f값)" value={fi} min={0} max={F_STOPS.length - 1} onChange={setFi} display={`f/${f}`} />
        <Slider id="cs-s" label="셔터 속도" value={si} min={0} max={SHUTTERS.length - 1} onChange={setSi} display={`1/${sh}초`} />
        <Slider id="cs-i" label="ISO 감도" value={ii} min={0} max={ISOS.length - 1} onChange={setIi} display={`ISO ${iso}`} />
        <Slider id="cs-wb" label="화이트밸런스 (조명: 5600K)" value={wb} min={3200} max={7500} step={100} onChange={setWb} display={`${wb}K`} accent="accent-amber-300" />
      </div>
    </div>
  );
}

const MV_SRC = { 1: 'cam1', 2: 'cam2', 3: 'slides', 4: 'nosignal' };
function MultiviewVisual() {
  const [pgm, setPgm] = useState(1);
  const [pvw, setPvw] = useState(2);
  const [mix, setMix] = useState(false);
  const auto = () => { setMix(true); setTimeout(() => { setPgm(pvw); setPvw(pgm); setMix(false); }, 700); };
  return (
    <div className="p-4 space-y-3">
      <div className="bg-black rounded-lg p-1.5 grid grid-cols-2 gap-1.5 max-w-xl mx-auto">
        {[['PREVIEW', pvw, 'border-green-500'], ['PROGRAM', pgm, 'border-red-500']].map(([t, n, b]) => (
          <div key={t} className={`relative aspect-video border-4 ${b}`}>
            <Scene src={MV_SRC[n]} fade={t === 'PROGRAM' && mix} />
            <span className="absolute left-1.5 bottom-1 text-[10px] font-bold text-white drop-shadow">{t}</span>
          </div>
        ))}
        <div className="col-span-2 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" onClick={() => setPvw(n)} aria-label={`입력 ${n}을 PVW로`}
              className={`relative aspect-video border-[3px] ${n === pgm ? 'border-red-500' : n === pvw ? 'border-green-500' : 'border-slate-700'}`}>
              <Scene src={MV_SRC[n]} label={false} />
              <span className="absolute left-1 bottom-0.5 text-[9px] font-bold text-white drop-shadow">{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={() => { setPgm(pvw); setPvw(pgm); }} className="px-5 py-2 rounded bg-slate-200 text-slate-900 font-black">CUT</button>
        <button type="button" onClick={auto} className="px-5 py-2 rounded bg-amber-600 hover:bg-amber-500 font-black">AUTO</button>
      </div>
      <p className="text-xs text-slate-400 text-center">아래 입력 화면을 누르면 PVW로 올라갑니다. CUT/AUTO로 PGM과 맞바꿔 보세요.</p>
    </div>
  );
}

function TransitionsVisual() {
  const [cur, setCur] = useState('cam1');
  const [next, setNext] = useState('slides');
  const [anim, setAnim] = useState(null); // { type, key }
  const [pip, setPip] = useState(false);
  const run = (type) => {
    if (anim) return;
    if (type === 'CUT') { setCur(next); setNext(cur); return; }
    setAnim({ type, key: Date.now() });
    setTimeout(() => { setCur(next); setNext(cur); setAnim(null); }, 1000);
  };
  const cls = anim ? { MIX: 'bm-t-mix', DIP: 'bm-t-dipin', WIPE: 'bm-t-wipe' }[anim.type] : '';
  return (
    <div className="p-5 space-y-3">
      <style>{`
        @keyframes bm-t-mix { from { opacity: 0 } to { opacity: 1 } } .bm-t-mix { animation: bm-t-mix 1s linear forwards; }
        @keyframes bm-t-dipin { 0%,50% { opacity: 0 } 100% { opacity: 1 } } .bm-t-dipin { animation: bm-t-dipin 1s linear forwards; }
        @keyframes bm-t-dip { 0% { opacity: 0 } 50% { opacity: 1 } 100% { opacity: 0 } } .bm-t-dip { animation: bm-t-dip 1s linear forwards; }
        @keyframes bm-t-wipe { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } } .bm-t-wipe { animation: bm-t-wipe 1s ease-in-out forwards; }
      `}</style>
      <div className="relative mx-auto w-full max-w-md aspect-video rounded-lg overflow-hidden border-4 border-red-500">
        <div className="absolute inset-0"><Scene src={cur} /></div>
        {anim && <div key={anim.key} className={`absolute inset-0 ${cls}`} style={{ opacity: anim.type === 'WIPE' ? 1 : 0 }}><Scene src={next} /></div>}
        {anim?.type === 'DIP' && <div key={`d${anim.key}`} className="absolute inset-0 bg-black bm-t-dip" />}
        {pip && (
          <div className="absolute right-2 bottom-2 w-[32%] aspect-video border-2 border-white rounded overflow-hidden shadow-lg">
            <Scene src="cam1" label={false} />
          </div>
        )}
        <span className="absolute left-2 top-1.5 text-[10px] font-bold bg-red-600 px-1.5 rounded">PGM</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {['CUT', 'MIX', 'DIP', 'WIPE'].map((t) => (
          <button key={t} type="button" onClick={() => run(t)} className={`px-4 py-2 rounded font-black ${t === 'CUT' ? 'bg-slate-200 text-slate-900' : 'bg-amber-600 hover:bg-amber-500'}`}>{t}</button>
        ))}
        <ToggleBtn on={pip} color="green" onClick={() => setPip(!pip)}>PIP (진행자 작은 화면)</ToggleBtn>
      </div>
      <p className="text-xs text-slate-400 text-center">다음 화면: {next === 'slides' ? 'PC 슬라이드' : next === 'cam1' ? '진행자 클로즈업' : next}</p>
    </div>
  );
}

/* ---------------------------- 케이블 개념 그림 ---------------------------- */
function wavePath(fn, w, h, mid) {
  let d = '';
  for (let x = 0; x <= w; x += 2) d += `${x ? 'L' : 'M'}${x},${(mid - fn(x)).toFixed(1)} `;
  return d;
}
function BalancedVisual() {
  const [mode, setMode] = useState('balanced');
  const [amp, setAmp] = useState(10);
  const W = 300;
  const sig = (x) => Math.sin((x / W) * Math.PI * 4) * 16;
  const noise = (x) => (Math.sin(x * 0.9) * 0.6 + Math.sin(x * 2.3 + 1) * 0.3 + Math.sin(x * 5.1) * 0.2) * amp;
  const rows = mode === 'balanced'
    ? [['Hot (+) · 원래 신호 + 잡음', (x) => sig(x) + noise(x), '#60a5fa'], ['Cold (-) · 뒤집은 신호 + 같은 잡음', (x) => -sig(x) + noise(x), '#a78bfa'], ['받는 쪽: (Hot − Cold) ÷ 2 = 깨끗한 신호', (x) => sig(x), '#4ade80']]
    : [['보낸 신호', (x) => sig(x), '#60a5fa'], ['케이블을 지나며 잡음이 섞임', (x) => sig(x) + noise(x), '#fbbf24'], ['받은 소리: 잡음이 그대로 남음', (x) => sig(x) + noise(x), '#f87171']];
  return (
    <div className="p-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        {[['unbalanced', '언밸런스드 (TS · RCA)'], ['balanced', '밸런스드 (XLR · TRS)']].map(([k, t]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`px-3 py-1.5 rounded border text-xs font-bold ${mode === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{t}</button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} 210`} className="w-full max-w-xl block mx-auto bg-slate-950 rounded-lg border border-slate-700" role="img" aria-label="케이블 신호와 잡음 파형">
        {rows.map(([label, fn, color], i) => (
          <g key={label}>
            <line x1="0" x2={W} y1={40 + i * 66} y2={40 + i * 66} stroke="#1e293b" />
            <path d={wavePath(fn, W, 50, 40 + i * 66)} fill="none" stroke={color} strokeWidth="2" />
            <text x="6" y={14 + i * 66} fill="#cbd5e1" fontSize="10">{label}</text>
          </g>
        ))}
      </svg>
      <Slider id="bal-noise" label="잡음 크기 (케이블이 길수록, 주변 전원선이 많을수록)" value={amp} min={0} max={24} onChange={setAmp} display={`${amp}`} accent="accent-amber-300" />
    </div>
  );
}

const CABLE_ROWS = [
  ['XLR', 'cable_xlr', '오디오', '마이크·라인', '예', '예', '~100m', '마이크, 장비 사이'],
  ['TS 6.3mm', 'cable_trs', '오디오', '악기', '아니오', '아니오', '~5m', '기타·베이스'],
  ['TRS 6.3mm', 'cable_trs', '오디오', '라인·헤드폰', '예(모노)', '아니오', '~30m', '라인 장비, 헤드폰'],
  ['3.5mm', 'cable_mini', '오디오', '가정용 라인', '아니오', '아니오', '~3m', 'PC·폰·카메라 마이크'],
  ['RCA', 'cable_rca', '오디오', '가정용 라인', '아니오', '아니오', '~3m', 'DJ·가정용 오디오'],
  ['스피콘', 'cable_speakon', '오디오', '스피커 레벨', '-', '예', '굵기에 따라', '앰프 → 패시브 스피커'],
  ['HDMI', 'cable_hdmi', '영상', '디지털 영상+음성', '-', '아니오', '5~10m', '카메라·스위처·모니터'],
  ['SDI', 'cable_sdi', '영상', '디지털 영상+음성', '-', '예', '100m+', '방송 카메라, 장거리'],
  ['USB-C', 'cable_usb', '데이터', '데이터·오디오·영상', '-', '아니오', '3~5m', '인터페이스·웹캠 → PC'],
  ['이더넷', 'cable_eth', '데이터', '네트워크', '-', 'etherCON만', '100m', 'Dante·AES50·NDI·제어'],
];
function CableMapVisual({ onOpen }) {
  const [f, setF] = useState('전체');
  const rows = CABLE_ROWS.filter((r) => f === '전체' || r[2] === f);
  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {['전체', '오디오', '영상', '데이터'].map((k) => (
          <button key={k} type="button" onClick={() => setF(k)} className={`px-3 py-1 rounded-full border text-xs font-bold ${f === k ? 'bg-sky-700 border-sky-400' : 'bg-slate-800 border-slate-600 hover:bg-slate-700'}`}>{k}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-700">
            {['케이블', '신호', '밸런스드', '잠금', '최대 길이', '주 용도'].map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-b border-slate-800 hover:bg-slate-800/60">
                <td className="py-1.5 pr-3"><button type="button" onClick={() => onOpen(r[1])} className="font-bold text-sky-300 hover:underline">{r[0]}</button></td>
                <td className="pr-3 text-slate-300">{r[3]}</td><td className="pr-3 text-slate-300">{r[4]}</td><td className="pr-3 text-slate-300">{r[5]}</td>
                <td className="pr-3 font-mono text-slate-200">{r[6]}</td><td className="text-slate-300">{r[7]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">케이블 이름을 누르면 자세한 설명으로 이동합니다.</p>
    </div>
  );
}

const CHECKLIST = [
  '연결할 장비와 단자 목록을 적고 필요한 케이블 수 세기',
  '종류별 예비 케이블 1개 이상 챙기기',
  '변환 젠더 챙기기 (3.5mm↔6.3mm, XLR↔TRS, HDMI↔SDI)',
  '케이블 테스터로 모든 케이블 점검하기',
  '양 끝에 같은 번호 라벨 붙이기',
  '바닥 고정용 테이프·케이블 커버 챙기기',
  '멀티탭과 전원 케이블 여유 있게 준비하기',
];
function CableCareVisual() {
  const [done, setDone] = useState([]);
  const loops = Array.from({ length: 6 });
  return (
    <div className="p-5 grid md:grid-cols-2 gap-5 items-center">
      <div>
        <svg viewBox="0 0 220 160" className="w-full max-w-xs mx-auto block" role="img" aria-label="8자 감기(오버-언더) 그림">
          {loops.map((_, i) => (
            <ellipse key={i} cx={110 + (i % 2 ? 4 : -4)} cy="80" rx={70 - i * 3} ry={55 - i * 3} fill="none"
              stroke={i % 2 ? '#60a5fa' : '#f8fafc'} strokeWidth="5" strokeDasharray={i % 2 ? '10 4' : '0'} opacity={0.9 - i * 0.08} />
          ))}
          <text x="110" y="155" textAnchor="middle" fill="#94a3b8" fontSize="11">흰색 = 바로 감기 · 파랑 = 뒤집어 감기</text>
        </svg>
        <p className="text-xs text-slate-400 text-center mt-1">한 번은 바로(오버), 한 번은 뒤집어(언더) 번갈아 감습니다.</p>
      </div>
      <div>
        <div className="text-sm font-bold mb-2">출동 전 케이블 체크리스트 <span className="text-emerald-300 font-mono">{done.length}/{CHECKLIST.length}</span></div>
        <ul className="space-y-1.5">
          {CHECKLIST.map((c) => {
            const on = done.includes(c);
            return (
              <li key={c}>
                <button type="button" onClick={() => setDone((d) => (on ? d.filter((x) => x !== c) : [...d, c]))}
                  className={`w-full text-left text-sm flex gap-2 items-start px-2 py-1.5 rounded border ${on ? 'bg-emerald-950 border-emerald-700 text-emerald-200' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-400' : 'border-slate-500'}`}>{on && <Check size={12} />}</span>{c}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function MixerSizes({ item }) {
  const [size, setSize] = useState('small');
  return (
    <div>
      <div className="h-[340px] sm:h-[420px] relative bg-[#131a27]">
        <MixerSizeViewer key={size} size={size} />
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">드래그로 돌려 보기 · 휠/핀치로 확대</div>
      </div>
      <div className="p-3 border-t border-slate-700 bg-slate-900/60 grid sm:grid-cols-3 gap-2">
        {item.sizes.map((z) => (
          <button key={z.key} type="button" onClick={() => setSize(z.key)}
            className={`text-left rounded-lg border p-3 space-y-1 ${size === z.key ? 'bg-sky-900/60 border-sky-400' : 'bg-slate-900 border-slate-700 hover:bg-slate-800'}`}>
            <div className="flex items-baseline justify-between gap-2"><span className="text-lg font-bold">{z.name}</span><span className="text-xs font-mono text-amber-300">{z.ch}</span></div>
            <div className="text-xs text-slate-300 leading-relaxed">{z.feature}</div>
            <div className="text-[11px] text-slate-400"><b className="text-slate-300">쓰이는 곳</b> · {z.where}</div>
            <div className="text-[11px] text-slate-500"><b className="text-slate-400">예시</b> · {z.examples}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DmxVisual() {
  const chain = [['콘솔', 'DMX OUT', null], ['LED 파 1', '001~008', 8], ['LED 파 2', '009~016', 8], ['무빙 1', '017~032', 16], ['무빙 2', '033~048', 16]];
  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {chain.map(([n, a, fp], i) => (
          <React.Fragment key={n}>
            <div className={`rounded-lg border px-2.5 py-2 text-center ${i ? 'border-lime-500/60 bg-lime-950/40' : 'border-orange-400/60 bg-orange-950/40'}`}>
              <div className="text-xs font-bold text-slate-100">{n}</div>
              <div className="text-[11px] font-mono text-lime-300">{a}</div>
              {fp && <div className="text-[10px] text-slate-400">{fp}채널</div>}
            </div>
            {i < chain.length - 1 && <span className="text-lime-400 text-xs font-bold">IN←OUT</span>}
          </React.Fragment>
        ))}
        <div className="rounded-full border border-lime-400 px-2 py-1 text-[10px] text-lime-200">터미네이터 120Ω</div>
      </div>
      <div className="h-6 rounded bg-slate-950 border border-slate-700 relative overflow-hidden" aria-label="512 채널 중 사용 범위">
        {[[0, 8, '#38bdf8'], [8, 8, '#22c55e'], [16, 16, '#f472b6'], [32, 16, '#a78bfa']].map(([st, len, c], i) => <div key={i} className="absolute top-0 bottom-0" style={{ left: `${(st / 64) * 100}%`, width: `${(len / 64) * 100}%`, background: c, opacity: 0.8 }} />)}
        <span className="absolute right-1 top-0.5 text-[10px] text-slate-300">채널 1 ~ 64 (유니버스 1 = 512채널)</span>
      </div>
      <p className="text-xs text-slate-400">각 조명은 자기 시작 주소부터 채널 수만큼만 읽습니다. 범위가 겹치면 두 조명이 서로의 값을 읽어 엉뚱하게 움직입니다.</p>
    </div>
  );
}
function LayersVisual() {
  const layers = [['Layer 3', '로고', '#38bdf8'], ['Layer 2', '가사', '#f8fafc'], ['Layer 1', '배경 영상', '#f59e0b']];
  return (
    <div className="p-4 grid sm:grid-cols-2 gap-4 items-center">
      <div className="space-y-1.5">
        {layers.map(([l, n, c], i) => (
          <div key={l} className="rounded border border-slate-600 px-3 py-2 flex items-center gap-2 bg-slate-900" style={{ marginLeft: i * 14 }}>
            <span className="w-3 h-3 rounded-sm" style={{ background: c }} /><b className="text-xs">{l}</b><span className="text-xs text-slate-300">{n}</span>
          </div>
        ))}
        <div className="text-[11px] text-slate-400">↑ 위 레이어가 앞에 보임</div>
      </div>
      <div className="space-y-2 text-xs">
        <div className="rounded-lg border border-rose-500/50 p-2"><b className="text-rose-300">출력 1 → LED 전광판</b><div className="text-slate-400">배경 + 가사, LED 해상도에 맞춤</div></div>
        <div className="rounded-lg border border-sky-500/50 p-2"><b className="text-sky-300">출력 2 → ATEM 입력 3</b><div className="text-slate-400">방송용 오프닝·자막 그래픽</div></div>
      </div>
    </div>
  );
}
function IpVisual() {
  const devs = [['PTZ 카메라', '192.168.1.21', true], ['PTZ 조이스틱', '192.168.1.10', true], ['ATEM Mini Pro', '192.168.1.240', true], ['다른 대역 카메라', '192.168.0.21', false]];
  return (
    <div className="p-4 space-y-3">
      <div className="mx-auto w-fit rounded-lg border border-teal-400/60 bg-teal-950/40 px-4 py-2 text-center"><div className="text-sm font-bold">공유기 / 스위치</div><div className="text-[11px] font-mono text-teal-300">192.168.1.1</div></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {devs.map(([n, ip, ok]) => (
          <div key={n} className={`rounded-lg border p-2 text-center ${ok ? 'border-green-500/50' : 'border-red-500/60'}`}>
            <div className="text-xs font-bold">{n}</div><div className="text-[11px] font-mono text-slate-300">{ip}</div>
            <div className={`text-[10px] ${ok ? 'text-green-300' : 'text-red-300'}`}>{ok ? '통신 가능' : '대역이 달라 못 찾음'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CONCEPT = {
  dmx: DmxVisual, layers: LayersVisual, ipnet: IpVisual,
  flow: FlowVisual, gain: GainVisual, feedback: FeedbackVisual, pgmpvw: PgmPvwVisual,
  levels: LevelsVisual, camsettings: CamSettingsVisual, multiview: MultiviewVisual, transitions: TransitionsVisual,
  balanced: BalancedVisual, cablemap: CableMapVisual, cablecare: CableCareVisual,
};

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
