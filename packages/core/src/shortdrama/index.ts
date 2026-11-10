/**
 * 短剧管线（阶段 3）入口：分集大纲 / 单集剧本 / 节拍检查器 / 短剧审读 / 节奏模板 / 示例。
 *
 * 注意：本模块不改 packages/core/src/index.ts（阶段 3 只创建新文件），
 * 所以 @webnovel/core 的包入口暂不导出短剧能力；协调人接线时在
 * packages/core/src/index.ts 加一行 `export * from './shortdrama'` 即可，
 * 见汇报里的注册代码片段。
 */

export * from './types'
export * from './templates'
export * from './outline'
export * from './script'
export * from './beat-checker'
export * from './review'
export * from './examples'
