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
 *
 * 对齐轮次（阶段 4 对齐，格式取自《痴迷》参考案例
 * docs/examples/痴迷-12集分镜剧本-参考案例.docx，全 12 集 911 镜实测）：
 * - 场头：`1-1 日／内 餐厅卡座`（集-场 日/夜／内/外 地点）。
 * - 人物行：`人物：贝尔（毛衣男子）、伊恩（棒球帽男子）`（人名 + 括号内形象标识）。
 * - 场景环境行：`场景环境：美式复古风格餐厅室内。……`（中文描写）。
 * - 镜头块头：`△【镜头01｜时间：00:00—00:42｜景别：近景｜角度：平视正面｜运镜：固定镜头】`
 *   五字段缺一不可；镜头号与时间码都是集内累计、集间重置。
 * - 镜头块内：△站位/动作/表情行各独立成行；对白行 `角色（语速…，音量…，语调…，尾音…）：对白`，
 *   画外音在标注最前面加「画外音，」；`【环境声：……】` / `【字幕：……】` 各单独成行；
 *   无人物面部时用 `△【本镜头无人物面部，表情不适用】` 等变体行。
 * - 集末：`【画面淡出黑场】`，下一集镜头号与时间码从 01 / 00:00 重新开始。
 * - 语言规则：说明/场景/动作文字一律中文，对白按目标市场语言（海外题材为英文）。
 *   这是“输出永远中文”的边界：团队看的说明文字是中文，演员说的对白是目标市场语言。
 * - 景别/角度/运镜词表见本文件的 SHOT_SIZE_VOCAB / SHOT_ANGLE_VOCAB / SHOT_MOVEMENT_VOCAB
 *   （从案例全文词频提取；不在词表里只警告、不判错——案例本身也有长尾写法）。
 * - 渲染—解析往返一致：renderEpisodeScript 的输出经 parseEpisodeScript 读回
 *   必须逐字节还原（逐字节测试见 screenplay-export.spec.ts 与 shortdrama-example.spec.ts）。
 */

import { paths } from '../repo/paths'
import { RHYTHM_TEMPLATES } from './templates'
import {
  type EpisodeCharacter,
  type EpisodeScriptInput,
  type EpisodeShot,
  type RenderedEpisodeScript,
  type ScriptLine,
  type ScriptScene,
  isHookType,
  isShortDramaOrientation,
} from './types'

/** 停顿标记：只用 `(pause)`，不用 `(beat)`（见文件头约定）。 */
export const PAUSE_MARK = '(pause)'

/** 单句台词上限（字）：中文指南约每句 <12 字（调研 §2.2）。 */
export const MAX_DIALOGUE_CHARS = 12

/**
 * 景别词表（《痴迷》案例全文词频：近景 536 / 中景 195 / 特写 78 / 全景 47 /
 * 大特写 9 / 中近景 8；另有 `中景→近景` 等过渡写法，用 `→` 连接两个基本词）。
 */
export const SHOT_SIZE_VOCAB = ['近景', '中景', '特写', '全景', '大特写', '中近景', '远景', '中远景', '极远景'] as const

/**
 * 角度词表（《痴迷》案例全文词频前列：平视正面 170 / 正面平视 120 /
 * 侧面平视 97 / 微侧平视 65 / 平视 63 / 平视侧面 54 / 平视微侧 34 /
 * 平视正面微侧 31 / 侧面俯拍 / 俯拍 / 极低仰角平视地面 / 极低角度俯拍）。
 */
export const SHOT_ANGLE_VOCAB = [
  '平视正面', '正面平视', '侧面平视', '微侧平视', '平视', '平视侧面', '平视微侧',
  '平视正面微侧', '侧面俯拍', '俯拍', '极低仰角平视地面', '极低角度俯拍',
] as const

/**
 * 运镜词表（《痴迷》案例全文词频：固定镜头 763，占绝对多数；其余为
 * 手持微晃 / 微晃动 / 缓慢推进 / 手持剧烈晃动 / 微晃手持 / 由远及近缓慢下推 /
 * 低机位平移推进 / 向内缓慢推进）。
 */
export const SHOT_MOVEMENT_VOCAB = [
  '固定镜头', '手持微晃', '微晃动', '缓慢推进', '手持剧烈晃动', '微晃手持',
  '由远及近缓慢下推', '低机位平移推进', '向内缓慢推进',
] as const

/** 集末淡出黑场行（《痴迷》案例集末写法；每集末尾一行，下一集从 01 / 00:00 重置）。 */
export const EPISODE_FADE_OUT = '【画面淡出黑场】'

/** 无人物面部时的 △ 变体行（案例写法；放进镜头块的 描写 里）。 */
export const NO_FACE_SHOT_NOTE = '【本镜头无人物面部，表情不适用】'

/** 秒数 → `MM:SS`（分可超 59，如横屏长集 12:34）。 */
export function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** `MM:SS` → 秒；非法返回 null。 */
export function parseTimecode(value: string): number | null {
  const m = /^(\d{1,3}):(\d{2})$/.exec(value.trim())
  if (m === null) return null
  const seconds = Number(m[1]) * 60 + Number(m[2])
  return Number(m[2]) < 60 ? seconds : null
}

/** 一场全部台词：有分镜头时取各镜台词扁平汇总，否则取场台词（供字数统计与 Fountain 导出复用）。 */
export function sceneDialogueLines(scene: ScriptScene): readonly ScriptLine[] {
  if (scene.镜头 === undefined) return scene.台词
  return scene.镜头.flatMap((shot) => shot.台词)
}

/** 一集全部台词角色（按出场顺序去重；供人名一致性检查用）。 */
export function episodeCharacterNames(episode: EpisodeScriptInput): string[] {
  const names: string[] = []
  for (const scene of episode.场景) {
    for (const line of sceneDialogueLines(scene)) {
      if (!names.includes(line.角色)) names.push(line.角色)
    }
  }
  return names
}

/** 一场分镜头总数：有镜头取镜数，否则模板出一镜（供镜头号跨场连续计数用）。 */
export function countEpisodeShots(scene: ScriptScene): number {
  return scene.镜头 === undefined ? 1 : scene.镜头.length
}

/**
 * 场头的日/夜：从场景 `时间` 推导——含 夜/晚/凌晨/深夜 → 夜；含
 * 日/白天/上午/下午/清晨/黄昏 → 日；其余原样透传（如 `黄昏` 以外的时间词）。
 */
export function dayNightLabel(时间: string): string {
  if (/夜|晚|凌晨|深夜/.test(时间)) return '夜'
  if (/日|白天|上午|下午|清晨|黄昏/.test(时间)) return '日'
  return 时间
}

function checkShotVocab(value: string, vocab: readonly string[], label: string, where: string, warnings: string[]): void {
  if (value.trim() === '' || value.trim() === '—') return
  const parts = value.trim().split('→')
  for (const part of parts) {
    if (!(vocab as readonly string[]).includes(part.trim())) {
      warnings.push(`${where}：${label}「${value}」不在常用词表里（${vocab.join('/')}），核对是不是笔误`)
      return
    }
  }
}

/** 台词字数：数非空白字符（中文按字计，含标点）。 */
export function dialogueChars(line: string): number {
  return [...line].filter((ch) => !/\s/.test(ch)).length
}

/** 一集台词总字数（竖屏 180–360 字，见 templates.ts；有分镜头时按各镜台词计）。 */
export function totalDialogueChars(scenes: readonly ScriptScene[]): number {
  let n = 0
  for (const scene of scenes) for (const line of sceneDialogueLines(scene)) n += dialogueChars(line.台词)
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

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${field}必须是一个对象`)
  return value as Record<string, unknown>
}

function requireArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${field}必须是一个数组`)
  return value
}

function requireString(value: unknown, field: string): void {
  if (typeof value !== 'string') fail(`${field}必须是字符串`)
}

function requireNumber(value: unknown, field: string): void {
  if (typeof value !== 'number') fail(`${field}必须是数字`)
}

function requireStringArray(value: unknown, field: string): void {
  for (const [index, item] of requireArray(value, field).entries()) requireString(item, `${field}[${index}]`)
}

function validateLines(value: unknown, field: string): void {
  for (const [index, item] of requireArray(value, field).entries()) {
    const where = `${field}[${index}]`
    const line = requireRecord(item, where)
    requireString(line['角色'], `${where}.角色`)
    requireString(line['台词'], `${where}.台词`)
    if (line['括号提示'] !== undefined) requireString(line['括号提示'], `${where}.括号提示`)
  }
}

/** 工具参数来自运行时 JSON；先检查结构，再执行依赖字符串/数组方法的领域校验。 */
function validateStructure(input: unknown): void {
  const value = requireRecord(input, '参数')
  for (const field of ['标题', '核心想法', '爽点', '结尾悬念']) requireString(value[field], field)
  if (!isShortDramaOrientation(value['画幅'])) fail('画幅必须是竖屏或横屏')
  if (!isHookType(value['钩子类型'])) fail('钩子类型必须是身份、情感或顿悟')
  for (const field of ['开场冲突秒', '结尾钩子秒']) requireNumber(value[field], field)
  for (const [index, second] of requireArray(value['反转秒'], '反转秒').entries()) requireNumber(second, `反转秒[${index}]`)
  for (const [index, item] of requireArray(value['场景'], '场景').entries()) {
    const where = `场景[${index}]`
    const scene = requireRecord(item, where)
    for (const field of ['地点', '时间', '动作']) requireString(scene[field], `${where}.${field}`)
    if (scene['内外'] !== '内' && scene['内外'] !== '外') fail(`${where}.内外必须是内或外`)
    validateLines(scene['台词'], `${where}.台词`)
    if (scene['场景环境'] !== undefined) requireString(scene['场景环境'], `${where}.场景环境`)
    if (scene['人物'] !== undefined) {
      for (const [personIndex, personItem] of requireArray(scene['人物'], `${where}.人物`).entries()) {
        const personWhere = `${where}.人物[${personIndex}]`
        const person = requireRecord(personItem, personWhere)
        requireString(person['角色'], `${personWhere}.角色`)
        if (person['形象标识'] !== undefined) requireString(person['形象标识'], `${personWhere}.形象标识`)
      }
    }
    if (scene['镜头'] !== undefined) {
      for (const [shotIndex, shotItem] of requireArray(scene['镜头'], `${where}.镜头`).entries()) {
        const shotWhere = `${where}.镜头[${shotIndex}]`
        const shot = requireRecord(shotItem, shotWhere)
        requireNumber(shot['镜头号'], `${shotWhere}.镜头号`)
        for (const field of ['开始秒', '结束秒']) {
          if (shot[field] !== null) requireNumber(shot[field], `${shotWhere}.${field}（未知时填 null）`)
        }
        for (const field of ['景别', '角度', '运镜']) requireString(shot[field], `${shotWhere}.${field}`)
        requireStringArray(shot['描写'], `${shotWhere}.描写`)
        validateLines(shot['台词'], `${shotWhere}.台词`)
        for (const field of ['环境声', '字幕']) {
          if (shot[field] !== undefined) requireStringArray(shot[field], `${shotWhere}.${field}`)
        }
      }
    }
  }
}

function validate(input: EpisodeScriptInput): string[] {
  validateStructure(input)
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
    if (scene.人物 !== undefined) {
      const names = new Set<string>()
      for (const person of scene.人物) {
        if (person.角色.trim() === '') fail(`集${input.集} 场${scene.场}：人物行里有人名为空`)
        if (names.has(person.角色)) fail(`集${input.集} 场${scene.场}：人物行里 ${person.角色} 重复`)
        names.add(person.角色)
      }
    }
    for (const line of sceneDialogueLines(scene)) {
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
  // 分镜头校验（对齐轮次）：镜头号集内连续、时间码集内累计且不超出单集时长、
  // 景别/角度/运镜必填（模板镜除外：时间未知时三项可填 `—`，只警告）。
  let expectedShot = 1
  for (const scene of [...input.场景].sort((a, b) => a.场 - b.场)) {
    if (scene.镜头 === undefined) {
      expectedShot += 1
      continue
    }
    for (const shot of scene.镜头) {
      const where = `集${input.集} 场${scene.场} 镜头${String(shot.镜头号).padStart(2, '0')}`
      if (shot.镜头号 !== expectedShot) fail(`集${input.集}：镜头号须从 1 起集内连续（第 ${expectedShot} 镜应为镜头${String(expectedShot).padStart(2, '0')}，收到镜头${String(shot.镜头号).padStart(2, '0')}）`)
      expectedShot += 1
      if (shot.描写.length === 0) fail(`${where}：至少要有一行 △站位/动作/表情行（无面部时用「${NO_FACE_SHOT_NOTE}」）`)
      if (shot.描写.every((d) => d.trim() === '')) fail(`${where}：描写行全为空（至少要有一行非空的 △站位/动作/表情行；空行渲染不出内容，见 renderShotBlock）`)
      if (shot.开始秒 !== null && shot.结束秒 !== null) {
        if (!Number.isSafeInteger(shot.开始秒) || !Number.isSafeInteger(shot.结束秒) || shot.开始秒 < 0 || shot.结束秒 <= shot.开始秒) {
          fail(`${where}：时间码须为 00:00—MM:SS 且开始早于结束（收到：${formatTimecode(shot.开始秒)}—${formatTimecode(shot.结束秒)}）`)
        }
        if (shot.结束秒 > input.时长秒) fail(`${where}：时间码超出单集时长（结束 ${formatTimecode(shot.结束秒)}，本集 ${input.时长秒} 秒）`)
      } else if ((shot.开始秒 === null) !== (shot.结束秒 === null)) {
        fail(`${where}：时间码开始与结束须同时给或同时空（模板镜填 —）`)
      }
      for (const [label, value] of [['景别', shot.景别], ['角度', shot.角度], ['运镜', shot.运镜]] as const) {
        if (value.trim() === '' || value.trim() === '—') {
          if (shot.开始秒 !== null) fail(`${where}：${label}不能为空（有时间码的镜必须填实；模板镜才填 —）`)
          warnings.push(`${where}：${label}待填（填 — 表示暂无，导演补）`)
        }
      }
      checkShotVocab(shot.景别, SHOT_SIZE_VOCAB, '景别', where, warnings)
      checkShotVocab(shot.角度, SHOT_ANGLE_VOCAB, '角度', where, warnings)
      checkShotVocab(shot.运镜, SHOT_MOVEMENT_VOCAB, '运镜', where, warnings)
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
 * 渲染一镜的 △ 块（对齐轮次，分镜剧本形状）。
 * 空的 △描写行（空字符串/空白）一律跳过，渲染器永不输出裸 `△` 行
 * （2026-11-11 修：《夜市摊主》集001 镜头03 的空描写曾渲染出裸 `△` 行）。
 * 描写全空的输入由 validate 阻断（见下），这里是第二道防线（renderEpisodeMarkdown
 * 不经过 validate 的路径也一样不出裸行）。
 */
export function renderShotBlock(shot: EpisodeShot): string {
  const 时间 = shot.开始秒 === null || shot.结束秒 === null
    ? '—'
    : `${formatTimecode(shot.开始秒)}—${formatTimecode(shot.结束秒)}`
  const lines: string[] = [
    `△【镜头${String(shot.镜头号).padStart(2, '0')}｜时间：${时间}｜景别：${shot.景别}｜角度：${shot.角度}｜运镜：${shot.运镜}】`,
  ]
  for (const desc of shot.描写) {
    if (desc.trim() === '') continue
    lines.push(`△${desc}`)
  }
  for (const line of shot.台词) lines.push(renderLine(line))
  for (const env of shot.环境声 ?? []) lines.push(`【环境声：${env}】`)
  for (const sub of shot.字幕 ?? []) lines.push(`【字幕：${sub}】`)
  return lines.join('\n')
}

function renderTemplateShot(scene: ScriptScene, 镜头号: number): string {
  return renderShotBlock({
    镜头号,
    开始秒: null,
    结束秒: null,
    景别: '—',
    角度: '—',
    运镜: '—',
    描写: [scene.动作],
    台词: scene.台词,
  })
}

/**
 * 渲染一场（对齐轮次，分镜剧本形状，供 renderEpisodeScript 与阶段 4 剧本导出复用同一口径；
 * 改动渲染格式时只改这里）。
 *
 * ```
 * 1-1 日／内 苏家客厅
 * 人物：顾霆琛（赘婿）、苏晚（妻子）
 * 场景环境：苏家客厅。……
 * △【镜头01｜时间：00:00—00:30｜景别：近景｜角度：平视正面｜运镜：固定镜头】
 * △顾霆琛站在客厅中央，面向苏晚。
 * 顾霆琛（语速缓慢，音量偏低，语调平稳，尾音轻落）：这婚，我不离。
 * 【环境声：客厅空调轻响】
 * ```
 *
 * `集` 是本集集号（场头用）；`镜头起始号` 是本场第一镜的集内编号
 * （镜头号集内连续，调用方按场顺序累加，见 countEpisodeShots）。
 * 没有分镜头数据的场出一镜模板行（五字段填 `—`），不编造导演的决定。
 */
export function renderEpisodeSceneBlock(scene: ScriptScene, 集: number, 镜头起始号 = 1): string {
  const lines: string[] = [`${集}-${scene.场} ${dayNightLabel(scene.时间)}／${scene.内外} ${scene.地点}`, '']
  if (scene.人物 !== undefined && scene.人物.length > 0) {
    lines.push(`人物：${scene.人物.map((p) => (p.形象标识 === undefined ? p.角色 : `${p.角色}（${p.形象标识}）`)).join('、')}`, '')
  }
  lines.push(`场景环境：${scene.场景环境 ?? scene.动作}`, '')
  if (scene.镜头 === undefined) {
    lines.push(renderTemplateShot(scene, 镜头起始号), '')
  } else {
    for (const shot of scene.镜头) lines.push(renderShotBlock(shot), '')
  }
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
  let 镜头号 = 1
  for (const scene of [...input.场景].sort((a, b) => a.场 - b.场)) {
    lines.push(renderEpisodeSceneBlock(scene, input.集, 镜头号))
    镜头号 += countEpisodeShots(scene)
  }
  lines.push(EPISODE_FADE_OUT, '')
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
/** 场头：`1-1 日／内 苏家客厅`（集-场 日/夜／内/外 地点；／ 也认 `/`）。 */
const EPISODE_SCENE_RE = /^(\d+)-(\d+)\s+(\S+)[／/](内|外)\s+(.+?)\s*$/
/** 旧版场头 `## 场01. 地点 时间 内/外`（对齐轮次已改场头格式，解析到就报迁移提示）。 */
const EPISODE_SCENE_LEGACY_RE = /^##\s*场(\d+)\s*\.\s*(.+?)\s*$/
/** 镜头块头：`△【镜头01｜时间：00:00—00:42｜景别：近景｜角度：平视正面｜运镜：固定镜头】`（｜ 也认 `|`）。 */
const EPISODE_SHOT_RE = /^△【镜头(\d+)[｜|]时间[：:](.+?)[｜|]景别[：:](.+?)[｜|]角度[：:](.+?)[｜|]运镜[：:](.+?)】$/
const EPISODE_CHARACTER_RE = /^人物[：:]\s*(.+?)\s*$/
const EPISODE_SETTING_RE = /^场景环境[：:]\s*(.+?)\s*$/
const EPISODE_SOUND_RE = /^【环境声[：:](.+)】$/
const EPISODE_SUBTITLE_RE = /^【字幕[：:](.+)】$/
const EPISODE_DIALOGUE_RE = /^([^：:（(]{1,15}?)(?:[（(]([^）)]+)[）)])?[：:](.+)$/
const EPISODE_BEAT_OPEN_RE = /^-\s*开场冲突：\s*第\s*(\d+)\s*秒/
const EPISODE_BEAT_HOOK_RE = /^-\s*结尾钩子：\s*第\s*(\d+)\s*秒/

function parseShotTimecode(raw: string, where: string, problems: string[]): { 开始秒: number | null; 结束秒: number | null } {
  const value = raw.trim()
  if (value === '—' || value === '') return { 开始秒: null, 结束秒: null }
  const parts = value.split(/[—-]/)
  if (parts.length !== 2) {
    problems.push(`${where}：时间码格式不对，应为「MM:SS—MM:SS」或「—」（收到：${value}）`)
    return { 开始秒: null, 结束秒: null }
  }
  const 开始秒 = parseTimecode(parts[0]!)
  const 结束秒 = parseTimecode(parts[1]!)
  if (开始秒 === null || 结束秒 === null) {
    problems.push(`${where}：时间码格式不对，应为「MM:SS—MM:SS」（收到：${value}）`)
    return { 开始秒: null, 结束秒: null }
  }
  return { 开始秒, 结束秒 }
}

function parseCharacterLine(raw: string, where: string, problems: string[]): EpisodeCharacter[] {
  const people: EpisodeCharacter[] = []
  for (const segment of raw.split('、')) {
    const part = segment.trim()
    if (part === '') continue
    const m = /^([^（(]+?)(?:[（(]([^）)]+)[）)])?$/.exec(part)
    if (m === null || (m[1] ?? '').trim() === '') {
      problems.push(`${where}：人物行格式不对，应为「人物：名字（形象标识）、名字……」（收到：${part}）`)
      continue
    }
    people.push({
      角色: m[1]!.trim(),
      ...(m[2] !== undefined ? { 形象标识: m[2].trim() } : {}),
    })
  }
  return people
}

function episodeMetaValue(lines: readonly string[], label: string): string | undefined {
  for (const line of lines) {
    const m = new RegExp(`^-\\s*${label}[：:]\\s*(.+?)\\s*$`).exec(line)
    if (m) return m[1]!.trim()
  }
  return undefined
}

/**
 * 解析一集短剧剧本（renderEpisodeScript 的输出格式，对齐轮次分镜形状）。
 *
 * 约定：场头 `集-场 日/夜／内/外 地点` → 可选人物行 → 场景环境行 →
 * 镜头块（`△【镜头NN｜时间｜景别｜角度｜运镜】` + △站位/动作/表情行 +
 * `角色（标注）：台词` + `【环境声：……】` / `【字幕：……】`）→ 集末
 * `【画面淡出黑场】` → `## 节拍表`（开场冲突/反转/结尾钩子秒数）。
 * 旧版场头 `## 场01. 地点 时间 内/外` 不再接受，报迁移提示。
 * `SFX:` / `MUSIC:` 独占行与 `(beat)` 一律记解析问题（与电影剧本同一口径：
 * 前者是广播剧格式，后者停顿只用 `(pause)`）。横屏专用的 首场冲突 /
 * 起承转合 不写进集文本，解析结果不含这两项（导出时不依赖它们）。
 * 解析后用 renderEpisodeScript 重渲染一次校验：结构非法（集号越界、场号不连续、
 * 时长越界、镜头号不连续等）直接报问题。
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
  interface MutableShot {
    镜头号: number
    开始秒: number | null
    结束秒: number | null
    景别: string
    角度: string
    运镜: string
    描写: string[]
    台词: ScriptLine[]
    环境声: string[]
    字幕: string[]
  }
  interface MutableScene {
    集: number
    场: number
    地点: string
    时间: string
    内外: '内' | '外'
    动作: string
    台词: ScriptLine[]
    人物: EpisodeCharacter[]
    场景环境: string
    镜头: MutableShot[]
    seenSetting: boolean
  }
  let current: MutableScene | null = null
  let currentShot: MutableShot | null = null
  let inBeats = false
  let 开场冲突秒 = NaN
  let 反转秒: number[] = []
  let 结尾钩子秒 = NaN
  const flushScene = (): void => {
    if (current !== null) {
      const flatLines = current.镜头.flatMap((s) => s.台词)
      场景.push({
        场: current.场,
        地点: current.地点,
        时间: current.时间,
        内外: current.内外,
        动作: current.动作,
        台词: flatLines.length > 0 ? flatLines : current.台词,
        ...(current.人物.length > 0 ? { 人物: current.人物 } : {}),
        ...(current.场景环境 !== '' ? { 场景环境: current.场景环境 } : {}),
        ...(current.镜头.length > 0
          ? {
            镜头: current.镜头.map((s): EpisodeShot => ({
              镜头号: s.镜头号,
              开始秒: s.开始秒,
              结束秒: s.结束秒,
              景别: s.景别,
              角度: s.角度,
              运镜: s.运镜,
              描写: s.描写,
              台词: s.台词,
              ...(s.环境声.length > 0 ? { 环境声: s.环境声 } : {}),
              ...(s.字幕.length > 0 ? { 字幕: s.字幕 } : {}),
            })),
          }
          : {}),
      })
    }
    current = null
    currentShot = null
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
    if (line === EPISODE_FADE_OUT) continue
    const legacyScene = EPISODE_SCENE_LEGACY_RE.exec(line)
    if (legacyScene) {
      problems.push(`场${legacyScene[1]} 还是旧版场头「## 场01. 地点 时间 内/外」：对齐轮次已改场头为「集-场 日/夜／内/外 地点」（如 1-1 日／内 苏家客厅），请用新版格式重写`)
      continue
    }
    const sceneMatch = EPISODE_SCENE_RE.exec(line)
    if (sceneMatch) {
      flushScene()
      inBeats = false
      const scene集 = Number(sceneMatch[1])
      const scene场 = Number(sceneMatch[2])
      if (集 !== 0 && scene集 !== 集) {
        problems.push(`场头集号与集标题不一致：集标题是集${集}，场头写成 ${sceneMatch[1]}-${sceneMatch[2]}`)
        continue
      }
      current = {
        集: scene集, 场: scene场, 地点: sceneMatch[5]!.trim(), 时间: sceneMatch[3]!.trim(),
        内外: sceneMatch[4]! as '内' | '外', 动作: '', 台词: [], 人物: [], 场景环境: '', 镜头: [], seenSetting: false,
      }
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
      problems.push(`场景标题之外出现正文「${line.slice(0, 20)}……」：单集剧本正文必须先有场头（集-场 日/夜／内/外 地点）`)
      continue
    }
    const where = `集${current.集} 场${String(current.场).padStart(2, '0')}`
    const characterMatch = EPISODE_CHARACTER_RE.exec(line)
    if (characterMatch) {
      if (current.镜头.length > 0) {
        problems.push(`${where}：人物行须在镜头块之前（收到：${line.slice(0, 20)}……）`)
        continue
      }
      current.人物.push(...parseCharacterLine(characterMatch[1]!, where, problems))
      continue
    }
    const settingMatch = EPISODE_SETTING_RE.exec(line)
    if (settingMatch) {
      if (current.镜头.length > 0) {
        problems.push(`${where}：场景环境行须在镜头块之前（收到：${line.slice(0, 20)}……）`)
        continue
      }
      const value = settingMatch[1]!.trim()
      if (/^SFX:|^MUSIC:/.test(value)) {
        problems.push(`${where}：场景环境行用了 \`SFX:\` / \`MUSIC:\` 独占行写法：这是 BBC 广播剧格式，不是电影/短剧剧本格式（音效写进动作行，音乐提示进分镜头表）`)
        continue
      }
      current.场景环境 = value
      current.动作 = value
      current.seenSetting = true
      continue
    }
    const shotMatch = EPISODE_SHOT_RE.exec(line)
    if (shotMatch) {
      if (!current.seenSetting) {
        problems.push(`${where}：镜头块之前缺少场景环境行（应先写「场景环境：……」）`)
        continue
      }
      const shotWhere = `${where} 镜头${shotMatch[1]}`
      const { 开始秒, 结束秒 } = parseShotTimecode(shotMatch[2]!, shotWhere, problems)
      currentShot = {
        镜头号: Number(shotMatch[1]),
        开始秒, 结束秒,
        景别: shotMatch[3]!.trim(),
        角度: shotMatch[4]!.trim(),
        运镜: shotMatch[5]!.trim(),
        描写: [], 台词: [], 环境声: [], 字幕: [],
      }
      current.镜头.push(currentShot)
      continue
    }
    if (line.startsWith('△')) {
      if (currentShot === null) {
        problems.push(`${where}：△描写行在镜头块之外（须先写「△【镜头NN｜时间｜景别｜角度｜运镜】」）`)
        continue
      }
      const desc = line.slice(1)
      if (/^SFX:|^MUSIC:/.test(desc)) {
        problems.push(`${where}：△描写行用了 \`SFX:\` / \`MUSIC:\` 独占行写法：这是 BBC 广播剧格式，不是电影/短剧剧本格式（音效写进动作行，音乐提示进分镜头表）`)
        continue
      }
      currentShot.描写.push(desc)
      continue
    }
    const soundMatch = EPISODE_SOUND_RE.exec(line)
    if (soundMatch) {
      if (currentShot === null) {
        problems.push(`${where}：【环境声】行在镜头块之外`)
        continue
      }
      currentShot.环境声.push(soundMatch[1]!.trim())
      continue
    }
    const subtitleMatch = EPISODE_SUBTITLE_RE.exec(line)
    if (subtitleMatch) {
      if (currentShot === null) {
        problems.push(`${where}：【字幕】行在镜头块之外`)
        continue
      }
      currentShot.字幕.push(subtitleMatch[1]!.trim())
      continue
    }
    const dialogue = EPISODE_DIALOGUE_RE.exec(line)
    if (dialogue === null) {
      problems.push(`${where} 有一行既不是场景环境、镜头块也不是「角色：台词」：「${line.slice(0, 20)}……」`)
      continue
    }
    if (currentShot === null) {
      problems.push(`${where}：台词行在镜头块之外（对白须写进镜头块里）`)
      continue
    }
    const mark = dialogue[2]
    if (mark !== undefined && isBeatMark(mark)) {
      problems.push(`${where} ${dialogue[1]}：括号提示用了 (beat)，停顿只用 ${PAUSE_MARK}`)
    }
    currentShot.台词.push({
      角色: dialogue[1]!.trim(),
      ...(mark !== undefined ? { 括号提示: mark.trim() } : {}),
      台词: dialogue[3]!.trim(),
    })
  }
  flushScene()
  if (场景.length === 0) problems.push('单集剧本里没有场景（场头：集-场 日/夜／内/外 地点，如 1-1 日／内 苏家客厅）')
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
