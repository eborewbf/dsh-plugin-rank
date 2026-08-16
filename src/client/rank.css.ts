/**
 * dsh-plugin-rank 内嵌模态面板的样式（CSS 字符串）。
 *
 * 客户端 bundle 自包含约束：不 import 任何 `@deepseek-ai/*` 运行时包，也不
 * 依赖 CSS Modules 链路。样式以字符串形式内联，由 `RankModal` 在挂载时
 * 注入一次 `<style id="dsh-plugin-rank-css">`，类名统一 `pr-` 前缀避免污染。
 *
 * 颜色全部走宿主主题语义 token（与设置面板一致），保证深浅色主题都能正确渲染：
 *   - 遮罩/模糊：--dsw-alias-bg-mask-1 / --dsw-mask-blur
 *   - 面板/卡片：--dsw-alias-bg-layer-2 / --dsw-alias-bg-layer-1
 *   - 文字：--dsw-alias-label-primary / --dsw-alias-label-secondary / --dsw-alias-label-caption
 *   - 边框：--dsw-alias-border-l1 / --dsw-alias-border-l2
 *   - 交互底色：--dsw-alias-interactive-bg-hover
 *   - 强调（激活 tab / 安装按钮 / 星标）：--dsw-alias-label-primary-bluish
 */
export const RANK_CSS = `
#dsh-plugin-rank-css,
.pr-scope {
  box-sizing: border-box;
}
.pr-scope *,
.pr-scope *::before,
.pr-scope *::after {
  box-sizing: border-box;
}

/* —— 遮罩 + 面板（仿设置 Modal） —— */
.pr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pr-mask {
  position: absolute;
  inset: 0;
  background: var(--dsw-alias-bg-mask-1);
  backdrop-filter: var(--dsw-mask-blur);
}
.pr-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 860px;
  height: min(720px, calc(100vh - 48px));
  max-width: calc(100vw - 48px);
  border-radius: 16px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-shadow-lv3);
  color: var(--dsw-alias-label-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.6;
}
.pr-scope {
  --pr-accent: var(--dsw-alias-label-primary-bluish);
  --pr-text: var(--dsw-alias-label-primary);
  --pr-muted: var(--dsw-alias-label-secondary);
  --pr-dim: var(--dsw-alias-label-caption);
  --pr-border: var(--dsw-alias-border-l2);
  --pr-border-soft: var(--dsw-alias-border-l1);
  --pr-hover: var(--dsw-alias-interactive-bg-hover);
  --pr-card: var(--dsw-alias-bg-layer-1);
}

/* —— 头部 —— */
.pr-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 12px 0 20px;
  border-bottom: 1px solid var(--pr-border-soft);
}
.pr-title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pr-badge {
  flex: none;
  font-size: 11px;
  font-weight: 500;
  color: var(--pr-accent);
  border: 1px solid currentColor;
  border-radius: 20px;
  padding: 0 8px;
}
.pr-close {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-left: auto;
  padding: 0;
  border: none;
  border-radius: 28px;
  background: transparent;
  color: var(--pr-text);
  cursor: pointer;
}
.pr-close:hover {
  background: var(--pr-hover);
}
.pr-spacer {
  flex: none;
  width: 8px;
}
.pr-lang {
  flex: none;
  display: inline-flex;
  gap: 2px;
  margin: 0 4px;
}
.pr-lang-btn {
  flex: none;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border: 1px solid var(--pr-border-soft);
  border-radius: 4px;
  background: transparent;
  color: var(--pr-muted);
  cursor: pointer;
  transition: background .15s, color .15s, border-color .15s;
}
.pr-lang-btn.active {
  color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-static-blue-900);
  border-color: var(--dsw-static-blue-900);
}
.pr-lang-btn:hover:not(.active) {
  background: var(--pr-hover);
}

/* —— Tab 栏 —— */
.pr-tabs {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 16px 0;
  border-bottom: 1px solid var(--pr-border-soft);
}
.pr-tab {
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--pr-muted);
  padding: 8px 12px 7px;
  font-size: 13px;
  cursor: pointer;
}
.pr-tab.active {
  color: var(--pr-text);
  border-bottom-color: var(--pr-accent);
  font-weight: 600;
}

/* —— 主体 —— */
.pr-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 20px 20px;
}
.pr-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.pr-toolbar .spacer {
  flex: 1;
}
.pr-btn {
  appearance: none;
  background: transparent;
  color: var(--pr-text);
  border: 1px solid var(--pr-border);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12.5px;
  cursor: pointer;
}
.pr-btn:hover {
  background: var(--pr-hover);
}
.pr-btn.primary {
  background: var(--pr-accent);
  border-color: transparent;
  color: var(--dsw-alias-label-primary-foreground);
  font-weight: 600;
}
.pr-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pr-status {
  font-size: 12px;
  color: var(--pr-dim);
}
.pr-select {
  appearance: none;
  background: var(--pr-card);
  color: var(--pr-text);
  border: 1px solid var(--pr-border);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 12.5px;
  cursor: pointer;
}

/* —— 卡片列表 —— */
.pr-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pr-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: var(--pr-card);
  border: 1px solid var(--pr-border-soft);
  border-radius: 10px;
  padding: 12px 14px;
}
.pr-idx {
  flex: 0 0 38px;
  font-size: 14px;
  font-weight: 700;
  color: var(--pr-accent);
  text-align: center;
  padding-top: 3px;
  font-variant-numeric: tabular-nums;
}
.pr-score {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 15px;
  font-weight: 700;
  color: var(--pr-accent);
}
.pr-score-total {
  font-size: 10px;
  color: var(--pr-dim);
}
.pr-card-body {
  flex: 1;
  min-width: 0;
}
.pr-name {
  font-size: 14px;
  font-weight: 600;
}
.pr-name a {
  color: var(--pr-text);
  text-decoration: none;
}
.pr-name a:hover {
  color: var(--pr-accent);
}
.pr-stars {
  color: var(--pr-accent);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12.5px;
  margin-left: 8px;
}
.pr-pkg {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11.5px;
  color: var(--pr-dim);
}
.pr-desc {
  color: var(--pr-muted);
  font-size: 12.5px;
  margin-top: 2px;
}
.pr-desc-zh {
  color: var(--pr-accent);
  font-size: 12px;
  margin-top: 2px;
}
.pr-reason {
  margin-top: 8px;
  font-size: 12px;
  color: var(--pr-text);
  background: var(--dsw-alias-bg-layer-2);
  border-left: 3px solid var(--pr-accent);
  padding: 6px 10px;
  border-radius: 6px;
}
.pr-reasons {
  margin: 8px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pr-reasons li {
  font-size: 12px;
  color: var(--pr-text);
}
.pr-reasons li::marker {
  color: var(--pr-accent);
}
.pr-expand {
  margin-top: 6px;
  appearance: none;
  background: transparent;
  color: var(--pr-accent);
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.pr-actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: stretch;
}
.pr-install {
  appearance: none;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  background: var(--pr-accent);
  color: var(--dsw-alias-label-primary-foreground);
  border: none;
  font-weight: 600;
}
.pr-install:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pr-remove {
  appearance: none;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  background: transparent;
  color: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-static-red-400, #e25555));
  border: 1px solid currentColor;
}
.pr-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* —— 详情（截图 + 评论） —— */
.pr-detail {
  margin-top: 10px;
  border-top: 1px dashed var(--pr-border);
  padding-top: 10px;
}
.pr-detail h4 {
  margin: 8px 0 6px;
  font-size: 12.5px;
  color: var(--pr-muted);
  font-weight: 600;
}
.pr-detail h4 .n {
  color: var(--pr-accent);
}
.pr-shots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pr-shot {
  flex: 0 0 200px;
  border: 1px solid var(--pr-border-soft);
  border-radius: 8px;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-2);
}
.pr-shot img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
  cursor: pointer;
  background: #000;
}
.pr-shot .cap {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--pr-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pr-reviews {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pr-review {
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--pr-border-soft);
  border-radius: 8px;
  padding: 8px 10px;
}
.pr-review .rh {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.pr-review .rh .t {
  font-size: 12px;
  font-weight: 600;
  color: var(--pr-text);
}
.pr-review .rh .t.issue {
  color: var(--pr-accent);
}
.pr-review .rh .au {
  font-size: 11px;
  color: var(--pr-dim);
}
.pr-review .rh time {
  font-size: 11px;
  color: var(--pr-dim);
  margin-left: auto;
}
.pr-review .b {
  font-size: 11.5px;
  color: var(--pr-text);
  margin-top: 2px;
}
.pr-review .b a {
  color: var(--pr-accent);
  text-decoration: none;
}
.pr-detail-empty {
  color: var(--pr-dim);
  font-size: 12px;
  padding: 4px 0;
}
.pr-loader {
  color: var(--pr-dim);
  font-size: 12px;
  padding: 4px 0;
}
.pr-empty {
  color: var(--pr-dim);
  text-align: center;
  padding: 40px 0;
}

/* —— 轻量大图 —— */
.pr-lightbox {
  position: fixed;
  inset: 0;
  background: var(--dsw-alias-bg-mask-photo);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  cursor: zoom-out;
}
.pr-lightbox img {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 6px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}

/* —— 提示 toast —— */
.pr-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: var(--dsw-alias-bg-overlay);
  border: 1px solid var(--pr-border);
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  max-width: 640px;
  width: max-content;
  z-index: 1300;
  box-shadow: var(--dsw-shadow-lv3);
  color: var(--pr-text);
}
.pr-toast.ok {
  border-color: var(--pr-accent);
}
.pr-toast.err {
  border-color: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-static-red-400, #e25555));
}
`