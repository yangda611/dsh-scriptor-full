import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  APPROVE_LABEL,
  REJECT_LABEL,
  computeScreenplayExport,
  contractTemplate,
  createBook,
  paths,
  writeFileAtomic,
  type AskRequest,
  type AskResponse,
} from '@webnovel/core'
import { exampleOutlines, exampleVerticalScripts } from '../../core/src/shortdrama/examples'
import { createNovelTools, type NovelToolsDeps } from '../src/novel-tools'
import { nativeWriteStub } from './fixtures/native-write-stub'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
})

function fixture(overrides: Partial<NovelToolsDeps> = {}, output = '短剧') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shortdrama-save-'))
  roots.push(root)
  writeFileAtomic(root, paths.契约(), contractTemplate({}, { 书id: 'book', 输出形态: output }))
  const tool = createNovelTools({ workspaceRoot: () => root, bookRootOfBookId: id => id === 'book' ? root : undefined,
    nativeWrite: nativeWriteStub, ...overrides }).find(tool => tool.name === 'novel_shortdrama_render_episode')!
  return { root, tool }
}

const draftPath = '草稿区/剧本/短剧/集001.md'
const context = { name: 'novel_shortdrama_render_episode', callId: 'render-episode', agent: { id: 'main', session: { header: { id: 'session' } } } }

describe('短剧渲染保存', () => {
  it('注册工具保存实际草稿、读回相同正文并留下操作记录', async () => {
    const { root, tool } = fixture()
    const result = await tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] }, context) as { 内容: string }
    expect(result).toMatchObject({ ok: true, saved: true, path: draftPath, finalPath: '剧本/短剧/集001.md' })
    expect(fs.readFileSync(path.join(root, draftPath), 'utf8')).toBe(result.内容)
    expect(fs.existsSync(path.join(root, '剧本/短剧/集001.md'))).toBe(false)
    const records = fs.readdirSync(path.join(root, '.webnovel/operations')).map(name => JSON.parse(fs.readFileSync(path.join(root, '.webnovel/operations', name), 'utf8')))
    expect(records).toContainEqual(expect.objectContaining({ toolName: 'novel_shortdrama_render_episode', callId: 'render-episode', targets: expect.arrayContaining([draftPath]) }))
  })

  it.each([undefined, '', 'unknown'])('缺少或未知书id %s 时拒绝保存', async bookId => {
    const { root, tool } = fixture()
    expect(await tool.execute({ ...exampleVerticalScripts[0], ...(bookId === undefined ? {} : { bookId }) })).toMatchObject({ ok: false, code: 'book-not-found' })
    expect(fs.existsSync(path.join(root, draftPath))).toBe(false)
  })

  it('非短剧契约不得保存短剧草稿', async () => {
    const { root, tool } = fixture({}, '小说')
    expect(await tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] })).toMatchObject({ ok: false, code: 'invalid-argument' })
    expect(fs.existsSync(path.join(root, draftPath))).toBe(false)
  })

  it('宿主写入失败保留已有草稿并返回失败', async () => {
    const { root, tool } = fixture({ nativeWrite: async () => { throw new Error('FS_STALE_VERSION') } })
    writeFileAtomic(root, draftPath, '作者原稿')
    expect(await tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] }, context)).toMatchObject({ ok: false, reason: expect.stringContaining('FS_STALE_VERSION') })
    expect(fs.readFileSync(path.join(root, draftPath), 'utf8')).toBe('作者原稿')
  })

  it.each([false, true])('宿主报告成功但实际%s写入时不能返回保存成功', async wrongContent => {
    const { root, tool } = fixture({ nativeWrite: async (bookRoot, op) => {
      if (wrongContent) writeFileAtomic(bookRoot, op.relPath, '截断正文')
    } })
    expect(await tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] }, context)).toMatchObject({ ok: false, saved: false })
    expect(fs.existsSync(path.join(root, '剧本/短剧/集001.md'))).toBe(false)
  })

  it('缺少原生写入能力时不能退回直接覆盖', async () => {
    const { root, tool } = fixture({ nativeWrite: undefined })
    expect(await tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] })).toMatchObject({ ok: false, code: 'host-unavailable' })
    expect(fs.existsSync(path.join(root, draftPath))).toBe(false)
  })

  it('草稿目录链接指向已定稿剧本时拒绝覆盖', async () => {
    const { root, tool } = fixture()
    const finalDirectory = path.join(root, '剧本/短剧')
    fs.mkdirSync(finalDirectory, { recursive: true })
    fs.writeFileSync(path.join(finalDirectory, '集001.md'), '作者已确认的定稿')
    fs.mkdirSync(path.join(root, '草稿区/剧本'), { recursive: true })
    fs.symlinkSync(finalDirectory, path.join(root, '草稿区/剧本/短剧'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(await tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] }, context)).toMatchObject({ ok: false, code: 'runtime-link' })
    expect(fs.readFileSync(path.join(finalDirectory, '集001.md'), 'utf8')).toBe('作者已确认的定稿')
  })

  it('取消保存保留取消语义，释放书仓锁并允许后续重试', async () => {
    const controller = new AbortController()
    const { root, tool } = fixture({ nativeWrite: async (_root, _op, exec) => {
      controller.abort(new Error('作者取消保存'))
      exec!.signal!.throwIfAborted()
    } })
    await expect(tool.execute({ bookId: 'book', ...exampleVerticalScripts[0] }, { ...context, signal: controller.signal })).rejects.toThrow('作者取消保存')
    expect(fs.existsSync(path.join(root, draftPath))).toBe(false)
    expect(fs.existsSync(path.join(root, '.webnovel/book.lock'))).toBe(false)
    const retry = createNovelTools({ workspaceRoot: () => root, bookRootOfBookId: () => root, nativeWrite: nativeWriteStub }).find(t => t.name === tool.name)!
    expect(await retry.execute({ bookId: 'book', ...exampleVerticalScripts[0] })).toMatchObject({ ok: true, saved: true })
  })
})

const SHORTDRAMA_CONCEPT = {
  状态: '已确认',
  核心创意: '隐忍赘婿亮出真实身份',
  题材与目标读者: '都市短剧',
  主角核心欲望: '拿回尊严与掌控权',
  主要冲突: '离婚协议逼宫',
  核心看点: '当众身份反转',
  差异化方向: '快节奏强反差',
  明确不要什么: '注水拖戏',
  市场: '中文',
  输出形态: '短剧',
  目标总字数: 100000,
}

function createShortdramaBook(overrides: Partial<NovelToolsDeps> = {}) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'shortdrama-settle-'))
  roots.push(ws)
  const bookName = '短剧测试'
  const created = createBook({ workspaceRoot: ws, 书名: bookName, concept: SHORTDRAMA_CONCEPT })
  expect(created.ok).toBe(true)
  if (!created.ok) throw new Error(created.reason)
  const { bookId, bookRoot } = created
  const tools = createNovelTools({
    workspaceRoot: () => ws,
    bookRootOfBookId: id => id === bookId ? bookRoot : undefined,
    nativeWrite: nativeWriteStub,
    ...overrides,
  })
  const call = (name: string, args: Record<string, unknown>, exec?: Record<string, unknown>) =>
    tools.find(t => t.name === name)!.execute(args, exec as never) as Promise<Record<string, unknown>>
  return { ws, bookId, bookRoot, call }
}

const approveFn: NovelToolsDeps['askFn'] = async (): Promise<AskResponse> => ({
  answers: [{ id: '定稿入档', selected: [APPROVE_LABEL] }],
})

describe('短剧单集定稿入档（novel_shortdrama_settle_episode）', () => {
  it('渲染 → 审读回写 → 作者裁决批准 → 原子落盘 剧本/短剧/集001.md 并 ch: 提交、可导出', async () => {
    let seenReq: AskRequest | undefined
    const { bookId, bookRoot, call } = createShortdramaBook({
      askFn: async req => {
        seenReq = req
        return { answers: [{ id: '定稿入档', selected: [APPROVE_LABEL] }] }
      },
    })

    const rendered = await call('novel_shortdrama_render_episode', { bookId, ...exampleVerticalScripts[0] }, context)
    expect(rendered).toMatchObject({ ok: true, saved: true, path: '草稿区/剧本/短剧/集001.md' })

    const reviewed = await call('novel_shortdrama_review_episode', { 剧本: exampleVerticalScripts[0], 大纲: exampleOutlines[0] })
    expect(reviewed.ok).toBe(true)
    const fp = String(reviewed['审读指纹'])

    const recDet = await call('novel_record_review_findings', {
      bookId, 适用范围: '集', 集: 1, 模块名: '短剧审读',
      发现项: [], 审读指纹: fp, 剧本: exampleVerticalScripts[0], 大纲: exampleOutlines[0],
    })
    expect(recDet.ok).toBe(true)
    const recSem = await call('novel_record_review_findings', {
      bookId, 适用范围: '集', 集: 1, 模块名: '短剧审读（语义）',
      发现项: [], 审读指纹: fp, 剧本: exampleVerticalScripts[0], 大纲: exampleOutlines[0],
    })
    expect(recSem).toMatchObject({ ok: true, 完成: true, 审核通过: true })

    const settled = await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: '第1集 离婚协议' }, context)
    expect(settled).toMatchObject({
      ok: true,
      path: '剧本/短剧/集001.md',
      draftPath: '草稿区/剧本/短剧/集001.md',
      集: 1,
      标题: exampleVerticalScripts[0]!.标题,
      alreadyCommitted: false,
      审读状态: expect.stringContaining('审读通过'),
    })

    expect(seenReq).toBeDefined()
    expect(seenReq!.questions[0]?.id).toBe('定稿入档')
    expect(seenReq!.questions[0]?.detail).toContain('剧本/短剧/集001.md')
    expect(seenReq!.questions[0]?.detail).toContain('审读通过')

    const finalAbs = path.join(bookRoot, '剧本/短剧/集001.md')
    expect(fs.readFileSync(finalAbs, 'utf8')).toBe(rendered['内容'])
    expect(fs.readdirSync(path.join(bookRoot, '定稿/卷01'))).toEqual(['.gitkeep'])

    const log = spawnSync('git', ['-c', 'core.quotepath=false', 'log', '-1', '--format=%s'], { cwd: bookRoot, encoding: 'utf8', windowsHide: true })
    expect(log.status).toBe(0)
    expect(log.stdout.trim()).toBe('ch: 第1集 离婚协议')

    const show = spawnSync('git', ['-c', 'core.quotepath=false', 'show', '--stat', '--format=', 'HEAD'], { cwd: bookRoot, encoding: 'utf8', windowsHide: true })
    expect(show.stdout).toContain('剧本/短剧/集001.md')

    // 定稿后可直接走剧本导出
    const exported = computeScreenplayExport(bookRoot, { 形态: '短剧', 集: 1 })
    expect(exported.ok, exported.gaps.join('；')).toBe(true)

    // 同一内容重复调用幂等返回 alreadyCommitted=true，不新增提交
    const countBefore = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: bookRoot, encoding: 'utf8', windowsHide: true }).stdout.trim()
    const repeat = await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: '第1集 离婚协议' }, context)
    expect(repeat).toMatchObject({ ok: true, alreadyCommitted: true, path: '剧本/短剧/集001.md' })
    const countAfter = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: bookRoot, encoding: 'utf8', windowsHide: true }).stdout.trim()
    expect(countAfter).toBe(countBefore)

    // 定稿只增不改：草稿改写后再次定稿被拒绝，原定稿内容不变
    const modified = { ...exampleVerticalScripts[0]!, 标题: '修改后的第1集' }
    await call('novel_shortdrama_render_episode', { bookId, ...modified }, context)
    const conflict = await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: '试图覆盖' }, context)
    expect(conflict).toMatchObject({ ok: false, code: 'source-conflict' })
    expect(fs.readFileSync(finalAbs, 'utf8')).toBe(rendered['内容'])
  })

  it('缺少裁决通道、作者退回或取消均拒绝写入剧本/短剧/', async () => {
    const noAsk = createShortdramaBook({ askFn: undefined })
    await noAsk.call('novel_shortdrama_render_episode', { bookId: noAsk.bookId, ...exampleVerticalScripts[0] }, context)
    expect(await noAsk.call('novel_shortdrama_settle_episode', { bookId: noAsk.bookId, 集: 1, summary: '测试' }))
      .toMatchObject({ ok: false, code: 'host-unavailable' })
    expect(fs.existsSync(path.join(noAsk.bookRoot, '剧本/短剧/集001.md'))).toBe(false)

    const rejected = createShortdramaBook({
      askFn: async () => ({ answers: [{ id: '定稿入档', selected: [REJECT_LABEL] }] }),
    })
    await rejected.call('novel_shortdrama_render_episode', { bookId: rejected.bookId, ...exampleVerticalScripts[0] }, context)
    expect(await rejected.call('novel_shortdrama_settle_episode', { bookId: rejected.bookId, 集: 1, summary: '测试' }))
      .toMatchObject({ ok: false, code: 'author-declined' })
    expect(fs.existsSync(path.join(rejected.bookRoot, '剧本/短剧/集001.md'))).toBe(false)

    const controller = new AbortController()
    const cancelled = createShortdramaBook({
      askFn: async () => {
        controller.abort()
        return { answers: [{ id: '定稿入档', selected: [APPROVE_LABEL] }] }
      },
    })
    await cancelled.call('novel_shortdrama_render_episode', { bookId: cancelled.bookId, ...exampleVerticalScripts[0] }, context)
    expect(await cancelled.call('novel_shortdrama_settle_episode', { bookId: cancelled.bookId, 集: 1, summary: '测试' }, { ...context, signal: controller.signal }))
      .toMatchObject({ ok: false, code: 'author-cancelled' })
    expect(fs.existsSync(path.join(cancelled.bookRoot, '剧本/短剧/集001.md'))).toBe(false)
  })

  it('等待裁决期间草稿被改写时按 approval-stale 拒绝入档', async () => {
    const { bookId, bookRoot, call } = createShortdramaBook({
      askFn: async () => {
        fs.writeFileSync(path.join(bookRoot, '草稿区/剧本/短剧/集001.md'), '等待期间被篡改\n', 'utf8')
        return { answers: [{ id: '定稿入档', selected: [APPROVE_LABEL] }] }
      },
    })
    await call('novel_shortdrama_render_episode', { bookId, ...exampleVerticalScripts[0] }, context)
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: '第1集' }, context))
      .toMatchObject({ ok: false, code: 'approval-stale' })
    expect(fs.existsSync(path.join(bookRoot, '剧本/短剧/集001.md'))).toBe(false)
  })

  it('参数、契约、缺稿、损坏草稿与目录链接均在裁决前拦截', async () => {
    let askCalls = 0
    const { bookId, bookRoot, call } = createShortdramaBook({
      askFn: async req => {
        askCalls++
        return approveFn(req)
      },
    })

    expect(await call('novel_shortdrama_settle_episode', { bookId: 'missing', 集: 1, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'book-not-found' })
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 0, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'invalid-argument' })
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: '   ' }))
      .toMatchObject({ ok: false, code: 'invalid-argument' })
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'invalid-argument', reason: expect.stringContaining('不存在') })

    writeFileAtomic(bookRoot, '草稿区/剧本/短剧/集001.md', '不是合法短剧格式\n')
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'parse-error' })

    const ep2 = { ...exampleVerticalScripts[1]!, 集: 2 }
    await call('novel_shortdrama_render_episode', { bookId, ...ep2 }, context)
    fs.writeFileSync(path.join(bookRoot, '草稿区/剧本/短剧/集001.md'), fs.readFileSync(path.join(bookRoot, '草稿区/剧本/短剧/集002.md'), 'utf8'))
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 1, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'invalid-argument', reason: expect.stringContaining('集号不一致') })

    // 链接防绕过：剧本/短剧 若指向仓外目录直接拒绝
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'shortdrama-outside-'))
    roots.push(outside)
    fs.mkdirSync(path.join(bookRoot, '剧本'), { recursive: true })
    fs.symlinkSync(outside, path.join(bookRoot, '剧本/短剧'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(await call('novel_shortdrama_settle_episode', { bookId, 集: 2, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'runtime-link' })

    expect(askCalls).toBe(0)
  })

  it('非短剧作品拒绝调用短剧定稿', async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-non-sd-'))
    roots.push(ws)
    const created = createBook({
      workspaceRoot: ws,
      书名: '纯小说',
      concept: { ...SHORTDRAMA_CONCEPT, 输出形态: '小说' },
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const tools = createNovelTools({
      workspaceRoot: () => ws,
      bookRootOfBookId: id => id === created.bookId ? created.bookRoot : undefined,
      nativeWrite: nativeWriteStub,
      askFn: approveFn,
    })
    const settle = tools.find(t => t.name === 'novel_shortdrama_settle_episode')!
    expect(await settle.execute({ bookId: created.bookId, 集: 1, summary: 'x' }))
      .toMatchObject({ ok: false, code: 'invalid-argument' })
  })
})
