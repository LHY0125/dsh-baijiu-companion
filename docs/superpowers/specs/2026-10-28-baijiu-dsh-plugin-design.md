# 白酒学伴 → DeepSeek Harness 插件 · 设计文档

- 日期：2026-10-28
- 来源项目：`D:\Code\doing_exercises\programs\比赛项目\白酒学伴`（Python + Gradio，1495 行）
- 目标项目：`D:\Code\doing_exercises\programs\比赛项目\baijiu-dsh-plugin`（TypeScript + Cordis，独立 bundle 包）
- 宿主：DeepSeek Harness（`@deepseek-ai/dsh`，本地源码 0.2.1-rc.3 / npm 0.2.1-rc.2）

## 1. 背景与目标

白酒学伴是一个面向本地小参数模型（4K 上下文）的单页 Web 教学应用。它的核心不是提示词，而是**用代码接管全部流程控制**：状态机、上下文压缩、出题与批改分离、评后自动补学。

本设计把这套控制逻辑移植为一个 DeepSeek Harness 插件。DSH 是全插件 Cordis 架构，插件通过 `ctx` 注册工具、命令、系统提示段，并监听 agent 生命周期事件。

### 目标

1. 在 DSH 中重建"讲解 → 答疑 → 出题 → 批改 → 补学"闭环。
2. 保留原版最核心的主张：**流程控制权在代码手里，不依赖模型自己记忆阶段**。
3. 在可行处用 DSH 的强约束替代原版的启发式手段（正则、尾部约定）。

### 非目标

- 不修改 `白酒学伴` 原仓库。
- 不修改 `deepseek-harness` 上游仓库（独立包，保持其工作区干净）。
- 不移植 Gradio 的 CSS / 主题 / 布局。
- 不移植分阶段 `temperature` 调参。
- 不移植 4K 预算执行器（压缩交给 `dsh-compaction`）。

## 2. 决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 移植深度 | 代码级状态机 | 用户选定；保留原版核心主张 |
| 代码落点 | 独立 bundle 包，不碰上游仓库 | 上游是干净 clone，避免污染 |
| 入口形态 | 斜杠命令 + 模型工具双入口 | 对应原版"按钮 + 输入框" |
| 上下文策略 | 只注入摘要，压缩交给 harness | 避免与 `dsh-compaction` 双轨冲突 |
| 实现路线 | 结构化工件（schema 承载题目/批改） | 从构造上杜绝答案泄漏，替代正则擦除 |
| 状态闸门 | 工具始终注册，`execute` 内校验阶段 | 发布版 `dsh-tools` 不支持条件注册 `{ when }`；`restrict` 需按 agent 维护限制，生命周期成本高于收益 |
| 状态维度 | 按 `sessionId` | Agent 会随 resume/fork 重建，学生进度不应丢 |
| 状态持久化 | 进程内 Map + LRU | 与原版刷新即丢的语义一致；持久化留作后续增强 |
| 消息改写 | 不做 | 保持"模型可见 ⟺ 日志可重建"与用户原话一致 |

## 3. 目录结构

```
baijiu-dsh-plugin/
├── package.json           # name: dsh-baijiu-companion, dsh.bundle 清单
├── cordis.patch.yml       # 插入一行 plugin 行 + 默认配置
├── tsconfig.json          # types 指向本地 checkout 源码
├── tsdown.config.ts
├── README.md
├── src/
│   ├── index.ts           # apply(ctx, config)：唯一入口
│   ├── config.ts          # Schemastery 配置 schema
│   ├── state.ts           # LearningState + 纯函数迁移
│   ├── store.ts           # sessionId → state 的 LRU 存储
│   ├── summary.ts         # 代码生成摘要（对应原版 code_summary）
│   ├── prompt.ts          # 按 phase 渲染 system 段文本
│   ├── commands.ts        # /learn /quiz /status /reset
│   ├── router.ts          # agent/pre-step 状态迁移
│   ├── reminder.ts        # 退化路径（turn/end 提醒）
│   └── tools/
│       ├── submit-quiz.ts
│       └── submit-grade.ts
└── tests/
```

单文件职责单一，任何一个文件都可在单个上下文内读完。

## 4. 状态模型

```ts
type Phase = 'explain' | 'qa' | 'quiz' | 'grade' | 'remedial'

interface QuizQuestion {
  readonly stem: string
  readonly options: readonly string[]
}

interface Quiz {
  readonly topic: string
  readonly questions: readonly QuizQuestion[]
}

interface LearningState {
  readonly phase: Phase
  readonly topic: string
  readonly focus: string
  readonly summary: string
  readonly weakPoints: readonly string[]
  readonly quiz: Quiz | null
  readonly reminderAttempts: number
}
```

所有迁移写成 `(state, event) => state` 的纯函数，集中在 `state.ts`，不触碰任何 I/O。

阶段语义：

| Phase | 含义 | 可调用工具 |
|---|---|---|
| `explain` | 讲解中 | 无 |
| `qa` | 答疑中 | 无 |
| `quiz` | 出题中 / 等待作答 | `submit_quiz`（尚无题目时） |
| `grade` | 批改中（收到学生作答后） | `submit_grade` |
| `remedial` | 补学中 | 无 |

## 5. 对外契约

### 5.1 命令（人触发，不产生模型轮次）

| 命令 | 行为 |
|---|---|
| `/learn <主题>` | 置 `topic`、`phase=explain`，清空 `focus`/`quiz`/`weakPoints`，重置 `summary`；随后 `agent.followup()` 送一条"请开始讲解「主题」"的用户消息 |
| `/quiz` | 置 `phase=quiz`、清 `quiz`；followup 送"请出题并调用 submit_quiz" |
| `/status` | 返回当前阶段、主题、聚焦点、弱点与待答题目数的纯文本（直接渲染，不进模型） |
| `/reset` | 删除该 session 的状态 |

命令处理器签名使用 `CommandInvocation`（含 `agent`、`rawInput`、`signal`），返回 `CommandResult`。

### 5.2 工具 `submit_quiz`

两个工具**始终注册**（发布版不支持条件注册），阶段约束在 `execute` 内强制：调用时机不符时抛出带中文说明的错误，模型据此自我纠正。原"模型看不见越权工具"的强主张降级为"调用了也会被代码拒绝"。

仅在 `phase === 'quiz' && quiz === null` 时可执行。

参数 schema：

```ts
{
  questions: {
    type: 'array',
    required: true,
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stem:    { type: 'string', required: true },
        options: { type: 'array', required: true, items: { type: 'string' } },
      },
    },
  },
}
```

**schema 中没有答案字段**——这是对原版 `_ANSWER_LEAK_RE` 正则护栏的替代，从构造上使答案泄漏不可能发生。

`execute` 内手检：题数等于 `questionCount`、每题选项数等于 `optionsPerQuestion`、题干与选项非空。不满足则抛错（表示模型输出无效，转由退化路径处理）。

输出 canonical value：`{ topic, questions }`；`output.render` 渲染为给用户看的题目文本，末行附作答格式提示。

成功后调用 `exec.concludeTurn()`，避免模型复述题目。

### 5.3 工具 `submit_grade`

仅在 `phase === 'grade'` 时可执行。

参数 schema：

```ts
{
  score:     { type: 'integer', required: true },
  total:     { type: 'integer', required: true },
  wrong:     { type: 'array', required: true, items: {
                 type: 'object', additionalProperties: false,
                 properties: {
                   index:       { type: 'integer', required: true },
                   explanation: { type: 'string',  required: true },
                 } } },
  weakPoint: { type: 'string', required: true },   // 空串表示未识别出薄弱点
}
```

替代原版的 `【补学主题】XXX` 尾部约定 + `_REMEDIAL_RE` 正则。

`execute` 行为：

1. 校验 `0 <= score <= total`，且 `total === quiz.questions.length`。
2. 写入弱点（非空时；超过 `maxWeakPoints` 时取最近 N 个）。
3. `phase=remedial`、`focus=weakPoint`、`quiz=null`。
4. 更新 `summary`（代码生成，不调用模型）。
5. 用 `exec.deferContext()` 追加一条插件来源的补学请求（有弱点则"请针对「X」重新讲解，讲得比上次更细"，否则"请针对原主题核心要点再梳理一遍"）。该上下文在同一回合的下一次模型请求中生效，因此不调用 `concludeTurn()`。

### 5.4 动态 system 提示段

一个 `ctx.systemPrompt.section()`，`text` 为函数，读取 `AssembleContext.agent` 对应的状态：

```
【当前阶段】<中文阶段名>
【当前主题】<topic 或默认主题>
【当前聚焦】<focus>            （仅非空时）
【上下文摘要】<summary>
【待巩固】<weakPoints 最近 3 个> （仅非空时）
<该阶段的指令模板>
```

**未激活短路**：session 没有状态时返回空字符串。插件装在 profile 中对所有会话可见，但只有执行过 `/learn` 的会话才被接管。

### 5.5 `agent/pre-step` 路由

只做状态迁移，不改写消息内容：

- `phase === 'explain'` 且收到非空用户消息 → `phase = 'qa'`，并用该消息重算 `summary`
- `phase === 'quiz'` 且已有题目且收到非空用户消息（学生提交作答）→ `phase = 'grade'`
- `phase === 'remedial'` 且回合结束 → `phase = 'explain'`

不改写消息的理由：DSH 要求"模型可见的内容必须能从会话日志重建"；改写用户原话会让日志与用户实际输入不一致。指令一律走 system 段。

### 5.6 退化路径

监听 `turn/end`：若 `phase === 'quiz'` 且 `quiz === null`，但本回合产生了助手文本（模型没调工具，直接自由发挥），则 `followup()` 一次提醒"请改用 submit_quiz 工具提交题目"。

每个 session 最多提醒 `reminderMaxAttempts` 次（默认 1），之后放行并计数。

## 6. 完整闭环时序

```
/learn 酱香工艺
  → phase=explain，followup("请开始讲解「酱香工艺」")
      → 模型讲解
      → 用户追问 → pre-step: phase=qa → 模型答疑
/quiz
  → phase=quiz，followup("请出题并调用 submit_quiz")
      → 模型调用 submit_quiz
          → 校验 -> 落库 quiz -> 卡片展示 -> concludeTurn
  → 用户回答 "1A 2B 3C"
      → pre-step: phase=quiz 且有题目且收到用户消息 → phase=grade
      → 模型据 system 段调用 submit_grade（此时唯一可调用的工具）
          → 落库 score/weakPoint -> phase=remedial
          → exec.deferContext("请针对「高温堆积发酵」重新讲解…")
              → 同一回合下一步：模型补讲 -> pre-step: phase=explain
                  → 用户可说 "/quiz" 再考一次
```

## 7. 配置

Schemastery schema，全部字段可在 `cordis.patch.yml` 覆盖：

| 字段 | 默认 | 说明 |
|---|---|---|
| `topics` | `["酱香工艺","浓香品鉴","白酒文化"]` | 预设主题 |
| `defaultTopic` | `"白酒基础知识"` | 未选主题兜底 |
| `questionCount` | `3` | 每次出题数 |
| `optionsPerQuestion` | `4` | 每题选项数 |
| `maxWeakPoints` | `5` | 弱点列表上限 |
| `maxSessions` | `200` | 状态表 LRU 上限 |
| `reminderMaxAttempts` | `1` | 退化提醒次数 |

非法配置在插件加载时直接失败并给出可操作错误。

## 8. 交付与运行

### 包清单

```json
{
  "name": "dsh-baijiu-companion",
  "version": "0.1.0",
  "type": "module",
  "main": "./lib/index.js",
  "files": ["lib", "cordis.patch.yml"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "engines": { "dsh": ">=0.2.1-rc.2 <0.3.0" }
}
```

### 构建

- TypeScript，用 `tsc` 直接编译到 `lib/`（小包无需打包器；比 tsdown 少一层配置）
- 类型检查对着本地 checkout 的 `src`（`tsconfig.paths`），因为本地源码 rc.3 领先于 npm rc.2
- devDependencies 使用 npm 已发布的 `0.0.1-rc.1` 系列包

### 安装与启动

```powershell
npm i -g @deepseek-ai/dsh@0.2.1-rc.2
dsh plugin --profile web add <本包路径>
dsh web
```

### 早期验证（第一步）

安装 CLI 后立即确认 rc.2 的 `dsh-tools` 提供 `ToolExecution.concludeTurn()` 与 `ctx.tools.restrict(`（与实现计划 Task 1 的 Step 4 对齐）。

**发布版不支持条件注册 `{ when }`，本设计不依赖它**——两个工具始终注册，阶段约束在 `execute` 内强制。

## 9. 测试策略

| 层 | 覆盖内容 | 工具 |
|---|---|---|
| 单元 | 状态迁移纯函数、摘要生成、`submit_quiz` 参数校验（题数/选项数/空值）、配置默认值与非法配置 | vitest |
| 集成 | `dsh headless` 跑完整闭环，断言工具调用顺序与状态流转 | 本地 vLLM 或 DeepSeek key |
| 人工 | `dsh web` 走全部命令 | 手动 |

单元测试为主力：状态迁移被设计成纯函数，不依赖 DSH 运行时。

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 版本漂移（本地 rc.3 / npm rc.2） | 依赖的 API 可能不存在 | 第 1 步验证；退到源码启动 |
| 小模型结构化调用能力不足 | 不调工具、参数不合规 | 退化提醒；仍失败则降级为文本题目，但不回退正则方案 |
| `deferContext` 与实际模型请求的衔接 | 补学请求可能不触发下一跳 | 集成测试实测；必要时改用 `followup()` |
| `agent/pre-step` 是全局监听 | 影响所有会话 | 以"有无状态"短路 |
| 状态表内存增长 | 长跑进程泄漏 | LRU 上限 `maxSessions` |

## 11. 未决项

- 是否需要 `ctx.storage` 持久化教学进度（首版不做）。
- 是否需要为题目/评语提供自定义 Web 卡片（首版走通用卡片）。
- 是否接入本地 vLLM 作为 OpenAI 兼容 provider（属 harness 配置，不属插件职责）。
