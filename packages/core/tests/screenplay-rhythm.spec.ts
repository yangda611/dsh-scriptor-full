import { describe, expect, it } from 'vitest'
import { FILM_RHYTHM, checkRhythm, describeRhythm } from '../src/screenplay/rhythm'
import { parseSceneOutline } from '../src/screenplay/outline'
import { VALID_OUTLINE } from './screenplay-fixtures'
import { VALID_DRAFT } from './screenplay-fixtures'

describe('阶段 2：电影节奏模板', () => {
  it('长片 90–110 页，一页约一分钟是经验法则', () => {
    expect(FILM_RHYTHM.总页数).toEqual({ 下限: 90, 上限: 110 })
    expect(FILM_RHYTHM.页数说明).toContain('55 秒/页')
    expect(FILM_RHYTHM.页数说明).toContain('经验法则')
    expect(FILM_RHYTHM.幕).toHaveLength(3)
    expect(describeRhythm()).toContain('第一幕')
    expect(describeRhythm()).toContain('中点反转')
  })

  it('有效大纲 + 短片草稿：节奏检查零高级别发现项', () => {
    const r = parseSceneOutline(VALID_OUTLINE)
    expect(r.ok).toBe(true)
    if (!r.ok || r.outline === undefined) return
    const findings = checkRhythm(r.outline, VALID_DRAFT, '短片')
    expect(findings.filter((f) => f.严重程度 === '高')).toEqual([])
    expect(findings).toEqual([])
  })

  it('缺一幕报高级别；某幕无转折报高级别', () => {
    const r = parseSceneOutline(VALID_OUTLINE)
    expect(r.ok).toBe(true)
    if (!r.ok || r.outline === undefined) return
    const missingAct = { 标题: '测试', 场: r.outline.场.filter((s) => s.幕 !== 3) }
    expect(checkRhythm(missingAct, VALID_DRAFT, '短片').some((f) => f.严重程度 === '高' && f.问题说明.includes('第三幕'))).toBe(true)
    const noTwist = { 标题: '测试', 场: r.outline.场.map((s) => (s.幕 === 2 ? { ...s, 转折: '' } : s)) }
    expect(checkRhythm(noTwist, VALID_DRAFT, '短片').some((f) => f.严重程度 === '高' && f.问题说明.includes('第二幕'))).toBe(true)
  })

  it('长片页数只作低级别参考，不卡通过；短片跳过页数检查', () => {
    const r = parseSceneOutline(VALID_OUTLINE)
    expect(r.ok).toBe(true)
    if (!r.ok || r.outline === undefined) return
    const longFindings = checkRhythm(r.outline, VALID_DRAFT, '长片')
    const pageFinding = longFindings.find((f) => f.证据位置.includes('页'))
    expect(pageFinding?.严重程度).toBe('低')
    expect(pageFinding?.是否建议阻断).toBe(false)
    const shortFindings = checkRhythm(r.outline, VALID_DRAFT, '短片')
    expect(shortFindings.some((f) => f.证据位置.includes('页'))).toBe(false)
  })
})
