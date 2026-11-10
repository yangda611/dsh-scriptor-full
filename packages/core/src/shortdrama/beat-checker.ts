/**
 * 内置节拍检查器（beat checker）：按调研规则逐项校验每集，报出哪集哪条规则没过。
 *
 * 共用节拍规则（2026-11-11 用户决定：竖屏与横屏共用同一套节拍规则，只按单集
 * 时长缩放，不按画幅放宽；规则来源见 templates.ts 的 共用节拍规则）：
 *  1. 开场冲突在 5 秒内出现（两画幅统一）；2. 无铺垫开场、无片头（两画幅统一，
 *     由第 1 条推出）；3. 每 20–30 秒一个反转：首次反转不晚于 30 秒，相邻间隔
 *     20–30 秒，所需个数随单集时长缩放（requiredTurns）；4. 每集结尾 5–10 秒
 *     留悬念、切在问题上不是答案上（两画幅统一）；5. 三种钩子类型（身份/情感/
 *     顿悟）轮换；6. 前 3 集定生死（第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩）；
 *  7. 起承转合只看时长：单集 ≥600 秒才要求四段齐全，短集不适用。
 *
 * 首胜集号与付费墙是平台变现安排（平台说明，见 templates.ts 的 平台说明），
 * 不是节拍规则：本检查器不检查它们。checkSeasonBeats 的 opts.付费集参数只为
 * 兼容 shortdrama-tools.ts 而保留（已忽略，协调人移除工具参数后可删）。
 *
 * 检查器只读 EpisodeBeats 里的数，不读正文猜测：节拍时间点由单集剧本的
 * 「节拍表」小节（script.ts 渲染）或工具调用方提供。
 * EpisodeBeats.首场冲突 是旧字段（横屏曾用「首场即冲突」），检查器不再读它；
 * EpisodeBeats.首次胜利 是平台说明数据，检查器不检查它。
 */

import { HOOK_ROTATION, type EpisodeBeats, type ShortDramaOrientation } from './types'

export type BeatRuleStatus = '通过' | '未通过' | '不适用'

export interface BeatRuleResult {
  /** 规则 id（稳定字符串，供工具/测试断言）。 */
  readonly 规则: string
  readonly 说明: string
  readonly 状态: BeatRuleStatus
  /** 没过 / 不适用时写明原因；通过时为空字符串。 */
  readonly 原因: string
}

export interface EpisodeBeatCheck {
  readonly 集: number
  readonly 画幅: ShortDramaOrientation
  readonly 规则: readonly BeatRuleResult[]
  readonly 通过: boolean
}

export interface SeasonBeatCheck {
  /** 集级检查（每集一条）。 */
  readonly 各集: readonly EpisodeBeatCheck[]
  /** 季级检查（钩子轮换、前三集钩子顺序）。 */
  readonly 季级规则: readonly BeatRuleResult[]
  readonly 全部通过: boolean
  /** 所有未通过的规则，按「集001 · 规则」列出，供汇报直接引用。 */
  readonly 未通过清单: readonly string[]
}

function pass(规则: string, 说明: string): BeatRuleResult {
  return { 规则, 说明, 状态: '通过', 原因: '' }
}

function fail(规则: string, 说明: string, 原因: string): BeatRuleResult {
  return { 规则, 说明, 状态: '未通过', 原因 }
}

function na(规则: string, 说明: string, 原因: string): BeatRuleResult {
  return { 规则, 说明, 状态: '不适用', 原因 }
}

const RULES = {
  开场冲突5秒内: '开场冲突5秒内',
  无片头无铺垫: '无片头无铺垫',
  反转密度: '每20至30秒一个反转',
  结尾留悬念: '结尾5至10秒留悬念',
  切在问题上: '切在问题上不是答案上',
  起承转合: '起承转合四段齐全',
  钩子轮换: '钩子类型轮换',
  前三集钩子顺序: '前三集钩子顺序',
} as const

/**
 * 起承转合的时长门槛（秒）：单集达到此时长才要求四段齐全。
 * 取横屏单集时长范围下限（600 秒），是时长推导，不是画幅判定——竖屏长集
 * 同样适用，横屏短集（若有）同样不适用。
 */
export const 起承转合时长门槛秒 = 600

/**
 * 所需反转数（工具约定，见 templates.ts 的 共用节拍规则）：
 * 首次反转不晚于 30 秒，此后每 20–30 秒一个——
 * required = max(1, ceil((时长秒 − 30) / 30))：90 秒→2，60 秒→1，600 秒→19，900 秒→29。
 * 分集规划（outline.ts 的最少反转次数）与本函数共用同一公式。
 */
export function requiredTurns(时长秒: number): number {
  if (!Number.isFinite(时长秒) || 时长秒 <= 0) return 1
  return Math.max(1, Math.ceil((时长秒 - 30) / 30))
}

/** 校验一集（集级规则）。季级规则（轮换/前三集）见 checkSeasonBeats。两画幅同一条检查路径，只按时长区分（起承转合 ≥600 秒才检查）。 */
export function checkEpisodeBeats(beats: EpisodeBeats): EpisodeBeatCheck {
  const 规则: BeatRuleResult[] = []
  const ep = `集${String(beats.集).padStart(3, '0')}`

  规则.push(
    beats.开场冲突秒 <= 5
      ? pass(RULES.开场冲突5秒内, '开场冲突在 5 秒内出现')
      : fail(RULES.开场冲突5秒内, '开场冲突在 5 秒内出现', `${ep}开场冲突在第 ${beats.开场冲突秒} 秒，超过 5 秒`),
  )
  规则.push(
    !beats.有片头 && !beats.有开场铺垫
      ? pass(RULES.无片头无铺垫, '无铺垫开场、无片头')
      : fail(
          RULES.无片头无铺垫,
          '无铺垫开场、无片头',
          `${ep}${beats.有片头 ? '放了片头' : ''}${beats.有片头 && beats.有开场铺垫 ? '、' : ''}${beats.有开场铺垫 ? '有开场铺垫' : ''}`,
        ),
  )
  // 反转密度：首次反转不晚于 30 秒；相邻反转间隔 20–30 秒；所需个数随单集时长缩放。
  const required = requiredTurns(beats.时长秒)
  const sorted = [...beats.反转秒].sort((a, b) => a - b)
  const 反转密度说明 = `每 20–30 秒一个反转，本集 ${beats.时长秒} 秒至少 ${required} 个反转`
  if (sorted.length < required) {
    规则.push(fail(RULES.反转密度, 反转密度说明, `${ep}只有 ${sorted.length} 个反转，至少需要 ${required} 个`))
  } else if (sorted[0] as number > 30) {
    规则.push(fail(RULES.反转密度, 反转密度说明, `${ep}首次反转在第 ${sorted[0]} 秒，晚于 30 秒`))
  } else {
    const badGap: number | null = (() => {
      for (let i = 1; i < sorted.length; i++) {
        const gap = (sorted[i] as number) - (sorted[i - 1] as number)
        if (gap < 20 || gap > 30) return gap
      }
      return null
    })()
    规则.push(
      badGap === null
        ? pass(RULES.反转密度, 反转密度说明)
        : fail(RULES.反转密度, 反转密度说明, `${ep}相邻反转间隔 ${badGap} 秒，不在 20–30 秒之间`),
    )
  }
  规则.push(
    beats.结尾钩子秒 >= beats.时长秒 - 10 && beats.结尾钩子秒 <= beats.时长秒
      ? pass(RULES.结尾留悬念, '每集结尾 5–10 秒留钩子')
      : fail(RULES.结尾留悬念, '每集结尾 5–10 秒留钩子', `${ep}结尾钩子在第 ${beats.结尾钩子秒} 秒，不在结尾 5–10 秒内（本集 ${beats.时长秒} 秒）`),
  )
  规则.push(
    beats.结尾切在问题上
      ? pass(RULES.切在问题上, '结尾切在问题上，不是答案上')
      : fail(RULES.切在问题上, '结尾切在问题上，不是答案上', `${ep}结尾切在了答案上`),
  )
  // 起承转合：只看时长（≥600 秒才要求四段齐全），不看画幅。
  if (beats.时长秒 < 起承转合时长门槛秒) {
    规则.push(na(RULES.起承转合, '起承转合四段齐全（单集 ≥600 秒时适用）', `本集 ${beats.时长秒} 秒，不到 ${起承转合时长门槛秒} 秒，不要求起承转合`))
  } else {
    const acts = beats.起承转合
    规则.push(
      acts !== undefined && acts.起 && acts.承 && acts.转 && acts.合
        ? pass(RULES.起承转合, '起承转合四段齐全（单集 ≥600 秒时适用）')
        : fail(RULES.起承转合, '起承转合四段齐全（单集 ≥600 秒时适用）', `${ep}起承转合不全（${acts === undefined ? '未提供分幕' : `起${acts.起 ? '✓' : '✗'} 承${acts.承 ? '✓' : '✗'} 转${acts.转 ? '✓' : '✗'} 合${acts.合 ? '✓' : '✗'}`}）`),
    )
  }

  return { 集: beats.集, 画幅: beats.画幅, 规则, 通过: 规则.every((r) => r.状态 !== '未通过') }
}

/**
 * 校验一季（集级 + 季级）。季级规则只有两条：
 * - 钩子轮换：相邻两集钩子类型不同；
 * - 前三集钩子顺序：第 1 集身份、第 2 集情感、第 3 集顿悟。
 * 首胜集号与付费墙是平台说明（排播数据），不是节拍规则，不在这里检查。
 */
export function checkSeasonBeats(
  episodes: readonly EpisodeBeats[],
): SeasonBeatCheck {
  const sorted = [...episodes].sort((a, b) => a.集 - b.集)
  const 各集 = sorted.map(checkEpisodeBeats)
  const 季级规则: BeatRuleResult[] = []

  // 钩子轮换：相邻两集不同。
  const clash = (() => {
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i] as EpisodeBeats).钩子类型 === (sorted[i - 1] as EpisodeBeats).钩子类型) return i
    }
    return null
  })()
  季级规则.push(
    clash === null
      ? pass(RULES.钩子轮换, '三种钩子类型（身份/情感/顿悟）轮换，两集不用同一种')
      : fail(RULES.钩子轮换, '三种钩子类型（身份/情感/顿悟）轮换，两集不用同一种', `集${String((sorted[clash] as EpisodeBeats).集).padStart(3, '0')} 与上一集用了同一种钩子「${(sorted[clash] as EpisodeBeats).钩子类型}」`),
  )

  // 前三集钩子顺序（竖屏/横屏通用：前三集定生死）。
  const first3 = sorted.filter((e) => e.集 <= 3)
  if (first3.length < 3) {
    季级规则.push(na(RULES.前三集钩子顺序, '前三集定生死（第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩）', `只提供了前 ${first3.length} 集，不足 3 集无法判定`))
  } else {
    const bad = first3.find((e) => e.钩子类型 !== (HOOK_ROTATION[e.集 - 1] as string))
    季级规则.push(
      bad === undefined
        ? pass(RULES.前三集钩子顺序, '前三集定生死（第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩）')
        : fail(RULES.前三集钩子顺序, '前三集定生死（第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩）', `集${String(bad.集).padStart(3, '0')}钩子是「${bad.钩子类型}」，应为「${HOOK_ROTATION[bad.集 - 1]}」`),
    )
  }

  const 未通过清单: string[] = []
  for (const ep of 各集) {
    for (const r of ep.规则) {
      if (r.状态 === '未通过') 未通过清单.push(`集${String(ep.集).padStart(3, '0')} · ${r.规则}：${r.原因}`)
    }
  }
  for (const r of 季级规则) {
    if (r.状态 === '未通过') 未通过清单.push(`季级 · ${r.规则}：${r.原因}`)
  }
  return { 各集, 季级规则, 全部通过: 未通过清单.length === 0, 未通过清单 }
}
