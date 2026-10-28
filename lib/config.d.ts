import Schema from '@deepseek-ai/schemastery';
/** 插件配置，全部字段可在 cordis.patch.yml 覆盖。 */
export interface Config {
    /** 预设主题列表。 */
    topics: string[];
    /** 未选择主题时的兜底主题。 */
    defaultTopic: string;
    /** 每次测验的题目数。 */
    questionCount: number;
    /** 每题的选项数。 */
    optionsPerQuestion: number;
    /** 弱点列表保留上限。 */
    maxWeakPoints: number;
    /** 会话状态表的 LRU 上限。 */
    maxSessions: number;
    /** 模型未按工具调用格式输出时的提醒次数上限。 */
    reminderMaxAttempts: number;
}
/** 配置校验 schema，非法配置在插件加载时直接失败。 */
export declare const Config: Schema<Config>;
