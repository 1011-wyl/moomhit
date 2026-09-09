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
const roleList = ['狼人', '预言家', '女巫', '猎人', '村民'];
const types: any = {
  night: '夜间行动',
  wolfChat: '狼队密谈',
  kill: '选择袭击目标',
  inspect: '预言家查验',
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
    [role, setRole] = useState('村民'),
    [god, setGod] = useState('blind'),
    [assigned, setAssigned] = useState([
      '狼人',
      '狼人',
      '狼人',
      '预言家',
      '女巫',
      '猎人',
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
    [trial, setTrial] = useState('介绍自己，并说说你会怎样找出狼人。');
  const lock = useRef(false),
    clock = useRef(0),
    lastTick = useRef(0),
    latest = useRef<any>(null);
  const g = screen === 'replay' ? replay : data?.game;
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
    if (!r.ok) throw Error(d.error || '操作失败');
    return d;
  }
  async function act(body: any) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
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
  const publicSpeech = [...logs]
    .reverse()
    .find((e: any) => ['speech', 'lastWords', 'wolfChat'].includes(e.kind));
  const spoken = publicSpeech?.text || '月色渐深，等待下一段故事。';
  latest.current = {
    g,
    screen,
    busy,
    draft,
    remaining,
    hold,
    speed,
    spoken,
    visible,
  };
  useEffect(() => {
    const timer = setInterval(() => {
      const x = latest.current;
      const now = Date.now(),
        delta = Math.min(250, now - lastTick.current);
      lastTick.current = now;
      if (
        !x?.g ||
        x.screen !== 'game' ||
        x.g.paused ||
        x.g.winner ||
        lock.current
      )
        return;
      clock.current += delta;
      setVisible((v) => Math.min(x.spoken.length, v + x.speed / 10));
      if (x.g.task?.human) {
        if (['speech', 'lastWords', 'wolfChat'].includes(x.g.task.type)) {
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
      if (
        clock.current >=
        x.hold * 1000 + Math.min(15000, (x.spoken.length / x.speed) * 1000)
      ) {
        clock.current = 0;
        void act({ op: 'step', revision: x.g.revision });
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);
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
            {data?.game && !data.game.winner && (
              <Button variant="outline" onClick={() => setScreen('game')}>
                继续对局 · 第{data.game.day}天
              </Button>
            )}
          </div>
          <p className="hint">九人无警长 · 纯文字 · 本地存档</p>
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
    if (modal === 'end')
      return (
        <AlertDialog open onOpenChange={(open) => !open && setModal('')}>
          <AlertDialogContent className="dialog">
            <AlertDialogTitle>结束当前对局？</AlertDialogTitle>
            <AlertDialogDescription>
              本局将保存到历史并揭晓身份，无法继续。
            </AlertDialogDescription>
            <div className="row">
              <Button variant="outline" onClick={() => setModal('')}>
                继续保留
              </Button>
              <Button
                className="danger"
                disabled={busy}
                onClick={async () => {
                  const d = await act({ op: 'archive' });
                  if (d) setModal('');
                }}
              >
                结束并揭晓身份
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
                : '九人 · 无警长 · 暗牌 · 屠边'}
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
                发言后停留：{hold} 秒
                <Slider
                  aria-label="发言后停留秒数"
                  min={1}
                  max={15}
                  value={[hold]}
                  onValueChange={(v) => setHold(Array.isArray(v) ? v[0] : v)}
                />
              </label>
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
                三名狼人、三名村民，预言家、女巫、猎人各一名。狼人全部出局则好人胜；村民或神职全部出局则狼人胜。
              </p>
              <p>
                夜间依次狼队讨论与投刀、预言家查验、女巫用药。狼刀平票为空刀。女巫仅首夜可自救，每夜最多一瓶药；解药用完后不再获知刀口。
              </p>
              <p>
                白天依座位发言并投票。平票者PK，其他存活者再投；再次平票或全弃票则无人出局。
              </p>
              <p>
                猎人被刀或放逐可以开枪，中毒不可开枪。首夜出局和白天出局有遗言；胜负已成立时直接结算。
              </p>
              <p>
                不设警长、白狼王或狼人自爆。普通对局出局后保持盲视角，结束后统一揭晓。导演可在开局前选择全知视角。
              </p>
              <p>
                参考常见网易玩法，以上为本作固定规则，并非官方客户端的完整复刻。
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
                    {p.id === 9 && mode !== 'director' ? '你的座位' : p.mbti}
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
            {mode === 'practice' && (
              <Pick
                label="你的身份"
                value={role}
                onChange={setRole}
                items={roleList.map((x) => [x, x])}
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
          <h2>
            {g.winner
              ? g.winner + (g.winner === '中途结束' ? '' : '阵营获胜')
              : `第 ${g.day} ${g.phase === 'night' ? '夜' : '天'} · ${types[g.task?.type] || '对局进行中'}`}
          </h2>
        </div>
        <div className="row">
          <span className="cost">
            ¥{g.spent.toFixed(3)} / ¥{g.budget}
          </span>
          {screen === 'game' && !g.winner && (
            <Button variant="outline" onClick={pause}>
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
                  (g.task?.actor === p.id ? 'speaking' : '')
                }
              >
                <span className="seat-no">{p.id}号</span>
                <Portrait
                  seat={Number(p.avatarIndex ?? p.id - 1) + 1}
                  avatar={p.avatar}
                />
                <strong>{p.name}</strong>
                <small>
                  {p.role || '身份未知'} · {p.alive ? '存活' : '已出局'}
                </small>
                {p.human && <span className="you">你</span>}
              </div>
            ))}
          </div>
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
                  {g.winner === '中途结束'
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
                  {publicSpeech
                    ? `${publicSpeech.actor}号 · ${g.players[publicSpeech.actor - 1]?.name}`
                    : '月夜村庄'}
                </h2>
                <p className="speech-text">
                  {g.paused ? spoken : spoken.slice(0, Math.floor(visible))}
                  <span className="cursor">▏</span>
                </p>
                <div className="hint">
                  {g.paused
                    ? '已暂停，继续后自动推进'
                    : busy
                      ? '正在处理，请稍候…'
                      : g.task?.human
                        ? '轮到你行动'
                        : '文字展示后自动进入下一位'}
                </div>
              </>
            )}
          </article>
          <section className="actions panel">
            {!g.winner && screen === 'game' && g.task?.human ? (
              <>
                <div className="row">
                  <strong>{types[g.task.type]}</strong>
                  {['speech', 'lastWords', 'wolfChat'].includes(
                    g.task.type,
                  ) && <span className="timer">{Math.ceil(remaining)} 秒</span>}
                </div>
                {['speech', 'lastWords', 'wolfChat'].includes(g.task.type) ? (
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
                          {v === 0
                            ? '弃权 / 不行动'
                            : v === 'none'
                              ? '不用药'
                              : v === 'save'
                                ? '使用解药'
                                : String(v).startsWith('poison:')
                                  ? '毒杀 ' + v.split(':')[1] + '号'
                                  : v + '号'}
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
                            choice:
                              g.task.type === 'potion'
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
