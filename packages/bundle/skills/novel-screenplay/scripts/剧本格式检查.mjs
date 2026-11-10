/**
 * 剧本格式检查：从同包独立 CLI 运行库调用现有只读计算。
 * 退出码：沿用业务返回值；2 执行异常；3 运行库无法加载或导出不符。
 *
 * 接线说明：本脚本是薄入口，与 novel-review 的 scripts/确定性检查.mjs
 * 同一模式——它调用 lib/cli.js 导出的 runScreenplayChecksCli。
 * 该导出由协调人接线时在 packages/bundle/src/cli.ts 里加（见阶段 2 汇报），
 * 在此之前本脚本退出码为 3（运行库无法加载或导出不符），属预期未接线状态，
 * 不要把它当作脚本本身的缺陷去改脚本。
 */
const libUrl = new URL('../../../lib/cli.js', import.meta.url)
let run
try {
  const lib = await import(libUrl)
  run = lib.runScreenplayChecksCli
  if (typeof run !== 'function') throw new Error('运行库缺少 runScreenplayChecksCli，请核对插件文件版本')
} catch (err) {
  console.error(`无法加载技能运行库 lib/cli.js（${libUrl.href}）：${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 3
}
if (typeof run === 'function') {
  try {
    process.exitCode = await run(process.argv.slice(2))
  } catch (err) {
    console.error(`剧本格式检查执行异常：${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 2
  }
}
