import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
import type { SessionStore } from './store.js';
/**
 * 生成预设主题提示；未配置任何主题时返回空串，避免出现空的「可选主题：」。
 * @param config - 插件配置。
 * @returns 可直接拼接进提示语的文本。
 */
export declare function topicsHint(config: Config): string;
/**
 * 注册四个教学命令。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export declare function registerCommands(ctx: Context, store: SessionStore, config: Config): void;
