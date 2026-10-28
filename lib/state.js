import { composeSummary } from './summary.js';
/**
 * 开始一个主题的学习，回到讲解态并清空旧进度。
 * @param topic - 学习主题。
 * @returns 全新的讲解态状态。
 */
export function activate(topic) {
    return {
        phase: 'explain',
        topic,
        focus: '',
        summary: `学生刚开始学习「${topic}」，此前没有任何对话记录。`,
        weakPoints: [],
        quiz: null,
        reminderAttempts: 0,
    };
}
/**
 * 收到学生消息后的状态迁移。
 * 讲解态进入答疑并重算摘要；已出题的出题态进入批改态；其余不变。
 * @param state - 当前状态。
 * @param text - 学生消息正文。
 * @returns 迁移后的新状态。
 */
export function noteUserMessage(state, text) {
    if (state.phase === 'explain') {
        return { ...state, phase: 'qa', summary: composeSummary(state.topic, state.focus, text) };
    }
    if (state.phase === 'quiz' && state.quiz !== null) {
        return { ...state, phase: 'grade' };
    }
    return state;
}
/**
 * 进入出题态：清空上一轮题目与聚焦点。
 * @param state - 当前状态。
 * @returns 出题态的新状态。
 */
export function enterQuiz(state) {
    return { ...state, phase: 'quiz', quiz: null, focus: '' };
}
/**
 * 记录模型提交的题目。
 * @param state - 当前状态。
 * @param quiz - 校验通过的测验。
 * @returns 出题态的新状态。
 */
export function noteQuiz(state, quiz) {
    return { ...state, phase: 'quiz', quiz, focus: '' };
}
/**
 * 记录批改结果并进入补学态。
 * @param state - 当前状态。
 * @param weakPoint - 模型给出的薄弱点，空串表示未识别出。
 * @param maxWeakPoints - 弱点列表上限；非正数表示本次不新增弱点，既有弱点保持不变。
 * @returns 补学态的新状态。
 */
export function noteGrade(state, weakPoint, maxWeakPoints) {
    const point = weakPoint.trim();
    const limit = Math.max(0, Math.trunc(maxWeakPoints));
    const weakPoints = point && limit > 0
        ? [...state.weakPoints, point].slice(-limit)
        : state.weakPoints;
    const summary = point
        ? `学生刚完成一次「${state.topic}」测验，暴露的薄弱点是「${point}」。`
        : `学生刚完成一次「${state.topic}」测验，未识别出明确薄弱点，正在复习原主题。`;
    return { ...state, phase: 'remedial', focus: point, quiz: null, weakPoints, summary };
}
/**
 * 补学回合结束后回到讲解态。
 * @param state - 当前状态。
 * @returns 讲解态的新状态。
 */
export function finishRemedial(state) {
    return state.phase === 'remedial' ? { ...state, phase: 'explain' } : state;
}
/**
 * 增加一次退化提醒计数。
 * @param state - 当前状态。
 * @returns 计数加一后的新状态。
 */
export function bumpReminder(state) {
    return { ...state, reminderAttempts: state.reminderAttempts + 1 };
}
