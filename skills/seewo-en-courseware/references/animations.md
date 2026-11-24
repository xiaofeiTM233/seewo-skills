# 教学动画

按教学与阅读节奏主动安排动画：既服务于答案揭晓、步骤推导，也可帮助普通展示页建立阅读顺序、突出重点、衔接章节。封面、目录、知识介绍和总结页都可以适度使用，不因“普通展示页”而省略动画。用户要求静态或指定动画风格时遵循其偏好。

## 场景与节奏

在 STORY 阶段逐页确定原生页的动画效果与推进顺序，以下作为选择建议，不设动画页比例或数量配额。多要点讲解、推导、对照与答案页默认按语义分组呈现；确实需要同时阅读时简记静态理由。不能只给少数重点页配置、把其余原生页无理由地统一记为静态：

| 页面场景                   | 可采用的呈现方式                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------ |
| 封面、章节页               | 内容常显，使用简短 Fade 页面过渡；需要开场停顿时，也可点击淡入标题或导语             |
| 目录、目标、普通知识介绍   | 标题常显，将相关要点或图文按讲解顺序分组淡入；短小且需要整体阅读的内容可一次呈现     |
| 图文赏析、对比、原文与释义 | 先展示观察对象，再点击呈现解释、对比项或重点结论；同一意思的图、文及卡片背景同步出现 |
| 总结、回顾                 | 按知识结构分组呈现，或保留整页内容并用简短过渡收束                                   |
| 答案揭晓、步骤推导         | 保留题干和必要条件，教师点击揭示答案或下一步，给学生思考时间                         |

普通展示页优先使用简短 FadeIn 或 Fade 过渡，通常少量分组即可；不要让教师为每个短句、图标或装饰单独点击。需要同时阅读的表格、全诗、全图可保持常显或整组呈现。避免为了增加动画数量而隐藏阅读上下文，连续页面保持效果一致，确有方向关系时再用移入或擦入。

教师点击推进独立讲解步骤，同一步图文同步出现，紧密关联且无需停顿的解释可以自动接续；需要观察、提问或思考时保留下一次点击。默认 400ms、无延迟、播放一次。当前元素动画首步必须点击，不支持进页自动启动元素序列；仅希望切页时自然出现时使用页面过渡，不凭空添加自动触发参数。

## 生成

将 STORY 中已确定的元素动画或页面过渡落实为 `page.animationPlan`，随同一次 `insertSlideLayout` 提交；规划文字本身不会生成动画。STORY 写清常显对象、每步目标内容、点击/自动接续、具体效果与过渡，制作本页时再把语义目标映射到节点 key；不能只写“逐步出现”。布局节点使用唯一 `key`，由计划引用；用于答案揭示的步骤标记 `purpose:"answerReveal"`。容器目标包含背景和全部后代元素，因此答案卡片不会先露出文字或留下背景。每条要点、公式或答案分别作为独立内容块，不要求单文本框内部逐字或逐行播放。

批次草稿保留每页的完整 page 对象，包括 root 与 animationPlan；写入循环直接传该 page，不重新只挑 title/theme/root 导致动画字段丢失。在已有的写入前自检中确认：规划有元素动画的页有对应 steps 与 targetKey；仅过渡的页带 `steps:[]` 和 transition（例如 `animationPlan:{steps:[],transition:{effect:"Fade",durationMs:400}}`）；明确静态的页才省略。动画与内容在同次生成请求内提交，不等全篇完成后再查询元素 ID 补写。HTML 页的内部交互在 HTML 中实现，不给其截图背景套原生步骤冒充内部动画。

`steps[].purpose` 可省略；需要标记时仅接受 `answerReveal`、`explanation`、`emphasis`。提问或展示题干属于讲解，可用 `explanation`，不新增 `question` 等枚举值。字段校验失败按报错的完整路径与合法值修改当前页，保留其他页及动画设计。

```json
{
	"title": "练习讲解",
	"root": {
		"kind": "flex",
		"gap": 32,
		"padding": 60,
		"children": [
			{
				"kind": "text",
				"key": "node-2",
				"paragraphs": [
					{
						"runs": [
							{
								"text": "计算 6 × 7"
							}
						]
					}
				]
			},
			{
				"kind": "flex",
				"key": "answer",
				"padding": 24,
				"style": {
					"backgroundColor": "#E8F2FF"
				},
				"children": [
					{
						"kind": "text",
						"key": "node-4",
						"paragraphs": [
							{
								"runs": [
									{
										"text": "答案：42"
									}
								]
							}
						]
					}
				],
				"direction": "column"
			},
			{
				"kind": "text",
				"key": "explanation",
				"paragraphs": [
					{
						"runs": [
							{
								"text": "可以分解为 6 × 5 + 6 × 2。"
							}
						]
					}
				]
			}
		],
		"key": "node-1",
		"direction": "column"
	},
	"animationPlan": {
		"steps": [
			{
				"key": "reveal-answer",
				"start": "click",
				"purpose": "answerReveal",
				"effects": [
					{
						"targetKey": "answer",
						"effect": "FadeIn"
					}
				]
			},
			{
				"key": "explain",
				"start": "afterPrevious",
				"purpose": "explanation",
				"effects": [
					{
						"targetKey": "explanation",
						"effect": "FadeIn"
					}
				]
			}
		]
	},
	"schemaVersion": 2,
	"theme": "academic"
}
```

参数：`durationMs` 1–10000、`delayMs` 0–10000，均为整数毫秒。首步必须 `click`；同一步 effects 同步，`afterPrevious` 等上一组结束后执行。

支持 `FadeIn/FadeOut`、`TranslateIn/TranslateOut`、`DiagonalWipeIn/DiagonalWipeOut`、`Zoom`、`Transparency`。移入移出和擦入擦出可以设置 `orientation: LeftToRight|RightToLeft|TopToBottom|BottomToTop`，默认 LeftToRight。`Zoom.scale` 0.5–2（默认 1.1），`Transparency.opacity` 0–1（默认 0.5），二者只用于单个原生元素，不用于多元素容器。强调后的大小或透明度是原生效果的结束状态，不承诺自动回到原值；缩放需考虑相邻内容。

可选 `transition:{effect:"Fade",durationMs:400}` 与 steps 同级。页面过渡支持 None、Fade、SlideToLeft、SlideToRight、SlideToTop、SlideToBottom；仅过渡时 steps 为 []。是否加入过渡取决于教学节奏，不默认每页设置。

每个元素最多一个出现、一个强调、一个消失动画；父容器 key 绑定它的全部子元素；先对父容器淡入、再对子节点淡入会重复同一出现类别。使用互不重叠的子组 key。生成动画的缺 key、首步和可静态判定的父子类别冲突会在内容写入前拒绝；合法内容提交后，真实动画调用仍可能单独 notApplied/unknown，应保留内容并回读，不重新插页。不能用第二段同类动画覆盖第一段。路径、音效、元素点击触发和复合动画仅保留，不创作。

## 原位编辑

普通改字、改样式、换图保留当前动画，新增内容默认静态。用户明确要求调整动画或讲解步骤时，先 `tools.courseware_read` 查询 `{"kind":"animations","slideId":"..."}`，取得原生动画 ID、元素 ID、步骤及当前 editorInstanceId/revision。存在 nextOffset 时，以 offset 和同一 knownRevision 读取下一页；版本变化必须重新开始，不能拼接两个版本。

```javascript
const first = await tools.courseware_read({ coursewareId, query: { kind: "animations", slideId } });
if (first.data.nextOffset !== undefined) {
	const next = await tools.courseware_read({
		coursewareId,
		query: {
			kind: "animations",
			slideId,
			offset: first.data.nextOffset,
			knownRevision: first.revision,
		},
	});
	text(next);
}
```

`offset` 必须是数字，不能转成字符串，也不能改用 `cursor`。遇到 CURSOR_STALE 先重新读取首页取得新 revision，再按同一版本继续；不要枚举参数名。

动画写入每次只提交一个 operation，并附带新的 `operationId` 和读取得到的 `expected:{editorInstanceId,revision}`：

- `insertAnimationSteps`：`slideId`、`anchor:{kind:"start"|"end"}` 或 `{kind:"after",animationId}`，`steps` 与生成相似，但 effects 用 `elementIds:[...]` 替代 targetKey，不带生成步骤 key。锚点定位整个同步步骤。可同时附带 transition。
- `updateAnimation`：`slideId`、`animationId`、`parameters`，只填需修改的 effect/durationMs/delayMs/orientation/scale/opacity。
- `removeAnimations`：`slideId`、`animationIds`。
- `moveAnimationStep`：`slideId`、步骤中任一 `animationId`、`anchor`、`start`，移动整个同步组。
- `setSlideTransition`：`slideId`、`transition`，None 表示移除。

参数校验失败时按字段错误修正本次调用，不能据此判断动画接口不可用或改为静态页。例如编辑已有元素应写 `{effect:"FadeIn",elementIds:["实际元素ID"]}`；`targetKey` 只用于生成时的 `page.animationPlan`。保留教学动画意图，按当前工具声明核对版本、目标与步骤后重试；结果未知仍先查询操作状态，不能盲目重放。

已有复杂动画不可编辑项保留原样。复杂队列不能证明安全时拒绝重排，不重新生成整页。删除带动画的元素前，先明确删除对应动画；作为触发源的元素不能直接删除。替换 Shape 为 Picture 若影响动画身份则拒绝；保留原元素，不能以相似新图替代后宣称无损。

## 失败、撤销与交付

同一次布局调用中，工具内部先提交静态内容，再独立提交动画，分别形成撤销记录；模型无需将新页拆成两轮写入。静态页已确认写入而动画失败时，保留内容并记录待修页，继续批量创建，不重新插页；全部页面创建完成后再按每批 3–4 页组织动画检查与修复，单次动画操作仍遵守独占与版本要求。未知写入先核对实际状态。交付时按实际页码列出未解决项，答案揭示未落实的页面必须提示“授课前必须修复，答案可能直接可见”，包括尚未提交计划的遗漏页。

- applied：原生动画写入且回读一致；不等于播放已验收。
- notApplied：未应用，或已恢复动画写入前状态；内容仍保留。
- unknown：部分写入或通信中断。用 `{"kind":"operation-status","operationId":"..."}` 与实际 animations 查询核对，不盲目重放。编辑器重建后操作记录可能不存在，这不证明写入没有发生。

生成结果保留静态写入回执、layoutReadback 和独立 animation 回执。`insertSlideLayout` 的动画结果在顶层 `reply.animation`；原位 `insertAnimationSteps` 等动画编辑的结果在对应 `reply.applied[].animation`，按 operationIndex 匹配，不只打印顶层字段而漏掉实际回执。依据本页规划解释动画结果：

- 明确静态：无需 animation 回执，不为通过检查补动画。
- 已规划元素动画或过渡：检查对应 `animation.status`，只有 applied 证明已配置。回执缺失时先检查提交参数：未传 animationPlan 记为漏提交；已传而结果缺失记为待查。两者都先定向读取当前页 animations 再决定补写，不能当作已完成或自动改记静态。仅有过渡时 steps 可以为空，单独核对 transition。
- notApplied 或 unknown：保留对应状态和待修项，按上面的恢复规则处理，不能用内容已写入代替动画成功。

核对配置时，对照原 STORY 的真实目标内容、元素绑定、点击分组和自动接续关系，并核对计划页码与已配置页码的差额。不能通过事后追加“其余静态”或删除计划消除遗漏；缺项集中原位补齐，无法完成则保留实际页码与原因。需要读取完整队列时沿用同一版本分页。`animations.total` 是元素动画条目数，不是点击次数；一个容器可展开成多条同步动画，不能靠数量相等判断规划是否落实。有效配置回执已覆盖且文档未变时直接复用，不机械重读每页。静态回读可能早于动画 revision，不用于后续动画写入的版本条件，修复前重新读取。

最后按当前文档提供“第几次点击显示什么、哪些内容自动接续”的摘要，并引导用户在原生播放中检查。静态截图不能证明初始隐藏、同步和接续正确。内容写入、动画回读、真实播放、保存重开分别说明；没有真实播放证据时不得宣称动画验收通过。
