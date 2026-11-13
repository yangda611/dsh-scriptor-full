import { describe, expect, it } from 'vitest'
import { agentList, agentRoots } from '../src/study/web'

describe('agent registry compatibility readers', () => {
  it('preserves the receiver of registry methods', () => {
    const main = { id: 'main' }, child = { id: 'child' }
    const registry = {
      entries: [main, child],
      roots() { return this.entries.filter(agent => agent === main) },
      list() { return this.entries },
    }
    expect(agentRoots(registry)).toEqual([main])
    expect(agentList(registry)).toEqual([main, child])
  })
})
