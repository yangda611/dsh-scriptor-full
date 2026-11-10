import { describe, expect, it } from 'vitest'
import { draftFromOutline, estimatePages, parseScreenplay, renderScreenplay, renderSlugline, validateScreenplay, PAUSE_MARKER } from '../src/screenplay/format'
import { parseSceneOutline } from '../src/screenplay/outline'
import type { ScreenplayDraft } from '../src/screenplay/types'
import { VALID_DRAFT, VALID_OUTLINE } from './screenplay-fixtures'

describe('阶段 2：剧本草稿格式', () => {
  it('场景标题三段式全大写、场号两位', () => {
    expect(renderSlugline(VALID_DRAFT.场[0]!)).toBe('场01 INT. 面馆 - 深夜')
    expect(renderSlugline(VALID_DRAFT.场[2]!)).toBe('场03 EXT. 天台 - 夜')
  })

  it('渲染—解析往返一致：场景标题/动作/台词/括号提示齐全', () => {
    const text = renderScreenplay(VALID_DRAFT)
    expect(text).toContain('FADE IN:')
    expect(text).toContain('FADE OUT.')
    expect(text).toContain('(pause)')
    const r = parseScreenplay(text)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
    expect(r.draft).toEqual(VALID_DRAFT)
  })

  it('有效草稿格式校验零发现项', () => {
    expect(validateScreenplay(VALID_DRAFT)).toEqual([])
  })

  it('停顿定死 (pause)：(beat) 报高级别，(pause) 通过', () => {
    expect(PAUSE_MARKER).toBe('(pause)')
    const beat: ScreenplayDraft = {
      标题: '测试',
      场: [{ 场号: 1, 标题: { 内外: 'INT', 地点: '面馆', 时间: '夜' }, 动作: ['林晚星擦桌子。'], 台词段: [{ 角色: '林晚星', 括号提示: '(beat)', 台词: ['你先别说话。'] }] }],
    }
    const findings = validateScreenplay(beat)
    expect(findings.some((f) => f.严重程度 === '高' && f.问题说明.includes('(beat)'))).toBe(true)
    const pause: ScreenplayDraft = {
      标题: '测试',
      场: [{ 场号: 1, 标题: { 内外: 'INT', 地点: '面馆', 时间: '夜' }, 动作: ['林晚星擦桌子。'], 台词段: [{ 角色: '林晚星', 括号提示: '(pause)', 台词: ['你先别说话。'] }] }],
    }
    expect(validateScreenplay(pause)).toEqual([])
  })

  it('SFX:/MUSIC: 独占行禁用（广播剧格式，不进电影剧本）', () => {
    const bad: ScreenplayDraft = {
      标题: '测试',
      场: [{ 场号: 1, 标题: { 内外: 'INT', 地点: '面馆', 时间: '夜' }, 动作: ['SFX: 警笛声', '林晚星擦桌子。'], 台词段: [{ 角色: '林晚星', 台词: ['听见了吗？'] }] }],
    }
    expect(validateScreenplay(bad).some((f) => f.严重程度 === '高' && f.问题说明.includes('SFX:'))).toBe(true)
  })

  it('角色名须全大写：小写拉丁字母名报高级别；动作行内心想法报中级别', () => {
    const bad: ScreenplayDraft = {
      标题: '测试',
      场: [{
        场号: 1,
        标题: { 内外: 'INT', 地点: '面馆', 时间: '夜' },
        动作: ['Selene 心想今晚一定要问清楚。'],
        台词段: [{ 角色: 'Selene', 台词: ['你到底是谁？'] }],
      }],
    }
    const findings = validateScreenplay(bad)
    expect(findings.some((f) => f.问题说明.includes('Selene') && f.问题说明.includes('全大写'))).toBe(true)
    expect(findings.some((f) => f.问题说明.includes('内心想法'))).toBe(true)
  })

  it('镜头提示只报低级别警告，不判错', () => {
    const shot: ScreenplayDraft = {
      标题: '测试',
      场: [{ 场号: 1, 标题: { 内外: 'INT', 地点: '面馆', 时间: '夜' }, 动作: ['特写：林晚星的手在发抖。'], 台词段: [{ 角色: '林晚星', 台词: ['别碰那张照片。'] }] }],
    }
    const findings = validateScreenplay(shot)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.严重程度).toBe('低')
  })

  it('无场景标题的文本解析失败', () => {
    expect(parseScreenplay('# 测试\n\n林晚星擦桌子。\n').ok).toBe(false)
  })

  it('分场大纲 → 剧本草稿骨架：每场有场景标题，动作/台词是待写占位', () => {
    const r = parseSceneOutline(VALID_OUTLINE)
    expect(r.ok).toBe(true)
    if (!r.ok || r.outline === undefined) return
    const draft = draftFromOutline(r.outline)
    expect(draft.场).toHaveLength(4)
    expect(renderSlugline(draft.场[0]!)).toBe('场01 INT. 面馆 - 深夜')
    expect(renderSlugline(draft.场[2]!)).toBe('场03 EXT. 天台 - 夜')
    // 骨架不是成品：校验必报高级别待写项
    const findings = validateScreenplay(draft)
    expect(findings.some((f) => f.严重程度 === '高' && f.问题说明.includes('待写'))).toBe(true)
  })

  it('页数粗估：小草稿至少 1 页', () => {
    expect(estimatePages(VALID_DRAFT)).toBeGreaterThanOrEqual(1)
  })
})
