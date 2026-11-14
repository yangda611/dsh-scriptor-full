/**
 * 短剧工具定义测试（阶段 3 后续轮次）：审读工具经注册表 + 节拍检查不再接受付费集。
 * 覆盖 novel_shortdrama_review_episode 的新输出（审核编号 / 审读指纹 / 待回写模块）
 * 与 novel_shortdrama_check_beats 的统一节拍规则。
 */
import { describe, expect, it } from 'vitest'
import { SHORTDRAMA_TOOL_DEFINITIONS, SHORTDRAMA_TOOL_NAMES } from '../src/shortdrama-tools'
import { exampleOutlines, exampleVerticalBeats, exampleVerticalScripts } from '../../core/src/shortdrama/examples'

const byName = new Map(SHORTDRAMA_TOOL_DEFINITIONS.map((t) => [t.name, t]))

describe('阶段 3：短剧工具定义（shortdrama-tools，注册表接线后）', () => {
  it('导出 4 个工具，名称与 SHORTDRAMA_TOOL_NAMES 一致', () => {
    expect(SHORTDRAMA_TOOL_DEFINITIONS.map((t) => t.name)).toEqual([...SHORTDRAMA_TOOL_NAMES])
    expect(SHORTDRAMA_TOOL_NAMES).toHaveLength(4)
  })

  it('纯渲染定义明确标记未保存，不能把预览当作已落盘', async () => {
    expect(await byName.get('novel_shortdrama_render_episode')!.execute({ ...exampleVerticalScripts[0] }))
      .toMatchObject({ ok: true, saved: false, finalPath: '剧本/短剧/集001.md' })
  })

  it('缺失台词字段返回具体参数错误', async () => {
    expect(await byName.get('novel_shortdrama_render_episode')!.execute({ ...exampleVerticalScripts[0], 标题: undefined }))
      .toMatchObject({ ok: false, code: 'invalid-argument', reason: expect.stringContaining('标题必须是字符串') })
  })

  it('审读工具：示例集零发现，经注册表返回审核编号与指纹，待回写语义模块', async () => {
    const tool = byName.get('novel_shortdrama_review_episode')!
    const r = await tool.execute({ 剧本: exampleVerticalScripts[0], 大纲: exampleOutlines[0] }) as {
      ok: boolean
      模块名: string
      发现项: unknown[]
      审核编号: string
      审读指纹: string
      待回写模块: string[]
    }
    expect(r.ok).toBe(true)
    expect(r.模块名).toBe('短剧审读')
    expect(r.发现项).toEqual([])
    expect(r.审核编号).toBe('审-集001')
    expect(typeof r.审读指纹).toBe('string')
    expect(r.审读指纹.length).toBeGreaterThan(0)
    expect(r.待回写模块).toEqual(['短剧审读（语义）'])
  })

  it('审读工具：反转数不足报发现项，审核编号与指纹仍返回', async () => {
    const tool = byName.get('novel_shortdrama_review_episode')!
    const r = await tool.execute({
      剧本: { ...exampleVerticalScripts[0], 反转秒: [25] },
      大纲: exampleOutlines[0],
    }) as {
      ok: boolean
      发现项: Array<{ 问题说明: string; 修改建议: string }>
      审核编号: string
      审读指纹: string
    }
    expect(r.ok).toBe(true)
    expect(r.审核编号).toBe('审-集001')
    expect(r.发现项.some((f) => f.问题说明.includes('反转数不足'))).toBe(true)
    // 修改建议按时长推导（90 秒一集至少 2 个），不写固定的「竖屏 90 秒」。
    expect(r.发现项.find((f) => f.问题说明.includes('反转数不足'))?.修改建议).toContain('90 秒一集至少 2 个')
    expect(r.审读指纹.length).toBeGreaterThan(0)
  })

  it('节拍检查工具：不接受付费集参数，竖屏横屏共用一套规则', async () => {
    const tool = byName.get('novel_shortdrama_check_beats')!
    // 工具定义里已无 付费集 参数。
    const params = tool.parameters as { properties: Record<string, unknown> }
    expect('付费集' in params.properties).toBe(false)
    const r = await tool.execute({ 集数据: exampleVerticalBeats.slice(0, 3) }) as {
      ok: boolean
      全部通过: boolean
    }
    expect(r.ok).toBe(true)
    expect(r.全部通过).toBe(true)
  })
})
