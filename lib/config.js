import Schema from '@deepseek-ai/schemastery';
/** 配置校验 schema，非法配置在插件加载时直接失败。 */
export const Config = Schema.object({
    topics: Schema.array(String).default(['酱香工艺', '浓香品鉴', '白酒文化']),
    defaultTopic: Schema.string().min(1).default('白酒基础知识'),
    questionCount: Schema.number().min(1).max(10).step(1).default(3),
    optionsPerQuestion: Schema.number().min(2).max(6).step(1).default(4),
    maxWeakPoints: Schema.number().min(1).step(1).default(5),
    maxSessions: Schema.number().min(1).step(1).default(200),
    reminderMaxAttempts: Schema.number().min(0).step(1).default(1),
});
