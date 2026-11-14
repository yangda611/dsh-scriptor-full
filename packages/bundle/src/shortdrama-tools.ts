/** 短剧计算定义与书仓接线。注册后的渲染工具经原生写入保存草稿；定稿另走审读与作者确认。 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { failureFrom, toolFailure } from './tool-failure'
import type { NovelToolDefinition, NovelToolsDeps, ToolExecContext } from './novel-tools'
import { computeEpisodeFindings } from '@webnovel/review'
import {
  checkSeasonBeats,
  planSeason,
  renderEpisodeScript,
  readExistingContract,
  gateFileAccess,
  type FileOp,
  type EpisodeBeats,
  type EpisodeOutline,
  type EpisodeScriptInput,
} from '@webnovel/core'

export const SHORTDRAMA_TOOL_NAMES = [
  'novel_shortdrama_plan_episodes',
  'novel_shortdrama_render_episode',
  'novel_shortdrama_check_beats',
  'novel_shortdrama_review_episode',
] as const

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} 必须是一个对象`)
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown, name: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${name} 必须是一个数组`)
  return value
}

/** 工具执行统一包装：core 抛错转 toolFailure，不让异常原样冒泡。 */
function run<T>(fn: () => T): T | ReturnType<typeof toolFailure> {
  try {
    return fn()
  } catch (error) {
    return failureFrom(error, '短剧工具执行失败：')
  }
}

export const SHORTDRAMA_TOOL_DEFINITIONS: readonly NovelToolDefinition[] = [
  {
    name: 'novel_shortdrama_plan_episodes',
    description: '短剧分集钩子/爽点大纲规划：按集排钩子轮换（第 1 集身份钩、第 2 集情感钩、第 3 集顿悟钩，此后循环）与平台说明（排播数据）：首胜集、首个付费集。首胜/付费墙是平台说明（排播/变现安排），不是节拍规则，节拍检查不检查这两项。只排结构位，不发明情节；每集内容另填。只在契约输出形态=短剧时用。',
    parameters: {
      type: 'object',
      properties: {
        市场: { type: 'string', enum: ['海外', '中文'], description: '契约里的市场，决定加载哪套题材库' },
        题材档: { type: 'string', enum: ['中文男频', '中文女频', '海外女性向', '海外男性向', '东南亚通用起步'], description: '题材档，必须属于该市场' },
        画幅: { type: 'string', enum: ['竖屏', '横屏'], description: '竖屏（60–100 集）或横屏（20–30 集）' },
        总集数: { type: 'integer', description: '全季总集数：竖屏 60–100，横屏 20–30' },
        首胜集: { type: 'integer', description: '平台说明（排播数据）：第一次真正的胜利所在的集号；不填竖屏默认第 5 集、横屏默认第 3 集。不是节拍规则，节拍检查不检查。' },
        付费集: { type: 'integer', description: '平台说明（排播数据）：首个付费集；不填竖屏默认第 11 集，只接受 10 或 11；横屏无此概念，不用传。不是节拍规则，节拍检查不检查。' },
      },
      required: ['市场', '题材档', '画幅', '总集数'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          市场: { type: 'string' },
          题材档: { type: 'string' },
          画幅: { type: 'string' },
          总集数: { type: 'integer' },
          付费集: { type: 'integer', description: '首个付费集（10 或 11）；横屏时为 null' },
          首胜集: { type: 'integer' },
          集大纲: { type: 'array' },
          reason: { type: 'string' },
        },
        required: ['ok'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: (args) => run(() => {
      const 市场 = args['市场']
      const 题材档 = args['题材档']
      const 画幅 = args['画幅']
      const 总集数 = args['总集数']
      if (市场 !== '海外' && 市场 !== '中文') return toolFailure('invalid-argument', `市场取值非法：${String(市场)}，只接受 海外 / 中文`)
      if (画幅 !== '竖屏' && 画幅 !== '横屏') return toolFailure('invalid-argument', `画幅取值非法：${String(画幅)}，只接受 竖屏 / 横屏`)
      if (typeof 总集数 !== 'number') return toolFailure('invalid-argument', '总集数必须是数字')
      const plan = planSeason({
        市场,
        题材档: 题材档 as '中文男频' | '中文女频' | '海外女性向' | '海外男性向' | '东南亚通用起步',
        画幅,
        总集数,
        ...(typeof args['首胜集'] === 'number' ? { 首胜集: args['首胜集'] } : {}),
        ...(typeof args['付费集'] === 'number' ? { 付费集: args['付费集'] } : {}),
      })
      return { ok: true, ...plan }
    }),
  },
  {
    name: 'novel_shortdrama_render_episode',
    description: '短剧单集剧本渲染预览：返回正文与未来定稿路径，saved=false 表示尚未保存。台词超长只报警告、不丢稿。',
    parameters: {
      type: 'object',
      properties: {
        集: { type: 'integer', description: '集号，1–100' },
        标题: { type: 'string', description: '本集标题' },
        画幅: { type: 'string', enum: ['竖屏', '横屏'] },
        钩子类型: { type: 'string', enum: ['身份', '情感', '顿悟'], description: '本集结尾钩子类型，须与分集大纲一致' },
        核心想法: { type: 'string', description: '一集只容一个想法，一句话' },
        爽点: { type: 'string', description: '本集的爽点，一句话' },
        时长秒: { type: 'integer', description: '单集时长（秒）：竖屏 60–120，横屏 600–1200' },
        开场冲突秒: { type: 'integer', description: '开场冲突出现的秒数' },
        反转秒: { type: 'array', items: { type: 'integer' }, description: '反转出现的时间点（秒），升序' },
        结尾钩子秒: { type: 'integer', description: '结尾钩子开始的秒数' },
        结尾悬念: { type: 'string', description: '结尾悬念，必须是问题，不是答案' },
        场景: {
          type: 'array',
          description: '各场：场（集内场号，从 1 起连续）、地点、时间、内外（内/外）、动作、台词（角色/台词/括号提示，停顿只用 pause）',
          items: {
            type: 'object',
            properties: {
              场: { type: 'integer' },
              地点: { type: 'string' },
              时间: { type: 'string' },
              内外: { type: 'string', enum: ['内', '外'] },
              动作: { type: 'string' },
              台词: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    角色: { type: 'string' },
                    台词: { type: 'string' },
                    括号提示: { type: 'string' },
                  },
                  required: ['角色', '台词'],
                },
              },
            },
            required: ['场', '地点', '时间', '内外', '动作', '台词'],
          },
        },
        首场冲突: { type: 'boolean', description: '横屏专用：开场冲突是否在首场内' },
        起承转合: {
          type: 'object',
          description: '横屏专用：起承转合四段是否齐全',
          properties: {
            起: { type: 'boolean' },
            承: { type: 'boolean' },
            转: { type: 'boolean' },
            合: { type: 'boolean' },
          },
        },
      },
      required: ['集', '标题', '画幅', '钩子类型', '核心想法', '爽点', '时长秒', '开场冲突秒', '反转秒', '结尾钩子秒', '结尾悬念', '场景'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          path: { type: 'string', description: 'saved=true 时为实际草稿路径；纯渲染预览只返回未来定稿路径' },
          finalPath: { type: 'string', description: '未来定稿路径；不表示已经定稿' },
          saved: { type: 'boolean', description: '实际文件读回一致时才为 true' },
          message: { type: 'string' },
          内容: { type: 'string' },
          警告: { type: 'array' },
          reason: { type: 'string' },
        },
        required: ['ok'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: (args) => run(() => {
      const input = asRecord(args, '参数') as unknown as EpisodeScriptInput
      const rendered = renderEpisodeScript(input)
      return { ok: true, ...rendered, finalPath: rendered.path, saved: false, message: '仅渲染预览，尚未保存文件。' }
    }),
  },
  {
    name: 'novel_shortdrama_check_beats',
    description: '短剧节拍检查：竖屏横屏共用一套节拍规则，只按单集时长缩放——3–5 秒内进冲突、无片头无铺垫、每 20–30 秒一个反转（所需反转数 = max(1, ceil((时长秒−30)/30))，首个反转不晚于 30 秒）、结尾 5–10 秒留悬念切在问题上、钩子轮换（身份/情感/顿悟）、前三集身份→情感→顿悟、台词短/对白即动作；起承转合只检查 ≥600 秒的长集。首胜/付费墙是平台说明，不检查。报出哪集哪条规则没过。',
    parameters: {
      type: 'object',
      properties: {
        集数据: {
          type: 'array',
          description: '每集的节拍时间点：集、画幅、时长秒、开场冲突秒、有片头、有开场铺垫、反转秒（数组）、结尾钩子秒、钩子类型、结尾切在问题上、首次胜利；首场冲突为遗留字段（不检查，统一规则下开场冲突只看秒数）；起承转合只对 ≥600 秒的长集检查',
          items: {
            type: 'object',
            properties: {
              集: { type: 'integer' },
              画幅: { type: 'string', enum: ['竖屏', '横屏'] },
              时长秒: { type: 'integer' },
              开场冲突秒: { type: 'integer' },
              有片头: { type: 'boolean' },
              有开场铺垫: { type: 'boolean' },
              反转秒: { type: 'array', items: { type: 'integer' } },
              结尾钩子秒: { type: 'integer' },
              钩子类型: { type: 'string', enum: ['身份', '情感', '顿悟'] },
              结尾切在问题上: { type: 'boolean' },
              首次胜利: { type: 'boolean' },
              首场冲突: { type: 'boolean' },
              起承转合: {
                type: 'object',
                properties: {
                  起: { type: 'boolean' },
                  承: { type: 'boolean' },
                  转: { type: 'boolean' },
                  合: { type: 'boolean' },
                },
              },
            },
            required: ['集', '画幅', '时长秒', '开场冲突秒', '有片头', '有开场铺垫', '反转秒', '结尾钩子秒', '钩子类型', '结尾切在问题上', '首次胜利'],
          },
        },
      },
      required: ['集数据'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          全部通过: { type: 'boolean' },
          各集: { type: 'array' },
          季级规则: { type: 'array' },
          未通过清单: { type: 'array' },
          reason: { type: 'string' },
        },
        required: ['ok'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: (args) => run(() => {
      const episodes = asArray(args['集数据'], '集数据') as unknown as readonly EpisodeBeats[]
      const report = checkSeasonBeats(episodes)
      return { ok: true, ...report }
    }),
  },
  {
    name: 'novel_shortdrama_review_episode',
    description: '短剧审读确定性检查：台词单句长度、台词总量、场景数、钩子/核心想法/爽点/结尾悬念与大纲的一致性、反转数、节拍表时间点。经共享审读注册表跑完（范围 集，与章节审读同一套完成判定逻辑），返回发现项（模块名：短剧审读）+ 审核编号 + 审读指纹；零发现不等于审读通过，语义审读（短剧审读（语义））仍按底本派发。发现项与语义审读发现项一并经 novel_record_review_findings（适用范围 集）回写进分集审读记录（草稿区/审核/审-集NNN.json）；全部范围模块回写完毕才算审核完成。',
    parameters: {
      type: 'object',
      properties: {
        剧本: {
          type: 'object',
          description: '单集剧本（与 novel_shortdrama_render_episode 的参数同一形状）',
          properties: {
            集: { type: 'integer' },
            标题: { type: 'string' },
            画幅: { type: 'string', enum: ['竖屏', '横屏'] },
            钩子类型: { type: 'string', enum: ['身份', '情感', '顿悟'] },
            核心想法: { type: 'string' },
            爽点: { type: 'string' },
            时长秒: { type: 'integer' },
            开场冲突秒: { type: 'integer' },
            反转秒: { type: 'array', items: { type: 'integer' } },
            结尾钩子秒: { type: 'integer' },
            结尾悬念: { type: 'string' },
            场景: { type: 'array' },
          },
          required: ['集', '标题', '画幅', '钩子类型', '核心想法', '爽点', '时长秒', '开场冲突秒', '反转秒', '结尾钩子秒', '结尾悬念', '场景'],
        },
        大纲: {
          type: 'object',
          description: '对应的分集大纲一集：集、标题、钩子类型、核心想法、爽点、开场冲突、反转（数组）、结尾悬念',
          properties: {
            集: { type: 'integer' },
            标题: { type: 'string' },
            钩子类型: { type: 'string', enum: ['身份', '情感', '顿悟'] },
            核心想法: { type: 'string' },
            爽点: { type: 'string' },
            开场冲突: { type: 'string' },
            反转: { type: 'array', items: { type: 'string' } },
            结尾悬念: { type: 'string' },
          },
          required: ['集', '标题', '钩子类型', '核心想法', '爽点', '开场冲突', '反转', '结尾悬念'],
        },
      },
      required: ['剧本', '大纲'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          模块名: { type: 'string' },
          发现项: { type: 'array' },
          审核编号: { type: 'string', description: '本次审读的编号（审-集NNN）' },
          审读指纹: { type: 'string', description: '本次审读输入的指纹；回写发现项时原样传入 novel_record_review_findings' },
          待回写模块: { type: 'array', items: { type: 'string' }, description: '尚未回写的范围模块（语义审读须派发回写后才算完成）' },
          reason: { type: 'string' },
        },
        required: ['ok'],
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    execute: (args) => run(() => {
      const 剧本 = asRecord(args['剧本'], '剧本') as unknown as EpisodeScriptInput
      const 大纲 = asRecord(args['大纲'], '大纲') as unknown as EpisodeOutline
      const result = computeEpisodeFindings({
        集: 剧本.集,
        剧本,
        大纲,
        剧本文本: renderEpisodeScript(剧本).内容,
      })
      return {
        ok: true,
        模块名: '短剧审读',
        发现项: result.findings,
        审核编号: result.审核编号,
        审读指纹: result.审读指纹,
        待回写模块: ['短剧审读（语义）'],
      }
    }),
  },
]

interface ShortdramaToolsDeps {
  readonly bookRootOfBookId: NovelToolsDeps['bookRootOfBookId']
  readonly writeDraft: (root: string, op: FileOp, exec?: ToolExecContext) => Promise<void>
}

/** 调用方在异步书仓写入锁内执行，复用原生写入的版本保护、取消与操作留痕。 */
export function createShortdramaTools(deps: ShortdramaToolsDeps): NovelToolDefinition[] {
  return SHORTDRAMA_TOOL_DEFINITIONS.map(tool => {
    if (tool.name !== 'novel_shortdrama_render_episode') return tool
    const parameters = tool.parameters as { properties: Record<string, unknown>; required: string[] }
    return {
      ...tool,
      description: '渲染并保存短剧单集草稿：必传 bookId，核对契约输出形态=短剧，经原生写入保存到草稿区/剧本/短剧/集001.md 起，读回核验后才返回 saved=true 和实际 path。finalPath 是未来定稿路径；草稿仍须节拍检查、审读和作者确认，不代表定稿。台词超长只报警告、不丢稿。',
      parameters: {
        ...tool.parameters,
        properties: { ...parameters.properties, bookId: { type: 'string', description: '当前短剧的书id（必填）' } },
        required: ['bookId', ...parameters.required],
      },
      execute: async (args, exec) => {
        const bookId = typeof args['bookId'] === 'string' ? args['bookId'].trim() : ''
        if (bookId === '') return toolFailure('book-not-found', 'bookId 必填，请先核对当前短剧书目。')
        try {
          const root = deps.bookRootOfBookId(bookId, exec?.agent)
          if (root === undefined) return toolFailure('book-not-found', `书id不存在或不唯一：${bookId}`)
          if (readExistingContract(root).fields['输出形态'] !== '短剧') return toolFailure('invalid-argument', '作品契约的输出形态必须是短剧，不能保存到其他项目。')
          const rendered = renderEpisodeScript(args as unknown as EpisodeScriptInput)
          const draftPath = `草稿区/${rendered.path}`
          const access = gateFileAccess(root, draftPath)
          if (!access.allow || access.zone !== '草稿区') return toolFailure('runtime-link', `短剧草稿目标必须留在草稿区，请核对目录链接：${access.allow ? draftPath : access.reason}`)
          exec?.signal?.throwIfAborted()
          await deps.writeDraft(root, { relPath: draftPath, content: rendered.内容 }, exec)
          if (fs.readFileSync(path.join(root, draftPath), 'utf8') !== rendered.内容) {
            return { ...toolFailure('internal', '短剧草稿保存后读回正文不一致，请核对实际文件后再继续。'), saved: false }
          }
          return { ok: true, ...rendered, path: draftPath, finalPath: rendered.path, saved: true, message: '短剧草稿已保存并读回核验，尚待节拍检查、审读和作者确认。' }
        } catch (error) {
          if (exec?.signal?.aborted) throw error
          return { ...failureFrom(error, '短剧草稿保存失败：'), saved: false }
        }
      },
    }
  })
}
