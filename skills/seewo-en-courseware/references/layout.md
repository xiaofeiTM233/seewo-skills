# TSX 原生课件布局

先在 codemode 中用 `text(await describeTool("courseware_edit"))` 查询实际接口。启用内置 en-courseware 后，`codemode` 支持 TypeScript/TSX、纯函数组件和数据循环；没有 JSX 的读取与修复代码也支持类型标注。无需 import，不使用 React、DOM、CSS 或第三方组件。页面采用 `schemaVersion:2`；旧 row/column JSON 输入已经移除。

根据当前内容自由组合下方基础节点，可定义纯函数组件复用本课共同结构。无需选模板，也不默认使用 PageFrame。需要快捷组件时仅查 [组件 API](components.md)，不加载视觉样例。

写入合同为单个 `insertSlideLayout`，提供 `anchor:{kind:"end"}` 与 `page:{schemaVersion:2,title,theme,root,animationPlan}`；root 是本页自行设计的 TSX 布局树。有已规划的元素动画或页面过渡时，page 同时带上 [animationPlan](animations.md#生成)，明确静态的页才省略。批次循环传完整 page 对象，不能只重组 title/theme/root 丢掉计划。每次调用仍只插入一页。

## 调用前检查

- 教学正文默认 body，自动缩字最低24；bright 及低年级正文自动缩字最低28，其他主题用于低年级时设置 `bodyMinimum:28` 或更高。必要来源与图注使用 `role="caption"` 的默认16号；标题使用 `role="title"`。优先省略 fontSize，由主题和有限适配控制。有意采用小字号时显式指定，低于角色推荐值只返回 `FONT_BELOW_RECOMMENDED` 提示，在既有代表页抽查中判断可读性，不因此重试或插入测试页，也不靠缩小文字掩盖空间不足。
- 内容短的容器不必填满正文区；只有同维对照才默认等高。文字优先自动高度；横向剩余栏用 `box={{grow:1}}` 即按剩余宽度分配，显式 basis/width 优先。不要删除必要正文来消除诊断。
- 页面不创建页脚、页码或总页数节点，不为它们预留固定区域；使用 PageFrame 时不传 section、footer、footerHeight 或 footerRule。先从720中扣除上下边距、实际标题区和各段gap，再分配正文。必要来源或图注就近排在对应内容旁；16号单行文字通常约40高（含内边距），不能按16或24高预留。长图注使用剩余宽度并保持自动高度，内容仍超预算时调整分栏或拆分完整教学内容。
- 短标签也使用自动高度；字号28并不保证能放进40高的原生文字框。背景用独立 shape，与文字作为兄弟节点；`text` 内只放字符串或 paragraphs/runs，不嵌套 shape。形状用 `shapeType="rect"`，伸展用 `box={{grow:1}}`。数学比较符号写在字符串表达式内，如 `<text key="condition">{"Δ > 0 时有两个不相等的实数根"}</text>`，避免裸 `<`/`>` 触发 JSX 编译错误。
- TSX 文字字号写在 `style={{fontSize:...}}`，不写顶层 `<text fontSize={...}>`；优先继承 role。图片旁的图注也有原生内边距，使用自动高度，不按16号字硬设22高。装饰图形保持在画布内；需要出血的氛围用素材裁切表达，不用负坐标的大椭圆触发明显画布越界。
- 独立定义的科学图可标注 `const diagram: CoursewareDiagram = {...}`，避免对象数组的 kind 被推断为普通 string；运行时仍检查数量和数值上限。多边形 vertices 为3–12个点 ID，不能把几十个采样点塞进 polygon。
- 失败后按错误节点 key、行列、实际需求和下限修改共享组件，再重试未成功页。不要往用户课件插入 probe/test 页探索 schema、字号或标签名；接口以 `describeTool` 和本参考为准。

## 组件与约束

- `flex`：direction 为 row 或 column；默认 column，默认 gap 为24。支持 wrap、align(start/center/end/stretch)、justify(start/center/end/space-between)、gap、padding；padding 为单个数字，不接受 CSS 四边对象。`lockedSpacing` 锁定该容器的 gap 与 padding；正文内部可用独立 flex 保留有限适配。
- `stack`：叠放，子节点用 box 的 x、y、width、height 定位。装饰可以叠放，正文避免互相遮挡。
- `text`：字符串 children 自动规范化换行；显式换行用 `{ "第一段\n第二段" }`，不依赖源码缩进。富文本使用 paragraphs，不能同时提供文字 children。接收布局节点的组件把节点直接放进 flex/stack；不要用 `<text>{节点}</text>` 再包一层。
- `image.source` 接受已登记的 `{ kind: "asset", assetId }`，或本地文件 `{ kind: "file", path }`。本地 PNG、JPEG、WebP、GIF 由当前会话授权读取并在编辑时登记。SVG 按 [静态图接入](subject-integration.md#静态图) 转成 PNG。
- `image.fit` 支持 contain 和 cover。contain 不裁切，cover 默认居中裁切，可用 `focus={[0.7,0.3]}` 指定源图归一化焦点（0–1）。用 `style={{opacity:0.5}}` 调整透明度。
- `vector`：受限几何/曲线转透明图片并保存源；标注用原生 text，见 [矢量图解](vector-graphics.md)。
- `shape`：rect、ellipse、roundRect、line、arrow、doubleArrow、triangle、diamond、bracket、brace，输出原生可编辑图形。
- `diagram`：使用 [理科绘图](math-visuals.md) 中结构化对象，输出图片并将源随对象保存。

每个节点必须有页内唯一 key。box 支持宽高、百分比、min/max、grow、shrink、basis、position:'absolute'、x、y。横排中 grow>0 且未指定 width 的栏默认 basis:0、shrink:1，显式 basis/shrink 优先；纵排仍按内容基准分配。盒布局使用 Yoga 的明确子集，不接受任意 CSS。TSX 的结果直接是布局节点，不是 React 元素，不访问 `.props`；通过节点自身的 box/style/children 修改。

普通文字不设固定高度，让内容参与测量。必须固定高度时，引擎仍检查文字是否放得下。超过限制返回节点 key、源码行列及约束原因，先修正该节点的高度、间距或父容器分配，再考虑换版或拆页；不能靠删除正文或标成 caption 绕过。

## 原生箭头与标注图形

简单关系和标注优先使用shape，不生成图片或用多个小图形拼箭头。arrow为单向、doubleArrow为双向；line/arrow/doubleArrow支持direction：right、left、up、down、upRight、downRight、upLeft、downLeft。箭头默认right；line保留默认upRight，画水平/垂直线必须显式指定方向。水平线位于盒子高度中线，垂直线位于宽度中线，斜线连接相应角点；盒子宽高要为目标方向留出实际长度，禁止退化为点。

shape.style支持strokeColor、strokeWidth、strokeDash（solid/dashed/dotted）和opacity，填充用backgroundColor；line、箭头和括号默认开放无填充。描边优先主题$accent或$line，普通箭头建议2–4逻辑单位。bracket是左方括号，brace是左花括号，用于归纳相邻信息；triangle和diamond可作为提示或判断标记，不能代替文字说明。

标注文字放独立原生text，通过flex或stack排列，正文优先继承主题字级；显式小字号沿用可读性提示规则。箭头两端留出空隙，避免穿字；虚实线仅在能解释关系差异时使用。不承诺连接点吸附、折线自动避障、箭头随目标对象移动或图形内置文字。关系复杂时再使用vector/diagram，保留源并独立放置原生文字。

## 主题与自动调整

主题：academic（学术蓝）、navy（海军蓝）、red-gold（红金）、ink（宣纸）、bright（明亮）。颜色 token：`$background` 页面底、`$surface` 内容底、`$ink` 主要文字、`$muted` 次要文字、`$accent` 强调文字/强调底、`$onAccent` 强调实色底上的文字、`$accentSoft` 柔和强调底、`$decorative` 装饰、`$line` 分隔。具体颜色由主题统一解析，不在页面组件中复制色表。主题视觉语言见 [主题分支](themes.md)，图文与布局仍可自由组合。

1280×720 EN 逻辑单位：普通主题自动适配为 body 28→26→24、title 40→36→32，caption 默认16且不自动缩字；bright 正文为32→30→28、标题为40→36→34。`bodyMinimum` 只能提高自动适配下限；显式字号保留，低于角色推荐值只提示。其他画布按比例解析。未指定字体先继承主题的文字角色，再解析可用字体；字体缺失时明确返回回退结果，同一实际字体用于测量和输出。不要为了统一外观给所有节点提前写死 Arial。

根页框的 gap/padding 保持稳定，正文内部未锁定间距才参与原值、85%、70% 的适配，再按当前页面的 role＋group 一起缩字。未指定 group 为 page；显式 fontSize/lockedFont 只锁定该节点，不阻止同组其他正文适配。画布内的容器/边距越界、不超过4逻辑单位（随画布缩放）的画布轻微出血及显式小字号，写入成功并在 layout.diagnostics 中提示，不因这些提示重试或先截图。文字实际放不下、明显画布裁切及非法字号仍阻断写入，不截断、不删文字。layoutReadback 的静态提示也不单独构成返工理由，集中抽查时判断是否影响阅读。

生成与实际回读/审阅共用同一画布容差；`staticAdvisories` 或审阅的 `GEOMETRY_MINOR_OVERFLOW` 表示轻微出血，只需在现有抽查中判断可读性，不为此重排整页、重复扫描所有页面或扩大截图范围。`staticIssues` 中的明显裁切、文字放不下仍须处理。

段内重点通过paragraphs/runs表达，字符串中的`**重点**`不会自动变粗，`<b>`/`<mark>`也不是支持的节点。run支持bold/italic/color/fontFamily，以及backgroundColor（词级底色）、underline（布尔值）、baseline（normal/superscript/subscript）；保持同段自动换行。backgroundColor在TSX布局中支持主题token，正文高亮优先$accentSoft搭配$ink；它与文本框style.backgroundColor不同。强调策略见[正文富文本与重点标注](design.md#正文富文本与重点标注)。

取消底色用`backgroundColor:"rgba(0,0,0,0)"`，取消下划线用`underline:false`，恢复基线用`baseline:"normal"`。上下标保留正文基准字号，实际字形缩放与基线交由EN处理，不手工缩字号或偏移文字框。

富文本接口片段（不是页面模板）：

```tsx
const quote = (
	<text
		key="quote"
		paragraphs={[
			{
				runs: [
					{ text: "先观察", bold: true, backgroundColor: "$accentSoft" },
					{ text: "，再用证据解释。", underline: true },
				],
				lineSpacing: 1.2,
				spaceAfter: 12,
			},
			{ runs: [{ text: "颜色、声音与动作共同构成画面。" }] },
		]}
	/>
);
```

领域工具直接返回业务 DTO，不需要每次 `text` 整份结果。`tools.courseware_read` 的结果按查询分支读取：截图通过 `images` 输出图片并读取 `reviewEvidence`，审阅状态读取 `slides`。`insertSlideLayout` 的布局回读在 `layoutReadback`，动画汇总在顶层 `animation`；原位动画编辑的结果则在对应 `applied[].animation`。内容与动画分别按实际回执记录，不以单一成功标记代表页面制作完成。是否应有动画结果以本页规划为准，详见 [动画回执规则](animations.md#失败撤销与交付)。不能仅因字段缺失就判定空数据、零消耗或成功。只需筛选结果时直接 `text({ ... })`，不先 JSON.stringify。

限制：一页200节点、12层；单个文字节点4000字符；段落128、每段128 runs。不要用一次超大提交拼全篇。角色组调整有限轮次，超时或资源失效先修原因，不重放未知写入。

## 页型、装饰与复用

依据本页教学任务和内容关系设计构图，没有固定页型目录。模型可自主决定分区、排列方向、视觉重心与局部叠放；共享样式与基础组件用于维持一致性，不强制每页相同外框。教师后续手改仍以当前 EN 文档为准，旧 TSX 不持续控制编辑器。

结构装饰用标题短线、内容标签等原生元素；内容强调用富文本、引文线、批注或步骤标记；主题氛围用少量角饰与登记素材。装饰背景在 stack 中先输出，强调底先于文字，避免遮挡正文和科学图。装饰 key 与教学内容 key 分开，动画只绑定需要讲解的内容。分隔线可用窄矩形，不依赖容器描边产生可见线条。

按目标比例准备图片，共享主题装饰复用 assetId。精确绘图按对应学科规则生成，讲解页用原生组件组织文字与配图。完整策略见 [视觉设计](design.md)。

制作建议每批 3–4 页，在一次 codemode({code}) 中顺序调用；每次 tools.courseware_edit 只提交一页 insertSlideLayout。全部页面创建后复用回读核对内容，按 [检查与交付](review.md) 少量抽查截图。遇到未知写入立即核对 manifest、operation-status 与实际页面身份，未核实前停止新增，不重插页面。接口通过原生 describeTool 查询，工具直接返回业务 DTO。

## 失败后的局部修复

当前批次 TSX 展开为布局树后，在首次 tools 写入前，用原生 codemode 的 `store` 暂存每页完整参数（含已规划的 animationPlan）、课件 ID 和下一待写位置，随后在同一调用中顺序写入，每页成功记录真实 slideId。不能只保存 out 回执而未保存 pages 草稿；否则一个节点错误会迫使下一轮重写整批。页级错误捕获后正常结束脚本，下一次 `load` 只修失败页，保留其余内容与呈现节奏；不为保存草稿增加固定的模型轮次。只保存当前批次，不额外预写全篇文件；成功页的当前 EN 文档始终是事实源。编译失败时脚本里的 store 没有执行；使用下述宿主保存的编译失败原稿，只修报错位置，避免改写其它页面。跨 Run 或恢复后先核对 load 结果，缺失时读取已保存资料与实际文档，不能用 undefined 的课件 ID 写入。

批次执行使用页级 try/catch，错误打印后停止该批并正常结束，保留草稿与成功页 ID。`store(key,value)`/`load(key)` 是函数，不使用 store.get/set；图片只存 assetId/path 等元数据，预览直接 image，不把 base64 存入草稿。`// @options:` 仅放输入首行，不在复制的补丁内重复。一次类型错误只修对应行，不重写整批长代码。

**修复不得删减原方案**：在原稿上保留共享 backgroundElements、本页装饰、配图 source、完整 animationPlan（steps、目标 key、transition），以及 HTML 页的源码路径、交互动作、反馈与 verification。写入前沿用当前批次自检，对照原稿及 STORY / DESIGN 核对这些项目，不能仅以编译通过或工具成功宣布恢复。背景参数放错位置时移动原数组并补齐字段，不设 includeBackground:false；仅过渡缺 steps 时补 steps:[] 并保留 transition；有元素动画时保留原定步骤；互动校验失败时修动作或反馈，不删验证、不改静态页。转换背景写法见 [组件 API](components.md#课件级风格与语义富文本)。这些核对合并进当前修复调用，不增加固定截图或确认轮次。

- **TSX/参数错误**：先看 diagnostics 的原始行列、excerpt 光标和 related 开括号位置。语法错误优先修复括号、逗号等结构，不把对象缺括号误判为 JSX/公式问题。只修改报错行、属性或缺失参数。宽高写在 `box` 内，如 `box={{width:370}}`，不写 `<stack width={370}>`；`theme="academic"` 不写成 `theme:`。未通过编译的代码没有执行，不重做教材、风格和已成功页面。
- **尚未写入的布局错误**：从 store 取回当前页树，按诊断 `key` 定位节点，修改相关 `box`、gap/padding 或父容器分配后保存，只重试这一页。文字高度不足先取消不必要的固定高度；容器溢出先按实际可用高度分配主辅内容，不凭猜测连续缩小整页字号。模型只输出补丁代码和必要摘要，不再次打印整棵树。不要把节点 key 当已写入的 EN elementId。
- **已成功写入的问题**：依据回执或定向读取得到的真实 elementId，用 setText/setRichText/setBounds/setStyle 等原位修复，见 [编辑](editing.md)。不重新 insertSlideLayout 修复同一页，不拿旧布局覆盖用户修改。
- **外层脚本失败**：优先读 `BUSINESS_WRITE_RECOVERY` 的可信业务摘要。`completed` 的写入没有回滚，复用对应 resource.id，再查实际文档接着做，不重新创建空白课件；`running`/`unknown` 或摘要省略的调用须先查 operation-status、manifest 或目标页。恢复文件仍遵守原文件权限；摘要不是新的访问授权。没有摘要时按原有实际状态核对，不全盘重放。
- **写入未知**：先查 manifest、operation-status 或目标页，确认成功与否再继续；此前成功页不能重放。重试同一故障仍失败时，读取约束或简化问题子树的实现结构，同时保留上述设计内容；只在局部无法表达目标时重做该页，不重做整批。

编译拒绝的回执若含 `draftId`，宿主已在本 Session 保存未执行的原稿，不依赖脚本 store。下一次 codemode 只提交一行补丁指令（JSON 字符串中的换行写成 `\n`）：

```javascript
// @courseware-repair: {"draftId":"<本次回执的 draftId>","edits":[{"oldText":"<精确且唯一的原文片段>","newText":"<修正后的片段>"}]}
```

每项替换必须唯一匹配，含糊时补充上下文；按顺序应用 1–20 项局部替换。保留原稿首行 `// @options:`，不要在补丁指令后追加另一段脚本。补丁仍经原编译器、Pi 沙箱和工具权限执行。编译再失败时使用新回执的 draftId；同一原稿一旦进入修复尝试就不能再次提交，避免运行失败后重复业务写入。草稿未保存、当前分支不可见或宿主不支持时，依据原始诊断修正源稿，不能臆造 ID 或声称已保存。

创建空白课件与搜图分开提交：创建成功后保存课件 ID 并正常结束该次脚本，再执行可能失败的素材检索；后续页批次仍使用页级 try/catch 保存进度，不把全篇制造成一个不可恢复的大脚本。

同页同类阻断最多两轮定向修复；仍失败时改用更简单的局部结构（单栏、自动高度、减少嵌套与固定尺寸），保留完整教学内容、主题装饰、动画和互动。不要连续猜测字号、间距和宽高，也不要用提前截图来探索尚未写入的布局。

原生 store 仅在整段脚本成功结束时持久化。批量写入须在页级 try/catch 中捕获失败，保存已成功页的回执与失败位置，输出错误后停止本批并正常结束脚本；不能再次 throw 导致本批进度丢失，也不能把捕获错误说成页面成功。若整个调用超时/崩溃，存储可能没有提交，先核对实际文档。每个草稿 JSON 最多 262144 字符，总 store 最多 1048576 字符；不保存图片 base64，成功页草稿可用 store(key, undefined) 清理，只保留小型身份与回执摘要。局部补丁与当前页重试也可同次执行，遵守相同的页级错误捕获与停止规则。

草稿存储只减少重复代码，不改变权限、版本或写入确认合同。调用 tools 前保存的草稿不能证明页面已写入。
