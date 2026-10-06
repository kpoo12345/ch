/* =====================================================================
 * 조작(op) — 플레이어·튜토리얼·정답 자동 진행이 모두 같은 형식으로 상태를 바꾼다.
 * applyOp(st, op)는 새 상태를 돌려준다 (원본은 건드리지 않음).
 *
 *  { op:'place', device }                       장비 배치
 *  { op:'connect', from:'d.p', to:'d.p', cable } 케이블 연결 (가방에서 케이블 1개 사용)
 *  { op:'disconnect', from:'d.p', to:'d.p' }     케이블 분리 (가방으로 돌아감)
 *  { op:'ch', ch, key, value }                   믹서 채널 (gain, fader, mute, eqMid …)
 *  { op:'master', key, value }                   믹서 마스터 (mainFader, mainMute, usbOut …)
 *  { op:'dev', device, key:'a.b.c', value }      장비 설정 (경로로 지정)
 *  { op:'atem', key:'program'|'preview'|'cut'|'auto'|'streaming'|'recording'|'pip', value }
 *  { op:'obs', key:'video'|'audio'|'muted'|'streaming', value }
 *  { op:'lightRecord', device, index, label }    조명 프로그래머 → 플레이백 저장
 *  { op:'patchAdd', device, entry }              조명 패치 추가
 *  { op:'patchRemove', device, n }               조명 패치 삭제
 *  { op:'ptz', device, act:'select'|'aim'|'store'|'recall', value, pan, tilt, zoom }
 *  { op:'fade', ch?, to, ms }                   페이더를 ms 동안 천천히 (ch가 없으면 메인)
 *  { op:'talk', on } · { op:'perform', on } · { op:'wait', ms }   (화면 쪽에서 처리)
 * ===================================================================== */
import { canConnect, computeSim, connId, mixerStateOf, newMixerState, ATEM_DEFAULT, DEV_DEFAULTS, FOOTPRINT } from './sim.js';
import { DEVICE_TYPES } from './engine.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const parseEnd = (s) => { const [d, p] = String(s).split('.'); return { d, p: p ?? null }; };

export function setPath(obj, path, value) {
  const keys = String(path).split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const k = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  const last = /^\d+$/.test(keys[keys.length - 1]) ? Number(keys[keys.length - 1]) : keys[keys.length - 1];
  o[last] = value;
}
export function getPath(obj, path) {
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
}

// 연결 검사 결과를 그대로 돌려주기 위해 별도로 노출
export function tryConnect(st, a, b, cable) {
  if (!st.unlimited && !(st.cables[cable] > 0)) return { ok: false, reason: `${cable.toUpperCase()} 케이블이 남아 있지 않습니다.` };
  return canConnect(st, a, b, cable);
}

export function applyOp(stIn, op) {
  const st = clone(stIn);
  switch (op.op) {
    case 'place':
      if (st.devices[op.device]) st.devices[op.device].placed = true;
      if (op.slot && st.devices[op.device]) st.devices[op.device].slot = op.slot;
      if (op.pos && st.devices[op.device]) { st.devices[op.device].pos = op.pos; st.devices[op.device].rot = op.rot ?? 0; st.devices[op.device].surface = op.surface ?? 'floor'; }
      return st;
    case 'connect': {
      const a = parseEnd(op.from), b = parseEnd(op.to);
      const r = tryConnect(st, a, b, op.cable);
      if (!r.ok) { st.lastError = r; return st; }
      st.connections.push({ id: connId(r.from, r.to), from: r.from, to: r.to, cable: op.cable });
      if (!st.unlimited) st.cables[op.cable] -= 1;
      st.lastError = null;
      return st;
    }
    case 'disconnect': {
      const a = parseEnd(op.from), b = parseEnd(op.to);
      const i = st.connections.findIndex((c) => (c.from.d === a.d && c.from.p === a.p && c.to.d === b.d && c.to.p === b.p) || (c.from.d === b.d && c.from.p === b.p && c.to.d === a.d && c.to.p === a.p) || c.id === op.id);
      if (i >= 0) {
        const [c] = st.connections.splice(i, 1);
        if (!st.unlimited) st.cables[c.cable] = (st.cables[c.cable] ?? 0) + 1;
      }
      return st;
    }
    // 믹서 조작: op.mixer가 있으면 그 믹서(두 번째 믹서 등), 없으면 첫 믹서
    case 'ch': { const S = mixerStateOf(st, op.mixer); if (S.channels[op.ch - 1]) S.channels[op.ch - 1][op.key] = op.value; return st; }
    // 페이드: 최종 값만 반영 (천천히 움직이는 과정은 화면 쪽에서 보여 준다)
    case 'fade': { const S = mixerStateOf(st, op.mixer); if (op.ch) { if (S.channels[op.ch - 1]) S.channels[op.ch - 1].fader = op.to; } else S.master.mainFader = op.to; return st; }
    case 'master': mixerStateOf(st, op.mixer).master[op.key] = op.value; return st;
    case 'dev': if (st.dev[op.device]) setPath(st.dev[op.device], op.key, op.value); return st;
    case 'atem': {
      // op.switcher가 있으면 그 스위처(두 번째 ATEM 등), 없으면 첫 스위처
      const a = op.switcher && op.switcher !== st.switcherId ? (st.atems ??= {})[op.switcher] ??= { ...ATEM_DEFAULT } : st.atem;
      if (op.key === 'cut' || op.key === 'auto') { const p = a.program; a.program = a.preview; a.preview = p; a.transitioning = op.key === 'auto'; }
      else a[op.key] = op.value;
      return st;
    }
    case 'obs': st.obs[op.key] = op.value; return st;
    case 'lightRecord': {
      const cs = st.dev[op.device];
      if (!cs) return st;
      const pr = cs.programmer;
      const cue = { fixtures: [...(pr.sel ?? [])], intensity: pr.intensity ?? 100, color: pr.color ?? '#ffffff', pan: pr.pan ?? 0, tilt: pr.tilt ?? 0 };
      const i = op.index - 1;
      while (cs.playbacks.length <= i) cs.playbacks.push({ label: `PB ${cs.playbacks.length + 1}`, level: 0, cue: { fixtures: [] } });
      cs.playbacks[i] = { label: op.label ?? cs.playbacks[i].label, level: cs.playbacks[i].level ?? 0, cue };
      // 저장 후 프로그래머 비우기 (실제 콘솔의 CLEAR)
      cs.programmer = { sel: [], intensity: null, color: null, pan: null, tilt: null };
      return st;
    }
    case 'patchAdd': {
      const cs = st.dev[op.device];
      if (!cs) return st;
      const n = op.entry.n ?? (cs.patch.reduce((m, e) => Math.max(m, e.n), 0) + 1);
      cs.patch = cs.patch.filter((e) => e.n !== n).concat([{ ...op.entry, n }]).sort((x, y) => x.n - y.n);
      return st;
    }
    case 'patchRemove': dropPatch(st.dev[op.device], (e) => e.n === op.n); return st;
    case 'ptz': {
      const cs = st.dev[op.device];
      if (!cs) return st;
      if (op.act === 'select') { cs.selected = op.value; return st; }
      const sim = computeSim(st);
      const target = Object.entries(sim.ptz).find(([, r]) => r.reachable && r.index === cs.selected + 1)?.[0];
      if (!target) { st.lastError = { reason: '선택한 번호의 PTZ 카메라와 통신할 수 없습니다 (네트워크·IP 확인).' }; return st; }
      const cam = st.dev[target];
      if (op.act === 'aim') { if (op.pan != null) cam.pan = op.pan; if (op.tilt != null) cam.tilt = op.tilt; if (op.zoom != null) cam.zoom = op.zoom; }
      if (op.act === 'store') cam.presets = { ...(cam.presets ?? {}), [op.value]: { pan: cam.pan, tilt: cam.tilt, zoom: cam.zoom } };
      if (op.act === 'recall') { const p = cam.presets?.[op.value]; if (p) Object.assign(cam, p); }
      st.lastError = null;
      return st;
    }
    case 'addDevice': {
      // 자유 모드: 새 장비 추가
      st.devices[op.device.id] = { placed: true, ...op.device };
      st.dev[op.device.id] = op.state ?? {};
      if (op.device.type === 'analog_mixer' || op.device.type === 'digital_mixer') {
        if (!st.mixerId) st.mixerId = op.device.id;
        else st.mixers = { ...(st.mixers ?? {}), [op.device.id]: newMixerState() }; // 두 번째 믹서부터는 따로 상태를 갖는다
      }
      if (op.device.type === 'atem' || op.device.type === 'atem_pro') {
        if (!st.switcherId) st.switcherId = op.device.id;
        else st.atems = { ...(st.atems ?? {}), [op.device.id]: { ...ATEM_DEFAULT } }; // 두 번째 스위처부터는 따로 상태를 갖는다
      }
      // 조명: 콘솔 패치에 자동 등록 (콘솔을 나중에 놓으면 이미 있는 조명을 한꺼번에)
      const con = lightConsoleOf(st);
      if (con && FIXTURES.has(op.device.type)) autoPatch(st, con, op.device.id, false);
      if (con && con === op.device.id) Object.values(st.devices).filter((d) => d.placed && FIXTURES.has(d.type)).forEach((d) => autoPatch(st, con, d.id, true));
      // PTZ: 같은 대역 카메라 IP를 조이스틱 목록에 자동 등록
      if (op.device.type === 'ptz' || op.device.type === 'ptz_controller') {
        Object.values(st.devices).filter((d) => d.type === 'ptz_controller').forEach((d) => { if (st.dev[d.id]?.cams) st.dev[d.id].cams = discoverCams(st, d.id); });
      }
      return st;
    }
    case 'removeDevice': {
      const id = op.device;
      st.connections = st.connections.filter((c) => c.from.d !== id && c.to.d !== id);
      // 조명을 치우면 자동 패치 항목도 지운다
      if (FIXTURES.has(st.devices[id]?.type)) Object.values(st.devices).filter((d) => d.type === 'lighting_console').forEach((d) => dropPatch(st.dev[d.id], (e) => e.fixture === id));
      delete st.devices[id]; delete st.dev[id];
      if (st.mixers?.[id]) delete st.mixers[id];
      if (st.mixerId === id) {
        st.mixerId = Object.values(st.devices).find((d) => d.type === 'analog_mixer' || d.type === 'digital_mixer')?.id ?? null;
        // 남은 믹서가 첫 믹서가 되면 그 믹서의 설정을 그대로 가져온다
        if (st.mixerId && st.mixers?.[st.mixerId]) { st.channels = st.mixers[st.mixerId].channels; st.master = st.mixers[st.mixerId].master; delete st.mixers[st.mixerId]; }
      }
      if (st.atems?.[id]) delete st.atems[id];
      if (st.switcherId === id) {
        st.switcherId = Object.values(st.devices).find((d) => d.type === 'atem' || d.type === 'atem_pro')?.id ?? null;
        if (st.switcherId && st.atems?.[st.switcherId]) { st.atem = st.atems[st.switcherId]; delete st.atems[st.switcherId]; }
      }
      return st;
    }
    case 'move': {
      // 다른 자리로 옮기기 (그 자리가 비어 있을 때만)
      const d = st.devices[op.device];
      if (d && !Object.values(st.devices).some((x) => x.id !== op.device && x.slot === op.slot)) d.slot = op.slot;
      return st;
    }
    case 'moveDevice': {
      const d = st.devices[op.device];
      if (d) { if (op.pos) d.pos = op.pos; if (op.rot != null) d.rot = op.rot; if (op.surface) d.surface = op.surface; }
      return st;
    }
    default: return st;
  }
}

// 조작 → 3D "유령 손" 동작
export function opToAction(st, op, key) {
  const mixer = st.mixerId, sw = st.switcherId;
  const pc = Object.values(st.devices).find((d) => d.type === 'pc')?.id;
  switch (op.op) {
    case 'place': return { key, device: op.device, ctl: { kind: 'place' } };
    case 'move': return { key, device: op.device, ctl: { kind: 'place' } };
    case 'addDevice': return { key, device: op.device.id, ctl: { kind: 'place' } };
    case 'moveDevice': return { key, device: op.device, ctl: { kind: 'place' } };
    case 'connect': return { key, device: parseEnd(op.from).d, ctl: { kind: 'cable', from: parseEnd(op.from), to: parseEnd(op.to) } };
    case 'disconnect': return { key, device: parseEnd(op.from).d, ctl: { kind: 'press' } };
    case 'ch': return { key, device: op.mixer ?? mixer, ctl: { kind: 'mixer', key: op.key, ch: op.ch, value: op.value, prev: mixerStateOf(st, op.mixer).channels[op.ch - 1]?.[op.key], needSelect: true } };
    case 'master': return { key, device: op.mixer ?? mixer, ctl: { kind: 'master', key: op.key, value: op.value, prev: mixerStateOf(st, op.mixer).master[op.key] } };
    case 'dev': {
      const t = st.devices[op.device]?.type;
      if (t === 'lighting_console') return { key, device: op.device, ctl: { kind: 'light', key: op.key, value: op.value } };
      if (t === 'media_server') return { key, device: op.device, ctl: { kind: 'press', key: op.key } };
      const m = /^in\.(\d)\./.exec(op.key);
      return { key, device: op.device, ctl: { kind: typeof op.value === 'number' ? 'turn' : 'press', key: op.key.split('.').pop(), input: m ? Number(m[1]) + 1 : null, value: op.value } };
    }
    case 'atem': return { key, device: op.switcher ?? sw, ctl: { kind: 'press', key: op.key, value: op.value } };
    case 'obs': return { key, device: pc, ctl: { kind: 'press', key: op.key } };
    case 'lightRecord': return { key, device: op.device, ctl: { kind: 'light', key: 'record', value: op.index } };
    case 'patchAdd': return { key, device: op.device, ctl: { kind: 'light', key: 'patch' } };
    case 'patchRemove': return { key, device: op.device, ctl: { kind: 'light', key: 'patch' } };
    case 'ptz': return { key, device: op.device, ctl: { kind: 'joystick', act: op.act, value: op.value } };
    default: return null;
  }
}

// 정답/튜토리얼 실행기: 한 단계씩 적용하며 "말하기 테스트" 같은 순간 목표를 기록
export function runOps(st0, ops, { onStep } = {}) {
  let st = st0;
  let talking = false, performing = null;
  const latched = new Set();
  ops.forEach((op, i) => {
    if (op.op === 'talk') talking = op.on;
    else if (op.op === 'perform') performing = op.on;
    else if (op.op !== 'wait' && op.op !== 'say') {
      noteOnAirMove(st, op, latched);
      notePop(st, op, latched);
      if (op.op === 'fade' && (op.ms ?? 3000) >= 1500) {
        const k = op.ch ? `ch${op.ch}` : 'main';
        const from = op.ch ? st.channels[op.ch - 1]?.fader : st.master.mainFader;
        if (from >= 35 && op.to <= 3) { latched.add(`fadeOut:${k}`); latched.delete(`cutOut:${k}`); }
        if (from <= 3 && op.to >= 50) latched.add(`fadeIn:${k}`);
      }
      st = applyOp(st, op);
    }
    onStep?.(st, op, i, { talking, latched });
    latchTalk(st, talking, latched, performing);
  });
  return { st, latched, talking, performing };
}

// 켜진 스피커로 가는 길에 케이블을 꽂고 빼거나 +48V를 바꾸면 "퍽" (팝 노이즈) — 스피커 전원은 마지막에 켠다
export function notePop(st, op, latched) {
  if (op.op === 'dev' && op.key === 'power' && op.value === false) { latched.delete(`pop:${op.device}`); return null; }
  const isCable = op.op === 'connect' || op.op === 'disconnect';
  if (!isCable && !((op.op === 'ch' || op.op === 'master') && op.key === 'phantom')) return null;
  const powered = Object.values(st.devices).filter((d) => d.placed && (d.type === 'speaker' || d.type === 'monitor') && st.dev[d.id]?.power);
  if (!powered.length) return null;
  const ends = isCable ? [String(op.from).split('.')[0], String(op.to).split('.')[0]] : [op.mixer ?? st.mixerId];
  const hit = powered.filter((spk) => {
    // 스피커에서 거꾸로 따라가며 신호 경로에 있는 장비들
    const chain = new Set([spk.id]);
    let cur = spk.id;
    for (let k = 0; k < 5; k += 1) {
      const c = st.connections.find((x) => x.to.d === cur);
      if (!c || chain.has(c.from.d)) break;
      chain.add(c.from.d); cur = c.from.d;
    }
    return ends.some((e) => chain.has(e));
  }).map((d) => d.id);
  hit.forEach((id) => latched.add(`pop:${id}`));
  return hit.length ? hit : null;
}

// 방송 중(PGM)인 PTZ 카메라를 움직이면 기록 (방송 사고!)
export function noteOnAirMove(st, op, latched) {
  if (op.op !== 'ptz' || !(op.act === 'aim' || op.act === 'recall')) return null;
  const cs = st.dev[op.device];
  if (!cs) return null;
  const sim = computeSim(st);
  const target = Object.entries(sim.ptz).find(([, r]) => r.reachable && r.index === cs.selected + 1)?.[0];
  if (target && sim.video.tally?.[target] === 'pgm') { latched.add(`onAirMove:${target}`); return target; }
  return null;
}

export function latchTalk(st, talking, latched, performing) {
  if (!talking) return;
  const sim = computeSim(st, { talking: true, performing: performing ?? true });
  if (sim.feedback) return;
  const voices = Object.values(st.devices).filter((d) => d.placed && ['dynamic_mic', 'condenser_mic', 'wireless_mic'].includes(d.type)).map((d) => d.id);
  ['main', 'monitor', 'stream', 'headphones'].forEach((at) => { if (voices.some((v) => sim.reaches(v, at))) latched.add(`talk:${at}`); });
}

// 자유 모드: 새 장비 추가 op 만들기 (무대 쪽을 봐야 하는 장비는 뒤로 돌려 놓는다)
const FACE_STAGE = new Set(['camera', 'mirrorless', 'ptz', 'par_led', 'moving_head', 'projector']);
export function addDeviceOp(st, type, pos, surface) {
  let n = 1;
  while (st.devices[`${type}_${n}`]) n += 1;
  const id = `${type}_${n}`;
  const same = Object.values(st.devices).filter((d) => d.type === type).length + 1;
  const state = DEV_DEFAULTS[type]?.() ?? {};
  if (type === 'ptz') state.ip = nextPtzIp(st);
  return {
    op: 'addDevice',
    device: { id, type, name: `${DEVICE_TYPES[type].name} ${same}`, pos, rot: FACE_STAGE.has(type) ? Math.PI : 0, surface, placed: true },
    state,
  };
}

/* ---------------------------- 조명 패치 도우미 ---------------------------- */
const FIXTURES = new Set(['par_led', 'moving_head']);
const fpOf = (type) => FOOTPRINT[type] ?? 8;
// 조명 계산이 쓰는 콘솔 = 처음 놓인 조명 콘솔
const lightConsoleOf = (st) => Object.values(st.devices).find((d) => d.placed && d.type === 'lighting_console')?.id ?? null;
// 패치에서 다음 빈 시작 주소 (가장 뒤 항목의 주소 + 채널 수, 비어 있으면 1)
export const nextDmxAddress = (patch = []) => patch.reduce((m, e) => Math.max(m, e.address + fpOf(e.type)), 1);
export const patchOverlap = (patch = [], type, address) => patch.find((e) => address < e.address + fpOf(e.type) && e.address < address + fpOf(type)) ?? null;
// 조명 1대를 콘솔 패치에 등록: 새 조명은 다음 빈 주소로, 이미 있던 조명(keep)은 주소가 비어 있으면 그대로
function autoPatch(st, conId, fid, keep) {
  const cs = st.dev[conId], f = st.dev[fid], type = st.devices[fid]?.type;
  if (!cs || !f || !FIXTURES.has(type)) return;
  cs.patch = cs.patch ?? [];
  if (cs.patch.some((e) => e.fixture === fid)) return;
  const address = keep && f.address >= 1 && f.address + fpOf(type) - 1 <= 512 && !patchOverlap(cs.patch, type, f.address) ? f.address : nextDmxAddress(cs.patch);
  if (address + fpOf(type) - 1 > 512) return; // 유니버스(512채널)가 꽉 참
  f.address = address;
  const n = cs.patch.reduce((m, e) => Math.max(m, e.n), 0) + 1;
  cs.patch.push({ n, type, address, label: st.devices[fid].name ?? DEVICE_TYPES[type].name, fixture: fid });
}
// 패치 항목 지우기: 프로그래머 선택·플레이백 큐에서도 빠진다
function dropPatch(cs, pick) {
  if (!cs?.patch) return;
  const gone = cs.patch.filter(pick).map((e) => e.n);
  if (!gone.length) return;
  cs.patch = cs.patch.filter((e) => !gone.includes(e.n));
  if (cs.programmer?.sel) cs.programmer.sel = cs.programmer.sel.filter((n) => !gone.includes(n));
  (cs.playbacks ?? []).forEach((pb) => { if (pb.cue?.fixtures) pb.cue.fixtures = pb.cue.fixtures.filter((n) => !gone.includes(n)); });
}

/* ---------------------------- PTZ IP 도우미 ---------------------------- */
const netOf = (ip) => String(ip).split('.').slice(0, 3).join('.');
// 새 PTZ 카메라 IP: 조이스틱 목록에서 아직 안 쓰는 것 → 없으면 192.168.1.21부터 빈 번호
export function nextPtzIp(st) {
  const used = new Set(Object.values(st.devices).filter((d) => d.type === 'ptz' || d.type === 'ptz_controller').map((d) => st.dev[d.id]?.ip));
  const ctrl = Object.values(st.devices).find((d) => d.placed && d.type === 'ptz_controller');
  const free = (st.dev[ctrl?.id]?.cams ?? []).find((ip) => !used.has(ip));
  if (free) return free;
  for (let k = 21; k < 255; k += 1) if (!used.has(`192.168.1.${k}`)) return `192.168.1.${k}`;
  return '192.168.1.21';
}
// 조이스틱 카메라 목록 + 같은 대역인데 목록에 없는 PTZ IP (네트워크에서 찾기)
export function discoverCams(st, ctrlId) {
  const cs = st.dev[ctrlId];
  const cams = [...(cs?.cams ?? [])];
  Object.values(st.devices).filter((d) => d.placed && d.type === 'ptz').forEach((d) => {
    const ip = st.dev[d.id]?.ip;
    if (ip && netOf(ip) === netOf(cs?.ip) && ip !== cs?.ip && !cams.includes(ip)) cams.push(ip);
  });
  return cams;
}
