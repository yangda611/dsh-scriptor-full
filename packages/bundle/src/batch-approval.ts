import { randomUUID } from 'node:crypto'
import { askAuthor, canonicalizePath, type AskFn } from '@webnovel/core'
import { classifyReason, type ToolFailureCode } from './tool-failure'
import type { ToolExecContext } from './novel-tools'

export type BatchScopeTarget = 'chapter' | 'episode' | 'screenplay' | 'all'

export interface BatchGrant {
  readonly batchId: string
  readonly bookRoot: string
  readonly sessionKey: string
  readonly 范围: string
  readonly targetType: BatchScopeTarget
  readonly 起号?: number
  readonly 止号?: number
  readonly authorizedAt: string
  readonly kind: string
  readonly 决定: string
  readonly expiresAt: number
}

export interface BatchMatch {
  readonly batchId: string
  readonly 范围: string
  readonly 裁决记录: string
}

const DEFAULT_BATCH_TTL_MS = 4 * 60 * 60 * 1000

function sessionKeyOf(exec: ToolExecContext | undefined): string {
  return exec?.agent?.session?.header?.id ?? exec?.agent?.id ?? 'default-session'
}

function storeKey(bookRoot: string, sessionKey: string): string {
  return `${canonicalizePath(bookRoot)}::${sessionKey}`
}

/**
 * 会话内批量定稿授权存储（半自动两步走核心）：
 * 授权仅能经真实宿主 `askAuthor` 弹窗批准产生，绝不接受模型文本自证；
 * 批准后同一会话内对应书仓和范围的定稿入档可连续自动推进，不再逐章/逐集弹窗。
 */
export class BatchApprovalStore {
  private readonly grants = new Map<string, BatchGrant>()

  async authorize(params: {
    readonly askFn: AskFn | undefined
    readonly bookRoot: string
    readonly 范围: string
    readonly 摘要: string
    readonly targetType?: BatchScopeTarget
    readonly 起号?: number
    readonly 止号?: number
    readonly exec?: ToolExecContext
  }): Promise<
    | { readonly ok: true; readonly grant: BatchGrant }
    | { readonly ok: false; readonly reason: string; readonly code: ToolFailureCode }
  > {
    if (!params.askFn) {
      return { ok: false, code: 'host-unavailable', reason: '裁决通道不可用：当前环境无法弹出作者裁决窗口，未授予批量托管。' }
    }
    const decision = await askAuthor(
      params.askFn,
      '定稿入档',
      {
        范围: `批量托管（${params.范围}）`,
        摘要: params.摘要,
      },
      { agent: params.exec?.agent, signal: params.exec?.signal },
    )
    if (params.exec?.signal?.aborted) {
      return { ok: false, code: 'author-cancelled', reason: '作者裁决已取消（会话已中止），未授予批量托管。' }
    }
    if (!decision.ok) {
      return { ok: false, code: classifyReason(decision.reason), reason: decision.reason }
    }
    if (decision.决定 !== '已批准') {
      return { ok: false, code: 'author-declined', reason: `未获作者批准：作者${decision.决定}，未授予批量托管。` }
    }
    const sessionKey = sessionKeyOf(params.exec)
    const normalizedRoot = canonicalizePath(params.bookRoot)
    const now = Date.now()
    const grant: BatchGrant = {
      batchId: randomUUID().slice(0, 8),
      bookRoot: normalizedRoot,
      sessionKey,
      范围: params.范围,
      targetType: params.targetType ?? 'all',
      ...(params.起号 === undefined ? {} : { 起号: params.起号 }),
      ...(params.止号 === undefined ? {} : { 止号: params.止号 }),
      authorizedAt: new Date(now).toISOString(),
      kind: decision.kind,
      决定: decision.决定,
      expiresAt: now + DEFAULT_BATCH_TTL_MS,
    }
    this.grants.set(storeKey(normalizedRoot, sessionKey), grant)
    return { ok: true, grant }
  }

  match(
    bookRoot: string,
    exec: ToolExecContext | undefined,
    targetType: Exclude<BatchScopeTarget, 'all'>,
    itemNumber?: number,
  ): BatchMatch | undefined {
    const key = storeKey(bookRoot, sessionKeyOf(exec))
    const grant = this.grants.get(key)
    if (grant === undefined) return undefined
    if (Date.now() > grant.expiresAt) {
      this.grants.delete(key)
      return undefined
    }
    if (grant.targetType !== 'all' && grant.targetType !== targetType) return undefined
    if (itemNumber !== undefined) {
      if (grant.起号 !== undefined && itemNumber < grant.起号) return undefined
      if (grant.止号 !== undefined && itemNumber > grant.止号) return undefined
    }
    return {
      batchId: grant.batchId,
      范围: grant.范围,
      裁决记录: `作者于 ${grant.authorizedAt} 批量批准定稿托管（batch=${grant.batchId}, 范围=${grant.范围}, kind=${grant.kind}, 决定=${grant.决定}）`,
    }
  }

  clear(bookRoot: string, exec?: ToolExecContext): void {
    this.grants.delete(storeKey(bookRoot, sessionKeyOf(exec)))
  }

  hasAnyForSession(exec?: ToolExecContext): boolean {
    const key = sessionKeyOf(exec)
    const now = Date.now()
    for (const grant of this.grants.values()) {
      if (grant.sessionKey === key && now <= grant.expiresAt) return true
    }
    return false
  }
}
