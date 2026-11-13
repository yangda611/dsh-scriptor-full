# DSH Scriptor 8.4.7 真机测试报告（DSH Web，Simular Box）

- **测试时间**：2026-11-13 07:55–09:20 CST（Box 时区 UTC 11-12 23:55 – 13 01:20）
- **DSH 版本**：0.2.2-rc.2（`npm install -g @deepseek-ai/dsh@next`，Node v24.21.0）
- **DSH Web**：`dsh web --no-open`（工作区 `~/dsh-webtest`），桌面 Chrome 打开带 token 的地址；点卡一律走 Chrome DevTools 协议（CDP，`/tmp/cdp.js`），像素点击不可靠
- **模型**：GPT-6 Astra（ZeroShell https://zeroshell.top/v1，低价组测试 key，token id 146）
- **插件**：`@yangda611/dsh-scriptor@8.4.7`，仅主包；Box `web` profile 已装 8.4.7（`dsh plugin --profile web list` 确认）；本地 build 产物 `.tmp/release/8.4.7/`（主包 126 文件，含 `lib/retrieval.js`，`dsh.bundle` 正确），commit b491722
- **截图**：`web-test-screenshots-8.4.7/`，共 4 张（Box 原图在 `/tmp/dsh-shots/`，720px 压缩版已入库）
- **测试 key 与 token 均未写入报告**；截图地址栏仅显示 `127.0.0.1:3080`，无 token 参数

## 结论（先说）

**8.4.7 修好了 8.4.6 的左栏空白：工作区会话列表能渲染、能点、插件页往返后还在、点会话能回到对应聊天。** 根因修复（`webnovel.workspaces` 子 slot 转发 `useSectionScroller`）在真机上生效，8.4.6 的 `TypeError: useSectionScroller is not a function` 崩溃不再出现。

| 检查项 | 结果 |
|---|---|
| 插件 8.4.7 安装并启用，版本号确认为 8.4.7 | ✅ **通过**。Plugins 详情页显示 `@yangda611/dsh-scriptor 8.4.7`（截图 02） |
| 左栏工作区会话列表渲染 | ✅ **通过**。Workspaces / dsh-webtest 下列出 4 个会话：创作小说并完成第一章正文、凌晨三点的预言顾客、深夜骑手与城市阴谋、自我介绍与模型名称（截图 02/03；DOM：`aside` innerText 119 字符含全部 4 条） |
| 无 slot 崩溃 | ✅ **通过**。DOM 中 `[data-slot-error]` 为 null；8.4.6 同位置是 `<div data-slot-error="webnovel.workspaces">` |
| 插件页往返后列表还在 | ✅ **通过**。进 Plugins 页再点回「工作区」，列表完整（4 条全在），「工作区」tab `aria-selected=true`（截图 04） |
| 点会话能回到对应聊天 | ✅ **通过**。点「凌晨三点的预言顾客」，标题变为「凌晨三点的预言顾客 — DeepSeek Harness」，主区域切到该会话（截图 05） |
| 第一章流程不受影响 | ✅ **通过**。8.4.6 已验证：第一章 1914 汉字已落盘（`回信的人/定稿/卷01/0001-信上的今天.md`）；本次未重写章节，书目与文件均在 |
| 孤儿修复点击 | ✅ **通过（带 1 个遗留）**。点「请 AI 帮我修复」后 AI 已把《夜单听心》按规范重建并迁移（新书号 b-1cgl4bp，出现在「我的作品」；卷纲/计划时间线/第一章细纲/第一章原稿/材料包「段齐备」）；**遗留：红色警告本身仍在**（孤儿源目录还在磁盘上），警告文案已更新为承认修复请求——见问题清单 |

## 修复说明（代码）

- `packages/bundle/src/client/workspace-slots.tsx`：`webnovel.workspaces` 子 slot 增加 `inject: sectionScrollerInject`，把每轮渲染的 `hookContext.useSectionScroller` 转发给重挂载的原生 `WorkspaceBrowser`；没有它重挂载的浏览器拿到 `useSectionScroller: undefined` 直接崩溃，`SlotErrorBoundary` 吞掉后左栏全空。
- 另改：`browser.tsx`、`host.ts`（`UseSectionScroller` 类型导出）、`writing-delegation.ts`；测试 `workspace-slots.spec.ts` 新增覆盖；5 个 `package.json` + CHANGELOG + 文档版本串升到 8.4.7。
- 本地验证：`workspace-slots.spec.ts` 5 测试 + `worker-policy.spec.ts` 2 测试全部通过；`pnpm check:version` + `pnpm lint` 通过；`release:build` 成功（主包 126 文件）。

## 过程备注

- 本次 8.4.7 修复 agent 在 2026-11-13 01:42 与 08:34 两次中断（运行时重启），修复代码与 Box 验证（往返、孤儿修复）已完成，收尾（报告、提交、发版）由主会话在 09:00 后亲自接手完成；中断未造成数据丢失。
- 测量插曲：往返后立即查 `aside` 有一次读到空（React 重挂载瞬间），5 秒后重查列表完整；另有一次 `querySelector('aside')` 返回 null（布局容器标签变化），以 `document.body.innerText` 为准，列表一直都在。结论以多次重查 + 截图为准，不是单次读数。
- 孤儿修复的 AI 回合耗时约 30 分钟（含多次压缩）；token 146 余额约 ¥2.03，全部测试结束后删除。

## 问题清单

- **遗留（P1）**：孤儿修复后红色警告不清除——源目录 `~/dsh-webtest/书房/夜单听心/`（3 个旧文件）仍在磁盘上，诊断每次扫描都会重新报。修法方向：修复成功后删除或归档源目录，或诊断跳过已迁移的书（以新书号 b-1cgl4bp 为准）。不阻塞 8.4.7 使用。
- 8.4.6 已知的 P1（技能 Q3 仍预选 100 万字、只读查询反复触发 danger-full-access 审批）与 QA Phase 1 的 6 个 P0（见 `DSH-FULL-QA-REPORT.md`）不在本次修复范围，修法另起任务（8.4.8）。

## 截图清单

- `02-plugin-8.4.7-detail.jpg` — Plugins 详情页 `@yangda611/dsh-scriptor 8.4.7`，左栏会话列表 4 条可见
- `03-workspace-list-fixed.jpg` — 工作区列表（同上，另一时刻）
- `04-after-roundtrip-847.jpg` — 插件页往返后，工作区列表完整
- `05-session-opened-847.jpg` — 点开「凌晨三点的预言顾客」，主区域切到该会话，左栏列表仍在
