import { afterAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createBook } from '../src/book/create'
import { emptyContractBody, resolveContractFields } from '../src/book/scaffold'
import { prepareContract, readExistingContract } from '../src/design/contract'
import {
  GENRE_LIBRARY,
  GENRE_TIERS,
  createGenreLibrary,
  getGenreTier,
  tiersForMarket,
  validateGenreLibrary,
  withNaming,
} from '../src/design/genres'
import {
  checkConceptCompleteness,
  marketOf,
  outputFormOf,
  parseConcept,
  serializeConcept,
  type Concept,
} from '../src/inspire/concept'
import { parseDocument } from '../src/repo/frontmatter'
import { paths } from '../src/repo/paths'

const roots: string[] = []
function mkRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webnovel-stage1-'))
  roots.push(dir)
  return dir
}
afterAll(() => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch { /* ignore */ } } })

function confirmed(over: Partial<Concept> = {}): Concept {
  return {
    状态: '已确认',
    核心创意: '被系统选中的普通人',
    题材与目标读者: '都市异能向网文读者',
    ...over,
  }
}

describe('阶段 1：Concept 市场 / 输出形态字段', () => {
  it('不填默认 中文 / 小说，显式值原样读出', () => {
    expect(marketOf(confirmed())).toBe('中文')
    expect(outputFormOf(confirmed())).toBe('小说')
    expect(marketOf(confirmed({ 市场: '海外' }))).toBe('海外')
    expect(outputFormOf(confirmed({ 输出形态: '短剧' }))).toBe('短剧')
    expect(outputFormOf(confirmed({ 输出形态: '电影剧本' }))).toBe('电影剧本')
    expect(marketOf(null)).toBe('中文')
    expect(outputFormOf(undefined)).toBe('小说')
  })

  it('非法值按默认值处理，不报错', () => {
    const bad = confirmed({ 市场: '欧美' as never, 输出形态: '电视剧' as never })
    expect(marketOf(bad)).toBe('中文')
    expect(outputFormOf(bad)).toBe('小说')
  })

  it('checkConceptCompleteness 不把两字段当必填', () => {
    expect(checkConceptCompleteness(confirmed())).toEqual({ ok: true })
    expect(checkConceptCompleteness(confirmed({ 市场: '海外', 输出形态: '短剧' }))).toEqual({ ok: true })
  })

  it('序列化往返保留两字段，旧文本（无字段）解析后按默认值处理', () => {
    const parsed = parseConcept(serializeConcept(confirmed({ 市场: '海外', 输出形态: '短剧' })))
    expect(parsed?.市场).toBe('海外')
    expect(parsed?.输出形态).toBe('短剧')
    const legacy = serializeConcept(confirmed())
      .replace(/^市场: 中文\n/m, '')
      .replace(/^输出形态: 小说\n/m, '')
    const legacyParsed = parseConcept(legacy)
    expect(legacyParsed?.市场).toBeUndefined()
    expect(marketOf(legacyParsed ?? null)).toBe('中文')
    expect(outputFormOf(legacyParsed ?? null)).toBe('小说')
  })
})

describe('阶段 1：建书写入契约 frontmatter 与构想快照', () => {
  it('海外短剧项目：契约与快照都写 海外 / 短剧', () => {
    const ws = mkRoot()
    const r = createBook({ workspaceRoot: ws, 书名: '海外短剧', concept: confirmed({ 市场: '海外', 输出形态: '短剧' }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const contract = parseDocument(fs.readFileSync(path.join(r.bookRoot, paths.契约()), 'utf-8'))
    expect(contract.ok).toBe(true)
    if (!contract.ok) return
    expect(contract.data.fields['市场']).toBe('海外')
    expect(contract.data.fields['输出形态']).toBe('短剧')
    const snap = parseDocument(fs.readFileSync(path.join(r.bookRoot, paths.构想快照()), 'utf-8'))
    expect(snap.ok).toBe(true)
    if (!snap.ok) return
    expect(snap.data.fields['市场']).toBe('海外')
    expect(snap.data.fields['输出形态']).toBe('短剧')
  })

  it('中文电影剧本项目：契约写 中文 / 电影剧本', () => {
    const ws = mkRoot()
    const r = createBook({ workspaceRoot: ws, 书名: '中文电影', concept: confirmed({ 市场: '中文', 输出形态: '电影剧本' }) })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const contract = parseDocument(fs.readFileSync(path.join(r.bookRoot, paths.契约()), 'utf-8'))
    expect(contract.ok).toBe(true)
    if (!contract.ok) return
    expect(contract.data.fields['市场']).toBe('中文')
    expect(contract.data.fields['输出形态']).toBe('电影剧本')
  })

  it('不填两字段的旧流程：契约写默认值 中文 / 小说，行为不变', () => {
    const ws = mkRoot()
    const r = createBook({ workspaceRoot: ws, 书名: '老派小说', concept: confirmed() })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const contract = parseDocument(fs.readFileSync(path.join(r.bookRoot, paths.契约()), 'utf-8'))
    expect(contract.ok).toBe(true)
    if (!contract.ok) return
    expect(contract.data.fields['市场']).toBe('中文')
    expect(contract.data.fields['输出形态']).toBe('小说')
  })

  it('非法取值拒绝建书', () => {
    const ws = mkRoot()
    const r = createBook({ workspaceRoot: ws, 书名: '坏取值', concept: confirmed({ 市场: '欧美' as never }) })
    expect(r.ok).toBe(false)
    const r2 = createBook({ workspaceRoot: ws, 书名: '坏形态', concept: confirmed({ 输出形态: '电视剧' as never }) })
    expect(r2.ok).toBe(false)
  })

  it('emptyContractBody 默认与显式值', () => {
    expect(resolveContractFields()).toEqual({ 市场: '中文', 输出形态: '小说' })
    expect(resolveContractFields({ 市场: '海外', 输出形态: '短剧' })).toEqual({ 市场: '海外', 输出形态: '短剧' })
    expect(() => resolveContractFields({ 市场: '欧美' as never })).toThrow('市场取值非法')
    const doc = parseDocument(emptyContractBody('b-x', { 市场: '海外', 输出形态: '电影剧本' }))
    expect(doc.ok).toBe(true)
    if (!doc.ok) return
    expect(doc.data.fields['市场']).toBe('海外')
    expect(doc.data.fields['输出形态']).toBe('电影剧本')
    expect(doc.data.fields['书id']).toBe('b-x')
  })
})

describe('阶段 1：prepareContract 保留市场 / 输出形态', () => {
  it('更新契约分部不抹掉两字段；非法 extraFields 拒绝写入', () => {
    const root = mkRoot()
    fs.mkdirSync(path.join(root, '作品契约'), { recursive: true })
    fs.writeFileSync(path.join(root, paths.契约()), emptyContractBody('b-y', { 市场: '海外', 输出形态: '短剧' }))
    const op = prepareContract(root, { '题材与读者定位': { state: '已确认', body: '海外狼人短剧' } })
    fs.writeFileSync(path.join(root, op.relPath), op.content)
    const after = readExistingContract(root)
    expect(after.fields['市场']).toBe('海外')
    expect(after.fields['输出形态']).toBe('短剧')
    expect(after.parts['题材与读者定位']?.body).toBe('海外狼人短剧')
    expect(() => prepareContract(root, {}, { 市场: '欧美' })).toThrow('市场取值非法')
    expect(() => prepareContract(root, {}, { 输出形态: '电视剧' })).toThrow('输出形态取值非法')
    // 旧书（契约无两字段）更新分部不报错、不自动补写
    const legacyRoot = mkRoot()
    fs.mkdirSync(path.join(legacyRoot, '作品契约'), { recursive: true })
    const legacyBody = emptyContractBody('b-z').replace(/^市场: 中文\n/m, '').replace(/^输出形态: 小说\n/m, '')
    fs.writeFileSync(path.join(legacyRoot, paths.契约()), legacyBody)
    const legacyOp = prepareContract(legacyRoot, { '题材与读者定位': { state: '暂定', body: '旧定位' } })
    const legacyFields = readExistingContract(legacyRoot).fields
    expect(legacyFields['市场']).toBeUndefined()
    expect(parseDocument(legacyOp.content).ok).toBe(true)
  })
})

describe('阶段 1：两套题材库', () => {
  it('五档齐全，按市场取档', () => {
    expect(GENRE_TIERS.map((t) => t.id)).toEqual(['中文男频', '中文女频', '海外女性向', '海外男性向', '东南亚通用起步'])
    expect(tiersForMarket(GENRE_LIBRARY, '中文').map((t) => t.id)).toEqual(['中文男频', '中文女频'])
    expect(tiersForMarket(GENRE_LIBRARY, '海外').map((t) => t.id)).toEqual(['海外女性向', '海外男性向', '东南亚通用起步'])
    expect(getGenreTier(GENRE_LIBRARY, '海外女性向')?.题材.some((e) => e.名称.includes('狼人'))).toBe(true)
    expect(getGenreTier(GENRE_LIBRARY, '中文男频')?.题材.some((e) => e.名称 === '赘婿逆袭')).toBe(true)
  })

  it('内置库校验通过：每档非空、每条有来源、取值合法', () => {
    expect(validateGenreLibrary(GENRE_LIBRARY)).toEqual([])
  })

  it('每条题材、每个命名、每条禁忌都有 http(s) 来源', () => {
    const isUrl = (s: string) => s.startsWith('http://') || s.startsWith('https://')
    for (const tier of GENRE_TIERS) {
      expect(tier.题材.length).toBeGreaterThan(0)
      expect(tier.禁忌.length).toBeGreaterThan(0)
      for (const e of tier.题材) {
        expect(e.名称.trim().length).toBeGreaterThan(0)
        expect(e.爽点.trim().length).toBeGreaterThan(0)
        expect(isUrl(e.来源)).toBe(true)
      }
      const naming = [...tier.命名.姓氏, ...tier.命名.英文名, ...tier.命名.地点, ...tier.命名.人名示例, ...tier.命名.称谓]
      expect(naming.length).toBeGreaterThan(0)
      for (const v of naming) expect(isUrl(v.来源)).toBe(true)
      for (const taboo of tier.禁忌) {
        expect(taboo.内容.trim().length).toBeGreaterThan(0)
        expect(isUrl(taboo.来源)).toBe(true)
      }
    }
  })

  it('命名词表可替换、可扩展，原库不动', () => {
    const replaced = createGenreLibrary({ naming: { '中文男频': { 姓氏: [{ 值: '新姓', 来源: 'https://example.com/' }] } } })
    expect(getGenreTier(replaced, '中文男频')?.命名.姓氏).toEqual([{ 值: '新姓', 来源: 'https://example.com/' }])
    expect(getGenreTier(GENRE_LIBRARY, '中文男频')?.命名.姓氏[0]?.值).toBe('顾')
    const extended = withNaming(GENRE_LIBRARY, '海外女性向', { 地点: [{ 值: '纽约', 来源: 'https://example.com/' }] })
    expect(getGenreTier(extended, '海外女性向')?.命名.地点).toEqual([{ 值: '纽约', 来源: 'https://example.com/' }])
    expect(getGenreTier(GENRE_LIBRARY, '海外女性向')?.命名.地点[0]?.值).toBe('洛杉矶')
    expect(validateGenreLibrary(replaced)).toEqual([])
  })

  it('校验器能发现空档与缺来源', () => {
    const broken = createGenreLibrary({ naming: { '中文男频': { 姓氏: [], 英文名: [], 地点: [], 人名示例: [], 称谓: [] } } })
    expect(validateGenreLibrary(broken).some((p) => p.includes('中文男频') && p.includes('命名词表为空'))).toBe(true)
  })
})
