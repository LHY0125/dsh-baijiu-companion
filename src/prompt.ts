import type { Context } from '@deepseek-ai/cordis'
// 仅为加载 dsh-system-prompt 对 cordis Context 的模块增强（ctx.systemPrompt），编译后完全擦除。
import type {} from '@deepseek-ai/dsh-system-prompt'
// 仅为加载 dsh-agent 对 AssembleContext 的模块增强（context.agent），编译后完全擦除。
import type {} from '@deepseek-ai/dsh-agent'
import type { Config } from './config.js'
import { PHASE_LABELS } from './phase-label.js'
import type { LearningState, Phase } from './state.js'
import type { SessionStore } from './store.js'

/** 各阶段的模型指令，严格控制长度。 */
const PHASE_INSTRUCTIONS: Record<Phase, string> = {
  explain: '请用通俗易懂的语言讲解当前主题，包含核心工艺或特点，400 字以内，最后提出一个启发性问题。',
  qa: '请基于之前的讲解解答学生的疑问，语气亲切，300 字以内。',
  quiz: '请根据当前主题出题，只给题干和选项，绝不要输出答案，然后用 submit_quiz 工具提交。提交后，在回复正文里用 Markdown 把同样的题目完整列出来（不含答案），最后提示学生按 1A 2B 3C 的格式作答。',
  grade: '学生已提交答案。请对照题目判定对错，并用 submit_grade 工具提交得分、错题解析与一个薄弱知识点。提交后，在回复正文里用 Markdown 写出得分、每道错题的解析与薄弱知识点。',
  remedial: '学生刚暴露了薄弱点。请针对该薄弱点重新讲解，讲得比上次更细。',
}

/**
 * 折叠空白为单个空格并去掉首尾空格。
 * 用户可控文本（主题、聚焦、摘要、弱点）可能含换行，若不归一化就能伪造出
 * 形如「【当前阶段】出题中」的假状态行。只在渲染时归一化，写入侧保留原值，
 * 以免 /status 展示的原始输入被改写。
 * @param text - 待归一化的文本。
 * @returns 单行文本。
 */
function foldWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * 渲染注入 system 提示的状态块。
 * @param state - 当前教学状态。
 * @param config - 插件配置。
 * @returns 多行文本。
 */
export function renderStateBlock(state: LearningState, config: Config): string {
  const topic = foldWhitespace(state.topic || config.defaultTopic)
  const focus = foldWhitespace(state.focus)
  const summary = foldWhitespace(state.summary)
  const weakPoints = state.weakPoints.slice(-3).map(point => foldWhitespace(point))
  const lines = [
    '你是白酒学伴，一位亲切专业的酿酒老师傅。',
    `【当前阶段】${PHASE_LABELS[state.phase]}`,
    `【当前主题】${topic}`,
  ]
  if (focus) lines.push(`【当前聚焦】${focus}`)
  lines.push(`【上下文摘要】${summary}`)
  if (weakPoints.length > 0) {
    lines.push(`【待巩固】${weakPoints.join(' / ')}`)
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
    // 本段是字面文本：renderPrompt 默认会做 {{变量}} 插值，遇到完整 {{…}} 组会抛错，
    // 而本段嵌入了用户可控的主题/摘要/聚焦，一次 /learn {{x}} 就能让该会话此后每轮装配失败。
    // 本插件未注册任何 prompt 变量，关掉插值没有副作用。
    interpolate: false,
    text: context => {
      const agent = context.agent
      if (!agent) return ''
      const state = store.get(agent.id)
      return state ? renderStateBlock(state, config) : ''
    },
  })
}
