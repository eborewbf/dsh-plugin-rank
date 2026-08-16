# dsh-plugin-rank

> **DeepSeek Harness 插件排名与推荐中心** —— 把 GitHub / npm 上全部 DSH 插件「聚合、排名、推荐、管理」到同一个页面。

<p align="center">
  <a href="https://github.com/eborewbf/dsh-plugin-rank/blob/main/README.md">English</a> · <a href="./README.zh.md">中文</a>
</p>

## 🎯 为什么你需要它

DSH 插件生态已经有**几千个**「插件」，但绝大多数是噪音：

- 🎭 **蹭热度 / 蹭流量的**：只是把 `dsh-plugin` 当营销话题贴上去，根本不是真正的 DSH 专属插件。
- 🧰 **伪插件**：只是支持多个 agent CLI 的通用工具，打着 `dsh-plugin` 旗号。
- ❓ **好坏难辨**：到底哪个好用？哪个不能用？哪个效果差？

**挨个逛仓库要花好几天。** 这个项目帮你过滤噪音，不再靠猜：

- ⭐ 按**真实 GitHub 星标**排名，而不是看谁自吹自擂。
- 💡 按**活跃度 + issue 健康度 + 增长势头**推荐，而不是看谁的声量高。
- 🏷 把**长期未更新 / 已归档**的插件标出来，避免装到死掉、过时的东西。

**告别试错成本。一眼看清 DSH 插件生态全景，快速选对插件。**

## ✨ 功能

- ⭐ **星标排名**：按 GitHub 星标数排序，并写清每一项的排名理由（星标、名次、fork、维护活跃度、是否归档）。
- 💡 **智能推荐**：综合维护活跃度、issue 健康度、增长势头，给出 0-100 推荐分与逐条理由。
- 📦 **插件管理**：页面内一键安装 / 卸载，复用 DSH 官方 pnpm 机制，自动写回 `dsh.profile.bundles`。

## 🚀 快速开始

```sh
# 1. 构建
pnpm install
pnpm build

# 2. 安装到 DSH（页面内安装后重启生效）
dsh plugin add dsh-plugin-rank

# 3. 打开页面
dsh web
# 浏览器打开 http://127.0.0.1:3080/plugin-rank/
```

## 🔌 API

| 接口 | 说明 |
| --- | --- |
| `GET /plugin-rank/api/discovery` | 发现结果（来源 live/cache 与提示） |
| `GET /plugin-rank/api/ranking` | 星标排名（含理由） |
| `GET /plugin-rank/api/recommend?top=N` | 智能推荐（含分数与理由） |
| `GET /plugin-rank/api/installed` | 已安装情况 |
| `POST /plugin-rank/api/install` | `{ spec: 'owner/repo' \| 'npm 包名' }` |
| `POST /plugin-rank/api/remove` | `{ name: '包名' }` |
| `POST /plugin-rank/api/translate` | `{ text: '英文' }` → `{ zh: '中文' }`（百度翻译，可选） |

## ⚙️ 配置

- **翻译（可选）**：设置环境变量 `BAIDU_APPID` 与 `BAIDU_SECRET_KEY` 后，页面「🌐 中文描述」开关即可把插件描述翻译为中文。
- 设置 `GITHUB_TOKEN` 可提高 GitHub API 限额，获得更全的数据。
- 数据目录：`$DSH_HOME/plugin-rank/`（默认 `~/.dsh/plugin-rank/`）。

> ⚠️ **密钥安全**：所有密钥都通过**环境变量**在运行时注入，**切勿写进源码或提交到仓库**；仓库只提供 `.env.example` 占位模板。

## 🛠️ 开发

```sh
pnpm install
pnpm build
pnpm verify   # 用真实 GitHub 数据端到端验证排名/推荐/理由输出
```

## 📄 License

[MIT](./LICENSE)