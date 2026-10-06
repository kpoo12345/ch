import React, { useEffect, useRef } from 'react';
import { Power, Radio, Cable, Camera, Tv, MonitorPlay, Lightbulb, Clapperboard, Joystick, Router as RouterIcon, Laptop, Info } from 'lucide-react';
import { DEVICE_TYPES, CABLES } from '../engine.js';
import { FOOTPRINT, PTZ_TARGETS, COLOR_NAMES, colorFamily, chCountOf, chLabel } from '../sim.js';
import { VENUES } from '../venues.js';
import { nextDmxAddress, patchOverlap, discoverCams } from '../ops.js';
import { Meter } from '../ui.jsx';
import { Knob, Toggle, Seg, Stepper, Row, Card, HSlider } from './controls.jsx';
import { drawSource, drawComposition, sourceOf, CLIPS, drawMeterBar } from '../scenes.js';

/* =====================================================================
 * 장비별 조작 패널 — 선택한 장비의 실제 버튼·노브를 2D로
 * ===================================================================== */

const COLORS = [['#ffffff', '흰색'], ['#fff1d6', '따뜻한 흰색'], ['#ef4444', '빨강'], ['#f97316', '주황'], ['#facc15', '노랑'], ['#22c55e', '초록'], ['#22d3ee', '하늘'], ['#2563eb', '파랑'], ['#a855f7', '보라'], ['#ec4899', '분홍']];

function Canvas2D({ draw, deps, w = 480, h = 270, className = '' }) {
  const ref = useRef(null);
  useEffect(() => { const c = ref.current; if (!c) return; draw(c.getContext('2d'), w, h); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} width={w} height={h} className={`w-full rounded border border-slate-700 bg-black ${className}`} />;
}

export function DevicePanel({ game, id }) {
  const { st, nominal, actual, apply, show } = game;
  const d = st.devices[id];
  if (!d) return null;
  const def = DEVICE_TYPES[d.type];
  const s = st.dev[id] ?? {};
  const set = (key, value, visual = true) => apply({ op: 'dev', device: id, key, value }, { visual });
  const commit = (key) => (prev, value) => { if (prev !== value) show({ op: 'dev', device: id, key, value }, prev); };
  const Icon = def.icon ?? Info;
  const conns = st.connections.filter((c) => c.from.d === id || c.to.d === id);
  const header = (
    <div className="flex items-start gap-2">
      <div className="p-2 rounded-md bg-slate-800 text-sky-300"><Icon size={18} /></div>
      <div className="min-w-0">
        <div className="font-bold text-slate-100 leading-tight">{d.name ?? def.name}</div>
        <div className="text-[11px] text-slate-400">{def.name} · {def.model}</div>
      </div>
    </div>
  );
  if (!d.placed) {
    return (
      <div className="space-y-2">{header}
        <p className="text-xs text-slate-300">아직 배치되지 않았습니다.</p>
        <button type="button" onClick={() => apply({ op: 'place', device: id })} className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold">+ 배치하기</button>
      </div>
    );
  }
  let body = null;
  switch (d.type) {
    case 'speaker': {
      const venue = VENUES[st.venue];
      const free = Object.entries(venue?.slots ?? {}).filter(([k]) => /^pa_/.test(k) && !Object.values(st.devices).some((x) => x.slot === k));
      const lv = actual.inLevel(id, 'in');
      body = (
        <Card title="액티브 스피커" icon={Power}>
          <Row label="전원" hint="케이블을 다 꽂은 뒤 마지막에 켜고, 끌 때는 가장 먼저 끕니다."><Toggle on={s.power} color="green" onClick={() => set('power', !s.power)}>{s.power ? 'ON' : 'OFF'}</Toggle></Row>
          <Row label="스피커로 들어오는 신호"><div className="w-36"><Meter level={s.power ? lv : null} /></div></Row>
          <Row label="위치" hint={d.slot === 'pa_alt' ? '⚠ 마이크 정면 — 하울링 위험' : '청중 쪽을 향함 (마이크 뒤)'}>
            {free.map(([k, sl]) => <button key={k} type="button" onClick={() => apply({ op: 'move', device: id, slot: k })} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-100">{sl.label}로 옮기기</button>)}
          </Row>
        </Card>
      );
      break;
    }
    case 'monitor':
      body = (
        <Card title="모니터 스피커 (웨지)" icon={Power}>
          <Row label="전원"><Toggle on={s.power} color="green" onClick={() => set('power', !s.power)}>{s.power ? 'ON' : 'OFF'}</Toggle></Row>
          <Row label="웨지로 들어오는 신호 (AUX)"><div className="w-36"><Meter level={s.power ? actual.inLevel(id, 'in') : null} /></div></Row>
          <p className="text-[11px] text-slate-400">무대 위 연주자·설교자가 자기 소리를 듣는 스피커입니다. 믹서의 각 채널 AUX 노브로 무엇을 얼마나 보낼지 정합니다.</p>
        </Card>
      );
      break;
    case 'wireless_mic': {
      const ok = s.txPower && s.txChannel === s.rxChannel && s.battery > 15;
      body = (
        <Card title="무선 마이크 (송신기 + 수신기)" icon={Radio}>
          <div className={`rounded px-2 py-1 font-mono text-xs ${ok ? 'bg-sky-950 text-sky-200' : 'bg-red-950 text-red-200'}`}>
            RX CH {s.rxChannel} · {ok ? '신호 수신 중 (RF ▮▮▮▮)' : !s.txPower ? '송신기 전원 꺼짐' : s.txChannel !== s.rxChannel ? '채널 불일치 — 신호 없음' : '배터리 부족 — 끊김'}
          </div>
          <Row label="송신기(마이크) 전원"><Toggle on={s.txPower} color="green" onClick={() => set('txPower', !s.txPower)}>{s.txPower ? 'ON' : 'OFF'}</Toggle></Row>
          <Row label="송신기 채널"><Stepper value={s.txChannel} min={1} max={8} onChange={(v) => set('txChannel', v)} label="송신기 채널" /></Row>
          <Row label="수신기 채널" hint="송신기와 같은 채널이어야 합니다."><Stepper value={s.rxChannel} min={1} max={8} onChange={(v) => set('rxChannel', v)} label="수신기 채널" /></Row>
          <Row label={`배터리 ${s.battery}%`}><button type="button" onClick={() => set('battery', 100)} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-slate-100">새 배터리로 교체</button></Row>
        </Card>
      );
      break;
    }
    case 'di_box':
      body = (
        <Card title="DI 박스" icon={Cable}>
          <p className="text-[11px] text-slate-400">악기·키보드의 언밸런스드 신호를 밸런스드 XLR(마이크 레벨)로 바꿔 멀리 보내도 잡음이 없게 합니다.</p>
          <Row label="GROUND LIFT" hint="험(웅—) 소리가 나면 켜서 접지 루프를 끊습니다."><Toggle on={s.groundLift} color="amber" onClick={() => set('groundLift', !s.groundLift)}>LIFT</Toggle></Row>
          <Row label="PAD -20dB" hint="입력이 너무 큰 소스(앰프 출력 등)일 때"><Toggle on={s.pad} color="amber" onClick={() => set('pad', !s.pad)}>PAD</Toggle></Row>
          {nominal.humSources.length > 0 && <div className="text-[11px] text-amber-300">험 감지: {nominal.humSources.map((x) => st.devices[x]?.name ?? x).join(', ')}</div>}
        </Card>
      );
      break;
    case 'audio_interface':
      body = (
        <Card title="오디오 인터페이스" icon={Radio}>
          {[0, 1].map((i) => {
            const cfg = s.in[i];
            const lv = Object.values(actual.heard.interface ?? {}).length ? lvOfInput(st, actual, id, i) : null;
            return (
              <div key={i} className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Knob label={`IN ${i + 1} GAIN`} value={cfg.gain} min={0} max={60} color="#ef4444" size={40} display={`+${cfg.gain}`} def={30}
                  onChange={(v) => set(`in.${i}.gain`, v, false)} onCommit={commit(`in.${i}.gain`)} />
                <div className="flex-1 space-y-1">
                  <Meter level={lv} target={[-20, -6]} />
                  <div className="flex gap-1">
                    <Toggle small on={cfg.phantom} color="amber" onClick={() => set(`in.${i}.phantom`, !cfg.phantom)}>+48V</Toggle>
                    <Toggle small on={cfg.inst} color="amber" onClick={() => set(`in.${i}.inst`, !cfg.inst)}>INST</Toggle>
                  </div>
                </div>
              </div>
            );
          })}
          <Row label="DIRECT MONITOR" hint="PC를 거치지 않고 입력을 헤드폰으로 바로 (지연 없음)"><Toggle on={s.direct} color="green" onClick={() => set('direct', !s.direct)}>{s.direct ? 'ON' : 'OFF'}</Toggle></Row>
          <Row label="헤드폰 볼륨"><Knob value={s.monitor} min={0} max={100} size={34} def={60} onChange={(v) => set('monitor', v, false)} onCommit={commit('monitor')} /></Row>
        </Card>
      );
      break;
    case 'mirrorless':
      body = (
        <Card title="미러리스 카메라" icon={Camera}>
          <Row label="클린 HDMI 출력" hint="끄면 배터리·조리개 같은 화면 표시가 방송에 그대로 나갑니다."><Toggle on={s.clean} color="green" onClick={() => set('clean', !s.clean)}>{s.clean ? 'ON' : 'OFF'}</Toggle></Row>
          <Canvas2D w={320} h={180} draw={(ctx, w, h) => drawSource(ctx, sourceOf(st, nominal, id), 0, 0, w, h)} deps={[s.clean, st.venue]} />
        </Card>
      );
      break;
    case 'camera':
      body = (
        <Card title="방송용 캠코더" icon={Camera}>
          <Canvas2D w={320} h={180} draw={(ctx, w, h) => drawSource(ctx, sourceOf(st, nominal, id), 0, 0, w, h)} deps={[st.venue, nominal.video.dark]} />
          <p className="text-[11px] text-slate-400">카메라맨이 직접 구도를 잡습니다. HDMI/SDI로 스위처에 연결하세요. 빨간 탈리 = 방송 중, 초록 = 다음 화면(PVW).</p>
        </Card>
      );
      break;
    case 'ptz': {
      const r = nominal.ptz[id];
      const T = PTZ_TARGETS[st.venue]?.[d.slot];
      const ipNet = String(s.ip).split('.').slice(0, 3).join('.');
      const ipLast = Number(String(s.ip).split('.')[3]) || 1;
      const joy = Object.values(st.devices).find((x) => x.placed && x.type === 'ptz_controller');
      body = (
        <Card title="PTZ 카메라 설정" icon={Camera}>
          <Row label={`IP 주소 ${s.ip}`} hint="앞 세 자리(대역)는 조이스틱과 같게, 끝자리는 카메라마다 다르게.">
            <Seg small value={ipNet} options={[['192.168.1', '192.168.1.x'], ['192.168.0', '192.168.0.x (다른 대역)']]} onChange={(v) => set('ip', `${v}.${ipLast}`)} />
            <Stepper value={ipLast} min={1} max={254} onChange={(v) => set('ip', `${ipNet}.${v}`)} fmt={(v) => `.${v}`} label="IP 끝자리" />
          </Row>
          {joy && <div className="text-[11px] font-mono text-slate-500">조이스틱 목록: {(st.dev[joy.id]?.cams ?? []).map((ip, i) => `CAM${i + 1} ${ip}`).join(' · ')}</div>}
          <div className="text-[11px] text-slate-400">원격 제어: {r?.reachable ? <span className="text-green-300">조이스틱 {r.index}번으로 연결됨</span> : <span className="text-amber-300">{PTZ_REASON[r?.reason] ?? '—'}{r?.dupWith?.length ? ` — ${r.dupWith.map((x) => st.devices[x]?.name ?? x).join(', ')}와(과) 같은 IP` : ''}</span>}</div>
          {T && <div className="text-[11px] text-slate-300">현재 구도: <b>{r?.framing ? T[r.framing].label : '대상 없음'}</b></div>}
          <Canvas2D w={320} h={180} draw={(ctx, w, h) => drawSource(ctx, sourceOf(st, nominal, id), 0, 0, w, h)} deps={[r?.framing, st.venue, s.pan, s.tilt, s.zoom]} />
          <p className="text-[11px] text-slate-500">PAN·TILT·ZOOM은 PTZ 조이스틱에서 움직입니다.</p>
        </Card>
      );
      break;
    }
    case 'laptop':
      body = (
        <Card title="노트북 (음원 재생)" icon={Laptop}>
          <Row label="BGM 재생"><Toggle on={s.playing} color="green" onClick={() => set('playing', !s.playing)}>{s.playing ? '▶ 재생 중' : '❚❚ 정지'}</Toggle></Row>
          <p className="text-[11px] text-slate-400">3.5mm 출력은 가정용 라인 레벨입니다. 믹서의 LINE(TRS) 단자나 스테레오 채널에 꽂고 GAIN을 낮게 씁니다. MIC(XLR) 단자에 꽂으면 GAIN을 0 근처까지 내려야 합니다.</p>
        </Card>
      );
      break;
    case 'analog_mixer':
    case 'digital_mixer':
      body = (
        <Card title="믹서" icon={Radio}>
          <p className="text-[11px] text-slate-400">아래 <b>믹서 콘솔</b> 버튼을 누르면 채널마다 GAIN·EQ·페이더를 직접 조작할 수 있습니다.{d.type === 'digital_mixer' ? ' 디지털 믹서는 채널마다 입력 패치(어느 LOCAL 단자를 들을지)와 USB 출력 라우팅을 정해야 합니다.' : ' 모노 채널은 MIC(XLR)·LINE(TRS) 단자가 따로 있고, 9/10·11/12는 스테레오(L/R) 채널입니다. +48V는 PHANTOM 스위치 하나로 모든 MIC 단자에 들어갑니다.'}</p>
          <ul className="text-[11px] text-slate-300 space-y-0.5">
            {st.channels.slice(0, chCountOf(d.type)).map((ch, i) => {
              const c = nominal.mixer.channels[i];
              const src = c?.comps?.[0]?.src;
              if (!src) return null;
              const jack = c.comps[0].jack === 'line' ? ' LINE' : c.comps[0].jack === 'mic' ? ' MIC' : '';
              return <li key={i}>CH{chLabel(d.type, i)}{jack} · {st.devices[src]?.name ?? src} · GAIN +{ch.gain} · 입력 {c.inLevel == null ? '신호 없음' : `${c.inLevel.toFixed(0)}dB`}{ch.mute ? (d.type === 'analog_mixer' ? ' · ON 꺼짐' : ' · MUTE') : ''}</li>;
            })}
          </ul>
        </Card>
      );
      break;
    case 'pc': body = <ObsPanel game={game} id={id} />; break;
    case 'atem':
    case 'atem_pro': body = <AtemPanel game={game} id={id} />; break;
    case 'lighting_console': body = <TigerTouchPanel game={game} id={id} />; break;
    case 'par_led':
    case 'moving_head': body = <FixturePanel game={game} id={id} />; break;
    case 'media_server': body = <ResolumePanel game={game} id={id} />; break;
    case 'projector':
    case 'led_wall': {
      const r = nominal.displays[id];
      body = (
        <Card title={d.type === 'projector' ? '프로젝터' : 'LED 전광판'} icon={Tv}>
          <Row label="전원"><Toggle on={s.power} color="green" onClick={() => set('power', !s.power)}>{s.power ? 'ON' : 'OFF'}</Toggle></Row>
          {d.type === 'led_wall' && <Row label="LED 프로세서 입력 해상도"><span className="font-mono text-xs text-slate-200">{s.res}</span></Row>}
          <div className="text-[11px] text-slate-400">상태: {!s.power ? '꺼짐' : !r?.source ? '입력 없음' : r.scaled ? <span className="text-red-300">해상도 불일치 — 화면이 늘어남</span> : r.ok ? <span className="text-green-300">정상 출력</span> : '신호는 있지만 보낼 화면이 비어 있음'}</div>
          <Canvas2D w={320} h={180} draw={(ctx, w, h) => { if (r?.layers?.length) drawComposition(ctx, r.layers, 0, 0, w, h); else if (r?.program) drawSource(ctx, sourceOf(st, nominal, nominal.video.programCam), 0, 0, w, h); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); } }} deps={[JSON.stringify(r)]} />
        </Card>
      );
      break;
    }
    case 'ptz_controller': body = <JoystickPanel game={game} id={id} />; break;
    case 'router':
      body = (
        <Card title="네트워크" icon={RouterIcon}>
          <p className="text-[11px] text-slate-400">랜선으로 연결된 장비끼리 통신하고, 인터넷으로 송출합니다.</p>
          <ul className="text-xs text-slate-200 space-y-0.5">{conns.map((c) => <li key={c.id}>• {st.devices[c.from.d]?.name ?? c.from.d} → {c.to.p.toUpperCase()}</li>)}</ul>
        </Card>
      );
      break;
    case 'headphones':
      body = <Card title="헤드폰" icon={Radio}><p className="text-[11px] text-slate-400">연결된 장비의 헤드폰 출력이 들립니다. 아래 "듣는 위치"를 헤드폰으로 바꿔 들어 보세요.</p></Card>;
      break;
    default:
      body = null;
  }
  return (
    <div className="space-y-2">
      {header}
      <p className="text-[11px] text-slate-400 leading-relaxed">{def.info}</p>
      {body}
      <Card title="연결된 케이블" icon={Cable}>
        {conns.length === 0 ? <div className="text-xs text-slate-500">없음</div> : (
          <ul className="space-y-1">
            {conns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs text-slate-200">
                <span className="flex items-center gap-1.5 min-w-0"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CABLES[c.cable]?.stroke }} />
                  <span className="truncate">{st.devices[c.from.d]?.name ?? c.from.d} {c.from.p} → {st.devices[c.to.d]?.name ?? c.to.d} {c.to.p}</span></span>
                <button type="button" onClick={() => game.disconnect(c)} className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700 hover:bg-red-700 text-[10px]">분리</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

const PTZ_REASON = {
  noController: 'PTZ 조이스틱이 없습니다', ctrlNet: '조이스틱이 네트워크에 연결되지 않음', camNet: '카메라 LAN이 연결되지 않음',
  otherNet: '서로 다른 공유기에 연결됨', subnet: 'IP 대역이 다름 (예: 192.168.0.x ≠ 192.168.1.x)', notInList: '조이스틱 카메라 목록에 이 IP가 없음',
  dupIp: 'IP 충돌: 같은 IP를 쓰는 장비가 네트워크에 둘 이상 (끝자리를 바꾸세요)',
};

function lvOfInput(st, sim, id, i) {
  const c = st.connections.find((x) => x.to.d === id && x.to.p === `in${i + 1}`);
  if (!c) return null;
  const srcs = Object.entries(sim.heard.interface ?? {});
  // 해당 입력으로 들어오는 소스 찾기 (DI 등 경유 포함)
  let cur = c.from.d;
  for (let k = 0; k < 4; k += 1) {
    const hit = srcs.find(([src]) => src === cur);
    if (hit) return hit[1].level;
    const up = st.connections.find((x) => x.to.d === cur);
    if (!up) break;
    cur = up.from.d;
  }
  return null;
}

/* ---------------------------- OBS ---------------------------- */
function ObsPanel({ game, id }) {
  const { st, nominal, actual, apply } = game;
  const o = st.obs;
  const set = (key, value) => apply({ op: 'obs', key, value });
  const src = o.video === 'atem' && nominal.video.atemUsbToPc ? sourceOf(st, nominal, nominal.video.programCam) : { kind: 'nosignal' };
  const lv = Object.values(actual.heard.stream).reduce((m, h) => Math.max(m, h.level), -99);
  return (
    <Card title="OBS Studio" icon={MonitorPlay}>
      <Canvas2D w={480} h={270} draw={(ctx, w, h) => { drawSource(ctx, src, 0, 0, w, h); if (o.streaming) { ctx.fillStyle = nominal.stream.obsLive ? '#dc2626' : '#92400e'; ctx.fillRect(w - 110, 10, 100, 28); ctx.fillStyle = '#fff'; ctx.font = '800 16px sans-serif'; ctx.fillText(nominal.stream.obsLive ? '● LIVE' : '● 문제', w - 98, 30); } }}
        deps={[JSON.stringify(src), o.streaming, nominal.stream.obsLive]} />
      <Row label="영상 소스"><Seg small value={o.video} options={[['none', '없음'], ['atem', 'ATEM (USB 웹캠)']]} onChange={(v) => set('video', v)} /></Row>
      <Row label="오디오 소스"><Seg small value={o.audio} options={[['none', '없음'], ['builtin', 'PC 내장 마이크'], ['mixer', '믹서 USB'], ['interface', '오디오 인터페이스']]} onChange={(v) => set('audio', v)} /></Row>
      <Row label="오디오 미터"><div className="w-40"><Meter level={o.muted ? null : lv > -99 ? lv : null} /></div><Toggle small on={o.muted} color="red" onClick={() => set('muted', !o.muted)}>MUTE</Toggle></Row>
      <Row label="방송">
        <button type="button" onClick={() => set('streaming', !o.streaming)} className={`px-3 py-1.5 rounded font-bold text-sm ${o.streaming ? 'bg-slate-200 text-slate-900' : 'bg-red-600 text-white'}`}>{o.streaming ? '방송 중지' : '방송 시작'}</button>
      </Row>
      {o.streaming && !nominal.stream.obsLive && (
        <div className="text-[11px] text-amber-300">시청자 화면 점검: {!nominal.stream.obsVideoOk ? '영상이 나가지 않음 · ' : ''}{!nominal.stream.obsAudioOk ? '소리가 나가지 않음' : ''}</div>
      )}
      {o.audio === 'builtin' && <div className="text-[11px] text-amber-300">PC 내장 마이크는 방 소리를 멀리서 얇게 잡습니다. 방송 품질이 아닙니다.</div>}
    </Card>
  );
}

/* ---------------------------- ATEM ---------------------------- */
function AtemPanel({ game, id }) {
  const { st, nominal, apply } = game;
  const pro = st.devices[id].type === 'atem_pro';
  const a = st.atem;
  const at = (key, value) => apply({ op: 'atem', key, value });
  const map = { 1: null, 2: null, 3: null, 4: null };
  Object.entries(nominal.video.camAt).forEach(([n, c]) => { map[n] = c; });
  return (
    <Card title={pro ? 'ATEM Mini Pro' : 'ATEM Mini'} icon={Tv}>
      <Canvas2D w={480} h={270} draw={(ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const top = h * 0.6, half = w / 2;
        drawSource(ctx, map[a.preview] ? sourceOf(st, nominal, map[a.preview]) : null, 2, 2, half - 4, top - 4);
        drawSource(ctx, map[a.program] ? sourceOf(st, nominal, map[a.program]) : null, half + 2, 2, half - 4, top - 4);
        ctx.lineWidth = 4; ctx.strokeStyle = '#22c55e'; ctx.strokeRect(2, 2, half - 4, top - 4); ctx.strokeStyle = '#ef4444'; ctx.strokeRect(half + 2, 2, half - 4, top - 4);
        ctx.fillStyle = '#fff'; ctx.font = '700 13px sans-serif'; ctx.fillText('PVW', 8, top - 10); ctx.fillText('PGM', half + 8, top - 10);
        [1, 2, 3, 4].forEach((n, i) => { const x = i * (w / 4) + 2; drawSource(ctx, map[n] ? sourceOf(st, nominal, map[n]) : { kind: 'nosignal' }, x, top + 2, w / 4 - 4, h - top - 4); ctx.strokeStyle = n === a.program ? '#ef4444' : n === a.preview ? '#22c55e' : '#334155'; ctx.lineWidth = 3; ctx.strokeRect(x, top + 2, w / 4 - 4, h - top - 4); ctx.fillStyle = '#fff'; ctx.fillText(String(n), x + 4, top + 16); });
      }} deps={[JSON.stringify(map), a.program, a.preview, JSON.stringify(Object.values(nominal.ptz).map((r) => r.framing)), nominal.video.dark]} />
      <div className="text-[11px] text-slate-400">PROGRAM (방송 중)</div>
      <div className="flex gap-1">{[1, 2, 3, 4].map((n) => <button key={n} type="button" onClick={() => at('program', n)} className={`w-10 h-9 rounded font-bold ${a.program === n ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,.6)]' : 'bg-slate-700 text-slate-200'}`}>{n}</button>)}</div>
      <div className="text-[11px] text-slate-400">PREVIEW (다음 화면)</div>
      <div className="flex gap-1 items-center">{[1, 2, 3, 4].map((n) => <button key={n} type="button" onClick={() => at('preview', n)} className={`w-10 h-9 rounded font-bold ${a.preview === n ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{n}</button>)}
        <button type="button" onClick={() => at('cut')} className="ml-2 px-3 h-9 rounded bg-slate-100 text-slate-900 font-black">CUT</button>
        <button type="button" onClick={() => at('auto')} className="px-3 h-9 rounded bg-amber-500 text-slate-900 font-black">AUTO</button>
      </div>
      {pro && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Toggle on={a.streaming} color="red" onClick={() => at('streaming', !a.streaming)}>ON AIR</Toggle>
          <Toggle on={a.recording} color="red" onClick={() => at('recording', !a.recording)}>REC</Toggle>
          <Toggle on={a.pip} color="sky" onClick={() => at('pip', !a.pip)}>PIP</Toggle>
          <span className="text-[11px] text-slate-400 self-center">{a.streaming ? (nominal.stream.proLive ? '송출 정상' : !nominal.video.proNet ? '인터넷(LAN) 연결 없음' : !nominal.stream.proAudioOk ? '소리가 없음 (MIC 입력 확인)' : '영상 확인') : ''}</span>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------- 조명 콘솔 (Tiger Touch) ---------------------------- */
function TigerTouchPanel({ game, id }) {
  const { st, apply, show } = game;
  const cs = st.dev[id];
  const [tab, setTab] = React.useState('pb');
  const set = (key, value, visual = true) => apply({ op: 'dev', device: id, key, value }, { visual });
  const pr = cs.programmer ?? {};
  const toggleSel = (n) => { const sel = pr.sel ?? []; set('programmer.sel', sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n].sort()); };
  // 패치 편집: 종류 · 시작 주소(기본 = 다음 빈 주소) · 이름
  const [pType, setPType] = React.useState('par_led');
  const [pAddr, setPAddr] = React.useState(null);
  const [pLabel, setPLabel] = React.useState('');
  const pMax = 513 - FOOTPRINT[pType];
  const addr = Math.min(pAddr ?? nextDmxAddress(cs.patch), pMax);
  const clash = patchOverlap(cs.patch, pType, addr);
  const unpatched = Object.values(st.devices).filter((d) => d.placed && FOOTPRINT[d.type] && !cs.patch.some((e) => e.address === st.dev[d.id]?.address && e.type === d.type));
  const addPatch = () => {
    apply({ op: 'patchAdd', device: id, entry: { type: pType, address: addr, label: pLabel.trim() || `${DEVICE_TYPES[pType].name} ${cs.patch.length + 1}` } });
    setPAddr(null); setPLabel('');
  };
  return (
    <Card title="Avolites Tiger Touch II" icon={Lightbulb} right={<Seg small value={tab} options={[['pb', '플레이백'], ['prog', '프로그래머'], ['patch', '패치']]} onChange={setTab} />}>
      {tab === 'pb' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: Math.max(4, cs.playbacks.length) }, (_, i) => {
              const pb = cs.playbacks[i];
              return (
                <div key={i} className="shrink-0 w-14 flex flex-col items-center gap-1">
                  <div className="text-[9px] text-center text-slate-300 h-6 leading-tight">{pb ? pb.label : `PB ${i + 1}`}</div>
                  <input type="range" min={0} max={100} value={pb?.level ?? 0} disabled={!pb} aria-label={`플레이백 ${i + 1}`}
                    onChange={(e) => set(`playbacks.${i}.level`, Number(e.target.value), false)}
                    onPointerUp={(e) => show({ op: 'dev', device: id, key: `playbacks.${i}.level`, value: Number(e.currentTarget.value) }, 0)}
                    className="h-24 accent-orange-500" style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
                  <span className="text-[10px] font-mono text-slate-200">{pb?.level ?? 0}</span>
                  {pb && <span className="w-4 h-4 rounded-full border border-slate-600" style={{ background: pb.cue?.color ?? '#fff' }} />}
                </div>
              );
            })}
            <div className="shrink-0 w-14 flex flex-col items-center gap-1 border-l border-slate-700 pl-2">
              <div className="text-[9px] text-center text-rose-300 h-6">GRAND MASTER</div>
              <input type="range" min={0} max={100} value={cs.gm} aria-label="그랜드 마스터" onChange={(e) => set('gm', Number(e.target.value), false)}
                onPointerUp={(e) => show({ op: 'dev', device: id, key: 'gm', value: Number(e.currentTarget.value) }, 0)} className="h-24 accent-rose-500" style={{ writingMode: 'vertical-lr', direction: 'rtl' }} />
              <span className="text-[10px] font-mono">{cs.gm}</span>
            </div>
          </div>
          <Row label="BLACKOUT" hint="켜면 모든 조명이 즉시 꺼집니다."><Toggle on={cs.blackout} color="red" onClick={() => set('blackout', !cs.blackout)}>BLACKOUT</Toggle></Row>
        </>
      )}
      {tab === 'prog' && (
        <>
          <div className="text-[11px] text-slate-400">1) 조명 선택(SELECT)</div>
          <div className="flex flex-wrap gap-1">{cs.patch.map((e) => <Toggle key={e.n} small on={(pr.sel ?? []).includes(e.n)} color="sky" onClick={() => toggleSel(e.n)}>{e.n}. {e.label}</Toggle>)}</div>
          <div className="text-[11px] text-slate-400">2) 값 만들기</div>
          <HSlider label="밝기 (Intensity)" value={pr.intensity ?? 0} onChange={(v) => set('programmer.intensity', v, false)} onCommit={(p, v) => show({ op: 'dev', device: id, key: 'programmer.intensity', value: v }, p)} display={`${pr.intensity ?? 0}%`} accent="accent-amber-400" />
          <div className="flex flex-wrap gap-1">{COLORS.map(([c, n]) => <button key={c} type="button" title={n} aria-label={n} onClick={() => set('programmer.color', c)} className={`w-7 h-7 rounded-full border-2 ${pr.color === c ? 'border-white' : 'border-slate-700'}`} style={{ background: c }} />)}</div>
          <HSlider label="PAN (좌우)" value={pr.pan ?? 0} min={-90} max={90} onChange={(v) => set('programmer.pan', v, false)} onCommit={(p, v) => show({ op: 'dev', device: id, key: 'programmer.pan', value: v }, p)} display={`${pr.pan ?? 0}°`} />
          <HSlider label="TILT (상하)" value={pr.tilt ?? 0} min={-60} max={60} onChange={(v) => set('programmer.tilt', v, false)} onCommit={(p, v) => show({ op: 'dev', device: id, key: 'programmer.tilt', value: v }, p)} display={`${pr.tilt ?? 0}°`} />
          <div className="text-[11px] text-slate-400">3) RECORD → 저장할 플레이백 번호</div>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={!(pr.sel ?? []).length} onClick={() => apply({ op: 'lightRecord', device: id, index: n, label: cs.playbacks[n - 1]?.label ?? `큐 ${n}` })} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-bold">REC → PB {n}</button>)}
            <button type="button" onClick={() => set('programmer', { sel: [], intensity: null, color: null, pan: null, tilt: null })} className="px-2 py-1 rounded bg-slate-700 text-xs">CLEAR</button>
          </div>
          {pr.color && <div className="text-[11px] text-slate-300">현재 색: {COLOR_NAMES[colorFamily(pr.color)]}</div>}
        </>
      )}
      {tab === 'patch' && (
        <>
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400"><th className="text-left">번호</th><th className="text-left">이름</th><th>종류</th><th>주소</th><th>채널</th><th /></tr></thead>
            <tbody>{cs.patch.map((e) => (
              <tr key={e.n} className="text-slate-200 border-t border-slate-800">
                <td>{e.n}</td><td>{e.label}</td><td className="text-center">{DEVICE_TYPES[e.type]?.name}</td>
                <td className="text-center font-mono">{String(e.address).padStart(3, '0')}</td>
                <td className="text-center font-mono text-slate-400">{e.address}~{e.address + (FOOTPRINT[e.type] ?? 8) - 1}</td>
                <td className="text-right"><button type="button" onClick={() => apply({ op: 'patchRemove', device: id, n: e.n })} aria-label={`${e.n}번 패치 삭제`} className="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-red-700 text-[10px]">삭제</button></td>
              </tr>
            ))}</tbody>
          </table>
          {cs.patch.length === 0 && <div className="text-[11px] text-amber-300">패치가 비어 있습니다. 조명을 패치해야 프로그래머에서 고르고 켤 수 있습니다.</div>}
          <div className="rounded border border-slate-700 p-2 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300">조명 패치 추가</div>
            {unpatched.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">패치 안 된 조명:
                {unpatched.map((d) => <button key={d.id} type="button" onClick={() => { setPType(d.type); setPAddr(st.dev[d.id].address); setPLabel(d.name ?? ''); }} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">{d.name} ({String(st.dev[d.id].address).padStart(3, '0')})</button>)}
              </div>
            )}
            <Row label="종류"><Seg small value={pType} options={[['par_led', 'LED 파 (8ch)'], ['moving_head', '무빙 헤드 (16ch)']]} onChange={setPType} /></Row>
            <Row label="시작 주소" hint={`${String(addr).padStart(3, '0')} ~ ${String(addr + FOOTPRINT[pType] - 1).padStart(3, '0')}번 채널 · 조명기 본체 주소와 같아야 합니다.`}>
              <Stepper value={addr} min={1} max={pMax} onChange={setPAddr} fmt={(v) => String(v).padStart(3, '0')} label="패치 시작 주소" />
            </Row>
            <Row label="이름">
              <input type="text" value={pLabel} maxLength={20} onChange={(e) => setPLabel(e.target.value)} placeholder="예: 무대 앞 왼쪽" aria-label="패치 이름"
                className="w-36 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-100" />
            </Row>
            {clash && <div className="text-[11px] text-amber-300">⚠ {clash.n}번({clash.label})과 채널이 겹칩니다. 그대로 추가하면 패치 충돌이 납니다.</div>}
            <button type="button" onClick={addPatch} className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold">+ 패치 추가</button>
          </div>
          {st.unlimited && <p className="text-[10px] text-slate-500">스튜디오 모드에서는 조명을 놓으면 다음 빈 주소로 자동 패치됩니다. 직접 지우고 다시 패치해 볼 수도 있습니다.</p>}
        </>
      )}
      {game.nominal.light.conflicts.length > 0 && <div className="text-[11px] text-red-300">패치 충돌: 주소 범위가 겹칩니다.</div>}
    </Card>
  );
}

function FixturePanel({ game, id }) {
  const { st, nominal, apply } = game;
  const s = st.dev[id];
  const d = st.devices[id];
  const r = nominal.light.fixtures[id] ?? {};
  const fp = FOOTPRINT[d.type];
  const set = (key, value) => apply({ op: 'dev', device: id, key, value });
  const cs = st.dev[nominal.light.consoleId];
  const entry = cs?.patch?.find((e) => e.address === s.address && e.type === d.type);
  return (
    <Card title="조명기 설정" icon={Lightbulb}>
      <Row label="DMX 시작 주소" hint={`${fp}채널 모드: ${String(s.address).padStart(3, '0')} ~ ${String(s.address + fp - 1).padStart(3, '0')}번 채널 사용`}>
        <Stepper value={s.address} min={1} max={512 - fp + 1} onChange={(v) => set('address', v)} fmt={(v) => String(v).padStart(3, '0')} label="DMX 주소" />
      </Row>
      <Row label="전원"><Toggle on={s.power} color="green" onClick={() => set('power', !s.power)}>{s.power ? 'ON' : 'OFF'}</Toggle></Row>
      <Row label="DMX 터미네이터" hint="라인의 마지막 조명 OUT에 꽂아 신호 반사를 막습니다."><Toggle on={s.terminated} color="green" onClick={() => set('terminated', !s.terminated)}>{s.terminated ? '꽂힘' : '없음'}</Toggle></Row>
      <div className="text-[11px] space-y-0.5">
        <div className={r.receiving ? 'text-green-300' : 'text-amber-300'}>DMX 신호: {r.receiving ? `수신 중 (체인 ${r.depth}번째)` : '없음 — 케이블 확인'}</div>
        {r.flicker && <div className="text-red-300">깜빡임! {r.viaMic ? '라인 중간에 마이크(XLR) 케이블이 있습니다.' : '라인 끝 터미네이터가 필요합니다.'}</div>}
        {r.wrong && <div className="text-red-300">주소가 패치와 어긋나 다른 조명의 채널을 읽고 있습니다.</div>}
        <div className="text-slate-300">콘솔 패치: {entry ? `${entry.n}번 ${entry.label}` : '이 주소의 패치 없음'}</div>
        <div className="flex items-center gap-1 text-slate-300">출력: 밝기 {Math.round((r.intensity ?? 0) * 100)}% <span className="w-3 h-3 rounded-full inline-block" style={{ background: r.color ?? '#000' }} /></div>
      </div>
    </Card>
  );
}

/* ---------------------------- Resolume ---------------------------- */
function ResolumePanel({ game, id }) {
  const { st, apply, show } = game;
  const m = st.dev[id];
  const set = (key, value, visual = true) => apply({ op: 'dev', device: id, key, value }, { visual });
  const clipIds = Object.keys(CLIPS);
  return (
    <Card title="Resolume Arena" icon={Clapperboard}>
      <Canvas2D w={480} h={270} draw={(ctx, w, h) => drawComposition(ctx, m.playing ? m.layers : [], 0, 0, w, h, 0, { master: m.master })} deps={[JSON.stringify(m.layers), m.master, m.playing]} />
      <div className="text-[11px] text-slate-400">레이어는 아래(1)부터 위(3)로 겹칩니다. 위 레이어가 앞에 보입니다.</div>
      {[2, 1, 0].map((li) => {
        const l = m.layers[li];
        return (
          <div key={li} className="rounded border border-slate-700 p-1.5 space-y-1">
            <div className="flex items-center justify-between text-xs"><b className="text-rose-300">Layer {li + 1}</b><span className="font-mono text-slate-300">투명도 {l.opacity}</span></div>
            <div className="flex flex-wrap gap-1">
              {clipIds.map((c) => <button key={c} type="button" onClick={() => set(`layers.${li}.clip`, l.clip === c ? null : c)} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${l.clip === c ? 'text-slate-900' : 'bg-slate-800 text-slate-300'}`} style={l.clip === c ? { background: CLIPS[c].color } : undefined}>{CLIPS[c].name}</button>)}
            </div>
            <input type="range" min={0} max={100} value={l.opacity} aria-label={`레이어 ${li + 1} 투명도`} onChange={(e) => set(`layers.${li}.opacity`, Number(e.target.value), false)}
              onPointerUp={(e) => show({ op: 'dev', device: id, key: `layers.${li}.opacity`, value: Number(e.currentTarget.value) }, l.opacity)} className="w-full accent-rose-500" />
          </div>
        );
      })}
      <HSlider label="컴포지션 마스터" value={m.master} onChange={(v) => set('master', v, false)} accent="accent-rose-500" />
      <Row label="재생"><Toggle on={m.playing} color="green" onClick={() => set('playing', !m.playing)}>{m.playing ? '▶ PLAY' : '❚❚'}</Toggle></Row>
      <Row label="컴포지션 해상도" hint="출력할 화면(LED·프로젝터)의 해상도와 맞추세요."><Seg small value={m.compRes} options={[['1920x1080', '1920×1080'], ['1280x720', '1280×720']]} onChange={(v) => set('compRes', v)} /></Row>
      {['out1', 'out2'].map((o) => (
        <Row key={o} label={`출력 ${o === 'out1' ? '1 (HDMI OUT 1)' : '2 (HDMI OUT 2)'}`}>
          <Seg small value={m[o]} options={[['comp', '컴포지션'], ['layer1', 'L1'], ['layer2', 'L2'], ['layer3', 'L3'], ['off', 'OFF']]} onChange={(v) => set(o, v)} />
        </Row>
      ))}
    </Card>
  );
}

/* ---------------------------- PTZ 조이스틱 ---------------------------- */
function JoystickPanel({ game, id }) {
  const { st, nominal, apply } = game;
  const cs = st.dev[id];
  const [storeMode, setStoreMode] = React.useState(false);
  const camOf = (i) => Object.entries(nominal.ptz).find(([, r]) => r.reachable && r.index === i + 1)?.[0];
  const target = camOf(cs.selected);
  const cam = target ? st.dev[target] : null;
  const tally = (i) => { const c = camOf(i); if (!c) return null; if (nominal.video.programCam === c) return 'pgm'; if (nominal.video.previewCam === c) return 'pvw'; return null; };
  const T = target ? PTZ_TARGETS[st.venue]?.[st.devices[target].slot] : null;
  const padRef = useRef(null);
  const aim = (pan, tilt, zoom) => apply({ op: 'ptz', device: id, act: 'aim', pan, tilt, zoom }, { visual: false });
  // 카메라 목록 편집: 선택한 CAM의 IP 끝자리 · CAM 추가 · 네트워크에서 찾기
  const selIp = String(cs.cams[cs.selected] ?? '');
  const selNet = selIp.split('.').slice(0, 3).join('.') || String(cs.ip).split('.').slice(0, 3).join('.');
  const selLast = Number(selIp.split('.')[3]) || 1;
  const setCams = (cams) => apply({ op: 'dev', device: id, key: 'cams', value: cams });
  const found = discoverCams(st, id);
  const lastOf = (ip) => Number(String(ip).split('.')[3]) || 0;
  const drag = (e) => {
    if (!cam) return;
    const r = padRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    aim(Math.round(x * 2 * 90), Math.round(-y * 2 * 40), cam.zoom);
  };
  return (
    <Card title="PTZ 조이스틱 컨트롤러" icon={Joystick}>
      <div className="text-[11px] text-slate-400">카메라 선택 (빨강 = 방송 중, 초록 = PVW)</div>
      <div className="flex flex-wrap gap-1">
        {cs.cams.map((_, i) => {
          const t = tally(i);
          return <button key={i} type="button" onClick={() => apply({ op: 'ptz', device: id, act: 'select', value: i })}
            className={`w-12 h-10 rounded font-bold text-xs border-2 ${cs.selected === i ? 'border-sky-300' : 'border-transparent'} ${t === 'pgm' ? 'bg-red-600 text-white' : t === 'pvw' ? 'bg-green-600 text-white' : camOf(i) ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500'}`}>CAM {i + 1}</button>;
        })}
      </div>
      <div className="text-[11px] font-mono text-slate-400">대상 IP: {cs.cams[cs.selected] ?? '—'} · {target ? <span className="text-green-300">응답 있음</span> : <span className="text-red-300">응답 없음</span>}</div>
      <Row label={`CAM ${cs.selected + 1} IP 끝자리`} hint={`조이스틱 자신은 ${cs.ip} — 카메라 IP와 겹치면 안 됩니다.`}>
        <Stepper value={selLast} min={1} max={254} onChange={(v) => setCams(cs.cams.map((ip, i) => (i === cs.selected ? `${selNet}.${v}` : ip)))} fmt={(v) => `.${v}`} label="카메라 IP 끝자리" />
        {cs.cams.length < 8 && <button type="button" onClick={() => setCams([...cs.cams, `${selNet}.${Math.max(20, ...cs.cams.map(lastOf)) + 1}`])} className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">+ CAM</button>}
        {found.length > cs.cams.length && <button type="button" onClick={() => setCams(found)} className="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs">네트워크에서 찾기 (+{found.length - cs.cams.length})</button>}
      </Row>
      {tally(cs.selected) === 'pgm' && <div className="text-xs font-bold text-red-300 animate-pulse">⚠ 이 카메라는 지금 방송 중입니다! 움직이지 마세요.</div>}
      <div className="flex gap-3 items-center">
        <div ref={padRef} role="slider" aria-label="조이스틱 (PAN·TILT)" tabIndex={0}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); drag(e); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture?.(e.pointerId)) drag(e); }}
          onPointerUp={() => { if (cam) game.show({ op: 'ptz', device: id, act: 'aim' }, 0); }}
          onKeyDown={(e) => { if (!cam) return; const k = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, 2], ArrowDown: [0, -2] }[e.key]; if (k) { e.preventDefault(); aim(cam.pan + k[0], cam.tilt + k[1], cam.zoom); } }}
          className={`relative w-32 h-32 rounded-full border-2 ${cam ? 'border-slate-500 bg-slate-950 cursor-crosshair' : 'border-slate-800 bg-slate-900 opacity-50'} touch-none`}>
          {cam && <div className="absolute w-6 h-6 rounded-full bg-slate-200 border-2 border-slate-900 -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + (cam.pan / 180) * 100}%`, top: `${50 - (cam.tilt / 80) * 100}%` }} />}
          <span className="absolute inset-x-0 bottom-1 text-center text-[9px] text-slate-500">PAN · TILT</span>
        </div>
        <div className="flex-1 space-y-1">
          <HSlider label="ZOOM" value={Math.round((cam?.zoom ?? 0) * 100)} onChange={(v) => cam && aim(cam.pan, cam.tilt, v / 100)} display={`${Math.round((cam?.zoom ?? 0) * 100)}%`} />
          {cam && <div className="text-[11px] font-mono text-slate-300">PAN {cam.pan}° · TILT {cam.tilt}°</div>}
          {T && <div className="text-[11px] text-slate-300">구도: <b>{nominal.ptz[target]?.framing ? T[nominal.ptz[target].framing].label : '대상 없음'}</b></div>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <Toggle small on={storeMode} color="amber" onClick={() => setStoreMode(!storeMode)}>STORE</Toggle>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" disabled={!cam}
            onClick={() => { apply({ op: 'ptz', device: id, act: storeMode ? 'store' : 'recall', value: n }); setStoreMode(false); }}
            className={`w-9 h-8 rounded text-xs font-bold disabled:opacity-40 ${cam?.presets?.[n] ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>{n}</button>
        ))}
        <span className="text-[10px] text-slate-500">{storeMode ? '저장할 번호를 누르세요' : '번호 = 프리셋 불러오기'}</span>
      </div>
      {T && (
        <div className="text-[10px] text-slate-500">이 자리의 대표 구도: {Object.values(T).map((t) => `${t.label}(PAN ${t.pan}° TILT ${t.tilt}°)`).join(' · ')}</div>
      )}
    </Card>
  );
}

export { drawMeterBar };
