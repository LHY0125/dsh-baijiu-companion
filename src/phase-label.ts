import type { Phase } from './state.js'

/** 阶段的中文名称，供命令与 system 提示段共用。 */
export const PHASE_LABELS: Record<Phase, string> = {
  explain: '讲解中',
  qa: '答疑中',
  quiz: '出题中',
  grade: '批改中',
  remedial: '补学中',
}
