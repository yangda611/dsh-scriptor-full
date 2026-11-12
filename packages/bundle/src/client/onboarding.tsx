/**
 * 建书向导（8.4.4）：书房面板里的可点击新建书流程。
 *
 * 三项全是点选卡片，不用打字：市场（中文/海外）、输出形态（小说/短剧/电影剧本）、
 * 目标总字数（短篇/中篇/长篇/超长篇档位 + 手动输入万字数）。三项选齐才能保存；
 * “就按默认来”一次填好三项默认值（中文 / 小说 / 100万字）。
 * 保存后答案存在待建书草稿里，模型调 novel_create_book 时自动取用，聊天里不用再问。
 */

import React, { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { callStudy } from './api'
import { useStudy } from './hooks'
import {
  DEFAULT_ONBOARDING_ANSWERS,
  WORD_COUNT_TIERS,
  type OnboardingAnswers,
} from '../study/onboarding'
import type { Market, OutputForm } from '@webnovel/core'

const MARKET_OPTIONS: readonly { value: Market; label: string; hint: string; recommended?: boolean }[] = [
  { value: '中文', label: '中文', hint: '给国内观众，用中文题材库', recommended: true },
  { value: '海外', label: '海外', hint: '给海外观众，用海外题材库' },
]

const FORM_OPTIONS: readonly { value: OutputForm; label: string; hint: string; recommended?: boolean }[] = [
  { value: '小说', label: '小说', hint: '长篇小说，走原来的写章流程', recommended: true },
  { value: '短剧', label: '短剧', hint: '一集一集的短剧，走分集大纲流程' },
  { value: '电影剧本', label: '电影剧本', hint: '一部电影的剧本，走故事稿流程' },
]

function OptionCard<T extends string>({ label, hint, recommended, selected, onSelect }: {
  label: string; hint: string; recommended?: boolean; selected: boolean; onSelect: () => void
}) {
  return <button type="button" className={`nw-onboarding-card${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={onSelect}>
    <strong>{label}{recommended ? <span className="nw-onboarding-recommended">★推荐</span> : null}</strong>
    <small>{hint}</small>
  </button>
}

export function OnboardingWizard({ sessionId, onSaved, onClose }: {
  sessionId: string
  onSaved?: (answers: OnboardingAnswers) => void
  onClose?: () => void
}) {
  const existing = useStudy<{ answers: OnboardingAnswers }>(sessionId, 'onboarding', { action: 'read' })
  const [market, setMarket] = useState<Market | undefined>(undefined)
  const [form, setForm] = useState<OutputForm | undefined>(undefined)
  const [words, setWords] = useState<number | undefined>(undefined)
  const [customWords, setCustomWords] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [saved, setSaved] = useState<OnboardingAnswers | undefined>(undefined)

  // 已有草稿时预填（只在用户还没点过时填一次）。
  useEffect(() => {
    if (touched || !existing.value) return
    const answers = existing.value.answers
    if (answers.市场 !== undefined) setMarket(answers.市场)
    if (answers.输出形态 !== undefined) setForm(answers.输出形态)
    if (answers.目标总字数 !== undefined) setWords(answers.目标总字数)
  }, [existing.value, touched])

  const pickCustomWords = (text: string) => {
    setTouched(true)
    setCustomWords(text)
    const wan = Number(text)
    setWords(text.trim() !== '' && Number.isFinite(wan) && wan > 0 ? Math.round(wan * 10000) : undefined)
  }

  const complete = market !== undefined && form !== undefined && words !== undefined
  const useDefaults = () => {
    setTouched(true)
    setMarket(DEFAULT_ONBOARDING_ANSWERS.市场)
    setForm(DEFAULT_ONBOARDING_ANSWERS.输出形态)
    setWords(DEFAULT_ONBOARDING_ANSWERS.目标总字数)
    setCustomWords('')
    // 点一下就直接保存，不用再点一次“保存”。
    void saveAnswers(DEFAULT_ONBOARDING_ANSWERS)
  }

  const saveAnswers = async (toSave: OnboardingAnswers) => {
    if (saving) return
    setSaving(true)
    setError(undefined)
    try {
      await callStudy(sessionId, 'onboarding', { action: 'save', answers: toSave })
      setSaved(toSave)
      onSaved?.(toSave)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!complete) return
    void saveAnswers({ 市场: market, 输出形态: form, 目标总字数: words })
  }

  if (saved) {
    return <section className="nw-onboarding" aria-label="新建书向导">
      <p className="nw-onboarding-saved" role="status">已保存：{saved.市场} / {saved.输出形态} / 目标 {Math.round((saved.目标总字数 ?? 0) / 10000)} 万字。去对话里聊构想，建书时会自动用你选的，不用再问。</p>
      {onClose ? <Button variant="outline" size="sm" onClick={onClose}>知道了</Button> : null}
    </section>
  }

  return <section className="nw-onboarding" aria-label="新建书向导">
    <div className="nw-onboarding-head"><strong>新建书 · 点三下就好</strong><span className="nw-onboarding-sub">选完保存，去对话里聊构想就能建书</span></div>
    <div className="nw-onboarding-step"><span className="nw-onboarding-step-no">1</span><div className="nw-onboarding-step-body">
      <p className="nw-onboarding-question">这个项目面向海外还是中文市场？</p>
      <div className="nw-onboarding-cards">{MARKET_OPTIONS.map(option =>
        <OptionCard key={option.value} label={option.label} hint={option.hint} recommended={option.recommended}
          selected={market === option.value} onSelect={() => { setTouched(true); setMarket(option.value) }} />)}
      </div>
    </div></div>
    <div className="nw-onboarding-step"><span className="nw-onboarding-step-no">2</span><div className="nw-onboarding-step-body">
      <p className="nw-onboarding-question">要出短剧、电影剧本还是小说？</p>
      <div className="nw-onboarding-cards">{FORM_OPTIONS.map(option =>
        <OptionCard key={option.value} label={option.label} hint={option.hint} recommended={option.recommended}
          selected={form === option.value} onSelect={() => { setTouched(true); setForm(option.value) }} />)}
      </div>
    </div></div>
    <div className="nw-onboarding-step"><span className="nw-onboarding-step-no">3</span><div className="nw-onboarding-step-body">
      <p className="nw-onboarding-question">这本书目标写多少字？</p>
      <div className="nw-onboarding-cards">{WORD_COUNT_TIERS.map(tier =>
        <OptionCard key={tier.id} label={tier.label} hint={tier.hint} recommended={tier.recommended}
          selected={words === tier.words} onSelect={() => { setTouched(true); setWords(tier.words); setCustomWords('') }} />)}
      </div>
      <label className="nw-onboarding-custom">自己有想法，手动输入
        <span className="nw-onboarding-custom-input"><input className="nw-onboarding-custom-field" type="number" min={1} inputMode="decimal" value={customWords} placeholder="例如 120"
          aria-label="目标总字数（万字）" onChange={event => pickCustomWords(event.target.value)} /><span>万字</span></span>
      </label>
    </div></div>
    {error ? <p className="nw-error" role="alert">{error}</p> : null}
    <div className="nw-onboarding-actions">
      <Button variant="outline" size="sm" onClick={useDefaults}>就按默认来</Button>
      <Button variant="primary" size="sm" disabled={!complete || saving} onClick={() => void save()}>{saving ? '保存中…' : '保存，去对话里继续'}</Button>
      {onClose ? <Button variant="ghost" size="sm" onClick={onClose}>取消</Button> : null}
    </div>
  </section>
}
