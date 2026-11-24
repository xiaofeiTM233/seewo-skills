# Node CLI 合同

入口为 `scripts/webpage.mjs`，仅依赖 Node 内置模块。在 Session Workspace 执行；只接受工作区内的普通文件，支持相对路径和工作区内绝对路径，拒绝越界路径及符号链接。工作区外图片先通过现有授权文件能力复制进来。

只有两个命令，不初始化项目，也不写入任何本地文件：

| 命令                         | 行为                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `upload-image --file <图片>` | 上传一张图片，返回可直接引用的 `url`、`mimeType`、`bytes`、`sha256` 和 `verification`      |
| `check --file <HTML>`        | 只读检查最终文件，返回大小、内联脚本数、`staticChecks`、`warnings` 与 `browserInteraction` |

`--help` 列出命令与内置 policy 地址。成功返回 JSON `ok:true`；失败返回 `ok:false,error:<分类>` 并以非零状态退出，不输出服务策略或临时请求头。

`upload-image` 的 `verification:passed` 表示返回图片已匿名读取且内容与原图一致；其他值表示上传已返回 URL，但探测失败，先检查该 URL，不要重复上传。上传只处理一次，不维护缓存或重试状态，详见 [图片](images.md)。

`check` 检查完整文档的 doctype/html/head/body、标签属性、普通内联 JavaScript 和事件属性语法、JSON script，以及遗留 `asset:` 图片占位符。它不转换、注入或执行 HTML，不检查版本，不限制图片、样式、脚本等外链来源。直接使用真实 URL 或 data URL，不再使用 `asset:<id>` / `getAssetUrl()` 构建约定。

外链脚本和 module 脚本返回未校验提示，需浏览器验证；`browserInteraction` 始终是 `not-verified`。此检查不是完整 HTML 标准验证器或安全过滤器，不检查远端依赖可用性和教学事实，也不替代宿主文件授权。

单图最大 20 MiB、HTML 最大 100 MiB、网络 JSON 最大 128 KiB、stdout 最大 16 KiB。离线内嵌需注意 Base64 体积膨胀，可先缩图。图片容器检查不替代浏览器解码与视觉检查。
