import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  createGame,
  roles,
  apply,
  advance,
  view,
  beginNight,
  killTarget,
  settleKnife,
  submitWolfChoice,
  skipHiddenSpeech,
} from '../lib/game/engine.mjs';
const game = () => {
  const g = createGame({ mode: 'director', assigned: roles, demo: true });
  g.paused = false;
  return g;
};
test('majority, top-tie lottery, abstention and frozen knife survive serialization', () => {
  for (const [votes, expected] of [
    [{ 1: 9, 2: 9, 3: 10 }, 9],
    [{ 1: 0, 2: 9, 3: 0 }, 9],
    [{ 1: 0, 2: 0, 3: 0 }, 0],
  ]) {
    const g = game();
    g.night.kills = votes;
    assert.equal(settleKnife(g), expected);
    assert.equal(killTarget(JSON.parse(JSON.stringify(g))), expected);
  }
  for (const [r, expected] of [
    [0, 9],
    [0.499, 9],
    [0.5, 10],
    [0.999, 10],
  ]) {
    const g = game();
    g.night.kills = { 1: 9, 2: 10, 3: 0 };
    assert.equal(
      settleKnife(g, () => r),
      expected,
    );
    const saved = JSON.parse(JSON.stringify(g));
    assert.equal(
      settleKnife(saved, () => {
        throw Error('rerolled');
      }),
      expected,
    );
    assert.equal(killTarget(saved), expected);
  }
  const g = game();
  g.night.kills = { 1: 9, 2: 10, 3: 11 };
  assert.equal(
    settleKnife(g, () => 0.7),
    11,
  );
});
test('old in-progress nights retain old tie and next night adopts new selection phase', () => {
  const g = game();
  g.night = { kills: { 1: 9, 2: 10 }, guards: [], poisoned: [] };
  assert.equal(killTarget(g), 0);
  const h = JSON.parse(JSON.stringify(g));
  assert.equal(killTarget(h), 0);
  beginNight(h);
  assert.equal(h.night.knifeRule, 'random-top');
  assert(h.tasks.some((t) => t.type === 'wolfStart'));
  assert(!h.tasks.some((t) => t.type === 'kill'));
});
test('only invisible wolf chat skips acknowledgment, public speech always manual', () => {
  for (const [role, god, skip] of [
    ['村民', false, true],
    ['觉醒隐狼', false, true],
    ['狼人', false, false],
    ['村民', true, false],
  ]) {
    const g = game();
    g.players[11].human = true;
    g.players[11].role = role;
    g.god = god;
    g.tasks = [{ type: 'wolfChat', actor: 1 }];
    apply(g, { text: '明天我跳魔镜，今晚刀9。' });
    assert.equal(skipHiddenSpeech(g), skip);
    assert.equal(g.awaitingAdvance, !skip);
  }
  const g = game();
  g.tasks = [{ type: 'speech', actor: 1 }];
  apply(g, { text: '公开发言' });
  assert.equal(skipHiddenSpeech(g), false);
  assert(g.awaitingAdvance);
});
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moonlit-night-test-'));
const oldCwd = process.cwd();
process.chdir(testDir);
process.env.MOONLIT_DATA_DIR = testDir;
process.env.DEEPSEEK_API_KEY = 'test-only-night';
process.env.DEEPSEEK_INPUT_CNY_PER_MILLION = '2';
process.env.DEEPSEEK_OUTPUT_CNY_PER_MILLION = '8';
const { command, snapshot } = await import('../lib/game/service.mjs');
const state = () => globalThis[Symbol.for('moonlit.store.v2')];
const response = (choice) => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({ choice, rationale: '参考事件1' }),
        },
      },
    ],
    usage: { prompt_tokens: 20, completion_tokens: 10 },
  }),
});
const tick = () => new Promise((r) => setTimeout(r, 0));
async function start(role) {
  await command({ op: 'archive' });
  await command({ op: 'start', mode: 'normal', role, budget: 100 });
  await command({ op: 'pause', value: false });
  return state().db.game;
}
test('human inspection immediate, following AI cannot cover result; wolf choices parallel and retry only failures', async () => {
  const oldFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = () => {
      calls++;
      throw Error('unexpected API');
    };
    let g = await start('魔镜少女');
    const witch = g.players.find((p) => p.role === '女巫');
    g.tasks = [
      { type: 'inspect', actor: 12 },
      { type: 'potion', actor: witch.id },
    ];
    const inspected = g.players[0].role;
    const d = await command({
      op: 'step',
      revision: g.revision,
      action: { choice: 1 },
    });
    assert.equal(calls, 0);
    assert.equal(d.game.players[11].knowledge[0].result, inspected);
    assert(!d.busy);
    assert.equal(d.game.task.type, 'potion');
    let finish;
    globalThis.fetch = async (url, opts) => {
      calls++;
      const body = JSON.parse(opts.body);
      assert(!body.messages[0].content.includes('"text"'));
      assert.equal(body.max_tokens, 16384);
      assert.equal(body.thinking, undefined);
      return new Promise((r) => (finish = r));
    };
    const next = command({ op: 'step', revision: g.revision });
    await tick();
    assert.equal(snapshot().game.players[11].knowledge[0].result, inspected);
    finish(response('none'));
    await next;
    assert.equal(snapshot().game.players[11].knowledge[0].result, inspected);
    g.players[11].human = false;
    assert(!view(g).players[11].knowledge);
    assert(!view(g).events.some((e) => e.kind === 'inspect'));
    g = await start('狼人');
    const ids = g.players.filter((p) => p.role === '狼人').map((p) => p.id);
    g.tasks = [{ type: 'wolfStart', eligible: ids }];
    const pending = [];
    calls = 0;
    globalThis.fetch = async (url, opts) => {
      calls++;
      const ob = JSON.parse(JSON.parse(opts.body).messages[1].content);
      assert(!ob.events.some((e) => e.kind === 'kill'));
      return new Promise((r) => pending.push({ resolve: r, ob }));
    };
    await command({ op: 'step', revision: g.revision });
    assert.equal(calls, 2);
    assert(g.wolfSelection);
    const selectionId = g.wolfSelection.id;
    await command({ op: 'wolfChoice', selectionId, choice: 9 });
    await assert.rejects(
      command({ op: 'wolfChoice', selectionId, choice: 8 }),
      /重复/,
    );
    assert(!snapshot().game.events.some((e) => e.kind === 'kill'));
    pending[0].resolve(response(9));
    pending[1].resolve({ ok: false, status: 500 });
    await tick();
    assert(g.paused);
    assert.equal(Object.keys(g.night.kills).length, 2);
    assert(g.wolfSelection);
    const firstOb = pending[1].ob;
    const restartDir = path.join(testDir, 'restart');
    fs.mkdirSync(restartDir);
    fs.copyFileSync(
      path.join(testDir, 'store.json'),
      path.join(restartDir, 'store.json'),
    );
    const serviceUrl = new URL('../lib/game/service.mjs', import.meta.url).href;
    const childCode = `import assert from 'node:assert/strict';const {command,snapshot}=await import(${JSON.stringify(serviceUrl)});let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({choice:8})}}]})};};assert(snapshot().game.paused);assert(snapshot().game.wolfSelection.humanSubmitted);await command({op:'pause',value:false});await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);assert.equal(snapshot().game.wolfSelection,null);`;
    const child = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', childCode],
      {
        cwd: restartDir,
        env: { ...process.env, MOONLIT_DATA_DIR: restartDir },
        encoding: 'utf8',
      },
    );
    assert.equal(child.status, 0, child.stderr);

    await command({ op: 'pause', value: false });
    assert.equal(calls, 3);
    assert.deepEqual(pending[2].ob, firstOb);
    pending[2].resolve(response(8));
    await tick();
    assert.equal(g.wolfSelection, null);
    assert.equal(killTarget(g), 9);
    assert.equal(g.events.filter((e) => e.kind === 'kill').length, 3);
    assert.equal(calls, 3);
    g = await start('狼人');
    const team = g.players.filter((p) => p.role === '狼人').map((p) => p.id);
    g.tasks = [{ type: 'wolfStart', eligible: team }];
    pending.length = 0;
    calls = 0;
    await command({ op: 'step', revision: g.revision });
    await command({
      op: 'wolfChoice',
      selectionId: g.wolfSelection.id,
      choice: 9,
    });
    await command({ op: 'pause', value: true });
    pending[0].resolve(response(9));
    pending[1].resolve(response(8));
    await tick();
    assert(g.wolfSelection);
    assert.equal(Object.keys(g.night.kills).length, 3);
    await command({ op: 'pause', value: false });
    assert(!g.wolfSelection);
    assert.equal(calls, 2);
    const metrics = fs
      .readFileSync(path.join(testDir, 'timings.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);
    assert(metrics.some((m) => m.task === 'inspect' && !m.modelCalled && m.ok));
    assert(metrics.some((m) => m.task === 'kill' && m.modelCalled && !m.ok));
    assert(
      metrics.every(
        (m) => m.durationMs >= 0 && !('key' in m) && !('content' in m),
      ),
    );
  } finally {
    globalThis.fetch = oldFetch;
    process.chdir(oldCwd);
    const resolved = path.resolve(testDir);
    assert(
      resolved.startsWith(
        path.resolve(os.tmpdir()) + path.sep + 'moonlit-night-test-',
      ),
    );
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
