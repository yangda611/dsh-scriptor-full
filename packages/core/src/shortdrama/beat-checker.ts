/**
 * 内置节拍检查器（beat checker）：按调研规则逐项校验每集，报出哪集哪条规则没过。
 *
 * 竖屏规则（来源：docs/research/film-drama-research.md §2.2–§2.3，逐条见
 * templates.ts 的 VERTICAL_TEMPLATE）：
 *  1. 开场冲突在 5 秒内出现；2. 无铺垫开场、无片头；3. 每 20–30 秒一个反转、
 *     90 秒一集至少 2 个反转；4. 每集结尾 5–10 秒留悬念、切在问题上不是答案上；
 *  5. 三种钩子类型（身份/情感/顿悟）轮换；6. 前 3 集定生死（第 1 集身份钩、
 *     第 2 集情感钩、第 3 集顿悟钩）；7. 第一次真正的胜利不晚于第 5 集；
 *  8. 付费墙在第 10–11 集。
 * 横屏规则（来源同上 §2.4 + templates.ts 的 HORIZONTAL_TEMPLATE）：按横屏节奏放宽，
 * 竖屏专属的秒数/集号硬限在横屏返回「不适用」，不硬套。
 *
 * 检查器只读 EpisodeBeats 里的数，不读正文猜测：节拍时间点由单集剧本的
 * 「节拍表」小节（script.ts 渲染）或工具调用方提供。
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
  /** 季级检查（轮换、前三集、首胜、付费墙）。 */
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
  钩子轮换: '钩子类型轮换',
  前三集钩子顺序: '前三集钩子顺序',
  首胜不晚于第5集: '首次胜利不晚于第5集',
  付费墙10至11集: '付费墙在第10至11集',
  横屏开场首场冲突: '开场首场即冲突',
  横屏起承转合: '起承转合四段齐全',
  横屏反转下限: '每集至少2个转折',
  横屏结尾悬念: '结尾1分钟内留悬念',
} as const

/** 校验一集（集级规则）。季级规则（轮换/前三集/首胜/付费墙）见 checkSeasonBeats。 */
export function checkEpisodeBeats(beats: EpisodeBeats): EpisodeBeatCheck {
  const 规则: BeatRuleResult[] = []
  const ep = `集${String(beats.集).padStart(3, '0')}`

  if (beats.画幅 === '竖屏') {
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
    // 反转密度：首次反转不晚于 30 秒；相邻反转间隔 20–30 秒；90 秒一集至少 2 个反转
    // （60 秒一集至少 1 个，按时长折算）。
    const required = beats.时长秒 >= 90 ? 2 : 1
    const sorted = [...beats.反转秒].sort((a, b) => a - b)
    if (sorted.length < required) {
      规则.push(fail(RULES.反转密度, '每 20–30 秒一个反转，90 秒一集至少 2 个反转', `${ep}只有 ${sorted.length} 个反转，至少需要 ${required} 个`))
    } else if (sorted[0] as number > 30) {
      规则.push(fail(RULES.反转密度, '每 20–30 秒一个反转，90 秒一集至少 2 个反转', `${ep}首次反转在第 ${sorted[0]} 秒，晚于 30 秒`))
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
          ? pass(RULES.反转密度, '每 20–30 秒一个反转，90 秒一集至少 2 个反转')
          : fail(RULES.反转密度, '每 20–30 秒一个反转，90 秒一集至少 2 个反转', `${ep}相邻反转间隔 ${badGap} 秒，不在 20–30 秒之间`),
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
  } else {
    // 横屏：竖屏的秒数硬限不适用；按横屏模板检查（见 templates.ts）。
    规则.push(na(RULES.开场冲突5秒内, '开场冲突在 5 秒内出现', '竖屏规则，横屏不适用（横屏用“开场首场即冲突”）'))
    规则.push(na(RULES.无片头无铺垫, '无铺垫开场、无片头', '竖屏规则，横屏不适用（横屏每集是有头有尾的完整结构）'))
    规则.push(
      beats.首场冲突 === true
        ? pass(RULES.横屏开场首场冲突, '开场首场即冲突')
        : fail(RULES.横屏开场首场冲突, '开场首场即冲突', `${ep}首场没有冲突`),
    )
    const acts = beats.起承转合
    规则.push(
      acts !== undefined && acts.起 && acts.承 && acts.转 && acts.合
        ? pass(RULES.横屏起承转合, '起承转合四段齐全')
        : fail(RULES.横屏起承转合, '起承转合四段齐全', `${ep}起承转合不全（${acts === undefined ? '未提供分幕' : `起${acts.起 ? '✓' : '✗'} 承${acts.承 ? '✓' : '✗'} 转${acts.转 ? '✓' : '✗'} 合${acts.合 ? '✓' : '✗'}`}）`),
    )
    规则.push(
      beats.反转秒.length >= 2
        ? pass(RULES.横屏反转下限, '每集至少 2 个转折（“转”段须有一次全集最大转折）')
        : fail(RULES.横屏反转下限, '每集至少 2 个转折（“转”段须有一次全集最大转折）', `${ep}只有 ${beats.反转秒.length} 个转折，至少需要 2 个`),
    )
    规则.push(
      beats.结尾钩子秒 >= beats.时长秒 - 60 && beats.结尾钩子秒 <= beats.时长秒
        ? pass(RULES.横屏结尾悬念, '结尾 1 分钟内留悬念')
        : fail(RULES.横屏结尾悬念, '结尾 1 分钟内留悬念', `${ep}结尾钩子在第 ${beats.结尾钩子秒} 秒，不在结尾 1 分钟内（本集 ${beats.时长秒} 秒）`),
    )
    规则.push(
      beats.结尾切在问题上
        ? pass(RULES.切在问题上, '结尾切在问题上，不是答案上')
        : fail(RULES.切在问题上, '结尾切在问题上，不是答案上', `${ep}结尾切在了答案上`),
    )
  }

  return { 集: beats.集, 画幅: beats.画幅, 规则, 通过: 规则.every((r) => r.状态 !== '未通过') }
}

/**
 * 校验一季（集级 + 季级）。季级规则需要全季的集数据：
 * - 钩子轮换：相邻两集钩子类型不同；
 * - 前三集钩子顺序：第 1 集身份、第 2 集情感、第 3 集顿悟；
 * - 首胜不晚于第 5 集（竖屏）；付费墙在第 10–11 集（竖屏，须由调用方传入付费集号）。
 */
export function checkSeasonBeats(
  episodes: readonly EpisodeBeats[],
  opts: { readonly 付费集?: number | null } = {},
): SeasonBeatCheck {
  const sorted = [...episodes].sort((a, b) => a.集 - b.集)
  const 各集 = sorted.map(checkEpisodeBeats)
  const 季级规则: BeatRuleResult[] = []
  const 画幅 = sorted[0]?.画幅 ?? '竖屏'

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

  if (画幅 === '竖屏') {
    // 首胜不晚于第 5 集。
    const wins = sorted.filter((e) => e.首次胜利).map((e) => e.集)
    if (wins.length === 0) {
      季级规则.push(fail(RULES.首胜不晚于第5集, '第一次真正的胜利不晚于第 5 集', '全季没有标注首次胜利的集'))
    } else if ((wins[0] as number) > 5) {
      季级规则.push(fail(RULES.首胜不晚于第5集, '第一次真正的胜利不晚于第 5 集', `第一次胜利在第 ${wins[0]} 集，晚于第 5 集`))
    } else if (wins.length > 1) {
      季级规则.push(fail(RULES.首胜不晚于第5集, '第一次真正的胜利不晚于第 5 集', `首次胜利标注了 ${wins.length} 集（第 ${wins.join('、')} 集），只能有一集`))
    } else {
      季级规则.push(pass(RULES.首胜不晚于第5集, '第一次真正的胜利不晚于第 5 集'))
    }
    // 付费墙在第 10–11 集（须由调用方传入；不传则不适用）。
    if (opts.付费集 === undefined || opts.付费集 === null) {
      季级规则.push(na(RULES.付费墙10至11集, '付费墙在第 10–11 集', '未传入付费集号，无法判定'))
    } else if (opts.付费集 === 10 || opts.付费集 === 11) {
      季级规则.push(pass(RULES.付费墙10至11集, '付费墙在第 10–11 集'))
    } else {
      季级规则.push(fail(RULES.付费墙10至11集, '付费墙在第 10–11 集', `付费墙在第 ${opts.付费集} 集，不在第 10–11 集`))
    }
  } else {
    季级规则.push(na(RULES.首胜不晚于第5集, '第一次真正的胜利不晚于第 5 集', '竖屏规则，横屏不适用（横屏不设首胜集号硬限，见 templates.ts）'))
    季级规则.push(na(RULES.付费墙10至11集, '付费墙在第 10–11 集', '竖屏规则，横屏不适用（横屏点播，不设按集付费墙）'))
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
