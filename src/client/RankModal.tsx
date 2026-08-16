/**
 * dsh-plugin-rank 内嵌模态面板（browser half）。
 *
 * 仿 DSH 原生「设置」模态：全屏遮罩 + 居中面板，内容在面板内以 tab 切换
 * （星标排名 / 智能推荐 / 插件管理），不再跳转独立页面。数据从 host 侧
 * 托管的 `/plugin-rank/api/*` 同源拉取。
 *
 * 自包含约束：仅依赖 `react`（平台模块）与本目录的字典/CSS 字符串，不
 * import 任何 `@deepseek-ai/*` 运行时包。样式由 `pr-` 前缀类名 + 宿主主题
 * token 组成，挂载时注入一条 `<style id="dsh-plugin-rank-css">`。
 */
import { useEffect, useRef, useState } from 'react'
import type { RankKey } from './locales.ts'
import { en, zh } from './locales.ts'
import { RANK_CSS } from './rank.css.ts'

/** API 根路径（与 host 侧 web.ts 的 MARKET_BASE 保持一致）。 */
const API = '/plugin-rank/api'

/** 本地最小仓库模型（对应 host 侧 PluginRepo 的展示字段）。 */
interface PluginRepo {
  packageName: string
  version: string
  fullName: string | null
  description: string
  stars: number
  forks: number
  archived: boolean
  htmlUrl: string | null
  githubKnown: boolean
}

/** 星标排名项。 */
interface RankedItem {
  rank: number
  repo: PluginRepo
  reason: string
  reasonEn: string
}

/** 智能推荐项。 */
interface RecommendedItem {
  rank: number
  score: number
  repo: PluginRepo
  reasons: string[]
  reasonsEn: string[]
}

/** 排名/推荐接口的公共元信息。 */
interface MetaData {
  total: number
  fetchedAt: string
  source: string
  stats?: { githubKnown: number; withRepo: number; missingRepos: number; hasToken: boolean }
}

/** 详情（截图 + 评论）。 */
interface PluginDetail {
  fullName: string
  readmeExcerpt: string
  screenshots: { url: string; alt: string }[]
  reviews: {
    type: 'issue' | 'comment'
    title: string
    body: string
    url: string
    author: string
    createdAt: string
    labels: string[]
  }[]
}

/** 已安装信息。 */
interface InstalledInfo {
  bundles: string[]
  removable: string[]
  byRepo: Record<string, string>
}

/** 格式化星标数（1.2k / 340）。 */
function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

/** 简单转义（避免描述里的 HTML 注入）。 */
function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

/** 常用工具：把 host 侧返回的仓库对象规整为本地模型。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRepo(r: any): PluginRepo {
  return {
    packageName: String(r?.packageName ?? ''),
    version: String(r?.version ?? ''),
    fullName: r?.fullName ?? null,
    description: String(r?.description ?? ''),
    stars: Number(r?.stars ?? 0),
    forks: Number(r?.forks ?? 0),
    archived: Boolean(r?.archived),
    htmlUrl: r?.htmlUrl ?? null,
    githubKnown: Boolean(r?.githubKnown),
  }
}

/** 语言：从宿主页面持久化（与旧 host 页同一 key），en 优先。 */
function currentLang(): 'zh' | 'en' {
  try {
    return localStorage.getItem('dsh-rank-lang') === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

/** 是否开启中文描述翻译。 */
function translateOn(): boolean {
  try {
    return localStorage.getItem('dsh-rank-translate') === '1'
  } catch {
    return false
  }
}

/** 把后端英文描述翻译为中文（同源 API，未配置密钥时返回空串）。 */
async function translateText(text: string): Promise<string> {
  if (!text) return ''
  try {
    const res = await fetch(`${API}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const d = (await res.json()) as { zh?: string }
    return d.zh ?? ''
  } catch {
    return ''
  }
}

/** 注入一条 `dsh-plugin-rank` 样式（幂等）。 */
function injectStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('dsh-plugin-rank-css')) return
  const style = document.createElement('style')
  style.id = 'dsh-plugin-rank-css'
  style.textContent = RANK_CSS
  document.head.appendChild(style)
}

/**
 * 模态外壳：遮罩 + 面板 + tab 切换。
 * @param props - 关闭回调与翻译函数。
 * @returns 内嵌面板的元素树。
 */
export function RankModal({ onClose }: { onClose: () => void }) {
  useEffect(injectStyles, [])

  const [lang, setLang] = useState<'zh' | 'en'>(currentLang)
  const [tab, setTab] = useState<'ranking' | 'recommend' | 'manage'>('ranking')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  // 本地翻译器：由字典 + lang 状态派生，模态内全文可控（不随宿主 locale 漂移）。
  const t = (key: RankKey): string => (lang === 'en' ? en : zh)[key]

  // 数据缓存
  const [ranking, setRanking] = useState<{ meta: MetaData | null; list: RankedItem[] } | null>(null)
  const [recommend, setRecommend] = useState<{ meta: MetaData | null; list: RecommendedItem[] } | null>(null)
  const [installed, setInstalled] = useState<InstalledInfo | null>(null)
  const [manageList, setManageList] = useState<string[]>([])
  const [detailCache, setDetailCache] = useState<Record<string, PluginDetail>>({})

  // 详情展开状态
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // 加载状态
  const [loadingRank, setLoadingRank] = useState(true)
  const [loadingRec, setLoadingRec] = useState(false)
  const [loadingMan, setLoadingMan] = useState(false)
  const [recTop, setRecTop] = useState(10)

  // 安装/卸载进行中（按包名标记，用于按钮显示“安装中…/卸载中…”）
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  // 翻译描述
  const [translateOnState, setTranslateOnState] = useState(translateOn)
  const [descZh, setDescZh] = useState<Record<string, string>>({})

  // 大图
  const [lightbox, setLightbox] = useState<string | null>(null)

  // 关闭按钮聚焦
  const closeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => { closeRef.current?.focus() }, [])

  // Escape 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [onClose])

  // toast 自动消失
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  // 记住插件总数（推荐/管理页无 total 时兜底）
  const totalRef = useRef(0)
  const metaFor = (meta: MetaData | null): MetaData | null => {
    if (meta) { if (meta.total) totalRef.current = meta.total }
    return meta && meta.total ? meta : meta ? { ...meta, total: totalRef.current } : null
  }

  /** 拉取星标排名。 */
  const loadRanking = async () => {
    setLoadingRank(true)
    try {
      const res = await fetch(`${API}/ranking`)
      const d = (await res.json()) as { error?: string; list?: RankedItem[]; total?: number } & MetaData
      if (d.error) throw new Error(d.error)
      setRanking({ meta: metaFor(d), list: (d.list ?? []).map((i) => ({ ...i, repo: toRepo(i.repo) })) })
    } catch (err) {
      setToast({ msg: t('empty.loadfail') + String(err), ok: false })
    } finally {
      setLoadingRank(false)
    }
  }

  /** 拉取智能推荐。 */
  const loadRecommend = async () => {
    setLoadingRec(true)
    try {
      const res = await fetch(`${API}/recommend?top=${recTop}`)
      const d = (await res.json()) as { error?: string; list?: RecommendedItem[]; total?: number } & MetaData
      if (d.error) throw new Error(d.error)
      setRecommend({ meta: metaFor(d), list: (d.list ?? []).map((i) => ({ ...i, repo: toRepo(i.repo) })) })
    } catch (err) {
      setToast({ msg: t('empty.loadfail') + String(err), ok: false })
    } finally {
      setLoadingRec(false)
    }
  }

  /** 拉取已安装情况。 */
  const loadInstalled = async () => {
    setLoadingMan(true)
    try {
      const res = await fetch(`${API}/installed`)
      const d = (await res.json()) as InstalledInfo
      setInstalled(d)
      setManageList((d.removable ?? d.bundles ?? []))
    } catch (err) {
      setToast({ msg: t('empty.loadfail') + String(err), ok: false })
    } finally {
      setLoadingMan(false)
    }
  }

  // 首次挂载：注入样式 + 初始数据
  useEffect(() => {
    injectStyles()
    void loadRanking()
    void loadInstalled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchTab = (next: 'ranking' | 'recommend' | 'manage') => {
    setTab(next)
    if (next === 'ranking') void loadRanking()
    if (next === 'recommend') void loadRecommend()
    if (next === 'manage') void loadInstalled()
  }

  /** 切换界面语言（中文/EN），并持久化到宿主 localStorage。 */
  const switchLang = (next: 'zh' | 'en') => {
    setLang(next)
    try { localStorage.setItem('dsh-rank-lang', next) } catch {}
  }

  /** 安装插件。 */
  const install = async (pkgName: string) => {
    setBusy((p) => ({ ...p, [pkgName]: true }))
    try {
      const res = await fetch(`${API}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: pkgName }),
      })
      const d = (await res.json()) as { ok?: boolean; error?: string }
      if (d.ok) {
        setToast({ msg: t('toast.installed'), ok: true })
        await loadInstalled()
      } else {
        setToast({ msg: t('empty.loadfail') + (d.error ?? ''), ok: false })
      }
    } catch (err) {
      setToast({ msg: t('empty.loadfail') + String(err), ok: false })
    } finally {
      setBusy((p) => ({ ...p, [pkgName]: false }))
    }
  }

  /** 卸载插件。 */
  const remove = async (name: string) => {
    setBusy((p) => ({ ...p, [name]: true }))
    try {
      const res = await fetch(`${API}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const d = (await res.json()) as { ok?: boolean; error?: string }
      if (d.ok) {
        setToast({ msg: t('toast.uninstalled'), ok: true })
        await loadInstalled()
      } else {
        setToast({ msg: t('empty.loadfail') + (d.error ?? ''), ok: false })
      }
    } catch (err) {
      setToast({ msg: t('empty.loadfail') + String(err), ok: false })
    } finally {
      setBusy((p) => ({ ...p, [name]: false }))
    }
  }

  /** 拉取某插件详情（缓存优先）。 */
  const loadDetail = async (fullName: string) => {
    setExpanded((p) => ({ ...p, [fullName]: !p[fullName] }))
    if (detailCache[fullName]) return
    try {
      const res = await fetch(`${API}/detail?repo=${encodeURIComponent(fullName)}`)
      const d = (await res.json()) as PluginDetail & { error?: string }
      if (d.error) throw new Error(d.error)
      setDetailCache((p) => ({ ...p, [fullName]: d }))
    } catch (err) {
      setDetailCache((p) => ({ ...p, [fullName]: { fullName, readmeExcerpt: '', screenshots: [], reviews: [] } }))
      setToast({ msg: t('empty.loadfail') + String(err), ok: false })
    }
  }

  /** 判定某插件是否已安装。 */
  const isInstalled = (pkgName: string, fullName: string | null): boolean => {
    if (installed?.bundles?.includes(pkgName)) return true
    if (fullName && installed?.byRepo?.[fullName.toLowerCase()] !== undefined) return true
    return false
  }

  /** 是否已安装（用于 manage 页按包名判断）。 */
  const isBundleInstalled = (name: string): boolean => !!(installed?.bundles?.includes(name))

  /** 切换中文描述翻译。 */
  const toggleTranslate = () => {
    const next = !translateOnState
    setTranslateOnState(next)
    try { localStorage.setItem('dsh-rank-translate', next ? '1' : '0') } catch {}
  }

  /** 翻译所有卡片的英文描述（懒加载，按文本缓存）。 */
  const translateAll = async () => {
    const targets = new Set<string>()
    if (tab === 'ranking') ranking?.list.forEach((i) => i.repo.description && targets.add(i.repo.description))
    if (tab === 'recommend') recommend?.list.forEach((i) => i.repo.description && targets.add(i.repo.description))
    const pending: Record<string, string> = {}
    await Promise.all([...targets].map(async (text) => {
      if (descZh[text]) { pending[text] = descZh[text]; return }
      const zh = await translateText(text)
      if (zh) pending[text] = zh
    }))
    if (Object.keys(pending).length) setDescZh((p) => ({ ...p, ...pending }))
  }

  // 翻译开关变化时刷新
  useEffect(() => {
    if (translateOnState) void translateAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateOnState, tab])

  /** 渲染一张卡片的操作按钮（安装/卸载）。 */
  const renderActions = (pkgName: string, fullName: string | null) => {
    const installedNow = isInstalled(pkgName, fullName)
    const isBusy = !!busy[pkgName]
    return (
      <div className="pr-actions">
        {!installedNow && (
          <button
            type="button"
            className="pr-install"
            disabled={isBusy}
            onClick={() => void install(pkgName)}
          >{isBusy ? t('installing') : t('install')}</button>
        )}
        {installedNow && (
          <button
            type="button"
            className="pr-remove"
            disabled={isBusy}
            onClick={() => void remove(pkgName)}
          >{isBusy ? t('uninstalling') : t('uninstall')}</button>
        )}
      </div>
    )
  }

  /** 渲染详情的展开/收起 + 截图 + 评论。 */
  const renderDetail = (repo: PluginRepo) => {
    if (!repo.fullName) return null
    const open = !!expanded[repo.fullName]
    const detail = detailCache[repo.fullName]
    return (
      <>
        <button type="button" className="pr-expand" onClick={() => void loadDetail(repo.fullName!)}>
          {open ? t('detail.collapse') : t('detail.expand')}
        </button>
        {open && detail && (
          <div className="pr-detail">
            {detail.readmeExcerpt && <div className="pr-detail-empty">{detail.readmeExcerpt}</div>}
            {detail.screenshots.length > 0 && (
              <>
                <h4>{t('detail.shots')} <span className="n">({detail.screenshots.length})</span></h4>
                <div className="pr-shots">
                  {detail.screenshots.map((s, i) => (
                    <div className="pr-shot" key={s.url + i}>
                      <img loading="lazy" src={s.url} alt={s.alt} onClick={() => setLightbox(s.url)} />
                      <div className="cap">{s.alt}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {detail.reviews.length > 0 && (
              <>
                <h4>{t('detail.reviews')} <span className="n">({detail.reviews.length})</span></h4>
                <div className="pr-reviews">
                  {detail.reviews.map((v, i) => (
                    <div className="pr-review" key={i}>
                      <div className="rh">
                        <span className={`t ${v.type}`}>{v.type === 'issue' ? t('review.issue') : t('review.reply')}</span>
                        {v.title && <span className="t">{v.title}</span>}
                        <span className="au">@{v.author}</span>
                        <time>{String(v.createdAt || '').slice(0, 10)}</time>
                      </div>
                      <div className="b" dangerouslySetInnerHTML={{
                        __html: `${esc(v.body)} <a href="${esc(v.url)}" target="_blank" rel="noopener">↗</a>`,
                      }} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {detail.screenshots.length === 0 && detail.reviews.length === 0 && (
              <div className="pr-detail-empty">{t('detail.empty')}</div>
            )}
          </div>
        )}
        {open && !detail && <div className="pr-loader">{t('detail.loading')}</div>}
      </>
    )
  }

  /** 渲染带中文描述行的卡片主体。 */
  const renderCardBody = (repo: PluginRepo, extra: React.ReactNode) => {
    const showZh = translateOnState && repo.description && descZh[repo.description]
    return (
      <div className="pr-card-body">
        <div className="pr-name">
          {repo.htmlUrl
            ? <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer">{repo.packageName}</a>
            : repo.packageName}
          {repo.githubKnown && repo.stars > 0 && <span className="pr-stars">★ {fmtStars(repo.stars)}</span>}
          <br />
          <span className="pr-pkg">{repo.fullName || ''} v{repo.version}</span>
        </div>
        {repo.description && <div className="pr-desc">{repo.description}</div>}
        {showZh && <div className="pr-desc-zh">{t('desc.zh')}：{descZh[repo.description]}</div>}
        {extra}
        {renderDetail(repo)}
      </div>
    )
  }

  /** 星标排名 tab。 */
  const renderRanking = () => {
    const list = ranking?.list ?? []
    return (
      <>
        <div className="pr-toolbar">
          <button type="button" className="pr-btn primary" onClick={() => void loadRanking()}>{t('btn.refresh')}</button>
          <button type="button" className="pr-btn" onClick={() => void loadRanking()}>{t('btn.enrich')}</button>
          <button type="button" className={`pr-btn ${translateOnState ? 'active' : ''}`} onClick={toggleTranslate}>
            {translateOnState ? t('desc.zhOn') : t('desc.zh')}
          </button>
          <span className="spacer" />
          <span className="pr-status">{loadingRank ? t('empty.loading') : t('status.rank.done')}</span>
        </div>
        <div className="pr-list">
          {loadingRank && !list.length && <div className="pr-empty">{t('empty.loading')}</div>}
          {!loadingRank && !list.length && <div className="pr-empty">{t('empty.nodata')}</div>}
          {list.map((item) => (
            <div className="pr-card" key={item.repo.packageName}>
              <div className="pr-idx">#{item.rank}</div>
              {renderCardBody(item.repo, (
                <div className="pr-reason">{lang === 'en' ? (item.reasonEn || item.reason) : item.reason}</div>
              ))}
              {renderActions(item.repo.packageName, item.repo.fullName)}
            </div>
          ))}
        </div>
      </>
    )
  }

  /** 智能推荐 tab。 */
  const renderRecommend = () => {
    const list = recommend?.list ?? []
    return (
      <>
        <div className="pr-toolbar">
          <label className="pr-status">{t('label.top')}</label>
          <select className="pr-select" value={recTop} onChange={(e) => setRecTop(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
          <button type="button" className="pr-btn primary" onClick={() => void loadRecommend()}>{t('btn.refresh')}</button>
          <button type="button" className={`pr-btn ${translateOnState ? 'active' : ''}`} onClick={toggleTranslate}>
            {translateOnState ? t('desc.zhOn') : t('desc.zh')}
          </button>
          <span className="spacer" />
          <span className="pr-status">{loadingRec ? t('empty.loading') : `${t('status.top')} ${list.length}`}</span>
        </div>
        <div className="pr-list">
          {loadingRec && !list.length && <div className="pr-empty">{t('empty.loading')}</div>}
          {!loadingRec && !list.length && <div className="pr-empty">{t('empty.norec')}</div>}
          {list.map((item) => (
            <div className="pr-card" key={item.repo.packageName}>
              <div className="pr-idx">
                <span className="pr-score">{item.score}</span>
                <br />
                <span className="pr-score-total">/100</span>
              </div>
              {renderCardBody(item.repo, (
                <ul className="pr-reasons">
                  {(lang === 'en' && item.reasonsEn.length ? item.reasonsEn : item.reasons).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ))}
              {renderActions(item.repo.packageName, item.repo.fullName)}
            </div>
          ))}
        </div>
      </>
    )
  }

  /** 插件管理 tab。 */
  const renderManage = () => {
    return (
      <>
        <div className="pr-toolbar">
          <button type="button" className="pr-btn primary" onClick={() => void loadInstalled()}>{t('btn.refresh')}</button>
          <span className="spacer" />
          <span className="pr-status">
            {loadingMan ? t('empty.loading') : `${manageList.length} ${t('status.installed')}`}
          </span>
        </div>
        <div className="pr-list">
          {loadingMan && !manageList.length && <div className="pr-empty">{t('empty.loading')}</div>}
          {!loadingMan && !manageList.length && <div className="pr-empty">{t('status.zero')}</div>}
          {manageList.map((name) => (
            <div className="pr-card" key={name}>
              <div className="pr-idx">📦</div>
              <div className="pr-card-body">
                <div className="pr-name">{name}</div>
                <div className="pr-desc">{t('manage.tip')}</div>
              </div>
              <div className="pr-actions">
                <button type="button" className="pr-remove" disabled={!!busy[name]} onClick={() => void remove(name)}>{busy[name] ? t('uninstalling') : t('uninstall')}</button>
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="pr-scope">
      <div className="pr-overlay" role="presentation">
        <div className="pr-mask" aria-hidden="true" onClick={onClose} />
        <div className="pr-panel" role="dialog" aria-modal="true" aria-label={t('modal.title')}>
          <div className="pr-header">
            <span className="pr-title">{t('modal.title')}</span>
            <span className="pr-badge">dsh-plugin-rank</span>
            <span className="pr-spacer" />
            <span className="pr-lang" role="group" aria-label="language">
              <button type="button" className={`pr-lang-btn ${lang === 'zh' ? 'active' : ''}`} onClick={() => switchLang('zh')}>中文</button>
              <button type="button" className={`pr-lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => switchLang('en')}>EN</button>
            </span>
            <button ref={closeRef} type="button" className="pr-close" aria-label={t('modal.close')} onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="pr-tabs">
            <button type="button" className={`pr-tab ${tab === 'ranking' ? 'active' : ''}`} onClick={() => switchTab('ranking')}>{t('tab.ranking')}</button>
            <button type="button" className={`pr-tab ${tab === 'recommend' ? 'active' : ''}`} onClick={() => switchTab('recommend')}>{t('tab.recommend')}</button>
            <button type="button" className={`pr-tab ${tab === 'manage' ? 'active' : ''}`} onClick={() => switchTab('manage')}>{t('tab.manage')}</button>
          </div>
          <div className="pr-body">
            {tab === 'ranking' && renderRanking()}
            {tab === 'recommend' && renderRecommend()}
            {tab === 'manage' && renderManage()}
          </div>
        </div>
      </div>
      {lightbox && (
        <div className="pr-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
      {toast && <div className={`pr-toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>}
    </div>
  )
}