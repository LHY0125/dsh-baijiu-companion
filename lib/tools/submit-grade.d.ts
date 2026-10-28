import type { Context } from '@deepseek-ai/cordis';
import type { Config } from '../config.js';
import type { SessionStore } from '../store.js';
/** `submit_grade` 的参数。 */
export interface SubmitGradeArgs {
    readonly score: number;
    readonly total: number;
    readonly wrong: readonly {
        readonly index: number;
        readonly explanation: string;
    }[];
    readonly weakPoint: string;
}
/**
 * 校验批改结果。
 * @param args - 工具参数。
 * @param expectedTotal - 本卷题目数，来自已保存的测验。
 * @returns 校验通过的批改结果。
 * @throws 得分、题数、错题数、错题序号或解析不合法时抛出中文错误。
 */
export declare function validateGrade(args: SubmitGradeArgs, expectedTotal: number): SubmitGradeArgs;
/**
 * 渲染批改结果为面向用户的文本。
 * @param args - 批改结果。
 * @param topic - 主题。
 * @returns Markdown 文本。
 */
export declare function formatFeedback(args: SubmitGradeArgs, topic: string): string;
/**
 * 注册 `submit_grade` 工具，仅在批改态可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export declare function registerSubmitGrade(ctx: Context, store: SessionStore, config: Config): void;
