export const roles = [
  '狼人',
  '狼人',
  '狼人',
  '预言家',
  '女巫',
  '猎人',
  '村民',
  '村民',
  '村民',
];
export const presets = [
  [
    '沈清辞',
    'INFJ',
    '温柔、谨慎',
    '古风小生，称自己为在下，措辞文雅但推理明确',
    '☾',
  ],
  ['林烬', 'ENTJ', '强势、果断', '直接指出矛盾，主动组织票型', '♜'],
  ['苏晚', 'ENFJ', '温柔、共情', '耐心倾听，温和质疑，不轻信情绪', '✧'],
  ['顾衡', 'INTJ', '冷静、严谨', '先区分事实与假设，再做推断', '♞'],
  ['唐梨', 'ENFP', '活泼、机敏', '轻松俏皮，关注细节', '❀'],
  ['祁夜', 'ENTP', '毒舌、善辩', '可以犀利吐槽发言逻辑，但不辱骂玩家', '♠'],
  ['白露', 'ISTJ', '沉稳、细致', '重视时间线、承诺和投票记录', '❖'],
  ['陆星河', 'INTP', '好奇、独立', '提出多种假设并寻找反例', '✦'],
  ['你', '自定义', '自由发挥', '由你亲自发言', '◇'],
].map(([name, mbti, traits, prompt, avatar], i) => ({
  id: i + 1,
  name,
  mbti,
  traits,
  prompt,
  avatar,
  avatarIndex: i,
}));
const clone = (x) => structuredClone(x);
export function createGame(options = {}, random = Math.random) {
  const pool = [...roles];
  for (let i = 8; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (options.mode === 'practice' && roles.includes(options.role)) {
    const n = pool.indexOf(options.role);
    [pool[n], pool[8]] = [pool[8], pool[n]];
  }
  if (options.mode === 'director' && options.assigned) {
    if (
      JSON.stringify([...options.assigned].sort()) !==
      JSON.stringify([...roles].sort())
    )
      throw Error('导演身份必须为三狼、三民、预言家、女巫、猎人各一位');
    pool.splice(0, 9, ...options.assigned);
  }
  const g = {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    mode: options.mode || 'normal',
    god: options.mode === 'director' && !!options.god,
    demo: !!options.demo,
    day: 1,
    phase: 'night',
    players: (options.characters || presets).map((c, i) => ({
      ...clone(c),
      id: i + 1,
      role: pool[i],
      alive: true,
      human: i === 8 && options.mode !== 'director',
      knowledge: [],
    })),
    events: [],
    tasks: [],
    revision: 0,
    paused: true,
    winner: null,
    antidote: true,
    poison: true,
    night: {},
    votes: {},
    tie: [],
    round: 0,
    spent: 0,
    tokens: { input: 0, output: 0 },
    budget: Number(options.budget) || 5,
  };
  beginNight(g);
  return g;
}
export function log(g, text, visibility = 'public', extra = {}) {
  g.events.push({
    id: g.events.length + 1,
    day: g.day,
    phase: g.phase,
    text,
    visibility,
    ...extra,
  });
}
const living = (g) => g.players.filter((p) => p.alive);
const tasks = (g, type, ps) => ps.map((p) => ({ type, actor: p.id }));
export function beginNight(g) {
  g.phase = 'night';
  g.night = {};
  g.round = 0;
  g.tie = [];
  log(g, '天黑请闭眼。');
  const wolves = living(g).filter((p) => p.role === '狼人');
  g.tasks = [
    ...tasks(g, 'wolfChat', wolves),
    ...tasks(g, 'kill', wolves),
    ...tasks(
      g,
      'inspect',
      living(g).filter((p) => p.role === '预言家'),
    ),
    ...tasks(
      g,
      'potion',
      living(g).filter((p) => p.role === '女巫'),
    ),
    { type: 'dawn' },
  ];
}
export function winner(g) {
  const a = living(g);
  return !a.some((p) => p.role === '狼人')
    ? '好人'
    : !a.some((p) => p.role === '村民') ||
        !a.some((p) => !['狼人', '村民'].includes(p.role))
      ? '狼人'
      : null;
}
function finish(g) {
  const w = winner(g);
  if (w) {
    g.winner = w;
    g.phase = 'over';
    g.tasks = [];
    g.paused = true;
    log(g, `${w}阵营获胜，身份揭晓。`);
  }
  return !!w;
}
export function killTarget(g) {
  const tally = {};
  for (const t of Object.values(g.night.kills || {}))
    if (t) tally[t] = (tally[t] || 0) + 1;
  const ids = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
  return ids.length && (ids.length === 1 || tally[ids[0]] > tally[ids[1]])
    ? Number(ids[0])
    : 0;
}
export function legal(g, t = g.tasks[0]) {
  if (!t?.actor) return [];
  const p = g.players[t.actor - 1];
  let ids = living(g).map((x) => x.id);
  switch (t.type) {
    case 'kill':
      return [0, ...ids.filter((i) => g.players[i - 1].role !== '狼人')];
    case 'inspect':
      return ids.filter(
        (i) => i !== p.id && !p.knowledge.some((k) => k.target === i),
      );
    case 'potion': {
      const a = ['none'];
      const target = killTarget(g);
      if (g.antidote && target && (target !== p.id || g.day === 1))
        a.push('save');
      if (g.poison)
        a.push(...ids.filter((i) => i !== p.id).map((i) => 'poison:' + i));
      return a;
    }
    case 'vote':
      return [0, ...(g.tie.length ? g.tie : ids).filter((i) => i !== p.id)];
    case 'shoot':
      return [0, ...ids.filter((i) => i !== p.id)];
    default:
      return [];
  }
}
export function observation(g, id) {
  const p = g.players[id - 1];
  return {
    day: g.day,
    phase: g.phase,
    self: {
      id,
      name: p.name,
      role: p.role,
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
    task: g.tasks[0],
    choices: legal(g),
    ...(g.tasks[0]?.type === 'potion' && g.antidote
      ? { attacked: killTarget(g) }
      : {}),
  };
}
export function apply(g, action = {}) {
  if (g.winner) throw Error('对局已结束');
  const t = g.tasks[0];
  if (!t) throw Error('没有待执行阶段');
  const p = t.actor ? g.players[t.actor - 1] : null;
  const choice = action.choice;
  const text = String(action.text || '').slice(0, 1600);
  const rationale = String(action.rationale || '').slice(0, 1000);
  if (
    ['kill', 'vote', 'shoot', 'potion'].includes(t.type) &&
    !legal(g).includes(choice)
  )
    throw Error('目标不合法');
  if (t.type === 'inspect' && legal(g).length && !legal(g).includes(choice))
    throw Error('查验目标不合法');
  g.tasks.shift();
  g.revision++;
  if (['speech', 'lastWords', 'wolfChat'].includes(t.type)) {
    log(
      g,
      text || '（未发言，过。）',
      t.type === 'wolfChat' ? 'wolves' : 'public',
      { actor: p.id, kind: t.type },
    );
  }
  if (t.type === 'kill') {
    g.night.kills ??= {};
    g.night.kills[p.id] = choice;
    log(g, `${p.id}号选择${choice ? choice + '号' : '空刀'}`, 'wolves', {
      actor: p.id,
      kind: 'kill',
    });
  }
  if (t.type === 'inspect' && legal(g, t).length) {
    const result = g.players[choice - 1].role === '狼人' ? '狼人' : '好人';
    p.knowledge.push({ day: g.day, target: choice, result });
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
      g.night.poisoned = Number(choice.split(':')[1]);
    }
    log(
      g,
      choice === 'save'
        ? '使用解药'
        : choice === 'none'
          ? '未使用药剂'
          : `毒杀${g.night.poisoned}号`,
      p.id,
      { actor: p.id, kind: 'potion' },
    );
  }
  if (t.type === 'vote') {
    g.votes[p.id] = choice;
  }
  if (rationale && p)
    log(g, rationale, p.id, { actor: p.id, kind: 'rationale' });
  if (t.type === 'dawn') {
    g.phase = 'day';
    const target = killTarget(g);
    const dead = [
      ...new Set(
        [!g.night.saved ? target : 0, g.night.poisoned].filter(Boolean),
      ),
    ];
    dead.forEach((id) => (g.players[id - 1].alive = false));
    log(
      g,
      dead.length
        ? `天亮了。${dead.join('、')}号昨夜出局。`
        : '天亮了，昨夜平安无事。',
    );
    const hunters = dead.filter(
      (id) => g.players[id - 1].role === '猎人' && id !== g.night.poisoned,
    );
    g.tasks = [
      ...hunters.map((actor) => ({ type: 'shoot', actor, night: true })),
      ...(g.day === 1
        ? dead.map((actor) => ({ type: 'lastWords', actor }))
        : []),
      { type: 'dayStart' },
    ];
    if (!hunters.length && winner(g)) finish(g);
  }
  if (t.type === 'dayStart') {
    if (!finish(g)) {
      g.phase = 'speech';
      g.tasks = [...tasks(g, 'speech', living(g)), { type: 'voteStart' }];
    }
  }
  if (t.type === 'voteStart') {
    g.phase = 'vote';
    g.votes = {};
    g.tasks = [
      ...tasks(
        g,
        'vote',
        living(g).filter((p) => !g.tie.includes(p.id)),
      ),
      { type: 'voteEnd' },
    ];
    log(
      g,
      g.round
        ? '平票玩家发言结束，开始第二轮投票。'
        : '发言结束，开始放逐投票。',
    );
  }
  if (t.type === 'voteEnd') {
    const count = {};
    for (const [id, target] of Object.entries(g.votes)) {
      log(g, `${id}号 → ${target ? target + '号' : '弃票'}`, 'public', {
        kind: 'vote',
        actor: Number(id),
        target,
      });
      if (target) count[target] = (count[target] || 0) + 1;
    }
    const max = Math.max(0, ...Object.values(count));
    const tied = Object.keys(count)
      .filter((id) => count[id] === max)
      .map(Number);
    if (tied.length === 1) {
      const victim = g.players[tied[0] - 1];
      victim.alive = false;
      log(g, `${victim.id}号被放逐。`);
      g.tasks = [
        ...(victim.role === '猎人'
          ? [{ type: 'shoot', actor: victim.id }]
          : []),
        { type: 'lastWords', actor: victim.id },
        { type: 'nextNight' },
      ];
      if (victim.role !== '猎人' && winner(g)) finish(g);
    } else if (tied.length > 1 && !g.round) {
      g.tie = tied;
      g.round = 1;
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
  }
  if (t.type === 'shoot') {
    if (choice) {
      g.players[choice - 1].alive = false;
      log(g, `${p.id}号亮明猎人身份，带走${choice}号。`, 'public', {
        reveal: p.id,
      });
      g.tasks = g.tasks.filter((q) => q.actor !== choice);
      if (!t.night || g.day === 1)
        g.tasks.unshift({ type: 'lastWords', actor: choice });
    } else log(g, `${p.id}号放弃开枪。`, p.id);
    if (winner(g)) finish(g);
  }
  if (t.type === 'nextNight' && !finish(g)) {
    g.day++;
    beginNight(g);
  }
  return g;
}
export function demoDecision(g) {
  const t = g.tasks[0],
    o = observation(g, t.actor),
    choices = o.choices;
  const others = o.players.filter((p) => p.alive && p.id !== t.actor);
  const target = others[(g.day + t.actor) % Math.max(1, others.length)]?.id;
  let choice = choices.find((x) => x !== 0 && x !== 'none') ?? choices[0];
  if (t.type === 'potion') choice = choices.includes('save') ? 'save' : 'none';
  return {
    choice,
    text:
      t.type === 'wolfChat'
        ? `先关注${target}号的发言，保持口径一致。`
        : `${o.self.personality.mbti === 'INFJ' ? '在下认为，' : ''}${g.day === 1 ? '目前信息有限，先听大家的身份声明。' : '我会对照昨天的发言和投票。'}我想请${target || '其他'}号解释判断依据。不要只凭语气定身份。`,
    rationale: '规则演示：按固定策略推进，不代表真实模型推理。',
  };
}
export function view(g) {
  if (!g) return null;
  const reveal = g.winner || g.god;
  const human = g.players.find((p) => p.human);
  const allowed = (e) =>
    e.visibility === 'public' ||
    reveal ||
    e.visibility === human?.id ||
    (e.visibility === 'wolves' && human?.role === '狼人');
  const t = g.tasks[0];
  const actor = g.players[(t?.actor || 0) - 1];
  return {
    id: g.id,
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
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      avatarIndex: p.avatarIndex,
      mbti: p.mbti,
      traits: p.traits,
      alive: p.alive,
      human: p.human,
      ...(reveal ||
      p.human ||
      (human?.role === '狼人' && p.role === '狼人') ||
      g.events.some((e) => e.reveal === p.id)
        ? { role: p.role }
        : {}),
      ...(p.human || reveal ? { knowledge: p.knowledge } : {}),
    })),
    events: g.events.filter(allowed),
    task: t
      ? {
          type:
            actor?.human || reveal || g.phase !== 'night' ? t.type : 'night',
          actor:
            actor?.human || reveal || g.phase !== 'night' ? t.actor : undefined,
          human: !!actor?.human,
        }
      : null,
    choices: actor?.human ? legal(g) : [],
    ...(actor?.human && t.type === 'potion' && g.antidote
      ? { attacked: killTarget(g) }
      : {}),
  };
}
