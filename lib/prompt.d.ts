import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './config.js';
import type { LearningState } from './state.js';
import type { SessionStore } from './store.js';
/**
 * 渲染注入 system 提示的状态块。
 * @param state - 当前教学状态。
 * @param config - 插件配置。
 * @returns 多行文本。
 */
export declare function renderStateBlock(state: LearningState, config: Config): string;
/**
 * 注册按阶段渲染的 system 提示段。未接管的会话贡献空文本，插件对其完全隐身。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export declare function registerPrompt(ctx: Context, store: SessionStore, config: Config): void;
