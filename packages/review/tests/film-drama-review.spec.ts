/**
 * 影视剧审读注册表接线测试（2026-11-11 阶段 2/3 后续轮次，任务 2）：
 * - 注册表按适用范围列出剧本/短剧模块，且章节注册（registerDefaultChecks）不变；
 * - 剧本审读 run 完成并落盘发现项（草稿区/审核/审-剧本.json），语义模块回写后完成；
 * - 短剧分集审读 run 完成并落盘发现项（草稿区/审核/审-集NNN.json），语义模块回写后完成；
 * - 指纹过期拒绝（剧本/集）；
 * - 全部模块注册后，章节审读完成判定不受影响（范围过滤）。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  assembleMaterials,
  confirmOutline,
  deriveChapterFacts,
  exampleOutlines,
  exampleVerticalScripts,
  loadEpisodeReviewRecord,
  loadReviewRecord,
  loadScreenplayReviewRecord,
  parseSceneOutline,
  parseScreenplay,
  renderEpisodeScript,
  scanChapter,
  seedMinDesign,
  serializeDocument,
  writeCandidate,
} from '@webnovel/core'
import {
  computeEpisodeReview,
  computeScreenplayReview,
  episodeOutlineText,
  getCheck,
  ingestFilmDramaFindings,
  ingestFindings,
  listChecks,
  registerAllReviewChecks,
  registerDefaultChecks,
  resetChecks,
  runEpisodeReviewRecord,
  runReview,
  runScreenplayReviewRecord,
  FILM_DRAMA_MODULE_NAMES,
  剧本对白审读名,
  剧本节奏审读名,
  剧本场次完整性审读名,
  剧本语义审读名,
  短剧审读名,
  短剧审读语义名,
} from '../src/index'

const roots: string[] = []
function mkBook(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webnovel-film-drama-review-'))
  roots.push(dir)
  seedMinDesign(dir)
  return dir
}
afterAll(() => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch { /* Windows 句柄延迟释放，%TEMP% 残留无害 */ } } })
beforeEach(() => {
  resetChecks()
  registerAllReviewChecks()
})

// —— 剧本夹具：2 场草稿（含一个 (beat)，对白模块应报阻断级发现项）+ 对应大纲 ——
const DRAFT_TEXT = `# 晚星

FADE IN:

场01 INT. 面馆 - 深夜

林晚星擦着桌子。

林晚星
(pause)
你先别说话。

阿辉
(beat)
我有话要说。

场02 INT. 档案室 - 日

林晚星翻着档案。

林晚星
这份记录不对。

场03 INT. 面馆 - 黎明

林晚星把证据交给警方。

林晚星
(pause)
真相不是用来报复的。

FADE OUT.
`

const OUTLINE_TEXT = `# 晚星

## 第一幕

### 场01  面馆 深夜 内

- 场景：面馆 深夜 内
- 人物：林晚星、阿辉
- 冲突：深夜面馆来了纵火嫌疑人。
- 转折：嫌疑人掏出一张旧照片。

## 第二幕

### 场02  档案室 日 内

- 场景：档案室 日 内
- 人物：林晚星
- 冲突：林晚星想调三年前的出警记录，档案室拒绝。
- 转折：监控显示大火是人为纵火。

## 第三幕

### 场03  面馆 黎明 内

- 场景：面馆 黎明 内
- 人物：林晚星
- 冲突：林晚星要在报复与交出真相之间做选择。
- 转折：她把证据交给警方，面馆重新开张。
`

function parseDraft() {
  const draft = parseScreenplay(DRAFT_TEXT)
  expect(draft.ok).toBe(true)
  if (!draft.ok || draft.draft === undefined) throw new Error('草稿解析失败')
  const outline = parseSceneOutline(OUTLINE_TEXT)
  expect(outline.ok).toBe(true)
  if (!outline.ok || outline.outline === undefined) throw new Error('大纲解析失败')
  return { draft: draft.draft, outline: outline.outline }
}

// —— 章节夹具（复用 review.spec.ts 的最小设计）——
const key = { 卷: 1, 章: 1, 章名: '开篇任务' } as const
const refs = ['作品契约/契约.md@1', '世界书/人物档案/主角.md@1'] as const
const HARD = '本章必须出现「主角现身」'

function confirmWithHard(root: string): void {
  const body = [
    '# 章细纲',
    '',
    '## 定位段',
    '',
    '### 来源窗口项及拆并关系',
    '开篇任务，单章承接',
    '',
    '### 章节功能',
    '',
    `- 〔硬〕${HARD}`,
    '',
    '### 视角与焦点',
    '主角视角',
    '',
    '### 时空锚定',
    '城门口，清晨',
    '',
    '### 起止边界',
    '从抵达城门到发现异状',
    '',
    '### 故事线与承诺分配',
    '推进主线承诺',
    '',
    '### 信息边界',
    '只披露主角所见',
    '',
    '### 情绪与节奏目标',
    '紧张后留钩子',
    '',
    '### 前置条件核对结果',
    '已核对来源与窗口，前置设定均非留白',
    '',
    '## 细纲段',
    '',
    '### 单元 1',
    '',
    '- 目标: 开场',
    '- 人物: 主角',
    '- 时空: 城门口',
    '- 行动/冲突: 盘问与发现',
    '- 信息披露: 异常线索',
    '- 状态变化: 从平静到警觉',
    '',
  ].join('\n')
  writeCandidate(root, { 卷: 1, 章: 1, 章名: '开篇任务', 来源引用: refs, body })
  const r = confirmOutline(root, key)
  if (!r.ok) throw new Error(`confirm failed:${r.gaps.join(';')}`)
}

function putPending(root: string, body: string, file = '稿1.md'): void {
  const rel = `草稿区/草稿/卷01-开篇任务/${file}`
  fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), serializeDocument({ 角色: '待审稿', 选定: true }, body), 'utf-8')
}

/** 把记录里全部待回写模块回写（空发现项）。 */
function ingestAll(root: string): void {
  const record = loadReviewRecord(root, key)
  for (const [name, st] of Object.entries(record?.模块 ?? {})) {
    if (st.待回写 === true) {
      const r = ingestFindings(root, key, name, [], record!.审读指纹)
      if (!r.ok) throw new Error(r.reason)
    }
  }
}

describe('影视剧审读注册表接线', () => {
  it('注册表按适用范围列出剧本/短剧模块；章节默认注册不变', () => {
    expect(FILM_DRAMA_MODULE_NAMES).toEqual([
      剧本对白审读名,
      剧本节奏审读名,
      剧本场次完整性审读名,
      剧本语义审读名,
      短剧审读名,
      短剧审读语义名,
    ])
    // 全量注册：6 个影视剧模块都在。
    for (const name of FILM_DRAMA_MODULE_NAMES) {
      expect(listChecks().some((m) => m.名称 === name)).toBe(true)
    }
    // 范围过滤：章范围不含影视剧模块；剧本范围 4 个；集范围 2 个。
    expect(listChecks('章').some((m) => FILM_DRAMA_MODULE_NAMES.includes(m.名称))).toBe(false)
    expect(listChecks('章').length).toBe(listChecks().length - FILM_DRAMA_MODULE_NAMES.length)
    expect(listChecks('剧本').map((m) => m.名称).sort()).toEqual(
      [剧本对白审读名, 剧本节奏审读名, 剧本场次完整性审读名, 剧本语义审读名].sort(),
    )
    expect(listChecks('集').map((m) => m.名称).sort()).toEqual(
      [短剧审读名, 短剧审读语义名].sort(),
    )
    // 模块元数据：适用范围与执行形态。
    expect(getCheck(剧本对白审读名)?.适用范围).toBe('剧本')
    expect(getCheck(剧本对白审读名)?.执行形态).toBe('确定性代码')
    expect(getCheck(剧本语义审读名)?.适用范围).toBe('剧本')
    expect(getCheck(剧本语义审读名)?.执行形态).toBe('隔离子 Agent')
    expect(getCheck(短剧审读名)?.适用范围).toBe('集')
    expect(getCheck(短剧审读名)?.执行形态).toBe('确定性代码')
    expect(getCheck(短剧审读语义名)?.适用范围).toBe('集')
    expect(getCheck(短剧审读语义名)?.执行形态).toBe('隔离子 Agent')
    // 章节默认注册（向后兼容）：不含影视剧模块。
    resetChecks()
    registerDefaultChecks()
    expect(listChecks().some((m) => FILM_DRAMA_MODULE_NAMES.includes(m.名称))).toBe(false)
  })

  it('剧本审读 run 完成并落盘发现项；语义模块回写后完成', () => {
    const root = mkBook()
    const { draft, outline } = parseDraft()
    const input = {
      剧本草稿: draft,
      剧本草稿文本: DRAFT_TEXT,
      分场大纲: outline,
      分场大纲文本: OUTLINE_TEXT,
      片长: '短片' as const,
    }
    // 纯算：(beat) 阻断级发现项进记录，审核编号为 审-剧本，指纹非空。
    const computed = computeScreenplayReview(root, input)
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    expect(computed.record.问题.some((f) => f.审核编号 === '审-剧本' && f.问题说明.includes('(beat)'))).toBe(true)
    expect(computed.record.问题.some((f) => f.是否建议阻断)).toBe(true)
    expect(computed.record.审读指纹).not.toBe('')
    // 落盘 run：发现项进记录，确定性模块完成，语义待回写。
    const r = runScreenplayReviewRecord(root, input)
    expect(r.ok).toBe(true)
    if (!r.ok || r.record === null) return
    expect(r.record.审读指纹).toBe(computed.record.审读指纹)
    expect(r.record.问题.some((f) => f.模块名 === 剧本对白审读名 && f.问题说明.includes('(beat)'))).toBe(true)
    expect(r.record.问题.some((f) => f.是否建议阻断)).toBe(true)
    expect(r.record.模块[剧本对白审读名]?.完成).toBe(true)
    expect(r.record.模块[剧本节奏审读名]?.完成).toBe(true)
    expect(r.record.模块[剧本场次完整性审读名]?.完成).toBe(true)
    expect(r.record.完成).toBe(false)
    expect(r.待回写模块).toEqual([剧本语义审读名])
    // 记录文件落盘在 草稿区/审核/审-剧本.json，可读回；发现项审核编号为 审-剧本。
    expect(fs.existsSync(path.join(root, '草稿区/审核/审-剧本.json'))).toBe(true)
    expect(loadScreenplayReviewRecord(root)?.问题.some((f) => f.审核编号 === '审-剧本')).toBe(true)
    expect(loadScreenplayReviewRecord(root)?.问题.length).toBe(r.record.问题.length)
    // 语义模块回写（同一指纹）：完成。
    const ing = ingestFilmDramaFindings({
      bookRoot: root,
      scope: '剧本',
      模块名: 剧本语义审读名,
      发现项: [{
        证据位置: '场01',
        问题说明: '语义：阿辉的动机在场01未交代清楚。',
        严重程度: '中',
        是否建议阻断: false,
        修改建议: '场01补一句阿辉来面馆的理由。',
        建议返回节点: '剧本草稿',
      }],
      审读指纹: computed.record.审读指纹,
      剧本草稿文本: DRAFT_TEXT,
      分场大纲文本: OUTLINE_TEXT,
      片长: '短片',
    })
    expect(ing.ok).toBe(true)
    if (!ing.ok || ing.record === null) return
    expect(ing.record.完成).toBe(true)
    expect(ing.待回写模块).toEqual([])
    expect(ing.record.问题.some((f) => f.模块名 === 剧本语义审读名)).toBe(true)
  })

  it('剧本审读：指纹过期拒绝回写', () => {
    const root = mkBook()
    const { draft, outline } = parseDraft()
    const input = {
      剧本草稿: draft,
      剧本草稿文本: DRAFT_TEXT,
      分场大纲: outline,
      分场大纲文本: OUTLINE_TEXT,
      片长: '短片' as const,
    }
    const r = runScreenplayReviewRecord(root, input)
    expect(r.ok).toBe(true)
    const ing = ingestFilmDramaFindings({
      bookRoot: root,
      scope: '剧本',
      模块名: 剧本语义审读名,
      发现项: [],
      审读指纹: 'deadbeef-过期指纹',
      剧本草稿文本: DRAFT_TEXT,
      分场大纲文本: OUTLINE_TEXT,
      片长: '短片',
    })
    expect(ing.ok).toBe(false)
    expect(ing.reason).toMatch(/已过期/)
  })

  it('短剧分集审读 run 完成并落盘发现项；语义模块回写后完成', () => {
    const root = mkBook()
    const 剧本 = { ...exampleVerticalScripts[0]!, 反转秒: [25] }
    const 大纲 = exampleOutlines[0]!
    const computed = computeEpisodeReview(root, { 集: 1 }, { 剧本, 大纲 })
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    expect(computed.record.问题.some((f) => f.审核编号 === '审-集001' && f.问题说明.includes('反转数不足'))).toBe(true)
    expect(computed.record.审读指纹).not.toBe('')
    const r = runEpisodeReviewRecord(root, { 集: 1 }, { 剧本, 大纲 })
    expect(r.ok).toBe(true)
    if (!r.ok || r.record === null) return
    expect(r.record.审读指纹).toBe(computed.record.审读指纹)
    expect(r.record.问题.some((f) => f.模块名 === 短剧审读名 && f.问题说明.includes('反转数不足'))).toBe(true)
    expect(r.record.模块[短剧审读名]?.完成).toBe(true)
    expect(r.record.完成).toBe(false)
    expect(r.待回写模块).toEqual([短剧审读语义名])
    expect(fs.existsSync(path.join(root, '草稿区/审核/审-集001.json'))).toBe(true)
    expect(loadEpisodeReviewRecord(root, 1)?.问题.some((f) => f.审核编号 === '审-集001')).toBe(true)
    // 语义模块回写：先用改过的剧本文本（指纹对不上）应被拒绝，再用审读时的文本成功。
    const ingBad = ingestFilmDramaFindings({
      bookRoot: root,
      scope: '集',
      集: 1,
      模块名: 短剧审读语义名,
      发现项: [],
      审读指纹: computed.record.审读指纹,
      剧本文本: '改过的剧本文本',
      大纲文本: episodeOutlineText(大纲),
    })
    expect(ingBad.ok).toBe(false)
    expect(ingBad.reason).toMatch(/已过期/)
    const ing2 = ingestFilmDramaFindings({
      bookRoot: root,
      scope: '集',
      集: 1,
      模块名: 短剧审读语义名,
      发现项: [{
        证据位置: '集001',
        问题说明: '语义：爽点在对白里没有落到行动上。',
        严重程度: '中',
        是否建议阻断: false,
        修改建议: '把爽点改成一句看得见的动作。',
        建议返回节点: '单集剧本',
      }],
      审读指纹: computed.record.审读指纹,
      剧本文本: renderEpisodeScript(剧本).内容,
      大纲文本: episodeOutlineText(大纲),
    })
    expect(ing2.ok).toBe(true)
    if (!ing2.ok || ing2.record === null) return
    expect(ing2.record.完成).toBe(true)
    expect(ing2.待回写模块).toEqual([])
  })

  it('全部模块注册后，章节审读完成判定不受影响（范围过滤）', () => {
    const root = mkBook()
    confirmWithHard(root)
    assembleMaterials(root, key)
    putPending(root, `巷口风大。${HARD}。他没有回头。`)
    const r = runReview(root, key)
    expect(r.ok).toBe(true)
    expect(r.record?.完成).toBe(false)
    // 章节记录的模块表里没有任何影视剧模块。
    expect(Object.keys(r.record?.模块 ?? {}).some((m) => FILM_DRAMA_MODULE_NAMES.includes(m))).toBe(false)
    ingestAll(root)
    const loaded = loadReviewRecord(root, key)!
    expect(loaded.完成).toBe(true)
    expect(loaded.问题).toEqual([])
    expect(Object.keys(loaded.模块).some((m) => FILM_DRAMA_MODULE_NAMES.includes(m))).toBe(false)
    expect(deriveChapterFacts(scanChapter(root, key)).建议.环节).toBe('定稿准备与沉淀')
  })
})
