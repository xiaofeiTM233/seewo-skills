# PDF 文字与页面

在 codemode 调用 [office 入口](../SKILL.md)中的 `office_read` 读取 PDF 文字层。可用 `pages: "1,3-5"` 指定从 1 开始且不重复的页号，省略则请求整个文档。工具使用随包 PDF.js，按需从 `content` 或当前 Run 的 `file` 读取 JSON。文字层读取不提供 OCR。

结果包含源文件事实、`coverage.totalPages` 总页数、`units`、`coverage.processed` / `omissions`、`partial` 和 `warnings`；指定页范围时还有 `coverage.requested`。每个页单元带页码、提取文字和 `textStatus`（`text` 或 `no_text`）；顺序是 PDF.js 文字层的提取顺序，不保证符合分栏或视觉阅读顺序。已处理页仍可能发生文字截断，应结合 `partial`、遗漏及警告解释。默认最多处理 2000 页、200 万 UTF-16 字符，输入上限 256 MiB；`maxUnits`、`maxTextChars` 可调低。跨页输出受限时可分批并汇总覆盖；单页仍超限时说明缺口，不把样本说成全文。

`NO_TEXT_LAYER` 表示没有可提取文字，`TEXT_MAPPING_UNCERTAIN` 提示控制字符或疑似 CJK 部首等文字映射异常，`LIMIT_REACHED` 表示数量限制。少文字、无文字和字符异常都是线索，不等于空白页、扫描件或正确识别；按目标用 `office_render` 查看相关页面。保留提取原文，不用猜测性的替换表修正文字符号。渲染只能提供视觉依据，不等于 OCR、精确全文、表格结构或原始素材提取。

输入、密码、格式、资源或文件错误时按工具回执处理。整个输入大小超限不能通过缩小页范围解决；同一条件不变时不要重复执行。PDF 文字层覆盖和实际看过的页面范围分开报告，答案以已读取和已看见的内容为限。
