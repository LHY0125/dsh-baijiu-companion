import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Config } from '../config.js'
import type { QuizQuestion } from '../state.js'
import { noteQuiz } from '../state.js'
import type { SessionStore } from '../store.js'

/** 题目选项字母表，供渲染作答格式使用。 */
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** `submit_quiz` 的参数。 */
export interface SubmitQuizArgs {
  readonly questions: readonly {
    readonly stem: string
    readonly options: readonly string[]
  }[]
}

/**
 * 校验模型提交的题目。
 * @param args - 工具参数。
 * @param config - 插件配置，提供题数与选项数约束。
 * @returns 校验通过的题目列表。
 * @throws 题目数、选项数或题干不合法时抛出带中文说明的错误。
 */
export function validateQuiz(args: SubmitQuizArgs, config: Config): QuizQuestion[] {
  if (args.questions.length !== config.questionCount) {
    throw new Error(`题目数必须为 ${config.questionCount}，实际 ${args.questions.length}`)
  }
  return args.questions.map((question, index) => {
    if (question.stem.trim() === '') {
      throw new Error(`第 ${index + 1} 题题干为空`)
    }
    if (question.options.length !== config.optionsPerQuestion) {
      throw new Error(
        `第 ${index + 1} 题选项数必须为 ${config.optionsPerQuestion}，实际 ${question.options.length}`,
      )
    }
    return { stem: question.stem.trim(), options: question.options.map(o => o.trim()) }
  })
}

/**
 * 把题目渲染成给用户看的文本。
 * @param topic - 主题。
 * @param questions - 题目列表。
 * @returns Markdown 文本，末行附作答格式。
 */
export function formatQuiz(topic: string, questions: readonly QuizQuestion[]): string {
  const body = questions
    .map((question, index) => {
      const options = question.options
        .map((option, optionIndex) => `${OPTION_LETTERS[optionIndex]}. ${option}`)
        .join('\n')
      return `${index + 1}. ${question.stem}\n${options}`
    })
    .join('\n\n')
  return `### 📝 随堂测验 · ${topic}\n\n${body}\n\n---\n请按 \`1A 2B 3C\` 的格式回复你的答案。`
}

/**
 * 注册 `submit_quiz` 工具，仅在"出题态且尚无题目"时可执行。
 * @param ctx - Cordis 上下文。
 * @param store - 会话状态表。
 * @param config - 插件配置。
 */
export function registerSubmitQuiz(ctx: Context, store: SessionStore, config: Config): void {
  ctx.tools.register(
    defineTool({
      name: 'submit_quiz',
      description: '提交本次测验的题目。只提交题干与选项，不要提交任何答案。',
      parameters: {
        questions: {
          type: 'array',
          required: true,
          description: `题目列表，必须正好 ${config.questionCount} 道`,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              stem: { type: 'string', required: true, description: '题干' },
              options: {
                type: 'array',
                required: true,
                description: `选项列表，必须正好 ${config.optionsPerQuestion} 项`,
                items: { type: 'string' },
              },
            },
          },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            topic: { type: 'string', required: true },
            questionCount: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => [
          { type: 'text', text: `已提交 ${value.questionCount} 道题，主题「${value.topic}」。` },
        ],
      },
      execute: async (args, exec) => {
        const agent = exec.agent
        if (!agent) throw new Error('当前调用没有关联会话')
        const state = store.get(agent.id)
        if (!state) throw new Error('当前会话没有教学状态，请先用 /learn <主题> 开始学习')
        if (state.phase !== 'quiz' || state.quiz !== null) {
          throw new Error(`当前处于「${state.phase}」阶段，不能提交题目`)
        }
        const questions = validateQuiz(args, config)
        store.set(agent.id, noteQuiz(state, { topic: state.topic, questions }))
        exec.concludeTurn()
        return { topic: state.topic, questionCount: questions.length }
      },
    }),
  )
}
