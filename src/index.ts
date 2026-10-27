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
