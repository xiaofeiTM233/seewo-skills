# Excel 工作簿

除用户或适用的工作区要求指定其他库外，已有 XLSX 使用 `openpyxl`，数据分析和变换可用 `pandas`；按 `office` 指导选择 Python。脚本、工作文件和成果放在授权工作区，运行时及 Skill 资源只读。默认另存新文件。脚本名不要遮蔽 `openpyxl`、`pandas`、`inspect` 等库。

## 读取与修改

`openpyxl` 不读旧 `.xls`：先用 `office_convert` 转为 `xlsx`，在同一 Run 前台复制到工作区，再编辑副本。修改前检查工作表名称、目标单元格类型、公式、样式、合并和引用范围；需要保留公式时使用 `data_only=False`。保存后重新打开，包括用户要求保留的未修改部分。

DataFrame 不等于完整工作簿；导出覆盖原文件可能丢失工作表、公式、图表与格式。用 `openpyxl` 将结果写回所需范围。`XlsxWriter` 可创建新工作簿，但不能打开或修改已有工作簿。

```python
from openpyxl import Workbook
from openpyxl.styles import Font

workbook = Workbook()
sheet = workbook.active
sheet.title = "收入"
for row in [("季度", "收入"), ("Q1", 12), ("Q2", 18), ("合计", "=SUM(B2:B3)")]:
    sheet.append(row)
for cell in sheet[1]:
    cell.font = Font(bold=True)
sheet.column_dimensions["A"].width = 18
sheet.column_dimensions["B"].width = 18
workbook.save("report.xlsx")
```

数字、日期、布尔值和标识符应保留预期单元格类型，格式不是类型转换。不要靠改扩展名处理 XLS、XLSB、加密或含宏文件；`keep_vba=True` 可保留 VBA 包内容，但不会执行或编辑宏，复杂特性需针对任务核验。

## 公式与检查

写入公式不等于计算。`openpyxl` 和 `XlsxWriter` 不求值，`data_only=True` 读取的是可能缺失或过期的保存缓存。需要刷新计算结果时调用 `office_recalculate`，将其结果在同一 Run 前台复制到工作区：

- XLSX：分别用 `data_only=False` 和 `data_only=True` 打开该结果，核对任务相关公式仍存在、缓存值符合预期。
- ODS：对复制后的原重算结果使用已有 ZIP/lxml 有界读取 `content.xml`。先核对 ZIP 条目数及 XML 展开大小，禁用 XML 实体、DTD 和网络；只在任务范围内展开重复行列并设置数量上限。核对工作表、`table:formula`、值类型及对应缓存内容；不要用再次转换或重算的 XLSX 代替验证。核验业务公式是否合理。

重算失败时保留原文件并报告缓存未刷新，不把公式替换为常量或把旧缓存称为新计算结果。

回读目标工作表、值、类型、公式、样式和总计；这些检查不判断外观。用户要求看图、视觉检查，或任务目标是填充颜色、对齐、间距、尺寸等外观时，对受影响 `sheet` / `range` 调用 `office_render`；用户明确要求跳过时优先遵循。新建工作簿或数据、公式编辑附带的基础格式可由库核验，不必仅为此渲染。视觉检查未完成时如实说明。仅需 PDF 时使用 `office_convert` 并复制临时结果。

完成所需验证后，用 `publish_file({path, summary})` 登记工作区实际最终文件，不发布中间脚本和报告。只读回答不必生成成果文件。

本参考依据 [DeepSeek Harness 固定版本](https://github.com/deepseek-ai/deepseek-harness/tree/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/skill/skill-office/assets/office-xlsx) 中文适配，许可见 [LICENSE](../LICENSE)。
