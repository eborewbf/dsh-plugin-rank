/**
 * `dsh-plugin-rank` 客户端命名空间字典：侧边栏入口 + 内嵌模态面板文案。
 * zh 为 key 定义源，en 与 zh 保持 key 完全一致。
 */

/** 本插件拥有的字典命名空间。 */
export const NS = 'plugin-rank'

/** 简体中文字典（key 定义源）。 */
export const zh = {
  label: '插件排名',
  description: 'DSH 插件排名与推荐中心',

  // 模态面板
  'modal.title': 'DSH 插件排名与推荐中心',
  'modal.close': '关闭',
  'tab.ranking': '⭐ 星标排名',
  'tab.recommend': '💡 智能推荐',
  'tab.manage': '📦 插件管理',

  // 工具栏 / 状态
  'btn.refresh': '刷新数据',
  'btn.enrich': '补充星标',
  'label.top': '推荐数量',
  'status.rank.done': '已按星标降序排名',
  'status.top': '综合评分 Top',
  'status.installed': '个已安装',
  'status.zero': '还没有安装任何插件',

  // 空态 / 加载
  'empty.loading': '加载中…',
  'empty.nodata': '暂无数据',
  'empty.norec': '暂无推荐',
  'empty.loadfail': '加载失败：',

  // 安装 / 卸载
  install: '安装',
  installed: '已安装',
  installing: '安装中…',
  uninstall: '卸载',
  uninstalling: '卸载中…',
  'toast.installed': '安装成功，重启 dsh web 后生效。',
  'toast.uninstalled': '卸载成功，重启 dsh web 后生效。',
  'manage.tip': '已加入 profile 插件层（dsh.profile.bundles）',

  // 详情（截图 + 评论）
  'detail.expand': '▸ 查看效果截图与评论',
  'detail.collapse': '▾ 收起详情',
  'detail.loading': '加载详情中…（首次需从 GitHub 抓取）',
  'detail.shots': '效果截图 / 演示',
  'detail.reviews': '评论与反馈',
  'review.issue': 'Issue',
  'review.reply': '回复',
  'detail.empty': '暂未抓取到截图或评论（README 可能没有图片，或仓库没有 Issue）。',

  // 翻译
  'desc.zh': '中文描述',
  'desc.zhOn': '中文描述：开',
} as const

/** 英文字典，与 zh 的 key 完全对齐。 */
export const en: Record<RankKey, string> = {
  label: 'Plugin Rank',
  description: 'DSH plugin ranking & recommendation center',

  'modal.title': 'DSH Plugin Ranking & Recommendation Center',
  'modal.close': 'Close',
  'tab.ranking': '⭐ Star Ranking',
  'tab.recommend': '💡 Recommend',
  'tab.manage': '📦 Manage',

  'btn.refresh': 'Refresh',
  'btn.enrich': 'Enrich Stars',
  'label.top': 'Top N',
  'status.rank.done': 'Sorted by stars (desc)',
  'status.top': 'Top by score',
  'status.installed': 'installed',
  'status.zero': 'Nothing installed yet',

  'empty.loading': 'Loading…',
  'empty.nodata': 'No data',
  'empty.norec': 'No recommendations',
  'empty.loadfail': 'Failed to load: ',

  install: 'Install',
  installed: 'Installed',
  installing: 'Installing…',
  uninstall: 'Uninstall',
  uninstalling: 'Uninstalling…',
  'toast.installed': 'Installed; restart dsh web to apply.',
  'toast.uninstalled': 'Uninstalled; restart dsh web to apply.',
  'manage.tip': 'Added to profile plugin layer (dsh.profile.bundles)',

  'detail.expand': '▸ View screenshots & reviews',
  'detail.collapse': '▾ Collapse',
  'detail.loading': 'Loading details… (fetched from GitHub on first view)',
  'detail.shots': 'Screenshots / Demos',
  'detail.reviews': 'Reviews & Feedback',
  'review.issue': 'Issue',
  'review.reply': 'Reply',
  'detail.empty': 'No screenshots or reviews found (README may have no images, or no issues).',

  'desc.zh': 'CN desc',
  'desc.zhOn': 'CN desc: on',
}

/** 本命名空间的 key 域（zh 为源）。 */
export type RankKey = keyof typeof zh