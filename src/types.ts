/**
 * dsh-plugin-rank 的公共类型。
 *
 * 这里只使用结构性（structural）类型描述 DSH 运行时的关键服务面，
 * 运行时完全不会 import 任何 `@deepseek-ai/*` 包，保证插件零运行时依赖、
 * 可独立安装到任意 DSH profile，也能脱离 DSH 单独构建与验证。
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/** @deepseek-ai/dsh-host-webserver 的路由类型（与官方实现一致）。 */
export interface WebRoute {
  kind: 'exact' | 'prefix'
  /** 绝对路径，不带尾部斜杠。 */
  path: string
  /** 全权负责响应生命周期（可保持连接打开，如 SSE）。 */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** `ctx.webServer` 的最小结构面。 */
export interface WebServerService {
  register(route: WebRoute): () => void
  readonly host: '127.0.0.1' | '0.0.0.0'
  readonly port: number
}

/** Cordis Context 的最小结构面（只声明本插件用到的成员）。 */
export interface PluginContext {
  webServer: WebServerService
  logger: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }
  on(event: string, listener: (...args: unknown[]) => void): void
}
