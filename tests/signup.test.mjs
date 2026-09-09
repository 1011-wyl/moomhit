import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createGame,
  roles,
  apply,
  submitSignup,
  view,
  beginSignup,
  explode,
} from '../lib/game/engine.mjs';
const game = () => {
  const g = createGame({ mode: 'director', assigned: roles, demo: true });
  g.paused = false;
  g.tasks = [{ type: 'electionStart' }];
  apply(g);
  return g;
};
test('signup choices remain private until everyone finishes, zero/one/all candidates resolve correctly', () => {
  for (const count of [0, 1, 12]) {
    const g = game();
    for (let id = 1; id <= 11; id++)
      submitSignup(g, id, { choice: id <= count ? 'join' : 'stay' });
    assert.equal(g.candidates.length, 0);
    assert(!g.events.some((e) => e.kind === 'signup'));
    const v = view(g);
    assert.equal(v.signupSelection.submittedCount, 11);
    assert(!('choices' in v.signupSelection));
    assert(!('observations' in v.signupSelection));
    assert.throws(() => submitSignup(g, 1, { choice: 'stay' }), /重复/);
    submitSignup(g, 12, { choice: 12 <= count ? 'join' : 'stay' });
    assert.equal(g.candidates.length, count);
    assert.equal(g.events.filter((e) => e.kind === 'signup').length, 12);
    assert.equal(g.signupSelection, null);
    apply(g);
    if (count === 0) assert(g.badgeDestroyed);
    if (count === 1) assert.equal(g.sheriff, 1);
    if (count === 12)
      assert.equal(
        g.tasks.filter((t) => t.type === 'sheriffSpeech').length,
        12,
      );
  }
});
test('old partial signup retains announced choices; explosion invalidates pending choices', () => {
  const g = game();
  g.candidates = [1];
  g.signed = [1];
  beginSignup(g, [2, 3]);
  submitSignup(g, 2, { choice: 'stay' });
  submitSignup(g, 3, { choice: 'join' });
  assert.deepEqual(g.candidates, [1, 3]);
  const h = game();
  explode(h, 1);
  assert.equal(h.signupSelection, null);
  assert.throws(() => submitSignup(h, 2, { choice: 'join' }));
});
const cwd = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moonlit-signup-test-'));
process.chdir(dir);
process.env.MOONLIT_DATA_DIR = dir;
process.env.DEEPSEEK_API_KEY = 'test-only-signup';
process.env.DEEPSEEK_INPUT_CNY_PER_MILLION = '2';
process.env.DEEPSEEK_OUTPUT_CNY_PER_MILLION = '8';
const { command, snapshot } = await import('../lib/game/service.mjs');
const tick = () => new Promise((r) => setTimeout(r, 0));
const reply = (choice) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        finish_reason: 'stop',
        message: { content: JSON.stringify({ choice }) },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 10 },
  }),
});
test('11 AI signup requests launch concurrently with human input, failure retries one unchanged snapshot', async () => {
  const original = globalThis.fetch;
  const pending = [];
  try {
    globalThis.fetch = async (url, opts) => {
      const ob = JSON.parse(JSON.parse(opts.body).messages[1].content);
      assert.equal(ob.task.type, 'signup');
      assert.equal(ob.candidates.length, 0);
      assert(!ob.events.some((e) => e.kind === 'signup'));
      return new Promise((resolve) => pending.push({ ob, resolve }));
    };
    await command({ op: 'start', mode: 'normal', role: '村民', budget: 100 });
    await command({ op: 'pause', value: false });
    const g = globalThis[Symbol.for('moonlit.store.v2')].db.game;
    g.tasks = [{ type: 'electionStart' }];
    await command({ op: 'step', revision: g.revision });
    assert.equal(pending.length, 11);
    const id = g.signupSelection.id;
    assert(!('deadline' in snapshot().game.signupSelection));
    await command({ op: 'signupChoice', selectionId: id, choice: 'join' });
    await assert.rejects(
      command({ op: 'signupChoice', selectionId: id, choice: 'stay' }),
      /重复/,
    );
    for (let i = 0; i < 10; i++) pending[i].resolve(reply('stay'));
    pending[10].resolve({ ok: false, status: 500 });
    await tick();
    assert(g.paused);
    assert.equal(snapshot().game.signupSelection.submittedCount, 11);
    assert.equal(g.candidates.length, 0);
    assert(!snapshot().game.events.some((e) => e.kind === 'signup'));
    await command({ op: 'pause', value: false });
    assert.equal(pending.length, 12);
    assert.deepEqual(pending[11].ob, pending[10].ob);
    pending[11].resolve(reply('join'));
    await tick();
    assert.equal(g.signupSelection, null);
    assert.equal(g.candidates.length, 2);
    assert(g.candidates.includes(12));
    assert.equal(g.events.filter((e) => e.kind === 'signup').length, 12);
    await assert.rejects(
      command({ op: 'signupChoice', selectionId: id, choice: 'stay' }),
      /不可提交/,
    );
  } finally {
    globalThis.fetch = original;
    process.chdir(cwd);
    assert(
      path
        .resolve(dir)
        .startsWith(
          path.resolve(os.tmpdir()) + path.sep + 'moonlit-signup-test-',
        ),
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
