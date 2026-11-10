/**
 * 剧本 / 短剧审读模块：注册进共享审读注册表（registry.ts）。
 *
 * 接线（2026-11-11 跟进轮，用户拍板要全套审读逻辑）：
 * - 剧本三个确定性模块（剧本对白审读 / 剧本节奏审读 / 剧本场次完整性审读）
 *   的实现在 core（packages/core/src/screenplay/review.ts）；这里只做
 *   适配器：把 core 的 ScreenplayReviewInput 形状转成注册表的
 *   ReviewCheckInput（scope '剧本'），并把 ScreenplayFinding 补成完整
 *   Finding（审核编号 / 所依据材料及版本 / 建议复审模块）。
 * - 短剧确定性模块（短剧审读）的实现在 core
 *   （packages/core/src/shortdrama/review.ts 的 reviewShortDramaEpisode）；
 *   适配器同理（scope '集'，发现项编号由本文件按 findingId 分配）。
 * - 语义模块（隔离子 Agent 形态，无 run）：剧本语义审读（skill
 *   novel-screenplay，底本/全量审读.md）与短剧审读（语义）
 *   （skill novel-shortdrama，底本/短剧审读.md）。语义发现项须经
 *   ingestFilmDramaFindings 回写才算完成（空审 fail-closed，与章节一致）。
 * - core 不 import review（循环依赖），所以适配器只能放在 review 包这一侧；
 *   core 的 registerScreenplayChecks 仍保留（纯函数侧的注册入口），
 *   注册表侧以本文件为准。
 *
 * 完成判定按适用范围过滤（run.ts）：章节审读只看 '章' 模块，剧本审读只看
 * '剧本' 模块，短剧集审读只看 '集' 模块。注册进同一张表不会互相污染
 * 完成态——这是 2026-11-10 延期时担心的点，已由 scope 过滤解决。
 */

import {
  draftHashOf,
  normalizeFinding,
  reviewInputFingerprintOf,
  剧本对白审读 as coreDialogue,
  剧本节奏审读 as coreRhythm,
  剧本场次完整性审读 as coreCompleteness,
  reviewShortDramaEpisode,
  type EpisodeOutline,
  type EpisodeScriptInput,
  type Finding,
  type ModuleRunState,
  type ScreenplayDraft,
  type SceneOutline,
  type FilmLength,
} from '@webnovel/core'
import { findingId, registerDefaultChecks } from './checks'
import {
  getCheck,
  registerCheck,
  type CheckModule,
  type EpisodeCheckInput,
  type ReviewCheckInput,
  type ScreenplayCheckInput,
} from './registry'

export const 剧本对白审读名 = '剧本对白审读'
export const 剧本节奏审读名 = '剧本节奏审读'
export const 剧本场次完整性审读名 = '剧本场次完整性审读'
export const 剧本语义审读名 = '剧本语义审读'
export const 短剧审读名 = '短剧审读'
export const 短剧审读语义名 = '短剧审读（语义）'

export const FILM_DRAMA_MODULE_NAMES = [
  剧本对白审读名,
  剧本节奏审读名,
  剧本场次完整性审读名,
  剧本语义审读名,
  短剧审读名,
  短剧审读语义名,
] as const

/** 剧本审读记录编号：全书一部电影剧本共用一个（版本由审读指纹区分）。 */
export function screenplayReviewId(): string {
  return '审-剧本'
}

/** 短剧集审读记录编号：按集寻址（集三位）。 */
export function episodeReviewId(集: number): string {
  return `审-集${String(集).padStart(3, '0')}`
}

/**
 * 把 core 的部分发现项补成完整 Finding。
 * core 的 ScreenplayFinding / ShortDramaFinding 是 Finding 的子集
 * （缺 审核编号 / 所依据材料及版本 / 建议复审模块 / 材料完整性等）；
 * 这里补上：审核编号与所依据材料及版本取自本次审读输入，
 * 建议复审模块 = 本模块名（复审仍回本模块）。
 * 发现项编号须由调用方先行分配（core 的剧本模块已按审核编号重排；
 * 短剧模块由适配器按 findingId 分配）。
 */
function toFinding(
  raw: unknown,
  审核编号: string,
  材料版本: string,
  模块名: string,
): Finding {
  const merged = {
    ...(raw as Readonly<Record<string, unknown>>),
    审核编号,
    模块名,
    所依据材料及版本: 材料版本,
    建议复审模块: 模块名,
  }
  const finding = normalizeFinding(merged)
  if (finding === null) throw new Error(`发现项规范化失败（模块 ${模块名}）`)
  return finding
}

/** 范围守卫：适配器只收自己范围的输入，收到别的范围直接抛错（fail-closed）。 */
function requireScope(input: ReviewCheckInput, scope: '剧本' | '集'): void {
  if (input.scope !== scope) {
    throw new Error(`审读模块收到错误范围的输入：期望 ${scope}，收到 ${input.scope ?? '（未标注）'}`)
  }
}

function adaptScreenplay(
  名称: string,
  审什么: string,
  依赖材料: readonly string[],
  runCore: (input: {
    readonly 剧本草稿: ScreenplayDraft
    readonly 分场大纲?: SceneOutline
    readonly 片长?: FilmLength
    readonly 审核编号?: string
  }) => readonly unknown[],
): CheckModule {
  return {
    名称,
    审什么,
    依赖材料,
    执行形态: '确定性代码',
    适用范围: '剧本',
    run(input: ReviewCheckInput): Finding[] {
      requireScope(input, '剧本')
      const scoped = input as ScreenplayCheckInput
      return runCore({
        剧本草稿: scoped.剧本草稿,
        ...(scoped.分场大纲 !== undefined ? { 分场大纲: scoped.分场大纲 } : {}),
        ...(scoped.片长 !== undefined ? { 片长: scoped.片长 } : {}),
        审核编号: scoped.审核编号,
      }).map((f) => toFinding(f, scoped.审核编号, scoped.材料版本, 名称))
    },
  }
}

export const 剧本对白审读模块: CheckModule = adaptScreenplay(
  剧本对白审读名,
  '角色名全大写、台词非空、括号提示小写短、停顿只用 (pause)、禁用 SFX:/MUSIC: 独占行',
  ['剧本草稿'],
  (input) => coreDialogue.run(input),
)

export const 剧本节奏审读模块: CheckModule = adaptScreenplay(
  剧本节奏审读名,
  '三幕齐全、每幕有转折、开场进冲突、场次下限、长片页数参考',
  ['剧本草稿', '分场大纲'],
  (input) => coreRhythm.run(input),
)

export const 剧本场次完整性审读模块: CheckModule = adaptScreenplay(
  剧本场次完整性审读名,
  '大纲与草稿场场对应、场号连续、每场有动作或台词、无待写占位、内外景已定',
  ['剧本草稿', '分场大纲'],
  (input) => coreCompleteness.run(input),
)

export const 剧本语义审读模块: CheckModule = {
  名称: 剧本语义审读名,
  审什么: '对白像不像这个人、转折可不可信、人物前后一致（语义深挖，见 novel-screenplay 底本/全量审读.md）',
  依赖材料: ['剧本草稿', '分场大纲', '故事稿'],
  执行形态: '隔离子 Agent',
  skill: 'novel-screenplay',
  适用范围: '剧本',
}

export const 短剧审读模块: CheckModule = {
  名称: 短剧审读名,
  审什么: '短剧单集剧本的确定性检查（台词长度/总量、场景数、钩子与大纲一致性、节拍表对应）',
  依赖材料: ['分集大纲', '单集剧本'],
  执行形态: '确定性代码',
  适用范围: '集',
  run(input: ReviewCheckInput): Finding[] {
    requireScope(input, '集')
    const scoped = input as EpisodeCheckInput
    const findings = reviewShortDramaEpisode({ 剧本: scoped.剧本, 大纲: scoped.大纲 })
    return findings.map((f, i) =>
      toFinding(
        { ...f, 发现项编号: findingId(scoped.审核编号, 短剧审读名, i + 1) },
        scoped.审核编号,
        scoped.材料版本,
        短剧审读名,
      ),
    )
  },
}

export const 短剧审读语义模块: CheckModule = {
  名称: 短剧审读语义名,
  审什么: '对白是否即行动、爽点是否成立、人物是否前后一致、题材禁忌是否踩线（语义，见 novel-shortdrama 底本/短剧审读.md）',
  依赖材料: ['分集大纲', '单集剧本', '题材库对应档'],
  执行形态: '隔离子 Agent',
  skill: 'novel-shortdrama',
  适用范围: '集',
}

export const FILM_DRAMA_MODULES: readonly CheckModule[] = [
  剧本对白审读模块,
  剧本节奏审读模块,
  剧本场次完整性审读模块,
  剧本语义审读模块,
  短剧审读模块,
  短剧审读语义模块,
]

/** 注册剧本 + 短剧审读模块（幂等：已注册的不重复注册）。 */
export function registerFilmDramaChecks(): void {
  for (const mod of FILM_DRAMA_MODULES) {
    if (getCheck(mod.名称) === undefined) registerCheck(mod)
  }
}

/** 注册全部审读模块（章节 + 剧本 + 短剧）。完成判定按范围过滤，见 run.ts。 */
export function registerAllReviewChecks(): void {
  registerDefaultChecks()
  registerFilmDramaChecks()
}

/** 分集大纲的规范文本（审读指纹用）：字段顺序固定，不依赖对象键顺序。 */
export function episodeOutlineText(大纲: EpisodeOutline): string {
  return [
    `集${大纲.集} ${大纲.标题}`,
    `钩子类型：${大纲.钩子类型}`,
    `核心想法：${大纲.核心想法}`,
    `爽点：${大纲.爽点}`,
    `开场冲突：${大纲.开场冲突}`,
    ...大纲.反转.map((r, i) => `反转${i + 1}：${r}`),
    `结尾悬念：${大纲.结尾悬念}`,
  ].join('\n')
}

/**
 * 剧本审读指纹（计算与回写两端共用，绝不能各写一份——指纹不一致会让
 * 回写永远报「已过期」）。输入与 computeScreenplayFindings 完全一致：
 * 正文 = 剧本草稿文本，细纲 = 分场大纲文本（无大纲为空串），
 * 方案 = { 片长 }（缺省 '长片'）。
 */
export function screenplayFingerprint(
  剧本草稿文本: string,
  分场大纲文本?: string,
  片长?: FilmLength,
): string {
  return reviewInputFingerprintOf({
    正文: 剧本草稿文本,
    细纲: 分场大纲文本 ?? '',
    方案: { 片长: 片长 ?? '长片' },
  })
}

/**
 * 短剧集审读指纹（计算与回写两端共用）。正文 = 渲染后的单集剧本文本，
 * 细纲 = episodeOutlineText(大纲） 的规范文本。
 */
export function episodeFingerprint(剧本文本: string, 大纲文本: string): string {
  return reviewInputFingerprintOf({ 正文: 剧本文本, 细纲: 大纲文本 })
}

export interface ScreenplayFindingsResult {
  readonly findings: readonly Finding[]
  readonly 按模块: Readonly<Record<string, readonly Finding[]>>
  readonly 是否阻断: boolean
  readonly 审核编号: string
  readonly 审读指纹: string
  readonly 审稿哈希: string
  readonly 模块状态: Readonly<Record<string, ModuleRunState>>
}

export interface EpisodeFindingsResult {
  readonly findings: readonly Finding[]
  readonly 是否阻断: boolean
  readonly 审核编号: string
  readonly 审读指纹: string
  readonly 审稿哈希: string
  readonly 模块状态: Readonly<Record<string, ModuleRunState>>
}

/**
 * 纯计算：跑完三个剧本确定性模块（经注册表，不直接调 core）。
 * 不读写书仓、不落盘；落盘走 run.ts 的 runScreenplayReviewRecord。
 * 语义模块（剧本语义审读）是隔离子 Agent 形态：这里只标记待回写，
 * 发现项须经 ingestFilmDramaFindings 回写后才算完成（空审 fail-closed）。
 */
export function computeScreenplayFindings(input: {
  readonly 剧本草稿: ScreenplayDraft
  readonly 剧本草稿文本: string
  readonly 分场大纲?: SceneOutline
  readonly 分场大纲文本?: string
  readonly 片长?: FilmLength
  readonly 材料版本?: string
}): ScreenplayFindingsResult {
  registerFilmDramaChecks()
  const 审核编号 = screenplayReviewId()
  const 材料版本 = input.材料版本 ?? '草稿区/剧本/剧本草稿.md'
  const 审稿哈希 = draftHashOf(input.剧本草稿文本)
  const 审读指纹 = screenplayFingerprint(input.剧本草稿文本, input.分场大纲文本, input.片长)
  const checkInput: ScreenplayCheckInput = {
    scope: '剧本',
    bookRoot: '',
    剧本草稿: input.剧本草稿,
    ...(input.分场大纲 !== undefined ? { 分场大纲: input.分场大纲 } : {}),
    ...(input.片长 !== undefined ? { 片长: input.片长 } : {}),
    审核编号,
    材料版本,
  }
  const 按模块: Record<string, readonly Finding[]> = {}
  const 模块状态: Record<string, ModuleRunState> = {}
  for (const name of [剧本对白审读名, 剧本节奏审读名, 剧本场次完整性审读名]) {
    const mod = getCheck(name)
    if (mod?.run === undefined) throw new Error(`剧本审读模块未注册：${name}`)
    try {
      const findings = mod.run(checkInput)
      按模块[name] = findings
      模块状态[name] = { 完成: true, 失败: false }
    } catch (err) {
      // 确定性模块跑抛错不炸掉整轮审读：记失败态、完成态为假（与章节 computeReview 一致）。
      按模块[name] = []
      模块状态[name] = { 完成: false, 失败: true, 理由: String(err) }
    }
  }
  模块状态[剧本语义审读名] = { 完成: false, 失败: false, 待回写: true }
  const findings = [...按模块[剧本对白审读名] as readonly Finding[], ...按模块[剧本节奏审读名] as readonly Finding[], ...按模块[剧本场次完整性审读名] as readonly Finding[]]
  return { findings, 按模块, 是否阻断: findings.some((f) => f.是否建议阻断), 审核编号, 审读指纹, 审稿哈希, 模块状态 }
}

/**
 * 纯计算：跑完短剧确定性模块（经注册表，不直接调 core）。
 * 不读写书仓、不落盘；落盘走 run.ts 的 runEpisodeReviewRecord。
 */
export function computeEpisodeFindings(input: {
  readonly 集: number
  readonly 剧本: EpisodeScriptInput
  readonly 剧本文本: string
  readonly 大纲: EpisodeOutline
  readonly 材料版本?: string
}): EpisodeFindingsResult {
  registerFilmDramaChecks()
  const 审核编号 = episodeReviewId(input.集)
  const 材料版本 = input.材料版本 ?? `剧本/短剧/集${String(input.集).padStart(3, '0')}.md`
  const 审稿哈希 = draftHashOf(input.剧本文本)
  const 审读指纹 = episodeFingerprint(input.剧本文本, episodeOutlineText(input.大纲))
  const checkInput: EpisodeCheckInput = {
    scope: '集',
    bookRoot: '',
    集: input.集,
    剧本: input.剧本,
    大纲: input.大纲,
    审核编号,
    材料版本,
  }
  const mod = getCheck(短剧审读名)
  if (mod?.run === undefined) throw new Error(`短剧审读模块未注册：${短剧审读名}`)
  let findings: readonly Finding[]
  const 模块状态: Record<string, ModuleRunState> = {}
  try {
    findings = mod.run(checkInput)
    模块状态[短剧审读名] = { 完成: true, 失败: false }
  } catch (err) {
    findings = []
    模块状态[短剧审读名] = { 完成: false, 失败: true, 理由: String(err) }
  }
  模块状态[短剧审读语义名] = { 完成: false, 失败: false, 待回写: true }
  return { findings, 是否阻断: findings.some((f) => f.是否建议阻断), 审核编号, 审读指纹, 审稿哈希, 模块状态 }
}
