import { afterAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { removeSync } from '../../core/src/repo/remove'
import { createNovelTools } from '../src/novel-tools'
import { parseDocument } from '@webnovel/core'
import { MARKET_VALUES as CORE_MARKET_VALUES, OUTPUT_FORM_VALUES as CORE_OUTPUT_FORM_VALUES } from '../../core/src/repo/document-fields'
import { createStudyHandler, type StudyWebRuntime } from '../src/study/web'
import { ONBOARDING_DRAFT_RELATIVE, MARKET_VALUES, OUTPUT_FORM_VALUES } from '../src/study/onboarding'
import { nativeWriteStub } from './fixtures/native-write-stub'

const roots: string[] = []
function mkRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webnovel-gate-'))
  roots.push(dir)
  return dir
}
afterAll(() => { for (const r of roots) { try { removeSync(r) } catch { /* ignore */ } } })

const CONCEPT = {
  状态: '已确认',
  核心创意: 'x', 题材与目标读者: 'x', 主角核心欲望: 'x', 主要冲突: 'x',
  核心看点: 'x', 差异化方向: 'x', 明确不要什么: 'x',
} as const

function toolsFor(ws: string) {
  return createNovelTools({ nativeWrite: nativeWriteStub, workspaceRoot: () => ws, bookRootOfBookId: (id) => path.join(ws, id) })
}

function contractFields(ws: string, bookName: string): Record<string, unknown> {
  const text = fs.readFileSync(path.join(ws, bookName, '作品契约/契约.md'), 'utf-8')
  const parsed = parseDocument(text)
  expect(parsed.ok).toBe(true)
  if (!parsed.ok) throw new Error('contract unreadable')
  return parsed.data.fields as Record<string, unknown>
}

describe('建书硬性流程关卡（8.4.4）', () => {
  it('向导的取值表与核心取值表一致（客户端安全模块自含定义，防漂移）', () => {
    expect([...MARKET_VALUES]).toEqual([...CORE_MARKET_VALUES])
    expect([...OUTPUT_FORM_VALUES]).toEqual([...CORE_OUTPUT_FORM_VALUES])
  })

  it('缺市场/形态/字数时拒绝建书，并告诉模型先问作者', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '关卡书', concept: { ...CONCEPT } }) as any
    expect(res.ok).toBe(false)
    expect(res.code).toBe('invalid-argument')
    expect(res.reason).toContain('市场')
    expect(res.reason).toContain('输出形态')
    expect(res.reason).toContain('目标总字数')
    expect(res.next).toContain('先问作者')
    expect(fs.existsSync(path.join(ws, '关卡书'))).toBe(false)
  })

  it('只缺目标总字数时同样阻塞', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '缺字数书', 市场: '中文', 输出形态: '小说', concept: { ...CONCEPT } }) as any
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('目标总字数')
    expect(fs.existsSync(path.join(ws, '缺字数书'))).toBe(false)
  })

  it('只缺市场时阻塞并点名缺项', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '缺市场书', 输出形态: '小说', 目标总字数: 1000000, concept: { ...CONCEPT } }) as any
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('市场')
    expect(res.reason).not.toContain('目标总字数')
  })

  it('三项齐全时放行，值写进作品契约 frontmatter', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '放行书', 市场: '海外', 输出形态: '短剧', 目标总字数: 300000, concept: { ...CONCEPT } }) as any
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const fields = contractFields(ws, '放行书')
    expect(fields['市场']).toBe('海外')
    expect(fields['输出形态']).toBe('短剧')
    expect(fields['目标总字数']).toBe(300000)
  })

  it('三项放在 concept 里同样放行', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '概念书', concept: { ...CONCEPT, 市场: '中文', 输出形态: '小说', 目标总字数: 50000 } }) as any
    expect(res.ok, JSON.stringify(res)).toBe(true)
    expect(contractFields(ws, '概念书')['目标总字数']).toBe(50000)
  })

  it('目标总字数非法时拒绝（0、负数、非数字）', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    for (const bad of [0, -5, 'abc']) {
      const res = await create.execute({ bookName: '非法书', 市场: '中文', 输出形态: '小说', 目标总字数: bad, concept: { ...CONCEPT } }) as any
      expect(res.ok).toBe(false)
      expect(res.reason).toContain('目标总字数')
    }
    expect(fs.existsSync(path.join(ws, '非法书'))).toBe(false)
  })

  it('书房面板向导保存的草稿可作后备，建书成功后消费掉', async () => {
    const ws = mkRoot()
    const draftPath = path.join(ws, ...ONBOARDING_DRAFT_RELATIVE.split('/'))
    fs.mkdirSync(path.dirname(draftPath), { recursive: true })
    fs.writeFileSync(draftPath, JSON.stringify({ 市场: '海外', 输出形态: '电影剧本', 目标总字数: 2000000 }), 'utf-8')
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '草稿书', concept: { ...CONCEPT } }) as any
    expect(res.ok, JSON.stringify(res)).toBe(true)
    const fields = contractFields(ws, '草稿书')
    expect(fields['市场']).toBe('海外')
    expect(fields['输出形态']).toBe('电影剧本')
    expect(fields['目标总字数']).toBe(2000000)
    // 建书成功消费草稿：下一本不会悄悄沿用旧选择。
    expect(fs.existsSync(draftPath)).toBe(false)
  })

  it('草稿只有部分项时，参数补齐剩余项也能建书', async () => {
    const ws = mkRoot()
    const draftPath = path.join(ws, ...ONBOARDING_DRAFT_RELATIVE.split('/'))
    fs.mkdirSync(path.dirname(draftPath), { recursive: true })
    fs.writeFileSync(draftPath, JSON.stringify({ 市场: '中文' }), 'utf-8')
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '拼读书', 输出形态: '小说', 目标总字数: 1000000, concept: { ...CONCEPT } }) as any
    expect(res.ok, JSON.stringify(res)).toBe(true)
    expect(contractFields(ws, '拼读书')['市场']).toBe('中文')
  })

  it('损坏的草稿文件不挡建书（当作没有）', async () => {
    const ws = mkRoot()
    const draftPath = path.join(ws, ...ONBOARDING_DRAFT_RELATIVE.split('/'))
    fs.mkdirSync(path.dirname(draftPath), { recursive: true })
    fs.writeFileSync(draftPath, '{not json', 'utf-8')
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const res = await create.execute({ bookName: '坏草稿书', 市场: '中文', 输出形态: '小说', 目标总字数: 1000000, concept: { ...CONCEPT } }) as any
    expect(res.ok, JSON.stringify(res)).toBe(true)
  })
})

describe('rc.2 下建书 → 书房 → 书架整条链路', () => {
  const post = async (handler: ReturnType<typeof createStudyHandler>, method: string, sessionId: string, extra: object = {}) => {
    const response = await handler(new Request('http://127.0.0.1/api/webnovel/study/' + method, { method: 'POST', headers: { 'x-webnovel-request': '1', 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, ...extra }) }))
    return { status: response.status, value: await response.json() as any }
  }

  it('rc.2（只有 list，没有 roots）：建书后书出现在书架上，契约字数可读', async () => {
    const ws = mkRoot()
    const tools = toolsFor(ws)
    const create = tools.find(t => t.name === 'novel_create_book')!
    const created = await create.execute({ bookName: '链路书', 市场: '中文', 输出形态: '小说', 目标总字数: 1000000, concept: { ...CONCEPT } }) as any
    expect(created.ok, JSON.stringify(created)).toBe(true)
    // rc.2 的 agents 注册表：没有 roots()，只有 list()。
    const agent = { id: 'main', session: { header: { cwd: ws } }, followup: () => {} }
    const runtime: StudyWebRuntime = { agents: { get: id => id === 'main' ? agent : undefined, list: () => [agent] } }
    const handler = createStudyHandler(runtime)
    const shelf = await post(handler, 'shelf', 'main')
    expect(shelf.status).toBe(200)
    expect(shelf.value.ok).toBe(true)
    expect(shelf.value.value.books.map((b: any) => b.name)).toContain('链路书')
    const read = await post(handler, 'read', 'main', { ref: { space: 'book:' + created.bookId, path: '作品契约/契约.md' } })
    expect(read.status).toBe(200)
    // read 返回的 body 是去掉 frontmatter 的正文；目标总字数在 frontmatter 里，经 prefix 返回。
    expect(read.value.value.body).toContain('作品契约')
    expect(read.value.value.prefix).toContain('目标总字数: 1000000')
  })

  it('rc.2（roots 是数组属性）：主会话放行，子智能体仍被拒绝', async () => {
    const ws = mkRoot()
    const main = { id: 'main', session: { header: { cwd: ws } }, followup: () => {} }
    const sub = { id: 'sub', session: { header: { cwd: ws, origin: 'subagent' } }, followup: () => {} }
    // roots 不是函数而是数组属性（另一种可能的 rc.2 形态）。
    const runtime: StudyWebRuntime = { agents: { get: id => id === 'main' ? main : id === 'sub' ? sub : undefined, roots: [main] } }
    const handler = createStudyHandler(runtime)
    expect((await post(handler, 'shelf', 'main')).status).toBe(200)
    const denied = await post(handler, 'shelf', 'sub')
    expect(denied.status).toBe(400)
    expect(denied.value).toMatchObject({ code: 'read-only' })
  })

  it('rc.2（roots 完全缺失）：按 origin 回退，主会话放行', async () => {
    const ws = mkRoot()
    const main = { id: 'main', session: { header: { cwd: ws } }, followup: () => {} }
    const sub = { id: 'sub', session: { header: { cwd: ws, origin: 'subagent' } }, followup: () => {} }
    const runtime: StudyWebRuntime = { agents: { get: id => id === 'main' ? main : id === 'sub' ? sub : undefined } }
    const handler = createStudyHandler(runtime)
    expect((await post(handler, 'shelf', 'main')).status).toBe(200)
    const denied = await post(handler, 'shelf', 'sub')
    expect(denied.status).toBe(400)
    expect(denied.value).toMatchObject({ code: 'read-only' })
  })
})
