/**
 * 短剧管线（阶段 3）：共用类型。
 *
 * 只在契约 `输出形态=短剧` 时走这条管线。集/场寻址用阶段 0.5 已有的键
 * （集三位、场两位，见 packages/core/src/repo/paths.ts 的 episodeNo / sceneNo），
 * 不复用卷/章参数名。定稿输出路径用 paths.短剧集(集号)（`剧本/短剧/集001.md` 起）。
 *
 * 节奏规则来源：docs/research/film-drama-research.md 第 2 节（短剧惯例，约 22 条来源）。
 * 调研里明确写着“未确认”的 7 项（调研笔记第 5 节）一律不编进模板；
 * 凡是调研原文没有、但模板必须先定下来的数，一律标为「工具约定」并在
 * templates.ts 里写明出处与待确认点，不冒充调研结论。
 */

import type { GenreTierId } from '../design/genres'
import type { Market } from '../repo/document-fields'

/** 画幅：竖屏与横屏是两种产品（调研 §2.4），各用一套节奏模板，不混成一个。 */
export type ShortDramaOrientation = '竖屏' | '横屏'
export const SHORTDRAMA_ORIENTATIONS = ['竖屏', '横屏'] as const

/** 结尾钩子的三种类型（调研 §2.2）：身份 / 情感 / 顿悟，三集轮换。 */
export type HookType = '身份' | '情感' | '顿悟'
export const HOOK_TYPES = ['身份', '情感', '顿悟'] as const

/** 钩子轮换顺序：前三集定生死——第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩，此后循环。 */
export const HOOK_ROTATION: readonly HookType[] = ['身份', '情感', '顿悟']

export function hookTypeForEpisode(集: number): HookType {
  if (!Number.isSafeInteger(集) || 集 < 1) throw new Error(`集号必须是正整数（收到：${String(集)}）`)
  return HOOK_ROTATION[(集 - 1) % HOOK_ROTATION.length] as HookType
}

export function isHookType(value: unknown): value is HookType {
  return typeof value === 'string' && (HOOK_TYPES as readonly string[]).includes(value)
}

export function isShortDramaOrientation(value: unknown): value is ShortDramaOrientation {
  return typeof value === 'string' && (SHORTDRAMA_ORIENTATIONS as readonly string[]).includes(value)
}

/** 一集的节拍时间点（秒）。节拍检查器只读这些数，不读正文猜测。 */
export interface EpisodeBeats {
  /** 集号（1 起，与 paths.短剧集 的集号一致）。 */
  readonly 集: number
  readonly 画幅: ShortDramaOrientation
  /** 单集时长（秒）：竖屏 60–120，横屏 600–1200。 */
  readonly 时长秒: number
  /** 开场冲突出现的秒数（竖屏要求 ≤5）。 */
  readonly 开场冲突秒: number
  /** 是否放了片头（竖屏要求：无）。 */
  readonly 有片头: boolean
  /** 开场是否有铺垫场景/自我介绍（竖屏要求：无）。 */
  readonly 有开场铺垫: boolean
  /** 反转出现的时间点（秒），升序。 */
  readonly 反转秒: readonly number[]
  /** 结尾钩子开始的秒数（竖屏要求：在结尾 5–10 秒内开始）。 */
  readonly 结尾钩子秒: number
  /** 结尾钩子的类型。 */
  readonly 钩子类型: HookType
  /** 结尾是否切在问题上（true）还是答案上（false）。 */
  readonly 结尾切在问题上: boolean
  /** 本集主角是否取得第一次真正的胜利（全季只应有一集为 true）。 */
  readonly 首次胜利: boolean
  /**
   * 横屏专用：开场冲突是否在首场内（横屏不设 5 秒硬限，见 templates.ts）。
   * 竖屏集可省略（竖屏用 开场冲突秒 判定）。
   */
  readonly 首场冲突?: boolean
  /**
   * 横屏专用：起承转合四段是否齐全（横屏是偏精品叙事的完整结构，见 templates.ts）。
   * 竖屏集可省略。
   */
  readonly 起承转合?: Readonly<{ 起: boolean; 承: boolean; 转: boolean; 合: boolean }>
}

/** 分集大纲里一集的结构位（钩子/爽点分布，内容由作者/模型填，不由规划器发明情节）。 */
export interface EpisodeOutlineSlot {
  readonly 集: number
  readonly 画幅: ShortDramaOrientation
  /** 本集结尾钩子类型（按 HOOK_ROTATION 排布，前三集 身份→情感→顿悟）。 */
  readonly 钩子类型: HookType
  /** 本集要求的最少反转次数（竖屏：90 秒至少 2 次；横屏：模板约定下限 2 次）。 */
  readonly 最少反转次数: number
  /** 本集场景数范围。 */
  readonly 场景数: readonly [number, number]
  /** 预计时长（秒）范围。 */
  readonly 时长秒: readonly [number, number]
  /** 预计台词字数范围（竖屏 180–360 字；横屏不设总量硬限，见 templates.ts）。 */
  readonly 台词字数: readonly [number, number] | null
  /** 是否为付费墙集（竖屏第 10–11 集；横屏无此概念，见 templates.ts）。 */
  readonly 付费墙集: boolean
  /** 是否为本季第一次真正的胜利所在的集（竖屏不晚于第 5 集）。 */
  readonly 首胜集: boolean
}

/** 一季的分集规划骨架（不含情节正文，只含结构位与全季卡点）。 */
export interface SeasonPlan {
  readonly 市场: Market
  readonly 题材档: GenreTierId
  readonly 画幅: ShortDramaOrientation
  readonly 总集数: number
  /** 竖屏：首个付费集（10 或 11）；横屏：null（无按集付费墙概念）。 */
  readonly 付费集: number | null
  /** 第一次真正的胜利所在的集号（竖屏不晚于第 5 集）。 */
  readonly 首胜集: number
  readonly 集大纲: readonly EpisodeOutlineSlot[]
}

/** 填好内容的分集大纲（一集一个核心想法，见 outline.ts）。 */
export interface EpisodeOutline {
  readonly 集: number
  readonly 标题: string
  readonly 钩子类型: HookType
  /** 一集只容一个想法（调研 §2.2）：一句话写清本集要让观众记住什么。 */
  readonly 核心想法: string
  /** 本集的爽点（一句话：打脸 / 逆袭 / 揭露……）。 */
  readonly 爽点: string
  /** 开场冲突（一句话，第一句台词或第一个动作就是冲突本身）。 */
  readonly 开场冲突: string
  /** 本集的反转（每条一句话；数量须满足结构位的最少反转次数）。 */
  readonly 反转: readonly string[]
  /** 结尾悬念（一句话，必须是问题，不是答案）。 */
  readonly 结尾悬念: string
}

/** 单集剧本的一句台词。 */
export interface ScriptLine {
  readonly 角色: string
  readonly 台词: string
  /**
   * 括号提示：只写语气/对象，少用；停顿只用 `(pause)`（见 script.ts 的停顿约定）。
   * 省略时不写。
   *
   * 对齐轮次（按《痴迷》参考案例）：括号提示也是对白的表演标注位，可写
   * 「语速/音量/语调/尾音」四项，如「语速较慢，音量偏低，语调平稳柔和，尾音轻落」；
   * 画外音在最前面加「画外音，」，如「画外音，语速正常，音量轻柔，语调平稳，尾音轻落」。
   * 说明/场景/动作文字一律中文，对白按目标市场语言（海外题材为英文）。
   */
  readonly 括号提示?: string
}

/**
 * 分镜头块里的一镜（对齐轮次，格式取自《痴迷》参考案例
 * docs/examples/痴迷-12集分镜剧本-参考案例.docx）：
 * `△【镜头01｜时间：00:00—00:42｜景别：近景｜角度：平视正面｜运镜：固定镜头】`
 * 五个字段缺一不可；镜头号与时间码都是集内累计、集间重置。
 */
export interface EpisodeShot {
  /** 集内连续编号（1 起，两位数显示）。 */
  readonly 镜头号: number
  /** 开始秒（集内累计）；时间未知填 null，渲染为 `—`（模板镜）。 */
  readonly 开始秒: number | null
  /** 结束秒（集内累计）；时间未知填 null，渲染为 `—`（模板镜）。 */
  readonly 结束秒: number | null
  /** 景别（近景最常用；也可用 `中景→近景` 这类过渡写法）。 */
  readonly 景别: string
  /** 角度（如平视正面 / 侧面平视 / 俯拍）。 */
  readonly 角度: string
  /** 运镜（如固定镜头 / 手持微晃 / 缓慢推进）。 */
  readonly 运镜: string
  /**
   * △站位/动作/表情行（不含 `△` 前缀），按顺序各独立成行；无人物面部时
   * 用变体行，如「【本镜头无人物面部，表情不适用】」「【本镜头仅见贝尔下半身及手部动作，面部未入镜，表情无法确认】」
   * 「【本镜头无实际活动人物动作，画面静止】」。至少一行。
   */
  readonly 描写: readonly string[]
  /** 本镜内的对白（按出场顺序；无对白的静默镜为空）。 */
  readonly 台词: readonly ScriptLine[]
  /** 本镜的环境声（各独立成行 `【环境声：……】`）。 */
  readonly 环境声?: readonly string[]
  /** 本镜的字幕（各独立成行 `【字幕：……】`）。 */
  readonly 字幕?: readonly string[]
}

/** 一场的人物（人物行 `人物：贝尔（毛衣男子）、伊恩（棒球帽男子）`）。 */
export interface EpisodeCharacter {
  readonly 角色: string
  /** 括号内形象标识，如「毛衣男子」；没有就不写括号。 */
  readonly 形象标识?: string
}

/** 单集剧本的一场。 */
export interface ScriptScene {
  /** 集内场号（竖屏 1–4，显示为两位 场01）。 */
  readonly 场: number
  readonly 地点: string
  readonly 时间: string
  /** 内景 / 外景。 */
  readonly 内外: '内' | '外'
  /** 动作行：现在时、只写看得见/听得见的。 */
  readonly 动作: string
  readonly 台词: readonly ScriptLine[]
  /**
   * 本场人物（人物行）。省略时渲染不写人物行（只用台词里的说话人推不出
   * 形象标识，不编造）；解析时从人物行读回。
   */
  readonly 人物?: readonly EpisodeCharacter[]
  /**
   * 场景环境行（中文描写）。省略时渲染用 `动作` 行；解析时场景环境行
   * 同时写回 `动作` 与本字段（两者一致，Fountain 导出仍读 `动作`）。
   */
  readonly 场景环境?: string
  /**
   * 分镜头（集内连续编号，集间重置）。省略时渲染按场出一镜模板行
   * （景别/角度/运镜/时间填 `—`，描写取 `动作`，台词取本场台词）——
   * 工具不编造导演的景别与运镜决定，待填项进警告，不进错误。
   * 有 `镜头` 时渲染以镜头为准；`台词` 仍保留为全场台词扁平汇总
   * （解析时自动填），供台词字数统计与 Fountain 导出复用。
   */
  readonly 镜头?: readonly EpisodeShot[]
}

/** 单集剧本输入（编剧层分场景格式，见 script.ts）。 */
export interface EpisodeScriptInput {
  readonly 集: number
  readonly 标题: string
  readonly 画幅: ShortDramaOrientation
  readonly 钩子类型: HookType
  readonly 核心想法: string
  readonly 爽点: string
  readonly 时长秒: number
  readonly 场景: readonly ScriptScene[]
  /** 结尾悬念（问题，不是答案）。 */
  readonly 结尾悬念: string
  /** 节拍时间点（秒），渲染进「节拍表」小节，供节拍检查器复核。 */
  readonly 开场冲突秒: number
  readonly 反转秒: readonly number[]
  readonly 结尾钩子秒: number
  /** 横屏专用：见 EpisodeBeats.首场冲突 / 起承转合。 */
  readonly 首场冲突?: boolean
  readonly 起承转合?: Readonly<{ 起: boolean; 承: boolean; 转: boolean; 合: boolean }>
}

/** 渲染出的一集剧本：定稿路径 + 正文 + 非阻断警告（台词超长等只警告、不丢稿）。 */
export interface RenderedEpisodeScript {
  /** 定稿路径：paths.短剧集(集号)，如 `剧本/短剧/集001.md`。 */
  readonly path: string
  readonly 内容: string
  readonly 警告: readonly string[]
}
