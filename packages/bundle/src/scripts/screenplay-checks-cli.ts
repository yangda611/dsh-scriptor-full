/**
 * 剧本格式检查脚本的 CLI 逻辑（阶段 2，仿 deterministic-checks.ts）。
 *
 * 本模块经薄入口 `skills/novel-screenplay/scripts/剧本格式检查.mjs` 动态引 lib 调用。
 * 只算不写：读剧本草稿 + 分场大纲 → parseScreenplay + parseSceneOutline →
 * runScreenplayReview，把逐模块发现项打到 stdout。函数保持纯函数形态
 * （argv 进、退出码出），模块顶层不得有副作用。
 *
 * 退出码：0 完成（发现项可能是空）；1 前置参数错误 / 文件不存在 / 解析失败；
 * 2 执行异常。约定与 deterministic-checks.ts 一致（阶段 2 汇报里“参数错误退出 2”
 * 与薄入口“2 执行异常”的说法不一致，以此处为准：参数错误是 1）。
 */
import * as fs from 'node:fs'
import { parseSceneOutline, parseScreenplay, runScreenplayReview, type FilmLength } from '@webnovel/core'

interface Args {
  readonly 草稿: string
  readonly 大纲?: string
  readonly 片长: FilmLength
}

function parseArgs(argv: readonly string[]): Args {
  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const name = token.slice(2)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`参数 ${token} 缺少值`)
    values.set(name, value)
    i += 1
  }
  const 草稿 = values.get('草稿')?.trim()
  const 大纲 = values.get('大纲')?.trim()
  const 片长 = values.get('片长')?.trim() ?? '长片'
  if (!草稿) throw new Error('必须传 --草稿 剧本草稿路径')
  if (片长 !== '长片' && 片长 !== '短片') throw new Error('--片长 必须是 长片 或 短片')
  return { 草稿, ...(大纲 !== undefined && 大纲 !== '' ? { 大纲 } : {}), 片长 }
}

export function runScreenplayChecksCli(argv: readonly string[]): number {
  let args: Args
  try {
    args = parseArgs(argv)
  } catch (err) {
    console.error(`前置参数错误：${err instanceof Error ? err.message : String(err)}`)
    return 1
  }
  if (!fs.existsSync(args.草稿) || !fs.statSync(args.草稿).isFile()) {
    console.error(`剧本草稿不存在：${args.草稿}`)
    return 1
  }
  if (args.大纲 !== undefined && (!fs.existsSync(args.大纲) || !fs.statSync(args.大纲).isFile())) {
    console.error(`分场大纲不存在：${args.大纲}`)
    return 1
  }
  try {
    const draftParsed = parseScreenplay(fs.readFileSync(args.草稿, 'utf-8'))
    if (!draftParsed.ok || draftParsed.draft === undefined) {
      console.error(`剧本草稿解析失败：${draftParsed.problems.join('；')}`)
      return 1
    }
    let outline
    if (args.大纲 !== undefined) {
      const outlineParsed = parseSceneOutline(fs.readFileSync(args.大纲, 'utf-8'))
      if (!outlineParsed.ok || outlineParsed.outline === undefined) {
        console.error(`分场大纲解析失败：${outlineParsed.problems.join('；')}`)
        return 1
      }
      outline = outlineParsed.outline
    }
    const result = runScreenplayReview({
      剧本草稿: draftParsed.draft,
      ...(outline !== undefined ? { 分场大纲: outline } : {}),
      片长: args.片长,
    })
    const counts = (Object.entries(result.按模块) as Array<[string, readonly unknown[]]>)
      .map(([name, findings]) => `${name}:${findings.length}`)
      .join('、') || '（无）'
    console.log(`剧本格式检查完成：${counts}`)
    console.log(`是否阻断：${result.是否阻断 ? 'true' : 'false'}`)
    console.log('发现项（逐模块）:')
    console.log(JSON.stringify(result.按模块, null, 2))
    return 0
  } catch (err) {
    console.error(`剧本格式检查异常：${err instanceof Error ? err.message : String(err)}`)
    return 2
  }
}
