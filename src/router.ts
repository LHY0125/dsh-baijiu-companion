import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
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
 * 消息来源用白名单：只认 source.kind === 'user'。MessageSourceMap 可被宿主合并扩展出
 * user-approval、skill-invocation、goal 等注入型 user 消息，白名单能让上游改名时
 * 迁移响亮失效，而不是把这些注入文本误当成学生发言。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 */
export function registerRouter(ctx: Context, store: SessionStore): void {
  ctx.on('agent/pre-step', async (payload, next) => {
    const sessionId = payload.agent.id
    const state = store.get(sessionId)
    if (state) {
      // 同一批可能认领多条消息，取最后一条非空人类消息作为学生发言。
      const human = payload.messages
        .filter(message => {
          const source = (message as { source?: { kind?: string } }).source
          return source?.kind === 'user' && textOf(message) !== ''
        })
        .at(-1)
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
