import { afterAll, describe, expect, it, vi} from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
createBook,
EPISODE_FADE_OUT,
parseEpisodeScript,
renderEpisodeScript,
totalDialogueChars,
type EpisodeScriptInput,
type StoryBibleInput,
} from '@webnovel/core'
import { screenplayExportCli} from '../src/scripts/screenplay-export-cli'
import { removeSync} from '../../core/src/repo/remove'

/**
* 阶段 5：新手走查（自动化复现，见 docs/user/walkthrough-film-drama.md）。
*
* 按更新后的新手文档从零走一遍：建一本短剧项目（市场 中文 + 输出形态 短剧，
* 其余全部默认）→ 写第 1 集 → 导出（Fountain + Markdown + 总纲）→ 校验。
* 走查用的是一集原创短剧《巷口面馆》第 1 集（竖屏、身份钩），不是仓库已有示例。
* 注意：这里只复现“建书 → 写集 → 导出”的机器可验证部分；对话里的提问、
* 确认点与大白话提示由走查记录逐项人工核对（技能文本见 novel-inspiration /
* novel-design SKILL.md，走查记录有对照表）。
*/

const roots: string[] = []
afterAll(() => roots.forEach((root) => removeSync(root)))

function runCli(argv: string[]): { exit: number; stdout: string; stderr: string} {
const out: string[] = []
const err: string[] = []
const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => { out.push(args.join(' '))})
const errSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { err.push(args.join(' '))})
try {
const exit = screenplayExportCli(argv)
return { exit, stdout: out.join('\n'), stderr: err.join('\n')}
} finally {
logSpy.mockRestore()
errSpy.mockRestore()
}
}

const EPISODE_001: EpisodeScriptInput = {
集: 1,
标题: '等了三年的面',
画幅: '竖屏',
钩子类型: '身份',
核心想法: '所有人都以为面馆要关了，其实有人等了三年。',
爽点: '来吃面的阿婆，认出了妈妈的味道。',
时长秒: 90,
开场冲突秒: 3,
反转秒: [25, 55],
结尾钩子秒: 82,
结尾悬念: '妈妈当年为什么离开面馆？',
场景: [
{
场: 1,
地点: '巷口面馆',
时间: '夜',
内外: '内',
动作: '林晚把“今日打烊”的牌子翻过来，阿婆推门进来。',
人物: [
{ 角色: '林晚', 形象标识: '面馆老板娘'},
{ 角色: '阿婆', 形象标识: '白发老太太'},
],
场景环境: '巷口小面馆，灯暖，蒸汽漫过柜台。',
台词: [
{ 角色: '林晚', 台词: '打烊了，阿婆。'},
{ 角色: '阿婆', 台词: '我来吃碗面。'},
{ 角色: '林晚', 台词: '哪种面？'},
{ 角色: '阿婆', 台词: '你妈做的那种。'},
{ 角色: '林晚', 括号提示: 'pause', 台词: '没有那种面。'},
{ 角色: '阿婆', 台词: '有，你会做。'},
{ 角色: '阿婆', 台词: '我等了三年。'},
{ 角色: '林晚', 台词: '等什么？'},
{ 角色: '阿婆', 台词: '等这碗面。'},
{ 角色: '林晚', 台词: '坐吧，我做。'},
],
},
{
场: 2,
地点: '面馆后厨',
时间: '夜',
内外: '内',
动作: '林晚翻出妈妈留下的旧菜谱，手指停在“阳春面”那一页。',
人物: [
{ 角色: '林晚', 形象标识: '面馆老板娘'},
{ 角色: '阿婆', 形象标识: '白发老太太'},
],
场景环境: '后厨窄小，灶火亮着，墙上挂着旧铁勺。',
台词: [
{ 角色: '林晚', 台词: '妈，你教过我。'},
{ 角色: '阿婆', 台词: '她教过你什么？'},
{ 角色: '林晚', 台词: '面要现做，汤要清。'},
{ 角色: '阿婆', 台词: '那就做一碗。'},
{ 角色: '林晚', 台词: '做砸了别怪我。'},
{ 角色: '林晚', 台词: '水开了。'},
{ 角色: '阿婆', 台词: '火别太大。'},
{ 角色: '林晚', 台词: '知道了。'},
{ 角色: '阿婆', 台词: '你妈也这样说。'},
{ 角色: '林晚', 台词: '她总说火候。'},
],
},
{
场: 3,
地点: '巷口面馆',
时间: '夜',
内外: '内',
动作: '阿婆吃完面，把一张旧照片推到林晚面前。',
人物: [
{ 角色: '林晚', 形象标识: '面馆老板娘'},
{ 角色: '阿婆', 形象标识: '白发老太太'},
],
场景环境: '面馆只剩一盏灯，照片上是年轻时的妈妈。',
台词: [
{ 角色: '阿婆', 台词: '这碗面，值了。'},
{ 角色: '林晚', 台词: '您到底是谁？'},
{ 角色: '阿婆', 台词: '你妈的老主顾。'},
{ 角色: '林晚', 台词: '那她去哪了？'},
{ 角色: '阿婆', 台词: '她把店交给你了。'},
{ 角色: '林晚', 台词: '店是她的命。'},
{ 角色: '阿婆', 台词: '现在是你的了。'},
{ 角色: '林晚', 台词: '我守不住。'},
{ 角色: '阿婆', 台词: '你守得住。'},
{ 角色: '林晚', 台词: '明晚还来吗？'},
{ 角色: '林晚', 台词: '那我等你。'},
],
},
],
}

const BIBLE: StoryBibleInput = {
标题: '巷口面馆',
类型: '都市／身份反转／温情治愈',
形式: '12集连续短剧／约90分钟长片规格；三幕、十二集',
文字目标: '分镜拉片剧本每集约3,000—5,000字，服从成片节奏，不为凑字数扩写',
叙事线: { A线: '林晚守店与身份揭晓', B线: '妈妈留下的菜谱与旧照片', C线: '阿婆的暗中守护'},
故事一句话: '接手妈妈面馆的林晚，在打烊前遇到一位等了三年的老主顾。',
开篇承诺: '打烊前，阿婆走进巷口面馆，点了一碗妈妈做的面。',
悬念: ['阿婆到底是谁', '妈妈当年为什么离开面馆', '菜谱里还藏着什么'],
主题: '手艺与记忆，比招牌更难守。',
反题: '靠噱头和流量换来的爆红，守不住一口锅的温度。',
世界硬约束: {
现实基底与唯一超自然规则: '江南小城巷口，没有超自然设定；唯一的硬规矩是“妈妈的面只做给家里人吃”。',
硬约束: ['妈妈的菜谱不外传：林晚答应过妈妈，配方只做给家里人吃。', '面馆租约只剩一个月，到期不续就得走。'],
核心地理空间: ['巷口面馆：林晚的面馆，路灯下最后一个摊位。', '面馆后厨：墙上挂着妈妈留下的旧铁勺。'],
},
三段核心真相: [
{ 阶段: '第一阶段', 内容: '林晚接手妈妈的面馆，生意冷清，准备关店。'},
{ 阶段: '第二阶段', 内容: '阿婆的出现让“妈妈的面”重新被人记住，找上门的人越来越多。'},
{ 阶段: '第三阶段', 内容: '妈妈离开的真相揭开：她把店交给了女儿，林晚决定守下去。'},
],
人物: [
{ 标准名: '林晚', 年龄: '28岁', 身份: '巷口面馆老板娘', 人物弧: '从想关店、只求脱手，到为妈妈重新掌勺，把店守下去。', 曾误标: ['老板娘[第1集]']},
{ 标准名: '阿婆', 年龄: '约70岁', 身份: '妈妈的老主顾', 人物弧: '从只来吃面的客人，变成替林晚守住真相的人。'},
],
分集结构: [{ 集: 1, 时间锚点: 'D1 夜晚', 梗概: '打烊前，阿婆走进面馆，点了一碗妈妈做的面。'}],
对白语言: '中文',
}

describe('阶段 5：新手走查——《巷口面馆》短剧项目从建书走到导出', () => {
it('建书：市场 中文 + 输出形态 短剧写进契约 frontmatter，默认值外显', () => {
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5-walkthrough-'))
roots.push(workspace)
const created = createBook({
workspaceRoot: workspace,
书名: '巷口面馆',
concept: {
状态: '已确认',
核心创意: '接手妈妈面馆的女儿，在打烊前遇到一位等了三年的老主顾。',
题材与目标读者: '都市温情短剧，中文观众',
主角核心欲望: '林晚想守住妈妈的面馆。',
主要冲突: '面馆租约只剩一个月，阿婆的出现打乱了关店的计划。',
核心看点: '妈妈的面到底有什么秘密，阿婆到底是谁。',
差异化方向: '一碗面牵出三代人的记忆，不靠打脸靠味道。',
明确不要什么: '不要恶俗反转，不要羞辱式打脸。',
市场: '中文',
输出形态: '短剧',
},
})
expect(created.ok, created.reason).toBe(true)
const bookRoot = path.join(workspace, '巷口面馆')
const contract = fs.readFileSync(path.join(bookRoot, '作品契约/契约.md'), 'utf-8')
expect(contract).toContain('市场: 中文')
expect(contract).toContain('输出形态: 短剧')
})

it('第 1 集：竖屏 90 秒、3 场、台词 180–360 字、单句 ≤12 字、渲染—解析往返一致', () => {
const rendered = renderEpisodeScript(EPISODE_001)
expect(rendered.path).toBe('剧本/短剧/集001.md')
const total = totalDialogueChars(EPISODE_001.场景)
expect(total).toBeGreaterThanOrEqual(180)
expect(total).toBeLessThanOrEqual(360)
for (const scene of EPISODE_001.场景) {
for (const line of scene.台词) {
expect([...line.台词].filter((c) =>!/\s/.test(c)).length).toBeLessThanOrEqual(12)
}
}
expect(rendered.内容).toContain('1-1 夜／内 巷口面馆')
expect(rendered.内容).toContain(EPISODE_FADE_OUT)
// 未给分镜头：渲染按场出待填模板行（工具不编造导演的决定）；台词无超长，零警告。
expect(rendered.警告).toEqual([])
const reparsed = parseEpisodeScript(rendered.内容)
expect(reparsed.ok, reparsed.problems.join('；')).toBe(true)
expect(renderEpisodeScript(reparsed.episode!).内容).toBe(rendered.内容)
})

it('导出：短剧集001 + 总纲，退出 0、人名检查通过、写盘后 --校验 true 退出 0', () => {
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5-walkthrough-'))
roots.push(workspace)
const bookRoot = path.join(workspace, '巷口面馆')
fs.mkdirSync(path.join(bookRoot, '剧本/短剧'), { recursive: true})
fs.writeFileSync(path.join(bookRoot, '剧本/短剧/集001.md'), renderEpisodeScript(EPISODE_001).内容)
const biblePath = path.join(workspace, '总纲.json')
fs.writeFileSync(biblePath, JSON.stringify(BIBLE, null, 2))
const { exit, stdout, stderr} = runCli([
'--book', bookRoot, '--形态', '短剧', '--集', '1', '--总纲', biblePath,
])
expect(stderr).toBe('')
expect(exit).toBe(0)
const value = JSON.parse(stdout)
expect(value.ok).toBe(true)
expect(value.总纲文件).toBe('巷口面馆-总纲.md')
expect(value.人名检查).toEqual({ ok: true, problems: []})
expect(value.文件).toHaveLength(3)
expect(value.文件[2].content).toContain('# 《巷口面馆》总纲（剧本圣经）')
expect(value.文件[2].content).toContain('（原剧本曾误标为：老板娘[第1集]，已全部统一为林晚）')
// 写盘 + 校验：按新手文档第 7 节的纪律，校验通过才算完成。
const target = path.join(workspace, '导出目标')
fs.mkdirSync(target, { recursive: true})
for (const file of value.文件) fs.writeFileSync(path.join(target, file.名称), file.content)
const verified = runCli(['--book', bookRoot, '--形态', '短剧', '--集', '1', '--总纲', biblePath, '--目标', target, '--校验', 'true'])
expect(verified.exit).toBe(0)
expect(JSON.parse(verified.stdout).校验.ok).toBe(true)
})
})
