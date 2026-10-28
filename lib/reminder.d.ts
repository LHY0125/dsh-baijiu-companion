import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
import type { SessionStore } from './store.js';
/**
 * 模型在出题态没有调用 submit_quiz 时提醒一次。
 * 上限由 config.reminderMaxAttempts 控制，超过后放行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export declare function registerReminder(ctx: Context, store: SessionStore, config: Config): void;
