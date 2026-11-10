import { describe, expect, it } from 'vitest'
import { emptySceneOutline, parseSceneOutline, parseSceneField, renderSceneOutline, validateSceneOutline } from '../src/screenplay/outline'
import { VALID_OUTLINE } from './screenplay-fixtures'

describe('阶段 2：分场大纲解析与校验', () => {
  it('有效大纲解析通过：三幕、四场、四项齐全', () => {
    const r = parseSceneOutline(VALID_OUTLINE)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
    expect(r.outline?.场).toHaveLength(4)
    expect(r.outline?.场.map((s) => s.幕)).toEqual([1, 2, 2, 3])
    expect(r.outline?.场[0]?.场景).toBe('面馆 深夜 内')
  })

  it('缺一幕、场号不连续、缺项都报问题', () => {
    expect(parseSceneOutline(VALID_OUTLINE.replace('## 第三幕\n\n### 场04', '## 第三幕\n\n### 场05')).ok).toBe(false)
    expect(parseSceneOutline(VALID_OUTLINE.replace('## 第三幕', '## 尾声')).problems.some((p) => p.includes('第三幕') || p.includes('未知幕'))).toBe(true)
    expect(parseSceneOutline(VALID_OUTLINE.replace('- 转折：她把证据交给警方，面馆重新开张。', '- 转折：')).problems.some((p) => p.includes('场04') && p.includes('转折'))).toBe(true)
  })

  it('解析—渲染往返一致', () => {
    const r = parseSceneOutline(VALID_OUTLINE)
    expect(r.ok).toBe(true)
    if (!r.ok || r.outline === undefined) return
    const r2 = parseSceneOutline(renderSceneOutline(r.outline))
    expect(r2.ok).toBe(true)
    expect(r2.outline).toEqual(r.outline)
    expect(validateSceneOutline(r.outline).errors).toEqual([])
  })

  it('空模板三幕各一场占位，解析报缺项', () => {
    const r = parseSceneOutline(emptySceneOutline('测试'))
    expect(r.ok).toBe(false)
    expect(r.problems.some((p) => p.includes('缺「冲突」') || p.includes('缺「转折」'))).toBe(true)
  })

  it('场景自由文本拆三段：内/外、时间、地点', () => {
    expect(parseSceneField('面馆 深夜 内')).toEqual({ 内外: 'INT', 地点: '面馆', 时间: '深夜' })
    expect(parseSceneField('街道 黄昏 外')).toEqual({ 内外: 'EXT', 地点: '街道', 时间: '黄昏' })
    expect(parseSceneField('会议室 日')).toEqual({ 内外: undefined, 地点: '会议室', 时间: '日' })
    expect(parseSceneField('天台 夜 外')).toEqual({ 内外: 'EXT', 地点: '天台', 时间: '夜' })
  })
})
