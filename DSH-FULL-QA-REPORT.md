# DSH Scriptor 全链路 QA 报告

> **审计对象**：`~/workspace/dsh-scriptor-full`，分支 `muse-dev`，HEAD `d060a30`（8.4.6，已发 npm，主包 verified live）
> **审计时间**：2026-11-13 ~01:20–01:35 CST
> **审计方式**：Phase 1 代码级审计 + 本地 vitest（已完成）；Phase 2 Box 真实 Web 端到端（**待做**，见 §10）
> **角色**：QA 只查问题，不改代码、不发版、不提交。
>
> **先说总结论**：
>
> 1. **8.4.6 的主链路是通的**（建书→第一章 1914 汉字已落盘，见 DSH-8.4.6-WEB-TEST），但链路上有 **6 个 P0 级结构性缺陷**，集中在三个地方：① **Q3 字数默认仍是 100 万字**（技能文本修法在 live 模型上没生效，工具层描述仍在推 100 万字）；② **材料包是快照且无过期检测**——改了设定不起草重组装，下一章照旧用旧设定，审读指纹也看不出来；③ **跨章矛盾没有环节负责抓**——账本/记忆靠名字字符串匹配、同名即串，审读输入只有上一章尾巴 800 字 + 3 章摘要，矛盾的另一方根本不在审读输入里。
> 2. **向量/检索模块代码层面基本可用**，但有 3 个 P1（配置损坏误报、无线相似度阈值、O(n²) 缓存校验）和 10 个 P2；**未在真机上开起来验证过**（Phase 2 待做；ZeroShell 没有 embedding 模型，需在 Box 上起本地 embedding 服务）。
> 3. **工作区左栏空白**是已知问题，正在由 8.4.7 修复，本报告不重复查（见 §4 开头）。
> 4. **Phase 2 未做**：8.4.7 agent 仍在占用 Box（01:35 时仍在活动，工作区文件已有未提交修改，DSH-8.4.7-WEB-TEST.md 未落盘）。Phase 2 程序、探针设计、token 预算已全部写好（§10），等 Box 空闲即可执行。

## 审计分工与证据来源

| 分项 | 审计员 | 方法 | 结论条数 |
|---|---|---|---|
| §1 整体链路 | 链路审计 | 通读 `packages/bundle/src/index.ts`、novel-tools.ts 关键段、onboarding、settlement、export、review、gates | F1–F12（1×P0、5×P1、6×P2） |
| §2 向量/检索 | 向量审计 | 通读 `packages/core/src/retrieval/`、`packages/bundle/src/indexing/`、`packages/embedding-provider/` | P1×3、P2×10，另有已确认 OK 项 |
| §3/§5/§6 关联与一致性 | 一致性审计 | 通读 ledger、graph、assembly、review、settlement、recovery、budget | F1–F27（5×P0、10×P1、12×P2） |
| §4 UI | QA 本人 | 通读 `browser.tsx`、`onboarding.tsx`、`indexing.tsx`、`index.tsx`、`workflow-view.tsx`、`tool-result-card.tsx` | U1–U13 |
| 本地测试 | QA 本人 | `./node_modules/.bin/vitest run` 14 个文件 | **172 测试，0 失败** |

> 注：三份子审计报告的原始全文已并入本报告各节；子审计员的编号（F1–F27、P1-1 等）在本报告中保留原编号以便追溯，汇总清单（§8）按 P0/P1/P2 重新归并、去重。

---

## §1 整体链路：装插件 → 向导 → 建书 → 设计 → 细纲 → 起草 → 审读 → 定稿 → 导出

### 结论

**主链路通，但“去预设化”只做了工具层，行为指令层仍留在预设门内。** 8.4.5/8.4.6 把 novel 工具从写作预设门后解放出来（第一章已能写出），但 persona、书架总览、起草字数反馈、Q3 默认值、plugin_manager 约束等行为指令仍只在写作预设下挂载或只活在按需加载的技能文本里。结果是：standard 预设下的主 Agent **能调工具，但不知道该怎么用**——Q3 仍默认 100 万字（P0），设计确认靠模型“自称已确认”（P1），导出无代码兜底（P1）。

### 证据（逐项）

**F1（P0）Q3 预选仍是 100 万字——技能修法在 live 模型上没生效。**
- 8.4.6 的技能文本修法在 `novel-inspiration/SKILL.md:34`（“先查 `_待建书.json`”），但该技能是按需加载（`index.ts:373-382` 以 provider 挂载，`user-invocable: false`，描述门控），**没有任何机制强制模型在调 `novel_create_book` 之前先加载它**。
- 同一技能文件自相矛盾：`:37` 仍写“长篇·100万字（★推荐，默认）……作者不选默认 100万字”。
- 始终可见的工具层仍在推 100 万字：`novel-tools.ts:353, :360, :412`（工具描述 + 缺参报错重列选项，带“长篇·100万字★推荐”）。
- 执行侧其实是对的：服务端读草稿优先级是 top 参数 > concept > 向导草稿（`:401-406`）——**错在提问路径，不在执行路径**。
- 复现：8.4.6 真实 Web 测试（DSH-8.4.6-WEB-TEST）中 Q3 live 仍预选 100 万字，测试员手动改成 5 万字。
- 修法：(a) 缺参报错回显草稿值；(b) 从工具描述/报错里去掉 ★推荐/默认 100 万字；(c) 在状态总览里附上草稿值。**根因方向：把默认值和引导从按需技能文本移到始终可见的代码面。**

**F2（P1）`_待建书.json` 无书名绑定、无过期，废弃答案静默带到下一本书。**
- `onboarding-store.ts:31` 只存 {市场， 输出形态， 目标总字数， updatedAt}，无书名、无过期；unlink 失败被 `catch {}` 吞掉；读失败静默返回 {}。
- 复现（Phase 2）：向导答完不建书，另开一本，看旧答案是否被采用。

**F3（P1）plugin_manager 审批循环——仓库里唯一的“修法”是一行技能散文。**
- `novel-director/SKILL.md:238` 一行 prose 要求克制查询；无代码约束、无替代查询入口（没有任何 novel_* 工具返回插件版本/工具列表）；worker-policy allow-list 已在子代理里禁掉 plugin_manager（`worker-policy.ts:79-87`）。
- 修法：新增 `novel_get_plugin_status` 工具；文档说明宿主行为。

**F4（P1）8.4.6“任何预设都能写”只兑现了一半。**
- standard 预设主 Agent 没有 persona、没有书架总览、没有起草字数反馈（`index.ts:670, 679, 680, 684, 691, 744`；capability 仍由 `writingCapabilityOf` 只在写作预设下提供）。
- 修法：把挂载条件与工具注册对齐（与 F1 同根，宜一起修）。

**F5（P1）设计确认与提案裁决是“模型自称已确认”。**
- `novel_update_contract`（`:425-492`）、`novel_confirm_outline`（`:947-1008`）、`novel_update_skeleton`、`novel_update_volume_layout`、世界书/卷纲确认、`novel_roll_window` 均无 `askAuthor`；`state: 已确认` 只是模型传的一个字符串，写进契约.md 即成一次 `design:` 提交；`novel_resolve_proposal`（`:1696-1726`）把模型对聊天记录的解读当作批准。
- 对照：审读结论绑定是做对了的（指纹，`review/run.ts:318, 324`）；`askAuthor` 只在 3 处存在（定稿 `:855`、追认 `:1760`、书升级 `book-upgrade-tools.ts:138`）。
- 修法：快照 + askAuthor + 记录确认句 + 文件指纹进提交。

**F6（P1）导出无代码兜底。**
- 没有 `novel_export_book` 工具；导出靠技能 + 脚本 + 模型手写（`novel-export/SKILL.md:14-18`）；`computeExport`（`core/export/index.ts:116-180`）很严格（任何缺口 → fail())，但“写 + `--校验 true`”两步不由代码强制，模型可以跳过校验、只写合集、或把计划路径当作成品。
- 修法：加 `novel_export_book` 工具，内部强制校验。

**F7（P2）开章前长自查无熔断。** `novel_delegate`（`writing-delegation.ts:110-135`）直通原生 subagent，无超时、无轮次上限、无心跳；唯一刹车是 `design-commit-result.ts:87-98`（同轮重复不变设计操作），不覆盖起草。8.4.6 真实测试里 AI 开章前自查花了 14 + 18 分钟。
**F8（P2）`askAuthor` 无超时。** `arbitration/channel.ts:29-64` 只处理 `signal.aborted`；作者不答则永远挂起；单轮问答、无重问（这点是好的），但无超时。
**F9（P2）“正在写哪本书”只存在于对话里。** `novel_select_book`（`:299-350`）不持久化；刷新/新会话即丢失；索引通知发往旧 sessionId。
**F10（P2）门控注释承诺 N10，但代码无 `ask` 分支。** `decideTargetForFile`（`gates.ts:125-160`）只返回 allow/deny；书仓外的绝对路径直接放行。
**F11（P2）设计提交失败重试“一次”只在散文里。** `classifyReason`（`tool-failure.ts:88-118`）用正则匹配 reason 文本。
**F12（P2）向导保存是全有或全无（好的），但读侧不校验“哪次向导运行”。** 向导面板会话与聊天会话 `cwd` 在多工作区下可能不同 → 静默 miss。

### 已确认无问题（链路）

- 审读回写指纹、定稿防篡改（两次 captureApprovalFiles）、待定包原子性（writeBatchAtomic）、材料 ok≠ready、失败结构统一、锁有界（2s 获取、graph retryLock 10s、index retry 5/600s、reschedule>3 停止）、编辑器保存提示去重（256 上限）、孤儿扫描只读 + 经 novel_create_book 修复。
- 链路断点表（13 阶段：插件安装/工具注册、向导答案、当前书选择、设计确认、细纲、材料、起草、审读、作者裁决、定稿、导出、索引/图谱后台、书锁——每阶段的状态位置、丢失风险、死循环风险）已由链路审计交付，见子审计报告原文。

### 未读（链路）

screenplay/shortdrama 工具全文；novel-tools.ts:1726-2110；review/run.ts（除指纹外）；polish/run.ts；ledger/index.ts；drafting/context.ts；export/index.ts（除 computeExport 头部）；safeFileStem；first-book.md/workflows.md 全文。

---

## §2 向量配置：把 embeddings 开起来之后会发生什么

### 结论

**代码层面：能开，但有 3 个 P1 和 10 个 P2，全部未经真机验证。** 检索主包默认停用（配置项 `webnovel-embeddings`），嵌入、场景识别、重排三件套的管线、去重、重试、缓存逻辑基本齐全；但配置损坏会被误报、检索无相似度下限、每次打开缓存都要全表扫一遍。**Phase 2 必须在真机上开起来跑**（见 §10）；注意 **ZeroShell 没有 embedding 模型**（2026-11-13 ~01:26 查 DB：`%embed%` 0 行，channel 类型只有 1 和 60），Phase 2 需在 Box 上起本地 embedding 服务。

### 定位：`lib/retrieval.js` 的源头

`lib/retrieval.js` 是构建产物（根 `.gitignore` 含 `lib/`，不在 git 里）。源头是 `packages/embedding-provider/src/index.ts`，由 `packages/bundle/scripts/bundle.mjs:106-109` 打包。核心逻辑在 `packages/core/src/retrieval/`（search/sync/cache/source/scenes/scene-sync/state/retry/vectors/embedding）；索引在 `packages/bundle/src/indexing/manager.ts`；配置 UI 在 `packages/embedding-provider/src/client.tsx`。

### 证据（逐项）

**V-P1-1 配置损坏被误报为“未配置”或“权限问题”。**
- `search.ts:57` `getProvider()` 的错误被 `catch {}` 吞掉，`degraded` = “未启用或未配置”；`retry.ts` `indexFailure()` 丢掉原始 message，改成通用“检查读写权限”。
- 修法：错误码分级透传（配置损坏 / 未配置 / 权限 / 网络各走各的文案）。

**V-P1-2 无最小相似度阈值。**
- 语义候选只滤 `score > 0`；RRF 常数 60；无关查询也会返回 `matchedBy: semantic`。
- 修法：加可配阈值（如 0.2），低于阈值只返回关键词结果并标注。

**V-P1-3 每次 `SearchCache.open()` 都要全表 FTS 校验（O(n²)）。**
- `cache.ts:86-88` 把 chunks+terms 两表全读进内存；一次 search 打开 2–3 次，scanFinalized 读文件+SHA 2–3 次；只有单文件 16 MiB 上限（`source.ts:13`），无全书上限。
- 修法：校验改为增量（按文件指纹/生成号），或缓存校验结果。

**V-P2-1 改 baseURL 或前后缀触发全量重嵌。** revision hash 含 baseURL、documentPrefix、queryPrefix、geminiTaskMode、sendDimensions；文档没提前后缀的影响。
**V-P2-2 场景识别失败后永久钉死 fallback，模型修好后也不自动重试。**
**V-P2-3 改场景模型不重识别是 by design，但 UI 无任何提示。**
**V-P2-4 纯关键词查询也会建 SQLite 索引文件（读操作带写副作用）。**
**V-P2-5 场景输入无上限；`scene-input-too-long` 是死代码；整章作一个 JSON 发出，只有 timeoutMs（默认 60s，最大 180s）兜底；超长章可能烧几分钟才 fallback。**
**V-P2-6 关掉自动更新/禁用后残留索引仍可读，无清理入口。**
**V-P2-7 搜索结果 `index.embedded` 硬编码为 0（`search.ts:140`）。**
**V-P2-8 设置页文案与实际发送范围不一致（写“仅混合检索时发送”，后台同步也会发定稿切片）。**
**V-P2-9 场景边界只做格式校验，无合理性检查（1 章 1 场景和 1 段 1 场景都通过）。**
**V-P2-10 插件加载时 `apply()` 调 `resolveSettings` 无 try/catch；已启用但损坏的配置可能导致插件加载失败。**

### 已确认 OK（向量）

去重/增量（按内容+标题+修订版嵌入）、有界重试（maxRetries 5，退避 2s→60s，预算 600s；鉴权/格式错误不重试）、三重时新性检查（书指纹、文件 SHA、索引 generation）、git 不被污染（索引文件在书 `.webnovel/` 内，脚手架给新书加 `.gitignore` 行——**旧书需自查**）、场景缓存与向量缓存分离。

### 检索与起草/审读的接口（重要边界）

检索结果**不会自动喂给起草/审读**——唯一入口是工具 `novel_search_finalized`（`novel-tools.ts:717`），模型必须自己调；默认 limit 10、每片段最多 800 字（~8000 字/调用），无预算控制。过期保护是哈希级（文件 SHA + 指纹），不是版本级；过期内容会返回并标注“定稿定位，未经原文核对”。

### 配置表（Phase 2 配服务时用）

字段：enabled / protocol / baseURL / model / dimensions / apiKeyEnv / batchSize / timeoutMs / maxRetries / sendDimensions / prefixes（documentPrefix、queryPrefix）/ geminiTaskMode / scene / rerank。各字段必填性、配错后果、校验点见向量审计报告原文。关键两点：① 插件会校验返回向量宽度，配置的 dimensions 必须与服务实际输出一致（或按 `packages/embedding-provider/MODEL_DIMENSIONS.md` 的 18 模型表选模型名）；② 模型名不在表里时需手动填 dimensions。

### 需 Box 验证的项

V-P1-1、V-P1-2、V-P1-3、V-P2-1、V-P2-2、V-P2-5、V-P2-6、V-P2-10（验证程序见向量审计报告原文，§10 已汇总）。

---

## §3 关联：契约 ↔ 世界书 ↔ 大纲 ↔ 章节 ↔ 账本 ↔ 记忆 ↔ 检索

### 结论

**关联机制存在，但三根支柱都是字符串匹配 + 快照，改一处别处大概率感知不到。** 账本/记忆/对账靠“归一化名字”匹配（同名即串，P0）；细纲→世界书、定稿→细纲靠路径字符串（改名即悬空，P1）；起草/审读读的是材料包快照，不是活的世界书/账本（改设定后不重组装就感知不到，P0）；影响分析 `analyzeImpact` 写好了但主流程调不到（P1）；账本↔记忆之间没有任何链接（P2）。

### 关联矩阵（谁读谁 / 什么时候读 / 缓存还是文件）

| 机制 | 谁读谁 | 什么时候读 | 缓存还是文件 |
|---|---|---|---|
| 契约 | 书架扫描读契约 frontmatter 取书 id（`book/identity.ts`）；设计扫描/进度卡读全文；材料包装契约禁区与文风段 | 每次现扫/现算；材料包组装时切片 | 文件直读，无缓存 |
| 世界书 | 细纲经正则抠 `世界书/...md` 路径；材料包切片；星团全量读；`prepareEntry` 事实只增不改 | 组装材料包时；读星团时；沉淀事实追加时 | 文件直读；但起草/审读读的是材料包快照（C-F7/F8） |
| 大纲（卷纲/计划时间线/细纲） | 细纲是起草与审读的主输入；计划时间线只与账本时间线对账；卷纲经补充登记可入材料包 | 每章备料/起草/审读/对账时 | 文件直读；细纲版本只记字符串 `@版本`，无哈希校验（未确认是否验哈希） |
| 章节（草稿/待审稿/定稿） | 定稿是检索唯一来源、星团 `relatedChapters` 来源、进度推导来源；待审稿是审读输入 | 定稿时；检索后台监听更新；恢复时现扫 | 文件直读；检索有 SQLite 向量/关键词缓存（文件变则指纹变，见 `search.ts` 的 source-changed 校验） |
| 账本 | 材料包读时间线（近 20 条）与活跃条目；对账读计划时间线 vs 事实时间线；到期查询读线索；星团读全部五类 | 备料/对账/恢复/读星团时，现算 | 文件直读，无缓存；但只有定稿沉淀时才写（C-F13） |
| 记忆 | 材料包只读“文风”类（点名全文否则近 5 条）；恢复/进度卡读全量计数；选书时只读目录快照 | 备料时（仅文风）；选书/恢复时 | 文件直读；上下文里的是快照（C-F11）；索引文件按文件名链接 |
| 星团 | 读世界书 + 账本五类（显式）+ 模型抽取缓存（sqlite）；不读定稿正文，只读定稿路径引用 | 显式部分每次读图现算；抽取部分后台 worker 在 enable/update/retry/rebuild 后跑 | 显式=文件直读；抽取=`.webnovel/story-graph.sqlite` 缓存，按源哈希失效；读端另有进程内 `readerSnapshots`（≤2 个，按指纹失效） |
| 检索 | 只读 `定稿/`（`scanFinalized`），不读草稿/账本/记忆/世界书 | 后台监听 + 5s 轮询更新索引；查询时现扫快照比对指纹 | SQLite 缓存（`.webnovel/finalized-search.sqlite`）+ 向量；文件变则重扫/失效 |

### 证据（逐项，C- 前缀 = 一致性审计编号）

**C-F1（P0）账本/记忆/对账全靠“归一化名字字符串”匹配，同名即串。**
- `packages/core/src/ledger/index.ts:289` `normalizeName()` 去空白/标点/转小写；`:293` `currentEntries()` 按 `分类:normalizeName(名称)` 折叠，只保留**最后一条**；`:331` `queryLedger()`、`:385` `queryMemory()` 都用它；`:683` `reconcileLedger()` 计划与事实按 `normalizeName(名称)` 配对。
- 根因：账本条目、记忆条目没有任何稳定 id，全凭名字。两个同名人物/地点/线索（或仅标点/大小写不同的两个条目）会被折叠成一个，后写的静默覆盖先写的；对账时同名计划项与事实项即使说的不是同一件事也会判“已匹配”。
- 修法：给账本/记忆条目加稳定 id（建条目时生成，随条目走，改名不变）；`currentEntries`/对账改按 id 匹配，名字仅作显示；同名并存时在查询结果里显式告警而非折叠。

**C-F2（P1）星团节点 id 同样用名字，改名即断链且抽取结果静默丢失。**
- `packages/bundle/src/study/graph.ts:31` `readStoryGraph()`：账本节点 id 为 `ledger:<分类>:<identity(名称)>`，事件节点为 `event:<路径>:<行号>`，世界书节点为 `world:<路径>`；`packages/bundle/src/study/graph-extraction.ts:overlayExtractions()`：抽取结果与 `evidenceId`/`sourceHash`/`identityHash` 任一不符即整条跳过。
- 修法：抽取缓存按“证据内容哈希 + 实体解析”重挂而非 evidenceId 精确匹配；或给账本条目稳定 id 后节点 id 改用它。

**C-F3（P2）图谱的同名处理是 fail-closed，但只覆盖图谱，不覆盖账本。**
- `graph.ts:140-143` `resolve()`：别名解析到多个 id 或找不到时不猜，只记 warning，边不生成。同一问题在图谱层被显式拦截，在账本层（C-F1）被静默折叠，两层语义不一致。
- 修法：账本层照搬图谱做法：同名冲突时返回 `parse-error`/警告并保留全部条目，不折叠。

**C-F4（P1）细纲→世界书、定稿→细纲靠路径字符串，无改名/移动感知。**
- `packages/core/src/assembly/assemble.ts:119` `collectWorldbookRels()` 用正则 `/世界书\/[^\s@]+?\.md/g` 从细纲正文抠路径；`packages/core/src/prepare/pack.ts` 定稿 frontmatter 写 `来源细纲版本: <路径>@<版本>`；`packages/core/src/impact/index.ts` 只认 frontmatter 的 `来源引用`/`来源细纲版本` 两处字段建边（正文 `[[...]]` 不建边）。
- 世界书文件改名/移目录后，细纲里的旧路径串变成悬空引用；`assembleMaterials` 只会把该切片标“（缺失）”进 gaps，不提示“疑似改名”。`analyzeImpact` 的 D3 注释明确写“悬空引用如实报出、不猜改名”。
- 修法：补改名/移动工具（改文件 + 同步改所有引用该路径的细纲 `来源引用` 与世界书内链），或至少在 gaps 里把“缺失的世界书引用”升级为显式警告并列出候选同名文件。

**C-F5（P1）影响分析（`analyzeImpact`）存在但主流程调不到。**
- `packages/core/src/impact/index.ts:92` `buildRefGraph()`、`:238` `analyzeImpact()` 都是纯读反向闭包，现算不缓存；全仓库 grep 只有 `packages/bundle/src/scripts/impact-cli.ts` 一个调用方（CLI），没有任何 `novel_*` 工具调用它；`packages/bundle/src/study/service.ts:26` `routeForDocument()` 对大纲/世界书/契约变更的路由只是文字“设计变更：核对并报告本次修改的影响；需要下游修改时只呈报提案，等待作者决定”。
- 修法：把 `analyzeImpact` 接成 `novel_check_book`/`novel_begin_chapter` 的一部分，或在设计类工具成功提交后自动跑一次并把闭包结果写入回包。

**C-F6（P2）账本↔记忆之间没有任何链接。**
- `ledger/index.ts` 的 `queryLedger`/`queryMemory` 各自独立解析；`settlement/index.ts` 的 `planSettlement()` 里账本 ops 与记忆 ops 各自从候选文本生成，之间无交叉校验；记忆更新基线只按条目标题查。
- 修法：至少在 `novel_check_book` 的卷对账里加一项“账本/记忆同名条目内容比对”；长期应给记忆条目加 `来源账本条目` 字段。

**C-F7（P0）起草读的是材料包快照，不是活的世界书/账本；改设定后不起草重组装就感知不到。**
- `packages/drafting/src/context.ts:29` `loadDraftContext()` 只读确认细纲 + `loadMaterialPackage()`；`packages/core/src/assembly/read.ts:87` `loadMaterialPackage()` 读的是磁盘上的十段切片文件（`草稿区/材料包/.../*.md`），不是世界书/账本原文；组装只发生在手动调 `novel_assemble_materials` 时，全仓库无 watcher/自动重组装。
- 修法：`loadDraftContext` 在读包前比对切片来源文件的当前哈希（清单里补内容哈希），过期则拒绝起草并提示重组装；或起草时自动重组装。

**C-F8（P0，与 C-F7 同根，各记一条）材料包过期检测不到：基础十段没有内容哈希，`scanChapter` 永远报“未过期”。**
- `packages/core/src/assembly/read.ts:149` `materialReviewIdentity()`：无补充协议的旧包直接返回 `{标识: manifest, 问题: []}`；`packages/core/src/assembly/sections.ts` 的 `SectionRecord` 只有段名/来源/版本/选用原因/完整性/字数，**无内容哈希**；`packages/core/src/derive/scan.ts:142` 只有 `materials.问题.length > 0` 才置 `材料包状态='已过期'`。
- 修法：清单的每段加 `内容哈希`（切片文本 sha256），`materialReviewIdentity` 逐段比对；同时纳入审读指纹。

**C-F9（P1，C-F8 的审读侧）审读指纹不含材料内容，世界书/账本变了旧审读仍“有效”。**
- `packages/core/src/evidence/record.ts:95` `reviewInputFingerprintOf()` 只哈希 `{正文, 细纲, 材料清单, 方案, 章节篇幅}`，其中材料清单是 manifest JSON（无内容哈希，见 C-F8）；`packages/review/src/run.ts:reviewInput()` 的输入只有待审稿 + 确认细纲 + 材料包。
- 修法：同 C-F8，清单加段内容哈希后指纹自然覆盖。

**C-F10（P1）八维审读子代理只能看到主控粘贴的材料，漏粘即盲区。**
- `packages/bundle/skills/novel-review/SKILL.md` 派发模板：材料全部内联，子代理“没有书仓访问槽位”“材料里没有的设定不推断”“材料缺了在材料完整性里报缺项”；其中“相关设定摘要：按本章实际涉及取舍”“账本到期线索摘录：主控粘贴”——取舍权在主控，无完整性校验。
- 修法：派发前由脚本按细纲点名清单自动生成“应含材料核对表”（世界书条目/到期线索/文风条目），缺项时阻断派发而不是留空。

**C-F11（P2）本书记忆目录是选书时快照 + 会话初一次注入，会话内改记忆不刷新。**
- `packages/bundle/src/status-context.ts`：`bookMemoryCatalogText()` 注释“选书时快照；只作定位，正文不进”；`attachInitialMemoryCatalog()` 每会话只发一次作者记忆目录（`delivered` 标志 + `catalogWasDelivered` 去重）。
- 修法：记忆写工具成功后使快照失效，下次 `progressLineOf`/恢复时重读；或在记忆变更回包里带新目录行。

**C-F12（P1，触发条件未完全确认）星团显式部分每次现读，抽取部分只在显式操作后更新。**
- `packages/bundle/src/study/service.ts:186-213`：`graph()`/`graphForReader()` 每次用 `scanGraphFiles` 的文件哈希算指纹重读显式图，`readerSnapshots` 进程内缓存按指纹失效；抽取层在 `.webnovel/story-graph.sqlite`，由 `packages/bundle/src/indexing/graph-manager.ts` 的 worker 跑，触发点是 `control()` 的 build/enable/update/pause/resume/disable/retry/rebuild（需预览 token），`check()`/`refresh()` 无文件监听；`graph-manager.ts` 全文未见 `fs.watch`。
- 修法：给图谱 worker 接检索同款文件监听（`indexing/manager.ts:125` 已有 `fs.watch` + 250ms debounce + 5s 轮询可复用），或在书房保存世界书后自动使图谱进入 `queued`。

**C-F13（P0）账本/记忆只在定稿沉淀时写，且候选文本由模型手写；漏写可静默过关。**
- 唯一写入路径是 `planSettlement()`（`packages/core/src/settlement/index.ts`），由 `archiveChapter/archiveRetcon`（`packages/core/src/commit/archive.ts`）在作者批准后调用；候选来自 `novel_prepare_pack` 传入的模型文本（`packages/core/src/prepare/pack.ts:computePack()`：无候选时四段默认填“（无事实变更）/（无时间线变更）/（无账本变更）/（无记忆候选）”）；`planSettlement()` 无候选时返回 `{ok:true, ops:[], 有候选:false}`，定稿照常提交。
- 修法：`novel_prepare_pack` 增加“候选覆盖检查”：把待审稿候选事实段与账本变更候选逐条比对，候选事实未进账本/记忆的逐条列出由作者确认；或至少在无任何候选时要求作者显式确认“本章确实无沉淀”。

**C-F14（P1，按设计如此，但需明示）未定稿的章在账本/记忆里完全不存在。**
- `writeDraft`（`packages/drafting/src/write.ts`）只写草稿文件 + 草稿内候选事实段；`polish`（`packages/polish/src/run.ts`）只改草稿；`reconcileLedger()` 只读账本时间线与计划时间线。
- 设计上沉淀只发生在定稿，但“写了 5 章没定稿”时账本/记忆/星团抽取（抽取只认 `eligible` 的已沉淀证据）都看不到这 5 章，审读也只能靠 800 字尾巴 + 3 章摘要。
- 修法：文档里明示此边界；或给草稿候选事实一个“待沉淀预览”视图（只读，不入账本）。

**C-F15（P1）断更恢复从文件推导，不靠 git、不靠会话；推导错多为 fail-safe，但“已定稿”只看文件存在。**
- `packages/core/src/recovery/index.ts:listResumable()`/`rebuildResume()`：`scanChapter()`（文件存在性 + frontmatter 状态）+ `queryLedger` + `queryMemory` + `reconcileLedger()` 全是现读文件；git 只用于提交收据与健康检查；`packages/core/src/derive/scan.ts:97` `scanChapter()`：`已定稿 = 定稿文件存在`，与账本/记忆/摘要是否沉淀无关；审核记录丢了 → `审核完成=false` 回到审核环节（fail-safe 方向）。
- 修法：`已定稿` 改为“定稿文件存在 + 该章有对应的沉淀收据（archive receipt）或账本/记忆无待沉淀候选”；或在进度卡上对“有定稿文件但无沉淀记录”的章显式标出。

**C-F16（P1）关系错了没有纠正入口。**
- `novel-tools.ts` 的工具表（grep 全表）无任何图谱工具；`relationship-reader.tsx` 的“未归属证据”区只有“打开原文”按钮；显式关系来自世界书 `关系双方/主体/客体/关系` 字段与 `[[...]]` 链接，改源文件可纠；但模型抽取错的关系（`graph-extraction.ts:validateExtraction()` 只验引用原文逐字存在 + 实体消歧，不验关系语义对错）无任何覆盖/删除/否决表；`rebuild` 会重抽，但同一文本大概率抽出同一错误。
- 修法：加一张人工裁决表（`evidenceId → 接受/否决/修正为 X`），`overlayExtractions` 时先应用裁决；或至少允许在界面上把一条抽取边标“错误”并写回源证据文件。

### 未确认（关联）

① 图谱 worker 是否有除显式操作外的自动触发（`graph-manager.ts` 未见监听，需 Box 验证 C-F12）；② `来源细纲版本 @版本` 在消费时是否校验版本一致性（只见写入与影响分析读边，未见消费端校验）；③ `archiveChapter` 的 `loadOps` 在定稿包文件被改后是否重验清单哈希（未读该函数）；④ 检索后台在 DSH 重启/书未打开时是否继续更新（只读了 `manager.ts` 的监听与轮询，未读完整生命周期）。

### 未读（关联）

`packages/bundle/src/client/graph-canvas.tsx`、`graph-model.ts`（客户端）、`message-sources.ts`、`study/web.ts`、`study/editor-requests.ts`、`reference/host.ts`：只 grep，未通读。`packages/core/src/retrieval/sync.ts`、`state.ts`、`scenes.ts`、`memory/catalog.ts`、`memory/book.ts`、`derive/design.ts`、`design/contract.ts`、`commit/receipt.ts`、`commit/history.ts`：只 grep/部分读，未通读。`packages/polish/src/fidelity.ts`、`rules.ts`、`packages/bundle/src/scripts/*`（除 impact-cli 外）：未读。`novel-tools.ts`：只读了与本审计相关的工具段与 grep 命中处，未全量通读（工具总数约 30 个）。

---

## §4 UI：走一遍主要界面

### 结论

**主界面代码层面没有新的阻塞级问题（除已知左栏空白外），但有 3 个难用级问题值得先修。** 审计方法是通读客户端关键文件（`browser.tsx`、`onboarding.tsx`、`indexing.tsx`、`index.tsx`、`workflow-view.tsx`、`tool-result-card.tsx`），未在真机上逐屏点过——live UI 走查留给 Phase 2（§10）。

> **范围说明**：工作区左栏会话列表空白（插件重挂载 slot 崩溃 `useSectionScroller is not a function`）是已知问题，正在由 8.4.7 修复，**本报告不重复查、不重复列 bug**，只在 UI 清单里记一笔（U1）以便对照 8.4.7 的验证结果。

### 证据（逐项，U- 前缀 = 本报告 UI 编号）

**U1（阻塞，已知，8.4.7 在修）工作区左栏会话列表空白。**
- `browser.tsx` 的 `WorkspaceStudyTabs` 默认页签是 'study'，工作区面板 `hidden` 但 slot 仍挂载/渲染——崩溃发生在加载时，不只发生在点击时。8.4.6 真实测试截图 23/25 已复现（见 DSH-8.4.6-WEB-TEST.md）。Phase 2 需复核 8.4.7 的修复（§10）。

**U2（难用）孤儿红提示无“删除此目录”选项、无关闭，修复状态是本地组件状态，刷新即丢。**
- `browser.tsx:117` 渲染红色 `nw-error` 段落（8.4.4 遗留 `~/dsh-webtest/书房/夜单听心/` 的 3 个文件）；修复按钮点后只读「已请对话里的 AI 修复，请看对话回复」；警告只在修复成功 + 下次书架扫描后清除。用户如果只想删掉这个脏目录，没有入口；刷新页面后“已请修复”的状态提示消失，容易重复点。
- 建议：红提示加两个按钮——「删除该目录」（需二次确认）与「不再提示」；修复状态持久化到服务端/文件，而不是组件本地 state。

**U3（难用，与 §1 F1 同根）向导“一键默认”等于中文/小说/100 万字。**
- `onboarding.tsx`：“就按默认来” = 中文/小说/100万字；向导只在 `!touched` 时预填已有草稿。100 万字是产品有意设计的默认（`study/onboarding.ts`：WORD_COUNT_TIERS short 50000 / medium 300000 / long 1000000（recommended）/ epic 2000000；DEFAULT_TARGET_TOTAL_WORDS = 1000000），不是笔误——但与 8.4.6 真实测试里用户实际要的 5 万字短篇冲突最激烈。
- 建议：默认档位改为“中篇·30 万字”，或默认不选、强制点选（与“必须要问，必须要答”一致）；工具层去掉 ★推荐/默认 100 万字（见 F1 修法）。

**U4（难用）窄栏（`!wide`）只有“展开书房”一个按钮。**
- 窄窗口下工作区/书房切换只有一个展开按钮，书房内容被折叠后不易发现。建议：窄栏也保留两个页签（图标即可）。

**U5（难用）`watchError` 渲染为中性 `nw-empty`，容易错过。**
- 书房监听出错时显示为空态样式，不是错误样式。建议：出错时用红色错误样式 + 一句话原因。

**U6（难用）索引面板 + 工作流视图轮询过密，无退避。**
- `indexing.tsx` 每 1200ms 轮询 `index-status`，即使 phase 已是 'ready' 也不退避；`workflow-view.tsx` 每 750ms 轮询 `workflow`，隐藏时 3000ms，同样无退避；两者同开 ≈2 请求/秒。建议：ready/hidden 状态退避到 5–10s，或改推模式。

**U7（难用）自动更新开关只在插件偏好里，不在索引面板。**
- 用户在索引面板看到“未更新/已过期”时，想开关自动更新得去偏好页找。建议：索引面板内直接放开关。

**U8（难用）文档与代码 drift：`docs/user/ui-reference.md` 仍说写小说要选「写作模式」。**
- 与 8.4.5 的去预设化矛盾；“搜索会话…”有文档但工作区页签坏时不可达。建议：随 8.4.7 一起改文档，或在 8.4.8 里改。

**U9（难用）关系阅读器的 warning 藏在“来源诊断”折叠区，默认收起。**
- 同名/别名不唯一、引用未找到等 warning（`graph.ts:140-143` 的 fail-closed 拦截）用户默认看不到。建议：有 warning 时折叠区默认展开并标红点。

**U10（难用）星团抽取无进度/调用数预估。**
- 长书首次启用时抽取调用数随证据数线性增长（逐条串行调模型，C-F17），界面不给预估。建议：启用前给预估调用数与 token；抽取改为批量/并发（带上限）。

**U11（好看）工具结果卡片折叠视图只显示摘要第一行。**
- `tool-result-card.tsx` 的 结果/原文 tabs、事实列表、文件打开按钮、检索设置链接（attention 时）都做得干净；折叠视图信息略少。建议：折叠视图显示“结论 + 关键数字”两行。

**U12（已修，留档）插件文案“12 个技能”vs 实际 14 个。**
- 8.4.6 已修（README 与技能数 12→14）。Phase 2 复核 live 界面是否还有残留 12 的文案。

### UI 审计中确认做得好的点

- 索引面板的进度/场景/重试/错误/问题/诊断显示很全；版本行显示目标 vs 已同步 git head 哈希。
- 工作流视图标题逻辑细致；selectionCalls 上限 8；有诚实脚注“节点标记表示操作状态，不代表整个环节已完成”。
- 工具结果卡片结构干净；`index.tsx` 的 `beforeunload` 未保存缓冲守卫、窄屏（<1024px）引用动作自动关编辑器、quote 动作等细节到位；`remote.openWorkspacePath` 的 monkey-patch 带 restore-on-cleanup。

---

## §5 前后文一致性：多写几章后，AI 是否还记得前文

### 结论（Phase 1 代码审计结论，待 Phase 2 真机验证）

**按代码看：记不住是设计使然，不是偶发。** 起草上下文是“干净上下文”（`packages/drafting/src/context.ts` `loadDraftContext` 只收确认细纲 + 材料包，**不含**契约/世界书/账本/记忆/前章正文——插件规格 §5 明文如此）；审读输入是单章 + 切片（上一章尾巴 800 字 + 最近 3 章摘要 + 时间线最近 20 条 + 文风最近 5 条，`budget.ts:7-10`）；账本/记忆只在定稿时沉淀（C-F13/C-F14）。三者叠加，第 1 章埋的伏笔到第 5 章兑现时，第 1 章原文已不在任何输入里，唯一桥梁是账本到期线索（须事先入账且区间解析成功）与章摘要（须模型写进去）。

### 证据（逐项，C- 前缀 = 一致性审计编号）

**C-F18（P1）八维全是语义子代理，代码层只查两样：套话/篇幅 + 细纲硬约束字面命中。**
- `packages/review/src/checks.ts`：确定性模块只有 `文本规范检查`（套话、连续空格、空稿、篇幅）与 `设定与时序核对`（`runCanonCheck`：把细纲〔硬〕约束分类为出现/禁止/需审读，只做 `待审稿.includes(term)` 字面判断）；8 个语义模块（章节结构/人物与关系/情节与因果/信息披露/线索与伏笔/节奏与张力/读者承诺/文风与表达）`run` 为空，靠 `novel-review/SKILL.md` 派发子代理。
- 修法：至少把“账本到期线索未兑现”“人名/时间/地点与账本时间线字段不一致”做成确定性检查（字段级比对，不是语义判断）。

**C-F19（P0）审读输入只有上一章尾巴 800 字 + 最近 3 章摘要 + 卷摘要，前章伏笔大概率不在输入内。**
- `packages/core/src/assembly/budget.ts:7-10`：`上一章末尾字数: 800， 最近章摘要数: 3， 时间线最近条数: 20， 文风最近条数: 5`；`assemble.ts:338` 时间线取最后 20 条，`:375` 其余活跃条目只给一行（名 + 状态），`:444-445` 文风只取点名条目否则最近 5 条；章摘要本身是模型在 `pack.ts` 里写的（可漏伏笔）。
- 修法：审读输入加“本章相关到期/逾期线索全文 + 这些线索的埋设章摘要全文”（到期全文已有，但埋设章的上下文缺失）；或给审读一个“伏笔追溯”专用派发，输入为该线索的埋设章全文。

**C-F20（P0）后章与前章矛盾（人名/时间/地点/因果）没有环节负责抓。**
- `reconcileLedger()` 只做名字级配对（计划名 vs 事实名），不比对字段语义；`queryDueLedger()` 只看线索状态 + `预期兑现区间` 是否逾期；`runCanonCheck` 只看细纲硬约束字面；`novel-review` 各底本明确写“材料里没有的账本条目不推断”“材料缺了报缺项，不自行取料”；检索（`searchFinalized`）只检定稿、不参与审读。
- 根因：全链路没有“跨章事实一致性校验”这个确定性环节；语义审读理论上能抓，但输入里通常没有矛盾的另一方（见 C-F19），且底本要求“一切结论必须指回原文证据”——证据不在输入内就不能报。
- 修法：新增确定性“事实一致性检查”：账本时间线/世界书事实的字段（人名、时间、地点）与待审稿做字段级抽取比对（至少是名字出现 + 时点字符串比对），不一致即发现项；长远可接检索做“疑似矛盾段落”召回。

**C-F21（P2）逐章证据（graph evidence）与审读无连接。**
- `graph.ts` 的 evidence（逐条世界书/账本记录 + 行号范围）只供给关系阅读器与抽取输入（`graph-extraction.ts:extractionInput()`）；`reviewInput`/`loadMaterialPackage` 均不引用 graph evidence。
- 修法：审读材料包里对点名条目附上 graph evidence 的行号定位，便于发现项指回原文。

**C-F17（P2）星团默认关闭，且抽取逐条串行调模型，长书会很慢。**
- `packages/bundle/src/indexing/graph-storage.ts:initialGraphState()` `enabled:false`；`graph-manager.ts:run()` 对每条 eligible 证据串行 `provider.extract()`，逐条 `publish()` 写库；`graph-reader.ts` 视图分页 24/20、画布场景节点 person 模式 5 条 / all 模式 20 条、星团 8/3 个，`graph.ts` 单条 evidence preview 截 600 字。
- 修法：文档明示默认关闭；抽取改为批量/并发（带上限）；长书首次启用前给预估调用数与 token。

**最严重的叠加**：C-F7+C-F8（材料包快照 + 无过期检测，改设定后起草/审读双双用旧设定）与 C-F20（跨章矛盾无人负责抓）——两者叠加意味着：一处改错设定，既不会自动扩散到下一章，也不会在下一章被发现。

### Phase 1 已确认的事实（供 Phase 2 探针设计用）

- 起草上下文最小化是 by design：`loadDraftContext` 只收确认细纲 + 材料包。材料包（`packages/core/src/assembly/read.ts` `loadMaterialPackage`）十段基础切片：① 本章任务与确认细纲 ② 硬约束禁区完成条件 ③ 当前事实与连续性 ④ 人物、关系、地点、组织、规则、物件 ⑤ 时间位置与信息边界 ⑥ 故事线承诺线索 ⑦ 近期正文衔接 ⑧ 文风〔条目切片〕 ⑨ 暂定与警告 ⑩ 来源与版本清单；另有 supplements（带内容哈希、来源快照 domain/path/lines/read-hash、适用章节上限）。**过期检测的缺口**：只有登记了“补充”的包才有哈希/过期校验；基础十段改源文件后清单不变，`scanChapter`、`reviewInputFingerprintOf` 都看不出变化（C-F8）。
- 材料包里的补充切片过期时会被保留并打标签 + 附旧摘录——起草代理如果忽略标签，仍可能用过期事实。
- 审读检查：M0_REQUIRED_CHECKS = 文本规范检查 + 设定与时序核对；8 维注册表在 `packages/review/src/registry.ts`。
- 本地 vitest：14 个文件 172 测试 0 失败（index-panel 5/5；index-manager + graph + graph-evidence + chain-wiring + begin-chapter 59/59；worker-policy + onboarding-gate + onboarding-wizard + approval-snapshot + conversation-cards + host-loader + graph-reader + graph-index + story-graph 108/108）。

---

## §6 长篇量级：写了几万字之后会不会前后对不上

### 结论（Phase 1 代码审计结论，待 Phase 2 用合成数据 + 真书写到 3 章验证）

**按代码看：量级风险是真实存在的，且集中在“无上限 + 丢最早的 + 全量解析”三处。** 材料包无总上限（点名/到期条目全文 + 世界书整文件切片随书线性膨胀）；截断一律丢最早的（早期伏笔/人设最先被丢）；账本是单文件追加、无索引，每次查询全量解析；检索候选池上限 100/400，千章时相关片段可能排在池外；单文件 4 MiB 上限会让大世界书条目从星团静默消失。**务实的验证量级是 3 章（约 1 万字）+ 合成数据压测**，不要无节制烧 token 写几万字；外推局限见本节末尾。

### 证据（逐项，C- 前缀 = 一致性审计编号）

**C-F22（P1）材料包无总上限：点名/到期条目全文 + 世界书整文件切片随书线性膨胀。**
- `budget.ts` 头注释“体量由固定条数承担，不设段上限、不截断”；`assemble.ts`：点名条目（`:444` 前后，`namedEntries`）与到期条目（`dueFull`）全部全文入包，世界书切片（`sliceWorldbookFacts`）只滤掉未来事实、不截长度，卷摘要全文、上一卷卷摘要全文；`合计字数` 只统计不设限。
- 修法：给每段加字数上限（超限时按章号/相关度留最近的，超限部分只给索引行）；`合计字数` 超阈值时 `assembleMaterials` 显式告警。

**C-F23（P2，已确认的取舍方向）截断/取舍一律丢最早的。**
- 时间线 `slice(-20)`（`assemble.ts:338`）丢最早的；文风无点名时 `slice(-5)`（`:445`）丢最早的；章摘要最近 3 章（循环 `no = 章-3 .. 章-1`）；上一章只留末尾 800 字（`tailByParagraph`，段中不截、段首对齐）。
- 修法：时间线取舍改为“最近 20 条 + 本章点名/到期条目全文”（后者已有），并对被丢的早期条目在清单里留一行索引；文风同理。

**C-F24（P2）账本是单文件追加、无索引，每次查询全量解析。**
- `paths.ts`：每类账本一个 `.md`；`ledger/index.ts:read()` 全文 `readFileSync` + `parseEntries()` 逐行解析；`assemble.ts` 一次组装调 `queryLedger` 至少 3 次（时间线、全部、到期），`recovery/index.ts:listResumable()` 每卷重复查。
- 修法：长书达到阈值（如时间线 >500 条）时提示按卷拆账本文件，或加解析缓存（按文件哈希失效）。

**C-F25（P1）检索 top-k 会被稀释：候选池上限 100/400，语义向量全量内存比对。**
- `packages/core/src/retrieval/search.ts:40` 默认 limit 10、上限 50；`:108` `candidateLimit = max(100, limit*4)`；`:115` 关键词与语义各取前 `candidateLimit` 再融合；`:48` 重排预算上限 200；`packages/core/src/retrieval/source.ts` 切片 800 字/重叠 256（`CHUNK_VERSION='paragraph-800-overlap-256-v1'`），单定稿文件 >16 MiB 不索引；语义比对是对 `vectors` 全量 map 做余弦（无 ANN）。
- 修法：候选池按“章号邻近 + 语义”分层召回；向量查询走 SQLite 索引/分片；文档里写明千章时的召回边界。

**C-F26（P2）单文件 4 MiB 上限会让大世界书条目从星团静默消失。**
- `packages/bundle/src/study/service.ts:22, 38` 编辑器读写 4 MiB 上限；`packages/bundle/src/study/graph-source.ts:17, 41` 图谱源文件 >4 MiB 拒读；`graph.ts:scan()` 的 `catch` 把读失败记为一条 warning“该条目无法安全读取”，不阻断。
- 修法：世界书事实追加改按卷/按章拆文件，或图谱读数时对超限文件给显式“已超限、未入图”标记并在进度卡上告警。

**C-F27（P2）文档与代码基本一致，只有一处需核对。**
- `docs/user/workflows.md:53, 82` 只有两句相关原则（“先读旧条目再更新”“不要手写账本来绕过检查”），未描述账本/记忆/星团机制——未写错，但欠说明；`docs/user/reference-analysis.md` 全文无账本/记忆/星团/检索内容（该文档讲参考书拆解，与本审计范围无关，无矛盾）；`docs/user/enhanced-index.md` 的说法与代码一致：混合检索、后台更新、未配置时退回关键词（`search.ts` 的 `degraded` 分支）、改模型/维度后旧向量失效需重建（`cache.ts` 的 revision/dimensions 校验）、查询不现场重建全书向量。
- 修法：在 `workflows.md` 补一节“一致性边界”：沉淀时机、快照语义、星团默认关闭、无纠正入口。

### 验证到的量级与外推局限（Phase 1）

- **已验证的量级**：真实书《回信的人》1 章（1914 汉字）全链路跑通；本地 vitest 172 测试通过；8.4.5/8.4.6 的 Box 全量 vitest 2406 通过 / 99 失败（全是 pre-existing 的 Box git 2.43 vs 要求 2.56 的环境差异，0 新增失败）。
- **未验证的量级**：3 章以上连续写作、万字以上的材料包膨胀、百章以上账本解析耗时、千章检索召回——全部留给 Phase 2（合成数据 + 真书写 3 章，§10）。
- **外推局限**：3 章（约 1 万字）的验证只能证明“短篇量级下一致性机制是否按设计工作”，不能证明“50 万字/100 万字长篇下不丢伏笔、不串设定”。长篇的外推必须依赖合成数据压测（C-F22/C-F24/C-F25 的程序见 §10），且结论要写明是“合成数据下的表现”，不是“真书写到 100 万字的表现”。

---

## §8 Bug 清单汇总（按 P0 / P1 / P2 分级）

> 编号说明：L- = 链路审计（§1），V- = 向量审计（§2），C- = 一致性审计（§3/§5/§6），U- = UI（§4，见 §9）。“根因方向”与“修法建议”来自各子审计报告原文，本报告只做归并去重。**8.4.7 正在修的左栏空白不在此表**（已知，另案）。

### P0（6 项）—— 阻塞用户明天正常使用，或静默丢数据/用错设定

| # | 问题 | 根因方向 | 修法建议 | 证据 |
|---|---|---|---|---|
| P0-1 | Q3 字数预选仍是 100 万字；技能文本修法在 live 模型上没生效 | 引导只活在按需加载的技能文本里，模型可能永不加载；工具层描述/报错仍推 100 万字★推荐 | 缺参报错回显草稿值；工具描述/报错去掉 ★推荐/默认 100 万字；状态总览附草稿值；把默认值从技能文本移到始终可见的代码面 | §1 F1；8.4.6 真实测试已复现 |
| P0-2 | 材料包是快照，改设定后不起草重组装，下一章照旧用旧设定 | `loadDraftContext` 只读材料包切片文件，无 watcher/自动重组装 | 读包前比对来源文件当前哈希，过期则拒绝起草并提示重组装；或起草时自动重组装 | §3 C-F7 |
| P0-3 | 材料包过期检测不到：基础十段无内容哈希，`scanChapter` 永远报“未过期” | `SectionRecord` 无内容哈希；无补充协议的旧包直接返回“问题：[]” | 清单每段加内容哈希（切片文本 sha256），`materialReviewIdentity` 逐段比对；纳入审读指纹 | §3 C-F8 |
| P0-4 | 账本/记忆/对账靠归一化名字字符串匹配，同名即串、后写覆盖先写 | 条目无稳定 id，全凭名字；`currentEntries` 按 `分类:normalizeName` 折叠只留最后一条 | 条目加稳定 id（建时生成，改名不变）；匹配改按 id，名字仅显示；同名并存时显式告警不折叠 | §3 C-F1 |
| P0-5 | 账本/记忆只在定稿沉淀时写，候选由模型手写，漏写静默过关 | 唯一写入路径 `planSettlement()`；无候选时返回 ok、ops 空，定稿照常提交；无任何机制从正文自动提取事实 | `novel_prepare_pack` 加“候选覆盖检查”（待审稿候选事实 vs 账本变更候选逐条比对，漏的列出由作者确认）；或无候选时要求作者显式确认“本章确实无沉淀” | §3 C-F13 |
| P0-6 | 跨章矛盾（人名/时间/地点/因果）没有环节负责抓；审读输入里通常没有矛盾的另一方 | 全链路无“跨章事实一致性校验”确定性环节；审读输入只有上章尾巴 800 字 + 3 章摘要；语义审读要求证据在输入内才能报 | 新增确定性“事实一致性检查”（账本时间线/世界书事实字段与待审稿字段级抽取比对）；审读输入加“本章相关到期/逾期线索全文 + 埋设章摘要全文”；长远接检索做“疑似矛盾段落”召回 | §5 C-F19 + C-F20 |

### P1（21 项）

| # | 问题 | 根因方向 | 修法建议 | 证据 |
|---|---|---|---|---|
| P1-1 | `_待建书.json` 无书名绑定、无过期，废弃答案静默带到下一本书 | 只存 {市场， 形态， 字数， updatedAt}；unlink 失败被 catch 吞掉 | 加书名绑定 + 过期（如 24h）；读失败/删除失败显式报错 | §1 F2 |
| P1-2 | plugin_manager 只读查询反复触发 danger-full-access 审批 | 唯一“修法”是一行技能散文；无代码约束；无替代查询入口 | 新增 `novel_get_plugin_status` 工具；文档说明宿主行为 | §1 F3 |
| P1-3 | 8.4.6“任何预设都能写”只兑现一半：standard 预设无 persona/书架总览/起草字数反馈 | 行为指令层仍留在 `writingCapabilityOf` 预设门内 | 挂载条件与工具注册对齐（与 P0-1 同根，宜一起修） | §1 F4 |
| P1-4 | 设计确认与提案裁决是“模型自称已确认”，无 askAuthor、无指纹绑定 | `state: 已确认` 只是模型传的字符串；`novel_resolve_proposal` 把模型读聊天记录当批准 | 快照 + askAuthor + 记录确认句 + 文件指纹进提交 | §1 F5 |
| P1-5 | 导出无代码兜底，无 `novel_export_book` 工具 | 导出靠技能 + 脚本 + 模型手写；校验步骤不由代码强制 | 加 `novel_export_book` 工具，内部强制校验 | §1 F6 |
| P1-6 | 向量配置损坏被误报为“未配置”或“权限问题” | `getProvider()` 错误被 `catch {}` 吞掉；`indexFailure()` 丢原始 message | 错误码分级透传（配置损坏 / 未配置 / 权限 / 网络各走各的文案） | §2 V-P1-1 |
| P1-7 | 检索无最小相似度阈值，无关查询也返回 `matchedBy: semantic` | 语义候选只滤 `score > 0`；RRF 常数 60 | 加可配阈值（如 0.2），低于阈值只返回关键词结果并标注 | §2 V-P1-2 |
| P1-8 | 每次 `SearchCache.open()` 都全表 FTS 校验（O(n²)） | `cache.ts:86-88` 把 chunks+terms 全读进内存；一次 search 打开 2–3 次 | 校验改为增量（按文件指纹/生成号），或缓存校验结果 | §2 V-P1-3 |
| P1-9 | 星团节点 id 用名字，改名即断链，抽取结果静默丢失 | 节点 id = `ledger:<分类>:<identity(名称)>`；抽取与 evidenceId/sourceHash/identityHash 任一不符即整条跳过 | 抽取缓存按“证据内容哈希 + 实体解析”重挂；或节点 id 改用稳定 id（见 P0-4） | §3 C-F2 |
| P1-10 | 细纲→世界书、定稿→细纲靠路径字符串，改名/移动即悬空引用 | 正则抠路径；`analyzeImpact` 注释“悬空引用如实报出、不猜改名”；gaps 只标“（缺失）” | 补改名/移动工具（同步改引用）；或 gaps 里把缺失引用升级为显式警告 + 列候选同名文件 | §3 C-F4 |
| P1-11 | 影响分析 `analyzeImpact` 存在但主流程调不到 | 全仓库唯一调用方是 CLI；无 novel_* 工具调用它 | 接成 `novel_check_book`/`novel_begin_chapter` 的一部分，或设计类工具提交成功后自动跑一次写进回包 | §3 C-F5 |
| P1-12 | 审读指纹不含材料内容，世界书/账本变了旧审读仍“有效” | 指纹只哈希 manifest JSON，无内容哈希 | 同 P0-3，清单加段内容哈希后指纹自然覆盖 | §3 C-F9 |
| P1-13 | 八维审读子代理只能看到主控粘贴的材料，漏粘即盲区 | 派发模板材料全内联；取舍权在主控，无完整性校验 | 派发前由脚本按细纲点名清单自动生成“应含材料核对表”，缺项阻断派发 | §3 C-F10 |
| P1-14 | 星团显式现读，抽取只在显式操作后更新 | 抽取 worker 触发点只有 control() 的显式操作；`graph-manager.ts` 无 `fs.watch` | 接检索同款文件监听，或书房保存世界书后自动使图谱进入 `queued` | §3 C-F12 |
| P1-15 | 未定稿的章在账本/记忆里完全不存在（按设计，需明示） | 沉淀只发生在定稿；`writeDraft`/`polish` 只写草稿 | 文档明示边界；或给草稿候选事实一个“待沉淀预览”视图（只读） | §3 C-F14 |
| P1-16 | 断更恢复“已定稿”只看文件存在，与沉淀无关 | `scanChapter()`：已定稿 = 定稿文件存在 | 改为“定稿文件存在 + 有沉淀收据或无待沉淀候选”；或进度卡显式标出“有定稿文件但无沉淀记录”的章 | §3 C-F15 |
| P1-17 | 关系错了没有纠正入口 | 无图谱工具；`validateExtraction()` 只验引用原文逐字存在 + 实体消歧，不验关系语义；rebuild 大概率抽出同一错误 | 加人工裁决表（`evidenceId → 接受/否决/修正为 X`），`overlayExtractions` 时先应用裁决 | §3 C-F16 |
| P1-18 | 八维全是语义子代理，代码层只查套话/篇幅 + 细纲硬约束字面命中 | 8 个语义模块 `run` 为空，靠技能派发子代理 | 把“账本到期线索未兑现”“人名/时间/地点与账本时间线字段不一致”做成确定性检查 | §5 C-F18 |
| P1-19 | 材料包无总上限，随书线性膨胀 | `budget.ts`“不设段上限、不截断”；点名/到期条目全文 + 世界书整文件切片 | 每段加字数上限（超限留最近的，超限部分只给索引行）；`合计字数` 超阈值时显式告警 | §6 C-F22 |
| P1-20 | 检索 top-k 会被稀释：候选池上限 100/400，语义向量全量内存比对 | 无 ANN；每次查询扫全量向量 | 候选池按“章号邻近 + 语义”分层召回；向量查询走 SQLite 索引/分片；文档写明千章召回边界 | §6 C-F25 |
| P1-21 | 审读输入只有上章尾巴 800 字 + 3 章摘要，前章伏笔大概率不在输入内 | 见 P0-6（C-F19 单列为 P1，此处与 P0-6 互为表里，修法同 P0-6） | 同 P0-6 | §5 C-F19 |

### P2（28 项）

| # | 问题 | 根因方向 | 修法建议 | 证据 |
|---|---|---|---|---|
| P2-1 | 开章前长自查无熔断（8.4.6 实测 14+18 分钟） | `novel_delegate` 直通原生 subagent，无超时/轮次上限/心跳 | 加超时 + 轮次上限 + 心跳/进度回包 | §1 F7 |
| P2-2 | `askAuthor` 无超时，作者不答则永远挂起 | `arbitration/channel.ts` 只处理 `signal.aborted` | 加超时（如 10 分钟）+ 超时后回包提示 | §1 F8 |
| P2-3 | “正在写哪本书”只存在于对话里，不持久化 | `novel_select_book` 不持久化；刷新/新会话丢失 | 持久化当前书选择到工作区级状态 | §1 F9 |
| P2-4 | 门控注释承诺 N10，但 `decideTargetForFile` 无 `ask` 分支 | 只返回 allow/deny；书仓外绝对路径直接放行 | 补 `ask` 分支，仓外写操作走作者确认 | §1 F10 |
| P2-5 | 设计提交失败重试“一次”只在散文里 | `classifyReason` 用正则匹配 reason 文本 | 重试策略进代码（计数器 + 明确上限） | §1 F11 |
| P2-6 | 向导保存全有或全无（好的），但读侧不校验“哪次向导运行” | 向导面板会话与聊天会话 `cwd` 在多工作区下可能不同 | 读草稿时校验 workspace/cwd 一致性 | §1 F12 |
| P2-7 | 改 baseURL 或前后缀触发全量重嵌，文档未提 | revision hash 含 baseURL/prefixes/geminiTaskMode/sendDimensions | 文档写明；或配置变更时提示“将重嵌 N 条” | §2 V-P2-1 |
| P2-8 | 场景识别失败后永久钉死 fallback，模型修好后也不自动重试 | 失败状态无过期/重试触发 | 失败加 TTL，过期后下次查询/同步时重试 | §2 V-P2-2 |
| P2-9 | 改场景模型不重识别是 by design，但 UI 无提示 | — | UI 加提示“改模型后已有场景不重识别，需手动重建” | §2 V-P2-3 |
| P2-10 | 纯关键词查询也会建 SQLite 索引文件（读带写副作用） | 查询路径复用索引初始化 | 关键词路径延迟建库/只读打开 | §2 V-P2-4 |
| P2-11 | 场景输入无上限；`scene-input-too-long` 是死代码 | 整章作一个 JSON 发出，只有 timeoutMs 兜底 | 场景输入按字数切块/截断并告警；死代码删掉或接通 | §2 V-P2-5 |
| P2-12 | 关掉自动更新/禁用后残留索引仍可读，无清理入口 | — | 设置页加“清除索引”入口；禁用时提示残留索引仍可读 | §2 V-P2-6 |
| P2-13 | 搜索结果 `index.embedded` 硬编码为 0 | `search.ts:140` | 返回真实已嵌条数 | §2 V-P2-7 |
| P2-14 | 设置页文案与实际发送范围不一致 | 写“仅混合检索时发送”，后台同步也会发定稿切片 | 文案改实话 | §2 V-P2-8 |
| P2-15 | 场景边界只做格式校验，无合理性检查 | 1 章 1 场景和 1 段 1 场景都通过 | 加合理性告警（如单章场景数 >20 或 =1 时提示） | §2 V-P2-9 |
| P2-16 | 插件加载时 `apply()` 调 `resolveSettings` 无 try/catch | 已启用但损坏的配置可能导致插件加载失败 | 加 try/catch，损坏配置降级为未启用 + 显式报错 | §2 V-P2-10 |
| P2-17 | 图谱同名处理 fail-closed，但只覆盖图谱不覆盖账本（设计不一致） | 见 P0-4 | 账本层照搬图谱做法：同名冲突返回 parse-error/警告并保留全部条目 | §3 C-F3 |
| P2-18 | 账本↔记忆之间没有任何链接 | 各自独立解析；`planSettlement()` 两边无交叉校验 | `novel_check_book` 卷对账加“账本/记忆同名条目内容比对”；长期给记忆条目加 `来源账本条目` 字段 | §3 C-F6 |
| P2-19 | 本书记忆目录是选书时快照 + 会话初一次注入，会话内改记忆不刷新 | `attachInitialMemoryCatalog()` 每会话只发一次 | 记忆写工具成功后使快照失效，下次恢复时重读 | §3 C-F11 |
| P2-20 | 逐章证据（graph evidence）与审读无连接 | evidence 只供关系阅读器与抽取输入 | 审读材料包对点名条目附 graph evidence 行号定位 | §5 C-F21 |
| P2-21 | 星团默认关闭，且抽取逐条串行调模型，长书会很慢 | `initialGraphState()` `enabled:false`；`run()` 逐条串行 | 文档明示默认关闭；抽取批量/并发（带上限）；启用前给预估 | §5 C-F17 |
| P2-22 | 截断/取舍一律丢最早的（早期伏笔/人设最先被丢） | 时间线 `slice(-20)`、文风 `slice(-5)`、章摘要最近 3 章、上章只留末尾 800 字 | 时间线取舍改为“最近 20 条 + 本章点名/到期条目全文”，被丢的早期条目在清单留索引行 | §6 C-F23 |
| P2-23 | 账本单文件追加、无索引，每次查询全量解析 | 每类账本一个 `.md`；`read()` 全文读 + 逐行解析 | 时间线 >500 条时提示按卷拆账本，或加解析缓存（按文件哈希失效） | §6 C-F24 |
| P2-24 | 单文件 4 MiB 上限会让大世界书条目从星团静默消失 | 编辑器读写与图谱源文件 >4 MiB 拒读；`scan()` 的 catch 只记一条 warning | 世界书事实追加改按卷/按章拆文件，或超限文件给显式“已超限、未入图”标记并在进度卡告警 | §6 C-F26 |
| P2-25 | 文档缺“一致性边界”一节（沉淀时机、快照语义、星团默认关闭、无纠正入口） | `workflows.md` 只有两句原则 | 在 `workflows.md` 补一节“一致性边界” | §6 C-F27 |
| P2-26 | 孤儿红提示无“删除此目录”选项、无关闭，修复状态刷新即丢 | 见 U2 | 见 §9 U2 | §4 U2 |
| P2-27 | 索引面板 + 工作流视图轮询过密无退避（同开 ≈2 请求/秒） | 见 U6 | 见 §9 U6 | §4 U6 |
| P2-28 | `docs/user/ui-reference.md` 仍说写小说要选「写作模式」，与 8.4.5 去预设化矛盾 | 见 U8 | 随 8.4.7/8.4.8 改文档 | §4 U8 |

### 修法优先级建议（给修任务的参考，不在本报告内修）

1. **先修 P0-1 + P1-3（同根）**：把默认值/引导从按需技能文本移到始终可见的代码面——这是用户明天用起来最直接撞到的墙。
2. **再修 P0-2 + P0-3 + P1-12（同根）**：材料包段内容哈希 + 过期检测 + 审读指纹覆盖——这是“改设定不生效”与“旧审读仍有效”的总根。
3. **再修 P0-6 + P1-18（同根）**：确定性跨章事实一致性检查——这是长篇能不能用的分水岭。
4. **再修 P0-4 + P0-5**：账本/记忆稳定 id + 沉淀覆盖检查——这是数据不丢的底线。
5. 其余 P1/P2 按 §9 的 UI 排序与各节修法逐项做。

---

## §9 UI 优化清单（按影响排序：阻塞 > 难用 > 好看）

| # | 级别 | 问题（一句话） | 建议（一句话） | 证据 |
|---|---|---|---|---|
| U1 | 阻塞 | 工作区左栏会话列表空白（已知，8.4.7 在修） | 等 8.4.7 验证，Phase 2 复核（§10 步骤 c） | §4 |
| U2 | 难用 | 孤儿红提示无“删除此目录”/“不再提示”，修复状态刷新即丢 | 加删除（二次确认）与不再提示按钮；修复状态持久化 | §4 |
| U3 | 难用 | 向导“一键默认”= 中文/小说/100 万字，与用户实际要的短篇冲突最烈 | 默认档改为中篇·30 万字，或默认不选强制点选；工具层去掉 ★推荐 100 万字 | §4 |
| U4 | 难用 | 窄栏只有“展开书房”一个按钮，页签难发现 | 窄栏也保留两个页签（图标即可） | §4 |
| U5 | 难用 | `watchError` 渲染为中性空态，易错过 | 出错时用红色错误样式 + 一句话原因 | §4 |
| U6 | 难用 | 索引面板（1200ms）+ 工作流视图（750ms）轮询过密无退避，同开 ≈2 请求/秒 | ready/hidden 状态退避到 5–10s，或改推模式 | §4 |
| U7 | 难用 | 自动更新开关只在插件偏好里，不在索引面板 | 索引面板内直接放开关 | §4 |
| U8 | 难用 | `ui-reference.md` 仍说写小说要选「写作模式」，与去预设化矛盾 | 随 8.4.7/8.4.8 改文档 | §4 |
| U9 | 难用 | 关系阅读器 warning 藏在默认收起的“来源诊断”折叠区 | 有 warning 时折叠区默认展开并标红点 | §4 |
| U10 | 难用 | 星团抽取无进度/调用数预估，长书首次启用调用数线性增长 | 启用前给预估调用数与 token；抽取批量/并发（带上限） | §4 |
| U11 | 好看 | 工具结果卡片折叠视图只显示摘要第一行 | 折叠视图显示“结论 + 关键数字”两行 | §4 |
| U12 | 已修 | 插件文案“12 个技能”vs 实际 14 个（8.4.6 已修） | Phase 2 复核 live 界面是否还有残留 | §4 |

---

## §10 Phase 2 待办：Box 真实 Web 端到端（未做，等 Box 空闲）

### 前置条件（全部满足后才能开始）

1. 8.4.7 agent（499de959）已交报告，`DSH-8.4.7-WEB-TEST.md` 已落盘；或 `subagent.list` 显示它已完成。
2. Box 空闲：DSH Web + Chrome 可用，工作区 `~/dsh-webtest`，书《回信的人》（b-1c3whhe，中文/小说/50000 字），第一章 `定稿/卷01/0001-信上的今天.md`（1914 汉字）仍在。
3. 测试 token **id 146**（`dsh-846-test`，用户 5，低价组，¥5）：2026-11-13 ~01:26 查 DB 剩 1,015,898 quota（约 ¥2.03），已用 1,484,102。**预算：最多再写 2 章 + 探针，token 见底即停。** 测试全部结束后删除 token 146。
4. 截图放 `web-test-screenshots-qa/`（本报告写成时该目录尚不存在，Phase 2 新建）；Box 上点卡一律走 **CDP**（像素点击已失败 3×，不要再试）；对话全记录（用户要求：每一次对话 verbatim + 每次页面变化截图 + 每张截图一句话说明）。

### 步骤 a：向量配置真机验证

1. **起本地 embedding 服务**（ZeroShell 没有 embedding 模型，只能本地起）：Box 上跑小 ONNX 模型（如 BAAI/bge-small-zh-v1.5 384 维或 bge-base-zh-v1.5 768 维），OpenAI-compatible `/v1/embeddings`，`http://127.0.0.1:<PORT>/v1`。模型名尽量选 `packages/embedding-provider/MODEL_DIMENSIONS.md` 18 模型表里的名字，否则手动填 dimensions（插件校验返回向量宽度）。
2. 在插件偏好里配 `webnovel-embeddings`（enabled + protocol + baseURL + model + dimensions），观察：索引是否开始跑、有无报错、是否重复索引、UI 有无异常、速度是否明显变慢。
3. 查一个第 1 章出现过的细节，看检索结果对不对（top-10 里有没有、排序对不对、snippet 对不对）。
4. 场景识别：看是否正常跑（用聊天模型，token 146）；重排：大概率无 rerank 服务可配——**如实报“无法验证”，不要硬造**。
5. 逐项验证 V-P1-1（配一个损坏的配置，看报错文案是不是“未配置/权限问题”）、V-P1-2（查一个无关词，看是否返回语义结果）、V-P1-3（观察索引/查询耗时随书变大是否明显变慢）、V-P2-1（改 baseURL，看是否全量重嵌）、V-P2-2（场景识别失败后修好模型，看是否自动重试）、V-P2-5（超长章场景识别耗时）、V-P2-6（禁用后残留索引是否仍可读）、V-P2-10（配损坏的已启用配置，看插件是否加载失败）。

### 步骤 b：写第 2、3 章 + 一致性探针（核心）

1. **先读第 1 章定稿全文**，记下 3 个可探针的真实细节（人名/时间/地点各一），再设计探针——不要凭空编细节。
2. 写第 2 章（正常流程：备料→起草→审读→定稿→沉淀），约 3000 字；写第 3 章，同流程。
3. **矛盾探针**（C-F10/C-F18/C-F19/C-F20）：在第 2 章故意埋一个与第 1 章定稿矛盾的细节（例：第 1 章写“林晚左手有疤”，第 2 章写“林晚右手有疤”——以第 1 章实际文本为准），只给审读常规材料（不主动粘贴第 1 章疤的设定），走完整流程，看哪个环节报警；预期是都不报警（代码已预判），如实记录。
4. **伏笔探针**（C-F19）：第 1 章埋一个已入账、区间第 5 章的伏笔，第 3 章故意不接，看“线索与伏笔”审读是否发现“到期未兑现”；再把同一伏笔不入账重跑，看是否彻底漏网。
5. **快照探针**（C-F7/C-F8/C-F9）：改世界书某人物设定（不改细纲），直接起草第 2 章（不重组装材料包），看新草稿用的是旧设定还是新设定；再跑 `novel_check_book`/`scanChapter`，看材料包状态是否仍为“段齐备”而非“已过期”；看已完成的第 1 章审读是否仍显示完成、未提示重审。
6. **沉淀探针**（C-F13）：第 2 章写一个明确的新事实（新人物出场/新线索埋设），定稿准备时故意不写账本候选，看流程是否放行且账本里无此条。
7. **同名探针**（C-F1）：在测试书建两条同名不同内容的线索（如两个都叫“信”），看 `queryLedger`/对账是否只剩一条。
8. **定稿文件探针**（C-F15）：手动把一个未走沉淀的草稿复制为 `定稿/卷01/0002-xxx.md`，看恢复/进度卡是否直接显示该章完成且无任何告警。
9. **孤儿修复点击**（8.4.6 遗留）：第一章落盘后已可点——点书房红提示的修复入口，看 AI 是否经 novel_create_book 重建《夜单听心》，警告是否清除。

### 步骤 c：8.4.7 复核 + UI 走查

1. 插件页往返：进插件页再回工作区，左栏会话列表是否渲染、可点、能否回到运行中的任务；刷新后是否仍正常。
2. 走一遍主要界面（书房、向导、索引面板、工作流视图、关系星团、工具结果卡片），逐项复核 §9 的 U2–U12，对照 live 界面更新清单。
3. 星团：启用抽取并计时（1 章书能否跑通、耗时多少，为长篇量级提供基线）；改世界书一条关系后只刷新星团页不点更新，看抽取边是否还是旧的、是否只显示“证据待更新”（C-F12）；尝试纠正一条抽取错边，看是否存在任何入口（C-F16）；把世界书某条目改名（文件改名），重组装第 2 章材料包，看该条目切片是否变“（缺失）”且无改名提示（C-F4）。

### 步骤 d：长篇量级合成压测（不用真书写几万字）

1. 构造带 50 章摘要/200 条时间线的测试书，组装材料包，看合计字数与起草 token 消耗（C-F22）。
2. 生成含 1000 条时间线的账本，计时一次 `assembleMaterials` 与一次 `listResumable`（C-F24）。
3. 生成 200 章测试书，查一个只在第 3 章出现过的冷门细节，看是否进 top-10（C-F25）。
4. 结论写明是“合成数据下的表现”，不是“真书写到 100 万字的表现”。

### Phase 2 完成后

- 把本报告 §1–§6 中所有“待 Box 验证”的项逐项补结论 + 截图编号；§8 清单按验证结果调整分级（证实的升/降级、证伪的划掉并注明）；§9 清单按 live 界面更新。
- 在报告头部更新“Phase 2 已完成 + 日期 + 结论变化”。
- **不要改代码，不要发 npm，不要动 git 提交。** 修法另起任务。

---

## 附录 A：已确认无问题项（Phase 1）

- 链路：审读回写指纹、定稿防篡改、待定包原子性、材料 ok≠ready、失败结构统一、锁有界、编辑器保存提示去重、孤儿扫描只读 + 经 novel_create_book 修复。
- 向量：去重/增量、有界重试、三重时新性检查、git 不污染、场景缓存与向量缓存分离。
- 文档：`enhanced-index.md` 与代码一致（混合检索、后台更新、未配置退回关键词、改模型/维度后旧向量失效需重建、查询不现场重建全书向量）。
- 本地 vitest：14 个文件 172 测试 0 失败（命令：`./node_modules/.bin/vitest run <path>`；注意 pnpm filter 形式会报 "No test files found"，`--reporter=basic` 无法加载 reporter 模块——用根目录二进制直接跑）。

## 附录 B：未读代码清单（按任务要求明示）

- 链路：screenplay/shortdrama 工具全文；novel-tools.ts:1726-2110；review/run.ts（除指纹外）；polish/run.ts；ledger/index.ts；drafting/context.ts；export/index.ts（除 computeExport 头部）；safeFileStem；first-book.md/workflows.md 全文。
- 关联：`packages/bundle/src/client/graph-canvas.tsx`、`graph-model.ts`、`message-sources.ts`、`study/web.ts`、`study/editor-requests.ts`、`reference/host.ts`（只 grep，未通读）；`packages/core/src/retrieval/sync.ts`、`state.ts`、`scenes.ts`、`memory/catalog.ts`、`memory/book.ts`、`derive/design.ts`、`design/contract.ts`、`commit/receipt.ts`、`commit/history.ts`（只 grep/部分读）；`packages/polish/src/fidelity.ts`、`rules.ts`；`packages/bundle/src/scripts/*`（除 impact-cli 外）；`novel-tools.ts` 未全量通读（工具总数约 30 个）。
- 向量：见向量审计报告原文的未读清单（本报告 §2 已汇总其结论）。

## 附录 C：证据索引

| 证据 | 位置 |
|---|---|
| 8.4.4 真实 Web 测试 | `DSH-8.4.4-WEB-TEST.md`、`web-test-conversations.md`、`web-test-screenshots/`（56 张） |
| 8.4.5 真实 Web 测试 | `DSH-8.4.5-WEB-TEST.md`、`web-test-conversations-8.4.5.md`、`web-test-screenshots-8.4.5/` |
| 8.4.6 真实 Web 测试 | `DSH-8.4.6-WEB-TEST.md`（待 8.4.7 agent 补全）、`web-test-screenshots-8.4.6/`（截图 01–25，含 23/24/25 左栏空白复现） |
| 8.4.7 修复与验证 | `DSH-8.4.7-WEB-TEST.md`（**未落盘，8.4.7 agent 进行中**） |
| 本报告 QA 截图 | `web-test-screenshots-qa/`（**未建，Phase 2 用**） |
| 三份子审计报告原文 | 已并入本报告各节；子审计员编号（F1–F27、P1-1 等）在本报告中保留原编号 |
| 仓库基线 | `muse-dev`，HEAD `d060a30`（8.4.6）；8.4.7 agent 工作中有未提交修改（`browser.tsx`、`host.ts`、`workspace-slots.tsx`、`writing-delegation.ts` + 2 个测试文件），本报告未动 git |
