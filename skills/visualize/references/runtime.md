# 页面运行时

只使用产品打包的这些精确脚本地址；Host 在执行前替换成本地固定字节，无 CDN 回退：

- `https://unpkg.com/@floating-ui/core@1.7.3/dist/floating-ui.core.umd.min.js`
- `https://unpkg.com/@floating-ui/dom@1.7.4/dist/floating-ui.dom.umd.min.js`
- `https://unpkg.com/lucide@1.17.0/dist/umd/lucide.js`
- `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js`

可以不引入任何脚本资源。使用 `window.zcode` 的状态／追问 API，不能自行 postMessage 或实现 RPC。`setWidgetState` 返回保存 Promise；页面恢复后通过 `window.zcode.widgetState` 读取当前完整状态，并监听 `zcode:set_globals` 事件刷新本地显示。保存或追问被拒绝时保留本地编辑并显示错误，避免自动重试写入。

文字使用 `--foreground`／`--muted-foreground`，图表实色使用 `--viz-series-1` 到 `--viz-series-6` 或 `--content-accent`，边框使用 `--border`。`--accent` 是浅色强调背景，不适合充当主要数据图形的实色。行内 `style` 与 SVG 属性均受支持；出现空图时先核对实际尺寸、计算后的颜色和脚本错误，不假定宿主会过滤行内样式。

DOM 可使用原生媒体查询和 `prefers-color-scheme`；不要写死浅色背景和黑色文本。主题变量随 Host context 更新。页面不能导航、开新窗口、访问父页面、文件或账号接口。
