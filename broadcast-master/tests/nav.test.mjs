import test from 'node:test';
import assert from 'node:assert/strict';
import { screenFromUrl, urlOf, sameScreen, parentOf } from '../src/game/nav.js';

const loc = (search = '', hash = '', pathname = '/ch/') => ({ pathname, search, hash });

test('nav: every screen survives a round trip through the address', () => {
  const screens = [
    { mode: 'menu' }, { mode: 'dict' }, { mode: 'dict', entry: 'dynamic_mic' }, { mode: 'tutorial' }, { mode: 'tutorial', part: 0 }, { mode: 'tutorial', part: 7 },
    { mode: 'story' }, { mode: 'story', stage: 'light-2' }, { mode: 'studio' },
  ];
  for (const s of screens) {
    const url = urlOf(s, loc());
    const back = screenFromUrl(url.slice(url.indexOf('?') >= 0 ? url.indexOf('?') : url.length));
    assert.ok(sameScreen(back, s), `${JSON.stringify(s)} → ${url} → ${JSON.stringify(back)}`);
  }
  assert.equal(urlOf({ mode: 'menu' }, loc()), '/ch/');
  assert.equal(urlOf({ mode: 'dict' }, loc()), '/ch/?dict');
  assert.equal(urlOf({ mode: 'tutorial', part: 2 }, loc()), '/ch/?tutorial=3');
});

test('nav: the host page keeps its own query and hash; the game keys are replaced', () => {
  assert.equal(urlOf({ mode: 'dict', entry: 'xlr' }, loc('?token=a&x=1', '#top')), '/ch/?token=a&x=1&dict=xlr#top');
  assert.equal(urlOf({ mode: 'menu' }, loc('?token=a&dict=xlr&auto=1')), '/ch/?token=a');
  assert.equal(urlOf({ mode: 'story', stage: 'ptz-1' }, loc('?stage=light-2&auto=1')), '/ch/?stage=ptz-1');
});

test('nav: older links still open the right screen', () => {
  assert.deepEqual(screenFromUrl('?stage=light-2&auto=1'), { mode: 'story', stage: 'light-2', auto: true });
  assert.deepEqual(screenFromUrl('?tutorial=1'), { mode: 'tutorial', part: 0 });
  assert.deepEqual(screenFromUrl('?tutorial'), { mode: 'tutorial', part: undefined });
  assert.deepEqual(screenFromUrl('?dict='), { mode: 'dict', entry: null });
  assert.deepEqual(screenFromUrl('?token=a'), { mode: 'menu' });
});

test('nav: the list is the parent of an entry, a mission and a tutorial part', () => {
  assert.deepEqual(parentOf({ mode: 'dict', entry: 'xlr' }), { mode: 'dict' });
  assert.deepEqual(parentOf({ mode: 'story', stage: 'seminar-1' }), { mode: 'story' });
  assert.deepEqual(parentOf({ mode: 'tutorial', part: 0 }), { mode: 'tutorial' });
  assert.equal(parentOf({ mode: 'dict' }), null);
  assert.equal(parentOf({ mode: 'menu' }), null);
  assert.ok(sameScreen({ mode: 'tutorial', part: undefined }, { mode: 'tutorial', part: null }));
});
