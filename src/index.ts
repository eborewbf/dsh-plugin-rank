/**
 * dsh-plugin-rank — DeepSeek Harness 插件排名与推荐中心。
 *
 * 一个 host 侧 bundle 插件：通过 `webServer` 服务在 `/plugin-rank/` 下
 * 托管一个独立页面 + JSON API，提供：
 *   - 星标排名（含排名理由）
 *   - 智能推荐（含推荐分与理由）
 *   - 一键安装 / 卸载管理（复用 DSH 的 pnpm profile 机制）
 *
 * 插件入口（Cordis 插件）：
 *   - name / inject / apply 为 Cordis 约定的导出；
 *   - 运行时只依赖 Node 内置能力与注入的 ctx.webServer，零 `@deepseek-ai/*` 运行时依赖。
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PluginContext, WebRoute } from './types.js'
import { cacheFile } from './cache.js'
import { PluginDiscovery } from './discovery.js'
import { buildHandlers, type MarketHandlers } from './web.js'

/** 稳定插件名。 */
export const name = 'plugin-rank'

/** 依赖的服务：等待 webServer 就绪后激活。 */
export const inject = ['webServer']

/** 插件包的根目录（lib/ 的上一级），ui/ 与 lib/ 同级。 */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 抓取缓存的 TTL：6 小时。 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** 插件排名与推荐中心 Web UI 的根路径。 */
export const MARKET_BASE = '/plugin-rank'

export function apply(ctx: PluginContext): void {
  const discovery = new PluginDiscovery(CACHE_TTL_MS)
  const handlers: MarketHandlers = buildHandlers({
    discovery,
    profile: 'web',
    uiRoot: join(PACKAGE_ROOT, 'ui'),
  })

  const routes: WebRoute[] = [
    { kind: 'exact', path: MARKET_BASE, handler: (_req, res) => handlers.redirect(res) },
    { kind: 'exact', path: `${MARKET_BASE}/`, handler: handlers.index },
    { kind: 'exact', path: `${MARKET_BASE}/api/discovery`, handler: handlers.discovery },
    { kind: 'exact', path: `${MARKET_BASE}/api/ranking`, handler: handlers.ranking },
    { kind: 'exact', path: `${MARKET_BASE}/api/recommend`, handler: handlers.recommendList },
    { kind: 'exact', path: `${MARKET_BASE}/api/detail`, handler: handlers.detail },
    { kind: 'exact', path: `${MARKET_BASE}/api/enrich`, handler: handlers.enrich },
    { kind: 'exact', path: `${MARKET_BASE}/api/installed`, handler: handlers.installed },
    { kind: 'exact', path: `${MARKET_BASE}/api/install`, handler: handlers.install },
    { kind: 'exact', path: `${MARKET_BASE}/api/remove`, handler: handlers.remove },
    { kind: 'exact', path: `${MARKET_BASE}/api/translate`, handler: handlers.translate },
  ]

  for (const route of routes) {
    try {
      ctx.webServer.register(route)
    } catch (err) {
      ctx.logger.error(`[plugin-rank] 注册路由 ${route.path} 失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  ctx.logger.info(`[plugin-rank] 插件排名与推荐中心已就绪: http://127.0.0.1:${ctx.webServer.port}${MARKET_BASE}/`)
}
