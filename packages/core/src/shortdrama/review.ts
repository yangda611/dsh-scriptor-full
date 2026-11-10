/**
 * 短剧审读（阶段 3 第三步）：复用现有审读机制，加短剧审读检查。
 *
 * 接线（2026-11-11 阶段 2/3 后续轮次）：本模块已注册进共享审读注册表
 * （packages/review/src/film-drama.ts 的 `短剧审读`，适用范围 集），
 * 与 `短剧审读（语义）` 合流；审读记录按集寻址，落
 * 草稿区/审核/审-集NNN.json（见 packages/core/src/evidence/record.ts）。
 * - 确定性检查由本文件的 reviewShortDramaEpisode 做：台词长度、台词总量、场景数、
 *   钩子/大纲一致性、节拍表与大纲的对应——不读正文猜测，只算数。
 * - 发现项沿用现有审读的词汇：模块名 `短剧审读`，字段与 packages/core/src/evidence/record.ts
 *   的 Finding 同义（审核编号/发现项编号/证据位置/严重程度/是否建议阻断/问题说明/
 *   修改建议/建议返回节点/处置状态），由 `novel_record_review_findings`
 *   （适用范围 集）回写。
 * - 语义审读（对白是否即行动、爽点是否成立、人物是否前后一致、题材禁忌是否踩线）
 *   不由代码判定，见技能底本 packages/bundle/skills/novel-shortdrama/底本/短剧审读.md，
 *   由隔离派发按底本执行，与 novel-review 的 8 维底本同一派发方式。
 * - 空审 fail-closed：本函数返回空数组只表示确定性检查零发现，不表示审读通过；
 *   语义底本的回写仍须经 novel_record_review_findings 落盘后才算完成（与全量审读同理）。
 */

import { requiredTurns } from './beat-checker'
import { RHYTHM_TEMPLATES } from './templates'
import {
  MAX_DIALOGUE_CHARS,
  PAUSE_MARK,
  dialogueChars,
  isBeatMark,
  sceneDialogueLines,
  totalDialogueChars,
} from './script'
import type { EpisodeOutline, EpisodeScriptInput } from './types'

/** 短剧审读发现项（与 Finding 同义的子集；编号由回写通道分配，这里只给内容）。 */
export interface ShortDramaFinding {
  /** 固定 `短剧审读`（回写用的模块名）。 */
  readonly 模块名: '短剧审读'
  /** 证据位置：`集001` / `集001/场01` / `集001/节拍表`。 */
  readonly 证据位置: string
  readonly 严重程度: string
  readonly 是否建议阻断: boolean
  readonly 问题说明: string
  readonly 修改建议: string
  /** 建议返回的节点：`分集大纲` / `单集剧本`。 */
  readonly 建议返回节点: '分集大纲' | '单集剧本'
  readonly 处置状态: '待处理'
}

export interface ShortDramaReviewInput {
  /** 单集剧本（与 renderEpisodeScript 的输入同一形状）。 */
  readonly 剧本: EpisodeScriptInput
  /** 对应的分集大纲（核对钩子类型/核心想法/爽点/反转数是否一致）。 */
  readonly 大纲: EpisodeOutline
}

function epNo(集: number): string {
  return `集${String(集).padStart(3, '0')}`
}

function sceneNo(场: number): string {
  return `场${String(场).padStart(2, '0')}`
}

/** 确定性短剧审读：只算数，不猜语义。返回发现项（空数组 = 确定性检查零发现）。 */
export function reviewShortDramaEpisode(input: ShortDramaReviewInput): ShortDramaFinding[] {
  const { 剧本, 大纲 } = input
  const findings: ShortDramaFinding[] = []
  const push = (
    证据位置: string,
    严重程度: string,
    是否建议阻断: boolean,
    问题说明: string,
    修改建议: string,
    建议返回节点: '分集大纲' | '单集剧本',
  ): void => {
    findings.push({ 模块名: '短剧审读', 证据位置, 严重程度, 是否建议阻断, 问题说明, 修改建议, 建议返回节点, 处置状态: '待处理' })
  }
  const ep = epNo(剧本.集)
  const template = RHYTHM_TEMPLATES[剧本.画幅]

  // 1. 大纲一致性：钩子类型、核心想法、爽点、反转数。
  if (剧本.钩子类型 !== 大纲.钩子类型) {
    push(ep, '高', true, `钩子类型与大纲不一致：剧本是「${剧本.钩子类型}」，大纲是「${大纲.钩子类型}」。`, '按大纲改剧本结尾钩子，或回分集大纲改钩子排布（轮换不能断）。', '分集大纲')
  }
  if (剧本.核心想法.trim() !== 大纲.核心想法.trim()) {
    push(ep, '高', true, '核心想法与大纲不一致：一集只容一个想法，剧本与大纲说的不是同一件事。', '以大纲为准改剧本，或回分集大纲改核心想法；两边必须同一句话。', '分集大纲')
  }
  if (剧本.爽点.trim() !== 大纲.爽点.trim()) {
    push(ep, '中', false, '爽点与大纲不一致：剧本的爽点不是大纲定的那个。', '以大纲为准改剧本，或回分集大纲改爽点。', '分集大纲')
  }
  if (剧本.反转秒.length < 大纲.反转.length) {
    push(`${ep}/节拍表`, '中', false, `反转数不足：大纲定了 ${大纲.反转.length} 个反转，节拍表只有 ${剧本.反转秒.length} 个时间点。`, `补反转时间点，或回分集大纲减反转（${剧本.时长秒} 秒一集至少 ${requiredTurns(剧本.时长秒)} 个，按时长缩放）。`, '单集剧本')
  }

  // 2. 场景数（竖屏 2–4 场）。
  if (template.每集场景数 !== null) {
    const [min, max] = template.每集场景数
    if (剧本.场景.length < min || 剧本.场景.length > max) {
      push(ep, '中', false, `${剧本.画幅}每集 ${min}–${max} 场，本集 ${剧本.场景.length} 场。`, min === max ? `改成 ${min} 场。` : `合并或拆分到 ${min}–${max} 场。`, '单集剧本')
    }
  }

  // 3. 台词：单句超长、总量越界（竖屏 180–360 字）。
  for (const scene of 剧本.场景) {
    for (const line of sceneDialogueLines(scene)) {
      const n = dialogueChars(line.台词)
      if (n > MAX_DIALOGUE_CHARS) {
        push(
          `${ep}/${sceneNo(scene.场)}`,
          '中',
          false,
          `${line.角色}的台词 ${n} 字，超过单句 ${MAX_DIALOGUE_CHARS} 字上限：「${line.台词}」。`,
          '拆成两句短台词，或改成动作行（对白即行动，短句才有力）。',
          '单集剧本',
        )
      }
      if (line.括号提示 !== undefined && isBeatMark(line.括号提示)) {
        push(
          `${ep}/${sceneNo(scene.场)}`,
          '低',
          false,
          `${line.角色}的括号提示用了 (beat)，本工具停顿只用 ${PAUSE_MARK}。`,
          `把 (beat) 改成 ${PAUSE_MARK}，或用动作行说明停顿原因。`,
          '单集剧本',
        )
      }
    }
  }
  const total = totalDialogueChars(剧本.场景)
  if (template.台词字数 !== null) {
    const [min, max] = template.台词字数
    if (total < min || total > max) {
      push(ep, '中', false, `台词总量 ${total} 字，超出${剧本.画幅}范围 ${min}–${max} 字。`, total < min ? '加一场冲突对白，或把旁白改成台词。' : '删寒暄与背景交代台词，只留推进冲突或揭示人物的句子。', '单集剧本')
    }
  }

  // 4. 节拍表与大纲的对应：开场冲突、结尾悬念是否还在。
  if (剧本.开场冲突秒 < 0 || 剧本.开场冲突秒 > 剧本.时长秒) {
    push(`${ep}/节拍表`, '高', true, `开场冲突秒 ${剧本.开场冲突秒} 不在单集时长 0–${剧本.时长秒} 秒内。`, '修正节拍表时间点。', '单集剧本')
  }
  if (剧本.结尾钩子秒 < 0 || 剧本.结尾钩子秒 > 剧本.时长秒) {
    push(`${ep}/节拍表`, '高', true, `结尾钩子秒 ${剧本.结尾钩子秒} 不在单集时长 0–${剧本.时长秒} 秒内。`, '修正节拍表时间点。', '单集剧本')
  }
  if (剧本.结尾悬念.trim() !== 大纲.结尾悬念.trim()) {
    push(ep, '高', true, '结尾悬念与大纲不一致：必须切在同一个问题上。', '以大纲为准改剧本结尾，或回分集大纲改悬念。', '分集大纲')
  }

  return findings
}

/** 短剧审读模块注册信息（供协调人登记进 review 注册表时照抄）。 */
export const SHORTDRAMA_REVIEW_MODULE = {
  名称: '短剧审读',
  审什么: '短剧单集剧本的确定性检查（台词长度/总量、场景数、钩子与大纲一致性、节拍表对应）+ 语义审读（底本派发：对白即行动、爽点成立、人物一致、题材禁忌）',
  依赖材料: ['分集大纲', '单集剧本', '题材库对应档'],
  执行形态: '确定性代码 + 隔离派发',
  skill: 'novel-shortdrama',
  适用范围: '集',
} as const
