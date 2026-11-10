import { describe, expect, it } from 'vitest'
import { buildEpisodeOutline, planSeason, renderSeasonOutline } from '../src/shortdrama/outline'
import { hookTypeForEpisode } from '../src/shortdrama/types'

describe('阶段 3：分集钩子/爽点大纲', () => {
  it('竖屏季规划：60 集、钩子按身份→情感→顿悟轮换、首胜第 5 集、付费集第 11 集', () => {
    const plan = planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60 })
    expect(plan.总集数).toBe(60)
    expect(plan.首胜集).toBe(5)
    expect(plan.付费集).toBe(11)
    expect(plan.集大纲[0]?.钩子类型).toBe('身份')
    expect(plan.集大纲[1]?.钩子类型).toBe('情感')
    expect(plan.集大纲[2]?.钩子类型).toBe('顿悟')
    expect(plan.集大纲[3]?.钩子类型).toBe('身份')
    expect(plan.集大纲[10]?.付费墙集).toBe(true)
    expect(plan.集大纲[4]?.首胜集).toBe(true)
    expect(plan.集大纲[0]?.最少反转次数).toBe(2)
    expect(plan.集大纲[0]?.场景数).toEqual([2, 4])
    expect(plan.集大纲[0]?.时长秒).toEqual([60, 120])
    expect(plan.集大纲[0]?.台词字数).toEqual([180, 360])
  })

  it('hookTypeForEpisode 与规划一致：前三集 身份/情感/顿悟，此后循环', () => {
    expect(hookTypeForEpisode(1)).toBe('身份')
    expect(hookTypeForEpisode(2)).toBe('情感')
    expect(hookTypeForEpisode(3)).toBe('顿悟')
    expect(hookTypeForEpisode(4)).toBe('身份')
    expect(hookTypeForEpisode(100)).toBe('身份')
    expect(() => hookTypeForEpisode(0)).toThrow()
  })

  it('横屏季规划：24 集、首胜默认第 3 集、无付费集、台词不限总量', () => {
    const plan = planSeason({ 市场: '海外', 题材档: '海外女性向', 画幅: '横屏', 总集数: 24 })
    expect(plan.付费集).toBeNull()
    expect(plan.首胜集).toBe(3)
    expect(plan.集大纲[0]?.台词字数).toBeNull()
    expect(plan.集大纲[0]?.时长秒).toEqual([600, 1200])
    expect(plan.集大纲.some((s) => s.付费墙集)).toBe(false)
  })

  it('题材档必须属于契约市场：中文市场不能用海外档', () => {
    expect(() => planSeason({ 市场: '中文', 题材档: '海外女性向', 画幅: '竖屏', 总集数: 60 })).toThrow('不属于中文市场')
    expect(() => planSeason({ 市场: '海外', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60 })).toThrow('不属于海外市场')
  })

  it('总集数越界拒绝：竖屏 60–100、横屏 20–30', () => {
    expect(() => planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 59 })).toThrow('60–100')
    expect(() => planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 101 })).toThrow('60–100')
    expect(() => planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '横屏', 总集数: 19 })).toThrow('20–30')
    expect(() => planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '横屏', 总集数: 31 })).toThrow('20–30')
  })

  it('竖屏首胜晚于第 5 集拒绝；付费集只接受 10 或 11', () => {
    expect(() => planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60, 首胜集: 6 })).toThrow('不得晚于第 5 集')
    expect(() => planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60, 付费集: 9 })).toThrow('第 10 或 11 集')
    expect(planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60, 付费集: 10 }).付费集).toBe(10)
  })

  it('填一集大纲：反转不足拒绝；结尾悬念必须切在问题上', () => {
    const plan = planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60 })
    const slot = plan.集大纲[0]!
    const base = {
      标题: '废物赘婿',
      核心想法: '所有人都以为他是废物赘婿。',
      爽点: '当众羞辱他的人不知道他是继承人。',
      开场冲突: '岳母逼他签离婚协议。',
      反转: ['他掏出一张黑卡。', '黑卡是继承人卡。'],
      结尾悬念: '他到底是谁？',
    }
    const outline = buildEpisodeOutline(slot, base)
    expect(outline.钩子类型).toBe('身份')
    expect(outline.反转).toHaveLength(2)
    expect(() => buildEpisodeOutline(slot, { ...base, 反转: ['只有一个反转。'] })).toThrow('至少 2 个')
    expect(() => buildEpisodeOutline(slot, { ...base, 结尾悬念: '他就是继承人。' })).toThrow('切在问题上')
    expect(() => buildEpisodeOutline(slot, { ...base, 核心想法: '   ' })).toThrow('核心想法')
  })

  it('渲染分集大纲：含市场/画幅/首胜/付费集与每集钩子', () => {
    const plan = planSeason({ 市场: '中文', 题材档: '中文男频', 画幅: '竖屏', 总集数: 60, 首胜集: 3, 付费集: 11 })
    const outline = buildEpisodeOutline(plan.集大纲[0]!, {
      标题: '废物赘婿',
      核心想法: '所有人都以为他是废物赘婿。',
      爽点: '当众羞辱他的人不知道他是继承人。',
      开场冲突: '岳母逼他签离婚协议。',
      反转: ['他掏出一张黑卡。', '黑卡是继承人卡。'],
      结尾悬念: '他到底是谁？',
    })
    const text = renderSeasonOutline(plan, [outline])
    expect(text).toContain('市场：中文（题材档：中文男频）')
    expect(text).toContain('首胜集：第 3 集')
    expect(text).toContain('首个付费集：第 11 集')
    expect(text).toContain('## 集001：废物赘婿')
    expect(text).toContain('钩子类型：身份')
    expect(text).toContain('结尾悬念：他到底是谁？')
  })
})
