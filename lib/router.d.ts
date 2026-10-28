import type { Context } from '@deepseek-ai/cordis';
import type { SessionStore } from './store.js';
/**
 * 注册状态迁移：pre-step 处理讲解→答疑、出题→批改；turn/end 处理补学→讲解。
 * 消息来源用白名单：只认 source.kind === 'user'。MessageSourceMap 可被宿主合并扩展出
 * user-approval、skill-invocation、goal 等注入型 user 消息，白名单能让上游改名时
 * 迁移响亮失效，而不是把这些注入文本误当成学生发言。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 */
export declare function registerRouter(ctx: Context, store: SessionStore): void;
