/**
 * 剧本草稿（阶段 2 第三步）：编剧层分场景格式。
 *
 * 六大元素（调研 §1.1，来源见各处注释）：
 * - 场景标题：`INT./EXT. + 地点 + 时间`，全大写；时间多用 日/夜/黄昏 等，
 *   除非时钟本身是剧情点，避免写具体钟点。
 *   来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/
 *   https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
 * - 动作行：现在时、只写银幕上看得见/听得见的，不写人物内心想法；段落宜短。
 *   来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/
 * - 角色名：说话人姓名全大写、居中于对白上方；首次出场姓名全大写。
 * - 台词：窄栏、无引号、口语化；被打断用双破折号 `--`，拖长/欲言又止用
 *   省略号 `...`（省略号表示 trailing off，不是打断）。
 *   来源：https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue
 * - 括号提示：小写、简短、少用；只在台词本身无法传达语气/对象时才用。
 *   来源：https://www.finaldraft.com/blog/lets-talk-about-parentheticals
 * - 转场：右对齐、全大写、以冒号结尾（如 CUT TO:）；现代 spec 剧本默认
 *   “新场景标题即意味着切”，转场少用；以 FADE IN: 开场、FADE OUT. 收尾。
 *
 * 停顿写法（工具内定死，三选一，不混用）：
 * 选 `(pause)`。依据：ScreenCraft 明确反对用 `(beat)` 表示停顿，认为 beat
 * 在表演术语里含义不止“停顿”，主张写 `(pause)` 或用动作行说明停顿原因
 * （来源：https://screencraft.org/blog/10-things-to-delete-from-your-dialogue-scenes-right-now/）；
 * 省略号 `...` 表示拖长/欲言又止（trailing off），不是干净的停顿
 * （来源：https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue）。
 * 所以：停顿一律写 `(pause)`；`(beat)` 视为格式错误；省略号只用于台词内
 * 的欲言又止，不单独承担“停顿”功能。
 *
 * 音效与音乐（调研 §1.3）：
 * - 音效：动作行内关键音效词大写（如“警笛声由远及近”写成动作行里的
 *   “警笛声”大写关键词——中文无大小写，写“此时传来剧烈的爆炸声”式
 *   的明确提示，或用【音效：……】短标注，二者取一，不混用）。
 *   `SFX:` / `MUSIC:` 独占一行是 BBC 广播剧格式，不是电影剧本格式，禁用。
 *   来源：https://epicscribe.io/blog/writing-sound-effects-audio-drama-scripts
 * - 音乐提示：不进编剧层，那是阶段 4 导演层分镜头表的事（分镜头表音乐栏）。
 *
 * 镜头提示：spec 剧本里克制，除非该镜头对理解场景不可或缺，否则不写
 * （属于导演职权）。校验只报警告，不判错。
 * 来源：https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
 */

import { parseSceneField } from './outline'
import type { DialogueBlock, SceneOutline, ScreenplayDraft, ScreenplayFinding, ScreenplayScene } from './types'

/** 停顿只用 `(pause)`（见文件头依据）；`(beat)` 禁用。 */
export const PAUSE_MARKER = '(pause)' as const
export const FORBIDDEN_PAUSE_MARKERS = ['(beat)'] as const

/** 场景标题时间词（中英文常用值；除非时钟是剧情点，不写具体钟点）。 */
export const SCENE_TIME_TOKENS = ['日', '夜', '黄昏', '清晨', '傍晚', '深夜', '黎明', '午夜', '白天', '晚上', '中午', '凌晨', 'DAY', 'NIGHT', 'MORNING', 'EVENING', 'CONTINUOUS', 'LATER'] as const

/** 动作行里应克制的镜头提示词（编剧层警告，不判错）。 */
const SHOT_WORDS = ['特写', '近景', '远景', '全景', '中景', '推镜头', '拉镜头', '摇镜头', '跟拍', '航拍', 'CLOSE ON', 'WIDE SHOT', 'ANGLE ON', 'PUSH IN', 'PULL OUT', 'TRACKING'] as const

const SLUGLINE_RE = /^(?:场(\d{1,2})\s+)?(INT\.|EXT\.|INT\.\/EXT\.)\s+(.+?)\s+-\s+(.+?)\s*$/
const TRANSITION_RE = /^(CUT TO|DISSOLVE TO|FADE OUT|SMASH CUT TO|MATCH CUT TO|FADE IN):?\.?$/
const SENTENCE_PUNCT = /[。！？；：，、.!?;,:"“”『』]/

/** 渲染一场场景标题：`场01 INT. 会议室 - 日`（场号两位 + 三段式全大写）。 */
export function renderSlugline(scene: ScreenplayScene): string {
  // 内外景本身已含句点（INT./EXT.）时不再补句点，避免渲染出 INT./EXT..
  const interior = scene.标题.内外.endsWith('.') ? scene.标题.内外 : `${scene.标题.内外}.`
  return `场${String(scene.场号).padStart(2, '0')} ${interior} ${scene.标题.地点} - ${scene.标题.时间}`
}

/** 渲染整部剧本草稿（FADE IN: 开场、FADE OUT. 收尾）。 */
export function renderScreenplay(draft: ScreenplayDraft): string {
  const lines: string[] = [`# ${draft.标题}`, '', 'FADE IN:', '']
  for (const scene of draft.场) {
    lines.push(renderSlugline(scene), '')
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
  return lines.join('\n')
}

/**
 * 页数粗估：渲染后总行数 ÷ 55 行/页。
 * 工具内约定，仅用于量级判断：Courier 12 磅标准页约 55 行是排版经验值，
 * 不是调研结论；且“一页 ≈ 一分钟”本身只是经验法则（实测约 55 秒/页，
 * Stephen Follows）。估算结果只作参考发现项，绝不卡通过。
 */
export function estimatePages(draft: ScreenplayDraft): number {
  const lines = renderScreenplay(draft).split('\n').length
  return Math.max(1, Math.round(lines / 55))
}

export interface DraftParseResult {
  readonly ok: boolean
  readonly draft?: ScreenplayDraft
  readonly problems: readonly string[]
}

/**
 * 解析剧本草稿文本。
 * 角色名行判定：无句中标点、≤15 字、下一非空行是括号提示或台词（不是
 * 场景标题/转场/FADE）。动作行默认带标点或成句；空行终结当前台词段，
 * 空行后的正文回到动作行。判定规则写死在这里，解析与校验共用同一口径。
 */
export function parseScreenplay(text: string): DraftParseResult {
  const problems: string[] = []
  const rawLines = text.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  const scenes: ScreenplayScene[] = []
  let current: { 场号: number; 标题: ScreenplayDraft['场'][number]['标题']; 动作: string[]; 台词段: DialogueBlock[]; 转场?: string } | null = null
  let currentBlock: { 角色: string; 括号提示?: string; 台词: string[] } | null = null
  const flushBlock = (): void => {
    if (current !== null && currentBlock !== null) {
      current.台词段.push({ 角色: currentBlock.角色, ...(currentBlock.括号提示 !== undefined ? { 括号提示: currentBlock.括号提示 } : {}), 台词: currentBlock.台词 })
    }
    currentBlock = null
  }
  const flushScene = (): void => {
    flushBlock()
    if (current !== null) scenes.push({ 场号: current.场号, 标题: current.标题, 动作: current.动作, 台词段: current.台词段, ...(current.转场 !== undefined ? { 转场: current.转场 } : {}) })
    current = null
  }
  const nextNonEmpty = (from: number): string | null => {
    for (let i = from; i < rawLines.length; i++) {
      const l = (rawLines[i] ?? '').trim()
      if (l !== '') return l
    }
    return null
  }
  for (let i = 0; i < rawLines.length; i++) {
    const line = (rawLines[i] ?? '').trim()
    // 空行终结当前台词段：渲染格式里每段台词后都有空行，动作行从空行后重新开始。
    if (line === '') {
      flushBlock()
      continue
    }
    const h1 = /^#\s+(.+?)\s*$/.exec(line)
    if (h1) {
      title = h1[1]!.trim()
      continue
    }
    // `>` 开头的行是批注（如示例文件头的说明），不是剧本正文，跳过。
    if (line.startsWith('>')) continue
    if (line === 'FADE IN:' || line === 'FADE OUT.') continue
    const slug = SLUGLINE_RE.exec(line)
    if (slug) {
      flushScene()
      // 正则吃掉了场景标题里的句点（INT. / EXT. / INT./EXT.）：INT./EXT. 原样保留，
      // INT. / EXT. 去掉末尾句点，还原成类型里的 'INT' / 'EXT'。
      const rawInterior = slug[2]!
      const 内外 = (rawInterior === 'INT./EXT.' ? 'INT./EXT.' : rawInterior.replace(/\.$/, '')) as 'INT' | 'EXT' | 'INT./EXT.'
      current = { 场号: slug[1] !== undefined ? Number(slug[1]) : scenes.length + 1, 标题: { 内外, 地点: slug[3]!.trim(), 时间: slug[4]!.trim() }, 动作: [], 台词段: [] }
      continue
    }
    if (current === null) {
      problems.push(`场景标题之外出现正文「${line.slice(0, 20)}……」：剧本正文必须先有场景标题`)
      continue
    }
    if (TRANSITION_RE.test(line)) {
      flushBlock()
      current.转场 = line.endsWith(':') || line.endsWith('.') ? line : `${line}:`
      continue
    }
    // 括号提示：全角/半角括号独占一行，须依附于一段台词（角色名行之后、
    // 或同一台词段的两行台词之间）；无依附时记解析问题，不静默吞掉。
    const paren = /^[（(](.+)[）)]$/.exec(line)
    if (paren !== null) {
      if (currentBlock !== null) {
        currentBlock.括号提示 = line
      } else {
        problems.push(`括号提示「${line}」没有依附的台词段：括号提示须写在角色名行之后或同一段台词中间`)
      }
      continue
    }
    // 角色名行：无句中标点、≤15 字、下一非空行不是场景标题/转场。
    const next = nextNonEmpty(i + 1)
    const looksLikeCue =
      !SENTENCE_PUNCT.test(line) && line.length <= 15 && next !== null && SLUGLINE_RE.exec(next) === null && !TRANSITION_RE.test(next) && next !== 'FADE OUT.'
    if (looksLikeCue && currentBlock === null) {
      currentBlock = { 角色: line, 台词: [] }
      continue
    }
    if (currentBlock !== null) {
      currentBlock.台词.push(line)
    } else {
      current.动作.push(line)
    }
  }
  flushScene()
  if (title === '') problems.push('剧本草稿缺少一级标题（# 标题）')
  if (scenes.length === 0) problems.push('剧本草稿里没有场景标题（INT./EXT. 地点 - 时间）')
  const numbers = scenes.map((s) => s.场号).sort((a, b) => a - b)
  numbers.forEach((n, i) => {
    if (n !== i + 1) problems.push('场号不连续：应从 01 起连续编号')
  })
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, problems, draft: { 标题: title, 场: scenes } }
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

const PLACEHOLDER = /【待写/

/**
 * 校验剧本草稿格式（确定性检查）。
 * 发现项按模块名分流：对白/括号提示类 →「剧本对白审读」；场次结构类 →
 * 「剧本场次完整性审读」。review.ts 的三个审读模块直接复用本函数的结果。
 */
export function validateScreenplay(draft: ScreenplayDraft): ScreenplayFinding[] {
  const out: ScreenplayFinding[] = []
  const 对白 = '剧本对白审读'
  const 完整 = '剧本场次完整性审读'
  let n = 1
  if (draft.场.length === 0) {
    out.push(finding(完整, `format-${n++}`, '高', '全文', '剧本没有场', '按分场大纲逐场写场景标题、动作与台词。'))
    return out
  }
  const seenCharacters = new Set<string>()
  for (const scene of draft.场) {
    const at = `场${String(scene.场号).padStart(2, '0')}`
    if (!(SCENE_TIME_TOKENS as readonly string[]).includes(scene.标题.时间)) {
      out.push(finding(完整, `format-${n++}`, '中', at, `场景时间「${scene.标题.时间}」不在常用时间词里（日/夜/黄昏/清晨/傍晚/深夜/DAY/NIGHT……）；除非时钟本身是剧情点，避免写具体钟点`, '改用常用时间词，或核对这个具体时间是不是剧情必需。'))
    }
    if (scene.标题.内外 === 'INT./EXT.') {
      out.push(finding(完整, `format-${n++}`, '中', at, '内外景未定（INT./EXT.）：分场大纲里这场没标明内/外', '到分场大纲核对这场是内景还是外景，改写场景标题。'))
    }
    if (scene.动作.length === 0 && scene.台词段.length === 0) {
      out.push(finding(完整, `format-${n++}`, '高', at, '空场：既无动作也无台词', '补写本场动作或台词，空场不能进审读。'))
    }
    for (const action of scene.动作) {
      if (PLACEHOLDER.test(action)) {
        out.push(finding(完整, `format-${n++}`, '高', at, '动作行还是【待写】占位：骨架未写成正文', '按分场大纲把本场动作写出来（现在时，只写可见/可听）。'))
      }
      if (/^SFX:|^MUSIC:/.test(action)) {
        out.push(finding(对白, `format-${n++}`, '高', at, '用了 `SFX:` / `MUSIC:` 独占一行：这是 BBC 广播剧格式，不是电影剧本格式', '音效写进动作行（关键音效词大写/明确提示）；音乐提示不进编剧层，进阶段 4 分镜头表。'))
      }
      if (/心想|心里想|暗想|他想|她想/.test(action)) {
        out.push(finding(完整, `format-${n++}`, '中', at, `动作行写了内心想法「${action.slice(0, 20)}……」：动作行只写看得见/听得见的`, '把内心想法转成可见的动作或台词，或删掉。'))
      }
      const shot = SHOT_WORDS.find((w) => action.includes(w))
      if (shot !== undefined) {
        out.push(finding(完整, `format-${n++}`, '低', at, `动作行写了镜头提示「${shot}」：编剧层应克制镜头提示（属于导演职权），除非该镜头对理解场景不可或缺`, '核对这个镜头是不是非写不可；不是就删掉，留到分镜头表。'))
      }
    }
    for (const block of scene.台词段) {
      const isFirstAppearance = !seenCharacters.has(block.角色)
      seenCharacters.add(block.角色)
      if (/[a-z]/.test(block.角色)) {
        out.push(finding(对白, `format-${n++}`, '高', `${at} ${block.角色}`, `角色名「${block.角色}」含小写拉丁字母：角色名须全大写${isFirstAppearance ? '（首次出场更须全大写）' : ''}`, '角色名改全大写（如 Selene、Jackson 写成 SELENE、JACKSON）。'))
      }
      if (block.台词.length === 0 || block.台词.every((l) => l.trim() === '')) {
        out.push(finding(对白, `format-${n++}`, '高', `${at} ${block.角色}`, `角色「${block.角色}」只有角色名没有台词`, '补写台词，或删掉这段空台词。'))
      }
      for (const line of block.台词) {
        if (PLACEHOLDER.test(line)) {
          out.push(finding(对白, `format-${n++}`, '高', `${at} ${block.角色}`, '台词还是【待写】占位：骨架未写成正文', '把这句台词写出来（口语化，推进冲突或揭示人物）。'))
        }
        if (/^SFX:|^MUSIC:/.test(line.trim())) {
          out.push(finding(对白, `format-${n++}`, '高', `${at} ${block.角色}`, '台词里出现 `SFX:` / `MUSIC:` 独占行：广播剧格式，不进电影剧本', '音效写进动作行；音乐提示进阶段 4 分镜头表。'))
        }
      }
      if (block.括号提示 !== undefined) {
        const inner = block.括号提示.replace(/^[（(]/, '').replace(/[）)]$/, '')
        if (inner.toLowerCase() === 'beat') {
          out.push(finding(对白, `format-${n++}`, '高', `${at} ${block.角色}`, '用了 `(beat)` 表示停顿：本工具定死停顿只用 `(pause)`（ScreenCraft 明确反对用 (beat) 表停顿）', '把 `(beat)` 改成 `(pause)`。'))
        } else if (inner !== 'pause' && /[A-Z]/.test(inner)) {
          out.push(finding(对白, `format-${n++}`, '中', `${at} ${block.角色}`, `括号提示「${block.括号提示}」含大写字母：括号提示小写、简短（专有名词除外）`, '括号提示改小写，保持简短。'))
        }
        if (inner.length > 15) {
          out.push(finding(对白, `format-${n++}`, '中', `${at} ${block.角色}`, `括号提示「${block.括号提示}」超过 15 字：括号提示要短，不要用作动作描写`, '缩短括号提示，或把内容移到动作行。'))
        }
      }
    }
  }
  return out
}

/**
 * 分场大纲 → 剧本草稿骨架（转换，不代写正文）：
 * 每场一个场景标题（由 parseSceneField 拆大纲「场景」），动作与台词各留
 * 一处【待写】占位。骨架经 validateScreenplay 必报高级别待写项——
 * 骨架本身不是成品，须逐场写完再审读。
 */
export function draftFromOutline(outline: SceneOutline): ScreenplayDraft {
  return {
    标题: outline.标题,
    场: outline.场.map((s) => {
      const parsed = parseSceneField(s.场景)
      const firstCharacter = s.人物.split(/[、,，]/).map((c) => c.trim()).filter((c) => c !== '')[0] ?? '主角'
      return {
        场号: s.场号,
        标题: { 内外: parsed.内外 ?? 'INT./EXT.', 地点: parsed.地点, 时间: parsed.时间 === '' ? '日' : parsed.时间 },
        动作: ['【待写：按分场大纲写本场动作——现在时，只写可见/可听】'],
        台词段: [{ 角色: firstCharacter, 台词: ['【待写台词】'] }],
      }
    }),
  }
}
