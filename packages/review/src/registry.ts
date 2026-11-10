/**
 * 检查项库注册协议(插件规格 §9)。
 *
 * 适用范围（ReviewScope）：'章'（小说章节）、'剧本'（电影剧本，按场寻址）、
 * '集'（短剧单集，按集/场寻址）。注册表是三者共用的——完成判定必须按
 * 适用范围过滤（见 run.ts 的 scope 过滤），否则注册剧本/短剧模块会让
 * 章节审读的完成态永假（2026-11-10 阶段 3 延期原因，见
 * docs/plan-film-drama.md 阶段 3「有意不做的事」；2026-11-11 跟进轮
 * 接线：用户拍板要全套审读逻辑，遂按范围过滤 + 集/场寻址记录接进来）。
 */

import type {
  ChapterKey,
  ChapterLengthCheck,
  EpisodeOutline,
  EpisodeScriptInput,
  FilmLength,
  Finding,
  SceneOutline,
  ScreenplayDraft,
} from '@webnovel/core'

export type ReviewScope = '章' | '剧本' | '集'

export interface CheckInput {
  readonly scope?: '章'
  readonly bookRoot: string
  readonly key: ChapterKey
  readonly 待审稿: string
  readonly 细纲: string
  readonly 审核编号: string
  readonly 材料版本: string
  /** Actual registered package text, including source-labelled supplements. */
  readonly 材料段?: Readonly<Record<string, string>>
  readonly 篇幅核对?: ChapterLengthCheck
}

/** 剧本审读输入：剧本草稿 + 分场大纲（不是待审小说稿 + 细纲）。 */
export interface ScreenplayCheckInput {
  readonly scope: '剧本'
  readonly bookRoot: string
  readonly 剧本草稿: ScreenplayDraft
  readonly 分场大纲?: SceneOutline
  readonly 片长?: FilmLength
  readonly 审核编号: string
  readonly 材料版本: string
}

/** 短剧单集审读输入：单集剧本 + 对应的分集大纲。 */
export interface EpisodeCheckInput {
  readonly scope: '集'
  readonly bookRoot: string
  readonly 集: number
  readonly 剧本: EpisodeScriptInput
  readonly 大纲: EpisodeOutline
  readonly 审核编号: string
  readonly 材料版本: string
}

/** 注册表统一输入：按 scope 区分；各模块只收自己范围的输入（见适配器守卫）。 */
export type ReviewCheckInput = CheckInput | ScreenplayCheckInput | EpisodeCheckInput

export interface CheckModule {
  readonly 名称: string
  readonly 审什么: string
  readonly 依赖材料: readonly string[]
  /** 「作者」形态＝作者亲自回写发现项的通道,永不自动跑、不进默认方案、不卡完成态。 */
  readonly 执行形态: '确定性代码' | '隔离子 Agent' | '作者'
  /** 隔离子 Agent 形态时,指向承载人设/做法的 skill 名(§11.1,如 章节结构审读)。 */
  readonly skill?: string
  readonly 适用范围: ReviewScope
  /**
   * 确定性代码形态的实现;隔离子 Agent 形态由主 Agent 编排派发,无 run。
   * 输入是 ReviewCheckInput 联合类型：各模块只处理自己适用范围的输入，
   * 收到别的范围必须 fail-closed（返回空数组或抛错，见适配器），绝不能
   * 把章输入当成剧本/集输入跑——范围过滤是完成判定的前提。
   */
  run?(input: ReviewCheckInput): Finding[]
}

const registry = new Map<string, CheckModule>()

export function registerCheck(mod: CheckModule): void {
  registry.set(mod.名称, mod)
}

export function getCheck(name: string): CheckModule | undefined {
  return registry.get(name)
}

/**
 * 列出已注册模块；传 scope 时只返回该适用范围的模块。
 * 完成判定与待回写计算必须用带 scope 的版本——无 scope 的全量遍历只
 * 用于盘点（如 skills.spec.ts 的计数），绝不能用来算完成态。
 */
export function listChecks(scope?: ReviewScope): readonly CheckModule[] {
  const all = [...registry.values()]
  return scope === undefined ? all : all.filter((c) => c.适用范围 === scope)
}

export function resetChecks(): void {
  registry.clear()
}
