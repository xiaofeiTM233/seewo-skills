# 可组合页型与视觉样例

本文件是工程视觉回归与显式样例评审索引，不进入默认课件创作流程。仅在用户明确要求参考这些样例或维护回归时读取。八页是固定内容的 EN 原生渲染样例，用于理解构图、字体层级、装饰和内容关系；它们不是当前课题候选，不证明真实模型已按相同质量生成，也不证明美观度提升已经量化。预览须与当前样例源码一起更新，维护流程见 [样例说明](../examples/visual/README.md)。

## 选择页型

| 教学任务 | 源码与真实 EN 预览                                                                                                         | 可借鉴的结构                                     | 避免照搬的错误                                   |
| -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| 情境导入 | [01-intro.tsx](../examples/visual/01-intro.tsx) · [预览](../examples/visual/previews/01-intro.png)                         | 庭院主图、独立展示标题、明确的阅读问题           | 用无关风景替代观察主体；把标题写进图片           |
| 原文精读 | [02-close-reading.tsx](../examples/visual/02-close-reading.tsx) · [预览](../examples/visual/previews/02-close-reading.png) | 原文主区、同段富文本强调、紧邻的两项批注         | 删掉关键原文只留答案；为配色拆碎每个词语         |
| 图解探究 | [03-diagram.tsx](../examples/visual/03-diagram.tsx) · [预览](../examples/visual/previews/03-diagram.png)                   | 科学图占主区，问题对应图中证据，留出继续探究     | 用装饰图冒充精确曲线；图过小而解释占满整页       |
| 同维对照 | [04-comparison.tsx](../examples/visual/04-comparison.tsx) · [预览](../examples/visual/previews/04-comparison.png)          | 两对象按相同维度组织，结论讨论独立成区           | 无对照关系也强制等宽；提前把开放讨论写成唯一答案 |
| 过程推导 | [05-process.tsx](../examples/visual/05-process.tsx) · [预览](../examples/visual/previews/05-process.png)                   | 编号步骤承接推理，核心公式和适用条件形成第二焦点 | 只列口号没有推理；省去半径等必要条件             |
| 练习反馈 | [06-exercise.tsx](../examples/visual/06-exercise.tsx) · [预览](../examples/visual/previews/06-exercise.png)                | 大观察图、完整任务、表达支架和反例问题           | 装饰挤占作答区；暗示图片已经支持拖动或自动判题   |
| 重点结论 | [07-key-message.tsx](../examples/visual/07-key-message.tsx) · [预览](../examples/visual/previews/07-key-message.png)       | 大字焦点与表达支架、具体应用对应                 | 只有大标语没有解释；所有正文页都放展示大标题     |
| 关系总结 | [08-summary.tsx](../examples/visual/08-summary.tsx) · [预览](../examples/visual/previews/08-summary.png)                   | 观察、寻证、解释形成方法关系，以迁移任务收尾     | 只列三个名称；每个环节换词但仍是同一张空卡       |

比例、方向和图片高度按实际内容调整。补足本页所需材料后，优先扩大有教学价值的主视觉、调整主辅分区、取消无意义满高卡片；保留朗读、观察与作答留白。完整策略见 [视觉设计](design.md)，页型不形成填充率或使用数量门禁。

## 组件接口

接口与约束独立维护在 [可选组件 API](components.md)，无需读取本样例索引即可使用。

## 主题 token 与素材

颜色全部继承主题，不在示例组件中复制一份色表：

| 用途                 | token                                        |
| -------------------- | -------------------------------------------- |
| 页面底、内容底       | `$background`、`$surface`                    |
| 主要文字、次要文字   | `$ink`、`$muted`                             |
| 强调文字或实色强调底 | `$accent`                                    |
| 实色强调底上的文字   | `$onAccent`，只与 `$accent` 底配对           |
| 柔和强调底           | `$accentSoft`，搭配 `$ink` 或 `$accent` 文字 |
| 装饰、分隔线         | `$decorative`、`$line`                       |

具体值由运行时主题单一维护；主题美术语言见 [主题分支](themes.md)。默认字体按 title/body/caption 角色与实际环境解析，不把示例截图里的可用字体当作所有设备都已安装。字号下限与有限适配继续遵循 [布局合同](layout.md#主题与自动调整)。

[manifest.json](../examples/visual/manifest.json) 的 example-garden、example-animals、example-sine 仅是固定样例验收别名，**不是当前会话可直接使用的 assetId**。真实创作先通过当前可用图片工具登记/生成素材，用工具真实回执中的 assetId 替换；不要把本地路径、远端 URL 或示例别名直接提交给课件编辑工具。按 `searchTools` / `describeTool` 核对当前登记接口，不猜登记动作名。

garden.png 与 animals.png 是 AI 情境插画；保留其来源说明，不能当作史料或物种鉴定证据。sine.png 是由同目录确定性脚本绘制的样例，用于固定图片布局回归；它作为普通 ImagePanel 不证明科学图源码已随 EN 对象保存。真实课件需要可重生成的精确曲线时，使用 [diagram](math-visuals.md)，由工具保存结构化来源。相同主题角饰和已登记素材可复用，不每页重新生成背景。

## 预览与验收边界

预览来自固定 TSX 经实际 Authoring、主题字体解析、EN 原生文字测量、Yoga、EN 元素写入后的截图。它们可用于风格参考，但不能直接成为当前课件的 review evidence，不能冒充四个已经原生生成的当前课题候选。HTML/CSS 方向示意另标明“非 EN 原生页面”。

截图展示静态构图；真实模型生成、教师编辑、实际投屏、动画点击和跨设备恢复需要独立验收。例题、引用与用户实际教材也需重新核对；不把样例的精简内容当成整节课教案。当前课件按 [检查与交付](review.md) 核对内容、少量视觉抽查与问题页复查，不增加试探页或每页审美循环。
