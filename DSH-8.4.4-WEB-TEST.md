# DSH Scriptor 8.4.4 真实用户测试报告（DSH Web rc.2 / Simular Box）

- **测试时间**：2026-11-12 12:36–13:01 UTC（北京时间 20:36–21:01）
- **测试环境**：Simular Box `main`（cb-0477cbb22c70，桌面版，2 CPU / 3.8 GiB RAM / 20 GiB 磁盘）
- **DSH 版本**：0.2.2-rc.2（`npm install -g @deepseek-ai/dsh@next`，Node v24.21.0，pnpm 12.18.0）
- **DSH Web**：`dsh --profile web --no-open --port 3080`，桌面 Chrome 打开带 token 的地址
- **模型**：GPT-6 Astra（ZeroShell https://zeroshell.top/v1，低价组测试 key；插件、模型配置均已验证可用）
- **插件**：`@yangda611/dsh-scriptor@8.4.4`，仅主包，从 npm 安装，已启用
- **完整对话记录**：[`web-test-conversations.md`](./web-test-conversations.md)（每句话 verbatim，取自 DSH 会话文件解压）
- **截图**：`web-test-screenshots/`，共 56 张，按时间顺序编号（清单见文末）

---

## 结论（先说）

**8.4.4 在真实 DSH rc.2 Web 环境里只能算“半可用”：向导和书房面板修好了，但建书的端到端链路是断的。**

| 检查项 | 结果 |
|---|---|
| rc.2 `runtime.agents.roots is not a function` 红错 | ✅ **不报了**。书房面板正常打开，全程无此报错（8.4.4 的 roots 兼容修复有效） |
| 新建书向导问市场 / 输出形态 / 字数三个问题 | ✅ **都问了**。三个问题全部是可点选的选项，保存按钮在三题答完前是禁用的（硬门控有效） |
| 向导答案被建书流程采用 | ✅ **采用了**。AI 读了向导保存的配置（中文 / 小说 / 30 万字），建书时没有重问 |
| AI 写出书稿内容 | ✅ **写出来了**。`书籍信息.json`、`故事大纲.md`、第一章《雨夜来客》（约 2,800 字），内容真实连贯 |
| **书出现在书房「我的作品」里** | ❌ **没有。反复刷新仍为 0 本** |
| 插件的建书流程走通 | ❌ **没有走通（根因，见下）** |

**一句话根因：插件的 Agent 工具和技能根本没有进到这个 DSH Web 会话里。** AI 看不到 `novel_create_book`，只能用通用文件工具自己手写书稿，写出来的东西书房识别不了。

---

## 关键证据（都已核实，不是推测）

### 1. 会话里根本没有插件的工具

从 DSH 会话文件（`session-41e52828…/session.v4.jsonl.zstd`，解压后 350,497 字符）里取出的**本次请求实际下发的工具列表，共 31 个**：

ask_user_question、bash、create_goal、edit、get_goal、glob、grep、job_kill、job_list、job_output、list_agents、list_subagent_models、plugin_manager、present、read、read_image、schedule_create、schedule_edit、schedule_list、schedule_view、send_message、skill、subagent、subagent_fork、todo_write、update_goal、wait_agent、web_fetch、workflow、working_directory、write。

**没有一个 `novel_*` 工具。** 全会话文件里 `novel_`、`webnovel`、`dsh-scriptor` 出现次数都是 **0**。

### 2. 会话的技能目录里也没有插件的技能

下发给模型的 `<available_skills>` 只有 5 个：`dsh-doc`、`office`、`office-docx`、`office-pptx`、`office-xlsx`。**没有 `novel-inspiration` / `novel-design` / `novel-screenplay` / `novel-shortdrama` 等任何一个插件技能。** AI 在第二轮只加载了 `dsh-doc`（查 DSH 自身文档），第一轮连技能都没调。

### 3. AI 的实际行为：绕过插件，自己手写文件

会话记录的工具调用统计：`novel_create_book` **0 次**，`Write` 6 次，`Read` 67 次，`Glob` 1 次，`Bash` 1 次。AI 直接用 `Write` 写了三个文件：

```
/home/user/dsh-webtest/书房/夜单听心/书籍信息.json   （964 字节，后改为 1041 字节）
/home/user/dsh-webtest/书房/夜单听心/故事大纲.md     （3,827 字节）
/home/user/dsh-webtest/书房/夜单听心/第一章-雨夜来客.md（7,980 字节）
```

### 4. 为什么这样写出来的书上不了架（代码侧核对）

书房识别一本书的唯一标准在 `packages/core/src/book/identity.ts` 的 `scanWorkspaceBooks`：**工作范围根目录下的一级子目录里必须有 `作品契约/契约.md`**（含 `书id` frontmatter）。而 AI 写出来的东西两点都不满足：

- **位置错**：写在 `书房/夜单听心/`（书房是共享资料保留目录，`createBook` 明确拒绝以“书房”为书名；扫描只看工作范围根下的一级子目录，不会钻进 `书房/` 里找书）；
- **文件错**：没有 `作品契约/契约.md`，没有 `书id`，没有 git 初始化——AI 自创了 `书籍信息.json` 这个插件根本不认的 schema。

正确流程本应是 `novel_create_book` → `createBook`，在 `<工作范围>/<书名>/` 下生成脚手架（含 `作品契约/契约.md` + `书id` + git init），扫描即可发现。

### 5. AI 自己尝试的“上架修复”无效（已验证）

我追问后，AI 在 `书籍信息.json` 里加了 `"上架状态": "已上架"` 和 `"上架时间": "2026-11-12T12:56:53.000Z"`，并坦承“无法确认书房界面实际读取的字段是否就是这个上架标记”。随后我两次点「刷新书房」，**「我的作品」仍为 0 本**（截图 46、56）。这个字段没有任何代码读取它，是 AI 的猜测。

### 6. 附带：AI 自身的校验步骤也失败了（次要）

建书回合里 AI 跑了两次 Bash 校验：检查书稿变更 exit code **128**（工作区不是 Git 仓库——因为没走 `createBook`，而 `createBook` 会做 `git init`）；另一次元数据校验 exit code **127**（命令未找到）。这两处是 AI 自选的校验方式失败，不是插件报错，但 128 那个是绕过建书工具的连带后果。

---

## 问题清单与修复方向

### P0 — 插件的工具/技能没有注册进 DSH Web 会话（本次测试的头号问题）

- **现象**：插件已安装、已启用，书房面板和向导都正常，但 Agent 会话的工具列表（31 个）和技能目录（5 个）里完全没有插件的东西。
- **插件侧的注册路径**（`packages/bundle/src/index.ts`）：Cordis 步骤 `webnovel:tools-register` 等 `tools` + `userQuestions` 服务就绪后建 kit，对主 Agent 调 `registerToolsInto`（经 `isMainAgent` 判断，再经 agent scope 的 `tools.register` 注册）。`isMainAgent` 走 `runtime.agents.roots()`（8.4.4 已做函数/数组兼容）+ origin 回退。
- **修复方向**（按排查顺序）：
  1. 确认在 DSH Web 下 `tools` / `userQuestions` 服务是否到达 `webnovel:tools-register`——若 Web 下这两个服务名/时机与桌面不同，步骤会一直 pending，工具永远注不进去；
  2. 确认 Web 会话的 agent 是否被 `isMainAgent` 判定为主 Agent（roots 为空且 origin 不是主会话时会判否）；
  3. 确认 agent scope 的 `tools.register` 在 Web 下存在且可用；
  4. 注意 bundle 依赖的是 `@deepseek-ai/dsh-tools 0.2.2-rc.1`，而 DSH 已是 rc.2——像 `agents.roots` 一样，tools 注册 API 也可能在 rc.2 变了，需要按 rc.2 的实际 API 核对；
  5. DSH Web 的插件日志目前没有落到可读的文件里（`/tmp/dsh-web.log` 只有启动行），排障时先解决日志可见性，否则只能黑盒猜。
- **验收标准**：在 DSH Web 里新建会话，下发的工具列表中出现 `novel_create_book` 等插件工具，技能目录中出现插件技能；随后按本次测试的同一剧本重测，书应出现在「我的作品」里。

### P1 — 即使工具注册修好，也要防住“模型不用工具”的情况

- **现象**：本次模型在没有工具时一声不吭地手写文件，还自信地汇报“已建立小说”。它没有说“我没有建书工具”。
- **修复方向**：在技能/工具描述里写死——建书**必须**调 `novel_create_book`，禁止手写书稿文件；`novel_create_book` 的前置说明里强调书的位置与契约文件是书房识别的唯一依据；考虑在 study 面板侧加一道校验：若 `书房/` 下出现非契约结构的书稿目录，给出明确提示而不是静默 0 本。

### P1 — “我的作品 0 本”时用户得不到任何诊断

- **现象**：书房明明在文件树里能看到 `夜单听心` 目录，但「我的作品」只显示“当前工作范围还没有作品”，不解释为什么。
- **修复方向**：书房面板在 0 本时，若扫描到疑似书稿目录（如含 `书籍信息.json` / 章节 md 但缺 `作品契约/契约.md`），提示“发现未按规范建立的书稿目录，缺作品契约”，并给出修复入口（而不是让用户去对话里追问）。

### P2 — 插件介绍文案与实际默认不一致

- **现象**：安装成功页写着“Webnovel Writer：DSH 长篇网文写作工作台（含检索增强：嵌入、场景识别与重排，**默认启用**）”，但 8.4.4 的设计是检索默认**关闭**。
- **修复方向**：把 `package.json` 的 description 改成与实际一致（默认关闭/需手动开启）。

### P2 — 向导里“目标总字数”手动输入的 spinbutton 初始值

- **现象**（小）：Q3 的“自己有想法，手动输入”展开后 spinbutton 显示的默认值需要用户自己改，测试中未深究。
- **修复方向**：复核手动输入框的默认值/单位（万字）是否与选项一致。

---

## 本次测试中确认通过的部分（不用返工）

1. **rc.2 兼容修复有效**：`agents.roots` 不再是函数的问题已解决，书房面板全程打开正常，无红错。`index.ts:324` 的 `isMainAgent` 回退逻辑与 `web.ts` 的 roots 处理均未触发报错。
2. **新建书向导的硬门控有效**：市场（中文/海外）、输出形态（小说/短剧/电影剧本）、字数（短篇 5 万 / 中篇 30 万 / 长篇 100 万★推荐 / 超长篇 200 万 + 手动输入）三个问题全部可点选；三题答完前「保存，去对话里继续」是禁用的；答完后保存成功，面板提示“已保存：中文 / 小说 / 目标 30 万字。去对话里聊构想，建书时会自动用你选的，不用再问。”
3. **向导答案确实被采用**：AI 读了 `书房/构想/_待建书.json`，按中文/小说/30 万字建书，没有重问三个问题；落盘的 `书籍信息.json` 里市场、输出形态、目标总字数（300000）与向导选择一致。
4. **模型与网关链路正常**：ZeroShell gpt-6-astra 在 DSH Web 里全程可用。会话 1 自我介绍 12 秒回包；会话 2 两轮累计 361K tok（第一轮结束时 195K，第二轮约 166K），无模型报错。
5. **书稿内容质量尚可**：大纲与第一章是真实连贯的创作（主角陈渡，29 岁夜班骑手；核心设定为送单途中听见收件人最不愿说出口的一句话；第一章《雨夜来客》开篇“凌晨一点十七分，临江路的雨下得像有人在楼顶拆水管”），不是模板占位。

---

## 测试过程（简述）

1. Box 上 Node v24.21.0 已装；DSH `0.2.2-rc.2` 经 `npm install -g @deepseek-ai/dsh@next` 装好（`latest` 是 rc.1，`next` 才是 rc.2）；pnpm 起初缺失导致插件安装报 `spawn pnpm ENOENT`，装好 pnpm 12.18.0 后重试成功。
2. DSH Web 以 `dsh --profile web --no-open --port 3080` 后台运行；MCP `browser_navigate` 带 token 也打不开（始终报 `dsh web authentication required`），改走桌面 Chrome + `desk` 工具操作。
3. 模型配置：Settings → Models → Add provider（openai）→ API key（ZeroShell 测试 key）→ Base URL `https://zeroshell.top/v1` → Fetch available models 成功 → 选 GPT-6 Astra（DSH 内显示名 “GPT-6 Astra”，搜 `gpt-6-astra` 无结果，搜 `astra` 才找到）。
4. 插件安装：Plugins → Add plugin → `@yangda611/dsh-scriptor@8.4.4` → Installed → Enable now，侧栏出现「展开书房」。
5. 向导：书房 → ＋新建书 → 点选 中文 → 小说 → 中篇（30 万字）→ 保存 → 去对话建书。
6. 建书对话：发送骑手听心声的构想 → AI 写出大纲与第一章 → 追问上架 → AI 加“上架状态”字段 → 两次刷新书房仍为 0 本。
7. 事后取证：解压 DSH 会话文件核对工具列表、技能目录与工具调用；对照插件源码（`identity.ts` / `create.ts` / `index.ts`）确认书房识别规则与注册路径。

---

## 截图清单（56 张，按时间顺序）

1. `01-dsh-home-after-preview.webp` — DSH Web 首页，工作区列表为空，尚未配置模型。
2. `02-add-api-key-dialog.webp` — 点击添加 API Key 弹出的对话框。
3. `03-main-ui-no-model.webp` — 主界面，未选模型时的空白会话页。
4. `04-account-menu.webp` — 左下角账号菜单展开。
5. `05-settings.webp` — Settings 设置页。
6. `06-models-settings.webp` — Settings → Models，模型提供商列表。
7. `07-add-provider.webp` — 点击 “+ Add model provider” 后的提供商选择。
8. `08-provider-openai.webp` — 新增 openai 提供商的表单。
9. `09-customized-settings.webp` — 展开 Customized settings，填 Base URL。
10. `10-provider-filled.webp` — 提供商表单已填好 key 与 Base URL。
11. `11-fetch-models.webp` — 点击 “Fetch available models” 后模型列表加载中。
12. `12-search-gpt-6-astra.webp` — 在模型列表里搜 `gpt-6-astra`。
13. `13-models-updated.webp` — 模型列表已更新，GPT-6 Astra 被勾选。
14. `14-provider-applied.webp` — 点 Apply 后提示 “Saved openai.”，提供商显示绿点。
15. `15-settings-closed.webp` — 关闭设置回到主界面。
16. `16-choose-workspace.webp` — 选择工作区对话框。
17. `17-new-folder.webp` — 新建文件夹输入框。
18. `18-workspace-created.webp` — 工作区 `dsh-webtest` 已创建。
19. `19-workspace-open.webp` — 工作区打开后的主界面。
20. `20-select-model.webp` — 会话底部点选模型。
21. `21-model-search.webp` — 搜 `gpt-6-astra` 显示 “No matching models”。
22. `22-model-search-astra.webp` — 改搜 `astra`，找到 “GPT-6 Astra”。
23. `23-model-selected.webp` — 模型已选为 GPT-6 Astra Default。
24. `24-test-message-typed.webp` — 自我介绍测试消息已输入待发送。
25. `25-model-reply.webp` — 模型正在回复测试消息。
26. `26-model-reply-done.webp` — 模型回复完成：“我是 Codex，一名基于 GPT-6-Astra 模型的编程助手。”。
27. `27-plugins-page.webp` — Plugins 页面。
28. `28-add-plugin-dialog.webp` — “+ Add plugin” 对话框。
29. `29-plugin-name-typed.webp` — 输入 `@yangda611/dsh-scriptor@8.4.4`。
30. `30-plugin-installing.webp` — 首次安装失败：`spawn pnpm ENOENT`（Box 上缺 pnpm）。
31. `31-plugin-install-retry.webp` — 装好 pnpm 后重试，显示 Installed，版本 8.4.4。
32. `32-plugin-enabled.webp` — 点 “Enable now” 后插件列在 Installed plugins 且开关开启。
33. `33-study-opened.webp` — 点「展开书房」，书房面板打开，无 roots 报错，显示“我的作品 0”。
34. `34-new-book-clicked.webp` — 点「＋新建书」，新建书向导弹出，显示 Q1 市场选项。
35. `35-wizard-market-zh.webp` — 向导 Q1 已点选「中文」。
36. `36-wizard-all-three.webp` — 向导三题已全部点选（中文 / 小说 / 中篇），保存按钮变为可用。
37. `37-wizard-saved.webp` — 点保存后提示“已保存：中文 / 小说 / 目标 30 万字”。
38. `38-wizard-dismissed.webp` — 点「知道了」关闭向导提示。
39. `39-new-session.webp` — 新建会话，准备输入建书构想。
40. `40-book-idea-typed.webp` — 建书构想已输入待发送。
41. `41-ai-first-reply.webp` — AI 首次回复：读到待建书配置，按中文小说 30 万字建书。
42. `42-ai-working.webp` — AI 正在写：已建立书籍信息与故事大纲。
43. `43-ai-writing-ch1.webp` — AI 正在写第一章《雨夜来客》。
44. `44-ai-ch1-done.webp` — 第一章写完，AI 做收尾校验，Bash 报错 exit 128/127 可见。
45. `45-ai-final-reply.webp` — AI 最终回复：Edited 3 files（+227），To-Dos 4 completed，Usage 195K tok。
46. `46-study-refresh.webp` — 点「刷新书房」后，「我的作品」仍为 0。
47. `47-ai-reply-top.webp` — 点开 Review 面板，看 `书籍信息.json` 的 diff 内容（书名/类型/市场/形态/字数均正确）。
48. `48-followup-typed.webp` — 尝试输入追问消息，未成功落进输入框（输入框仍为空，右侧为故事大纲 diff）。
49. `49-followup-typed.webp` — 再次确认输入框仍为空（与 48 相同画面，桌面焦点问题排查中）。
50. `50-input-focus.webp` — 重新点击输入框确认焦点（画面与 49 相同）。
51. `51-followup-typed2.webp` — 追问消息成功进入输入框：“书建好了，但我在书房的「我的作品」里看不到这本书，还是显示 0 本……”。
52. `52-followup-sent.webp` — 追问已发送，AI 开始工作：检查书房登记规则，Grep“我的作品上架性判断”，加载 dsh-doc 技能。
53. `53-followup-working.webp` — AI 回复可见：已加“上架时间”，“元数据格式已验证通过”，但坦承无法确认书房是否读这个字段。
54. `54-followup-done.webp` — AI 回复完成（内容与 53 相同，时钟 13:00）。
55. `55-study-refresh-2.webp` — 再次点「刷新书房」后的画面。
56. `56-study-still-zero.webp` — 最终状态：书房面板展开，「我的作品」仍为 0，“当前工作范围还没有作品。”。

---

## 备注

- **测试用 ZeroShell token（id 140，`dsh-webtest`，用户 5，低价组，¥5）仍有效，需删除**——请主代理处理，key 不写入本报告。
- 本次测试**没有修改任何插件代码**，只做测试、取证与报告。
- DSH Web 的 token、ZeroShell 测试 key 均未写入报告与截图以外的文件；截图中的 token 已打码（地址栏 token 参数）。
- 两个待用户决策的文档问题仍 open（与本次测试无关）：`walkthrough-film-drama.md` 仍描述旧的两问流程；`beginner.md` §7 与 walkthrough 对默认导出文件的说法不一致。
