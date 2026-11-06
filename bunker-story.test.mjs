import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceBunkerStory, BUNKER_ALLIES, BUNKER_BODIES, BUNKER_OBJECTIVES,
  BUNKER_THREATS, bunkerCheckpoint, bunkerSummary, createBunkerStory, getBunkerObjective,
} from './bunker-story.js';

function playUntil(state, choices, stopAt) {
  let current = getBunkerObjective(state);
  while (current && current.id !== stopAt) {
    const result = advanceBunkerStory(state, {id:current.id, choice:choices[current.id]});
    assert.equal(result.ok, true, `Advance ${current.id}`);
    if (current.kind === 'lift') assert.equal(result.effects.nextFloor, state.floor);
    current = getBunkerObjective(state);
  }
}

test('starts with three distinct body inspections and rejects skipped objectives or invalid choices', () => {
  const state = createBunkerStory();
  assert.deepEqual(BUNKER_OBJECTIVES.slice(0, 3).map(goal => goal.id), BUNKER_BODIES.map(body => body.id));
  assert.equal(new Set(BUNKER_BODIES.map(body => `${body.x},${body.z}`)).size, 3);
  assert.equal(advanceBunkerStory(state, {id:'blast-door'}).ok, false);
  assert.equal(state.step, 0);
  playUntil(state, {}, 'mara');
  const before = bunkerCheckpoint(state);
  assert.equal(advanceBunkerStory(state, {id:'mara', choice:'invalid'}).ok, false);
  assert.deepEqual(bunkerCheckpoint(state), before);
});

test('rescued engineer changes the risk of a live call and all allies can survive', () => {
  const state = createBunkerStory();
  const choices = {mara:'shelter', ivo:'rescue', noor:'broadcast'};
  playUntil(state, choices, 'noor');
  assert.equal(state.floor, 2);
  assert.match(getBunkerObjective(state).choices[1].detail, /protect Noor/);
  playUntil(state, choices);
  assert.equal(state.phase, 'won');
  assert.equal(getBunkerObjective(state), null);
  for (const ally of BUNKER_ALLIES) {
    assert.equal(state.survivors[ally.id], 'sheltered');
    assert.match(bunkerSummary(state), new RegExp(ally.name));
  }
  assert.match(bunkerSummary(state), /answered Noor’s live call/);
});

test('leaving allies exposed changes their outcomes at the breaker and Warden encounter', () => {
  const state = createBunkerStory();
  const choices = {mara:'leave', ivo:'seal', noor:'broadcast'};
  playUntil(state, choices, 'power');
  assert.equal(state.survivors.mara, 'at-risk');
  const breaker = advanceBunkerStory(state, {id:'power'});
  assert.deepEqual(breaker.effects, {ally:'mara', outcome:'lost', pose:'fallen'});
  playUntil(state, choices, 'noor');
  assert.match(getBunkerObjective(state).choices[1].detail, /will reach Noor/);
  playUntil(state, choices, 'warden');
  assert.equal(state.survivors.noor, 'at-risk');
  const threat = advanceBunkerStory(state, {id:'warden'});
  assert.deepEqual(threat.effects, {ally:'noor', outcome:'lost', pose:'fallen'});
  playUntil(state, choices);
  assert.deepEqual(Object.values(state.survivors), ['lost', 'lost', 'lost']);
  assert.match(bunkerSummary(state), /No allies made it to shelter/);
  assert.match(bunkerSummary(state), /answered Noor’s live call/);
});

test('shielding Noor saves her even with backup offline and checkpoint restores the exact route', () => {
  const state = createBunkerStory();
  const choices = {mara:'leave', ivo:'seal', noor:'shield'};
  playUntil(state, choices, 'warden');
  const saved = JSON.parse(JSON.stringify(bunkerCheckpoint(state)));
  const restored = createBunkerStory(saved);
  assert.deepEqual(restored, state);
  assert.equal(restored.survivors.noor, 'sheltered');
  assert.equal(restored.flags.backup, false);
  playUntil(restored, choices);
  assert.equal(restored.flags.transfer, true);
  assert.match(bunkerSummary(restored), /relay forwarded/);
  assert.deepEqual(createBunkerStory(bunkerCheckpoint(restored)), restored);
  assert.equal(getBunkerObjective(createBunkerStory({...saved, decisions:{}})).id, 'mara');
  assert.deepEqual(createBunkerStory({version:1, step:-1}), createBunkerStory());
});

test('each mandatory threat and ally has an objective at its own level and position', () => {
  for (const actor of [...BUNKER_THREATS, ...BUNKER_ALLIES]) {
    const goal = BUNKER_OBJECTIVES.find(candidate => candidate.id === actor.id);
    assert.deepEqual([goal.floor, goal.x, goal.z], [actor.floor, actor.x, actor.z]);
  }
});
