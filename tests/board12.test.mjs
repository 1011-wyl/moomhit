import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  roles,
  legal,
  apply,
  advance,
  beginNight,
  view,
  observation,
  prepareBallot,
  openBallot,
  submitBallot,
  closeBallot,
  explode,
  withdraw,
  demoDecision,
  winner,
  submitWolfChoice,
  submitSignup,
  finishWolfSelection,
  settleKnife,
  skipHiddenSpeech,
} from '../lib/game/engine.mjs';
const game = () =>
  createGame({ mode: 'director', assigned: roles, demo: true });
function action(g, type, actor, choice) {
  g.awaitingAdvance = false;
  g.tasks = [{ type, actor }];
  apply(g, { choice, text: '测试发言' });
}
test('12-seat composition and requested player role', () => {
  for (const role of new Set(roles)) {
    const g = createGame({ mode: 'normal', role });
    assert.equal(g.players[11].role, role);
    assert.deepEqual(g.players.map((p) => p.role).sort(), [...roles].sort());
    assert.equal(g.players.filter((p) => p.human).length, 1);
  }
  assert.throws(() =>
    createGame({ mode: 'director', assigned: roles.slice(1) }),
  );
});
test('hidden wolf isolated; disguise immediate but skills next night; exact mirror no repeats', () => {
  const g = game();
  assert.deepEqual(
    observation(g, 1)
      .players.filter((p) => p.teammate)
      .map((p) => p.id),
    [1, 2, 3],
  );
  assert(!observation(g, 4).players.some((p) => p.teammate));
  action(g, 'copy', 4, 5);
  assert.equal(g.players[3].copied, '魔镜少女');
  action(g, 'inspect', 5, 4);
  assert.equal(g.players[4].knowledge[0].result, '魔镜少女');
  assert(!legal(g, { type: 'inspect', actor: 5 }).includes(4));
  beginNight(g);
  assert(!g.tasks.some((t) => t.type === 'inspect' && t.actor === 4));
  g.day++;
  beginNight(g);
  assert(g.tasks.some((t) => t.type === 'inspect' && t.actor === 4));
  assert(!view(g).events.some((e) => e.kind === 'copy'));
  assert.equal(view(g).task.actor, undefined);
});
test('ordinary guards, enhanced guards, witch self-save and milk-through', () => {
  let g = game();
  g.night.kills = { 1: 6 };
  assert(!legal(g, { type: 'potion', actor: 6 }).includes('save'));
  action(g, 'guard', 8, 9);
  assert(!legal(g, { type: 'guard', actor: 8 }).includes(9));
  g.night.kills = { 1: 9 };
  g.night.saved = true;
  action(g, 'dawn');
  assert(!g.players[8].alive);
  g = game();
  g.night.guards = [{ target: 9, enhanced: true }];
  g.night.kills = { 1: 9 };
  g.night.poisoned = [9];
  action(g, 'dawn');
  assert(g.players[8].alive);
  g = game();
  g.night.guards = [{ target: 9, enhanced: false }];
  g.night.poisoned = [9];
  action(g, 'dawn');
  assert(!g.players[8].alive);
});
test('copy poison and extra knife are one-shot; hidden takes knife only after ordinary wolves die', () => {
  const g = game();
  action(g, 'copy', 4, 6);
  g.day = 2;
  beginNight(g);
  assert(g.tasks.some((t) => t.type === 'copyPoison'));
  action(g, 'copyPoison', 4, 9);
  beginNight(g);
  assert(!g.tasks.some((t) => t.type === 'copyPoison'));
  g.players[3].copied = '狼人';
  beginNight(g);
  assert(!g.tasks.some((t) => t.type === 'kill' && t.actor === 4));
  g.players.slice(0, 3).forEach((p) => (p.alive = false));
  beginNight(g);
  assert(g.tasks.some((t) => t.type === 'wolfStart' && t.eligible.includes(4)));
  assert(g.tasks.some((t) => t.type === 'extraKill'));
  action(g, 'extraKill', 4, 10);
  beginNight(g);
  assert(!g.tasks.some((t) => t.type === 'extraKill'));
  assert.equal(winner(g), null);
});
test('hunter and copied hunter can shoot, poison disables both', () => {
  for (const poison of [false, true]) {
    const g = game();
    action(g, 'copy', 4, 7);
    g.night.kills = { 1: 4 };
    g.night.extra = 7;
    if (poison) g.night.poisoned = [4, 7];
    action(g, 'dawn');
    assert.equal(
      g.tasks.filter((t) => t.type === 'shoot').length,
      poison ? 0 : 2,
    );
  }
});
test('night death announcement follows election; withdrawal removes candidacy but no election vote', () => {
  const g = game();
  g.night.kills = { 1: 9 };
  action(g, 'electionStart');
  assert(g.players[8].alive);
  action(g, 'signup', 1, 'join');
  action(g, 'signup', 2, 'join');
  action(g, 'signup', 3, 'join');
  withdraw(g, 3);
  prepareBallot(g, 'sheriff');
  assert.deepEqual(g.ballot.candidates, [1, 2]);
  assert(!g.ballot.eligible.includes(3));
  openBallot(g, 100);
  submitBallot(g, 12, 2, 101);
  closeBallot(g, 5100);
  assert.equal(g.sheriff, 2);
  assert(g.players[8].alive);
  apply(g);
  assert(!g.players[8].alive);
});
test('speech is acknowledged manually and never repeats after final speaker', () => {
  const g = game();
  g.phase = 'speech';
  g.tasks = [{ type: 'speech', actor: 12 }, { type: 'voteStart' }];
  apply(g, { text: '我发言结束。' });
  assert(g.awaitingAdvance);
  assert.throws(() => apply(g), /手动/);
  assert.equal(g.tasks[0].type, 'voteStart');
  advance(g);
  apply(g);
  assert(g.ballot);
  assert.equal(g.events.filter((e) => e.kind === 'speech').length, 1);
});
test('strict shared 5-second ballot, secret choices, missing abstentions and sheriff weight', () => {
  const g = game();
  g.sheriff = 1;
  prepareBallot(g, 'exile');
  openBallot(g, 1000);
  submitBallot(g, 1, 9, 5999);
  submitBallot(g, 2, 10, 5999);
  assert.throws(() => submitBallot(g, 3, 9, 6000), /截止/);
  assert.throws(() => submitBallot(g, 1, 10, 5999), /重复/);
  assert(!view(g).ballot.votes);
  assert(!g.events.some((e) => e.kind === 'vote'));
  assert.equal(closeBallot(g, 5999), false);
  assert(closeBallot(g, 6000));
  assert(!g.players[8].alive);
  assert.equal(g.events.filter((e) => e.timeout).length, 10);
  assert.equal(
    g.events.find((e) => e.kind === 'vote' && e.actor === 1).weight,
    1.5,
  );
});
test('tie has one PK, tied candidates excluded from exile revote, all abstain ends vote', () => {
  const g = game();
  prepareBallot(g, 'exile');
  openBallot(g, 0);
  submitBallot(g, 1, 9, 1);
  submitBallot(g, 2, 10, 1);
  closeBallot(g, 5000);
  assert.deepEqual(g.tie, [9, 10]);
  prepareBallot(g, 'exile');
  assert(!g.ballot.eligible.includes(9));
  openBallot(g, 5000);
  submitBallot(g, 1, 9, 5001);
  submitBallot(g, 2, 10, 5001);
  closeBallot(g, 10000);
  assert.equal(g.tasks[0].type, 'nextNight');
  assert(g.players.every((p) => p.alive));
});
test('sheriff speaks last and transfers badge; two election explosions destroy badge', () => {
  const g = game();
  g.sheriff = 7;
  action(g, 'direction', 7, 'counterclockwise');
  assert.equal(g.tasks.at(-2).actor, 7);
  action(g, 'badge', 7, 8);
  assert.equal(g.sheriff, 8);
  action(g, 'badge', 8, 0);
  assert(g.badgeDestroyed);
  const h = game();
  action(h, 'electionStart');
  explode(h, 1);
  assert(h.electionPending);
  h.day = 2;
  beginNight(h);
  action(h, 'electionStart');
  explode(h, 2);
  assert(h.badgeDestroyed);
  assert(!h.electionPending);
  assert.throws(() => explode(h, 4));
});
test('100 demo games complete with manual acknowledgments, concurrent votes and save roundtrips', () => {
  for (let k = 0; k < 100; k++) {
    let g = createGame({ mode: 'director', demo: true });
    g.paused = false;
    for (let i = 0; i < 2000 && !g.winner; i++) {
      if (g.awaitingAdvance) {
        advance(g);
        continue;
      }
      if (g.signupSelection) {
        for (const id of [...g.signupSelection.eligible])
          submitSignup(g, id, demoDecision(g, { type: 'signup', actor: id }));
        continue;
      }
      if (g.wolfSelection) {
        for (const id of [...g.wolfSelection.eligible])
          submitWolfChoice(g, id, demoDecision(g, { type: 'kill', actor: id }));
        continue;
      }
      if (g.ballot) {
        openBallot(g, 0);
        for (const id of g.ballot.eligible)
          submitBallot(
            g,
            id,
            demoDecision(g, { type: 'vote', actor: id }).choice,
            1,
          );
        closeBallot(g, 5000);
      } else apply(g, g.tasks[0].actor ? demoDecision(g) : {});
      if (i % 23 === 0) g = JSON.parse(JSON.stringify(g));
    }
    assert(g.winner, 'game stalled');
    assert.equal(view(g).players.filter((p) => p.role).length, 12);
  }
});
