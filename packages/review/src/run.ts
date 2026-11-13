/**
 * 审核编排辅助:方案留痕 + 注册检查执行。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  MACHINE_SCHEMA_VERSION,
  countPendingReviewDrafts,
  countProseText,
  chapterLengthIdentity,
  checkChapterLength,
  readChapterLength,
  emptyReviewRecord,
  findPendingReviewDraft,
  loadEpisodeReviewRecord,
  loadReviewRecord,
  loadScreenplayReviewRecord,
  paths,
  parseEpisodeScript,
  planReviewRecord,
  renderEpisodeScript,
  writeEpisodeReviewRecord,
  writeReviewRecord,
  writeScreenplayReviewRecord,
  normalizeFinding,
  draftHashOf,
  reviewInputFingerprintOf,
  loadMaterialPackage,
  type LoadedMaterialPackage,
  type DraftFile,
  type ChapterKey,
  type EpisodeOutline,
  type EpisodeScriptInput,
  type FilmLength,
  type Finding,
  type ModuleRunState,
  type ReviewPlan,
  type ReviewRecord,
  type ReviewDisposition,
  type ProseTextCounts,
  type ChapterLengthPolicy,
  type ChapterLengthCheck,
  type SceneOutline,
  type ScreenplayDraft,
} from '@webnovel/core'
import { 作者意见模块名, findingId, registerDefaultChecks } from './checks'
import {
  computeEpisodeFindings,
  computeScreenplayFindings,
  episodeFingerprint,
  episodeOutlineText,
  episodeReviewId,
  registerFilmDramaChecks,
  screenplayFingerprint,
  screenplayReviewId,
  短剧审读名,
  短剧审读语义名,
  剧本场次完整性审读名,
  剧本对白审读名,
  剧本节奏审读名,
  剧本语义审读名,
} from './film-drama'
import { getCheck, listChecks, type ReviewScope } from './registry'
import { bookWriter, withBookWrite } from '@webnovel/core'

export interface ReviewKey {
  readonly 卷: number
  readonly 章: number
  readonly 章名: string
}

export interface RunReviewResult {
  readonly ok: boolean
  readonly reason?: string
  readonly record: ReviewRecord | null
  readonly 材料段?: Readonly<Record<string, string>>
  readonly 正文统计?: ReviewProseStats
  readonly 篇幅核对?: ChapterLengthCheck
}

export interface ReviewProseStats extends ProseTextCounts {
  readonly 稿件: string
  readonly 版本: number | null
  readonly 审稿哈希: string
  readonly 审读指纹: string
  readonly 统计口径: string
}

function readText(root: string, rel: string): string | null {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf-8')
  } catch {
    return null
  }
}

function reviewId(key: ReviewKey): string {
  return `审-${String(key.卷).padStart(2, '0')}-${String(key.章).padStart(4, '0')}`
}

function reviewInput(bookRoot: string, key: ReviewKey, plan: ReviewPlan | undefined): { pending: DraftFile; outline: string; bodyHash: string; fingerprint: string; materials: LoadedMaterialPackage; length: ChapterLengthPolicy } | null {
  const pending = findPendingReviewDraft(bookRoot, key)
  if (pending === null) return null
  const outline = readText(bookRoot, paths.确认细纲(key.卷, key.章, key.章名)) ?? ''
  const materials = loadMaterialPackage(bookRoot, key)
  const length = readChapterLength(bookRoot)
  return {
    pending,
    outline,
    bodyHash: draftHashOf(pending.body),
    fingerprint: reviewInputFingerprintOf({ 正文: pending.body, 细纲: outline, 材料清单: materials.审读材料标识, 方案: plan, 章节篇幅: chapterLengthIdentity(length) }),
    materials,
    length,
  }
}

/** 身份三元组分隔符:单元分隔符不会出现在发现项文本里。 */
const FINDING_KEY_SEP = '\u001F'

/**
 * 发现项身份:发现项编号按轮次内序号生成(前一项被解决后序号会平移),
 * 因此跨轮认亲只能用语义三元组,否则会把处置带给另一个问题。
 */
function findingIdentity(finding: Pick<Finding, '模块名' | '证据位置' | '问题说明'>): string {
  return [finding.模块名, finding.证据位置, finding.问题说明].join(FINDING_KEY_SEP)
}

function dispositionMap(record: ReviewRecord): Map<string, ReviewDisposition> {
  const result = new Map<string, ReviewDisposition>()
  for (const item of [...(record.待继承处置 ?? []), ...record.问题]) {
    if (item.处置状态 === '待处理') continue
    const { 模块名, 证据位置, 问题说明, 处置状态, 处置说明, 转交提案 } = item
    result.set(findingIdentity(item), { 模块名, 证据位置, 问题说明, 处置状态,
      ...(转交提案 === undefined ? {} : { 转交提案 }),
      ...(处置说明 === undefined ? {} : { 处置说明 }) })
  }
  return result
}

function inheritDisposition(finding: Finding, previous: Map<string, ReviewDisposition>): Finding {
  const old = previous.get(findingIdentity(finding))
  return old === undefined ? finding : { ...finding, 处置: old.处置状态, 处置状态: old.处置状态,
    ...(old.转交提案 === undefined ? {} : { 转交提案: old.转交提案 }),
    ...(old.处置说明 === undefined ? {} : { 处置说明: old.处置说明 }) }
}

/**
 * 待继承处置只认本范围的模块：章节审读的待继承处置不能被剧本/短剧模块
 * 的名字顶掉，反之亦然（范围过滤，见 registry.ts）。
 */
function remainingDispositions(record: ReviewRecord, resetting: boolean, processed: ReadonlySet<string>, scope: ReviewScope): ReviewDisposition[] {
  const active = new Set(listChecks(scope).filter(c => c.执行形态 !== '作者').map(c => c.名称))
  const prior = resetting ? [...dispositionMap(record).values()] : record.待继承处置 ?? []
  return prior.filter(item => active.has(item.模块名) && !processed.has(item.模块名))
}

function planReviewLocked(bookRoot: string, key: ReviewKey, plan: ReviewPlan): ReviewRecord {
  registerDefaultChecks()
  return planReviewRecord(bookRoot, key, plan)
}

export const planReview = bookWriter(planReviewLocked)

export function computeReview(bookRoot: string, key: ReviewKey): RunReviewResult {
  registerDefaultChecks()
  const pendingCount = countPendingReviewDrafts(bookRoot, key)
  if (pendingCount === 0) {
    return { ok: false, reason: '无待审稿', record: null }
  }
  if (pendingCount > 1) {
    return { ok: false, reason: `待审稿不唯一:${pendingCount}份`, record: null }
  }

  const existing = loadReviewRecord(bookRoot, key) ?? emptyReviewRecord()
  const plan = existing.方案
  const skips = new Map<string, string>()
  for (const item of plan?.跳过 ?? []) {
    if (item.理由.trim() !== '') skips.set(item.模块, item.理由)
  }

  // F5(2026-09-05):审核证据绑定被审正文哈希。换稿(哈希失配)→新审读轮:模块态重置、
  // 旧稿发现项不保留(作者意见条目除外——作者指示跨稿有效),旧完成态不再冒充当前稿已审。
  const inputIdentity = reviewInput(bookRoot, key, plan)
  if (inputIdentity === null) return { ok: false, reason: '待审稿在审核过程中消失或不再唯一', record: null }
  if (inputIdentity.materials.问题.length > 0) {
    return { ok: false, reason: `材料需要核对：${inputIdentity.materials.问题.join('；')}`, record: null }
  }
  const 审稿哈希 = inputIdentity.bodyHash
  const 审读指纹 = inputIdentity.fingerprint
  const stale = existing.审读指纹 !== 审读指纹
  const 审核编号 = reviewId(key)
  // 检查与指纹消费同一份读入快照，读取间作者改动不能把旧结果绑定到新输入。
  const pending = inputIdentity.pending
  const counts = countProseText(pending.body)
  const 篇幅核对 = checkChapterLength(inputIdentity.length, counts.汉字数)
  const 材料版本 = pending.版本
  const input = {
    bookRoot,
    scope: '章' as const,
    key: key as ChapterKey,
    待审稿: pending.body,
    细纲: inputIdentity.outline,
    审核编号,
    材料版本: 材料版本 === null ? pending.relPath : `${pending.relPath}@${材料版本}`,
    材料段: inputIdentity.materials.段,
    篇幅核对,
  }

  // Keep removed/legacy module keys as audit history, but never reuse their
  // completion state for the current input when the fingerprint is stale.
  const 模块: Record<string, ModuleRunState> = { ...existing.模块 }
  const 旧处置 = dispositionMap(existing)
  // 章节完成判定只看 '章' 范围的模块：注册表里即使已有剧本/短剧模块
  // （同一进程里跑过跟进轮），也不得计入章节完成态（范围过滤）。
  const checks = listChecks('章').filter((c) => c.执行形态 !== '作者')
  const names = checks.map((c) => c.名称)
  // 确定性模块每次运行都会重算；隔离子 Agent 模块的发现项由 ingestFindings
  // 生产，必须跨过本次脚本运行保留，否则脚本与语义回写的先后顺序会改变记录内容。
  const deterministicNames = new Set(checks.filter((c) => c.run !== undefined).map((c) => c.名称))
  const 问题: Finding[] = stale
    ? existing.问题.filter((finding) => finding.模块名 === 作者意见模块名)
    : existing.问题.filter((finding) => !deterministicNames.has(finding.模块名))

  for (const name of names) {
    const skipReason = skips.get(name)
    if (skipReason !== undefined) {
      模块[name] = { 完成: true, 失败: false, 跳过: true, 理由: skipReason }
      continue
    }
    const mod = getCheck(name)
    if (mod === undefined) {
      模块[name] = { 完成: false, 失败: true, 理由: '未注册' }
      continue
    }
    try {
      if (mod.run === undefined) {
        // 隔离子 Agent 形态:主 Agent 编排派发(§9),本确定性执行面不调 run。
        // 发现项须经 ingestFindings 回写后才算完成——空审不再自动通过(拍板:空审 fail-closed)。
        const previous = stale ? undefined : 模块[name]
        模块[name] = previous?.完成 === true && previous.待回写 !== true
          ? previous
          : { 完成: false, 失败: false, 待回写: true, 理由: '隔离子 Agent 编排' }
        continue
      }
      for (const finding of mod.run(input)) {
        问题.push(inheritDisposition(finding, 旧处置))
      }
      模块[name] = { 完成: true, 失败: false }
    } catch (err) {
      模块[name] = { 完成: false, 失败: true, 理由: String(err) }
    }
  }

  /**
   * `模块` 合并历史键只为留痕；`完成` 只看本轮处理过的模块。
   *
   * 若对合并后的全集取 every，一个曾经失败、之后被摘掉或改名的模块会永久压住 `完成`，
   * 章节卡在改稿且重跑无法自愈——只能手改审核记录 JSON。
   */
  const 完成 = names.every((name) => 模块[name]?.完成 === true)
  const record: ReviewRecord = {
    schemaVersion: MACHINE_SCHEMA_VERSION,
    完成,
    问题,
    模块,
    方案: plan,
    审稿哈希,
    审读指纹,
    待继承处置: remainingDispositions(existing, stale, new Set([...deterministicNames, ...skips.keys()]), '章'),
  }
  const 正文统计: ReviewProseStats = {
    稿件: pending.relPath,
    版本: pending.版本,
    审稿哈希,
    审读指纹,
    统计口径: '正文含章标题，不含 frontmatter 和草稿候选事实。换行统一为 LF、去首尾空白；字符数按 Unicode 码点计，含标点、Markdown 标记和内部空白；非空白字符数仅剔除空白；汉字数仅计 Unicode Han 字符。',
    ...counts,
  }
  return { ok: true, record, 材料段: inputIdentity.materials.段, 正文统计, 篇幅核对 }
}

/**
 * 进程内写入路径（R21 写侧）:computeReview＋写入器落盘。技能脚本只调 computeReview
 * （脚本只算不写），脚本算出的确定性模块发现项经常驻工具 novel_record_review_findings
 * （ingestFindings 逐模块回写）落盘——模块态置完成、发现项整批替换、跨轮认亲沿用旧
 * 处置，净效果与本函数写盘一致。
 */
function runReviewLocked(bookRoot: string, key: ReviewKey): RunReviewResult {
  const result = computeReview(bookRoot, key)
  if (result.ok && result.record !== null) writeReviewRecord(bookRoot, key, result.record)
  return result
}

export const runReview = bookWriter(runReviewLocked)

/**
 * 发现项回写(拍板:堵「空审通过」):隔离子 Agent 产出的发现项并入审核记录。
 *
 * 该模块置为 {完成:true, 待回写:false};并入复用 runReview 既有的跨轮认亲
 * (模块名+证据位置+问题说明三元组沿用旧处置),不另写第二套认亲规则。
 * 每次自动模块回写必须携带实际审读输入的指纹；作者意见跨稿有效，不刷新自动证据身份。
 * 本模块本轮结果整批替换、其他模块留痕不动;全部模块完成且无待回写时记录完成为真。
 */
function ingestFindingsLocked(
  bookRoot: string,
  key: ReviewKey,
  模块名: string,
  rawFindings: readonly unknown[],
  expectedFingerprint?: string,
): { readonly ok: boolean; readonly reason?: string; readonly record: ReviewRecord | null; readonly 待回写模块?: readonly string[] } {
  registerDefaultChecks()
  const check = getCheck(模块名)
  if (check === undefined) {
    return { ok: false, reason: `未注册的审读模块:${模块名}`, record: null }
  }
  if (check.适用范围 !== '章') {
    return { ok: false, reason: `审读模块 ${模块名} 适用范围是 ${check.适用范围}，不能回写进章的审核记录`, record: null }
  }
  const authorOpinion = check.执行形态 === '作者'
  if (!authorOpinion && (typeof expectedFingerprint !== 'string' || expectedFingerprint.trim() === '')) {
    return { ok: false, reason: '自动审读结果必须携带审读指纹：每个模块回写均需提供实际审读输入的指纹，请重新运行审核', record: null }
  }
  const existing = loadReviewRecord(bookRoot, key) ?? emptyReviewRecord()

  const inputIdentity = reviewInput(bookRoot, key, existing.方案)
  if (inputIdentity === null) return { ok: false, reason: '无唯一待审稿，拒绝回写可能属于旧稿的结果', record: null }
  if (!authorOpinion && expectedFingerprint !== inputIdentity.fingerprint) {
    return { ok: false, reason: '审读结果已过期：回写指纹与当前审核输入不一致，请重新运行审核', record: null }
  }
  if (!authorOpinion && inputIdentity.materials.问题.length > 0) {
    return { ok: false, reason: `材料需要核对：${inputIdentity.materials.问题.join('；')}`, record: null }
  }
  const hasPriorReviewState = existing.完成 || existing.问题.length > 0 || Object.keys(existing.模块).length > 0
  const stale = (existing.审读指纹 !== undefined && existing.审读指纹 !== inputIdentity.fingerprint)
    || (existing.审读指纹 === undefined && hasPriorReviewState)
  // 重跑通道（2026-09-18 真机缺陷 D-002）：记录陈旧时，调用方传与当前输入一致的
  // 审读指纹（确定性脚本当轮产出）即证明发现项是新跑的，按 F5 语义重置旧轮次后
  // 接收——旧完成态与旧稿发现项不再冒充当前稿已审（作者意见条目跨稿保留，处置
  // 认亲照旧）。本轮后续结果仍逐条验指纹；作者意见本身不能重开自动审读轮次。
  const resetting = stale && !authorOpinion

  const 旧处置 = dispositionMap(existing)

  const findings: Finding[] = []
  let n = 1
  for (const raw of rawFindings) {
    if (raw !== null && typeof raw === 'object') {
      const value = raw as Record<string, unknown>
      if (value['处置状态'] === '已转提案' || value['处置'] === '已转提案' || value['转交提案'] !== undefined) {
        return { ok: false, reason: '发现项回写不接受转交处置。请用 novel_apply_revision 或 novel_apply_revision_batch 校验已通过的关联提案', record: null }
      }
    }
    const f = normalizeFinding(raw)
    if (f === null) continue
    const withModule: Finding = { ...f, 模块名, 审核编号: reviewId(key) }
    const numbered: Finding = { ...withModule, 发现项编号: findingId(withModule.审核编号, 模块名, n++) }
    findings.push(inheritDisposition(numbered, 旧处置))
  }

  // 重置轮次（resetting）：旧完成态一律不作数，各模块须按当前输入重新回写；
  // 旧稿发现项不保留（作者意见跨稿有效），认亲处置仍按三元组沿用。
  const base问题 = resetting ? existing.问题.filter((p) => p.模块名 === 作者意见模块名) : existing.问题
  const base模块 = resetting ? {} : existing.模块
  const 问题: Finding[] = [...base问题.filter((p) => p.模块名 !== 模块名), ...findings]
  const 模块: Record<string, ModuleRunState> = {
    ...base模块,
    [模块名]: { 完成: true, 失败: false, 待回写: false },
  }
  const names = listChecks('章').filter((c) => c.执行形态 !== '作者').map((c) => c.名称)
  // 待办与完成同源:记录里的「模块」只有回写过的键(首轮与重置轮都不含未回写模块),
  // 从中筛待回写会漏报;一律按注册模块全集减去已完成者计算,完成＝待办为空。
  // 全集按 '章' 范围过滤：剧本/短剧模块不得计入章节待回写（范围过滤）。
  const 待回写模块 = names.filter((name) => 模块[name]?.完成 !== true || 模块[name]?.待回写 === true)
  const 完成 = 待回写模块.length === 0
  const record: ReviewRecord = {
    ...existing,
    完成,
    问题,
    模块,
    ...(authorOpinion ? {} : { 审稿哈希: inputIdentity.bodyHash, 审读指纹: inputIdentity.fingerprint }),
    待继承处置: remainingDispositions(existing, resetting, new Set([模块名]), '章'),
  }
  writeReviewRecord(bookRoot, key, record)
  return { ok: true, record, 待回写模块 }
}

export const ingestFindings = bookWriter(ingestFindingsLocked)

/**
 * 作者意见回写（M1 design §3）：作者「只提意见、不改正文」时，意见进当前轮审核记录，
 * 作为发现项（模块名=作者意见，处置=待处理，建议返回节点=改稿），草稿字节不变。
 * **无审核记录时拒绝**——不凭意见凭空建记录（否则推导会把章节直接判到改稿、跳过检查项库）。
 * 「作者意见」模块执行形态=「作者」（checks.ts）：不进 names.every 完成判定、重跑不丢、
 * 非待处理处置沿用（与其它发现项同一认亲规则）。
 */
function recordAuthorFindingLocked(
  bookRoot: string,
  key: ReviewKey,
  input: { readonly 问题说明: string; readonly 证据位置?: string; readonly 修改建议?: string },
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  registerDefaultChecks()
  const existing = loadReviewRecord(bookRoot, key)
  if (existing === null) return { ok: false, reason: '无审核记录——先完成一轮审核（含确定性检查与语义回写），作者意见才有可附着的记录' }
  const raw = {
    模块名: 作者意见模块名,
    问题说明: input.问题说明,
    ...(input.证据位置 === undefined ? {} : { 证据位置: input.证据位置 }),
    ...(input.修改建议 === undefined ? {} : { 修改建议: input.修改建议 }),
    建议返回节点: '改稿',
  }
  const r = ingestFindings(bookRoot, key, 作者意见模块名, [raw])
  if (!r.ok) return { ok: false, reason: r.reason ?? '作者意见回写失败' }
  return { ok: true }
}

export const recordAuthorFinding = bookWriter(recordAuthorFindingLocked)

// ===== 影视剧审读（跟进轮，2026-11-11）：剧本 / 短剧集 =====
// 与章节审读同一套逻辑（方案留痕 + 确定性重算 + 语义回写 + 跨轮认亲 +
// 指纹绑定 + 空审 fail-closed），区别只有两点：
// (1) 完成判定只看本范围的模块（scope 过滤）；
// (2) 审读记录按剧本 / 集寻址（草稿区/审核/审-剧本.json、审-集NNN.json），
//     不按卷/章寻址。输入是内存里的草稿 + 大纲（工具传入的文本），
//     不从书仓读待审稿——剧本/短剧草稿没有“唯一待审稿”的磁盘形态。

export interface EpisodeReviewKey {
  readonly 集: number
}

export interface FilmDramaReviewResult {
  readonly ok: boolean
  readonly reason?: string
  readonly record: ReviewRecord | null
  readonly 审读指纹?: string
  readonly 审稿哈希?: string
  readonly 待回写模块?: readonly string[]
}

/** 范围内尚未回写的模块（与 ingestFilmDramaFindings 同一口径：未完成或待回写）。 */
function pendingFilmDramaModules(record: ReviewRecord, scope: '剧本' | '集'): readonly string[] {
  const names = listChecks(scope).filter((c) => c.执行形态 !== '作者').map((c) => c.名称)
  return names.filter((name) => record.模块[name]?.完成 !== true || record.模块[name]?.待回写 === true)
}

export interface ScreenplayReviewRunInput {
  readonly 剧本草稿: ScreenplayDraft
  readonly 剧本草稿文本: string
  readonly 分场大纲?: SceneOutline
  readonly 分场大纲文本?: string
  readonly 片长?: FilmLength
  readonly 方案?: ReviewPlan
  readonly 材料版本?: string
}

export interface EpisodeReviewRunInput {
  readonly 剧本: EpisodeScriptInput
  readonly 大纲: EpisodeOutline
  readonly 方案?: ReviewPlan
  readonly 材料版本?: string
}

/**
 * 剧本/短剧集审读记录的公共组装：确定性发现项（本轮重算）+ 语义发现项
 * （已回写的保留）+ 模块态 + 完成判定。结构与 computeReview 同构，
 * 只是范围换成本 scope、输入换成内存草稿。确定性模块的发现项与模块态
 * 取自 computed（film-drama.ts 的纯计算已跑过注册表）；语义模块沿用
 * computeReview 的“上轮完成且未待回写则保留，否则待回写”规则。
 */
function buildFilmDramaRecord(
  scope: '剧本' | '集',
  existing: ReviewRecord,
  computed: {
    readonly findings: readonly Finding[]
    readonly 审读指纹: string
    readonly 审稿哈希: string
    readonly 模块状态: Readonly<Record<string, ModuleRunState>>
  },
  plan: ReviewPlan | undefined,
): ReviewRecord {
  registerFilmDramaChecks()
  const scopeModules = listChecks(scope).filter((c) => c.执行形态 !== '作者')
  const names = scopeModules.map((c) => c.名称)
  const deterministicNames = new Set(scopeModules.filter((c) => c.run !== undefined).map((c) => c.名称))
  const skips = new Map<string, string>()
  for (const item of plan?.跳过 ?? []) {
    if (item.理由.trim() !== '') skips.set(item.模块, item.理由)
  }
  const stale = existing.审读指纹 !== computed.审读指纹
  const 旧处置 = dispositionMap(existing)
  const 问题: Finding[] = [
    ...(stale ? [] : existing.问题.filter((f) => !deterministicNames.has(f.模块名))),
    ...computed.findings.map((f) => inheritDisposition(f, 旧处置)),
  ]
  const 模块: Record<string, ModuleRunState> = { ...existing.模块 }
  for (const name of names) {
    const skipReason = skips.get(name)
    if (skipReason !== undefined) {
      模块[name] = { 完成: true, 失败: false, 跳过: true, 理由: skipReason }
      continue
    }
    const mod = getCheck(name)
    if (mod === undefined) {
      模块[name] = { 完成: false, 失败: true, 理由: '未注册' }
      continue
    }
    if (mod.run !== undefined) {
      // 确定性模块：本轮已重算，模块态取自 compute 结果（跑抛错时为失败态）。
      模块[name] = computed.模块状态[name] ?? { 完成: false, 失败: true, 理由: '未计算' }
    } else {
      // 隔离子 Agent 形态：发现项须经 ingestFilmDramaFindings 回写后才算完成。
      const previous = stale ? undefined : 模块[name]
      模块[name] = previous?.完成 === true && previous?.待回写 !== true
        ? previous
        : { 完成: false, 失败: false, 待回写: true, 理由: '隔离子 Agent 编排' }
    }
  }
  const 完成 = names.every((name) => 模块[name]?.完成 === true)
  return {
    schemaVersion: MACHINE_SCHEMA_VERSION,
    完成,
    问题,
    模块,
    方案: plan,
    审稿哈希: computed.审稿哈希,
    审读指纹: computed.审读指纹,
    待继承处置: remainingDispositions(existing, stale, new Set([...deterministicNames, ...skips.keys()]), scope),
  }
}

/** 剧本审读（纯计算 + 组装记录，不写盘）。 */
export function computeScreenplayReview(bookRoot: string, input: ScreenplayReviewRunInput): FilmDramaReviewResult {
  registerFilmDramaChecks()
  const computed = computeScreenplayFindings(input)
  const existing = loadScreenplayReviewRecord(bookRoot) ?? emptyReviewRecord()
  const plan = input.方案 ?? existing.方案
  const record = buildFilmDramaRecord('剧本', existing, computed, plan)
  return { ok: true, record, 审读指纹: computed.审读指纹, 审稿哈希: computed.审稿哈希, 待回写模块: pendingFilmDramaModules(record, '剧本') }
}

/** 短剧单集审读（纯计算 + 组装记录，不写盘）。剧本文本由 renderEpisodeScript 从剧本对象统一渲染（与 ingest 回写时的重算同一口径，指纹才对得上），调用方不传文本。 */
export function computeEpisodeReview(bookRoot: string, key: EpisodeReviewKey, input: EpisodeReviewRunInput): FilmDramaReviewResult {
  registerFilmDramaChecks()
  if (key.集 !== input.剧本.集 || key.集 !== input.大纲.集) {
    return { ok: false, reason: '集号不一致：审核记录、单集剧本和分集大纲必须属于同一集', record: null }
  }
  const 剧本文本 = renderEpisodeScript(input.剧本).内容
  const computed = computeEpisodeFindings({ 集: key.集, 剧本: input.剧本, 剧本文本, 大纲: input.大纲, 材料版本: input.材料版本 })
  const existing = loadEpisodeReviewRecord(bookRoot, key.集) ?? emptyReviewRecord()
  const plan = input.方案 ?? existing.方案
  const record = buildFilmDramaRecord('集', existing, computed, plan)
  return { ok: true, record, 审读指纹: computed.审读指纹, 审稿哈希: computed.审稿哈希, 待回写模块: pendingFilmDramaModules(record, '集') }
}

function runScreenplayReviewRecordLocked(bookRoot: string, input: ScreenplayReviewRunInput): FilmDramaReviewResult {
  const result = computeScreenplayReview(bookRoot, input)
  if (result.ok && result.record !== null) writeScreenplayReviewRecord(bookRoot, result.record)
  return result
}

/** 剧本审读 + 落盘（bookWriter 锁，与 runReview 同一写入语义）。 */
export const runScreenplayReviewRecord = bookWriter(runScreenplayReviewRecordLocked)

function runEpisodeReviewRecordLocked(bookRoot: string, key: EpisodeReviewKey, input: EpisodeReviewRunInput): FilmDramaReviewResult {
  const result = computeEpisodeReview(bookRoot, key, input)
  if (result.ok && result.record !== null) writeEpisodeReviewRecord(bookRoot, key.集, result.record)
  return result
}

/** 短剧单集审读 + 落盘（bookWriter 锁，与 runReview 同一写入语义）。 */
export const runEpisodeReviewRecord = bookWriter(runEpisodeReviewRecordLocked)

export interface FilmDramaIngestArgs {
  readonly bookRoot: string
  readonly scope: '剧本' | '集'
  /** scope '集' 时必填（集号）；scope '剧本' 时不用传。 */
  readonly 集?: number
  readonly 模块名: string
  readonly 发现项: readonly unknown[]
  /** 自动模块每次必填：使用派发该模块时的审核输入指纹。 */
  readonly 审读指纹?: string
  /** 当前审读输入（重算指纹、验过期用；scope '剧本' 用前两项，'集' 用后两项）。 */
  readonly 剧本草稿文本?: string
  readonly 分场大纲文本?: string
  readonly 剧本文本?: string
  readonly 大纲文本?: string
  readonly 片长?: FilmLength
}

export interface FilmDramaIngestResult {
  readonly ok: boolean
  readonly reason?: string
  readonly record: ReviewRecord | null
  readonly 待回写模块?: readonly string[]
}

/**
 * 剧本 / 短剧集发现项回写（与 ingestFindings 同构，只是范围与寻址不同）。
 * 语义模块的发现项由此落盘；确定性模块的发现项由 compute + run*ReviewRecord
 * 落盘，一般不走这里（走了也按本模块整批替换，与章节一致）。
 * 指纹校验：用调用方提供的当前输入文本重算指纹，与回写指纹比对——
 * 指纹不一致拒绝回写（过期结果不能进记录），与章节的 fail-closed 一致。
 */
export function ingestFilmDramaFindings(args: FilmDramaIngestArgs): FilmDramaIngestResult {
  return withBookWrite(args.bookRoot, () => ingestFilmDramaFindingsLocked(args))
}

function ingestFilmDramaFindingsLocked(args: FilmDramaIngestArgs): FilmDramaIngestResult {
  registerFilmDramaChecks()
  const { bookRoot, scope, 模块名 } = args
  const check = getCheck(模块名)
  if (check === undefined) {
    return { ok: false, reason: `未注册的审读模块:${模块名}`, record: null }
  }
  if (check.适用范围 !== scope) {
    return { ok: false, reason: `审读模块 ${模块名} 适用范围是 ${check.适用范围}，不能回写进 ${scope} 的审核记录`, record: null }
  }
  const authorOpinion = check.执行形态 === '作者'
  const expectedFingerprint = args.审读指纹
  if (!authorOpinion && (typeof expectedFingerprint !== 'string' || expectedFingerprint.trim() === '')) {
    return { ok: false, reason: '自动审读结果必须携带审读指纹：每个模块回写均需提供实际审读输入的指纹，请重新运行审核', record: null }
  }
  // 重算当前输入的指纹（须与 compute 端的指纹函数完全一致，见 film-drama.ts）。
  let recomputed: string
  let currentHash: string
  let 审核编号: string
  let existing: ReviewRecord | null
  if (scope === '剧本') {
    if (args.剧本草稿文本 === undefined) {
      return { ok: false, reason: '回写剧本审读结果须提供当前剧本草稿文本（重算指纹用）', record: null }
    }
    recomputed = screenplayFingerprint(args.剧本草稿文本, args.分场大纲文本, args.片长)
    currentHash = draftHashOf(args.剧本草稿文本)
    审核编号 = screenplayReviewId()
    existing = loadScreenplayReviewRecord(bookRoot)
  } else {
    if (args.集 === undefined) {
      return { ok: false, reason: '回写短剧集审读结果须提供集号', record: null }
    }
    if (args.剧本文本 === undefined || args.大纲文本 === undefined) {
      return { ok: false, reason: '回写短剧集审读结果须提供当前单集剧本文本与大纲文本（重算指纹用）', record: null }
    }
    recomputed = episodeFingerprint(args.剧本文本, args.大纲文本)
    currentHash = draftHashOf(args.剧本文本)
    审核编号 = episodeReviewId(args.集)
    existing = loadEpisodeReviewRecord(bookRoot, args.集)
  }
  if (!authorOpinion && expectedFingerprint !== recomputed) {
    return { ok: false, reason: '审读结果已过期：回写指纹与当前审核输入不一致，请重新运行审核', record: null }
  }
  if (scope === '集') {
    const script = parseEpisodeScript(args.剧本文本!)
    const outlineEpisode = /^集(\d+)\s/.exec(args.大纲文本!)?.[1]
    if (!script.ok || script.episode === undefined) return { ok: false, reason: '单集剧本文本解析失败，不能回写审读结果', record: null }
    if (script.episode.集 !== args.集 || outlineEpisode === undefined || Number(outlineEpisode) !== args.集) {
      return { ok: false, reason: '集号不一致：审核记录、单集剧本和分集大纲必须属于同一集', record: null }
    }
  }
  const record0 = existing ?? emptyReviewRecord()
  const hasPriorReviewState = record0.完成 || record0.问题.length > 0 || Object.keys(record0.模块).length > 0
  const stale = (record0.审读指纹 !== undefined && record0.审读指纹 !== recomputed)
    || (record0.审读指纹 === undefined && hasPriorReviewState)
  const resetting = stale && !authorOpinion
  const 旧处置 = dispositionMap(record0)
  const findings: Finding[] = []
  let n = 1
  for (const raw of args.发现项) {
    if (raw !== null && typeof raw === 'object') {
      const value = raw as Record<string, unknown>
      if (value['处置状态'] === '已转提案' || value['处置'] === '已转提案' || value['转交提案'] !== undefined) {
        return { ok: false, reason: '发现项回写不接受转交处置。请用 novel_apply_revision 或 novel_apply_revision_batch 校验已通过的关联提案', record: null }
      }
    }
    const f = normalizeFinding(raw)
    if (f === null) continue
    const withModule: Finding = { ...f, 模块名, 审核编号 }
    const numbered: Finding = { ...withModule, 发现项编号: findingId(withModule.审核编号, 模块名, n++) }
    findings.push(inheritDisposition(numbered, 旧处置))
  }
  const base问题 = resetting ? [] : record0.问题
  const base模块 = resetting ? {} : record0.模块
  const 问题: Finding[] = [...base问题.filter((p) => p.模块名 !== 模块名), ...findings]
  const 模块: Record<string, ModuleRunState> = {
    ...base模块,
    [模块名]: { 完成: true, 失败: false, 待回写: false },
  }
  const 待回写模块 = pendingFilmDramaModules({ ...record0, 模块 }, scope)
  const 完成 = 待回写模块.length === 0
  const record: ReviewRecord = {
    ...record0,
    完成,
    问题,
    模块,
    ...(authorOpinion ? {} : { 审稿哈希: currentHash, 审读指纹: recomputed }),
    待继承处置: remainingDispositions(record0, resetting, new Set([模块名]), scope),
  }
  if (scope === '剧本') {
    writeScreenplayReviewRecord(bookRoot, record)
  } else {
    writeEpisodeReviewRecord(bookRoot, args.集 as number, record)
  }
  return { ok: true, record, 待回写模块 }
}
