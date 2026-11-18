import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  APPROVE_LABEL,
  REJECT_LABEL,
  paths,
  renderEpisodeScript,
  renderSceneOutline,
  renderScreenplay,
  renderStoryDraft,
  type AskFn,
} from '@webnovel/core'
import { exampleOutlines, exampleVerticalScripts } from '../../core/src/shortdrama/examples'
import { createNovelTools, type NativeWriteFn } from '../src/novel-tools'
import type { AutomationMode } from '../src/preferences'

const roots: string[] = []
afterAll(() => {
  for (const dir of roots) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch { /* Windows handle delay */ }
  }
})

const nativeWrite: NativeWriteFn = async (root, op) => {
  const abs = path.join(root, op.relPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, op.content, 'utf8')
}

const baseConcept = {
  状态: '已确认' as const,
  核心创意: '外卖员在暴雨夜亮出冻结令反将恶霸',
  题材与目标读者: '都市逆袭',
  主角核心欲望: '拿回被吞的三百万救命钱',
  主要冲突: '恶霸扣押外卖箱与抵押协议逼签',
  核心看点: '当众亮牌打脸与资金秒到账',
  差异化方向: '物证与大白话结论同轮直给',
  明确不要什么: '不拖沓注水',
}

function makeWorkspace(prefix: string): { ws: string; books: Map<string, string> } {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  roots.push(ws)
  return { ws, books: new Map<string, string>() }
}

function createHarness(options: {
  mode?: () => AutomationMode
  askImpl?: (req: unknown) => '已批准' | '退回'
} = {}) {
  const { ws, books } = makeWorkspace('dsh-two-step-')
  const askCalls: unknown[] = []
  const askFn: AskFn = async (req) => {
    askCalls.push(req)
    const choice = options.askImpl ? options.askImpl(req) : '已批准'
    const label = choice === '已批准' ? APPROVE_LABEL : REJECT_LABEL
    return { answers: req.questions.map((q) => ({ id: q.id, selected: [label] })) }
  }
  const tools = createNovelTools({
    nativeWrite,
    workspaceRoot: () => ws,
    bookRootOfBookId: (bookId) => {
      const hit = books.get(bookId)
      if (hit) return hit
      const candidate = path.join(ws, '作品', bookId)
      return fs.existsSync(candidate) ? candidate : undefined
    },
    askFn,
    automationMode: options.mode ?? (() => 'semi-auto'),
  })
  const call = (name: string, args: Record<string, unknown>) => {
    const tool = tools.find((t) => t.name === name)
    if (!tool) throw new Error(`Missing tool: ${name}`)
    return tool.execute(args) as Promise<Record<string, unknown>>
  }
  return { ws, books, askCalls, call }
}

describe('半自动两步走与影视全链路闭环（短剧 / 电影剧本 / 小说）', () => {
  it('短剧与电影剧本建书自动折算目标总字数，小说仍要求明确字数', async () => {
    const { call } = createHarness()

    const shortDrama = await call('novel_create_book', {
      bookName: '暴雨冻结令',
      市场: '中文',
      输出形态: '短剧',
      concept: baseConcept,
    })
    expect(shortDrama.ok).toBe(true)

    const film = await call('novel_create_book', {
      bookName: '夜行证人',
      市场: '中文',
      输出形态: '电影剧本',
      concept: baseConcept,
    })
    expect(film.ok).toBe(true)

    const novelMissingWords = await call('novel_create_book', {
      bookName: '长篇修仙',
      市场: '中文',
      输出形态: '小说',
      concept: baseConcept,
    })
    expect(novelMissingWords).toMatchObject({ ok: false, code: 'invalid-argument' })
  })

  it('短剧全链路：保存 Markdown 草稿 -> 审读回写 -> novel_authorize_batch 一次弹窗 -> settle 零额外弹窗入档', async () => {
    const { ws, books, askCalls, call } = createHarness()
    const created = await call('novel_create_book', {
      bookName: '短剧闭环测试',
      市场: '中文',
      输出形态: '短剧',
      concept: baseConcept,
    })
    expect(created.ok).toBe(true)
    const bookId = String(created.bookId)
    const bookRoot = String(created.bookRoot)
    books.set(bookId, bookRoot)

    const ep = exampleVerticalScripts[0]!
    const rendered = renderEpisodeScript(ep)
    const saved = await call('novel_shortdrama_save_script', {
      bookId,
      集: 1,
      正文: rendered.内容,
    })
    expect(saved).toMatchObject({ ok: true, saved: true, path: '草稿区/剧本/短剧/集001.md' })

    const mismatch = await call('novel_shortdrama_save_script', {
      bookId,
      集: 2,
      正文: rendered.内容,
    })
    expect(mismatch).toMatchObject({ ok: false, saved: false, code: 'invalid-argument' })

    const reviewed = await call('novel_shortdrama_review_episode', {
      剧本: ep,
      大纲: exampleOutlines[0]!,
    })
    expect(reviewed.ok).toBe(true)
    const fp = String(reviewed['审读指纹'])

    expect(await call('novel_record_review_findings', {
      bookId,
      适用范围: '集',
      集: 1,
      模块名: '短剧审读',
      审读指纹: fp,
      发现项: [],
      剧本: ep,
      大纲: exampleOutlines[0]!,
    })).toMatchObject({ ok: true })
    expect(await call('novel_record_review_findings', {
      bookId,
      适用范围: '集',
      集: 1,
      模块名: '短剧审读（语义）',
      审读指纹: fp,
      发现项: [],
      剧本: ep,
      大纲: exampleOutlines[0]!,
    })).toMatchObject({ ok: true })

    // 一次批量授权弹窗
    const auth = await call('novel_authorize_batch', {
      bookId,
      范围: '集001–集003',
      摘要: '第 1–3 集都市逆袭开篇与打脸节奏大纲确认。',
      目标类型: 'episode',
      起号: 1,
      止号: 3,
    })
    expect(auth).toMatchObject({ ok: true, automationMode: 'semi-auto' })
    expect(askCalls).toHaveLength(1)

    // 批量范围内定稿不再弹窗
    const settled = await call('novel_shortdrama_settle_episode', {
      bookId,
      集: 1,
      summary: '第1集定稿入档',
    })
    expect(settled).toMatchObject({ ok: true, 集: 1 })
    expect(askCalls).toHaveLength(1)
    expect(fs.existsSync(path.join(bookRoot, paths.短剧集(1)))).toBe(true)
  })

  it('电影剧本全链路：save_draft 保存故事稿/分场大纲/剧本草稿 -> review -> batch authorize -> settle 零额外弹窗', async () => {
    const { ws, books, askCalls, call } = createHarness()
    const created = await call('novel_create_book', {
      bookName: '深夜证人',
      市场: '中文',
      输出形态: '电影剧本',
      concept: baseConcept,
    })
    expect(created.ok).toBe(true)
    const bookId = String(created.bookId)
    const bookRoot = String(created.bookRoot)
    books.set(bookId, bookRoot)

    const story = {
      标题: '深夜证人',
      故事一句话: '夜班修车工护送失忆目击者逃出封锁区并揭开警署黑幕。',
      人物: [
        { 姓名: '周越', 小传: '主角。夜班修车工，必须还清冤屈并保住妹妹的手术费。' },
        { 姓名: '赵警督', 小传: '对手。警署督察，必须赶在黎明前销毁黑账录音。' },
      ],
      世界规则: '暴雪夜高架封路，全城通讯信号每隔两小时中断一次。',
      情节主线: '修车工意外载到关键证人，一路避开伏击并在天亮前公开录音。',
      关键转折: ['修车铺遭纵火伏击', '证人恢复关键车牌记忆', '天台对质录音直播'],
      结尾: '黑账曝光，周越洗清污名。',
    }
    expect(await call('novel_screenplay_save_draft', {
      bookId, 类型: '故事稿', 正文: renderStoryDraft(story),
    })).toMatchObject({ ok: true, saved: true, path: '草稿区/剧本/故事稿.md' })

    const outline = {
      标题: '深夜证人',
      场: [
        { 场号: 1, 幕: 1 as const, 场景: '深夜修车铺 夜 内', 人物: '周越', 冲突: '周越被讨债人堵门追缴违约金。', 转折: '失忆女子浑身是血撞进卷帘门。' },
        { 场号: 2, 幕: 2 as const, 场景: '结冰高架桥 夜 外', 人物: '周越、赵警督', 冲突: '黑警借设卡名义搜查后备箱。', 转折: '证人认出巡逻车尾号正是凶手座驾。' },
        { 场号: 3, 幕: 3 as const, 场景: '旧广播塔天台 清晨 外', 人物: '周越、赵警督', 冲突: '赵警督持枪逼周越交出磁带。', 转折: '周越已提前接通城市早间应急广播。' },
      ],
    }
    expect(await call('novel_screenplay_save_draft', {
      bookId, 类型: '分场大纲', 正文: renderSceneOutline(outline),
    })).toMatchObject({ ok: true, saved: true, path: '草稿区/剧本/分场大纲.md' })

    const draft = {
      标题: '深夜证人',
      场: [
        { 场号: 1, 标题: { 内外: 'INT' as const, 地点: '深夜修车铺', 时间: '夜' }, 动作: ['暴雨敲打铁皮顶，周越拧紧扳手。女子撞开卷帘门跌倒在地。'], 台词段: [{ 角色: '周越', 台词: ['谁在外面？别拿血蹭脏千斤顶。'] }] },
        { 场号: 2, 标题: { 内外: 'EXT' as const, 地点: '结冰高架桥', 时间: '夜' }, 动作: ['警灯刺穿大雾，赵警督手按腰间走近车窗。'], 台词段: [{ 角色: '赵警督', 台词: ['后备箱打开，例行检查。'] }] },
        { 场号: 3, 标题: { 内外: 'EXT' as const, 地点: '旧广播塔天台', 时间: '清晨' }, 动作: ['风雪卷起录音带盒，周越松手让红灯亮起。'], 台词段: [{ 角色: '周越', 台词: ['全城早高峰，现在开始放音。'] }] },
      ],
    }
    expect(await call('novel_screenplay_save_draft', {
      bookId, 类型: '剧本草稿', 正文: renderScreenplay(draft),
    })).toMatchObject({ ok: true, saved: true, path: '草稿区/剧本/剧本草稿.md' })

    expect(await call('novel_authorize_batch', {
      bookId,
      范围: '电影剧本全片',
      摘要: '故事稿、三幕分场大纲与剧本定稿授权。',
      目标类型: 'screenplay',
    })).toMatchObject({ ok: true })
    expect(askCalls).toHaveLength(1)

    const settled = await call('novel_screenplay_settle', {
      bookId,
      summary: '电影剧本《深夜证人》定稿入档',
      片长: '短片',
    })
    expect(settled).toMatchObject({ ok: true, path: '剧本/电影/剧本.md' })
    expect(askCalls).toHaveLength(1)
    expect(fs.existsSync(path.join(bookRoot, paths.电影剧本()))).toBe(true)
  })

  it('manual 严格模式拒绝 novel_authorize_batch，并保留逐项裁决要求', async () => {
    let mode: AutomationMode = 'manual'
    const { ws, books, call } = createHarness({ mode: () => mode })
    const created = await call('novel_create_book', {
      bookName: '手动校验测试',
      市场: '中文',
      输出形态: '短剧',
      concept: baseConcept,
    })
    const bookId = String(created.bookId)
    const bookRoot = String(created.bookRoot)
    books.set(bookId, bookRoot)

    expect(await call('novel_authorize_batch', {
      bookId,
      范围: '集001–集003',
      摘要: '手动模式下不应批准批量。',
    })).toMatchObject({ ok: false, code: 'invalid-argument' })

    mode = 'semi-auto'
    const declined = createHarness({ askImpl: () => '退回' })
    const c2 = await declined.call('novel_create_book', {
      bookName: '退回测试',
      市场: '中文',
      输出形态: '短剧',
      concept: baseConcept,
    })
    const b2 = String(c2.bookId)
    declined.books.set(b2, String(c2.bookRoot))
    expect(await declined.call('novel_authorize_batch', {
      bookId: b2,
      范围: '集001',
      摘要: '作者点退回时不授权。',
    })).toMatchObject({ ok: false, code: 'author-declined' })
  })
})
