/**
 * 分场大纲（阶段 2 第二步）：按三幕结构分场。
 *
 * 文本格式（Markdown）：
 *   # <标题>
 *   ## 第一幕
 *   ### 场01  面馆 深夜 内
 *   - 场景：面馆 深夜 内
 *   - 人物：林晚星、陈默
 *   - 冲突：……
 *   - 转折：……
 *   ## 第二幕
 *   ### 场02 ……
 *
 * 每场四项齐全（场景/人物/冲突/转折）；场号两位，全片从 01 连续编号；
 * 三幕都要有场（任务要求：按三幕结构分场）。
 */

import type { OutlineScene, SceneOutline, StoryDraft } from './types'

export const ACT_NAMES = ['第一幕', '第二幕', '第三幕'] as const
export const OUTLINE_FIELDS = ['场景', '人物', '冲突', '转折'] as const

/** 分场大纲空模板：三幕各一场空场，照抄填空即可。 */
export function emptySceneOutline(标题 = '未命名故事'): string {
  const lines: string[] = [`# ${标题}`, '']
  const acts: ReadonlyArray<readonly [string, number]> = [['第一幕', 1], ['第二幕', 2], ['第三幕', 3]]
  for (const [act, n] of acts) {
    lines.push(`## ${act}`, '', `### 场0${n}  【地点 时间 内/外】`, '')
    for (const f of OUTLINE_FIELDS) lines.push(`- ${f}：【待写】`)
    lines.push('')
  }
  return lines.join('\n')
}

export interface OutlineParseResult {
  readonly ok: boolean
  readonly outline?: SceneOutline
  readonly problems: readonly string[]
}

/** 解析分场大纲文本：缺幕、场号不连续、缺项都记入 problems（ok=false）。 */
export function parseSceneOutline(text: string): OutlineParseResult {
  const problems: string[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  let act: 1 | 2 | 3 | null = null
  const scenes: OutlineScene[] = []
  let current: { 场号: number; 幕: 1 | 2 | 3; 场景行: string; fields: Map<string, string> } | null = null
  const flush = (): void => {
    if (current === null) return
    const get = (f: string): string => current!.fields.get(f) ?? ''
    scenes.push({ 场号: current.场号, 幕: current.幕, 场景: get('场景') === '' ? current.场景行 : get('场景'), 人物: get('人物'), 冲突: get('冲突'), 转折: get('转折') })
    current = null
  }
  for (const line of lines) {
    const h1 = /^#\s+(.+?)\s*$/.exec(line)
    if (h1) {
      title = h1[1]!.trim()
      continue
    }
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) {
      flush()
      const name = h2[1]!.trim()
      const idx = (ACT_NAMES as readonly string[]).indexOf(name)
      act = idx === -1 ? null : ((idx + 1) as 1 | 2 | 3)
      if (act === null) problems.push(`未知幕标题「${name}」，只认 第一幕 / 第二幕 / 第三幕`)
      continue
    }
    const h3 = /^###\s+场(\d{1,2})\b\s*(.*?)\s*$/.exec(line)
    if (h3) {
      flush()
      if (act === null) {
        problems.push(`场${h3[1]} 写在幕标题之外，分场必须先分幕`)
        continue
      }
      current = { 场号: Number(h3[1]), 幕: act, 场景行: h3[2] ?? '', fields: new Map() }
      continue
    }
    if (current !== null) {
      const field = /^-\s*(场景|人物|冲突|转折)[：:]\s*(.*?)\s*$/.exec(line)
      if (field) current.fields.set(field[1]!, field[2] ?? '')
    }
  }
  flush()
  if (title === '') problems.push('分场大纲缺少一级标题（# 标题）')
  if (scenes.length === 0) problems.push('分场大纲里没有场（### 场01 ……）')
  const seenActs = new Set(scenes.map((s) => s.幕))
  for (let a = 1 as 1 | 2 | 3; a <= 3; a = (a + 1) as 1 | 2 | 3) {
    if (!seenActs.has(a)) problems.push(`缺少第${['一', '二', '三'][a - 1]}幕的场，三幕结构缺一幕`)
  }
  const numbers = scenes.map((s) => s.场号).sort((a, b) => a - b)
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      problems.push(`场号不连续：应从 01 起连续编号，缺场${String(i + 1).padStart(2, '0')}（实际为场${String(numbers[i]).padStart(2, '0')}）`)
      break
    }
  }
  for (const s of scenes) {
    for (const f of OUTLINE_FIELDS) {
      const value = s[f as '场景' | '人物' | '冲突' | '转折']
      if (value.trim() === '' || value.trim() === '【待写】') problems.push(`场${String(s.场号).padStart(2, '0')} 缺「${f}」`)
    }
  }
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, problems, outline: { 标题: title, 场: scenes } }
}

/** 校验已解析的分场大纲（与 parseSceneOutline 同一套规则，供已解析对象复用）。 */
export function validateSceneOutline(outline: SceneOutline): { readonly errors: readonly string[]; readonly warnings: readonly string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  if (outline.场.length === 0) errors.push('分场大纲里没有场')
  const seenActs = new Set(outline.场.map((s) => s.幕))
  for (let a = 1 as 1 | 2 | 3; a <= 3; a = (a + 1) as 1 | 2 | 3) {
    if (!seenActs.has(a)) errors.push(`缺少第${['一', '二', '三'][a - 1]}幕的场`)
  }
  const numbers = outline.场.map((s) => s.场号).sort((a, b) => a - b)
  numbers.forEach((n, i) => {
    if (n !== i + 1) errors.push('场号不连续：应从 01 起连续编号')
  })
  for (const s of outline.场) {
    for (const f of OUTLINE_FIELDS) {
      if (s[f as '场景' | '人物' | '冲突' | '转折'].trim() === '') errors.push(`场${String(s.场号).padStart(2, '0')} 缺「${f}」`)
    }
  }
  const actCounts = [1, 2, 3].map((a) => outline.场.filter((s) => s.幕 === a).length)
  if ((actCounts[1] ?? 0) < (actCounts[0] ?? 0)) warnings.push('第二幕场次少于第一幕：对抗段通常是全片最长的一段，请核对是不是漏了升级冲突的场')
  return { errors, warnings }
}

/** 把已解析的分场大纲序列化回标准文本（解析—渲染往返一致）。 */
export function renderSceneOutline(outline: SceneOutline): string {
  const lines: string[] = [`# ${outline.标题}`, '']
  for (let a = 1 as 1 | 2 | 3; a <= 3; a = (a + 1) as 1 | 2 | 3) {
    const scenes = outline.场.filter((s) => s.幕 === a)
    if (scenes.length === 0) continue
    lines.push(`## ${ACT_NAMES[a - 1]}`, '')
    for (const s of scenes) {
      lines.push(`### 场${String(s.场号).padStart(2, '0')}  ${s.场景}`, '')
      lines.push(`- 场景：${s.场景}`)
      lines.push(`- 人物：${s.人物}`)
      lines.push(`- 冲突：${s.冲突}`)
      lines.push(`- 转折：${s.转折}`, '')
    }
  }
  return lines.join('\n')
}

/**
 * 故事稿 → 分场大纲骨架（转换，不代写情节）：
 * 第一幕 1 场（开场：立主角与世界）；第二幕每条关键转折 1 场（转折原句
 * 直接落进该场的「转折」项，冲突/场景留待写）；第三幕 1 场（结局）。
 * 骨架的待写项由 validateSceneOutline 判为缺项——骨架本身不是成品大纲。
 */
export function outlineFromStory(story: StoryDraft): SceneOutline {
  const scenes: OutlineScene[] = []
  let n = 1
  const names = story.人物.map((c) => c.姓名).join('、')
  scenes.push({ 场号: n++, 幕: 1, 场景: '【待写：地点 时间 内/外】', 人物: names, 冲突: '【待写】', 转折: '【待写：激励事件，把主角推出日常】' })
  for (const t of story.关键转折) {
    scenes.push({ 场号: n++, 幕: 2, 场景: '【待写：地点 时间 内/外】', 人物: names, 冲突: '【待写】', 转折: t })
  }
  scenes.push({ 场号: n++, 幕: 3, 场景: '【待写：地点 时间 内/外】', 人物: names, 冲突: '【待写】', 转折: `【待写：兑现结尾——${story.结尾.slice(0, 40)}】` })
  return { 标题: story.标题, 场: scenes }
}

const TIME_TOKENS = ['深夜', '清晨', '黄昏', '傍晚', '黎明', '午夜', '白天', '晚上', '中午', '凌晨', '日', '夜', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER'] as const

/**
 * 把大纲「场景」自由文本拆成场景标题三段。
 * 启发式：末尾的 内/外 定内外景；末尾的时间词（日/夜/黄昏……）定时间；
 * 剩下的是地点。拆不出的部分原样保留，内外景未知时返回 undefined，
 * 由 draftFromOutline 落成 INT./EXT. 并在审读里标待核对。
 */
export function parseSceneField(场景: string): { readonly 内外?: 'INT' | 'EXT'; readonly 地点: string; readonly 时间: string } {
  let rest = 场景.trim()
  let 内外: 'INT' | 'EXT' | undefined
  if (/[（(]内[）)]?$/.test(rest) || /\s内$/.test(rest)) {
    内外 = 'INT'
    rest = rest.replace(/[（(]内[）)]?$/, '').replace(/\s内$/, '').trim()
  } else if (/[（(]外[）)]?$/.test(rest) || /\s外$/.test(rest)) {
    内外 = 'EXT'
    rest = rest.replace(/[（(]外[）)]?$/, '').replace(/\s外$/, '').trim()
  }
  let 时间 = ''
  for (const token of TIME_TOKENS) {
    if (rest.endsWith(token)) {
      时间 = token
      rest = rest.slice(0, rest.length - token.length).trim()
      break
    }
  }
  return { 内外, 地点: rest === '' ? 场景.trim() : rest, 时间 }
}
