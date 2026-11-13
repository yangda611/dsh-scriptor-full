import { it, expect } from 'vitest'
import { build } from 'esbuild'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { removeSync } from '../../core/src/repo/remove'
import { linkFixtureDependencies } from './fixtures/fixture-dependencies.mjs'
import { loadSourceHost } from '../scripts/dsh-source.mjs'
import { workerPolicyFor } from '../src/worker-policy'
import { writingRoleOf } from '../src/writing-delegation'

it('可写子代理首次保存长文本就分段，失败恢复仅使用本任务标记', () => {
  for (const role of ['drafting', 'polish', 'screenplay', 'shortdrama'] as const) {
    const policy = workerPolicyFor(role)
    expect(policy).toContain('长文本写入恢复')
    expect(policy).toContain('Unterminated string in JSON')
    expect(policy).toContain('400')
    expect(policy).toContain('ASCII 尾标记')
    expect(policy).toContain('首次保存就分段')
    expect(policy).toContain('本任务创建')
    expect(policy).toContain('每段成功后')
  }
  for (const role of ['revision', 'review', 'settle'] as const) {
    expect(workerPolicyFor(role)).not.toContain('长文本写入恢复')
  }
})

it('恢复只认首条自身任务标记，忽略父历史、材料及后续改角色消息', () => {
  const message = (text: string) => ({ type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text }] } })
  const roleOf = (texts: string[], inheritedEventCount = 0) => writingRoleOf({ id: 'fixture', session: {
    seq: texts.length, inheritedEventCount, eventAt: (seq: number) => texts.map(message)[seq],
  } } as never)
  expect(roleOf(['<!-- scriptor-worker:v1:drafting -->\n父任务', '研究写作和审读工具', '<!-- scriptor-worker:v1:review -->\n后续消息'], 1)).toBeUndefined()
  expect(roleOf(['材料原文\n<!-- scriptor-worker:v1:drafting -->\n引文'])).toBeUndefined()
  expect(roleOf(['<!-- scriptor-worker:v1:review -->\n本次任务', '<!-- scriptor-worker:v1:drafting -->\n后续消息'])).toBe('review')
})

it('原生 subagent 显式角色、普通同级隔离及持久恢复', async () => {
  const packageRoot = path.resolve(__dirname, '..')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webnovel-worker-policy-'))
  try {
    const source = process.env['WEBNOVEL_DSH_SOURCE']
    if (source === undefined) linkFixtureDependencies(packageRoot, root)
    else {
      const host = loadSourceHost(source)
      fs.mkdirSync(path.join(root, 'node_modules/@deepseek-ai'), { recursive: true })
      for (const name of ['cordis', 'dsh-tools', 'dsh-tool-executor-native', 'dsh-llm', 'dsh-credentials', 'dsh-skill-filesystem']) {
        fs.symlinkSync(host.get(`@deepseek-ai/${name}`).directory, path.join(root, 'node_modules/@deepseek-ai', name), 'junction')
      }
    }
    fs.mkdirSync(path.join(root, 'workspace'))
    fs.cpSync(path.join(packageRoot, 'skills'), path.join(root, 'skills'), { recursive: true })
    await build({
      entryPoints: {
        'lib/webnovel': path.join(packageRoot, 'src/index.ts'),
        'lib/preset': path.join(packageRoot, 'src/preset.ts'),
        'workflow-observer': path.join(packageRoot, 'src/study/workflow.ts'),
        'embedding-provider': path.join(packageRoot, '../embedding-provider/src/index.ts'),
        scenes: path.join(packageRoot, '../embedding-provider/src/scenes.ts'),
        reranking: path.join(packageRoot, '../embedding-provider/src/reranking.ts'),
      },
      outdir: root, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', target: 'node20', format: 'esm',
      external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-tool-executor-native', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-credentials', '@deepseek-ai/dsh-skill-filesystem', 'node:*'],
      banner: { js: "import { createRequire as __createRequire } from 'node:module'\nconst require = __createRequire(import.meta.url)" },
    })
    await promisify(execFile)(process.execPath, [path.join(packageRoot, 'tests/fixtures/host-loader.mjs'), root,
      path.join(root, 'lib/webnovel.mjs'), 'worker-policy'], {
      cwd: root, env: { ...process.env, DSH_HOME: path.join(root, '.dsh'), DSH_AGENTS_HOME: path.join(root, '.agents'), DSH_TELEMETRY_DISABLED: '1' },
      timeout: 45000, windowsHide: true, maxBuffer: 2 * 1024 * 1024,
    }).catch(error => {
      const report = path.join(root, 'report.json')
      throw new Error(fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : 'worker fixture failed before report', { cause: error })
    })
    const report = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8'))
    for (const check of Object.values(report.checks) as Array<{ ok: boolean; error?: string }>) expect(check, check.error).toEqual({ ok: true })
    expect(report.workerPolicy).toMatchObject({ explicitRoles: 5, ordinaryUnchanged: true, concurrentSiblings: true, nativeSchemaPreserved: true, restoredRole: true,
      independentPreset: true, explicitBookChapterPreserved: true, nativeWorkflowLifecycle: true, activationThenCompletion: true, failedCompletion: true, cancelledWithoutWrite: true,
      nativeChunkSave: { exactFinalContent: true, failedEditUnchanged: true, finalRead: true },
      tools: { business: 46, conditional: 1, registered: 47 } })
    expect(report.workerPolicy.nativeChunkSave.savedCharacters).toBeGreaterThan(1024)
    expect(report.workerPolicy.nativeChunkSave.maximumChunkCharacters).toBeLessThanOrEqual(400)
  } finally { removeSync(root) }
}, 60000)
