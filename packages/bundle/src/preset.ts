import type { Context } from '@deepseek-ai/cordis'
import type { WritingCapability } from './agent-mode'

declare module '@deepseek-ai/cordis' {
  interface Context {
    webnovelWriting: WritingCapability
    webnovelHost: { readonly active: true, refresh?: () => void | Promise<void> }
  }
  interface Events { 'webnovel/writing-capability-updated'(): void }
}

export const name = 'scriptor-writing-preset'
export const inject = ['skills', 'webnovelHost']

/** The declaration isolates the capability; bundled skills are mounted once by the main bundle (index.ts), not here. */
export function apply(ctx: Context): void {
  const capability = { mode: 'writing' as const, disposed: false }
  ctx.provide('webnovelWriting', capability)
  const host = ctx.webnovelHost
  const changed = async () => {
    try { ctx.root.emit('webnovel/writing-capability-updated') } catch { /* Host shutdown. */ }
    try { await host.refresh?.() } catch { /* Host shutdown. */ }
  }
  ctx.effect(() => {
    void changed()
    return async () => {
      capability.disposed = true
      await changed()
    }
  })
}
