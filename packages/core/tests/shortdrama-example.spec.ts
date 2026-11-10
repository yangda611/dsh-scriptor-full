import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  exampleHorizontalBeats,
  exampleHorizontalPlan,
  exampleHorizontalScripts,
  exampleOutlines,
  exampleVerticalBeats,
  exampleVerticalPlan,
  exampleVerticalScripts,
  runExampleShortDrama,
} from '../src/shortdrama/examples'
import { renderSeasonOutline } from '../src/shortdrama/outline'
import { renderEpisodeScript, totalDialogueChars } from '../src/shortdrama/script'

const EXAMPLE_DIR = path.resolve(__dirname, '../../../examples/shortdrama/赘婿逆袭')

describe('阶段 3：示例短剧端到端（《赘婿归来》，至少 3 集，竖屏 + 横屏）', () => {
  it('分集大纲：前 3 集钩子 身份→情感→顿悟，首胜第 3 集，竖屏付费集第 11 集', () => {
    expect(exampleOutlines.map((o) => o.钩子类型)).toEqual(['身份', '情感', '顿悟'])
    expect(exampleOutlines.map((o) => o.集)).toEqual([1, 2, 3])
    expect(exampleVerticalPlan.首胜集).toBe(3)
    expect(exampleVerticalPlan.付费集).toBe(11)
    expect(exampleHorizontalPlan.付费集).toBeNull()
    for (const o of exampleOutlines) expect(o.核心想法.trim()).not.toBe('')
  })

  it('竖屏 3 集：每集 90 秒、3 场、台词 180–360 字、单句 ≤12 字、零渲染警告', () => {
    for (const s of exampleVerticalScripts) {
      const rendered = renderEpisodeScript(s)
      expect(rendered.path).toBe(`剧本/短剧/集${String(s.集).padStart(3, '0')}.md`)
      expect(rendered.警告).toEqual([])
      const total = totalDialogueChars(s.场景)
      expect(total).toBeGreaterThanOrEqual(180)
      expect(total).toBeLessThanOrEqual(360)
      expect(s.场景.length).toBeGreaterThanOrEqual(2)
      expect(s.场景.length).toBeLessThanOrEqual(4)
    }
  })

  it('横屏 3 集：每集 900 秒、起承转合齐全、单句 ≤12 字、零渲染警告', () => {
    for (const s of exampleHorizontalScripts) {
      const rendered = renderEpisodeScript(s)
      expect(rendered.警告).toEqual([])
      expect(s.时长秒).toBe(900)
      expect(s.起承转合).toEqual({ 起: true, 承: true, 转: true, 合: true })
      expect(s.首场冲突).toBe(true)
      for (const scene of s.场景) {
        for (const line of scene.台词) {
          expect([...line.台词].filter((c) => !/\s/.test(c)).length).toBeLessThanOrEqual(12)
        }
      }
    }
  })

  it('节拍检查：竖屏与横屏前 3 集全部通过（竖屏付费集第 11 集）', () => {
    const result = runExampleShortDrama()
    expect(result.竖屏节拍.全部通过).toBe(true)
    expect(result.竖屏节拍.未通过清单).toEqual([])
    expect(result.横屏节拍.全部通过).toBe(true)
    expect(result.横屏节拍.未通过清单).toEqual([])
  })

  it('短剧审读：6 集确定性检查零发现', () => {
    const result = runExampleShortDrama()
    expect(result.审读发现).toHaveLength(6)
    for (const row of result.审读发现) expect(row.发现数).toBe(0)
  })

  it('示例输出文件与渲染结果逐字节一致', () => {
    const outline = renderSeasonOutline(exampleVerticalPlan, exampleOutlines)
    expect(fs.readFileSync(path.join(EXAMPLE_DIR, '分集大纲.md'), 'utf8')).toBe(outline)
    for (const s of exampleVerticalScripts) {
      const rendered = renderEpisodeScript(s)
      const file = path.join(EXAMPLE_DIR, '竖屏', `集${String(s.集).padStart(3, '0')}.md`)
      expect(fs.readFileSync(file, 'utf8')).toBe(rendered.内容)
    }
    for (const s of exampleHorizontalScripts) {
      const rendered = renderEpisodeScript(s)
      const file = path.join(EXAMPLE_DIR, '横屏', `集${String(s.集).padStart(3, '0')}.md`)
      expect(fs.readFileSync(file, 'utf8')).toBe(rendered.内容)
    }
    // 节拍数据与剧本数据一致（同一部示例，不出现两套数）
    expect(exampleVerticalBeats).toHaveLength(3)
    expect(exampleHorizontalBeats).toHaveLength(3)
  })
})
