/**
 * HTTP 层：托管插件市场页面与 JSON API。
 *
 * 页面与接口都挂在 `webServer` 的 `/plugin-rank/*` 路径下，同源访问，
 * 无需鉴权（webServer 默认只监听 127.0.0.1）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PluginDiscovery } from './discovery.js'
import { rankByStars } from './ranking.js'
import { recommend } from './recommend.js'
import { getPluginDetail } from './detail.js'
import * as manage from './manage.js'

/** 插件市场运行时共享对象。 */
export interface MarketRuntime {
  discovery: PluginDiscovery
  profile: string
  uiRoot: string
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** 构建全部 API handler。 */
export function buildHandlers(rt: MarketRuntime) {
  return {
    /** 页面。 */
    index(_req: IncomingMessage, res: ServerResponse): void {
      try {
        const html = readFileSync(join(rt.uiRoot, 'index.html'), 'utf8')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html)
      } catch {
        sendJson(res, 500, { error: 'ui/index.html 缺失，请检查插件安装是否完整。' })
      }
    },

    /** 重定向到带尾部斜杠的页面路径。 */
    redirect(res: ServerResponse): void {
      res.writeHead(302, { Location: '/plugin-rank/' })
      res.end()
    },

    /** 发现结果（含来源、统计与提示）。 */
    async discovery(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const result = await rt.discovery.discover()
        sendJson(res, 200, {
          fetchedAt: result.fetchedAt,
          source: result.source,
          notice: result.notice,
          stats: result.stats,
          total: result.repos.length,
          repos: result.repos,
        })
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 星标排名（含理由）。 */
    async ranking(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const result = await rt.discovery.discover()
        sendJson(res, 200, {
          fetchedAt: result.fetchedAt,
          source: result.source,
          notice: result.notice,
          stats: result.stats,
          total: result.repos.length,
          list: rankByStars(result.repos),
        })
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 智能推荐（含理由）。支持 ?top=N。 */
    async recommendList(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const url = new URL(req.url ?? '/', 'http://x')
        const top = Math.min(50, Math.max(1, Number(url.searchParams.get('top')) || 10))
        const result = await rt.discovery.discover()
        sendJson(res, 200, {
          fetchedAt: result.fetchedAt,
          source: result.source,
          notice: result.notice,
          stats: result.stats,
          total: result.repos.length,
          top,
          list: recommend(result.repos, top),
        })
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 插件详情：评论 + 效果截图。?repo=owner/name */
    async detail(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const url = new URL(req.url ?? '/', 'http://x')
        const repo = (url.searchParams.get('repo') || '').trim()
        if (!repo) {
          sendJson(res, 400, { error: '缺少 repo 参数（格式 owner/name）' })
          return
        }
        const result = await rt.discovery.discover()
        const hit = result.repos.find((r) => r.fullName && r.fullName.toLowerCase() === repo.toLowerCase())
        if (!hit) {
          sendJson(res, 404, { error: `未找到仓库 ${repo}` })
          return
        }
        const detail = await getPluginDetail(hit.fullName as string, hit.defaultBranch)
        sendJson(res, 200, detail)
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 补充 GitHub 星标数据（逐仓库增强）。GET 触发，返回本轮进度。 */
    async enrich(_req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const result = await rt.discovery.enrich()
        sendJson(res, 200, result)
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 已安装情况。 */
    installed(_req: IncomingMessage, res: ServerResponse): void {
      try {
        sendJson(res, 200, {
          bundles: manage.installedBundles(rt.profile),
          removable: manage.installedRemovable(rt.profile),
          byRepo: manage.mapInstalledByRepo(rt.profile),
          self: manage.selfInstalled(rt.profile),
        })
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 安装插件。body: { spec: 'owner/repo' | 'npm 包名' } */
    async install(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = JSON.parse(await readBody(req) || '{}') as { spec?: string }
        if (!body.spec) {
          sendJson(res, 400, { error: '缺少 spec 参数' })
          return
        }
        sendJson(res, 200, manage.install(body.spec, rt.profile))
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 卸载插件。body: { name: '包名' } */
    async remove(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = JSON.parse(await readBody(req) || '{}') as { name?: string }
        if (!body.name) {
          sendJson(res, 400, { error: '缺少 name 参数' })
          return
        }
        sendJson(res, 200, manage.remove(body.name, rt.profile))
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },

    /** 翻译一段英文为中文（走百度翻译免费版，按文本缓存）。body: { text } */
    async translate(req: IncomingMessage, res: ServerResponse): Promise<void> {
      try {
        const body = JSON.parse(await readBody(req) || '{}') as { text?: string }
        const text = String(body.text ?? '').trim()
        if (!text) {
          sendJson(res, 400, { error: '缺少 text 参数' })
          return
        }
        const cached = translateCache.get(text)
        if (cached) {
          sendJson(res, 200, { zh: cached })
          return
        }
        const zh = await translateBaidu(text)
        if (zh) {
          translateCache.set(text, zh)
          sendJson(res, 200, { zh })
          return
        }
        sendJson(res, 200, { error: '翻译未配置或失败（请设置环境变量 BAIDU_APPID 与 BAIDU_SECRET_KEY）' })
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) })
      }
    },
  }
}

/** 翻译结果内存缓存（英文 -> 中文）。 */
const translateCache = new Map<string, string>()

/** 调用百度翻译（通用文本翻译 API，免费版）。未配置密钥或失败时返回 null。 */
async function translateBaidu(text: string): Promise<string | null> {
  const appid = process.env.BAIDU_APPID
  const secret = process.env.BAIDU_SECRET_KEY
  if (!appid || !secret) return null
  const q = text.slice(0, 2000) // 百度单次上限约 2000 字符
  const salt = Date.now().toString()
  const sign = createHash('md5').update(appid + q + salt + secret).digest('hex')
  try {
    const json = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: new URLSearchParams({ q, from: 'en', to: 'zh', appid, salt, sign }).toString(),
    }).then((r) => r.json()) as { trans_result?: { dst: string }[] }
    return json.trans_result?.[0]?.dst ?? null
  } catch {
    return null
  }
}

export type MarketHandlers = ReturnType<typeof buildHandlers>
