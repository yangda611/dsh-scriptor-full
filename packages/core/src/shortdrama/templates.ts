/**
 * 短剧节奏模板：竖屏 / 横屏各一套，分开（调研 §2.4：两种产品，不要混成一个模板）。
 *
 * 来源：docs/research/film-drama-research.md 第 2 节。
 * 每条规则后面都标来源 URL；调研原文没有的数标为「工具约定」，不冒充调研结论。
 * 调研第 5 节“未确认”的 7 项（BBC 原站模板页、FlexTV 专属榜单、各平台成文审核
 * 细则、中文剧本格式协会标准、电影剧本音乐提示统一格式、竖屏分镜单镜时长统一
 * 标准、海外命名习惯除狼人题材外的成文总结）一律不编进模板。
 */

import type { ShortDramaOrientation } from './types'

/** 调研来源 URL（docs/research/film-drama-research.md 第 2 节 / 第 6 节清单）。 */
export const SHORTDRAMA_SOURCES = {
  /** SceneMixer《Vertical Short Drama Script Format》：竖屏单集结构、钩子、转折、台词。 */
  sceneMixer: 'https://scenemixer.com/guides/vertical-short-drama-script-format/',
  /** Filmustage《How to Write a Vertical Drama Script》：四段 Beat Engine、前三集、付费卡点。 */
  filmustage: 'https://filmustage.com/blog/how-to-write-a-vertical-drama-script/',
  /** TopDrama《Short Drama Glossary》：竖屏定义、广电第 16 号令（单集 20 分钟以下）。 */
  topDrama: 'https://topdrama.app/guides/short-drama-glossary/',
  /** ShorStory《Vertical Drama Script Format Template》：开头 3–5 秒进冲突、每集三标签。 */
  shorStory: 'https://news.shorstory.com/zh/articles/vertical-drama-script-format-template/',
  /** ScreenWeaver《Short Drama Episode Structure》：开头 3–5 秒进冲突。 */
  screenWeaver: 'https://www.screenweaver.ai/zh/blog/short-drama-episode-structure',
  /** Drama.so《Short Drama Script Structure》：每 20–30 秒一个转折。 */
  dramaSo: 'https://drama.so/zh/blog/short-drama-script-structure',
  /** MicroDrama Academy《Short Drama Foundations》：三类钩子轮换。 */
  microDrama: 'https://microdrama.id/en/academy/short-drama-foundations',
  /** ShorStory《Microdrama Paywall Episode Cliffhanger Guide》：付费卡点、卡点写法。 */
  paywallGuide: 'https://news.shorstory.com/zh/articles/microdrama-paywall-episode-cliffhanger-guide/',
  /** 虎嗅《好一个乖乖女》：同一 IP 竖屏 88 集×3 分钟 vs 横屏 29 集×15 分钟。 */
  huxiu: 'https://www.huxiu.com/article/4902474.html',
  /** 新浪：腾讯“十分短剧”、横屏深度叙事 + 竖屏碎片消费互补。 */
  sinaShortDrama: 'https://ent.sina.cn/2026-07-03/detail-inifpuss2397938.dhtml',
  /** 中国作家网：横屏式微的原因、竖屏是独立格式、叙事围绕爽点组织。 */
  chinaWriter: 'https://www.chinawriter.com.cn/n1/2026/0829/c419388-40788397.html',
  /** 百度开发者：竖屏 1–3 分钟 / 横屏 5–20 分钟分野。 */
  baiduDev: 'https://developer.baidu.com/article/detail.html?id=9323643',
  /** 100EC：竖屏与横屏（中剧）的时长与集数分野。 */
  ec100: 'https://www.100ec.cn/detail--6658254.html',
  /** ScenePaper《How to Write a Vertical Micro-Drama Script》：台词短、竖屏为特写服务。 */
  scenePaper: 'https://scenepaper.com/blog/how-to-write-a-vertical-micro-drama-script',
  /** 腾讯新闻：爽点表现方式（先欺负再打脸）。 */
  qqCoolPoints: 'https://news.qq.com/rain/a/20240715A05FZF00',
} as const

/** 一条节奏规则：规则内容 + 来源（调研原文）或「工具约定」标记。 */
export interface TempoRule {
  readonly 规则: string
  /** 调研来源 URL；工具约定时为空字符串，另见 约定说明。 */
  readonly 来源: string
  /** 调研原文没有、模板必须先定下来的数，在此写明为什么这样定、待谁确认。 */
  readonly 约定说明?: string
}

export interface RhythmTemplate {
  readonly 画幅: ShortDramaOrientation
  /** 画幅比。 */
  readonly 画幅比: string
  /** 单集时长（秒）范围。 */
  readonly 单集时长秒: readonly [number, number]
  /** 每集场景数范围（横屏不设硬上限时为 null，见说明）。 */
  readonly 每集场景数: readonly [number, number] | null
  /** 全季总集数范围。 */
  readonly 总集数: readonly [number, number]
  /** 台词总量（字）范围；横屏不设总量硬限时为 null。 */
  readonly 台词字数: readonly [number, number] | null
  /** 单句台词上限（字）：中文指南约每句 <12 字，两模板通用。 */
  readonly 单句台词上限字数: number
  /** 节奏规则清单。 */
  readonly 规则: readonly TempoRule[]
  /** 与另一模板的不同点（写明，不让使用者以为只差画幅）。 */
  readonly 与另一模板的不同: readonly string[]
}

function r(规则: string, 来源: string, 约定说明?: string): TempoRule {
  return 约定说明 === undefined ? { 规则, 来源 } : { 规则, 来源, 约定说明 }
}

/**
 * 竖屏模板：9:16，每集 60–120 秒，2–4 场，对白 180–360 字，60–100 集/季。
 * 节拍检查器的规则按竖屏节奏执行（见 beat-checker.ts）。
 */
export const VERTICAL_TEMPLATE: RhythmTemplate = {
  画幅: '竖屏',
  画幅比: '9:16',
  单集时长秒: [60, 120],
  每集场景数: [2, 4],
  总集数: [60, 100],
  台词字数: [180, 360],
  单句台词上限字数: 12,
  规则: [
    r('开头 3–5 秒内必须进冲突：第一句台词或第一个动作就是冲突本身，不铺场景、不做自我介绍、不放片头；静音预览也要看得懂。', SHORTDRAMA_SOURCES.sceneMixer),
    r('每 20–30 秒一个转折：90 秒一集至少转两次，转折可以是新信息、立场翻转、危机升级或身份揭露。', SHORTDRAMA_SOURCES.dramaSo),
    r('每集结尾 5–10 秒必须留钩子（cliffhanger），且要切在问题上、不是答案上。', SHORTDRAMA_SOURCES.sceneMixer),
    r('钩子三种类型轮换使用——身份类（某人不是他自称的那个人）、情感类（告白/拒绝/关系破裂停在关键点）、顿悟类（观众和主角同时发现先前的判断错了）；两集用同一种钩子会像骗术。', SHORTDRAMA_SOURCES.microDrama),
    r('前三集定生死：第 1 集 5 秒内冲突、立主角处境与目标、结尾身份钩；第 2 集反派登场、赌注上桌（钱/婚姻/性命/名声选其一）、主角被逼到墙角、结尾情感钩；第 3 集第一次反转（弱者亮底牌或盟友倒戈）、结尾顿悟钩。', SHORTDRAMA_SOURCES.sceneMixer),
    r('主角的第一次真正胜利不得晚于第 5 集，否则付费墙前完播率会塌。', SHORTDRAMA_SOURCES.sceneMixer),
    r('付费卡点：海外首个付费集最常见第 11 集，免费集数中位数约 9 集；国内前 10–15 集免费，此后多卡点（约第 8–16/25–30/50 集）。本模板取海外最常见值：第 10–11 集设首个付费墙。', SHORTDRAMA_SOURCES.paywallGuide),
    r('台词要短：中文指南约每句不超过 12 个字；每集只容纳一个想法/一个事件，不是三个。', SHORTDRAMA_SOURCES.shorStory),
    r('对白即动作：每句台词要么推进冲突、要么在压力下揭示人物，二者都不满足就删；没有寒暄、铺垫与借对话交代背景的空间。', SHORTDRAMA_SOURCES.filmustage),
    r('竖屏写作为特写服务：9:16 画幅大部分时间被一张脸填满，地点让位于反应镜头，微表情比布景重要；多用一两个人物的正反打，少用大场面。', SHORTDRAMA_SOURCES.filmustage),
    r('四段 Beat Engine（90 秒一集）：Hook 0–15 秒、Friction 15–60 秒、Spike 60–90 秒、Button 最后 5–10 秒（切在问题上，比感觉安全的时间再早两秒）。', SHORTDRAMA_SOURCES.filmustage),
  ],
  与另一模板的不同: [
    '单集只有 60–120 秒，钩子/转折按秒计（5 秒进冲突、每 20–30 秒一转折、结尾 5–10 秒留钩）；横屏按场/幕计。',
    '全季 60–100 集，每集自成小闭环；横屏 20–30 集，每集是有头有尾的完整结构。',
    '有按集付费墙（第 10–11 集）；横屏是长视频平台点播，不设按集付费墙。',
    '台词总量有硬范围（180–360 字/集）；横屏只限单句长度，不限总量。',
    '场景数 2–4 场/集；横屏不设场景数硬上限。',
  ],
}

/**
 * 横屏模板：16:9，每集 10–20 分钟，20–30 集，有头有尾的完整结构、偏精品叙事。
 * 钩子/爽点密度按横屏节奏放宽——放宽点全部写明出处或标为工具约定。
 */
export const HORIZONTAL_TEMPLATE: RhythmTemplate = {
  画幅: '横屏',
  画幅比: '16:9',
  单集时长秒: [600, 1200],
  每集场景数: null,
  总集数: [20, 30],
  台词字数: null,
  单句台词上限字数: 12,
  规则: [
    r('单集 10–20 分钟（头部项目多为 10–15 分钟）、总集数 20–30 集、16:9、长视频平台点播、精品化与深度叙事导向。', SHORTDRAMA_SOURCES.baiduDev),
    r('每集是有头有尾的完整结构：起承转合，足以承载传统戏剧结构（“中剧”单集可覆盖 15–30 分钟）。', SHORTDRAMA_SOURCES.chinaWriter),
    r('开场首场即冲突：第一场就要立住冲突与人物处境，不做长铺垫。', '', '工具约定：调研原文的“3–5 秒进冲突”是竖屏规则；横屏单集 10–20 分钟，5 秒硬限不适用，改放宽为“首场即冲突”，待协调人/用户确认。'),
    r('每集至少 2 个转折，且“转”段必须有一次全集最大的转折（立场翻转或身份揭露）。', '', '工具约定：调研只给了竖屏的“每 20–30 秒一个转折”；横屏按幕计，转折下限取 2 次（承→转一次、转→合一次），待协调人/用户确认。'),
    r('每集结尾留悬念，切在问题上、不是答案上；悬念落在结尾 1 分钟内。', '', '工具约定：调研原文的“结尾 5–10 秒留钩”是竖屏规则；横屏改放宽为结尾 1 分钟内，待协调人/用户确认。'),
    r('钩子三种类型（身份/情感/顿悟）跨集轮换；前三集按身份→情感→顿悟排布，与竖屏相同。', SHORTDRAMA_SOURCES.microDrama),
    r('台词要短：中文指南约每句不超过 12 个字；每集只容纳一个核心想法。对白即动作（每句推进冲突或揭示人物）。', SHORTDRAMA_SOURCES.shorStory),
    r('不设按集付费墙：横屏走长视频平台点播/会员，不适用竖屏第 10–11 集的付费墙规则。', '', '工具约定：调研的付费卡点数据（第 11 集最常见、国内多卡点）全部针对竖屏按集付费；横屏无对应数据，不编一个集号。'),
    r('不设首胜集号硬限：竖屏“第一次胜利不晚于第 5 集”是按 60–100 集篇幅给的，横屏 20–30 集不直接套用，首胜位置由作者按全季弧线自定。', '', '工具约定：不把竖屏第 5 集硬套到横屏；若用户要一个数，协调人再定。'),
  ],
  与另一模板的不同: [
    '单集 10–20 分钟，是竖屏的 5–10 倍；集数约 1/3（20–30 集 vs 60–100 集）。',
    '钩子/转折按场/幕计，不按秒计：开场放宽为“首场即冲突”，转折下限为每集 2 次，结尾悬念放宽到结尾 1 分钟内。',
    '每集是有头有尾的完整结构（起承转合），不是每集自成小闭环。',
    '无按集付费墙、无首胜集号硬限；台词不限总量、不限场景数，只限单句长度与每集一个核心想法。',
    '同一 IP 两种形态的实例：《好一个乖乖女》竖屏 88 集×3 分钟 vs 横屏 29 集×15 分钟，横屏版有效剧情多出至少两小时——改编不是换画幅比，是重排结构。',
  ],
}

export const RHYTHM_TEMPLATES: Readonly<Record<ShortDramaOrientation, RhythmTemplate>> = {
  竖屏: VERTICAL_TEMPLATE,
  横屏: HORIZONTAL_TEMPLATE,
}

export function rhythmTemplate(画幅: ShortDramaOrientation): RhythmTemplate {
  return RHYTHM_TEMPLATES[画幅]
}
