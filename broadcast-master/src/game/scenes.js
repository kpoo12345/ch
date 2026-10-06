/* =====================================================================
 * 화면 그림 (Canvas 2D) — 카메라 샷, VJ 클립, 방송·멀티뷰 화면
 * 3D 모니터 텍스처와 2D 패널 미리보기가 같은 그림을 쓴다.
 * ===================================================================== */
import { PTZ_TARGETS } from './sim.js';

export const FONT = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

const VENUE_LOOK = {
  seminar: { wall: ['#334155', '#1e293b'], shirt: '#3b5b8f', label: '세미나실' },
  youtube_room: { wall: ['#4c1d95', '#1e1b4b'], shirt: '#be185d', label: '1인 스튜디오' },
  church: { wall: ['#e7dcc8', '#a8916c'], shirt: '#1f2937', label: '예배당' },
  live_stage: { wall: ['#111827', '#020617'], shirt: '#111827', label: '공연장' },
  lecture_hall: { wall: ['#1e3a8a', '#0f172a'], shirt: '#3b5b8f', label: '강의 스튜디오' },
  sandbox: { wall: ['#334155', '#0f172a'], shirt: '#3b5b8f', label: '스튜디오' },
};

function person(ctx, cx, cy, s, shirt, skin = '#e0b896') {
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(cx, cy + s * 1.15, s * 0.95, s * 0.75, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.42, Math.PI, 0); ctx.fill();
}

// shot: 'closeup' | 'wide' | 'misframe' | 'leader' | 'choir' | 'band'
export function drawShot(ctx, venue, shot, x, y, w, h, { dark = false, label } = {}) {
  const L = VENUE_LOOK[venue] ?? VENUE_LOOK.sandbox;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, L.wall[0]); g.addColorStop(1, L.wall[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (venue === 'church') {
    ctx.fillStyle = '#7c4f2a'; ctx.fillRect(x + w * 0.48, y + h * 0.05, w * 0.04, h * 0.45); ctx.fillRect(x + w * 0.42, y + h * 0.15, w * 0.16, h * 0.05);
  }
  if (venue === 'live_stage') {
    ['#f472b6', '#60a5fa', '#facc15'].forEach((c, i) => {
      const gg = ctx.createRadialGradient(x + w * (0.2 + i * 0.3), y, 2, x + w * (0.2 + i * 0.3), y, h);
      gg.addColorStop(0, `${c}99`); gg.addColorStop(1, 'transparent'); ctx.fillStyle = gg; ctx.fillRect(x, y, w, h);
    });
  }
  if (venue === 'youtube_room') {
    ctx.fillStyle = 'rgba(244,114,182,.7)'; ctx.font = `800 ${Math.round(h * 0.09)}px ${FONT}`; ctx.fillText('ON AIR ♪', x + w * 0.62, y + h * 0.2);
  }
  if (shot === 'misframe') {
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `600 ${Math.round(h * 0.07)}px ${FONT}`; ctx.fillText('(빈 벽 — 구도가 맞지 않음)', x + w * 0.06, y + h * 0.5);
  } else if (shot === 'closeup' || shot === 'leader') {
    person(ctx, x + w / 2, y + h * 0.42, h * 0.3, shot === 'leader' ? '#e2e8f0' : L.shirt);
  } else if (shot === 'choir') {
    [0.25, 0.42, 0.58, 0.75].forEach((px) => person(ctx, x + w * px, y + h * 0.5, h * 0.12, '#7c2d12'));
  } else if (shot === 'band') {
    person(ctx, x + w * 0.5, y + h * 0.48, h * 0.15, '#111827');
    person(ctx, x + w * 0.22, y + h * 0.55, h * 0.13, '#7f1d1d');
    person(ctx, x + w * 0.78, y + h * 0.55, h * 0.13, '#065f46');
  } else {
    // 와이드: 무대 전체
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
    person(ctx, x + w * 0.45, y + h * 0.55, h * 0.1, L.shirt);
    if (venue === 'church' || venue === 'live_stage') { person(ctx, x + w * 0.62, y + h * 0.57, h * 0.09, '#e2e8f0'); person(ctx, x + w * 0.3, y + h * 0.58, h * 0.08, '#7c2d12'); }
  }
  if (dark) { ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = `600 ${Math.round(h * 0.06)}px ${FONT}`; ctx.fillText('조명 부족 — 너무 어두움', x + 10, y + 26); }
  if (label) { ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `600 ${Math.round(h * 0.065)}px ${FONT}`; ctx.fillText(label, x + 10, y + h - 10); }
  ctx.restore();
}

/* ---------------------------- VJ 클립 ---------------------------- */
export const CLIPS = {
  worship_bg: { name: '찬양 배경 (빛줄기)', color: '#f59e0b' },
  lyrics: { name: '가사 (주 하나님 지으신…)', color: '#f8fafc' },
  logo: { name: '교회 로고', color: '#38bdf8' },
  concert: { name: '공연 비주얼 (네온)', color: '#f472b6' },
  waves: { name: '파도 루프', color: '#22d3ee' },
  countdown: { name: '카운트다운', color: '#a78bfa' },
};
export function drawClip(ctx, clip, x, y, w, h, t = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  switch (clip) {
    case 'worship_bg': {
      const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#78350f'); g.addColorStop(1, '#1c1917');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 6; i += 1) {
        ctx.fillStyle = `rgba(253,230,138,${0.08 + (i % 3) * 0.03})`;
        ctx.beginPath(); ctx.moveTo(x + w * 0.5, y - 10); ctx.lineTo(x + w * (0.05 + i * 0.18 + Math.sin(t + i) * 0.02), y + h); ctx.lineTo(x + w * (0.12 + i * 0.18), y + h); ctx.fill();
      }
      break;
    }
    case 'lyrics':
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x, y + h * 0.62, w, h * 0.3);
      ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(h * 0.085)}px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('주 하나님 지으신 모든 세계', x + w / 2, y + h * 0.74);
      ctx.fillText('내 마음 속에 그리어 볼 때', x + w / 2, y + h * 0.86); ctx.textAlign = 'left';
      break;
    case 'logo':
      ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.arc(x + w * 0.9, y + h * 0.13, h * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(h * 0.05)}px ${FONT}`; ctx.fillText('LOGO', x + w * 0.78, y + h * 0.25);
      break;
    case 'concert': {
      ctx.fillStyle = '#0b0218'; ctx.fillRect(x, y, w, h);
      for (let i = 0; i < 14; i += 1) {
        ctx.strokeStyle = ['#f472b6', '#60a5fa', '#a78bfa', '#facc15'][i % 4]; ctx.lineWidth = Math.max(2, h * 0.012);
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, (h * 0.06) * (i + 1) + (t * 30) % (h * 0.06), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(h * 0.12)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('LIVE', x + w / 2, y + h / 2 + h * 0.04); ctx.textAlign = 'left';
      break;
    }
    case 'waves': {
      ctx.fillStyle = '#082f49'; ctx.fillRect(x, y, w, h);
      for (let k = 0; k < 5; k += 1) {
        ctx.strokeStyle = `rgba(34,211,238,${0.3 + k * 0.12})`; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i <= 40; i += 1) { const px = x + (i / 40) * w; const py = y + h * (0.3 + k * 0.12) + Math.sin(i / 4 + t * 2 + k) * h * 0.04; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.stroke();
      }
      break;
    }
    case 'countdown':
      ctx.fillStyle = '#1e1b4b'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#c4b5fd'; ctx.font = `900 ${Math.round(h * 0.3)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(`0${Math.max(0, 5 - Math.floor(t % 6))}`, x + w / 2, y + h * 0.62); ctx.textAlign = 'left';
      break;
    default: break;
  }
  ctx.restore();
}
// Resolume 컴포지션: 아래 레이어부터 위로 겹친다 (레이어 1이 맨 아래)
export function drawComposition(ctx, layers, x, y, w, h, t = 0, { master = 100 } = {}) {
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
  (layers ?? []).forEach((l) => { if (l.clip && l.opacity > 0) drawClip(ctx, l.clip, x, y, w, h, t, (l.opacity / 100) * (master / 100)); });
}

export function drawNoSignal(ctx, x, y, w, h, text = 'NO SIGNAL') {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + (i * w) / 7, y, w / 7 + 1, h * 0.75); });
  ctx.fillStyle = '#111'; ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(h * 0.09)}px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, y + h * 0.92); ctx.textAlign = 'left';
}

// 비디오 소스 하나를 그린다 (카메라 샷 / 미디어 서버 / 없음)
export function drawSource(ctx, src, x, y, w, h, t = 0) {
  if (!src) { ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#64748b'; ctx.font = `600 ${Math.round(h * 0.08)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('BLACK', x + w / 2, y + h / 2); ctx.textAlign = 'left'; return; }
  if (src.kind === 'nosignal') { drawNoSignal(ctx, x, y, w, h); return; }
  if (src.kind === 'vj') { drawComposition(ctx, src.layers, x, y, w, h, t, { master: src.master }); return; }
  drawShot(ctx, src.venue, src.shot, x, y, w, h, { dark: src.dark, label: src.label });
  if (src.overlay) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y, w, h * 0.09); ctx.fillRect(x, y + h * 0.91, w, h * 0.09);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(h * 0.05)}px ${FONT}`; ctx.fillText('4K 30p  ▮▮▮▯ 87%   F2.8  1/60  ISO800', x + 8, y + h * 0.065);
  }
}

export function drawMeterBar(ctx, x, y, w, h, level) {
  ctx.fillStyle = '#0b0d10'; ctx.fillRect(x, y, w, h);
  if (level == null) return;
  const pct = Math.max(0, Math.min(1, (level + 60) / 66));
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#16a34a'); g.addColorStop(0.81, '#22c55e'); g.addColorStop(0.82, '#eab308'); g.addColorStop(0.9, '#eab308'); g.addColorStop(0.91, '#ef4444');
  ctx.fillStyle = g; ctx.fillRect(x, y, w * pct, h);
}

// 소스 설명 객체 만들기: sim 결과 + 상태 → 각 ATEM 입력/카메라가 무엇을 보여 주는지
const SHOT_BY_SLOT = {
  presenter_mic: 'closeup', cam1: 'closeup', cam_tripod: 'closeup', cam2: 'wide', cam_back: 'wide', cam_rear: 'wide', cam_stage: 'band',
};
export function sourceOf(st, sim, id) {
  const d = st.devices[id];
  if (!d) return null;
  if (d.type === 'media_server') { const m = st.dev[id]; return { kind: 'vj', layers: m.playing ? m.layers : [], master: m.master }; }
  let shot = SHOT_BY_SLOT[d.slot] ?? 'wide';
  if (d.type === 'ptz' && PTZ_TARGETS[st.venue]?.[d.slot]) {
    // 구도 목표가 있는 PTZ 자리: 현재 PAN/TILT/ZOOM이 무엇을 잡고 있는지 그린다
    const f = sim.ptz?.[id]?.framing ?? null;
    shot = f == null ? 'misframe' : f === 'wide' ? 'wide' : f === 'pastor' || f === 'host' || f === 'singer' ? 'closeup' : f === 'leader' ? 'leader' : f === 'choir' ? 'choir' : 'band';
  }
  return { kind: 'cam', venue: st.venue, shot, dark: !!sim.video?.dark, overlay: d.type === 'mirrorless' && !st.dev[id]?.clean, label: d.name };
}
