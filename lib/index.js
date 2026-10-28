import { registerCommands } from './commands.js';
import { Config } from './config.js';
import { registerPrompt } from './prompt.js';
import { registerReminder } from './reminder.js';
import { registerRouter } from './router.js';
import './source.js';
import { SessionStore } from './store.js';
import { registerSubmitGrade } from './tools/submit-grade.js';
import { registerSubmitQuiz } from './tools/submit-quiz.js';
export { Config };
/** 插件名。 */
export const name = 'baijiu-companion';
/** 依赖的服务：工具、命令、系统提示、Agent 注册表、会话存储。 */
export const inject = ['tools', 'commands', 'systemPrompt', 'agents', 'sessions'];
/**
 * 插件入口。
 * @param ctx - Cordis 上下文。
 * @param config - 已校验的插件配置。
 */
export function apply(ctx, config) {
    const store = new SessionStore(config.maxSessions);
    registerSubmitQuiz(ctx, store, config);
    registerSubmitGrade(ctx, store, config);
    registerCommands(ctx, store, config);
    registerPrompt(ctx, store, config);
    registerRouter(ctx, store);
    registerReminder(ctx, store, config);
}
