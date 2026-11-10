/**
 * 电影剧本改编管线工具定义（阶段 2，新文件）。
 *
 * 注意：不要直接改 packages/bundle/src/novel-tools.ts——本文件只导出
 * 工具定义数组，接线（并进 createNovelTools 的 tools 数组、登记
 * tool-catalog、novel-director 路由）由协调人统一做，见汇报里的接线代码。
 *
 * 导入说明：本文件经相对路径 import 核心模块
 * (`../../core/src/screenplay/index`)，因为 core/src/index.ts 目前还没
 * 导出 screenplay（协调人接线时加一行 `export * from './screenplay/index'`，
 * 然后把这里的相对导入改成 `from '@webnovel/core'`——改一行即可，
 * 其余不动）。相对导入在 esbuild 打包与 tsc 下都能解析，与仓内
 * `@webnovel/core` 源码直引的形态一致。
 *
 * 工具都是纯计算（解析 / 转换 / 校验 / 审读），不读写书仓文件：
 * 落盘（故事稿 / 分场大纲 / 剧本草稿 / 定稿）走接线后的写入通道，
 * 定稿路径只认 paths.电影剧本()（剧本/电影/剧本.md），见 pipeline.ts。
 */

import type { NovelToolDefinition } from './novel-tools'
import {
  checkScreenplayGate, draftFromOutline, emptySceneOutline, emptyStoryDraft,
  outlineFromStory, parseSceneOutline, parseScreenplay, parseStoryDraft,
  renderSceneOutline, renderScreenplay, renderStoryDraft, runScreenplayPipeline,
  runScreenplayReview, screenplayFinalPath, validateSceneOutline, validateScreenplay,
  validateStoryDraft, estimatePages,
  MARKET_VALUES, OUTPUT_FORM_VALUES, GENRE_TIER_IDS, type GenreTierId,
} from '@webnovel/core'

export const SCREENPLAY_TOOL_NAMES: readonly string[] = [
  'novel_screenplay_check_contract',
  'novel_screenplay_validate_story',
  'novel_screenplay_build_outline',
  'novel_screenplay_build_draft',
  'novel_screenplay_review',
  'novel_screenplay_render',
]

/** 接线时可选的依赖：只用于按 bookId 读契约字段；不传时工具只用显式参数。 */
export interface ScreenplayToolsDeps {
  readonly bookRootOfBookId?: (bookId: string) => string | undefined
  readonly readContractFields?: (bookRoot: string) => { readonly 市场?: unknown; readonly 输出形态?: unknown } | undefined
}

function renderOutput(value: unknown): Array<{ readonly type: 'text'; readonly text: string }> {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function textArg(args: Record<string, unknown>, name: string): string {
  return typeof args[name] === 'string' ? (args[name] as string) : ''
}

function enumArg(args: Record<string, unknown>, name: string): string | undefined {
  const v = args[name]
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

/** 工具定义数组（NovelToolDefinition 形状，与 novel-tools.ts 一致）。 */
export function createScreenplayTools(deps: ScreenplayToolsDeps = {}): NovelToolDefinition[] {
  return [
    {
      name: 'novel_screenplay_check_contract',
      description: '核对一部作品能不能走电影剧本改编管线：只在契约输出形态=电影剧本时通过；返回该市场可用的题材档与定稿路径（剧本/电影/剧本.md）。bookId 给了且接线已提供读契约依赖时，按契约 frontmatter 核对；否则按显式参数核对。',
      parameters: {
        type: 'object',
        properties: {
          bookId: { type: 'string', description: '书id（可选；给了就按契约核对）' },
          市场: { type: 'string', enum: [...MARKET_VALUES], description: '目标市场：海外或中文（不传 bookId 时必填）' },
          输出形态: { type: 'string', enum: [...OUTPUT_FORM_VALUES], description: '输出形态（不传 bookId 时必填；只有 电影剧本 能走本管线）' },
          题材档: { type: 'string', enum: [...GENRE_TIER_IDS], description: '题材档（可选；给了须属于该市场）' },
        },
        required: [],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            通过: { type: 'boolean' },
            原因: { type: 'array', items: { type: 'string' } },
            可用题材档: { type: 'array', items: { type: 'string' } },
            定稿路径: { type: 'string' },
          },
          required: ['ok'],
        },
        render: (_args, value) => renderOutput(value),
      },
      execute: (args) => {
        let 市场 = enumArg(args, '市场')
        let 输出形态 = enumArg(args, '输出形态')
        const bookId = enumArg(args, 'bookId')
        if (bookId !== undefined && deps.bookRootOfBookId !== undefined && deps.readContractFields !== undefined) {
          const root = deps.bookRootOfBookId(bookId)
          const fields = root === undefined ? undefined : deps.readContractFields(root)
          if (typeof fields?.市场 === 'string') 市场 = fields.市场
          if (typeof fields?.输出形态 === 'string') 输出形态 = fields.输出形态
        }
        const gate = checkScreenplayGate(市场, 输出形态, enumArg(args, '题材档') as GenreTierId | undefined)
        return { ok: gate.通过, 通过: gate.通过, 原因: gate.原因, 可用题材档: gate.可用题材档, 定稿路径: screenplayFinalPath() }
      },
    },
    {
      name: 'novel_screenplay_validate_story',
      description: '校验故事稿（小说浓缩版）：六节是否齐全、人物与关键转折是否写出、人物小传是否写清动机。只判结构与完整度，不评文学质量；返回问题与警告。',
      parameters: {
        type: 'object',
        properties: {
          故事稿: { type: 'string', description: '故事稿全文（Markdown，见空模板 novel_screenplay_build_outline 的返回或技能文档）' },
        },
        required: ['故事稿'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            问题: { type: 'array', items: { type: 'string' } },
            警告: { type: 'array', items: { type: 'string' } },
          },
          required: ['ok'],
        },
        render: (_args, value) => renderOutput(value),
      },
      execute: (args) => {
        const parsed = parseStoryDraft(textArg(args, '故事稿'))
        if (parsed.story === undefined) return { ok: false, 问题: parsed.problems, 警告: [] }
        const v = validateStoryDraft(parsed.story)
        return { ok: parsed.ok && v.errors.length === 0, 问题: [...parsed.problems, ...v.errors], 警告: v.warnings }
      },
    },
    {
      name: 'novel_screenplay_build_outline',
      description: '故事稿 → 分场大纲骨架：第一幕 1 场、第二幕每条关键转折 1 场（转折原句直接落进该场）、第三幕 1 场。骨架不代写情节，场景/冲突留【待写】，须逐场写完再审读；同时返回空故事稿与空大纲模板。',
      parameters: {
        type: 'object',
        properties: {
          故事稿: { type: 'string', description: '已通过校验的故事稿全文' },
        },
        required: ['故事稿'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            分场大纲骨架: { type: 'string' },
            待写提醒: { type: 'array', items: { type: 'string' } },
            空故事稿模板: { type: 'string' },
            空大纲模板: { type: 'string' },
            原因: { type: 'array', items: { type: 'string' } },
          },
          required: ['ok'],
        },
        render: (_args, value) => renderOutput(value),
      },
      execute: (args) => {
        const parsed = parseStoryDraft(textArg(args, '故事稿'))
        if (parsed.story === undefined) return { ok: false, 分场大纲骨架: '', 待写提醒: [], 空故事稿模板: emptyStoryDraft(), 空大纲模板: emptySceneOutline(), 原因: parsed.problems }
        const outline = outlineFromStory(parsed.story)
        const check = validateSceneOutline(outline)
        return {
          ok: true,
          分场大纲骨架: renderSceneOutline(outline),
          待写提醒: [...check.errors, ...check.warnings],
          空故事稿模板: emptyStoryDraft(parsed.story.标题),
          空大纲模板: emptySceneOutline(parsed.story.标题),
          原因: [],
        }
      },
    },
    {
      name: 'novel_screenplay_build_draft',
      description: '分场大纲 → 剧本草稿骨架：每场一个场景标题（INT./EXT. 地点 - 时间），动作与台词各留一处【待写】占位。骨架不是成品，校验必报高级别待写项，须逐场写完再审读。',
      parameters: {
        type: 'object',
        properties: {
          分场大纲: { type: 'string', description: '已确认的分场大纲全文' },
        },
        required: ['分场大纲'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            剧本草稿骨架: { type: 'string' },
            待写清单: { type: 'array', items: { type: 'string' } },
            原因: { type: 'array', items: { type: 'string' } },
          },
          required: ['ok'],
        },
        render: (_args, value) => renderOutput(value),
      },
      execute: (args) => {
        const parsed = parseSceneOutline(textArg(args, '分场大纲'))
        if (parsed.outline === undefined) return { ok: false, 剧本草稿骨架: '', 待写清单: [], 原因: parsed.problems }
        const draft = draftFromOutline(parsed.outline)
        const findings = validateScreenplay(draft)
        return {
          ok: true,
          剧本草稿骨架: renderScreenplay(draft),
          待写清单: findings.filter((f) => f.严重程度 === '高').map((f) => `${f.证据位置}：${f.问题说明}`),
          原因: [],
        }
      },
    },
    {
      name: 'novel_screenplay_review',
      description: '剧本审读：三个确定性模块（剧本对白审读、剧本节奏审读、剧本场次完整性审读）一次跑完。任一高级别发现项即阻断，不得进定稿；无分场大纲时节奏审读只报材料缺失，不伪装通过。',
      parameters: {
        type: 'object',
        properties: {
          剧本草稿: { type: 'string', description: '剧本草稿全文' },
          分场大纲: { type: 'string', description: '分场大纲全文（可选；给了加做大纲—草稿场场对应检查）' },
          片长: { type: 'string', enum: ['长片', '短片'], description: '长片 90–110 页才做页数参考；短片跳过页数检查。默认 长片。' },
        },
        required: ['剧本草稿'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            是否阻断: { type: 'boolean' },
            发现项: { type: 'array', items: { type: 'object' } },
            原因: { type: 'array', items: { type: 'string' } },
          },
          required: ['ok'],
        },
        render: (_args, value) => renderOutput(value),
      },
      execute: (args) => {
        const draft = parseScreenplay(textArg(args, '剧本草稿'))
        if (draft.draft === undefined) return { ok: false, 是否阻断: true, 发现项: [], 原因: draft.problems }
        const outlineText = textArg(args, '分场大纲')
        const outline = outlineText.trim() === '' ? undefined : parseSceneOutline(outlineText)
        if (outline !== undefined && outline.outline === undefined) {
          return { ok: false, 是否阻断: true, 发现项: [], 原因: outline.problems }
        }
        const result = runScreenplayReview({
          剧本草稿: draft.draft,
          ...(outline?.outline !== undefined ? { 分场大纲: outline.outline } : {}),
          片长: enumArg(args, '片长') === '短片' ? '短片' : '长片',
        })
        return { ok: !result.是否阻断, 是否阻断: result.是否阻断, 发现项: result.findings, 原因: [] }
      },
    },
    {
      name: 'novel_screenplay_render',
      description: '把剧本草稿文本解析后渲染成标准格式（FADE IN: 开场、场号两位 + 三段式场景标题、FADE OUT. 收尾），并返回页数粗估与格式问题。页数是粗估（渲染行数 ÷ 55），只作参考。',
      parameters: {
        type: 'object',
        properties: {
          剧本草稿: { type: 'string', description: '剧本草稿全文' },
        },
        required: ['剧本草稿'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            标准格式文本: { type: 'string' },
            估算页数: { type: 'number' },
            格式问题: { type: 'array', items: { type: 'string' } },
            原因: { type: 'array', items: { type: 'string' } },
          },
          required: ['ok'],
        },
        render: (_args, value) => renderOutput(value),
      },
      execute: (args) => {
        const parsed = parseScreenplay(textArg(args, '剧本草稿'))
        if (parsed.draft === undefined) return { ok: false, 标准格式文本: '', 估算页数: 0, 格式问题: [], 原因: parsed.problems }
        const findings = validateScreenplay(parsed.draft)
        return {
          ok: findings.every((f) => f.严重程度 !== '高'),
          标准格式文本: renderScreenplay(parsed.draft),
          估算页数: estimatePages(parsed.draft),
          格式问题: findings.map((f) => `${f.模块名}〔${f.严重程度}〕${f.证据位置}：${f.问题说明}`),
          原因: [],
        }
      },
    },
  ]
}

/** 故事稿 → 分场大纲 → 剧本草稿 → 审读：一步跑完改编全流程（纯计算）。 */
export function runScreenplayPipelineTool(input: {
  readonly 市场: string
  readonly 输出形态: string
  readonly 题材档?: GenreTierId
  readonly 片长?: '长片' | '短片'
  readonly 故事稿: string
  readonly 分场大纲: string
  readonly 剧本草稿: string
}): ReturnType<typeof runScreenplayPipeline> {
  return runScreenplayPipeline({
    市场: input.市场 as '海外' | '中文',
    输出形态: input.输出形态 as '短剧' | '电影剧本' | '小说',
    ...(input.题材档 !== undefined ? { 题材档: input.题材档 } : {}),
    ...(input.片长 !== undefined ? { 片长: input.片长 } : {}),
    故事稿: input.故事稿,
    分场大纲: input.分场大纲,
    剧本草稿: input.剧本草稿,
  })
}

export { renderStoryDraft }
