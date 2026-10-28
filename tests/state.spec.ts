import { describe, expect, it } from 'vitest'
import { composeSummary } from '../src/summary.js'
import {
  activate,
  bumpReminder,
  enterGrade,
  enterQuiz,
  finishRemedial,
  noteGrade,
  noteQuiz,
  noteUserMessage,
} from '../src/state.js'

const sampleQuiz = {
  topic: '酱香工艺',
  questions: [
    { stem: '酱香型白酒的典型工艺特点是？', options: ['高温制曲', '低温发酵', '一次取酒', '不加曲'] },
  ],
}

describe('composeSummary', () => {
  it('无聚焦点、无追问时只描述主题与本轮提问', () => {
    const text = composeSummary('酱香工艺', '', '什么是高温堆积')
    expect(text).toBe('正在学习「酱香工艺」，本轮学生提问「什么是高温堆积」。')
  })

  it('有聚焦点时带上补学信息', () => {
    const text = composeSummary('酱香工艺', '高温堆积发酵', '为什么温度这么高')
    expect(text).toContain('刚补学过「高温堆积发酵」')
  })

  it('过长提问被截断到 24 字', () => {
    const long = '一'.repeat(60)
    expect(composeSummary('酱香工艺', '', long).length).toBeLessThan(60)
  })
})

describe('状态迁移', () => {
  it('激活后处于讲解态且主题正确', () => {
    const state = activate('酱香工艺')
    expect(state.phase).toBe('explain')
    expect(state.topic).toBe('酱香工艺')
    expect(state.quiz).toBeNull()
    expect(state.weakPoints).toEqual([])
  })

  it('讲解态收到用户消息后进入答疑态并重算摘要', () => {
    const state = noteUserMessage(activate('酱香工艺'), '为什么叫酱香')
    expect(state.phase).toBe('qa')
    expect(state.summary).toContain('为什么叫酱香')
  })

  it('进入出题态时清空上一轮题目与聚焦点', () => {
    const withQuiz = noteQuiz(activate('酱香工艺'), sampleQuiz)
    // noteGrade 会写入 focus，再把题目补回来，得到「既有题目又有聚焦点」的状态，
    // 这样两条清空断言都不会空转。
    const stale = { ...noteGrade(withQuiz, '制曲', 5), quiz: withQuiz.quiz }
    const entered = enterQuiz(stale)
    expect(entered.phase).toBe('quiz')
    expect(entered.quiz).toBeNull()
    expect(entered.focus).toBe('')
  })

  it('出题态收到作答后进入批改态', () => {
    const quizState = noteQuiz(activate('酱香工艺'), sampleQuiz)
    expect(quizState.phase).toBe('quiz')
    const gradeState = noteUserMessage(quizState, '1A 2B 3C')
    expect(gradeState.phase).toBe('grade')
  })

  it('出题态但尚未出题时收到消息不进入批改态', () => {
    const state = activate('酱香工艺')
    const quizPending = { ...state, phase: 'quiz' as const, quiz: null }
    expect(noteUserMessage(quizPending, '1A 2B 3C').phase).toBe('quiz')
  })

  it('批改结果记录弱点并进入补学态', () => {
    const graded = noteGrade(noteQuiz(activate('酱香工艺'), sampleQuiz), '高温堆积发酵', 5)
    expect(graded.phase).toBe('remedial')
    expect(graded.focus).toBe('高温堆积发酵')
    expect(graded.weakPoints).toEqual(['高温堆积发酵'])
    expect(graded.quiz).toBeNull()
  })

  it('空弱点不写入弱点列表', () => {
    const graded = noteGrade(noteQuiz(activate('酱香工艺'), sampleQuiz), '  ', 5)
    expect(graded.weakPoints).toEqual([])
    expect(graded.focus).toBe('')
  })

  it('弱点列表超出上限时保留最近 N 个', () => {
    let state = activate('酱香工艺')
    for (const point of ['a', 'b', 'c']) {
      state = noteGrade(noteQuiz(state, sampleQuiz), point, 2)
    }
    expect(state.weakPoints).toEqual(['b', 'c'])
  })

  it('补学结束回到讲解态', () => {
    const graded = noteGrade(noteQuiz(activate('酱香工艺'), sampleQuiz), '制曲', 5)
    expect(finishRemedial(graded).phase).toBe('explain')
  })

  it('提醒计数可累加', () => {
    expect(bumpReminder(activate('酱香工艺')).reminderAttempts).toBe(1)
  })

  it('弱点上限为非正数时不保留任何弱点', () => {
    const quizState = noteQuiz(activate('酱香工艺'), sampleQuiz)
    expect(noteGrade(quizState, '高温堆积发酵', 0).weakPoints).toEqual([])
    expect(noteGrade(quizState, '高温堆积发酵', -3).weakPoints).toEqual([])
  })

  it('补学之外调用 finishRemedial 返回原引用', () => {
    const state = activate('酱香工艺')
    expect(finishRemedial(state)).toBe(state)
  })

  it('空弱点时复用原弱点数组引用', () => {
    const quizState = noteQuiz(activate('酱香工艺'), sampleQuiz)
    expect(noteGrade(quizState, '  ', 5).weakPoints).toBe(quizState.weakPoints)
  })

  it('迁移不修改传入的原状态', () => {
    const before = activate('酱香工艺')
    const after = noteUserMessage(before, '为什么叫酱香')
    expect(before.phase).toBe('explain')
    expect(before.summary).not.toBe(after.summary)
  })

  it('已出题时 enterGrade 推进到批改态', () => {
    const quizState = noteQuiz(activate('酱香工艺'), sampleQuiz)
    expect(enterGrade(quizState).phase).toBe('grade')
  })

  it('尚未出题时 enterGrade 返回原引用', () => {
    const state = activate('酱香工艺')
    expect(enterGrade(state)).toBe(state)
  })
})
