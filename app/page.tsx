'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Moon,
  ArrowUpRight,
  Users,
  BookOpen,
  Settings,
  ArrowLeft,
  Pause,
  Play,
  Send,
  Eye,
  Shield,
  ScrollText,
} from 'lucide-react';
const roleList = [
  '狼人',
  '觉醒隐狼',
  '魔镜少女',
  '女巫',
  '猎人',
  '守卫',
  '村民',
];
const stringActions = ['potion', 'signup', 'withdraw', 'direction'];
function choiceLabel(v: any) {
  return (
    (
      {
        join: '报名上警',
        stay: '保留 / 不上警',
        withdraw: '退水',
        clockwise: '顺时针，警长最后发言',
        counterclockwise: '逆时针，警长最后发言',
        none: '不用药',
        save: '使用解药',
      } as any
    )[v] ??
    (v === 0
      ? '弃权 / 不行动'
      : String(v).startsWith('poison:')
        ? '毒杀 ' + String(v).split(':')[1] + '号'
        : v + '号')
  );
}
const types: any = {
  copy: '觉醒隐狼模仿',
  guard: '守卫行动',
  extraKill: '额外狼刀',
  copyPoison: '模仿毒药',
  signup: '报名上警',
  signupSelect: '全体同时选择是否上警',
  withdraw: '退水选择',
  direction: '选择发言方向',
  badge: '移交警徽',
  sheriffSpeech: '警上发言',
  ballot: '同时投票',
  night: '夜间行动',
  wolfChat: '狼队密谈',
  wolfStart: '狼队准备选择目标',
  wolfSelect: '狼人正在选择袭击目标',
  kill: '选择袭击目标',
  inspect: '魔镜少女查验',
  potion: '女巫用药',
  dawn: '等待天亮',
  dayStart: '白天开始',
  speech: '轮流发言',
  voteStart: '开始投票',
  vote: '放逐投票',
  voteEnd: '公布票型',
  shoot: '猎人开枪',
  lastWords: '发表遗言',
  nextNight: '进入下一夜',
};
function Pick({ value, onChange, items, label }: any) {
  return (
    <label className="field">
      {label}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue>
            {items.find((x: any) => x[0] === value)?.[1] || value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {items.map(([v, l]: any) => (
            <SelectItem value={v} key={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function Portrait({ seat, avatar }: any) {
  return (
    <div
      className="portrait"
      style={{
        backgroundPosition: `${((seat - 1) % 3) * 50}% ${Math.floor((seat - 1) / 3) * 50}%`,
      }}
    >
      <span>{avatar}</span>
    </div>
  );
}
export default function Home() {
  const [data, setData] = useState<any>(null),
    [screen, setScreen] = useState('home'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [characters, setCharacters] = useState<any[]>([]),
    [seat, setSeat] = useState(1),
    [mode, setMode] = useState('normal'),
    [role, setRole] = useState('random'),
    [god, setGod] = useState('blind'),
    [assigned, setAssigned] = useState([
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
    ]),
    [engine, setEngine] = useState('demo'),
    [budget, setBudget] = useState('5'),
    [draft, setDraft] = useState(''),
    [choice, setChoice] = useState(''),
    [remaining, setRemaining] = useState(90),
    [visible, setVisible] = useState(0),
    [note, setNote] = useState(''),
    [hold, setHold] = useState(3),
    [speed, setSpeed] = useState(40),
    [modal, setModal] = useState(''),
    [preview, setPreview] = useState(''),
    [replay, setReplay] = useState<any>(null),
    [filter, setFilter] = useState('all'),
    [notice, setNotice] = useState(''),
    [trial, setTrial] = useState('介绍自己，并说说你会怎样找出狼人。'),
    [now, setNow] = useState(Date.now());
  const lock = useRef(false),
    clock = useRef(0),
    lastTick = useRef(0),
    latest = useRef<any>(null);
  const [submittingTask, setSubmittingTask] = useState('');
  const g = screen === 'replay' ? replay : data?.game;
  const inspectionResults = (
    g?.players.find((p: any) => p.human)?.knowledge || []
  ).filter((k: any) => k.kind === 'inspect' && k.day === g?.day);
  const c = characters[seat - 1];
  async function api(body?: any) {
    const r = await fetch(
      '/api/game',
      body
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : undefined,
    );
    const d: any = await r.json();
    d.clockOffset = (d.serverNow || Date.now()) - Date.now();
    if (!r.ok) throw Error(d.error || '操作失败');
    return d;
  }
  async function act(body: any) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    if (body.op === 'step' && g?.task?.human) setSubmittingTask(g.task.type);
    try {
      const d = await api(body);
      setData(d);
      return d;
    } catch (e: any) {
      setError(e.message);
      try {
        setData(await api());
      } catch {}
      return null;
    } finally {
      lock.current = false;
      setBusy(false);
      setSubmittingTask('');
    }
  }
  useEffect(() => {
    api()
      .then((d) => {
        setData(d);
        setCharacters(d.characters);
      })
      .catch((e) => setError(e.message));
    const pref = JSON.parse(
      localStorage.getItem('moonlit-preferences') || '{}',
    );
    setHold(pref.hold ?? 3);
    setSpeed(pref.speed ?? 40);
  }, []);
  useEffect(() => {
    localStorage.setItem(
      'moonlit-preferences',
      JSON.stringify({ hold, speed }),
    );
  }, [hold, speed]);
  useEffect(() => {
    if (!g) return;
    clock.current = 0;
    lastTick.current = Date.now();
    setVisible(0);
    setChoice('');
    const saved = JSON.parse(
      localStorage.getItem('moonlit-draft-' + g.id + '-' + g.revision) || '{}',
    );
    setDraft(saved.text || '');
    setRemaining(saved.remaining ?? 90);
    setNote(localStorage.getItem('moonlit-notes-' + g.id) || '');
  }, [g?.id, g?.revision]);
  useEffect(() => {
    if (g && screen === 'game')
      localStorage.setItem(
        'moonlit-draft-' + g.id + '-' + g.revision,
        JSON.stringify({ text: draft, remaining }),
      );
  }, [draft, remaining, g?.id, g?.revision]);
  const logs = g?.events || [];
  const isVoting = !!g?.ballot;
  const publicSpeech = g?.awaitingAdvance ? g.displaySpeech : null;
  const voteSeconds = g?.ballot?.deadline
    ? Math.max(0, (g.ballot.deadline - now - (data?.clockOffset || 0)) / 1000)
    : 5;
  const spoken = isVoting
    ? g.ballot.status === 'waiting'
      ? '投票准备中。倒计时开始后，你和所有AI同时选择。'
      : '全体同时投票，剩余 ' +
        voteSeconds.toFixed(1) +
        ' 秒。截止后未提交视为弃票，所有票型统一公布。'
    : publicSpeech?.text || g?.stage || '月色渐深，等待下一段故事。';
  useEffect(() => {
    if (screen !== 'game') return;
    let active = true;
    let pending = false;
    const id = setInterval(async () => {
      if (pending || lock.current) return;
      pending = true;
      try {
        const d = await api();
        if (active && !lock.current)
          setData((old: any) =>
            !old?.serverNow || d.serverNow >= old.serverNow ? d : old,
          );
      } catch {
      } finally {
        pending = false;
      }
    }, 250);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [screen]);
  latest.current = {
    g,
    screen,
    busy,
    draft,
    remaining,
    hold,
    speed,
    spoken,
    isVoting,
    visible,
  };
  useEffect(() => {
    const timer = setInterval(() => {
      const x = latest.current;
      const now = Date.now(),
        delta = Math.min(250, now - lastTick.current);
      lastTick.current = now;
      setNow(now);
      if (
        !x?.g ||
        x.screen !== 'game' ||
        x.g.paused ||
        x.g.winner ||
        lock.current
      )
        return;
      if (x.g.ballot?.status === 'open') return;
      clock.current += delta;
      setVisible((v) => Math.min(x.spoken.length, v + x.speed / 10));
      if (x.g.awaitingAdvance) return;
      if (x.g.task?.human) {
        if (
          ['speech', 'lastWords', 'wolfChat', 'sheriffSpeech'].includes(
            x.g.task.type,
          )
        ) {
          setRemaining((v) => Math.max(0, v - delta / 1000));
          if (x.remaining <= 0)
            void act({
              op: 'step',
              revision: x.g.revision,
              action: { text: x.draft },
            });
        }
        return;
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      !g ||
      screen !== 'game' ||
      g.paused ||
      g.winner ||
      g.awaitingAdvance ||
      g.task?.human ||
      g.wolfSelection ||
      g.signupSelection ||
      g.ballot?.status === 'open' ||
      busy ||
      lock.current ||
      data?.busy
    )
      return;
    void act({ op: 'step', revision: g.revision });
  }, [
    screen,
    g?.id,
    g?.revision,
    g?.paused,
    g?.awaitingAdvance,
    g?.task?.type,
    g?.task?.human,
    !!g?.wolfSelection,
    !!g?.signupSelection,
    g?.ballot?.status,
    busy,
    data?.busy,
  ]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'get_werewolf_state',
          description: '读取当前玩家合法可见的对局信息，不泄露隐藏身份。',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async () => {
            const d = await api();
            return d.game;
          },
        },
        opts,
      ),
    ).catch(() => {});
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'pause_werewolf',
          description: '暂停当前狼人杀对局。',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          execute: async () => {
            const d = await api({ op: 'pause', value: true });
            setData(d);
            return { paused: d.game?.paused };
          },
        },
        opts,
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  async function goHome() {
    if (data?.game && !data.game.winner)
      await act({ op: 'pause', value: true });
    setScreen('home');
  }
  async function start() {
    await act({ op: 'characters', characters });
    const d = await act({
      op: 'start',
      mode,
      role,
      god: god === 'god',
      demo: engine === 'demo',
      budget: Number(budget),
      ...(mode === 'director' ? { assigned } : {}),
    });
    if (d) {
      setScreen('game');
      await act({ op: 'pause', value: false });
    }
  }
  async function pause() {
    // Bypass the UI action lock so an in-flight model request can be paused.
    try {
      const d = await api({ op: 'pause', value: !g.paused });
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  }
  function update(k: string, v: string) {
    setCharacters((cs) =>
      cs.map((x, i) => (i === seat - 1 ? { ...x, [k]: v } : x)),
    );
  }
  const header = (
    <header>
      <a
        href="#"
        className="brand"
        onClick={(e) => {
          e.preventDefault();
          void goHome();
        }}
      >
        <Moon />
        月下疑局 <small>MOONLIT</small>
      </a>
      <div className="row">
        <span className="status-dot" />
        {data?.config.configured ? 'DeepSeek 已配置' : 'DeepSeek 待配置'}
        <Button
          variant="ghost"
          aria-label="游戏设置"
          onClick={() => setModal('settings')}
        >
          <Settings />
        </Button>
      </div>
    </header>
  );
  const errorBox = error ? (
    <div className="error" role="alert">
      {error}
      <Button variant="ghost" onClick={() => setError('')}>
        关闭
      </Button>
    </div>
  ) : null;
  if (screen === 'home')
    return (
      <main className="lobby">
        {header}
        {errorBox}
        <section className="intro">
          <p className="eyebrow">THE VILLAGE AWAITS</p>
          <h1>
            月光之下，
            <br />
            谁的话可信？
          </h1>
          <p>
            为每一个对手赋予性格。
            <br />
            在谎言与线索之间，找到你的答案。
          </p>
          <div className="row">
            <Button
              className="gold"
              disabled={!data}
              onClick={() => setScreen('prepare')}
            >
              进入村庄 <ArrowUpRight />
            </Button>
            {data?.game && !data.game.winner && !data.game.legacy && (
              <Button variant="outline" onClick={() => setScreen('game')}>
                继续对局 · 第{data.game.day}天
              </Button>
            )}
          </div>
          <p className="hint">12人镜隐迷踪 · 有警长 · 纯文字 · 本地存档</p>
        </section>
        <nav className="lobby-nav">
          <Button
            variant="outline"
            disabled={!data}
            onClick={() => setScreen('characters')}
          >
            <Users />
            角色档案
          </Button>
          <Button
            variant="outline"
            disabled={!data}
            onClick={() => setScreen('history')}
          >
            <BookOpen />
            往日对局
          </Button>
          <Button variant="outline" onClick={() => setModal('rules')}>
            <ScrollText />
            村庄规则
          </Button>
        </nav>
        <footer>
          <span>夜色藏住身份，言语留下痕迹。</span>
          <span>01 / MOONLIT VILLAGE</span>
        </footer>
        {dialogs()}
      </main>
    );
  function dialogs() {
    if (modal === 'end' || modal === 'explode')
      return (
        <AlertDialog open onOpenChange={(open) => !open && setModal('')}>
          <AlertDialogContent className="dialog">
            <AlertDialogTitle>
              {modal === 'explode' ? '确认狼人自爆？' : '结束当前对局？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {modal === 'explode'
                ? '你将公开狼人身份并出局，白天提前结束。'
                : '本局将保存到历史并揭晓身份，无法继续。'}
            </AlertDialogDescription>
            <div className="row">
              <Button variant="outline" onClick={() => setModal('')}>
                继续保留
              </Button>
              <Button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  const d = await act(
                    modal === 'explode'
                      ? { op: 'explode', revision: g.revision }
                      : { op: 'archive' },
                  );
                  if (d) setModal('');
                }}
              >
                {modal === 'explode' ? '确认自爆' : '结束并揭晓身份'}
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      );
    return (
      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal('')}>
        <DialogContent className="dialog">
          <DialogTitle>
            {modal === 'settings'
              ? '游戏设置'
              : modal === 'identity'
                ? '我的身份'
                : modal === 'end'
                  ? '结束当前对局？'
                  : '村庄规则'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'settings'
              ? '设置保存在本机，密钥仅从本地服务读取。'
              : modal === 'end'
                ? '本局将存入历史并揭晓全部身份，无法继续。'
                : '12人 · 有警长 · 暗牌 · 屠边'}
          </DialogDescription>
          {modal === 'settings' ? (
            <>
              <div className="callout">
                DeepSeek：{data?.config.model || '待载入'}
                <br />
                {data?.config.configured
                  ? '密钥已配置'
                  : '密钥未配置，当前可使用规则演示。'}
                <p>
                  在项目的 .env.local 填写 API
                  Key、模型名称及人民币单价。此处不接收密钥。
                </p>
              </div>
              <label className="field">
                文字速度：{speed} 字/秒
                <Slider
                  aria-label="文字速度"
                  min={10}
                  max={120}
                  value={[speed]}
                  onValueChange={(v) => setSpeed(Array.isArray(v) ? v[0] : v)}
                />
              </label>
              <label className="field">
                单局预算（元）
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </label>
              <Button
                onClick={async () => {
                  if (data?.game && !data.game.winner)
                    await act({ op: 'budget', value: budget });
                  setModal('');
                }}
              >
                保存设置
              </Button>
              <p className="hint">
                费用按你填写的单价预估，包含模型思考输出。以供应商账单为准。
              </p>
            </>
          ) : modal === 'identity' ? (
            <div className="identity">
              <Shield />
              <h2>{g?.players.find((p: any) => p.human)?.role}</h2>
              {g?.players
                .find((p: any) => p.human)
                ?.knowledge?.map((k: any) => (
                  <p key={k.target}>
                    第{k.day}夜 · {k.target}号：{k.result}
                  </p>
                ))}
            </div>
          ) : modal === 'end' ? (
            <Button
              className="danger"
              onClick={async () => {
                await act({ op: 'archive' });
                setModal('');
              }}
            >
              结束并揭晓身份
            </Button>
          ) : (
            <div className="rules">
              <p>
                镜隐迷踪：3普通狼人、1觉醒隐狼、4村民，魔镜少女、女巫、猎人、守卫各1；有警长、暗牌、屠边。
              </p>
              <p>
                觉醒隐狼与普通狼互不相认，一局一次模仿并立即得知、伪装目标身份，今夜结束后获得技能。普通狼全部出局后取得刀权。模仿狼人另有一次额外狼刀；模仿女巫只有一瓶毒药；模仿守卫可以挡刀和毒且不可连守；模仿猎人非毒死可开枪；模仿魔镜少女可查具体身份。
              </p>
              <p>
                魔镜少女每夜查一人的具体身份，不可重复。觉醒隐狼已模仿时显示模仿身份，未模仿时显示觉醒隐狼。
              </p>
              <p>
                女巫全程不可自救、每夜最多一药。守卫可自守但不可连守，同守同救被刀者仍出局。猎人毒死不能开枪。
              </p>
              <p>
                首夜行动后全体同时选择是否上警，全部确认后公布上警名单，再进行竞选发言、退水、警下投票，随后公布死亡。平票PK一次，再平票无警长。警长放逐票权1.5、选择发言方向并最后归票，出局可移交或撕徽。
              </p>
              <p>
                普通狼人可自刀和白天自爆，觉醒隐狼不可自爆。密谈后共同选刀，最高票并列时随机确定一个目标；空刀不参与目标竞争，全部空刀则无人被刀。警上第一次自爆延后竞选，第二次自爆吞警徽。
              </p>
              <p>
                所有可见发言结束后由你手动点下一位。不可见的狼队密谈自动推进。警长投票和放逐投票都同时开放5秒；超时、模型未及时返回或失败均弃票。投票期间不能暂停，票型在截止后统一公布。
              </p>
              <p>
                普通规则参考网易官方，手动发言与5秒投票采用你的自定义设置。旧九人存档仅作历史查看。
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
  if (screen === 'prepare' || screen === 'characters')
    return (
      <main className="app">
        {header}
        {errorBox}
        <div className="page-heading">
          <Button variant="ghost" onClick={goHome}>
            <ArrowLeft />
            返回大厅
          </Button>
          <div>
            <p className="eyebrow">CAST OF THE NIGHT</p>
            <h2>{screen === 'characters' ? '角色档案' : '今晚，谁将入局'}</h2>
          </div>
          <span>点击座位，赋予角色独特性格</span>
        </div>
        <div className="preparation">
          <section>
            <div className="seat-grid">
              {characters.map((p) => (
                <button
                  key={p.id}
                  className={
                    'character-card ' + (seat === p.id ? 'selected' : '')
                  }
                  onClick={() => setSeat(p.id)}
                >
                  <span className="seat-no">
                    {String(p.id).padStart(2, '0')}
                  </span>
                  <Portrait
                    seat={Number(p.avatarIndex ?? p.id - 1) + 1}
                    avatar={p.avatar}
                  />
                  <h3>{p.name}</h3>
                  <p>
                    {p.id === 12 && mode !== 'director' ? '你的座位' : p.mbti}
                  </p>
                  <small>{p.traits}</small>
                </button>
              ))}
            </div>
            <div className="callout">
              人物性格与游戏身份独立。温柔的人也可能是狼人，犀利的发言也可能在保护好人。
            </div>
          </section>
          <aside className="editor panel">
            {c && (
              <>
                <p className="eyebrow">
                  CHARACTER / {String(seat).padStart(2, '0')}
                </p>
                <h2>{c.name}</h2>
                <Pick
                  label="人物头像"
                  value={String(c.avatarIndex ?? seat - 1)}
                  onChange={(v: string) => update('avatarIndex', v)}
                  items={Array.from({ length: 9 }, (_, i) => [
                    String(i),
                    '肖像 ' + (i + 1),
                  ])}
                />
                <label className="field">
                  姓名
                  <input
                    value={c.name}
                    maxLength={30}
                    onChange={(e) => update('name', e.target.value)}
                  />
                </label>
                <Pick
                  label="MBTI（仅影响扮演风格）"
                  value={c.mbti}
                  onChange={(v: string) => update('mbti', v)}
                  items={[
                    'INTJ',
                    'INTP',
                    'ENTJ',
                    'ENTP',
                    'INFJ',
                    'INFP',
                    'ENFJ',
                    'ENFP',
                    'ISTJ',
                    'ISFJ',
                    'ESTJ',
                    'ESFJ',
                    'ISTP',
                    'ISFP',
                    'ESTP',
                    'ESFP',
                    '自定义',
                  ].map((x) => [x, x])}
                />
                <label className="field">
                  性格标签
                  <input
                    value={c.traits}
                    maxLength={120}
                    onChange={(e) => update('traits', e.target.value)}
                  />
                </label>
                <label className="field">
                  自定义角色提示词
                  <textarea
                    value={c.prompt}
                    rows={5}
                    maxLength={2000}
                    onChange={(e) => update('prompt', e.target.value)}
                  />
                </label>
                <div className="row">
                  <Button
                    className="gold"
                    disabled={busy}
                    onClick={async () => {
                      const d = await act({ op: 'characters', characters });
                      if (d) setNotice('角色档案已保存');
                    }}
                  >
                    保存角色
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await act({ op: 'characters', characters });
                      const d = await act({
                        op: 'preview',
                        seat,
                        demo: engine === 'demo',
                        text: trial,
                      });
                      if (d) setPreview(d.preview);
                    }}
                  >
                    角色试聊
                  </Button>
                </div>
                <Pick
                  label="试聊来源"
                  value={engine}
                  onChange={setEngine}
                  items={[
                    ['demo', '规则演示（免费）'],
                    ['deepseek', 'DeepSeek（按量计费）'],
                  ]}
                />
                <label className="field">
                  试聊内容
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={trial}
                    onChange={(e) => setTrial(e.target.value)}
                  />
                </label>
                <p className="hint">
                  试聊累计 ¥{(data?.previewSpent || 0).toFixed(3)} /
                  ¥5，独立于对局预算。
                </p>
                {notice && (
                  <p role="status" className="hint">
                    {notice}
                  </p>
                )}
                {preview && <p className="callout">{preview}</p>}
              </>
            )}
          </aside>
        </div>
        {screen === 'prepare' && (
          <section className="setup panel">
            <Pick
              label="游戏模式"
              value={mode}
              onChange={setMode}
              items={[
                ['normal', '普通对局'],
                ['practice', '身份练习'],
                ['director', '导演观战'],
              ]}
            />
            {mode !== 'director' && (
              <Pick
                label="我的身份（开局分配）"
                value={role}
                onChange={setRole}
                items={[['random', '随机身份'], ...roleList.map((x) => [x, x])]}
              />
            )}
            <Pick
              label="对手来源"
              value={engine}
              onChange={setEngine}
              items={[
                ['demo', '规则演示 · 不调用模型'],
                ['deepseek', 'DeepSeek · 真实 AI'],
              ]}
            />
            {mode === 'director' && (
              <Pick
                label="观战视角"
                value={god}
                onChange={setGod}
                items={[
                  ['blind', '盲视角'],
                  ['god', '全知视角'],
                ]}
              />
            )}
            <Button className="gold" disabled={busy} onClick={start}>
              开始对局 <ArrowUpRight />
            </Button>
            {mode === 'director' && (
              <div className="assignments">
                {assigned.map((v, i) => (
                  <Pick
                    key={i}
                    label={`${i + 1}号身份`}
                    value={v}
                    onChange={(x: string) =>
                      setAssigned((a) => a.map((r, j) => (j === i ? x : r)))
                    }
                    items={roleList.map((x) => [x, x])}
                  />
                ))}
              </div>
            )}
            <p className="hint">
              {engine === 'demo'
                ? '演示角色使用固定策略，不代表真实 AI 能力。'
                : '单局预算 ¥' + budget + ' · API 未配置时不会发起调用。'}
            </p>
          </section>
        )}
        {dialogs()}
      </main>
    );
  if (screen === 'history')
    return (
      <main className="app">
        {header}
        {errorBox}
        <section className="history">
          <Button variant="ghost" onClick={goHome}>
            <ArrowLeft />
            返回
          </Button>
          <p className="eyebrow">ECHOES OF THE PAST</p>
          <h1>往日对局</h1>
          {!data?.history.length ? (
            <div className="panel empty">
              村庄还没有留下故事。完成第一局后，来这里回顾每一次选择。
            </div>
          ) : (
            data.history.map((h: any) => (
              <button
                className="history-row panel"
                key={h.id}
                onClick={async () => {
                  const d = await act({ op: 'replay', id: h.id });
                  if (d) {
                    setReplay(d.replay);
                    setScreen('replay');
                  }
                }}
              >
                <span>
                  {new Date(h.created).toLocaleString('zh-CN')}
                  <small>
                    {h.demo ? '规则演示' : 'DeepSeek'} · 第{h.day}天
                  </small>
                </span>
                <strong>
                  {h.winner}
                  {h.winner === '中途结束' ? '' : '获胜'}
                </strong>
                <span>
                  ¥{h.spent.toFixed(3)} <ArrowUpRight />
                </span>
              </button>
            ))
          )}
        </section>
        {dialogs()}
      </main>
    );
  if (!g)
    return (
      <main>
        {header}
        <p className="empty">正在读取对局…</p>
        {errorBox}
      </main>
    );
  const visibleLogs = logs.filter(
    (e: any) =>
      filter === 'all' ||
      (filter === 'votes' ? e.kind === 'vote' : e.kind === 'rationale'),
  );
  return (
    <main className={'app game ' + (g.phase === 'night' ? 'night' : '')}>
      {header}
      {errorBox}
      <div className="game-bar">
        <div>
          <p className="eyebrow">
            {g.demo ? 'RULE DEMO · 规则演示' : 'DEEPSEEK · LIVE GAME'}
          </p>
          <h2 aria-live="polite" aria-atomic="true">
            {g.winner
              ? g.legacy
                ? '九人旧版存档 · 只读保留'
                : g.winner + (g.winner === '中途结束' ? '' : '阵营获胜')
              : `第 ${g.day} ${g.phase === 'night' ? '夜' : '天'} · ${g.stage || types[g.task?.type] || '对局进行中'}`}
          </h2>
        </div>
        <div className="row">
          <span className="cost">
            ¥{g.spent.toFixed(3)} / ¥{g.budget}
          </span>
          {screen === 'game' && !g.winner && (
            <Button
              variant="outline"
              disabled={g.ballot?.status === 'open'}
              onClick={pause}
            >
              {g.paused ? <Play /> : <Pause />}
              {g.paused ? '继续' : '暂停'}
            </Button>
          )}
          <Button variant="ghost" onClick={goHome}>
            <ArrowLeft />
            大厅
          </Button>
        </div>
      </div>
      <div className="game-layout">
        <section className="table-area">
          <div className="players">
            {g.players.map((p: any) => (
              <div
                key={p.id}
                className={
                  'player ' +
                  (!p.alive ? 'dead ' : '') +
                  ((g.awaitingAdvance
                    ? g.displaySpeech?.actor
                    : g.task?.actor) === p.id
                    ? 'speaking'
                    : '') +
                  (g.ballot?.eligible.includes(p.id) ? ' voting-player' : '')
                }
              >
                <span className="seat-no">{p.id}号</span>
                <Portrait
                  seat={Number(p.avatarIndex ?? p.id - 1) + 1}
                  avatar={p.avatar}
                />
                <strong>
                  {p.name}
                  {p.sheriff ? ' · 警长' : ''}
                </strong>
                {g.ballot?.eligible.includes(p.id) && (
                  <span className="vote-seat-state">
                    {g.ballot.submitted.includes(p.id) ? '已提交' : '投票中'}
                  </span>
                )}
                <small>
                  {p.role || '身份未知'} · {p.alive ? '存活' : '已出局'}
                </small>
                {p.human && <span className="you">你</span>}
              </div>
            ))}
          </div>
          {inspectionResults.length > 0 && (
            <section
              className="inspection-result panel"
              role="status"
              aria-live="polite"
            >
              <p className="eyebrow">查验完成 · 仅你可见</p>
              {inspectionResults.map((k: any) => (
                <h2 key={k.day + '-' + k.target}>
                  第{k.day}夜 · {k.target}号 · {k.result}
                </h2>
              ))}
              <p>
                结果已保存。
                {g.paused
                  ? '对局已暂停。'
                  : '其他角色继续行动中，你可以随时查看。'}
              </p>
            </section>
          )}
          {submittingTask === 'inspect' && (
            <p className="inspection-pending" role="status">
              正在提交查验，请稍候…
            </p>
          )}
          <article className="speech panel">
            <p className="eyebrow">
              {g.winner
                ? 'THE TRUTH REVEALED'
                : g.paused
                  ? 'GAME PAUSED'
                  : busy
                    ? 'WAITING FOR RESPONSE'
                    : 'VOICES IN THE DARK'}
            </p>
            {g.winner ? (
              <>
                <h2>
                  {g.legacy
                    ? '九人旧版存档'
                    : g.winner === '中途结束'
                      ? '故事暂告一段落'
                      : g.winner + '阵营获胜'}
                </h2>
                <p>身份已揭晓。右侧可以回顾投票、夜间行动和决策摘要。</p>
                <Button
                  className="gold"
                  onClick={() => {
                    setScreen('prepare');
                    setReplay(null);
                  }}
                >
                  原阵容再来一局
                </Button>
              </>
            ) : (
              <>
                <h2>
                  {isVoting
                    ? g.ballot.kind === 'sheriff'
                      ? '警长竞选投票'
                      : '放逐投票'
                    : publicSpeech
                      ? `${publicSpeech.actor}号 · ${g.players[publicSpeech.actor - 1]?.name}`
                      : g.stage || '月夜村庄'}
                </h2>
                <p className="speech-text">
                  {g.paused || isVoting || !g.awaitingAdvance
                    ? spoken
                    : spoken.slice(0, Math.floor(visible))}
                  {!isVoting && <span className="cursor">▏</span>}
                </p>
                <div className="hint">
                  {g.paused
                    ? '已暂停，恢复后继续当前阶段'
                    : busy
                      ? '正在处理，请稍候…'
                      : g.task?.human
                        ? '轮到你行动'
                        : isVoting
                          ? '全体同时投票，5秒到时统一结算'
                          : g.awaitingAdvance
                            ? '阅读完毕后，请手动点击下一位'
                            : '正在进入下一项行动'}
                </div>
              </>
            )}
          </article>
          <section className="actions panel">
            {!g.winner && screen === 'game' && g.signupSelection ? (
              <div className="signup-selection">
                <h2>全体同时选择是否上警</h2>
                <p>所有人独立确认，全部完成后统一公布上警名单。</p>
                {g.signupSelection.error && (
                  <p role="alert">{g.signupSelection.error}</p>
                )}
                {g.signupSelection.humanEligible &&
                !g.signupSelection.humanSubmitted ? (
                  <div className="row">
                    <Button
                      className="gold"
                      disabled={busy || g.paused}
                      onClick={() =>
                        act({
                          op: 'signupChoice',
                          selectionId: g.signupSelection.id,
                          choice: 'join',
                        })
                      }
                    >
                      我要上警
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || g.paused}
                      onClick={() =>
                        act({
                          op: 'signupChoice',
                          selectionId: g.signupSelection.id,
                          choice: 'stay',
                        })
                      }
                    >
                      不上警
                    </Button>
                  </div>
                ) : (
                  <p>
                    {g.signupSelection.humanSubmitted
                      ? '你已确认，等待其他人完成选择。'
                      : '其他玩家正在选择，请稍候。'}
                  </p>
                )}
                <p className="hint">
                  已确认 {g.signupSelection.submittedCount} /{' '}
                  {g.signupSelection.total} 人
                </p>
              </div>
            ) : !g.winner && screen === 'game' && g.wolfSelection ? (
              <div className="wolf-selection">
                <h2>狼队同时选择目标</h2>
                <p>密谈结束后共同选择，收齐后按最高票结算，并列最高票随机。</p>
                {g.wolfSelection.error && (
                  <p role="alert">{g.wolfSelection.error}</p>
                )}
                {g.wolfSelection.humanEligible &&
                !g.wolfSelection.humanSubmitted ? (
                  <>
                    <div className="targets">
                      {g.wolfSelection.choices.map((v: any) => (
                        <Button
                          key={v}
                          variant="outline"
                          className={choice === String(v) ? 'chosen' : ''}
                          disabled={busy || g.paused}
                          onClick={() => setChoice(String(v))}
                        >
                          {v === 0 ? '空刀' : v + '号'}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="gold"
                      disabled={busy || g.paused || choice === ''}
                      onClick={() =>
                        act({
                          op: 'wolfChoice',
                          selectionId: g.wolfSelection.id,
                          choice: Number(choice),
                        })
                      }
                    >
                      确认狼刀
                    </Button>
                  </>
                ) : (
                  <p>
                    {g.wolfSelection.humanSubmitted
                      ? '你已提交，等待其他狼人完成选择。'
                      : '狼人正在选择目标，请等待夜间流程继续。'}
                  </p>
                )}
              </div>
            ) : !g.winner && screen === 'game' && g.ballot ? (
              <div className="ballot-panel">
                <div className="row">
                  <h2>
                    {g.ballot.kind === 'sheriff' ? '选举警长' : '放逐投票'}
                  </h2>
                  <strong className="ballot-clock" role="timer">
                    {voteSeconds.toFixed(1)} 秒
                  </strong>
                </div>
                <p>同时投票 · 5秒截止 · 未提交视为弃票</p>
                {g.ballot.humanEligible && !g.ballot.humanSubmitted ? (
                  <>
                    <div className="targets">
                      {g.ballot.choices.map((v: any) => (
                        <Button
                          key={v}
                          variant="outline"
                          className={choice === String(v) ? 'chosen' : ''}
                          disabled={
                            voteSeconds <= 0 || g.ballot.status !== 'open'
                          }
                          onClick={() => setChoice(String(v))}
                        >
                          {choiceLabel(v)}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="gold"
                      disabled={
                        busy ||
                        choice === '' ||
                        voteSeconds <= 0 ||
                        g.ballot.status !== 'open'
                      }
                      onClick={() =>
                        act({
                          op: 'ballotVote',
                          ballotId: g.ballot.id,
                          choice: Number(choice),
                        })
                      }
                    >
                      确认投票
                    </Button>
                  </>
                ) : (
                  <p>
                    {g.ballot.humanSubmitted
                      ? '你已提交，等待倒计时结束。'
                      : '本轮你没有投票权，请等待结果。'}
                  </p>
                )}
                <p className="hint">
                  已提交 {g.ballot.submitted.length} /{' '}
                  {g.ballot.eligible.length} 人
                </p>
              </div>
            ) : !g.winner && screen === 'game' && g.awaitingAdvance ? (
              <div className="row">
                <p>本段发言已结束，由你控制下一位。</p>
                <Button
                  className="gold"
                  disabled={busy || g.paused}
                  onClick={() => act({ op: 'advance', revision: g.revision })}
                >
                  下一位 / 继续流程 <ArrowUpRight />
                </Button>
              </div>
            ) : !g.winner && screen === 'game' && g.task?.human ? (
              <>
                <div className="row">
                  <strong>{types[g.task.type]}</strong>
                  {[
                    'speech',
                    'lastWords',
                    'wolfChat',
                    'sheriffSpeech',
                  ].includes(g.task.type) && (
                    <span className="timer">{Math.ceil(remaining)} 秒</span>
                  )}
                </div>
                {['speech', 'lastWords', 'wolfChat', 'sheriffSpeech'].includes(
                  g.task.type,
                ) ? (
                  <>
                    <textarea
                      aria-label="你的发言"
                      rows={4}
                      maxLength={1600}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="输入你的判断，引用线索，说服其他玩家…"
                    />
                    <Button
                      className="gold"
                      disabled={g.paused || busy}
                      onClick={() =>
                        act({
                          op: 'step',
                          revision: g.revision,
                          action: { text: draft },
                        })
                      }
                    >
                      <Send />
                      结束发言
                    </Button>
                  </>
                ) : (
                  <>
                    {g.attacked !== undefined && (
                      <p>
                        今晚被袭击：{g.attacked ? g.attacked + '号' : '无人'}
                      </p>
                    )}
                    <div className="targets">
                      {g.choices.map((v: any) => (
                        <Button
                          key={v}
                          className={String(v) === choice ? 'chosen' : ''}
                          variant="outline"
                          onClick={() => setChoice(String(v))}
                        >
                          {choiceLabel(v)}
                        </Button>
                      ))}
                    </div>
                    <Button
                      className="gold"
                      disabled={
                        g.paused ||
                        busy ||
                        (choice === '' && g.choices.length > 0)
                      }
                      onClick={() =>
                        act({
                          op: 'step',
                          revision: g.revision,
                          action: {
                            choice: stringActions.includes(g.task.type)
                              ? choice
                              : Number(choice),
                          },
                        })
                      }
                    >
                      确认行动
                    </Button>
                  </>
                )}
              </>
            ) : (
              <p className="hint">
                {g.winner
                  ? '对局已存入往日记录。'
                  : g.players.find((p: any) => p.human)?.alive === false
                    ? '你已出局，正在盲视角旁观。'
                    : g.mode === 'director'
                      ? g.god
                        ? '导演模式 · 全知视角'
                        : '导演模式 · 盲视角'
                      : '等待你的回合，随时可以暂停查看记录。'}
              </p>
            )}
          </section>
          <div className="row">
            {g.canWithdraw && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => act({ op: 'withdraw', revision: g.revision })}
              >
                退水
              </Button>
            )}
            {g.canExplode && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setModal('explode')}
              >
                狼人自爆
              </Button>
            )}
            {g.mode !== 'director' && (
              <Button variant="outline" onClick={() => setModal('identity')}>
                <Shield />
                我的身份
              </Button>
            )}
            <Button variant="ghost" onClick={() => setModal('rules')}>
              查看规则
            </Button>
            {!g.winner && (
              <Button variant="ghost" onClick={() => setModal('end')}>
                结束本局
              </Button>
            )}
          </div>
        </section>
        <aside className="panel record">
          <Tabs defaultValue="events">
            <TabsList>
              <TabsTrigger value="events">对局记录</TabsTrigger>
              <TabsTrigger value="notes">私人笔记</TabsTrigger>
            </TabsList>
            <TabsContent value="events">
              <Pick
                label="记录筛选"
                value={filter}
                onChange={setFilter}
                items={[
                  ['all', '全部可见记录'],
                  ['votes', '投票记录'],
                  ...(g.winner || g.god ? [['reason', 'AI 决策摘要']] : []),
                ]}
              />
              <div className="event-list">
                {[...visibleLogs].reverse().map((e: any) => (
                  <div
                    className={
                      'event ' + (e.visibility !== 'public' ? 'private' : '')
                    }
                    key={e.id}
                  >
                    <small>
                      #{e.id} · 第{e.day}
                      {e.phase === 'night' ? '夜' : '天'}
                      {e.actor ? ' · ' + e.actor + '号' : ''}
                      {e.visibility !== 'public' ? ' · 私密' : ''}
                    </small>
                    <p>{e.text}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="notes">
              <p className="hint">仅保存在你的浏览器，不会发送给 AI。</p>
              <textarea
                aria-label="私人笔记"
                rows={16}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  localStorage.setItem('moonlit-notes-' + g.id, e.target.value);
                }}
                placeholder="记录你怀疑的人、身份声明和关键票型…"
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      {dialogs()}
    </main>
  );
}
