#!/usr/bin/env node
/**
 * 端到端验证脚本：用真实数据验证「发现（npm 主数据源 + GitHub 增强）
 * → 补充星标 → 排名（含理由）→ 推荐（含理由）」。
 *
 * 用法（先 build）：
 *   node scripts/verify.mjs
 * 可选：设置 GITHUB_TOKEN 可显著提高 GitHub 补充星标的额度（5000/小时）。
 */
import { PluginDiscovery } from '../lib/discovery.js'

const TTL_MS = 6 * 60 * 60 * 1000
const discovery = new PluginDiscovery(TTL_MS)

function fmtStats(s) {
  return `npm 插件 ${s.npmTotal} 个 · 有 GitHub 仓库 ${s.withRepo} · 已补充星标 ${s.githubKnown} · 待补充 ${s.missingRepos}${s.hasToken ? ' · 已设置 GITHUB_TOKEN' : ''}`
}

console.log('== 1) 发现插件（npm 主数据源 + GitHub 增强） ==')
let result = await discovery.discover()
console.log(`来源: ${result.source} | ${fmtStats(result.stats)}`)
if (result.notice) console.log(`提示: ${result.notice}`)

const { rankByStars } = await import('../lib/ranking.js')
const { recommend } = await import('../lib/recommend.js')

console.log('\n== 2) 星标排名 Top 12（含排名理由） ==')
for (const item of rankByStars(result.repos).slice(0, 12)) {
  console.log(`#${item.rank} ${item.repo.fullName ?? item.repo.packageName}  ${item.repo.githubKnown ? '★' + item.repo.stars : 'npm分' + item.repo.npmFinal.toFixed(1)}  [${item.repo.packageName}]`)
  console.log(`   理由: ${item.reason}`)
}

console.log('\n== 3) 智能推荐 Top 12（含推荐分与理由） ==')
for (const item of recommend(result.repos, 12)) {
  console.log(`#${item.rank} ${item.repo.fullName ?? item.repo.packageName}  推荐分 ${item.score}/100`)
  for (const r of item.reasons) console.log(`   - ${r}`)
}

console.log('\n== 4) 补充 GitHub 星标（逐仓库增强，受 API 限额） ==')
const enrichRes = await discovery.enrich()
console.log(enrichRes.message)

console.log('\n== 5) 重组后最新统计与排名 Top 10 ==')
result = await discovery.discover()
console.log(`来源: ${result.source} | ${fmtStats(result.stats)}`)
if (result.notice) console.log(`提示: ${result.notice}`)
for (const item of rankByStars(result.repos).slice(0, 10)) {
  console.log(`#${item.rank} ${item.repo.fullName ?? item.repo.packageName}  ${item.repo.githubKnown ? '★' + item.repo.stars : 'npm分' + item.repo.npmFinal.toFixed(1)}  [${item.repo.packageName}]`)
}

console.log('\n验证完成。')
