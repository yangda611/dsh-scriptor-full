import { describe, expect, it } from 'vitest'
import { checkEpisodeBeats, checkSeasonBeats, requiredTurns, 起承转合时长门槛秒 } from '../src/shortdrama/beat-checker'
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
    开场冲突秒: 3,
    有片头: false,
    有开场铺垫: false,
    反转秒: [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450,
      475, 500, 525, 550, 575, 600, 625, 650, 675, 700, 725],
    结尾钩子秒: 892,
    钩子类型: '身份',
    结尾切在问题上: true,
    首次胜利: false,
    起承转合: { 起: true, 承: true, 转: true, 合: true },
    ...over,
  }
}

function rule(check: { 规则: readonly { 规则: string; 状态: string; 原因: string }[] }, name: string) {
  const found = check.规则.find((r) => r.规则 === name)
  if (found === undefined) throw new Error(`找不到规则 ${name}`)
  return found
}

describe('阶段 3：节拍检查器（共用节拍规则，两画幅同一条检查路径）', () => {
  it('requiredTurns 公式：60 秒→1，90 秒→2，600 秒→19，900 秒→29', () => {
    expect(requiredTurns(60)).toBe(1)
    expect(requiredTurns(90)).toBe(2)
    expect(requiredTurns(120)).toBe(3)
    expect(requiredTurns(600)).toBe(19)
    expect(requiredTurns(900)).toBe(29)
    expect(requiredTurns(0)).toBe(1)
  })

  it('全过的一集：开场 3 秒、无片头、反转 25/55 秒、结尾 82 秒切在问题上', () => {
    const check = checkEpisodeBeats(verticalBeats())
    expect(check.通过).toBe(true)
    expect(check.规则.every((r) => r.状态 === '通过' || r.状态 === '不适用')).toBe(true)
    // 90 秒一集不到起承转合门槛，该规则为不适用
    expect(rule(check, '起承转合四段齐全').状态).toBe('不适用')
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

  it('横屏长集：900 秒一集 29 个转折全过；少一个、首次晚于 30 秒都未通过', () => {
    const check = checkEpisodeBeats(horizontalBeats())
    expect(check.通过).toBe(true)
    expect(rule(check, '每20至30秒一个反转').状态).toBe('通过')
    expect(rule(check, '每20至30秒一个反转').说明).toContain('至少 29 个反转')
    const short = horizontalBeats({ 反转秒: horizontalBeats().反转秒.slice(0, 28) })
    expect(rule(checkEpisodeBeats(short), '每20至30秒一个反转').状态).toBe('未通过')
    const late = horizontalBeats({ 反转秒: [35, 60, 85, 110, 135, 160, 185, 210, 235, 260, 285, 310, 335, 360, 385, 410, 435, 460, 485, 510, 535, 560, 585, 610, 635, 660, 685, 710, 735] })
    expect(rule(checkEpisodeBeats(late), '每20至30秒一个反转').状态).toBe('未通过')
  })

  it('横屏长集也按 5 秒进冲突、结尾 5–10 秒留悬念检查，不再放宽', () => {
    expect(rule(checkEpisodeBeats(horizontalBeats({ 开场冲突秒: 45 })), '开场冲突5秒内').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(horizontalBeats({ 结尾钩子秒: 860 })), '结尾5至10秒留悬念').状态).toBe('未通过')
    expect(rule(checkEpisodeBeats(horizontalBeats({ 有片头: true })), '无片头无铺垫').状态).toBe('未通过')
    // 横屏旧规则 id 已删除
    const ids = checkEpisodeBeats(horizontalBeats()).规则.map((r) => r.规则)
    expect(ids).not.toContain('开场首场即冲突')
    expect(ids).not.toContain('每集至少2个转折')
    expect(ids).not.toContain('结尾1分钟内留悬念')
  })

  it('起承转合只看时长：90 秒一集不适用；600 秒一集不全未通过，齐全才通过', () => {
    expect(起承转合时长门槛秒).toBe(600)
    expect(rule(checkEpisodeBeats(verticalBeats()), '起承转合四段齐全').状态).toBe('不适用')
    const long = horizontalBeats({ 时长秒: 600, 反转秒: [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475], 结尾钩子秒: 595 })
    expect(rule(checkEpisodeBeats(long), '起承转合四段齐全').状态).toBe('通过')
    const incomplete = { ...long, 起承转合: { 起: true, 承: true, 转: false, 合: true } }
    expect(rule(checkEpisodeBeats(incomplete), '起承转合四段齐全').状态).toBe('未通过')
    const missing = horizontalBeats({ 时长秒: 600, 反转秒: [25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475], 结尾钩子秒: 595, 起承转合: undefined })
    expect(rule(checkEpisodeBeats(missing), '起承转合四段齐全').状态).toBe('未通过')
  })

  it('同集同数据只换画幅：竖屏 90 秒与横屏 90 秒节拍结构完全相同（只差画幅字段）', () => {
    const vertical = checkEpisodeBeats(verticalBeats())
    const horizontal = checkEpisodeBeats(verticalBeats({ 画幅: '横屏' }))
    expect(horizontal.画幅).toBe('横屏')
    expect(horizontal.规则).toEqual(vertical.规则)
    expect(horizontal.通过).toBe(vertical.通过)
    // 反过来也一样：横屏数据改竖屏，规则不变
    const h900 = checkEpisodeBeats(horizontalBeats())
    const v900 = checkEpisodeBeats(horizontalBeats({ 画幅: '竖屏' }))
    expect(v900.规则).toEqual(h900.规则)
  })

  it('旧字段 首场冲突 不再参与判定：填 false 也不影响通过', () => {
    const check = checkEpisodeBeats(verticalBeats({ 首场冲突: false }))
    expect(check.通过).toBe(true)
    expect(check.规则.some((r) => r.规则 === '开场首场即冲突')).toBe(false)
  })

  it('季级：钩子轮换断裂、前三集顺序错报出哪集哪条；首胜/付费墙不再是节拍规则', () => {
    const season = checkSeasonBeats([
      verticalBeats({ 集: 1, 钩子类型: '身份' }),
      verticalBeats({ 集: 2, 钩子类型: '身份' }),
      verticalBeats({ 集: 3, 钩子类型: '顿悟', 首次胜利: true }),
    ], { 付费集: 12 })
    expect(season.全部通过).toBe(false)
    expect(season.未通过清单.some((s) => s.includes('钩子类型轮换') && s.includes('集002'))).toBe(true)
    expect(season.未通过清单.some((s) => s.includes('前三集钩子顺序') && s.includes('集002'))).toBe(true)
    // 首胜在第 3 集、付费集 12 都不再报（平台说明，不是节拍规则；opts.付费集已忽略）
    expect(season.未通过清单.some((s) => s.includes('首次胜利不晚于第5集'))).toBe(false)
    expect(season.未通过清单.some((s) => s.includes('付费墙在第10至11集'))).toBe(false)
    expect(season.季级规则.map((r) => r.规则)).toEqual(['钩子类型轮换', '前三集钩子顺序'])
  })

  it('季级：三集钩子 身份→情感→顿悟、轮换不断就全部通过（不再要求首胜标注）', () => {
    const ok = checkSeasonBeats([
      verticalBeats({ 集: 1, 钩子类型: '身份' }),
      verticalBeats({ 集: 2, 钩子类型: '情感' }),
      verticalBeats({ 集: 3, 钩子类型: '顿悟' }),
    ])
    expect(ok.全部通过).toBe(true)
    expect(ok.未通过清单).toEqual([])
    const horizontal = checkSeasonBeats([
      horizontalBeats({ 集: 1, 钩子类型: '身份' }),
      horizontalBeats({ 集: 2, 钩子类型: '情感' }),
      horizontalBeats({ 集: 3, 钩子类型: '顿悟' }),
    ])
    expect(horizontal.全部通过).toBe(true)
  })
})
