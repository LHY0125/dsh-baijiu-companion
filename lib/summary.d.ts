/**
 * 用代码拼出一句话上下文摘要，不发起模型请求。
 * @param topic - 当前学习主题。
 * @param focus - 当前补学聚焦点，空串表示无。
 * @param question - 本轮学生提问。
 * @returns 可直接注入 system 提示的摘要句。
 */
export declare function composeSummary(topic: string, focus: string, question: string): string;
