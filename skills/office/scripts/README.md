# Office 和 PDF 只读脚本

脚本与 `office` Skill 一起安装。普通读取及 macOS / Linux、Windows PowerShell 的调用方式见 [office 入口](../SKILL.md)；使用 `load_workspace_dependencies` 返回的真实运行时、PDF.js 资源及本 Skill 的实际路径，不猜应用目录。文件系统路径交给当前宿主和 Shell，ZIP 内部部件名保持 POSIX 路径；不要全局替换正反斜杠。相对输入和输出路径相对于调用时工作目录。

Windows 工具声明使用 `cmd.exe` 时，可将查询得到的 Python 绝对路径、当前 Skill 目录绝对路径和输入文件绝对路径分别存入环境变量 `python`、`skillDir`、`inputPath`，再执行：

```cmd
"%python%" -I -B "%skillDir%\scripts\read_office.py" --input "%inputPath%"
```

## DOCX、PPTX、XLSX

`read_office.py` 读取 JSON；`extract_assets.py` 提取使用到的媒体。两者只支持 DOCX/PPTX/XLSX，可选 `--blocks`、`--pages`、`--sheet` 相互排斥，`--range` 仅随 `--sheet` 使用；范围序号从 1 开始。未指定范围时请求支持内容层的全部范围，`--help` 可查看完整选项。正文默认输出到 stdout，`--output` 写入新文件且不覆盖。

素材命令需要 `--output-dir` 指定新目录，绝不覆盖或清空已有目录；可使用 `--type image`、`audio`、`video` 或 `all`，`--zip` 打包清单及提取文件。`manifest.json` 记录相对于当前输入容器的素材部件、类型、使用位置、字节数和 SHA-256。`status` 为 `external`、`too_large` 或 `render_required` 时没有提取文件：外链未抓取，图表等需要渲染。按 `files`、每个素材的 `relativePath` 和摘要核对磁盘及 ZIP。

指定范围时 `coverage.requested` 是所选范围，`coverage.processed` 为处理到的范围，`coverage.layer` 和 `exclusions` 描述支持层；结合 `partial`、`coverage.omissions` 和 `warnings` 解释已知遗漏或限制。DOCX 正文不包含页眉页脚、注释及部分修订对象；PPTX 正文以对象顺序遍历，并单独标记演讲者备注，素材不含母版、版式和备注中的媒体；XLSX 素材限工作表绘图锚点。图片中的文字不会被 OCR；读取 XLSX 返回现有公式与可读取缓存，不计算或刷新公式。

输入限制为 256 MiB，ZIP 声明展开上限为 512 MiB / 10000 项；输出上限为 2000 个内容单元、200 万 UTF-16 字符、20000 个工作表单元格，素材 200 项、单文件 20 MiB / 合计 100 MiB，图片 16777216 像素。读取选项可调低数量上限。输入文件及 ZIP 展开预算在打开前检查，缩小页范围无法解决超限；只有输出范围或数量受限时，才按任务需要缩小范围并检查实际覆盖。脚本固定 UTF-8 输出，不打开网络引用、不执行宏、不修改输入。原始字节、SHA-256 和位置只相对于脚本的当前输入容器；其他格式先转换并复制，保留转换回执与脚本清单的关系。

## PDF

`read_pdf.mjs` 通过返回的产品 Node launcher 和 `nodePackages["pdfjs-dist"]` 的 `entry`、`root` 读取文字层；参数与限制见 [PDF 参考](../references/pdf.md)。它不识别图片中的文字或提取 PDF 原始素材。结果、错误及输入均不作为 Host 授权或版本凭据。
