import { afterAll, describe, expect, it} from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  buildCharacterRegistry,
  checkCharacterNames,
  collectEpisodeNames,
  computeScreenplayExport,
  parseEpisodeScript,
  parseShotListTable,
  renderEpisodeMarkdown,
  renderEpisodeScript,
  renderShotListTable,
  renderStoryBible,
  validateShotList,
  validateStoryBible,
  type ShotList,
} from '../src/index'
import { NIGHT_MARKET_BIBLE, NIGHT_MARKET_EPISODE_001} from './alignment-fixtures'
import { removeSync} from '../src/repo/remove'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const exportExamplesDir = path.join(repoRoot, 'docs/examples/剧本导出示例')
const alignmentExample = path.join(exportExamplesDir, '短剧-分镜剧本示例-夜市摊主集001.md')

const roots: string[] = []
afterAll(() => roots.forEach((root) => removeSync(root)))

describe('阶段 4 对齐轮次：按《痴迷》参考案例对齐', () => {
  it('总纲渲染：七节齐全（类型/形式/文字目标/叙事线→故事一句话→开篇承诺→世界硬约束→三段核心真相→人物弧含曾误标→分集结构）', () => {
    const text = renderStoryBible(NIGHT_MARKET_BIBLE)
    expect(text).toContain('# 《夜市摊主》总纲（剧本圣经）')
    expect(text).toContain('类型：都市美食／身份反转／温情治愈')
    expect(text).toContain('文字目标：分镜拉片剧本每集约3,000—5,000字')
    expect(text).toContain('叙事：陈默摆摊求生与身份揭晓为主线（A线）')
    expect(text).toContain('一、故事一句话')
    expect(text).toContain('二、开篇承诺与中心问题')
    expect(text).toContain('开篇：夜市收摊前，陈默拒绝了美食博主林晓十万买配方的出价。')
    expect(text).toContain('悬念：1. 小满炒饭的配方到底从哪来')
    expect(text).toContain('主题：手艺与尊严比名声更难守')
    expect(text).toContain('反题：靠噱头和流量换来的爆红')
    expect(text).toContain('三、世界硬约束与地理')
    expect(text).toContain('• 现实基底与唯一超自然规则：江南小城夜市')
    expect(text).toContain('四、三段核心真相（作者事实，不等于所有角色已知）')
    expect(text).toContain('【第一阶段：隐姓埋名的摊主（第1—4集）】陈默三年前离开米其林')
    expect(text).toContain('【第三阶段：真相与归来（第9—12集）】小满的身世揭开')
    expect(text).toContain('')
    expect(text).toContain('五、主要人物与人物弧（全剧统一规范）')
    expect(text).toContain('1. 陈默（35岁）：前米其林主厨，现夜市炒饭摊主。')
    expect(text).toContain('（原剧本曾误标为：摊主[第1集]、厨子[第2集]，已全部统一为陈默）')
    expect(text).toContain('六、分集结构与时间锚点')
    expect(text).toContain('• 第一幕：身份藏匿')
    expect(text).toContain('- 第1集（D1 夜晚）：收摊前最后一份炒饭，陈默拒绝了林晓十万买配方的出价。')
    expect(text).toContain('- 第12集（D8 清晨）：陈默接回小满，铁锅有了新的主人。')
    expect(text).toContain('> 语言规则：说明/场景/动作文字一律中文；对白按目标市场语言（本剧对白语言：中文）。')
    // 确定性：重复渲染字节相同
    expect(renderStoryBible(NIGHT_MARKET_BIBLE)).toBe(text)
  })

  it('总纲校验：缺节/三段不对/人物重名/集号不连续都报问题', () => {
    expect(validateStoryBible(NIGHT_MARKET_BIBLE).ok).toBe(true)
    expect(validateStoryBible({...NIGHT_MARKET_BIBLE, 故事一句话: ' '}).ok).toBe(false)
    expect(validateStoryBible({...NIGHT_MARKET_BIBLE, 三段核心真相: NIGHT_MARKET_BIBLE.三段核心真相.slice(0, 2)}).problems.some((p) => p.includes('三段'))).toBe(true)
    expect(validateStoryBible({...NIGHT_MARKET_BIBLE, 分集结构: [...NIGHT_MARKET_BIBLE.分集结构.slice(0, 5), ...NIGHT_MARKET_BIBLE.分集结构.slice(6)]}).ok).toBe(false)
    expect(() => renderStoryBible({...NIGHT_MARKET_BIBLE, 对白语言: ''})).toThrow('对白语言')
  })

  it('人名注册表 + 导出前检查：标准名通过，误标名点名纠正，未登记报错', () => {
    const registry = buildCharacterRegistry(NIGHT_MARKET_BIBLE)
    expect(registry).toHaveLength(4)
    expect(registry[0]).toEqual({ 标准名: '陈默', 曾误标名: ['摊主[第1集]', '厨子[第2集]']})
    expect(checkCharacterNames(registry, ['陈默', '小满', '老周', '林晓']).ok).toBe(true)
    const mislabel = checkCharacterNames(registry, ['陈默', '摊主[第1集]'])
    expect(mislabel.ok).toBe(false)
    expect(mislabel.problems[0]).toContain('曾误标名')
    expect(mislabel.problems[0]).toContain('陈默')
    const unknown = checkCharacterNames(registry, ['陈默', '神秘人'])
    expect(unknown.ok).toBe(false)
    expect(unknown.problems[0]).toContain('未登记')
    // 注意：注册表只认精确的曾误标串；裸写「摊主」是不在册的名字，按未登记报
    expect(checkCharacterNames(registry, ['摊主']).problems[0]).toContain('未登记')
  })

  it('分镜剧本渲染—解析往返一致：场头/人物/场景环境/镜头块五字段/对白标注/环境声/字幕/无面部/集末淡出', () => {
    const rendered = renderEpisodeScript(NIGHT_MARKET_EPISODE_001)
    expect(rendered.警告).toEqual([])
    const text = rendered.内容
    expect(text).toContain('# 集001：最后一份炒饭')
    expect(text).toContain('1-1 夜／外 夜市东街')
    expect(text).toContain('人物：陈默（围裙摊主）、林晓（美食博主）')
    expect(text).toContain('场景环境：夜市东街尽头。陈默的炒饭摊支在路灯下，铁锅冒着热气，摊前排着三四个人。')
    expect(text).toContain('△')
    expect(text).toContain('△陈默右手颠锅，左手撒入一把葱花。')
    expect(text).toContain('林晓(语速较快，音量正常，语调上扬，尾音上扬)：老板，再来一份！')
    expect(text).toContain('')
    expect(text).toContain('△')
    expect(text).toContain('')
    expect(text).toContain('△')
    expect(text).toContain('')
    expect(text).toContain('')
    expect(text).toContain('## 节拍表')
    const parsed = parseEpisodeScript(text)
    expect(parsed.ok, parsed.problems.join('；')).toBe(true)
    expect(parsed.episode).toEqual(NIGHT_MARKET_EPISODE_001)
    expect(renderEpisodeScript(parsed.episode!).内容).toBe(text)
  })

  it('无分镜头数据的场出一镜模板行（五字段填 —），不编造导演决定', () => {
    const plain: typeof NIGHT_MARKET_EPISODE_001 = {
      ...NIGHT_MARKET_EPISODE_001,
      场景: NIGHT_MARKET_EPISODE_001.场景.map((s) => {
        const { 镜头: _shots, 人物: _people, 场景环境: _setting,...rest} = s
        return rest
      }),
    }
    const rendered = renderEpisodeScript(plain)
    expect(rendered.内容).toContain('1-1 夜／外 夜市东街')
    expect(rendered.内容).toContain('△')
    expect(rendered.内容).toContain('△夜市东街尽头。陈默的炒饭摊支在路灯下，铁锅冒着热气，摊前排着三四个人。')
    expect(rendered.内容).not.toContain('人物：')
    const parsed = parseEpisodeScript(rendered.内容)
    expect(parsed.ok, parsed.problems.join('；')).toBe(true)
    expect(renderEpisodeScript(parsed.episode!).内容).toBe(rendered.内容)
  })

  it('镜头校验：镜头号不连续、时间码越界、空描写都阻断；旧版场头报迁移提示', () => {
    const withShot = (sceneIdx: number, shotIdx: number, patch: Partial<{ 镜头号: number; 结束秒: number; 描写: readonly string[] }>): typeof NIGHT_MARKET_EPISODE_001 => ({
      ...NIGHT_MARKET_EPISODE_001,
      场景: NIGHT_MARKET_EPISODE_001.场景.map((s, i) => (i !== sceneIdx ? s : {
        ...s,
        镜头: s.镜头!.map((sh, j) => (j !== shotIdx ? sh : { ...sh, ...patch })),
      })),
    })
    expect(() => renderEpisodeScript(withShot(1, 0, { 镜头号: 99 }))).toThrow('镜头号须从 1 起集内连续')
    expect(() => renderEpisodeScript(withShot(2, 2, { 结束秒: 120 }))).toThrow('超出单集时长')
    expect(() => renderEpisodeScript(withShot(0, 0, { 描写: [] }))).toThrow('至少要有一行')
    const legacy = renderEpisodeScript(NIGHT_MARKET_EPISODE_001).内容.replace('1-1 夜／外 夜市东街', '## 场01. 夜市东街 夜 外')
    const parsed = parseEpisodeScript(legacy)
    expect(parsed.ok).toBe(false)
    expect(parsed.problems.some((p) => p.includes('旧版场头'))).toBe(true)
  })

  it('分镜头表新版 13 列渲染—解析往返一致；旧版 10 列仍可解析（摄法→角度）', () => {
    const shotList: ShotList = {
      标题: '夜市摊主 集001',
      镜: [
        {
          镜号: 1, 场号: 1, 景别: '近景', 角度: '平视正面', 运镜: '固定镜头',
          时间: '00:00—00:08', 时长秒: 8, 画面内容: '陈默颠锅，林晓举手机拍。',
          台词: '老板，再来一份！', 对白标注: '语速较快，音量正常，语调上扬，尾音上扬',
          音响: '铁锅翻炒声', 字幕: '—', 音乐: '—',
        },
        {
          镜号: 2, 场号: 1, 景别: '特写', 角度: '平视正面', 运镜: '固定镜头',
          时间: '00:08—00:16', 时长秒: 8, 画面内容: '手部与铁锅特写。',
          台词: '小满炒饭，不外卖。', 对白标注: '语速缓慢，音量偏低，语调平稳，尾音轻落',
          音响: '—', 字幕: '小满炒饭', 音乐: '—',
        },
      ],
    }
    const rendered = renderShotListTable(shotList)
    expect(rendered).toContain('| 镜号 | 场 | 景别 | 角度 | 运镜 | 时间 | 时长（秒） | 画面内容 | 台词 | 对白标注 | 音响 | 字幕 | 音乐 |')
    const reparsed = parseShotListTable(`# 分镜头表：夜市摊主 集001\n\n${rendered}\n`)
    expect(reparsed.ok, reparsed.problems.join('；')).toBe(true)
    expect(reparsed.shotList).toEqual({ 标题: '分镜头表：夜市摊主 集001', 镜: shotList.镜})
    expect(validateShotList(shotList, 3).ok).toBe(true)
    const legacy = [
      '| 镜号 | 场 | 景别 | 摄法 | 运镜 | 时长（秒） | 画面内容 | 台词 | 音响 | 音乐 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      '| 1 | 1 | 近景 | 平视正面 | 固定镜头 | 8 | 陈默颠锅。 | 老板，再来一份！ | 铁锅翻炒声 | — |',
      '',
    ].join('\n')
    const legacyParsed = parseShotListTable(legacy)
    expect(legacyParsed.ok, legacyParsed.problems.join('；')).toBe(true)
    expect(legacyParsed.shotList!.镜[0]!.角度).toBe('平视正面')
    expect(legacyParsed.shotList!.镜[0]!.时间).toBe('—')
    expect(legacyParsed.shotList!.镜[0]!.对白标注).toBe('—')
    expect(legacyParsed.shotList!.镜[0]!.字幕).toBe('—')
    const badTime = renderShotListTable({ 标题: '测试', 镜: [{...shotList.镜[0]!, 时间: '00:08—00:00'}]})
    expect(parseShotListTable(badTime).ok).toBe(false)
  })

  it('computeScreenplayExport 接总纲：渲染总纲文件 + 人名检查通过；误标名阻断', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-alignment-'))
    roots.push(workspace)
    const root = path.join(workspace, '夜市摊主')
    fs.mkdirSync(path.join(root, '剧本/短剧'), { recursive: true})
    fs.writeFileSync(path.join(root, '剧本/短剧/集001.md'), renderEpisodeScript(NIGHT_MARKET_EPISODE_001).内容)
    const ok = computeScreenplayExport(root, { 形态: '短剧', 集: 1, 总纲: NIGHT_MARKET_BIBLE})
    expect(ok.ok, ok.gaps.join('；')).toBe(true)
    expect(ok.总纲文件).toBe('夜市摊主-总纲.md')
    expect(ok.总纲).toBe(renderStoryBible(NIGHT_MARKET_BIBLE))
    expect(ok.人名检查).toEqual({ ok: true, problems: []})
    expect(ok.markdown).toContain('△')
    expect(ok.markdown).toContain('')
    // 误标名：把集里一个角色改成曾误标串，导出必须阻断
    const mislabelled = renderEpisodeScript(NIGHT_MARKET_EPISODE_001).内容.replaceAll('陈默', '摊主[第1集]')
    fs.writeFileSync(path.join(root, '剧本/短剧/集001.md'), mislabelled)
    const blocked = computeScreenplayExport(root, { 形态: '短剧', 集: 1, 总纲: NIGHT_MARKET_BIBLE})
    expect(blocked.ok).toBe(false)
    expect(blocked.gaps.some((g) => g.includes('曾误标名') && g.includes('陈默'))).toBe(true)
    // 不传总纲时不做人名检查、不渲染总纲
    const noBible = computeScreenplayExport(root, { 形态: '短剧', 集: 1})
    expect(noBible.ok).toBe(true)
    expect(noBible.总纲文件).toBe('')
    expect(noBible.人名检查).toEqual({ ok: true, problems: []})
    expect(collectEpisodeNames(NIGHT_MARKET_EPISODE_001)).toEqual(['林晓', '陈默', '老周', '小满'])
  })

  it('对齐示例文件与渲染输出逐字节一致（示例不是手写稿）', () => {
    const expected = `${renderStoryBible(NIGHT_MARKET_BIBLE)}\n${renderEpisodeScript(NIGHT_MARKET_EPISODE_001).内容}`
    expect(fs.readFileSync(alignmentExample, 'utf-8')).toBe(expected)
    // Markdown 导出的编剧层与单集渲染同一口径
    const md = renderEpisodeMarkdown(NIGHT_MARKET_EPISODE_001, {
      标题: '夜市摊主 集001',
      镜: [],
    })
    expect(md).toContain('△')
    expect(md).toContain('')
  })
})
