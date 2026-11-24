# 可选布局组件 API

启用内置 en-courseware 后，这些函数已由原生 codemode 的课件创作扩展提供；直接写 JSX，无需 import、React 或第三方库。它们展开为现有 flex、stack、text、shape、image 节点，不新增页面存储格式。布局仍由 EN 原生测量与 Yoga 完成。

各组件必须提供页内唯一 `key`。只有 PageFrame、QuotePanel、StepMarker、ConclusionBand 四个容器接受 `children`，其中的文字用 `<text>` 包裹，不传裸字符串。SectionHeading、ImagePanel、CornerMotif、VectorGraphic 是叶子组件，类型检查和运行时均拒绝 children，不能把正文放在其标签内部。除根页框外，`box` 可传 [布局](layout.md) 中的宽高、grow、basis 等约束。源码行列 `location` 自动注入，不需要填写。组件内部会生成 `${key}-title`、`${key}-image` 等派生 key，避免与手写节点重名。

| 组件             | 必填参数                               | 可选参数                                                                                                           | 输出与使用范围                                                                                                                                                                                                                                                                                     |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageFrame`      | `key`、`title:string`                  | `section:string`、`footer:string`、`margin`、`headerHeight`、`footerHeight`、`titleRule`、`footerRule`、`children` | 用作根页框；默认左右及底部安全边距64、标题区0–120、正文区120–656，无页脚；margin范围40–160、headerHeight范围80–240、footerHeight范围40–100。常规课件不传 section、footer、footerHeight、footerRule；单独传 section 不产生页脚，也不补“课堂活动”。仅显式提供非空 footer 时保留自定义页脚能力，section 才与其合并，footerHeight 默认60。短线默认关闭，不自动加角饰。不传 box 自定义页框尺寸，特殊封面可直接组合原生节点。 |
| `SectionHeading` | `key`、`title:string`                  | `eyebrow:string`、`box`                                                                                            | 独立标题区，包含可选的小字、标题和短线；PageFrame 已内置，不重复添加整页标题。不接受 children，编译与运行时均阻断。                                                                                                                                                                                |
| `QuotePanel`     | `key`                                  | `source:string`、`variant:"plain"或"rail"或"soft"`、`box`、`children`                                              | 默认rail只有侧线；plain无底无侧线，soft另加浅底。含正文容器和可选来源。原文用 text/paragraphs 表达，来源不会自动核验。                                                                                                                                                                             |
| `ImagePanel`     | `key`、`assetId:string`                | `caption:string`、`height:number`、`fit:"contain"或"cover"`、`focus:[number,number]`、`opacity:number`、`box`      | 图片宽度随容器，图片高度默认 330，图注另占高度；不接受 children，编译与运行时均阻断。cover 默认居中，可用focus在0–1范围指定源图焦点；opacity范围0–1。准确科学图通常用contain。                                                                                                                     |
| `StepMarker`     | `key`、`number:string`、`title:string` | `box`、`children`                                                                                                  | 编号区宽度 56，数字按实际字号取自然高度，背景椭圆随容器高度伸展；右侧为标题和对应正文。number 用简短的步骤号，如 `"1"`；不放长标签，不自动添加连接线或动画。                                                                                                                                       |
| `ConclusionBand` | `key`                                  | `label:string`、`variant:"plain"或"soft"`、`box`、`children`                                                       | 默认soft柔和强调底，plain无底无内边距；可选标签和正文，适合问题、结论、反馈或表达支架；不强制占满余下空间。                                                                                                                                                                                        |
| `CornerMotif`    | `key`                                  | `theme`、`box`                                                                                                     | 默认 132×44 的局部原生形状角饰；水墨/红金用简化叶形，其余用几何圆点。PageFrame 不自动添加；按教学主题显式使用，不接受 children，编译与运行时均阻断；不能替代主图。                                                                                                                                 |

`theme` 可选 academic、navy、red-gold、ink、bright。页面的 `page.theme` 决定颜色与字体；CornerMotif 的 theme 只选择装饰形态，应传与页面相同的值；PageFrame 的 theme 仅保留为可接受参数，颜色仍取page.theme。组件不提供任意 style、CSS、阴影或字体栈参数，需自由设计时组合底层节点，不猜帮助组件属性。

`VectorGraphic` 参数与限制见 [矢量图解](vector-graphics.md)。组件只展开布局树，不创建页面；把 page 传给 `tools.courseware_edit` 的单个 insertSlideLayout，详见 [制作流程](workflow.md)。组件不自动绑定动画或隐藏答案，教学分步呈现另按 [教学动画](animations.md) 执行。

这些组件只是可选快捷写法，不是创作入口或页型要求。可以完全使用基础节点和自定义纯函数组件；PageFrame 的标题与正文结构不适合当前构图时不使用它。

## 课件级风格与语义富文本

定制风格使用内置 `createCoursewareDesign(spec)`。它在写入前统一展开颜色、文字角色和背景，输出仍是原有 page；不向工具 page 添加 palette、design 等字段。`spec` 是可序列化的本课共享数据，与 DESIGN 的规格对应，随首批草稿保存，后续批次读取后重新调用工厂；不把返回的函数对象存入 store，不依赖跨调用全局变量。

```tsx
const spec: CoursewareDesignSpec = {
  palette: {
    background: "#F6F0E6", ink: "#16263D", accent: "#C8762F",
    accentSoft: "#F0E2CE", surface: "#FFFBF4", muted: "#5B5348",
    decorative: "#D8A05A", line: "#E6DED1", onAccent: "#FFFFFF"
  },
  textStyles: { title: { color: "$ink", fontFamily: "Songti SC" } }
};
const design = createCoursewareDesign(spec);
const rawPage = {
  schemaVersion: 2, title: "寻找证据", theme: "ink",
  animationPlan: { steps: [
    { key: "reveal", start: "click", purpose: "answerReveal",
      effects: [{ targetKey: "answer", effect: "FadeIn" }] }
  ] },
  root: <PageFrame key="p3" title="寻找证据">
    <QuotePanel key="source" variant="plain">
      <text key="words" paragraphs={[
        design.paragraph(["观察", {text:"关键变化", emphasis:"concept"}, "，说明你的依据。"], {spaceAfter:12})
      ]} />
    </QuotePanel>
    <text key="answer" paragraphs={[
      design.paragraph([{text:"用观察到的变化支持结论。", emphasis:"conclusion"}])
    ]} />
  </PageFrame>
};
const page = design.apply(rawPage); // 作为 insertSlideLayout.page；原始草稿保持不变

// 封面单独构图，保留本页过渡。
const coverPage = design.apply({
  schemaVersion: 2, title: "观察与发现", theme: "ink",
  animationPlan: { steps: [], transition: { effect: "Fade", durationMs: 400 } },
  root: <flex key="cover" direction="column" padding={84} gap={24}>
    <text key="cover-title" role="title">观察与发现</text>
  </flex>
}, { includeBackground: false });
```

此色板仅演示接口，每套课件按选定方向另定，不当作默认皮肤。字体按实际环境回退。

引文可用 `QuotePanel variant="plain"`。需要把一段引文标为独立阅读区域时，可选 `rail` 或 `soft`，侧线随引文高度。其位置按引文与正文的关系确定。

- `palette`：上述九个颜色角色均需具体颜色，不在色板值中引用 `$token`。`apply` 覆盖快捷组件与手写节点中的同名 token，也为未指定颜色的正文、标题与图注补齐颜色；显式具体颜色优先保留。原有 page.theme 仍负责字体回退、字号下限与排版。
- `textStyles`：可选 title/body/caption 角色的 fontFamily、fontSize、color、bold、italic。未指定字号继续按原生测量适配，不为风格统一锁死所有字号。标题位置与组内层级由本课构图确定。
- `spec.backgroundElements`：可选的 shape/image/vector **元素数组**，放在 `createCoursewareDesign` 的配置中。JSON 节点必须写 `kind`；图形同时写 `kind:"shape"` 和 `shapeType:"rect"`。每个有独立 key 与画布坐标 box `{x,y,width,height}`。图片必须是已登记 assetId；在正文前按绝对位置加入根 flex/stack，不占内容流。最终 key 为 `${root.key}-decor-${key}`，不能与正文重名。正文和答案不放这里；背景避开主内容，不绑定教学动画。主题变体由原 spec 派生，明确同步前景与背景色。
- `apply(rawPage,{includeBackground:false})`：可选的**布尔开关**，默认 true，仅控制本页是否加入共享装饰，不改变页面底色、正文、配图或动画。DESIGN 中明确采用净底或独立构图的页面可关闭；教学图片和标注写入 rawPage 的内容节点；修复错误不能以关闭开关代替恢复背景。不要把元素数组传到 apply 的第二个参数。
- `paragraph(parts, options?)`：parts 为普通字符串或带 text 的 run，可加 emphasis：concept（概念）、condition（条件）、evidence（证据）、change（变化）、conclusion（结论）；options 支持原有 align/lineSpacing/spaceAfter。默认分别使用加粗着色、下划线、浅底、加粗着色、加粗着色；通过 `spec.emphasis` 一次覆盖某类 run 样式。局部 run 显式样式优先，原文顺序、标点和上下标保留，不自动猜词或改写文本。
- 强调不等于隐藏。待学生发现的答案放独立内容节点，按 STORY 配置 animationPlan；不要在初始题干中调用强调来泄露答案，也不要假设 paragraph 会自动创建动画。
- `motifSvg(key)` 从当前 spec.backgroundElements 中读取指定的 vector，复用其图框、透明度和色板生成 1280×720 的透明 SVG 装饰层。找不到该矢量节点会报告 EN_LAYOUT_DESIGN_MOTIF。用于风格卡和互动页。
- `vectorSvg(vector, {width,height})` 将本课矢量源和色板生成可嵌入预览或互动 HTML 的 SVG，图框尺寸使用原生逻辑单位。保存与选中后应用见[主题矢量图稿](vector-graphics.md#主题矢量图稿)。
- `cssVariables`：导出同一色板的 `--cw-background`、`--cw-ink`、`--cw-accent-soft` 等 CSS 变量，以及已指定的 `--cw-title-font-family` / `--cw-title-font-size` / `--cw-title-color` 等角色变量。HTML 与消息流风格示意从这里构造局部 CSS 变量声明并使用 `var(...)`，字号变量基于 1280×720 课件画布；窄栏预览外部说明仍按容器自适应。它不把原生布局变成 HTML，标题结构与素材媒介仍按 DESIGN 对齐。

对尚未写入的原始草稿调用一次 apply，随后暂存完整输出（包括 animationPlan）并按既有工具流程写入。apply 不修改节点 key、教学内容、图片绑定、动画或来源位置；不得用它覆盖用户编辑过的已有页面。背景 key 冲突、未知 token 等错误有明确反馈，按原始草稿局部修正；不重建已成功页面。

旧稿的 `background` 不作为新写法：元素数组移至 `spec.backgroundElements`，原布尔开关改名为 `includeBackground`。例如旧稿 `design.apply(rawPage,{background:bg})` 报错，应将原 `bg` 完整移入 `createCoursewareDesign({...spec,backgroundElements:bg})` 并改为 `design.apply(rawPage)`，补齐节点的 kind；不能删掉 bg 或只在封面补一条线。编译拒绝时用回执 draftId 按 [局部修复](layout.md#失败后的局部修复) 修改这两处，保留原 animationPlan、配图和 HTML 互动操作。
