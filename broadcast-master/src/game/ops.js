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
 *  { op:'ptz', device, act:'select'|'aim'|'store'|'recall', value, pan, tilt, zoom }
 *  { op:'talk', on } · { op:'perform', on } · { op:'wait', ms }   (화면 쪽에서 처리)
 * ===================================================================== */
import { canConnect, computeSim, connId } from './sim.js';

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
    case 'ch': if (st.channels[op.ch - 1]) st.channels[op.ch - 1][op.key] = op.value; return st;
    case 'master': st.master[op.key] = op.value; return st;
    case 'dev': if (st.dev[op.device]) setPath(st.dev[op.device], op.key, op.value); return st;
    case 'atem': {
      const a = st.atem;
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
      if (!st.mixerId && (op.device.type === 'analog_mixer' || op.device.type === 'digital_mixer')) st.mixerId = op.device.id;
      if (!st.switcherId && (op.device.type === 'atem' || op.device.type === 'atem_pro')) st.switcherId = op.device.id;
      return st;
    }
    case 'removeDevice': {
      const id = op.device;
      st.connections = st.connections.filter((c) => c.from.d !== id && c.to.d !== id);
      delete st.devices[id]; delete st.dev[id];
      if (st.mixerId === id) st.mixerId = Object.values(st.devices).find((d) => d.type === 'analog_mixer' || d.type === 'digital_mixer')?.id ?? null;
      if (st.switcherId === id) st.switcherId = Object.values(st.devices).find((d) => d.type === 'atem' || d.type === 'atem_pro')?.id ?? null;
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
    case 'connect': return { key, device: parseEnd(op.from).d, ctl: { kind: 'cable', from: parseEnd(op.from), to: parseEnd(op.to) } };
    case 'disconnect': return { key, device: parseEnd(op.from).d, ctl: { kind: 'press' } };
    case 'ch': return { key, device: mixer, ctl: { kind: 'mixer', key: op.key, ch: op.ch, value: op.value, prev: st.channels[op.ch - 1]?.[op.key], needSelect: true } };
    case 'master': return { key, device: mixer, ctl: { kind: 'master', key: op.key, value: op.value, prev: st.master[op.key] } };
    case 'dev': {
      const t = st.devices[op.device]?.type;
      if (t === 'lighting_console') return { key, device: op.device, ctl: { kind: 'light', key: op.key, value: op.value } };
      if (t === 'media_server') return { key, device: op.device, ctl: { kind: 'press', key: op.key } };
      const m = /^in\.(\d)\./.exec(op.key);
      return { key, device: op.device, ctl: { kind: typeof op.value === 'number' ? 'turn' : 'press', key: op.key.split('.').pop(), input: m ? Number(m[1]) + 1 : null, value: op.value } };
    }
    case 'atem': return { key, device: sw, ctl: { kind: 'press', key: op.key, value: op.value } };
    case 'obs': return { key, device: pc, ctl: { kind: 'press', key: op.key } };
    case 'lightRecord': return { key, device: op.device, ctl: { kind: 'light', key: 'record', value: op.index } };
    case 'patchAdd': return { key, device: op.device, ctl: { kind: 'light', key: 'patch' } };
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
    else if (op.op !== 'wait' && op.op !== 'say') st = applyOp(st, op);
    onStep?.(st, op, i, { talking, latched });
    latchTalk(st, talking, latched, performing);
  });
  return { st, latched, talking, performing };
}

export function latchTalk(st, talking, latched, performing) {
  if (!talking) return;
  const sim = computeSim(st, { talking: true, performing: performing ?? true });
  if (sim.feedback) return;
  const voices = Object.values(st.devices).filter((d) => d.placed && ['dynamic_mic', 'condenser_mic', 'wireless_mic'].includes(d.type)).map((d) => d.id);
  ['main', 'monitor', 'stream', 'headphones'].forEach((at) => { if (voices.some((v) => sim.reaches(v, at))) latched.add(`talk:${at}`); });
}
