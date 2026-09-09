import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.MOONLIT_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), 'moonlit-tests-'),
);
process.env.DEEPSEEK_API_KEY = 'test-only-not-a-real-key';
process.env.DEEPSEEK_INPUT_CNY_PER_MILLION = '2';
process.env.DEEPSEEK_OUTPUT_CNY_PER_MILLION = '8';
const { command, snapshot } = await import('../lib/game/service.mjs');
const { roles } = await import('../lib/game/engine.mjs');
const response = (text = '测试发言', choice = 4) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            text,
            choice,
            rationale: '依据公开事件 #1。',
          }),
        },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50 },
  }),
});
test('API adapter: blank-key gate, concurrency, pause reuse, invalid response accounting, budget, replay', async () => {
  const fetchOriginal = globalThis.fetch;
  let calls = 0;
  try {
    process.env.DEEPSEEK_API_KEY = '';
    await assert.rejects(
      command({ op: 'start', mode: 'normal', budget: 5, demo: false }),
      /API/,
    );
    assert.equal(snapshot().game, null);
    process.env.DEEPSEEK_API_KEY = 'test-only-not-a-real-key';
    await command({
      op: 'start',
      mode: 'director',
      assigned: roles,
      budget: 5,
      demo: false,
    });
    assert.equal(snapshot().game.paused, true);
    await command({ op: 'pause', value: false });
    let release;
    globalThis.fetch = async (url, opts) => {
      calls++;
      const body = JSON.parse(opts.body);
      assert.equal(body.response_format.type, 'json_object');
      assert.equal(body.messages.length, 2);
      const ob = JSON.parse(body.messages[1].content);
      assert.equal(ob.self.role, '狼人');
      assert(!('role' in ob.players[3]));
      return await new Promise(
        (resolve) => (release = () => resolve(response())),
      );
    };
    const pending = command({ op: 'step', revision: 0 });
    await new Promise((r) => setTimeout(r, 0));
    await assert.rejects(command({ op: 'step', revision: 0 }), /上一项/);
    await command({ op: 'pause', value: true });
    release();
    await pending;
    assert.equal(snapshot().game.revision, 0);
    assert.equal(snapshot().game.paused, true);
    await command({ op: 'pause', value: false });
    await command({ op: 'step', revision: 0 });
    assert.equal(calls, 1);
    assert.equal(snapshot().game.revision, 1);
    assert(Math.abs(snapshot().game.spent - 0.0006) < 0.00001);
    await assert.rejects(command({ op: 'step', revision: 0 }), /更新/);
    globalThis.fetch = async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'invalid' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      };
    };
    await assert.rejects(command({ op: 'step', revision: 1 }), /格式/);
    assert.equal(snapshot().game.paused, true);
    assert.equal(snapshot().game.revision, 1);
    assert(snapshot().game.spent >= 0.0011);
    await command({ op: 'budget', value: 0.001 });
    await command({ op: 'pause', value: false });
    const before = calls;
    await assert.rejects(command({ op: 'step', revision: 1 }), /预算/);
    assert.equal(calls, before);
    await command({ op: 'archive' });
    assert.equal(snapshot().history.length, 1);
    const replay = await command({
      op: 'replay',
      id: snapshot().history[0].id,
    });
    assert.equal(replay.replay.players.filter((p) => p.role).length, 9);
    assert(!JSON.stringify(snapshot()).includes('test-only-not-a-real-key'));
    const persisted = JSON.parse(
      fs.readFileSync(
        path.join(process.env.MOONLIT_DATA_DIR, 'store.json'),
        'utf8',
      ),
    );
    assert.equal(persisted.history.length, 1);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
