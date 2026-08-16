/**
 * 插件安装 / 卸载管理。
 *
 * DSH 的插件安装本质是在 profile 目录（如 `~/.dsh/profiles/web`）里用 pnpm
 * 管理依赖，并把「声明了 dsh.bundle.patch 的包」写入 `dsh.profile.bundles`
 * 作为插件层。这里用与官方 `dsh plugin` 等价的流程实现：
 *
 * 1. 在 profile 目录执行 `pnpm add|remove <spec>`；
 * 2. 依据「已安装依赖是否声明 dsh.bundle」重算 `dsh.profile.bundles`。
 *
 * 依赖 pnpm 在 PATH 上（与官方 `dsh plugin` 一致）。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { profileDir } from './cache.js'

/** 一次安装/卸载操作的结果。 */
export interface ManageResult {
  ok: boolean
  command: string
  output: string
  error?: string
  /** 操作后重算得到的 bundles 名单。 */
  bundles: string[]
}

/** 读取 profile 的 package.json。 */
function readProfilePackage(profile: string): { manifest: Record<string, unknown>; dir: string } {
  const dir = profileDir(profile)
  const file = join(dir, 'package.json')
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    manifest = {}
  }
  return { manifest, dir }
}

/** 读取 `dsh.profile.bundles` 名单。 */
export function installedBundles(profile = 'web'): string[] {
  const { manifest } = readProfilePackage(profile)
  const dsh = manifest.dsh as { profile?: { bundles?: string[] } } | undefined
  return dsh?.profile?.bundles ?? []
}

/**
 * 可卸载的插件名单：仅包含「确实是 profile 直接依赖」的 bundle。
 * 基础 bundle（如 @deepseek-ai/dsh-base、@deepseek-ai/dsh-web-app）由 profile
 * 组合注入、不在 dependencies 中，不在可卸载之列。
 */
export function installedRemovable(profile = 'web'): string[] {
  const { manifest } = readProfilePackage(profile)
  const deps = (manifest.dependencies ?? {}) as Record<string, string>
  return installedBundles(profile).filter((name) => deps[name] !== undefined)
}

/** 某包名是否已是 profile 的直接依赖。 */
function isDependency(name: string, profile: string): boolean {
  const { manifest } = readProfilePackage(profile)
  const deps = (manifest.dependencies ?? {}) as Record<string, string>
  return deps[name] !== undefined
}

/** 某包是否声明了 `dsh.bundle.patch`（即是否是一个 bundle）。 */
function isBundlePackage(dir: string, name: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
    }
    return pkg.dsh?.bundle?.patch !== undefined
  } catch {
    return false
  }
}

/** 在指定目录执行 pnpm。 */
function runPnpm(args: string[], dir: string): ManageResult {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const res = spawnSync(cmd, args, {
    cwd: dir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  const output = `${res.stdout ?? ''}\n${res.stderr ?? ''}`.trim()
  return {
    ok: res.status === 0,
    command: `pnpm ${args.join(' ')}`,
    output,
    bundles: [],
    ...(res.error ? { error: String(res.error) } : {}),
  }
}

/**
 * 依据已安装依赖与 `dsh.bundle` 声明，把「已是直接依赖且声明 bundle」的包
 * 补进 `dsh.profile.bundles` 层栈（对齐官方 reconcilePlugins 的增量语义）。
 *
 * 这里只做「增量添加」，不做通用删除：基础 bundle（如 @deepseek-ai/dsh-base、
 * @deepseek-ai/dsh-web-app）由 profile 组合注入，并不在 dependencies 中，
 * 若在此按「非依赖即删」会误删，导致 webServer 等基础服务缺失。卸载时由
 * `remove()` 单独从层栈剔除目标包。
 */
export function reconcileBundles(profile = 'web'): void {
  const { manifest, dir } = readProfilePackage(profile)
  const deps = Object.keys((manifest.dependencies ?? {}) as Record<string, string>)
  const bundles = [...installedBundles(profile)]
  let changed = false

  for (const dep of deps) {
    if (isBundlePackage(dir, dep) && !bundles.includes(dep)) {
      bundles.push(dep)
      changed = true
    }
  }
  if (changed) {
    const dsh = (manifest.dsh ?? {}) as { profile?: { bundles?: string[] } }
    manifest.dsh = { ...dsh, profile: { ...(dsh.profile ?? {}), bundles } }
    writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2))
  }
}

/** 安装插件。spec 可以是 npm 包名或 GitHub 的 owner/repo。 */
export function install(spec: string, profile = 'web'): ManageResult {
  const { dir } = readProfilePackage(profile)
  const res = runPnpm(['--filter', '@deepseek-ai/dsh-profile', 'add', spec], dir)
  if (res.ok) {
    try {
      reconcileBundles(profile)
    } catch (err) {
      res.error = `pnpm 成功，但重算 bundles 失败：${err instanceof Error ? err.message : String(err)}`
    }
  }
  return { ...res, bundles: installedBundles(profile) }
}

/** 卸载插件。name 是已安装的包名。 */
export function remove(name: string, profile = 'web'): ManageResult {
  const { dir } = readProfilePackage(profile)
  const res = runPnpm(['--filter', '@deepseek-ai/dsh-profile', 'remove', name], dir)
  if (res.ok) {
    try {
      // 先重算新增，再把目标包从层栈剔除（不动基础 bundle）。
      reconcileBundles(profile)
      stripBundle(name, profile)
    } catch (err) {
      res.error = `pnpm 成功，但重算 bundles 失败：${err instanceof Error ? err.message : String(err)}`
    }
  }
  return { ...res, bundles: installedBundles(profile) }
}

/** 把某个包名从 `dsh.profile.bundles` 层栈中剔除（幂等）。 */
function stripBundle(name: string, profile = 'web'): void {
  const { manifest, dir } = readProfilePackage(profile)
  const bundles = [...installedBundles(profile)]
  const at = bundles.indexOf(name)
  if (at === -1) return
  bundles.splice(at, 1)
  const dsh = (manifest.dsh ?? {}) as { profile?: { bundles?: string[] } }
  manifest.dsh = { ...dsh, profile: { ...(dsh.profile ?? {}), bundles } }
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest, null, 2))
}

/**
 * 扫描 profile 已安装包，把 `owner/repo` 映射到其包名，用于界面标记「已安装」。
 * 依据每个包的 package.json 里的 repository.url 判断。
 */
export function mapInstalledByRepo(profile = 'web'): Record<string, string> {
  const result: Record<string, string> = {}
  const { manifest, dir } = readProfilePackage(profile)
  const deps = Object.keys((manifest.dependencies ?? {}) as Record<string, string>)
  const modulesDir = join(dir, 'node_modules')

  for (const name of deps) {
    let pkg: { repository?: { url?: string } | string } | undefined
    try {
      const raw = readFileSync(join(modulesDir, name, 'package.json'), 'utf8')
      pkg = JSON.parse(raw) as { repository?: { url?: string } | string }
    } catch {
      continue
    }
    if (!pkg?.repository) continue
    const repository = pkg.repository
    const url = typeof repository === 'string' ? repository : repository.url
    if (!url) continue
    // 归一化：支持 git+https://github.com/a/b.git、https://github.com/a/b、git@github.com:a/b.git
    const match = /github\.com[/:]([^/]+)\/([^/.#]+)/.exec(url)
    if (match) {
      result[`${match[1]}/${match[2]}`.toLowerCase()] = name
    }
  }
  return result
}

/** 判断插件排名中心是否已安装本插件（用于首次使用提示）。 */
export function selfInstalled(profile = 'web'): boolean {
  return isDependency('dsh-plugin-rank', profile)
}
