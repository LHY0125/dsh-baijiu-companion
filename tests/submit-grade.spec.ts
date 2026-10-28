import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import { describe, expect, it, vi } from 'vitest'
import { activate } from '../src/state.js'
import { SessionStore } from '../src/store.js'
import { formatFeedback, registerSubmitGrade, validateGrade } from '../src/tools/submit-grade.js'

const config = {
  topics: ['酱香工艺'],
  defaultTopic: '白酒基础知识',
  questionCount: 3,
  optionsPerQuestion: 4,
  maxWeakPoints: 5,
  maxSessions: 200,
  reminderMaxAttempts: 1,
}

const ok = {
  score: 2,
  total: 3,
  wrong: [{ index: 2, explanation: '堆积温度记成了低温' }],
  weakPoint: '高温堆积发酵',
}

describe('validateGrade', () => {
  it('合法输入原样返回', () => {
    expect(validateGrade(ok, 3).weakPoint).toBe('高温堆积发酵')
  })

  it('得分超过总分时抛错', () => {
    expect(() => validateGrade({ ...ok, score: 4 }, 3)).toThrow(/得分/)
  })

  it('负分抛错', () => {
    expect(() => validateGrade({ ...ok, score: -1 }, 3)).toThrow(/得分/)
  })

  it('题数对不上时抛错', () => {
    expect(() => validateGrade(ok, 5)).toThrow(/题数/)
  })

  it('错题序号越界时抛错', () => {
    expect(() =>
      validateGrade({ ...ok, score: 2, wrong: [{ index: 9, explanation: 'x' }] }, 3),
    ).toThrow(/序号/)
  })

  it('错题数与得分不符时抛错', () => {
    expect(() => validateGrade({ ...ok, score: 2, wrong: [] }, 3)).toThrow(/错题数/)
  })

  it('解析为空时抛错', () => {
    expect(() =>
      validateGrade({ ...ok, wrong: [{ index: 2, explanation: '   ' }] }, 3),
    ).toThrow(/解析为空/)
  })
})

describe('formatFeedback', () => {
  it('渲染得分、错题解析与薄弱点', () => {
    const text = formatFeedback(ok, '酱香工艺')
    expect(text).toContain('2 / 3')
    expect(text).toContain('第 2 题')
    expect(text).toContain('堆积温度记成了低温')
    expect(text).toContain('高温堆积发酵')
  })

  it('无错题时不渲染错题段落', () => {
    const text = formatFeedback({ score: 3, total: 3, wrong: [], weakPoint: '' }, '酱香工艺')
    expect(text).not.toContain('错题解析')
  })
})

describe('render', () => {
  it('渲染得分与逐题解析', () => {
    const definition = captureDefinition(new SessionStore(10))
    const blocks = definition.output.render(ok, {
      topic: '酱香工艺',
      score: 2,
      total: 3,
      weakPoint: '高温堆积发酵',
    })
    expect(blocks).toHaveLength(1)
    const text = (blocks[0] as { text: string }).text
    expect(text).toContain('2 / 3')
    expect(text).toContain('堆积温度记成了低温')
    expect(text).toContain('高温堆积发酵')
  })

  it('旧日志缺 topic 时不渲染出 undefined', () => {
    const definition = captureDefinition(new SessionStore(10))
    const blocks = definition.output.render(ok, { score: 2, total: 3, weakPoint: '' })
    const text = (blocks[0] as { text: string }).text
    expect(text).not.toContain('undefined')
  })
})

/**
 * 用一个假 ctx 捕获 `registerSubmitGrade` 注册的工具定义。
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
  registerSubmitGrade(ctx, store, config)
  if (captured === undefined) throw new Error('未捕获到工具定义')
  return captured
}

/**
 * 造一个假的执行上下文。
 * @param sessionId - 关联会话 id；传 undefined 表示没有关联会话。
 * @returns 执行上下文与 `deferContext` 的替身。
 */
function fakeExec(sessionId: string | undefined): {
  exec: ToolRunContext
  deferContext: ReturnType<typeof vi.fn>
} {
  const deferContext = vi.fn()
  const exec = {
    agent: sessionId === undefined ? undefined : { id: sessionId },
    deferContext,
  } as unknown as ToolRunContext
  return { exec, deferContext }
}

/** 造一个处于批改态、带三题试卷的会话状态。 */
function gradeState() {
  return {
    ...activate('酱香工艺'),
    phase: 'grade' as const,
    quiz: {
      topic: '酱香工艺',
      questions: [
        { stem: '题一', options: ['甲', '乙', '丙', '丁'] },
        { stem: '题二', options: ['甲', '乙', '丙', '丁'] },
        { stem: '题三', options: ['甲', '乙', '丙', '丁'] },
      ],
    },
  }
}

describe('registerSubmitGrade', () => {
  it('没有关联会话时抛错', async () => {
    const definition = captureDefinition(new SessionStore(10))
    const { exec } = fakeExec(undefined)
    await expect(definition.execute(ok, exec)).rejects.toThrow(/没有关联会话/)
  })

  it('会话没有教学状态时抛错', async () => {
    const definition = captureDefinition(new SessionStore(10))
    const { exec } = fakeExec('s1')
    await expect(definition.execute(ok, exec)).rejects.toThrow(/没有教学状态/)
  })

  it('非批改阶段时抛错', async () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    const definition = captureDefinition(store)
    const { exec } = fakeExec('s1')
    await expect(definition.execute(ok, exec)).rejects.toThrow(/没有待批改的答卷/)
  })

  it('批改成功时写入补学态并投递补学上下文', async () => {
    const store = new SessionStore(10)
    store.set('s1', gradeState())
    const definition = captureDefinition(store)
    const { exec, deferContext } = fakeExec('s1')

    const value = await definition.execute(ok, exec)

    expect(value).toEqual({
      topic: '酱香工艺',
      score: 2,
      total: 3,
      weakPoint: '高温堆积发酵',
    })
    const state = store.get('s1')
    expect(state?.phase).toBe('remedial')
    expect(state?.quiz).toBeNull()
    expect(state?.weakPoints).toEqual(['高温堆积发酵'])
    expect(deferContext).toHaveBeenCalledTimes(1)
    const message = deferContext.mock.calls[0]![0] as { role: string; source: { kind: string } }
    expect(message.role).toBe('user')
    expect(message.source.kind).toBe('baijiu')
  })

  it('未识别出薄弱点时投递复习原主题的上下文', async () => {
    const store = new SessionStore(10)
    store.set('s1', gradeState())
    const definition = captureDefinition(store)
    const { exec, deferContext } = fakeExec('s1')

    await definition.execute({ score: 3, total: 3, wrong: [], weakPoint: '' }, exec)

    const message = deferContext.mock.calls[0]![0] as {
      content: readonly { type: string; text: string }[]
    }
    expect(message.content[0]?.text).toContain('酱香工艺')
  })

  it('有薄弱点时投递包含该薄弱点的补学请求，且前后空白不进入文本', async () => {
    const store = new SessionStore(10)
    store.set('s1', gradeState())
    const definition = captureDefinition(store)
    const { exec, deferContext } = fakeExec('s1')

    await definition.execute({ ...ok, weakPoint: '  高温堆积发酵  ' }, exec)

    const message = deferContext.mock.calls[0]![0] as {
      content: readonly { type: string; text: string }[]
    }
    expect(message.content[0]?.text).toContain('「高温堆积发酵」')
  })
})
