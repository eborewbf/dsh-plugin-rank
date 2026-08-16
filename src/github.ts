/**
 * GitHub 侧数据：插件仓库的星标 / fork / 活跃度等元数据。
 *
 * GitHub 主题（topic）只作为「廉价批量增强」来源：`topic:dsh-plugin` 等
 * 主题会命中大量蹭热度项目，因此本模块只负责抓取原始仓库元数据，是否
 * 算作「插件」的判断交给 npm 侧（见 npm.ts），合并逻辑见 discovery.ts。
 */

/** GitHub 仓库元数据（增强字段，可能整体缺失）。 */
export interface GithubRepo {
  fullName: string
  owner: string
  name: string
  description: string
  homepage: string | null
  stars: number
  forks: number
  openIssues: number
  createdAt: string
  updatedAt: string
  pushedAt: string
  topics: string[]
  archived: boolean
  license: string | null
  htmlUrl: string
  defaultBranch: string
}

/**
 * 市场里一条插件的完整身份：
 *   - npm 字段是主身份（一定存在，来自 npm `dsh-plugin` 关键字）；
 *   - GitHub 字段是增强（可能缺失，`githubKnown=false` 时星标未知）。
 */
export interface PluginRepo {
  // npm 主身份
  packageName: string
  version: string
  lastPublish: string | null
  license: string | null
  npmFinal: number
  npmPopularity: number
  npmQuality: number
  npmMaintenance: number
  /** npm 声明的仓库 `owner/repo`（小写）；无则 null。用于判断「有仓库但未补星标」。 */
  repo: string | null
  // GitHub 增强
  fullName: string | null
  owner: string | null
  name: string | null
  description: string
  homepage: string | null
  stars: number
  forks: number
  openIssues: number
  createdAt: string | null
  updatedAt: string | null
  pushedAt: string | null
  topics: string[]
  archived: boolean
  htmlUrl: string | null
  defaultBranch: string | null
  /** 是否拿到了 GitHub 元数据（决定排名用星标还是 npm 热度）。 */
  githubKnown: boolean
}

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

/** 最近一次 GitHub 响应里看到的 Core API 剩余额度（未请求过则 null）。 */
let lastRemaining: number | null = null

function trackRateLimit(res: { headers: { get(name: string): string | null } }): void {
  const raw = res.headers.get('x-ratelimit-remaining')
  if (raw !== null && raw !== '') lastRemaining = Number(raw)
}

/** 把 GitHub 仓库对象映射为 GithubRepo。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRepo(item: any): GithubRepo {
  return {
    fullName: item.full_name,
    owner: item.owner?.login ?? '',
    name: item.name,
    description: item.description ?? '',
    homepage: item.homepage || null,
    stars: item.stargazers_count ?? 0,
    forks: item.forks_count ?? 0,
    openIssues: item.open_issues_count ?? 0,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    pushedAt: item.pushed_at,
    topics: Array.isArray(item.topics) ? item.topics : [],
    archived: Boolean(item.archived),
    license: item.license?.spdx_id ?? null,
    htmlUrl: item.html_url,
    defaultBranch: item.default_branch ?? 'main',
  }
}

/** 执行一次 GitHub 仓库搜索（Search API，独立限额桶）。 */
export async function searchRepos(query: string, page: number, perPage = 100): Promise<GithubRepo[]> {
  const url =
    `https://api.github.com/search/repositories` +
    `?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}&page=${page}`
  const res = await fetch(url, { headers: ghHeaders() })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub search failed (${res.status}): ${body.slice(0, 300)}`)
  }
  trackRateLimit(res)
  const json = (await res.json()) as { items?: unknown[] }
  return (json.items ?? []).map(mapRepo)
}

/**
 * 抓取单个仓库（Core API，unauth 60 次/小时；设 GITHUB_TOKEN 为 5000）。
 * 404 或不可用返回 null；被限流时抛错，由调用方按剩余额度决定是否继续。
 */
export async function fetchRepo(fullName: string): Promise<GithubRepo | null> {
  const url = `https://api.github.com/repos/${fullName}`
  const res = await fetch(url, { headers: ghHeaders() })
  trackRateLimit(res)
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GitHub repo fetch failed (${res.status}): ${body.slice(0, 200)}`)
  }
  return mapRepo(await res.json())
}

/** 读取最近一次请求看到的 Core API 剩余额度（未请求过则未知）。 */
export function ghRateLimitRemaining(): number | null {
  return lastRemaining
}
