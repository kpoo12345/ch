import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Search, X, BookOpen, GraduationCap, Gamepad2, Hand,
  Lightbulb, AlertTriangle, MapPin, Plug, ListChecks, Cpu, CircleHelp, CheckCircle2, XCircle, Link2, Table2,
  Workflow, Mic, Cable, SlidersHorizontal, Speaker, Guitar, Camera, Tv, Lightbulb as LightIcon, Clapperboard, Image as ImageIcon, Box,
} from 'lucide-react';
import { CLIPS } from './scenes.js';
import { DEVICE_TYPES, PORT_KIND_LABEL, PORT_COLOR, CABLES, MIXER_DEFAULT, MIC_LEVEL, faderDb, fmtDb } from './engine.js';
import { EquipmentViewer, CableShowcase } from './Studio3D.jsx';
import AudioLab from './AudioLab.jsx';
import FadeLab from './FadeLab.jsx';
import { Slider, ToggleBtn } from './ui.jsx';
import { EDU_CATEGORIES, EDU_ITEMS, EDU_BY_ID, partTitle } from './eduContent.js';
import { CONCEPT, MixerSizes } from './eduVisuals.jsx';
import { PHOTOS, photoSrc, photoCredit, photoPage } from './data/photos.js';
import { patchBetaContext } from './betaContext.js';
import { TUTORIAL } from './data/tutorial.js';
import STORY from './data/story.json';
import { buildIndex, searchItems } from './dictSearch.js';

/* =====================================================================
 * 장비 백과사전 — 빨리 찾아보는 참고서
 *  검색(이름 · 다른 이름 · 초성) → 목록 → 항목: 한 줄 정의 · 사진/3D · 어디에 쓰나 · 연결 · 현장 팁
 *  배우는 곳은 튜토리얼과 스토리 모드 — 항목마다 "튜토리얼에서 배우기" · "스토리에서 써 보기"로 이어 준다
 * ===================================================================== */

const CAT_ICON = { '소리 기초': Workflow, 마이크: Mic, '케이블·스네이크': Cable, 믹서: SlidersHorizontal, '스피커·모니터': Speaker, 악기: Guitar, 카메라: Camera, '스위처·송출': Tv, 조명: LightIcon, '영상 연출': Clapperboard };
// Studio3D의 EquipmentViewer가 그릴 수 있는 장비 (뷰어에 새 모델을 넣으면 여기에도 추가)
const VIEWER_TYPES = new Set([
  'dynamic_mic', 'condenser_mic', 'wireless_mic', 'kick_mic', 'snare_mic', 'overhead_mic', 'analog_mixer', 'digital_mixer', 'audio_interface', 'di_box',
  'stage_box', 'snake_fanout', 'speaker', 'passive_speaker', 'power_amp', 'iem', 'monitor', 'headphones', 'drum_kit', 'digital_piano', 'bass_guitar', 'camera', 'mirrorless', 'ptz', 'ptz_controller',
  'atem', 'atem_pro', 'pc', 'lighting_console', 'par_led', 'moving_head', 'media_server', 'led_wall', 'projector',
]);
// 직접 만져 보기 컨트롤이 있는 장비
const HAS_DEMO = new Set([
  'dynamic_mic', 'condenser_mic', 'wireless_mic', 'kick_mic', 'snare_mic', 'overhead_mic', 'analog_mixer', 'digital_mixer', 'audio_interface', 'di_box',
  'stage_box', 'snake_fanout', 'speaker', 'monitor', 'camera', 'mirrorless', 'ptz', 'ptz_controller', 'atem', 'atem_pro', 'pc',
  'lighting_console', 'par_led', 'moving_head', 'media_server', 'led_wall', 'projector',
]);
const POPULAR = ['cable_xlr', 'gain', 'feedback', 'condenser_mic', 'cable_trs', 'di_box', 'stage_box', 'levels', 'pgmpvw', 'dmx'];

// 스토리 스테이지 이름: 'seminar-1' → '1장 · 첫 소리 내기'
const STAGE_LABEL = Object.fromEntries(STORY.chapters.flatMap((c) => c.stages.map((s) => [s.id, `${c.title.match(/^\d+장/)?.[0] ?? c.title} · ${s.title}`])));
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const isWide = () => typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches;

/* ---------------------------- 직접 만져 보기 (장비별 체험 컨트롤) ---------------------------- */
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
    case 'kick_mic':
    case 'snare_mic':
    case 'overhead_mic':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleBtn on={demo.talking} color="green" onClick={() => set({ ...demo, talking: !demo.talking })}>{demo.talking ? '연주 중' : '연주하기'}</ToggleBtn>
          {type === 'overhead_mic' && <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>+48V 팬텀</ToggleBtn>}
          <span className="text-xs text-slate-400">{type === 'overhead_mic' ? '콘덴서라 팬텀을 끄면 신호가 나오지 않습니다.' : '다이나믹이라 전원 없이 동작합니다.'}</span>
        </div>
      );
    case 'stage_box':
    case 'snake_fanout':
      return (
        <div className="flex flex-wrap gap-2 items-center">
          <ToggleBtn on={demo.talking} color="green" onClick={() => set({ ...demo, talking: !demo.talking })}>{demo.talking ? '무대에서 소리 나는 중' : '무대 소리 내기'}</ToggleBtn>
          <span className="text-xs text-slate-400">신호가 지나가는 단자의 불이 켜집니다. 박스 INPUT 번호 = 팬아웃 OUT 번호입니다.</span>
        </div>
      );
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
            <ToggleBtn on={demo.mixer.phantom} color="amber" onClick={() => mix('phantom', !demo.mixer.phantom)}>+48V</ToggleBtn>
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
            <Slider id="edu-mainf" label={type === 'analog_mixer' ? 'STEREO 페이더' : 'MAIN 페이더'} value={demo.mixer.mainFader} min={0} max={100} onChange={(v) => mix('mainFader', v)} display={fmtDb(faderDb(demo.mixer.mainFader))} />
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
              <input type="range" min={0} max={100} value={vj.layers[li].opacity} aria-label={`레이어 ${li + 1} 불투명도`} onChange={(e) => set({ ...demo, vj: { ...vj, layers: vj.layers.map((l, j) => (j === li ? { ...l, opacity: Number(e.target.value) } : l)) } })} className="w-24 accent-rose-500" />
            </div>
          ))}
          {type !== 'media_server' && <ToggleBtn on={demo.screenOn} color="green" onClick={() => set({ ...demo, screenOn: !demo.screenOn })}>전원 {demo.screenOn ? 'ON' : 'OFF'}</ToggleBtn>}
          <p className="text-xs text-slate-400">레이어 1이 맨 아래, 3이 맨 위입니다. 가사(Layer 2)의 불투명도를 올려 보세요.</p>
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

/* ---------------------------- 3D가 깨져도 페이지는 살린다 ---------------------------- */
class SafeView extends Component {
  constructor(props) { super(props); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}
const NoView = <div className="h-full flex items-center justify-center text-sm text-slate-500">3D 모델을 불러오지 못했어요</div>;

/* ---------------------------- 장비 3D + 직접 만져 보기 ---------------------------- */
function DeviceView({ type }) {
  const [demo, setDemo] = useState(DEMO_DEFAULT);
  const [open, setOpen] = useState(false);
  const [jitter, setJitter] = useState(0);
  // 미터 흔들림은 만져 보기를 열었을 때만 (닫혀 있으면 다시 그리지 않는다)
  useEffect(() => {
    if (!open || !demo.talking) return undefined;
    const t = setInterval(() => setJitter(-(Math.random() ** 1.5) * 12), 120);
    return () => clearInterval(t);
  }, [open, demo.talking]);
  const levels = useMemo(() => {
    const m = demo.mixer;
    const rfDown = type === 'wireless_mic' && (!demo.txPower || demo.rf <= 15);
    if (!demo.talking || ((type === 'condenser_mic' || type === 'overhead_mic') && !m.phantom) || rfDown) return { chLevel: null, mainLevel: null };
    const ch = MIC_LEVEL + m.gain + jitter;
    const post = m.chMute || m.chFader <= 0 ? null : ch + faderDb(m.chFader);
    const main = post == null || m.mainMute || m.mainFader <= 0 ? null : post + faderDb(m.mainFader);
    return { chLevel: ch, mainLevel: main };
  }, [demo, jitter, type]);
  const viewDemo = { ...demo, ...levels, talking: levels.chLevel != null, level: demo.talking ? -14 + jitter : null };
  return (
    <>
      <div className="h-[260px] sm:h-[360px] bg-[#131a27] relative">
        <SafeView fallback={NoView}><EquipmentViewer key={type} type={type} demo={viewDemo} /></SafeView>
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">드래그로 돌려 보기 · 핀치/휠로 확대</div>
      </div>
      {HAS_DEMO.has(type) && (
        <div className="border-t border-slate-700 bg-slate-900/60">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-800/60">
            <Hand size={15} className="text-amber-300 shrink-0" /><span className="text-sm font-bold text-amber-200">직접 만져 보기</span>
            <span className="text-xs text-slate-500 truncate">버튼을 누르면 3D가 따라 움직여요</span>
            <ChevronDown size={16} className={`ml-auto shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <div className="px-3 pb-3"><DemoControls type={type} demo={demo} set={setDemo} /></div>}
        </div>
      )}
    </>
  );
}

/* ---------------------------- 그림: 사진 → 3D → 개념 그림 ---------------------------- */
function Figure({ item, onOpen }) {
  const photos = asList(item.photo).map((id) => ({ id, src: photoSrc(id), alt: PHOTOS[id]?.alt ?? item.title, credit: photoCredit(id), page: photoPage(id) })).filter((p) => p.src);
  const has3d = (item.kind === 'device' && VIEWER_TYPES.has(item.type) && !!DEVICE_TYPES[item.type]) || item.kind === 'cable';
  const [view, setView] = useState(photos.length ? 'photo' : '3d');
  const [pi, setPi] = useState(0);
  const Concept = item.concept ? CONCEPT[item.concept] : null;
  if (item.kind === 'mixersizes') return <MixerSizes item={item} />;
  if (!photos.length && !has3d) return Concept ? <div className="bg-[#131a27]"><Concept onOpen={onOpen} /></div> : null;
  const photo = photos[Math.min(pi, photos.length - 1)];
  return (
    <div>
      {photos.length > 0 && has3d && (
        <div className="flex gap-1 p-1.5 bg-slate-900/70 border-b border-slate-700" role="tablist" aria-label="보기 방식">
          {[['photo', '사진', ImageIcon], ['3d', '3D로 돌려 보기', Box]].map(([k, t, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 ${view === k ? 'bg-sky-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Icon size={13} /> {t}</button>
          ))}
        </div>
      )}
      {view === 'photo' && photo ? (
        <figure className="bg-[#131a27]">
          <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" className="w-full h-[260px] sm:h-[360px] object-contain" />
          <figcaption className="px-3 py-1.5 text-[11px] text-slate-400 flex flex-wrap gap-x-2 border-t border-slate-700/60">
            <span>{photo.alt}</span>{photo.credit && <span className="text-slate-500">· {photo.page ? <a href={photo.page} target="_blank" rel="noreferrer" className="underline hover:text-slate-300">{photo.credit}</a> : photo.credit}</span>}
          </figcaption>
          {photos.length > 1 && (
            <div className="flex gap-1.5 p-2 border-t border-slate-700/60">
              {photos.map((p, i) => (
                <button key={p.id} type="button" onClick={() => setPi(i)} aria-label={p.alt} aria-pressed={i === pi}
                  className={`w-14 h-14 rounded-md overflow-hidden border-2 ${i === pi ? 'border-sky-400' : 'border-slate-700'}`}><img src={p.src} alt="" className="w-full h-full object-cover" /></button>
              ))}
            </div>
          )}
        </figure>
      ) : item.kind === 'device' ? <DeviceView type={item.type} />
        : (
          <div className="h-[240px] sm:h-[320px] bg-[#131a27] relative">
            <SafeView fallback={NoView}><CableShowcase key={item.cable} kind={item.cable} color={item.color} /></SafeView>
            <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">드래그로 돌려 보기 · 핀치/휠로 확대</div>
          </div>
        )}
      {Concept && <div className="border-t border-slate-700 bg-[#131a27]"><Concept onOpen={onOpen} /></div>}
    </div>
  );
}

/* ---------------------------- 작은 조각들 ---------------------------- */
function Card({ icon: Icon, title, tone, children }) {
  return (
    <section className="bg-slate-800/70 rounded-xl border border-slate-700 p-4 min-w-0">
      <h3 className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${tone}`}><Icon size={15} /> {title}</h3>
      {children}
    </section>
  );
}
const Bullets = ({ items }) => (
  <ul className="space-y-1.5 text-sm text-slate-300 leading-relaxed list-disc pl-5 marker:text-slate-500">{items.map((t) => <li key={t}>{t}</li>)}</ul>
);

function Fold({ icon: Icon, title, hint, tone, children }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-slate-800/70 rounded-xl border border-slate-700 min-w-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 text-left rounded-xl hover:bg-slate-700/40">
        <Icon size={15} className={`${tone} shrink-0`} /><span className={`text-sm font-bold ${tone} shrink-0`}>{title}</span>
        {hint && <span className="text-xs text-slate-500 truncate">{hint}</span>}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

// 단자: 방향 · 종류별로 묶어 짧게
function Ports({ def }) {
  const groups = [];
  for (const [dir, ports] of [['입력', def.ins], ['출력', def.outs]]) {
    const byKind = {};
    for (const p of ports) (byKind[p.kind] ??= []).push(p.label);
    for (const [kind, labels] of Object.entries(byKind)) groups.push({ dir, kind, labels });
  }
  if (!groups.length) return null;
  return (
    <div className="mt-3 pt-3 border-t border-slate-700">
      <div className="text-[11px] font-bold text-slate-400 mb-1.5">단자</div>
      <ul className="space-y-1.5 text-[13px]">
        {groups.map((g) => (
          <li key={g.dir + g.kind} className="flex items-start gap-2">
            <span className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PORT_COLOR[g.kind] }} />
            <span className="min-w-0">
              <b className="text-slate-200">{g.dir}</b> <span className="text-slate-400">· {PORT_KIND_LABEL[g.kind] ?? g.kind}{g.labels.length > 1 ? ` ×${g.labels.length}` : ''}</span>
              <span className="block text-xs text-slate-500">{g.labels.length > 3 ? `${g.labels[0]} ~ ${g.labels[g.labels.length - 1]}` : g.labels.join(' · ')}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Specs({ rows }) {
  return (
    <Card icon={Table2} title="한눈에" tone="text-slate-200">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-t border-slate-700/70 first:border-t-0">
              <th scope="row" className="text-left font-normal text-slate-400 py-1.5 pr-3 w-24 align-top">{k}</th>
              <td className="py-1.5 text-slate-200">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Quiz({ quiz }) {
  const [pick, setPick] = useState(null);
  const { q, options, answer, explain } = quiz;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{q}</p>
      <div className="grid gap-1.5">
        {options.map((o, i) => {
          const cls = pick != null && i === answer ? 'border-green-500 bg-green-950' : pick === i ? 'border-red-500 bg-red-950' : 'border-slate-600 bg-slate-900 hover:bg-slate-800';
          return <button key={o} type="button" onClick={() => setPick(i)} className={`text-left text-sm px-3 py-2 rounded border ${cls}`}>{o}</button>;
        })}
      </div>
      {pick != null && (
        <p className={`text-sm flex gap-1.5 ${pick === answer ? 'text-green-300' : 'text-red-300'}`}>
          {pick === answer ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <XCircle size={16} className="shrink-0 mt-0.5" />}
          <span>{pick === answer ? '정답! ' : '다시 생각해 보세요. '}{explain}</span>
        </p>
      )}
    </div>
  );
}

/* ---------------------------- 항목 한 장 ---------------------------- */
function Entry({ item, list, onOpen, onCat, go }) {
  const CatIcon = CAT_ICON[item.cat] ?? BookOpen;
  const part = item.part != null && item.part < TUTORIAL.length ? item.part : null;
  const stages = asList(item.stage).filter((s) => STAGE_LABEL[s]).slice(0, 2);
  const def = item.type ? DEVICE_TYPES[item.type] : null;
  const thing = item.kind === 'device' || item.kind === 'cable';
  const figure = <Figure item={item} onOpen={onOpen} />;
  const hasFigure = !!(item.kind === 'mixersizes' || item.concept || asList(item.photo).some(photoSrc) || item.kind === 'cable' || (item.kind === 'device' && VIEWER_TYPES.has(item.type) && def));
  // 관련 항목 + 이 항목을 관련으로 둔 항목
  const related = useMemo(() => {
    const ids = [...(item.related ?? []), ...EDU_ITEMS.filter((x) => x.related?.includes(item.id)).map((x) => x.id)];
    return [...new Set(ids)].filter((id) => id !== item.id && EDU_BY_ID[id]).slice(0, 10).map((id) => EDU_BY_ID[id]);
  }, [item]);
  const idx = list.findIndex((x) => x.id === item.id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const lab = item.kind === 'audiolab' ? <AudioLab focus={item.lab} /> : item.kind === 'fadelab' ? <FadeLab /> : null;

  return (
    <article className="space-y-4" aria-labelledby="dict-title">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <button type="button" onClick={() => onCat(item.cat)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-sky-300 font-bold hover:border-sky-500">
            <CatIcon size={12} /> {item.cat}
          </button>
          <span className="text-slate-400">{item.subtitle}</span>
        </div>
        <h2 id="dict-title" className="text-2xl sm:text-3xl font-bold tracking-tight">{item.title}</h2>
        <p className="text-base sm:text-lg text-slate-100 leading-relaxed border-l-4 border-sky-500 pl-3" style={{ textWrap: 'pretty' }}>{item.def}</p>
        {item.aka?.length > 0 && <p className="text-xs text-slate-500">다른 이름 · {item.aka.slice(0, 7).join(', ')}</p>}
        {(part != null || stages.length > 0) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {part != null && (
              <button type="button" onClick={() => go('tutorial', part)} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-bold flex items-center gap-1.5 text-left">
                <GraduationCap size={16} className="shrink-0" /> 튜토리얼에서 배우기 <span className="font-normal text-violet-100">· 파트 {part + 1} {partTitle(TUTORIAL, part)}</span>
              </button>
            )}
            {stages.map((s) => (
              <button key={s} type="button" onClick={() => go('story', s)} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm font-bold flex items-center gap-1.5 text-left">
                <Gamepad2 size={16} className="shrink-0" /> 스토리에서 써 보기 <span className="font-normal text-slate-300">· {STAGE_LABEL[s]}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {hasFigure && (
        <div className={`grid gap-4 ${item.specs && item.kind !== 'mixersizes' ? 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start' : ''}`}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-w-0">{figure}</div>
          {item.specs && item.kind !== 'mixersizes' && <Specs rows={item.specs} />}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {item.use && <Card icon={MapPin} title={thing ? '어디에 쓰나' : '언제 필요한가'} tone="text-sky-300"><Bullets items={item.use} /></Card>}
        {item.connect && (
          <Card icon={Plug} title="연결" tone="text-emerald-300">
            <Bullets items={item.connect} />
            {def && <Ports def={def} />}
            {item.kind === 'cable' && CABLES[item.cable] && (
              <p className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-400 flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color ?? CABLES[item.cable].stroke }} /> 게임 안에서는 이 색의 케이블로 보입니다.</p>
            )}
          </Card>
        )}
        {item.key && <Card icon={ListChecks} title="핵심 정리" tone="text-emerald-300"><Bullets items={item.key} /></Card>}
        {item.tips?.length > 0 && <Card icon={Lightbulb} title="현장 팁" tone="text-amber-300"><Bullets items={item.tips} /></Card>}
        {item.mistakes?.length > 0 && <Card icon={AlertTriangle} title="자주 하는 실수" tone="text-red-300"><Bullets items={item.mistakes} /></Card>}
        {item.specs && (!hasFigure || item.kind === 'mixersizes') && <Specs rows={item.specs} />}
      </div>

      <div className="space-y-2">
        {(item.about || item.how) && (
          <Fold icon={Cpu} title="원리 자세히" hint="왜 그렇게 동작하나" tone="text-sky-300">
            {item.about && <p className="text-sm text-slate-200 leading-relaxed mb-2">{item.about}</p>}
            {item.how && <Bullets items={item.how} />}
          </Fold>
        )}
        {lab && <Fold icon={Hand} title="직접 만져 보기" hint={item.kind === 'fadelab' ? '음악을 틀고 CUT과 페이드를 비교' : '노브를 돌리며 소리 변화를 듣기'} tone="text-amber-300">{lab}</Fold>}
        {item.quiz && <Fold icon={CircleHelp} title="확인 문제" hint="한 문제로 점검" tone="text-emerald-300"><Quiz quiz={item.quiz} /></Fold>}
      </div>

      {related.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-1.5"><Link2 size={15} /> 관련 항목</h3>
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => (
              <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-sky-500 text-sm text-left">
                {r.title} <span className="text-[11px] text-slate-500">{r.cat}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <nav className="flex gap-2 pt-2 border-t border-slate-800" aria-label="이전·다음 항목">
        {prev && <button type="button" onClick={() => onOpen(prev.id)} className="min-w-0 flex-1 sm:flex-none px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-1 text-left"><ChevronLeft size={16} className="shrink-0" /><span className="truncate">{prev.title}</span></button>}
        {next && <button type="button" onClick={() => onOpen(next.id)} className="min-w-0 flex-1 sm:flex-none ml-auto px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm flex items-center justify-end gap-1 text-right"><span className="truncate">{next.title}</span><ChevronRight size={16} className="shrink-0" /></button>}
      </nav>
    </article>
  );
}

/* ---------------------------- 목록 ---------------------------- */
function ResultList({ results, grouped, showCat, activeId, onOpen }) {
  const row = (r) => {
    const active = r.x.id === activeId;
    return (
      <li key={r.x.id}>
        <button type="button" onClick={() => onOpen(r.x.id)} aria-current={active ? 'true' : undefined}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-2 border-l-2 ${active ? 'bg-sky-900/50 border-sky-400' : 'border-transparent hover:bg-slate-700/50'}`}>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-sm font-bold text-slate-100 truncate">{r.x.title}</span>
              {showCat && <span className="text-[10px] text-slate-500 shrink-0">{r.x.cat}</span>}
            </span>
            <span className="block text-xs text-slate-400 truncate">{r.snippet ?? r.x.def}</span>
          </span>
          <ChevronRight size={16} className="text-slate-600 shrink-0 lg:hidden" />
        </button>
      </li>
    );
  };
  if (!grouped) return <ul className="divide-y divide-slate-700/60">{results.map(row)}</ul>;
  return EDU_CATEGORIES.map((c) => {
    const rs = results.filter((r) => r.x.cat === c);
    if (!rs.length) return null;
    const Icon = CAT_ICON[c] ?? BookOpen;
    return (
      <div key={c}>
        <div className="lg:sticky lg:top-0 z-10 bg-slate-800 px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 flex items-center gap-1.5 border-y border-slate-700 first:border-t-0"><Icon size={12} /> {c}</div>
        <ul className="divide-y divide-slate-700/60">{rs.map(row)}</ul>
      </div>
    );
  });
}

/* ---------------------------- 첫 화면 (넓은 화면에서 항목을 안 골랐을 때) ---------------------------- */
function Home({ onOpen, onCat, onNavigate }) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-5 sm:p-6">
        <h2 className="text-2xl font-bold">무엇을 찾고 있나요?</h2>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">장비 이름, 현장에서 부르는 다른 이름(캐논, 55잭, 팬텀…), 초성(ㄷㅇㄴㅁ)으로 검색하세요. 항목마다 <b className="text-slate-100">한 줄 정의 · 어디에 쓰나 · 연결 · 현장 팁</b>이 정리되어 있어요.</p>
        <p className="mt-1.5 text-xs text-slate-500"><kbd className="px-1 rounded bg-slate-700 text-slate-300">/</kbd> 검색창으로 · <kbd className="px-1 rounded bg-slate-700 text-slate-300">Enter</kbd> 첫 번째 결과 열기</p>
        <div className="mt-4 text-xs font-bold text-slate-400 mb-1.5">자주 찾는 항목</div>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR.filter((id) => EDU_BY_ID[id]).map((id) => (
            <button key={id} type="button" onClick={() => onOpen(id)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-sky-500 text-sm">{EDU_BY_ID[id].title}</button>
          ))}
        </div>
      </section>
      <section className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3" aria-label="분류">
        {EDU_CATEGORIES.map((c) => {
          const Icon = CAT_ICON[c] ?? BookOpen;
          const xs = EDU_ITEMS.filter((x) => x.cat === c);
          return (
            <button key={c} type="button" onClick={() => onCat(c)} className="text-left rounded-xl border border-slate-700 bg-slate-800/70 hover:border-sky-500 p-3.5">
              <div className="flex items-center gap-2 font-bold"><Icon size={16} className="text-sky-300" /> {c} <span className="ml-auto text-xs font-mono text-slate-500">{xs.length}</span></div>
              <div className="mt-1 text-xs text-slate-400 truncate">{xs.slice(0, 4).map((x) => x.title).join(' · ')}</div>
            </button>
          );
        })}
      </section>
      <section className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-4 flex flex-wrap items-center gap-3">
        <GraduationCap className="text-violet-300 shrink-0" />
        <div className="flex-1 min-w-[220px]">
          <div className="font-bold text-violet-100">차근차근 배우고 싶다면</div>
          <div className="text-sm text-slate-300">튜토리얼(기초 과정)에서 배우고 스토리 모드 현장 미션으로 연습하세요. 백과사전은 그때그때 찾아보는 곳이에요.</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onNavigate('tutorial')} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-bold">① 튜토리얼</button>
          <button type="button" onClick={() => onNavigate('story')} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-sm font-bold">② 스토리 모드</button>
        </div>
      </section>
    </div>
  );
}

/* =====================================================================
 * Encyclopedia
 *  onNavigate(mode, arg, fromId): 'tutorial'(파트 번호) · 'story'(스테이지 id) — fromId는 돌아올 항목
 * ===================================================================== */
export default function Encyclopedia({ onExit, onNavigate, initialId = null }) {
  const index = useMemo(() => buildIndex(EDU_ITEMS), []);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [openId, setOpenId] = useState(() => (initialId && EDU_BY_ID[initialId] ? initialId : null));
  const searchRef = useRef(null);

  const all = useMemo(() => searchItems(index, query), [index, query]);
  const results = useMemo(() => (cat === 'all' ? all : all.filter((r) => r.x.cat === cat)), [all, cat]);
  const list = results.map((r) => r.x);
  const item = openId ? EDU_BY_ID[openId] : null;
  useEffect(() => { patchBetaContext({ entry: item ? item.title : undefined }); }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => {
    const c = { all: all.length };
    for (const r of all) c[r.x.cat] = (c[r.x.cat] ?? 0) + 1;
    return c;
  }, [all]);

  const open = (id) => { if (!EDU_BY_ID[id]) return; setOpenId(id); window.scrollTo(0, 0); };
  const pickCat = (c) => { setCat(c); setQuery(''); if (!isWide()) setOpenId(null); };

  // '/' 키로 검색창
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      if (!isWide()) setOpenId(null);
      setTimeout(() => searchRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-slate-900 text-white font-sans">
      <style>{`
        @keyframes bm-travel { 0% { left: 1.5rem; } 100% { left: calc(100% - 2.25rem); } }
        .bm-travel { animation: bm-travel 2.4s linear infinite; }
        @keyframes bm-flow { to { stroke-dashoffset: -24; } }
        .bm-flow { animation: bm-flow .6s linear infinite; }
        .bm-noevents { pointer-events: none !important; }
        .bm-noscroll { scrollbar-width: none; } .bm-noscroll::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) { .bm-travel, .bm-flow, .animate-pulse { animation: none !important; } }
      `}</style>

      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2">
          {item && (
            <button type="button" onClick={() => setOpenId(null)} className="lg:hidden px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm flex items-center gap-1 shrink-0">
              <ArrowLeft size={16} /> 목록
            </button>
          )}
          <button type="button" onClick={onExit} className={`${item ? 'hidden lg:flex' : 'flex'} px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm items-center gap-1 shrink-0`}>
            <ArrowLeft size={16} /> 메뉴
          </button>
          <h1 className="font-bold text-lg text-emerald-300 flex items-center gap-2 min-w-0"><BookOpen size={20} className="shrink-0" /> <span className="truncate">장비 백과사전</span></h1>
          <span className="hidden md:inline text-xs text-slate-500 shrink-0">{EDU_ITEMS.length}개 항목 · 찾아보기용</span>
          <button type="button" onClick={() => onNavigate('tutorial')} className="ml-auto hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold text-violet-200 border border-violet-500/50 bg-violet-950/40 hover:bg-violet-900/60 shrink-0">
            <GraduationCap size={15} /> 처음부터 배우기
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
        {/* 검색 · 분류 · 목록 */}
        <aside className={`${item ? 'hidden lg:flex' : 'flex'} flex-col gap-3 min-w-0 lg:sticky lg:top-[4.5rem] lg:self-start lg:max-h-[calc(100dvh-5.5rem)]`}>
          {!query && (
            <button type="button" onClick={() => onNavigate('tutorial')} className="lg:hidden text-left rounded-xl border border-violet-500/40 bg-violet-950/30 px-3 py-2 text-xs text-slate-300 flex items-center gap-2">
              <GraduationCap size={16} className="text-violet-300 shrink-0" /><span>찾아보기용 사전이에요. 처음이라면 <b className="text-violet-200">튜토리얼</b>부터 배워 보세요.</span><ChevronRight size={14} className="ml-auto shrink-0 text-violet-300" />
            </button>
          )}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); open(list[0].id); } if (e.key === 'Escape') setQuery(''); }}
              placeholder="검색: 캐논, 팬텀, 하울링, ㄷㅇㄴㅁ…" aria-label="백과사전 검색" enterKeyHint="search" autoComplete="off"
              className="w-full rounded-xl bg-slate-800 border border-slate-600 focus:border-sky-400 outline-none pl-10 pr-10 py-2.5 text-base text-slate-100 placeholder:text-slate-500 [&::-webkit-search-cancel-button]:hidden" />
            {query && (
              <button type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-slate-700 text-slate-400"><X size={16} /></button>
            )}
          </div>
          <div role="group" aria-label="분류" className="flex gap-1.5 overflow-x-auto lg:flex-wrap -mx-3 px-3 lg:mx-0 lg:px-0 bm-noscroll">
            {['all', ...EDU_CATEGORIES].map((c) => {
              const on = cat === c;
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => setCat(on && c !== 'all' ? 'all' : c)}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold border ${on ? 'bg-sky-600 border-sky-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}>
                  {c === 'all' ? '전체' : c} <span className="font-mono opacity-60">{counts[c] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="min-h-0 lg:overflow-y-auto rounded-xl bg-slate-800/60 border border-slate-700 overflow-hidden">
            {query && <div className="px-3 py-1.5 text-[11px] text-slate-400 border-b border-slate-700">검색 결과 {results.length}개{cat !== 'all' && all.length > results.length ? ` · 다른 분류에 ${all.length - results.length}개 더` : ''}</div>}
            {results.length ? (
              <ResultList results={results} grouped={!query && cat === 'all'} showCat={!!query && cat === 'all'} activeId={openId} onOpen={open} />
            ) : (
              <div className="p-6 text-center text-sm text-slate-400 space-y-2">
                <p>"{query}"에 맞는 항목이 없어요.</p>
                {cat !== 'all' && all.length > 0
                  ? <button type="button" onClick={() => setCat('all')} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-100 text-xs font-bold">전체 분류에서 {all.length}개 보기</button>
                  : <p className="text-xs text-slate-500">다른 이름(예: 캐논, 55잭)이나 초성으로 찾아보세요.</p>}
              </div>
            )}
          </div>
        </aside>

        {/* 항목 */}
        <main className={`${item ? 'block' : 'hidden lg:block'} min-w-0`}>
          {item
            ? <Entry key={item.id} item={item} list={list.some((x) => x.id === item.id) ? list : EDU_ITEMS} onOpen={open} onCat={pickCat} go={(m, arg) => onNavigate(m, arg, item.id)} />
            : <Home onOpen={open} onCat={pickCat} onNavigate={onNavigate} />}
        </main>
      </div>
    </div>
  );
}
