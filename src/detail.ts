/**
 * 插件详情增强：评论/反馈提取 + 效果截图。
 *
 * 数据来源（均为 GitHub 公开接口）：
 *   - README（raw.githubusercontent.com，不计 Core API 限额）→ 提取效果截图
 *     （markdown 图片 / HTML <img>，含 GIF 演示），并生成一段简介摘录；
 *   - 最近 Issue（Core API）→ 用户反馈、Bug 报告、功能请求，作为「评论」展示；
 *   - Issue 评论（Core API）→ 维护者与用户的最新回复。
 *
 * 详情按仓库缓存 7 天，且只在用户点开某插件详情时按需抓取，避免占满
 * GitHub API 额度（Core API unauth 60/小时，设 GITHUB_TOKEN 5000/小时）。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pluginDataDir } from './cache.js'

/** 一条效果截图（README 中的演示图 / GIF）。 */
export interface PluginScreenshot {
  url: string
  alt: string
}

/** 一条评论 / 反馈（Issue 或 Issue 评论）。 */
export interface PluginReview {
  /** issue：用户反馈/提问；comment：维护者或用户的回复。 */
  type: 'issue' | 'comment'
  /** Issue 标题（comment 时可能为空）。 */
  title: string
  /** 正文（已截断）。 */
  body: string
  /** 跳转链接。 */
  url: string
  author: string
  createdAt: string
  labels: string[]
  /** 展示顺序（issue 在前，comment 在后，各自保持时间倒序）。 */
  index: number
}

/** 一个插件的详情增强结果。 */
export interface PluginDetail {
  fullName: string
  /** README 简介摘录（去 markdown 后的前 N 字）。 */
  readmeExcerpt: string
  /** 效果截图列表。 */
  screenshots: PluginScreenshot[]
  /** 评论 / 反馈列表。 */
  reviews: PluginReview[]
  fetchedAt: string
}

/** 详情缓存的 TTL：7 天。 */
const DETAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000

const GH_HEADERS: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-plugin-rank',
  'X-GitHub-Api-Version': '2022-11-28',
}

function ghHeaders(): Record<string, string> {
  const headers = { ...GH_HEADERS }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/** 把正文截断到上限字符。 */
function clip(text: string, max = 500): string {
  const s = (text ?? '').trim().replace(/\s+/g, ' ').replace(/```[\s\S]*?```/g, ' ')
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** 用 GitHub Contents API 抓取 README（走 api.github.com，与其它请求同网络路径）。 */
async function fetchReadme(fullName: string, branch: string | null): Promise<string | null> {
  const candidates = [branch, 'main', 'master'].filter((b): b is string => Boolean(b))
  for (const b of candidates) {
    try {
      const url = `https://api.github.com/repos/${fullName}/readme?ref=${encodeURIComponent(b)}`
      const res = await fetch(url, { headers: { ...ghHeaders(), Accept: 'application/vnd.github-commit.raw+json' } })
      if (res.ok) return await res.text()
    } catch {
      /* 继续尝试下一个分支 */
    }
  }
  return null
}

/** 解析 README 里的演示图片：markdown `![alt](url)` 与 HTML `<img src>`。 */
function extractScreenshots(readme: string, fullName: string, branch: string | null): PluginScreenshot[] {
  const out: PluginScreenshot[] = []
  // 相对图片统一解析到 GitHub raw 端点（浏览器侧加载，服务端不抓图）。
  const rawBase = `https://raw.githubusercontent.com/${fullName}/${branch ?? 'main'}/`
  const resolve = (rawUrl: string): string => {
    const u = rawUrl.trim()
    if (!u) return ''
    if (/^https?:\/\//i.test(u)) return u
    if (u.startsWith('//')) return `https:${u}`
    // 相对路径：相对 README 所在目录（仓库根）解析到 raw。
    return rawBase + u.replace(/^\.\//, '')
  }
  const push = (u: string, alt: string): void => {
    const url = resolve(u)
    if (url && !out.some((s) => s.url === url)) out.push({ url, alt: (alt || '').trim() || url.split('/').pop() || '' })
  }
  // markdown: ![alt](url)
  const mdRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let m: RegExpExecArray | null
  while ((m = mdRe.exec(readme)) !== null) push(m[2], m[1])
  // html: <img src="..." alt="...">
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let im: RegExpExecArray | null
  while ((im = imgRe.exec(readme)) !== null) {
    const altMatch = /alt=["']([^"']*)["']/i.exec(im[0])
    push(im[1], altMatch?.[1] ?? '')
  }
  // 只保留前面若干张，避免 README 图过多撑爆界面。
  return out.slice(0, 12)
}

/** 从 README 提取纯文本摘要（去图片、代码块、标题符号）。 */
function readmeExcerpt(readme: string, max = 400): string {
  const text = readme
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapIssue(item: any, index: number): PluginReview {
  return {
    type: 'issue',
    title: String(item.title ?? ''),
    body: clip(item.body ?? ''),
    url: String(item.html_url ?? ''),
    author: item.user?.login ?? '',
    createdAt: String(item.created_at ?? ''),
    labels: Array.isArray(item.labels) ? item.labels.map((l: { name?: string }) => String(l.name ?? '')).slice(0, 4) : [],
    index,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComment(item: any, index: number): PluginReview {
  return {
    type: 'comment',
    title: '',
    body: clip(item.body ?? ''),
    url: String(item.html_url ?? ''),
    author: item.user?.login ?? '',
    createdAt: String(item.created_at ?? ''),
    labels: [],
    index,
  }
}

/** 抓取某插件的评论与反馈（Issue + Issue 评论，Core API）。失败返回空数组。 */
async function fetchReviews(fullName: string): Promise<PluginReview[]> {
  const reviews: PluginReview[] = []
  // 1) 最近 Issue（state=all，含已关闭的 Bug 与功能请求；过滤 PR）。
  try {
    const url = `https://api.github.com/repos/${fullName}/issues?state=all&sort=created&direction=desc&per_page=8`
    const res = await fetch(url, { headers: ghHeaders() })
    if (res.ok) {
      const issues = (await res.json()) as Array<Record<string, unknown> & { pull_request?: unknown }>
      issues
        .filter((it) => !it.pull_request)
        .forEach((it, i) => reviews.push(mapIssue(it, i)))
    }
  } catch {
    /* 评论抓取失败不阻塞截图 */
  }
  // 2) 最近的 Issue 评论（跨 issue 的最新回复）。
  try {
    const url = `https://api.github.com/repos/${fullName}/issues/comments?sort=created&direction=desc&per_page=8`
    const res = await fetch(url, { headers: ghHeaders() })
    if (res.ok) {
      const comments = (await res.json()) as Array<Record<string, unknown>>
      comments.forEach((it, i) => reviews.push(mapComment(it, i)))
    }
  } catch {
    /* 同上 */
  }
  return reviews.slice(0, 12)
}

/** 插件详情缓存（按仓库持久化，7 天 TTL）。读写失败不影响主流程。 */
class DetailCache {
  private readonly file = join(pluginDataDir(), 'detail-cache.json')
  private map: Record<string, { savedAt: number; data: PluginDetail }> | null = null

  private load(): Record<string, { savedAt: number; data: PluginDetail }> {
    if (this.map) return this.map
    try {
      this.map = JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, { savedAt: number; data: PluginDetail }>
    } catch {
      this.map = {}
    }
    return this.map
  }

  read(fullName: string): PluginDetail | null {
    const entry = this.load()[fullName.toLowerCase()]
    if (!entry) return null
    if (Date.now() - entry.savedAt > DETAIL_TTL_MS) return null
    return entry.data
  }

  write(fullName: string, data: PluginDetail): void {
    try {
      const map = this.load()
      map[fullName.toLowerCase()] = { savedAt: Date.now(), data }
      mkdirSync(join(pluginDataDir()), { recursive: true })
      writeFileSync(this.file, JSON.stringify(map))
    } catch {
      /* 缓存写入失败不应影响主流程 */
    }
  }
}

const detailCache = new DetailCache()

/**
 * 获取插件详情（缓存优先）。fullName 形如 `owner/repo`；
 * branch 为该仓库的默认分支（可空，自动回退 main/master）。
 */
export async function getPluginDetail(fullName: string, branch: string | null): Promise<PluginDetail> {
  const key = fullName.toLowerCase()
  const cached = detailCache.read(key)
  if (cached) return cached

  const [readme, reviews] = await Promise.all([
    fetchReadme(key, branch),
    fetchReviews(key),
  ])

  const detail: PluginDetail = {
    fullName: key,
    readmeExcerpt: readme ? readmeExcerpt(readme) : '',
    screenshots: readme ? extractScreenshots(readme, key, branch) : [],
    reviews,
    fetchedAt: new Date().toISOString(),
  }
  detailCache.write(key, detail)
  return detail
}
