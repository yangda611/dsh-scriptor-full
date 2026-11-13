/**
 * 最小 Markdown 导出（任务 09-06-minimal-markdown-export）。
 *
 * 只算不写：computeExport 读取定稿真源，在内存中生成「定稿合集」与「来源清单」两份
 * 完整载荷；inspectExportTarget 对作者选定目录做只读检查。实际写盘由主 Agent 经原生
 * 文件工具完成（目标通常在书仓围栏外，属 R20 预留的提权情形），书仓事务锁不扩展到
 * 任意目录。导出确定性（无时间戳），同一书仓状态重复计算结果字节相同。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { canonicalizePath, isInsidePath } from '../gate/canonical'
import { parseDocument } from '../repo/frontmatter'
import { chapterNo, episodeNo, pad, paths, validateSegment } from '../repo/paths'
import { extractVersionFields } from '../provenance'
import { materialHash, readMaterialFile } from '../assembly/source'
import { parseScreenplay, validateScreenplay } from '../screenplay/format'
import type { ScreenplayFinding } from '../screenplay/types'
import { parseEpisodeScript, renderEpisodeScript, totalDialogueChars } from '../shortdrama/script'
import {
  buildCharacterRegistry,
  checkCharacterNames,
  collectEpisodeNames,
  collectScreenplayNames,
  deriveShotListTemplate, renderEpisodeFountain, renderEpisodeMarkdown, renderFilmStoryboardMarkdown, renderFountainScreenplay,
  renderScreenplayMarkdown, renderStoryBible, validateShotList, validateStoryBible,
  type CharacterNameCheck, type ShotList, type StoryBibleInput,
} from './screenplay-format'

export * from './screenplay-format'

/** 导出范围：默认全书；卷限定单卷；起/止章按全书连续章号（含端点），可与卷叠加。 */
export interface ExportScope {
  readonly 卷?: number
  readonly 起章?: number
  readonly 止章?: number
}

export interface ExportChapter {
  readonly 卷: number
  readonly 章: number
  readonly 章名: string
  readonly 相对路径: string
  readonly 版本: number | null
  readonly 内容哈希: string
  readonly 字数: number
  readonly 正文: string
}

export interface ComputedExport {
  readonly ok: boolean
  readonly gaps: readonly string[]
  readonly 书名: string
  readonly 范围: string
  readonly 章列表: readonly ExportChapter[]
  readonly 合计字数: number
  readonly 合集文件: string
  readonly 清单文件: string
  readonly 合集: string
  readonly 清单: string
  readonly 合集哈希: string
}

export interface ExportTargetReport {
  readonly ok: boolean
  readonly 目标目录: string
  readonly 已存在: boolean
  readonly problems: readonly string[]
  readonly 冲突: readonly string[]
}

const FINALIZED_RE = /^定稿\/卷(\d+)\/(\d{4,})-(.+)\.md$/

function walkFinalized(root: string, gaps: string[]): string[] {
  const out: string[] = []
  const walk = (abs: string, rel: string): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true })
    } catch {
      if (rel !== '定稿') gaps.push(`定稿目录无法读取：${rel}`)
      return
    }
    for (const entry of entries) {
      const childAbs = path.join(abs, entry.name)
      const childRel = `${rel}/${entry.name}`
      if (entry.isSymbolicLink()) {
        gaps.push(`定稿目录包含链接或别名：${childRel}`)
        continue
      }
      if (entry.isDirectory()) {
        walk(childAbs, childRel)
        continue
      }
      if (entry.isFile() && FINALIZED_RE.test(childRel)) out.push(childRel)
    }
  }
  walk(path.join(root, '定稿'), '定稿')
  return out
}

function scopeLabel(scope: ExportScope): string {
  const parts: string[] = []
  if (scope.卷 !== undefined) parts.push(`卷${pad(scope.卷)}`)
  if (scope.起章 !== undefined || scope.止章 !== undefined) {
    parts.push(`第${scope.起章 !== undefined ? chapterNo(scope.起章) : '起'}–${scope.止章 !== undefined ? chapterNo(scope.止章) : '止'}章`)
  }
  return parts.length === 0 ? '全书' : parts.join('，')
}

function safeFileStem(书名: string): string {
  return validateSegment(书名).length === 0 && 书名 !== '' ? 书名 : '书稿'
}

/** 只读计算导出计划与两份完整载荷；不落盘、不改书仓。 */
export function computeExport(bookRoot: string, scope: ExportScope = {}): ComputedExport {
  const gaps: string[] = []
  const fail = (extra?: readonly string[]): ComputedExport => ({
    ok: false, gaps: [...gaps, ...(extra ?? [])], 书名: '', 范围: '', 章列表: [], 合计字数: 0,
    合集文件: '', 清单文件: '', 合集: '', 清单: '', 合集哈希: '',
  })
  if (scope.卷 !== undefined && (!Number.isSafeInteger(scope.卷) || scope.卷 < 1)) return fail(['导出范围卷号必须是正整数'])
  if (scope.起章 !== undefined && (!Number.isSafeInteger(scope.起章) || scope.起章 < 1)) return fail(['导出范围起章必须是正整数'])
  if (scope.止章 !== undefined && (!Number.isSafeInteger(scope.止章) || scope.止章 < 1)) return fail(['导出范围止章必须是正整数'])
  if (scope.起章 !== undefined && scope.止章 !== undefined && scope.起章 > scope.止章) return fail(['导出范围起章不能晚于止章'])
  const root = canonicalizePath(bookRoot)
  if (root === '') return fail(['书仓路径无效'])
  const 书名 = path.basename(root)

  const chapters: ExportChapter[] = []
  const seenChapterNo = new Map<number, string>()
  for (const rel of walkFinalized(root, gaps)) {
    const m = FINALIZED_RE.exec(rel)!
    const 卷 = Number(m[1])
    const 章 = Number(m[2])
    const 章名 = m[3]!
    let read: ReturnType<typeof readMaterialFile>
    try {
      read = readMaterialFile(root, rel)
    } catch (err) {
      gaps.push(`定稿读取失败：${rel}（${err instanceof Error ? err.message : String(err)}）`)
      continue
    }
    const parsed = parseDocument(read.text)
    if (!parsed.ok) {
      gaps.push(`定稿 frontmatter 解析失败：${rel}（${parsed.detail}）`)
      continue
    }
    const 状态 = parsed.data.fields['状态']
    if (状态 !== undefined && 状态 !== '已定稿') {
      gaps.push(`定稿目录中的文档状态不是已定稿：${rel}`)
      continue
    }
    const occupied = seenChapterNo.get(章)
    if (occupied !== undefined) {
      gaps.push(`章号全书不连续：第${chapterNo(章)}章同时出现在 ${occupied} 与 ${rel}`)
      continue
    }
    seenChapterNo.set(章, rel)
    const 正文 = parsed.data.body.replace(/\n+$/, '')
    chapters.push({
      卷, 章, 章名, 相对路径: rel, 版本: extractVersionFields(parsed.data.fields).版本,
      内容哈希: read.hash, 字数: [...正文].length, 正文,
    })
  }
  if (gaps.length > 0) return fail()
  const selected = chapters
    .filter((c) => (scope.卷 === undefined || c.卷 === scope.卷)
      && (scope.起章 === undefined || c.章 >= scope.起章)
      && (scope.止章 === undefined || c.章 <= scope.止章))
    .sort((a, b) => a.章 - b.章)
  if (selected.length === 0) return fail([`空选择：范围内没有已定稿章节（${scopeLabel(scope)}）`])

  const stem = safeFileStem(书名)
  const 合集文件 = `${stem}-定稿合集.md`
  const 清单文件 = `${stem}-来源清单.md`
  const 范围 = scopeLabel(scope)
  const 合计字数 = selected.reduce((sum, c) => sum + c.字数, 0)

  const compendium: string[] = [
    `# 《${书名}》定稿合集`,
    '',
    `> 范围：${范围}；共 ${selected.length} 章，合计 ${合计字数} 字。来源路径与版本哈希见同目录「${清单文件}」。`,
    '',
  ]
  let currentVolume = 0
  for (const c of selected) {
    if (c.卷 !== currentVolume) {
      currentVolume = c.卷
      compendium.push(`## 卷${pad(c.卷)}`, '')
    }
    compendium.push(`### 第${chapterNo(c.章)}章 ${c.章名}`, '', c.正文, '')
  }
  const 合集 = `${compendium.join('\n').replace(/\n+$/, '')}\n`
  const 合集哈希 = materialHash(合集)

  const manifest: string[] = [
    `# 《${书名}》定稿来源清单`,
    '',
    `- 导出范围：${范围}`,
    `- 章数：${selected.length}；合计字数：${合计字数}`,
    `- 合集文件：${合集文件}`,
    `- 合集 SHA-256：${合集哈希}`,
    '- 口径：只读导出；源书仓内容与 Git HEAD 不因本导出改变。',
    '- 完成验收：本清单最后落盘；须读取合集和清单校验实际内容，仅清单存在不代表完成。',
    '',
    '| 章 | 卷 | 来源路径 | 版本 | 内容 SHA-256 | 字数 |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  for (const c of selected) {
    manifest.push(`| 第${chapterNo(c.章)}章 ${c.章名} | 卷${pad(c.卷)} | ${c.相对路径} | ${c.版本 ?? '无'} | ${c.内容哈希} | ${c.字数} |`)
  }
  const 清单 = `${manifest.join('\n')}\n`

  return {
    ok: true, gaps: [], 书名, 范围, 章列表: selected, 合计字数,
    合集文件, 清单文件, 合集, 清单, 合集哈希,
  }
}

/**
 * 只读检查作者选定目录：落在源定稿目录（含其内）拒绝；目标已存在且不是目录拒绝；
 * 已存在的同名导出文件列入冲突（先说明，不默认覆盖）。不写任何文件。
 * 目标路径先 canonical 化：经链接/别名进入时报告与比较都用真实落点，作者看到的就是
 * 实际写入位置；别名指向定稿目录时同样命中拒绝。
 */
export function inspectExportTarget(bookRoot: string, targetDir: string, fileNames: readonly string[]): ExportTargetReport {
  const problems: string[] = []
  const 冲突: string[] = []
  const root = canonicalizePath(bookRoot)
  const target = canonicalizePath(targetDir)
  if (root === '' || target === '') {
    return { ok: false, 目标目录: targetDir, 已存在: false, problems: ['书仓或目标目录路径无效'], 冲突 }
  }
  const finalizedRoot = path.join(root, '定稿')
  if (target === finalizedRoot || isInsidePath(finalizedRoot, target)) {
    problems.push('目标位于源定稿目录内，导出会污染真源：请另选目录')
  }
  let stat: fs.Stats | null = null
  try {
    stat = fs.lstatSync(target)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') problems.push(`目标目录无法读取：${err instanceof Error ? err.message : String(err)}`)
  }
  const 已存在 = stat !== null
  if (stat !== null) {
    if (!stat.isDirectory()) problems.push('目标已存在且不是目录')
    else {
      for (const name of fileNames) {
        if (validateSegment(name).length > 0) {
          problems.push(`导出文件名不合法：${name}`)
          continue
        }
        try {
          fs.accessSync(path.join(target, name))
          冲突.push(name)
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') problems.push(`目标文件无法检查：${name}`)
        }
      }
    }
  }
  return { ok: problems.length === 0 && 冲突.length === 0, 目标目录: target, 已存在, problems, 冲突 }
}

export interface ExportVerification {
  readonly ok: boolean
  readonly 目标目录: string
  readonly problems: readonly string[]
  readonly 文件: readonly { 名称: string; 预期哈希: string; 实际哈希: string | null; 一致: boolean }[]
}

/** 只读验收实际落盘的两个文件；清单存在本身不代表本批已完成。 */
export function verifyExportTarget(bookRoot: string, targetDir: string, computed: ComputedExport): ExportVerification {
  const expected = [{ 名称: computed.合集文件, content: computed.合集 }, { 名称: computed.清单文件, content: computed.清单 }]
  const target = inspectExportTarget(bookRoot, targetDir, computed.ok ? expected.map(f => f.名称) : [])
  const problems = [...target.problems, ...computed.gaps]
  const 文件: Array<{ 名称: string; 预期哈希: string; 实际哈希: string | null; 一致: boolean }> = []
  if (computed.ok && problems.length === 0) {
    for (const file of expected) {
      const 预期哈希 = materialHash(file.content)
      let 实际哈希: string | null = null
      try { 实际哈希 = readMaterialFile(target.目标目录, file.名称).hash }
      catch (err) { problems.push(`导出文件不可读取：${file.名称}（${err instanceof Error ? err.message : String(err)}）`) }
      const 一致 = 实际哈希 === 预期哈希
      if (实际哈希 !== null && !一致) problems.push(`导出文件内容不一致：${file.名称}`)
      文件.push({ 名称: file.名称, 预期哈希, 实际哈希, 一致 })
    }
  }
  return { ok: computed.ok && problems.length === 0 && 文件.length === 2 && 文件.every(f => f.一致), 目标目录: target.目标目录, problems, 文件 }
}

// ---------------------------------------------------------------------------
// 专业剧本导出（阶段 4，muse-dev）：Fountain / 分镜剧本 / master-scene 三种输出。
//
// 只算不写：computeScreenplayExport 读剧本定稿真源（剧本/电影/剧本.md 或
// 剧本/短剧/集NNN.md），在内存中生成 Fountain 与 Markdown 两份完整载荷；
// 实际写盘由主 Agent 经原生文件工具完成（与小说导出同一纪律：目标在书仓
// 围栏外时属提权情形，清单最后落盘、写盘后逐份比对哈希才算完成）。
// 导出确定性（无时间戳），同一书仓状态重复计算结果字节相同。
// 默认格式 storyboard（2026-11-11 用户决定）：电影与短剧默认出《痴迷》式分镜剧本
// （总纲 + △分镜块 + 导演层分镜头表）；master-scene（FADE IN / INT. 场景标题）
// 是电影的次要导出，Fountain 是编剧层纯文本。小说导出（computeExport /
// verifyExportTarget）一字不动，只加不改。
// ---------------------------------------------------------------------------

/** 剧本导出形态：电影剧本全文一份；短剧按集导出（集号三位）。 */
export type ScreenplayExportKind = '电影剧本' | '短剧'
/**
 * 导出格式（2026-11-11 用户决定：电影剧本默认出《痴迷》式分镜剧本）：
 * storyboard（默认：总纲 + △分镜块 + 导演层分镜头表；电影与短剧通用）/
 * master-scene（电影次要导出：FADE IN + INT./EXT. 场景标题的编剧层 + 导演层；
 * 短剧不支持）/ fountain（编剧层纯文本）/ both（fountain + storyboard）。
 * 旧值 markdown 已废弃：电影用 storyboard（默认）或 master-scene 替代。
 */
export type ScreenplayExportFormat = 'storyboard' | 'master-scene' | 'fountain' | 'both'

export interface ScreenplayExportOptions {
  readonly 形态: ScreenplayExportKind
  /** 短剧必填（1–100）；电影剧本不传。 */
  readonly 集?: number
  /** 默认 storyboard（《痴迷》式分镜剧本）。 */
  readonly 格式?: ScreenplayExportFormat
  /** 导演已填的分镜头表；不传则按场生成待填模板行（不编造景别与运镜）。 */
  readonly 分镜头表?: ShotList
  /**
   * 总纲（剧本圣经，对齐轮次）：传了就渲染总纲文件（`<书名>-总纲.md`），并以
   * 总纲第五节为人名注册表做导出前一致性检查——全剧人名必须在册且只用标准名，
   * 未登记/误标直接阻断（gaps），不准静默输出。不传则不渲染总纲、不做人名检查。
   */
  readonly 总纲?: StoryBibleInput
}

export interface ComputedScreenplayExport {
  readonly ok: boolean
  readonly gaps: readonly string[]
  /** 非阻断提醒：分镜头表待填项、台词超长等（见 renderEpisodeScript 警告）。 */
  readonly 警告: readonly string[]
  readonly 书名: string
  readonly 形态: ScreenplayExportKind
  readonly 标题: string
  readonly 集?: number
  readonly 场景数: number
  /** 台词总字数（非空白字符数；电影按台词行计，短剧按 totalDialogueChars 计）。 */
  readonly 台词字数: number
  readonly fountain文件: string
  readonly markdown文件: string
  /** markdown 的实际形态：storyboard（默认）/ master-scene；不出 markdown 时为空。 */
  readonly markdown格式: 'storyboard' | 'master-scene' | ''
  readonly fountain: string
  readonly markdown: string
  /** 总纲文件（传了 总纲 才有，否则为空）；总纲正文（同上）。 */
  readonly 总纲文件: string
  readonly 总纲: string
  /** 人名一致性检查（传了 总纲 才做，否则 ok:true、problems 为空）。 */
  readonly 人名检查: CharacterNameCheck
  readonly 分镜头表: ShotList
  readonly 分镜头数: number
  /** 电影剧本的格式审读发现项（validateScreenplay）；短剧为空（短剧审读另走 reviewShortDramaEpisode，需分集大纲，不在导出里做）。 */
  readonly 审读发现项: readonly ScreenplayFinding[]
}

function dialogueCharsOf(text: string): number {
  return [...text].filter((ch) => !/\s/.test(ch)).length
}

/**
 * 只读计算剧本导出计划与两份完整载荷；不落盘、不改书仓。
 * 阻断条件：定稿文件缺失/解析失败、电影剧本有高级别格式发现项
 * （(beat)、SFX:/MUSIC: 独占行、空场等）、分镜头表校验失败。
 */
export function computeScreenplayExport(bookRoot: string, options: ScreenplayExportOptions): ComputedScreenplayExport {
  const gaps: string[] = []
  const 警告: string[] = []
  const fail = (extra?: readonly string[]): ComputedScreenplayExport => ({
    ok: false, gaps: [...gaps, ...(extra ?? [])], 警告, 书名: '', 形态: options.形态, 标题: '',
    ...(options.集 !== undefined ? { 集: options.集 } : {}),
    场景数: 0, 台词字数: 0, fountain文件: '', markdown文件: '', markdown格式: '', fountain: '', markdown: '',
    总纲文件: '', 总纲: '', 人名检查: { ok: true, problems: [] },
    分镜头表: { 标题: '', 镜: [] }, 分镜头数: 0, 审读发现项: [],
  })
  if (options.形态 !== '电影剧本' && options.形态 !== '短剧') return fail(['导出形态必须是 电影剧本 或 短剧'])
  const 格式 = options.格式 ?? 'storyboard'
  if (格式 !== 'storyboard' && 格式 !== 'master-scene' && 格式 !== 'fountain' && 格式 !== 'both') {
    return fail(['导出格式必须是 storyboard、master-scene、fountain 或 both。旧值 markdown 已废弃。电影默认 storyboard，次要导出用 master-scene。'])
  }
  if (options.形态 === '短剧' && 格式 === 'master-scene') {
    return fail(['短剧没有 master-scene 形态，短剧剧本本身就是分镜剧本。请用 storyboard（默认）、fountain 或 both。'])
  }
  if (options.形态 === '短剧' && (options.集 === undefined || !Number.isSafeInteger(options.集) || options.集 < 1 || options.集 > 100)) {
    return fail(['短剧导出必须传 --集 1–100 的集号'])
  }
  if (options.形态 === '电影剧本' && options.集 !== undefined) return fail(['电影剧本导出不传集号（集号只用于短剧）'])
  // 总纲先行校验：七节不全直接阻断，不渲染、不继续导出。
  let 总纲文件 = ''
  let 总纲 = ''
  if (options.总纲 !== undefined) {
    const bibleCheck = validateStoryBible(options.总纲)
    if (!bibleCheck.ok) return fail(bibleCheck.problems.map((p) => `总纲校验失败：${p}`))
    try {
      总纲 = renderStoryBible(options.总纲)
    } catch (err) {
      return fail([`总纲渲染失败：${err instanceof Error ? err.message : String(err)}`])
    }
  }
  const root = canonicalizePath(bookRoot)
  if (root === '') return fail(['书仓路径无效'])
  const 书名 = path.basename(root)
  const 定稿相对路径 = options.形态 === '电影剧本' ? paths.电影剧本() : paths.短剧集(options.集!)
  let source: string
  try {
    source = readMaterialFile(root, 定稿相对路径).text
  } catch (error) {
    return fail([`剧本定稿读取失败：${定稿相对路径}（${error instanceof Error ? error.message : String(error)}）。请先把剧本定稿到 剧本/ 目录。目录约定见 docs/book-format.md「剧本定稿目录」。`])
  }

  const stem = safeFileStem(书名)
  if (options.总纲 !== undefined) 总纲文件 = `${stem}-总纲.md`
  const wantFountain = 格式 === 'fountain' || 格式 === 'both'
  const wantStoryboard = 格式 === 'storyboard' || 格式 === 'both'
  const wantMasterScene = 格式 === 'master-scene'
  const wantMarkdown = wantStoryboard || wantMasterScene
  const markdown格式: 'storyboard' | 'master-scene' | '' = wantStoryboard ? 'storyboard' : wantMasterScene ? 'master-scene' : ''
  // 人名一致性检查（传了总纲才做）：注册表 = 总纲第五节；失败直接阻断。
  const checkNames = (names: readonly string[]): CharacterNameCheck => {
    if (options.总纲 === undefined) return { ok: true, problems: [] }
    return checkCharacterNames(buildCharacterRegistry(options.总纲), names)
  }

  if (options.形态 === '电影剧本') {
    const parsed = parseScreenplay(source)
    if (!parsed.ok || parsed.draft === undefined) return fail(parsed.problems)
    const draft = parsed.draft
    const findings = validateScreenplay(draft)
    const blocking = findings.filter((f) => f.严重程度 === '高')
    if (blocking.length > 0) {
      return fail(blocking.map((f) => `审读阻断 ${f.证据位置}：${f.问题说明}`))
    }
    const shotList = options.分镜头表 ?? deriveShotListTemplate(draft.标题, draft.场.map((s) => ({
      场号: s.场号,
      画面内容: s.动作[0] ?? '',
      台词: s.台词段[0]?.台词[0] ?? '',
    })))
    const shotCheck = validateShotList(shotList, draft.场.length)
    if (!shotCheck.ok) return fail(shotCheck.problems)
    警告.push(...shotCheck.warnings)
    const 人名检查 = checkNames(collectScreenplayNames(draft))
    if (!人名检查.ok) return fail(人名检查.problems)
    let fountain = ''
    let markdown = ''
    try {
      if (wantFountain) fountain = renderFountainScreenplay(draft)
      if (wantStoryboard) markdown = renderFilmStoryboardMarkdown(draft, shotList, options.总纲)
      else if (wantMasterScene) markdown = renderScreenplayMarkdown(draft, shotList)
    } catch (err) {
      return fail([`剧本导出渲染失败：${err instanceof Error ? err.message : String(err)}`])
    }
    return {
      ok: true, gaps: [], 警告, 书名, 形态: '电影剧本', 标题: draft.标题,
      场景数: draft.场.length,
      台词字数: draft.场.flatMap((s) => s.台词段).flatMap((b) => b.台词).reduce((sum, line) => sum + dialogueCharsOf(line), 0),
      fountain文件: wantFountain ? `${stem}-电影剧本.fountain` : '',
      markdown文件: wantMarkdown ? `${stem}-电影剧本.md` : '',
      markdown格式,
      fountain, markdown,
      总纲文件, 总纲, 人名检查,
      分镜头表: shotList, 分镜头数: shotList.镜.length, 审读发现项: findings,
    }
  }

  const parsed = parseEpisodeScript(source)
  if (!parsed.ok || parsed.episode === undefined) return fail(parsed.problems)
  const episode = parsed.episode
  if (episode.集 !== options.集) return fail(['集号不一致：定稿文件名和剧本正文必须属于同一集'])
  let rendered: ReturnType<typeof renderEpisodeScript>
  try {
    rendered = renderEpisodeScript(episode)
  } catch (err) {
    return fail([`单集剧本结构校验失败：${err instanceof Error ? err.message : String(err)}`])
  }
  警告.push(...rendered.警告)
  const shotList = options.分镜头表 ?? deriveShotListTemplate(`集${episodeNo(episode.集)}：${episode.标题}`, episode.场景.map((s) => ({
    场号: s.场,
    画面内容: s.动作,
    台词: s.台词[0]?.台词 ?? '',
  })))
  const shotCheck = validateShotList(shotList, episode.场景.length)
  if (!shotCheck.ok) return fail(shotCheck.problems)
  警告.push(...shotCheck.warnings)
  const 人名检查 = checkNames(collectEpisodeNames(episode))
  if (!人名检查.ok) return fail(人名检查.problems)
  let fountain = ''
  let markdown = ''
  try {
    if (wantFountain) fountain = renderEpisodeFountain(episode)
    if (wantMarkdown) markdown = renderEpisodeMarkdown(episode, shotList)
  } catch (err) {
    return fail([`剧本导出渲染失败：${err instanceof Error ? err.message : String(err)}`])
  }
  const epNo = episodeNo(episode.集)
  return {
    ok: true, gaps: [], 警告, 书名, 形态: '短剧', 标题: episode.标题, 集: episode.集,
    场景数: episode.场景.length,
    台词字数: totalDialogueChars(episode.场景),
    fountain文件: wantFountain ? `${stem}-短剧集${epNo}.fountain` : '',
    markdown文件: wantMarkdown ? `${stem}-短剧集${epNo}.md` : '',
    markdown格式,
    fountain, markdown,
    总纲文件, 总纲, 人名检查,
    分镜头表: shotList, 分镜头数: shotList.镜.length, 审读发现项: [],
  }
}

/**
 * 剧本导出的目标目录只读检查：复用小说导出的 inspectExportTarget（目标
 * 落在定稿目录内拒绝、同名文件列入冲突），再加一条——目标落在剧本定稿
 * 目录（剧本/）内同样拒绝，导出不能污染剧本真源。
 */
export function inspectScreenplayExportTarget(bookRoot: string, targetDir: string, fileNames: readonly string[]): ExportTargetReport {
  const base = inspectExportTarget(bookRoot, targetDir, fileNames)
  const problems = [...base.problems]
  const root = canonicalizePath(bookRoot)
  const target = canonicalizePath(targetDir)
  if (root !== '' && target !== '') {
    const scriptRoot = path.join(root, '剧本')
    if (target === scriptRoot || isInsidePath(scriptRoot, target)) {
      problems.push('目标位于剧本定稿目录内，导出会污染真源：请另选目录')
    }
  }
  return { ...base, problems, ok: problems.length === 0 && base.冲突.length === 0 }
}

export interface ScreenplayExportVerification {
  readonly ok: boolean
  readonly 目标目录: string
  readonly problems: readonly string[]
  readonly 文件: readonly { 名称: string; 预期哈希: string; 实际哈希: string | null; 一致: boolean }[]
}

/** 只读验收实际落盘的剧本导出文件（Fountain 和/或 Markdown，按本次导出格式逐份比对哈希）。 */
export function verifyScreenplayExportTarget(bookRoot: string, targetDir: string, computed: ComputedScreenplayExport): ScreenplayExportVerification {
  const expected: { 名称: string; content: string }[] = []
  if (computed.fountain文件 !== '') expected.push({ 名称: computed.fountain文件, content: computed.fountain })
  if (computed.markdown文件 !== '') expected.push({ 名称: computed.markdown文件, content: computed.markdown })
  if (computed.总纲文件 !== '') expected.push({ 名称: computed.总纲文件, content: computed.总纲 })
  const target = inspectScreenplayExportTarget(bookRoot, targetDir, computed.ok ? expected.map((f) => f.名称) : [])
  const problems = [...target.problems, ...computed.gaps]
  const 文件: Array<{ 名称: string; 预期哈希: string; 实际哈希: string | null; 一致: boolean }> = []
  if (computed.ok && problems.length === 0) {
    for (const file of expected) {
      const 预期哈希 = materialHash(file.content)
      let 实际哈希: string | null = null
      try { 实际哈希 = readMaterialFile(target.目标目录, file.名称).hash }
      catch (err) { problems.push(`导出文件不可读取：${file.名称}（${err instanceof Error ? err.message : String(err)}）`) }
      const 一致 = 实际哈希 === 预期哈希
      if (实际哈希 !== null && !一致) problems.push(`导出文件内容不一致：${file.名称}`)
      文件.push({ 名称: file.名称, 预期哈希, 实际哈希, 一致 })
    }
  }
  return {
    ok: computed.ok && problems.length === 0 && 文件.length === expected.length && 文件.every((f) => f.一致),
    目标目录: target.目标目录, problems, 文件,
  }
}
