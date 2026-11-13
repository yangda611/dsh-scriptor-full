import { afterAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { writeBatchAtomic } from '../src/repo/atomic'

const roots: string[] = []
function mkRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webnovel-b1-'))
  roots.push(dir)
  return dir
}
afterAll(() => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch { /* Windows 句柄延迟释放，%TEMP% 残留无害 */ } } })

describe('批量原子写(机制 B1)', () => {
  it.skipIf(process.platform !== 'win32')('Windows 尾点别名不能新建 Git 保留目录', () => {
    const root = mkRoot()
    expect(() => writeBatchAtomic(root, [{ relPath: '.git./config', content: '覆盖' }])).toThrow(/保留路径/)
    expect(fs.existsSync(path.join(root, '.git'))).toBe(false)
  })

  it.each(['.git', '.webnovel'])('目录别名不能绕过保留路径 %s', (reserved) => {
    const root = mkRoot()
    const dir = path.join(root, reserved)
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'protected'), '保留内容')
    fs.symlinkSync(dir, path.join(root, '别名'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(() => writeBatchAtomic(root, [{ relPath: '别名/protected', content: '覆盖' }])).toThrow(/保留路径/)
    expect(fs.readFileSync(path.join(dir, 'protected'), 'utf-8')).toBe('保留内容')
  })

  it('拒绝经目录别名重复写入同一目标，保留原文件', () => {
    const root = mkRoot()
    const real = path.join(root, '正文')
    fs.mkdirSync(real)
    fs.writeFileSync(path.join(real, '章.md'), '原文')
    fs.symlinkSync(real, path.join(root, '别名'), process.platform === 'win32' ? 'junction' : 'dir')
    expect(() => writeBatchAtomic(root, [
      { relPath: '正文/章.md', content: '第一份' },
      { relPath: '别名/章.md', content: '第二份' },
    ])).toThrow(/目标路径重复/)
    expect(fs.readFileSync(path.join(real, '章.md'), 'utf-8')).toBe('原文')
  })

  it.skipIf(process.platform !== 'win32')('拒绝仅大小写不同的重复目标，保留原文件', () => {
    const root = mkRoot()
    fs.writeFileSync(path.join(root, 'draft.md'), '原文')
    expect(() => writeBatchAtomic(root, [
      { relPath: 'draft.md', content: '第一份' },
      { relPath: 'DRAFT.md', content: '第二份' },
    ])).toThrow(/目标路径重复/)
    expect(fs.readFileSync(path.join(root, 'draft.md'), 'utf-8')).toBe('原文')
  })

  it('全部成功:目录自动创建,内容正确', () => {
    const root = mkRoot()
    writeBatchAtomic(root, [
      { relPath: '定稿/卷01/0001-初见.md', content: '正文' },
      { relPath: '账本/线索.md', content: '账' },
    ])
    expect(fs.readFileSync(path.join(root, '定稿/卷01/0001-初见.md'), 'utf-8')).toBe('正文')
    expect(fs.readFileSync(path.join(root, '账本/线索.md'), 'utf-8')).toBe('账')
  })

  it('路径校验:拒绝绝对路径与 .. 穿越(B1/B2 衔接)', () => {
    const root = mkRoot()
    expect(() => writeBatchAtomic(root, [{ relPath: '../越界.md', content: 'x' }])).toThrow(/路径穿越/)
    expect(() => writeBatchAtomic(root, [{ relPath: 'D:/绝对.md', content: 'x' }])).toThrow(/绝对/)
    expect(fs.readdirSync(root)).toEqual([])
  })

  it('中途失败:新建文件回滚删除,书仓零半成品', () => {
    const root = mkRoot()
    // 预置一个目录,使第二条目标标在 rename 阶段失败(目录不可作文件覆盖)
    fs.mkdirSync(path.join(root, '占位目录'))
    expect(() => writeBatchAtomic(root, [
      { relPath: 'a/新文件.md', content: '新' },
      { relPath: '占位目录', content: 'x' },
    ])).toThrow(/原子写失败/)
    expect(fs.existsSync(path.join(root, 'a/新文件.md'))).toBe(false)
    expect(fs.statSync(path.join(root, '占位目录')).isDirectory()).toBe(true) // 既有目录不受损
  })

  it('中途失败:既有文件恢复原文,零丢失', () => {
    const root = mkRoot()
    fs.mkdirSync(path.join(root, 'a'), { recursive: true })
    fs.writeFileSync(path.join(root, 'a/旧.md'), '旧内容', 'utf-8')
    fs.mkdirSync(path.join(root, '占位目录'))
    expect(() => writeBatchAtomic(root, [
      { relPath: 'a/旧.md', content: '新内容' },
      { relPath: '占位目录', content: 'x' },
    ])).toThrow(/原子写失败/)
    expect(fs.readFileSync(path.join(root, 'a/旧.md'), 'utf-8')).toBe('旧内容')
  })

  it('中途失败:中文路径新建文件也回滚删除', () => {
    const root = mkRoot()
    fs.mkdirSync(path.join(root, '占位目录'))
    expect(() => writeBatchAtomic(root, [
      { relPath: '账本/线索.md', content: '账' },
      { relPath: '占位目录', content: 'x' },
    ])).toThrow(/原子写失败/)
    expect(fs.existsSync(path.join(root, '账本/线索.md'))).toBe(false)
  })
})
