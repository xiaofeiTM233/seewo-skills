---
name: office
description: 解析、总结或对比本地 PDF、Word、PPT、Excel 文件，提取 Office 文档素材，或创建、编辑、转换 Office 文档。
---

# Office 和 PDF

先按用户目标选择需要的路径，用户或工作区明确指定的环境和检查要求优先。纯文本、Markdown、CSV、TSV 使用现有文本或数据工具，无需 Office 转换。

- **正文或数据**：在 codemode 调用 `office_read` 读取 DOCX、PPTX、XLSX 正文或 PDF 文字层。它按当前权限读取原文件，返回正文 JSON 或供同一 Run 分段读取的结果路径。DOC、PPT、XLS 等旧格式先转换为对应现代格式，再在同一 Run 读取转换结果。
- **视觉**：使用 `office_render`，按页或工作表区域分批投递图片；实际收到图片才能声称看过。正文和视觉的覆盖范围分别记录。PDF 的少文字、无文字或字符异常只是需要核查的线索，不能据此判定空白或扫描件；按目标选择需要看的页。
- **原始素材**：DOCX、PPTX、XLSX 使用下方 `extract_assets.py`，按清单核对；页面渲染图不是原始素材。PDF 暂无原始素材提取。
- **创建或复杂编辑**：只读取需要的 [DOCX 参考](references/docx.md)、[PPTX 参考](references/pptx.md) 或 [XLSX 参考](references/xlsx.md)；PDF 文字层及限制见 [PDF 参考](references/pdf.md)。简单读取无需先读格式参考。
- **转换或重算**：通过 codemode 调用下方原生工具，只有要运行脚本时才查询运行时。PDF 不可作为转换输入；计算后的表格要核对业务结果。

## 原生操作

以下三个工具通过 codemode 的 `tools.office_render(...)`、`tools.office_convert(...)`、`tools.office_recalculate(...)` 调用；它们不作为独立的顶层模型工具声明。可用 `describeTool` 按需查询完整合同。

- `office_render`：使用 `input`，文档页或幻灯片可指定从 1 开始且不重复的 `pages` 数组；工作簿使用 `sheet` 及可选 `range`，`range` 必须带 `sheet`。`dpi` 为 24–600，默认 144。每次最多 4 张图；省略 `pages` 或 `sheet` 会选择全部页面或可见工作表，可能超过预算，不要用同一范围反复重试。
- `office_convert`：使用 `input`、`format` 及可选 `sheet`。DOC/DOCX/ODT 可转 PDF、DOCX、ODT、TXT；XLS/XLSX/ODS 可转 PDF、XLSX、ODS、CSV；PPT/PPTX/ODP 可转 PDF、PPTX、ODP。多工作表导出 CSV 必须指定 `sheet`，其他格式不接受 `sheet`。
- `office_recalculate`：对 XLS/XLSX/ODS 整本工作簿重算，指定 `format: "xlsx"` 或 `"ods"`。结果需复制后按 [XLSX 参考](references/xlsx.md) 核对公式和缓存；引擎成功不等于业务公式正确。

在 codemode 中显式投递渲染图：

```javascript
const reply = await tools.office_render({ input: "报告.pdf", pages: [1] });
for (let i = 0; i < (reply.imageBlocks?.length ?? 0); i++) image(reply.imageBlocks[i]);
```

无图片时检查回执，已知非空内容渲染成透明或全白应报告视觉检查未完成。纯导出 PDF 时，复制结果并检查非空及 `%PDF-` 签名；只有任务需要视觉验收时才渲染。

## 正文读取

先将原文件路径传给 `tools.office_read({ input: "报告.pdf", pages: "1,3-5" })`。读取成功后直接使用结果。DOCX 可选 `blocks: "1-8"`，PDF 和 PPTX 可选 `pages`，XLSX 可选 `sheet` 和 `range: "A1:D20"`。短结果可读 `content`，其余用 `read` 分段读取回执中的 `file`。该 JSON 仅在当前 Run 可用。

- **原文件超出当前工具的默认访问范围**。优先走原工具提供的单次审批。只有回执确认受限的是工作区外的原文件、该限制可申请放行，且后续处理可以通过工作区副本继续时，才复制。用前台 Shell 将这一份文件复制到当前任务工作区内未占用的路径，保留原件。若复制命令的默认权限不足，用 `sandbox_permissions: "require_escalated"` 发起该命令的宿主审批。确认复制成功且副本可读后，用副本继续。
- **访问明确被拒或审批未获准**。遇到受保护路径、操作系统拒绝访问，或用户拒绝、取消、审批超时，结束本次访问，按实际原因反馈。
- **解析故障或原因未明**。`DOCUMENT_READ_WORKER_ACCESS_DENIED` 表示解析进程在回执所示阶段访问文件被拒，按解析或运行时故障处理。若只有 `DOCUMENT_READ_FAILED` 等通用错误，反馈已知的失败阶段和错误，说明原因尚未确定。

检查 JSON 的 `coverage`、`partial`、`warnings`。PPTX 按对象顺序遍历，备注标记为 `speaker_notes`。XLSX 返回现有公式与缓存。PDF 只提取文字层，扫描内容按需渲染。旧格式报复合文件结构无效时，可请用户用兼容的 Office 应用另存为现代格式，再读取新文件。

## 素材提取和编辑脚本

需要脚本时，在 codemode 调用 `tools.load_workspace_dependencies({})`，按返回值和 `warnings` 使用 `python`；同一运行时未改变时复用查询。Python 可选，缺失时说明限制，不搜索系统程序或联网安装依赖。查询不授予执行或文件访问权；使用可用的前台 Shell，并遵守“需要授权／完全访问”的当前执行边界。

以下变量均填实际值：`python` 来自查询；`skillDir` 是当前已加载 office Skill 的实际目录；`inputPath` 是本任务可读取的源文件，`outputDir` 是待新建的已授权工作区目录。变量保存原始路径值，按当前 Shell 的语法传参，不将 JSON 字符串里的转义字符当成路径内容。下面的命令提取 Office 原始素材。macOS / Linux：

```sh
"$python" -I -B "$skillDir/scripts/extract_assets.py" --input "$inputPath" --output-dir "$outputDir"
```

Windows 以当前工具声明的 Shell 为准；`cmd.exe` 调用见 [脚本说明](scripts/README.md)。以下是 PowerShell：

```powershell
& $python -I -B (Join-Path $skillDir 'scripts\extract_assets.py') --input $inputPath --output-dir $outputDir
```

素材的类型、ZIP 和覆盖范围见 [脚本说明](scripts/README.md)。

## 结果检查与交付

DOCX、XLSX 通常回读任务涉及的内容；需要核对外观时渲染受影响范围。PPTX 新建或修改可见内容默认渲染变更页；用户明确跳过优先。全量请求需汇总实际文字与视觉覆盖，说明遗漏。低文字量或警告可引导按需视觉检查，但渲染不是 OCR，也不保证表格结构或文字识别。

输入大小或 ZIP 展开超限发生在打开前，缩小页范围不能解决；输出单位、字符、图片或素材预算受限时，按任务需要缩小范围并汇总实际覆盖。同一条件不变时不重复失败，不为绕过限制删除媒体或改扩展名。对密码、损坏、格式、权限或运行时错误报告实际原因，不把单个文件失败推广为所有文档能力缺失。

运行时查询只确认组件路径与部署信息，不代表脚本已成功执行。遇到带错误码的失败，区分权限拒绝、命令环境故障、已执行后的报错和引擎失败；`ENGINE_PIPE_FAILED` 表示 Windows 引擎通信管道失败，`ENGINE_START_FAILED` 表示引擎子进程未启动。同一环境下缩页或降 DPI 无法解决这两类错误。渲染或转换失败不证明正文脚本不可用，正文脚本失败也不证明原生引擎不可用；按真实回执判断下一条已授权且符合目标的路径，可能已执行部分操作时先核对结果。

原生转换、重算和渲染结果仅在当前 Run 临时可用，需要留存时在同一 Run 前台复制到授权工作区的新路径，再核对结果。子 Agent 须在返回前持久化产物，父 Agent 不依赖子 Run 临时路径。Windows PowerShell 用 `Copy-Item -LiteralPath $resultPath -Destination $workspacePath`；macOS / Linux 可用 `cp "$resultPath" "$workspacePath"`，变量均为实际路径。需要可下载文件时调用 `publish_file({path, summary})` 登记最终文件；只读问答直接回答，无需发布中间文件。发布失败保留文件并说明。

本 Skill 依据 [DeepSeek Harness 固定版本](https://github.com/deepseek-ai/deepseek-harness/tree/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/skill/skill-office/assets/office) 中文适配，许可见 [LICENSE](LICENSE)。
