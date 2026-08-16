# dsh-plugin-rank

DeepSeek Harness 插件排名与推荐中心 —— 一个把 GitHub / npm 上全部 DSH 插件「聚合、排名、推荐、管理」的插件。

> GitHub 上 DeepSeek Harness 的插件越来越多，逐个逛仓库太费时间。本插件把所有插件集中到一个页面：
> **星标排名（含理由）**、**智能推荐（含理由）**、**一键安装 / 卸载**。

## ✨ 功能

| 功能 | 说明 |
| --- | --- |
| ⭐ 星标排名 | 按 GitHub 星标数对全部插件排序，并为每一项写清「为什么排在这里」：星标数、相对名次、被 fork 情况、维护活跃度、是否已归档。 |
| 💡 智能推荐 | 不止看星标：综合维护活跃度、issue 健康度、增长势头，给出 0-100 推荐分并逐条列出推荐理由。 |
| 📦 插件管理 | 页面内一键安装 / 卸载，复用 DSH 官方同款 pnpm 机制，自动写回 `dsh.profile.bundles`。 |

### 有什么作用 / 用途 / 好处
- **省时**：不用逐个逛 GitHub，一次看清 DSH 插件生态全景。
- **避坑**：排名理由会标注「长期未更新」「已被归档」的插件，避免装到过时、废弃的项目。
- **选得准**：星标高 ≠ 适合你；推荐分综合活跃度与健康度，帮你挑「活着且在进步」的插件。
- **装得快**：看到就装、不要就卸，全部在页面内完成。

## 🚀 快速开始

### 1. 构建

```sh
pnpm install
pnpm build        # 产出 lib/
```

### 2. 安装到 DSH

方式 A（推荐，页面内安装后重启生效）：

```sh
cd deepseek-harness
pnpm -r build     # 先构建官方源码
dsh plugin add dsh-plugin-rank   # 或直接 `dsh plugin add <本项目本地路径>`
```

方式 B（本地路径安装，便于开发）：

```sh
dsh plugin add "file:d:/SourceCode/DSHarness_APP/dsh-plugin-rank"
```

> 安装本质是把这个包加入 profile 的依赖，并把包名写入 `dsh.profile.bundles`。
> 修改 `cordis.patch.yml` 或代码后需重新 `pnpm build` 并重启 `dsh web`。

### 3. 打开页面

```sh
dsh web
# 浏览器打开
http://127.0.0.1:3080/plugin-rank/
```

## 🔌 如何工作

- 插件发现：以 npm `dsh-plugin` 关键字为主数据源（保证「是真插件」），GitHub Search API 按主题 `dsh-plugin` 等做星标增强，结果缓存 6 小时。
- 页面与 API：通过 DSH 的 `webServer` 服务在 `/plugin-rank/*` 下注册路由（host 侧插件，无需改动 DSH 官方前端）。
- 安装 / 卸载：在 `~/.dsh/profiles/web` 目录执行 `pnpm add|remove`，再按「已安装依赖是否声明 `dsh.bundle.patch`」重算 `dsh.profile.bundles`（与官方 `dsh plugin` 等价）。

### API 一览

| 接口 | 说明 |
| --- | --- |
| `GET /plugin-rank/api/discovery` | 发现结果（含来源 live/cache 与提示） |
| `GET /plugin-rank/api/ranking` | 星标排名（含理由） |
| `GET /plugin-rank/api/recommend?top=N` | 智能推荐（含分数与理由） |
| `GET /plugin-rank/api/installed` | 已安装情况（bundles / 按仓库映射） |
| `POST /plugin-rank/api/install` | `{ spec: 'owner/repo' \| 'npm 包名' }` |
| `POST /plugin-rank/api/remove` | `{ name: '包名' }` |
| `POST /plugin-rank/api/translate` | `{ text: '英文' }` → `{ zh: '中文' }`（百度翻译，可选） |

## ⚙️ 配置

- **翻译（可选）**：设置环境变量 `BAIDU_APPID` 与 `BAIDU_SECRET_KEY`（[百度翻译开放平台](https://fanyi-api.baidu.com/) 免费申请的通用文本翻译密钥）后，页面「🌐 中文描述」开关即可把插件描述翻译为中文。未配置时该开关自动静默失效。
- 设置环境变量 `GITHUB_TOKEN` 可提高 GitHub API 限额，获得更全的数据。
- 数据目录：`$DSH_HOME/plugin-rank/`（默认 `~/.dsh/plugin-rank/`）。

> ⚠️ 密钥安全：所有密钥都通过**环境变量**在运行时注入，**切勿把密钥写进源码或提交到仓库**。仓库中只提供 `.env.example` 占位模板。

## 🛠️ 开发

```sh
pnpm install
pnpm build
pnpm verify     # 用真实 GitHub 数据端到端验证排名/推荐/理由输出
```

## 📦 开源发布

```sh
git init
git add .
git commit -m "feat: dsh plugin rank (ranking + recommendation + management)"
git branch -M main
git remote add origin git@github.com:<你的用户名>/dsh-plugin-rank.git
git push -u origin main
# 然后发布到 npm（可选）：
npm publish
```

发布到 npm 后，任何人即可 `dsh plugin add dsh-plugin-rank` 一键安装。

## 📄 License

[MIT](./LICENSE)
