import { describe, expect, it } from 'vitest'
import { activate } from '../src/state.js'
import { SessionStore } from '../src/store.js'

describe('SessionStore', () => {
  it('写入后可读出同一状态', () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    expect(store.get('s1')?.topic).toBe('酱香工艺')
  })

  it('未写入的会话返回 undefined', () => {
    expect(new SessionStore(10).get('missing')).toBeUndefined()
  })

  it('删除后不可读', () => {
    const store = new SessionStore(10)
    store.set('s1', activate('酱香工艺'))
    store.delete('s1')
    expect(store.get('s1')).toBeUndefined()
  })

  it('超出上限时淘汰最久未访问的会话', () => {
    const store = new SessionStore(2)
    store.set('a', activate('甲'))
    store.set('b', activate('乙'))
    store.get('a')
    store.set('c', activate('丙'))
    expect(store.get('b')).toBeUndefined()
    expect(store.get('a')?.topic).toBe('甲')
    expect(store.get('c')?.topic).toBe('丙')
  })
})
