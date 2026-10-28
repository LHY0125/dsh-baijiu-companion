import type { Context } from '@deepseek-ai/cordis';
import type { Config } from '../config.js';
import type { QuizQuestion } from '../state.js';
import type { SessionStore } from '../store.js';
/** `submit_quiz` 的参数。 */
export interface SubmitQuizArgs {
    readonly questions: readonly {
        readonly stem: string;
        readonly options: readonly string[];
    }[];
}
/**
 * 校验模型提交的题目。
 * @param args - 工具参数。
 * @param config - 插件配置，提供题数与选项数约束。
 * @returns 校验通过的题目列表。
 * @throws 题目数、选项数、题干或选项为空时抛出带中文说明的错误。
 */
export declare function validateQuiz(args: SubmitQuizArgs, config: Config): QuizQuestion[];
/**
 * 把题目渲染成给用户看的文本。
 * @param topic - 主题。
 * @param questions - 题目列表。
 * @param answerLine - 学生已有的作答；省略时提示文字作答。
 * @returns Markdown 文本。
 */
export declare function formatQuiz(topic: string, questions: readonly QuizQuestion[], answerLine?: string): string;
/**
 * 注册 `submit_quiz` 工具，仅在"出题态且尚无题目"时可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export declare function registerSubmitQuiz(ctx: Context, store: SessionStore, config: Config): void;
