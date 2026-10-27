import type { LearningState } from './state.js'

/**
 * 按会话保存教学状态的 LRU 表。
 * Map 的插入顺序即访问顺序：每次读取都把键移到队尾，超限时淘汰队首。
 */
export class SessionStore {
  private readonly states = new Map<string, LearningState>()

  /**
   * @param maxSessions - 保留的会话数上限，必须为正数。
   */
  constructor(private readonly maxSessions: number) {
    if (!Number.isInteger(maxSessions) || maxSessions < 1) {
      throw new RangeError(`maxSessions 必须是正整数，收到 ${maxSessions}`)
    }
  }

  /**
   * 读取一个会话的状态，并把它标记为最近使用。
   * @param id - 会话 id。
   * @returns 状态；该会话未被接管时返回 undefined。
   */
  get(id: string): LearningState | undefined {
    const state = this.states.get(id)
    if (state === undefined) return undefined
    this.states.delete(id)
    this.states.set(id, state)
    return state
  }

  /**
   * 写入一个会话的状态。
   * @param id - 会话 id。
   * @param state - 新状态。
   */
  set(id: string, state: LearningState): void {
    this.states.delete(id)
    this.states.set(id, state)
    while (this.states.size > this.maxSessions) {
      const oldest = this.states.keys().next()
      if (oldest.done) break
      this.states.delete(oldest.value)
    }
  }

  /**
   * 删除一个会话的状态。
   * @param id - 会话 id。
   */
  delete(id: string): void {
    this.states.delete(id)
  }

  /** 当前被接管的会话数。 */
  get size(): number {
    return this.states.size
  }
}
