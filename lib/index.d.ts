import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
import './source.js';
export { Config };
export type { Config as ConfigShape } from './config.js';
/** 插件名。 */
export declare const name = "baijiu-companion";
/** 依赖的服务：工具、命令、系统提示、Agent 注册表、会话存储。 */
export declare const inject: string[];
/**
 * 插件入口。
 * @param ctx - Cordis 上下文。
 * @param config - 已校验的插件配置。
 */
export declare function apply(ctx: Context, config: Config): void;
