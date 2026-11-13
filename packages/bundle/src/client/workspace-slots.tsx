import React from 'react'
import type { ClientHost, NativeEntry, UseSectionScroller, WorkspaceProps } from './host'
import { WorkspaceStudyTabs, type StudyUI } from './browser'

const alias = (name: string) => `webnovel.${name}`

/**
 * Mirror of the host sidebar's SIDEBAR_SECTION_INJECT (dsh-client-ui-sidebar):
 * the section occupant receives the scroller hook from each render's
 * hookContext. The aliased `webnovel.workspaces` slot needs the same slot-level
 * inject — without it the re-mounted native browser gets
 * `useSectionScroller: undefined` and crashes, leaving the workspace session
 * list blank (8.4.6). The factory only forwards the hook; it never invokes one.
 */
const sectionScrollerInject = {
  hooks: {
    sectionScroller: (_standard: unknown, hookContext: { useSectionScroller: UseSectionScroller }): UseSectionScroller => hookContext.useSectionScroller,
  },
}

/** Mirror native declarations and entries together: menu hooks live on the
 * declaration, while action identity, ordering and behavior live on entries. */
function mountNativeEntry(host: ClientHost, name: string, entry: NativeEntry): () => void {
  const Native = entry.component
  const children = Object.fromEntries(Object.entries(entry.children ?? {}).map(([key, spec]) => [alias(key), spec]))
  const offEntry = host.slots.register({ name, ...entry.options, children,
    ...(entry.store ? { store: entry.store } : {}), ...(entry.locale ? { locale: entry.locale } : {}),
    ...(entry.inject ? { inject: entry.inject } : {}),
  }, (props: WorkspaceProps) => <Native {...props} renderSlot={(key, owner, options) => props.renderSlot(alias(key), owner, options)} />)
  const cleanups = Object.keys(entry.children ?? {}).map(key => {
    const mounted = new Map<NativeEntry, () => void>()
    const sync = () => {
      const entries = host.slots.entries(key)
      for (const [previous, dispose] of mounted) {
        if (!entries.includes(previous)) { dispose(); mounted.delete(previous) }
      }
      for (const current of entries) {
        if (!mounted.has(current)) mounted.set(current, mountNativeEntry(host, alias(key), current))
      }
    }
    const offSubscribe = host.slots.subscribe(key, sync)
    sync()
    return () => { offSubscribe(); for (const dispose of mounted.values()) dispose(); mounted.clear() }
  })
  return () => { for (const cleanup of cleanups.reverse()) cleanup(); offEntry() }
}

export function installWorkspaceStudyTabs({ host, store, openIndex }: StudyUI): void {
  host.slots.inject('sidebar.workspaces.directoryFlow', () => {
    const original = host.slots.entries('sidebar.workspaces')[0]
    if (!original) return
    const offRegion = host.slots.register({ name: 'sidebar.workspaces', priority: -40,
      children: { 'webnovel.workspaces': { kind: 'single', scope: 'root', inject: sectionScrollerInject } },
      inject: () => ({ host, store, openIndex }),
    }, WorkspaceStudyTabs)
    const offNative = mountNativeEntry(host, 'webnovel.workspaces', original)
    return () => { offNative(); offRegion() }
  })
}
