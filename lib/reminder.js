import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { BAIJIU_SOURCE } from './source.js';
import { bumpReminder } from './state.js';
/**
 * 模型在出题态没有调用 submit_quiz 时提醒一次。
 * 上限由 config.reminderMaxAttempts 控制，超过后放行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerReminder(ctx, store, config) {
    ctx.on('session/event', (session, event) => {
        if (event.type !== 'turn/end')
            return;
        const state = store.get(session.id);
        if (!state)
            return;
        if (state.phase !== 'quiz' || state.quiz !== null)
            return;
        if (state.reminderAttempts >= config.reminderMaxAttempts)
            return;
        const agent = ctx.agents.get(session.id);
        if (!agent)
            return;
        store.set(session.id, bumpReminder(state));
        agent.followup(createUserMessage({
            content: [
                {
                    type: 'text',
                    text: '请改用 submit_quiz 工具提交题目：题干与选项放进 questions 数组，不要直接输出题目文本。',
                },
            ],
            source: BAIJIU_SOURCE,
        }));
    });
}
