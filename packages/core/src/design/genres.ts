/**
 * 题材库（影视剧扩展，muse-dev）：按「市场 × 性别向」组织的两套题材库。
 *
 * 内容来源：docs/research/film-drama-research.md 第 3 节（海外 vs 中文），每条题材、
 * 每个命名、每条禁忌后面都附调研来源 URL（正文 §3 可查到同一结论）；没有来源的
 * 不写成事实（见调研笔记第 5 节“未查到”清单，例如 FlexTV 专属榜单、各平台成文
 * 审核细则均未查到，本文件不编造）。
 *
 * 命名词表会过期，不要写死一处：
 * 2025 年初的改名潮里，“总裁 / 战神 / 神豪 / 首富 / 千亿总裁 / 京圈太子爷 /
 * 禁欲大佬”等词大幅减少，“爱”成为最常出现的情绪词（占 11%），人设关键词前列
 * 变为老公、小姐、女儿等更平民视角的词（来源：https://news.qq.com/rain/a/20250120A0959B00）。
 * 所以命名词表以可替换/可扩展的结构导出：用 createGenreLibrary(overrides) 或
 * withNaming(library, tierId, patch) 换掉某一档的命名，不改其他档、不改题材与禁忌。
 */

import { MARKET_VALUES, type Market } from '../repo/document-fields'

/** 调研来源 URL（docs/research/film-drama-research.md 第 3 节 / 第 6 节清单）。 */
export const GENRE_SOURCES = {
  /** LanternPop《Short Drama Tropes Explained》：六大套路、279 部标题词频、狼人等级称谓。 */
  lanternTropes: 'https://lanternpop.com/guides/short-drama-tropes-explained/',
  /** Qingchuan《Chinese Short Drama Top 5 × 4 — July 2026》：平台榜单、地域分化、避开清单。 */
  qingchuanRankings: 'https://www.qingchuan.asia/rankings/2026-07/',
  /** 流媒体网：男频爽点与身份反转、赘婿/战神投放、《无双》1.2 亿、女频反超。 */
  lmtwMaleFemale: 'https://lmtw.com/mzw/content/detail/id/255330',
  /** 流媒体网：男女频界限模糊、男频题材扩容。 */
  lmtwBlurred: 'https://lmtw.com/mzw/content/detail/id/250135/keyword_id/-1',
  /** 界面新闻：男频身份反转、女频多样化、大女主。 */
  jiemian: 'https://www.jiemian.com/article/12064720.html',
  /** 腾讯新闻：男频女频爽点表现（先欺负再打脸）、爽点差异。 */
  qqCoolPoints: 'https://news.qq.com/rain/a/20240715A05FZF00',
  /** 腾讯新闻：中文主角姓氏偏冷门贵气姓、命名讲究。 */
  qqNames: 'https://news.qq.com/rain/a/20250408A06YH100',
  /** 新浪：短剧高频姓氏 + 名字（顾傅厉陆霍司 / 苏沈夏林安温姜许阮唐、苏晚等）。 */
  sinaNames: 'https://www.sina.cn/news/detail/5342734259061175.html',
  /** 新浪：地点命名（京市 / 江城 / A 市等）。 */
  sinaPlaces: 'https://www.sina.cn/news/detail/5320628051903179.html',
  /** 新浪财经：2,315 部微短剧剧名分析（归来 / 千金 / 总裁 / 夫人 / 大佬）。 */
  sinaTitles: 'https://finance.sina.com.cn/jjxw/2025-02-07/doc-ineirmwh0207215.shtml',
  /** 163：暴拆 5,000 部短剧剧名（总裁 216 次、顾傅厉、苏小姐）。 */
  netease163Titles: 'https://www.163.com/dy/article/JFOMC8V405198R91.html',
  /** 163：观众画像、套路（先欺负再打脸）。 */
  netease163Audience: 'https://www.163.com/dy/article/LBBQ1TR20556BXT9.html',
  /** 腾讯新闻：2025 年初改名潮（总裁/战神/神豪消失、“爱”占 11%）。 */
  qqRenameTide: 'https://news.qq.com/rain/a/20250120A0959B00',
  /** 维基百科《短剧（中国大陆）》：备案时间线、片名审核、11 项禁区。 */
  wikiCnShortDrama: 'https://zh.wikipedia.org/zh-hans/%E7%9F%AD%E5%89%A7_(%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86)',
  /** 湖南省政府转载广电总局通知：分类分层审核、备案、许可证号标注。 */
  hunanNrta: 'https://www.hunan.gov.cn/zqt/zcsd/202502/t20250206_33580560.html',
  /** 赣县区政府转载：重点 / 普通 / 其他三类、协审题材。 */
  ganxianNrta: 'https://www.ganxian.gov.cn/gxqxxgk/c111222/202502/258ec2e6256c49288620cc84f0223c39.shtml',
  /** TVOAO《“繁星指数”2024 微短剧行业年度洞察报告》：霸总专项提示、片名审核。 */
  tvoao: 'https://www.tvoao.com/a/220171.aspx',
  /** 国家广播电视总局《微短剧发展管理办法》：11 项禁区、AI 标识。 */
  nrtaPolicy: 'https://policy.mofcom.gov.cn/claw/clawContent.shtml?id=106656',
  /** LaiTimes：赘婿婆媳海外无感、狼人吸血鬼受欢迎、出海本地化两条路。 */
  laitimesOverseas: 'https://www.laitimes.com/en/article/6cobw_6t0mq.html',
  /** LaiTimes：出海动因之一是海外内容限制较少、狼人/黑手党在海外是主流。 */
  laitimesWhyOverseas: 'https://www.laitimes.com/en/article/6b5on_6rhzi.html',
  /** Flicksmore《Fated to My Forbidden Alpha》：Selene / Alpha Jackson / Luna。 */
  flicksmoreAlpha: 'https://en.flicksmore.com/movie/vid-8419002-fated-to-my-forbidden-alpha.html',
  /** AI-Drama：狼人世界观、等级制度（Alpha / Luna / Omega / Rogue）。 */
  aiDramaWerewolf: 'https://www.ai-drama.ai/blog/werewolf-short-dramas',
  /** Episivo：ReelShort 与 DramaBox 平台调性差异。 */
  episivoPlatforms: 'https://www.episivo.com/blogs/dramabox-vs-reelshort/',
  /** Zot.News：英国对微短剧暴力、性侵主题与贬低女性描写的监管担忧。 */
  zotUk: 'https://zot.news/article/microdramas-snackable-90-second-shows-winning-uk-viewers-iwp9x',
  /** 爱奇艺短剧风云榜：战神 / 重生 / 复仇 / 虐恋标签。 */
  iqiyiRanks: 'http://www.iqiyi.com/ranks1/35/2508071793676233',
} as const

export type GenreTierId = '中文男频' | '中文女频' | '海外女性向' | '海外男性向' | '东南亚通用起步'
export const GENRE_TIER_IDS = ['中文男频', '中文女频', '海外女性向', '海外男性向', '东南亚通用起步'] as const

/** 一条题材：套路名 + 一句话爽点说明 + 调研来源 URL。 */
export interface GenreEntry {
  readonly 名称: string
  readonly 爽点: string
  readonly 来源: string
}

/** 一个命名：词本身 + 调研来源 URL。 */
export interface NamedValue {
  readonly 值: string
  readonly 来源: string
}

/**
 * 一档的命名词表。姓氏 / 英文名 / 地点三组按市场取舍：中文档用姓氏 + 人名示例 +
 * 地点（无英文名）；海外档用英文名 + 称谓 + 地点（无中文姓氏）；东南亚档复用
 * 中文命名（调研：东南亚可直接复用国内题材、文化障碍最小）。
 */
export interface NamingTable {
  readonly 姓氏: readonly NamedValue[]
  readonly 英文名: readonly NamedValue[]
  readonly 地点: readonly NamedValue[]
  /** 中文全名示例（如 顾霆琛、苏晚），海外档为空。 */
  readonly 人名示例: readonly NamedValue[]
  /** 海外档的等级 / 身份称谓（如 Alpha / Luna / Omega），中文档为空。 */
  readonly 称谓: readonly NamedValue[]
}

/** 一条禁忌：禁什么 + 调研来源 URL。 */
export interface TabooEntry {
  readonly 内容: string
  readonly 来源: string
}

export interface GenreTier {
  readonly id: GenreTierId
  readonly 市场: Market
  readonly 性别向: '男频' | '女频' | '女性向' | '男性向' | '通用'
  readonly 题材: readonly GenreEntry[]
  readonly 命名: NamingTable
  readonly 禁忌: readonly TabooEntry[]
  /**
   * 合规备注（不是查到的成文细则，不配来源 URL、不计入禁忌清单）：
   * 海外各平台逐条列明的审核细则本次未查到，只能先以通用底线 + 目标市场法律作占位规则。
   */
  readonly 合规备注?: string
}

export interface GenreLibrary {
  readonly tiers: readonly GenreTier[]
}

function n(值: string, 来源: string): NamedValue {
  return { 值, 来源 }
}

function g(名称: string, 爽点: string, 来源: string): GenreEntry {
  return { 名称, 爽点, 来源 }
}

function t(内容: string, 来源: string): TabooEntry {
  return { 内容, 来源 }
}

const S = GENRE_SOURCES

/** 中文档共用的禁忌（国内备案与内容禁区，见调研 §3.4）。 */
const CN_TABOOS: readonly TabooEntry[] = [
  t('不得载有危害国家安全、歪曲民族历史、诋毁中华优秀传统文化、侵害未成年人合法权益等 11 项禁区内容。', S.wikiCnShortDrama),
  t('2024 年 6 月 1 日起未经审核备案的微短剧不得上网传播；重点与普通微短剧报省级以上广电主管部门规划备案与成片审查，片头须标注许可证号或备案号。', S.hunanNrta),
  t('涉及政治、军事、外交、国家安全、统战、民族、宗教、司法、公安等特殊题材的微短剧按协审工作机制落实审核。', S.ganxianNrta),
  t('片名不得使用恶俗、恶趣味等违背公序良俗的片名，不得渲染极端对立、复仇、暴戾、焦虑。', S.wikiCnShortDrama),
  t('使用 AI 技术生成、制作的微短剧必须显著标明 AI 制作标识。', S.wikiCnShortDrama),
  t('“霸总”类微短剧有专项管理提示，慎用极端打脸羞辱与恶俗桥段。', S.tvoao),
]

/** 海外档共用的禁忌（文化转译与目标市场监管，见调研 §3.4）。 */
const OVERSEAS_TABOOS: readonly TabooEntry[] = [
  t('不要把纯修仙、复杂东方神话、长升级线直接出口到西方市场——西方观众流失很快。', S.qingchuanRankings),
  t('赘婿、婆媳等题材外国观众不感兴趣，不要做海外主力。', S.laitimesOverseas),
  t('英国已有对微短剧中暴力、性侵主题与贬低女性描写的监管担忧与内容标准呼声，涉此类内容先核对目标市场法律。', S.zotUk),
  t('狼人、吸血鬼、黑手党等在国内受限或敏感的题材在海外是主流，但不等于无法无天，仍守目标市场法律与平台通用底线。', S.laitimesWhyOverseas),
]

const EMPTY_NAMING: NamingTable = { 姓氏: [], 英文名: [], 地点: [], 人名示例: [], 称谓: [] }

function buildTiers(): GenreTier[] {
  return [
    {
      id: '中文男频',
      市场: '中文',
      性别向: '男频',
      题材: [
        g('赘婿逆袭', '男主一开始身份低微备受欺凌，在被欺压的节点亮明大佬身份报复反派。', S.lmtwMaleFemale),
        g('战神归来', '功成名就的战神回归故地，仇人自投罗网、当众打脸。', S.lmtwMaleFemale),
        g('神豪', '巨额财富碾压一切阻碍，钱能解决的都不叫事。', S.lmtwMaleFemale),
        g('神医', '医术通天，救人一命的同时拿捏权贵命脉。', S.lmtwMaleFemale),
        g('修仙玄幻', '境界一路突破，弱者逆天改命。', S.lmtwMaleFemale),
        g('重生逆袭', '带着前世记忆重来一次，爽在布局与看仇人自投罗网。', S.lmtwMaleFemale),
        g('权谋', '朝堂商战步步布局，以智取胜夺权。', S.lmtwMaleFemale),
        g('末世', '末世求生囤货，秩序崩塌后凭实力重建规则。', S.lmtwMaleFemale),
      ],
      命名: {
        ...EMPTY_NAMING,
        姓氏: ['顾', '傅', '厉', '陆', '霍', '司', '江', '叶', '楚', '裴', '季'].map((值) => n(值, S.qqNames)),
        人名示例: ['顾霆琛', '傅景深', '厉云霆', '陆景川', '霍司砚'].map((值) => n(值, S.sinaNames)),
        地点: ['京市', '江城', '江州', '燕都', '北江', 'A市'].map((值) => n(值, S.sinaPlaces)),
      },
      禁忌: CN_TABOOS,
    },
    {
      id: '中文女频',
      市场: '中文',
      性别向: '女频',
      题材: [
        g('霸总甜宠', '高冷总裁独宠女主，权力不对等反转为偏爱。', S.lmtwMaleFemale),
        g('虐恋', '先虐后甜，误会与伤害拉满再和解。', S.iqiyiRanks),
        g('闪婚', '闪婚先婚后爱，契约关系里长出真感情。', S.lmtwMaleFemale),
        g('萌宝', '聪明萌娃助攻，母子联手拿捏全场。', S.lmtwMaleFemale),
        g('重生复仇', '重生归来手撕仇人，步步讨回前世的债。', S.lmtwMaleFemale),
        g('大女主', '事业型无 CP 大女主，靠自己登顶不靠男人。', S.jiemian),
        g('宫斗 / 宅斗', '后宅步步惊心，以智谋在等级森严的内宅中上位。', S.lmtwMaleFemale),
        g('婆媳', '婆媳矛盾与豪门恩怨，家庭权力场的拉锯。', S.lmtwMaleFemale),
        g('年代', '年代背景下的命运沉浮，时代洪流里的小人物翻身。', S.lmtwMaleFemale),
        g('种田', '种田经营细水长流，靠手艺与耐心过上好日子。', S.lmtwMaleFemale),
      ],
      命名: {
        ...EMPTY_NAMING,
        姓氏: ['苏', '沈', '夏', '林', '安', '温', '姜', '许', '阮', '唐'].map((值) => n(值, S.sinaNames)),
        人名示例: ['苏晚', '苏清颜', '沈知微', '夏安然', '林晚星'].map((值) => n(值, S.sinaNames)),
        地点: ['京市', '江城', '滨海市', '澜市', '淮城', 'A市'].map((值) => n(值, S.sinaPlaces)),
      },
      禁忌: CN_TABOOS,
    },
    {
      id: '海外女性向',
      市场: '海外',
      性别向: '女性向',
      题材: [
        g('狼人 / 命中注定伴侣', '月亮女神指定的唯一伴侣，双方都无法轻易逃脱，爽在命中注定的拉扯。', S.lanternTropes),
        g('吸血鬼奇幻', '永生者的禁忌之恋，危险与诱惑并存。', S.qingchuanRankings),
        g('亿万富翁复仇', '被背叛的女主东山再起，用财富与地位反杀。', S.qingchuanRankings),
        g('独立女性', '不靠男人的女主自己立起来，事业与尊严双收。', S.qingchuanRankings),
        g('契约婚姻', '假结婚先婚后爱，契约到期前动了真心。', S.episivoPlatforms),
        g('替身新娘', '替嫁入豪门，替身身份揭穿时反转。', S.qingchuanRankings),
        g('意外怀孕', '一夜之后意外怀孕，孩子把两个世界绑在一起。', S.qingchuanRankings),
        g('隐藏身份', '表面普通、实则强大，爽在等待揭露与揭露后的余波。', S.lanternTropes),
      ],
      命名: {
        ...EMPTY_NAMING,
        英文名: ['Selene', 'Luna', 'Jackson', 'Alexander', 'Kane'].map((值) => n(值, S.flicksmoreAlpha)),
        称谓: ['Alpha', 'Luna', 'Omega'].map((值) => n(值, S.aiDramaWerewolf)),
        地点: [n('洛杉矶', S.laitimesOverseas)],
      },
      禁忌: OVERSEAS_TABOOS,
      合规备注: 'ReelShort / DramaBox / FlexTV 各平台公开的逐条审核细则未查到（调研 §5.3），先以平台通用底线 + 目标市场法律作占位规则，上线前再确认。',
    },
    {
      id: '海外男性向',
      市场: '海外',
      性别向: '男性向',
      题材: [
        g('黑手党复仇', '忠诚、危险、既是保护者又是威胁的强者，赌注是身体性的——债务、仇敌、家族规矩。', S.lanternTropes),
        g('末世生存', '末世囤货求生，秩序崩塌后凭实力活下去。', S.qingchuanRankings),
        g('西方奇幻', '西方奇幻世界观下的冒险与权力争夺。', S.qingchuanRankings),
        g('隐藏身份', '表面窝囊、实则大佬，爽在等待揭露与揭露后的余波。', S.qingchuanRankings),
        g('弃儿继承人', '被抛弃的继承人归来，夺回属于自己的一切。', S.qingchuanRankings),
        g('战神', '战场归来的强者复仇，武力碾压仇敌。', S.qingchuanRankings),
      ],
      命名: {
        ...EMPTY_NAMING,
        英文名: ['Alexander', 'Kane', 'Jackson'].map((值) => n(值, S.flicksmoreAlpha)),
        称谓: ['Alpha'].map((值) => n(值, S.aiDramaWerewolf)),
        地点: [n('洛杉矶', S.laitimesOverseas)],
      },
      禁忌: OVERSEAS_TABOOS,
      合规备注: 'ReelShort / DramaBox / FlexTV 各平台公开的逐条审核细则未查到（调研 §5.3），先以平台通用底线 + 目标市场法律作占位规则，上线前再确认。',
    },
    {
      id: '东南亚通用起步',
      市场: '海外',
      性别向: '通用',
      题材: [
        g('重生', '带着记忆重来一次，布局看仇人自投罗网，男女皆宜。', S.lanternTropes),
        g('复仇', '讨回前世今生的债，快意恩仇。', S.qingchuanRankings),
        g('隐藏身份', '表面普通、实则强大，爽在等待揭露。', S.lanternTropes),
        g('系统', '游戏化规则界面与任务清单，爽在学规则、钻规则。', S.lanternTropes),
        g('契约婚姻', '假结婚先婚后爱，契约到期前动了真心。', S.episivoPlatforms),
        g('中国奇幻', '中国奇幻设定在东南亚可直接复用、文化障碍最小。', S.qingchuanRankings),
        g('战神复仇', '战神归来复仇，东南亚男女皆宜。', S.qingchuanRankings),
        g('古风种田', '古风背景种田经营，细水长流的翻身。', S.qingchuanRankings),
        g('宫斗', '后宫宅斗步步为营，东南亚可直接复用。', S.qingchuanRankings),
      ],
      命名: {
        ...EMPTY_NAMING,
        姓氏: ['林', '叶', '楚', '江', '萧', '顾', '程', '苏', '傅'].map((值) => n(值, S.qqNames)),
        人名示例: ['顾霆琛', '苏晚', '沈知微'].map((值) => n(值, S.sinaNames)),
        地点: ['京市', '江城', 'A市'].map((值) => n(值, S.sinaPlaces)),
      },
      禁忌: [
        t('东方修仙只限东南亚，不要顺带推向西方市场——西方观众流失很快。', S.qingchuanRankings),
        t('赘婿、婆媳在西方无感，只在东南亚复用，不要当作全球通吃题材。', S.laitimesOverseas),
        t('若回国内平台播出，须走国内备案：未经审核备案的微短剧不得上网传播，片头须标注许可证号或备案号。', S.hunanNrta),
        t('使用 AI 技术生成、制作的微短剧必须显著标明 AI 制作标识（国内平台播出时）。', S.wikiCnShortDrama),
      ],
    },
  ]
}

export interface GenreLibraryOverrides {
  /**
   * 按档替换命名词表（只换命名，不动题材与禁忌）。
   * 命名词表会过期（2025 年初改名潮为证，来源见文件头注释），更新时走这里，
   * 不要直接改 GENRE_LIBRARY / GENRE_TIERS 里的常量。
   */
  readonly naming?: Partial<Record<GenreTierId, Partial<NamingTable>>>
}

/** 建一套题材库（默认即内置库；传 overrides 可替换某一档的命名词表）。 */
export function createGenreLibrary(overrides: GenreLibraryOverrides = {}): GenreLibrary {
  const tiers = buildTiers().map((tier) => {
    const patch = overrides.naming?.[tier.id]
    if (patch === undefined) return tier
    return { ...tier, 命名: { ...tier.命名, ...patch } }
  })
  return { tiers }
}

/** 默认题材库（五档，见 GENRE_TIER_IDS）。命名要更新时用 createGenreLibrary / withNaming 另建一套，不要改它。 */
export const GENRE_LIBRARY: GenreLibrary = createGenreLibrary()

/** 默认五档（与 GENRE_LIBRARY.tiers 同值，便于直接遍历）。 */
export const GENRE_TIERS: readonly GenreTier[] = GENRE_LIBRARY.tiers

/** 换掉某一档的命名词表，返回新库（原库不动）。 */
export function withNaming(library: GenreLibrary, tierId: GenreTierId, patch: Partial<NamingTable>): GenreLibrary {
  return {
    tiers: library.tiers.map((tier) => (tier.id === tierId ? { ...tier, 命名: { ...tier.命名, ...patch } } : tier)),
  }
}

/** 按 id 取一档；找不到返回 undefined（不抛错，由调用方决定 fallback）。 */
export function getGenreTier(library: GenreLibrary, id: GenreTierId): GenreTier | undefined {
  return library.tiers.find((tier) => tier.id === id)
}

/** 按市场取可用的档：中文 → 中文男频 / 中文女频；海外 → 海外女性向 / 海外男性向 / 东南亚通用起步。 */
export function tiersForMarket(library: GenreLibrary, market: Market): readonly GenreTier[] {
  if (!MARKET_VALUES.includes(market)) return []
  return library.tiers.filter((tier) => tier.市场 === market)
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

/**
 * 校验一套题材库，返回问题清单（空数组 = 通过）：
 * 每档题材 / 禁忌非空、每条题材与禁忌有非空爽点/内容与 http(s) 来源、
 * 每档命名词表合计非空、每个命名有 http(s) 来源。
 */
export function validateGenreLibrary(library: GenreLibrary): readonly string[] {
  const problems: string[] = []
  if (library.tiers.length === 0) problems.push('题材库为空：至少需要一档')
  const seen = new Set<string>()
  for (const tier of library.tiers) {
    if (seen.has(tier.id)) problems.push(`${tier.id}：重复出现`)
    seen.add(tier.id)
    if (!(GENRE_TIER_IDS as readonly string[]).includes(tier.id)) problems.push(`${tier.id}：未知的档位 id`)
    if (!MARKET_VALUES.includes(tier.市场)) problems.push(`${tier.id}：市场取值非法：${tier.市场}`)
    if (tier.题材.length === 0) problems.push(`${tier.id}：题材列表为空`)
    for (const entry of tier.题材) {
      if (entry.名称.trim() === '') problems.push(`${tier.id}：题材名称为空`)
      if (entry.爽点.trim() === '') problems.push(`${tier.id}「${entry.名称}」：爽点说明为空`)
      if (!isHttpUrl(entry.来源)) problems.push(`${tier.id}「${entry.名称}」：来源不是 http(s) URL：${entry.来源}`)
    }
    const namingCount = tier.命名.姓氏.length + tier.命名.英文名.length + tier.命名.地点.length + tier.命名.人名示例.length + tier.命名.称谓.length
    if (namingCount === 0) problems.push(`${tier.id}：命名词表为空`)
    for (const [group, values] of Object.entries(tier.命名) as [string, readonly NamedValue[]][]) {
      for (const v of values) {
        if (v.值.trim() === '') problems.push(`${tier.id} 命名 ${group}：值为空`)
        if (!isHttpUrl(v.来源)) problems.push(`${tier.id} 命名 ${group}「${v.值}」：来源不是 http(s) URL：${v.来源}`)
      }
    }
    if (tier.禁忌.length === 0) problems.push(`${tier.id}：禁忌清单为空`)
    for (const taboo of tier.禁忌) {
      if (taboo.内容.trim() === '') problems.push(`${tier.id}：禁忌内容为空`)
      if (!isHttpUrl(taboo.来源)) problems.push(`${tier.id}：禁忌来源不是 http(s) URL：${taboo.来源}`)
    }
  }
  return problems
}
