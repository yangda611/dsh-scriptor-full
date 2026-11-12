/**
 * 待建书草稿的文件读写（仅服务端使用；客户端不要 import 本模块）。
 *
 * 书房面板向导把作者点选的答案存在 `<工作范围>/书房/构想/_待建书.json`，
 * novel_create_book 找不到参数时读它作后备；建书成功后消费（删除），
 * 下一本书重新选——不让旧选择悄悄沿用到新书上。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { ONBOARDING_DRAFT_RELATIVE, validateOnboardingAnswers, type OnboardingAnswers } from './onboarding'

export function onboardingDraftPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, ...ONBOARDING_DRAFT_RELATIVE.split('/'))
}

/** 读待建书草稿：文件不存在、损坏或值非法都当作没有（返回空对象），绝不抛错。 */
export function readOnboardingDraft(workspaceRoot: string): OnboardingAnswers {
  try {
    const raw = fs.readFileSync(onboardingDraftPath(workspaceRoot), 'utf-8')
    return validateOnboardingAnswers(JSON.parse(raw) as unknown)
  } catch {
    return {}
  }
}

/** 保存待建书草稿（书房面板向导调用）。 */
export function saveOnboardingDraft(workspaceRoot: string, answers: OnboardingAnswers): void {
  const target = onboardingDraftPath(workspaceRoot)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify({ ...answers, updatedAt: new Date().toISOString() }, null, 2), 'utf-8')
}

/** 消费待建书草稿（建书成功后调用）：删文件，下一本书重新选。 */
export function consumeOnboardingDraft(workspaceRoot: string): void {
  try { fs.unlinkSync(onboardingDraftPath(workspaceRoot)) } catch { /* 本来就没有，不用管 */ }
}
