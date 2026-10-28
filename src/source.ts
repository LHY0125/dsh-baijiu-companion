import type { MessageSource } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-llm' {
  /** 本插件投递的上下文消息来源。 */
  interface MessageSourceMap {
    baijiu: { kind: 'baijiu' }
  }
}

/** 本插件投递消息时使用的来源标记，用于在 pre-step 中区分插件与真人输入。 */
export const BAIJIU_SOURCE: MessageSource = { kind: 'baijiu' }
