/**
 * 建书前强制关卡的共享定义（8.4.4）：市场、输出形态、目标总字数三项，建书前必须问作者拿到答案。
 *
 * 本模块只放纯数据与校验，不碰文件系统——书房面板客户端（浏览器 bundle）与服务端共用。
 * 文件读写见 ./onboarding-store（仅服务端）。
 */

/**
 * 取值表与校验函数在本文件内定义，不从 `@webnovel/core` 引值：`@webnovel/core`
 * 的包根索引会把带 node 导入的核心模块一并拉进来，浏览器 bundle 打包失败
 * （platform browser 解析不了 node:fs/node:crypto）。取值必须与
 * `packages/core/src/repo/document-fields.ts` 的 MARKET_VALUES /
 * OUTPUT_FORM_VALUES 保持一致，onboarding-gate.spec.ts 会断言两边相同。
 */
export const MARKET_VALUES = ['海外', '中文'] as const
export type Market = (typeof MARKET_VALUES)[number]
export const OUTPUT_FORM_VALUES = ['短剧', '电影剧本', '小说'] as const
export type OutputForm = (typeof OUTPUT_FORM_VALUES)[number]

/** 校验市场 / 输出形态字段值是否合法（单行文本且在取值表内）。 */
export function isMarketValue(value: unknown): value is Market {
  return typeof value === 'string' && (MARKET_VALUES as readonly string[]).includes(value)
}
export function isOutputFormValue(value: unknown): value is OutputForm {
  return typeof value === 'string' && (OUTPUT_FORM_VALUES as readonly string[]).includes(value)
}

/** 待建书草稿在工作范围内的相对路径（书房面板向导保存、novel_create_book 读取）。 */
export const ONBOARDING_DRAFT_RELATIVE = '书房/构想/_待建书.json'

export interface OnboardingAnswers {
  readonly 市场?: Market
  readonly 输出形态?: OutputForm
  /** 目标总字数（汉字数，正整数）。 */
  readonly 目标总字数?: number
}

/** 字数档位：点一下就选；手动输入走数字框。长篇 100 万字为推荐/默认档。 */
export interface WordCountTier {
  readonly id: string
  readonly label: string
  /** 该档代表的目标总字数（汉字数）。 */
  readonly words: number
  readonly hint: string
  readonly recommended?: boolean
}

export const WORD_COUNT_TIERS: readonly WordCountTier[] = [
  { id: 'short', label: '短篇', words: 50000, hint: '约 5 万字' },
  { id: 'medium', label: '中篇', words: 300000, hint: '约 30 万字' },
  { id: 'long', label: '长篇', words: 1000000, hint: '约 100 万字', recommended: true },
  { id: 'epic', label: '超长篇', words: 2000000, hint: '约 200 万字' },
]

/** “就按默认来”时的目标总字数（长篇 100 万字）。只在作者明确说按默认时用，绝不静默套用。 */
export const DEFAULT_TARGET_TOTAL_WORDS = 1000000

export const DEFAULT_MARKET_ANSWER: Market = '中文'
export const DEFAULT_OUTPUT_FORM_ANSWER: OutputForm = '小说'

export const DEFAULT_ONBOARDING_ANSWERS: Required<OnboardingAnswers> = {
  市场: DEFAULT_MARKET_ANSWER,
  输出形态: DEFAULT_OUTPUT_FORM_ANSWER,
  目标总字数: DEFAULT_TARGET_TOTAL_WORDS,
}

/** 校验一组向导答案：只认合法值，其余一律视为未填（不编默认值、不抛错）。 */
export function validateOnboardingAnswers(value: unknown): OnboardingAnswers {
  if (value === null || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  const out: { 市场?: Market; 输出形态?: OutputForm; 目标总字数?: number } = {}
  if (isMarketValue(record['市场'])) out.市场 = record['市场']
  if (isOutputFormValue(record['输出形态'])) out.输出形态 = record['输出形态']
  if (typeof record['目标总字数'] === 'number' && Number.isSafeInteger(record['目标总字数']) && record['目标总字数'] > 0) {
    out.目标总字数 = record['目标总字数']
  }
  return out
}

/** 三项是否齐全（缺任何一项都不能建书）。 */
export function onboardingComplete(answers: OnboardingAnswers): boolean {
  return answers.市场 !== undefined && answers.输出形态 !== undefined && answers.目标总字数 !== undefined
}

/** 列出缺失的项（用于工具失败提示与向导校验）。 */
export function onboardingMissing(answers: OnboardingAnswers): string[] {
  const missing: string[] = []
  if (answers.市场 === undefined) missing.push('市场')
  if (answers.输出形态 === undefined) missing.push('输出形态')
  if (answers.目标总字数 === undefined) missing.push('目标总字数')
  return missing
}
