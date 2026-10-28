import type { Agent } from '@deepseek-ai/dsh-agent/types';
import type { AskUserQuestionAnswer, AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions';
import type { Quiz, QuizQuestion } from './state.js';
/**
 * 提问服务里本插件用到的那一小块。
 *
 * 只声明结构而不引入 `UserQuestionService` 类，测试因此可以用一个普通对象冒充它：
 * 插件需要的只有「把问题问出去、拿回答案」这一件事。
 */
export interface QuizAsker {
    ask(request: {
        readonly questions: AskUserQuestionItem[];
        readonly agent?: Agent;
        readonly signal?: AbortSignal;
    }): Promise<AskUserQuestionAnswer>;
}
/** 学生在卡片上的一道作答。 */
export interface AnsweredQuestion {
    /** 1 起的题号。 */
    readonly index: number;
    /** 0 起的选项下标；`-1` 表示学生没选任何选项。 */
    readonly optionIndex: number;
    /** 选项字母；没选时为 `?`。 */
    readonly letter: string;
    /** 学生的自由输入（卡片上的「其他」）；通常为空串。 */
    readonly custom: string;
}
/** 题目在卡片请求里的稳定 id。 */
export declare function questionId(index: number): string;
/**
 * 把题目转成提问卡片的问题列表。
 * @param questions - 校验通过的题目。
 * @returns 一问一项、单选、选项标签带字母的请求。
 */
export declare function toQuestionItems(questions: readonly QuizQuestion[]): AskUserQuestionItem[];
/**
 * 把卡片回传的答案批次映射回选项下标。
 * @param questions - 当初发出去的题目。
 * @param answer - 宿主回传的答案批次。
 * @returns 按题号升序的作答；无法识别的题目被丢弃。
 */
export declare function interpretAnswers(questions: readonly QuizQuestion[], answer: AskUserQuestionAnswer): AnsweredQuestion[];
/**
 * 把作答压成学生熟悉的 `1A 2B 3C`。
 * @param answered - 卡片作答。
 * @returns 单行文本；缺答的题用 `?` 占位，自由输入括注在后面。
 */
export declare function formatAnswers(answered: readonly AnsweredQuestion[]): string;
/**
 * 让学生点选作答。
 *
 * 卡片由宿主的 `dsh-client-ui-user-questions` 渲染在输入框座位（`conversation.composer`），
 * 一题一屏、选项可点，学生不需要打字。刻意不带 `wait.callId`：带 callId 的卡片
 * 在请求结束后不会被移除（客户端只清理匿名卡片），输入框会留下一张点不动的死卡片。
 * @param asker - 提问服务。
 * @param agent - 发起调用的 Agent；必须是当前运行的根 Agent。
 * @param quiz - 本次测验。
 * @param signal - 调用方取消信号。
 * @returns 作答列表；宿主没有答题者（headless 终端）、学生取消或调用被中断时返回 null。
 */
export declare function askQuiz(asker: QuizAsker, agent: Agent, quiz: Quiz, signal: AbortSignal | undefined): Promise<AnsweredQuestion[] | null>;
