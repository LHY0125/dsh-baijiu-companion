import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.js'
import { apply } from '../src/index.js'

/**
 * 装配一个假 ctx，记录 `apply` 注册的每一类贡献。
 * @returns 记录容器与可传给 `apply` 的上下文。
 */
function fakeContext(): {
  ctx: Context
  tools: string[]
  commands: string[]
  sections: { name: string; interpolate?: boolean }[]
  events: string[]
} {
  const tools: string[] = []
  const commands: string[] = []
  const sections: { name: string; interpolate?: boolean }[] = []
  const events: string[] = []
  const ctx = {
    tools: {
      register: (definition: ToolDefinition) => {
        tools.push(definition.name)
        return () => {}
      },
    },
    commands: {
      register: (definition: { name: string }) => {
        commands.push(definition.name)
        return () => {}
      },
    },
    systemPrompt: {
      section: (section: { name: string; interpolate?: boolean }) => {
        sections.push({ name: section.name, interpolate: section.interpolate })
        return () => {}
      },
    },
    on: (event: string) => {
      events.push(event)
      return () => {}
    },
    agents: { get: () => undefined },
  } as unknown as Context
  return { ctx, tools, commands, sections, events }
}

describe('apply 装配', () => {
  it('注册两个工具，名字固定', () => {
    const { ctx, tools } = fakeContext()
    apply(ctx, Config({}))
    expect(tools.sort()).toEqual(['submit_grade', 'submit_quiz'])
  })

  it('注册四个命令，名字固定', () => {
    const { ctx, commands } = fakeContext()
    apply(ctx, Config({}))
    expect(commands.sort()).toEqual(['learn', 'quiz', 'reset', 'status'])
  })

  it('注册一个提示段并关闭模板插值', () => {
    const { ctx, sections } = fakeContext()
    apply(ctx, Config({}))
    expect(sections).toEqual([{ name: 'baijiu:state', interpolate: false }])
  })

  it('注册 pre-step 与两个 session/event 监听（router 与 reminder）', () => {
    const { ctx, events } = fakeContext()
    apply(ctx, Config({}))
    expect(events.sort()).toEqual(['agent/pre-step', 'session/event', 'session/event'])
  })

  it('装配过程不抛错', () => {
    const { ctx } = fakeContext()
    expect(() => apply(ctx, Config({}))).not.toThrow()
  })
})
