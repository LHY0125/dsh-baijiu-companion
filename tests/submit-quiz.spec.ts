import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { describe, expect, it, vi } from 'vitest'
import { activate, noteQuiz } from '../src/state.js'
import { SessionStore } from '../src/store.js'
import { formatQuiz, registerSubmitQuiz, validateQuiz } from '../src/tools/submit-quiz.js'

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

/**
 * 用一个假 ctx 捕获 `registerSubmitQuiz` 注册的工具定义。
 * @param store - 传给注册函数的会话状态表。
 * @returns 被捕获的工具定义。
 */
function captureDefinition(store: SessionStore): ToolDefinition {
  let captured: ToolDefinition | undefined
  const ctx = {
    tools: {
      register: (definition: ToolDefinition) => {
        captured = definition
        return () => {}
      },
    },
  } as unknown as Context
  registerSubmitQuiz(ctx, store, config)
  if (captured === undefined) throw new Error('未捕获到工具定义')
  return captured
}

/**
 * 造一个假的执行上下文。
 * @param sessionId - 关联会话 id；传 undefined 表示没有关联会话。
 * @returns 执行上下文与 `concludeTurn` 的替身。
 */
function fakeExec(sessionId: string | undefined): {
  exec: ToolRunContext
  concludeTurn: ReturnType<typeof vi.fn>
} {
  const concludeTurn = vi.fn()
  const exec = {
    agent: sessionId === undefined ? undefined : { id: sessionId },
    concludeTurn,
  } as unknown as ToolRunContext
  return { exec, concludeTurn }
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

  it('选项为空时抛错', () => {
    const bad = { questions: [{ stem: '题一', options: ['A', '   ', 'C'] }, ok.questions[1]!] }
    expect(() => validateQuiz(bad, config)).toThrow(/第 1 题第 2 个选项为空/)
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

  it('选项超过字母表长度时退化为数字序号', () => {
    const text = formatQuiz('酱香工艺', [
      { stem: '题一', options: ['甲', '乙', '丙', '丁', '戊', '己', '庚'] },
    ])
    expect(text).toContain('F. 己')
    expect(text).toContain('7. 庚')
  })
})

describe('render', () => {
  it('渲染出题目正文与作答格式提示', () => {
    const definition = captureDefinition(new SessionStore(10))
    const blocks = definition.output.render(
      { questions: [] },
      {
        topic: '酱香工艺',
        questions: [{ stem: '题一', options: ['甲', '乙', '丙'] }],
      },
    )
    expect(blocks).toHaveLength(1)
    const text = (blocks[0] as { text: string }).text
    expect(text).toContain('1. 题一')
    expect(text).toContain('A. 甲')
    expect(text).toContain('请按 `1A 2B 3C` 的格式回复')
  })
})

describe('registerSubmitQuiz', () => {
  const args = {
    questions: [
      { stem: '题一', options: ['甲', '乙', '丙'] },
      { stem: '题二', options: ['甲', '乙', '丙'] },
    ],
  }

  it('没有关联会话时抛错', async () => {
    const definition = captureDefinition(new SessionStore(10))
    const { exec } = fakeExec(undefined)
    await expect(definition.execute(args, exec)).rejects.toThrow(/没有关联会话/)
  })

  it('会话没有教学状态时抛错', async () => {
    const definition = captureDefinition(new SessionStore(10))
    const { exec } = fakeExec('s1')
    await expect(definition.execute(args, exec)).rejects.toThrow(/没有教学状态/)
  })

  it('非出题阶段时抛错', async () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    const definition = captureDefinition(store)
    const { exec } = fakeExec('s1')
    await expect(definition.execute(args, exec)).rejects.toThrow(/不能提交题目/)
  })

  it('已有题目时抛重复提交错误', async () => {
    const store = new SessionStore(10)
    store.set(
      's1',
      noteQuiz(activate('酱香工艺'), {
        topic: '酱香工艺',
        questions: [{ stem: '旧题', options: ['甲', '乙', '丙'] }],
      }),
    )
    const definition = captureDefinition(store)
    const { exec } = fakeExec('s1')
    await expect(definition.execute(args, exec)).rejects.toThrow(/已经提交/)
  })

  it('出题阶段成功时写入题目并结束回合', async () => {
    const store = new SessionStore(10)
    store.set('s1', { ...activate('酱香工艺'), phase: 'quiz', quiz: null })
    const definition = captureDefinition(store)
    const { exec, concludeTurn } = fakeExec('s1')

    const value = await definition.execute(args, exec)

    expect(value).toEqual({ topic: '酱香工艺', questions: args.questions })
    expect(store.get('s1')?.quiz?.questions).toHaveLength(2)
    // 不能结束回合：没有助手消息的回合不会被渲染出工具行，卡片就看不见了。
    expect(concludeTurn).not.toHaveBeenCalled()
  })
})
