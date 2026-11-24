# Word 文档

除用户或适用的工作区要求指定其他库外，使用 `python-docx` 创建和常规编辑 DOCX；按 `office` 的运行时指导选择 Python。脚本、中间文件和成果放在授权工作区，运行时和 Skill 资源只读；编辑已有文档时保留原设计并使用请求的语言。脚本名避免 `docx.py`、`inspect.py`、`zipfile.py` 等依赖或标准库名称。

## 创建与编辑

`python-docx` 不读旧 `.doc`。先以 `office_convert` 转为 `docx`，在同一 Run 前台复制到工作区，再编辑副本。

文字编辑先按内容或位置定位目标，检查相应 run 和格式；标题可以是普通段落。只修改相关 run，给段落直接赋 `.text` 会破坏 run 格式。默认另存新文件，用户要求原位编辑时遵循其要求。普通文字修改不必展开 ZIP、枚举部件或读取无关元数据、页眉页脚；仅在具体故障、定位歧义、不支持的特性或用户要求时深入检查。重建文档可能丢失不支持的特性。明确提取素材属于独立任务，可使用 `office` 的素材脚本。

标题和正文使用段落样式；表格尺寸应适应所在节，并考虑合并单元格和嵌套表格。中日韩文字必要时除 `run.font.name` 外还设置 `w:eastAsia` 字体；写入字体名不代表环境一定有该字体或呈现正确。

```python
from docx import Document

document = Document()
document.add_heading("项目报告", level=0)
document.add_paragraph("摘要", style="Heading 1")
document.add_paragraph("在此填写所需内容。")
document.save("report.docx")
```

`python-docx` 不负责分页或渲染；普通替换、颜色文字和批注不是修订模式。涉及真实修订或不支持的 OOXML 特性时保留相关部件并验证；确需直接改包时，新建 ZIP 且每个未修改成员只复制一次，不能追加同名成员。

## 检查与交付

重新打开结果，核对用户要求的内容、相关格式及应保留部分。用户要求看图、视觉检查，或修改目标是样式、颜色、间距、尺寸或对齐时，对受影响页面调用 `office_render`；用户明确要求跳过时遵循。新建文档或内容编辑附带的基础格式，可用 `python-docx` 检查，不必仅为此渲染。仅需 PDF 时使用 `office_convert` 并复制临时文件。

结构与内容检查通过但视觉检查未完成时如实说明。最终文件位于工作区且完成所需验证后，用 `publish_file({path, summary})` 登记；不发布中间检查文件。只读回答不必生成成果文件。

本参考依据 [DeepSeek Harness 固定版本](https://github.com/deepseek-ai/deepseek-harness/tree/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/skill/skill-office/assets/office-docx) 中文适配，许可见 [LICENSE](../LICENSE)。
