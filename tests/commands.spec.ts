import { describe, expect, it } from 'vitest'
import { topicsHint } from '../src/commands.js'
import { Config } from '../src/config.js'

describe('topicsHint', () => {
  it('有预设主题时列出全部主题', () => {
    const config = Config({})
    const hint = topicsHint(config)
    for (const topic of config.topics) expect(hint).toContain(topic)
    expect(hint).toContain('可选主题')
  })

  it('主题列表为空时返回空串', () => {
    expect(topicsHint({ ...Config({}), topics: [] })).toBe('')
  })
})
