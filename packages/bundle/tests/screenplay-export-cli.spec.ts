import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { screenplayExportCli } from '../src/scripts/screenplay-export-cli'
import { removeSync } from '../../core/src/repo/remove'

const repoRoot = path.resolve(__dirname, '..', '..', '..')
const roots: string[] = []
afterAll(() => roots.forEach((root) => removeSync(root)))

function makeBook(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'screenplay-export-cli-'))
  roots.push(workspace)
  const book = path.join(workspace, '晚星')
  fs.mkdirSync(path.join(book, '剧本/电影'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'docs/examples/电影剧本示例/剧本.md'), path.join(book, '剧本/电影/剧本.md'))
  fs.mkdirSync(path.join(book, '剧本/短剧'), { recursive: true })
  fs.copyFileSync(path.join(repoRoot, 'examples/shortdrama/赘婿逆袭/竖屏/集001.md'), path.join(book, '剧本/短剧/集001.md'))
  return book
}

function runCli(argv: string[]): { exit: number; stdout: string; stderr: string } {
  const out: string[] = []
  const err: string[] = []
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { out.push(args.join(' ')) })
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { err.push(args.join(' ')) })
  try {
    const exit = screenplayExportCli(argv)
    return { exit, stdout: out.join('\n'), stderr: err.join('\n') }
  } finally {
    logSpy.mockRestore()
    errSpy.mockRestore()
  }
}

describe('阶段 4：剧本导出 CLI（screenplayExportCli）', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('电影导出：退出 0、stdout 纯 JSON、ok:true、两份文件全文在 文件 里', () => {
    const book = makeBook()
    const { exit, stdout } = runCli(['--book', book, '--形态', '电影剧本', '--格式', 'both'])
    expect(exit).toBe(0)
    const value = JSON.parse(stdout)
    expect(value.ok).toBe(true)
    expect(value.书名).toBe('晚星')
    expect(value.场景数).toBe(8)
    expect(value.fountain文件).toBe('晚星-电影剧本.fountain')
    expect(value.markdown文件).toBe('晚星-电影剧本.md')
    expect(value.文件).toHaveLength(2)
    expect(value.文件[0].content).toContain('Title: 晚星')
    expect(value.文件[1].content).toContain('## 导演层')
    expect(value.审读发现项).toEqual([])
  })

  it('电影导出默认出分镜剧本（storyboard）：△分镜块，无 FADE IN；--格式 master-scene 仍出编剧层', () => {
    const book = makeBook()
    const { exit, stdout } = runCli(['--book', book, '--形态', '电影剧本'])
    expect(exit).toBe(0)
    const value = JSON.parse(stdout)
    expect(value.ok).toBe(true)
    expect(value.markdown格式).toBe('storyboard')
    expect(value.fountain文件).toBe('')
    expect(value.文件).toHaveLength(1)
    expect(value.文件[0].content).toContain('△【镜头01')
    expect(value.文件[0].content).toContain('## 导演层')
    expect(value.文件[0].content).not.toContain('FADE IN:')
    const master = runCli(['--book', book, '--形态', '电影剧本', '--格式', 'master-scene'])
    expect(master.exit).toBe(0)
    const masterValue = JSON.parse(master.stdout)
    expect(masterValue.markdown格式).toBe('master-scene')
    expect(masterValue.文件).toHaveLength(1)
    expect(masterValue.文件[0].content).toContain('FADE IN:')
    expect(masterValue.文件[0].content).toContain('场01 INT. 面馆 - 深夜')
    // 旧值 markdown 已废弃
    expect(runCli(['--book', book, '--格式', 'markdown']).exit).toBe(1)
  })

  it('短剧导出：--集 1 出集001；--分镜头 读导演表进分镜头数', () => {
    const book = makeBook()
    const table = path.join(repoRoot, 'docs/examples/剧本导出示例/分镜头表-赘婿归来集001.md')
    const { exit, stdout } = runCli(['--book', book, '--形态', '短剧', '--集', '1', '--格式', 'both', '--分镜头', table])
    expect(exit).toBe(0)
    const value = JSON.parse(stdout)
    expect(value.ok).toBe(true)
    expect(value.集).toBe(1)
    expect(value.分镜头数).toBe(6)
    expect(value.fountain文件).toBe('晚星-短剧集001.fountain')
  })

  it('无参退出 1；短剧缺 --集 退出 1；电影传 --集 退出 1；非法 --格式 退出 1', () => {
    expect(runCli([]).exit).toBe(1)
    const book = makeBook()
    expect(runCli(['--book', book, '--形态', '短剧']).exit).toBe(1)
    expect(runCli(['--book', book, '--形态', '电影剧本', '--集', '1']).exit).toBe(1)
    expect(runCli(['--book', book, '--格式', 'pdf']).exit).toBe(1)
  })

  it('定稿缺失退出 1；--目标 落在 剧本/ 内退出 1；写盘后 --校验 true 退出 0', () => {
    const book = makeBook()
    const missing = runCli(['--book', book, '--形态', '短剧', '--集', '2'])
    expect(missing.exit).toBe(1)
    expect(missing.stderr).toContain('剧本/短剧/集002.md')
    const badTarget = runCli(['--book', book, '--目标', path.join(book, '剧本/电影')])
    expect(badTarget.exit).toBe(1)
    expect(badTarget.stderr).toContain('剧本定稿目录')
    const target = path.join(roots[roots.length - 1]!, '导出目标')
    fs.mkdirSync(target, { recursive: true })
    const computed = runCli(['--book', book])
    const value = JSON.parse(computed.stdout)
    for (const file of value.文件) fs.writeFileSync(path.join(target, file.名称), file.content)
    const verified = runCli(['--book', book, '--目标', target, '--校验', 'true'])
    expect(verified.exit).toBe(0)
    expect(JSON.parse(verified.stdout).校验.ok).toBe(true)
  })

  it('总纲：--总纲 渲染总纲文件并做人名检查；未登记人名阻断', () => {
    const book = makeBook()
    const bible = {
      标题: '赘婿归来',
      类型: '都市／身份反转',
      形式: '12集连续短剧',
      文字目标: '分镜拉片剧本每集约3,000—5,000字',
      叙事线: { A线: '顾霆琛的身份揭晓', B线: '苏晚的信任动摇', C线: '岳母的算计' },
      故事一句话: '被当成废物赘婿的顾霆琛，其实是顾氏继承人。',
      开篇承诺: '岳母把离婚协议拍在顾霆琛面前。',
      悬念: ['他到底是谁', '黑卡从哪来'],
      主题: '尊严不是别人给的。',
      反题: '靠羞辱别人抬高自己的人，迟早被真相打脸。',
      世界硬约束: {
        现实基底与唯一超自然规则: '现代都市，没有超自然设定。',
        硬约束: ['顾氏继承人的身份只有老爷子能确认。'],
        核心地理空间: ['苏家客厅。'],
      },
      三段核心真相: [
        { 阶段: '第一阶段', 内容: '顾霆琛在苏家当了三年赘婿。' },
        { 阶段: '第二阶段', 内容: '黑卡出现，身份开始松动。' },
        { 阶段: '第三阶段', 内容: '顾霆琛公开身份，接回苏晚。' },
      ],
      人物: [
        { 标准名: '顾霆琛', 身份: '顾氏继承人', 人物弧: '从忍气吞声到公开身份。', 曾误标: ['废物[第1集]'] },
        { 标准名: '苏晚', 身份: '苏家女儿', 人物弧: '从半信半疑到坚定站队。' },
        { 标准名: '岳母', 身份: '苏晚的母亲', 人物弧: '从百般刁难到无话可说。' },
        { 标准名: '电话那头', 身份: '顾氏管家', 人物弧: '只在电话里出现。' },
      ],
      分集结构: [{ 集: 1, 时间锚点: 'D1 白天', 梗概: '岳母逼顾霆琛签离婚协议。' }],
      对白语言: '中文',
    }
    const biblePath = path.join(roots[roots.length - 1]!, '总纲.json')
    fs.writeFileSync(biblePath, JSON.stringify(bible, null, 2))
    const { exit, stdout } = runCli(['--book', book, '--形态', '短剧', '--集', '1', '--格式', 'both', '--总纲', biblePath])
    expect(exit).toBe(0)
    const value = JSON.parse(stdout)
    expect(value.ok).toBe(true)
    expect(value.总纲文件).toBe('晚星-总纲.md')
    expect(value.人名检查).toEqual({ ok: true, problems: [] })
    expect(value.文件).toHaveLength(3)
    expect(value.文件[2].content).toContain('# 《赘婿归来》总纲（剧本圣经）')
    expect(value.文件[2].content).toContain('（原剧本曾误标为：废物[第1集]，已全部统一为顾霆琛）')
    // 未登记：去掉「电话那头」的登记，导出必须阻断
    const missing = { ...bible, 人物: bible.人物.slice(0, 3) }
    fs.writeFileSync(biblePath, JSON.stringify(missing, null, 2))
    const blocked = runCli(['--book', book, '--形态', '短剧', '--集', '1', '--总纲', biblePath])
    expect(blocked.exit).toBe(1)
    expect(blocked.stderr).toContain('未登记')
    // 总纲文件不存在 / JSON 非法都退出 1
    expect(runCli(['--book', book, '--形态', '短剧', '--集', '1', '--总纲', '不存在.json']).exit).toBe(1)
    fs.writeFileSync(biblePath, '{不是 json')
    expect(runCli(['--book', book, '--形态', '短剧', '--集', '1', '--总纲', biblePath]).exit).toBe(1)
  })

  it('书仓无改动：CLI 只算不写', () => {
    const book = makeBook()
    const before = fs.readdirSync(book, { recursive: true }).sort()
    runCli(['--book', book])
    expect(fs.readdirSync(book, { recursive: true }).sort()).toEqual(before)
  })
})
