/**
 * npm 插件数据源。
 *
 * DeepSeek Harness 的「插件」本质是 npm 包：它在 package.json 里声明
 * `dsh.bundle.patch`，被 profile 用 pnpm 加载进 Cordis 插件层。因此，
 * 判断一个东西「是不是真正的 DSH 插件」，npm 的 `dsh-plugin` 关键字
 * 比 GitHub 主题可靠得多（GitHub 主题被大量蹭热度项目污染）。
 *
 * 本模块负责从 npm registry 抓取全部 `dsh-plugin` 插件，并把
 * 仓库链接归一化为 `owner/repo`，供后续 GitHub 星标增强使用。
 */

/** npm search 结果里我们关心的包字段。 */
export interface NpmPackage {
  name: string
  version: string
  description: string
  license: string
  /** 最近一次发布时间（ISO）。 */
  lastPublish: string
  /** npm 官方综合分（0-1）。 */
  npmFinal: number
  /** npm 热度分（0-1），可作星标缺失时的流行度代理。 */
  npmPopularity: number
  npmQuality: number
  npmMaintenance: number
  /** 归一化后的 GitHub 仓库 `owner/repo`（小写）；无则 null。 */
  repo: string | null
}

/** 从任意仓库 URL 归一化出 `owner/repo`（小写）；解析失败返回 null。 */
export function repoOfUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /github\.com[/:]([^/]+)\/([^/.#]+)/.exec(url)
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null
}

/** 执行一次 npm search。 */
async function searchNpm(query: string, size: number, from: number): Promise<{
  total: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objects: { package: Record<string, any>; score: { final?: number; detail?: { popularity?: number; quality?: number; maintenance?: number } } }[]
}> {
  const url =
    `https://registry.npmjs.org/-/v1/search` +
    `?text=${encodeURIComponent(query)}&size=${size}&from=${from}`
  const res = await fetch(url, { headers: { 'User-Agent': 'dsh-plugin-rank' } })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`npm search failed (${res.status}): ${body.slice(0, 300)}`)
  }
  return (await res.json()) as ReturnType<typeof searchNpm>
}

/** 把 npm 搜索结果对象映射为 NpmPackage。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNpmObject(o: { package: Record<string, any>; score?: { final?: number; detail?: { popularity?: number; quality?: number; maintenance?: number } } }): NpmPackage {
  const p = o.package
  const detail = o.score?.detail
  const repoRaw = (p.links?.repository as string | undefined) ?? null
  return {
    name: String(p.name ?? ''),
    version: String(p.version ?? ''),
    description: String(p.description ?? ''),
    license: (p.license as string | null) ?? '',
    lastPublish: (p.date as string) ?? '',
    npmFinal: o.score?.final ?? 0,
    npmPopularity: detail?.popularity ?? 0,
    npmQuality: detail?.quality ?? 0,
    npmMaintenance: detail?.maintenance ?? 0,
    repo: repoOfUrl(repoRaw),
  }
}

/**
 * 抓取全部带 `dsh-plugin` 关键字的 npm 包（分页直到抓完或超过上限）。
 * 结果按 npm 综合分降序返回。
 */
export async function fetchNpmPlugins(maxTotal = 2000): Promise<NpmPackage[]> {
  const PAGE = 250
  const byName = new Map<string, NpmPackage>()
  for (let from = 0; from < maxTotal; from += PAGE) {
    const { total, objects } = await searchNpm('keywords:dsh-plugin', PAGE, from)
    for (const o of objects) {
      const pkg = mapNpmObject(o)
      byName.set(pkg.name, pkg)
    }
    if (objects.length < PAGE || byName.size >= total) break
  }
  return [...byName.values()].sort((a, b) => b.npmFinal - a.npmFinal)
}
