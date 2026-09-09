import { presets as oldPresets, view as legacyView } from './engine-v1.mjs';
export const roles = [
  '狼人',
  '狼人',
  '狼人',
  '觉醒隐狼',
  '魔镜少女',
  '女巫',
  '猎人',
  '守卫',
  '村民',
  '村民',
  '村民',
  '村民',
];
export const SPEECH_TYPES = [
  'speech',
  'lastWords',
  'wolfChat',
  'sheriffSpeech',
];
export const presets = [
  ...oldPresets.slice(0, 8),
  {
    name: '江雾',
    mbti: 'ISFP',
    traits: '敏锐、克制',
    prompt: '注意措辞和动机，简洁表达自己的观察。',
    avatar: '◇',
    avatarIndex: 8,
  },
  {
    name: '钟离',
    mbti: 'ESTJ',
    traits: '直率、负责',
    prompt: '重视清晰的规则和可验证的证据。',
    avatar: '♜',
    avatarIndex: 3,
  },
  {
    name: '许知遥',
    mbti: 'INFP',
    traits: '细腻、独立',
    prompt: '温和但不盲从，找出故事中的矛盾。',
    avatar: '✧',
    avatarIndex: 7,
  },
  { ...oldPresets[8], avatarIndex: 5 },
].map((p, i) => ({ ...p, id: i + 1 }));
export const isWolf = (p) => ['狼人', '觉醒隐狼'].includes(p.role);
const alive = (g) => g.players.filter((p) => p.alive);
const tasks = (type, ps) => ps.map((p) => ({ type, actor: p.id }));
export function log(g, text, visibility = 'public', extra = {}) {
  const e = {
    id: g.events.length + 1,
    day: g.day,
    phase: g.phase,
    text,
    visibility,
    ...extra,
  };
  g.events.push(e);
  return e;
}
export function createGame(options = {}, random = Math.random) {
  const pool = [...roles];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (
    options.role &&
    options.role !== 'random' &&
    options.mode !== 'director'
  ) {
    if (!roles.includes(options.role)) throw Error('身份不属于镜隐迷踪板子');
    const n = pool.indexOf(options.role);
    [pool[n], pool[11]] = [pool[11], pool[n]];
  }
  if (options.mode === 'director' && options.assigned) {
    if (
      JSON.stringify([...options.assigned].sort()) !==
      JSON.stringify([...roles].sort())
    )
      throw Error('身份配置应为三普狼、一觉醒隐狼、四村民及四名不同神职');
    pool.splice(0, 12, ...options.assigned);
  }
  const cs = options.characters || presets;
  if (cs.length !== 12) throw Error('需要12个座位');
  const g = {
    version: 2,
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    mode: options.mode || 'normal',
    god: options.mode === 'director' && !!options.god,
    demo: !!options.demo,
    day: 1,
    phase: 'night',
    players: cs.map((c, i) => ({
      ...structuredClone(c),
      id: i + 1,
      role: pool[i],
      human: i === 11 && options.mode !== 'director',
      alive: true,
      knowledge: [],
      copied: null,
      copyDay: 0,
      copyPoison: true,
      extraKnife: true,
      previousGuard: 0,
      shotUsed: false,
    })),
    events: [],
    tasks: [],
    revision: 0,
    paused: true,
    winner: null,
    antidote: true,
    poison: true,
    night: {},
    sheriff: 0,
    badgeDestroyed: false,
    electionPending: true,
    electionExplosions: 0,
    candidates: [],
    signed: [],
    electionRound: 0,
    voteRound: 0,
    tie: [],
    awaitingAdvance: false,
    displaySpeech: null,
    ballot: null,
    spent: 0,
    tokens: { input: 0, output: 0 },
    budget: Number(options.budget) || 5,
  };
  beginNight(g);
  return g;
}
export function winner(g) {
  const ps = alive(g);
  if (!ps.some(isWolf)) return '好人';
  if (
    !ps.some((p) => p.role === '村民') ||
    !ps.some((p) => !isWolf(p) && p.role !== '村民')
  )
    return '狼人';
  return null;
}
function finish(g) {
  if (g.tasks.some((t) => t.type === 'shoot')) return false;
  const w = winner(g);
  if (!w) return false;
  g.winner = w;
  g.phase = 'over';
  g.tasks = [];
  g.ballot = null;
  g.paused = true;
  g.awaitingAdvance = false;
  log(g, `${w}阵营获胜，身份揭晓。`);
  return true;
}
const hasCopy = (g, p, role) =>
  p.role === '觉醒隐狼' && p.copied === role && g.day > p.copyDay;
export function beginNight(g) {
  g.phase = 'night';
  g.night = {
    kills: {},
    guards: [],
    poisoned: [],
    saved: false,
    extra: 0,
    knifeRule: 'random-top',
    knifeTarget: null,
  };
  g.wolfSelection = null;
  g.nightUnsettled = true;
  g.voteRound = 0;
  g.tie = [];
  g.displaySpeech = null;
  g.awaitingAdvance = false;
  log(g, '天黑请闭眼。');
  const living = alive(g);
  const wolves = living.filter((p) => p.role === '狼人');
  const hidden = living.find((p) => p.role === '觉醒隐狼');
  g.tasks = [
    ...tasks(
      'copy',
      living.filter((p) => p.role === '觉醒隐狼' && !p.copied),
    ),
    ...tasks(
      'guard',
      living.filter((p) => p.role === '守卫' || hasCopy(g, p, '守卫')),
    ),
    ...tasks('wolfChat', wolves),
    {
      type: 'wolfStart',
      eligible: (wolves.length ? wolves : hidden ? [hidden] : []).map(
        (p) => p.id,
      ),
    },
    ...tasks(
      'extraKill',
      living.filter(
        (p) => !wolves.length && hasCopy(g, p, '狼人') && p.extraKnife,
      ),
    ),
    ...tasks(
      'inspect',
      living.filter((p) => p.role === '魔镜少女' || hasCopy(g, p, '魔镜少女')),
    ),
    ...tasks(
      'potion',
      living.filter((p) => p.role === '女巫'),
    ),
    ...tasks(
      'copyPoison',
      living.filter((p) => hasCopy(g, p, '女巫') && p.copyPoison),
    ),
    { type: g.electionPending && !g.badgeDestroyed ? 'electionStart' : 'dawn' },
  ];
}
export function settleKnife(g, random = Math.random) {
  if (g.night.knifeTarget !== null && g.night.knifeTarget !== undefined)
    return g.night.knifeTarget;
  const counts = {};
  for (const id of Object.values(g.night.kills || {}))
    if (id) counts[id] = (counts[id] || 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const tied = Object.keys(counts)
    .filter((id) => counts[id] === max)
    .map(Number);
  g.night.knifeTarget = tied.length
    ? tied[Math.floor(random() * tied.length)]
    : 0;
  return g.night.knifeTarget;
}
export function beginSignup(g, eligible = alive(g).map((p) => p.id)) {
  g.signupSelection = {
    id: crypto.randomUUID(),
    eligible,
    choices: {},
    rationales: {},
    observations: {},
    error: null,
  };
  for (const id of eligible)
    g.signupSelection.observations[id] = observation(g, id, {
      type: 'signup',
      actor: id,
    });
  g.tasks = [{ type: 'signupSelect' }, { type: 'electionSpeeches' }];
}
export function finishSignup(g) {
  const b = g.signupSelection;
  if (!b || g.paused || !b.eligible.every((id) => Object.hasOwn(b.choices, id)))
    return false;
  for (const id of b.eligible) {
    const join = b.choices[id] === 'join';
    if (join) {
      g.candidates.push(id);
      g.signed.push(id);
    }
    log(g, `${id}号${join ? '报名上警' : '选择警下'}`, 'public', {
      actor: id,
      kind: 'signup',
    });
    if (b.rationales[id])
      log(g, b.rationales[id], id, { actor: id, kind: 'rationale' });
  }
  g.candidates.sort((a, b) => a - b);
  g.signed.sort((a, b) => a - b);
  g.signupSelection = null;
  g.tasks.shift();
  g.revision++;
  return true;
}
export function submitSignup(g, id, action) {
  const b = g.signupSelection;
  if (!b || !b.eligible.includes(id)) throw Error('当前不能报名上警');
  if (Object.hasOwn(b.choices, id)) throw Error('已提交上警选择，不能重复提交');
  if (!['join', 'stay'].includes(action.choice)) throw Error('上警选择不合法');
  b.choices[id] = action.choice;
  b.rationales[id] = String(action.rationale || '').slice(0, 1000);
  finishSignup(g);
}
export function finishWolfSelection(g) {
  const b = g.wolfSelection;
  if (
    !b ||
    g.paused ||
    !b.eligible.every((id) => Object.hasOwn(g.night.kills, id))
  )
    return false;
  settleKnife(g);
  for (const id of b.eligible) {
    const target = g.night.kills[id];
    log(
      g,
      `${id}号选择${target ? target + '号' : '空刀'}`,
      g.players[id - 1].role === '狼人' ? 'wolves' : id,
      { actor: id, kind: 'kill' },
    );
    if (b.rationales[id])
      log(g, b.rationales[id], id, { actor: id, kind: 'rationale' });
  }
  g.wolfSelection = null;
  g.tasks.shift();
  g.revision++;
  return true;
}
export function submitWolfChoice(g, id, action) {
  const b = g.wolfSelection;
  if (!b || !b.eligible.includes(id)) throw Error('当前不能选择狼刀');
  if (Object.hasOwn(g.night.kills, id)) throw Error('已提交狼刀，不能重复选择');
  if (!legal(g, { type: 'kill', actor: id }).includes(action.choice))
    throw Error('狼刀目标不合法');
  g.night.kills[id] = action.choice;
  b.rationales[id] = String(action.rationale || '').slice(0, 1000);
  finishWolfSelection(g);
}
export function skipHiddenSpeech(g) {
  if (!g.awaitingAdvance) return false;
  const e = g.events.find((e) => e.id === g.displaySpeech);
  if (
    e?.kind === 'wolfChat' &&
    !g.god &&
    !g.players.some((p) => p.human && p.role === '狼人')
  ) {
    advance(g);
    return true;
  }
  return false;
}
export function killTarget(g) {
  // Old in-progress nights retain their original tie-as-empty behavior.
  if (g.night.knifeTarget !== null && g.night.knifeTarget !== undefined)
    return g.night.knifeTarget;
  const counts = {};
  Object.values(g.night.kills || {}).forEach((id) => {
    if (id) counts[id] = (counts[id] || 0) + 1;
  });
  const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return ids.length && (ids.length === 1 || counts[ids[0]] > counts[ids[1]])
    ? Number(ids[0])
    : 0;
}
export function legal(g, t = g.tasks[0]) {
  if (!t?.actor) return [];
  const p = g.players[t.actor - 1];
  const ids = alive(g).map((p) => p.id);
  switch (t.type) {
    case 'copy':
      return [0, ...ids.filter((i) => i !== p.id)];
    case 'guard':
      return [0, ...ids.filter((i) => i !== p.previousGuard)];
    case 'kill':
      return [0, ...ids];
    case 'extraKill':
      return [0, ...ids.filter((i) => i !== p.id)];
    case 'inspect':
      return ids.filter(
        (i) =>
          i !== p.id &&
          !p.knowledge.some((k) => k.kind === 'inspect' && k.target === i),
      );
    case 'copyPoison':
      return [0, ...ids.filter((i) => i !== p.id)];
    case 'potion': {
      const a = ['none'];
      const target = killTarget(g);
      if (g.antidote && target && target !== p.id) a.push('save');
      if (g.poison)
        a.push(...ids.filter((i) => i !== p.id).map((i) => 'poison:' + i));
      return a;
    }
    case 'shoot':
    case 'badge':
      return [0, ...ids.filter((i) => i !== p.id)];
    case 'signup':
      return ['join', 'stay'];
    case 'withdraw':
      return ['stay', 'withdraw'];
    case 'direction':
      return ['clockwise', 'counterclockwise'];
    case 'vote':
      return [0, ...(g.ballot?.candidates || []).filter((i) => i !== p.id)];
    default:
      return [];
  }
}
export function observation(g, id, task = g.tasks[0]) {
  const p = g.players[id - 1];
  const o = {
    day: g.day,
    phase: g.phase,
    board: '12人镜隐迷踪',
    sheriff: g.sheriff,
    candidates: g.candidates,
    self: {
      id: p.id,
      name: p.name,
      role: p.role,
      copied: p.copied,
      copyAvailable: p.copied && g.day > p.copyDay,
      personality: { mbti: p.mbti, traits: p.traits, prompt: p.prompt },
      knowledge: p.knowledge,
    },
    players: g.players.map((q) => ({
      id: q.id,
      name: q.name,
      alive: q.alive,
      ...(p.role === '狼人' && q.role === '狼人' ? { teammate: true } : {}),
    })),
    events: g.events.filter(
      (e) =>
        e.visibility === 'public' ||
        e.visibility === id ||
        (e.visibility === 'wolves' && p.role === '狼人'),
    ),
    task,
    choices: legal(g, task),
  };
  if (task.type === 'potion' && g.antidote) o.attacked = killTarget(g);
  return o;
}
function speechQueue(g, direction = 'clockwise') {
  let ps = alive(g);
  if (g.sheriff && g.players[g.sheriff - 1].alive) {
    const order = [];
    for (let d = 1; d <= 12; d++) {
      const id =
        ((((g.sheriff - 1 + (direction === 'clockwise' ? d : -d)) % 12) + 12) %
          12) +
        1;
      const p = ps.find((p) => p.id === id);
      if (p) order.push(p);
    }
    ps = order;
  }
  g.phase = 'speech';
  g.tasks = [...tasks('speech', ps), { type: 'voteStart' }];
  log(
    g,
    g.sheriff
      ? `警长选择${direction === 'clockwise' ? '顺时针' : '逆时针'}发言，警长最后归票。`
      : '开始白天发言，按座位顺序进行。',
  );
}
function deathTasks(g, id, cause, night = false) {
  const p = g.players[id - 1];
  const canShoot =
    !p.shotUsed &&
    cause !== 'poison' &&
    (p.role === '猎人' ||
      (p.role === '觉醒隐狼' &&
        p.copied === '猎人' &&
        (g.day > p.copyDay || night)));
  return [
    ...(canShoot ? [{ type: 'shoot', actor: id, night }] : []),
    ...(g.sheriff === id ? [{ type: 'badge', actor: id }] : []),
    ...(!night || g.day === 1 ? [{ type: 'lastWords', actor: id }] : []),
  ];
}
function resolveNight(g) {
  if (!g.nightUnsettled) return [];
  g.nightUnsettled = false;
  const knife = killTarget(g),
    extra = g.night.extra;
  const dead = [];
  const reactions = [];
  for (const p of alive(g)) {
    const guards = (g.night.guards || []).filter((x) => x.target === p.id);
    const guarded = guards.length > 0,
      enhanced = guards.some((x) => x.enhanced);
    const saved = g.night.saved && knife === p.id;
    const poisoned = g.night.poisoned.includes(p.id) && !enhanced;
    const attacked = knife === p.id || extra === p.id;
    const knifeDeath =
      attacked &&
      ((!guarded && !saved) ||
        (guarded && saved) ||
        (extra === p.id && !guarded));
    if (poisoned || knifeDeath) {
      p.alive = false;
      dead.push(p.id);
      reactions.push(
        ...deathTasks(g, p.id, poisoned ? 'poison' : 'knife', true),
      );
    }
  }
  log(
    g,
    dead.length
      ? `天亮了。${dead.join('、')}号昨夜出局。`
      : '天亮了，昨夜平安无事。',
  );
  return reactions;
}
function electionEnd(g, id) {
  g.sheriff = id;
  g.electionPending = false;
  log(g, id ? `${id}号当选警长，获得警徽。` : '本轮未选出警长，警徽流失。');
  if (!id) g.badgeDestroyed = true;
  g.tasks = [{ type: 'dawn' }];
}
export function prepareBallot(g, kind) {
  const candidates =
    kind === 'sheriff'
      ? g.candidates.filter((id) => g.players[id - 1].alive)
      : g.tie.length
        ? g.tie
        : alive(g).map((p) => p.id);
  const eligible = alive(g)
    .filter((p) =>
      kind === 'sheriff' ? !g.signed.includes(p.id) : !g.tie.includes(p.id),
    )
    .map((p) => p.id);
  g.phase = 'vote';
  g.displaySpeech = null;
  g.ballot = {
    id: crypto.randomUUID(),
    kind,
    candidates: [...candidates],
    eligible,
    votes: {},
    rationales: {},
    deadline: null,
    status: 'waiting',
  };
  g.tasks = [{ type: 'ballot' }];
  log(
    g,
    kind === 'sheriff'
      ? '警长投票准备：警下玩家投票。'
      : '放逐投票准备：所有有投票权的玩家同时选择。',
  );
}
export function openBallot(g, now = Date.now()) {
  if (!g.ballot || g.ballot.status !== 'waiting')
    throw Error('当前投票不能重复开启');
  g.ballot.deadline = now + 5000;
  g.ballot.status = 'open';
  log(g, '投票开始，倒计时5秒。超时未投视为弃票。');
}
export function submitBallot(g, id, choice, now = Date.now(), rationale = '') {
  const b = g.ballot;
  if (!b || b.status !== 'open' || now >= b.deadline)
    throw Error('投票已截止，未提交视为弃票');
  if (!b.eligible.includes(id)) throw Error('你没有本轮投票权');
  if (Object.hasOwn(b.votes, id)) throw Error('已提交，本轮不能重复投票');
  if (!legal(g, { type: 'vote', actor: id }).includes(choice))
    throw Error('投票目标不合法');
  b.votes[id] = choice;
  b.rationales[id] = String(rationale).slice(0, 1000);
}
export function closeBallot(g, now = Date.now()) {
  const b = g.ballot;
  if (!b || b.status !== 'open' || now < b.deadline) return false;
  b.status = 'closed';
  const count = {};
  for (const id of b.eligible) {
    const cast = Object.hasOwn(b.votes, id),
      target = b.votes[id] || 0,
      weight = b.kind === 'exile' && g.sheriff === id ? 1.5 : 1;
    log(
      g,
      `${id}号 → ${target ? target + '号' : '弃票'}${!cast ? '（超时未提交）' : ''}${weight === 1.5 ? ' · 1.5票' : ''}`,
      'public',
      { actor: id, kind: 'vote', target, weight, timeout: !cast },
    );
    if (target) count[target] = (count[target] || 0) + weight;
    if (b.rationales[id])
      log(g, b.rationales[id], id, { actor: id, kind: 'rationale' });
  }
  const max = Math.max(0, ...Object.values(count)),
    tied = Object.keys(count)
      .filter((id) => count[id] === max)
      .map(Number);
  g.ballot = null;
  g.revision++;
  if (b.kind === 'sheriff') {
    if (tied.length === 1) electionEnd(g, tied[0]);
    else if (tied.length > 1 && !g.electionRound) {
      g.electionRound = 1;
      g.candidates = tied;
      g.phase = 'election';
      log(g, '警长投票平票，平票候选人进行PK发言。');
      g.tasks = [
        ...tied.map((actor) => ({ type: 'sheriffSpeech', actor })),
        { type: 'sheriffVoteStart' },
      ];
    } else electionEnd(g, 0);
  } else if (tied.length === 1) {
    const id = tied[0];
    g.players[id - 1].alive = false;
    log(g, `${id}号被放逐。`);
    g.tasks = [...deathTasks(g, id, 'vote'), { type: 'nextNight' }];
    finish(g);
  } else if (tied.length > 1 && !g.voteRound) {
    g.voteRound = 1;
    g.tie = tied;
    g.phase = 'speech';
    log(g, `${tied.join('、')}号平票，进入PK发言。`);
    g.tasks = [
      ...tied.map((actor) => ({ type: 'speech', actor })),
      { type: 'voteStart' },
    ];
  } else {
    log(g, '无人被放逐。');
    g.tasks = [{ type: 'nextNight' }];
  }
  return true;
}
export function advance(g) {
  if (!g.awaitingAdvance) throw Error('没有等待确认的发言');
  g.awaitingAdvance = false;
  g.displaySpeech = null;
  g.revision++;
}
export function canExplode(g, id) {
  return (
    !g.winner &&
    !g.ballot &&
    g.players[id - 1]?.alive &&
    g.players[id - 1].role === '狼人' &&
    ['speech', 'election'].includes(g.phase)
  );
}
export function explode(g, id) {
  if (!canExplode(g, id)) throw Error('当前不能自爆');
  const election = g.phase === 'election';
  g.signupSelection = null;
  g.players[id - 1].alive = false;
  g.awaitingAdvance = false;
  g.displaySpeech = null;
  log(g, `${id}号狼人自爆，结束本轮白天流程。`, 'public', {
    reveal: id,
    revealRole: '狼人',
  });
  if (election) {
    g.electionExplosions++;
    g.electionPending = g.electionExplosions < 2;
    if (!g.electionPending) {
      g.badgeDestroyed = true;
      g.sheriff = 0;
      log(g, '连续两次警上自爆，警徽流失。');
    }
  }
  g.phase = 'day';
  const reactions = resolveNight(g);
  g.tasks = [
    ...reactions,
    ...(g.sheriff === id ? [{ type: 'badge', actor: id }] : []),
    { type: 'nextNight' },
  ];
  g.revision++;
  finish(g);
}
export function withdraw(g, id) {
  if (g.phase !== 'election' || !g.candidates.includes(id))
    throw Error('当前无法退水');
  g.candidates = g.candidates.filter((x) => x !== id);
  g.tasks = g.tasks.filter(
    (t) => !(t.actor === id && ['sheriffSpeech', 'withdraw'].includes(t.type)),
  );
  log(g, `${id}号退水，不再竞选警长。`);
  g.revision++;
}
export function apply(g, action = {}) {
  if (g.winner) throw Error('对局已结束');
  if (g.awaitingAdvance) throw Error('请手动点击下一位发言');
  const t = g.tasks[0];
  if (
    !t ||
    t.type === 'ballot' ||
    t.type === 'wolfSelect' ||
    t.type === 'signupSelect'
  )
    throw Error('当前需要同时投票');
  const p = t.actor ? g.players[t.actor - 1] : null;
  const choices = legal(g, t);
  if (
    !SPEECH_TYPES.includes(t.type) &&
    t.actor &&
    choices.length &&
    !choices.includes(action.choice)
  )
    throw Error('行动目标不合法');
  if (SPEECH_TYPES.includes(t.type) && action.choice === 'explode') {
    explode(g, t.actor);
    return g;
  }
  g.tasks.shift();
  g.revision++;
  const choice = action.choice;
  if (SPEECH_TYPES.includes(t.type)) {
    const e = log(
      g,
      String(action.text || '（未发言，过。）').slice(0, 1600),
      t.type === 'wolfChat' ? 'wolves' : 'public',
      { actor: p.id, kind: t.type },
    );
    g.awaitingAdvance = true;
    g.displaySpeech = e.id;
  }
  if (t.type === 'wolfStart') {
    g.wolfSelection = {
      id: crypto.randomUUID(),
      eligible: t.eligible,
      rationales: {},
      observations: {},
      error: null,
    };
    for (const id of t.eligible)
      g.wolfSelection.observations[id] = observation(g, id, {
        type: 'kill',
        actor: id,
      });
    g.tasks.unshift({ type: 'wolfSelect' });
    finishWolfSelection(g);
  }
  if (t.type === 'copy' && choice) {
    p.copied = g.players[choice - 1].role;
    p.copyDay = g.day;
    p.knowledge.push({
      day: g.day,
      kind: 'copy',
      target: choice,
      result: p.copied,
    });
    log(
      g,
      `模仿${choice}号：${p.copied}。身份伪装立即生效，技能在今夜结束后获得。`,
      p.id,
      { actor: p.id, kind: 'copy' },
    );
  }
  if (t.type === 'guard') {
    p.previousGuard = choice;
    g.night.guards.push({
      actor: p.id,
      target: choice,
      enhanced: p.role === '觉醒隐狼',
    });
    log(g, choice ? `守护${choice}号` : '本夜空守', p.id, {
      actor: p.id,
      kind: 'guard',
    });
  }
  if (t.type === 'kill') {
    g.night.kills[p.id] = choice;
    log(
      g,
      `${p.id}号选择${choice ? choice + '号' : '空刀'}`,
      p.role === '狼人' ? 'wolves' : p.id,
      { actor: p.id, kind: 'kill' },
    );
  }
  if (t.type === 'extraKill' && choice) {
    p.extraKnife = false;
    g.night.extra = choice;
    log(g, `使用额外狼刀袭击${choice}号`, p.id, {
      actor: p.id,
      kind: 'extraKill',
    });
  }
  if (t.type === 'inspect' && choices.length) {
    const target = g.players[choice - 1];
    const result =
      target.role === '觉醒隐狼' && target.copied ? target.copied : target.role;
    p.knowledge.push({ day: g.day, kind: 'inspect', target: choice, result });
    log(g, `查验${choice}号：${result}`, p.id, {
      actor: p.id,
      kind: 'inspect',
    });
  }
  if (t.type === 'potion') {
    if (choice === 'save') {
      g.antidote = false;
      g.night.saved = true;
    }
    if (String(choice).startsWith('poison:')) {
      g.poison = false;
      g.night.poisoned.push(Number(choice.split(':')[1]));
    }
    log(
      g,
      choice === 'save'
        ? '使用解药'
        : choice === 'none'
          ? '未使用药剂'
          : `使用毒药：${choice.split(':')[1]}号`,
      p.id,
      { actor: p.id, kind: 'potion' },
    );
  }
  if (t.type === 'copyPoison' && choice) {
    p.copyPoison = false;
    g.night.poisoned.push(choice);
    log(g, `使用模仿毒药：${choice}号`, p.id, {
      actor: p.id,
      kind: 'copyPoison',
    });
  }
  if (t.type === 'electionStart') {
    g.phase = 'election';
    g.candidates = [];
    g.signed = [];
    g.electionRound = 0;
    log(g, '天亮前进入警长竞选。先报名上警，竞选结束后公布昨夜结果。');
    beginSignup(g);
  }
  if (t.type === 'signup') {
    if (choice === 'join') {
      g.candidates.push(p.id);
      g.signed.push(p.id);
    }
    log(g, `${p.id}号${choice === 'join' ? '报名上警' : '选择警下'}`);
  }
  if (t.type === 'electionSpeeches') {
    if (g.candidates.length <= 1) electionEnd(g, g.candidates[0] || 0);
    else
      g.tasks = [
        ...g.candidates.map((actor) => ({ type: 'sheriffSpeech', actor })),
        ...g.candidates.map((actor) => ({ type: 'withdraw', actor })),
        { type: 'sheriffVoteStart' },
      ];
  }
  if (t.type === 'withdraw' && choice === 'withdraw') {
    g.candidates = g.candidates.filter((id) => id !== p.id);
    log(g, `${p.id}号退水。`);
  }
  if (t.type === 'sheriffVoteStart') {
    if (g.candidates.length <= 1) electionEnd(g, g.candidates[0] || 0);
    else prepareBallot(g, 'sheriff');
  }
  if (t.type === 'dawn') {
    g.phase = 'day';
    g.tasks = [...resolveNight(g), { type: 'dayStart' }];
    finish(g);
  }
  if (t.type === 'dayStart' && !finish(g)) {
    if (g.sheriff && g.players[g.sheriff - 1].alive)
      g.tasks = [{ type: 'direction', actor: g.sheriff }];
    else speechQueue(g);
  }
  if (t.type === 'direction') speechQueue(g, choice);
  if (t.type === 'voteStart') prepareBallot(g, 'exile');
  if (t.type === 'shoot') {
    p.shotUsed = true;
    if (choice) {
      g.players[choice - 1].alive = false;
      log(g, `${p.id}号亮明猎人身份，带走${choice}号。`, 'public', {
        reveal: p.id,
        revealRole: '猎人',
      });
      g.tasks = g.tasks.filter(
        (t) => !(t.actor === choice && t.type === 'lastWords'),
      );
      g.tasks.unshift(...deathTasks(g, choice, 'shot', t.night));
    } else log(g, `${p.id}号放弃开枪。`, p.id);
    finish(g);
  }
  if (t.type === 'badge') {
    g.sheriff = choice;
    if (!choice) g.badgeDestroyed = true;
    log(
      g,
      choice ? `${p.id}号将警徽移交给${choice}号。` : `${p.id}号撕毁警徽。`,
    );
  }
  if (t.type === 'nextNight' && !finish(g)) {
    g.day++;
    beginNight(g);
  }
  if (action.rationale && p)
    log(g, String(action.rationale).slice(0, 1000), p.id, {
      actor: p.id,
      kind: 'rationale',
    });
  return g;
}
export function demoDecision(g, t = g.tasks[0]) {
  const ob = observation(g, t.actor, t),
    choices = ob.choices;
  let choice = choices.find((x) => x !== 0 && x !== 'none') ?? choices[0];
  if (t.type === 'signup') choice = t.actor % 3 === 1 ? 'join' : 'stay';
  if (t.type === 'withdraw') choice = 'stay';
  if (t.type === 'potion') choice = choices.includes('save') ? 'save' : 'none';
  if (t.type === 'copyPoison') choice = 0;
  if (t.type === 'kill')
    choice = choices.find((i) => i && g.players[i - 1].role !== '狼人') ?? 0;
  return {
    choice,
    text: `${ob.self.personality.mbti === 'INFJ' ? '在下认为，' : ''}${t.type === 'sheriffSpeech' ? '我希望承担警长职责，认真梳理大家的证据。' : '我会结合公开发言和票型判断，暂不把猜测当成事实。'}请下一位补充看法。`,
    rationale: '规则演示：固定策略，仅供验证流程。',
  };
}
export const stageNames = {
  copy: '觉醒隐狼模仿',
  guard: '守卫行动',
  wolfChat: '狼人密谈',
  wolfStart: '狼队准备选择目标',
  wolfSelect: '狼人正在选择袭击目标',
  kill: '狼人袭击',
  extraKill: '额外狼刀',
  inspect: '魔镜少女查验',
  potion: '女巫用药',
  copyPoison: '模仿毒药',
  electionStart: '警长竞选',
  signup: '上警报名',
  signupSelect: '全体同时选择是否上警',
  electionSpeeches: '警上发言准备',
  sheriffSpeech: '警上竞选发言',
  withdraw: '退水选择',
  sheriffVoteStart: '警长投票准备',
  ballot: '同时投票',
  dawn: '公布昨夜结果',
  dayStart: '白天开始',
  direction: '警长选择发言顺序',
  speech: '白天发言',
  lastWords: '发表遗言',
  voteStart: '放逐投票准备',
  shoot: '猎人开枪',
  badge: '移交警徽',
  nextNight: '进入下一夜',
};
export function view(g) {
  if (!g) return null;
  if (g.version !== 2) {
    const v = legacyView({ ...g, god: true });
    return {
      ...v,
      legacy: true,
      winner: g.winner || '旧版存档（只读）',
      paused: true,
      task: null,
      stage: '九人旧版存档 · 只读保留',
      awaitingAdvance: false,
      ballot: null,
    };
  }
  const human = g.players.find((p) => p.human),
    reveal = g.winner || g.god;
  const visible = (e) =>
    e.visibility === 'public' ||
    reveal ||
    e.visibility === human?.id ||
    (e.visibility === 'wolves' && human?.role === '狼人');
  const t = g.tasks[0],
    p = g.players[(t?.actor || 0) - 1];
  const display = g.awaitingAdvance
    ? g.events.find((e) => e.id === g.displaySpeech && visible(e))
    : null;
  // Night stage names are public host announcements; the acting seat is private.
  let stage = t ? stageNames[t.type] || t.type : '对局结束';
  if (g.phase === 'night' && p?.role === '觉醒隐狼' && !reveal && !p.human)
    stage = t.type === 'copy' ? '觉醒隐狼行动' : '夜间技能结算';
  if (g.ballot)
    stage =
      (g.ballot.kind === 'sheriff' ? '警长竞选投票' : '放逐投票') +
      ' · 5秒同时投票';
  else if (g.awaitingAdvance)
    stage =
      (display ? `${display.actor}号发言结束` : '本段发言结束') +
      ' · 请点击下一位';
  else if (t?.actor && g.phase !== 'night') stage = `${t.actor}号 · ${stage}`;
  const b = g.ballot;
  return {
    id: g.id,
    version: g.version,
    mode: g.mode,
    god: g.god,
    demo: g.demo,
    day: g.day,
    phase: g.phase,
    revision: g.revision,
    paused: g.paused,
    winner: g.winner,
    spent: g.spent,
    tokens: g.tokens,
    budget: g.budget,
    sheriff: g.sheriff,
    stage,
    signupSelection: g.signupSelection
      ? {
          id: g.signupSelection.id,
          humanEligible:
            !!human && g.signupSelection.eligible.includes(human.id),
          humanSubmitted:
            !!human && Object.hasOwn(g.signupSelection.choices, human.id),
          submittedCount: Object.keys(g.signupSelection.choices).length,
          total: g.signupSelection.eligible.length,
          error: g.signupSelection.error
            ? '报名请求未完成，已暂停；继续后仅重试未完成的选择。'
            : null,
        }
      : null,
    wolfSelection: g.wolfSelection
      ? {
          id: g.wolfSelection.id,
          humanEligible: !!human && g.wolfSelection.eligible.includes(human.id),
          humanSubmitted: !!human && Object.hasOwn(g.night.kills, human.id),
          choices:
            human && g.wolfSelection.eligible.includes(human.id)
              ? legal(g, { type: 'kill', actor: human.id })
              : [],
          error: g.wolfSelection.error
            ? '狼刀请求未完成，已暂停；继续后重试未完成的选择。'
            : null,
        }
      : null,
    awaitingAdvance: g.awaitingAdvance,
    displaySpeech: display || null,
    candidates: g.candidates,
    canWithdraw:
      !!human && g.phase === 'election' && g.candidates.includes(human.id),
    canExplode: !!human && canExplode(g, human.id),
    players: g.players.map((q) => ({
      id: q.id,
      name: q.name,
      avatar: q.avatar,
      avatarIndex: q.avatarIndex,
      mbti: q.mbti,
      traits: q.traits,
      alive: q.alive,
      human: q.human,
      sheriff: q.id === g.sheriff,
      ...(reveal || q.human || (human?.role === '狼人' && q.role === '狼人')
        ? { role: q.role }
        : g.events.some((e) => e.reveal === q.id)
          ? {
              role: [...g.events].reverse().find((e) => e.reveal === q.id)
                .revealRole,
            }
          : {}),
      ...(q.human || reveal
        ? { knowledge: q.knowledge, copied: q.copied }
        : {}),
    })),
    events: g.events.filter(visible),
    task: t
      ? {
          type: t.type,
          actor:
            g.phase !== 'night' || reveal || p?.human ? t.actor : undefined,
          human: !!p?.human,
        }
      : null,
    choices: p?.human ? legal(g) : [],
    ballot: b
      ? {
          id: b.id,
          kind: b.kind,
          deadline: b.deadline,
          status: b.status,
          eligible: b.eligible,
          submitted: Object.keys(b.votes).map(Number),
          humanEligible: !!human && b.eligible.includes(human.id),
          humanSubmitted: !!human && Object.hasOwn(b.votes, human.id),
          choices: human ? legal(g, { type: 'vote', actor: human.id }) : [],
        }
      : null,
    ...(p?.human && t.type === 'potion' && g.antidote
      ? { attacked: killTarget(g) }
      : {}),
  };
}
