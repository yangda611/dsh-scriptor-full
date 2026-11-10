# 二开说明（Fork Notes）

本仓库是 `lingfengQAQ/webnovel-writer` 的二次开发副本，基线为上游标签 `scriptor-v8.4.0`（commit `aeac95cb95`），即 npm 包 `@linfengqaqtat/dsh-scriptor-full@8.4.0` 的完整源码。

- 上游仓库：<https://github.com/lingfengQAQ/webnovel-writer>
- 本仓库保留 `upstream` remote；同步上游新版本：`git fetch upstream --tags`，再 `git merge scriptor-vX.Y.Z`（或 rebase 到你的开发分支）
- 本机 Git 若报 `schannel: AcquireCredentialsHandle failed`，本仓库已配置 `http.sslBackend=openssl` 绕过

## 包结构对应（npm ↔ 本仓库）

| npm 包 | 仓库目录 | 说明 |
|---|---|---|
| `@linfengqaqtat/dsh-scriptor-full` | `packages/meta` | 完整版元包（组合安装入口） |
| `@linfengqaqtat/dsh-scriptor` | `packages/bundle` | 写作工作台主插件 |
| `@linfengqaqtat/dsh-scriptor-retrieval` | `packages/embedding-provider` | 检索增强（嵌入/场景/重排/图谱） |
| `@webnovel/*` | `packages/core` `drafting` `review` `ledger` `polish` `companion` | 内部 workspace 包 |

## 开发要点

- pnpm monorepo：先 `pnpm install`（Node ≥ 24.9，DSH 宿主 `>=0.2.2-rc.1 <0.3.0-0`）
- 主插件构建：`packages/bundle` 内 `npm run build`（esbuild 产物在 `lib/`）
- 类型检查：各包 `npm run typecheck`；测试：`packages/bundle` 内 `npm test`（vitest）
- 二开后如需发布 npm：`@linfengqaqtat` 是原作者的 scope，需改成自己的 scope/包名，并同步修改 `packages/meta` 的依赖引用

## 许可

GPL-3.0-only（继承上游）。对外分发需遵守 GPL-3.0，保留版权与来源声明。
