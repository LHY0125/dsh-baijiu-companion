import type { Context } from '@deepseek-ai/cordis'
// 仅为加载 dsh-commands 对 cordis Context 的模块增强（ctx.commands），编译后完全擦除。
import type {} from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Config } from './config.js'
import { PHASE_LABELS } from './phase-label.js'
import { BAIJIU_SOURCE } from './source.js'
import { activate, enterQuiz } from './state.js'
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
 * 生成预设主题提示；未配置任何主题时返回空串，避免出现空的「可选主题：」。
 * @param config - 插件配置。
 * @returns 可直接拼接进提示语的文本。
 */
export function topicsHint(config: Config): string {
  return config.topics.length > 0 ? `可选主题：${config.topics.join(' / ')}。` : ''
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
      store.set(agent.id, activate(topic))
      sendToAgent(agent, `请开始讲解「${topic}」。`)
      return { kind: 'success', text: `已切换到主题「${topic}」，老师傅开始讲解。` }
    },
  })

  ctx.commands.register({
    name: 'quiz',
    description: `进入测验：出 ${config.questionCount} 道单选题`,
    handler: ({ agent }) => {
      const state = store.get(agent.id)
      if (!state) {
        return { kind: 'error', text: `尚未选择主题，请先用 /learn <主题> 开始学习。${topicsHint(config)}` }
      }
      store.set(agent.id, enterQuiz(state))
      sendToAgent(
        agent,
        `请针对「${state.topic}」出 ${config.questionCount} 道单项选择题，只给题干和选项，绝不要输出答案，然后用 submit_quiz 工具提交；工具返回的 answerLine 非空就立刻用 submit_grade 提交批改结果。`,
      )
      return { kind: 'success', text: '已进入出题模式。' }
    },
  })

  ctx.commands.register({
    name: 'status',
    description: '查看当前学习状态',
    handler: ({ agent }) => {
      const state = store.get(agent.id)
      if (!state) return { kind: 'success', text: `尚未开始学习。用 /learn <主题> 开始。${topicsHint(config)}` }
      const lines = [
        `阶段：${PHASE_LABELS[state.phase]}`,
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
      store.delete(agent.id)
      return { kind: 'success', text: '学习进度已清空。' }
    },
  })
}
