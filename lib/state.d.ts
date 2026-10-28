/** 教学状态机的阶段。 */
export type Phase = 'explain' | 'qa' | 'quiz' | 'grade' | 'remedial';
/** 单道单选题。schema 中没有答案字段，因此答案不可能被泄漏。 */
export interface QuizQuestion {
    readonly stem: string;
    readonly options: readonly string[];
}
/** 一次完整测验。 */
export interface Quiz {
    readonly topic: string;
    readonly questions: readonly QuizQuestion[];
}
/** 一个会话的全部教学状态，只读；发生迁移时返回新对象，无迁移时返回原引用，调用方可据此跳过写入。 */
export interface LearningState {
    readonly phase: Phase;
    readonly topic: string;
    readonly focus: string;
    readonly summary: string;
    readonly weakPoints: readonly string[];
    readonly quiz: Quiz | null;
    readonly reminderAttempts: number;
}
/**
 * 开始一个主题的学习，回到讲解态并清空旧进度。
 * @param topic - 学习主题。
 * @returns 全新的讲解态状态。
 */
export declare function activate(topic: string): LearningState;
/**
 * 收到学生消息后的状态迁移。
 * 讲解态进入答疑并重算摘要；已出题的出题态进入批改态；其余不变。
 * @param state - 当前状态。
 * @param text - 学生消息正文。
 * @returns 迁移后的新状态。
 */
export declare function noteUserMessage(state: LearningState, text: string): LearningState;
/**
 * 进入出题态：清空上一轮题目与聚焦点。
 * @param state - 当前状态。
 * @returns 出题态的新状态。
 */
export declare function enterQuiz(state: LearningState): LearningState;
/**
 * 记录模型提交的题目。
 * @param state - 当前状态。
 * @param quiz - 校验通过的测验。
 * @returns 出题态的新状态。
 */
export declare function noteQuiz(state: LearningState, quiz: Quiz): LearningState;
/**
 * 记录批改结果并进入补学态。
 * @param state - 当前状态。
 * @param weakPoint - 模型给出的薄弱点，空串表示未识别出。
 * @param maxWeakPoints - 弱点列表上限；非正数表示本次不新增弱点，既有弱点保持不变。
 * @returns 补学态的新状态。
 */
export declare function noteGrade(state: LearningState, weakPoint: string, maxWeakPoints: number): LearningState;
/**
 * 补学回合结束后回到讲解态。
 * @param state - 当前状态。
 * @returns 讲解态的新状态。
 */
export declare function finishRemedial(state: LearningState): LearningState;
/**
 * 增加一次退化提醒计数。
 * @param state - 当前状态。
 * @returns 计数加一后的新状态。
 */
export declare function bumpReminder(state: LearningState): LearningState;
