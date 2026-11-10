/**
 * 电影剧本改编管线（阶段 2 编排）：故事稿 → 分场大纲 → 剧本草稿 → 审读。
 *
 * 门禁（只在契约 `输出形态=电影剧本` 时走这条管线）：
 * - 输出形态不是 电影剧本 → 拒绝（短剧走短剧管线，小说走原长篇流程）；
 * - 市场非法 → 拒绝；题材档给了但不在该市场的档里 → 拒绝
 *   （市场 → 题材库见 packages/core/src/design/genres.ts 的 tiersForMarket；
 *   中文 → 中文男频/中文女频，海外 → 海外女性向/海外男性向/东南亚通用起步）。
 * 旧书契约没有两字段时按默认值处理（中文 / 小说），即默认不走本管线，
 * 不自动补写、不擅自改写（与阶段 1 的 prepareContract 行为一致）。
 *
 * 定稿输出路径用阶段 0.5 已有的 paths.电影剧本()（剧本/电影/剧本.md），
 * 不另造路径。中间稿（故事稿/分场大纲/剧本草稿）落盘路径见技能文档
 * （草稿区/剧本/ 下的约定），定稿只认这一条。
 */

import { GENRE_LIBRARY, tiersForMarket, type GenreTierId } from '../design/genres'
import { isMarketValue, isOutputFormValue, type Market, type OutputForm } from '../repo/document-fields'
import { paths } from '../repo/paths'
import { validateSceneOutline, parseSceneOutline } from './outline'
import { parseStoryDraft, validateStoryDraft } from './story'
import { parseScreenplay } from './format'
import { runScreenplayReview, type ScreenplayReviewResult } from './review'
import type { FilmLength } from './rhythm'

export interface ScreenplayGate {
  readonly 通过: boolean
  readonly 原因: readonly string[]
  /** 该市场可用的题材档（门禁通过时才有意义）。 */
  readonly 可用题材档: readonly GenreTierId[]
}

/** 门禁：输出形态 + 市场 + 题材档三项。 */
export function checkScreenplayGate(市场: unknown, 输出形态: unknown, 题材档?: GenreTierId): ScreenplayGate {
  const 原因: string[] = []
  if (!isOutputFormValue(输出形态)) {
    原因.push(`输出形态取值非法：${String(输出形态)}，只接受 短剧 / 电影剧本 / 小说`)
    return { 通过: false, 原因, 可用题材档: [] }
  }
  if (输出形态 !== '电影剧本') {
    原因.push(`输出形态是「${输出形态}」，不是「电影剧本」：不走电影剧本改编管线（短剧走短剧管线，小说走原长篇流程）`)
    return { 通过: false, 原因, 可用题材档: [] }
  }
  if (!isMarketValue(市场)) {
    原因.push(`市场取值非法：${String(市场)}，只接受 海外 / 中文`)
    return { 通过: false, 原因, 可用题材档: [] }
  }
  const 可用题材档 = tiersForMarket(GENRE_LIBRARY, 市场).map((t) => t.id)
  if (题材档 !== undefined && !可用题材档.includes(题材档)) {
    原因.push(`题材档「${题材档}」不在市场「${市场}」的档里（可用：${可用题材档.join('、')}）`)
    return { 通过: false, 原因, 可用题材档 }
  }
  return { 通过: true, 原因, 可用题材档 }
}

/** 定稿输出路径：阶段 0.5 已有的 paths.电影剧本()，即 剧本/电影/剧本.md。 */
export function screenplayFinalPath(): string {
  return paths.电影剧本()
}

export interface ScreenplayPipelineInput {
  readonly 市场: Market
  readonly 输出形态: OutputForm
  readonly 题材档?: GenreTierId
  readonly 片长?: FilmLength
  readonly 故事稿: string
  readonly 分场大纲: string
  readonly 剧本草稿: string
}

export interface ScreenplayPipelineResult {
  readonly ok: boolean
  readonly 门禁: ScreenplayGate
  readonly 故事稿问题: readonly string[]
  readonly 故事稿警告: readonly string[]
  readonly 分场大纲问题: readonly string[]
  readonly 分场大纲警告: readonly string[]
  readonly 剧本解析问题: readonly string[]
  readonly 审读: ScreenplayReviewResult | null
  /** 定稿路径（门禁通过才有意义）：剧本/电影/剧本.md。 */
  readonly 定稿路径: string
}

/**
 * 跑完改编全流程（纯计算，不读写文件；落盘由工具/技能层接线）。
 * ok=true 当且仅当：门禁通过、三步解析全通过、审读无阻断项。
 * 警告（故事稿动机提醒、大纲第二幕偏短等）不影响 ok。
 */
export function runScreenplayPipeline(input: ScreenplayPipelineInput): ScreenplayPipelineResult {
  const 定稿路径 = screenplayFinalPath()
  const 门禁 = checkScreenplayGate(input.市场, input.输出形态, input.题材档)
  if (!门禁.通过) {
    return { ok: false, 门禁, 故事稿问题: [], 故事稿警告: [], 分场大纲问题: [], 分场大纲警告: [], 剧本解析问题: [], 审读: null, 定稿路径 }
  }
  const story = parseStoryDraft(input.故事稿)
  const storyCheck = story.story !== undefined ? validateStoryDraft(story.story) : { errors: [] as string[], warnings: [] as string[] }
  const outline = parseSceneOutline(input.分场大纲)
  const outlineCheck = outline.outline !== undefined ? validateSceneOutline(outline.outline) : { errors: [] as string[], warnings: [] as string[] }
  const draft = parseScreenplay(input.剧本草稿)
  const 故事稿问题 = [...story.problems, ...storyCheck.errors]
  const 分场大纲问题 = [...outline.problems, ...outlineCheck.errors]
  const 剧本解析问题 = [...draft.problems]
  if (story.story === undefined || outline.outline === undefined || draft.draft === undefined) {
    return {
      ok: false, 门禁, 故事稿问题, 故事稿警告: storyCheck.warnings,
      分场大纲问题, 分场大纲警告: outlineCheck.warnings, 剧本解析问题, 审读: null, 定稿路径,
    }
  }
  const 审读 = runScreenplayReview({ 剧本草稿: draft.draft, 分场大纲: outline.outline, 片长: input.片长 ?? '长片' })
  const ok = 故事稿问题.length === 0 && 分场大纲问题.length === 0 && 剧本解析问题.length === 0 && !审读.是否阻断
  return {
    ok, 门禁, 故事稿问题, 故事稿警告: storyCheck.warnings,
    分场大纲问题, 分场大纲警告: outlineCheck.warnings, 剧本解析问题, 审读, 定稿路径,
  }
}
