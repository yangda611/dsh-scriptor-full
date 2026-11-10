/**
 * 电影剧本改编管线（阶段 2）入口。
 * 注意：接线前 core/src/index.ts 尚未导出本模块（协调人接线时加一行
 * `export * from './screenplay/index'`）；在此之前，本模块由
 * packages/bundle/src/screenplay-tools.ts 经相对路径导入，工具测试
 * 与核心测试直接从这里 import。
 */
export * from './types'
export * from './story'
export * from './outline'
export * from './rhythm'
export * from './format'
export * from './review'
export * from './pipeline'
