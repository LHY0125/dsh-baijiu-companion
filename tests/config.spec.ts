import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.js'

describe('Config schema', () => {
  it('缺省时填入全部默认值', () => {
    const config = Config({})
    expect(config.topics).toEqual(['酱香工艺', '浓香品鉴', '白酒文化'])
    expect(config.defaultTopic).toBe('白酒基础知识')
    expect(config.questionCount).toBe(3)
    expect(config.optionsPerQuestion).toBe(4)
    expect(config.maxWeakPoints).toBe(5)
    expect(config.maxSessions).toBe(200)
    expect(config.reminderMaxAttempts).toBe(1)
  })

  it('题目为 0 时配置校验失败', () => {
    expect(() => Config({ questionCount: 0 })).toThrow()
  })

  it('选项数小于 2 时配置校验失败', () => {
    expect(() => Config({ optionsPerQuestion: 1 })).toThrow()
  })
})
