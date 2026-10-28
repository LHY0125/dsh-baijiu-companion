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
  quiz: '请根据当前主题出题，只给题干和选项，绝不要输出答案，然后用 submit_quiz 工具提交，不要在回复正文里复述题目。',
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
    `【当前阶段】${PHASE_LABELS[state.phase]}`,
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
      const state = store.get(agent.id)
      return state ? renderStateBlock(state, config) : ''
    },
  })
}
