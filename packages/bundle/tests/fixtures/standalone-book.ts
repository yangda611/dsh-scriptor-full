import * as fs from 'node:fs'
import * as path from 'node:path'
import { makeFixtureBook } from '../../../core/tests/helpers/fixture-book'
import { serializeDocument } from '../../../core/src/repo/frontmatter'

/** Synthetic files only; this helper runs before the restricted CLI processes. */
export function createStandaloneBook(book: string): void {
  makeFixtureBook(book, 3)
  const draft = path.join(book, '草稿区/草稿/卷01-章1/稿1.md')
  fs.mkdirSync(path.dirname(draft), { recursive: true })
  fs.writeFileSync(draft, serializeDocument({ 角色: '待审稿', 版本: 1 },
    '主角在城门口交出通行文书。\n\n## 草稿候选事实\n- 此处不是正文，不计入字数。\n'))
  // 剧本格式检查验收用：复用阶段 2 已验证的《晚星》示例（短片，8 场，审读 0 发现项）。
  const screenplayDir = path.join(book, '草稿区/剧本')
  fs.mkdirSync(screenplayDir, { recursive: true })
  const exampleDir = path.resolve(__dirname, '../../../..', 'docs/examples/电影剧本示例')
  fs.copyFileSync(path.join(exampleDir, '剧本.md'), path.join(screenplayDir, '剧本草稿.md'))
  fs.copyFileSync(path.join(exampleDir, '分场大纲.md'), path.join(screenplayDir, '分场大纲.md'))
  // 剧本导出验收用：同一份《晚星》剧本放进剧本定稿目录（电影全文一份），
  // 《赘婿归来》竖屏集001 放进短剧定稿目录（每集一份）。
  const filmFinalDir = path.join(book, '剧本/电影')
  fs.mkdirSync(filmFinalDir, { recursive: true })
  fs.copyFileSync(path.join(exampleDir, '剧本.md'), path.join(filmFinalDir, '剧本.md'))
  const episodeFinalDir = path.join(book, '剧本/短剧')
  fs.mkdirSync(episodeFinalDir, { recursive: true })
  fs.copyFileSync(
    path.resolve(__dirname, '../../../..', 'examples/shortdrama/赘婿逆袭/竖屏/集001.md'),
    path.join(episodeFinalDir, '集001.md'),
  )
}
