import type { ShortDramaFinding } from './review'
import type { EpisodeScriptInput } from './types'

const REDLINE_RE = /断肢|开膛|破肚|身首异处|凌迟|活埋|注射死刑|吸毒|制毒|自杀方法|下蛊害人|蛊毒害人|真实的国家机关/
const OPEN_BAN_RE = /拉窗帘|太阳升起|醒过来|闹钟响|起床洗漱|开车上班|喝咖啡闲聊|悠闲的清晨|阳光明媚的早晨/
const WEAK_MICRO_ACT_RE = /眼神微动|眼神微闪|目光微闪|目光微动|微微一怔|若有所思|陷入沉思|嘴角微扬|嘴角微勾|推了半寸|移了半寸/
const STRONG_ACT_MARKERS = /砸|摔|甩|拍|踹|踢|扇|掀|撞|掐|抓|拽|扯|泼|烧|点燃|撕|跪|瘫|倒地|跌|扔|抛|夺|抢|掏出|抽出|拔出|按住|挡|躲|冲上|扑|抱住|拖|绑|堵住|捂|翻过|推翻|推开|推倒|举|亮出|亮明|逼近|踉跄|后退|转身|起身|站起|碎|裂|滚落|滑落|溅|冒出|涨红|攥|捏|摁|特写|推给|滑到|递/
const JARGON_RIDDLE_RE = /法则缝隙|气运锚点|因果闭环|维度坍缩|高维投影|底层逻辑闭环|赋能矩阵/
const PLAIN_GROUNDING_RE = /就是|赔|钱|万|亿|块|命|破产|坐牢|退婚|滚出|抵押|合同|房子|股权|死|活/
const ABSTRACT_EMOTION_CUE_RE = /^[（(]?\s*(?:开心|难过|生气|愤怒|悲伤|伤心|高兴|邪魅|伤感|激动)\s*[）)]?$/
const COMMON_TYPOS_RE = /竞然|迫不急待|按耐不住|走头无路|一愁莫展|再接再励|出奇不意/

function netChars(text: string): number {
  return Array.from(text.replace(/[\s，。！？；：、“”‘’（）()【】\[\]《》—…·\-]/g, '')).length
}

function stripShotTag(text: string): string {
  return text
    .replace(/^△\s*【镜头\d+[^】]*】\s*/, '')
    .replace(/^△\s*/, '')
    .trim()
}

export interface CraftUnit {
  readonly kind: 'action' | 'dialogue'
  readonly location: string
  readonly text: string
  readonly cue?: string
  /** 仅分镜头结构或混排 Markdown 能逐句穿插 △；无 镜头[] 的旧版扁平台词数组无法句间插镜。 */
  readonly shotInterleaved: boolean
}

export function extractCraftUnits(script: EpisodeScriptInput): readonly CraftUnit[] {
  const epTag = `集${String(script.集).padStart(3, '0')}`
  const units: CraftUnit[] = []
  for (const scene of script.场景) {
    const loc = `${epTag}/场${String(scene.场).padStart(2, '0')}`
    if (scene.镜头 && scene.镜头.length > 0) {
      for (const shot of scene.镜头) {
        const shotLoc = `${loc}/镜${String(shot.镜头号).padStart(2, '0')}`
        for (const line of shot.描写) {
          if (line.trim() !== '') {
            units.push({ kind: 'action', location: shotLoc, text: line.trim(), shotInterleaved: true })
          }
        }
        for (const line of shot.台词) {
          if (line.台词.trim() !== '') {
            units.push({
              kind: 'dialogue',
              location: shotLoc,
              text: line.台词.trim(),
              shotInterleaved: true,
              ...(line.括号提示 ? { cue: line.括号提示 } : {}),
            })
          }
        }
      }
    } else {
      const env = (scene.场景环境 ?? scene.动作).trim()
      if (env !== '') {
        units.push({ kind: 'action', location: loc, text: env, shotInterleaved: false })
      }
      for (const line of scene.台词) {
        if (line.台词.trim() !== '') {
          units.push({
            kind: 'dialogue',
            location: loc,
            text: line.台词.trim(),
            shotInterleaved: false,
            ...(line.括号提示 ? { cue: line.括号提示 } : {}),
          })
        }
      }
    }
  }
  return units
}

function pushFinding(
  list: ShortDramaFinding[],
  证据位置: string,
  严重程度: string,
  是否建议阻断: boolean,
  问题说明: string,
  修改建议: string,
): void {
  list.push({
    模块名: '短剧审读',
    证据位置,
    严重程度,
    是否建议阻断,
    问题说明,
    修改建议,
    建议返回节点: '单集剧本',
    处置状态: '待处理',
  })
}

/**
 * 吸收 short-drama-factory v4.9 实战工艺铁律的确定性检查（仅合规红线阻断，其余为创作精修提醒）：
 * E10 合规红线 / E5 开篇废镜头 / E24 干聊断层 / E26 无效微动作 / E25 谜语黑话 /
 * E19 15秒台词密度 / E20 动作过长 / E21 视听比例 / E18a 空泛情绪提示 / E22 错别字。
 */
export function checkEpisodeCraft(script: EpisodeScriptInput): readonly ShortDramaFinding[] {
  const findings: ShortDramaFinding[] = []
  const units = extractCraftUnits(script)
  if (units.length === 0) return findings
  const epTag = `集${String(script.集).padStart(3, '0')}`

  const fullText = units.map((u) => u.text).join('\n')
  const redline = REDLINE_RE.exec(fullText)
  if (redline !== null) {
    pushFinding(
      findings,
      epTag,
      '高',
      true,
      `合规红线（E10）：命中短剧平台高危违禁词「${redline[0]}」。`,
      '删除或替换为合法可拍的具体戏剧冲突细节。',
    )
  }

  const headText = units.slice(0, 3).map((u) => u.text).join(' ')
  const openBan = OPEN_BAN_RE.exec(headText)
  if (openBan !== null) {
    pushFinding(
      findings,
      units[0]!.location,
      '中',
      false,
      `开篇废镜头（E5）：开篇前 3 拍出现慢热日常铺垫「${openBan[0]}」，容易错失黄金 3 秒留存。`,
      '砍掉起床/出门/喝咖啡铺垫，首镜直接切入冲突或倒计时死线动作。',
    )
  }

  let consecutiveDlgLines = 0
  let consecutiveDlgChars = 0
  let dryRunWarned = false
  let densityWarned = false
  let totalDlgChars = 0
  let totalActChars = 0

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i]!
    const typo = COMMON_TYPOS_RE.exec(unit.text)
    if (typo !== null) {
      pushFinding(
        findings,
        unit.location,
        '低',
        false,
        `高频同音错别字（E22）：疑似错别字「${typo[0]}」。`,
        '核对并修正用字（如竟然/迫不及待/按捺不住/走投无路/一筹莫展/再接再厉/出其不意）。',
      )
    }

    if (unit.kind === 'action') {
      consecutiveDlgLines = 0
      consecutiveDlgChars = 0
      const cleanAct = stripShotTag(unit.text)
      const actLen = netChars(cleanAct)
      totalActChars += actLen
      if (actLen > 45) {
        pushFinding(
          findings,
          unit.location,
          '低',
          false,
          `动作描写过长（E20）：单条动作描写净字数为 ${actLen} 字，超出单镜可读建议（40–45 字）。`,
          '拆分为两个短促可拍的镜头拍，或砍掉非视觉心理赘语。',
        )
      }
      if (WEAK_MICRO_ACT_RE.test(cleanAct) && !STRONG_ACT_MARKERS.test(cleanAct)) {
        pushFinding(
          findings,
          unit.location,
          '低',
          false,
          `无效微动作（E26）：动作描写「${cleanAct}」仅依赖虚微神态，缺乏可见物理动作支撑。`,
          '补一个肉眼可见的强物理动作标记（砸/摔/按/亮牌/转身/摔），或改为具体手头动作。',
        )
      }
      continue
    }

    consecutiveDlgLines += 1
    const dlgLen = netChars(unit.text)
    consecutiveDlgChars += dlgLen
    totalDlgChars += dlgLen

    if (!dryRunWarned && unit.shotInterleaved && consecutiveDlgLines > 6) {
      dryRunWarned = true
      pushFinding(
        findings,
        unit.location,
        '中',
        false,
        `干聊断层（E24）：已连续出现 ${consecutiveDlgLines} 句纯对白而无视觉动作 △ 插入，画面易沦为站桩广播剧。`,
        '每 2–4 句对白穿插 1 条可见物理动作、神态反应特写或物证操作镜头。',
      )
    }

    if (!densityWarned && consecutiveDlgChars > 95) {
      densityWarned = true
      pushFinding(
        findings,
        unit.location,
        '低',
        false,
        `15 秒窗口台词过密（E19）：连续对白已达 ${consecutiveDlgChars} 字（超出 15 秒窗口参考容量），建议插入动作停顿换气。`,
        '在中间切入一条对手反应或道具动作打断口播感。',
      )
    }

    if (unit.cue && ABSTRACT_EMOTION_CUE_RE.test(unit.cue.trim())) {
      pushFinding(
        findings,
        unit.location,
        '低',
        false,
        `表演语气过于抽象（E18a）：括号提示「${unit.cue}」只有抽象情绪标签，不利于演员与声音指导落地。`,
        '改写为可表演的声学与身体提示（如“压低声音、笑意不达眼底”或语速/音量/尾音描述）。',
      )
    }

    const riddle = JARGON_RIDDLE_RE.exec(unit.text)
    if (riddle !== null) {
      const nextDlg = units.slice(i + 1, i + 3).find((u) => u.kind === 'dialogue')?.text ?? ''
      if (!PLAIN_GROUNDING_RE.test(unit.text) && !PLAIN_GROUNDING_RE.test(nextDlg)) {
        pushFinding(
          findings,
          unit.location,
          '低',
          false,
          `黑话未作大白话换算（E25）：台词出现抽象设定词「${riddle[0]}」，且同轮或下一句未直给白话利害结论。`,
          '当句或紧接下一句用大白话点透值多少钱、犯什么罪或谁输谁赢。',
        )
      }
    }
  }

  const hasInterleavedShots = units.some((u) => u.shotInterleaved)
  const dlgCount = units.filter((u) => u.kind === 'dialogue').length
  if (hasInterleavedShots && dlgCount >= 6 && totalDlgChars + totalActChars > 0) {
    const ratio = totalDlgChars / (totalDlgChars + totalActChars)
    if (ratio > 0.72) {
      pushFinding(
        findings,
        epTag,
        '低',
        false,
        `视听动作占比偏低（E21）：本集对白字数占比 ${(ratio * 100).toFixed(0)}%（高于 70% 参考线），视听调度略单薄。`,
        '删减口水复述句，将心理冲突改用身份反差忙活或物证对抗镜头演出。',
      )
    }
  }

  return findings
}

export interface EpisodeProtectiveNote {
  readonly code: 'N12' | 'N14'
  readonly label: string
  readonly reason: string
}

/** 保护性反例提示：识别快速短句拉扯（N12）等合法节奏形态，防止审读误伤。 */
export function collectEpisodeProtectiveNotes(script: EpisodeScriptInput): readonly EpisodeProtectiveNote[] {
  const notes: EpisodeProtectiveNote[] = []
  const units = extractCraftUnits(script)
  let shortStreak = 0
  let maxShortStreak = 0
  for (const unit of units) {
    if (unit.kind === 'dialogue' && netChars(unit.text) <= 4) {
      shortStreak += 1
      if (shortStreak > maxShortStreak) maxShortStreak = shortStreak
    } else if (unit.kind === 'dialogue') {
      shortStreak = 0
    }
  }
  if (maxShortStreak >= 5) {
    notes.push({
      code: 'N12',
      label: '快问快答合法碎句节奏',
      reason: `连续 ${maxShortStreak} 句短促交锋对白，属于高压快刀对抗节奏，不可为凑平均句长强行拉长。`,
    })
  }
  return notes
}
