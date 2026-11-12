# DSH Scriptor 8.4.5 真实用户测试报告（DSH Web rc.2 / Simular Box）

- **测试时间**：2026-11-12 21:57–23:01 CST（13:57–15:01 UTC）
- **测试环境**：Simular Box `main`（cb-0477cbb22c70，桌面版，2 CPU / 3.8 GiB RAM / 20 GiB 磁盘）
- **DSH 版本**：0.2.2-rc.2（`npm install -g @deepseek-ai/dsh@next`，Node v24.21.0）
- **DSH Web**：`dsh web --no-open`（工作区 `~/dsh-webtest`），桌面 Chrome 打开带 token 的地址
- **模型**：GPT-6 Astra（ZeroShell https://zeroshell.top/v1，低价组测试 key，token id 142；旧 key token 140 已换掉）
- **插件**：`@yangda611/dsh-scriptor@8.4.5`，仅主包，从本地刚 build 的 tgz 安装（`~/dsh-scriptor-full/.tmp/release/8.4.5/yangda611-dsh-scriptor-8.4.5.tgz`，126 文件，含 `lib/retrieval.js`），已启用
- **完整对话记录**：[`web-test-conversations-8.4.5.md`](./web-test-conversations-8.4.5.md)（每句话 verbatim，取自 DSH 会话文件解压）
- **截图**：`web-test-screenshots-8.4.5/`，共 5 张（清单见文末；其中 02/03/04 为测试结束时补拍，见备注）

---

## 结论（先说）

**8.4.5 修好了 8.4.4 的断链：书能建、能上架。但写第一章正文的链路断在下一步——会话里没有 `novel_delegate`，起草子代理被 AI 自己叫停，第一章至今没写出来。**

| 检查项 | 结果 |
|---|---|
| 插件 8.4.5 安装并启用，版本号确认为 8.4.5 | ✅ **通过**。Plugins 详情页显示 `v8.4.5`，开关开启 |
| novel_* 工具进入 DSH Web 会话 | ✅ **通过**。首个请求的工具列表共 77 个，其中 **46 个 novel_***（8.4.4 是 31 个、0 个 novel_*） |
| 插件技能进入会话 | ✅ **通过**。`<available_skills>` 共 19 个，其中 **14 个 novel-***（novel-inspiration / novel-design / novel-director / novel-drafting / novel-export / novel-maintenance / novel-outline / novel-polish / novel-review / novel-revision / novel-screenplay / novel-settle / novel-shortdrama / novel-analyze） |
| AI 调 `novel_create_book` 建书（不手写文件） | ✅ **通过**。会话文件里 `novel_create_book` 实际调用 1 次；通用 `write`/`edit` 调用 **0 次** |
| 书稿位置与格式正确（作品契约/契约.md） | ✅ **通过**。书在工作区根目录 `凌晨三点的便利店/`，`作品契约/契约.md` 含 `书id: b-1loqozi`、市场 中文、输出形态 小说、目标总字数 300000，并已 `git init` |
| **书出现在书房「我的作品」里** | ✅ **通过。反复刷新后仍在列，「我的作品」计数为 1**；书目显示“卷01 第0001章 第一章｜凌晨三点的客人 · 写稿” |
| P1-②：8.4.4 残留手写书稿被新诊断扫出来 | ✅ **通过**。书房显示“发现未按规范建立的书稿目录《夜单听心》（含 书籍信息.json、故事大纲.md、第一章-雨夜来客.md），缺作品契约（作品契约/契约.md），所以没出现在「我的作品」里。”＋「请 AI 帮我修复」按钮 |
| 新建书向导三题 + 保存硬门控 | ✅ **通过**（见下，有两点行为变化） |
| 第一章正文写出来 | ❌ **没有写出来。定稿/卷01/ 至今只有 `.gitkeep`** |
| 插件的建书流程走通 | ⚠️ **建书走通了，写章没走通（根因见问题清单 P0）** |

**一句话总结：8.4.5 的核心目标（书上架）达成，可以给用户用了；但“建书后接着写第一章”这条路在真实 Web 里仍然是断的，需要 8.4.6 修 `novel_delegate` 的注册。**

---

## 关键证据（都已核实，不是推测）

### 1. 首个请求的工具列表：77 个工具，46 个 novel_*

从 DSH 会话文件（`session-d84f9ca2-1948-4836-8ef6-53948109531c/session.v4.jsonl.zstd`，解压后约 2.1 MB，396 条记录）里取出的**第一个 `request/header` 下发的工具列表**：

- 总数 **77**；novel_* **46 个**：novel_apply_book_upgrade、novel_apply_retcon、novel_apply_revision、novel_apply_revision_batch、novel_assemble_materials、novel_begin_chapter、novel_check_book、novel_confirm_outline、novel_confirm_volume_outline、novel_confirm_worldbook_entry、novel_create_book、novel_editor_suggest、novel_get_book_progress、novel_get_story_status、novel_import_draft、novel_index_manage、novel_new_outline_draft、novel_note_pending、novel_prepare_pack、novel_preview_book_upgrade、novel_record_memory、novel_record_proposal、novel_record_review_findings、novel_reference_analyze、novel_reference_query、novel_reference_report、novel_reference_source、novel_resolve_proposal、novel_resume_book_upgrade、novel_roll_window、novel_screenplay_build_draft、novel_screenplay_build_outline、novel_screenplay_check_contract、novel_screenplay_render、novel_screenplay_review、novel_screenplay_validate_story、novel_search_finalized、novel_select_book、novel_settle_chapter、novel_shortdrama_check_beats、novel_shortdrama_plan_episodes、novel_shortdrama_render_episode、novel_shortdrama_review_episode、novel_update_contract、novel_update_skeleton、novel_update_volume_layout。
- 其余 31 个为 DSH 通用工具（与 8.4.4 的 31 个完全相同：ask_user_question、bash、read、write 等）。
- **唯独没有 `novel_delegate`**——这正是后文 P0 的根因。

### 2. 实际工具调用：novel_create_book ×1，全程零手写

`tool/call` 记录统计（截至收尾时）：`novel_create_book` 1 次、`novel_select_book` 1 次、`novel_update_contract` 6 次、`novel_confirm_worldbook_entry` 2 次、`novel_update_skeleton` 1 次、`novel_update_volume_layout` 1 次、`novel_confirm_volume_outline` 2 次、`novel_roll_window` 1 次、`novel_get_book_progress` 2 次、`novel_get_story_status` 1 次、`novel_begin_chapter` 1 次、`novel_new_outline_draft` 1 次、`novel_confirm_outline` 1 次、`novel_assemble_materials` 2 次；`skill` 6 次；通用 `read` 16 次；`write`/`edit` **0 次**。

### 3. 书仓结构正确

```
/home/user/dsh-webtest/凌晨三点的便利店/
├── .git/（已初始化）
├── 作品契约/契约.md   （frontmatter：书id: b-1loqozi；市场: 中文；输出形态: 小说；目标总字数: 300000）
├── 大纲/故事骨架.md、分卷布局.md、卷规划/卷01/（卷纲/计划时间线/近期窗口）
├── 世界书/模块声明.md
├── 账本/（人物弧线/承诺/时间线/线索/故事线）
├── 本书记忆/（决策/文风/灵感/对话）
├── 构想/构想快照.md
├── 草稿区/章细纲/卷01-第一章｜凌晨三点的客人.md
├── 草稿区/材料包/卷01-第一章｜凌晨三点的客人/（段齐备，14 个文件）
└── 定稿/卷01/.gitkeep（第一章正文未落盘）
```

### 4. AI 自己的根因确认（会话文件原文）

> 已确认根因：小说插件代码包含 `novel_delegate`，但当前会话工具面没有暴露它；小说导演规约明确禁止用普通 `subagent` 替代正文生产。我不会绕过该门槛代写或手写草稿，当前已完成的设计、细纲和段齐备材料均已保留。

随后 AI 发出提问卡“继续方式”：选项一“切换到写作模式后继续（推荐）——保留现有书仓状态，从第一章‘写稿’节点继续，使用专用小说委派入口”；选项二“先暂停”。我选了选项一，AI 回复“你选择切到写作模式继续……接下来我查当前安装版本如何选择活动代理预设”，随后为查 bundles 又触发审批卡，测试在此收尾（见问题清单 P0/P1）。

---

## 问题清单与修复方向

### P0 — `novel_delegate` 没有进会话，第一章正文写不出来（本次测试的头号问题）

- **现象**：建书、设计、细纲、材料包全走通了；到起草正文时，AI 说“当前工具面板没有专用 `novel_delegate` 入口”，改用隔离起草子代理，随即又自己叫停子代理（“避免在缺少专用小说委派入口时越权写稿”），子代理回执“没有产生任何文件副作用”。AI 不肯代写正文，回合卡在“等待回执”近 20 分钟，最后自查确认根因。
- **证据**：首个请求 77 个工具里 46 个 novel_*，**没有 `novel_delegate`**；而插件代码里包含它（AI 用 `read` 直接读插件文件核对后确认）；会话的技能目录里有 `novel-drafting`（其说明写着“组装自包含任务包派发起草子代理，或经 novel_import_draft 导入作者稿”），但执行层缺入口。
- **修复方向**：
  1. 8.4.5 的 scoped 注册覆盖了 46 个 novel_* 工具，却漏了 `novel_delegate`——先确认它是漏注册，还是有意按预设 gating（只在写作模式预设下注册）。若是后者，8.4.4 的根因（standard 预设下工具不注册）就只修了一半；
  2. 若 `novel_delegate` 只能在写作模式下出现，则“从书房向导进对话默认 standard 预设”的用户从向导一路走下来，到写章节点必然撞墙——要么让主 Agent 在任何预设下都能拿到它，要么在建书成功后自动提示/切换预设，而不是让 AI 在 40 分钟后才发现；
  3. 验收标准：同一剧本重测，从建书到第一章正文落盘（定稿/卷01/ 出现第一章文件）全程无人工干预、无审批卡、无子代理叫停。

### P1 — 技能三问重问向导已答过的市场/形态/字数，且 Q3 默认值与向导冲突

- **现象**：8.4.4 里 AI 读了 `_待建书.json` 就不再问三题；8.4.5 里 novel-inspiration 技能走了 3 步提问卡，第 3 步一次重问市场/形态/字数。Q1、Q2 预选值与向导一致（中文/小说），但 **Q3 预选的是“100 万字”（技能自己的★推荐），而向导保存的是 30 万字**。我手动改选了 30 万字才保住向导答案；若直接点 Submit，书会建成 100 万字。
- **修复方向**：技能第 3 步应以向导已保存的配置为预选值（读 `_待建书.json`，三项都对上），而不是用技能内置推荐值；或者三项与向导一致时直接跳过确认。验收：向导选 30 万字 → 技能三问里 Q3 预选 30 万字。

### P1 — `plugin_manager` 只读查询反复触发 danger-full-access 审批，陷入审批循环

- **现象**：AI 自查时 3 次调 `plugin_manager list_plugins` + 1 次 `list_bundles`，每次都要弹一次 “Allow this operation with danger-full-access permissions” 审批卡，我点了 4 次 Allow once，第 5 张卡出现时测试收尾。只读的 list 操作也要 danger 级审批，且每次调用都要重新批。
- **修复方向**：核对 `plugin_manager` 的权限分级——只读查询（list_plugins/list_bundles）不应要求 danger-full-access；或让一次授权覆盖同类只读调用。否则任何需要自查的会话都会卡在审批循环里。

### P2 — 向导恢复旧答案时保存按钮不是禁用态（行为说明，非缺陷）

- **现象**：向导打开时若已有 `_待建书.json`，会恢复旧答案，保存按钮直接可用（我点保存后原样重写了一遍）。删掉配置文件后重开向导，保存按钮才是 `[disabled]`，三题答完才启用。硬门控本身有效，但“恢复旧答案”与“全新未答”两种状态容易混淆。
- **修复方向**：无代码改动必要；文档里说明向导会恢复上次答案即可。

### P2 — `_待建书.json` 在建书后被消费删除

- **现象**：8.4.4 测试里该文件建书后仍保留；8.4.5 里建书后文件消失（`书房/构想/` 为空，目录 mtime 14:16，与建书时间一致）。
- **修复方向**：确认这是有意行为（向导配置一次消费）还是副作用；若有意，更新相关文档（beginner/walkthrough）说明。

### P2 — 开章入口报 Git 只读能力缺口（次要，不阻塞）

- **现象**：AI 说“开章入口已核对到章节状态，但 Git 只读能力返回环境级缺口，因此入口没有执行全仓检查，也没有阻止我继续做草稿区设计。”
- **修复方向**：核对 Web 下 Git 只读能力的来源；若只是环境缺口且不影响流程，可降级为静默记录，不必在对话里报出来。

### P2 — 附带小问题两则

- `wait_agent` 报错在界面显示：“Waiting for messages… Error: timeout_ms must be an integer from 10000 through 3600000”（AI 等子代理回执时出现）。
- AI 自查插件代码时 `grep` 报错：`grep search failed (exit 2): rg: /home/user/.npm-global/lib/node_modules/…`（Box 上无 `rg`，后改用 `read` 完成核对）。
- 插件详情页文案写“8.4.5包含12个写作与维护技能”，但会话实际暴露 14 个 novel-* 技能——文案数字与实际不一致。

---

## 本次测试中确认通过的部分（不用返工）

1. **8.4.5 的核心修复有效**：novel_* 工具与 14 个 novel-* 技能都进了 standard 预设的 Web 会话；`novel_create_book` 真实调用；书上架（8.4.4 的 P0 已解决）。
2. **P1-② 诊断有效**：书房 0 本（旧稿）时扫描到疑似书稿目录，给出完整诊断句 + 「请 AI 帮我修复」入口；新书上架后，诊断仍保留在旧稿条目下，不干扰新书显示。
3. **新建书向导的硬门控有效**：干净状态下保存按钮 `[disabled]`，三题（中文/海外；小说/短剧/电影剧本；短篇 5 万 / 中篇 30 万 / 长篇 100 万★推荐 / 超长篇 200 万 + 手动输入）全部可点选；答完后保存按钮启用；保存后 `_待建书.json` 内容为中文 / 小说 / 300000。
4. **插件介绍文案已修正**：详情页写“默认停用”（8.4.4 的 P2 已修好）。
5. **模型与网关链路正常**：ZeroShell gpt-6-astra（token 142）在 DSH Web 里全程可用。Turn 1 用时 8m 50s（Usage 368K tok）；Turn 2 用时 1m 18s（Usage 140K tok）；Turn 3 自 22:21 起持续 40 分钟以上（调查委派入口所致，非模型故障）。
6. **AI 不再手写书稿**：全程通用 `write`/`edit` 调用 0 次；被叫停的子代理经回执确认“没有产生任何文件副作用”；AI 明确拒绝绕过门槛代写正文——8.4.4 的“模型一声不吭手写文件”问题已不存在。

---

## 测试过程（简述）

1. 环境准备：Box 上 DSH Web 未在跑，先重启。插件升级遇 pnpm store 版本不匹配（node_modules 链自 v11 store，当前 pnpm 10.34.9 要用 v10）——装了 pnpm 12.18.0 后解决；`dsh plugin --profile web add <本地 8.4.5 tgz>` 成功，`pnpm approve --all` 批准技能；重启 DSH Web。
2. 模型 key：`~/.dsh/.credentials.yaml` 里 `OPENAI_API_KEY` 由 token 140 换成 token 142（base64 单条命令传入 Box），重启后生效；模型选择器显示 GPT-6 Astra。
3. 插件确认：Plugins 页详情显示 `v8.4.5`，开关开启；描述已改为“默认停用”。
4. 书房诊断：打开书房即看到夜单听心诊断 + 「请 AI 帮我修复」入口（未点，留给后续测试）。
5. 向导：删掉旧 `_待建书.json` 后重开向导验证硬门控（保存禁用），再点选中文 / 小说 / 中篇（30 万字）保存。
6. 建书对话：新会话发送便利店构想 → 技能三问（构想方向→方向多选→市场/形态/字数）→ `novel_create_book` 建书 → 设计草案审阅 → 确认后写入设计 → 细纲 + 材料包（段齐备）→ 起草被 `novel_delegate` 缺失拦住 → 子代理叫停 → AI 自查（plugin_manager 审批循环）→ 根因确认 + 提问卡 → 选“切换到写作模式后继续” → AI 查预设切换方式，测试收尾。
7. 事后取证：解压会话文件核对工具列表（77/46）、技能目录（19/14）、工具调用统计；核对书仓文件与契约 frontmatter；刷新书房确认上架。

---

## 截图清单（5 张，按时间顺序）

1. `01-desktop-restored-session.jpg` — DSH Web 重启后桌面 Chrome，恢复的上次会话「深夜骑手与城市阴谋」可见（测试开始时截取）。
2. `02-study-book-listed-and-diagnosis.jpg` — （测试结束时补拍）书房面板：我的作品计数 1，《凌晨三点的便利店》在列（卷01 第0001章 · 写稿）；下方仍有夜单听心诊断 + 「请 AI 帮我修复」。
3. `03-plugin-8.4.5-detail.jpg` — （测试结束时补拍）Plugins 详情页：`@yangda611/dsh-scriptor`，`v8.4.5`，开关开启，描述“默认停用”。
4. `04-wizard.jpg` — （测试结束时补拍）新建书向导：三题与选项齐全（向导恢复了已保存的中文/小说/30 万字答案）。
5. `05-final-state-pending-approval.jpg` — 收尾时画面：会话仍在运行，第 5 张 plugin_manager 审批卡待处理。

> 备注：测试中途的截图（向导三题、提问卡、审批卡等）当时通过浏览器截图工具实时查看，但因输出经管道过滤，只有上述 5 张落盘为文件；中途各步的证据以浏览器无障碍树快照文本 + 会话文件原文为准，均已写入本报告与对话记录。

---

## 备注

- **测试用 ZeroShell token（id 142，用户 5，低价组，¥5）仍有效，需删除**——请主代理处理，key 不写入本报告。
- 本次测试**没有修改任何插件代码**，只做测试、取证与报告；但为装插件在 Box 上全局安装了 pnpm 12.18.0（测试环境变更）。
- DSH Web 的 token、ZeroShell 测试 key 均未写入报告与对话记录；截图地址栏仅显示 `127.0.0.1:3080`，无 token 参数。
- 两个待用户决策的文档问题仍 open（与本次测试无关）：`walkthrough-film-drama.md` 仍描述旧的两问流程；`beginner.md` §7 与 walkthrough 对默认导出文件的说法不一致。
