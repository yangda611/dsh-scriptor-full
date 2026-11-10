# GitHub Pages 站点维护

产品站点由 `site/build.mjs` 生成：首页与 `docs/user/*.md` 文档页。版本和 DSH 兼容范围分别来自 `packages/bundle/package.json` 与 `dsh-baseline.json`。

## 本地构建与预览

```powershell
pnpm pages:build
node site/build.mjs --strict
npx serve .tmp/pages
```

构建默认输出到 `.tmp/pages`，缺失链接、图片或锚点会报错。指定输出目录时，仅允许仓内 `.tmp/` 下的专用目录或仓外独立产物目录；仓库根、源码、`.git` 和 `.tmp` 本身均不可作为输出。

文档间的 `*.md` 链接会改写为对应 `.html`；指向 `docs/user/` 之外仓库文件的链接会改写为 GitHub `blob/main` 地址；图片与媒体复制到相同相对位置。文档侧栏顺序在 `site/build.mjs` 的 `NAV` 中维护。

## 部署

`.github/workflows/v8-pages.yml` 在推送到 `main` 且站点相关路径变化时构建并用官方 Pages Actions 部署；对 `main` 的 PR 只构建不上传。Actions 固定到 commit，部署 job 仅持有 `pages: write` 与 `id-token: write`。

首次启用时，在仓库 Settings → Pages → Build and deployment 中将 Source 设为 **GitHub Actions**，并确保 `github-pages` 环境允许默认分支 `main` 部署。启用后站点地址为 `https://yangda611.github.io/dsh-scriptor-full/`；可将此地址设为仓库 About → Website。

站点只发布首页、文档 HTML、图片、介绍视频与字幕。生成器只读取公开白名单内文件，并扫描文本产物中的凭据和个人路径。

## 与发行流程的关系

站点内容是纯文档，不随 npm 包发行。版本相关文字（安装标识、下载链接、配套宿主）构建时从真源注入，`pnpm check:version` 检查文档示例一致性。合并到 `main` 后，站点工作流自动部署。

## 站点地址

`og:url` 与 `og:image` 使用 `https://<owner 小写>.github.io/<repo>/`，从 `packages/bundle/package.json` 的 `repository.url` 推导。自定义域名时要调整 `site/build.mjs` 的地址规则，并同步检查分享卡片。页面内文档链接、样式和脚本使用相对路径；`404.html` 使用仓库根路径 `/dsh-scriptor-full/`。

## 首页与截图

首页保留产品和操作信息，不包含赞助或广告入口。平台、许可、视频下载等图标带说明和可访问名称；细节放进对应文档。客户端入口使用 DeepSeek 官网。Windows、Linux 和 macOS 的验证范围以安装页为准。

2026-10-06 更新了工作台、书房文件树和编辑器菜单、建议、批注共五张截图。它们来自 DSH 0.2.0-rc.2 Web 端与 Scriptor 8.2.0，原文是[《河埠旧事》](examples/河埠旧事.md)。编辑建议和批注来自 DeepSeek 官方 API，保存操作实际产生稿2；示例不是固定响应。截图只裁去无关区域，不修改界面内容。

## 配色

三套配色的唯一来源是 `site/palettes.mjs` 的 `PALETTES`（A 黛蓝宣纸、B 墨与朱印、C 松烟竹青，各有 `light` / `dark`）。`site/build.mjs` 据此生成 `assets/theme.css`。改颜色时只改 `palettes.mjs`，然后运行 `node --test scripts/release/tests/pages.test.mjs`。

## 外观设置

页头「外观」按钮同时选择配色和明暗。生成的 HTML 默认 `data-palette="A"`，且不写 `data-theme`，因此无脚本时跟随系统。`localStorage['scriptor-palette']` 只接受 `A` / `B` / `C`；`localStorage['scriptor-theme']` 只接受 `light` / `dark`。

## 共享 Markdown 约定

`docs/user/*.md` 在 GitHub 上保持原样；站点会转换提示块、顶层有序列表和部分行内快捷键标记。未知的 `[!…]` 类型会使构建失败。新用户文档需登记到 `site/build.mjs` 的 `NAV`。
