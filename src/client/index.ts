/**
 * dsh-plugin-rank 客户端入口（browser half）。
 *
 * 通过 cordis fiber 注入 `slots` 与 `locale`，在系统预定义的
 * `sidebar.footer.action`（list 类型 slot）上注册一个侧边栏底部入口，
 * 点击后跳转到 host 侧托管的 `/plugin-rank/` 页面。
 *
 * 双面约束：本文件打包进 `lib/client.js`，运行时只从客户端模块表解析
 * `react` 平台模块；`apply`/`inject` 是 cordis fiber 约定的导出，交给
 * 客户端 Loader 的 entry 治理执行。`@deepseek-ai/*` 仅作类型（构建期擦除），
 * 因此这里用最小化的本地契约类型，避免引入未发布的内部包。
 */
import { PluginRankAction } from './PluginRankAction.tsx'
import { en, NS, zh } from './locales.ts'

/**
 * 客户端根上下文的本地最小契约：仅包含本入口消费的服务。
 * 与 `@deepseek-ai/dsh-client-runtime/client` 的 ClientContext 对齐；
 * 运行时由客户端模块系统注入真实实现。
 */
export interface ClientContext {
  /** 注册一个按上下文生命周期执行的副作用（此处用于字典注册）。 */
  effect(fn: () => void, label: string): void
  /** 客户端 slot 注册表。 */
  slots: {
    /**
     * 等目标 slot 声明落账后再注册；`register` 返回的句柄由框架消费。
     */
    inject(key: string, register: () => { id: string }): void
    /** 向指定 slot 注册一个组件。 */
    register(options: {
      name: string
      id: string
      order: number
      locale: string
    }, component: unknown): { id: string }
  }
  /** 客户端 locale 服务。 */
  locale: {
    /** 注册一个命名空间字典。 */
    register(ns: string, dict: { zh: Record<string, string>; en: Record<string, string> }): void
  }
}

/** 依赖的服务：等 slots 与 locale 就绪后激活。 */
export const inject = ['slots', 'locale']

/**
 * 注册 `plugin-rank` 字典与侧边栏底部动作。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-plugin-rank: dictionaries')
  ctx.slots.inject(
    'sidebar.footer.action',
    () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'plugin-rank',
      // 排在其它底部动作之间：order 越小越靠前。
      order: 10,
      locale: NS,
    }, PluginRankAction),
  )
}