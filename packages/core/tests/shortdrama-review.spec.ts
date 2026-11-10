import { describe, expect, it } from 'vitest'
import { reviewShortDramaEpisode } from '../src/shortdrama/review'
import { exampleHorizontalScripts, exampleOutlines, exampleVerticalScripts } from '../src/shortdrama/examples'
import type { EpisodeOutline, EpisodeScriptInput } from '../src/shortdrama/types'

function input(over: Partial<EpisodeScriptInput> = {}, outlineOver: Partial<EpisodeOutline> = {}) {
  const 剧本: EpisodeScriptInput = {
    集: 1,
    标题: '废物赘婿',
    画幅: '竖屏',
    钩子类型: '身份',
    核心想法: '所有人都以为他是废物赘婿。',
    爽点: '当众羞辱他的人不知道他是继承人。',
    时长秒: 90,
    开场冲突秒: 3,
    反转秒: [25, 55],
    结尾钩子秒: 82,
    结尾悬念: '他到底是谁？',
    场景: [
      {
        场: 1, 地点: '苏家客厅', 时间: '日', 内外: '内', 动作: '岳母把离婚协议拍在桌上。',
        台词: [
          { 角色: '岳母', 台词: '签了它，滚出苏家。' },
          { 角色: '顾霆琛', 台词: '这婚，我不离。' },
        ],
      },
      {
        场: 2, 地点: '苏家门外', 时间: '日', 内外: '外', 动作: '顾霆琛被赶出门。',
        台词: [{ 角色: '顾霆琛', 台词: '先别声张。' }],
      },
    ],
    ...over,
  }
  const 大纲: EpisodeOutline = {
    集: 1,
    标题: '废物赘婿',
    钩子类型: '身份',
    核心想法: '所有人都以为他是废物赘婿。',
    爽点: '当众羞辱他的人不知道他是继承人。',
    开场冲突: '岳母逼他签离婚协议。',
    反转: ['他掏出一张黑卡。', '黑卡是继承人卡。'],
    结尾悬念: '他到底是谁？',
    ...outlineOver,
  }
  return { 剧本, 大纲 }
}

describe('阶段 3：短剧审读（确定性检查）', () => {
  it('台词总量不足（竖屏 180–360 字）与场景数不足都报发现项，模块名为短剧审读', () => {
    const findings = reviewShortDramaEpisode(input())
    // 上面这集台词只有 9+7+5=21 字，场景 2 场刚好；只应有总量 1 条
    expect(findings).toHaveLength(1)
    expect(findings[0]?.模块名).toBe('短剧审读')
    expect(findings[0]?.证据位置).toBe('集001')
    expect(findings[0]?.问题说明).toContain('21 字')
    expect(findings[0]?.是否建议阻断).toBe(false)
    expect(findings[0]?.处置状态).toBe('待处理')
  })

  it('钩子类型 / 核心想法 / 结尾悬念与大纲不一致报阻断级发现项', () => {
    const findings = reviewShortDramaEpisode(input({ 钩子类型: '情感', 核心想法: '另一件事。', 结尾悬念: '他到底是谁？' }))
    expect(findings.some((f) => f.问题说明.includes('钩子类型与大纲不一致') && f.是否建议阻断)).toBe(true)
    expect(findings.some((f) => f.问题说明.includes('核心想法与大纲不一致') && f.是否建议阻断)).toBe(true)
    expect(findings.some((f) => f.问题说明.includes('结尾悬念与大纲不一致'))).toBe(false)
  })

  it('台词超长逐行报发现项，证据位置带场号', () => {
    const long = '这句台词一共有二十个字远远超过上限了。'
    const findings = reviewShortDramaEpisode(input({
      场景: [
        { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人说话。', 台词: [{ 角色: '苏晚', 台词: long }] },
        { 场: 2, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    }))
    expect(findings.some((f) => f.证据位置 === '集001/场01' && f.问题说明.includes('超过单句 12 字上限'))).toBe(true)
  })

  it('反转数少于大纲报发现项；(beat) 停顿报发现项', () => {
    const findings = reviewShortDramaEpisode(input({
      反转秒: [25],
      场景: [
        { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '沉默。', 台词: [{ 角色: '苏晚', 括号提示: 'beat', 台词: '你说。' }] },
        { 场: 2, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    }))
    expect(findings.some((f) => f.问题说明.includes('反转数不足'))).toBe(true)
    expect(findings.some((f) => f.问题说明.includes('(beat)'))).toBe(true)
  })

  it('示例短剧 6 集（竖屏 3 + 横屏 3）确定性审读零发现', () => {
    for (let i = 0; i < 3; i++) {
      expect(reviewShortDramaEpisode({ 剧本: exampleVerticalScripts[i]!, 大纲: exampleOutlines[i]! })).toEqual([])
      expect(reviewShortDramaEpisode({ 剧本: exampleHorizontalScripts[i]!, 大纲: exampleOutlines[i]! })).toEqual([])
    }
  })
})
