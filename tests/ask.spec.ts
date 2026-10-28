import type { AskUserQuestionAnswer } from '@deepseek-ai/dsh-user-questions'
import { describe, expect, it, vi } from 'vitest'
import type { QuizAsker } from '../src/ask.js'
import {
  askQuiz, formatAnswers, interpretAnswers, questionId, toQuestionItems,
} from '../src/ask.js'
import type { QuizQuestion } from '../src/state.js'

const questions: readonly QuizQuestion[] = [
  { stem: '题一', options: ['甲', '乙', '丙'] },
  { stem: '题二', options: ['甲', '乙', '丙'] },
]

/**
 * 造一个按需作答的提问服务替身。
 * @param answer - 要返回的答案批次。
 * @returns 带 `ask` 替身的提问服务。
 */
function fakeAsker(answer: AskUserQuestionAnswer): QuizAsker & { ask: ReturnType<typeof vi.fn> } {
  const ask = vi.fn(async () => answer)
  return { ask }
}

describe('toQuestionItems', () => {
  it('一题一项，带稳定 id 与字母选项', () => {
    const items = toQuestionItems(questions)
    expect(items).toHaveLength(2)
    expect(items[0]?.id).toBe(questionId(0))
    expect(items[0]?.question).toBe('1. 题一')
    expect(items[0]?.options).toEqual([
      { label: 'A. 甲' },
      { label: 'B. 乙' },
      { label: 'C. 丙' },
    ])
  })

  it('每题都是单选，学生不能勾多选题', () => {
    expect(toQuestionItems(questions).every(item => item.multiSelect === false)).toBe(true)
  })
})

describe('interpretAnswers', () => {
  it('把选项标签反查回下标与字母', () => {
    const answered = interpretAnswers(questions, {
      answers: [
        { id: questionId(0), selected: ['B. 乙'] },
        { id: questionId(1), selected: ['C. 丙'] },
      ],
    })
    expect(answered).toEqual([
      { index: 1, optionIndex: 1, letter: 'B', custom: '' },
      { index: 2, optionIndex: 2, letter: 'C', custom: '' },
    ])
  })

  it('答案乱序时按题号重排', () => {
    const answered = interpretAnswers(questions, {
      answers: [
        { id: questionId(1), selected: ['A. 甲'] },
        { id: questionId(0), selected: ['A. 甲'] },
      ],
    })
    expect(answered.map(item => item.index)).toEqual([1, 2])
  })

  it('忽略请求里没有的题目 id', () => {
    const answered = interpretAnswers(questions, {
      answers: [{ id: 'q9', selected: ['A. 甲'] }],
    })
    expect(answered).toEqual([])
  })

  it('标签对不上任何选项时标记为未选', () => {
    const answered = interpretAnswers(questions, {
      answers: [{ id: questionId(0), selected: ['Z. 不存在'] }],
    })
    expect(answered[0]?.optionIndex).toBe(-1)
    expect(answered[0]?.letter).toBe('?')
  })

  it('保留学生的自由输入', () => {
    const answered = interpretAnswers(questions, {
      answers: [{ id: questionId(0), selected: [], custom: ' 我家也这么酿 ' }],
    })
    expect(answered[0]?.custom).toBe('我家也这么酿')
  })
})

describe('formatAnswers', () => {
  it('压成 1A 2B 形式', () => {
    expect(formatAnswers([
      { index: 1, optionIndex: 0, letter: 'A', custom: '' },
      { index: 2, optionIndex: 1, letter: 'B', custom: '' },
    ])).toBe('1A 2B')
  })

  it('自由输入括注在答案后面', () => {
    expect(formatAnswers([
      { index: 1, optionIndex: -1, letter: '?', custom: '没记住' },
    ])).toBe('1?（没记住）')
  })
})

describe('askQuiz', () => {
  const quiz = { topic: '酱香工艺', questions }

  it('把题目与 Agent 一起交给提问服务', async () => {
    const asker = fakeAsker({ answers: [{ id: questionId(0), selected: ['A. 甲'] }] })
    const agent = { id: 's1' } as never
    await askQuiz(asker, agent, quiz, undefined)
    expect(asker.ask).toHaveBeenCalledWith({
      questions: toQuestionItems(questions),
      agent,
    })
  })

  it('有取消信号时一并透传给提问服务', async () => {
    const asker = fakeAsker({ answers: [{ id: questionId(0), selected: ['A. 甲'] }] })
    const signal = new AbortController().signal
    await askQuiz(asker, { id: 's1' } as never, quiz, signal)
    expect(asker.ask).toHaveBeenCalledWith(expect.objectContaining({ signal }))
  })

  it('学生作答后返回映射好的结果', async () => {
    const asker = fakeAsker({
      answers: [
        { id: questionId(0), selected: ['A. 甲'] },
        { id: questionId(1), selected: ['B. 乙'] },
      ],
    })
    await expect(askQuiz(asker, { id: 's1' } as never, quiz, undefined))
      .resolves.toEqual([
        { index: 1, optionIndex: 0, letter: 'A', custom: '' },
        { index: 2, optionIndex: 1, letter: 'B', custom: '' },
      ])
  })

  it('宿主没有答题者时返回 null，不抛错', async () => {
    const asker: QuizAsker = { ask: async () => { throw new Error('no user-questions answerer accepted the request') } }
    await expect(askQuiz(asker, { id: 's1' } as never, quiz, undefined)).resolves.toBeNull()
  })

  it('学生取消时返回 null', async () => {
    const asker: QuizAsker = { ask: async () => { throw Object.assign(new Error('cancelled'), { code: 'ASK_CANCELLED' }) } }
    await expect(askQuiz(asker, { id: 's1' } as never, quiz, undefined)).resolves.toBeNull()
  })

  it('答题者返回空批次时返回 null', async () => {
    const asker = fakeAsker({ answers: [] })
    await expect(askQuiz(asker, { id: 's1' } as never, quiz, undefined)).resolves.toBeNull()
  })
})
