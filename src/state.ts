import { composeSummary } from './summary.js'

/** 教学状态机的阶段。 */
export type Phase = 'explain' | 'qa' | 'quiz' | 'grade' | 'remedial'

/** 单道单选题。schema 中没有答案字段，因此答案不可能被泄漏。 */
export interface QuizQuestion {
  readonly stem: string
  readonly options: readonly string[]
}

/** 一次完整测验。 */
export interface Quiz {
  readonly topic: string
  readonly questions: readonly QuizQuestion[]
}

/** 一个会话的全部教学状态，只读，迁移必须返回新对象。 */
export interface LearningState {
  readonly phase: Phase
  readonly topic: string
  readonly focus: string
  readonly summary: string
  readonly weakPoints: readonly string[]
  readonly quiz: Quiz | null
  readonly reminderAttempts: number
}

/**
 * 开始一个主题的学习，回到讲解态并清空旧进度。
 * @param topic - 学习主题。
 * @returns 全新的讲解态状态。
 */
export function activate(topic: string): LearningState {
  return {
    phase: 'explain',
    topic,
    focus: '',
    summary: `学生刚开始学习「${topic}」，此前没有任何对话记录。`,
    weakPoints: [],
    quiz: null,
    reminderAttempts: 0,
  }
}

/**
 * 收到学生消息后的状态迁移。
 * 讲解态进入答疑并重算摘要；已出题的出题态进入批改态；其余不变。
 * @param state - 当前状态。
 * @param text - 学生消息正文。
 * @returns 迁移后的新状态。
 */
export function noteUserMessage(state: LearningState, text: string): LearningState {
  if (state.phase === 'explain') {
    return { ...state, phase: 'qa', summary: composeSummary(state.topic, state.focus, text) }
  }
  if (state.phase === 'quiz' && state.quiz !== null) {
    return { ...state, phase: 'grade' }
  }
  return state
}

/**
 * 记录模型提交的题目。
 * @param state - 当前状态。
 * @param quiz - 校验通过的测验。
 * @returns 出题态的新状态。
 */
export function noteQuiz(state: LearningState, quiz: Quiz): LearningState {
  return { ...state, phase: 'quiz', quiz, focus: '' }
}

/**
 * 记录批改结果并进入补学态。
 * @param state - 当前状态。
 * @param weakPoint - 模型给出的薄弱点，空串表示未识别出。
 * @param maxWeakPoints - 弱点列表上限。
 * @returns 补学态的新状态。
 */
export function noteGrade(
  state: LearningState,
  weakPoint: string,
  maxWeakPoints: number,
): LearningState {
  const point = weakPoint.trim()
  const weakPoints = point
    ? [...state.weakPoints, point].slice(-maxWeakPoints)
    : state.weakPoints
  const summary = point
    ? `学生刚完成一次「${state.topic}」测验，暴露的薄弱点是「${point}」。`
    : `学生刚完成一次「${state.topic}」测验，未识别出明确薄弱点，正在复习原主题。`
  return { ...state, phase: 'remedial', focus: point, quiz: null, weakPoints, summary }
}

/**
 * 补学回合结束后回到讲解态。
 * @param state - 当前状态。
 * @returns 讲解态的新状态。
 */
export function finishRemedial(state: LearningState): LearningState {
  return state.phase === 'remedial' ? { ...state, phase: 'explain' } : state
}

/**
 * 增加一次退化提醒计数。
 * @param state - 当前状态。
 * @returns 计数加一后的新状态。
 */
export function bumpReminder(state: LearningState): LearningState {
  return { ...state, reminderAttempts: state.reminderAttempts + 1 }
}
