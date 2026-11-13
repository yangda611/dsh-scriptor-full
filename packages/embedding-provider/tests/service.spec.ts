import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { EmbeddingService } from '../src/index'

describe('embedding service lifetime', () => {
  it('keeps stale service references closed after teardown', async () => {
    const ctx = new Context()
    const service = new EmbeddingService(ctx, () => ({
      enabled: true, baseURL: 'https://example.com/v1', model: 'fixture', dimensions: 3,
    }))
    try {
      const first = service.current()!
      await service.close()
      await expect(first.embed([{ text: 'late request' }], 'query')).rejects.toMatchObject({ code: 'provider-changed' })
      expect(service.current()).toBeUndefined()
      service.refresh()
      expect(service.current()).toBeUndefined()
    } finally { await service.close(); await ctx.fiber.dispose() }
  })
})
