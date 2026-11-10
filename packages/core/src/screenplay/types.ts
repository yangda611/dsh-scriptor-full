/**
 * 电影剧本改编管线（阶段 2，muse-dev）：故事稿 → 分场大纲 → 剧本草稿 → 审读。
 *
 * 只在契约 `输出形态=电影剧本` 时走这条管线（见 pipeline.ts 的门禁）；
 * 读契约里的 `市场` 选对应题材库（packages/core/src/design/genres.ts）。
 *
 * 格式与节奏规则以调研为准，不凭空发明：
 * 调研笔记 docs/research/film-drama-research.md 第 1 节（专业剧本格式）、
 * 第 2.5 节（短剧 vs 电影节奏对照）。凡是调研没给、工具内自定的约定，
 * 都在相关常量/函数注释里明确标为「工具内约定」，不冒充调研结论。
 *
 * 两层分开：本模块只产编剧层（分场景剧本：场景标题 + 动作行 + 角色名 +
 * 台词 + 括号提示）。导演层（分镜头表：镜号 / 景别 / 角度 / 运镜 / 时间 /
 * 音响 / 字幕 / 音乐，对齐轮次 13 列）是阶段 4 的事，不混写（调研 §1.3）。
 */

export type ScreenplaySeverity = '高' | '中' | '低'

/**
 * 剧本审读发现项。字段名与核心 Finding（packages/core/src/evidence/record.ts）
 * 对齐（审核编号 / 模块名 / 发现项编号 / 严重程度 / 是否建议阻断 / 证据位置 /
 * 问题说明 / 修改建议 / 建议返回节点），只省掉小说审读专用的材料版本、
 * 处置状态等字段——接线时由协调人按 review 注册表（packages/review/src）
 * 的 ingestFindings 映射补齐，不在本模块里伪造小说审读字段。
 */
export interface ScreenplayFinding {
  readonly 模块名: string
  readonly 发现项编号: string
  readonly 严重程度: ScreenplaySeverity
  readonly 是否建议阻断: boolean
  readonly 证据位置: string
  readonly 问题说明: string
  readonly 修改建议: string
  readonly 建议返回节点: string
}

/** 故事稿里的一位人物：姓名 + 一段小传（须含动机，见 story.ts 校验）。 */
export interface StoryCharacter {
  readonly 姓名: string
  readonly 小传: string
}

/**
 * 故事稿：小说浓缩版——故事逻辑、人物动机、世界规则在散文里过一遍，
 * 剧本继承这个深度。不必是完整长篇小说，只需浓缩故事稿
 * （用户认可的质量判断：电影/长剧本先小说后改编最好）。
 */
export interface StoryDraft {
  readonly 标题: string
  readonly 故事一句话: string
  readonly 人物: readonly StoryCharacter[]
  readonly 世界规则: string
  readonly 情节主线: string
  /** 关键转折：每条一句话，按故事顺序排；改编时按条落场（见 outlineFromStory）。 */
  readonly 关键转折: readonly string[]
  readonly 结尾: string
}

/** 分场大纲里的一场：幕 1–3，场号两位，场景/人物/冲突/转折四项齐全。 */
export interface OutlineScene {
  readonly 场号: number
  readonly 幕: 1 | 2 | 3
  /** 自由文本，如「面馆 深夜 内」；改编时由 parseSceneField 拆成场景标题。 */
  readonly 场景: string
  readonly 人物: string
  readonly 冲突: string
  readonly 转折: string
}

export interface SceneOutline {
  readonly 标题: string
  readonly 场: readonly OutlineScene[]
}

/** 场景标题三段式（调研 §1.1）：INT./EXT. + 地点 + 时间，全大写。 */
export interface ScreenplayHeading {
  readonly 内外: 'INT' | 'EXT' | 'INT./EXT.'
  readonly 地点: string
  /** 时间多用 日 / 夜 / 黄昏 / 清晨 / 傍晚 / 深夜，或 DAY / NIGHT / MORNING / EVENING。 */
  readonly 时间: string
}

/** 一段台词：角色名 + 可选括号提示 + 台词行。 */
export interface DialogueBlock {
  readonly 角色: string
  /** 括号提示：小写、简短；停顿只用 `(pause)`（见 format.ts 的停顿约定）。 */
  readonly 括号提示?: string
  readonly 台词: readonly string[]
}

/** 剧本草稿里的一场。 */
export interface ScreenplayScene {
  readonly 场号: number
  readonly 标题: ScreenplayHeading
  /** 动作行：现在时，只写可见/可听（调研 §1.1）。 */
  readonly 动作: readonly string[]
  readonly 台词段: readonly DialogueBlock[]
  /** 转场（如 CUT TO:）：少用，只在转场本身有意义时用（调研 §1.1）。 */
  readonly 转场?: string
}

export interface ScreenplayDraft {
  readonly 标题: string
  readonly 场: readonly ScreenplayScene[]
}
