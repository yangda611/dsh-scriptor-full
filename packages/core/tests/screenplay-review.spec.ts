import { describe, expect, it } from 'vitest'
import { parseSceneOutline } from '../src/screenplay/outline'
import { parseScreenplay } from '../src/screenplay/format'
import { registerScreenplayChecks, runScreenplayReview, SCREENPLAY_REVIEW_MODULES, type ScreenplayCheckModule } from '../src/screenplay/review'
import { VALID_OUTLINE } from './screenplay-fixtures'
import { VALID_DRAFT } from './screenplay-fixtures'

describe('阶段 2：剧本审读（复用 review 注册表）', () => {
  it('三个剧本模块可注册进注册表（鸭子类型，不 import review 包）', () => {
    const registry = new Map<string, ScreenplayCheckModule>()
    registerScreenplayChecks((mod) => { registry.set(mod.名称, mod) })
    expect([...registry.keys()]).toEqual(['剧本对白审读', '剧本节奏审读', '剧本场次完整性审读'])
    expect(SCREENPLAY_REVIEW_MODULES.every((m) => m.执行形态 === '确定性代码')).toBe(true)
    expect(SCREENPLAY_REVIEW_MODULES.every((m) => m.适用范围 === '剧本')).toBe(true)
  })

  it('有效草稿 + 对应大纲：三模块零发现项，不阻断', () => {
    const outline = parseSceneOutline(VALID_OUTLINE)
    expect(outline.ok).toBe(true)
    if (!outline.ok || outline.outline === undefined) return
    const result = runScreenplayReview({ 剧本草稿: VALID_DRAFT, 分场大纲: outline.outline, 片长: '短片' })
    expect(result.findings).toEqual([])
    expect(result.是否阻断).toBe(false)
  })

  it('(beat) 进对白模块报高级别并阻断；缺场进完整性模块报高级别', () => {
    const outline = parseSceneOutline(VALID_OUTLINE)
    expect(outline.ok).toBe(true)
    if (!outline.ok || outline.outline === undefined) return
    const beatText = `# 晚星

FADE IN:

场01 INT. 面馆 - 深夜

林晚星擦着桌子。

林晚星
(beat)
你先别说话。

FADE OUT.
`
    const draft = parseScreenplay(beatText)
    expect(draft.ok).toBe(true)
    if (!draft.ok || draft.draft === undefined) return
    const result = runScreenplayReview({ 剧本草稿: draft.draft, 分场大纲: outline.outline, 片长: '短片' })
    expect(result.是否阻断).toBe(true)
    expect(result.按模块['剧本对白审读'].some((f) => f.问题说明.includes('(beat)'))).toBe(true)
    expect(result.按模块['剧本场次完整性审读'].some((f) => f.问题说明.includes('场02') && f.问题说明.includes('没有这一场'))).toBe(true)
    // 发现项编号按模块内顺序编号
    expect(result.按模块['剧本对白审读'][0]?.发现项编号).toContain('剧本对白审读')
  })

  it('无大纲时节奏审读报材料缺失（中级别），不伪装成通过', () => {
    const result = runScreenplayReview({ 剧本草稿: VALID_DRAFT, 片长: '短片' })
    expect(result.按模块['剧本节奏审读'].some((f) => f.问题说明.includes('没有分场大纲'))).toBe(true)
    expect(result.是否阻断).toBe(false)
  })

  it('大纲人物在草稿里一次也没出现，报中级别', () => {
    const outline = parseSceneOutline(VALID_OUTLINE)
    expect(outline.ok).toBe(true)
    if (!outline.ok || outline.outline === undefined) return
    const noSuqing = {
      ...VALID_DRAFT,
      场: VALID_DRAFT.场.map((s) => ({
        ...s,
        动作: s.动作.map((a) => a.replace('苏晴', '记者')),
        台词段: s.台词段.filter((b) => b.角色 !== '苏晴').map((b) => ({ ...b, 台词: b.台词.map((l) => l.replace('苏晴', '记者')) })),
      })),
    }
    const result = runScreenplayReview({ 剧本草稿: noSuqing, 分场大纲: outline.outline, 片长: '短片' })
    expect(result.按模块['剧本场次完整性审读'].some((f) => f.问题说明.includes('苏晴'))).toBe(true)
  })
})
