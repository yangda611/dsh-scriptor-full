/**
 * 剧本审读（阶段 2 第四步）：复用现有审读机制（review 注册表）。
 *
 * 现有机制（packages/review/src/registry.ts + checks.ts）：检查模块是
 * { 名称, 审什么, 依赖材料, 执行形态, skill?, 适用范围, run? }，
 * 由 registerCheck 注册进注册表；确定性代码形态的模块带 run(input)。
 * 本文件定义的三个剧本模块就是同一形状——区别只有两点：
 * (1) 适用范围是 '剧本' 不是 '章'（小说审读按章寻址，剧本按场寻址，
 *     见阶段 0.5 的平行寻址键）；(2) 输入是剧本草稿 + 分场大纲，
 *     不是待审小说稿 + 细纲。
 * 所以本文件不 import @webnovel/review（core  import review 会循环依赖：
 * review 包本身依赖 core）。registerScreenplayChecks 接受注册函数作参数
 * （鸭子类型），由协调人在 packages/review/src/checks.ts 里调用，
 * 并决定是否把 registry 的 适用范围 放宽到 '章' | '剧本'。
 *
 * 三个模块（确定性代码，可直接跑；语义深挖走技能底本，见
 * packages/bundle/skills/novel-screenplay/底本/）：
 * 1. 剧本对白审读——角色名全大写、台词非空、括号提示小写短、停顿只用
 *    (pause)、禁用 SFX:/MUSIC: 独占行。
 * 2. 剧本节奏审读——三幕齐全、每幕有转折、开场进冲突、场次下限、
 *    长片页数参考（见 rhythm.ts）。
 * 3. 剧本场次完整性审读——大纲与草稿场场对应、场号连续、每场有动作
 *    或台词、无【待写】占位、内外景已定。
 */

import { checkRhythm, type FilmLength } from './rhythm'
import { validateScreenplay } from './format'
import type { SceneOutline, ScreenplayDraft, ScreenplayFinding } from './types'

export const SCREENPLAY_REVIEW_MODULE_NAMES = ['剧本对白审读', '剧本节奏审读', '剧本场次完整性审读'] as const
export type ScreenplayReviewModuleName = (typeof SCREENPLAY_REVIEW_MODULE_NAMES)[number]

export interface ScreenplayReviewInput {
  readonly 剧本草稿: ScreenplayDraft
  /** 有大纲时加做「大纲—草稿场场对应」检查；没有只审草稿本身。 */
  readonly 分场大纲?: SceneOutline
  readonly 片长?: FilmLength
  readonly 审核编号?: string
}

/**
 * 与 review 注册表 CheckModule 同形的剧本检查模块。
 * 适用范围 '剧本'（见文件头说明）；执行形态一律 '确定性代码'。
 */
export interface ScreenplayCheckModule {
  readonly 名称: ScreenplayReviewModuleName
  readonly 审什么: string
  readonly 依赖材料: readonly string[]
  readonly 执行形态: '确定性代码'
  readonly 适用范围: '剧本'
  run(input: ScreenplayReviewInput): ScreenplayFinding[]
}

function findingId(审核编号: string, 模块名: string, n: number): string {
  return `${审核编号}-${模块名}-${n}`
}

function renumber(findings: ScreenplayFinding[], 审核编号: string, 模块名: string): ScreenplayFinding[] {
  return findings.map((f, i) => ({ ...f, 发现项编号: findingId(审核编号, 模块名, i + 1) }))
}

function runDialogue(input: ScreenplayReviewInput): ScreenplayFinding[] {
  const 审核编号 = input.审核编号 ?? 'screenplay-review'
  const all = validateScreenplay(input.剧本草稿).filter((f) => f.模块名 === '剧本对白审读')
  return renumber(all, 审核编号, '剧本对白审读')
}

function runRhythm(input: ScreenplayReviewInput): ScreenplayFinding[] {
  const 审核编号 = input.审核编号 ?? 'screenplay-review'
  const outline = input.分场大纲
  if (outline === undefined) {
    return [{
      模块名: '剧本节奏审读',
      发现项编号: findingId(审核编号, '剧本节奏审读', 1),
      严重程度: '中',
      是否建议阻断: false,
      证据位置: '分场大纲缺失',
      问题说明: '没有分场大纲，节奏审读只能核对草稿场次下限，不能核对三幕与转折分布',
      修改建议: '传入分场大纲重跑节奏审读。',
      建议返回节点: '剧本改编',
    }]
  }
  return renumber(checkRhythm(outline, input.剧本草稿, input.片长 ?? '长片'), 审核编号, '剧本节奏审读')
}

function runCompleteness(input: ScreenplayReviewInput): ScreenplayFinding[] {
  const 审核编号 = input.审核编号 ?? 'screenplay-review'
  const out: ScreenplayFinding[] = []
  let n = 1
  const formatFindings = validateScreenplay(input.剧本草稿).filter((f) => f.模块名 === '剧本场次完整性审读')
  for (const f of formatFindings) {
    out.push({ ...f, 发现项编号: findingId(审核编号, '剧本场次完整性审读', n++) })
  }
  const outline = input.分场大纲
  if (outline !== undefined) {
    const draftNumbers = new Set(input.剧本草稿.场.map((s) => s.场号))
    for (const scene of outline.场) {
      if (!draftNumbers.has(scene.场号)) {
        out.push({
          模块名: '剧本场次完整性审读',
          发现项编号: findingId(审核编号, '剧本场次完整性审读', n++),
          严重程度: '高',
          是否建议阻断: true,
          证据位置: `场${String(scene.场号).padStart(2, '0')}`,
          问题说明: `分场大纲里有场${String(scene.场号).padStart(2, '0')}（${scene.场景}），剧本草稿里没有这一场`,
          修改建议: '按大纲补写这一场，或修订大纲删掉它（走大纲修订，不静默删场）。',
          建议返回节点: '剧本改编',
        })
      }
    }
    for (const scene of input.剧本草稿.场) {
      if (!outline.场.some((s) => s.场号 === scene.场号)) {
        out.push({
          模块名: '剧本场次完整性审读',
          发现项编号: findingId(审核编号, '剧本场次完整性审读', n++),
          严重程度: '中',
          是否建议阻断: false,
          证据位置: `场${String(scene.场号).padStart(2, '0')}`,
          问题说明: `剧本草稿里有场${String(scene.场号).padStart(2, '0')}，分场大纲里没有：草稿超出了大纲`,
          修改建议: '把这场补进分场大纲，或删掉草稿里这场（以大纲为准）。',
          建议返回节点: '剧本改编',
        })
      }
    }
    // 大纲人物须在草稿里出场：只核对姓名出现，不判戏份。
    const draftText = input.剧本草稿.场.flatMap((s) => [...s.动作, ...s.台词段.map((b) => b.角色), ...s.台词段.flatMap((b) => b.台词)]).join('\n')
    const names = new Set(outline.场.flatMap((s) => s.人物.split(/[、,，]/).map((c) => c.trim()).filter((c) => c !== '')))
    for (const name of names) {
      if (!draftText.includes(name)) {
        out.push({
          模块名: '剧本场次完整性审读',
          发现项编号: findingId(审核编号, '剧本场次完整性审读', n++),
          严重程度: '中',
          是否建议阻断: false,
          证据位置: name,
          问题说明: `大纲人物「${name}」在剧本草稿里一次也没出现`,
          修改建议: '核对是不是漏写了这个人物的场，或修订大纲删掉这个人物。',
          建议返回节点: '剧本改编',
        })
      }
    }
  }
  return out
}

export const 剧本对白审读: ScreenplayCheckModule = {
  名称: '剧本对白审读',
  审什么: '角色名全大写、台词非空、括号提示小写短、停顿只用 (pause)、禁用 SFX:/MUSIC: 独占行',
  依赖材料: ['剧本草稿'],
  执行形态: '确定性代码',
  适用范围: '剧本',
  run: runDialogue,
}

export const 剧本节奏审读: ScreenplayCheckModule = {
  名称: '剧本节奏审读',
  审什么: '三幕齐全、每幕有转折、开场进冲突、场次下限、长片页数参考',
  依赖材料: ['剧本草稿', '分场大纲'],
  执行形态: '确定性代码',
  适用范围: '剧本',
  run: runRhythm,
}

export const 剧本场次完整性审读: ScreenplayCheckModule = {
  名称: '剧本场次完整性审读',
  审什么: '大纲与草稿场场对应、场号连续、每场有动作或台词、无待写占位、内外景已定',
  依赖材料: ['剧本草稿', '分场大纲'],
  执行形态: '确定性代码',
  适用范围: '剧本',
  run: runCompleteness,
}

export const SCREENPLAY_REVIEW_MODULES: readonly ScreenplayCheckModule[] = [剧本对白审读, 剧本节奏审读, 剧本场次完整性审读]

/**
 * 把三个剧本模块注册进 review 注册表。
 * @param register - review 包的 registerCheck（packages/review/src/registry.ts）。
 *   形参用鸭子类型：本文件不 import @webnovel/review，避免 core→review 循环依赖。
 *   注意：registry 的 CheckModule 要求 适用范围: '章'，剧本模块是 '剧本'——
 *   协调人接线时二选一：(a) 把 registry 的 适用范围 放宽为 '章' | '剧本'；
 *   (b) 注册时把 适用范围 写作 '章' 并在 skill 里注明本模块按场寻址。
 *   推荐 (a)，见汇报里的接线代码片段。
 */
export function registerScreenplayChecks(register: (mod: ScreenplayCheckModule) => void): void {
  for (const mod of SCREENPLAY_REVIEW_MODULES) register(mod)
}

export interface ScreenplayReviewResult {
  readonly findings: readonly ScreenplayFinding[]
  readonly 按模块: Readonly<Record<ScreenplayReviewModuleName, readonly ScreenplayFinding[]>>
  /** 任一 高 级别发现项（是否建议阻断）即阻断：不得进定稿。 */
  readonly 是否阻断: boolean
}

/** 跑完三个剧本审读模块，汇总发现项。 */
export function runScreenplayReview(input: ScreenplayReviewInput): ScreenplayReviewResult {
  const 按模块 = {
    剧本对白审读: runDialogue(input),
    剧本节奏审读: runRhythm(input),
    剧本场次完整性审读: runCompleteness(input),
  } as const
  const findings = [...按模块.剧本对白审读, ...按模块.剧本节奏审读, ...按模块.剧本场次完整性审读]
  return { findings, 按模块, 是否阻断: findings.some((f) => f.是否建议阻断) }
}
