import { describe, expect, it } from 'vitest'
import { emptyStoryDraft, parseStoryDraft, renderStoryDraft, validateStoryDraft } from '../src/screenplay/story'
import { outlineFromStory } from '../src/screenplay/outline'
import { VALID_STORY } from './screenplay-fixtures'

describe('阶段 2：故事稿解析与校验', () => {
  it('有效故事稿解析通过：六节、人名、转折齐全', () => {
    const r = parseStoryDraft(VALID_STORY)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
    expect(r.story?.标题).toBe('晚星')
    expect(r.story?.人物.map((c) => c.姓名)).toEqual(['林晚星', '陈默'])
    expect(r.story?.关键转折).toHaveLength(2)
    expect(r.story?.世界规则).toContain('现实世界')
  })

  it('缺节、空节、无人物、无转折都报问题', () => {
    expect(parseStoryDraft('# 只有标题\n').ok).toBe(false)
    expect(parseStoryDraft(VALID_STORY.replace('## 结尾', '## 收尾')).problems.some((p) => p.includes('结尾'))).toBe(true)
    expect(parseStoryDraft(VALID_STORY.replace('### 林晚星', '### ').replace('### 陈默', '### ')).ok).toBe(false)
  })

  it('空模板照抄过不了：六节是占位符，转折为空', () => {
    const r = parseStoryDraft(emptyStoryDraft('测试'))
    expect(r.ok).toBe(false)
    expect(r.problems.some((p) => p.includes('关键转折'))).toBe(true)
  })

  it('解析—渲染往返一致', () => {
    const r = parseStoryDraft(VALID_STORY)
    expect(r.ok).toBe(true)
    if (!r.ok || r.story === undefined) return
    const r2 = parseStoryDraft(renderStoryDraft(r.story))
    expect(r2.ok).toBe(true)
    expect(r2.story).toEqual(r.story)
  })

  it('人物小传没写动机只报警告，不判错', () => {
    const r = parseStoryDraft(VALID_STORY)
    expect(r.ok).toBe(true)
    if (!r.ok || r.story === undefined) return
    const noMotive = { ...r.story, 人物: [{ 姓名: '路人', 小传: '30 岁，面馆常客。' }] }
    const v = validateStoryDraft(noMotive)
    expect(v.errors).toEqual([])
    expect(v.warnings.some((w) => w.includes('路人') && w.includes('动机'))).toBe(true)
    expect(validateStoryDraft(r.story).errors).toEqual([])
    expect(validateStoryDraft(r.story).warnings).toEqual([])
  })

  it('故事稿 → 分场大纲骨架：每条关键转折落一场第二幕', () => {
    const r = parseStoryDraft(VALID_STORY)
    expect(r.ok).toBe(true)
    if (!r.ok || r.story === undefined) return
    const outline = outlineFromStory(r.story)
    expect(outline.场).toHaveLength(4)
    expect(outline.场.map((s) => s.幕)).toEqual([1, 2, 2, 3])
    expect(outline.场.filter((s) => s.幕 === 2).map((s) => s.转折)).toEqual(r.story.关键转折)
    expect(outline.场.map((s) => s.场号)).toEqual([1, 2, 3, 4])
  })
})
