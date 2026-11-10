/**
 * 单集剧本（阶段 3 第二步）：编剧层分场景格式。
 *
 * 与阶段 2 同一套场景标题/动作/角色/台词/括号提示规范（中文分场景剧本约定俗成写法）：
 * - 场景标题：`场号. 地点 时间 内/外`，如 `场01. 会议室 日 内`
 *   （来源：https://amber-zhang.ghost.io/fen-chang-jing-ju-ben-ge-shi/ ；
 *   美式三段式 INT./EXT. + 地点 + 时间见调研 §1.1，本工具出中文版）。
 * - 动作行：现在时、只写看得见/听得见的；角色首次出场姓名全大写改为中文习惯——
 *   首次出场在动作行里写清年龄/身份/外表（同上来源）。
 * - 对白：`说话人：内容`，说话人放句首、冒号后为说话内容。
 * - 括号提示：小写、简短、少用，只在台词本身无法传达语气/对象时才用。
 *
 * 停顿约定（本模块选定，协调人统一）：
 * 台词停顿只用 `(pause)`，不用 `(beat)`。理由：三方来源对 `(beat)` 的用法本身有
 * 分歧，ScreenCraft 明确反对用 `(beat)` 表示停顿（beat 在表演术语里含义不止
 * “停顿”），主张写 `(pause)` 或用动作行说明停顿原因
 * （来源：https://screencraft.org/blog/10-things-to-delete-from-your-dialogue-scenes-right-now/ ；
 * 另见 https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue）。
 * 若阶段 2（电影剧本）选了另一种写法，以协调人统一的为准——本模块只改
 * PAUSE_MARK 这一处常量即可全量切换。
 * 写法：停顿写在角色名后的括号里，如 `顾霆琛(pause)：再说一遍？`
 * 省略号 `...` 只表示拖长/欲言又止，不表示打断；被打断的台词行尾用 `--`。
 *
 * 对白要短：中文指南约每行 <12 字（来源：调研 §2.2）。超长台词不丢稿，
 * 渲染结果带警告，归短剧审读处置。
 */

import { paths } from '../repo/paths'
import { RHYTHM_TEMPLATES } from './templates'
import {
  type EpisodeScriptInput,
  type RenderedEpisodeScript,
  type ScriptLine,
  type ScriptScene,
} from './types'

/** 停顿标记：只用 `(pause)`，不用 `(beat)`（见文件头约定）。 */
export const PAUSE_MARK = '(pause)'

/** 单句台词上限（字）：中文指南约每句 <12 字（调研 §2.2）。 */
export const MAX_DIALOGUE_CHARS = 12

/** 台词字数：数非空白字符（中文按字计，含标点）。 */
export function dialogueChars(line: string): number {
  return [...line].filter((ch) => !/\s/.test(ch)).length
}

/** 一集台词总字数（竖屏 180–360 字，见 templates.ts）。 */
export function totalDialogueChars(scenes: readonly ScriptScene[]): number {
  let n = 0
  for (const scene of scenes) for (const line of scene.台词) n += dialogueChars(line.台词)
  return n
}

/** 括号提示是否用了 (beat)（裸写 beat、半角/全角括号都算）。 */
export function isBeatMark(mark: string): boolean {
  const m = mark.trim()
  return m === 'beat' || m.includes('(beat)') || m.includes('（beat）')
}

function fail(message: string): never {
  throw new Error(`单集剧本渲染失败：${message}`)
}

function validate(input: EpisodeScriptInput): string[] {
  const warnings: string[] = []
  const template = RHYTHM_TEMPLATES[input.画幅]
  if (!Number.isSafeInteger(input.集) || input.集 < 1 || input.集 > 100) {
    fail(`集号须在 1–100 之间（收到：${String(input.集)}）`)
  }
  if (input.标题.trim() === '') fail(`集${input.集}：标题不能为空`)
  if (input.核心想法.trim() === '') fail(`集${input.集}：核心想法不能为空（一集一个想法）`)
  if (input.爽点.trim() === '') fail(`集${input.集}：爽点不能为空`)
  if (input.结尾悬念.trim() === '') fail(`集${input.集}：结尾悬念不能为空`)
  if (!Number.isFinite(input.时长秒) || input.时长秒 < template.单集时长秒[0] || input.时长秒 > template.单集时长秒[1]) {
    fail(`集${input.集}：${input.画幅}单集时长须在 ${template.单集时长秒[0]}–${template.单集时长秒[1]} 秒之间（收到：${input.时长秒}）`)
  }
  if (input.场景.length === 0) fail(`集${input.集}：至少要有一场`)
  if (template.每集场景数 !== null) {
    const [min, max] = template.每集场景数
    if (input.场景.length < min || input.场景.length > max) {
      fail(`集${input.集}：${input.画幅}每集 ${min}–${max} 场（收到：${input.场景.length} 场）`)
    }
  }
  const seen = new Set<number>()
  for (const scene of input.场景) {
    if (!Number.isSafeInteger(scene.场) || scene.场 < 1) fail(`集${input.集}：场号必须是正整数（收到：${String(scene.场)}）`)
    if (seen.has(scene.场)) fail(`集${input.集}：场号 ${scene.场} 重复`)
    seen.add(scene.场)
    if (scene.地点.trim() === '' || scene.时间.trim() === '') fail(`集${input.集} 场${scene.场}：地点与时间不能为空`)
    if (scene.动作.trim() === '') fail(`集${input.集} 场${scene.场}：动作行不能为空`)
    for (const line of scene.台词) {
      if (line.角色.trim() === '') fail(`集${input.集} 场${scene.场}：台词缺少说话人`)
      if (line.台词.trim() === '') fail(`集${input.集} 场${scene.场}：${line.角色}的台词为空`)
      const n = dialogueChars(line.台词)
      if (n > MAX_DIALOGUE_CHARS) {
        warnings.push(`集${input.集} 场${scene.场} ${line.角色}：台词 ${n} 字，超过单句 ${MAX_DIALOGUE_CHARS} 字上限——「${line.台词}」`)
      }
      if (line.括号提示 !== undefined) {
        if (isBeatMark(line.括号提示)) {
          warnings.push(`集${input.集} 场${scene.场} ${line.角色}：括号提示用了 (beat)，本工具停顿只用 ${PAUSE_MARK}，请改写`)
        }
        if (line.括号提示.trim() === '') warnings.push(`集${input.集} 场${scene.场} ${line.角色}：括号提示为空，请去掉`)
      }
    }
  }
  const sorted = [...input.场景].map((s) => s.场).sort((a, b) => a - b)
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) fail(`集${input.集}：场号须从 1 起连续（收到：${sorted.join('、')}）`)
  }
  return warnings
}

function renderLine(line: ScriptLine): string {
  const mark = line.括号提示 === undefined ? '' : `(${line.括号提示})`
  return `${line.角色}${mark}：${line.台词}`
}

/**
 * 渲染一场（`## 场01. 地点 时间 内外` + 动作 + 台词），供 renderEpisodeScript
 * 与阶段 4 剧本导出复用同一口径；改动渲染格式时只改这里。
 */
export function renderEpisodeSceneBlock(scene: ScriptScene): string {
  const sceneNo = String(scene.场).padStart(2, '0')
  const lines: string[] = [`## 场${sceneNo}. ${scene.地点} ${scene.时间} ${scene.内外}`, '', scene.动作, '']
  for (const line of scene.台词) lines.push(renderLine(line))
  lines.push('')
  return lines.join('\n')
}

/** 渲染「节拍表」小节（开场冲突/反转/结尾钩子），与 renderEpisodeScript 同一口径。 */
export function renderEpisodeBeatTable(input: EpisodeScriptInput): string {
  return [
    '## 节拍表',
    '',
    `- 开场冲突：第 ${input.开场冲突秒} 秒`,
    `- 反转：${input.反转秒.map((s) => `第 ${s} 秒`).join('、') || '无'}`,
    `- 结尾钩子：第 ${input.结尾钩子秒} 秒（切在问题上）`,
    '',
  ].join('\n')
}

/** 渲染一集剧本（编剧层分场景格式）。定稿路径用 paths.短剧集(集号)。 */
export function renderEpisodeScript(input: EpisodeScriptInput): RenderedEpisodeScript {
  const warnings = validate(input)
  const template = RHYTHM_TEMPLATES[input.画幅]
  const epNo = String(input.集).padStart(3, '0')
  const lines: string[] = [
    `# 集${epNo}：${input.标题}`,
    '',
    `- 画幅：${input.画幅}（${template.画幅比}）`,
    `- 时长：${input.时长秒} 秒`,
    `- 钩子类型：${input.钩子类型}`,
    `- 核心想法：${input.核心想法}`,
    `- 爽点：${input.爽点}`,
    `- 台词字数：${totalDialogueChars(input.场景)} 字`,
    `- 结尾悬念：${input.结尾悬念}`,
    '',
  ]
  for (const scene of [...input.场景].sort((a, b) => a.场 - b.场)) lines.push(renderEpisodeSceneBlock(scene))
  lines.push(renderEpisodeBeatTable(input))
  return {
    path: paths.短剧集(input.集),
    内容: `${lines.join('\n').replace(/\n+$/, '')}\n`,
    警告: warnings,
  }
}

export interface EpisodeParseResult {
  readonly ok: boolean
  readonly episode?: EpisodeScriptInput
  readonly problems: readonly string[]
}

const EPISODE_TITLE_RE = /^#\s*集(\d+)\s*[：:]\s*(.+?)\s*$/
const EPISODE_SCENE_RE = /^##\s*场(\d+)\s*\.\s*(.+?)\s*$/
const EPISODE_DIALOGUE_RE = /^([^：:（(]{1,15}?)(?:[（(]([^）)]+)[）)])?[：:](.+)$/
const EPISODE_BEAT_OPEN_RE = /^-\s*开场冲突：\s*第\s*(\d+)\s*秒/
const EPISODE_BEAT_HOOK_RE = /^-\s*结尾钩子：\s*第\s*(\d+)\s*秒/

function episodeMetaValue(lines: readonly string[], label: string): string | undefined {
  for (const line of lines) {
    const m = new RegExp(`^-\\s*${label}[：:]\\s*(.+?)\\s*$`).exec(line)
    if (m) return m[1]!.trim()
  }
  return undefined
}

/**
 * 解析一集短剧剧本（renderEpisodeScript 的输出格式）。
 *
 * 约定：场景标题后第一行非空行是动作行，其后 `角色：台词` / `角色(pause)：台词`
 * 为台词行；`## 节拍表` 给出开场冲突/反转/结尾钩子秒数。`SFX:` / `MUSIC:` 独占行
 * 与 `(beat)` 一律记解析问题（与电影剧本同一口径：前者是广播剧格式，后者停顿
 * 只用 `(pause)`）。横屏专用的 首场冲突 / 起承转合 不写进集文本，解析结果不含
 * 这两项（导出时不依赖它们）。解析后用 renderEpisodeScript 重渲染一次校验：
 * 结构非法（集号越界、场号不连续、时长越界等）直接报问题。
 */
export function parseEpisodeScript(text: string): EpisodeParseResult {
  const problems: string[] = []
  const fail = (): EpisodeParseResult => ({ ok: false, problems })
  const rawLines = text.replace(/\r\n/g, '\n').split('\n')
  const lines = rawLines.map((l) => l.trim())
  let 集 = 0
  let 标题 = ''
  for (const line of lines) {
    if (line === '') continue
    const m = EPISODE_TITLE_RE.exec(line)
    if (m) {
      集 = Number(m[1])
      标题 = m[2]!.trim()
    } else if (line.startsWith('#')) {
      problems.push(`集标题格式不对：应为「# 集001：标题」，收到「${line.slice(0, 20)}」`)
    }
    break
  }
  if (集 === 0) problems.push('单集剧本缺少集标题（# 集001：标题）')
  if (标题 === '') problems.push('单集剧本缺少集标题（# 集001：标题）')
  const 画幅raw = episodeMetaValue(lines, '画幅')
  const 画幅 = 画幅raw === undefined ? undefined : (画幅raw.split('（')[0] ?? '').trim()
  if (画幅 !== '竖屏' && 画幅 !== '横屏') problems.push(`单集剧本缺少或写错画幅（应为 竖屏 或 横屏）：${画幅raw ?? '无'}`)
  const 时长raw = episodeMetaValue(lines, '时长')
  const 时长秒 = 时长raw === undefined ? NaN : Number(/(\d+)/.exec(时长raw)?.[1])
  const 钩子类型 = episodeMetaValue(lines, '钩子类型')
  if (钩子类型 !== '身份' && 钩子类型 !== '情感' && 钩子类型 !== '顿悟') problems.push(`单集剧本缺少或写错钩子类型（身份/情感/顿悟）：${钩子类型 ?? '无'}`)
  const 核心想法 = episodeMetaValue(lines, '核心想法') ?? ''
  const 爽点 = episodeMetaValue(lines, '爽点') ?? ''
  const 结尾悬念 = episodeMetaValue(lines, '结尾悬念') ?? ''
  if (核心想法 === '') problems.push('单集剧本缺少核心想法（一集一个想法）')
  if (爽点 === '') problems.push('单集剧本缺少爽点')
  if (结尾悬念 === '') problems.push('单集剧本缺少结尾悬念（须是问题，不是答案）')

  const 场景: ScriptScene[] = []
  let current: { 场: number; 地点: string; 时间: string; 内外: '内' | '外'; 动作: string; 台词: ScriptLine[] } | null = null
  let inBeats = false
  let 开场冲突秒 = NaN
  let 反转秒: number[] = []
  let 结尾钩子秒 = NaN
  const flushScene = (): void => {
    if (current !== null) {
      场景.push({ 场: current.场, 地点: current.地点, 时间: current.时间, 内外: current.内外, 动作: current.动作, 台词: current.台词 })
    }
    current = null
  }
  for (const line of lines) {
    if (line === '') continue
    if (/^SFX:|^MUSIC:/.test(line)) {
      problems.push(`用了 \`SFX:\` / \`MUSIC:\` 独占一行：这是 BBC 广播剧格式，不是电影/短剧剧本格式（音效写进动作行，音乐提示进分镜头表）`)
      continue
    }
    if (line === '## 节拍表') {
      flushScene()
      inBeats = true
      continue
    }
    const sceneMatch = EPISODE_SCENE_RE.exec(line)
    if (sceneMatch) {
      flushScene()
      inBeats = false
      const rest = sceneMatch[2]!.trim()
      const parts = rest.split(/\s+/)
      const 内外raw = parts[parts.length - 1]
      const 时间 = parts[parts.length - 2] ?? ''
      const 地点 = parts.slice(0, -2).join(' ')
      if (内外raw !== '内' && 内外raw !== '外') {
        problems.push(`场${sceneMatch[1]} 场景标题缺少内/外：应为「场01. 地点 时间 内/外」`)
        continue
      }
      if (地点 === '' || 时间 === '') {
        problems.push(`场${sceneMatch[1]} 场景标题不完整：应为「场01. 地点 时间 内/外」`)
        continue
      }
      current = { 场: Number(sceneMatch[1]), 地点, 时间, 内外: 内外raw, 动作: '', 台词: [] }
      continue
    }
    if (inBeats) {
      const open = EPISODE_BEAT_OPEN_RE.exec(line)
      if (open) {
        开场冲突秒 = Number(open[1])
        continue
      }
      const hook = EPISODE_BEAT_HOOK_RE.exec(line)
      if (hook) {
        结尾钩子秒 = Number(hook[1])
        continue
      }
      const twist = /^-\s*反转[：:]\s*(.+?)\s*$/.exec(line)
      if (twist) {
        const value = twist[1]!.trim()
        反转秒 = value === '无' ? [] : [...value.matchAll(/第\s*(\d+)\s*秒/g)].map((m) => Number(m[1]))
        continue
      }
      continue
    }
    if (line.startsWith('#') || line.startsWith('- ')) continue
    if (current === null) {
      problems.push(`场景标题之外出现正文「${line.slice(0, 20)}……」：单集剧本正文必须先有场景标题`)
      continue
    }
    if (current.动作 === '') {
      current.动作 = line
      continue
    }
    const dialogue = EPISODE_DIALOGUE_RE.exec(line)
    if (dialogue === null) {
      problems.push(`场${String(current.场).padStart(2, '0')} 有一行既不是动作也不是「角色：台词」：「${line.slice(0, 20)}……」`)
      continue
    }
    const mark = dialogue[2]
    if (mark !== undefined && isBeatMark(mark)) {
      problems.push(`场${String(current.场).padStart(2, '0')} ${dialogue[1]}：括号提示用了 (beat)，停顿只用 ${PAUSE_MARK}`)
    }
    current.台词.push({
      角色: dialogue[1]!.trim(),
      ...(mark !== undefined ? { 括号提示: mark.trim() } : {}),
      台词: dialogue[3]!.trim(),
    })
  }
  flushScene()
  if (场景.length === 0) problems.push('单集剧本里没有场景（## 场01. 地点 时间 内/外）')
  if (Number.isNaN(开场冲突秒)) problems.push('单集剧本缺少节拍表开场冲突秒数')
  if (Number.isNaN(结尾钩子秒)) problems.push('单集剧本缺少节拍表结尾钩子秒数')
  if (problems.length > 0) return fail()
  const episode: EpisodeScriptInput = {
    集, 标题, 画幅: 画幅 as '竖屏' | '横屏', 钩子类型: 钩子类型 as '身份' | '情感' | '顿悟',
    核心想法, 爽点, 时长秒, 场景, 结尾悬念, 开场冲突秒, 反转秒, 结尾钩子秒,
  }
  try {
    renderEpisodeScript(episode)
  } catch (err) {
    problems.push(`单集剧本结构校验失败：${err instanceof Error ? err.message : String(err)}`)
    return fail()
  }
  return { ok: true, problems, episode }
}
