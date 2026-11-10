/**
 * 专业剧本导出格式（阶段 4，muse-dev）：Fountain / Markdown 双输出渲染器 +
 * 导演层分镜头表。
 *
 * 两层分开，绝不混写（调研 docs/research/film-drama-research.md §1.3）：
 * - 编剧层（分场景剧本）：场景标题 + 动作行 + 角色名 + 台词 + 括号提示。
 *   Fountain 输出是这一层的纯文本标准格式；Markdown 输出把同一层嵌进
 *   `## 编剧层`，正文与定稿逐字一致。
 * - 导演层（分镜头表）：镜号 / 场 / 景别 / 摄法 / 运镜 / 时长（秒）/
 *   画面内容 / 台词 / 音响 / 音乐，一律以 Markdown 表格出（调研 §1.2：
 *   分镜头剧本大多采用表格形式，栏目含镜号、景别、摄法、长度、内容、音响、
 *   音乐；来源：https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031 ，
 *   https://blog.csdn.net/Dontla/article/details/105735904）。
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
 * - 没给表：deriveShotListTemplate 按场生成待填模板行（景别/摄法/运镜/
 *   音响/音乐填 `—`，时长空着），只给镜号、场号、画面内容与首句台词——
 *   工具不编造导演的景别与运镜决定，待填项进警告，不进错误。
 *
 * 本模块只渲染、不落盘、不改书仓；确定性输出（无时间戳），同一输入重复
 * 渲染字节相同。
 */

import { estimatePages, renderScreenplay } from '../screenplay/format'
import type { ScreenplayDraft, ScreenplayScene } from '../screenplay/types'
import { RHYTHM_TEMPLATES } from '../shortdrama/templates'
import { renderEpisodeBeatTable, renderEpisodeSceneBlock, totalDialogueChars } from '../shortdrama/script'
import type { EpisodeScriptInput } from '../shortdrama/types'

/** 景别词汇（调研 §1.2；中文常用写法 + 英文缩写都认）。 */
export const SHOT_SIZE_TOKENS = [
  '极远景', '远景', '中远景', '全景', '中景', '中近景', '近景', '特写', '大特写',
  'EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU',
] as const

/** 分镜头表表头（固定列序，解析与渲染共用同一口径）。 */
export const SHOT_TABLE_HEADERS = ['镜号', '场', '景别', '摄法', '运镜', '时长（秒）', '画面内容', '台词', '音响', '音乐'] as const

/** 分镜头表里的一镜。`—` 表示该栏待填/无（模板行与无台词、无音响、无音乐的镜都这么写）。 */
export interface ShotListRow {
  readonly 镜号: number
  readonly 场号: number
  readonly 景别: string
  readonly 摄法: string
  readonly 运镜: string
  /** 单镜时长（秒）；未知填 null，渲染为 `—`。 */
  readonly 时长秒: number | null
  readonly 画面内容: string
  readonly 台词: string
  readonly 音响: string
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
    for (const line of scene.台词) {
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
    row.摄法,
    row.运镜,
    row.时长秒 === null ? '—' : String(row.时长秒),
    row.画面内容,
    row.台词,
    row.音响,
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
 * 逐字一致；时长（秒）填数字或 `—`/空（未知）；`—` 在文本栏里原样保留
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
  if (headerCells.length !== SHOT_TABLE_HEADERS.length
    || !SHOT_TABLE_HEADERS.every((h, i) => headerCells[i] === h)) {
    problems.push(`分镜头表表头不对：应为「${SHOT_TABLE_HEADERS.join(' / ')}」，收到「${headerCells.join(' / ')}」`)
    return fail()
  }
  const separator = (lines[headerIndex + 1] ?? '').trim()
  if (!/^\|[\s:|-]+\|$/.test(separator) || !separator.includes('---')) {
    problems.push('分镜头表缺少分隔行（| --- | --- | …… |）')
    return fail()
  }
  const rows: ShotListRow[] = []
  for (let i = headerIndex + 2; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line === '') continue
    if (!line.startsWith('|')) break
    const cells = splitRow(line)
    if (cells.length !== SHOT_TABLE_HEADERS.length) {
      problems.push(`分镜头表第 ${rows.length + 1} 行列数不对：应 ${SHOT_TABLE_HEADERS.length} 列，收到 ${cells.length} 列`)
      continue
    }
    const 镜号 = Number(cells[0])
    const 场号 = Number(cells[1])
    const 时长raw = cells[5]!.trim()
    const 时长秒 = 时长raw === '' || 时长raw === '—' ? null : Number(时长raw)
    if (!Number.isSafeInteger(镜号) || 镜号 < 1) problems.push(`分镜头表第 ${rows.length + 1} 行镜号必须是正整数（收到：${cells[0]}）`)
    if (!Number.isSafeInteger(场号) || 场号 < 1) problems.push(`分镜头表第 ${rows.length + 1} 行场号必须是正整数（收到：${cells[1]}）`)
    if (时长秒 !== null && (!Number.isSafeInteger(时长秒) || 时长秒 <= 0)) problems.push(`分镜头表第 ${rows.length + 1} 行时长（秒）必须是正整数或 —（收到：${cells[5]}）`)
    if ((cells[6] ?? '').trim() === '') problems.push(`分镜头表第 ${rows.length + 1} 行画面内容不能为空`)
    rows.push({
      镜号: Number.isSafeInteger(镜号) ? 镜号 : rows.length + 1,
      场号: Number.isSafeInteger(场号) ? 场号 : 1,
      景别: cells[2] ?? '',
      摄法: cells[3] ?? '',
      运镜: cells[4] ?? '',
      时长秒,
      画面内容: cells[6] ?? '',
      台词: cells[7] ?? '',
      音响: cells[8] ?? '',
      音乐: cells[9] ?? '',
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
 * 时长（秒）须为正整数或未知；画面内容不能为空。景别/摄法/运镜/音响/
 * 音乐填 `—` 或空只记警告（待填），不阻断——模板行就是这么来的。
 * 景别不在 SHOT_SIZE_TOKENS 里也只记警告（中文分镜头表写法本就多样）。
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
    if (row.画面内容.trim() === '') problems.push(`${at}：画面内容不能为空`)
    for (const [label, value] of [['景别', row.景别], ['摄法', row.摄法], ['运镜', row.运镜], ['音响', row.音响], ['音乐', row.音乐]] as const) {
      if (value.trim() === '' || value.trim() === '—') warnings.push(`${at}：${label}待填（填 — 表示暂无，导演补）`)
    }
    if (row.景别.trim() !== '' && row.景别.trim() !== '—'
      && !(SHOT_SIZE_TOKENS as readonly string[]).includes(row.景别.trim())) {
      warnings.push(`${at}：景别「${row.景别}」不在常用景别词里（极远景/远景/中远景/全景/中景/中近景/近景/特写/大特写），核对是不是笔误`)
    }
  })
  return { ok: problems.length === 0, problems, warnings }
}

/**
 * 按场生成待填模板行：一场一镜，镜号连续；画面内容取本场首个动作行，
 * 台词取本场首句台词（没有则填 `—`）；景别/摄法/运镜/音响/音乐与时长
 * 一律留空（`—` / null），由导演填——工具不编造导演的决定。
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
      摄法: '—',
      运镜: '—',
      时长秒: null,
      画面内容: scene.画面内容 === '' ? '—' : scene.画面内容,
      台词: scene.台词 === '' ? '—' : scene.台词,
      音响: '—',
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
  const sceneBlocks = [...episode.场景].sort((a, b) => a.场 - b.场).map((s) => renderEpisodeSceneBlock(s)).join('\n')
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
