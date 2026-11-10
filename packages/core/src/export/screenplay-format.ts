/**
 * 专业剧本导出格式（阶段 4，muse-dev）：Fountain / Markdown 双输出渲染器 +
 * 导演层分镜头表。
 *
 * 两层分开，绝不混写（调研 docs/research/film-drama-research.md §1.3）：
 * - 编剧层（分场景剧本）：场景标题 + 动作行 + 角色名 + 台词 + 括号提示。
 *   Fountain 输出是这一层的纯文本标准格式；Markdown 输出把同一层嵌进
 *   `## 编剧层`，正文与定稿逐字一致。
 * - 导演层（分镜头表）：镜号 / 场 / 景别 / 角度 / 运镜 / 时间 / 时长（秒）/
 *   画面内容 / 台词 / 对白标注 / 音响 / 字幕 / 音乐，一律以 Markdown 表格出（调研 §1.2：
 *   分镜头剧本大多采用表格形式，栏目含镜号、景别、摄法、长度、内容、音响、
 *   音乐；来源：https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031 ，
 *   https://blog.csdn.net/Dontla/article/details/105735904）。
 *   对齐轮次（按《痴迷》参考案例）：`摄法` 栏改为 `角度`（案例角度词如平视正面/
 *   侧面平视/俯拍），另加 `时间`（MM:SS—MM:SS，集内累计）、`对白标注`
 *   （语速/音量/语调/尾音）、`字幕` 三栏；旧版 10 列分镜头表仍可解析（摄法→角度，
 *   新增三栏填 `—`），渲染一律出新版 13 列。
 *
 * 音效与音乐（调研 §1.3）：
 * - 编剧层：音效只写进动作行（关键音效词明确提示）；`SFX:` / `MUSIC:` 独占
 *   一行是 BBC 广播剧格式，不是电影剧本格式，渲染器不产生这种行，校验发现
 *   一律报问题（来源：https://epicscribe.io/blog/writing-sound-effects-audio-drama-scripts）。
 * - 导演层：音响 / 音乐各单列一栏，由导演填；电影剧本层音乐没有统一强制格式，
 *   本工具自定为分镜头表音乐栏（调研 §1.3 已注明“工具内需自定”）。
 * - 停顿只用 `(pause)`，`(beat)` 禁用（ScreenCraft，见 screenplay/format.ts）。
 *
 * 景别词汇（调研 §1.2，来源：https://openbooks.fitchburgstate.edu/preproduction/chapter/the-shot-list/）：
 * 极远景 EWS / 远景 WS / 中远景 MWS / 全景 / 中景 MS / 中近景 MCU /
 * 特写 CU / 大特写 ECU。校验只提醒不在词汇里的写法，不判错——中文分镜头
 * 表的景别写法本就以全景/中景/近景/特写为主（来源同上分镜头剧本条）。
 *
 * 分镜头表两种来源：
 * - 导演已填的表：用 parseShotListTable 从 Markdown 表格读回（CLI 的 --分镜头）。
 * - 没给表：deriveShotListTemplate 按场生成待填模板行（景别/角度/运镜/
 *   音响/字幕/音乐填 `—`，时长与时间空着），只给镜号、场号、画面内容与首句台词——
 *   工具不编造导演的景别与运镜决定，待填项进警告，不进错误。
 *
 * 总纲（剧本圣经）渲染器（对齐轮次，结构取自《痴迷》参考案例
 * docs/examples/痴迷-12集分镜剧本-参考案例.docx 第一部分）：
 * 固定七节——类型/形式/文字目标/叙事线 → 故事一句话 → 开篇承诺与中心问题 →
 * 世界硬约束与地理 → 三段核心真相 → 主要人物与人物弧（含曾误标统一记录）→
 * 分集结构与时间锚点。语言规则与分镜剧本同一条：说明/场景/动作文字一律中文，
 * 对白按目标市场语言（总纲 `对白语言` 字段写明，如海外题材为英文）。
 *
 * 人名注册表 + 导出前一致性检查（对齐轮次）：总纲第五节维护全剧统一的人名
 * 注册表（标准名 + 曾误标名清单）；导出前检查全剧人名必须在册且只用标准名，
 * 未登记/误标要报错，不准静默输出（见 buildCharacterRegistry /
 * checkCharacterNames，computeScreenplayExport 在传了 总纲 时执行）。
 *
 * 本模块只渲染、不落盘、不改书仓；确定性输出（无时间戳），同一输入重复
 * 渲染字节相同。
 */

import { estimatePages, renderScreenplay } from '../screenplay/format'
import type { ScreenplayDraft, ScreenplayScene } from '../screenplay/types'
import { RHYTHM_TEMPLATES } from '../shortdrama/templates'
import {
  SHOT_ANGLE_VOCAB,
  SHOT_MOVEMENT_VOCAB,
  SHOT_SIZE_VOCAB,
  countEpisodeShots,
  parseTimecode,
  renderEpisodeBeatTable,
  renderEpisodeSceneBlock,
  sceneDialogueLines,
  totalDialogueChars,
  EPISODE_FADE_OUT,
} from '../shortdrama/script'
import type { EpisodeScriptInput } from '../shortdrama/types'

/** 景别词汇（调研 §1.2；中文常用写法 + 英文缩写都认）。 */
export const SHOT_SIZE_TOKENS = [
  '极远景', '远景', '中远景', '全景', '中景', '中近景', '近景', '特写', '大特写',
  'EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU',
] as const

/** 分镜头表表头（固定列序，解析与渲染共用同一口径；对齐轮次 13 列）。 */
export const SHOT_TABLE_HEADERS = [
  '镜号', '场', '景别', '角度', '运镜', '时间', '时长（秒）', '画面内容', '台词', '对白标注', '音响', '字幕', '音乐',
] as const

/** 旧版分镜头表表头（阶段 4，10 列）：解析时仍接受，`摄法` 映射为 `角度`，新增栏填 `—`。 */
export const LEGACY_SHOT_TABLE_HEADERS = ['镜号', '场', '景别', '摄法', '运镜', '时长（秒）', '画面内容', '台词', '音响', '音乐'] as const

/** 分镜头表里的一镜。`—` 表示该栏待填/无（模板行与无台词、无音响、无音乐的镜都这么写）。 */
export interface ShotListRow {
  readonly 镜号: number
  readonly 场号: number
  readonly 景别: string
  /** 角度（如平视正面 / 侧面平视 / 俯拍；对齐轮次，旧版 `摄法` 栏改名）。 */
  readonly 角度: string
  readonly 运镜: string
  /** 时间码 `MM:SS—MM:SS`（集内累计）；未知填 `—`。 */
  readonly 时间: string
  /** 单镜时长（秒）；未知填 null，渲染为 `—`。 */
  readonly 时长秒: number | null
  readonly 画面内容: string
  readonly 台词: string
  /** 对白表演标注（语速/音量/语调/尾音，如「语速较慢，音量偏低，语调平稳柔和，尾音轻落」）；无标注填 `—`。 */
  readonly 对白标注: string
  readonly 音响: string
  /** 字幕文字；无字幕填 `—`。 */
  readonly 字幕: string
  readonly 音乐: string
}

/** 一份分镜头表：标题 + 按镜号升序的镜。 */
export interface ShotList {
  readonly 标题: string
  readonly 镜: readonly ShotListRow[]
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 时间码范围 `MM:SS—MM:SS` 是否合法（开始早于结束；`—` 由调用方先排除）。 */
export function isValidTimeRange(value: string): boolean {
  const parts = value.trim().split(/[—-]/)
  if (parts.length !== 2) return false
  const start = parseTimecode(parts[0]!)
  const end = parseTimecode(parts[1]!)
  return start !== null && end !== null && start < end
}

function fountainSlugline(scene: ScreenplayScene): string {
  const interior = scene.标题.内外.endsWith('.') ? scene.标题.内外 : `${scene.标题.内外}.`
  return `${interior} ${scene.标题.地点} - ${scene.标题.时间}`
}

function checkNoBroadcastRows(text: string, problems: string[]): void {
  for (const line of text.split('\n')) {
    if (/^SFX:|^MUSIC:/.test(line.trim())) {
      problems.push(`导出文本含 \`SFX:\` / \`MUSIC:\` 独占行：这是 BBC 广播剧格式，不进电影剧本（音效写进动作行，音乐提示进分镜头表）`)
      return
    }
  }
}

/**
 * 渲染电影剧本 Fountain（编剧层纯文本）。
 * Fountain 约定：标题页 `Title:` / `Credit:`；场景标题三段式全大写；
 * 角色名独占一行（本工具角色名已全大写，见 validateScreenplay）；括号提示
 * 原样跟在角色名后；台词无引号；`FADE IN:` 开场、`FADE OUT.` 收尾。
 * 场号不进场景标题行（Fountain 场景标题无场号），以 `/* 场01 *\/` 注释行
 * 保留场号对应关系（Fountain boneyard 注释，渲染时忽略）。
 */
export function renderFountainScreenplay(draft: ScreenplayDraft): string {
  const lines: string[] = [`Title: ${draft.标题}`, 'Credit: DSH Scriptor 剧本导出', '', 'FADE IN:', '']
  for (const scene of draft.场) {
    lines.push(`/* 场${pad2(scene.场号)} */`)
    lines.push(fountainSlugline(scene), '')
    for (const action of scene.动作) lines.push(action, '')
    for (const block of scene.台词段) {
      lines.push(block.角色)
      if (block.括号提示 !== undefined) lines.push(block.括号提示)
      for (const line of block.台词) lines.push(line)
      lines.push('')
    }
    if (scene.转场 !== undefined) lines.push(scene.转场, '')
  }
  lines.push('FADE OUT.')
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

/** 短剧一集转 Fountain：中文场景 `场01. 地点 时间 内/外` → 美式三段式场景标题（内→INT，外→EXT）。 */
export function renderEpisodeFountain(episode: EpisodeScriptInput): string {
  const epNo = String(episode.集).padStart(3, '0')
  const lines: string[] = [
    `Title: 集${epNo}：${episode.标题}`,
    'Credit: DSH Scriptor 剧本导出',
    '',
    'FADE IN:',
    '',
  ]
  for (const scene of [...episode.场景].sort((a, b) => a.场 - b.场)) {
    const interior = scene.内外 === '内' ? 'INT.' : 'EXT.'
    lines.push(`/* 场${pad2(scene.场)} */`)
    lines.push(`${interior} ${scene.地点} - ${scene.时间}`, '')
    lines.push(scene.动作, '')
    for (const line of sceneDialogueLines(scene)) {
      lines.push(line.角色)
      if (line.括号提示 !== undefined) lines.push(`(${line.括号提示})`)
      lines.push(line.台词)
      lines.push('')
    }
  }
  lines.push('FADE OUT.')
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

function escapeCell(value: string): string {
  return value.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\|/g, '\\|')
}

function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '\\' && line[i + 1] === '|') {
      current += '|'
      i += 1
    } else if (ch === '|') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  // 首尾竖线产生的空单元去掉
  if (cells.length > 0 && cells[0]!.trim() === '') cells.shift()
  if (cells.length > 0 && cells[cells.length - 1]!.trim() === '') cells.pop()
  return cells.map((c) => c.trim())
}

/** 渲染分镜头表（Markdown 表格，固定列序 SHOT_TABLE_HEADERS）。 */
export function renderShotListTable(shotList: ShotList): string {
  const header = `| ${SHOT_TABLE_HEADERS.join(' | ')} |`
  const separator = `| ${SHOT_TABLE_HEADERS.map(() => '---').join(' | ')} |`
  const rows = shotList.镜.map((row) => [
    String(row.镜号),
    String(row.场号),
    row.景别,
    row.角度,
    row.运镜,
    row.时间,
    row.时长秒 === null ? '—' : String(row.时长秒),
    row.画面内容,
    row.台词,
    row.对白标注,
    row.音响,
    row.字幕,
    row.音乐,
  ].map(escapeCell).join(' | '))
  return [header, separator, ...rows.map((r) => `| ${r} |`)].join('\n')
}

export interface ShotListParseResult {
  readonly ok: boolean
  readonly shotList?: ShotList
  readonly problems: readonly string[]
}

/**
 * 解析分镜头表（renderShotListTable 的输出格式）。
 * 接受可选的一级标题（`# 标题`）作表标题；表头须与 SHOT_TABLE_HEADERS
 * 逐字一致，旧版 10 列 LEGACY_SHOT_TABLE_HEADERS 也接受（`摄法` 映射为
 * `角度`，时间/对白标注/字幕填 `—`）；时长（秒）填数字或 `—`/空（未知）；
 * 时间填 `MM:SS—MM:SS` 或 `—`/空（未知）；`—` 在文本栏里原样保留
 * （表示待填/无），渲染往返不变。
 */
export function parseShotListTable(text: string): ShotListParseResult {
  const problems: string[] = []
  const fail = (): ShotListParseResult => ({ ok: false, problems })
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let 标题 = ''
  let headerIndex = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line === '') continue
    if (line.startsWith('# ')) {
      标题 = line.slice(2).trim()
      continue
    }
    // 表前的引用说明行（如导演表的填写提示）跳过，不当正文。
    if (line.startsWith('>')) continue
    if (line.startsWith('|')) {
      headerIndex = i
      break
    }
    problems.push(`分镜头表缺少 Markdown 表格（应以「| 镜号 | 场 | …… |」开头）`)
    return fail()
  }
  if (headerIndex === -1) {
    problems.push('分镜头表缺少 Markdown 表格（应以「| 镜号 | 场 | …… |」开头）')
    return fail()
  }
  const headerCells = splitRow(lines[headerIndex]!.trim())
  const isNewHeader = headerCells.length === SHOT_TABLE_HEADERS.length
    && SHOT_TABLE_HEADERS.every((h, i) => headerCells[i] === h)
  const isLegacyHeader = headerCells.length === LEGACY_SHOT_TABLE_HEADERS.length
    && LEGACY_SHOT_TABLE_HEADERS.every((h, i) => headerCells[i] === h)
  if (!isNewHeader && !isLegacyHeader) {
    problems.push(`分镜头表表头不对：应为「${SHOT_TABLE_HEADERS.join(' / ')}」（旧版 10 列「${LEGACY_SHOT_TABLE_HEADERS.join(' / ')}」也可），收到「${headerCells.join(' / ')}」`)
    return fail()
  }
  const separator = (lines[headerIndex + 1] ?? '').trim()
  if (!/^\|[\s:|-]+\|$/.test(separator) || !separator.includes('---')) {
    problems.push('分镜头表缺少分隔行（| --- | --- | …… |）')
    return fail()
  }
  const expectedCols = isNewHeader ? SHOT_TABLE_HEADERS.length : LEGACY_SHOT_TABLE_HEADERS.length
  const rows: ShotListRow[] = []
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line === '') continue
    if (!line.startsWith('|')) break
    const cells = splitRow(line)
    if (cells.length !== expectedCols) {
      problems.push(`分镜头表第 ${rows.length + 1} 行列数不对：应 ${expectedCols} 列，收到 ${cells.length} 列`)
      continue
    }
    const 镜号 = Number(cells[0])
    const 场号 = Number(cells[1])
    // 新版列序：镜号/场/景别/角度/运镜/时间/时长/画面内容/台词/对白标注/音响/字幕/音乐；
    // 旧版列序：镜号/场/景别/摄法/运镜/时长/画面内容/台词/音响/音乐（摄法→角度，时间/对白标注/字幕填 —）。
    const 时间 = isNewHeader ? (cells[5] ?? '—') : '—'
    const 时长raw = (isNewHeader ? cells[6] : cells[5])!.trim()
    const 时长秒 = 时长raw === '' || 时长raw === '—' ? null : Number(时长raw)
    const 画面内容 = (isNewHeader ? cells[7] : cells[6]) ?? ''
    if (!Number.isSafeInteger(镜号) || 镜号 < 1) problems.push(`分镜头表第 ${rows.length + 1} 行镜号必须是正整数（收到：${cells[0]}）`)
    if (!Number.isSafeInteger(场号) || 场号 < 1) problems.push(`分镜头表第 ${rows.length + 1} 行场号必须是正整数（收到：${cells[1]}）`)
    if (时长秒 !== null && (!Number.isSafeInteger(时长秒) || 时长秒 <= 0)) problems.push(`分镜头表第 ${rows.length + 1} 行时长（秒）必须是正整数或 —（收到：${时长raw}）`)
    if (时间.trim() !== '' && 时间.trim() !== '—' && !isValidTimeRange(时间)) {
      problems.push(`分镜头表第 ${rows.length + 1} 行时间必须是 MM:SS—MM:SS 或 —（收到：${时间}）`)
    }
    if (画面内容.trim() === '') problems.push(`分镜头表第 ${rows.length + 1} 行画面内容不能为空`)
    rows.push({
      镜号: Number.isSafeInteger(镜号) ? 镜号 : rows.length + 1,
      场号: Number.isSafeInteger(场号) ? 场号 : 1,
      景别: cells[2] ?? '',
      角度: cells[3] ?? '',
      运镜: cells[4] ?? '',
      时间: 时间.trim() === '' ? '—' : 时间.trim(),
      时长秒,
      画面内容,
      台词: (isNewHeader ? cells[8] : cells[7]) ?? '',
      对白标注: isNewHeader ? (cells[9] ?? '') : '—',
      音响: (isNewHeader ? cells[10] : cells[8]) ?? '',
      字幕: isNewHeader ? (cells[11] ?? '') : '—',
      音乐: (isNewHeader ? cells[12] : cells[9]) ?? '',
    })
  }
  if (rows.length === 0 && problems.length === 0) problems.push('分镜头表没有镜行')
  if (problems.length > 0) return fail()
  return { ok: true, problems, shotList: { 标题, 镜: rows } }
}

export interface ShotListValidation {
  readonly ok: boolean
  readonly problems: readonly string[]
  readonly warnings: readonly string[]
}

/**
 * 校验分镜头表：镜号须从 1 起连续；场号须落在已有场内（传了场数时）；
 * 时长（秒）须为正整数或未知；时间须为 MM:SS—MM:SS 或未知；画面内容不能为空。
 * 景别/角度/运镜/音响/字幕/音乐填 `—` 或空只记警告（待填），不阻断——模板行就是这么来的。
 * 景别/角度/运镜不在《痴迷》案例词表里也只记警告（`→` 过渡写法按段校验）。
 */
export function validateShotList(shotList: ShotList, sceneCount?: number): ShotListValidation {
  const problems: string[] = []
  const warnings: string[] = []
  if (shotList.镜.length === 0) {
    problems.push('分镜头表没有镜行')
    return { ok: false, problems, warnings }
  }
  shotList.镜.forEach((row, i) => {
    const at = `镜${row.镜号}`
    if (row.镜号 !== i + 1) problems.push(`${at}：镜号不连续，应从 1 起顺序编号（第 ${i + 1} 行应为镜${i + 1}）`)
    if (!Number.isSafeInteger(row.场号) || row.场号 < 1) problems.push(`${at}：场号必须是正整数`)
    else if (sceneCount !== undefined && row.场号 > sceneCount) problems.push(`${at}：场号 ${row.场号} 超出本剧本场数（共 ${sceneCount} 场）`)
    if (row.时长秒 !== null && (!Number.isSafeInteger(row.时长秒) || row.时长秒 <= 0)) problems.push(`${at}：时长（秒）必须是正整数或未知`)
    if (row.时间.trim() !== '' && row.时间.trim() !== '—' && !isValidTimeRange(row.时间)) {
      problems.push(`${at}：时间必须是 MM:SS—MM:SS 或 —（收到：${row.时间}）`)
    }
    if (row.画面内容.trim() === '') problems.push(`${at}：画面内容不能为空`)
    for (const [label, value] of [['景别', row.景别], ['角度', row.角度], ['运镜', row.运镜], ['音响', row.音响], ['字幕', row.字幕], ['音乐', row.音乐]] as const) {
      if (value.trim() === '' || value.trim() === '—') warnings.push(`${at}：${label}待填（填 — 表示暂无，导演补）`)
    }
    const checkVocab = (label: string, value: string, vocab: readonly string[]): void => {
      if (value.trim() === '' || value.trim() === '—') return
      for (const part of value.trim().split('→')) {
        if (!(vocab as readonly string[]).includes(part.trim())) {
          warnings.push(`${at}：${label}「${value}」不在常用词表里（${vocab.join('/')}），核对是不是笔误`)
          return
        }
      }
    }
    checkVocab('景别', row.景别, SHOT_SIZE_VOCAB)
    checkVocab('角度', row.角度, SHOT_ANGLE_VOCAB)
    checkVocab('运镜', row.运镜, SHOT_MOVEMENT_VOCAB)
  })
  return { ok: problems.length === 0, problems, warnings }
}

/**
 * 按场生成待填模板行：一场一镜，镜号连续；画面内容取本场首个动作行，
 * 台词取本场首句台词（没有则填 `—`）；景别/角度/运镜/音响/字幕/音乐与时长、
 * 时间一律留空（`—` / null），由导演填——工具不编造导演的决定。
 */
export function deriveShotListTemplate(
  标题: string,
  scenes: readonly { readonly 场号: number; readonly 画面内容: string; readonly 台词: string }[],
): ShotList {
  return {
    标题,
    镜: scenes.map((scene, i) => ({
      镜号: i + 1,
      场号: scene.场号,
      景别: '—',
      角度: '—',
      运镜: '—',
      时间: '—',
      时长秒: null,
      画面内容: scene.画面内容 === '' ? '—' : scene.画面内容,
      台词: scene.台词 === '' ? '—' : scene.台词,
      对白标注: '—',
      音响: '—',
      字幕: '—',
      音乐: '—',
    })),
  }
}

const EXPORT_NOTE = [
  '> 导出说明：本文件分两层——编剧层（分场景剧本）与导演层（分镜头表），两层不要混写。',
  '> 音效写进动作行，不用 `SFX:` / `MUSIC:` 独占行（那是 BBC 广播剧格式）；停顿只用 `(pause)`，不用 `(beat)`；',
  '> 音乐提示只进分镜头表音乐栏。格式来源：调研 docs/research/film-drama-research.md §1.1–§1.3。',
].join('\n')

function stripFirstTitle(text: string): string {
  const lines = text.split('\n')
  if (lines[0]?.startsWith('# ')) lines.splice(0, 2)
  return lines.join('\n')
}

/** 渲染电影剧本 Markdown 导出：标题 + 编剧层（定稿正文逐字）+ 导演层（分镜头表）。 */
export function renderScreenplayMarkdown(draft: ScreenplayDraft, shotList: ShotList): string {
  const problems: string[] = []
  const body = stripFirstTitle(renderScreenplay(draft))
  const lines = [
    `# 《${draft.标题}》电影剧本`,
    '',
    `- 场数：${draft.场.length} 场`,
    `- 预估页数：约 ${estimatePages(draft)} 页（一页约一分钟是经验法则，实测约 55 秒/页，见调研 §1.1）`,
    '',
    EXPORT_NOTE,
    '',
    '## 编剧层',
    '',
    body.replace(/\n+$/, ''),
    '',
    '## 导演层',
    '',
    '### 分镜头表',
    '',
    renderShotListTable(shotList),
    '',
  ]
  const text = `${lines.join('\n').replace(/\n+$/, '')}\n`
  checkNoBroadcastRows(text, problems)
  if (problems.length > 0) throw new Error(`剧本导出渲染失败：${problems.join('；')}`)
  return text
}

/** 渲染短剧一集 Markdown 导出：标题 + 元信息 + 编剧层（分场景）+ 节拍表 + 导演层（分镜头表）。 */
export function renderEpisodeMarkdown(episode: EpisodeScriptInput, shotList: ShotList): string {
  const problems: string[] = []
  const epNo = String(episode.集).padStart(3, '0')
  const template = RHYTHM_TEMPLATES[episode.画幅]
  let 镜头号 = 1
  const sceneBlocks = [...episode.场景].sort((a, b) => a.场 - b.场).map((s) => {
    const block = renderEpisodeSceneBlock(s, episode.集, 镜头号)
    镜头号 += countEpisodeShots(s)
    return block
  }).join('\n')
  const lines = [
    `# 集${epNo}：${episode.标题}`,
    '',
    `- 画幅：${episode.画幅}（${template.画幅比}）`,
    `- 时长：${episode.时长秒} 秒`,
    `- 钩子类型：${episode.钩子类型}`,
    `- 核心想法：${episode.核心想法}`,
    `- 爽点：${episode.爽点}`,
    `- 台词字数：${totalDialogueChars(episode.场景)} 字`,
    `- 结尾悬念：${episode.结尾悬念}`,
    '',
    EXPORT_NOTE,
    '',
    '## 编剧层',
    '',
    sceneBlocks.replace(/\n+$/, ''),
    '',
    EPISODE_FADE_OUT,
    '',
    renderEpisodeBeatTable(episode).replace(/\n+$/, ''),
    '',
    '## 导演层',
    '',
    '### 分镜头表',
    '',
    renderShotListTable(shotList),
    '',
  ]
  const text = `${lines.join('\n').replace(/\n+$/, '')}\n`
  checkNoBroadcastRows(text, problems)
  if (problems.length > 0) throw new Error(`剧本导出渲染失败：${problems.join('；')}`)
  return text
}

// ---------------------------------------------------------------------------
// 总纲（剧本圣经）+ 人名注册表（阶段 4 对齐轮次）。
//
// 结构取自《痴迷》参考案例第一部分（docs/examples/痴迷-12集分镜剧本-参考案例.docx）：
// 固定七节，缺一不可。渲染只出 Markdown（总纲是给团队看的说明文档，不是 Fountain
// 编剧层）；确定性输出（无时间戳），同一输入重复渲染字节相同。
// 语言规则与分镜剧本同一条：说明/场景/动作文字一律中文，对白按目标市场语言
// （`对白语言` 字段写明，如海外题材为英文）；渲染出的总纲正文不含对白，只有
// 在「对白语言」一行写明该剧的对白语言。
// ---------------------------------------------------------------------------

/** 总纲第五节里的一位主要人物（含全剧统一规范与曾误标统一记录）。 */
export interface StoryBibleCharacter {
/** 全剧统一的标准名（导出的人名检查只认这个）。 */
readonly 标准名: string
/** 原文名/别名（如 `Bear / Barrett`），没有就不写。 */
readonly 原名?: string
/** 年龄写法（如 `22岁` / `约50岁`），没有就不写。 */
readonly 年龄?: string
/** 身份（一句话，如 `Cassell's Music 乐器店店员`）。 */
readonly 身份: string
/** 人物弧（一句话：从什么状态出发，经历什么，落到哪里）。 */
readonly 人物弧: string
/**
* 原剧本曾误标为（统一记录），如 `伊恩[第2集]`、`Bear[第3集]`、`男子A[第7集]`；
* 渲染为「（原剧本曾误标为：……，已全部统一为标准名）」。没有就不写。
*/
readonly 曾误标?: readonly string[]
}

/** 总纲第六节里的一集（分集结构与时间锚点）。 */
export interface StoryBibleEpisodeEntry {
readonly 集: number
/** 所属幕（如 `第一幕：执念起端与恶愿达成`）；同幕的集渲染时归到一组。 */
readonly 幕?: string
/** 时间锚点（如 `D1 周三白天至傍晚`）。 */
readonly 时间锚点: string
/** 本集一句话梗概。 */
readonly 梗概: string
}

/** 总纲（剧本圣经）输入：固定七节（见 renderStoryBible）。 */
export interface StoryBibleInput {
/** 剧名（如 `痴迷`，渲染为 `# 《痴迷》总纲（剧本圣经）`）。 */
readonly 标题: string
/** 类型（如 `现代心理惊悚／超自然民俗恐怖／病态依恋／黑色幽默／爱情悲剧`）。 */
readonly 类型: string
/** 形式（如 `12集连续短剧／约90分钟长片规格；五幕、十二集`）。 */
readonly 形式: string
/** 文字目标（如 `分镜拉片剧本每集约3,000—5,000字，服从成片节奏，不为凑字数扩写`）。 */
readonly 文字目标: string
/** 叙事线：A线主角主线，B线暗线，C线辅线（B/C 可省略）。 */
readonly 叙事线: { readonly A线: string; readonly B线?: string; readonly C线?: string}
/** 故事一句话。 */
readonly 故事一句话: string
/** 开篇承诺（开篇讲了什么）。 */
readonly 开篇承诺: string
/** 悬念清单（每条一句话）。 */
readonly 悬念: readonly string[]
/** 主题。 */
readonly 主题: string
/** 反题。 */
readonly 反题: string
/** 世界硬约束与地理。 */
readonly 世界硬约束: {
/** 现实基底与唯一超自然规则。 */
readonly 现实基底与唯一超自然规则: string
/** 硬约束清单（每条一句话，如触发机制/唯一性铁律/不可撤销性……）。 */
readonly 硬约束: readonly string[]
/** 核心地理空间清单（每条一句话）。 */
readonly 核心地理空间: readonly string[]
}
/** 三段核心真相（作者事实，不等于所有角色已知；固定三段）。 */
readonly 三段核心真相: readonly { readonly 阶段: string; readonly 内容: string}[]
/** 主要人物与人物弧（全剧统一规范；同时是人名注册表的数据源）。 */
readonly 人物: readonly StoryBibleCharacter[]
/** 分集结构与时间锚点（集号从 1 起连续）。 */
readonly 分集结构: readonly StoryBibleEpisodeEntry[]
/** 对白语言（如 `英文` / `中文`）：说明文字一律中文，对白按目标市场语言。 */
readonly 对白语言: string
}

export interface StoryBibleValidation {
readonly ok: boolean
readonly problems: readonly string[]
}

/**
* 校验总纲：七节齐全（类型/形式/文字目标/叙事线 A线/故事一句话/开篇承诺/
* 主题/反题/世界硬约束三项/三段核心真相正好三段/人物至少一位/分集至少一集且
* 集号从 1 起连续）；人物标准名不重复；曾误标名不得与任何一位标准名相同
* （否则「统一」无所指）；对白语言必填。
*/
export function validateStoryBible(bible: StoryBibleInput): StoryBibleValidation {
const problems: string[] = []
const need = (value: string, label: string): void => {
if (value.trim() === '') problems.push(`总纲缺少${label}`)
}
need(bible.标题, '标题')
need(bible.类型, '类型')
need(bible.形式, '形式')
need(bible.文字目标, '文字目标')
need(bible.叙事线.A线, '叙事线 A线')
need(bible.故事一句话, '故事一句话')
need(bible.开篇承诺, '开篇承诺')
need(bible.主题, '主题')
need(bible.反题, '反题')
need(bible.世界硬约束.现实基底与唯一超自然规则, '世界硬约束（现实基底与唯一超自然规则）')
need(bible.对白语言, '对白语言（说明文字中文，对白按目标市场语言）')
if (bible.悬念.length === 0) problems.push('总纲缺少悬念清单（开篇承诺与中心问题一节）')
if (bible.世界硬约束.硬约束.length === 0) problems.push('总纲缺少世界硬约束清单')
if (bible.世界硬约束.核心地理空间.length === 0) problems.push('总纲缺少核心地理空间清单')
if (bible.三段核心真相.length!== 3) problems.push(`总纲「三段核心真相」须正好三段（收到 ${bible.三段核心真相.length} 段）`)
for (const [i, truth] of bible.三段核心真相.entries()) {
if (truth.阶段.trim() === '' || truth.内容.trim() === '') problems.push(`总纲三段核心真相第 ${i + 1} 段缺少阶段名或内容`)
}
if (bible.人物.length === 0) problems.push('总纲缺少主要人物（第五节）')
const 标准名 = new Set<string>()
for (const person of bible.人物) {
if (person.标准名.trim() === '') {
problems.push('总纲有人物缺少标准名')
continue
}
if (标准名.has(person.标准名)) problems.push(`总纲人物标准名重复：${person.标准名}`)
标准名.add(person.标准名)
if (person.身份.trim() === '' || person.人物弧.trim() === '') {
problems.push(`总纲人物 ${person.标准名} 缺少身份或人物弧`)
}
}
for (const person of bible.人物) {
for (const old of person.曾误标?? []) {
if (标准名.has(old.trim())) problems.push(`总纲人物 ${person.标准名} 的曾误标名「${old}」与另一位人物标准名相同，统一记录无所指`)
}
}
if (bible.分集结构.length === 0) problems.push('总纲缺少分集结构（第六节）')
bible.分集结构.forEach((entry, i) => {
if (entry.集!== i + 1) problems.push(`总纲分集结构集号须从 1 起连续（第 ${i + 1} 项应为第${i + 1}集，收到第${entry.集}集）`)
if (entry.时间锚点.trim() === '' || entry.梗概.trim() === '') problems.push(`总纲分集结构第${entry.集}集缺少时间锚点或梗概`)
})
return { ok: problems.length === 0, problems}
}

/** 渲染总纲（剧本圣经）Markdown：固定七节，节序与《痴迷》案例第一部分一致。 */
export function renderStoryBible(bible: StoryBibleInput): string {
const check = validateStoryBible(bible)
if (!check.ok) throw new Error(`总纲渲染失败：${check.problems.join('；')}`)
const lines: string[] = [
`# 《${bible.标题}》总纲（剧本圣经）`,
'',
`> 语言规则：说明/场景/动作文字一律中文；对白按目标市场语言（本剧对白语言：${bible.对白语言}）。`,
'',
`类型：${bible.类型}；形式：${bible.形式}；文字目标：${bible.文字目标}。`,
`叙事：${bible.叙事线.A线}为主线（A线）${bible.叙事线.B线!== undefined? `，${bible.叙事线.B线}为暗线（B线）`: ''}${bible.叙事线.C线!== undefined? `，${bible.叙事线.C线}为辅线（C线）`: ''}。`,
'',
'一、故事一句话',
'',
bible.故事一句话,
'',
'二、开篇承诺与中心问题',
'',
`开篇：${bible.开篇承诺}`,
`悬念：${bible.悬念.map((s, i) => `${i + 1}. ${s}`).join('；')}。`,
`主题：${bible.主题}`,
`反题：${bible.反题}`,
'',
'三、世界硬约束与地理',
'',
`• 现实基底与唯一超自然规则：${bible.世界硬约束.现实基底与唯一超自然规则}`,
'• 硬约束：',
...bible.世界硬约束.硬约束.map((c, i) => ` ${i + 1}. ${c}`),
'• 核心地理空间：',
...bible.世界硬约束.核心地理空间.map((g, i) => ` ${i + 1}. ${g}`),
'',
'四、三段核心真相（作者事实，不等于所有角色已知）',
'',
...bible.三段核心真相.map((t) => `【${t.阶段}】${t.内容}`),
'',
'五、主要人物与人物弧（全剧统一规范）',
'',
...bible.人物.map((p, i) => {
const head = `${i + 1}. ${p.标准名}${p.原名!== undefined? `（${p.原名}`: ''}${p.年龄!== undefined? `${p.原名!== undefined? '，': '（'}${p.年龄}`: ''}${p.原名!== undefined || p.年龄!== undefined? '）': ''}：${p.身份}。${p.人物弧}`
const formerNames = p.曾误标 ?? []
const former = formerNames.length === 0
? ''
: `（原剧本曾误标为：${formerNames.join('、')}，已全部统一为${p.标准名}）`
return `${head}${former}`
}),
'',
'六、分集结构与时间锚点',
'',
]
// 同幕的集归一组（幕名只出现一次）；没写幕的集平铺。
let currentAct = ''
for (const entry of bible.分集结构) {
if (entry.幕!== undefined && entry.幕!== currentAct) {
currentAct = entry.幕
lines.push(`• ${entry.幕}`)
}
lines.push(` - 第${entry.集}集（${entry.时间锚点}）：${entry.梗概}`)
}
lines.push('')
return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

/** 人名注册表里的一位人物：标准名 + 曾误标名清单（总纲第五节的统一记录）。 */
export interface CharacterRegistryEntry {
readonly 标准名: string
readonly 曾误标名: readonly string[]
}

/** 从总纲建人名注册表（第五节人物即注册表；标准名去重已由 validateStoryBible 保证）。 */
export function buildCharacterRegistry(bible: StoryBibleInput): readonly CharacterRegistryEntry[] {
return bible.人物.map((p) => ({ 标准名: p.标准名, 曾误标名: [...(p.曾误标?? [])]}))
}

export interface CharacterNameCheck {
readonly ok: boolean
readonly problems: readonly string[]
}

/**
* 导出前人名一致性检查：全剧人名必须在册且只用标准名。
* - 命中某人的曾误标名 → 报错，点名该用哪个标准名；
* - 未登记的名字 → 报错，须先补进总纲第五节；
* - 只检查给进来的名字，不静默输出、不自动改名。
*/
export function checkCharacterNames(
registry: readonly CharacterRegistryEntry[],
names: readonly string[],
): CharacterNameCheck {
const problems: string[] = []
const 标准名 = new Set(registry.map((e) => e.标准名))
const 曾误标 = new Map<string, string>()
for (const entry of registry) {
for (const old of entry.曾误标名) {
if (!曾误标.has(old)) 曾误标.set(old, entry.标准名)
}
}
for (const name of names) {
if (标准名.has(name)) continue
const correct = 曾误标.get(name)
if (correct!== undefined) {
problems.push(`人名「${name}」是曾误标名，全剧须统一为标准名「${correct}」（见总纲第五节统一记录），不准静默输出`)
} else {
problems.push(`人名「${name}」未登记在总纲人名注册表里（第五节），请先补登记再导出`)
}
}
return { ok: problems.length === 0, problems}
}

/** 电影剧本全剧人名（台词段角色名，按出场顺序去重；供人名一致性检查用）。 */
export function collectScreenplayNames(draft: ScreenplayDraft): string[] {
const names: string[] = []
for (const scene of draft.场) {
for (const block of scene.台词段) {
if (!names.includes(block.角色)) names.push(block.角色)
}
}
return names
}

/** 短剧一集全剧人名（各场台词角色名，按出场顺序去重；供人名一致性检查用）。 */
export function collectEpisodeNames(episode: EpisodeScriptInput): string[] {
const names: string[] = []
for (const scene of episode.场景) {
for (const line of sceneDialogueLines(scene)) {
if (!names.includes(line.角色)) names.push(line.角色)
}
}
return names
}
