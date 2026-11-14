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
  it.each([
    ['标题', undefined],
    ['核心想法', null],
    ['爽点', 123],
    ['结尾悬念', {}],
  ])('运行时参数校验：%s 缺失或类型不对时指出字段', (field, value) => {
    const input = { ...baseScript(), [field as string]: value } as unknown as EpisodeScriptInput
    expect(() => renderEpisodeScript(input)).toThrow(new RegExp(`${field}.*字符串`))
  })

  it.each([
    [null, '参数'],
    [{ ...baseScript(), 画幅: '方屏' }, '画幅'],
    [{ ...baseScript(), 钩子类型: undefined }, '钩子类型'],
    [{ ...baseScript(), 场景: null }, '场景'],
    [{ ...baseScript(), 场景: [null, baseScript().场景[1]] }, '场景\\[0\\]'],
    [{ ...baseScript(), 反转秒: '25,55' }, '反转秒'],
    [{ ...baseScript(), 反转秒: [25, '55'] }, '反转秒\\[1\\]'],
    [{ ...baseScript(), 开场冲突秒: undefined }, '开场冲突秒'],
  ])('运行时参数校验：拒绝错误的对象、枚举和数组（%#）', (input, field) => {
    expect(() => renderEpisodeScript(input as unknown as EpisodeScriptInput)).toThrow(new RegExp(`${field}.*必须`))
  })

  it.each([
    ['地点', undefined],
    ['时间', 123],
    ['动作', null],
    ['场景环境', []],
    ['台词', null],
    ['人物', {}],
    ['镜头', {}],
  ])('运行时参数校验：场景的 %s 类型不对时指出字段', (field, value) => {
    const input = baseScript({ 场景: [
      { ...baseScript().场景[0], [field as string]: value },
      baseScript().场景[1],
    ] } as unknown as Partial<EpisodeScriptInput>)
    expect(() => renderEpisodeScript(input)).toThrow(new RegExp(`场景\\[0\\].*${field}.*必须`))
  })

  it.each([
    [null, '台词\\[0\\]'],
    [{ 台词: '你说。' }, '角色'],
    [{ 角色: '苏晚', 台词: 123 }, '台词'],
    [{ 角色: '苏晚', 台词: '你说。', 括号提示: null }, '括号提示'],
  ])('运行时参数校验：台词缺字段或类型不对时指出位置（%#）', (line, field) => {
    const input = baseScript({ 场景: [
      { ...baseScript().场景[0], 台词: [line] },
      baseScript().场景[1],
    ] } as unknown as Partial<EpisodeScriptInput>)
    expect(() => renderEpisodeScript(input)).toThrow(new RegExp(`场景\\[0\\].*${field}.*必须`))
  })

  it.each([
    ['景别', undefined],
    ['角度', 123],
    ['运镜', null],
    ['描写', null],
    ['描写', [undefined]],
    ['台词', null],
    ['开始秒', undefined],
    ['环境声', '风声'],
    ['字幕', [123]],
  ])('运行时参数校验：镜头的 %s 缺失或类型不对时指出位置（%#）', (field, value) => {
    const shot = {
      镜头号: 1, 开始秒: 0, 结束秒: 10, 景别: '近景', 角度: '平视正面', 运镜: '固定镜头',
      描写: ['苏晚站在门口。'], 台词: [{ 角色: '苏晚', 台词: '你说。' }],
      [field as string]: value,
    }
    const input = baseScript({ 场景: [
      { ...baseScript().场景[0], 镜头: [shot] },
      baseScript().场景[1],
    ] } as unknown as Partial<EpisodeScriptInput>)
    expect(() => renderEpisodeScript(input)).toThrow(new RegExp(`场景\\[0\\].*镜头\\[0\\].*${field}.*必须`))
  })

  it('运行时参数校验：人物行缺少角色时指出位置', () => {
    const input = baseScript({ 场景: [
      { ...baseScript().场景[0], 人物: [{ 形象标识: '毛衣女子' }] },
      baseScript().场景[1],
    ] } as unknown as Partial<EpisodeScriptInput>)
    expect(() => renderEpisodeScript(input)).toThrow(/场景\[0\].*人物\[0\].*角色.*字符串/)
  })

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

  it('空描写行永不渲染成裸 △ 行：全空描写阻断，部分空行跳过', () => {
    const withEmpty = baseScript({
      场景: [
        {
          场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人。', 台词: [{ 角色: '苏晚', 台词: '进来。' }],
          镜头: [{ 镜头号: 1, 开始秒: 0, 结束秒: 10, 景别: '近景', 角度: '平视正面', 运镜: '固定镜头', 描写: [''], 台词: [{ 角色: '苏晚', 台词: '进来。' }] }],
        },
        { 场: 2, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    })
    expect(() => renderEpisodeScript(withEmpty)).toThrow('描写行全为空')
    // 部分空行：渲染时跳过，不出裸 △ 行
    const partial = baseScript({
      场景: [
        {
          场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '有人。', 台词: [{ 角色: '苏晚', 台词: '进来。' }],
          镜头: [{ 镜头号: 1, 开始秒: 0, 结束秒: 10, 景别: '近景', 角度: '平视正面', 运镜: '固定镜头', 描写: ['苏晚站在门口。', '', '   '], 台词: [{ 角色: '苏晚', 台词: '进来。' }] }],
        },
        { 场: 2, 地点: '门外', 时间: '日', 内外: '外', 动作: '风停。', 台词: [{ 角色: '顾霆琛', 台词: '是我。' }] },
      ],
    })
    const rendered = renderEpisodeScript(partial)
    expect(rendered.内容).toContain('△苏晚站在门口。')
    expect(rendered.内容.split('\n').some((line) => line.trim() === '△')).toBe(false)
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
