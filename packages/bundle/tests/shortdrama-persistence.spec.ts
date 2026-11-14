import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { contractTemplate, paths, writeFileAtomic } from '@webnovel/core'
import { exampleVerticalScripts } from '../../core/src/shortdrama/examples'
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
