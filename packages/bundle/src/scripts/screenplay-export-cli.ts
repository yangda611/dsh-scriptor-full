/**
 * 专业剧本导出脚本的 CLI 逻辑（阶段 4，仿 export-cli.ts / screenplay-checks-cli.ts）。
 *
 * 只算不写：computeScreenplayExport 读剧本定稿真源，在内存中生成 Fountain
 * 与 Markdown 两份完整载荷；inspectScreenplayExportTarget 只读检查目标目录；
 * verifyScreenplayExportTarget 只读验收已落盘文件。实际写盘由主 Agent 经原生
 * 文件工具完成（目标通常在书仓围栏外，属提权情形）。stdout 纯 JSON（独立 CLI
 * 验收要求 stdout 可 JSON.parse；人读的摘要行不打到 stdout）。函数保持纯函数
 * 形态（argv 进、退出码出），模块顶层不得有副作用。
 *
 * 参数：--book <书仓路径>（必填）；--形态 电影剧本|短剧（可选，默认 电影剧本）；
 * --集 N（短剧必填，1–100；电影剧本不传）；--格式 storyboard|master-scene|fountain|both
 * （可选，默认 storyboard：《痴迷》式分镜剧本；master-scene 是电影的次要导出，
 * 短剧不支持；旧值 markdown 已废弃）；--分镜头 <路径>（可选，相对书仓或绝对路径，导演已填的
 * 分镜头表 Markdown 表格；不传则按场生成待填模板行）；--总纲 <JSON 路径>
 * （可选，相对书仓或绝对路径，总纲 StoryBibleInput JSON；传了就渲染总纲文件
 * `<书名>-总纲.md`，并以总纲第五节为人名注册表做导出前一致性检查——全剧人名
 * 必须在册且只用标准名，未登记/误标直接阻断，不准静默输出；总纲 JSON 须为
 * 对象，七节不全由 computeScreenplayExport 报出）；--目标 <目录>（可选，
 * 只读检查）；--校验 true（可选，须与 --目标 同传，读实际文件逐份比对哈希）。
 * 语言规则（写进总纲与分镜模板）：说明/场景/动作文字一律中文，对白按目标市场语言。
 *
 * 退出码：0 完成；1 前置参数错误 / 文件不存在 / 解析失败 / 目标不可用 /
 * 校验失败；2 执行异常。约定与 export-cli.ts 一致。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  computeScreenplayExport, inspectScreenplayExportTarget, parseShotListTable, verifyScreenplayExportTarget,
  type ScreenplayExportFormat, type ScreenplayExportKind, type ShotList, type StoryBibleInput,
} from '@webnovel/core'

function argValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}

export function screenplayExportCli(argv: readonly string[]): number {
  const allowed = new Set(['--book', '--形态', '--集', '--格式', '--分镜头', '--总纲', '--目标', '--校验'])
  const seen = new Set<string>()
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]!
    const value = argv[i + 1]
    if (!allowed.has(flag) || seen.has(flag) || value === undefined || !value.trim() || value.startsWith('--')) {
      console.error(`前置参数错误：未知或重复选项，或选项缺值：${flag}`)
      return 1
    }
    seen.add(flag)
  }
  const book = argValue(argv, 'book')?.trim()
  const target = argValue(argv, '目标')?.trim()
  const verification = argValue(argv, '校验')
  if (verification !== undefined && (verification !== 'true' || !target)) {
    console.error('前置参数错误：校验须传 --校验 true 和 --目标 目录')
    return 1
  }
  if (!book) {
    console.error('前置参数错误：必须传 --book 书仓路径')
    return 1
  }
  const 形态raw = argValue(argv, '形态')?.trim() ?? '电影剧本'
  if (形态raw !== '电影剧本' && 形态raw !== '短剧') {
    console.error('前置参数错误：--形态 必须是 电影剧本 或 短剧')
    return 1
  }
  const 形态 = 形态raw as ScreenplayExportKind
  const 集raw = argValue(argv, '集')
  let 集: number | undefined
  if (集raw !== undefined) {
    const value = Number(集raw)
    if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
      console.error('前置参数错误：--集 必须是 1–100 的整数')
      return 1
    }
    集 = value
  }
  if (形态 === '短剧' && 集 === undefined) {
    console.error('前置参数错误：短剧导出必须传 --集 集号')
    return 1
  }
  if (形态 === '电影剧本' && 集 !== undefined) {
    console.error('前置参数错误：电影剧本导出不传 --集（集号只用于短剧）')
    return 1
  }
  const 格式raw = argValue(argv, '格式')?.trim() ?? 'storyboard'
  if (格式raw !== 'storyboard' && 格式raw !== 'master-scene' && 格式raw !== 'fountain' && 格式raw !== 'both') {
    console.error('前置参数错误：--格式 必须是 storyboard、master-scene、fountain 或 both（旧值 markdown 已废弃：默认 storyboard，次要导出用 master-scene）')
    return 1
  }
  const 格式 = 格式raw as ScreenplayExportFormat
  const 分镜头raw = argValue(argv, '分镜头')?.trim()
  let 分镜头表: ShotList | undefined
  if (分镜头raw !== undefined) {
    const shotPath = path.isAbsolute(分镜头raw) ? 分镜头raw : path.join(book, 分镜头raw)
    if (!fs.existsSync(shotPath) || !fs.statSync(shotPath).isFile()) {
      console.error(`分镜头表不存在：${shotPath}`)
      return 1
    }
    const parsed = parseShotListTable(fs.readFileSync(shotPath, 'utf-8'))
    if (!parsed.ok || parsed.shotList === undefined) {
      console.error(`分镜头表解析失败：${parsed.problems.join('；')}`)
      return 1
    }
    分镜头表 = parsed.shotList
  }
  const 总纲raw = argValue(argv, '总纲')?.trim()
  let 总纲: StoryBibleInput | undefined
  if (总纲raw !== undefined) {
    const biblePath = path.isAbsolute(总纲raw) ? 总纲raw : path.join(book, 总纲raw)
    if (!fs.existsSync(biblePath) || !fs.statSync(biblePath).isFile()) {
      console.error(`总纲文件不存在：${biblePath}`)
      return 1
    }
    try {
      const parsedBible: unknown = JSON.parse(fs.readFileSync(biblePath, 'utf-8'))
      if (typeof parsedBible !== 'object' || parsedBible === null || Array.isArray(parsedBible)) {
        console.error('总纲解析失败：总纲 JSON 须为对象（StoryBibleInput 七节）')
        return 1
      }
      总纲 = parsedBible as StoryBibleInput
    } catch (err) {
      console.error(`总纲解析失败：${err instanceof Error ? err.message : String(err)}`)
      return 1
    }
  }
  try {
    const c = computeScreenplayExport(book, {
      形态,
      ...(集 !== undefined ? { 集 } : {}),
      格式,
      ...(分镜头表 !== undefined ? { 分镜头表 } : {}),
      ...(总纲 !== undefined ? { 总纲 } : {}),
    })
    const names = c.ok ? [c.fountain文件, c.markdown文件, c.总纲文件].filter((n) => n !== '') : []
    const inspected = target ? inspectScreenplayExportTarget(book, target, names) : null
    const verified = verification === 'true' && target ? verifyScreenplayExportTarget(book, target, c) : null
    const ok = c.ok && (verified !== null ? verified.ok : inspected === null || inspected.ok)
    const files: { 名称: string; content: string }[] = []
    if (ok && verified === null) {
      if (c.fountain文件 !== '') files.push({ 名称: c.fountain文件, content: c.fountain })
      if (c.markdown文件 !== '') files.push({ 名称: c.markdown文件, content: c.markdown })
      if (c.总纲文件 !== '') files.push({ 名称: c.总纲文件, content: c.总纲 })
    }
    console.log(JSON.stringify({
      ok,
      gaps: c.gaps,
      警告: c.警告,
      书名: c.书名,
      形态: c.形态,
      标题: c.标题,
      ...(c.集 !== undefined ? { 集: c.集 } : {}),
      场景数: c.场景数,
      台词字数: c.台词字数,
      fountain文件: c.fountain文件,
      markdown文件: c.markdown文件,
      markdown格式: c.markdown格式,
      总纲文件: c.总纲文件,
      人名检查: c.人名检查,
      分镜头数: c.分镜头数,
      审读发现项: c.审读发现项,
      目标: inspected,
      校验: verified,
      文件: files,
    }, null, 2))
    if (!c.ok) {
      console.error(`剧本导出未完成：${c.gaps.join('；')}`)
      return 1
    }
    if (verified !== null) {
      if (!verified.ok) console.error(`剧本导出校验失败：${verified.problems.join('；')}`)
      return verified.ok ? 0 : 1
    }
    if (inspected !== null && !inspected.ok) {
      console.error(`导出目标不可用：${[...inspected.problems, ...(inspected.冲突.length ? [`已有同名文件，不覆盖，请另选新目录：${inspected.冲突.join('、')}`] : [])].join('；')}`)
      return 1
    }
    return 0
  } catch (err) {
    console.error(`剧本导出异常：${err instanceof Error ? err.message : String(err)}`)
    return 2
  }
}
