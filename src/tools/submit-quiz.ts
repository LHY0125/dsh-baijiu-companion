import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-questions'
import type { AnsweredQuestion, QuizAsker } from '../ask.js'
import { askQuiz, formatAnswers } from '../ask.js'
import type { Config } from '../config.js'
import { optionLabel } from '../options.js'
import type { Quiz, QuizQuestion } from '../state.js'
import { enterGrade, noteQuiz } from '../state.js'
import type { SessionStore } from '../store.js'

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
 * @throws 题目数、选项数、题干或选项为空时抛出带中文说明的错误。
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
    const options = question.options.map((option, optionIndex) => {
      const trimmed = option.trim()
      if (trimmed === '') {
        throw new Error(`第 ${index + 1} 题第 ${optionIndex + 1} 个选项为空`)
      }
      return trimmed
    })
    return { stem: question.stem.trim(), options }
  })
}

/**
 * 把题目渲染成给用户看的文本。
 * @param topic - 主题。
 * @param questions - 题目列表。
 * @param answerLine - 学生已有的作答；省略时提示文字作答。
 * @returns Markdown 文本。
 */
export function formatQuiz(
  topic: string,
  questions: readonly QuizQuestion[],
  answerLine?: string,
): string {
  const body = questions
    .map((question, index) => {
      const options = question.options
        .map((option, optionIndex) => optionLabel(optionIndex, option))
        .join('\n')
      return `${index + 1}. ${question.stem}\n${options}`
    })
    .join('\n\n')
  const tail = answerLine === undefined || answerLine === ''
    ? '请按 `1A 2B 3C` 的格式回复你的答案。'
    : `学生已点选作答：${answerLine}`
  return `### 📝 随堂测验 · ${topic}\n\n${body}\n\n---\n${tail}`
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
      description:
        '提交本次测验的题目。只提交题干与选项，不要提交任何答案。'
        + '工具会把题目弹出成可点选的卡片让学生作答，返回值里带回学生的作答。',
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
            questions: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  stem: { type: 'string', required: true },
                  options: { type: 'array', required: true, items: { type: 'string' } },
                },
              },
            },
            answers: {
              type: 'array',
              required: true,
              description: '学生在点选卡片上给出的作答；为空表示学生没在卡片上作答',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  index: { type: 'integer', required: true },
                  letter: { type: 'string', required: true },
                  custom: { type: 'string', required: true },
                },
              },
            },
            answerLine: {
              type: 'string',
              required: true,
              description: '形如 "1A 2B 3C"；空串表示学生没在卡片上作答，需请学生用文字作答',
            },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: formatQuiz(value.topic, value.questions, value.answerLine),
        }],
      },
      execute: async (args, exec) => {
        const agent = exec.agent
        if (!agent) throw new Error('当前调用没有关联会话')
        const state = store.get(agent.id)
        if (!state) throw new Error('当前会话没有教学状态，请先用 /learn <主题> 开始学习')
        if (state.phase !== 'quiz') {
          throw new Error(`当前处于「${state.phase}」阶段，不能提交题目`)
        }
        if (state.quiz !== null) {
          throw new Error('本次测验的题目已经提交，请等待学生作答')
        }
        const quiz: Quiz = { topic: state.topic, questions: validateQuiz(args, config) }
        store.set(agent.id, noteQuiz(state, quiz))
        // 刻意不调用 exec.concludeTurn()：没有助手消息的回合不会被渲染出工具行，
        // 卡片就没有落点（实测卡片仍在 DOM 但行高被折叠为 0，用户看不到题目）。
        const asker = ctx.get('userQuestions') as QuizAsker | undefined
        const answered = asker === undefined ? null : await askQuiz(asker, agent, quiz, exec.signal)
        const payload = quiz.questions.map(question => ({
          stem: question.stem,
          options: [...question.options],
        }))
        if (answered === null) {
          // 没有点选卡片（终端、学生取消、宿主未装答题者）：退回文字作答，
          // 阶段停在出题态，等学生发言后由路由推进到批改态。
          return { topic: quiz.topic, questions: payload, answers: [] as AnsweredQuestion[], answerLine: '' }
        }
        // 学生已经在卡片上作答，没有用户消息经过路由，阶段由这里推进。
        const current = store.get(agent.id)
        if (current !== undefined) store.set(agent.id, enterGrade(current))
        return {
          topic: quiz.topic,
          questions: payload,
          // 只交回 schema 声明过的字段：运行时会对 canonical value 做
          // additionalProperties 校验，多带一个 optionIndex 就直接抛错。
          answers: answered.map(item => ({
            index: item.index,
            letter: item.letter,
            custom: item.custom,
          })),
          answerLine: formatAnswers(answered),
        }
      },
    }),
  )
}
