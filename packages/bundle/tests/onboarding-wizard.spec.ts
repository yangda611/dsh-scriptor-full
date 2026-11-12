import React from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingWizard } from '../src/client/onboarding'

const renderers: ReactTestRenderer[] = []
let saved: Record<string, unknown>[]
let draftAnswers: Record<string, unknown>

beforeEach(() => {
  saved = []
  draftAnswers = {}
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const method = url.split('/').at(-1)!
    const body = JSON.parse(init.body as string) as { action?: string; answers?: object }
    if (method !== 'onboarding') throw new Error('unexpected method ' + method)
    if (body.action === 'read') return new Response(JSON.stringify({ ok: true, value: { answers: draftAnswers } }), { status: 200 })
    if (body.action === 'save') {
      saved.push(body.answers!)
      return new Response(JSON.stringify({ ok: true, value: { answers: body.answers } }), { status: 200 })
    }
    throw new Error('unexpected action ' + body.action)
  }))
})
afterEach(async () => {
  await act(async () => { for (const renderer of renderers.splice(0)) renderer.unmount() })
  vi.unstubAllGlobals()
})

const wait = (ms = 0) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })

const flatten = (node: ReactTestInstance | string): string =>
  typeof node === 'string' ? node : node.children.map(flatten).join('')

function buttonByText(root: ReactTestInstance, text: string): ReactTestInstance {
  const found = root.findAllByType('button').filter(b => flatten(b).includes(text))
  expect(found.length, `button containing ${text}`).toBeGreaterThan(0)
  return found[0]!
}

async function mount() {
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(React.createElement(OnboardingWizard, { sessionId: 's', onSaved: () => {} })) })
  renderers.push(renderer)
  await wait()
  await wait()
  return renderer
}

describe('建书向导（8.4.4）：可点击选择', () => {
  it('点三张卡再保存，提交的答案就是点的三项', async () => {
    const renderer = await mount()
    const root = renderer.root
    // 没选完时保存按钮禁用。
    expect(buttonByText(root, '保存，去对话里继续').props.disabled).toBe(true)
    await act(async () => { buttonByText(root, '中文').props.onClick() })
    await act(async () => { buttonByText(root, '小说').props.onClick() })
    await act(async () => { buttonByText(root, '100 万字').props.onClick() })
    expect(buttonByText(root, '保存，去对话里继续').props.disabled).toBe(false)
    await act(async () => { buttonByText(root, '保存，去对话里继续').props.onClick() })
    await wait()
    expect(saved).toEqual([{ 市场: '中文', 输出形态: '小说', 目标总字数: 1000000 }])
    expect(flatten(root)).toContain('已保存')
  })

  it('“就按默认来”直接保存默认值（中文 / 小说 / 100万字）', async () => {
    const renderer = await mount()
    await act(async () => { buttonByText(renderer.root, '就按默认来').props.onClick() })
    await wait()
    expect(saved).toEqual([{ 市场: '中文', 输出形态: '小说', 目标总字数: 1000000 }])
  })

  it('手动输入万字数：填 8 万字 → 保存 80000', async () => {
    const renderer = await mount()
    const root = renderer.root
    await act(async () => { buttonByText(root, '中文').props.onClick() })
    await act(async () => { buttonByText(root, '短剧').props.onClick() })
    const input = root.findByProps({ type: 'number' })
    await act(async () => { input.props.onChange({ target: { value: '8' } }) })
    // 选了自定义字数后保存可用。
    expect(buttonByText(root, '保存，去对话里继续').props.disabled).toBe(false)
    await act(async () => { buttonByText(root, '保存，去对话里继续').props.onClick() })
    await wait()
    expect(saved).toEqual([{ 市场: '中文', 输出形态: '短剧', 目标总字数: 80000 }])
  })

  it('已有草稿时预填选中态（海外 / 短剧 / 中篇）', async () => {
    draftAnswers = { 市场: '海外', 输出形态: '短剧', 目标总字数: 300000 }
    const renderer = await mount()
    const root = renderer.root
    const selected = root.findAllByProps({ className: 'nw-onboarding-card is-selected' })
    expect(selected.map(card => flatten(card))).toEqual([
      expect.stringContaining('海外'),
      expect.stringContaining('短剧'),
      expect.stringContaining('中篇'),
    ])
    // 预填后直接保存可用，且不改动原答案。
    expect(buttonByText(root, '保存，去对话里继续').props.disabled).toBe(false)
  })
})
