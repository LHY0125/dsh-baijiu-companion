import type { LearningState } from './state.js';
/**
 * 按会话保存教学状态的 LRU 表。
 * Map 的插入顺序即访问顺序：每次读取都把键移到队尾，超限时淘汰队首。
 */
export declare class SessionStore {
    private readonly maxSessions;
    private readonly states;
    /**
     * @param maxSessions - 保留的会话数上限，必须为正数。
     */
    constructor(maxSessions: number);
    /**
     * 读取一个会话的状态，并把它标记为最近使用。
     * @param id - 会话 id。
     * @returns 状态；该会话未被接管时返回 undefined。
     */
    get(id: string): LearningState | undefined;
    /**
     * 写入一个会话的状态。
     * @param id - 会话 id。
     * @param state - 新状态。
     */
    set(id: string, state: LearningState): void;
    /**
     * 删除一个会话的状态。
     * @param id - 会话 id。
     */
    delete(id: string): void;
    /** 当前被接管的会话数。 */
    get size(): number;
}
