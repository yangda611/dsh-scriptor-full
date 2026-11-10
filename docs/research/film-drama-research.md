# DSH Scriptor 影视剧改造调研笔记：专业剧本格式 × 短剧惯例 × 题材库（海外 vs 中文）

> 调研日期：2026-11-10 · 调研员：DSH Scriptor 改造调研（只调研、不改代码）· 用途：把 DSH Scriptor v8.4.1（长篇小说工作台）改造成输出短剧 / 电影剧本 / 小说原文的 AI 影视剧项目组工具；创建时选市场（海外 / 中文 → 题材库）与输出形态（短剧 / 电影剧本 / 小说），最终输出永远是中文（团队自己拿去拍）。

> **开头一句话：已查到——美式标准剧本格式的六大元素与版式规则、中文分场景 / 分镜头剧本的约定俗成格式与两者区别、竖屏短剧的单集结构与钩子 / 付费卡点节奏、横屏短剧与竖屏短剧的时长分野、海外与国内短剧的热门题材与命名习惯、国内微短剧的广电备案与内容禁区；暂未查到、需要再确认——BBC Writersroom 官网当前可直接打开的格式模板页（本次只查到二手转述与镜像页，未直接打开 bbc.co.uk 原站）、FlexTV 平台专属的爆款题材榜单、海外各平台对性 / 暴力内容的具体成文审核细则、以及中文剧本格式是否存在任何行业协会层面的成文标准（现有来源只说“没有专门协会规定”）。**

说明：本笔记每条结论后都标来源 URL（2026-11-10 当天通过搜索与打开页面核实）；没有来源的写“未查到”，不写成事实。第 4 节“对改造的启示”是基于前三节事实的推论，已标注为建议，不是查到的事实。

---

## 1. 专业剧本格式

### 1.1 美式标准剧本格式（Master Scene / Spec Script）：六大元素与版式

- **字体与页边距是硬规则**：12 磅 Courier（等宽字体，Courier Prime / Courier Final Draft 亦可），左 1.5 英寸（留装订孔）、上 / 下 / 右各 1 英寸；页码在页眉右上角、带句点，首页无页码。来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://filmdaft.com/screenplay-format/
- **“一页 ≈ 一分钟”是经验法则，不是定律**：标准格式下每页约合一分钟银幕时间，电影剧本通常 90–110 页（Final Draft 指南说写满 90–120 页即完成一部剧本；Nicholl 奖规则为 80–125 页）。实测研究（Stephen Follows 对 2,520 部已投产剧本）平均约 55 秒 / 页，只有 18.2% 的剧本落在“每页一分钟 ±5%”内——整本估算可用，单页不可。来源：https://www.studiobinder.com/blog/brilliant-script-screenplay-format/ ；https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://www.joinspringpro.com/guides/screenplay-format-for-film/
- **没有唯一的全球统一标准**：学院（Academy Nicholl Fellowships）只要求“标准行业格式（12 磅 Courier）”，并承认不存在绝对统一的格式；不同制片厂可在编剧合同里写自己的格式要求。来源：https://en.m.wikipedia.org/wiki/Screenplays#US ；https://filmdaft.com/screenplay-format/
- **六大元素各有固定缩进**（自左页边起算，常见值）：场景标题 1.5 英寸、动作行 1.5 英寸（满宽）、对白约 2.5 英寸（宽约 3.5 英寸）、括号提示约 3.1 英寸、角色名约 3.7 英寸、转场右对齐。来源：https://scenepaper.com/blog/screenplay-format-guide ；https://thelanote.com/mastering-the-art-of-screenplay-format-for-easy-reading/
- **场景标题（Slugline / Scene Heading）三段式、全大写**：`INT./EXT. + 地点 + 时间`，例如 `INT. KITCHEN - NIGHT`、`EXT. KEVIN'S HOUSE – DAY`；车内等内外兼有的场景用 `INT./EXT.`；时间多用 DAY / NIGHT / MORNING / EVENING，CONTINUOUS 表示与上一场无缝衔接，MOMENTS LATER / LATER 亦可；除非时钟本身是剧情点，避免写具体钟点如 3:47 PM。来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://www.studiobinder.com/blog/brilliant-script-screenplay-format/ ；https://www.epicdraft.com/blog/screenplay-format-reference
- **动作行（Action / Description）**：现在时、只写银幕上看得见 / 听得见的东西，不写人物内心想法；段落宜短（3–4 行为佳，超过 10 行易被跳读）；角色首次出场时姓名全大写、可附年龄（如 `KEVIN (30s)`）；重要道具、音效、镜头运动也可全大写以便场记拆解剧本，但滥用会适得其反。来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://www.studiobinder.com/blog/brilliant-script-screenplay-format/ ；https://en.wikibooks.org/wiki/Movie_Making_Manual/Screenplay_Format
- **角色名（Character Cue）与对白（Dialogue）**：说话人姓名全大写、居中于对白上方；对白用窄栏、无引号、口语化；被打断的台词行尾用双破折号 `--`，拖长 / 欲言又止用省略号 `...`（省略号表示 trailing off，不是打断）。来源：https://scenepaper.com/blog/screenplay-format-guide ；https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue ；https://screencraft.org/blog/10-things-to-delete-from-your-dialogue-scenes-right-now/
- **括号提示（Parenthetical）**：位于角色名与台词之间（也可插在两段台词中间），小写（专有名词首字母大写）、短、不用感叹号 / 问号、不用作动作描写；只在台词本身无法传达语气 / 对象时才用，逐行标注是新手常见错误。来源：https://www.finaldraft.com/blog/lets-talk-about-parentheticals ；https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
- **台词停顿的三种写法（有争议，需在工具内定一种）**：(a) 括号提示 `(beat)` / `(pause)` 插在台词中间，前后用省略号衔接；(b) 台词内直接用省略号 `...` 表示迟疑；(c) ScreenCraft 明确反对用 `(beat)` 表示停顿，认为 beat 在表演术语里含义不止“停顿”，主张写 `(pause)` 或用动作行说明停顿原因。工具设计时应二选一并保持一致，不要混用。来源：https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue ；https://screencraft.org/blog/10-things-to-delete-from-your-dialogue-scenes-right-now/ ；http://mibster.com/mibs/info/screenplay/
- **对话附加标记（Extension，紧跟角色名括号内）**：`(V.O.)` 画外音 / 旁白（说话人不在场、其他角色也听不到，如内心独白）；`(O.S.)` 画外（人在场景里但不在画面内，如隔壁房间喊话）；`(O.C.)` 画外镜头（与 O.S. 含义相近）；`(CONT'D)` 接续（同一角色的台词被动作行打断后继续，跨页时亦用；软件多自动生成）。来源：https://www.finaldraft.com/blog/lets-talk-about-parentheticals ；https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
- **转场（Transition）**：右对齐、全大写、以冒号结尾，如 `CUT TO:`、`DISSOLVE TO:`、`MATCH CUT TO:`、`SMASH CUT TO:`；剧本以 `FADE IN:` 开场、`FADE OUT.` 收尾（句点结尾）；现代 spec 剧本默认“新场景标题即意味着切”，转场应少用，只在转场本身有意义时用。来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://www.studiobinder.com/blog/brilliant-script-screenplay-format/ ；https://scenepaper.com/blog/screenplay-format-guide
- **副标题（Subheader）**：同一场景内换房间 / 跳时间时可用，如 `LATER`，不必另起场景标题；但制片方倾向另起 slugline（不同时间 = 不同拍摄安排），两种做法都被接受。来源：https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
- **蒙太奇（Montage）**：以 `BEGIN MONTAGE`（副标题式）开头、`END MONTAGE` 收尾，中间按行列出各小场景；若用于投产，每个小场景仍需单独 slugline（不同地点 = 不同拍摄安排）。来源：https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
- **字幕 / 屏幕文字（Chyron / Title）**：动作行开头写 `CHYRON`（全大写）+ 文字内容，或用 `TITLE` 代替，二者均被接受。来源：https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
- **镜头 / 机位提示（Shot）在 spec 剧本里应克制**：格式上写成全大写的动作行，如 `CLOSE ON`、`WIDE SHOT`、`ANGLE ON`；但除非编剧同时是导演、或该镜头对理解场景不可或缺，否则不应写镜头——会把读者拉出故事，且属于导演职权。拍摄剧本（shooting script）则相反，可以包含镜头、音乐提示、转场等精确制作信息。来源：https://www.studiobinder.com/blog/brilliant-script-screenplay-format/ ；https://www.studiobinder.com/blog/how-to-write-a-screenplay/ ；https://www.thewritersguide.co.uk/writing-a-screenplay
- **镜头术语（供分镜头层使用）**：景别 EWS（极远景）/ WS（远景）/ MWS（中远景）/ MS（中景，腰部以上）/ MCU（中近景，肩部以上）/ CU（特写，颈部以上）/ ECU（大特写，如眼睛）；角度分平视 / 仰拍（显强大）/ 俯拍（显弱小）/ 荷兰角（倾斜，不安感）/ POV；运镜分固定 / 横摇 Pan / 纵摇 Tilt / 推 Push In / 拉 Pull Out / 变焦 Zoom / 跟踪 Tracking / 弧线 Arc / 手持 Handheld；另有 INSERT（关键道具特写）与 TWO SHOT / THREE SHOT（画面内人数）。来源：https://openbooks.fitchburgstate.edu/preproduction/chapter/the-shot-list/ ；https://storybirdie.com/blog/how-to-create-a-shot-list-directors-guide ；https://www.aevon.ink/blog/shot-lists-storyboards-indie-filmmakers
- **音效（SFX）在电影剧本里的写法**：动作行内把关键音效词全大写（如 `the SOUND of silverware HITTING the floor`，一次只大写一个词）；首次出场角色、转场、镜头提示亦用全大写。注意：**“SFX: … / MUSIC: … 独占一行”是广播剧（BBC Radio Drama）格式，不是电影剧本格式**——BBC 广播剧里音效与音乐提示用下划线大写、独占一行、且不被当作台词读出；电影剧本里音乐提示没有统一强制格式，常见做法是动作行内简短提示情绪 / 曲名（歌名加引号），或单独一行 `MUSIC: …`，工具内需自定一种并注明。来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/ ；https://www.ejleeauthor.com/blog/screenwriting-standards-5Z9YD-wbjr3 ；https://epicscribe.io/blog/writing-sound-effects-audio-drama-scripts ；https://www.cloudrad.io/blog/radio-drama
- **跨页台词**：一页底部台词未完标注 `(MORE)`，下页顶部角色名后加 `(CONT'D)`；台词只在句末断页。来源：https://www.finaldraft.com/learn/how-to-format-a-screenplay/
- **文件交换格式**：Fountain 是纯文本剧本标记语言（全大写行 + INT./EXT. 即场景标题、以 `TO:` 结尾的大写行即转场）；Final Draft 的 FDX 是行业通用的可交换格式，制片与排期工具多要求 FDX。来源：https://scenepaper.com/blog/screenplay-format-guide ；https://www.aevon.ink/blog/screenplay-format-guide
- **BBC Writersroom（英国）**：提供多套免费模板（ScriptSmart），涵盖电影剧本（screenplay，电影与单集电视剧标准格式）、带幕间休息的电视剧本、BBC 录播正剧（taped drama）、BBC 录播情景喜剧、广播剧（scene style / cue style）、舞台剧等，分英式与美式两版；其 Script Room 投稿要求剧本至少 30 页、转成单个 PDF 提交（半小时剧约 30–35 页、一小时剧 50–70 页、长片 70–120 页）。**待确认**：本次未直接打开 bbc.co.uk 原站模板页，上述内容来自二手转述与镜像页，正式引用前应再打开原站核对。来源：https://forum.literatureandlatte.com/t/formatting-and-layout-of-finished-text/520 ；http://members.madasafish.com/~misterdisco/writersresources.htm ；https://bbcinsight.pages.dev/blogs/writersroom/entries/9cf269f5-d841-48eb-b0d9-692530a9f1c8 ；https://www.bbc.co.uk/writersroom/scripts （本次未打开，仅为 Writersroom 剧本库地址的转述）

### 1.2 中文影视剧本格式：三种剧本的区别与约定俗成写法

- **中国没有统一的剧本格式标准**：没有相关专门协会做出格式规定，市场也未提出统一要求；因文字差异也不可能完全克隆美国版本，现有写法只是国内约定俗成。来源：https://amber-zhang.ghost.io/fen-chang-jing-ju-ben-ge-shi/
- **三种剧本的分工**：文学剧本（编剧完成）、分镜头剧本 / 导演剧本（导演完成，是把文学内容分切成一系列可拍摄镜头的施工蓝图）、完成台本（场记记录完成）。来源：https://www.sohu.com/a/628132215_121124780 ；https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031
- **文学剧本（分场景剧本是编剧最常写的类型）**：首页居中写片名与作者，下设主要人物表（性别、年龄、身份、性格）；正文以“淡入”开始；每场首行是标头，格式为“场号 + 地点 + 时间 + 内外景”，例如 `6. 会议室 日 内`、`13. 街道 黄昏 外 夏`；地点转换或视觉效果变化较大的时间变化都要另起一场、另换标头；正文包括必要的环境交代、人物行动描写与人物对白；对白把说话人放句首、冒号后为说话内容，动作神态可稍作提示，例如“小慧：你为什么躲着不见我？”“国力没抬头：我不是不见你，是被工作缠住了。”来源：https://amber-zhang.ghost.io/fen-chang-jing-ju-ben-ge-shi/
- **分场景剧本必须做的提示**：角色首次出场提示年龄 / 身份 / 外表 / 性格；特殊音效与视觉效果要提示（如“此时传来剧烈的爆炸声”）；闪回 / 梦境要提示（行文中隐蔽提示或明确标注“以下为闪回 / 梦境”）；特殊视角要提示（主观视角）；字幕、画外音直接标注，如 `[字幕]……`、`[画外音]……`。来源：https://amber-zhang.ghost.io/fen-chang-jing-ju-ben-ge-shi/
- **分镜头剧本（导演剧本 / 故事板）**：大多采用表格形式，栏目一般包括镜号、景别、摄法、长度、内容（画面中人物的动作、台词、场面调度、环境造型）、音响、音乐；“摄法”指镜头的角度和运动；每个段落前注场景（地点与时间），段落之间标镜头组接技巧（切、淡入淡出、叠化等）；景别一般分远景 / 全景 / 中景 / 近景 / 特写；运镜包括推、拉、摇、移、跟；镜头长度以秒计；音乐要标明起始位置。来源：https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031 ；https://blog.csdn.net/Dontla/article/details/105735904 ；https://www.douban.com/note/344893204/
- **“场”与“场面”的区分（电视剧写作）**：场景 = 活动发生的地点（同一场景内人物可上下、时间可变化）；场面 = 同一时间、同一地点、同一人物的基本单位（一旦有人下场就转到下一个场面）；电视剧按集 / 段 / 场组织。来源：https://github.com/jtydhr88/screenwriting-skills/blob/main/plugins/screenwriting/skills/sw-chinese-series-practice/reference.md
- **美式与中文格式的核心差异（对照表）**：

| 维度 | 美式标准剧本 | 中文分场景剧本 |
|---|---|---|
| 权威来源 | 行业惯例 + Nicholl / Final Draft 等指南，无单一全球标准 | 无专门协会规定，约定俗成 |
| 场景标题 | `INT./EXT. 地点 - 时间`，全大写英文 | `场号. 地点 时间 内/外`，如 `6. 会议室 日 内` |
| 对白格式 | 角色名居中大写于对白上方，对白窄栏 | 说话人放句首 + 冒号，如 `小慧：……` |
| 字体 / 计时 | 12 磅 Courier，一页 ≈ 一分钟 | 无等宽字体计时规则 |
| 镜头提示 | spec 剧本克制， shooting script 才详写 | 文学剧本不写镜头，分镜头剧本（导演）才以表格详写 |
| 提示方式 | 括号提示小写、少用 | 括号加注 / `[画外音]`、`[字幕]`等方括号标注 |

来源：上表综合 https://www.finaldraft.com/learn/how-to-format-a-screenplay/ 、https://amber-zhang.ghost.io/fen-chang-jing-ju-ben-ge-shi/ 、https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031 。

### 1.3 对“剧本要专业影视级格式（镜头、音效、台词、台词停顿全细分）”的直接结论

- 应输出**两层**：一层是编剧层（分场景剧本 / 美式 master scene：场景标题 + 动作行 + 角色名 + 台词 + 括号提示），一层是导演层（分镜头表：镜号 / 景别 / 摄法 / 运镜 / 时长 / 画面内容 / 台词 / 音响 / 音乐），两层不要混在同一文本里——这是中美两边都确认的分工。来源：https://www.sohu.com/a/628132215_121124780 ；https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
- 台词停顿应定为显式字段（`(beat)` / `(pause)` / 省略号三选一），而不是让模型自由发挥——三方来源对 `(beat)` 的用法本身就有分歧。来源：https://screencraft.org/blog/10-things-to-delete-from-your-dialogue-scenes-right-now/ ；https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue
- 音效与音乐在电影剧本层没有像广播剧那样统一的 `SFX:` / `MUSIC:` 行格式，工具若要“全细分”，应在分镜头表里单列音响 / 音乐栏，而不是硬套广播剧格式进电影剧本。来源：https://epicscribe.io/blog/writing-sound-effects-audio-drama-scripts ；https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031

---

## 2. 短剧惯例

### 2.1 定义与基本盘

- **竖屏短剧（微短剧 / vertical drama / duanju）**：以 9:16 竖屏、手机信息流分发的连续剧；单集 1–2 分钟（60–120 秒，个别到 3 分钟），总集数 60–100 集；每集 2–4 个场景、台词与旁白 180–360 字（英文约 3 词 / 秒换算）；整季台词总量约 10,800–36,000 字。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/ ；https://filmustage.com/blog/how-to-write-a-vertical-drama-script/ ；https://topdrama.app/guides/short-drama-glossary/
- **监管定义**：中国广电总局 NRTA 第 16 号令（2026 年 9 月 1 日生效）将微短剧定义为单集时长 20 分钟以下、有明确主线与连续剧情的剧集。来源：https://topdrama.app/guides/short-drama-glossary/
- **市场规模（供背景参考，非格式规则）**：2025 年全球短剧应用内购收入 29.8 亿美元、同比 +115%（Sensor Tower）；Omdia 口径全球微短剧收入 2025 年 110 亿美元、2026 年预计 140 亿美元；ReelShort 美国用户日均使用 35.7 分钟，高于 Netflix 移动端 24.8 分钟。来源：https://filmustage.com/blog/how-to-write-a-vertical-drama-script/ ；https://topdrama.app/guides/short-drama-glossary/
- **竖屏短剧不是“把长剧剪短”**：它是独立格式，叙事围绕“爽点”组织而非围绕人物与主题展开，类型比长剧更精准细分；竖屏构图、单集一两分钟、前三秒必有钩子、每集结尾必有反转、依托信息流分发是其基因。来源：https://www.chinawriter.com.cn/n1/2026/0829/c419388-40788397.html ；https://scenepaper.com/blog/how-to-write-a-vertical-micro-drama-script

### 2.2 单集结构：钩子、转折、爽点、悬念

- **开头 3–5 秒内必须进冲突**：第一句台词或第一个动作就是冲突本身，不铺场景、不做自我介绍、不放片头；静音预览也要能看懂设定。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/ ；https://news.shorstory.com/zh/articles/vertical-drama-script-format-template/ ；https://www.screenweaver.ai/zh/blog/short-drama-episode-structure
- **每 20–30 秒一个转折**：90 秒一集至少转两次，转折可以是新信息、立场翻转、危机升级或身份揭露。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/ ；https://drama.so/zh/blog/short-drama-script-structure ；https://some.im/skills/niuwoai-skills-short-drama-script
- **每集结尾 5–10 秒必须留钩子（cliffhanger），且要切在问题上、不是答案上**：钩子三种类型轮换使用——身份类（某人不是他自称的那个人）、情感类（告白 / 拒绝 / 关系破裂停在关键点）、顿悟类（观众和主角同时发现先前的判断错了）；两集用同一种钩子会像骗术。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/ ；https://filmustage.com/blog/how-to-write-a-vertical-drama-script/ ；https://microdrama.id/en/academy/short-drama-foundations
- **Filmustage 的四段式 Beat Engine（90 秒一集）**：Hook 0–15 秒（中国制片人称之为“爆点”，有的剧把全季最具电影感的一拍直接放在开头当预告）、Friction 15–60 秒（必须是画面内真实的身体或语言冲突，不是潜台词）、Spike 60–90 秒（全集最大的一次冲击：证据变化、立场翻转、视角翻转；静音后若冲击消失就不算 Spike）、Button 最后 5–10 秒（切在问题上，比感觉安全的时间再早两秒）。来源：https://filmustage.com/blog/how-to-write-a-vertical-drama-script/
- **另一套六段式分镜节奏（90 秒一集，供分镜层参考）**：黄金钩子 0–3 秒、情境交代 3–15 秒、冲突升级 15–40 秒、反转点 40–55 秒、爽点释放 55–75 秒（打脸、碾压、众目睽睽，快切）、悬念收尾 75–90 秒（永远不要在圆满处结束）。来源：https://github.com/someonerow-oss/ai-short-drama-prompts/blob/main/docs/01-%E7%9F%AD%E5%89%A7%E8%8A%82%E5%A5%8F%E4%B8%8E%E5%88%86%E9%95%9C%E7%BB%93%E6%9E%84.md
- **爽点有固定表现方式**：动作上是扇耳光、下跪、辱骂；情节上是剧情反转、身份逆袭；人物设定上频繁出现“总裁”“夫人”“战神”；套路是先把主角往死里欺负、再让主角亮明身份狠狠打脸。来源：https://news.qq.com/rain/a/20240715A05FZF00 ；https://www.163.com/dy/article/LBBQ1TR20556BXT9.html
- **台词要短**：竖屏剧本单句台词宜在 20 个词以内（中文指南：台词尽量不超过 12 个字一句）；动作行每条约 40 词以内；每集只容纳一个想法 / 一个事件，不是三个。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/ ；https://news.shorstory.com/zh/articles/vertical-drama-script-format-template/ ；https://scenepaper.com/blog/how-to-write-a-vertical-micro-drama-script
- **对白即动作**：每句台词要么推进冲突、要么在压力下揭示人物，二者都不满足就删；没有寒暄、铺垫与借对话交代背景的空间；长独白基本不成立，告白 / 揭露场景可稍长。来源：https://filmustage.com/blog/how-to-write-a-vertical-drama-script/
- **竖屏写作为特写服务**：9:16 画幅大部分时间被一张脸填满，地点让位于反应镜头，微表情比布景重要；多用一两个人物的正反打，少用大场面。来源：https://filmustage.com/blog/how-to-write-a-vertical-drama-script/ ；https://scenepaper.com/blog/how-to-write-a-vertical-micro-drama-script
- **冲突要长在设定里**：最有效的设定自带结构性冲突——欢喜冤家（enemies-to-lovers）、被迫共处（forbidden proximity）、权力不对等（CEO / 助理、保护者 / 被保护者）、包办 / 强制处境；若每集都要现编障碍，设定本身就不合格。来源：https://filmustage.com/blog/how-to-write-a-vertical-drama-script/

### 2.3 全季结构与付费卡点

- **全季 60–100 集是平台偏好区间**，要预先规划完整弧线；典型四段：1–10 集立设定（立人物、立结构性冲突、给 2–3 个情绪高峰）、11–40 集升级与复杂化、41–70 集黑暗中段（离解决最远、观众最投入）、71 集至结尾收线（副线先收、主线最后收，最后一集兑现全季承诺的情感回报）。来源：https://filmustage.com/blog/how-to-write-a-vertical-drama-script/
- **前三集定生死**：第 1 集 5 秒内冲突、立主角处境与目标、结尾身份钩；第 2 集反派登场、赌注上桌（钱 / 婚姻 / 性命 / 名声选其一）、主角被逼到墙角、结尾情感钩；第 3 集第一次反转（弱者亮底牌或盟友倒戈）、结尾顿悟钩；主角的第一次真正胜利不得晚于第 5 集，否则付费墙前完播率会塌。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/
- **付费卡点（paywall）**：海外主流应用首个付费集最常见是第 11 集，免费集数中位数约 9 集（ReelShort、DramaBox、NetShort 等）；国内常见前 10–15 集免费，之后按集收费（约 0.8–1 元 / 集，看完全部约 68 元上下）或会员解锁；行业有“前十集定律”与多个卡点（卡一约第 8–16 集、卡二约第 25–30 集、卡三约第 50 集）。来源：https://news.shorstory.com/zh/articles/microdrama-paywall-episode-cliffhanger-guide/ ；https://hxdsb.fjdaily.com/pad/con/202405/16/content_365943.html ；https://www.dianyingjie.com.cn/2025/1027/400121.shtml ；https://filmustage.com/blog/how-to-write-a-vertical-drama-script/
- **卡点写法**：先定锁集的那一集再倒推；该集结尾停在冲突爆发前一拍，答案放进付费后第一集，且回答的同时抛出新问题；卡点处情绪须达顶峰。来源：https://news.shorstory.com/zh/articles/microdrama-paywall-episode-cliffhanger-guide/ ；https://hxdsb.fjdaily.com/pad/con/202405/16/content_365943.html
- **竖屏短剧的剧本组织单位是“集”，不是“幕”**：每集自成小闭环（起势、变向、留问题），并固定标注三个标签，方便编辑、导演、制片翻到哪页都能一眼找到。来源：https://news.shorstory.com/zh/articles/vertical-drama-script-format-template/ ；https://scenemixer.com/guides/vertical-short-drama-script-format/
- **没有统一的投稿模板**：ReelShort / DramaBox 等应用不公布单一强制模板，制片方普遍接受标准剧本版式按集组织（场景标题 INT./EXT. + 地点 + 时间、动作行、角色名与对白、每集结尾标注钩子类型），投稿前以目标平台当季的征稿要求为准。来源：https://scenemixer.com/guides/vertical-short-drama-script-format/

### 2.4 横屏 vs 竖屏：两种短剧是两种产品

- **竖屏短剧**：单集 1–3 分钟（多为 1–2 分钟）、总集数 60–100 集、9:16、信息流分发、情绪爽点导向、快节奏强冲突。来源：https://developer.baidu.com/article/detail.html?id=9323643 ；https://www.100ec.cn/detail--6658254.html
- **横屏短剧 / 中剧**：单集 5–20 分钟（头部项目多为 10–15 分钟）、总集数较少（如 28–29 集）、16:9、长视频平台点播、精品化与深度叙事导向；腾讯视频 2021 年 12 月推出“十分剧场”（单集 10–15 分钟精品横屏短剧），2025 年升级为“十分短剧”（横屏深度叙事 + 竖屏碎片消费互补）；2025 年 8 月广电总局发布“剧集新三样”，“中剧”成为官方认可的剧集品类，单集时长可覆盖 15–30 分钟、足以承载起承转合的传统戏剧结构。来源：https://www.huxiu.com/article/4902474.html ；https://ent.sina.cn/2026-07-03/detail-inifpuss2397938.d.html ；https://www.chinawriter.com.cn/n1/2026/0829/c419388-40788397.html ；https://www.100ec.cn/detail--6658254.html
- **同一 IP 两种形态的实例**：《好一个乖乖女》竖屏版 88 集、每集约 3 分钟；横屏网剧版 29 集、每集约 15 分钟，刨除片头片尾后横屏版有效剧情多出至少两小时。来源：https://www.huxiu.com/article/4902474.html
- **横屏式微的原因（中国作协文章分析）**：横屏要求用户把手机旋转 90 度，是心理门槛；10 几分钟的时长两头不靠（塞不进碎片时间、又不够长剧沉浸）；横屏依赖“频道—点播”的主动搜索逻辑，竖屏天然嵌入信息流、由算法推送。来源：https://www.chinawriter.com.cn/n1/2026/0829/c419388-40788397.html
- **对改造的直接含义**：任务要求的“短剧要横屏竖屏都能出”不是同一剧本换个画幅比——横屏版单集时长是竖屏版的 5–10 倍、集数约 1/3、叙事密度与结构（起承转合 vs 每集三钩）都不同，应作为两种输出模板分别设计，而不是一个模板加一个“画幅”开关。来源：综合 https://www.huxiu.com/article/4902474.html 、https://ent.sina.cn/2026-07-03/detail-inifpuss2397938.d.html 、https://filmustage.com/blog/how-to-write-a-vertical-drama-script/ 。

### 2.5 短剧 vs 电影剧本：节奏对照

| 维度 | 电影剧本 | 竖屏短剧 |
|---|---|---|
| 组织单位 | 场（scene），三幕结构 | 集（episode），每集自成小闭环 |
| 单集 / 单场时长 | 全片 90–120 分钟、90–110 页 | 每集 60–120 秒、180–360 字台词 |
| 钩子密度 | 全片数个转折点 | 每集 1 个开场钩 + 每 30 秒 1 转折 + 每集 1 结尾钩 |
| 总量 | 一部 90–120 页 | 一季 60–100 集、台词约 1–3.6 万字 |
| 付费点 | 无 | 第 8–12 集首个付费墙，此后多卡点 |
| 对白 | 可长、可潜台词 | 单句 <20 词，每句须推进冲突或揭示人物 |

来源：上表综合 https://www.finaldraft.com/learn/how-to-format-a-screenplay/ 、https://scenemixer.com/guides/vertical-short-drama-script-format/ 、https://filmustage.com/blog/how-to-write-a-vertical-drama-script/ 。

---

## 3. 题材库：海外 vs 中文

### 3.1 海外（ReelShort / DramaBox / FlexTV / ShortMax / GoodShort）热门题材

- **六大主导套路（trope 即“承诺一种爽感”）**：Billionaire（权力不对等，不是炫富）、Mafia（忠诚、危险、既是保护者又是威胁的强者；赌注是身体性的——债务、仇敌、家族规矩）、Werewolf / Fated Mates（命中注定的伴侣关系，双方都无法轻易逃脱）、Rebirth / Counterattack（带着前世记忆重来一次，爽在布局与看仇人自投罗网）、Hidden Identity（表面普通、实则强大，爽在等待揭露与揭露后的 fallout）、System（游戏化规则界面 / 任务清单，爽在学规则、钻规则）。来源：https://lanternpop.com/guides/short-drama-tropes-explained/
- **按标题词频统计（LanternPop 追踪的 279 部）**：婚姻 / 离婚类标题最多（53 部提到丈夫、妻子、新娘、婚礼或前任），其次是黑手党（28）、狼人（26）、神 / 龙等奇幻存在（26）、亿万富翁 / 继承人（16）；多数作品是两种套路叠加（如黑手党婚礼、Alpha 的契约新娘）。来源：https://lanternpop.com/guides/short-drama-tropes-explained/
- **平台榜单（2026 年 7 月，Qingchuan 手工核对榜单）**：ReelShort 付费收入第一是狼人题材《The Luna's Second Choice》（被五任未婚夫背叛的狼人女主东山再起）；DramaBox 历史第一是隐藏身份题材《Your Loser Husband Is A Big Shot》（窝囊老公真实身份是大佬）；另有黑手党《I'm The King Of Underground》、战神《Revenge Of The Abandoned Soldier》、弃儿继承人《Billionaire's Hidden Heir》、霸总替身新娘《My Billionaire Husband's Double Life》、狼人 + 意外怀孕《Pregnant After One Night With Alpha》。来源：https://www.qingchuan.asia/rankings/2026-07/
- **平台调性差异**：ReelShort 偏重打磨过的浪漫剧情（假结婚、隐藏身份、高冷亿万富翁、嫉妒对手、公开羞辱、快速到来的情感悬念）；DramaBox 目录更宽，浪漫之外还有复仇、家族剧、奇幻、悬疑，黑手党与权力斗争更重；两者都有亿万富翁题材，但 ReelShort 把财富框进浪漫幻想，DramaBox 更偏黑手党家族与地位争夺。来源：https://www.episivo.com/blogs/dramabox-vs-reelshort/
- **海外爆款的经典设定**：《Fated to My Forbidden Alpha》（ReelShort，60 集）：18 岁生日当天，Selene 发现命中注定的伴侣是死敌 Alpha Jackson，对方计划当众拒绝她，而她不知道自己是被绑架、误认为普通狼的 Luna；狼人世界观来自 Wattpad 狼人言情小说（等级：Alpha 领袖、Luna 伴侣、Omega 底层受欺负者、Rogue 流浪狼；月亮女神为每头狼指定唯一 mate）。来源：https://lanternpop.com/guides/short-drama-tropes-explained/ ；https://www.ai-drama.ai/blog/werewolf-short-dramas ；https://en.flicksmore.com/movie/vid-8419002-fated-to-my-forbidden-alpha.html
- **海外题材的地域分化（Qingchuan 市场情报）**：北美与英国女性偏好狼人 / 吸血鬼奇幻、亿万富翁复仇、独立女性，男性偏好末世生存、黑手党复仇、西方奇幻；东南亚男女皆宜，中国奇幻、战神复仇、古风种田、宫斗可直接复用、文化障碍最小；拉美偏好高情绪强度（末世、黑手党、复仇）。来源：https://www.qingchuan.asia/rankings/2026-07/
- **海外市场的禁忌题材（应避开）**：不要把纯修仙（修仙）、复杂东方神话、长升级线直接出口到西方市场——西方观众流失很快；AI 男频出海以末世囤货 + 西方奇幻为全球通吃组合，东方修仙只限东南亚。来源：https://www.qingchuan.asia/rankings/2026-07/
- **出海本地化的两条路**：直接给中文原版加英文字幕 / 配音，或用西方演员翻拍已验证的剧本；外国观众对赘婿、婆媳等题材不感兴趣，喜欢狼人、吸血鬼等设定；出海剧多在洛杉矶拍摄、起用当地演员。来源：https://www.laitimes.com/en/article/6b5on_6rhzi.html ；https://www.laitimes.com/en/article/6cobw_6t0mq.html ；https://vectree.io/pdf/c/duanju
- **FlexTV**：本次只查到它是 ReelShort / DramaBox 之外的海外竞品之一（与 ShortMax、GoodShort 并列），**未查到 FlexTV 专属的爆款题材榜单或题材偏好**，需再确认。来源：https://vectree.io/pdf/c/duanju ；https://www.laitimes.com/en/article/6cobw_6t0mq.html

### 3.2 国内热门题材：男频 vs 女频

- **男频（男性观众为主）**：核心是“爽”与身份反转——赘婿逆袭、战神归来、神豪、神医、修仙玄幻、重生逆袭、权谋、末世、都市；套路是男主一开始身份低微备受欺凌（或隐瞒大佬身份），在被欺压的节点亮明身份报复反派；早期七成题材是龙王、赘婿、战神大男主逆袭，2022 年赘婿逆袭类投放量断层领跑（《都市至尊豪婿》《超级赘婿之叶家风云》），2023 年 8 月《无双》上线 8 天充值流水破 1.2 亿元、成男频付费标杆。来源：https://lmtw.com/mzw/content/detail/id/255330 ；https://news.qq.com/rain/a/20240715A05FZF00 ；https://www.jiemian.com/article/12064720.html
- **女频（女性观众为主）**：题材更多样——霸总甜宠、虐恋、闪婚、萌宝、重生复仇、大女主（事业型、无 CP）、复仇、职场、宫斗 / 宅斗、婆媳、年代、种田；2023 年女频占比反超男频，到 2025–2026 年无 CP 事业型大女主成为爆款模板（如《女相师》热度破八千万）；中老年女频另有闪婚老伴、豪门恩怨、婆媳矛盾等分支。来源：https://lmtw.com/mzw/content/detail/id/255330 ；https://www.jiemian.com/article/12064720.html ；https://www.163.com/dy/article/LBBQ1TR20556BXT9.html
- **男女频界限正在模糊**：双向破圈、全民向内容成为新增长点；男频题材也在扩容（玄幻、历史、都市、末世、现实）。来源：https://lmtw.com/mzw/content/detail/id/250135/keyword_id/-1
- **国内榜单与剧名高频词**：爱奇艺短剧风云榜标签常见“战神 / 重生 / 复仇 / 虐恋”；对 2,351 部热门微短剧的统计显示剧名高频词前五是“归来”“千金”“总裁”“夫人”“大佬”，且常叠加出现（如《报告总裁夫人和少爷都成大佬了》）；另有统计称 5,000 部短剧中“总裁”出现 216 次、“重生”150 次、“夫人”148 次。来源：http://www.iqiyi.com/ranks1/35/2508071793676233 ；https://finance.sina.com.cn/jjxw/2025-02-07/doc-ineirmwh0207215.shtml ；https://www.163.com/dy/article/JFOMC8V405198R91.html
- **国内男频 / 女频的爽点差异**：男频爽点一般是男性掌握权力，女频爽点一般是有更好的老公、有关心自己的哥哥、依靠另一男性实现价值（从业者原话，市场喜欢但独立女性未必喜欢，引用时需注意这是行业人士的概括、不是定论）。来源：https://news.qq.com/rain/a/20240715A05FZF00
- **国内短剧的观众画像（供题材库权重参考）**：31–40 岁占比最高、是核心观看群体，18–30 岁贡献最多传播讨论，45 岁以上看得最久、花钱最多；女性观众稍多、男性快速追赶；二三四线城市是基本盘。来源：https://www.163.com/dy/article/LBBQ1TR20556BXT9.html

### 3.3 人物命名习惯

- **中文短剧主角姓氏偏冷门贵气姓**：林、叶、楚、江、萧、顾、程、苏、傅等；男主常用姓顾、傅、厉、陆、霍、司、江、叶、楚、裴、季，女主常用姓苏、沈、夏、林、安、温、姜、许、阮、唐；霸总男主名如顾霆琛、傅景深、厉云霆、陆景川、霍司砚，豪门女主名如苏晚、苏清颜、沈知微、夏安然、林晚星；年代江湖剧则多用王李张刘等常见姓、配“强子、老三”等外号。来源：https://news.qq.com/rain/a/20250408A06YH100 ；https://www.sina.cn/news/detail/5342734259061175.html ；https://www.163.com/dy/article/JFOMC8V405198R91.html
- **命名背后的讲究**：冷门姓氏自带独特、稀有、精英感，与主角强大的背景相配；顾、傅、厉等姓听着有贵气，苏、白、云等姓兼具江南温润与仙侠气，慕容、南宫、澹台等复姓常见于武侠 / 权谋题材；都市青春家庭类偏好简洁有代入感的姓（林、叶、周、季）。来源：https://news.qq.com/rain/a/20250408A06YH100 ；https://www.163.com/dy/article/JFOMC8V405198R91.html
- **地点命名同样套路化**：京市、京都、燕都、江城、江都、江州、津港、北江、滨海市、澜市、淮城，以及万能的“A市”。来源：https://www.sina.cn/news/detail/5320628051903179.html
- **海外短剧人物命名**：狼人题材用 Selene、Jackson、Alexander、Kane、Luna 等英文名 + Alpha / Luna / Omega 等等级称谓（如 Selene Lovette、Alpha Jackson、Alexander Kane）；霸总题材用英文名 + 头衔（CEO、billionaire heir）；称谓本身就是题材信号（Alpha = 狼群领袖、Luna = 其伴侣）。来源：https://en.flicksmore.com/movie/vid-8419002-fated-to-my-forbidden-alpha.html ；https://lanternpop.com/guides/short-drama-tropes-explained/ ；https://www.ai-drama.ai/blog/werewolf-short-dramas
- **剧名命名也在变化**：2025 年初的改名潮中，“总裁 / 战神 / 神豪 / 首富 / 千亿总裁 / 京圈太子爷 / 禁欲大佬”等词大幅减少，“爱”成为最常出现的情绪词（占 11%），人设关键词前列变为老公、小姐、女儿等更平民视角的词——题材库的命名词表需要定期更新，不能写死。来源：https://news.qq.com/rain/a/20250120A0959B00

### 3.4 文化背景设定与禁忌 / 审查注意点

- **国内：备案与分级审核是硬门槛**：2024 年 6 月 1 日起未经审核备案的微短剧不得上网传播；微短剧按投资额分三类——重点（100 万元及以上等）、普通（30 万–100 万元）、其他（不足 30 万元），重点与普通报省级以上广电主管部门规划备案与成片审查；所有微短剧须持有网络剧片发行许可证或完成上线报备登记，片头须标注许可证号或备案号，平台不得上线传播未标注的微短剧、不得为其引流推送。来源：https://www.hunan.gov.cn/zqt/zcsd/202502/t20250206_33580560.html ；https://www.ganxian.gov.cn/gxqxxgk/c111222/202502/258ec2e6256c49288620cc84f0223c39.shtml ；https://zh.wikipedia.org/zh-hans/%E7%9F%AD%E5%89%A7_(%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86)
- **国内：内容禁区**：微短剧不得载有危害国家安全、歪曲民族历史、诋毁中华优秀传统文化、侵害未成年人合法权益等 11 项内容；使用 AI 技术生成、制作的微短剧必须显著标明 AI 制作标识；片名不得使用恶俗、恶趣味等违背公序良俗的片名，不得渲染极端对立、复仇、暴戾、焦虑；广电总局曾就“霸总”类微短剧与中老年题材发布专项管理提示。来源：https://zh.wikipedia.org/zh-hans/%E7%9F%AD%E5%89%A7_(%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86) ；https://www.tvoao.com/a/220171.aspx
- **国内：重大题材协审**：涉及政治、军事、外交、国家安全、统战、民族、宗教、司法、公安等特殊题材的微短剧按协审工作机制落实审核；拟在平台首页首屏首推播出的微短剧由广电总局对成片复核。来源：https://www.ganxian.gov.cn/gxqxxgk/c111222/202502/258ec2e6256c49288620cc84f0223c39.shtml
- **海外：内容限制相对宽松，是出海的原因之一**：中国公司出海的部分动因就是海外市场内容限制较少；狼人、吸血鬼、黑手党等在国内受限或敏感的题材在海外是主流。但这不等于无法无天——英国已有对微短剧中暴力、性侵主题与贬低女性描写的监管担忧与内容标准呼声，英国是欧洲最大微短剧市场。来源：https://vectree.io/pdf/c/duanju ；https://zot.news/article/microdramas-snackable-90-second-shows-winning-uk-viewers-iwp9x
- **海外各平台的具体成文审核细则未查到**：本次未找到 ReelShort / DramaBox / FlexTV 公开的、逐条列明禁区的审核手册，只有上述笼统的监管担忧报道；工具若要做海外合规检查，只能先以“平台通用底线 + 目标市场法律”作占位规则，需再确认。来源：见本条说明（未查到）。
- **文化转译禁忌（出海改编时）**：赘婿、婆媳等题材外国观众不感兴趣；纯修仙、复杂东方神话、长升级线不要直接出口西方；东南亚可直接复用国内题材、文化障碍最小。来源：https://www.laitimes.com/en/article/6cobw_6t0mq.html ；https://www.qingchuan.asia/rankings/2026-07/
- **题材库对照总表（供创建时选市场后加载）**：

| | 中文市场 | 海外市场（欧美为主） |
|---|---|---|
| 女频 / 女性向 | 霸总甜宠、重生复仇、大女主、闪婚、萌宝、宫斗宅斗、婆媳、年代、种田 | 狼人 / 吸血鬼奇幻、亿万富翁复仇、独立女性、契约婚姻、替身新娘、意外怀孕 |
| 男频 / 男性向 | 赘婿逆袭、战神归来、神豪、神医、修仙玄幻、重生逆袭、权谋、末世 | 黑手党复仇、末世生存、西方奇幻、隐藏身份、弃儿继承人、战神 |
| 两性通用 | 重生、复仇、逆袭、系统、穿越、都市 | 重生、复仇、隐藏身份、系统、契约婚姻 |
| 慎用 / 避开 | 涉政军外交国安等特殊题材须协审；片名禁恶俗与极端复仇暴戾；AI 生成须标标识 | 纯修仙、复杂东方神话、长升级线（西方）；赘婿、婆媳（外国观众无感） |
| 命名 | 冷门贵气姓（顾傅厉陆霍司）+ 苏沈夏林安温姜许阮唐；地点京市 / 江城 / A市 | 英文名（Selene / Jackson / Alexander）+ Alpha / Luna / Omega 等级称谓 |

来源：上表综合 https://www.qingchuan.asia/rankings/2026-07/ 、https://lanternpop.com/guides/short-drama-tropes-explained/ 、https://www.jiemian.com/article/12064720.html 、https://news.qq.com/rain/a/20250408A06YH100 、https://zh.wikipedia.org/zh-hans/%E7%9F%AD%E5%89%A7_(%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86) 。

---

## 4. 对 DSH Scriptor 改造的启示（推论，非查到的事实）

以下为基于第 1–3 节事实的设计建议，供开发时参考，不作为调研结论引用：

1. **输出形态应做三套模板，不是“一套模板 + 参数”**：电影剧本（美式 master scene / 中文分场景剧本，90–120 页量级）、竖屏短剧（60–100 集 × 60–120 秒，每集钩子 / 转折 / 卡点三标签）、横屏短剧 / 中剧（单集 10–20 分钟、集数 20–30 集、起承转合）三者的组织单位、钩子密度与篇幅量级都不同。
2. **剧本输出应分两层**：编剧层（场景标题 / 动作行 / 角色名 / 台词 / 括号提示）与导演层（分镜头表：镜号 / 景别 / 摄法 / 运镜 / 时长 / 画面内容 / 台词 / 音响 / 音乐），两层分别生成、分别校验。
3. **题材库应按“市场 × 性别向”二维组织**：中文男频 / 中文女频 / 海外女性向 / 海外男性向 / 东南亚通用五档起步，每档配题材、命名词表（姓氏 / 英文名 / 地点）、禁忌清单；命名词表要留更新接口（2025 年初改名潮已证明词表会过期）。
4. **短剧生成须内置节拍校验器**：每集 5 秒内有冲突、每 30 秒一转折、每集结尾有钩子且三类钩子轮换、前三集按“身份 → 情感 → 顿悟”排布、第 5 集前给第一次胜利、第 10–11 集设付费卡点——这些都可做成生成后的自动检查项。
5. **合规检查应分市场**：中文走 NRTA 备案分类 + 11 项禁区 + 片名审核 + AI 标识；海外先以通用底线占位，待查到各平台成文细则后再补。
6. **台词停顿与音效 / 音乐的写法要在工具内先定规范**：`(beat)` vs `(pause)` vs 省略号三选一；电影剧本层音效用动作行内大写、音乐提示单列到分镜头表，不要把广播剧的 `SFX:` / `MUSIC:` 行格式硬套进电影剧本。

---

## 5. 未查到 / 需要再确认的清单

1. BBC Writersroom 官网（bbc.co.uk/writersroom）当前可直接打开的格式模板页与 ScriptSmart 下载链接——本次只查到二手转述与镜像页。待确认来源：https://www.bbc.co.uk/writersroom/scripts （未打开）。
2. FlexTV 平台专属的爆款题材榜单、题材偏好与投稿要求——本次只确认它是海外竞品之一，未找到专属榜单。
3. ReelShort / DramaBox / FlexTV / ShortMax / GoodShort 各平台公开的、逐条列明的审核细则（性、暴力、未成年人、仇恨等）——本次只找到英国监管担忧的笼统报道，未找到成文细则。
4. 中文剧本格式是否存在任何行业协会层面的成文标准——现有来源只说“没有专门协会做出格式规定”，未找到反证；若要宣称“无标准”，应以该来源为准，不宜再引申。
5. 电影剧本的音乐提示是否存在行业统一格式——现有来源显示无统一强制格式（与广播剧不同），工具内需自定；若后续找到 Final Draft / Nicholl 的成文规定，应补入。
6. 短剧分镜头表的“单镜时长”在竖屏短剧中的通用值——本次只查到 90 秒一集的六段式占比（黄金钩子 0–3 秒等）与单镜 1.5–4 秒的参考，未查到各平台统一的分镜时长标准。
7. 海外短剧的命名习惯除狼人题材外是否另有成文总结——本次只从具体剧名与榜单中归纳，未找到专门论述命名习惯的文章。

---

## 6. 来源清单（2026-11-10 核实，均可点开验证）

### 专业剧本格式

1. Final Draft《How to Format a Screenplay》— https://www.finaldraft.com/learn/how-to-format-a-screenplay/
2. Final Draft《Screenwriter's Guide to Using Parentheticals》— https://www.finaldraft.com/blog/lets-talk-about-parentheticals
3. StudioBinder《Screenplay Format Mastery》— https://www.studiobinder.com/blog/brilliant-script-screenplay-format/
4. StudioBinder《How to Write a Movie Script》— https://www.studiobinder.com/blog/how-to-write-a-screenplay/
5. ScenePaper《Screenplay Format: Complete Guide》— https://scenepaper.com/blog/screenplay-format-guide
6. The LA Note《Screenplay Format Guide》— https://thelanote.com/mastering-the-art-of-screenplay-format-for-easy-reading/
7. EpicDraft《How to Format a Screenplay: The Reference Version》— https://www.epicdraft.com/blog/screenplay-format-reference
8. FilmDaft《Screenplay Format》— https://filmdaft.com/screenplay-format/
9. Wikipedia《Screenplay》（美式格式、无单一标准、Nicholl 指南）— https://en.m.wikipedia.org/wiki/Screenplays#US
10. Wikibooks《Movie Making Manual / Screenplay Format》— https://en.wikibooks.org/wiki/Movie_Making_Manual/Screenplay_Format
11. JoinSpringPro《Movie Script Format》— https://www.joinspringpro.com/guides/screenplay-format-for-film/
12. Signum Nova《Master Scene Screenwriting Guide：Dialogue》（打断 / 停顿 / 省略号）— https://www.signumnova.com/scriptwriting/index.php?chapter=dialogue
13. ScreenCraft《10 Things to Delete From Your Dialogue Scenes》（反对 (beat) 表停顿）— https://screencraft.org/blog/10-things-to-delete-from-your-dialogue-scenes-right-now/
14. Mibster《Screenwriter's Glossary》（beat 定义）— http://mibster.com/mibs/info/screenplay/
15. The Writers' Guide《Writing a screenplay》（镜头提示克制）— https://www.thewritersguide.co.uk/writing-a-screenplay
16. Fitchburg State OpenBooks《The Shot List》（景别 / 角度 / 运镜）— https://openbooks.fitchburgstate.edu/preproduction/chapter/the-shot-list/
17. StoryBirdie《How to Create a Shot List》— https://storybirdie.com/blog/how-to-create-a-shot-list-directors-guide
18. Aevon《Shot Lists and Storyboards for Indie Filmmakers》— https://www.aevon.ink/blog/shot-lists-storyboards-indie-filmmakers
19. EJ Lee《Screenwriting Standards》（音效全大写）— https://www.ejleeauthor.com/blog/screenwriting-standards-5Z9YD-wbjr3
20. EpicScribe《How to Write Sound Effects Into Audio Drama Scripts》（SFX / MUSIC 行格式属广播剧）— https://epicscribe.io/blog/writing-sound-effects-audio-drama-scripts
21. CloudRad.io《Radio drama》（BBC 广播剧格式）— https://www.cloudrad.io/blog/radio-drama
22. BBC Writersroom 模板二手转述：Literature & Latte 论坛 — https://forum.literatureandlatte.com/t/formatting-and-layout-of-finished-text/520 ；Madasafish 资源指南 — http://members.madasafish.com/~misterdisco/writersresources.htm ；Script Room 镜像页 — https://bbcinsight.pages.dev/blogs/writersroom/entries/9cf269f5-d841-48eb-b0d9-692530a9f1c8
23. 中文分场景剧本格式 — https://amber-zhang.ghost.io/fen-chang-jing-ju-ben-ge-shi/
24. 搜狐《举例说明电影剧本的格式怎么写》（文学 / 分镜头 / 完成台本三分工）— https://www.sohu.com/a/628132215_121124780
25. 百度百科《分镜头剧本》— https://baike.baidu.com/item/%E5%88%86%E9%95%9C%E5%89%A7%E6%9C%AC/4050031
26. CSDN《分镜头剧本模板》（镜号 / 景别 / 技巧 / 音乐 / 音响 / 长度）— https://blog.csdn.net/Dontla/article/details/105735904
27. 豆瓣《什么是分镜头》— https://www.douban.com/note/344893204/
28. 国产剧创作体系参考（场 / 场面、集 / 段 / 场）— https://github.com/jtydhr88/screenwriting-skills/blob/main/plugins/screenwriting/skills/sw-chinese-series-practice/reference.md

### 短剧惯例

29. Filmustage《How to Write a Vertical Drama Script in 2026》（Beat Engine、四段全季结构、付费墙）— https://filmustage.com/blog/how-to-write-a-vertical-drama-script/
30. SceneMixer《Vertical Short Drama Script Format (2026)》（集组织、字数、钩子三型、前三集）— https://scenemixer.com/guides/vertical-short-drama-script-format/
31. ScenePaper《How to Write a Vertical Micro-Drama Script》— https://scenepaper.com/blog/how-to-write-a-vertical-micro-drama-script
32. Microdrama.id《Short Drama Foundations》— https://microdrama.id/en/academy/short-drama-foundations
33. ShortDramaTop《Microdrama Writing: The Swipe Beat Structure, 2026》— https://shortdramatop.com/blog/microdrama-writing-swipe-structure-2026.html
34. DramaSo《短剧怎么做：从剧本到成片》— https://drama.so/zh/blog/how-to-make-a-short-drama
35. DramaSo《短剧剧本结构：钩子、冲突、悬念》— https://drama.so/zh/blog/short-drama-script-structure
36. ShorStory《竖屏短剧剧本格式模板：一集一页、三个标签》— https://news.shorstory.com/zh/articles/vertical-drama-script-format-template/
37. ShorStory《短剧付费卡点怎么写？第 10 集前后的结构》— https://news.shorstory.com/zh/articles/microdrama-paywall-episode-cliffhanger-guide/
38. ScreenWeaver《短剧单集结构：钩子、转折与悬念》— https://www.screenweaver.ai/zh/blog/short-drama-episode-structure
39. Some.im《竖屏短剧剧本》技能页（单集 60–120 秒、80–100 集、每 20–30 秒转折）— https://some.im/skills/niuwoai-skills-short-drama-script
40. GitHub《短剧节奏与分镜结构》（六段式 90 秒分镜）— https://github.com/someonerow-oss/ai-short-drama-prompts/blob/main/docs/01-%E7%9F%AD%E5%89%A7%E8%8A%82%E5%A5%8F%E4%B8%8E%E5%88%86%E9%95%9C%E7%BB%93%E6%9E%84.md
41. 中国作家协会主管《中国作家网》微短剧文章（竖屏基因、横屏短剧式微）— https://www.chinawriter.com.cn/n1/2026/0829/c419388-40788397.html
42. 阿里云开发者社区《短剧剧本和长剧剧本的区别》（广电定义、单集结构）— https://developer.aliyun.com/article/1767512
43. 百度开发者中心《微短剧爆款打造指南》（单集 1–3 分钟、60–100 集、拍摄周期）— https://developer.baidu.com/article/detail.html?id=9323643
44. 腾讯新闻《竖屏短剧：站在风口野蛮生长》（男频女频、爽点表现、付费卡点）— https://news.qq.com/rain/a/20240715A05FZF00
45. 海峡都市报《小心付费微短剧的“坑”》（前 10–15 集免费、按集收费）— https://hxdsb.fjdaily.com/pad/con/202405/16/content_365943.html
46. 电影界《揭秘短剧千亿市场背后的“付费卡点”与“投流点”黄金法则》— https://www.dianyingjie.com.cn/2025/1027/400121.shtml
47. 虎嗅《〈好一个乖乖女〉横屏网剧版上线》（竖屏 88 集 × 3 分钟 vs 横屏 29 集 × 15 分钟、十分剧场）— https://www.huxiu.com/article/4902474.html
48. 新浪娱乐《300 万成本，3000 万分账，央一采购，“中剧元年”来了？》（中剧 15–20 分钟、深度叙事导向）— https://ent.sina.cn/2026-07-03/detail-inifpuss2397938.d.html
49. QuestMobile《2026 短剧行业洞察报告》转载（竖屏 1–3 分钟 / 横屏 5–15 分钟 / AI 漫剧三分法）— https://www.100ec.cn/detail--6658254.html
50. TopDrama《Short Drama Glossary: 80+ Terms Explained》（NRTA 第 16 号令、9:16、付费墙、套路词表）— https://topdrama.app/guides/short-drama-glossary/

### 题材库（海外 vs 中文）与审查

51. LanternPop《Short Drama Tropes Explained》（六大套路、279 部标题词频）— https://lanternpop.com/guides/short-drama-tropes-explained/
52. Qingchuan《Chinese Short Drama Top 5 × 4 — July 2026》（榜单、地域分化、避开清单）— https://www.qingchuan.asia/rankings/2026-07/
53. VerticalDrama.tv（榜单、主导套路：CEO Romance、Werewolf Mate、Secret Baby、Mafia Romance 等）— https://www.verticaldrama.tv/
54. Episivo《DramaBox or ReelShort Which App Is Right for You?》（平台调性差异）— https://www.episivo.com/blogs/dramabox-vs-reelshort/
55. AI-Drama《12 Best Werewolf Romance Short Dramas in 2026》（狼人世界观、等级制度）— https://www.ai-drama.ai/blog/werewolf-short-dramas
56. Flicksmore《Fated to My Forbidden Alpha》（Selene / Alpha Jackson / Luna）— https://en.flicksmore.com/movie/vid-8419002-fated-to-my-forbidden-alpha.html
57. Vectree《duanju》（NRTA 出海、ReelShort / DramaBox / FlexTV 并列）— https://vectree.io/pdf/c/duanju
58. LaiTimes《Micro-short dramas have been repeatedly removed…》（出海、狼人 / 吸血鬼 / 黑手党）— https://www.laitimes.com/en/article/6b5on_6rhzi.html
59. LaiTimes《The short drama goes to sea…》（赘婿婆媳海外无感、狼人吸血鬼受欢迎）— https://www.laitimes.com/en/article/6cobw_6t0mq.html
60. Zot.News《Microdramas: the 'snackable' 90-second shows winning UK viewers》（英国监管担忧）— https://zot.news/article/microdramas-snackable-90-second-shows-winning-uk-viewers-iwp9x
61. 界面新闻《大女主短剧破亿背后，是男频编剧血泪史》（男频身份反转、女频多样化）— https://www.jiemian.com/article/12064720.html
62. 流媒体网《漫剧切入大女主赛道》（赘婿 / 战神投放、《无双》1.2 亿、女频反超）— https://lmtw.com/mzw/content/detail/id/255330
63. 流媒体网《告别“女频独大”？男频微短剧占比回升》（男女频界限模糊、题材扩容）— https://lmtw.com/mzw/content/detail/id/250135/keyword_id/-1
64. 腾讯新闻《不喜“赵钱孙李周吴郑王”，短剧主角取名为啥偏冷门？》（林叶楚江、顾傅厉等）— https://news.qq.com/rain/a/20250408A06YH100
65. 新浪《短剧高频姓氏 + 名字》（顾傅厉陆霍司 / 苏沈夏林安温姜许阮唐、苏晚等）— https://www.sina.cn/news/detail/5342734259061175.html
66. 163《暴拆 5000 部短剧，什么样的剧名最火爆？》（总裁 216 次、顾傅厉、苏小姐）— https://www.163.com/dy/article/JFOMC8V405198R91.html
67. 新浪财经《2315 部微短剧剧名分析》（归来 / 千金 / 总裁 / 夫人 / 大佬）— https://finance.sina.com.cn/jjxw/2025-02-07/doc-ineirmwh0207215.shtml
68. 新浪《总结短剧名字》（顾临川等、地点京市 / 江城 / A 市）— https://www.sina.cn/news/detail/5320628051903179.html
69. 腾讯新闻《解码千部短剧改名》（总裁神豪消失、“爱”占 11%）— https://news.qq.com/rain/a/20250120A0959B00
70. 163《第一批短剧受害者出现！》（观众画像、套路：先欺负再打脸）— https://www.163.com/dy/article/LBBQ1TR20556BXT9.html
71. 爱奇艺《短剧风云榜》（战神 / 重生 / 复仇 / 虐恋标签）— http://www.iqiyi.com/ranks1/35/2508071793676233
72. 国家广播电视总局《微短剧发展管理办法》（11 项禁区、AI 标识）— https://policy.mofcom.gov.cn/claw/clawContent.shtml?id=106656
73. 湖南省政府转载广电总局通知（分类分层审核、备案、许可证号标注）— https://www.hunan.gov.cn/zqt/zcsd/202502/t20250206_33580560.html
74. 赣县区政府转载（重点 / 普通 / 其他三类、协审题材）— https://www.ganxian.gov.cn/gxqxxgk/c111222/202502/258ec2e6256c49288620cc84f0223c39.shtml
75. 维基百科《短剧（中国大陆）》（备案时间线、片名审核、11 项禁区）— https://zh.wikipedia.org/zh-hans/%E7%9F%AD%E5%89%A7_(%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86)
76. TVOAO《“繁星指数”2024 微短剧行业年度洞察报告》（霸总专项提示、片名审核）— https://www.tvoao.com/a/220171.aspx

---

*调研方法：2026-11-10 通过 browser.search 多轮检索（中英文）+ browser.open 打开核心来源逐条核对；未打开原站或未找到来源的结论已在正文与第 5 节中标注“未查到 / 待确认”。本笔记只写调研结论，不改任何代码与现有文档。*
