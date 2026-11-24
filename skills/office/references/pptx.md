# PowerPoint 演示文稿

除用户或适用的工作区要求指定其他库外，使用 `python-pptx`；按 `office` 指导选择 Python。将脚本和成果放在授权工作区，运行时及 Skill 资源只读。编辑时使用请求的语言并延续原有设计。脚本名不要遮蔽 `pptx`、`inspect` 或标准库。

读取结果中的演讲者备注以 `role: "speaker_notes"` 标识，和页面可见文字分开解释；形状按文档对象顺序遍历，不等于视觉阅读顺序，涉及版面时结合页面渲染。

## 创建与编辑

`python-pptx` 不读旧 `.ppt`：先用 `office_convert` 转为 `pptx`，同一 Run 前台复制到工作区，再编辑副本。检查布局、文字 run、图片、表格、图表和需要保留的对象；组合对象递归检查 `shape.shapes`。只改用户要求的内容，保留混合文字格式，默认另存新文件。重建幻灯片可能丢失动画、SmartArt 或其他扩展。

新建时使用可编辑的文字、表格和图表；本地图片优于依赖网络的 URL，明确画布、文字尺寸和图表数据。例如：

```python
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches, Pt

presentation = Presentation()
presentation.slide_width = Inches(13.333)
presentation.slide_height = Inches(7.5)
slide = presentation.slides.add_slide(presentation.slide_layouts[6])
title = slide.shapes.add_textbox(Inches(0.6), Inches(0.4), Inches(12), Inches(0.8))
run = title.text_frame.paragraphs[0].add_run()
run.text = "季度报告"
run.font.size = Pt(30)
data = CategoryChartData()
data.categories = ["Q1", "Q2"]
data.add_series("收入", [12, 18])
slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.8), Inches(1.6), Inches(11.5), Inches(4.8), data)
presentation.save("report.pptx")
```

用 `Inches` / `Cm` 设置位置尺寸，`Pt` 设置字号；检查文字、图片是否位于画布内，标题顺序与图表标签是否符合数据。段落居中不会移动文本框；要在页面居中，需同时检查文本框位置和段落对齐。原生图表的嵌入工作簿也是成果的一部分。

## 检查与交付

重新打开结果，核对所需幻灯片数量、内容、格式、图表数据、备注及应保留内容。`python-pptx` 不能判断文本换行、溢出、重叠和对比度。

新建幻灯片或修改任何可见内容（包括文字、图片、图表、尺寸、位置、样式）后，默认对新增或变更页分批调用 `office_render`；用户要求跳过时优先遵循。仅修改演讲者备注或文档属性可用结构回读。若结构检查通过但视觉检查未完成，应如实说明。仅需 PDF 时使用 `office_convert` 并复制临时文件。

完成所需验证后，用 `publish_file({path, summary})` 登记工作区实际最终文件，不发布临时图片或报告。只读回答不必生成成果文件。

本参考依据 [DeepSeek Harness 固定版本](https://github.com/deepseek-ai/deepseek-harness/tree/e8f7b93a344964de3dca1ace9e72b6e4d6de87cb/packages/skill/skill-office/assets/office-pptx) 中文适配，许可见 [LICENSE](../LICENSE)。
