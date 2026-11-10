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

  it('短剧导出：--集 1 出集001；--分镜头 读导演表进分镜头数', () => {
    const book = makeBook()
    const table = path.join(repoRoot, 'docs/examples/剧本导出示例/分镜头表-赘婿归来集001.md')
    const { exit, stdout } = runCli(['--book', book, '--形态', '短剧', '--集', '1', '--分镜头', table])
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

  it('书仓无改动：CLI 只算不写', () => {
    const book = makeBook()
    const before = fs.readdirSync(book, { recursive: true }).sort()
    runCli(['--book', book])
    expect(fs.readdirSync(book, { recursive: true }).sort()).toEqual(before)
  })
})
