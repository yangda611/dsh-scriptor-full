import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'
import { Config, resolveSettings } from '../../embedding-provider/src/config'
import { applyRetrieval } from '../src/client/index'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')
const RETRIEVAL_IDS = ['webnovel-embeddings', 'webnovel-scenes', 'webnovel-reranking', 'webnovel-graph'] as const
const MAIN_NAME = '@yangda611/dsh-scriptor'
const RETRIEVAL_NAME = '@yangda611/dsh-scriptor-retrieval'

interface PatchEntry { id: string; name: string }

function patchEntries(relative: string): PatchEntry[] {
  const patch = parseYaml(read(relative)) as [{ insert: PatchEntry[] }]
  return patch[0].insert
}

describe('检索增强并入主包', () => {
  it('主包单装注册写作与检索五项模块，入口指向主包子路径', () => {
    const entries = patchEntries('../cordis.patch.yml')
    expect(entries.map(entry => entry.id)).toEqual([
      'webnovel',
      'webnovel-embeddings',
      'webnovel-scenes',
      'webnovel-reranking',
      'webnovel-graph',
    ])
    expect(entries[0].name).toBe(MAIN_NAME)
    expect(entries[1].name).toBe(`${MAIN_NAME}/retrieval`)
    expect(entries[2].name).toBe(`${MAIN_NAME}/scenes`)
    expect(entries[3].name).toBe(`${MAIN_NAME}/reranking`)
    expect(entries[4].name).toBe(`${MAIN_NAME}/graph`)
  })

  it('主包清单导出并打包四项检索入口', () => {
    const manifest = JSON.parse(read('../package.json'))
    for (const [subpath, file] of [['retrieval', 'retrieval'], ['scenes', 'scenes'], ['reranking', 'reranking'], ['graph', 'graph']] as const) {
      expect(manifest.exports[`./${subpath}`]).toBe(`./lib/${file}.js`)
      expect(manifest.files).toContain(`lib/${file}.js`)
    }
  })

  it('主包与独立检索包注册同一组检索模块 id，两者同装会重复入口', () => {
    const mainIds = patchEntries('../cordis.patch.yml').map(entry => entry.id)
    const retrievalIds = patchEntries('../../embedding-provider/cordis.patch.yml').map(entry => entry.id)
    expect(retrievalIds).toEqual([...RETRIEVAL_IDS])
    expect(mainIds.filter(id => retrievalIds.includes(id)).sort()).toEqual([...RETRIEVAL_IDS].sort())
  })

  it('完整版是主包的薄别名：模块 id 与主包一致，且只依赖主包', () => {
    const entries = patchEntries('../../meta/cordis.patch.yml')
    expect(entries.map(entry => entry.id)).toEqual(patchEntries('../cordis.patch.yml').map(entry => entry.id))
    expect(entries[1].name).toBe(`${MAIN_NAME}/retrieval`)
    const metaManifest = JSON.parse(read('../../meta/package.json'))
    expect(Object.keys(metaManifest.dependencies)).toEqual([MAIN_NAME])
    expect(metaManifest.dependencies[MAIN_NAME]).toBe('workspace:*')
    expect(metaManifest.dependencies[RETRIEVAL_NAME]).toBeUndefined()
  })

  it('嵌入提供方默认停用：未配置不解析出任何设置，不产生调用', () => {
    // schemastery 的 schema 是可调用函数：调用即校验并补齐默认值。
    const parsed = Config({ baseURL: 'https://api.example.com/v1', model: 'bge-m3', dimensions: 1024 })
    expect(parsed.enabled).toBe(false)
    expect(resolveSettings({})).toBeUndefined()
    expect(resolveSettings({ enabled: false, baseURL: 'https://api.example.com/v1', model: 'bge-m3', dimensions: 1024 })).toBeUndefined()
  })

  it('主包客户端接线检索设置页：单装主包即可在插件管理页看到四项检索配置', () => {
    const rowConfigs = new Map<string, (props: { view: string }) => unknown>()
    const footers = new Map<string, unknown>()
    const scopes = Object.fromEntries(RETRIEVAL_IDS.map(id => [id, { getSnapshot: () => ({}), subscribe: () => () => {} }]))
    const host = {
      configForms: { get: (ns: string) => scopes[ns] },
      effect: () => () => {},
      get: () => undefined,
      slots: {
        inject(_name: string, fn: () => unknown) { fn(); return () => {} },
        register(reg: { name: string; key?: string; id?: string }, component: unknown) {
          if (reg.name === 'plugins.row.config' && reg.key) rowConfigs.set(reg.key, component as (props: { view: string }) => unknown)
          if (reg.name === 'settings.models.footer' && reg.id) footers.set(reg.id, component)
          return () => {}
        },
      },
    }
    applyRetrieval(host as never)
    for (const id of RETRIEVAL_IDS) {
      expect(rowConfigs.has(`${MAIN_NAME}#${id}`)).toBe(true)
    }
    expect(rowConfigs.get(`${MAIN_NAME}#webnovel-embeddings`)!({ view: 'summary' })).toBe('配置混合检索使用的接口、向量模型和维度。')
    expect(footers.has('webnovel-embeddings')).toBe(true)
  })

  it('主包 apply 调用检索客户端接线（源码级接线检查）', () => {
    const source = read('../src/client/index.tsx')
    expect(source).toContain('applyRetrievalClient')
    expect(source).toMatch(/function apply\(host[^)]*\)[^{]*\{[^}]*applyRetrieval\(host\)/s)
  })
})
