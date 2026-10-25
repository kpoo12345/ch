import React, { useEffect, useRef, useState } from 'react';
import { Plus, Move, RotateCw, Trash2, Trophy, CheckCircle2, Circle, Save, Undo2 } from 'lucide-react';
import { DEVICE_TYPES } from '../engine.js';
import { STARTS_OFF } from '../ops.js';
import { VENUES } from '../venues.js';
import { loadProgress, saveProgress } from '../ui.jsx';
import GameScreen from './GameScreen.jsx';
import { FeedbackButton } from '../BetaFeedback.jsx';

/* =====================================================================
 * 스튜디오 모드 (자유 모드)
 *  - 장비 개수 제한 없음: 카탈로그에서 골라 바닥·책상·무대 아무 곳에나 클릭해 놓는다
 *  - 이동·회전·삭제, 케이블 무제한
 *  - 정답은 없고, 도전 과제는 선택 사항
 * ===================================================================== */

const CATALOG = [
  ['음향 소스', ['dynamic_mic', 'condenser_mic', 'wireless_mic', 'e_guitar', 'bass_guitar', 'keyboard', 'digital_piano', 'laptop']],
  ['드럼', ['drum_kit', 'kick_mic', 'snare_mic', 'overhead_mic']],
  ['음향 처리', ['analog_mixer', 'digital_mixer', 'audio_interface', 'di_box', 'stage_box', 'snake_fanout']],
  ['음향 출력', ['speaker', 'power_amp', 'passive_speaker', 'monitor', 'iem', 'headphones']],
  ['영상', ['camera', 'mirrorless', 'ptz', 'ptz_controller', 'atem', 'atem_pro']],
  ['송출·네트워크', ['pc', 'router']],
  ['조명', ['lighting_console', 'par_led', 'moving_head']],
  ['화면', ['media_server', 'projector', 'led_wall']],
];

// how: 막힌 초보자를 위한 한 줄 방법 (도전 과제를 누르면 펼쳐진다)
export const CHALLENGES = [
  { id: 'pa', label: '첫 소리: 마이크 목소리를 객석 스피커로', test: (st, sim) => voices(st).some((v) => sim.reaches(v, 'main')),
    how: '마이크 XLR OUT → 믹서 CH1 MIC (XLR) · 믹서 STEREO OUT L → 액티브 스피커 INPUT (XLR) · 다 꽂은 뒤 스피커 전원 ON → 아래 말하기' },
  { id: 'monitor', label: '모니터 믹스: 무대 웨지로 목소리 보내기', test: (st, sim) => voices(st).some((v) => sim.reaches(v, 'monitor')),
    how: '믹서 AUX SEND 1 → 모니터 웨지 INPUT · 마이크 채널의 AUX 1 노브 올리기 · 웨지 전원 ON' },
  { id: 'wireless2', label: '무선 마이크 2대를 하울링 없이 스피커로', test: (st, sim) => voices(st).filter((v) => st.devices[v].type === 'wireless_mic' && sim.reaches(v, 'main')).length >= 2 && !sim.feedback,
    how: '무선 마이크 AF OUT → 믹서 CH1·CH2 MIC (XLR) · 마이크마다 송신기와 수신기 채널을 같게 · 스피커가 마이크를 향하지 않게 (하울링 나면 게인을 내리거나 스피커를 돌리기)' },
  { id: 'band', label: '밴드 라인업: 악기 2개 이상을 험 없이 스피커로', test: (st, sim) => Object.values(st.devices).filter((d) => ['e_guitar', 'bass_guitar', 'keyboard', 'digital_piano', 'kick_mic', 'snare_mic', 'overhead_mic'].includes(d.type) && sim.reaches(d.id, 'main')).length >= 2 && !sim.hum,
    how: '악기 OUT → DI 박스 INPUT (TS 케이블) · DI OUTPUT → 믹서 CH MIC (XLR) — 먼 거리를 TS 케이블로 끌면 험이 생겨요 (믹서 옆이면 LINE 입력에 바로 꽂아도 돼요)' },
  { id: 'multicam', label: '멀티캠 생중계: 카메라 2대 이상 + 송출', test: (st, sim) => Object.keys(sim.video.camAt).length >= 2 && sim.stream.live,
    how: '카메라 HDMI OUT → 스위처 HDMI IN 1·2 · 스위처 USB WEBCAM → PC USB · 디지털 믹서 USB AUDIO → PC USB (소리) · PC에서 영상 ATEM, 소리 믹서를 고르고 방송 시작' },
  { id: 'light', label: '조명 쇼: 조명 3대 이상을 DMX로 정상 점등', test: (st, sim) => Object.values(sim.light.fixtures).filter((r) => r.intensity > 0.3 && !r.flicker && !r.wrong).length >= 3,
    how: '콘솔 DMX A → 조명 1 DMX IN → 조명 1 DMX OUT → 조명 2 DMX IN… (DMX 케이블로 줄줄이) · 마지막 조명에 터미네이터 · 콘솔에서 조명을 골라 밝기 올리기' },
  { id: 'screen', label: '미디어 서버 화면을 LED·프로젝터에 출력', test: (st, sim) => Object.values(sim.displays).some((r) => r.ok && r.layers.length),
    how: '미디어 서버 HDMI OUT 1 → LED 전광판(또는 프로젝터) HDMI IN · 미디어 서버에서 레이어에 클립 올리기' },
  { id: 'ptz', label: 'PTZ 카메라를 조이스틱으로 원격 제어', test: (st, sim) => Object.values(sim.ptz).some((r) => r.reachable),
    how: 'PTZ 카메라 LAN과 조이스틱 LAN → 공유기 LAN 단자 (랜선) · 조이스틱에서 카메라 번호를 고르고 움직여 보기' },
];
const voices = (st) => Object.values(st.devices).filter((d) => d.placed && ['dynamic_mic', 'condenser_mic', 'wireless_mic'].includes(d.type)).map((d) => d.id);

const TEMPLATES = {
  empty: { name: '빈 무대', devices: [], connections: [] },
  pa: {
    name: '기본 PA 세트',
    devices: [
      { id: 'mic1', type: 'dynamic_mic', pos: [-1.6, 0.35, -1.8] },
      { id: 'mixer1', type: 'analog_mixer', pos: [1.2, 0.75, 2.6], surface: 'desk' },
      { id: 'spk1', type: 'speaker', pos: [-3.8, 0, -0.6] }, { id: 'spk2', type: 'speaker', pos: [3.8, 0, -0.6] },
    ],
    connections: [{ from: 'mic1.out', to: 'mixer1.in1', cable: 'xlr' }],
  },
  stream: {
    name: '라이브 방송 세트',
    devices: [
      { id: 'mic1', type: 'dynamic_mic', pos: [-1.6, 0.35, -1.8] },
      { id: 'mixer1', type: 'digital_mixer', pos: [0.6, 0.75, 2.6], surface: 'desk' },
      { id: 'cam1', type: 'camera', pos: [-1.0, 0, 0.8], rot: Math.PI }, { id: 'cam2', type: 'camera', pos: [1.8, 0, 1.0], rot: Math.PI },
      { id: 'atem1', type: 'atem', pos: [1.7, 0.75, 2.7], surface: 'desk' }, { id: 'pc1', type: 'pc', pos: [2.9, 0.75, 2.5], surface: 'desk' },
    ],
    connections: [],
  },
};

function makeSpec(venue, tpl) {
  const t = TEMPLATES[tpl] ?? TEMPLATES.empty;
  return {
    id: 'sandbox', venue, title: `${VENUES[venue].name} — 자유 설치`, tag: '스튜디오 모드', unlimited: true,
    mission: '원하는 장비를 꺼내 원하는 곳에 놓고 연결해 보세요. 제한은 없습니다.',
    devices: t.devices.map((d) => ({ ...d, name: `${DEVICE_TYPES[d.type].name} ${d.id.replace(/\D/g, '')}`, placed: true })),
    // 스피커·앰프는 꺼진 채로 시작 (다 연결한 뒤 맨 마지막에 켠다)
    connections: t.connections, inventory: {}, objectives: [], talk: 'ptt', performing: true,
    state: { devices: Object.fromEntries(t.devices.filter((d) => STARTS_OFF.has(d.type)).map((d) => [d.id, { power: false }])) },
  };
}

export default function Sandbox({ onExit }) {
  const [setup, setSetup] = useState(null); // { spec, key }
  const [venue, setVenue] = useState('sandbox');
  const [askNew, setAskNew] = useState(null); // 저장본을 지우고 새로 시작할지 묻는 중인 세트 이름
  // 메뉴로 돌아오면 한 번 더 그려 게임 화면이 나가며 남긴 저장본까지 읽는다
  const [, setSeen] = useState(0);
  useEffect(() => { if (!setup) setSeen((n) => n + 1); }, [setup]);
  if (setup) {
    return (
      <GameScreen key={setup.key} spec={setup.spec} mode="sandbox" heading="스튜디오 모드 · 자유 설치" onExit={() => setSetup(null)}
        sandbox={{ Panel: SandboxPanel, Tools: DeviceTools, useWatch: useSandboxWatch }} restore={setup.restore} />
    );
  }
  // 저장본은 메뉴를 그릴 때마다 새로 읽는다 (게임 중 자동 저장된 최신 상태)
  const saved = loadProgress('bm2-sandbox', null);
  const savedCount = Object.keys(saved?.devices ?? {}).length;
  const startNew = (k) => setSetup({ spec: makeSpec(venue, k), key: Date.now() });
  // 장비가 있는 저장본은 새 세트로 덮어쓰기 전에 한 번 묻는다
  const pick = (k) => (savedCount ? setAskNew(k) : startNew(k));
  const sets = venue === 'sandbox' ? Object.entries(TEMPLATES) : [['empty', TEMPLATES.empty]];
  return (
    <div className="min-h-[100dvh] bg-[#0b1220] text-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950/90">
        <button type="button" onClick={onExit} className="px-2 py-1 rounded hover:bg-slate-800 text-sm">← 메인 메뉴</button>
        <div className="font-black">스튜디오 모드</div>
        <FeedbackButton className="ml-auto" />
      </header>
      <main className="max-w-3xl mx-auto p-4 space-y-5">
        <p className="text-sm text-slate-300 leading-relaxed">정답이 없는 자유 모드입니다. 장비 개수 제한 없이 마이크·카메라·조명을 원하는 만큼 꺼내 <b>바닥·책상·무대 어디든</b> 클릭해 놓고, 케이블도 무제한으로 연결하세요. 도전 과제는 원할 때만 참고하면 됩니다.</p>
        {saved && (
          <button type="button" onClick={() => { setAskNew(null); setSetup({ spec: { ...makeSpec(saved.venue, 'empty') }, restore: saved, key: Date.now() }); }}
            className="w-full rounded-xl border border-sky-500/60 bg-sky-950/40 p-3 text-left hover:bg-sky-900/40 flex items-center gap-2">
            <Save size={18} className="text-sky-300" /> <span className="font-bold">이어서 하기</span> <span className="text-xs text-slate-400">— 저장된 {VENUES[saved.venue]?.name} · 장비 {Object.keys(saved.devices ?? {}).length}개</span>
          </button>
        )}
        <div>
          <div className="text-xs font-bold text-slate-400 mb-2">1. 장소 고르기</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['sandbox', 'seminar', 'youtube_room', 'church', 'live_stage', 'lecture_hall'].map((v) => (
              <button key={v} type="button" onClick={() => { setVenue(v); setAskNew(null); }} aria-pressed={venue === v}
                className={`rounded-lg border p-3 text-left ${venue === v ? 'border-amber-400 bg-amber-950/40' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
                <div className="font-bold text-sm">{VENUES[v].name}</div>
                <div className="text-[11px] text-slate-400">{v === 'sandbox' ? '넓은 무대 + 방송 책상' : '스토리 모드 장소에서 자유 설치'}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-400 mb-2">2. 시작 세트</div>
          <div className="flex flex-wrap gap-2">
            {sets.map(([k, t]) => (
              <button key={k} type="button" onClick={() => pick(k)} aria-pressed={askNew === k}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm">{t.name}로 시작</button>
            ))}
          </div>
          {venue !== 'sandbox' && <p className="text-[11px] text-slate-500 mt-1">스토리 장소에서는 빈 무대로 시작합니다 (PA·방송 세트는 자유 스튜디오 전용).</p>}
          {askNew && (
            <div role="alertdialog" aria-label="새로 시작 확인" className="mt-3 rounded-xl border border-red-400/60 bg-red-950/40 p-3 space-y-2">
              <p className="text-sm text-red-100">저장된 스튜디오(장비 {savedCount}개)가 지워지고 <b>{TEMPLATES[askNew].name}</b>로 새로 시작합니다. 계속할까요?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setAskNew(null); startNew(askNew); }} className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-bold">지우고 새로 시작</button>
                <button type="button" onClick={() => setAskNew(null)} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-sm">취소</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// 자유 모드 감시: 어느 탭을 보고 있든 자동 저장 + 도전 과제 판정 (GameScreen이 항상 호출)
const snapshotOf = (st) => ({ venue: st.venue, devices: st.devices, dev: st.dev, connections: st.connections, channels: st.channels, master: st.master, mixers: st.mixers ?? {}, atem: st.atem, atems: st.atems ?? {}, obs: st.obs });
export function useSandboxWatch(game) {
  const { st, nominal } = game;
  const [done, setDone] = useState(() => new Set(loadProgress('bm2-sandbox-ach', [])));
  const latest = useRef(st);
  latest.current = st;
  useEffect(() => {
    const t = setTimeout(() => saveProgress('bm2-sandbox', snapshotOf(st)), 600);
    return () => clearTimeout(t);
  }, [st]);
  // 화면을 나갈 때 마지막 상태를 바로 저장
  useEffect(() => () => saveProgress('bm2-sandbox', snapshotOf(latest.current)), []);
  useEffect(() => {
    const now = CHALLENGES.filter((c) => c.test(st, nominal)).map((c) => c.id).filter((id) => !done.has(id));
    if (now.length) { const n = new Set([...done, ...now]); setDone(n); saveProgress('bm2-sandbox-ach', [...n]); game.notify('ok', `도전 과제 달성: ${CHALLENGES.find((c) => c.id === now[0]).label}`, { soft: true }); }
  }, [nominal]); // eslint-disable-line react-hooks/exhaustive-deps
  return done;
}

// 고른 장비 옮기기·돌리기·지우기 — "장비 추가" 탭 맨 위와 "장비" 탭의 장비 화면에 같이 보인다
export function DeviceTools({ game, id, setPlacing, placing = null }) {
  const { st, apply, setSelected } = game;
  const sel = st.devices[id];
  if (!sel) return null;
  return (
    <div className="rounded-lg border border-sky-500/50 bg-slate-900 p-2 space-y-1.5">
      <div className="text-sm font-bold">{sel.name}</div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setPlacing({ type: sel.type, moveId: sel.id })} aria-pressed={placing?.moveId === sel.id} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-xs"><Move size={13} /> 이동</button>
        <button type="button" onClick={() => apply({ op: 'moveDevice', device: sel.id, rot: ((sel.rot ?? 0) + Math.PI / 4) % (Math.PI * 2) })} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-xs"><RotateCw size={13} /> 45° 회전</button>
        <button type="button" onClick={() => { apply({ op: 'removeDevice', device: sel.id }); setSelected(null); }} className="flex items-center gap-1 px-2 py-1 rounded bg-red-800 text-xs"><Trash2 size={13} /> 삭제</button>
      </div>
      {placing?.moveId === sel.id && (
        <div className="flex items-center gap-2 text-xs text-amber-100">옮길 곳을 3D 화면에서 클릭하세요.
          <button type="button" onClick={() => setPlacing(null)} className="ml-auto px-2 py-0.5 rounded bg-slate-700">취소</button>
        </div>
      )}
    </div>
  );
}

// 게임 화면의 "장비 추가" 탭
export function SandboxPanel({ game, placing, setPlacing }) {
  const { st, selected } = game;
  const done = new Set(loadProgress('bm2-sandbox-ach', []));
  const sel = selected ? st.devices[selected] : null;
  return (
    <div className="space-y-3">
      <button type="button" onClick={game.undo} disabled={!game.undoCount} title="장비 놓기·옮기기·지우기, 케이블 꽂기·뽑기를 하나씩 되돌립니다 (Ctrl+Z)"
        className="flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40"><Undo2 size={13} /> 되돌리기{game.undoCount ? ` (${game.undoCount})` : ''}</button>
      {placing && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-950/40 p-2 text-sm text-amber-100 flex items-center gap-2">
          {placing.moveId ? '옮길 곳' : `${DEVICE_TYPES[placing.type].name} 놓을 곳`}을 3D 화면에서 클릭하세요 (바닥·책상·무대).
          <button type="button" onClick={() => setPlacing(null)} className="ml-auto px-2 py-0.5 rounded bg-slate-700 text-xs">취소</button>
        </div>
      )}
      {sel && <DeviceTools game={game} id={sel.id} setPlacing={setPlacing} />}
      <div className="text-[11px] text-slate-400">장비를 고른 뒤 3D 화면에서 놓을 곳을 클릭하세요. 개수 제한이 없습니다.</div>
      {CATALOG.map(([group, types]) => (
        <div key={group}>
          <div className="text-[11px] font-bold text-slate-400 mb-1">{group}</div>
          <div className="grid grid-cols-2 gap-1">
            {types.map((t) => {
              const def = DEVICE_TYPES[t];
              const Icon = def.icon;
              const n = Object.values(st.devices).filter((d) => d.type === t).length;
              return (
                <button key={t} type="button" onClick={() => setPlacing({ type: t })} aria-pressed={placing?.type === t && !placing?.moveId}
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs ${placing?.type === t && !placing?.moveId ? 'border-amber-400 bg-amber-950/40' : 'border-slate-700 bg-slate-900 hover:bg-slate-800'}`}>
                  {Icon && <Icon size={14} className="text-sky-300 shrink-0" />}
                  <span className="truncate flex-1">{def.name}</span>
                  {n > 0 && <span className="text-[10px] text-slate-400">×{n}</span>}
                  <Plus size={12} className="text-slate-500" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 space-y-1">
        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1"><Trophy size={13} /> 도전 과제 (선택) {done.size}/{CHALLENGES.length}</div>
        {CHALLENGES.map((c) => (
          <details key={c.id} className={`group text-xs ${done.has(c.id) ? 'text-green-300' : 'text-slate-300'}`}>
            <summary className="flex cursor-pointer list-none items-start gap-1.5 [&::-webkit-details-marker]:hidden">
              {done.has(c.id) ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <Circle size={14} className="mt-0.5 shrink-0 text-slate-600" />}
              <span className="flex-1">{c.label}</span>
              <span className="shrink-0 text-[10px] text-sky-300 group-open:hidden">방법</span>
            </summary>
            <p className="ml-5 mt-0.5 mb-1 rounded bg-slate-800/80 px-2 py-1 text-[11px] leading-relaxed text-slate-300">{c.how}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

