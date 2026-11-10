export interface DocumentFieldContract {
  readonly name: string
  readonly description: string
  readonly type: 'positive-integer' | 'single-line-text'
  readonly owner: 'system' | 'content'
}

export const DOCUMENT_FIELDS = {
  bookFormatVersion: {
    name: '书仓格式版本', description: '书仓持久化格式的版本，不是内容修订或机器协议版本',
    type: 'positive-integer', owner: 'system',
  },
  /** 影视剧扩展（muse-dev）：创建项目时选定的目标市场，决定加载哪套题材库；默认值 中文。 */
  market: {
    name: '市场', description: '目标市场：海外（海外题材库）或中文（中文题材库）；创建时选定',
    type: 'single-line-text', owner: 'system',
  },
  /** 影视剧扩展（muse-dev）：创建项目时选定的输出形态，决定走哪条流水线；默认值 小说。 */
  outputForm: {
    name: '输出形态', description: '输出形态：短剧、电影剧本或小说；创建时选定',
    type: 'single-line-text', owner: 'system',
  },
  timelineEvent: {
    name: '事件', description: '实际发生的事件描述，不是事件条目的名称或记录章号',
    type: 'single-line-text', owner: 'content',
  },
  storyTime: {
    name: '时点', description: '事件的故事内相对或绝对时点；未明确时为未知',
    type: 'single-line-text', owner: 'content', unknown: '未知',
  },
  timelineChapter: {
    name: '章号', description: '记录该事实的定稿章号，不用于推断故事时点',
    type: 'single-line-text', owner: 'system',
  },
  timelineSource: {
    name: '来源', description: '本次沉淀的定稿来源，由写入器提供',
    type: 'single-line-text', owner: 'system',
  },
  timelineDecision: {
    name: '裁决记录', description: '本次沉淀的作者裁决记录，由写入器提供',
    type: 'single-line-text', owner: 'system',
  },
} as const satisfies Readonly<Record<string, DocumentFieldContract & { readonly unknown?: string }>>

export const TIMELINE_FIELD_KEYS = [
  DOCUMENT_FIELDS.timelineEvent.name, DOCUMENT_FIELDS.storyTime.name, DOCUMENT_FIELDS.timelineChapter.name,
  DOCUMENT_FIELDS.timelineSource.name, DOCUMENT_FIELDS.timelineDecision.name,
] as const

export const WORLDBOOK_NATURES = ['计划', '事实'] as const
export const WORLDBOOK_STATES = ['已确认', '暂定', '留白', '已成事实', '已废弃'] as const

/** 影视剧扩展（muse-dev）：市场字段的合法值（创建时二选一；默认值 中文）。 */
export const MARKET_VALUES = ['海外', '中文'] as const
export type Market = (typeof MARKET_VALUES)[number]
/** 影视剧扩展（muse-dev）：输出形态字段的合法值（创建时三选一；默认值 小说）。 */
export const OUTPUT_FORM_VALUES = ['短剧', '电影剧本', '小说'] as const
export type OutputForm = (typeof OUTPUT_FORM_VALUES)[number]

/** 校验市场 / 输出形态字段值是否合法（单行文本且在取值表内）。 */
export function isMarketValue(value: unknown): value is Market {
  return typeof value === 'string' && (MARKET_VALUES as readonly string[]).includes(value)
}
export function isOutputFormValue(value: unknown): value is OutputForm {
  return typeof value === 'string' && (OUTPUT_FORM_VALUES as readonly string[]).includes(value)
}

/** Only evidenced design inputs; graph reader fallbacks are not writable synonyms. */
export const WORLDBOOK_INPUT_FIELDS = {
  类型: { description: '条目类型（如 人物/规则/地点）；新建必填，更新省略保留', requiredOnCreate: true, type: 'single-line-text', allowEmpty: false, owner: 'plan-content' },
  性质: { description: '计划/事实；新建必填且只能为计划。本工具只创建或修改计划，事实由定稿入档写入，修改走更正/吃书；更新省略保留', requiredOnCreate: true, type: 'single-line-text', allowEmpty: false, owner: 'plan-content', values: WORLDBOOK_NATURES },
  状态: { description: '世界书状态：已确认/暂定/留白/已成事实/已废弃；新建必填，更新省略保留', requiredOnCreate: true, type: 'single-line-text', allowEmpty: false, owner: 'plan-content', values: WORLDBOOK_STATES },
  来源: { description: '计划条目来源（如 对谈共创 或 来源引用行）；新建必填，更新省略保留', requiredOnCreate: true, type: 'single-line-text', allowEmpty: false, owner: 'plan-content' },
  别名: { description: '别名文本；可为空字符串表示无别名，省略保留旧值，不删除字段', requiredOnCreate: false, type: 'single-line-text', allowEmpty: true, owner: 'plan-content' },
  正文: { description: '计划首段正文（Markdown）；省略保留旧正文，新建省略使用标题；不含系统追加的事实段', requiredOnCreate: false, type: 'markdown', allowEmpty: true, owner: 'plan-content' },
} as const

export function isDocumentFieldValue(field: DocumentFieldContract, value: unknown): boolean {
  return field.type === 'positive-integer'
    ? typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    : typeof value === 'string' && value.trim().length > 0 && !/[\r\n]/.test(value)
}
