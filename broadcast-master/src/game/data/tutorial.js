/* =====================================================================
 * 튜토리얼 — 주제별 파트. 선배(서진)와 신입(하늘)이 대화하며 한 장면씩 진행한다.
 *  파트 하나 = src/game/data/tutorial/<이름>.js (export default { ... })
 *
 *  파트: { id, venue, title, summary, mission, devices, connections, inventory, state, objectives: [], talk, performing, steps }
 *   - devices/connections/inventory/state 형식은 스토리 스테이지(story.json)와 같다 (buildRuntime이 읽는다)
 *
 *  장면(step) 한 칸:
 *   say      화면에 보이고 읽어 주는 대사 (한두 문장)
 *   who      'senior'(선배 서진, 기본) | 'junior'(신입 하늘 — 학습자 입장에서 묻고 반응한다)
 *   show     설명 카드: { photo: 'mic_dynamic' } | { model: 'condenser_mic' } | { connector: 'xlr', female? }
 *            | { concept: 'balanced' } | { concept: 'strip', focus: 'gain' } (채널 스트립 그림에서 그 부분만 빛난다)
 *            | { items: [카드, 카드, (카드)] } — 카드마다 label 가능, 전체에 caption 가능
 *            photo id는 data/photos.js의 PHOTOS. 사진이 아직 없으면 그 항목의 model/connector 그림으로 대신한다
 *   quiz     { q, options: [..], answer: 정답 번호(0부터), explain } — 맞히면 칭찬 후 다음, 틀리면 설명을 보여 주고 다시
 *   lab      { lab: 'fade' | 'eq' | 'fx', goal } — 실습실을 열어 직접 만져 본다 (닫으면 다음)
 *   focus    장비 id — 카메라가 그 장비로 다가간다
 *   op ...   조작 (place, connect, dev, ch, master, fade, move, atem, obs, ptz, talk, perform, wait …)
 *   practice "직접 해 보세요" 안내. 이게 있는 조작 장면은 직접 해보기가 켜져 있으면 플레이어가 해낼 때까지 기다린다
 * ===================================================================== */
import sound from './tutorial/sound.js';
import mic from './tutorial/mic.js';
import cable from './tutorial/cable.js';
import mixer from './tutorial/mixer.js';
import speaker from './tutorial/speaker.js';
import instrument from './tutorial/instrument.js';
import stream from './tutorial/stream.js';
import show from './tutorial/show.js';

export const TUTORIAL = [sound, mic, cable, mixer, speaker, instrument, stream, show];

// 말하는 사람
export const SPEAKERS = {
  senior: { name: '서진 선배', role: '음향·영상 엔지니어' },
  junior: { name: '하늘', role: '오늘 처음 온 신입' },
};

// 설명 카드에 쓸 수 있는 개념 그림 (eduVisuals.jsx의 CONCEPT 키) · 실습실
export const CONCEPT_KEYS = ['strip', 'flow', 'gain', 'feedback', 'pgmpvw', 'levels', 'camsettings', 'multiview', 'transitions', 'balanced', 'cablemap', 'cablecare', 'dmx', 'layers', 'ipnet'];
export const LABS = ['fade', 'eq', 'fx'];
// strip 그림에서 빛낼 수 있는 부분
export const STRIP_PARTS = ['input', 'phantom', 'pad', 'gain', 'lowcut', 'comp', 'high', 'mid', 'low', 'aux', 'fx', 'pan', 'mute', 'pfl', 'fader', 'master'];

// 짧은 한마디 (미리 녹음해 둔다)
export const STOCK = {
  praise: ['좋아요, 잘했어요!', '바로 그거예요.', '오, 손이 빠른데요?', '완벽해요.'],
  wrong: ['음, 아까워요. 다시 골라 볼까요?', '거의 다 왔어요. 한 번만 더 생각해 봐요.'],
};
