# dsh-plugin-rank

> **DeepSeek Harness Plugin Ranking & Recommendation Center** — aggregate, rank, recommend, and manage all DSH plugins from GitHub / npm on a single page.

<p align="center">
  <a href="./README.md">English</a> · <a href="https://github.com/eborewbf/dsh-plugin-rank/blob/main/README.zh.md">中文</a>
</p>

## 🎯 Why you need this

The DSH plugin ecosystem already has **tens of thousands** of "plugins" — but most of them are noise:

- 🎭 **Bandwagon plugins**: just slap `dsh-plugin` on as a marketing topic, not real DSH-specific plugins.
- 🧰 **Pretenders**: generic tools that support many agent CLIs, merely labeled with `dsh-plugin`.
- ❓ **Unknown quality**: which one is actually good? Which one is broken? Which one performs poorly?

**Reading repos one by one costs days.** This project cuts through the noise so you stop guessing:

- ⭐ Rank by **real GitHub stars**, not self-promotion.
- 💡 Recommend by **activity + issue health + growth**, not just hype.
- 🏷 Mark **long-unmaintained / archived** plugins so you don't install dead or outdated ones.

**Stop trial-and-error. See the whole DSH ecosystem at a glance and pick the right one fast.**

## ✨ Features

- ⭐ **Star Ranking**: Sort all plugins by GitHub stars, with a clear reason for each position (stars, rank, forks, maintenance activity, archived or not).
- 💡 **Smart Recommendation**: Beyond stars — combines maintenance activity, issue health, and growth momentum into a 0–100 score with itemized reasons.
- 📦 **Plugin Management**: One-click install / uninstall in the page, reusing DSH's official pnpm mechanism and writing back to `dsh.profile.bundles`.

## 🚀 Quick Start

```sh
# 1. Build
pnpm install
pnpm build

# 2. Install into DSH (restart after in-page install)
dsh plugin add dsh-plugin-rank

# 3. Open the page
dsh web
# open http://127.0.0.1:3080/plugin-rank/ in your browser
```

## 🔌 API

| Endpoint | Description |
| --- | --- |
| `GET /plugin-rank/api/discovery` | Discovery result (source live/cache and notice) |
| `GET /plugin-rank/api/ranking` | Star ranking (with reasons) |
| `GET /plugin-rank/api/recommend?top=N` | Smart recommendation (with score and reasons) |
| `GET /plugin-rank/api/installed` | Installed state |
| `POST /plugin-rank/api/install` | `{ spec: 'owner/repo' \| 'npm package' }` |
| `POST /plugin-rank/api/remove` | `{ name: 'package' }` |
| `POST /plugin-rank/api/translate` | `{ text: 'English' }` → `{ zh: '中文' }` (Baidu Translate, optional) |

## ⚙️ Configuration

- **Translation (optional)**: Set the environment variables `BAIDU_APPID` and `BAIDU_SECRET_KEY` to enable the "🌐 中文描述" toggle, which translates plugin descriptions into Chinese.
- Set `GITHUB_TOKEN` to raise the GitHub API rate limit and get more complete data.
- Data directory: `$DSH_HOME/plugin-rank/` (default `~/.dsh/plugin-rank/`).

> ⚠️ **Key security**: All secrets are injected via **environment variables** at runtime — **never write them into source code or commit them to the repo**; only a `.env.example` placeholder template is provided.

## 🛠️ Development

```sh
pnpm install
pnpm build
pnpm verify   # end-to-end validation of ranking/recommendation/reasons with real GitHub data
```

## 📄 License

[MIT](./LICENSE)