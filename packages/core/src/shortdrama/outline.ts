/**
 * 分集钩子/爽点大纲（阶段 3 第一步）：按集规划钩子与爽点分布，每集一个核心想法。
 *
 * 规划器只排结构位（钩子类型轮换、首胜集、付费集、反转次数下限、场景/时长/
 * 台词预算），不发明情节：每集的标题、核心想法、爽点、开场冲突、反转内容、
 * 结尾悬念由作者/模型填进 buildEpisodeOutline，规划器只校验结构。
 *
 * 题材库：读契约里的 `市场` 选对应题材库（packages/core/src/design/genres.ts
 * 的 tiersForMarket），题材档必须属于该市场，否则拒绝——不跨市场混用题材。
 */

import { GENRE_LIBRARY, tiersForMarket, type GenreTierId } from '../design/genres'
import { isMarketValue, type Market } from '../repo/document-fields'
import { requiredTurns } from './beat-checker'
import { RHYTHM_TEMPLATES } from './templates'
import {
  hookTypeForEpisode,
  type EpisodeOutline,
  type EpisodeOutlineSlot,
  type SeasonPlan,
  type ShortDramaOrientation,
} from './types'

export interface PlanSeasonInput {
  /** 契约里的 `市场`（海外/中文），决定加载哪套题材库。 */
  readonly 市场: Market
  /** 题材档 id，必须属于该市场（见 genres.ts 的 tiersForMarket）。 */
  readonly 题材档: GenreTierId
  readonly 画幅: ShortDramaOrientation
  readonly 总集数: number
  /**
   * 第一次真正的胜利所在的集号。不填时竖屏默认第 5 集、横屏默认第 3 集。
   * 平台说明（排播数据，不是节拍规则）：节拍检查器不检查首胜集号；竖屏
   * “不晚于第 5 集”是竖屏付费模式的排播建议（见 templates.ts 的 平台说明）。
   */
  readonly 首胜集?: number
  /**
   * 首个付费集。不填时竖屏默认第 11 集（海外最常见值）；横屏无此概念，传了也忽略。
   * 竖屏只接受 10 或 11（调研：海外最常见第 11 集，国内前 10–15 集免费）。
   * 平台说明（排播数据，不是节拍规则）：节拍检查器不检查付费集号。
   */
  readonly 付费集?: number
}

function fail(message: string): never {
  throw new Error(`分集大纲规划失败：${message}`)
}

/** 排一季的分集结构位：钩子轮换 + 首胜集 + 付费集 + 每集反转/场景/时长/台词预算。 */
export function planSeason(input: PlanSeasonInput): SeasonPlan {
  const { 市场, 题材档, 画幅, 总集数 } = input
  if (!isMarketValue(市场)) fail(`市场取值非法：${String(市场)}，只接受 海外 / 中文`)
  const tiers = tiersForMarket(GENRE_LIBRARY, 市场)
  if (!tiers.some((tier) => tier.id === 题材档)) {
    fail(`题材档「${题材档}」不属于${市场}市场（${市场}市场可选：${tiers.map((t) => t.id).join('、') || '无'}）`)
  }
  const template = RHYTHM_TEMPLATES[画幅]
  if (!Number.isSafeInteger(总集数) || 总集数 < template.总集数[0] || 总集数 > template.总集数[1]) {
    fail(`${画幅}总集数须在 ${template.总集数[0]}–${template.总集数[1]} 集之间（收到：${String(总集数)}）`)
  }

  const 首胜集 = input.首胜集 ?? (画幅 === '竖屏' ? 5 : 3)
  if (!Number.isSafeInteger(首胜集) || 首胜集 < 1 || 首胜集 > 总集数) {
    fail(`首胜集须在 1–${总集数} 之间（收到：${String(首胜集)}）`)
  }
  if (画幅 === '竖屏' && 首胜集 > 5) fail(`竖屏第一次真正的胜利不得晚于第 5 集（收到：第 ${首胜集} 集）`)

  let 付费集: number | null = null
  if (画幅 === '竖屏') {
    付费集 = input.付费集 ?? 11
    if (付费集 !== 10 && 付费集 !== 11) fail(`竖屏首个付费集只接受第 10 或 11 集（收到：第 ${付费集} 集）`)
    if (付费集 > 总集数) fail(`付费集第 ${付费集} 超出总集数 ${总集数}`)
  }

  const 集大纲: EpisodeOutlineSlot[] = []
  // 最少反转次数按单集时长范围中点折算（与节拍检查器同一公式 requiredTurns）：
  // 竖屏中点 90 秒→2 个，横屏中点 900 秒→29 个。实际集数按真实时长由节拍检查器核定。
  const 中点时长秒 = Math.round((template.单集时长秒[0] + template.单集时长秒[1]) / 2)
  const 最少反转次数 = requiredTurns(中点时长秒)
  for (let 集 = 1; 集 <= 总集数; 集++) {
    集大纲.push({
      集,
      画幅,
      钩子类型: hookTypeForEpisode(集),
      最少反转次数,
      场景数: template.每集场景数 ?? [1, 99],
      时长秒: template.单集时长秒,
      台词字数: template.台词字数,
      付费墙集: 付费集 !== null && 集 === 付费集,
      首胜集: 集 === 首胜集,
    })
  }
  return { 市场, 题材档, 画幅, 总集数, 付费集, 首胜集, 集大纲 }
}

/** 填一集大纲的内容。只校验结构，不评判情节好坏（好坏归审读）。 */
export function buildEpisodeOutline(
  slot: EpisodeOutlineSlot,
  content: {
    readonly 标题: string
    readonly 核心想法: string
    readonly 爽点: string
    readonly 开场冲突: string
    readonly 反转: readonly string[]
    readonly 结尾悬念: string
  },
): EpisodeOutline {
  const need = (value: string, name: string): string => {
    const v = value.trim()
    if (v === '') fail(`集${slot.集}：${name}不能为空`)
    return v
  }
  const 标题 = need(content.标题, '标题')
  const 核心想法 = need(content.核心想法, '核心想法（一集只容一个想法）')
  const 爽点 = need(content.爽点, '爽点')
  const 开场冲突 = need(content.开场冲突, '开场冲突')
  const 结尾悬念 = need(content.结尾悬念, '结尾悬念（必须是问题，不是答案）')
  if (content.反转.length < slot.最少反转次数) {
    fail(`集${slot.集}：反转至少 ${slot.最少反转次数} 个（收到 ${content.反转.length} 个）`)
  }
  for (const [i, item] of content.反转.entries()) {
    if (item.trim() === '') fail(`集${slot.集}：第 ${i + 1} 个反转为空`)
  }
  // 结尾悬念切在问题上：至少以疑问语气收尾（？或“吗/呢/怎么办/会怎样”等问句标志）。
  // 这是形式检查，语义是否真留悬念归审读。
  const 问句标志 = /[？?]|吗|呢|怎么办|会怎样|到底|还是|能不能|敢不敢|谁|什么|为什么|怎么$/
  if (!问句标志.test(结尾悬念)) {
    fail(`集${slot.集}：结尾悬念必须切在问题上（收到「${结尾悬念}」，不像问句）`)
  }
  return {
    集: slot.集,
    标题,
    钩子类型: slot.钩子类型,
    核心想法,
    爽点,
    开场冲突,
    反转: content.反转.map((s) => s.trim()),
    结尾悬念,
  }
}

/** 把一季大纲渲染成 Markdown（草稿区/分集大纲，供作者过目，不直接进定稿）。 */
export function renderSeasonOutline(plan: SeasonPlan, outlines: readonly EpisodeOutline[]): string {
  const byEp = new Map(outlines.map((o) => [o.集, o]))
  const lines: string[] = [
    '# 分集钩子/爽点大纲',
    '',
    `- 市场：${plan.市场}（题材档：${plan.题材档}）`,
    `- 画幅：${plan.画幅}（${RHYTHM_TEMPLATES[plan.画幅].画幅比}）`,
    `- 总集数：${plan.总集数} 集`,
    `- 首胜集：第 ${plan.首胜集} 集（平台说明，排播数据，不是节拍规则）`,
    plan.付费集 === null ? '- 付费墙：无（横屏点播，不设按集付费墙；平台说明）' : `- 首个付费集：第 ${plan.付费集} 集（平台说明，排播数据，不是节拍规则）`,
    '',
    '钩子轮换：第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩，此后循环。',
    '',
  ]
  for (const slot of plan.集大纲) {
    const o = byEp.get(slot.集)
    lines.push(`## 集${String(slot.集).padStart(3, '0')}：${o?.标题 ?? '（待填）'}`)
    lines.push('')
    lines.push(`- 钩子类型：${slot.钩子类型}${slot.付费墙集 ? '（付费墙集）' : ''}${slot.首胜集 ? '（首胜集）' : ''}`)
    lines.push(`- 最少反转：${slot.最少反转次数} 个；场景数：${slot.场景数[0]}–${slot.场景数[1]} 场；时长：${slot.时长秒[0]}–${slot.时长秒[1]} 秒`)
    if (o !== undefined) {
      lines.push(`- 核心想法：${o.核心想法}`)
      lines.push(`- 爽点：${o.爽点}`)
      lines.push(`- 开场冲突：${o.开场冲突}`)
      for (const [i, rev] of o.反转.entries()) lines.push(`- 反转 ${i + 1}：${rev}`)
      lines.push(`- 结尾悬念：${o.结尾悬念}`)
    }
    lines.push('')
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}
