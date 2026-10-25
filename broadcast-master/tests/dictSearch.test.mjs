import test from 'node:test';
import assert from 'node:assert/strict';
import { EDU_ITEMS } from '../src/game/eduContent.js';
import { buildIndex, searchItems } from '../src/game/dictSearch.js';

const index = buildIndex(EDU_ITEMS);
const ids = (q) => searchItems(index, q).map((r) => r.x.id);
const first = (q) => ids(q)[0];

test('dictionary search: the words players meet in the game find their entry first', () => {
  const cases = {
    블랙아웃: 'lighting_console', blackout: 'lighting_console', programmer: 'lighting_console', cue: 'lighting_console',
    GM: 'lighting_console', 'phantom power': 'condenser_mic', phantom: 'condenser_mic', 팬텀: 'condenser_mic',
    디아이: 'di_box', hum: 'balanced', preset: 'ptz', camera: 'camera', fader: 'channelstrip',
  };
  for (const [q, want] of Object.entries(cases)) {
    const got = ids(q);
    assert.ok(got.length, `"${q}" finds something`);
    assert.ok(EDU_ITEMS.some((x) => x.id === want), `entry ${want} exists`);
    assert.equal(got[0], want, `"${q}" → ${got.slice(0, 3).join(', ')}`);
  }
});

test('dictionary search: "snake" finds the snake, stage box and fanout entries', () => {
  const got = ids('snake');
  for (const id of ['cable_multi', 'stage_box', 'snake_fanout']) assert.ok(got.includes(id), `${id} in ${got.join(', ')}`);
});

test('dictionary search: short Latin queries match word starts only', () => {
  assert.ok(!ids('GM').includes('pgmpvw'), 'GM does not hit PGM');
  assert.equal(first('DI'), 'di_box');
  assert.ok(ids('EQ').length > 0);
  assert.ok(ids('48').includes('condenser_mic'), '+48V by its digits');
});

test('dictionary search: Korean initials and the earlier aliases still work', () => {
  assert.equal(first('ㄷㅇㄴㅁ'), 'dynamic_mic');
  assert.equal(first('캐논'), 'cable_xlr');
  assert.ok(ids('Tiger Touch').includes('lighting_console'));
});
