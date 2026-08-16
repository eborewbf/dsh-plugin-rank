/**
 * 侧边栏底部动作（sidebar.footer.action）注册项：一个指向
 * 插件排名内嵌模态面板的入口按钮。宽列显示图标+文字，窄栏（rail）只显示图标。
 *
 * 点击后不再跳转独立页面，改为在当前页面内渲染全屏模态面板（仿设置面板）。
 * 组件自包含：不依赖 `@deepseek-ai/*` 运行时包，图标为内联 SVG，样式为
 * 内联样式。运行时仅从模块表解析 `react`（平台模块）。
 */
import { useState } from 'react'
import type { RankKey } from './locales.ts'
import { RankModal } from './RankModal.tsx'

/** 侧边栏底部动作收到的注入 props：列宽状态 + 命名空间翻译器。 */
export type PluginRankActionProps = {
  /** 侧边栏是否渲染宽列（false = 56px 窄栏）。 */
  wide: boolean
  /** 绑定到 `plugin-rank` 命名空间的翻译函数。 */
  t: (key: RankKey) => string
}

/** 内联图标的公共样式。 */
const iconStyle: React.CSSProperties = {
  display: 'block',
  flexShrink: 0,
}

/** 宽列文字样式。 */
const labelStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1,
  color: 'inherit',
}

/**
 * 侧边栏底部动作按钮——点击后打开内嵌模态面板。
 * @param props - 列宽状态与翻译函数。
 * @returns 一个打开插件排名模态面板的按钮。
 */
export function PluginRankAction({ wide, t }: PluginRankActionProps) {
  const [open, setOpen] = useState(false)
  const label = t('label')

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(true) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: wide ? 'flex-start' : 'center',
          gap: 8,
          width: '100%',
          height: 32,
          padding: wide ? '0 10px' : 0,
          border: 'none',
          background: 'transparent',
          color: 'var(--dsw-alias-label-primary)',
          cursor: 'pointer',
          borderRadius: 6,
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'transparent'
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={iconStyle}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        {wide && <span style={labelStyle}>{label}</span>}
      </button>
      {open && <RankModal onClose={() => { setOpen(false) }} t={t} />}
    </>
  )
}