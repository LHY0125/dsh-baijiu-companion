# 白酒学伴 · DeepSeek Harness 插件

把「白酒学伴」的教学闭环（讲解 → 答疑 → 出题 → 批改 → 补学）移植为 DeepSeek Harness 插件。流程控制由代码强制执行：阶段迁移、出题与批改的先后顺序、补学触发都不依赖模型自己记忆。

## 安装

### 从 GitHub 安装

```powershell
dsh plugin --profile web add github:LHY0125/dsh-baijiu-companion
```

仓库已包含编译产物（`lib/`），安装时**不需要**放行任何构建脚本，桌面版的插件管理器可直接安装。要固定版本可写 `github:LHY0125/dsh-baijiu-companion#<commit>`。

### 从本地检出安装（开发用）

本地 `link:` 安装不会执行构建，先自行编译：

```powershell
pnpm install
pnpm run build
dsh plugin --profile web add "D:\Code\doing_exercises\programs\比赛项目\baijiu-dsh-plugin"
```

### 维护者须知

`lib/` 是**提交进仓库**的构建产物（这样从 GitHub 安装才不需要构建权限）。修改 `src/` 后必须执行 `pnpm run build` 并连同 `lib/` 一起提交，否则远程装到的是旧代码。

### 启动

```powershell
dsh web
```

插件对未激活的会话完全隐身：只有执行过 `/learn` 的会话才会被接管。

## 命令


| 命令            | 作用                                                             |
| ----------------- | ------------------------------------------------------------------ |
| `/learn <主题>` | 开始或切换主题，回到讲解态并向模型发起讲解请求                   |
| `/quiz`         | 进入出题态，要求模型调用 `submit_quiz` 出题                      |
| `/status`       | 显示当前阶段、主题、聚焦点、待巩固弱点与待答题目数（不触发模型） |
| `/reset`        | 清空当前会话的教学进度                                           |

## 工具（模型调用）

- **`submit_quiz`**：提交题干与选项。参数 schema 中**没有答案字段**，因此答案不可能被泄漏。仅在出题态且尚无题目时可执行。
- **`submit_grade`**：提交得分、错题解析与一个薄弱知识点。批次结束后插件自动发起一次针对薄弱点的补讲请求。

两个工具始终注册，阶段不符时由代码抛错拒绝——不是靠提示词劝阻。

## 配置

默认值由 schema 单点持有，可在 profile 的 `cordis.patch.yml` 中覆盖：


| 字段                  | 默认                                 | 说明                                 |
| ----------------------- | -------------------------------------- | -------------------------------------- |
| `topics`              | `["酱香工艺","浓香品鉴","白酒文化"]` | 预设主题                             |
| `defaultTopic`        | `白酒基础知识`                       | 未选主题时的兜底                     |
| `questionCount`       | `3`                                  | 每次出题数（1–10）                  |
| `optionsPerQuestion`  | `4`                                  | 每题选项数（2–6）                   |
| `maxWeakPoints`       | `5`                                  | 弱点列表保留上限                     |
| `maxSessions`         | `200`                                | 会话状态表的 LRU 上限                |
| `reminderMaxAttempts` | `1`                                  | 模型未按工具调用格式输出时的提醒次数 |

## 前提

需要模型具备**具名工具调用能力**：出题与批改都通过工具提交结构化结果。若模型只输出自由文本，插件会在出题态提醒一次；仍不成形则本回合没有题目可答。

## 开发

```powershell
pnpm install
pnpm run build
pnpm test
```

设计与实现计划见 `docs/superpowers/specs/` 与 `docs/superpowers/plans/`。
