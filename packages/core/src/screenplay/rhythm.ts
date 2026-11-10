/**
 * 电影节奏模板（阶段 2）：钩子与爽点（转折）分布规则。
 *
 * 来源（docs/research/film-drama-research.md）：
 * - 长片 90–110 页，“一页 ≈ 一分钟”是经验法则（Final Draft 指南：写满
 *   90–120 页即完成一部剧本；Nicholl 奖规则 80–125 页）；实测研究
 *   （Stephen Follows 对 2,520 部已投产剧本）平均约 55 秒/页，只有 18.2%
 *   的剧本落在“每页一分钟 ±5%”内——整本估算可用，单页不可。
 *   来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/
 *   https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
 * - 组织单位是场（scene），三幕结构；全片数个转折点（不是每集三钩——
 *   那是竖屏短剧的密度，见调研 §2.5 对照表）。
 *   来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/
 *   https://scenemixer.com/guides/vertical-short-drama-script-format/
 * - 对白可长、可潜台词（与短剧“单句 <20 词、每句须推进冲突”不同）。
 *   来源：调研 §2.5 对照表。
 *
 * 工具内约定（调研没给精确数，文件里明说，不冒充调研结论）：
 * - 三幕页占比 25% / 50% / 25%：三幕结构常规配比，仅作分布参考；
 * - 每幕至少一个转折：把“全片数个转折点”落成可检查的下限；
 * - 长片场次下限 10 场：90 分钟全片若少于 10 场，转折密度撑不起三幕。
 * 页数估算见 format.ts estimatePages（渲染行数折算，粗估，仅作参考）。
 */

import type { SceneOutline, ScreenplayDraft, ScreenplayFinding } from './types'
import { estimatePages } from './format'

export type FilmLength = '长片' | '短片'

export interface RhythmActRule {
  readonly 幕: 1 | 2 | 3
  readonly 名称: string
  /** 页占比区间（工具内约定，见文件头）。 */
  readonly 页占比: readonly [number, number]
  readonly 作用: string
  readonly 节拍: readonly string[]
}

export interface FilmRhythmTemplate {
  readonly 总页数: { readonly 下限: number; readonly 上限: number }
  readonly 页数说明: string
  readonly 幕: readonly RhythmActRule[]
  readonly 全片规则: readonly string[]
}

export const FILM_RHYTHM: FilmRhythmTemplate = {
  总页数: { 下限: 90, 上限: 110 },
  页数说明:
    '一页 ≈ 一分钟是经验法则，不是定律：实测平均约 55 秒/页，只有 18.2% 的剧本落在每页一分钟 ±5% 内（Stephen Follows，2,520 部已投产剧本）。整本估算可用，单页不可。',
  幕: [
    {
      幕: 1,
      名称: '第一幕',
      页占比: [0, 0.25],
      作用: '建置：立主角、立世界、立核心冲突；激励事件把主角推出日常。',
      节拍: ['开场钩子：第一场就进核心冲突，不铺场景', '激励事件：主角不得不行动的那个点'],
    },
    {
      幕: 2,
      名称: '第二幕',
      页占比: [0.25, 0.75],
      作用: '对抗：冲突升级，处境不断恶化；中点来一次大反转。',
      节拍: ['中点反转：主角与观众同时发现先前的判断错了', '每幕至少一个转折（工具内约定下限）'],
    },
    {
      幕: 3,
      名称: '第三幕',
      页占比: [0.75, 1],
      作用: '结局：高潮对决，兑现全片承诺；结尾落点与开场呼应。',
      节拍: ['高潮：主角用自己的方式赢下最后一次对决', '结局：兑现故事稿「结尾」写下的变化'],
    },
  ],
  全片规则: [
    '组织单位是场，三幕结构；全片数个转折点（短剧是每集三钩，电影不是）。',
    '对白可长、可潜台词；不要把短剧“单句 <20 词”的规则套到电影上。',
    '音效写进动作行（关键音效词大写）；音乐提示不进编剧层，进阶段 4 分镜头表。',
    '镜头提示在编剧层克制：除非该镜头对理解场景不可或缺，否则不写。',
  ],
}

/** 节奏模板的人话版（供技能文档与作者播报直接引用）。 */
export function describeRhythm(): string {
  const lines: string[] = [
    `电影节奏模板：长片 ${FILM_RHYTHM.总页数.下限}–${FILM_RHYTHM.总页数.上限} 页，一页约一分钟是经验法则（实测约 55 秒/页）。`,
  ]
  for (const act of FILM_RHYTHM.幕) {
    lines.push(`- ${act.名称}（约占全片 ${Math.round(act.页占比[0] * 100)}–${Math.round(act.页占比[1] * 100)}%）：${act.作用}节拍：${act.节拍.join('；')}。`)
  }
  for (const rule of FILM_RHYTHM.全片规则) lines.push(`- ${rule}`)
  return lines.join('\n')
}

function finding(模块名: string, 编号: string, 严重程度: ScreenplayFinding['严重程度'], 证据位置: string, 问题说明: string, 修改建议: string): ScreenplayFinding {
  return {
    模块名,
    发现项编号: 编号,
    严重程度,
    是否建议阻断: 严重程度 === '高',
    证据位置,
    问题说明,
    修改建议,
    建议返回节点: '剧本改编',
  }
}

/**
 * 按节奏模板检查分场大纲 + 剧本草稿。
 * 页数只在长片时检查，且只是「低」级参考发现项（页数估算本身是粗估，
 * 一页一分钟又是经验法则，不能拿它卡通过）；缺幕、缺转折才是硬问题。
 */
export function checkRhythm(outline: SceneOutline, draft: ScreenplayDraft, 片长: FilmLength = '长片'): ScreenplayFinding[] {
  const out: ScreenplayFinding[] = []
  const 模块名 = '剧本节奏审读'
  let n = 1
  for (let a = 1; a <= 3; a++) {
    const scenes = outline.场.filter((s) => s.幕 === a)
    if (scenes.length === 0) {
      out.push(finding(模块名, `rhythm-${n++}`, '高', `第${['一', '二', '三'][a - 1]}幕`, `缺少第${['一', '二', '三'][a - 1]}幕：三幕结构缺一幕`, '按三幕结构补场，分场大纲三幕都要有场。'))
      continue
    }
    if (!scenes.some((s) => s.转折.trim() !== '')) {
      out.push(finding(模块名, `rhythm-${n++}`, '高', `第${['一', '二', '三'][a - 1]}幕`, `第${['一', '二', '三'][a - 1]}幕没有转折：全片数个转折点，每幕至少要有一个`, '给这一幕至少一场写清转折（新信息、立场翻转或危机升级）。'))
    }
  }
  const first = outline.场.find((s) => s.场号 === 1)
  if (first !== undefined && first.冲突.trim() === '') {
    out.push(finding(模块名, `rhythm-${n++}`, '中', '场01', '第一场没有冲突：开场钩子要求第一场就进核心冲突，不铺场景', '第一场直接写冲突本身，不要先铺场景或自我介绍。'))
  }
  const minScenes = 片长 === '长片' ? 10 : 3
  if (draft.场.length < minScenes) {
    out.push(finding(模块名, `rhythm-${n++}`, '中', `全片 ${draft.场.length} 场`, `${片长}只有 ${draft.场.length} 场，少于 ${minScenes} 场的下限（工具内约定）：转折密度撑不起三幕`, '按分场大纲补场，或核对是不是大纲本身场次就不足。'))
  }
  if (片长 === '长片') {
    const pages = estimatePages(draft)
    if (pages < FILM_RHYTHM.总页数.下限 || pages > FILM_RHYTHM.总页数.上限) {
      out.push(finding(
        模块名,
        `rhythm-${n++}`,
        '低',
        `估算 ${pages} 页`,
        `长片估算 ${pages} 页，落在 ${FILM_RHYTHM.总页数.下限}–${FILM_RHYTHM.总页数.上限} 页之外。注意：一页约一分钟只是经验法则（实测约 55 秒/页），页数估算本身也是粗估，只作参考，不卡通过。`,
        '按节奏模板核对三幕分布是不是失衡（第一幕约 25%、第二幕约 50%、第三幕约 25%），再决定增删场次。',
      ))
    }
  }
  return out
}
