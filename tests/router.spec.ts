import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { registerRouter } from '../src/router.js'
import { activate, enterQuiz, noteGrade, noteQuiz } from '../src/state.js'
import { SessionStore } from '../src/store.js'

/** 路由器只读取 content 与 source，测试消息按最小形状构造。 */
interface TestMessage {
  readonly content: readonly { readonly type: string; readonly text?: string }[]
  readonly source: { readonly kind: string }
}

/** pre-step 载荷的最小形状。 */
interface PreStepPayload {
  readonly agent: { readonly id: string }
  readonly messages: TestMessage[]
}

type PreStepListener = (
  payload: PreStepPayload,
  next: () => Promise<unknown>,
) => Promise<unknown>

type SessionEventListener = (
  session: { readonly id: string },
  event: { readonly type: string },
) => void

/** `next()` 的固定返回值，用于断言引用透传。 */
const DECISION = { kind: 'enter', messages: [] }

/**
 * 用假 ctx 捕获 `registerRouter` 注册的两条监听器。
 * @param store - 传给注册函数的会话状态表。
 * @returns 捕获到的 pre-step 与 session/event 监听器。
 */
function capture(store: SessionStore): {
  preStep: PreStepListener
  sessionEvent: SessionEventListener
} {
  const captured = new Map<string, unknown>()
  const ctx = {
    on: (name: string, listener: unknown) => {
      captured.set(name, listener)
      return () => true
    },
  } as unknown as Context
  registerRouter(ctx, store)

  const preStep = captured.get('agent/pre-step')
  const sessionEvent = captured.get('session/event')
  if (typeof preStep !== 'function' || typeof sessionEvent !== 'function') {
    throw new Error('未捕获到 pre-step 或 session/event 监听器')
  }
  return {
    preStep: preStep as PreStepListener,
    sessionEvent: sessionEvent as SessionEventListener,
  }
}

/**
 * 造一条带来源标记的消息。
 * @param kind - 消息来源种类。
 * @param text - 正文；传 null 表示只有非文本块。
 * @returns 测试消息。
 */
function msg(kind: string, text: string | null): TestMessage {
  return {
    content: text === null ? [{ type: 'image' }] : [{ type: 'text', text }],
    source: { kind },
  }
}

/**
 * 驱动一次 pre-step。
 * @param listeners - 捕获到的监听器。
 * @param sessionId - 会话 id。
 * @param messages - 本批认领的消息。
 * @returns `next()` 的返回值与调用次数。
 */
async function runPreStep(
  listeners: { preStep: PreStepListener },
  sessionId: string,
  messages: TestMessage[],
): Promise<{ returned: unknown; nextCalls: number }> {
  let nextCalls = 0
  const next = () => {
    nextCalls += 1
    return Promise.resolve(DECISION)
  }
  const returned = await listeners.preStep({ agent: { id: sessionId }, messages }, next)
  return { returned, nextCalls }
}

describe('registerRouter / agent/pre-step', () => {
  it('没有教学状态时仍调用 next()，且不写入状态', async () => {
    const store = new SessionStore(10)
    const listeners = capture(store)

    const { nextCalls } = await runPreStep(listeners, 'none', [msg('user', '你好')])

    expect(nextCalls).toBe(1)
    expect(store.get('none')).toBeUndefined()
    expect(store.size).toBe(0)
  })

  it('explain 态收到人类消息后迁移到 qa，并用该消息重算摘要', async () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    const listeners = capture(store)

    const { nextCalls } = await runPreStep(listeners, 's1', [msg('user', '为什么要高温堆积？')])

    expect(nextCalls).toBe(1)
    expect(store.get('s1')?.phase).toBe('qa')
    expect(store.get('s1')?.summary).toContain('为什么要高温堆积？')
  })

  it('quiz 态且已有题目时收到人类消息迁移到 grade', async () => {
    const store = new SessionStore(10)
    const quiz = noteQuiz(enterQuiz(activate('酱香工艺')), {
      topic: '酱香工艺',
      questions: [{ stem: '题', options: ['A', 'B'] }],
    })
    store.set('s2', quiz)
    const listeners = capture(store)

    await runPreStep(listeners, 's2', [msg('user', '1A 2B')])

    expect(store.get('s2')?.phase).toBe('grade')
  })

  it('插件自己的 baijiu 消息不触发迁移', async () => {
    const store = new SessionStore(10)
    store.set('s3', activate('浓香品鉴'))
    const listeners = capture(store)

    await runPreStep(listeners, 's3', [msg('baijiu', '请开始讲解「浓香品鉴」。')])

    expect(store.get('s3')?.phase).toBe('explain')
    expect(store.get('s3')?.summary).not.toContain('请开始讲解')
  })

  it.each(['user-approval', 'skill-invocation', 'goal', 'schedule', 'webhook'])(
    '注入型来源 %s 不触发迁移',
    async kind => {
      const store = new SessionStore(10)
      store.set('s4', activate('酱香工艺'))
      const listeners = capture(store)

      await runPreStep(listeners, 's4', [msg(kind, '宿主注入的上下文')])

      expect(store.get('s4')?.phase).toBe('explain')
      expect(store.get('s4')?.summary).not.toContain('宿主注入的上下文')
    },
  )

  it('同一批多条消息时取最后一条人类消息', async () => {
    const store = new SessionStore(10)
    store.set('s5', activate('酱香工艺'))
    const listeners = capture(store)

    await runPreStep(listeners, 's5', [
      msg('baijiu', '插件投递的启动消息'),
      msg('user', '第一条人类消息'),
      msg('user-approval', '审批注入'),
      msg('user', '最后一条人类消息'),
    ])

    const state = store.get('s5')
    expect(state?.phase).toBe('qa')
    expect(state?.summary).toContain('最后一条人类消息')
    expect(state?.summary).not.toContain('第一条人类消息')
  })

  it('只有非文本块的人类消息不触发迁移', async () => {
    const store = new SessionStore(10)
    store.set('s6', activate('酱香工艺'))
    const listeners = capture(store)

    await runPreStep(listeners, 's6', [msg('user', null)])

    expect(store.get('s6')?.phase).toBe('explain')
  })

  it('next() 的返回值原样透传（同一引用）', async () => {
    const store = new SessionStore(10)
    store.set('s7', activate('酱香工艺'))
    const listeners = capture(store)

    const { returned } = await runPreStep(listeners, 's7', [msg('user', '嗨')])

    expect(returned).toBe(DECISION)
  })

  it('pre-step 前后 payload.messages 逐字节未变', async () => {
    const store = new SessionStore(10)
    store.set('s8', activate('酱香工艺'))
    const listeners = capture(store)
    const messages = [msg('user', '  原样保留  ')]
    const before = JSON.stringify(messages)

    await runPreStep(listeners, 's8', messages)

    expect(JSON.stringify(messages)).toBe(before)
  })
})

describe('registerRouter / session/event', () => {
  it('turn/end 把 remedial 改回 explain', () => {
    const store = new SessionStore(10)
    store.set('t1', noteGrade(activate('酱香工艺'), '高温堆积', 5))
    const listeners = capture(store)
    expect(store.get('t1')?.phase).toBe('remedial')

    listeners.sessionEvent({ id: 't1' }, { type: 'turn/end' })

    expect(store.get('t1')?.phase).toBe('explain')
  })

  it('turn/end 对非 remedial 阶段保持同一引用', () => {
    const store = new SessionStore(10)
    const explain = activate('酱香工艺')
    store.set('t2', explain)
    const listeners = capture(store)

    listeners.sessionEvent({ id: 't2' }, { type: 'turn/end' })

    expect(store.get('t2')).toBe(explain)
  })

  it('非 turn/end 事件不触发迁移', () => {
    const store = new SessionStore(10)
    store.set('t3', noteGrade(activate('酱香工艺'), '高温堆积', 5))
    const listeners = capture(store)

    listeners.sessionEvent({ id: 't3' }, { type: 'step/end' })

    expect(store.get('t3')?.phase).toBe('remedial')
  })

  it('没有教学状态时 turn/end 不抛错也不写入', () => {
    const store = new SessionStore(10)
    const listeners = capture(store)

    expect(() => listeners.sessionEvent({ id: 'ghost' }, { type: 'turn/end' })).not.toThrow()
    expect(store.size).toBe(0)
  })
})
