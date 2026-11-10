/**
 * 故事稿（阶段 2 第一步）：小说浓缩版。
 *
 * 文本格式（Markdown）：
 *   # <标题>
 *   ## 故事一句话
 *   ## 人物小传
 *   ### <姓名>
 *   <小传，须含动机>
 *   ## 世界规则
 *   ## 情节主线
 *   ## 关键转折
 *   - <转折一句话>（按故事顺序）
 *   ## 结尾
 *
 * 校验只判结构与完整度，不评文学质量：缺节、空节、无人物、无转折是错；
 * 人物小传没写动机是警告（动机是故事稿存在的理由，但不由机器判生死）。
 */

import type { StoryCharacter, StoryDraft } from './types'

export const STORY_SECTIONS = ['故事一句话', '人物小传', '世界规则', '情节主线', '关键转折', '结尾'] as const

/** 故事稿空模板：六节齐全、不发明情节，照抄填空即可。 */
export function emptyStoryDraft(标题 = '未命名故事'): string {
  return [
    `# ${标题}`,
    '',
    '## 故事一句话',
    '',
    '【一句话说清：谁，在什么处境下，想要什么，代价是什么】',
    '',
    '## 人物小传',
    '',
    '### 主角',
    '',
    '【年龄 / 身份 / 性格 / 动机：他想要什么，为什么非要不可】',
    '',
    '## 世界规则',
    '',
    '【这个故事的世界怎么运转；没有特殊规则就写「无特殊规则，现实世界」】',
    '',
    '## 情节主线',
    '',
    '【主角从哪里出发，经历什么，到哪里结束，一段散文写完】',
    '',
    '## 关键转折',
    '',
    '- 【转折 1：一句话】',
    '',
    '## 结尾',
    '',
    '【故事落在哪里，主角变了什么】',
    '',
  ].join('\n')
}

export interface StoryParseResult {
  readonly ok: boolean
  readonly story?: StoryDraft
  /** 解析/结构问题（空数组 = 通过）。 */
  readonly problems: readonly string[]
}

/** 解析故事稿文本：缺节、空节、无人物、无转折都记入 problems（ok=false）。 */
export function parseStoryDraft(text: string): StoryParseResult {
  const problems: string[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  const sections = new Map<string, string[]>()
  let current: string | null = null
  for (const line of lines) {
    const h1 = /^#\s+(.+?)\s*$/.exec(line)
    if (h1) {
      title = h1[1]!.trim()
      current = null
      continue
    }
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) {
      current = h2[1]!.trim()
      if (!sections.has(current)) sections.set(current, [])
      continue
    }
    if (current !== null) sections.get(current)!.push(line)
  }
  if (title === '') problems.push('故事稿缺少一级标题（# 标题）')
  for (const name of STORY_SECTIONS) {
    const body = sections.get(name)
    if (body === undefined) {
      problems.push(`故事稿缺少「${name}」一节`)
    } else if (body.join('\n').trim() === '') {
      problems.push(`故事稿「${name}」一节为空`)
    }
  }
  if (problems.length > 0) return { ok: false, problems }

  const bodyOf = (name: string): string => (sections.get(name) ?? []).join('\n').trim()

  // 人物小传：### 姓名 + 小传正文。
  const 人物: StoryCharacter[] = []
  const charLines = sections.get('人物小传') ?? []
  let charName: string | null = null
  let charBody: string[] = []
  const flush = (): void => {
    if (charName !== null) 人物.push({ 姓名: charName, 小传: charBody.join('\n').trim() })
    charName = null
    charBody = []
  }
  for (const line of charLines) {
    const h3 = /^###\s+(.+?)\s*$/.exec(line)
    if (h3) {
      flush()
      charName = h3[1]!.trim()
      continue
    }
    if (charName !== null) charBody.push(line)
  }
  flush()
  const 人物有效 = 人物.filter((c) => c.姓名 !== '' && c.小传 !== '')
  if (人物有效.length === 0) problems.push('故事稿「人物小传」里没有写出至少一位有人物小传的人物（### 姓名 + 小传）')

  // 关键转折：每条一行，- / * / 1. 开头。
  const 关键转折 = bodyOf('关键转折')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => l.replace(/^(?:[-*•]|\d+[.、])\s*/, '').trim())
    .filter((l) => l !== '' && !/^【.*】$/.test(l))
  if (关键转折.length === 0) problems.push('故事稿「关键转折」里没有写出至少一条转折')

  if (problems.length > 0) return { ok: false, problems }
  return {
    ok: true,
    problems,
    story: {
      标题: title,
      故事一句话: bodyOf('故事一句话'),
      人物: 人物有效,
      世界规则: bodyOf('世界规则'),
      情节主线: bodyOf('情节主线'),
      关键转折,
      结尾: bodyOf('结尾'),
    },
  }
}

/**
 * 校验已解析的故事稿：结构错是 errors；人物小传没写动机是 warnings。
 * 动机关键词只作启发式提醒——机器不判文学，只提醒作者补上。
 */
export function validateStoryDraft(story: StoryDraft): { readonly errors: readonly string[]; readonly warnings: readonly string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  if (story.标题.trim() === '') errors.push('标题为空')
  if (story.故事一句话.trim() === '') errors.push('「故事一句话」为空')
  if (story.人物.length === 0) errors.push('没有人物')
  if (story.世界规则.trim() === '') errors.push('「世界规则」为空（没有特殊规则也要写「无特殊规则，现实世界」）')
  if (story.情节主线.trim() === '') errors.push('「情节主线」为空')
  if (story.关键转折.length === 0) errors.push('没有关键转折')
  if (story.结尾.trim() === '') errors.push('「结尾」为空')
  for (const c of story.人物) {
    if (!/动机|想要|想|目标|害怕|怕|非.*不可|渴望|执念/.test(c.小传)) {
      warnings.push(`人物「${c.姓名}」的小传里没写清动机（想要什么、为什么非要不可），剧本继承不了这个人物的深度`)
    }
  }
  if (story.情节主线.length < 50) warnings.push('「情节主线」不到 50 字，故事逻辑可能没在散文里过透')
  return { errors, warnings }
}

/** 把已解析的故事稿序列化回标准文本（解析—渲染往返一致）。 */
export function renderStoryDraft(story: StoryDraft): string {
  const lines: string[] = [`# ${story.标题}`, '', '## 故事一句话', '', story.故事一句话.trim(), '', '## 人物小传', '']
  for (const c of story.人物) {
    lines.push(`### ${c.姓名}`, '', c.小传.trim(), '')
  }
  lines.push('## 世界规则', '', story.世界规则.trim(), '', '## 情节主线', '', story.情节主线.trim(), '', '## 关键转折', '')
  for (const t of story.关键转折) lines.push(`- ${t}`)
  lines.push('', '## 结尾', '', story.结尾.trim(), '')
  return lines.join('\n')
}
