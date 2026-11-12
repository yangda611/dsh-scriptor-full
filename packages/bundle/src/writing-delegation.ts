import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionSeq } from '@deepseek-ai/dsh-session'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { AgentLike } from './novel-tools'

import { WRITING_DELEGATE_TOOL } from './tool-catalog'
export { WRITING_DELEGATE_TOOL } from './tool-catalog'
export const WRITING_ROLES = ['drafting', 'polish', 'revision', 'review', 'settle', 'screenplay', 'shortdrama'] as const
export type WritingRole = typeof WRITING_ROLES[number]
export interface WritingAssignment { role: WritingRole; bookId?: string; chapter?: number }
const creationRole = new AsyncLocalStorage<WritingAssignment & { parent: AgentLike }>()
const isRole = (value: unknown): value is WritingRole => WRITING_ROLES.some(role => role === value)
const marker = (role: WritingRole) => `<!-- scriptor-worker:v1:${role} -->\n`

/** Explicit role only: never infer a worker's job from its title or prose. */
export function writingRoleOf(agent: AgentLike): WritingRole | undefined {
  return writingAssignmentOf(agent)?.role
}

export function writingAssignmentOf(agent: AgentLike): WritingAssignment | undefined {
  const active = creationRole.getStore()
  if (active && typeof agent.session?.header?.parentSession === 'string'
    && agent.session.header.parentSession === active.parent.session?.header?.id) return { role: active.role, bookId: active.bookId, chapter: active.chapter }
  const session = agent.session as Session | undefined
  if (typeof session?.eventAt !== 'function' || typeof session.seq !== 'number') return undefined
  // Skip forked parent history. The initial task message is the durable role;
  // later messages and quoted materials cannot retag this worker.
  for (let seq: number = session.inheritedEventCount ?? 0; seq < session.seq; seq++) {
    const event = session.eventAt(seq as SessionSeq)
    if (event?.type !== 'user/message' || event.data.source.kind !== 'user') continue
    const first = event.data.content[0]
    if (first?.type !== 'text') return undefined
    const role = WRITING_ROLES.find(role => first.text.startsWith(marker(role)))
    if (!role) return undefined
    const assignment = /^<!-- scriptor-assignment:v1:(.+) -->\n/.exec(first.text.slice(marker(role).length))
    if (!assignment) return { role }
    try {
      const value = JSON.parse(assignment[1]!) as { bookId?: unknown; chapter?: unknown }
      return { role, ...(typeof value.bookId === 'string' && value.bookId.trim() ? { bookId: value.bookId } : {}),
        ...(typeof value.chapter === 'number' && Number.isSafeInteger(value.chapter) && value.chapter > 0 ? { chapter: value.chapter } : {}) }
    } catch { return { role } }
  }
  return undefined
}

/** Add one typed role field while reusing the native tool's routing and lifecycle. */

// 写作委派 fiber 按主 Agent 去重（8.4.6）：installFor 会在能力/预设/角色变化
// 时反复重装同一主 Agent，旧 fiber 的异步 dispose 会在新 fiber 注册之后才
// 落地，其 effect 清理 off() 按名注销，会把新注册的 novel_delegate 一并
// 抹掉（真实回归：插件禁/启用后 46 个业务工具都在，唯独 novel_delegate
// 缺失）。因此委派 fiber 每个主 Agent 只挂一份、重装时不拆：attach 幂等，
// 卸载只发生在插件禁用（disposeAllDelegations）或 Agent ctx 销毁时。
const attachedDelegations = new WeakMap<AgentLike, () => Promise<void>>()
const liveDelegationDisposes = new Set<() => Promise<void>>()

export async function disposeAllDelegations(): Promise<void> {
  const disposals = [...liveDelegationDisposes]
  liveDelegationDisposes.clear()
  await Promise.all(disposals.map(async (dispose) => { try { await dispose() } catch { /* 幂等清理 */ } }))
}

export function attachWritingDelegationToAgent(agent: AgentLike): (() => Promise<void>) | undefined {
  const existing = attachedDelegations.get(agent)
  if (existing !== undefined) return existing
  const context = agent.ctx as Context | undefined
  if (typeof context?.inject !== 'function') return undefined
  let fiber: { dispose?: () => unknown } | undefined
  try {
    fiber = context.inject(['tools'], scope => {
      // 最小宿主（如 headless 冒烟测试的 mock ctx）没有 effect/tools：
      // 委派挂不上也不应炸掉整条装机链；真实宿主一定有这两个 API。
      const host = scope as unknown as { effect?: unknown; tools?: unknown }
      if (typeof host.effect !== 'function' || typeof host.tools !== 'object' || host.tools === null) return
      scope.effect(function* () {
      let native: ToolDefinition | undefined
      let off: (() => void) | undefined
      let updating = false
      const refresh = () => {
        if (updating) return
        const current = scope.tools.get('subagent', agent as Parameters<typeof scope.tools.get>[1])
        // 自愈：current 与 native 一致时旧逻辑直接返回，但注册本身可能
        // 已被先前 fiber 的滞后清理抹掉——以实际注册为准，缺失即重挂。
        const registered = scope.tools.get(WRITING_DELEGATE_TOOL, agent as Parameters<typeof scope.tools.get>[1])
        if (current === native && registered) return
        updating = true
        try {
          off?.(); off = undefined
          native = current
          if (!current) return
          const parameters = current.parameters as { properties?: Record<string, unknown>; required?: string[] }
          off = scope.tools.register({
            ...current,
            name: WRITING_DELEGATE_TOOL,
            description: '委派小说生产任务，按 role 绑定该实例的规约和权限。drafting 为起草，polish 为润色，revision 为改稿。review 为审读，settle 为沉淀对账。screenplay 为电影剧本改编，shortdrama 为短剧管线。明确目标书和章节时填写 bookId、chapter，供进度归属；未明确时不要猜填。普通研究和工具任务使用 subagent。\n' + current.description,
            parameters: {
              ...current.parameters,
              properties: { ...parameters.properties, role: { type: 'string', enum: [...WRITING_ROLES] },
                bookId: { type: 'string', description: '已明确的目标书id；仅用于任务归属' },
                chapter: { type: 'integer', minimum: 1, description: '已明确的全书章号；仅用于任务归属' } },
              required: [...parameters.required ?? [], 'role'],
            },
            execute(args, exec) {
              const { role, bookId, chapter, ...task } = args as Record<string, unknown>
              if (!isRole(role) || typeof task['prompt'] !== 'string' || exec.agent !== agent) {
                throw new Error('写作委派须指定有效 role、任务 prompt 和当前主控。')
              }
              if (bookId !== undefined && (typeof bookId !== 'string' || !bookId.trim() || bookId.length > 256 || /[\r\n<>]/.test(bookId))
                || chapter !== undefined && (typeof chapter !== 'number' || !Number.isSafeInteger(chapter) || chapter < 1)) throw new Error('委派的书id或章号无效')
              const assignment = { ...(typeof bookId === 'string' ? { bookId: bookId.trim() } : {}), ...(typeof chapter === 'number' ? { chapter } : {}) }
              const attribution = Object.keys(assignment).length ? `<!-- scriptor-assignment:v1:${JSON.stringify(assignment)} -->\n` : ''
              return creationRole.run({ parent: agent, role, ...assignment }, () => current.execute({
                ...task, prompt: marker(role) + attribution + task['prompt'],
              }, exec))
            },
          })
        } finally { updating = false }
      }
      yield () => { off?.() }
      yield scope.on('tools/change', refresh)
      refresh()
    })
    }) as unknown as { dispose?: () => unknown } | undefined
  } catch {
    return undefined
  }
  if (fiber === undefined || typeof fiber.dispose !== 'function') return undefined
  let disposed = false
  const dispose = async (): Promise<void> => {
    if (disposed) return
    disposed = true
    attachedDelegations.delete(agent)
    liveDelegationDisposes.delete(dispose)
    await fiber.dispose()
  }
  attachedDelegations.set(agent, dispose)
  liveDelegationDisposes.add(dispose)
  return dispose
}
