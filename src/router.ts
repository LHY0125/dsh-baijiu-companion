import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
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
    const sessionId = payload.agent.id
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
