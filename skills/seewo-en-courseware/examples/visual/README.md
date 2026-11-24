# EN 视觉页型样例

本目录为八类教学页型提供可运行 TSX、局部图片和对应 EN 原生预览。面向创作 Agent 的用途、反例、七个帮助组件参数及素材规则统一见 [视觉示例索引](../../references/visual-examples.md)；本文件说明目录约定与维护方法，不复制主题色值或底层写入合同。

这些是固定内容样例，不是用户当前课题的候选成品。默认不读取本目录。只有用户给出参考页型，或当前页没有现成原生写法时，才读对应的一个 TSX。不要把整套示例注入上下文，也不要把示例图写进用户课件。

## 源码与预览

| 页型     | TSX 源码                                     | EN 原生截图                                           |
| -------- | -------------------------------------------- | ----------------------------------------------------- |
| 情境导入 | [01-intro.tsx](01-intro.tsx)                 | [01-intro.png](previews/01-intro.png)                 |
| 原文精读 | [02-close-reading.tsx](02-close-reading.tsx) | [02-close-reading.png](previews/02-close-reading.png) |
| 图解探究 | [03-diagram.tsx](03-diagram.tsx)             | [03-diagram.png](previews/03-diagram.png)             |
| 同维对照 | [04-comparison.tsx](04-comparison.tsx)       | [04-comparison.png](previews/04-comparison.png)       |
| 过程推导 | [05-process.tsx](05-process.tsx)             | [05-process.png](previews/05-process.png)             |
| 练习反馈 | [06-exercise.tsx](06-exercise.tsx)           | [06-exercise.png](previews/06-exercise.png)           |
| 重点结论 | [07-key-message.tsx](07-key-message.tsx)     | [07-key-message.png](previews/07-key-message.png)     |
| 关系总结 | [08-summary.tsx](08-summary.tsx)             | [08-summary.png](previews/08-summary.png)             |

每个 TSX 在启用 en-courseware 的原生 codemode 中通过 `text(page)` 输出一个 schemaVersion 2 布局树，不调用创建、登记或写入工具。帮助组件由现有 Authoring 扩展提供，无需 import。真实生成时按教学任务读取少量相关样例，替换教学内容和真实素材身份，再将 page 用于 insertSlideLayout，不能把整套示例一并注入上下文或写进用户课件。

## 素材清单

[manifest.json](manifest.json) 是固定样例的本地素材映射，供隔离验收读取；不是用户会话的图片登记回执。

| 样例别名        | 文件                              | 性质与限制                                                                                   |
| --------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| example-garden  | [garden.png](assets/garden.png)   | AI 庭院情境插画，不能作为历史实景证明；正文标题由原生文字承载                                |
| example-animals | [animals.png](assets/animals.png) | AI 动物观察插画，仅作教学情境，不能当作物种鉴定依据                                          |
| example-sine    | [sine.png](assets/sine.png)       | 确定性正弦曲线图；源码为 [render-sine.mjs](assets/render-sine.mjs)，不以 AI 插画代替准确图形 |

正式创作使用图片工具登记/生成图片后返回的 assetId，逐项替换 `example-*`；不直接提交上述本地路径或别名。精确科学图通常使用结构化 diagram，使来源随对象保存；此处 PNG 只固定图片布局的输入，不替代来源持久化验收。复用主题角饰或背景时使用本次真实登记结果，不重复生图。

## 使用边界

PageFrame 默认只生成标题与正文，不补页脚或页码；样例不传 section/footer，必要图注随图片就近排版。只有 PageFrame、QuotePanel、StepMarker、ConclusionBand 四个容器接受 children；SectionHeading、ImagePanel、CornerMotif 三个叶子组件不接受 children，避免静默丢失正文。仓库内部实现路径不属于本技能的执行说明。

固定八页不代表完整课时，静态图也不证明动画和投屏效果。内容与方法以 [Skill](../../SKILL.md)、[视觉设计](../../references/design.md) 和 [检查与交付](../../references/review.md) 为准。
