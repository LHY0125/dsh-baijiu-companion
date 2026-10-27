# 白酒学伴 DSH 插件 · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把白酒学伴的"讲解 → 答疑 → 出题 → 批改 → 补学"代码级状态机移植为 DeepSeek Harness 的一个独立 bundle 插件。

**Architecture:** 插件在 `apply(ctx, config)` 中注册两个工具（`submit_quiz` / `submit_grade`）、四个斜杠命令、一个按阶段渲染的 system 提示段，并监听 `agent/pre-step` 与 `turn/end` 做状态迁移。会话状态保存在插件内的 LRU Map，键为 `sessionId`。题目与批改结果用工具 schema 承载，因此不存在答案泄漏的可能。

**Tech Stack:** TypeScript（ESM，`tsc` 编译到 `lib/`）、Schemastery 配置、vitest、Cordis 插件 API（`@deepseek-ai/cordis`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-llm`）、`@deepseek-ai/dsh` CLI 0.2.1-rc.2。

**Spec:** `docs/superpowers/specs/2026-10-28-baijiu-dsh-plugin-design.md`

## Global Constraints

- 包名 `dsh-baijiu-companion`，`"type": "module"`，`main: "./lib/index.js"`。
- `engines.dsh` 必须是 `>=0.2.1-rc.2 <0.3.0`。
- **工具可见性：两个工具始终注册。** 发布版 `dsh-tools` 没有条件注册 `{ when }`（已核实 0.2.1-rc.2 与 rc.3 的类型与运行时代码），因此阶段约束一律在 `execute` 内强制，违规调用抛中文错误。
- 运行时代码只从 `lib/` 加载；`src/` 不直接进 import 图。
- 所有可调参数必须是 Schemastery 配置字段，源码内不得出现业务常量（协议常量除外）。
- 中文注释、中文面向用户文案。
- 不修改 `白酒学伴` 原仓库，不修改 `deepseek-harness` 上游仓库。
- 每个任务结束时工作树可编译、测试可通过。

---

### Task 1: 项目骨架与环境验证

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `cordis.patch.yml`
- Create: `src/index.ts`
- Create: `.gitignore`

**Interfaces:**
- Consumes: 无
- Produces: 可被 `dsh plugin add` 识别的 bundle 包；`src/index.ts` 导出 `name` / `apply` / `Config` 的位置。

- [ ] **Step 1: 初始化 git 仓库与 `package.json`**

```powershell
cd "D:\Code\doing_exercises\programs\比赛项目\baijiu-dsh-plugin"
git init
```

`package.json`：

```json
{
  "name": "dsh-baijiu-companion",
  "version": "0.1.0",
  "description": "白酒学伴 —— DeepSeek Harness 教学状态机插件",
  "type": "module",
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "files": ["lib", "cordis.patch.yml"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "prepare": "npm run build"
  },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" },
  "peerDependencies": {
    "@deepseek-ai/cordis": "*",
    "@deepseek-ai/dsh-llm": "*",
    "@deepseek-ai/dsh-tools": "*",
    "@deepseek-ai/schemastery": "*"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "4.0.5",
    "@deepseek-ai/dsh-llm": "0.0.1-rc.1",
    "@deepseek-ai/dsh-tools": "0.0.1-rc.1",
    "@deepseek-ai/schemastery": "3.18.5",
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 写编译与测试配置**

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "declaration": true,
    "outDir": "lib",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['tests/**/*.spec.ts'] },
})
```

`.gitignore`：

```
node_modules/
lib/
*.tsbuildinfo
```

- [ ] **Step 3: 写最小可加载插件与 bundle 补丁**

`src/index.ts`（本任务只做占位，后续任务替换）：

```ts
import type { Context } from '@deepseek-ai/cordis'

/** 插件名，Cordis 加载时用于识别。 */
export const name = 'baijiu-companion'

/**
 * 插件入口。Task 11 会把各模块装配到这里。
 * @param ctx - Cordis 上下文。
 */
export function apply(ctx: Context): void {
  void ctx
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: baijiu-companion
      name: dsh-baijiu-companion
```

- [ ] **Step 4: 安装 dsh CLI 并验证关键 API 存在**

```powershell
npm i -g @deepseek-ai/dsh@0.2.1-rc.2
dsh --version
$root = npm root -g
$tools = "$root\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-tools\lib\types\index.d.ts"
Select-String -Path $tools -Pattern "concludeTurn|restrict\("
```

预期：两条模式都能命中（`concludeTurn` 供工具收尾；`restrict` 是本计划暂不使用的备选闸门）。
**不要**再查找 `when?`——已核实发布版没有该 API，本计划不依赖它。

- [ ] **Step 5: 安装依赖并构建**

```powershell
pnpm install
pnpm run build
```

预期：`lib/index.js` 与 `lib/index.d.ts` 生成，无报错。

- [ ] **Step 6: 安装插件到 profile 并确认补丁层生效**

```powershell
dsh plugin --profile web add "D:\Code\doing_exercises\programs\比赛项目\baijiu-dsh-plugin"
dsh --profile web --dump-config | Select-String "baijiu-companion"
```

预期：输出中出现 `# == dsh-baijiu-companion` 层与 `baijiu-companion` 行。

- [ ] **Step 7: 提交**

```powershell
git add -A
git commit -m "chore: 初始化 dsh-baijiu-companion 包骨架"
```

---

### Task 2: 摘要生成与状态模型

**Files:**
- Create: `src/summary.ts`
- Create: `src/state.ts`
- Test: `tests/state.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `composeSummary(topic: string, focus: string, question: string): string`
  - `type Phase = 'explain' | 'qa' | 'quiz' | 'grade' | 'remedial'`
  - `interface QuizQuestion { readonly stem: string; readonly options: readonly string[] }`
  - `interface Quiz { readonly topic: string; readonly questions: readonly QuizQuestion[] }`
  - `interface LearningState { phase, topic, focus, summary, weakPoints, quiz, reminderAttempts }`
  - `activate(topic: string): LearningState`
  - `noteUserMessage(state: LearningState, text: string): LearningState`
  - `noteQuiz(state: LearningState, quiz: Quiz): LearningState`
  - `noteGrade(state: LearningState, weakPoint: string, maxWeakPoints: number): LearningState`
  - `finishRemedial(state: LearningState): LearningState`
  - `bumpReminder(state: LearningState): LearningState`

- [ ] **Step 1: 写失败测试**

`tests/state.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { composeSummary } from '../src/summary.js'
import {
  activate,
  bumpReminder,
  finishRemedial,
  noteGrade,
  noteQuiz,
  noteUserMessage,
} from '../src/state.js'

const sampleQuiz = {
  topic: '酱香工艺',
  questions: [
    { stem: '酱香型白酒的典型工艺特点是？', options: ['高温制曲', '低温发酵', '一次取酒', '不加曲'] },
  ],
}

describe('composeSummary', () => {
  it('无聚焦点、无追问时只描述主题与本轮提问', () => {
    const text = composeSummary('酱香工艺', '', '什么是高温堆积')
    expect(text).toBe('正在学习「酱香工艺」，本轮学生提问「什么是高温堆积」。')
  })

  it('有聚焦点时带上补学信息', () => {
    const text = composeSummary('酱香工艺', '高温堆积发酵', '为什么温度这么高')
    expect(text).toContain('刚补学过「高温堆积发酵」')
  })

  it('过长提问被截断到 24 字', () => {
    const long = '一'.repeat(60)
    expect(composeSummary('酱香工艺', '', long).length).toBeLessThan(60)
  })
})

describe('状态迁移', () => {
  it('激活后处于讲解态且主题正确', () => {
    const state = activate('酱香工艺')
    expect(state.phase).toBe('explain')
    expect(state.topic).toBe('酱香工艺')
    expect(state.quiz).toBeNull()
    expect(state.weakPoints).toEqual([])
  })

  it('讲解态收到用户消息后进入答疑态并重算摘要', () => {
    const state = noteUserMessage(activate('酱香工艺'), '为什么叫酱香')
    expect(state.phase).toBe('qa')
    expect(state.summary).toContain('为什么叫酱香')
  })

  it('出题态收到作答后进入批改态', () => {
    const quizState = noteQuiz(activate('酱香工艺'), sampleQuiz)
    expect(quizState.phase).toBe('quiz')
    const gradeState = noteUserMessage(quizState, '1A 2B 3C')
    expect(gradeState.phase).toBe('grade')
  })

  it('出题态但尚未出题时收到消息不进入批改态', () => {
    const state = activate('酱香工艺')
    const quizPending = { ...state, phase: 'quiz' as const, quiz: null }
    expect(noteUserMessage(quizPending, '1A 2B 3C').phase).toBe('quiz')
  })

  it('批改结果记录弱点并进入补学态', () => {
    const graded = noteGrade(noteQuiz(activate('酱香工艺'), sampleQuiz), '高温堆积发酵', 5)
    expect(graded.phase).toBe('remedial')
    expect(graded.focus).toBe('高温堆积发酵')
    expect(graded.weakPoints).toEqual(['高温堆积发酵'])
    expect(graded.quiz).toBeNull()
  })

  it('空弱点不写入弱点列表', () => {
    const graded = noteGrade(noteQuiz(activate('酱香工艺'), sampleQuiz), '  ', 5)
    expect(graded.weakPoints).toEqual([])
    expect(graded.focus).toBe('')
  })

  it('弱点列表超出上限时保留最近 N 个', () => {
    let state = activate('酱香工艺')
    for (const point of ['a', 'b', 'c']) {
      state = noteGrade(noteQuiz(state, sampleQuiz), point, 2)
    }
    expect(state.weakPoints).toEqual(['b', 'c'])
  })

  it('补学结束回到讲解态', () => {
    const graded = noteGrade(noteQuiz(activate('酱香工艺'), sampleQuiz), '制曲', 5)
    expect(finishRemedial(graded).phase).toBe('explain')
  })

  it('提醒计数可累加', () => {
    expect(bumpReminder(activate('酱香工艺')).reminderAttempts).toBe(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
pnpm vitest run tests/state.spec.ts
```

预期：FAIL，报 `Cannot find module '../src/state.js'`。

- [ ] **Step 3: 实现 `src/summary.ts`**

```ts
/** 摘要中问题文本的最大保留字数。 */
const QUESTION_MAX_CHARS = 24

/**
 * 用代码拼出一句话上下文摘要，不发起模型请求。
 * @param topic - 当前学习主题。
 * @param focus - 当前补学聚焦点，空串表示无。
 * @param question - 本轮学生提问。
 * @returns 可直接注入 system 提示的摘要句。
 */
export function composeSummary(topic: string, focus: string, question: string): string {
  const parts = [`正在学习「${topic}」`]
  if (focus) parts.push(`刚补学过「${focus}」`)
  parts.push(`本轮学生提问「${question.slice(0, QUESTION_MAX_CHARS)}」`)
  return `${parts.join('，')}。`
}
```

- [ ] **Step 4: 实现 `src/state.ts`**

```ts
import { composeSummary } from './summary.js'

/** 教学状态机的阶段。 */
export type Phase = 'explain' | 'qa' | 'quiz' | 'grade' | 'remedial'

/** 单道单选题。schema 中没有答案字段，因此答案不可能被泄漏。 */
export interface QuizQuestion {
  readonly stem: string
  readonly options: readonly string[]
}

/** 一次完整测验。 */
export interface Quiz {
  readonly topic: string
  readonly questions: readonly QuizQuestion[]
}

/** 一个会话的全部教学状态，只读，迁移必须返回新对象。 */
export interface LearningState {
  readonly phase: Phase
  readonly topic: string
  readonly focus: string
  readonly summary: string
  readonly weakPoints: readonly string[]
  readonly quiz: Quiz | null
  readonly reminderAttempts: number
}

/**
 * 开始一个主题的学习，回到讲解态并清空旧进度。
 * @param topic - 学习主题。
 * @returns 全新的讲解态状态。
 */
export function activate(topic: string): LearningState {
  return {
    phase: 'explain',
    topic,
    focus: '',
    summary: `学生刚开始学习「${topic}」，此前没有任何对话记录。`,
    weakPoints: [],
    quiz: null,
    reminderAttempts: 0,
  }
}

/**
 * 收到学生消息后的状态迁移。
 * 讲解态进入答疑并重算摘要；已出题的出题态进入批改态；其余不变。
 * @param state - 当前状态。
 * @param text - 学生消息正文。
 * @returns 迁移后的新状态。
 */
export function noteUserMessage(state: LearningState, text: string): LearningState {
  if (state.phase === 'explain') {
    return { ...state, phase: 'qa', summary: composeSummary(state.topic, state.focus, text) }
  }
  if (state.phase === 'quiz' && state.quiz !== null) {
    return { ...state, phase: 'grade' }
  }
  return state
}

/**
 * 记录模型提交的题目。
 * @param state - 当前状态。
 * @param quiz - 校验通过的测验。
 * @returns 出题态的新状态。
 */
export function noteQuiz(state: LearningState, quiz: Quiz): LearningState {
  return { ...state, phase: 'quiz', quiz, focus: '' }
}

/**
 * 记录批改结果并进入补学态。
 * @param state - 当前状态。
 * @param weakPoint - 模型给出的薄弱点，空串表示未识别出。
 * @param maxWeakPoints - 弱点列表上限。
 * @returns 补学态的新状态。
 */
export function noteGrade(
  state: LearningState,
  weakPoint: string,
  maxWeakPoints: number,
): LearningState {
  const point = weakPoint.trim()
  const weakPoints = point
    ? [...state.weakPoints, point].slice(-maxWeakPoints)
    : state.weakPoints
  const summary = point
    ? `学生刚完成一次「${state.topic}」测验，暴露的薄弱点是「${point}」。`
    : `学生刚完成一次「${state.topic}」测验，未识别出明确薄弱点，正在复习原主题。`
  return { ...state, phase: 'remedial', focus: point, quiz: null, weakPoints, summary }
}

/**
 * 补学回合结束后回到讲解态。
 * @param state - 当前状态。
 * @returns 讲解态的新状态。
 */
export function finishRemedial(state: LearningState): LearningState {
  return state.phase === 'remedial' ? { ...state, phase: 'explain' } : state
}

/**
 * 增加一次退化提醒计数。
 * @param state - 当前状态。
 * @returns 计数加一后的新状态。
 */
export function bumpReminder(state: LearningState): LearningState {
  return { ...state, reminderAttempts: state.reminderAttempts + 1 }
}
```

- [ ] **Step 5: 运行测试确认通过**

```powershell
pnpm vitest run tests/state.spec.ts
```

预期：PASS，全部用例通过。

- [ ] **Step 6: 提交**

```powershell
git add src tests
git commit -m "feat: 教学状态模型与代码摘要生成"
```

---

### Task 3: 配置 schema

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.spec.ts`

**Interfaces:**
- Consumes: 无
- Produces: `interface Config`、`const Config: Schema<Config>`，字段为 `topics` / `defaultTopic` / `questionCount` / `optionsPerQuestion` / `maxWeakPoints` / `maxSessions` / `reminderMaxAttempts`。

- [ ] **Step 1: 写失败测试**

`tests/config.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.js'

describe('Config schema', () => {
  it('缺省时填入全部默认值', () => {
    const config = Config({})
    expect(config.topics).toEqual(['酱香工艺', '浓香品鉴', '白酒文化'])
    expect(config.defaultTopic).toBe('白酒基础知识')
    expect(config.questionCount).toBe(3)
    expect(config.optionsPerQuestion).toBe(4)
    expect(config.maxWeakPoints).toBe(5)
    expect(config.maxSessions).toBe(200)
    expect(config.reminderMaxAttempts).toBe(1)
  })

  it('题目为 0 时配置校验失败', () => {
    expect(() => Config({ questionCount: 0 })).toThrow()
  })

  it('选项数小于 2 时配置校验失败', () => {
    expect(() => Config({ optionsPerQuestion: 1 })).toThrow()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
pnpm vitest run tests/config.spec.ts
```

预期：FAIL，报 `Cannot find module '../src/config.js'`。

- [ ] **Step 3: 实现 `src/config.ts`**

```ts
import Schema from '@deepseek-ai/schemastery'

/** 插件配置，全部字段可在 cordis.patch.yml 覆盖。 */
export interface Config {
  /** 预设主题列表。 */
  topics: string[]
  /** 未选择主题时的兜底主题。 */
  defaultTopic: string
  /** 每次测验的题目数。 */
  questionCount: number
  /** 每题的选项数。 */
  optionsPerQuestion: number
  /** 弱点列表保留上限。 */
  maxWeakPoints: number
  /** 会话状态表的 LRU 上限。 */
  maxSessions: number
  /** 模型未按工具调用格式输出时的提醒次数上限。 */
  reminderMaxAttempts: number
}

/** 配置校验 schema，非法配置在插件加载时直接失败。 */
export const Config: Schema<Config> = Schema.object({
  topics: Schema.array(String).default(['酱香工艺', '浓香品鉴', '白酒文化']),
  defaultTopic: Schema.string().default('白酒基础知识'),
  questionCount: Schema.number().min(1).max(10).step(1).default(3),
  optionsPerQuestion: Schema.number().min(2).max(6).step(1).default(4),
  maxWeakPoints: Schema.number().min(1).default(5),
  maxSessions: Schema.number().min(1).default(200),
  reminderMaxAttempts: Schema.number().min(0).default(1),
})
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
pnpm vitest run tests/config.spec.ts
```

预期：PASS。若 `Schema.number().min().max().step()` 的链式 API 与当前 schemastery 版本不符，按 `node_modules/@deepseek-ai/schemastery/README.md` 调整，保持测试断言不变。

- [ ] **Step 5: 提交**

```powershell
git add src/config.ts tests/config.spec.ts
git commit -m "feat: 插件配置 schema 与默认值"
```

---

### Task 4: 会话状态存储（LRU）

**Files:**
- Create: `src/store.ts`
- Test: `tests/store.spec.ts`

**Interfaces:**
- Consumes: `LearningState`（Task 2）
- Produces: `class SessionStore`，方法 `get(id: string)`, `set(id: string, state: LearningState)`, `delete(id: string)`, 只读 `size`。

- [ ] **Step 1: 写失败测试**

`tests/store.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { activate } from '../src/state.js'
import { SessionStore } from '../src/store.js'

describe('SessionStore', () => {
  it('写入后可读出同一状态', () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    expect(store.get('s1')?.topic).toBe('酱香工艺')
  })

  it('未写入的会话返回 undefined', () => {
    expect(new SessionStore(10).get('missing')).toBeUndefined()
  })

  it('删除后不可读', () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    store.delete('s1')
    expect(store.get('s1')).toBeUndefined()
  })

  it('超出上限时淘汰最久未访问的会话', () => {
    const store = new SessionStore(2)
    store.set('a', activate('甲'))
    store.set('b', activate('乙'))
    store.get('a')
    store.set('c', activate('丙'))
    expect(store.get('b')).toBeUndefined()
    expect(store.get('a')?.topic).toBe('甲')
    expect(store.get('c')?.topic).toBe('丙')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
pnpm vitest run tests/store.spec.ts
```

预期：FAIL，报 `Cannot find module '../src/store.js'`。

- [ ] **Step 3: 实现 `src/store.ts`**

```ts
import type { LearningState } from './state.js'

/**
 * 按会话保存教学状态的 LRU 表。
 * Map 的插入顺序即访问顺序：每次读取都把键移到队尾，超限时淘汰队首。
 */
export class SessionStore {
  private readonly states = new Map<string, LearningState>()

  /**
   * @param maxSessions - 保留的会话数上限，必须为正数。
   */
  constructor(private readonly maxSessions: number) {
    if (!Number.isInteger(maxSessions) || maxSessions < 1) {
      throw new RangeError(`maxSessions 必须是正整数，收到 ${maxSessions}`)
    }
  }

  /**
   * 读取一个会话的状态，并把它标记为最近使用。
   * @param id - 会话 id。
   * @returns 状态；该会话未被接管时返回 undefined。
   */
  get(id: string): LearningState | undefined {
    const state = this.states.get(id)
    if (state === undefined) return undefined
    this.states.delete(id)
    this.states.set(id, state)
    return state
  }

  /**
   * 写入一个会话的状态。
   * @param id - 会话 id。
   * @param state - 新状态。
   */
  set(id: string, state: LearningState): void {
    this.states.delete(id)
    this.states.set(id, state)
    while (this.states.size > this.maxSessions) {
      const oldest = this.states.keys().next()
      if (oldest.done) break
      this.states.delete(oldest.value)
    }
  }

  /**
   * 删除一个会话的状态。
   * @param id - 会话 id。
   */
  delete(id: string): void {
    this.states.delete(id)
  }

  /** 当前被接管的会话数。 */
  get size(): number {
    return this.states.size
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
pnpm vitest run tests/store.spec.ts
```

预期：PASS。

- [ ] **Step 5: 提交**

```powershell
git add src/store.ts tests/store.spec.ts
git commit -m "feat: 会话教学状态 LRU 存储"
```

---

### Task 5: `submit_quiz` 工具

**Files:**
- Create: `src/tools/submit-quiz.ts`
- Test: `tests/submit-quiz.spec.ts`

**Interfaces:**
- Consumes: `SessionStore`（Task 4）、`LearningState` / `Quiz` / `noteQuiz`（Task 2）、`Config`（Task 3）
- Produces:
  - `interface SubmitQuizArgs { questions: readonly { stem: string; options: readonly string[] }[] }`
  - `validateQuiz(args: SubmitQuizArgs, config: Config): QuizQuestion[]`（纯函数，抛错表示无效）
  - `formatQuiz(topic: string, questions: readonly QuizQuestion[]): string`
  - `registerSubmitQuiz(ctx: Context, store: SessionStore, config: Config): void`

- [ ] **Step 1: 写失败测试**

`tests/submit-quiz.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { formatQuiz, validateQuiz } from '../src/tools/submit-quiz.js'

const config = {
  topics: ['酱香工艺'],
  defaultTopic: '白酒基础知识',
  questionCount: 2,
  optionsPerQuestion: 3,
  maxWeakPoints: 5,
  maxSessions: 200,
  reminderMaxAttempts: 1,
}

const ok = {
  questions: [
    { stem: '题一', options: ['A', 'B', 'C'] },
    { stem: '题二', options: ['A', 'B', 'C'] },
  ],
}

describe('validateQuiz', () => {
  it('题目数与选项数都合规时原样返回', () => {
    expect(validateQuiz(ok, config)).toHaveLength(2)
  })

  it('题目数不符时抛错', () => {
    expect(() => validateQuiz({ questions: [ok.questions[0]!] }, config)).toThrow(/题目数/)
  })

  it('选项数不符时抛错', () => {
    const bad = { questions: [ok.questions[0]!, { stem: '题二', options: ['A'] }] }
    expect(() => validateQuiz(bad, config)).toThrow(/选项数/)
  })

  it('题干为空时抛错', () => {
    const bad = { questions: [{ stem: '  ', options: ['A', 'B', 'C'] }, ok.questions[1]!] }
    expect(() => validateQuiz(bad, config)).toThrow(/题干/)
  })
})

describe('formatQuiz', () => {
  it('渲染出题号、题干、选项与作答提示', () => {
    const text = formatQuiz('酱香工艺', [
      { stem: '题一', options: ['甲', '乙', '丙'] },
    ])
    expect(text).toContain('酱香工艺')
    expect(text).toContain('1. 题一')
    expect(text).toContain('A. 甲')
    expect(text).toContain('1A')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
pnpm vitest run tests/submit-quiz.spec.ts
```

预期：FAIL，报 `Cannot find module '../src/tools/submit-quiz.js'`。

- [ ] **Step 3: 实现 `src/tools/submit-quiz.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from '../config.js'
import type { QuizQuestion } from '../state.js'
import { noteQuiz } from '../state.js'
import type { SessionStore } from '../store.js'

/** 题目选项字母表，供渲染作答格式使用。 */
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** `submit_quiz` 的参数。 */
export interface SubmitQuizArgs {
  readonly questions: readonly {
    readonly stem: string
    readonly options: readonly string[]
  }[]
}

/**
 * 校验模型提交的题目。
 * @param args - 工具参数。
 * @param config - 插件配置，提供题数与选项数约束。
 * @returns 校验通过的题目列表。
 * @throws 题目数、选项数或题干不合法时抛出带中文说明的错误。
 */
export function validateQuiz(args: SubmitQuizArgs, config: Config): QuizQuestion[] {
  if (args.questions.length !== config.questionCount) {
    throw new Error(`题目数必须为 ${config.questionCount}，实际 ${args.questions.length}`)
  }
  return args.questions.map((question, index) => {
    if (question.stem.trim() === '') {
      throw new Error(`第 ${index + 1} 题题干为空`)
    }
    if (question.options.length !== config.optionsPerQuestion) {
      throw new Error(
        `第 ${index + 1} 题选项数必须为 ${config.optionsPerQuestion}，实际 ${question.options.length}`,
      )
    }
    return { stem: question.stem.trim(), options: question.options.map(o => o.trim()) }
  })
}

/**
 * 把题目渲染成给用户看的文本。
 * @param topic - 主题。
 * @param questions - 题目列表。
 * @returns Markdown 文本，末行附作答格式。
 */
export function formatQuiz(topic: string, questions: readonly QuizQuestion[]): string {
  const body = questions
    .map((question, index) => {
      const options = question.options
        .map((option, optionIndex) => `${OPTION_LETTERS[optionIndex]}. ${option}`)
        .join('\n')
      return `${index + 1}. ${question.stem}\n${options}`
    })
    .join('\n\n')
  return `### 📝 随堂测验 · ${topic}\n\n${body}\n\n---\n请按 \`1A 2B 3C\` 的格式回复你的答案。`
}

/**
 * 注册 `submit_quiz` 工具，仅在"出题态且尚无题目"时可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerSubmitQuiz(ctx: Context, store: SessionStore, config: Config): void {
  ctx.tools.register(
    defineTool({
      name: 'submit_quiz',
      description: '提交本次测验的题目。只提交题干与选项，不要提交任何答案。',
      parameters: {
        questions: {
          type: 'array',
          required: true,
          description: `题目列表，必须正好 ${config.questionCount} 道`,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              stem: { type: 'string', required: true, description: '题干' },
              options: {
                type: 'array',
                required: true,
                description: `选项列表，必须正好 ${config.optionsPerQuestion} 项`,
                items: { type: 'string' },
              },
            },
          },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topic: { type: 'string', required: true },
            questionCount: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `已提交 ${value.questionCount} 道题，主题「${value.topic}」。` },
        ],
      },
      execute: (args, exec) => {
        const agent = exec.agent
        if (!agent) throw new Error('当前调用没有关联会话')
        const state = store.get(agent.sessionId)
        if (!state) throw new Error('当前会话没有教学状态，请先用 /learn <主题> 开始学习')
        if (state.phase !== 'quiz' || state.quiz !== null) {
          throw new Error(`当前处于「${state.phase}」阶段，不能提交题目`)
        }
        const questions = validateQuiz(args, config)
        store.set(agent.sessionId, noteQuiz(state, { topic: state.topic, questions }))
        exec.concludeTurn()
        return { topic: state.topic, questionCount: questions.length }
      },
    }),
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

```powershell
pnpm vitest run tests/submit-quiz.spec.ts
pnpm run build
```

预期：测试 PASS，构建无类型错误。

- [ ] **Step 5: 提交**

```powershell
git add src/tools tests/submit-quiz.spec.ts
git commit -m "feat: submit_quiz 工具与题目校验"
```

---

### Task 6: `submit_grade` 工具

**Files:**
- Create: `src/tools/submit-grade.ts`
- Test: `tests/submit-grade.spec.ts`

**Interfaces:**
- Consumes: Task 2 的 `noteGrade`、Task 3 的 `Config`、Task 4 的 `SessionStore`
- Produces:
  - `interface SubmitGradeArgs { score: number; total: number; wrong: readonly { index: number; explanation: string }[]; weakPoint: string }`
  - `validateGrade(args: SubmitGradeArgs, expectedTotal: number): SubmitGradeArgs`（纯函数）
  - `formatFeedback(args: SubmitGradeArgs, topic: string): string`
  - `registerSubmitGrade(ctx: Context, store: SessionStore, config: Config): void`

- [ ] **Step 1: 写失败测试**

`tests/submit-grade.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { formatFeedback, validateGrade } from '../src/tools/submit-grade.js'

const ok = {
  score: 2,
  total: 3,
  wrong: [{ index: 2, explanation: '堆积温度记成了低温' }],
  weakPoint: '高温堆积发酵',
}

describe('validateGrade', () => {
  it('合法输入原样返回', () => {
    expect(validateGrade(ok, 3).weakPoint).toBe('高温堆积发酵')
  })

  it('得分超过总分时抛错', () => {
    expect(() => validateGrade({ ...ok, score: 4 }, 3)).toThrow(/得分/)
  })

  it('负分抛错', () => {
    expect(() => validateGrade({ ...ok, score: -1 }, 3)).toThrow(/得分/)
  })

  it('题数对不上时抛错', () => {
    expect(() => validateGrade(ok, 5)).toThrow(/题数/)
  })

  it('错题序号越界时抛错', () => {
    expect(() =>
      validateGrade({ ...ok, score: 2, wrong: [{ index: 9, explanation: 'x' }] }, 3),
    ).toThrow(/序号/)
  })
})

describe('formatFeedback', () => {
  it('渲染得分、错题解析与薄弱点', () => {
    const text = formatFeedback(ok, '酱香工艺')
    expect(text).toContain('2 / 3')
    expect(text).toContain('第 2 题')
    expect(text).toContain('堆积温度记成了低温')
    expect(text).toContain('高温堆积发酵')
  })

  it('无错题时不渲染错题段落', () => {
    const text = formatFeedback({ score: 3, total: 3, wrong: [], weakPoint: '' }, '酱香工艺')
    expect(text).not.toContain('错题解析')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```powershell
pnpm vitest run tests/submit-grade.spec.ts
```

预期：FAIL，报模块不存在。

- [ ] **Step 3: 实现消息来源声明 `src/source.ts`**

```ts
import type { MessageSource } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  /** 本插件投递的上下文消息来源。 */
  interface MessageSourceMap {
    baijiu: { kind: 'baijiu' }
  }
}

/** 本插件投递消息时使用的来源标记，用于在 pre-step 中区分插件与真人输入。 */
export const BAIJIU_SOURCE: MessageSource = { kind: 'baijiu' }
```

- [ ] **Step 4: 实现 `src/tools/submit-grade.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from '../config.js'
import { BAIJIU_SOURCE } from '../source.js'
import { noteGrade } from '../state.js'
import type { SessionStore } from '../store.js'

/** `submit_grade` 的参数。 */
export interface SubmitGradeArgs {
  readonly score: number
  readonly total: number
  readonly wrong: readonly { readonly index: number; readonly explanation: string }[]
  readonly weakPoint: string
}

/**
 * 校验批改结果。
 * @param args - 工具参数。
 * @param expectedTotal - 本卷题目数，来自已保存的测验。
 * @returns 校验通过的批改结果。
 * @throws 得分、题数或错题序号不合法时抛出中文错误。
 */
export function validateGrade(args: SubmitGradeArgs, expectedTotal: number): SubmitGradeArgs {
  if (args.total !== expectedTotal) {
    throw new Error(`题数与试卷不符：试卷 ${expectedTotal} 题，提交 ${args.total} 题`)
  }
  if (!Number.isInteger(args.score) || args.score < 0 || args.score > args.total) {
    throw new Error(`得分必须是 0 到 ${args.total} 之间的整数，实际 ${args.score}`)
  }
  for (const item of args.wrong) {
    if (!Number.isInteger(item.index) || item.index < 1 || item.index > expectedTotal) {
      throw new Error(`错题序号越界：${item.index}`)
    }
  }
  return args
}

/**
 * 渲染批改结果为面向用户的文本。
 * @param args - 批改结果。
 * @param topic - 主题。
 * @returns Markdown 文本。
 */
export function formatFeedback(args: SubmitGradeArgs, topic: string): string {
  const lines = [`### 📊 批改结果 · ${topic}`, '', `得分：**${args.score} / ${args.total}**`]
  if (args.wrong.length > 0) {
    lines.push('', '**错题解析**')
    for (const item of args.wrong) {
      lines.push(`- 第 ${item.index} 题：${item.explanation}`)
    }
  }
  if (args.weakPoint.trim() !== '') {
    lines.push('', `**薄弱知识点**：${args.weakPoint}`)
  }
  return lines.join('\n')
}

/**
 * 注册 `submit_grade` 工具，仅在批改态可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerSubmitGrade(ctx: Context, store: SessionStore, config: Config): void {
  ctx.tools.register(
    defineTool({
      name: 'submit_grade',
      description: '提交本次测验的批改结果：得分、错题解析与一个薄弱知识点。',
      parameters: {
        score: { type: 'integer', required: true, description: '答对题数' },
        total: { type: 'integer', required: true, description: '本卷题目总数' },
        wrong: {
          type: 'array',
          required: true,
          description: '错题列表，全对时传空数组',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', required: true, description: '题号，从 1 开始' },
              explanation: { type: 'string', required: true, description: '该题解析' },
            },
          },
        },
        weakPoint: {
          type: 'string',
          required: true,
          description: '学生最薄弱的一个知识点，不超过 10 字；未识别出时传空字符串',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            score: { type: 'integer', required: true },
            total: { type: 'integer', required: true },
            weakPoint: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `已批改：${value.score} / ${value.total}。` },
        ],
      },
      execute: (args, exec) => {
        if (!exec.agent) throw new Error('当前调用没有关联会话')
        const sessionId = exec.agent.sessionId
        const state = store.get(sessionId)
        if (!state) throw new Error('当前会话没有教学状态，请先用 /learn <主题> 开始学习')
        if (state.phase !== 'grade' || !state.quiz) {
          throw new Error(`当前处于「${state.phase}」阶段，没有待批改的答卷`)
        }

        const graded = validateGrade(args, state.quiz.questions.length)
        store.set(sessionId, noteGrade(state, graded.weakPoint, config.maxWeakPoints))

        const ask = graded.weakPoint.trim()
          ? `请针对学生的薄弱点「${graded.weakPoint}」重新讲解一遍，讲得比上次更细。`
          : `请针对「${state.topic}」的核心要点再梳理一遍，帮助学生巩固。`
        exec.deferContext(
          createUserMessage({ content: [{ type: 'text', text: ask }], source: BAIJIU_SOURCE }),
        )

        return { score: graded.score, total: graded.total, weakPoint: graded.weakPoint }
      },
    }),
  )
}
```

- [ ] **Step 5: 运行测试确认通过**

```powershell
pnpm vitest run tests/submit-grade.spec.ts
pnpm run build
```

预期：测试 PASS，构建无类型错误。

- [ ] **Step 6: 提交**

```powershell
git add src/tools src/source.ts tests/submit-grade.spec.ts
git commit -m "feat: submit_grade 工具与补学上下文投递"
```

---

### Task 7: 斜杠命令

**Files:**
- Create: `src/commands.ts`

**Interfaces:**
- Consumes: `SessionStore`、`Config`、`activate`、`BAIJIU_SOURCE`
- Produces: `registerCommands(ctx: Context, store: SessionStore, config: Config): void`，注册 `/learn`、`/quiz`、`/status`、`/reset`。

本任务是薄胶水层，行为由 Task 11 的集成冒烟验证；纯逻辑已在 Task 2/4 覆盖。

- [ ] **Step 1: 实现 `src/commands.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Config } from './config.js'
import { BAIJIU_SOURCE } from './source.js'
import { activate } from './state.js'
import type { SessionStore } from './store.js'

/**
 * 向当前会话投递一条本插件来源的用户消息。
 * @param agent - 接收消息的 Agent。
 * @param text - 消息正文。
 */
function sendToAgent(agent: { followup(message: ReturnType<typeof createUserMessage>): void }, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: BAIJIU_SOURCE }))
}

/**
 * 注册四个教学命令。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerCommands(ctx: Context, store: SessionStore, config: Config): void {
  ctx.commands.register({
    name: 'learn',
    description: '开始或切换学习主题',
    input: { hint: '主题名，例如：酱香工艺' },
    handler: ({ agent, rawInput }) => {
      const topic = rawInput.trim() || config.defaultTopic
      store.set(agent.sessionId, activate(topic))
      sendToAgent(agent, `请开始讲解「${topic}」。`)
      return { kind: 'success', text: `已切换到主题「${topic}」，老师傅开始讲解。` }
    },
  })

  ctx.commands.register({
    name: 'quiz',
    description: '进入测验：出 3 道单选题',
    handler: ({ agent }) => {
      const state = store.get(agent.sessionId)
      if (!state) {
        return { kind: 'error', text: '尚未选择主题，请先用 /learn <主题> 开始学习。' }
      }
      store.set(agent.sessionId, { ...state, phase: 'quiz', quiz: null, focus: '' })
      sendToAgent(
        agent,
        `请针对「${state.topic}」出 ${config.questionCount} 道单项选择题，只给题目和选项，然后用 submit_quiz 工具提交。`,
      )
      return { kind: 'success', text: '已进入出题模式。' }
    },
  })

  ctx.commands.register({
    name: 'status',
    description: '查看当前学习状态',
    handler: ({ agent }) => {
      const state = store.get(agent.sessionId)
      if (!state) return { kind: 'success', text: '尚未开始学习。用 /learn <主题> 开始。' }
      const lines = [
        `阶段：${state.phase}`,
        `主题：${state.topic || config.defaultTopic}`,
        `聚焦：${state.focus || '无'}`,
        `待巩固：${state.weakPoints.length > 0 ? state.weakPoints.join(' / ') : '无'}`,
        `待答题目：${state.quiz ? state.quiz.questions.length : 0} 道`,
      ]
      return { kind: 'success', text: lines.join('\n') }
    },
  })

  ctx.commands.register({
    name: 'reset',
    description: '清空当前会话的学习进度',
    handler: ({ agent }) => {
      store.delete(agent.sessionId)
      return { kind: 'success', text: '学习进度已清空。' }
    },
  })
}
```

- [ ] **Step 2: 构建确认无类型错误**

```powershell
pnpm run build
```

预期：构建成功。若 `followup` 的参数类型不匹配，直接引用 `Agent` 类型作为参数类型，不要用结构化类型猜。

- [ ] **Step 3: 提交**

```powershell
git add src/commands.ts
git commit -m "feat: /learn /quiz /status /reset 命令"
```

---

### Task 8: 动态 system 提示段

**Files:**
- Create: `src/prompt.ts`

**Interfaces:**
- Consumes: `SessionStore`、`Config`、`Phase`
- Produces: `renderStateBlock(state: LearningState, config: Config): string`、`registerPrompt(ctx, store, config): void`

- [ ] **Step 1: 实现 `src/prompt.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './config.js'
import type { LearningState, Phase } from './state.js'
import type { SessionStore } from './store.js'

/** 各阶段的模型指令，严格控制长度。 */
const PHASE_INSTRUCTIONS: Record<Phase, string> = {
  explain: '请用通俗易懂的语言讲解当前主题，包含核心工艺或特点，400 字以内，最后提出一个启发性问题。',
  qa: '请基于之前的讲解解答学生的疑问，语气亲切，300 字以内。',
  quiz: '请根据当前主题出题，只给题干和选项，绝不要输出答案，然后调用 submit_quiz 工具提交。',
  grade: '学生已提交答案。请对照题目判定对错，并用 submit_grade 工具提交得分、错题解析与一个薄弱知识点。',
  remedial: '学生刚暴露了薄弱点。请针对该薄弱点重新讲解，讲得比上次更细。',
}

/**
 * 渲染注入 system 提示的状态块。
 * @param state - 当前教学状态。
 * @param config - 插件配置。
 * @returns 多行文本。
 */
export function renderStateBlock(state: LearningState, config: Config): string {
  const lines = [
    '你是白酒学伴，一位亲切专业的酿酒老师傅。',
    `【当前阶段】${state.phase}`,
    `【当前主题】${state.topic || config.defaultTopic}`,
  ]
  if (state.focus) lines.push(`【当前聚焦】${state.focus}`)
  lines.push(`【上下文摘要】${state.summary}`)
  if (state.weakPoints.length > 0) {
    lines.push(`【待巩固】${state.weakPoints.slice(-3).join(' / ')}`)
  }
  lines.push(PHASE_INSTRUCTIONS[state.phase])
  return lines.join('\n')
}

/**
 * 注册按阶段渲染的 system 提示段。未接管的会话贡献空文本，插件对其完全隐身。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerPrompt(ctx: Context, store: SessionStore, config: Config): void {
  ctx.systemPrompt.section({
    name: 'baijiu:state',
    order: 600,
    text: context => {
      const agent = context.agent
      if (!agent) return ''
      const state = store.get(agent.sessionId)
      return state ? renderStateBlock(state, config) : ''
    },
  })
}
```

- [ ] **Step 2: 构建确认无类型错误**

```powershell
pnpm run build
```

预期：构建成功。若 `AssembleContext` 上没有 `agent` 字段，改为在 `ctx.systemPrompt.section` 的注册处通过 `ctx.agents` 自行解析，并在本文件顶部注释说明原因。

- [ ] **Step 3: 提交**

```powershell
git add src/prompt.ts
git commit -m "feat: 按阶段渲染的动态 system 提示段"
```

---

### Task 9: pre-step 路由与回合结束迁移

**Files:**
- Create: `src/router.ts`

**Interfaces:**
- Consumes: `SessionStore`、`noteUserMessage`、`finishRemedial`、`BAIJIU_SOURCE`
- Produces: `registerRouter(ctx: Context, store: SessionStore): void`

- [ ] **Step 1: 实现 `src/router.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { BAIJIU_SOURCE } from './source.js'
import { finishRemedial, noteUserMessage } from './state.js'
import type { SessionStore } from './store.js'

/**
 * 取出消息中的纯文本内容。
 * @param message - 会话消息。
 * @returns 拼接后的文本，非文本块被忽略。
 */
function textOf(message: { content: readonly { type: string; text?: string }[] }): string {
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text ?? '')
    .join('')
    .trim()
}

/**
 * 注册状态迁移：pre-step 处理讲解→答疑、出题→批改；turn/end 处理补学→讲解。
 * 插件自己投递的消息（source.kind === 'baijiu'）不触发迁移。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 */
export function registerRouter(ctx: Context, store: SessionStore): void {
  ctx.on('agent/pre-step', async (payload, next) => {
    const sessionId = payload.agent.sessionId
    const state = store.get(sessionId)
    if (state) {
      const human = payload.messages.find(message => {
        const source = (message as { source?: { kind?: string } }).source
        return source?.kind !== BAIJIU_SOURCE.kind && textOf(message) !== ''
      })
      if (human) store.set(sessionId, noteUserMessage(state, textOf(human)))
    }
    return next()
  })

  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    const state = store.get(session.id)
    if (!state) return
    const next = finishRemedial(state)
    if (next !== state) store.set(session.id, next)
  })
}
```

- [ ] **Step 2: 构建确认无类型错误**

```powershell
pnpm run build
```

预期：构建成功。若 `session/event` 的监听签名与 `session.id` 不符，以 `packages/core/session/src/types.ts` 的实际类型为准调整，保持行为不变。

- [ ] **Step 3: 提交**

```powershell
git add src/router.ts
git commit -m "feat: pre-step 状态路由与回合结束迁移"
```

---

### Task 10: 退化提醒

**Files:**
- Create: `src/reminder.ts`

**Interfaces:**
- Consumes: `SessionStore`、`Config`、`bumpReminder`、`BAIJIU_SOURCE`
- Produces: `registerReminder(ctx: Context, store: SessionStore, config: Config): void`

- [ ] **Step 1: 实现 `src/reminder.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Config } from './config.js'
import { BAIJIU_SOURCE } from './source.js'
import { bumpReminder } from './state.js'
import type { SessionStore } from './store.js'

/**
 * 模型在出题态没有调用 submit_quiz 时提醒一次。
 * 上限由 config.reminderMaxAttempts 控制，超过后放行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerReminder(ctx: Context, store: SessionStore, config: Config): void {
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end') return
    const state = store.get(session.id)
    if (!state) return
    if (state.phase !== 'quiz' || state.quiz !== null) return
    if (state.reminderAttempts >= config.reminderMaxAttempts) return

    const agent = ctx.agents.get(session.id)
    if (!agent) return
    store.set(session.id, bumpReminder(state))
    agent.followup(
      createUserMessage({
        content: [
          {
            type: 'text',
            text: '请改用 submit_quiz 工具提交题目：题干与选项放进 questions 数组，不要直接输出题目文本。',
          },
        ],
        source: BAIJIU_SOURCE,
      }),
    )
  })
}
```

- [ ] **Step 2: 构建确认无类型错误**

```powershell
pnpm run build
```

预期：构建成功。

- [ ] **Step 3: 提交**

```powershell
git add src/reminder.ts
git commit -m "feat: 出题态未调工具的一次性提醒"
```

---

### Task 11: 装配、文档与集成冒烟

**Files:**
- Modify: `src/index.ts`
- Create: `README.md`
- Modify: `cordis.patch.yml`

**Interfaces:**
- Consumes: 全部前序模块
- Produces: 可运行的完整插件。

- [ ] **Step 1: 装配 `src/index.ts`**

```ts
import type { Context } from '@deepseek-ai/cordis'
import { registerCommands } from './commands.js'
import { Config } from './config.js'
import { registerPrompt } from './prompt.js'
import { registerReminder } from './reminder.js'
import { registerRouter } from './router.js'
import './source.js'
import { SessionStore } from './store.js'
import { registerSubmitGrade } from './tools/submit-grade.js'
import { registerSubmitQuiz } from './tools/submit-quiz.js'

export { Config }
export type { Config as ConfigShape } from './config.js'

/** 插件名。 */
export const name = 'baijiu-companion'

/** 依赖的服务：工具、命令、系统提示、Agent 注册表、会话存储。 */
export const inject = ['tools', 'commands', 'systemPrompt', 'agents', 'sessions']

/**
 * 插件入口。
 * @param ctx - Cordis 上下文。
 * @param config - 已校验的插件配置。
 */
export function apply(ctx: Context, config: Config): void {
  const store = new SessionStore(config.maxSessions)
  registerSubmitQuiz(ctx, store, config)
  registerSubmitGrade(ctx, store, config)
  registerCommands(ctx, store, config)
  registerPrompt(ctx, store, config)
  registerRouter(ctx, store)
  registerReminder(ctx, store, config)
}
```

- [ ] **Step 2: 补全 `cordis.patch.yml` 默认配置**

```yaml
- insert:
    - id: baijiu-companion
      name: dsh-baijiu-companion
      config:
        topics:
          - 酱香工艺
          - 浓香品鉴
          - 白酒文化
        defaultTopic: 白酒基础知识
        questionCount: 3
        optionsPerQuestion: 4
        maxWeakPoints: 5
        maxSessions: 200
        reminderMaxAttempts: 1
```

- [ ] **Step 3: 写 `README.md`**

内容必须包含：一句话简介、`dsh plugin --profile web add <路径>` 安装命令、四个命令的用法、两张工具说明、配置字段表、以及"需要模型具名工具调用能力"的前提说明。

- [ ] **Step 4: 全量测试与构建**

```powershell
pnpm test
pnpm run build
```

预期：全部测试 PASS，`lib/` 生成成功。

- [ ] **Step 5: 重新安装到 profile 并检查配置树**

```powershell
dsh plugin --profile web remove dsh-baijiu-companion
dsh plugin --profile web add "D:\Code\doing_exercises\programs\比赛项目\baijiu-dsh-plugin"
dsh --profile web --dump-config | Select-String "baijiu-companion" -Context 0,12
```

预期：出现插件行，且 `config` 中带上述默认值。

- [ ] **Step 6: 集成冒烟（需要模型凭据）**

```powershell
$env:DEEPSEEK_API_KEY = "<按用户环境填写>"
dsh headless "/learn 酱香工艺"
dsh headless "/quiz"
```

预期：
- `/learn` 后模型给出讲解文本；
- `/quiz` 后模型调用 `submit_quiz`，输出中出现"随堂测验"与"请按 `1A 2B 3C` 的格式回复"；
- 若模型未调工具而直接输出题目，第二次会话应能看到一次性提醒。

若 `deferContext` 没有触发补讲（批改后没有下文），把 `submit-grade.ts` 中的 `exec.deferContext(...)` 改为在 `execute` 里调用 `exec.agent.followup(...)`，然后重跑本步骤。

- [ ] **Step 7: 提交**

```powershell
git add -A
git commit -m "feat: 装配插件并补全文档与默认配置"
```

---

## 自审记录

- **Spec 覆盖**：状态模型↔Task 2；配置↔Task 3；LRU↔Task 4；submit_quiz↔Task 5；submit_grade 与补学投递↔Task 6；命令↔Task 7；动态提示段↔Task 8；pre-step 路由↔Task 9；退化提醒↔Task 10；装配与验证↔Task 11；早期 API 验证↔Task 1 Step 5。
- **占位符扫描**：无 TBD/TODO；每个代码步骤都给出可粘贴的实现。
- **类型一致性**：`LearningState.reminderAttempts` 在 Task 2 定义、Task 10 消费；`validateQuiz`/`validateGrade` 的返回类型在测试与注册处一致；`BAIJIU_SOURCE.kind` 在 Task 6 定义、Task 9 消费。
