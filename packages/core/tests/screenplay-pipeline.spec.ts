import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { checkScreenplayGate, runScreenplayPipeline, screenplayFinalPath } from '../src/screenplay/pipeline'
import { VALID_STORY } from './screenplay-fixtures'
import { VALID_OUTLINE } from './screenplay-fixtures'
import { renderScreenplay } from '../src/screenplay/format'
import { VALID_DRAFT } from './screenplay-fixtures'

/** 端到端示例：docs/examples/电影剧本示例/《晚星》（短片，8 场，三幕结构）。 */
const EXAMPLE_DIR = path.resolve(__dirname, '../../../docs/examples/电影剧本示例')
function readExample(name: string): string {
  return fs.readFileSync(path.join(EXAMPLE_DIR, name), 'utf-8')
}

describe('阶段 2：端到端——示例电影剧本走完改编全流程', () => {
  it('《晚星》从故事稿走完四步：门禁通过、三步解析通过、审读零发现项、定稿路径正确', () => {
    const result = runScreenplayPipeline({
      市场: '中文',
      输出形态: '电影剧本',
      题材档: '中文女频',
      片长: '短片',
      故事稿: readExample('故事稿.md'),
      分场大纲: readExample('分场大纲.md'),
      剧本草稿: readExample('剧本.md'),
    })
    expect(result.ok).toBe(true)
    expect(result.门禁.通过).toBe(true)
    expect(result.门禁.可用题材档).toEqual(['中文男频', '中文女频'])
    expect(result.故事稿问题).toEqual([])
    expect(result.故事稿警告).toEqual([])
    expect(result.分场大纲问题).toEqual([])
    expect(result.分场大纲警告).toEqual([])
    expect(result.剧本解析问题).toEqual([])
    expect(result.审读?.findings).toEqual([])
    expect(result.审读?.是否阻断).toBe(false)
    expect(result.定稿路径).toBe('剧本/电影/剧本.md')
    expect(screenplayFinalPath()).toBe('剧本/电影/剧本.md')
  })

  it('示例剧本符合专业剧本格式：场景标题/动作/台词/括号提示齐全', () => {
    const text = readExample('剧本.md')
    expect(text).toContain('FADE IN:')
    expect(text).toContain('FADE OUT.')
    expect(text).toContain('场01 INT. 面馆 - 深夜')
    expect(text).toContain('场05 EXT. 天台 - 夜')
    expect(text).toContain('(pause)')
    expect(text).not.toContain('(beat)')
    expect(text).not.toContain('SFX:')
    expect(text).not.toContain('MUSIC:')
  })

  it('门禁：输出形态不是电影剧本就不走本管线', () => {
    expect(checkScreenplayGate('中文', '小说').通过).toBe(false)
    expect(checkScreenplayGate('中文', '短剧').通过).toBe(false)
    expect(checkScreenplayGate('中文', '小说').原因[0]).toContain('不是「电影剧本」')
  })

  it('门禁：题材档须属于契约市场（中文市场不能选海外档）', () => {
    expect(checkScreenplayGate('中文', '电影剧本', '海外女性向').通过).toBe(false)
    expect(checkScreenplayGate('海外', '电影剧本', '海外女性向').通过).toBe(true)
    expect(checkScreenplayGate('海外', '电影剧本').可用题材档).toEqual(['海外女性向', '海外男性向', '东南亚通用起步'])
    expect(checkScreenplayGate('欧美', '电影剧本').通过).toBe(false)
  })

  it('夹具小稿也能走完管线（故事稿→大纲→草稿→审读）', () => {
    const result = runScreenplayPipeline({
      市场: '中文',
      输出形态: '电影剧本',
      片长: '短片',
      故事稿: VALID_STORY,
      分场大纲: VALID_OUTLINE,
      剧本草稿: renderScreenplay(VALID_DRAFT),
    })
    expect(result.ok).toBe(true)
    expect(result.审读?.findings).toEqual([])
  })
})
