import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from '../config.js'
import { BAIJIU_SOURCE } from '../source.js'
import { noteGrade } from '../state.js'
import type { SessionStore } from '../store.js'

/** `submit_grade` 的参数。 */
export interface SubmitGradeArgs {
  readonly score: number
  readonly total: number
  readonly wrong: readonly { readonly index: number; readonly explanation: string }[]
  readonly weakPoint: string
}

/**
 * 校验批改结果。
 * @param args - 工具参数。
 * @param expectedTotal - 本卷题目数，来自已保存的测验。
 * @returns 校验通过的批改结果。
 * @throws 得分、题数、错题数、错题序号或解析不合法时抛出中文错误。
 */
export function validateGrade(args: SubmitGradeArgs, expectedTotal: number): SubmitGradeArgs {
  if (args.total !== expectedTotal) {
    throw new Error(`题数与试卷不符：试卷 ${expectedTotal} 题，提交 ${args.total} 题`)
  }
  if (!Number.isInteger(args.score) || args.score < 0 || args.score > args.total) {
    throw new Error(`得分必须是 0 到 ${args.total} 之间的整数，实际 ${args.score}`)
  }
  if (args.wrong.length !== args.total - args.score) {
    throw new Error(
      `错题数与得分不符：得 ${args.score} 分意味着 ${args.total - args.score} 道错题，实际提交 ${args.wrong.length} 条`,
    )
  }
  for (const item of args.wrong) {
    if (!Number.isInteger(item.index) || item.index < 1 || item.index > expectedTotal) {
      throw new Error(`错题序号越界：${item.index}`)
    }
    if (item.explanation.trim() === '') {
      throw new Error(`第 ${item.index} 题解析为空`)
    }
  }
  return args
}

/**
 * 渲染批改结果为面向用户的文本。
 * @param args - 批改结果。
 * @param topic - 主题。
 * @returns Markdown 文本。
 */
export function formatFeedback(args: SubmitGradeArgs, topic: string): string {
  const lines = [`### 📊 批改结果 · ${topic}`, '', `得分：**${args.score} / ${args.total}**`]
  if (args.wrong.length > 0) {
    lines.push('', '**错题解析**')
    for (const item of args.wrong) {
      lines.push(`- 第 ${item.index} 题：${item.explanation}`)
    }
  }
  if (args.weakPoint.trim() !== '') {
    lines.push('', `**薄弱知识点**：${args.weakPoint}`)
  }
  return lines.join('\n')
}

/**
 * 注册 `submit_grade` 工具，仅在批改态可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerSubmitGrade(ctx: Context, store: SessionStore, config: Config): void {
  ctx.tools.register(
    defineTool({
      name: 'submit_grade',
      description: '提交本次测验的批改结果：得分、错题解析与一个薄弱知识点。',
      parameters: {
        score: { type: 'integer', required: true, description: '答对题数' },
        total: { type: 'integer', required: true, description: '本卷题目总数' },
        wrong: {
          type: 'array',
          required: true,
          description: '错题列表，全对时传空数组',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', required: true, description: '题号，从 1 开始' },
              explanation: { type: 'string', required: true, description: '该题解析' },
            },
          },
        },
        weakPoint: {
          type: 'string',
          required: true,
          description: '学生最薄弱的一个知识点，不超过 10 字；未识别出时传空字符串',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topic: { type: 'string', required: true },
            score: { type: 'integer', required: true },
            total: { type: 'integer', required: true },
            weakPoint: { type: 'string', required: true },
          },
        },
        render: (args, value) => [
          {
            type: 'text',
            text: formatFeedback(
              {
                score: value.score,
                total: value.total,
                wrong: args.wrong,
                weakPoint: value.weakPoint,
              },
              // 旧会话日志回放时 topic 可能缺失，兜底为空串而不是渲染出 undefined。
              value.topic ?? '',
            ),
          },
        ],
      },
      execute: async (args, exec) => {
        if (!exec.agent) throw new Error('当前调用没有关联会话')
        const sessionId = exec.agent.id
        const state = store.get(sessionId)
        if (!state) throw new Error('当前会话没有教学状态，请先用 /learn <主题> 开始学习')
        if (state.phase !== 'grade' || !state.quiz) {
          throw new Error(`当前处于「${state.phase}」阶段，没有待批改的答卷`)
        }

        const graded = validateGrade(args, state.quiz.questions.length)
        store.set(sessionId, noteGrade(state, graded.weakPoint, config.maxWeakPoints))

        // 与 noteGrade 写入 focus 的值保持一致：统一用 trim 后的薄弱点。
        const point = graded.weakPoint.trim()
        const ask = point
          ? `请针对学生的薄弱点「${point}」重新讲解一遍，讲得比上次更细。`
          : `请针对「${state.topic}」的核心要点再梳理一遍，帮助学生巩固。`
        exec.deferContext(
          createUserMessage({ content: [{ type: 'text', text: ask }], source: BAIJIU_SOURCE }),
        )

        return {
          topic: state.topic,
          score: graded.score,
          total: graded.total,
          weakPoint: graded.weakPoint,
        }
      },
    }),
  )
}
