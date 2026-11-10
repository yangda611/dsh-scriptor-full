import { describe, expect, it } from 'vitest'
import { validateSegment, assertSegment, paths, pad, chapterNo, episodeNo, sceneNo, LAYOUT } from '../src/repo/paths'

describe('路径白名单(机制 B2)', () => {
  it('合法中文名通过', () => {
    expect(validateSegment('初见')).toEqual([])
    expect(validateSegment('第一卷-风起')).toEqual([])
  })
  it('非法字符拒绝', () => {
    expect(validateSegment('a/b').length).toBeGreaterThan(0)
    expect(validateSegment('a\\b').length).toBeGreaterThan(0)
    expect(validateSegment('a:b').length).toBeGreaterThan(0)
    expect(validateSegment('a<b').length).toBeGreaterThan(0)
  })
  it('保留名与边界拒绝', () => {
    expect(validateSegment('CON').length).toBeGreaterThan(0)
    expect(validateSegment('..').length).toBeGreaterThan(0)
    expect(validateSegment('名字 ').length).toBeGreaterThan(0) // 尾空格(Windows)
    expect(validateSegment('名字.').length).toBeGreaterThan(0) // 尾点
    expect(validateSegment('').length).toBeGreaterThan(0)
  })
  it('assertSegment 抛错带字段名', () => {
    expect(() => assertSegment('a/b', '章名')).toThrow(/路径字段「章名」不合法/)
  })
})

describe('路径构造(格式规格 §2)', () => {
  it('卷号两位、章号四位', () => {
    expect(pad(1)).toBe('01')
    expect(chapterNo(12)).toBe('0012')
    expect(paths.定稿章(2, 13, '风起')).toBe('定稿/卷02/0013-风起.md')
    expect(paths.确认细纲(1, 3, '初见')).toBe('大纲/卷规划/卷01/章细纲/0003-初见.md')
    expect(paths.账本('时间线')).toBe('账本/时间线.md')
    expect(paths.记忆('文风')).toBe('本书记忆/文风.md')
    expect(paths.审核记录(1, '初见')).toBe('草稿区/审核/卷01-初见.json')
  })
})

describe('剧本路径（影视剧扩展 muse-dev，格式规格 §影视剧扩展）', () => {
  it('集号三位、场号两位', () => {
    expect(episodeNo(1)).toBe('001')
    expect(episodeNo(100)).toBe('100')
    expect(sceneNo(1)).toBe('01')
    expect(sceneNo(12)).toBe('12')
  })
  it('剧本定稿目录与定稿平行，不复用定稿目录', () => {
    expect(LAYOUT.剧本).toBe('剧本')
    expect(LAYOUT.电影剧本目录).toBe('剧本/电影')
    expect(LAYOUT.短剧目录).toBe('剧本/短剧')
    expect(paths.电影剧本()).toBe('剧本/电影/剧本.md')
    expect(paths.短剧集(1)).toBe('剧本/短剧/集001.md')
    expect(paths.短剧集(88)).toBe('剧本/短剧/集088.md')
  })
  it('电影剧本中间稿在草稿区/剧本/，可丢弃可重建', () => {
    expect(paths.剧本故事稿()).toBe('草稿区/剧本/故事稿.md')
    expect(paths.剧本分场大纲()).toBe('草稿区/剧本/分场大纲.md')
    expect(paths.剧本草稿()).toBe('草稿区/剧本/剧本草稿.md')
  })
})
