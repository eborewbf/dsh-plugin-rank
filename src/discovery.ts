/**
 * 插件市场数据编排：npm 主数据源 + GitHub 星标增强。
 *
 * 流程：
 *   1. npm 抓取全部 `dsh-plugin` 关键字插件（插件宇宙，一定完整）；
 *   2. GitHub topic 池（廉价批量）命中一部分仓库的星标；
 *   3. 逐仓库 Core API 增强其余仓库的星标（受 60/小时限额，或
 *      GITHUB_TOKEN 5000/小时），结果持久化，多次运行逐步补齐；
 *   4. 合并成 PluginRepo[] 并写入 market 缓存，供排名/推荐消费。
 *
 * discover() 只做「廉价」步骤（npm + topic 池），保证 Web 请求够快；
 * 逐仓库增强通过 enrich() 触发（后台/手动/CI），不阻塞页面加载。
 */

import { FileCache, cacheFile } from './cache.js'
import { fetchNpmPlugins, type NpmPackage } from './npm.js'
import {
  fetchRepo,
  ghRateLimitRemaining,
  searchRepos,
  type GithubRepo,
  type PluginRepo,
} from './github.js'

/** 市场数据统计（供界面展示与提示）。 */
export interface DiscoveryStats {
  npmTotal: number
  withRepo: number
  githubKnown: number
  missingRepos: number
  hasToken: boolean
  knownStars: number
  minStars: number
  maxStars: number
}

export interface DiscoveryResult {
  repos: PluginRepo[]
  fetchedAt: string
  /** live=本次重新组装；cache=命中合并缓存。 */
  source: 'live' | 'cache'
  stats: DiscoveryStats
  notice?: string
}

/** enrich() 的进度结果。 */
export interface EnrichResult {
  fetched: number
  notFound: number
  failed: number
  remaining: number
  done: boolean
  message: string
}

/** GitHub topic 池使用的主题（只用于批量星标增强，不判定插件身份）。 */
const POOL_TOPICS = [
  'topic:dsh-plugin',
  'topic:deepseek-harness-plugin',
  'topic:dsh-plugins',
  'topic:deepseek-harness-plugins',
  'topic:dsh',
  'topic:deepseek-harness',
]

/** 逐仓库增强时的并发度。 */
const ENRICH_CONCURRENCY = 6

/** 把单个 npm 包与可选的 GitHub 仓库合并为市场条目。 */
function mergePlugin(np: NpmPackage, gh: GithubRepo | null): PluginRepo {
  return {
    packageName: np.name,
    version: np.version,
    lastPublish: np.lastPublish || null,
    license: np.license || null,
    npmFinal: np.npmFinal,
    npmPopularity: np.npmPopularity,
    npmQuality: np.npmQuality,
    npmMaintenance: np.npmMaintenance,
    repo: np.repo,
    fullName: gh?.fullName ?? null,
    owner: gh?.owner ?? null,
    name: gh?.name ?? null,
    description: gh?.description ?? np.description,
    homepage: gh?.homepage ?? null,
    stars: gh?.stars ?? 0,
    forks: gh?.forks ?? 0,
    openIssues: gh?.openIssues ?? 0,
    createdAt: gh?.createdAt ?? null,
    updatedAt: gh?.updatedAt ?? null,
    pushedAt: gh?.pushedAt ?? null,
    topics: gh?.topics ?? [],
    archived: gh?.archived ?? false,
    htmlUrl: gh?.htmlUrl ?? null,
    defaultBranch: gh?.defaultBranch ?? null,
    githubKnown: gh !== null,
  }
}

/** 统计市场数据。 */
function computeStats(repos: PluginRepo[]): DiscoveryStats {
  const withRepo = repos.filter((r) => r.fullName).length
  const known = repos.filter((r) => r.githubKnown)
  return {
    npmTotal: repos.length,
    withRepo,
    githubKnown: known.length,
    missingRepos: repos.filter((r) => r.repo && !r.githubKnown).length,
    hasToken: Boolean(process.env.GITHUB_TOKEN),
    knownStars: known.length,
    minStars: known.length ? Math.min(...known.map((r) => r.stars)) : 0,
    maxStars: known.length ? Math.max(...known.map((r) => r.stars)) : 0,
  }
}

/** 空统计（用于失效缓存占位）。 */
function emptyStats(): DiscoveryStats {
  return { npmTotal: 0, withRepo: 0, githubKnown: 0, missingRepos: 0, hasToken: false, knownStars: 0, minStars: 0, maxStars: 0 }
}

/** 插件发现器：npm 为主 + GitHub 增强，带多级缓存。 */
export class PluginDiscovery {
  private readonly npmCache: FileCache
  private readonly poolCache: FileCache
  private readonly reposCache: FileCache
  private readonly marketCache: FileCache
  private enriching = false

  constructor(ttlMs: number) {
    this.npmCache = new FileCache(cacheFile('npm'), ttlMs)
    this.poolCache = new FileCache(cacheFile('github'), ttlMs)
    this.reposCache = new FileCache(cacheFile('repos'), 7 * 24 * 60 * 60 * 1000)
    this.marketCache = new FileCache(cacheFile('market'), ttlMs)
  }

  /** 读取（缓存优先）npm 插件列表。 */
  private async ensureNpm(): Promise<NpmPackage[]> {
    const cached = this.npmCache.read<NpmPackage[]>()
    if (cached && cached.length > 0) return cached
    const list = await fetchNpmPlugins()
    if (list.length === 0) throw new Error('npm 上未找到任何 dsh-plugin 插件')
    this.npmCache.write(list)
    return list
  }

  /** 读取（缓存优先）GitHub topic 池。失败时返回空池，不影响主流程。 */
  private async ensurePool(): Promise<Map<string, GithubRepo>> {
    const cached = this.poolCache.read<GithubRepo[]>()
    if (cached) return new Map(cached.map((r) => [r.fullName.toLowerCase(), r]))
    const pool = new Map<string, GithubRepo>()
    for (const topic of POOL_TOPICS) {
      for (let page = 1; page <= 2; page++) {
        try {
          const list = await searchRepos(topic, page)
          for (const repo of list) pool.set(repo.fullName.toLowerCase(), repo)
          if (list.length < 100) break
          // Search API 限额（unauth 10/分钟）较低，尽量克制抓取页数。
          if (page >= 1 && POOL_TOPICS.indexOf(topic) > 1) break
        } catch {
          break // 命中 Search API 限额或网络问题：用已抓到的部分
        }
      }
    }
    if (pool.size > 0) this.poolCache.write([...pool.values()])
    return pool
  }

  /** 读取（缓存优先）逐仓库增强表。 */
  private readRepoEnrich(): Map<string, GithubRepo> {
    const cached = this.reposCache.read<Record<string, GithubRepo>>()
    return new Map(Object.entries(cached ?? {}))
  }

  private writeRepoEnrich(map: Map<string, GithubRepo>): void {
    this.reposCache.write(Object.fromEntries(map))
  }

  /** 组装最终插件列表（不写入 market 缓存，由调用方决定）。 */
  private async assemble(): Promise<{ repos: PluginRepo[]; stats: DiscoveryStats; notice?: string }> {
    const npmList = await this.ensureNpm()
    const pool = await this.ensurePool()
    const enriched = this.readRepoEnrich()
    const repos = npmList.map((np) => {
      const gh =
        (np.repo && (pool.get(np.repo) ?? enriched.get(np.repo))) || null
      return mergePlugin(np, gh)
    })
    const stats = computeStats(repos)
    const notice =
      stats.missingRepos > 0
        ? `有 ${stats.missingRepos} 个插件尚未补充 GitHub 星标（设置 GITHUB_TOKEN 后在「补充数据」里补齐）。`
        : undefined
    return { repos, stats, notice }
  }

  /** 主入口：返回合并后的全部插件（命中合并缓存则直接返回）。 */
  async discover(): Promise<DiscoveryResult> {
    const cached = this.marketCache.read<DiscoveryResult>()
    if (cached && cached.repos.length > 0) return cached

    const { repos, stats, notice } = await this.assemble()
    const result: DiscoveryResult = {
      repos,
      fetchedAt: new Date().toISOString(),
      source: 'live',
      stats,
      notice,
    }
    this.marketCache.write(result)
    return result
  }

  /** 清除合并缓存，让下次 discover() 用最新增强数据重新组装。 */
  invalidateMarket(): void {
    this.marketCache.write<DiscoveryResult>({ repos: [], fetchedAt: '', source: 'cache', stats: emptyStats() })
  }

  /**
   * 逐仓库补充 GitHub 星标：优先补 npm 热度最高的缺失仓库，
   * 按剩余 Core API 额度（unauth 60/小时；有 token 5000/小时）执行。
   * 结果即时持久化，后续 discover() 自动合并。
   */
  async enrich(budget = Number.MAX_SAFE_INTEGER): Promise<EnrichResult> {
    if (this.enriching) {
      return { fetched: 0, notFound: 0, failed: 0, remaining: 0, done: false, message: '已有补充任务在运行，请稍候' }
    }
    this.enriching = true
    try {
      const npmList = await this.ensureNpm()
      const pool = await this.ensurePool()
      const enriched = this.readRepoEnrich()

      // 需要增强的仓库，按 npm 热度降序（最重要的先补）。
      const missing = npmList
        .filter((np) => np.repo && !pool.has(np.repo) && !enriched.has(np.repo))
        .sort((a, b) => b.npmFinal - a.npmFinal)

      let fetched = 0
      let notFound = 0
      let failed = 0
      let stop = false
      let cursor = 0
      const run = async (): Promise<void> => {
        while (!stop && cursor < missing.length) {
          const np = missing[cursor++]
          if (!np.repo) continue
          try {
            const gh = await fetchRepo(np.repo)
            if (gh) {
              enriched.set(np.repo, gh)
              fetched++
            } else {
              notFound++
              // 404：仓库不存在/已删除，记录为 null 避免反复抓。
              enriched.set(np.repo, null as unknown as GithubRepo)
            }
          } catch {
            failed++
            stop = true // 多半是限流，停止本轮
          }
          if (fetched + notFound + failed >= budget) stop = true
          const remaining = ghRateLimitRemaining()
          if (remaining !== null && remaining <= 1) stop = true
        }
      }

      const workers = Array.from({ length: ENRICH_CONCURRENCY }, () => run())
      await Promise.all(workers)
      this.writeRepoEnrich(enriched)
      this.invalidateMarket() // 有新增，让下次 discover() 重组

      const left = missing.length - (fetched + notFound + failed)
      const remaining = ghRateLimitRemaining()
      const done = left <= 0
      return {
        fetched,
        notFound,
        failed,
        remaining: remaining ?? 0,
        done,
        message: done
          ? `全部补齐：新增 ${fetched} 个仓库星标（不存在 ${notFound}，失败 ${failed}）`
          : `本轮补齐 ${fetched} 个仓库星标；还剩 ${left} 个待补（剩余 API 额度 ${remaining ?? '未知'}，可再次触发或设置 GITHUB_TOKEN）`,
      }
    } finally {
      this.enriching = false
    }
  }
}
