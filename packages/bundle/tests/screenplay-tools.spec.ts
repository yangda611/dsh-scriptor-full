import { describe, expect, it } from 'vitest'
import { createScreenplayTools, runScreenplayPipelineTool, SCREENPLAY_TOOL_NAMES } from '../src/screenplay-tools'
import { renderScreenplay } from '../../core/src/screenplay/format'
import { VALID_DRAFT, VALID_OUTLINE, VALID_STORY } from '../../core/tests/screenplay-fixtures'
import * as fs from 'node:fs'
import * as path from 'node:path'

const tools = createScreenplayTools()
const byName = new Map(tools.map((t) => [t.name, t]))

describe('阶段 2：电影剧本工具定义（screenplay-tools，不改 novel-tools）', () => {
  it('导出 6 个工具，名称与 SCREENPLAY_TOOL_NAMES 一致', () => {
    expect(tools.map((t) => t.name)).toEqual([...SCREENPLAY_TOOL_NAMES])
    expect(SCREENPLAY_TOOL_NAMES).toHaveLength(6)
  })

  it('门禁工具：电影剧本通过，小说/短剧拒绝；中文市场不能选海外档', async () => {
    const check = byName.get('novel_screenplay_check_contract')!
    expect(await check.execute({ 市场: '中文', 输出形态: '电影剧本' })).toMatchObject({ ok: true, 定稿路径: '剧本/电影/剧本.md' })
    expect(await check.execute({ 市场: '中文', 输出形态: '小说' })).toMatchObject({ ok: false })
    expect(await check.execute({ 市场: '中文', 输出形态: '电影剧本', 题材档: '海外女性向' })).toMatchObject({ ok: false })
  })

  it('故事稿校验工具：有效故事稿通过', async () => {
    const tool = byName.get('novel_screenplay_validate_story')!
    expect(await tool.execute({ 故事稿: VALID_STORY })).toMatchObject({ ok: true, 问题: [], 警告: [] })
    expect(await tool.execute({ 故事稿: '# 只有标题\n' })).toMatchObject({ ok: false })
  })

  it('建大纲工具：转折原句落进第二幕骨架；建草稿工具：骨架含待写清单', async () => {
    const outlineTool = byName.get('novel_screenplay_build_outline')!
    const outline = await outlineTool.execute({ 故事稿: VALID_STORY }) as { ok: boolean; 分场大纲骨架: string }
    expect(outline.ok).toBe(true)
    expect(outline.分场大纲骨架).toContain('监控显示三年前的大火不是意外')
    const draftTool = byName.get('novel_screenplay_build_draft')!
    const draft = await draftTool.execute({ 分场大纲: VALID_OUTLINE }) as { ok: boolean; 剧本草稿骨架: string; 待写清单: string[] }
    expect(draft.ok).toBe(true)
    expect(draft.剧本草稿骨架).toContain('场01 INT. 面馆 - 深夜')
    expect(draft.待写清单.length).toBeGreaterThan(0)
  })

  it('审读工具：有效草稿零阻断；(beat) 草稿阻断', async () => {
    const tool = byName.get('novel_screenplay_review')!
    const good = await tool.execute({ 剧本草稿: renderScreenplay(VALID_DRAFT), 分场大纲: VALID_OUTLINE, 片长: '短片' }) as { ok: boolean; 是否阻断: boolean }
    expect(good.ok).toBe(true)
    expect(good.是否阻断).toBe(false)
    const beat = renderScreenplay(VALID_DRAFT).replace('(pause)', '(beat)')
    const bad = await tool.execute({ 剧本草稿: beat, 分场大纲: VALID_OUTLINE, 片长: '短片' }) as { ok: boolean; 是否阻断: boolean }
    expect(bad.ok).toBe(false)
    expect(bad.是否阻断).toBe(true)
  })

  it('渲染工具：返回标准格式文本与页数粗估', async () => {
    const tool = byName.get('novel_screenplay_render')!
    const r = await tool.execute({ 剧本草稿: renderScreenplay(VALID_DRAFT) }) as { ok: boolean; 标准格式文本: string; 估算页数: number }
    expect(r.ok).toBe(true)
    expect(r.标准格式文本).toContain('FADE IN:')
    expect(r.估算页数).toBeGreaterThanOrEqual(1)
  })

  it('一步跑完示例《晚星》全流程：ok 且零发现项', () => {
    const dir = path.resolve(__dirname, '../../../docs/examples/电影剧本示例')
    const result = runScreenplayPipelineTool({
      市场: '中文',
      输出形态: '电影剧本',
      题材档: '中文女频',
      片长: '短片',
      故事稿: fs.readFileSync(path.join(dir, '故事稿.md'), 'utf-8'),
      分场大纲: fs.readFileSync(path.join(dir, '分场大纲.md'), 'utf-8'),
      剧本草稿: fs.readFileSync(path.join(dir, '剧本.md'), 'utf-8'),
    })
    expect(result.ok).toBe(true)
    expect(result.审读?.findings).toEqual([])
  })
})
