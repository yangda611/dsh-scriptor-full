import { afterAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  computeExport,
  computeScreenplayExport,
  deriveFilmStoryboard,
  deriveShotListTemplate,
  inspectScreenplayExportTarget,
  parseEpisodeScript,
  parseShotListTable,
  renderEpisodeFountain,
  renderEpisodeMarkdown,
  renderFilmStoryboardMarkdown,
  renderFountainScreenplay,
  renderScreenplayMarkdown,
  renderShotListTable,
  validateShotList,
  verifyScreenplayExportTarget,
  type ShotList,
} from '../src/index'
import { renderEpisodeScript } from '../src/shortdrama/script'
import { parseScreenplay } from '../src/screenplay/format'
import { removeSync } from '../src/repo/remove'
import { makeFixtureBook } from './helpers/fixture-book'
import { VALID_DRAFT, WANXING_BIBLE } from './screenplay-fixtures'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const filmExample = fs.readFileSync(path.join(repoRoot, 'docs/examples/电影剧本示例/剧本.md'), 'utf-8')
const episodeVertical001 = fs.readFileSync(path.join(repoRoot, 'examples/shortdrama/赘婿逆袭/竖屏/集001.md'), 'utf-8')
const episodeHorizontal001 = fs.readFileSync(path.join(repoRoot, 'examples/shortdrama/赘婿逆袭/横屏/集001.md'), 'utf-8')
const exportExamplesDir = path.join(repoRoot, 'docs/examples/剧本导出示例')

const roots: string[] = []
afterAll(() => roots.forEach((root) => removeSync(root)))

function filmBook(bookName: string, scriptText: string = filmExample): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-export-'))
  roots.push(workspace)
  const root = path.join(workspace, bookName)
  fs.mkdirSync(path.join(root, '剧本/电影'), { recursive: true })
  fs.writeFileSync(path.join(root, '剧本/电影/剧本.md'), scriptText)
  return root
}

function episodeBook(bookName: string, episodeText: string = episodeVertical001): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-export-'))
  roots.push(workspace)
  const root = path.join(workspace, bookName)
  fs.mkdirSync(path.join(root, '剧本/短剧'), { recursive: true })
  fs.writeFileSync(path.join(root, '剧本/短剧/集001.md'), episodeText)
  return root
}

function readShotList(name: string): ShotList {
  const parsed = parseShotListTable(fs.readFileSync(path.join(exportExamplesDir, name), 'utf-8'))
  expect(parsed.ok, parsed.problems.join('；')).toBe(true)
  return parsed.shotList!
}

describe('阶段 4：剧本导出格式（Fountain / Markdown 双输出 + 分镜头表）', () => {
  it('电影 Fountain：标题页 + FADE IN/OUT + 三段式场景标题 + 场号注释，(pause) 保留、无 SFX: 行', () => {
    const text = renderFountainScreenplay(VALID_DRAFT)
    expect(text).toContain('Title: 晚星')
    expect(text).toContain('FADE IN:')
    expect(text).toContain('FADE OUT.')
    expect(text).toContain('INT. 面馆 - 深夜')
    expect(text).toContain('/* 场01 */')
    expect(text).toContain('(pause)')
    expect(text).not.toMatch(/^SFX:|^MUSIC:/m)
    expect(text).not.toContain('(beat)')
    // 确定性：重复渲染字节相同
    expect(renderFountainScreenplay(VALID_DRAFT)).toBe(text)
  })

  it('电影 Markdown：编剧层逐字 + 导演层分镜头表 + 两层说明，导出说明里不出现 SFX: 独占行', () => {
    const shotList = deriveShotListTemplate('晚星', VALID_DRAFT.场.map((s) => ({
      场号: s.场号, 画面内容: s.动作[0] ?? '', 台词: s.台词段[0]?.台词[0] ?? '',
    })))
    const text = renderScreenplayMarkdown(VALID_DRAFT, shotList)
    expect(text).toContain('# 《晚星》电影剧本')
    expect(text).toContain('## 编剧层')
    expect(text).toContain('## 导演层')
    expect(text).toContain('| 镜号 | 场 | 景别 | 角度 | 运镜 | 时间 | 时长（秒） | 画面内容 | 台词 | 对白标注 | 音响 | 字幕 | 音乐 |')
    expect(text).toContain('场01 INT. 面馆 - 深夜')
    expect(text).toContain('(pause)')
    expect(text).not.toMatch(/^SFX:|^MUSIC:/m)
  })

  it('分镜头表渲染—解析往返一致：镜号/场号/时长/— 占位都不丢', () => {
    const shotList = readShotList('分镜头表-晚星.md')
    expect(shotList.镜).toHaveLength(12)
    expect(shotList.镜.map((r) => r.镜号)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(shotList.镜[6]!.音乐).toBe('低沉弦乐起')
    expect(shotList.镜[0]!.台词).toBe('—')
    const rendered = renderShotListTable(shotList)
    const reparsed = parseShotListTable(`# 分镜头表：晚星\n\n${rendered}\n`)
    expect(reparsed.ok, reparsed.problems.join('；')).toBe(true)
    expect(reparsed.shotList).toEqual({ 标题: '分镜头表：晚星', 镜: shotList.镜 })
  })

  it('分镜头表解析失败：表头不对、镜号不连续、场号越界、时长非法都报问题', () => {
    const badHeader = '| 镜号 | 场 | 景别 |\n| --- | --- | --- |\n| 1 | 1 | 全景 |\n'
    expect(parseShotListTable(badHeader).ok).toBe(false)
    const badDuration = '| 镜号 | 场 | 景别 | 角度 | 运镜 | 时间 | 时长（秒） | 画面内容 | 台词 | 对白标注 | 音响 | 字幕 | 音乐 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| 1 | 1 | 全景 | 平视正面 | 固定镜头 | — | 0 | 面馆。 | — | — | — | — | — |\n'
    expect(parseShotListTable(badDuration).ok).toBe(false)
    const template = deriveShotListTemplate('测试', [
      { 场号: 1, 画面内容: '面馆。', 台词: '吃面吗？' },
      { 场号: 2, 画面内容: '天台。', 台词: '—' },
    ])
    expect(template.镜.map((r) => r.镜号)).toEqual([1, 2])
    expect(template.镜[0]!.景别).toBe('—')
    const check = validateShotList(template, 2)
    expect(check.ok).toBe(true)
    expect(check.warnings.length).toBeGreaterThan(0)
    expect(check.warnings.some((w) => w.includes('待填'))).toBe(true)
    const outOfRange: ShotList = { 标题: '测试', 镜: [{ ...template.镜[0]!, 场号: 9 }] }
    expect(validateShotList(outOfRange, 2).ok).toBe(false)
  })

  it('单集剧本解析—渲染往返一致：竖屏/横屏集001 逐字节还原', () => {
    for (const source of [episodeVertical001, episodeHorizontal001]) {
      const parsed = parseEpisodeScript(source)
      expect(parsed.ok, parsed.problems.join('；')).toBe(true)
      expect(parsed.episode!.集).toBe(1)
      expect(renderEpisodeScript(parsed.episode!).内容).toBe(source)
    }
  })

  it('单集剧本解析：SFX: 独占行与 (beat) 记问题', () => {
    const withSfx = episodeVertical001.replace('岳母把离婚协议拍在顾霆琛面前，苏晚站在一旁。', 'SFX: 纸张拍桌声')
    expect(parseEpisodeScript(withSfx).ok).toBe(false)
    const withBeat = episodeVertical001.replace('(pause)', '(beat)')
    const beatParsed = parseEpisodeScript(withBeat)
    expect(beatParsed.ok).toBe(false)
    expect(beatParsed.problems.some((p) => p.includes('(beat)'))).toBe(true)
  })

  it('短剧 Fountain：中文场景转美式三段式，角色/台词/(pause) 齐全', () => {
    const parsed = parseEpisodeScript(episodeVertical001)
    expect(parsed.ok).toBe(true)
    const text = renderEpisodeFountain(parsed.episode!)
    expect(text).toContain('Title: 集001：废物赘婿')
    expect(text).toContain('INT. 苏家客厅 - 日')
    expect(text).toContain('EXT. 苏家门外 - 日')
    expect(text).toContain('/* 场01 */')
    expect(text).toContain('顾霆琛')
    expect(text).toContain('(pause)')
    expect(text).toContain('FADE IN:')
    expect(text).not.toMatch(/^SFX:|^MUSIC:/m)
    const md = renderEpisodeMarkdown(parsed.episode!, deriveShotListTemplate('集001', []))
    expect(md).toContain('## 编剧层')
    expect(md).toContain('## 节拍表')
    expect(md).toContain('## 导演层')
  })

  it('computeScreenplayExport 电影：双格式 + 导演已填分镜头表 + 审读零发现 + 确定性', () => {
    const root = filmBook('晚星')
    const shotList = readShotList('分镜头表-晚星.md')
    const result = computeScreenplayExport(root, { 形态: '电影剧本', 格式: 'both', 分镜头表: shotList })
    expect(result.ok, result.gaps.join('；')).toBe(true)
    expect(result.书名).toBe('晚星')
    expect(result.标题).toBe('晚星')
    expect(result.场景数).toBe(8)
    expect(result.fountain文件).toBe('晚星-电影剧本.fountain')
    expect(result.markdown文件).toBe('晚星-电影剧本.md')
    expect(result.分镜头数).toBe(12)
    expect(result.审读发现项).toEqual([])
    expect(result.fountain).toContain('Title: 晚星')
    expect(result.markdown).toContain('低沉弦乐起')
    expect(result.markdown).toContain('温暖主题音乐起')
    expect(result.markdown格式).toBe('storyboard')
    const again = computeScreenplayExport(root, { 形态: '电影剧本', 格式: 'both', 分镜头表: shotList })
    expect(again.fountain).toBe(result.fountain)
    expect(again.markdown).toBe(result.markdown)
  })

  it('电影默认出分镜剧本（storyboard）：总纲七节 + △分镜块五字段 + 对白标注，不是 master-scene 形状', () => {
    const root = filmBook('晚星')
    const shotList = readShotList('分镜头表-晚星.md')
    const result = computeScreenplayExport(root, { 形态: '电影剧本', 分镜头表: shotList, 总纲: WANXING_BIBLE })
    expect(result.ok, result.gaps.join('；')).toBe(true)
    expect(result.markdown格式).toBe('storyboard')
    expect(result.fountain文件).toBe('')
    expect(result.fountain).toBe('')
    // 总纲七节（电影版第六节是三幕结构）
    expect(result.markdown).toContain('# 《晚星》总纲（剧本圣经）')
    expect(result.markdown).toContain('一、故事一句话')
    expect(result.markdown).toContain('六、三幕结构与时间锚点')
    expect(result.markdown).toContain('• 第一幕：起疑（D1 深夜—清晨）')
    // 分镜剧本：场头 + △镜头块（五字段齐全）+ 对白带 (pause) 标注
    expect(result.markdown).toContain('# 《晚星》电影剧本（分镜剧本）')
    expect(result.markdown).toContain('场01 夜／内 面馆')
    expect(result.markdown).toContain('人物：林晚星、阿辉')
    expect(result.markdown).toMatch(/△【镜头01｜时间：00:00—00:0\d｜景别：—｜角度：—｜运镜：—】/)
    expect(result.markdown).toContain('△面馆打烊了，林晚星擦着桌子，门外传来脚步声。')
    expect(result.markdown).toContain('林晚星(pause)：你想说什么？')
    // 不是 master-scene 形状：没有 FADE IN / INT. 场景标题作主结构
    expect(result.markdown).not.toContain('FADE IN:')
    expect(result.markdown).not.toContain('场01 INT. 面馆 - 深夜')
    // 导演层分镜头表仍在
    expect(result.markdown).toContain('## 导演层')
    expect(result.markdown).toContain('低沉弦乐起')
    // 总纲仍单独出一份文件
    expect(result.总纲文件).toBe('晚星-总纲.md')
    expect(result.总纲).toContain('# 《晚星》总纲（剧本圣经）')
  })

  it('电影 master-scene 显式指定时仍可用（次要导出）：FADE IN + INT. 场景标题 + 导演层', () => {
    const root = filmBook('晚星')
    const shotList = readShotList('分镜头表-晚星.md')
    const result = computeScreenplayExport(root, { 形态: '电影剧本', 格式: 'master-scene', 分镜头表: shotList })
    expect(result.ok, result.gaps.join('；')).toBe(true)
    expect(result.markdown格式).toBe('master-scene')
    expect(result.markdown).toContain('FADE IN:')
    expect(result.markdown).toContain('场01 INT. 面馆 - 深夜')
    expect(result.markdown).toContain('## 导演层')
    expect(result.markdown).not.toContain('△【镜头01')
  })

  it('电影分镜推导：8 场 38 镜，时间码全片累计、总和等于页数 × 55 秒，景别/角度/运镜填 —', () => {
    const parsed = parseScreenplay(filmExample)
    expect(parsed.ok, parsed.problems.join('；')).toBe(true)
    const draft = parsed.draft!
    const scenes = deriveFilmStoryboard(draft)
    expect(scenes).toHaveLength(8)
    const shots = scenes.flatMap((s) => s.镜头)
    expect(shots).toHaveLength(38)
    expect(shots[0]!.镜头号).toBe(1)
    expect(shots[37]!.镜头号).toBe(38)
    expect(shots[0]!.开始秒).toBe(0)
    // 总时长 = 预估页数 × 55 秒（8 场剧本约 2 页 → 约 110 秒）
    const total = (shots[37]!.结束秒 as number) - (shots[0]!.开始秒 as number)
    expect(total).toBe(110)
    for (const shot of shots) {
      expect(shot.景别).toBe('—')
      expect(shot.角度).toBe('—')
      expect(shot.运镜).toBe('—')
      expect(shot.描写.length).toBeGreaterThan(0)
      expect(shot.描写.every((d) => d.trim() !== '')).toBe(true)
      expect((shot.结束秒 as number)).toBeGreaterThan(shot.开始秒 as number)
    }
    // 时间码连续：上一镜结束 = 下一镜开始
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i]!.开始秒).toBe(shots[i - 1]!.结束秒)
    }
    // 渲染出的分镜含 5 字段头与对白标注，且没有裸 △ 行
    const text = renderFilmStoryboardMarkdown(draft, readShotList('分镜头表-晚星.md'))
    expect(text).toContain('△【镜头01｜时间：00:00—')
    expect(text).toContain('林晚星(pause)：你想说什么？')
    expect(text).not.toMatch(/^△$/m)
  })

  it('computeScreenplayExport 电影：不传分镜头表时按场生成待填模板行（警告、不阻断）', () => {
    const root = filmBook('晚星')
    const result = computeScreenplayExport(root, { 形态: '电影剧本' })
    expect(result.ok, result.gaps.join('；')).toBe(true)
    expect(result.分镜头数).toBe(8)
    expect(result.警告.some((w) => w.includes('待填'))).toBe(true)
    expect(result.markdown).toContain('| 1 | 1 | — | — | — | — |')
  })

  it('computeScreenplayExport 电影：只出一种格式时另一份为空', () => {
    const root = filmBook('晚星')
    const fountainOnly = computeScreenplayExport(root, { 形态: '电影剧本', 格式: 'fountain' })
    expect(fountainOnly.ok).toBe(true)
    expect(fountainOnly.fountain文件).toBe('晚星-电影剧本.fountain')
    expect(fountainOnly.markdown文件).toBe('')
    expect(fountainOnly.markdown).toBe('')
  })

  it('computeScreenplayExport 短剧：集001 双格式 + 分镜头表 6 镜', () => {
    const root = episodeBook('赘婿归来')
    const shotList = readShotList('分镜头表-赘婿归来集001.md')
    const result = computeScreenplayExport(root, { 形态: '短剧', 集: 1, 格式: 'both', 分镜头表: shotList })
    expect(result.ok, result.gaps.join('；')).toBe(true)
    expect(result.书名).toBe('赘婿归来')
    expect(result.标题).toBe('废物赘婿')
    expect(result.集).toBe(1)
    expect(result.场景数).toBe(3)
    expect(result.台词字数).toBe(181)
    expect(result.fountain文件).toBe('赘婿归来-短剧集001.fountain')
    expect(result.markdown文件).toBe('赘婿归来-短剧集001.md')
    expect(result.分镜头数).toBe(6)
    expect(result.fountain).toContain('INT. 苏家客厅 - 日')
    expect(result.markdown).toContain('悬疑弦乐起')
    expect(result.markdown).toContain('## 节拍表')
  })

  it('computeScreenplayExport 失败：定稿缺失 / 短剧缺集号 / (beat) 阻断', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-export-'))
    roots.push(workspace)
    const empty = path.join(workspace, '空书')
    fs.mkdirSync(empty, { recursive: true })
    const missing = computeScreenplayExport(empty, { 形态: '电影剧本' })
    expect(missing.ok).toBe(false)
    expect(missing.gaps.some((g) => g.includes('剧本/电影/剧本.md'))).toBe(true)
    const noEpisode = computeScreenplayExport(episodeBook('赘婿归来'), { 形态: '短剧' })
    expect(noEpisode.ok).toBe(false)
    expect(noEpisode.gaps.some((g) => g.includes('--集'))).toBe(true)
    const beatBook = filmBook('晚星', filmExample.replaceAll('（pause）', '（beat）'))
    const beat = computeScreenplayExport(beatBook, { 形态: '电影剧本' })
    expect(beat.ok).toBe(false)
    expect(beat.gaps.some((g) => g.includes('(beat)'))).toBe(true)
  })

  it('verifyScreenplayExportTarget：落盘后逐份比对哈希；改动一字节即失败；目标进 剧本/ 拒绝', () => {
    const root = filmBook('晚星')
    const computed = computeScreenplayExport(root, { 形态: '电影剧本', 格式: 'both' })
    expect(computed.ok).toBe(true)
    const target = path.join(roots[roots.length - 1]!, '导出目标')
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(path.join(target, computed.fountain文件), computed.fountain)
    fs.writeFileSync(path.join(target, computed.markdown文件), computed.markdown)
    const verified = verifyScreenplayExportTarget(root, target, computed)
    expect(verified.ok, verified.problems.join('；')).toBe(true)
    expect(verified.文件).toHaveLength(2)
    fs.appendFileSync(path.join(target, computed.markdown文件), ' ')
    expect(verifyScreenplayExportTarget(root, target, computed).ok).toBe(false)
    const insideScript = inspectScreenplayExportTarget(root, path.join(root, '剧本/电影'), [computed.fountain文件])
    expect(insideScript.ok).toBe(false)
    expect(insideScript.problems.some((p) => p.includes('剧本定稿目录'))).toBe(true)
    const insideFinalized = inspectScreenplayExportTarget(root, path.join(root, '定稿'), [computed.fountain文件])
    expect(insideFinalized.ok).toBe(false)
  })

  it('小说导出不受影响：同一书仓 computeExport 仍按原口径出合集与清单', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-export-'))
    roots.push(workspace)
    const root = path.join(workspace, '测试书')
    makeFixtureBook(root, 3)
    const novel = computeExport(root)
    expect(novel.ok, novel.gaps.join(';')).toBe(true)
    expect(novel.章列表).toHaveLength(3)
    expect(novel.合集文件).toBe('测试书-定稿合集.md')
  })

  it('示例导出文件与代码输出逐字节一致（示例不是手写稿）', () => {
    const filmRoot = filmBook('晚星')
    const filmShotList = readShotList('分镜头表-晚星.md')
    const film = computeScreenplayExport(filmRoot, { 形态: '电影剧本', 格式: 'both', 分镜头表: filmShotList, 总纲: WANXING_BIBLE })
    expect(film.ok, film.gaps.join('；')).toBe(true)
    expect(fs.readFileSync(path.join(exportExamplesDir, '晚星-电影剧本.fountain'), 'utf-8')).toBe(film.fountain)
    expect(fs.readFileSync(path.join(exportExamplesDir, '晚星-电影剧本.md'), 'utf-8')).toBe(film.markdown)
    const episodeRoot = episodeBook('赘婿归来')
    const episodeShotList = readShotList('分镜头表-赘婿归来集001.md')
    const episode = computeScreenplayExport(episodeRoot, { 形态: '短剧', 集: 1, 格式: 'both', 分镜头表: episodeShotList })
    expect(episode.ok, episode.gaps.join('；')).toBe(true)
    expect(fs.readFileSync(path.join(exportExamplesDir, '赘婿归来-短剧集001.fountain'), 'utf-8')).toBe(episode.fountain)
    expect(fs.readFileSync(path.join(exportExamplesDir, '赘婿归来-短剧集001.md'), 'utf-8')).toBe(episode.markdown)
  })
})
