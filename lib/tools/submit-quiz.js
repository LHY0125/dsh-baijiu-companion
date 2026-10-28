import { defineTool } from '@deepseek-ai/dsh-tools';
import { noteQuiz } from '../state.js';
/** 题目选项字母表，供渲染作答格式使用。 */
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
/**
 * 校验模型提交的题目。
 * @param args - 工具参数。
 * @param config - 插件配置，提供题数与选项数约束。
 * @returns 校验通过的题目列表。
 * @throws 题目数、选项数、题干或选项为空时抛出带中文说明的错误。
 */
export function validateQuiz(args, config) {
    if (args.questions.length !== config.questionCount) {
        throw new Error(`题目数必须为 ${config.questionCount}，实际 ${args.questions.length}`);
    }
    return args.questions.map((question, index) => {
        if (question.stem.trim() === '') {
            throw new Error(`第 ${index + 1} 题题干为空`);
        }
        if (question.options.length !== config.optionsPerQuestion) {
            throw new Error(`第 ${index + 1} 题选项数必须为 ${config.optionsPerQuestion}，实际 ${question.options.length}`);
        }
        const options = question.options.map((option, optionIndex) => {
            const trimmed = option.trim();
            if (trimmed === '') {
                throw new Error(`第 ${index + 1} 题第 ${optionIndex + 1} 个选项为空`);
            }
            return trimmed;
        });
        return { stem: question.stem.trim(), options };
    });
}
/**
 * 把题目渲染成给用户看的文本。
 * @param topic - 主题。
 * @param questions - 题目列表。
 * @returns Markdown 文本，末行附作答格式。
 */
export function formatQuiz(topic, questions) {
    const body = questions
        .map((question, index) => {
        const options = question.options
            .map((option, optionIndex) => `${OPTION_LETTERS[optionIndex] ?? String(optionIndex + 1)}. ${option}`)
            .join('\n');
        return `${index + 1}. ${question.stem}\n${options}`;
    })
        .join('\n\n');
    return `### 📝 随堂测验 · ${topic}\n\n${body}\n\n---\n请按 \`1A 2B 3C\` 的格式回复你的答案。`;
}
/**
 * 注册 `submit_quiz` 工具，仅在"出题态且尚无题目"时可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerSubmitQuiz(ctx, store, config) {
    ctx.tools.register(defineTool({
        name: 'submit_quiz',
        description: '提交本次测验的题目。只提交题干与选项，不要提交任何答案。',
        parameters: {
            questions: {
                type: 'array',
                required: true,
                description: `题目列表，必须正好 ${config.questionCount} 道`,
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        stem: { type: 'string', required: true, description: '题干' },
                        options: {
                            type: 'array',
                            required: true,
                            description: `选项列表，必须正好 ${config.optionsPerQuestion} 项`,
                            items: { type: 'string' },
                        },
                    },
                },
            },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    topic: { type: 'string', required: true },
                    questions: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                stem: { type: 'string', required: true },
                                options: { type: 'array', required: true, items: { type: 'string' } },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => [
                { type: 'text', text: formatQuiz(value.topic, value.questions) },
            ],
        },
        execute: async (args, exec) => {
            const agent = exec.agent;
            if (!agent)
                throw new Error('当前调用没有关联会话');
            const state = store.get(agent.id);
            if (!state)
                throw new Error('当前会话没有教学状态，请先用 /learn <主题> 开始学习');
            if (state.phase !== 'quiz') {
                throw new Error(`当前处于「${state.phase}」阶段，不能提交题目`);
            }
            if (state.quiz !== null) {
                throw new Error('本次测验的题目已经提交，请等待学生作答');
            }
            const questions = validateQuiz(args, config);
            store.set(agent.id, noteQuiz(state, { topic: state.topic, questions }));
            // 刻意不调用 exec.concludeTurn()：没有助手消息的回合不会被渲染出工具行，
            // 卡片就没有落点（实测卡片仍在 DOM 但行高被折叠为 0，用户看不到题目）。
            // 让模型回一句提示即可，指令已要求它不要复述题目。
            return {
                topic: state.topic,
                questions: questions.map(question => ({
                    stem: question.stem,
                    options: [...question.options],
                })),
            };
        },
    }));
}
