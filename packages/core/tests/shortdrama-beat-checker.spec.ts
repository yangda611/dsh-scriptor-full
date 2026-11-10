import { describe, expect, it } from 'vitest'
import { checkEpisodeBeats, checkSeasonBeats } from '../src/shortdrama/beat-checker'
import type { EpisodeBeats } from '../src/shortdrama/types'

function verticalBeats(over: Partial<EpisodeBeats> = {}): EpisodeBeats {
  return {
    集: 1,
    画幅: '竖屏',
    时长秒: 90,
    开场冲突秒: 3,
    有片头: false,
    有开场铺垫: false,
    反转秒: [25, 55],
    结尾钩子秒: 82,
    钩子类型: '身份',
    结尾切在问题上: true,
    首次胜利: false,
    ...over,
  }
}

function horizontalBeats(over: Partial<EpisodeBeats> = {}): EpisodeBeats {
  return {
    集: 1,
    画幅: '横屏',
    时长秒: 900,
    开场冲突秒: 45,
    有片头: false,
    有开场铺垫: false,
    反转秒: [300, 620],
    结尾钩子秒: 860,
    钩子类型: '身份',
    结尾切在问题上: true,
    首次胜利: false,
    首场冲突: true,
    起承转合: { 起: true, 承: true, 转: true, 合: true },
    ...over,
  }
}

function rule(check: { 规则: readonly { 规则: string; 状态: string; 原因: string }[] }, name: string) {
  const found = check.规则.find((r) => r.规则 === name)
  if (found === undefined) throw new Error(`找不到规则 ${name}`)
  return found
}

describe('阶段 3：节拍检查器（竖屏）', () => {
  it('全过的一集：开场 3 秒、无片头、反转 25/55 秒、结尾 82 秒切在问题上', () => {
    const check = checkEpisodeBeats(verticalBeats())
    expect(check.通过).toBe(true)
    expect(check.规则.every((r) => r.状态 === '通过')).toBe(true)
  })

  it('开场冲突晚于 5 秒未通过，报出集号与秒数', () => {
    const bad = rule(checkEpisodeBeats(verticalBeats({ 开场冲突秒: 8 })), '开场冲突5秒内')
    expect(bad.状态).toBe('未通过')
    expect(bad.原因).toContain('集001')
    expect(bad.原因).toContain('第 8 秒')
  })

  it('有片头 / 有开场铺垫未通过', () => {
    expect(rule(checkEpisodeBeats(verticalBeats({ 有片头: true })), '无片头无铺垫').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(verticalBeats({ 有开场铺垫: true })), '无片头无铺垫').状态).toBe('未通过')
  })

  it('反转密度：90 秒一集少于 2 个反转、首次反转晚于 30 秒、间隔超出 20–30 秒都未通过', () => {
    expect(rule(checkEpisodeBeats(verticalBeats({ 反转秒: [25] })), '每20至30秒一个反转').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(verticalBeats({ 反转秒: [35, 60] })), '每20至30秒一个反转').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(verticalBeats({ 反转秒: [25, 60] })), '每20至30秒一个反转').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(verticalBeats({ 反转秒: [25, 50] })), '每20至30秒一个反转').状态).toBe('通过')
  })

  it('结尾钩子不在结尾 5–10 秒内、切在答案上都未通过', () => {
    expect(rule(checkEpisodeBeats(verticalBeats({ 结尾钩子秒: 70 })), '结尾5至10秒留悬念').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(verticalBeats({ 结尾钩子秒: 81 })), '结尾5至10秒留悬念').状态).toBe('通过')
    expect(rule(checkEpisodeBeats(verticalBeats({ 结尾切在问题上: false })), '切在问题上不是答案上').状态).toBe('未通过')
  })

  it('季级：钩子轮换断裂、前三集顺序错、首胜晚于第 5 集、付费墙不在 10–11 集都报出哪集哪条', () => {
    const season = checkSeasonBeats([
      verticalBeats({ 集: 1, 钩子类型: '身份' }),
      verticalBeats({ 集: 2, 钩子类型: '身份' }),
      verticalBeats({ 集: 3, 钩子类型: '顿悟', 首次胜利: true }),
    ], { 付费集: 12 })
    expect(season.全部通过).toBe(false)
    expect(season.未通过清单.some((s) => s.includes('钩子类型轮换') && s.includes('集002'))).toBe(true)
    expect(season.未通过清单.some((s) => s.includes('前三集钩子顺序') && s.includes('集002'))).toBe(true)
    expect(season.未通过清单.some((s) => s.includes('付费墙在第10至11集'))).toBe(true)
    // 首胜在第 3 集，通过，不应出现在未通过清单里
    expect(season.未通过清单.some((s) => s.includes('首次胜利不晚于第5集'))).toBe(false)
  })

  it('季级：全季无首胜标注未通过；付费集不传时为不适用', () => {
    const season = checkSeasonBeats([
      verticalBeats({ 集: 1, 钩子类型: '身份' }),
      verticalBeats({ 集: 2, 钩子类型: '情感' }),
      verticalBeats({ 集: 3, 钩子类型: '顿悟' }),
    ])
    expect(season.未通过清单.some((s) => s.includes('首次胜利不晚于第5集'))).toBe(true)
    const paywall = season.季级规则.find((r) => r.规则 === '付费墙在第10至11集')
    expect(paywall?.状态).toBe('不适用')
    const ok = checkSeasonBeats([
      verticalBeats({ 集: 1, 钩子类型: '身份' }),
      verticalBeats({ 集: 2, 钩子类型: '情感' }),
      verticalBeats({ 集: 3, 钩子类型: '顿悟', 首次胜利: true }),
    ], { 付费集: 11 })
    expect(ok.全部通过).toBe(true)
    expect(ok.未通过清单).toEqual([])
  })
})

describe('阶段 3：节拍检查器（横屏）', () => {
  it('全过的横屏一集：首场冲突、起承转合齐全、2 个转折、结尾 1 分钟内留悬念', () => {
    const check = checkEpisodeBeats(horizontalBeats())
    expect(check.通过).toBe(true)
  })

  it('竖屏秒数规则在横屏为不适用，不硬套 5 秒/20–30 秒', () => {
    const check = checkEpisodeBeats(horizontalBeats())
    expect(rule(check, '开场冲突5秒内').状态).toBe('不适用')
    expect(rule(check, '无片头无铺垫').状态).toBe('不适用')
    expect(check.规则.some((r) => r.规则 === '结尾5至10秒留悬念')).toBe(false)
    // 横屏用自己的结尾规则
    expect(rule(check, '结尾1分钟内留悬念').状态).toBe('通过')
  })

  it('横屏：首场无冲突、起承转合不全、转折不足 2 个、结尾钩子超出结尾 1 分钟都未通过', () => {
    expect(rule(checkEpisodeBeats(horizontalBeats({ 首场冲突: false })), '开场首场即冲突').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(horizontalBeats({ 起承转合: { 起: true, 承: true, 转: false, 合: true } })), '起承转合四段齐全').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(horizontalBeats({ 反转秒: [400] })), '每集至少2个转折').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(horizontalBeats({ 结尾钩子秒: 800 })), '结尾1分钟内留悬念').状态).toBe('未通过')
  })

  it('横屏季级：首胜与付费墙规则为不适用；钩子轮换与前三集顺序仍检查', () => {
    const season = checkSeasonBeats([
      horizontalBeats({ 集: 1, 钩子类型: '身份' }),
      horizontalBeats({ 集: 2, 钩子类型: '情感' }),
      horizontalBeats({ 集: 3, 钩子类型: '顿悟' }),
    ])
    const win = season.季级规则.find((r) => r.规则 === '首次胜利不晚于第5集')
    const pay = season.季级规则.find((r) => r.规则 === '付费墙在第10至11集')
    expect(win?.状态).toBe('不适用')
    expect(pay?.状态).toBe('不适用')
    expect(season.全部通过).toBe(true)
  })
})
