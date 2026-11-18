import { afterAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { assembleMaterials, paths, serializeDocument } from '../src/index'
import { checkEpisodeCraft, collectEpisodeProtectiveNotes } from '../src/shortdrama/episode-checks'
import { reviewShortDramaEpisode } from '../src/shortdrama/review'
import type { EpisodeOutline, EpisodeScriptInput } from '../src/shortdrama/types'
import { makeFixtureBook } from './helpers/fixture-book'

const roots: string[] = []
afterAll(() => {
  for (const root of roots) {
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch { /* ignore */ }
  }
})

function makeOutline(overrides: Partial<EpisodeOutline> = {}): EpisodeOutline {
  return {
    集: 1,
    标题: '暴雨夜债主上门',
    钩子类型: '身份钩',
    核心想法: '外卖员当众甩出冻结令反将债主',
    爽点: '当场打脸扣车恶霸',
    开场冲突: '恶霸一脚踩碎外卖箱逼签抵债合同',
    反转: ['掏出加密权证', '银行来电冻结恶霸账户'],
    结尾悬念: '神秘电话那头到底是谁？',
    ...overrides,
  }
}

function makeScript(overrides: Partial<EpisodeScriptInput> = {}): EpisodeScriptInput {
  return {
    集: 1,
    标题: '暴雨夜债主上门',
    画幅: '竖屏',
    钩子类型: '身份钩',
    核心想法: '外卖员当众甩出冻结令反将债主',
    爽点: '当场打脸扣车恶霸',
    时长秒: 90,
    结尾悬念: '神秘电话那头到底是谁？',
    开场冲突秒: 3,
    反转秒: [25, 70],
    结尾钩子秒: 85,
    场景: [
      {
        场: 1,
        地点: '老巷门口',
        时间: '夜',
        内外: '外',
        动作: '暴雨浇湿石阶，赵虎一脚踩扁林凡的外卖箱。',
        台词: [{ 角色: '赵虎', 台词: '欠债还钱' }],
        镜头: [
          {
            镜头号: 1,
            开始秒: 0,
            结束秒: 15,
            景别: '近景',
            角度: '平视正面',
            运镜: '固定镜头',
            描写: ['赵虎一脚踩扁外卖箱，把欠条拍在林凡脸上。'],
            台词: [{ 角色: '赵虎', 台词: '今天不签字，腿留下。' }],
          },
          {
            镜头号: 2,
            开始秒: 15,
            结束秒: 85,
            景别: '中景',
            角度: '平视正面',
            运镜: '推进',
            描写: ['林凡掏出烫金冻结令按在桌角，一把掀翻账桌。'],
            台词: [
              { 角色: '林凡', 台词: '查查你名下账户。' },
              { 角色: '赵虎', 台词: '你敢冻结我三个亿？' },
            ],
          },
        ],
      },
      {
        场: 2,
        地点: '巷口车旁',
        时间: '夜',
        内外: '外',
        动作: '赵虎手机刺耳震动。',
        台词: [{ 角色: '赵虎', 台词: '谁打来的' }],
        镜头: [
          {
            镜头号: 3,
            开始秒: 85,
            结束秒: 90,
            景别: '特写',
            角度: '正面',
            运镜: '固定镜头',
            描写: ['屏幕亮起加密号码，林凡缓缓转身走入雨幕。'],
            台词: [{ 角色: '赵虎', 台词: '您怎么找来了？' }],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('短剧工艺确定性检查（吸收 short-drama-factory v4.9）与质量模式备料', () => {
  it('命中合规红线 E10 立即产出高危阻断发现项', () => {
    const script = makeScript({
      场景: [{
        场: 1, 地点: '暗室', 时间: '夜', 内外: '内', 动作: '威胁下蛊害人。',
        台词: [{ 角色: '甲', 台词: '准备下蛊害人' }],
        镜头: [{ 镜头号: 1, 开始秒: 0, 结束秒: 10, 景别: '近景', 角度: '正面', 运镜: '固定镜头', 描写: ['桌上摆满毒瓶，威胁下蛊害人。'], 台词: [{ 角色: '甲', 台词: '别动。' }] }],
      }],
    })
    const findings = checkEpisodeCraft(script)
    expect(findings.some((f) => f.问题说明.includes('E10') && f.是否建议阻断 && f.严重程度 === '高')).toBe(true)
  })

  it('分镜头连续 7 句以上纯对白无动作报 E24 干聊断层；穿插 △ 后通过', () => {
    const dryLines = Array.from({ length: 7 }, (_, i) => ({ 角色: i % 2 === 0 ? '甲' : '乙', 台词: `第${i + 1}句对白。` }))
    const bad = makeScript({
      场景: [{
        场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '两人对坐。',台词: dryLines,
        镜头: [{ 镜头号: 1, 开始秒: 0, 结束秒: 45, 景别: '中景', 角度: '正面', 运镜: '固定镜头', 描写: ['两人坐在沙发前。'], 台词: dryLines }],
      }],
    })
    expect(checkEpisodeCraft(bad).some((f) => f.问题说明.includes('E24'))).toBe(true)
    expect(checkEpisodeCraft(makeScript()).some((f) => f.问题说明.includes('E24'))).toBe(false)
  })

  it('无效微动作 E26 拦截孤立眼神微动，放行微神态+强物理动作组合', () => {
    const weakOnly = makeScript({
      场景: [{
        场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '甲站定。',
        台词: [{ 角色: '甲', 台词: '站住' }],
        镜头: [{ 镜头号: 1, 开始秒: 0, 结束秒: 10, 景别: '近景', 角度: '正面', 运镜: '固定镜头', 描写: ['林凡微微一怔，眼神微动。'], 台词: [{ 角色: '林凡', 台词: '签吧。' }] }],
      }],
    })
    expect(checkEpisodeCraft(weakOnly).some((f) => f.问题说明.includes('E26'))).toBe(true)

    const combo = makeScript({
      场景: [{
        场: 1, 地点: '客厅', 时间: '日', 内外: '内', 动作: '甲拍桌。',
        台词: [{ 角色: '甲', 台词: '站住' }],
        镜头: [{ 镜头号: 1, 开始秒: 0, 结束秒: 10, 景别: '近景', 角度: '正面', 运镜: '固定镜头', 描写: ['林凡微微一怔，手里茶杯啪地砸碎在地。'], 台词: [{ 角色: '林凡', 台词: '签吧。' }] }],
      }],
    })
    expect(checkEpisodeCraft(combo).some((f) => f.问题说明.includes('E26'))).toBe(false)
  })

  it('E25 拦截未翻译黑话，放行同轮或下一句大白话翻译', () => {
    const riddleOnly = makeScript({
      场景: [{
        场: 1, 地点: '大堂', 时间: '日', 内外: '内', 动作: '对峙。',
        台词: [{ 角色: '甲', 台词: '因果闭环已成。' }, { 角色: '乙', 台词: '哼。' }],
        镜头: [{
          镜头号: 1, 开始秒: 0, 结束秒: 20, 景别: '近景', 角度: '正面', 运镜: '固定镜头',
          描写: ['甲甩出图纸。'],
          台词: [{ 角色: '甲', 台词: '因果闭环已经合拢了。' }, { 角色: '乙', 台词: '别故弄玄虚。' }],
        }],
      }],
    })
    expect(checkEpisodeCraft(riddleOnly).some((f) => f.问题说明.includes('E25'))).toBe(true)

    const grounded = makeScript({
      场景: [{
        场: 1, 地点: '大堂', 时间: '日', 内外: '内', 动作: '对峙。',
        台词: [{ 角色: '甲', 台词: '因果闭环已成。' }, { 角色: '乙', 台词: '意思就是赔五百万！' }],
        镜头: [{
          镜头号: 1, 开始秒: 0, 结束秒: 20, 景别: '近景', 角度: '正面', 运镜: '固定镜头',
          描写: ['甲把欠条拍在桌上。'],
          台词: [{ 角色: '甲', 台词: '因果闭环已经合拢了。' }, { 角色: '乙', 台词: '就是你今早要赔光三套房。' }],
        }],
      }],
    })
    expect(checkEpisodeCraft(grounded).some((f) => f.问题说明.includes('E25'))).toBe(false)
  })

  it('保护性反例 N12 识别快问快答合法碎句，E5 识别开篇慢热废镜头', () => {
    const fast = makeScript({
      场景: [{
        场: 1, 地点: '街头', 时间: '夜', 内外: '外', 动作: '拉窗帘醒过来。',
        台词: Array.from({ length: 5 }, () => ({ 角色: '甲', 台词: '别动！' })),
        镜头: [{
          镜头号: 1, 开始秒: 0, 结束秒: 15, 景别: '近景', 角度: '正面', 运镜: '固定镜头',
          描写: ['主角早晨起床拉窗帘。'],
          台词: Array.from({ length: 5 }, () => ({ 角色: '甲', 台词: '说谁？' })),
        }],
      }],
    })
    expect(collectEpisodeProtectiveNotes(fast).some((n) => n.code === 'N12')).toBe(true)
    expect(reviewShortDramaEpisode({ 剧本: fast, 大纲: makeOutline() }).some((f) => f.问题说明.includes('E5'))).toBe(true)
  })

  it('质量模式备料自动纳入世界书同名角色、完整契约/骨架与扩展预算，默认模式保持规模不变量', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webnovel-quality-assembly-'))
    roots.push(root)
    makeFixtureBook(root, 10)
    const put = (rel: string, content: string) => {
      const abs = path.join(root, rel)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, content, 'utf8')
    }
    put(paths.契约(), serializeDocument({ 状态: '已确认' }, [
      '# 作品契约', '',
      '## 题材与读者定位', '', '冷峻悬疑推理。', '',
      '## 核心看点与差异化', '', '微物证倒推人心暗流。', '',
      '## 叙事方式与文风基调', '', '克制白描。', '',
      '## 创作禁区与不可妥协项', '', '- 〔硬〕主角不降智。', '',
    ].join('\n')))
    put('世界书/人物/沈砚.md', '---\n名称: 沈砚\n状态: 已确认\n---\n\n老练的刑侦法医。\n')
    put(paths.故事骨架(), serializeDocument({ 状态: '已确认' }, '# 故事骨架\n\n## 核心冲突与对抗力量\n\n追查十年前悬案真凶。\n'))
    const key11 = { 卷: 1, 章: 11, 章名: '章11' }
    put(
      paths.确认细纲(1, 11, '章11'),
      serializeDocument({ 状态: '已确认', 版本: 1 }, '# 章11\n\n## 正文\n\n沈砚独自走入停尸间检查物证。\n\n## 来源引用\n\n- 作品契约/契约.md\n'),
    )

    const res = assembleMaterials(root, { ...key11, 质量模式: true })
    expect(res.ok).toBe(true)
    const dir = path.join(root, paths.材料包目录(1, '章11'))
    const wbSection = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.includes('人物、关系'))!), 'utf8')
    expect(wbSection).toContain('老练的刑侦法医')
    const noteSection = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.includes('暂定与警告'))!), 'utf8')
    expect(noteSection).toContain('微物证倒推人心暗流')
    expect(noteSection).toContain('追查十年前悬案真凶')
  })
})
