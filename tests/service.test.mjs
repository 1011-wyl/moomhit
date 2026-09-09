import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const cwd = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moonlit-v2-test-'));
process.env.MOONLIT_DATA_DIR = dir;
process.chdir(dir);
process.env.DEEPSEEK_API_KEY = 'test-only';
process.env.DEEPSEEK_INPUT_CNY_PER_MILLION = '2';
process.env.DEEPSEEK_OUTPUT_CNY_PER_MILLION = '8';
const { command, snapshot } = await import('../lib/game/service.mjs');
const { roles, prepareBallot } = await import('../lib/game/engine.mjs');
const answer = (choice, text = '测试发言') => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            choice,
            text,
            rationale: '依据公开信息。',
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 20 },
  }),
});
const state = () => globalThis[Symbol.for('moonlit.store.v2')];
test('service: config file, parallel ballot, common deadline, no early results, timeout accounting and manual turns', async () => {
  const originalFetch = globalThis.fetch;
  try {
    fs.writeFileSync('.env.local', 'DEEPSEEK_API_KEY=\n');
    assert.equal(snapshot().config.configured, false);
    await assert.rejects(
      command({ op: 'start', mode: 'normal', budget: 5 }),
      /API/,
    );
    fs.writeFileSync('.env.local', 'DEEPSEEK_API_KEY=test-only-file\n');
    await command({ op: 'start', mode: 'normal', role: '村民', budget: 20 });
    const g = state().db.game;
    g.paused = false;
    g.phase = 'speech';
    g.tasks = [{ type: 'speech', actor: 12 }, { type: 'voteStart' }];
    await command({
      op: 'step',
      revision: g.revision,
      action: { text: '说完了。' },
    });
    assert(snapshot().game.awaitingAdvance);
    await assert.rejects(
      command({ op: 'step', revision: g.revision }),
      /下一位/,
    );
    await command({ op: 'pause', value: false });
    await command({ op: 'advance', revision: g.revision });
    const pending = [];
    let calls = 0;
    globalThis.fetch = async (url, opts) => {
      calls++;
      const ob = JSON.parse(JSON.parse(opts.body).messages[1].content);
      assert.equal(ob.task.type, 'vote');
      assert(!ob.events.some((e) => e.kind === 'vote'));
      return new Promise((resolve, reject) => {
        pending.push({ resolve, ob });
        opts.signal.addEventListener('abort', () => reject(Error('aborted')));
      });
    };
    await command({ op: 'step', revision: g.revision });
    assert.equal(
      calls,
      11,
      'all calls must launch without awaiting one another',
    );
    const b = snapshot().game.ballot;
    assert.equal(b.status, 'open');
    assert(b.deadline - Date.now() <= 5000);
    assert(b.deadline - Date.now() > 4500);
    assert.equal(b.submitted.length, 0);
    pending[0].resolve(answer(pending[0].ob.choices.find((n) => n > 0)));
    await new Promise((r) => setTimeout(r, 0));
    await command({ op: 'ballotVote', ballotId: b.id, choice: 0 });
    assert.equal(snapshot().game.ballot.submitted.length, 2);
    assert(!snapshot().game.events.some((e) => e.kind === 'vote'));
    await assert.rejects(command({ op: 'pause', value: true }), /5秒/);
    await new Promise((r) =>
      setTimeout(r, Math.max(0, b.deadline - Date.now()) + 60),
    );
    const result = snapshot();
    assert.equal(result.game.ballot, null);
    assert.equal(result.game.events.filter((e) => e.timeout).length, 10);
    assert.equal(
      result.game.events.filter((e) => e.kind === 'vote').length,
      12,
    );
    assert(result.game.spent > 0);
    assert.equal(calls, 11);
    await assert.rejects(
      command({ op: 'ballotVote', ballotId: b.id, choice: 0 }),
      /轮次/,
    );
    await command({ op: 'archive' });
    await command({
      op: 'start',
      mode: 'director',
      assigned: roles,
      budget: 0.01,
    });
    await command({ op: 'pause', value: false });
    prepareBallot(state().db.game, 'exile');
    await assert.rejects(
      command({ op: 'step', revision: state().db.game.revision }),
      /预算/,
    );
    assert.equal(calls, 11);
    assert.equal(snapshot().game.ballot.status, 'waiting');
    assert(snapshot().game.paused);
    await command({ op: 'archive' });
    await command({
      op: 'start',
      mode: 'director',
      assigned: roles,
      budget: 20,
    });
    await command({ op: 'pause', value: false });
    const h = state().db.game;
    h.tasks = [{ type: 'speech', actor: 1 }];
    let release;
    globalThis.fetch = () => new Promise((r) => (release = r));
    const turn = command({ op: 'step', revision: h.revision });
    await new Promise((r) => setTimeout(r, 0));
    await assert.rejects(
      command({ op: 'step', revision: h.revision }),
      /上一项/,
    );
    await command({ op: 'pause', value: true });
    release(answer(null));
    await turn;
    assert(!h.awaitingAdvance);
    assert(h.pending);
    await command({ op: 'pause', value: false });
    await command({ op: 'step', revision: h.revision });
    assert(h.awaitingAdvance);
    assert.equal(h.events.filter((e) => e.kind === 'speech').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
