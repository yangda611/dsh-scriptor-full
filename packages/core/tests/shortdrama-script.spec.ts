import { describe, expect, it } from 'vitest'
import {
  MAX_DIALOGUE_CHARS,
  PAUSE_MARK,
  dialogueChars,
  renderEpisodeScript,
  totalDialogueChars,
} from '../src/shortdrama/script'
import type { EpisodeScriptInput } from '../src/shortdrama/types'

function baseScript(over: Partial<EpisodeScriptInput> = {}): EpisodeScriptInput {
  return {
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
        场: 1,
        地点: '苏家客厅',
        时间: '日',
        内外: '内',
        动作: '岳母把离婚协议拍在桌上。',
        台词: [
          { 角色: '岳母', 台词: '签了它，滚出苏家。' },
          { 角色: '顾霆琛', 台词: '这婚，我不离。' },
        ],
      },
      {
        场: 2,
        地点: '苏家门外',
        时间: '日',
        内外: '外',
        动作: '顾霆琛被赶出门。',
        台词: [{ 角色: '顾霆琛', 括号提示: 'pause', 台词: '先别声张。' }],
      },
    ],
    ...over,
  }
}

describe('阶段 3：单集剧本', () => {
  it('渲染格式：中文分场景标头、说话人冒号对白、节拍表；定稿路径用 paths.短剧集', () => {
    const rendered = renderEpisodeScript(baseScript())
    expect(rendered.path).toBe('剧本/短剧/集001.md')
    expect(rendered.内容).toContain('# 集001：废物赘婿')
    expect(rendered.内容).toContain('1-1 日／内 苏家客厅')
    expect(rendered.内容).toContain('1-2 日／外 苏家门外')
    expect(rendered.内容).toContain('场景环境：岳母把离婚协议拍在桌上。')
    expect(rendered.内容).toContain('△【镜头01｜时间：—｜景别：—｜角度：—｜运镜：—】')
    expect(rendered.内容).toContain('【画面淡出黑场】')
    expect(rendered.内容).toContain('岳母：签了它，滚出苏家。')
    expect(rendered.内容).toContain(`顾霆琛${PAUSE_MARK}：先别声张。`)
    expect(rendered.内容).toContain('## 节拍表')
    expect(rendered.内容).toContain('开场冲突：第 3 秒')
    expect(rendered.内容).toContain('反转：第 25 秒、第 55 秒')
    expect(rendered.内容).toContain('结尾钩子：第 82 秒')
    expect(rendered.警告).toEqual([])
  })

  it('集号三位、场号两位：集 12 渲染为 集012，场 3 渲染为 场03', () => {
    const rendered = renderEpisodeScript(baseScript({ 集: 12, 场景: [
      { 场: 3, 地点: '天台', 时间: '夜', 内外: '外', 动作: '风很大。', 台词: [{ 角色: '苏晚', 台词: '你是谁？' }] },
      { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人进来。', 台词: [{ 角色: '苏晚', 台词: '进来。' }] },
      { 场: 2, 地点: '书房', 时间: '夜', 内外: '内', 动作: '灯亮了。', 台词: [{ 角色: '苏晚', 台词: '开灯。' }] },
    ] }))
    expect(rendered.path).toBe('剧本/短剧/集012.md')
    expect(rendered.内容).toContain('# 集012：废物赘婿')
    // 场按场号排序渲染
    expect(rendered.内容.indexOf('12-1 ')).toBeLessThan(rendered.内容.indexOf('12-2 '))
    expect(rendered.内容.indexOf('12-2 ')).toBeLessThan(rendered.内容.indexOf('12-3 '))
  })

  it('停顿约定：只用 (pause)，(beat) 只警告不丢稿', () => {
    expect(PAUSE_MARK).toBe('(pause)')
    const rendered = renderEpisodeScript(baseScript({
      场景: [
        { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '沉默。', 台词: [{ 角色: '苏晚', 括号提示: 'beat', 台词: '你说。' }] },
        { 场: 2, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    }))
    expect(rendered.警告.some((w) => w.includes('(beat)') && w.includes('(pause)'))).toBe(true)
    expect(rendered.内容).toContain('苏晚(beat)：你说。')
  })

  it('台词超长只警告不丢稿：单句上限 12 字', () => {
    expect(MAX_DIALOGUE_CHARS).toBe(12)
    expect(dialogueChars('三年了，他赚过一分钱吗？')).toBe(12)
    const long = '这句台词一共有二十个字远远超过上限了。'
    expect(dialogueChars(long)).toBeGreaterThan(12)
    const rendered = renderEpisodeScript(baseScript({
      场景: [
        { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人说话。', 台词: [{ 角色: '苏晚', 台词: long }] },
        { 场: 2, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    }))
    expect(rendered.警告).toHaveLength(1)
    expect(rendered.警告[0]).toContain('超过单句 12 字上限')
    expect(rendered.内容).toContain(long)
  })

  it('结构校验：竖屏场数 2–4、时长 60–120 秒、集号 1–100、场号连续', () => {
    const oneScene = baseScript({ 场景: [baseScript().场景[0]!] })
    expect(() => renderEpisodeScript(oneScene)).toThrow('2–4 场')
    expect(() => renderEpisodeScript(baseScript({ 时长秒: 30 }))).toThrow('60–120 秒')
    expect(() => renderEpisodeScript(baseScript({ 时长秒: 121 }))).toThrow('60–120 秒')
    expect(() => renderEpisodeScript(baseScript({ 集: 0 }))).toThrow('1–100')
    expect(() => renderEpisodeScript(baseScript({ 集: 101 }))).toThrow('1–100')
    expect(() => renderEpisodeScript(baseScript({
      场景: [
        { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人。', 台词: [{ 角色: '苏晚', 台词: '进来。' }] },
        { 场: 3, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    }))).toThrow('从 1 起连续')
    expect(() => renderEpisodeScript(baseScript({ 核心想法: '  ' }))).toThrow('核心想法不能为空')
  })

  it('横屏：时长 600–1200 秒、场景数不限、台词总量不限', () => {
    const rendered = renderEpisodeScript(baseScript({
      画幅: '横屏',
      时长秒: 900,
      场景: [
        { 场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人。', 台词: [{ 角色: '苏晚', 台词: '进来。' }] },
      ],
    }))
    expect(rendered.path).toBe('剧本/短剧/集001.md')
    expect(rendered.内容).toContain('画幅：横屏（16:9）')
    expect(() => renderEpisodeScript(baseScript({ 画幅: '横屏', 时长秒: 599 }))).toThrow('600–1200 秒')
    expect(totalDialogueChars(baseScript().场景)).toBeGreaterThan(0)
  })
})
