import { describe, expect, it } from 'vitest'
import { formatQuiz, validateQuiz } from '../src/tools/submit-quiz.js'

const config = {
  topics: ['酱香工艺'],
  defaultTopic: '白酒基础知识',
  questionCount: 2,
  optionsPerQuestion: 3,
  maxWeakPoints: 5,
  maxSessions: 200,
  reminderMaxAttempts: 1,
}

const ok = {
  questions: [
    { stem: '题一', options: ['A', 'B', 'C'] },
    { stem: '题二', options: ['A', 'B', 'C'] },
  ],
}

describe('validateQuiz', () => {
  it('题目数与选项数都合规时原样返回', () => {
    expect(validateQuiz(ok, config)).toHaveLength(2)
  })

  it('题目数不符时抛错', () => {
    expect(() => validateQuiz({ questions: [ok.questions[0]!] }, config)).toThrow(/题目数/)
  })

  it('选项数不符时抛错', () => {
    const bad = { questions: [ok.questions[0]!, { stem: '题二', options: ['A'] }] }
    expect(() => validateQuiz(bad, config)).toThrow(/选项数/)
  })

  it('题干为空时抛错', () => {
    const bad = { questions: [{ stem: '  ', options: ['A', 'B', 'C'] }, ok.questions[1]!] }
    expect(() => validateQuiz(bad, config)).toThrow(/题干/)
  })
})

describe('formatQuiz', () => {
  it('渲染出题号、题干、选项与作答提示', () => {
    const text = formatQuiz('酱香工艺', [
      { stem: '题一', options: ['甲', '乙', '丙'] },
    ])
    expect(text).toContain('酱香工艺')
    expect(text).toContain('1. 题一')
    expect(text).toContain('A. 甲')
    expect(text).toContain('1A')
  })
})
