# DSH Scriptor 完整版

Scriptor 8.4.5 适配 DSH 0.2.2-rc.1。安装范围为 `>=0.2.2-rc.1 <0.3.0-0`，Node最低24.9；实际验证按具体版本记录。

[产品主页](https://yangda611.github.io/dsh-scriptor-full/) · [安装教程](https://yangda611.github.io/dsh-scriptor-full/docs/install.html)

> Scriptor 8.4.5 配套 **DSH 0.2.2-rc.1**。旧格式先备份并使用书仓维护预览，按明确批准执行升级。

`@yangda611/dsh-scriptor-full` 是主包的完整版入口：与单独安装主包效果相同，检索增强（嵌入、场景识别、重排、图谱）已包含在主包内，默认停用，需要自行配置后才启用。

## 安装

配套 DSH 0.2.2-rc.1。在 DSH 侧栏“插件 → 添加插件”输入 `@yangda611/dsh-scriptor-full@8.4.5`，核对预览并安装，按提示启用或重启。Desktop 自带运行时，不需要另装 Node/pnpm。

完整版只依赖主包，不包含鲸鱼娘。不要把完整版和主包、独立检索包同时装进同一个 profile：三者注册同一组模块 id，重复安装会留下重复入口。老用户如果现在是“主包 + 独立检索包”两件套，升级时卸载独立检索包、只留主包（或只留完整版）即可，配置与凭据都按原来的条目 id 保存，不会丢失。旧版本先备份、卸载旧入口，再安装新版本，详见 [安装与迁移](https://github.com/yangda611/dsh-scriptor-full/blob/main/docs/user/install.md)。

检索辅助功能默认关闭，需要自行配置模型和凭据；主聊天模型也由用户配置，包不包含模型额度。

## 更新与卸载

8.4.5 配套 DSH 0.2.2-rc.1，加入千章关系星团、证据轨迹、原生设置与书仓维护。先升级宿主，再更新 full 并重启。旧格式须先备份、检查并预览整仓升级；安装本身不迁移作品。升级后新建 **写作模式** 对话，打开原工作区继续；旧对话不会自动迁移。旧项目须保留原契约内容，补充并确认“章节篇幅”后启用范围核对。操作见 [新编辑器教程](https://github.com/yangda611/dsh-scriptor-full/blob/main/docs/user/editor.md) 和 [旧项目升级指南](https://github.com/yangda611/dsh-scriptor-full/blob/main/docs/user/upgrade-backup.md)。检索增强增加独立图谱模型，需在插件页配置并按书启用。

停止该 profile 的实例后，安装新精确版本并重启。卸载完整版：

```powershell
dsh plugin --profile scriptor remove @yangda611/dsh-scriptor-full
dsh --profile scriptor --dump-config
```

仅通过 full 安装时，卸载 full 会撤掉主包的组合配置。若仍保留独立安装项，卸载 full 不会移除它们；没有安装 full 时，也不能用删除 full 的命令卸载单装包。完整卸载需移除该 profile 实际安装的各入口，见 [卸载与重装](https://github.com/yangda611/dsh-scriptor-full/blob/main/docs/user/upgrade-backup.md#卸载与重装)。

卸载不删除作品、设置和凭据，也不清空 pnpm 的共享下载缓存。
GitHub Release 同时提供完整版 tarball；其唯一依赖（主包）仍需从 npm 下载，不能当作完全离线的一体包。

完整安装与使用教程：[公开使用文档](https://github.com/yangda611/dsh-scriptor-full/tree/main/docs/user)。
许可证：[GPL-3.0-only](LICENSE)。
