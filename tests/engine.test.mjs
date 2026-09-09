import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  roles,
  legal,
  apply,
  view,
  observation,
  demoDecision,
  killTarget,
  winner,
  beginNight,
} from '../lib/game/engine-v1.mjs';
function game() {
  return createGame({ mode: 'director', assigned: roles, demo: true });
}
function task(g, type, actor) {
  g.tasks = [{ type, actor }];
  return g;
}
test('random assignment preserves 3 wolves / 3 villagers / 3 gods and practice role', () => {
  for (let n = 0; n < 100; n++) {
    const g = createGame({ mode: 'practice', role: '女巫' });
    assert.deepEqual(g.players.map((p) => p.role).sort(), [...roles].sort());
    assert.equal(g.players[8].role, '女巫');
  }
});
test('information isolation: villager sees no other identity, wolf sees only teammates', () => {
  const g = game();
  g.mode = 'normal';
  g.players[8].human = true;
  g.players[3].knowledge.push({ target: 1, result: '狼人' });
  const v = view(g);
  assert.equal(v.players.filter((p) => p.role).length, 1);
  assert(!JSON.stringify(observation(g, 9)).includes('teammate'));
  assert(!('role' in observation(g, 9).players[0]));
  assert.equal(observation(g, 1).players.filter((p) => p.teammate).length, 3);
  assert.equal(observation(g, 9).self.knowledge.length, 0);
  assert.equal(v.task.actor, undefined);
});
test('witch self-save first night only, one potion and poison excludes self', () => {
  const g = game();
  g.night.kills = { 1: 5, 2: 5, 3: 5 };
  task(g, 'potion', 5);
  assert(legal(g).includes('save'));
  assert(!legal(g).includes('poison:5'));
  g.day = 2;
  assert(!legal(g).includes('save'));
  g.day = 1;
  apply(g, { choice: 'save' });
  assert.equal(g.antidote, false);
  assert.equal(g.night.saved, true);
  assert.equal(g.poison, true);
});
test('poisoned hunter cannot shoot; simultaneous poison overrides knife', () => {
  const g = game();
  g.night = { kills: { 1: 6, 2: 6, 3: 6 }, poisoned: 6 };
  task(g, 'dawn');
  apply(g);
  assert.equal(g.players[5].alive, false);
  assert(!g.tasks.some((t) => t.type === 'shoot'));
});
test('knife-killed hunter gets shot before victory resolution', () => {
  const g = game();
  g.players[3].alive = false;
  g.players[4].alive = false;
  g.night = { kills: { 1: 6, 2: 6 } };
  task(g, 'dawn');
  apply(g);
  assert.equal(g.tasks[0].type, 'shoot');
  assert.equal(g.winner, null);
  apply(g, { choice: 1 });
  assert.equal(g.players[0].alive, false);
  assert.equal(g.winner, '狼人');
});
test('wolf split votes means no kill', () => {
  const g = game();
  g.night.kills = { 1: 4, 2: 5, 3: 6 };
  assert.equal(killTarget(g), 0);
  g.night.kills[3] = 5;
  assert.equal(killTarget(g), 5);
});
test('PK and repeat tie cause no elimination', () => {
  const g = game();
  g.phase = 'vote';
  g.votes = { 1: 4, 2: 5 };
  task(g, 'voteEnd');
  apply(g);
  assert.deepEqual(g.tie, [4, 5]);
  assert.equal(g.tasks[0].type, 'speech');
  task(g, 'voteStart');
  apply(g);
  assert(!g.tasks.some((t) => [4, 5].includes(t.actor)));
  g.votes = { 1: 4, 2: 5 };
  task(g, 'voteEnd');
  apply(g);
  assert(g.players.every((p) => p.alive));
  assert.equal(g.tasks[0].type, 'nextNight');
});
test('illegal vote does not consume turn', () => {
  const g = game();
  task(g, 'vote', 1);
  assert.throws(() => apply(g, { choice: 99 }));
  assert.equal(g.tasks[0].actor, 1);
  assert.equal(g.revision, 0);
});
test('night privacy and god view do not change AI observations', () => {
  const g = game();
  const before = observation(g, 8);
  g.god = true;
  assert.deepEqual(observation(g, 8), before);
  assert.equal(view(g).players.filter((p) => p.role).length, 9);
  g.god = false;
  assert.equal(view(g).players.filter((p) => p.role).length, 0);
});
test('slaughter-side victory', () => {
  const g = game();
  g.players.filter((p) => p.role === '村民').forEach((p) => (p.alive = false));
  assert.equal(winner(g), '狼人');
  const h = game();
  h.players.filter((p) => p.role === '狼人').forEach((p) => (p.alive = false));
  assert.equal(winner(h), '好人');
});
test('new games preserve personality, clear knowledge and events', () => {
  const g = game();
  g.players[3].knowledge.push({ target: 1 });
  const h = game();
  assert.equal(h.players[3].knowledge.length, 0);
  assert.equal(h.players[0].prompt, g.players[0].prompt);
  assert.notEqual(g.id, h.id);
});
test('100 complete demo games reach a winner without deadlocks; serialization can resume', () => {
  for (let k = 0; k < 100; k++) {
    let g = createGame({ mode: 'director', demo: true });
    for (let step = 0; step < 600 && !g.winner; step++) {
      const t = g.tasks[0];
      assert(t, 'missing task');
      apply(g, t.actor ? demoDecision(g) : {});
      if (step === 12) g = JSON.parse(JSON.stringify(g));
    }
    assert(g.winner, 'demo stalled');
    assert.equal(g.tasks.length, 0);
    assert.equal(view(g).players.filter((p) => p.role).length, 9);
  }
});
