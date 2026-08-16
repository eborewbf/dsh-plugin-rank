/**
 * dsh-plugin-rank 客户端 bundle 构建配置。
 *
 * 产出 DSH 客户端模块表要求的闭包工厂产物 `lib/client.js`：
 * 透过 outputOptions 的 banner/footer/intro，把打包结果包成
 * `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`，
 * 外部依赖经注入的 require 从模块表解析。运行时的平台依赖只有 `react`
 * 与 `react/jsx-runtime`（平台模块），其余（内联 SVG、字典、组件）全部内联。
 *
 * 以普通对象导出（不 import 'tsdown' 的类型），便于在无本地 tsdown 依赖的
 * 环境下用仓库内已安装的 tsdown 二进制直接构建。
 */
export default {
  name: 'dsh-plugin-rank/client',
  entry: { client: 'src/client/index.ts' },
  // 浏览器 bundle 落在 node half 旁（同一 lib/ 目录）；entryFileNames 固定为
  // lib/client.js，与 exports["./client"] 对应。clean 必须关闭，避免清掉
  // tsc 先产出的 node half。
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  // 客户端平台模块：从模块表解析，不打包进 bundle。
  external: ['react', 'react/jsx-runtime'],
  // 除平台模块外全部内联（无其它共享运行时依赖）。
  noExternal: (id) => (['react', 'react/jsx-runtime'].includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: "window.__ModuleLoader__.load({ id: 'dsh-plugin-rank', factory: (require) => {",
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}