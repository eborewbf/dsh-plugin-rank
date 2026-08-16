/**
 * 星标排名：对全部插件排序并生成中英文双语排名理由。
 *
 * 排名口径：
 *   - 拿到 GitHub 星标数据的插件，按星标数降序（并列按 fork）；
 *   - 尚未补充 GitHub 数据的插件（仓库未收录/未增强），按 npm 热度
 *     降序排在后面，理由里明确说明「暂无星标数据」，避免误导。
 */

import type { PluginRepo } from './github.js'

/** 中英文双语的文本片段。 */
export interface BilingualText {
  /** 中文。 */
  zh: string
  /** English. */
  en: string
}

/** 一条带理由的排名项（reason 为中文，reasonEn 为英文）。 */
export interface RankedPlugin {
  rank: number
  repo: PluginRepo
  reason: string
  reasonEn: string
}

/** 距今的天数；解析失败返回 null。 */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / 86_400_000)
}

/** 把星标数格式化为可读文本（1.2k / 340）。 */
function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

/** 把「距今月数」格式化为整数文本。 */
function fmtMonths(days: number): string {
  return String(Math.round(days / 30))
}

/** GitHub 已知时的排名理由（星标 / 名次 / fork / 活跃度 / 归档），中英双语。 */
function rankReasonGitHub(repo: PluginRepo, rank: number, total: number): BilingualText {
  const zh: string[] = []
  const en: string[] = []
  zh.push(`星标 ${fmtStars(repo.stars)} 个，社区关注度排第 ${rank}/${total} 名`)
  en.push(`${fmtStars(repo.stars)} stars, ranking #${rank}/${total} in community attention`)
  if (repo.forks > 0) {
    zh.push(`被 fork ${repo.forks} 次，说明有较多二次开发与参考`)
    en.push(`forked ${repo.forks} times, indicating active secondary development and reuse`)
  }
  const pushed = daysSince(repo.pushedAt)
  if (pushed !== null) {
    if (pushed <= 30) {
      zh.push(`最近 ${pushed} 天内有更新，维护活跃`)
      en.push(`updated within the last ${pushed} days, actively maintained`)
    } else if (pushed <= 180) {
      zh.push(`最近更新约 ${fmtMonths(pushed)} 个月前，维护节奏一般`)
      en.push(`last updated ~${fmtMonths(pushed)} months ago, moderate maintenance pace`)
    } else {
      zh.push(`已约 ${fmtMonths(pushed)} 个月未更新，可能已停滞，建议谨慎选用`)
      en.push(`~${fmtMonths(pushed)} months without updates, possibly stalled — use with caution`)
    }
  }
  if (repo.archived) {
    zh.push('⚠️ 已被作者归档，不建议新项目依赖')
    en.push('⚠️ archived by the author, not recommended for new projects')
  }
  return { zh: zh.join('；'), en: en.join('; ') }
}

/** 暂无 GitHub 星标时的排名理由（按 npm 综合分兜底），中英双语。 */
function rankReasonNpm(repo: PluginRepo, rank: number, total: number): BilingualText {
  const zh: string[] = []
  const en: string[] = []
  zh.push(`暂无 GitHub 星标数据（仓库未收录），暂按 npm 综合分排在第 ${rank}/${total} 名`)
  en.push(`No GitHub star data yet (repo not indexed); temporarily ranked #${rank}/${total} by npm composite score`)
  if (repo.npmFinal > 0) {
    zh.push(`npm 综合分 ${repo.npmFinal.toFixed(1)} 分，下载与使用越多分越高`)
    en.push(`npm composite score ${repo.npmFinal.toFixed(1)}, higher with more downloads and usage`)
  }
  const published = daysSince(repo.lastPublish)
  if (published !== null && published <= 90) {
    zh.push(`最近 ${published} 天内在 npm 发布了新版本，仍在持续维护`)
    en.push(`published a new version on npm within ${published} days, still actively maintained`)
  } else if (published !== null) {
    zh.push(`npm 上约 ${fmtMonths(published)} 个月未发布新版本，请关注维护情况`)
    en.push(`no new npm release in ~${fmtMonths(published)} months, check maintenance status`)
  }
  return { zh: zh.join('；'), en: en.join('; ') }
}

/** 按星标（已知者优先）排名，附带中英文双语理由。 */
export function rankByStars(repos: PluginRepo[]): RankedPlugin[] {
  const sorted = [...repos].sort((a, b) => {
    if (a.githubKnown !== b.githubKnown) return a.githubKnown ? -1 : 1
    if (a.githubKnown) return b.stars - a.stars || b.forks - a.forks
    return b.npmFinal - a.npmFinal
  })
  const total = sorted.length
  return sorted.map((repo, i) => {
    const text = repo.githubKnown ? rankReasonGitHub(repo, i + 1, total) : rankReasonNpm(repo, i + 1, total)
    return {
      rank: i + 1,
      repo,
      reason: text.zh,
      reasonEn: text.en,
    }
  })
}
