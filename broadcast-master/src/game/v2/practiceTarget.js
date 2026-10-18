/* =====================================================================
 * 튜토리얼 연습: 지금 단계에서 플레이어가 눌러야 할 단추 찾기
 *
 * 장비 패널(DevicePanels.jsx)·믹서 콘솔(Console.jsx)의 조작 부품에는
 * data-ctl 이름이 붙어 있다.
 *   장비 설정 (op dev)   `${장비}-${key}`            예: light-playbacks.0.level
 *   여러 선택지 중 하나    `${장비}-${key}-${값}`       예: vj-layers.2.clip-logo
 *   PTZ 카메라 IP        `${카메라}-ip-${대역}` (예: cam1-ip-192.168.1) · `${카메라}-ip-last`
 *   ATEM                 `${스위처}-program-${n}` · `-preview-${n}` · `-cut` · `-auto` · `-streaming` · `-recording` · `-pip`
 *   OBS (송출 PC 패널)    `${pc}-obs-${key}` (+ `-${값}`)
 *   PTZ 조이스틱          `${조이스틱}-ptz-select-${i}` · `-ptz-aim` · `-ptz-zoom` · `-ptz-store` · `-ptz-preset-${n}`
 *   자리 옮기기           `${장비}-move-${자리}`
 *   케이블 분리           `${패널 장비}-disconnect-${from}>${to}` (연결이 저장된 방향 그대로)
 *   조명 콘솔 탭          `${콘솔}-tab-pb` · `-tab-prog` · `-tab-patch`
 *   조명 콘솔 저장·패치    `${콘솔}-lightRecord-${n}` · `-patchAdd` · `-patchRemove-${n}`
 *   놓기                 미션 탭의 "+ 배치" 단추 `mission-place-${장비}` (장비 패널 안의 `${장비}-place`는 다음 후보)
 *
 * ctlKeysOf는 앞에서부터 찾아볼 이름 목록(가장 구체적인 것부터)을,
 * panelDeviceOf는 그 단추가 들어 있는 패널의 장비를 돌려준다.
 * 아무것도 가져오지 않는다 (sim.js와 같은 규칙을 여기 그대로 쓴다).
 * ===================================================================== */

const endOf = (s) => { const [d, p] = String(s ?? '').split('.'); return { d, p: p ?? null }; };
const getPath = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const connKey = (c) => `${c.from.d}.${c.from.p}>${c.to.d}.${c.to.p}`;

// 송출 PC: 놓인 PC가 먼저, 없으면 아무 PC
export function pcIdOf(st) {
  const devs = Object.values(st?.devices ?? {});
  return (devs.find((d) => d.placed && d.type === 'pc') ?? devs.find((d) => d.type === 'pc'))?.id ?? null;
}

// 단추가 들어 있는 패널의 장비 (믹서 콘솔·케이블 잇기·놓기처럼 장비 패널이 아닌 단계는 null)
export function panelDeviceOf(step, st) {
  if (!step) return null;
  switch (step.op) {
    case 'atem': return step.switcher ?? st?.switcherId ?? null;
    case 'obs': return pcIdOf(st);
    case 'dev': case 'ptz': case 'move': case 'lightRecord': case 'patchAdd': case 'patchRemove': return step.device ?? null;
    case 'disconnect': return endOf(step.from).d || null;
    default: return null;
  }
}

// 여러 선택지 중 하나를 고르는 장비 설정 (Seg·색 단추 등): 이름 뒤에 값이 붙는다
const CHOICE_KEY = /^(programmer\.color|compRes|out\d)$/;
// 조명 콘솔: 그 조작이 들어 있는 탭 (탭이 닫혀 있으면 탭 단추부터 짚는다)
const consoleTab = (key) => (/^programmer(\.|$)/.test(key) ? 'prog' : /^(playbacks\.\d+\.level|gm|blackout)$/.test(key) ? 'pb' : null);

function devKeys(step, st) {
  const d = step.device, k = String(step.key), v = step.value;
  const cur = st?.dev?.[d];
  const keys = [];
  if (k === 'programmer.sel') {
    // 아직 안 고른 것(또는 빼야 할 것)부터 하나씩
    const want = Array.isArray(v) ? v : v == null ? [] : [v];
    const now = cur?.programmer?.sel ?? [];
    const flip = [...want.filter((n) => !now.includes(n)), ...now.filter((n) => !want.includes(n))];
    flip.forEach((n) => keys.push(`${d}-${k}-${n}`));
    keys.push(`${d}-${k}`);
  } else if (/^layers\.\d+\.clip$/.test(k)) {
    // 켜진 클립을 다시 누르면 비워진다 → 값이 null이면 지금 켜진 클립 단추
    const c = v ?? getPath(cur, k);
    if (c != null) keys.push(`${d}-${k}-${c}`);
    keys.push(`${d}-${k}`);
  } else if (k === 'ip') {
    // PTZ IP: 대역(앞 세 자리)은 선택지, 끝자리는 위아래 단추
    const net = String(v ?? '').split('.').slice(0, 3).join('.');
    const nowNet = String(cur?.ip ?? '').split('.').slice(0, 3).join('.');
    if (net && net !== nowNet) keys.push(`${d}-ip-${net}`);
    keys.push(`${d}-ip-last`, `${d}-ip`);
  } else if (CHOICE_KEY.test(k)) {
    keys.push(`${d}-${k}-${v}`, `${d}-${k}`);
  } else {
    keys.push(`${d}-${k}`);
  }
  const type = st?.devices?.[d]?.type;
  const tab = !type || type === 'lighting_console' ? consoleTab(k) : null;
  if (tab) keys.push(`${d}-tab-${tab}`);
  return keys;
}

// 앞에서부터 찾아볼 data-ctl 이름 목록 (가장 구체적인 것부터). 모르는 단계는 []
export function ctlKeysOf(step, st) {
  if (!step) return [];
  const d = step.device;
  switch (step.op) {
    case 'dev': return d && step.key != null ? devKeys(step, st) : [];
    case 'atem': {
      const sw = panelDeviceOf(step, st);
      if (!sw) return [];
      return step.key === 'program' || step.key === 'preview' ? [`${sw}-${step.key}-${step.value}`] : [`${sw}-${step.key}`];
    }
    case 'obs': {
      const pc = pcIdOf(st);
      if (!pc) return [];
      const base = `${pc}-obs-${step.key}`;
      return step.key === 'video' || step.key === 'audio' ? [`${base}-${step.value}`, base] : [base];
    }
    case 'ptz':
      switch (step.act) {
        case 'select': return [`${d}-ptz-select-${step.value}`];
        case 'aim': return step.zoom != null ? [`${d}-ptz-aim`, `${d}-ptz-zoom`] : [`${d}-ptz-aim`];
        case 'store': return [`${d}-ptz-store`, `${d}-ptz-preset-${step.value}`];
        case 'recall': return [`${d}-ptz-preset-${step.value}`];
        default: return [];
      }
    case 'place': return d ? [`mission-place-${d}`, `${d}-place`] : [];
    case 'move': return [`${d}-move-${step.slot}`];
    case 'disconnect': {
      const a = endOf(step.from), b = endOf(step.to);
      const same = (x, y) => x.d === y.d && x.p === y.p;
      const c = (st?.connections ?? []).find((x) => (step.id && x.id === step.id) || (same(x.from, a) && same(x.to, b)) || (same(x.from, b) && same(x.to, a)));
      const ids = c ? [connKey(c)] : [`${step.from}>${step.to}`, `${step.to}>${step.from}`];
      const owners = c ? [c.from.d, c.to.d] : [a.d, b.d];
      // 어느 쪽 장비 패널에서든 분리할 수 있다 (연습 문구가 가리키는 from 쪽이 먼저)
      const order = owners[0] === a.d ? owners : [owners[1], owners[0]];
      return order.flatMap((o) => ids.map((id) => `${o}-disconnect-${id}`));
    }
    case 'lightRecord': return [`${d}-lightRecord-${step.index}`, `${d}-tab-prog`];
    case 'patchAdd': return [`${d}-patchAdd`, `${d}-tab-patch`];
    case 'patchRemove': return [`${d}-patchRemove-${step.n}`, `${d}-tab-patch`];
    // 믹서 콘솔 (Console.jsx): GameScreen이 쓰던 규칙과 같다
    case 'fade': return step.ch ? [`ch${step.ch}-fader`, `ch${step.ch}`] : ['master-mainFader', 'master'];
    case 'master': return [`master-${step.key}`, 'master'];
    case 'ch': return [`ch${step.ch}-${step.key}`, `ch${step.ch}`];
    default: return [];
  }
}

// 화면에서 첫 번째로 찾은 단추 { el, key } (없으면 null)
export function findPracticeTarget(step, st, root = globalThis.document) {
  if (!root?.querySelector) return null;
  for (const key of ctlKeysOf(step, st)) {
    const el = root.querySelector(`[data-ctl="${String(key).replace(/["\\]/g, '\\$&')}"]`);
    // STORE가 이미 켜져 있으면 (조이스틱 패널 안의 상태라 st에 없다) 다음 이름 = 저장할 번호로
    if (el && /-ptz-store$/.test(key) && el.getAttribute?.('aria-pressed') === 'true') continue;
    // 불러오기인데 STORE가 켜져 있으면 번호를 누르는 순간 저장돼 버린다 → STORE부터 꺼야 한다
    if (el && step.op === 'ptz' && step.act === 'recall') {
      const store = root.querySelector(`[data-ctl="${String(step.device).replace(/["\\]/g, '\\$&')}-ptz-store"]`);
      if (store?.getAttribute?.('aria-pressed') === 'true') return { el: store, key: `${step.device}-ptz-store` };
    }
    if (el) return { el, key };
  }
  return null;
}
