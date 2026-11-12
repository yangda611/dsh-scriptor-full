/** A capability owned by one live, isolated preset revision. */
export interface WritingCapability {
  readonly mode: 'writing'
  /** Invalid as soon as teardown begins, before Cordis removes the service slot. */
  readonly disposed?: boolean
}

interface AgentContext {
  readonly ctx?: unknown
}

/** Use the live preset binding; titles, cwd, and historical origin are not mode evidence.
 *
 * 8.4.5：这个能力不再是小说工具/技能的门（主 Agent 一律注册，见 index.ts）；
 * 它现在只决定写作预设的附加挂载：主控 persona 与书架总览。写作委派自 8.4.6
 * 起也不再设门（默认标准预设会话也需要 novel_delegate 写章，见 index.ts）。 */
export function writingCapabilityOf(agent: AgentContext | undefined): WritingCapability | undefined {
  try {
    const ctx = agent?.ctx as { get?(name: string): unknown } | undefined
    const registry = ctx?.get?.('agentPresets') as { serviceFor?(agent: AgentContext, name: string): unknown } | undefined
    if (!agent || typeof registry?.serviceFor !== 'function') return undefined
    const capability = registry.serviceFor(agent, 'webnovelWriting')
    return capability !== null && typeof capability === 'object' && 'mode' in capability && capability.mode === 'writing'
      && !('disposed' in capability && capability.disposed === true)
      ? capability as WritingCapability : undefined
  } catch { return undefined }
}

export function isWritingAgent(agent: AgentContext | undefined): boolean {
  return writingCapabilityOf(agent) !== undefined
}
