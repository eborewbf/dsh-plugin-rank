/**
 * 智能推荐：对全部插件做多维度加权评分，并按总分产出「推荐 + 分数 + 理由」。
 *
 * 与星标排名不同：排名只看星标，推荐综合「质量与生命力」——星标 / 热度、
 * 维护活跃度、健康度、增长势头。拿到 GitHub 数据时用真实指标；尚未补充
 * GitHub 数据的插件用 npm 官方评分（热度/质量/维护）兜底，保证人人可比。
 *
 * 理由同时输出中文（reasons）与英文（reasonsEn），两数组一一对应，
 * 供前端按语言偏好切换展示。
 */

import type { PluginRepo } from './github.js'

/** 一条带理由的推荐项（reasons 为中文，reasonsEn 为英文，一一对应）。 */
export interface RecommendedPlugin {
  rank: number
  /** 0-100 综合推荐分。 */
  score: number
  repo: PluginRepo
  /** 得分依据的中文理由，逐条可读。 */
  reasons: string[]
  /** 得分依据的英文理由，与 reasons 一一对应。 */
  reasonsEn: string[]
}

/** 各维度权重（合计 1.0）。 */
const WEIGHTS = {
  stars: 0.4,
  recency: 0.2,
  health: 0.2,
  growth: 0.2,
} as const

/** 对数缩放：让头部大星标项目不至于压垮其他维度。 */
function logScale(n: number): number {
  return Math.log10(1 + n)
}

/** 距今天数（解析失败返回 null）。 */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

/** 距今月数（用于增长势头计算）。 */
function monthsSince(iso: string | null | undefined): number {
  const days = daysSince(iso)
  return days === null ? 0 : days / 30
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

/**
 * 单插件四维指标（均归一化到 0-1）。
 * GitHub 数据缺失时，用 npm 官方评分兜底，保证与有星标插件同一口径可比。
 */
function metricsOf(repo: PluginRepo): {
  stars: number
  recency: number
  health: number
  growth: number
} {
  // npm 综合分归一化（npm 官方 final 分常见 0-40，除以 40 得 0-1）。
  const npmNorm = Math.min(1, repo.npmFinal / 40)

  // 星标/热度：有 GitHub 用星标对数归一；否则用 npm 综合分兜底。
  const stars = repo.githubKnown
    ? Math.min(1, logScale(repo.stars) / logScale(10_000))
    : npmNorm

  // 活跃度：取 GitHub 最近 push 或 npm 最近发布中较新的一个。
  const lastActive = repo.pushedAt ?? repo.lastPublish
  const days = daysSince(lastActive)
  const recency = days === null ? (repo.githubKnown ? 0 : npmNorm) : clamp01(1 - days / 365)

  // 健康度：有 GitHub 用 open issue / fork；否则用 npm 综合分兜底。
  const health = repo.githubKnown
    ? clamp01(1 - repo.openIssues / Math.max(1, repo.forks) / 10)
    : npmNorm

  // 增长势头：有 GitHub 用「星标密度」（星标/月龄）；否则用综合分与活跃度组合近似。
  const growth = repo.githubKnown
    ? Math.min(1, logScale(repo.stars) / Math.log10(1 + Math.max(0.5, monthsSince(repo.createdAt)) * 30))
    : clamp01((npmNorm + recency) / 2)

  return { stars, recency, health, growth }
}

/** 单插件综合评分（0-100）。 */
function scoreRepo(repo: PluginRepo): number {
  const m = metricsOf(repo)
  return 100 * (
    WEIGHTS.stars * m.stars +
    WEIGHTS.recency * m.recency +
    WEIGHTS.health * m.health +
    WEIGHTS.growth * m.growth
  )
}

/** 按得分从高到低取前 N 名推荐（已过滤归档项目）。 */
export function recommend(repos: PluginRepo[], top = 10): RecommendedPlugin[] {
  const scored = repos
    .filter((repo) => !repo.archived)
    .map((repo) => ({ repo, score: scoreRepo(repo) }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, top).map((item, i) => {
    const text = recommendReasons(item.repo, item.score)
    return {
      rank: i + 1,
      score: Math.round(item.score),
      repo: item.repo,
      reasons: text.zh,
      reasonsEn: text.en,
    }
  })
}

/** 生成推荐理由：挑出对得分贡献最大的事实，中英双语逐条对应。 */
function recommendReasons(repo: PluginRepo, score: number): { zh: string[]; en: string[] } {
  const zh: string[] = []
  const en: string[] = []
  const push = (z: string, e: string): void => {
    zh.push(z)
    en.push(e)
  }

  const lastActive = repo.pushedAt ?? repo.lastPublish
  const activeDays = daysSince(lastActive)

  if (repo.githubKnown) {
    if (repo.stars > 0) {
      if (repo.stars >= 500) {
        push(
          `社区认可的头部项目（GitHub 星标 ${fmtStars(repo.stars)}），质量与生态验证充分`,
          `Community-recognized top project (${fmtStars(repo.stars)} GitHub stars), well-validated quality and ecosystem`,
        )
      } else if (repo.stars >= 50) {
        push(
          `有一定社区基础（GitHub 星标 ${fmtStars(repo.stars)}），属于被验证过的选择`,
          `Has a community base (${fmtStars(repo.stars)} GitHub stars), a proven choice`,
        )
      } else {
        push(
          `尚在早期（GitHub 星标 ${fmtStars(repo.stars)}），适合尝鲜或参与共建`,
          `Early stage (${fmtStars(repo.stars)} GitHub stars), good for trying out or contributing`,
        )
      }
    }
    if (activeDays !== null) {
      if (activeDays <= 30) {
        push(`最近 ${activeDays} 天内仍在更新，维护活跃、Bug 响应及时`, `Still updated within the last ${activeDays} days — active maintenance, responsive bug fixes`)
      } else if (activeDays <= 180) {
        push(`近 ${Math.round(activeDays / 30)} 个月有更新，维护节奏稳定`, `Updated in the last ~${Math.round(activeDays / 30)} months, stable maintenance pace`)
      } else {
        push(`已约 ${Math.round(activeDays / 30)} 个月未更新，请关注维护持续性`, `~${Math.round(activeDays / 30)} months without updates, please watch maintenance continuity`)
      }
    }
  } else {
    if (repo.npmFinal > 0) {
      push(
        `npm 综合分 ${repo.npmFinal.toFixed(1)} 分，在 npm 生态中下载与使用情况较好`,
        `npm composite score ${repo.npmFinal.toFixed(1)}, solid downloads and usage in the npm ecosystem`,
      )
    }
    if (activeDays !== null && activeDays <= 90) {
      push(`最近 ${activeDays} 天内在 npm 发布了新版本，迭代活跃`, `Published a new version on npm within the last ${activeDays} days, actively iterating`)
    } else if (activeDays !== null) {
      push(`npm 上约 ${Math.round(activeDays / 30)} 个月未发布新版本，请关注维护持续性`, `No new npm release in ~${Math.round(activeDays / 30)} months, please watch maintenance continuity`)
    }
    push(
      '暂无 GitHub 星标数据，建议到仓库页查看详情与最新动态',
      'No GitHub star data yet; check the repo page for details and latest updates',
    )
  }

  const ageMonths = Math.max(0.5, monthsSince(repo.createdAt))
  const starPerMonth = repo.githubKnown ? repo.stars / ageMonths : 0
  if (repo.githubKnown && repo.stars >= 50 && starPerMonth >= 10) {
    push(
      `增长势头强劲（月均新增约 ${Math.round(starPerMonth)} 星），社区关注度上升快`,
      `Strong growth momentum (~${Math.round(starPerMonth)} new stars/month), rapidly rising community attention`,
    )
  }

  if (repo.githubKnown && repo.forks > 0 && repo.openIssues / repo.forks < 0.5) {
    push(
      'issue 相对 fork 比例健康，说明问题处理及时、项目处于可用状态',
      'Healthy issue-to-fork ratio, indicating prompt issue handling and usable state',
    )
  }

  if (repo.topics.some((t) => t.toLowerCase().includes('dsh'))) {
    push(
      '收录于 dsh 相关主题，与 DeepSeek Harness 生态直接相关',
      'Indexed under dsh-related topics, directly relevant to the DeepSeek Harness ecosystem',
    )
  }

  if (zh.length === 0) {
    push(
      '基础信息较少，建议前往仓库/ npm 页面查看 README 与最新动态',
      'Limited base info; check the README and latest updates on the repo/npm page',
    )
  }

  push(
    `综合推荐分 ${Math.round(score)}/100`,
    `Overall recommendation score ${Math.round(score)}/100`,
  )
  return { zh, en }
}
