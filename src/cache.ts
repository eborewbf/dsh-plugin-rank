/**
 * 本地文件缓存与 DSH 目录解析。
 *
 * DSH 的 profile 目录：`$DSH_HOME/profiles/<profile>`，默认 `~/.dsh/profiles/web`。
 * 所有缓存文件存放在 `$DSH_HOME/plugin-rank/` 下，避免污染 profile。
 *
 * 缓存分层（各自独立 TTL）：
 *   - github.json   GitHub topic 池（批量星标增强，廉价）
 *   - npm.json      npm 插件主数据（插件宇宙）
 *   - repos.json    逐仓库 GitHub 增强（高星标覆盖，受 API 限额）
 *   - market.json   合并后的最终插件列表（排名/推荐消费它）
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** 带时间戳的缓存条目。 */
export interface CacheEntry<T> {
  savedAt: number
  data: T
}

/** 解析 DSH 家目录（`$DSH_HOME`，空白视为未设置，回退 `~/.dsh`）。 */
export function resolveDshHome(): string {
  const fromEnv = process.env.DSH_HOME
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : join(homedir(), '.dsh')
}

/** 解析某 profile 的目录（默认 web）。 */
export function profileDir(profile = 'web'): string {
  return join(resolveDshHome(), 'profiles', profile)
}

/** 插件自己的数据目录（缓存、本地状态）。 */
export function pluginDataDir(): string {
  return join(resolveDshHome(), 'plugin-rank')
}

/** 各类缓存的文件路径。 */
export function cacheFile(kind: 'github' | 'npm' | 'repos' | 'market' = 'github'): string {
  return join(pluginDataDir(), `${kind}-cache.json`)
}

/** 简单的 TTL 文件缓存。读写失败都不会影响主流程。 */
export class FileCache {
  constructor(
    private readonly file: string,
    private readonly ttlMs: number,
  ) {}

  read<T>(): T | null {
    try {
      const entry = JSON.parse(readFileSync(this.file, 'utf8')) as CacheEntry<T>
      if (Date.now() - entry.savedAt > this.ttlMs) return null
      return entry.data
    } catch {
      return null
    }
  }

  write<T>(data: T): void {
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify({ savedAt: Date.now(), data } satisfies CacheEntry<T>, null, 2))
    } catch {
      /* 缓存写入失败不应影响主流程 */
    }
  }
}
