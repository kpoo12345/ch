/* =====================================================================
 * 방송장비 마스터 — 신호 시뮬레이션 엔진 v2
 *
 * 여러 장비·여러 채널을 다루는 일반화된 엔진. 모든 소리 소스(마이크, 무선 마이크,
 * 악기, 노트북)를 케이블을 따라 추적해 믹서 채널 → 메인/AUX/USB 버스 → 스피커·
 * 모니터·헤드폰·송출까지 "어디에 어떤 크기로 도착하는지"를 계산한다.
 *
 *  - 레벨 단위는 dBu에 가까운 상대값. 말소리 마이크 = -45, 기타 = -20, 키보드/노트북 = -8
 *  - 출력 위치에서 -40 이하는 들리지 않는 것으로 본다 (AUDIBLE)
 *  - 채널 입력 -20 ~ -6 이 적정, 0 초과는 클리핑
 * ===================================================================== */
import { DEVICE_TYPES, PORT_ACCEPTS, faderDb } from './engine.js';

export const AUDIBLE = -40;
export const CHANNELS = 8;
const VOICE_TYPES = new Set(['dynamic_mic', 'condenser_mic', 'wireless_mic']);
const CAMERA_TYPES = new Set(['camera', 'mirrorless', 'ptz']);
const VIDEO_SOURCES = new Set(['camera', 'mirrorless', 'ptz', 'media_server']);
const FIXTURE_TYPES = new Set(['par_led', 'moving_head']);
export const FOOTPRINT = { par_led: 8, moving_head: 16 };
const SWITCHER_TYPES = new Set(['atem', 'atem_pro']);
const MIXER_TYPES = new Set(['analog_mixer', 'digital_mixer']);
const UNBALANCED = new Set(['trs', 'mini']);

/* ---------------------------- 장소(구역) ---------------------------- */
// 무대(stage)와 음향 부스(foh) 사이는 먼 거리 → 언밸런스드 케이블이면 험 잡음
export const VENUE_ZONES = {
  church: {
    stage: ['pulpit_mic', 'worship_mic_rx_stage', 'choir_mic', 'keys', 'di_keys', 'wedge_pulpit', 'wedge_band', 'pa_left', 'pa_right'],
    foh: ['foh1', 'foh2', 'foh3', 'foh4', 'cam_rear', 'ptz_side', 'router_foh'],
  },
  live_stage: {
    stage: ['vocal_mic', 'gtr', 'keys', 'di_gtr', 'di_keys', 'wedge_vocal', 'wedge_keys', 'pa_left', 'pa_right', 'cam_stage'],
    foh: ['foh1', 'foh2', 'foh3', 'laptop_foh'],
  },
};
export const zoneOf = (venue, slot) => {
  const z = VENUE_ZONES[venue];
  if (!z) return 'room';
  if (z.stage.includes(slot)) return 'stage';
  if (z.foh.includes(slot)) return 'foh';
  return 'room';
};
// 피드백 계산에서 마이크를 정면으로 향하는 스피커 자리
const FRONT_SLOTS = new Set(['pa_alt']);

/* ---------------------------- 기본값 ---------------------------- */
export const CH_DEFAULT = { gain: 30, lowCut: false, eqHigh: 0, eqMid: 0, eqLow: 0, fx: 0, aux: 0, mute: false, fader: 75, phantom: false, patch: null };
export const MASTER_DEFAULT = { mainFader: 75, mainMute: false, auxMaster: 75, fxReturn: 50, usbOut: 'main' };
export const DEV_DEFAULTS = {
  speaker: () => ({ power: true, position: 'behind' }),
  monitor: () => ({ power: true }),
  wireless_mic: () => ({ txPower: true, txChannel: 1, rxChannel: 1, battery: 90 }),
  di_box: () => ({ groundLift: false, pad: false, groundLoop: false }),
  audio_interface: () => ({ in: [{ gain: 30, phantom: false, inst: false }, { gain: 30, phantom: false, inst: false }], direct: true, monitor: 60 }),
  mirrorless: () => ({ clean: true }),
  laptop: () => ({ playing: true }),
  ptz: () => ({ pan: 0, tilt: 0, zoom: 0.3, ip: '192.168.1.21', presets: {} }),
  lighting_console: () => ({ gm: 100, blackout: false, patch: [], playbacks: [], programmer: { sel: [], intensity: null, color: null, pan: null, tilt: null } }),
  par_led: () => ({ address: 1, power: true, terminated: false }),
  moving_head: () => ({ address: 1, power: true, terminated: false }),
  media_server: () => ({ layers: [{ clip: null, opacity: 100 }, { clip: null, opacity: 100 }, { clip: null, opacity: 100 }], master: 100, out1: 'comp', out2: 'comp', playing: true, compRes: '1920x1080' }),
  projector: () => ({ power: true }),
  led_wall: () => ({ power: true, res: '1920x1080' }),
  ptz_controller: () => ({ ip: '192.168.1.10', cams: ['192.168.1.21', '192.168.1.22', '192.168.1.23', '192.168.1.24'], selected: 0 }),
};
export const ATEM_DEFAULT = { program: 0, preview: 1, transitioning: false, streaming: false, recording: false, pip: false, micGain: 30 };
export const OBS_DEFAULT = { video: 'none', audio: 'none', muted: false, streaming: false };

const structuredCloneSafe = (o) => JSON.parse(JSON.stringify(o));
const parseEnd = (s) => { const [d, p] = String(s).split('.'); return { d, p: p ?? null }; };
export const connId = (from, to) => `${from.d}.${from.p}>${to.d}.${to.p}`;
export const portKind = (type, portId) => {
  const def = DEVICE_TYPES[type];
  return [...def.ins, ...def.outs].find((p) => p.id === portId)?.kind;
};
export const isOutPort = (type, portId) => DEVICE_TYPES[type].outs.some((p) => p.id === portId);

/* ---------------------------- 스테이지 빌드 ---------------------------- */
export function buildRuntime(spec) {
  const devices = {};
  (spec.devices ?? []).forEach((d) => { devices[d.id] = { ...d, placed: d.placed !== false }; });
  const mixerId = Object.values(devices).find((d) => MIXER_TYPES.has(d.type))?.id ?? null;
  const switcherId = Object.values(devices).find((d) => SWITCHER_TYPES.has(d.type))?.id ?? null;
  const dev = {};
  Object.values(devices).forEach((d) => {
    const base = DEV_DEFAULTS[d.type]?.() ?? {};
    if (d.type === 'speaker' && FRONT_SLOTS.has(d.slot)) base.position = 'front';
    dev[d.id] = { ...base, ...structuredCloneSafe(spec.state?.devices?.[d.id] ?? {}) };
    if (d.type === 'audio_interface' && spec.state?.devices?.[d.id]?.in) {
      dev[d.id].in = [0, 1].map((i) => ({ ...base.in[i], ...(spec.state.devices[d.id].in[i] ?? {}) }));
    }
  });
  const channels = Array.from({ length: CHANNELS }, (_, i) => ({ ...CH_DEFAULT, ...(spec.state?.channels?.[i + 1] ?? spec.state?.channels?.[String(i + 1)] ?? {}) }));
  const connections = (spec.connections ?? []).map((c) => {
    const from = parseEnd(c.from); const to = parseEnd(c.to);
    return { id: connId(from, to), from, to, cable: c.cable };
  });
  const st = {
    venue: spec.venue ?? 'lecture_hall',
    devices, dev, connections, mixerId, switcherId,
    cables: { ...(spec.inventory ?? {}) },
    unlimited: !!spec.unlimited, // 자유 모드: 케이블 무제한
    channels,
    master: { ...MASTER_DEFAULT, ...(spec.state?.master ?? {}) },
    atem: { ...ATEM_DEFAULT, ...(spec.state?.atem ?? {}) },
    obs: { ...OBS_DEFAULT, ...(spec.state?.obs ?? {}) },
    faults: [],
  };
  (spec.faults ?? []).forEach((f) => applyFault(st, f));
  st.faults = (spec.faults ?? []).map((f) => ({ ...f }));
  return st;
}

/* ---------------------------- 연결 검사 ---------------------------- */
export function canConnect(st, a, b, cable) {
  const da = st.devices[a.d], db = st.devices[b.d];
  if (!da || !db) return { ok: false, reason: '장비가 없습니다.' };
  if (a.d === b.d) return { ok: false, reason: '같은 장비의 단자끼리는 연결할 수 없습니다.' };
  const outA = isOutPort(da.type, a.p), outB = isOutPort(db.type, b.p);
  if (outA === outB) return { ok: false, reason: `${outA ? '출력 ↔ 출력' : '입력 ↔ 입력'}은 연결할 수 없습니다. 신호는 항상 출력(OUT) → 입력(IN)으로 흐릅니다.` };
  const [from, to] = outA ? [a, b] : [b, a];
  const used = (d, p) => st.connections.some((c) => (c.from.d === d && c.from.p === p) || (c.to.d === d && c.to.p === p));
  if (used(from.d, from.p) || used(to.d, to.p)) return { ok: false, reason: '이미 케이블이 꽂혀 있는 단자입니다. 기존 케이블을 클릭해 먼저 분리하세요.' };
  const kinds = [portKind(st.devices[from.d].type, from.p), portKind(st.devices[to.d].type, to.p)];
  const bad = kinds.find((k) => !PORT_ACCEPTS[k]?.includes(cable));
  if (bad) return { ok: false, mismatch: bad, reason: null };
  // 3.5mm 변환 케이블은 한쪽이 3.5mm 단자일 때만 의미가 있다
  if (cable === 'mini' && !kinds.includes('mini')) return { ok: false, mismatch: kinds[0], reason: '3.5mm 변환 케이블은 한쪽이 3.5mm 단자(노트북·ATEM MIC)일 때 씁니다. 이 연결에는 원래 맞는 케이블을 쓰세요.' };
  return { ok: true, from, to };
}

/* ---------------------------- 신호 계산 ---------------------------- */
const mapDb = (v) => (v <= 0 ? -Infinity : faderDb(v)); // 페이더·AUX·모니터 노브 공통 (75 = 0dB)
const maxLevel = (arr) => { const l = arr.filter((x) => x.level != null && Number.isFinite(x.level)).map((x) => x.level); return l.length ? Math.max(...l) : null; };

export function computeSim(st, { talking = true, performing = true } = {}) {
  const { devices, dev, connections } = st;
  const placed = (id) => !!devices[id]?.placed;
  const feeding = {}; // "d.p" (입력) → 연결
  const outgoing = {}; // "d.p" (출력) → 연결
  connections.forEach((c) => {
    if (!placed(c.from.d) || !placed(c.to.d)) return;
    feeding[`${c.to.d}.${c.to.p}`] = c;
    outgoing[`${c.from.d}.${c.from.p}`] = c;
  });
  const zone = (id) => zoneOf(st.venue, devices[id]?.slot);
  const memo = new Map();
  const notes = { thin: new Set(), humSources: new Set(), deadPhantom: new Set() };

  // 입력 단자에 도착하는 신호들
  const inputComps = (d, p) => {
    const c = feeding[`${d}.${p}`];
    if (!c) return [];
    const long = UNBALANCED.has(c.cable) && zone(c.from.d) !== zone(c.to.d) && zone(c.from.d) !== 'room' && zone(c.to.d) !== 'room';
    return outComps(c.from.d, c.from.p).map((x) => (long ? { ...x, hum: true } : x));
  };

  // 출력 단자에서 나가는 신호들 (소스 id, 레벨, 성질)
  const outComps = (d, p) => {
    const key = `${d}.${p}`;
    if (memo.has(key)) return memo.get(key);
    memo.set(key, []); // 순환 방지
    const t = devices[d]?.type;
    const s = dev[d] ?? {};
    let r = [];
    switch (t) {
      case 'dynamic_mic': r = [{ src: d, kind: 'voice', level: talking ? -45 : null, needsPhantom: false }]; break;
      case 'condenser_mic': r = [{ src: d, kind: 'voice', level: talking ? -42 : null, needsPhantom: true, condenser: true }]; break;
      case 'wireless_mic': {
        const ok = s.txPower && s.txChannel === s.rxChannel && s.battery > 15;
        r = [{ src: d, kind: 'voice', level: ok && talking ? -45 : null, needsPhantom: false, rfDown: !ok }];
        break;
      }
      case 'e_guitar': r = [{ src: d, kind: 'inst', level: performing ? -20 : null, hiZ: true }]; break;
      case 'keyboard': r = [{ src: d, kind: 'line', level: performing ? -8 : null }]; break;
      case 'laptop': r = [{ src: d, kind: 'line', level: s.playing ? -8 : null }]; break;
      case 'di_box': {
        const ins = inputComps(d, 'input');
        if (p === 'thru') r = ins;
        else r = ins.map((x) => ({ ...x, level: x.level == null ? null : x.level - 20 - (s.pad ? 20 : 0), hiZ: false, viaDI: true, hum: x.hum || (s.groundLoop && !s.groundLift) }));
        break;
      }
      case 'analog_mixer':
      case 'digital_mixer': {
        const m = mixerCalc();
        if (p === 'main' || p === 'phones') r = m.main;
        else if (p === 'aux1') r = m.aux;
        else if (p === 'usb') r = st.master.usbOut === 'main' ? m.main : st.master.usbOut === 'aux1' ? m.aux : [];
        break;
      }
      case 'audio_interface': {
        const ai = interfaceCalc(d);
        if (p === 'usb') r = ai.usb;
        else if (p === 'phones' || p === 'monL' || p === 'monR') r = ai.phones;
        break;
      }
      default: r = [];
    }
    memo.set(key, r);
    return r;
  };

  // 믹서: 채널 → 메인/AUX 버스
  let mixerCache = null;
  const mixerCalc = () => {
    if (mixerCache) return mixerCache;
    mixerCache = { main: [], aux: [], channels: [] };
    const mid = st.mixerId;
    if (!mid || !placed(mid)) return mixerCache;
    const digital = devices[mid].type === 'digital_mixer';
    const M = st.master;
    const main = [], aux = [], chans = [];
    // 디지털 믹서의 +48V는 "입력 단자(헤드앰프)"에 걸린다: 그 단자를 쓰는 채널 중 하나라도 켜면 전원이 들어간다
    const portOfCh = (ch, i) => (digital ? (ch.patch ?? `local${i + 1}`) : `in${i + 1}`);
    const powered = new Set(st.channels.map((ch, i) => (ch.phantom ? portOfCh(ch, i) : null)).filter(Boolean));
    st.channels.forEach((ch, i) => {
      const port = portOfCh(ch, i);
      const comps = port === 'off' ? [] : inputComps(mid, port);
      const processed = comps.map((x) => {
        let level = x.level;
        if (x.needsPhantom && !powered.has(port)) { if (level != null) notes.deadPhantom.add(x.src); level = null; }
        if (x.hiZ) { notes.thin.add(x.src); if (level != null) level -= 6; }
        const inLevel = level == null ? null : level + ch.gain;
        return { ...x, inLevel };
      });
      const live = processed.filter((x) => x.inLevel != null);
      const inLevel = live.length ? Math.max(...live.map((x) => x.inLevel)) : null;
      const chOpen = !ch.mute && ch.fader > 0;
      const post = (x) => x.inLevel + mapDb(ch.fader);
      const info = { index: i + 1, port, comps: processed, inLevel, clip: inLevel != null && inLevel > 0 };
      chans.push(info);
      live.forEach((x) => {
        if (chOpen && !M.mainMute && M.mainFader > 0) main.push({ ...x, ch: i + 1, level: post(x) + mapDb(M.mainFader) });
        if (!ch.mute && ch.aux > 0 && M.auxMaster > 0) aux.push({ ...x, ch: i + 1, level: x.inLevel + mapDb(ch.aux) + mapDb(M.auxMaster) });
      });
    });
    mixerCache = { main, aux, channels: chans };
    return mixerCache;
  };

  // 오디오 인터페이스
  const aiCache = {};
  const interfaceCalc = (d) => {
    if (aiCache[d]) return aiCache[d];
    aiCache[d] = { usb: [], phones: [], inputs: [] };
    const s = dev[d];
    const inputs = [0, 1].map((i) => {
      const cfg = s.in[i];
      return inputComps(d, `in${i + 1}`).map((x) => {
        let level = x.level;
        if (x.needsPhantom && !cfg.phantom) { if (level != null) notes.deadPhantom.add(x.src); level = null; }
        if (x.hiZ && !cfg.inst) { notes.thin.add(x.src); if (level != null) level -= 6; }
        return { ...x, input: i + 1, inLevel: level == null ? null : level + cfg.gain, level: level == null ? null : level + cfg.gain };
      });
    }).flat();
    const live = inputs.filter((x) => x.level != null);
    aiCache[d] = {
      inputs,
      usb: live,
      phones: s.direct ? live.map((x) => ({ ...x, level: x.level + mapDb(s.monitor) })) : [],
    };
    return aiCache[d];
  };

  /* ----- 출력 위치에서 들리는 소리 ----- */
  const heard = { main: {}, monitor: {}, headphones: {}, stream: {}, mixer: {}, interface: {} };
  const put = (loc, x) => {
    if (x.level == null || !Number.isFinite(x.level)) return;
    const cur = heard[loc][x.src];
    if (!cur || x.level > cur.level) heard[loc][x.src] = { level: x.level, hum: !!x.hum };
  };
  const speakersHearing = []; // 피드백 계산용: [스피커 id, 위치항, 신호]
  Object.values(devices).forEach((d) => {
    if (!d.placed) return;
    if (d.type === 'speaker' || d.type === 'monitor') {
      if (!dev[d.id]?.power) return;
      const comps = inputComps(d.id, 'in');
      comps.forEach((x) => { put(d.type === 'speaker' ? 'main' : 'monitor', x); speakersHearing.push({ spk: d.id, type: d.type, x }); });
    }
    if (d.type === 'headphones') inputComps(d.id, 'plug').forEach((x) => put('headphones', x));
  });
  const mix = mixerCalc();
  mix.channels.forEach((c) => c.comps.forEach((x) => { if (x.inLevel != null) put('mixer', { ...x, level: x.inLevel }); }));
  Object.values(devices).filter((d) => d.placed && d.type === 'audio_interface').forEach((d) => {
    interfaceCalc(d.id).inputs.forEach((x) => { if (x.inLevel != null) put('interface', { ...x, level: x.inLevel }); });
  });

  /* ----- 영상 ----- */
  const sw = st.switcherId && placed(st.switcherId) ? st.switcherId : null;
  const camAt = {};
  if (sw) {
    connections.forEach((c) => {
      if (c.to.d === sw && /^in\d$/.test(c.to.p) && placed(c.from.d) && VIDEO_SOURCES.has(devices[c.from.d]?.type)) camAt[Number(c.to.p.slice(2))] = c.from.d;
    });
  }
  const programCam = sw ? camAt[st.atem.program] ?? null : null;
  const previewCam = sw ? camAt[st.atem.preview] ?? null : null;
  const overlay = !!programCam && devices[programCam].type === 'mirrorless' && !dev[programCam]?.clean;
  const pcId = Object.values(devices).find((d) => d.placed && d.type === 'pc')?.id ?? null;
  const routerOk = (fromD, fromP) => { const c = outgoing[`${fromD}.${fromP}`]; return !!c && devices[c.to.d]?.type === 'router'; };
  const toPc = (fromD, fromP) => { const c = outgoing[`${fromD}.${fromP}`]; return !!c && c.to.d === pcId; };
  const atemUsbToPc = !!sw && toPc(sw, 'usb');
  const isPro = !!sw && devices[sw].type === 'atem_pro';

  // OBS 오디오
  let obsAudioComps = [];
  if (pcId) {
    if (st.obs.audio === 'mixer' && st.mixerId && devices[st.mixerId].type === 'digital_mixer' && toPc(st.mixerId, 'usb')) obsAudioComps = outComps(st.mixerId, 'usb');
    if (st.obs.audio === 'interface') {
      const ai = Object.values(devices).find((d) => d.placed && d.type === 'audio_interface' && toPc(d.id, 'usb'));
      if (ai) obsAudioComps = outComps(ai.id, 'usb');
    }
  }
  // PC 내장 마이크: 방 소리를 멀리서 얇게 잡는다 (소리는 나지만 방송 품질이 아님)
  if (pcId && st.obs.audio === 'builtin' && talking) obsAudioComps = [{ src: 'pc_builtin', kind: 'room', level: -34 }];
  const obsHeard = st.obs.muted ? [] : obsAudioComps;
  // ATEM MIC 입력: 자체 프리앰프(micGain)로 증폭
  const micLevelSrc = (p) => { const c = feeding[`${sw}.${p}`]; return !!c && (VOICE_TYPES.has(devices[c.from.d]?.type)); };
  const proHeard = isPro ? ['mic1', 'mic2'].flatMap((p) => inputComps(sw, p).map((x) => ({ ...x, level: x.level == null || (x.needsPhantom && micLevelSrc(p)) ? null : x.level + (micLevelSrc(p) ? st.atem.micGain : 0) }))) : [];
  obsHeard.forEach((x) => put('stream', x));
  proHeard.forEach((x) => put('stream', x));
  const audible = (arr) => arr.some((x) => x.level != null && x.level > AUDIBLE);
  const obsVideoOk = !!pcId && st.obs.video === 'atem' && atemUsbToPc && !!programCam && !overlay;
  const obsAudioOk = audible(obsHeard);
  const proNet = isPro && routerOk(sw, 'eth');
  const proVideoOk = proNet && !!programCam && !overlay;
  const proAudioOk = audible(proHeard);
  const obsLive = st.obs.streaming && obsVideoOk && obsAudioOk;
  const proLive = isPro && st.atem.streaming && proVideoOk && proAudioOk;
  const streamingAny = (st.obs.streaming && !!pcId) || (isPro && st.atem.streaming);

  /* ----- 조명 (DMX) ----- */
  const light = lightCalc(st, placed, outgoing);

  /* ----- 화면 (프로젝터·LED) ----- */
  const displays = {};
  Object.values(devices).filter((d) => d.placed && (d.type === 'projector' || d.type === 'led_wall')).forEach((d) => {
    const s = dev[d.id] ?? {};
    const c = feeding[`${d.id}.hdmi`];
    const r = { power: !!s.power, source: c?.from.d ?? null, layers: [], ok: false, scaled: false, program: false };
    if (c && s.power) {
      const srcType = devices[c.from.d]?.type;
      if (srcType === 'media_server') {
        const m = dev[c.from.d];
        const map = m[c.from.p] ?? 'comp';
        if (m.playing && m.master > 0 && map !== 'off') {
          r.layers = m.layers.map((l, i) => ({ ...l, i: i + 1 })).filter((l) => l.clip && l.opacity >= 30 && (map === 'comp' || map === `layer${l.i}`));
        }
        r.scaled = d.type === 'led_wall' && m.compRes !== s.res;
      } else if (srcType === 'atem' || srcType === 'atem_pro') {
        r.program = !!programCam;
      } else if (CAMERA_TYPES.has(srcType)) {
        r.program = true;
      }
      r.ok = (r.layers.length > 0 || r.program) && !r.scaled;
    }
    displays[d.id] = r;
  });

  /* ----- PTZ 원격 제어 (IP) ----- */
  const ptz = {};
  const routerOf = (d, p) => { const c = outgoing[`${d}.${p}`]; return c && devices[c.to.d]?.type === 'router' ? c.to.d : null; };
  const ctrl = Object.values(devices).find((d) => d.placed && d.type === 'ptz_controller');
  Object.values(devices).filter((d) => d.placed && d.type === 'ptz').forEach((d) => {
    const s = dev[d.id];
    const r = { reachable: false, index: null, reason: null };
    if (!ctrl) r.reason = 'noController';
    else {
      const cs = dev[ctrl.id];
      const rc = routerOf(ctrl.id, 'lan'), rp = routerOf(d.id, 'lan');
      const subnet = (ip) => String(ip).split('.').slice(0, 3).join('.');
      const idx = cs.cams.indexOf(s.ip);
      if (!rc) r.reason = 'ctrlNet';
      else if (!rp) r.reason = 'camNet';
      else if (rc !== rp) r.reason = 'otherNet';
      else if (subnet(cs.ip) !== subnet(s.ip)) r.reason = 'subnet';
      else if (idx < 0) r.reason = 'notInList';
      else { r.reachable = true; r.index = idx + 1; }
    }
    r.framing = framingOf(st.venue, d.slot, s);
    ptz[d.id] = r;
  });

  /* ----- 피드백 ----- */
  const loops = [];
  speakersHearing.forEach(({ spk, type, x }) => {
    if (x.kind !== 'voice' || x.level == null) return;
    const ch = st.channels[(x.ch ?? 1) - 1];
    if (!ch) return;
    const pos = type === 'monitor' ? -2 : dev[spk]?.position === 'front' ? 8 : -6;
    const fxTerm = (ch.fx / 100) * (st.master.fxReturn / 100) * 4;
    const loop = x.level + 5 + ch.eqMid + 0.4 * ch.eqHigh + pos + (x.condenser ? 6 : 0) + fxTerm + (ch.lowCut ? -0.5 : 0);
    loops.push({ src: x.src, spk, loop });
  });
  const worst = loops.length ? Math.max(...loops.map((l) => l.loop)) : -99;

  /* ----- 잡음·클리핑 ----- */
  const humAt = ['main', 'monitor', 'stream', 'headphones'].some((loc) => Object.entries(heard[loc]).some(([src, h]) => { if (h.hum && h.level > AUDIBLE) { notes.humSources.add(src); return true; } return false; }));
  const clips = mix.channels.filter((c) => c.clip).map((c) => c.comps.find((x) => x.inLevel != null)?.src).filter(Boolean);
  Object.values(devices).filter((d) => d.placed && d.type === 'audio_interface').forEach((d) => interfaceCalc(d.id).inputs.forEach((x) => { if (x.inLevel != null && x.inLevel > 0) clips.push(x.src); }));

  return {
    heard, mixer: mix, loops,
    feedback: worst >= 0, ringing: worst >= -4 && worst < 0, worstLoop: worst,
    hum: humAt, humSources: [...notes.humSources], thin: [...notes.thin], deadPhantom: [...notes.deadPhantom],
    clips,
    video: { camAt, programCam, previewCam, overlay, atemUsbToPc, isPro, proNet, dark: light.stageLit === false },
    light, displays, ptz,
    stream: { obsVideoOk, obsAudioOk, proVideoOk, proAudioOk, obsLive, proLive, live: obsLive || proLive, streamingAny, pcId },
    channelOf: (src) => mix.channels.find((c) => c.comps.some((x) => x.src === src)) ?? null,
    // 단자별 신호 크기 (3D 케이블의 신호 흐름 표시용)
    outLevel: (d, p) => maxLevel(outComps(d, p)),
    inLevel: (d, p) => maxLevel(inputComps(d, p)),
    levelAt: (src, at) => heard[at]?.[src]?.level ?? null,
    reaches: (src, at) => { const h = heard[at]?.[src]; return !!h && h.level > AUDIBLE; },
  };
}

/* ---------------------------- 소스 목록 ---------------------------- */
export const voiceSources = (st) => Object.values(st.devices).filter((d) => d.placed && VOICE_TYPES.has(d.type)).map((d) => d.id);
export const sourceKind = (type) => (VOICE_TYPES.has(type) ? 'voice' : type === 'e_guitar' ? 'inst' : (type === 'keyboard' || type === 'laptop') ? 'line' : null);

/* ---------------------------- 채널 찾기 ---------------------------- */
// 소스가 꽂힌(또는 꽂혀야 할) 믹서 채널 번호. 신호가 없더라도 케이블 경로로 찾는다.
export function channelIndexOf(st, src) {
  const sim = computeSim(st, { talking: true, performing: true });
  const c = sim.channelOf(src);
  if (c) return c.index;
  // 팬텀 등으로 신호가 죽어도 경로를 따라가 찾는다
  const visited = new Set();
  let cur = { d: src, p: null };
  for (let hop = 0; hop < 6; hop += 1) {
    const out = st.connections.find((c) => c.from.d === cur.d && (cur.p == null || c.from.p === cur.p));
    if (!out || visited.has(out.id)) return null;
    visited.add(out.id);
    if (out.to.d === st.mixerId) {
      const digital = st.devices[st.mixerId].type === 'digital_mixer';
      if (!digital) return Number(out.to.p.replace('in', ''));
      const idx = st.channels.findIndex((ch, i) => (ch.patch ?? `local${i + 1}`) === out.to.p);
      return idx >= 0 ? idx + 1 : null;
    }
    if (st.devices[out.to.d]?.type === 'di_box') cur = { d: out.to.d, p: 'out' };
    else return null;
  }
  return null;
}

/* ---------------------------- 미션 판정 ---------------------------- */
export function checkObjective(check, st, sim, ctx = {}) {
  const ch = (src) => { const i = channelIndexOf(st, src); return i ? st.channels[i - 1] : null; };
  switch (check.type) {
    case 'placed': return check.devices.every((id) => st.devices[id]?.placed);
    case 'connected': {
      const f = parseEnd(check.from), t = parseEnd(check.to);
      return st.connections.some((c) => c.from.d === f.d && (!f.p || c.from.p === f.p) && c.to.d === t.d && (!t.p || c.to.p === t.p));
    }
    case 'reaches': return sim.reaches(check.source, check.at);
    case 'absent': return !sim.reaches(check.source, check.at);
    case 'gainOk': {
      const c = sim.channelOf(check.source);
      const comp = c?.comps.find((x) => x.src === check.source);
      if (comp?.inLevel != null) return comp.inLevel >= -20 && comp.inLevel <= -6;
      const ai = sim.heard.interface[check.source];
      return !!ai && ai.level >= -20 && ai.level <= -6;
    }
    case 'noClip': return sim.clips.length === 0;
    case 'noFeedback': return !sim.feedback;
    case 'noHum': return !sim.hum;
    case 'lowCut': return !!ch(check.source)?.lowCut;
    case 'fx': { const c = ch(check.source); return !!c && c.fx >= (check.min ?? 0) && c.fx <= (check.max ?? 100); }
    case 'eq': { const c = ch(check.source); const v = c?.[check.band]; return v != null && v >= (check.min ?? -15) && v <= (check.max ?? 15); }
    case 'power': return !!st.dev[check.device]?.power;
    case 'wireless': { const s = st.dev[check.device]; return !!s && s.txPower && s.txChannel === s.rxChannel && s.battery > 15; }
    case 'cleanHdmi': return !!st.dev[check.device]?.clean;
    case 'program': return sim.video.programCam === check.camera;
    case 'live': return sim.stream.live;
    case 'recording': return !!st.atem.recording && sim.video.isPro;
    case 'pip': return !!st.atem.pip;
    case 'talkTest': return !!ctx.latched?.includes(`talk:${check.at}`);
    case 'faultsFixed': return st.faults.every((f) => faultFixed(f, st, sim));
    // 조명
    case 'lit': { const r = sim.light.fixtures[check.device]; return !!r && r.intensity >= (check.min ?? 0.5) && !r.flicker && !r.wrong; }
    case 'dark': { const r = sim.light.fixtures[check.device]; return !r || r.intensity < 0.05; }
    case 'stageLit': return sim.light.stageLit === true;
    case 'dmxOk': return sim.light.conflicts.length === 0 && Object.values(sim.light.fixtures).every((r) => r.receiving && !r.flicker && !r.wrong);
    case 'fixtureColor': { const r = sim.light.fixtures[check.device]; return !!r && r.intensity >= 0.3 && colorFamily(r.color) === check.color; }
    case 'patched': { const cs = st.dev[sim.light.consoleId]; const d = st.dev[check.device]; return !!cs && !!d && cs.patch.some((e) => e.address === d.address && e.type === st.devices[check.device].type); }
    case 'playback': { const cs = st.dev[sim.light.consoleId]; const pb = cs?.playbacks?.[check.index - 1]; return !!pb && pb.level >= (check.min ?? 50); }
    case 'recorded': { const cs = st.dev[sim.light.consoleId]; const pb = cs?.playbacks?.[check.index - 1]; return !!pb?.cue?.fixtures?.length && (!check.color || colorFamily(pb.cue.color) === check.color); }
    // 영상 화면
    case 'display': { const r = sim.displays[check.device]; if (!r?.ok) return false; return check.content ? (check.content === 'program' ? r.program : r.layers.some((l) => l.clip === check.content)) : true; }
    case 'noScaling': return Object.values(sim.displays).every((r) => !r.scaled);
    // PTZ
    case 'ptzControl': return !!sim.ptz[check.device]?.reachable;
    case 'ptzFrames': return sim.ptz[check.device]?.framing === check.target;
    case 'ptzPreset': { const p = st.dev[check.device]?.presets?.[check.preset]; return !!p && framingOf(st.venue, st.devices[check.device].slot, p) === check.target; }
    default: return false;
  }
}

// 말하기 테스트: 실제로 말하는 중에 목소리가 그 위치에서 들리면 기록
export function talkHeardAt(st, simActual, at) {
  if (simActual.feedback) return false;
  return voiceSources(st).some((v) => simActual.reaches(v, at));
}

/* ---------------------------- 고장 ---------------------------- */
const chOf = (st, src) => { const i = channelIndexOf(st, src); return i ? st.channels[i - 1] : null; };

export function applyFault(st, f) {
  const c = f.source ? chOf(st, f.source) : null;
  switch (f.type) {
    case 'unplug': {
      const [a, b] = f.conn.split('>');
      const from = parseEnd(a), to = parseEnd(b);
      const idx = st.connections.findIndex((x) => x.from.d === from.d && x.from.p === from.p && x.to.d === to.d && x.to.p === to.p);
      if (idx >= 0) {
        const [removed] = st.connections.splice(idx, 1);
        st.cables[removed.cable] = (st.cables[removed.cable] ?? 0) + 1;
        f.toDevice = to.d;
      }
      break;
    }
    case 'mute': if (c) c.mute = true; break;
    case 'faderDown': if (c) c.fader = 0; break;
    case 'mainMute': st.master.mainMute = true; break;
    case 'phantomOff': {
      if (c) c.phantom = false;
      const ai = aiInputOf(st, f.source); if (ai) st.dev[ai.id].in[ai.i].phantom = false;
      break;
    }
    case 'patchWrong': if (c) { const i = st.channels.indexOf(c); c.patch = `local${((i + 4) % CHANNELS) + 1}`; } break;
    case 'usbRoute': st.master.usbOut = 'off'; break;
    case 'obsMute': st.obs.muted = true; break;
    case 'obsAudioNone': st.obs.audio = 'none'; break;
    case 'speakerOff': if (st.dev[f.device]) st.dev[f.device].power = false; break;
    case 'wirelessChannel': if (st.dev[f.device]) st.dev[f.device].rxChannel = (st.dev[f.device].txChannel % 4) + 1; break;
    case 'wirelessBattery': if (st.dev[f.device]) st.dev[f.device].battery = 5; break;
    case 'groundLoop': if (st.dev[f.device]) { st.dev[f.device].groundLoop = true; st.dev[f.device].groundLift = false; } break;
    case 'auxZero': if (c) c.aux = 0; break;
    case 'atemBlack': st.atem.program = 0; break;
    case 'cleanHdmiOff': if (st.dev[f.device]) st.dev[f.device].clean = false; break;
    case 'gainHigh': if (c) c.gain = 60; break;
    case 'dmxAddress': if (st.dev[f.device]) { f.was = st.dev[f.device].address; st.dev[f.device].address = f.to ?? (st.dev[f.device].address + 3); } break;
    case 'blackout': { const id = Object.values(st.devices).find((d) => d.type === 'lighting_console')?.id; if (id) st.dev[id].blackout = true; break; }
    case 'gmZero': { const id = Object.values(st.devices).find((d) => d.type === 'lighting_console')?.id; if (id) st.dev[id].gm = 0; break; }
    case 'dmxMicCable': {
      const c2 = st.connections.find((x) => `${x.from.d}.${x.from.p}>${x.to.d}.${x.to.p}` === f.conn);
      if (c2) { c2.cable = 'xlr'; c2.id = `${c2.from.d}.${c2.from.p}>${c2.to.d}.${c2.to.p}`; }
      break;
    }
    case 'fixturePower': if (st.dev[f.device]) st.dev[f.device].power = false; break;
    case 'ptzIp': if (st.dev[f.device]) { f.was = st.dev[f.device].ip; st.dev[f.device].ip = f.to ?? '192.168.0.21'; } break;
    case 'resolumeOutputOff': if (st.dev[f.device]) st.dev[f.device][f.output ?? 'out1'] = 'off'; break;
    case 'layerZero': if (st.dev[f.device]) st.dev[f.device].layers[(f.layer ?? 1) - 1].opacity = 0; break;
    case 'displayOff': if (st.dev[f.device]) st.dev[f.device].power = false; break;
    case 'resMismatch': if (st.dev[f.device]) st.dev[f.device].compRes = '1280x720'; break;
    default: break;
  }
}

function aiInputOf(st, src) {
  const conn = st.connections.find((x) => x.from.d === src && st.devices[x.to.d]?.type === 'audio_interface');
  if (!conn) return null;
  return { id: conn.to.d, i: Number(conn.to.p.replace('in', '')) - 1 };
}

export function faultFixed(f, st, sim) {
  const c = f.source ? chOf(st, f.source) : null;
  switch (f.type) {
    case 'unplug': {
      const from = parseEnd(f.conn.split('>')[0]);
      return st.connections.some((x) => x.from.d === from.d && x.from.p === from.p && x.to.d === (f.toDevice ?? parseEnd(f.conn.split('>')[1]).d));
    }
    case 'mute': return !!c && !c.mute;
    case 'faderDown': return !!c && c.fader >= 50;
    case 'mainMute': return !st.master.mainMute;
    case 'phantomOff': { const ai = aiInputOf(st, f.source); return ai ? st.dev[ai.id].in[ai.i].phantom : !!c?.phantom; }
    case 'patchWrong': return sim.reaches(f.source, 'mixer');
    case 'usbRoute': return st.master.usbOut === 'main';
    case 'obsMute': return !st.obs.muted;
    case 'obsAudioNone': return st.obs.audio !== 'none';
    case 'speakerOff': return !!st.dev[f.device]?.power;
    case 'wirelessChannel': return st.dev[f.device]?.txChannel === st.dev[f.device]?.rxChannel;
    case 'wirelessBattery': return (st.dev[f.device]?.battery ?? 0) > 15;
    case 'groundLoop': return !!st.dev[f.device]?.groundLift;
    case 'auxZero': return !!c && c.aux >= 40;
    case 'atemBlack': return !!sim.video.programCam;
    case 'cleanHdmiOff': return !!st.dev[f.device]?.clean;
    case 'gainHigh': { const comp = sim.channelOf(f.source)?.comps.find((x) => x.src === f.source); return !!comp && comp.inLevel != null && comp.inLevel <= -6; }
    case 'dmxAddress': { const r = sim.light.fixtures[f.device]; return !!r && !!r.entry && !r.wrong; }
    case 'blackout': return !st.dev[sim.light.consoleId]?.blackout;
    case 'gmZero': return (st.dev[sim.light.consoleId]?.gm ?? 0) >= 50;
    case 'dmxMicCable': return !st.connections.some((x) => x.cable === 'xlr' && st.devices[x.to.d] && (st.devices[x.to.d].type === 'par_led' || st.devices[x.to.d].type === 'moving_head'));
    case 'fixturePower': return !!st.dev[f.device]?.power;
    case 'ptzIp': return !!sim.ptz[f.device]?.reachable;
    case 'resolumeOutputOff': return st.dev[f.device]?.[f.output ?? 'out1'] !== 'off';
    case 'layerZero': return (st.dev[f.device]?.layers[(f.layer ?? 1) - 1]?.opacity ?? 0) >= 50;
    case 'displayOff': return !!st.dev[f.device]?.power;
    case 'resMismatch': return Object.values(sim.displays).every((r) => !r.scaled);
    default: return true;
  }
}

export const FAULT_TEXT = {
  unplug: (f) => `케이블이 빠져 있었습니다 (${f.conn.replace('>', ' → ')}).`,
  mute: (f) => `${f.source} 채널의 MUTE가 눌려 있었습니다.`,
  faderDown: (f) => `${f.source} 채널 페이더가 끝까지 내려가 있었습니다.`,
  mainMute: () => 'MAIN 출력이 뮤트되어 있었습니다.',
  phantomOff: (f) => `${f.source}(콘덴서 마이크)의 +48V 팬텀 전원이 꺼져 있었습니다.`,
  patchWrong: (f) => `${f.source} 채널의 입력 패치가 엉뚱한 입력으로 바뀌어 있었습니다.`,
  usbRoute: () => '믹서의 USB 출력 라우팅이 꺼져 있었습니다.',
  obsMute: () => 'OBS 오디오가 음소거되어 있었습니다.',
  obsAudioNone: () => 'OBS 오디오 소스가 지정되어 있지 않았습니다.',
  speakerOff: (f) => `${f.device} 스피커 전원이 꺼져 있었습니다.`,
  wirelessChannel: (f) => `${f.device} 무선 마이크 송신기와 수신기의 채널이 달랐습니다.`,
  wirelessBattery: (f) => `${f.device} 무선 마이크 배터리가 거의 없었습니다.`,
  groundLoop: (f) => `${f.device} DI 박스에서 그라운드 루프 험이 생겼습니다 (GROUND LIFT로 해결).`,
  auxZero: (f) => `${f.source}의 모니터(AUX) 보내기가 0이었습니다.`,
  atemBlack: () => 'ATEM 프로그램이 블랙(입력 없음)이었습니다.',
  cleanHdmiOff: (f) => `${f.device} 카메라의 클린 HDMI가 꺼져 화면 정보가 송출되고 있었습니다.`,
  gainHigh: (f) => `${f.source} 채널 GAIN이 너무 높아 클리핑되고 있었습니다.`,
  dmxAddress: (f) => `${f.device} 조명의 DMX 주소가 콘솔 패치와 달랐습니다 (${f.was ?? '?'}번이어야 함).`,
  blackout: () => '조명 콘솔의 BLACKOUT 버튼이 눌려 있었습니다.',
  gmZero: () => '조명 콘솔의 그랜드 마스터가 0이었습니다.',
  dmxMicCable: () => 'DMX 라인 중간에 마이크(XLR) 케이블이 쓰여 신호가 깨지고(깜빡임) 있었습니다.',
  fixturePower: (f) => `${f.device} 조명의 전원이 꺼져 있었습니다.`,
  ptzIp: (f) => `${f.device} PTZ 카메라의 IP가 다른 대역(${f.to ?? '192.168.0.x'})으로 바뀌어 조이스틱이 찾지 못했습니다.`,
  resolumeOutputOff: () => 'Resolume의 출력(Output)이 꺼져 있었습니다.',
  layerZero: (f) => `Resolume ${f.layer ?? 1}번 레이어의 투명도(Opacity)가 0이었습니다.`,
  displayOff: (f) => `${f.device} 화면 장비의 전원이 꺼져 있었습니다.`,
  resMismatch: () => 'Resolume 컴포지션 해상도가 LED 전광판 해상도와 달라 화면이 늘어나 보였습니다.',
};

// 색 이름 판정 (조명 목표용)
export const COLOR_NAMES = { red: '빨강', orange: '주황', yellow: '노랑', green: '초록', cyan: '하늘', blue: '파랑', purple: '보라', pink: '분홍', white: '흰색' };
export function colorFamily(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'white';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 0.18) return 'white';
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6; else if (max === g) h = (b - r) / (max - min) + 2; else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 340) return 'red';
  if (h < 40) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 160) return 'green';
  if (h < 200) return 'cyan';
  if (h < 255) return 'blue';
  if (h < 290) return 'purple';
  return 'pink';
}

/* ---------------------------- 조명 계산 ---------------------------- */
const hexOk = (c) => (typeof c === 'string' ? c : '#ffffff');
function lightCalc(st, placed, outgoing) {
  const { devices, dev } = st;
  const fixtures = Object.values(devices).filter((d) => d.placed && FIXTURE_TYPES.has(d.type));
  const res = { fixtures: {}, conflicts: [], chain: [], stageLit: null, consoleId: null };
  fixtures.forEach((f) => { res.fixtures[f.id] = { receiving: false, depth: null, viaMic: false, entry: null, wrong: false, intensity: 0, color: '#ffffff', pan: 0, tilt: 0, flicker: false }; });
  const con = Object.values(devices).find((d) => d.placed && d.type === 'lighting_console');
  if (con) {
    res.consoleId = con.id;
    const cs = dev[con.id];
    // 데이지 체인 따라가기: 콘솔 DMX OUT → 조명 IN → 조명 OUT → 다음 조명 IN …
    let c = outgoing[`${con.id}.dmx1`];
    let mic = false; let depth = 0;
    const seen = new Set();
    while (c && !seen.has(c.to.d) && FIXTURE_TYPES.has(devices[c.to.d]?.type) && c.to.p === 'dmxIn') {
      seen.add(c.to.d);
      mic = mic || c.cable === 'xlr';
      depth += 1;
      Object.assign(res.fixtures[c.to.d], { receiving: true, depth, viaMic: mic });
      res.chain.push(c.to.d);
      c = outgoing[`${c.to.d}.dmxOut`];
    }
    const last = res.chain[res.chain.length - 1];
    const unterminated = res.chain.length >= 4 && last && !dev[last]?.terminated;
    // 패치 충돌: 콘솔 패치끼리 주소 범위가 겹치면 안 된다
    const patch = cs.patch ?? [];
    patch.forEach((a, i) => patch.forEach((b, j) => {
      if (j <= i) return;
      const fa = FOOTPRINT[a.type] ?? 8, fb = FOOTPRINT[b.type] ?? 8;
      if (a.address < b.address + fb && b.address < a.address + fa) res.conflicts.push([a.n, b.n]);
    }));
    // 플레이백 + 프로그래머 → 패치 번호별 값
    const valueOf = (n) => {
      let intensity = 0, color = '#ffffff', pan = 0, tilt = 0, best = -1;
      (cs.playbacks ?? []).forEach((pb) => {
        if (!pb.level || !pb.cue?.fixtures?.includes(n)) return;
        const lv = ((pb.cue.intensity ?? 100) / 100) * (pb.level / 100);
        intensity = Math.max(intensity, lv);
        if (pb.level > best) { best = pb.level; color = pb.cue.color ?? color; pan = pb.cue.pan ?? pan; tilt = pb.cue.tilt ?? tilt; }
      });
      const pr = cs.programmer;
      if (pr?.sel?.includes(n)) {
        if (pr.intensity != null) intensity = pr.intensity / 100;
        if (pr.color != null) color = pr.color;
        if (pr.pan != null) pan = pr.pan;
        if (pr.tilt != null) tilt = pr.tilt;
      }
      return { intensity, color, pan, tilt };
    };
    fixtures.forEach((f) => {
      const r = res.fixtures[f.id];
      const s = dev[f.id];
      if (!r.receiving || !s.power) return;
      const fp = FOOTPRINT[f.type];
      const exact = patch.find((e) => e.address === s.address && e.type === f.type);
      const overlap = patch.find((e) => e !== exact && s.address < e.address + (FOOTPRINT[e.type] ?? 8) && e.address < s.address + fp);
      if (exact && !res.conflicts.some(([a, b]) => a === exact.n || b === exact.n)) {
        r.entry = exact.n;
        const v = valueOf(exact.n);
        Object.assign(r, v, { color: hexOk(v.color) });
      } else if (overlap || exact) {
        // 주소가 어긋나면 다른 조명의 채널을 읽어 엉뚱하게 반응한다
        r.wrong = true;
        r.entry = (overlap ?? exact).n;
        const v = valueOf(r.entry);
        Object.assign(r, { intensity: v.intensity * 0.6, color: '#a3e635', pan: (v.pan + 40) % 90, tilt: v.tilt });
      }
      r.intensity *= ((cs.gm ?? 100) / 100) * (cs.blackout ? 0 : 1);
      r.flicker = r.receiving && (r.viaMic || (unterminated && r.depth >= 3));
    });
  }
  const fronts = fixtures.filter((f) => f.role === 'front');
  if (fronts.length) res.stageLit = fronts.every((f) => { const r = res.fixtures[f.id]; return r.intensity >= 0.5 && !r.flicker && !r.wrong; });
  return res;
}

/* ---------------------------- PTZ 구도 ---------------------------- */
// 장소의 PTZ 자리에서 각 대상(사람)을 잡기 위한 PAN/TILT/ZOOM 목표
export const PTZ_TARGETS = {
  church: { ptz_side: {
    pastor: { label: '설교자 클로즈업', pan: 32, tilt: -8, zoom: [0.55, 1] },
    leader: { label: '찬양 인도자', pan: 18, tilt: -6, zoom: [0.45, 1] },
    choir: { label: '성가대', pan: 50, tilt: -6, zoom: [0.3, 0.7] },
    wide: { label: '강단 전체 (와이드)', pan: 30, tilt: -6, zoom: [0, 0.25], tol: 12 },
  } },
  lecture_hall: { ptz_ceiling: {
    host: { label: '진행자 클로즈업', pan: -25, tilt: -15, zoom: [0.55, 1] },
    wide: { label: '스튜디오 전체', pan: -5, tilt: -12, zoom: [0, 0.25], tol: 12 },
  } },
  live_stage: { ptz_truss: {
    singer: { label: '보컬 클로즈업', pan: 0, tilt: -20, zoom: [0.55, 1] },
    gtr: { label: '기타리스트', pan: -28, tilt: -18, zoom: [0.45, 1] },
    keys: { label: '키보디스트', pan: 28, tilt: -18, zoom: [0.45, 1] },
    wide: { label: '무대 전체', pan: 0, tilt: -15, zoom: [0, 0.25], tol: 14 },
  } },
};
export function framingOf(venue, slot, s) {
  const T = PTZ_TARGETS[venue]?.[slot];
  if (!T || !s) return null;
  const hit = Object.entries(T).find(([, t]) => {
    const tol = t.tol ?? 6;
    return Math.abs((s.pan ?? 0) - t.pan) <= tol && Math.abs((s.tilt ?? 0) - t.tilt) <= tol * 0.8 && (s.zoom ?? 0) >= t.zoom[0] && (s.zoom ?? 0) <= t.zoom[1];
  });
  return hit ? hit[0] : null;
}
