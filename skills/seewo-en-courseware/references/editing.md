# 编辑当前 EN 文档

只编辑用户指定范围，不重新做教学准备或全篇风格选择。读取 manifest 获取当前页、slideId 与 revision，精确读取目标页/元素。使用工具 schema 中已有的 setText、setRichText、setStyle、setBounds、replaceImage；图片继续使用已登记 assetId。修改建议每批 3–4 页，在一次 codemode 中按接口要求顺序处理；同批独立的普通修改可合并。全部目标页修改完成后再分批回读、验收和修复，重排或换图时查看真实截图；不为凑批次增加修改范围。

生成时保存的 STORY/DESIGN 只作设计参考，当前 EN 页面是内容事实源。不能重新提交旧布局覆盖用户手工修改。模糊反馈只澄清会改变范围的部分，不重复问已经确定的风格。

普通读取在 codemode 中直接返回工具声明的 DTO：manifest 的页序是 `reply.data.slides`，总页数是 `reply.data.slideCount`；slide/elements 的文字是 `reply.data.elements[].text`，search 的匹配是 `reply.data.results`。`editorInstanceId` / `revision` 在顶层。不要猜 `reply.manifest`、`reply.slide` 等别名；`textPreview` 只属于插页结果的 `layoutReadback.summary`，普通读取没有此字段。

先检查字段，再报告内容。缺字段不能通过 `|| []`、`?? []` 或 `|| 0` 解释成空课件/无文字；明确的空数组与文字 `""` 才是合法空值。`notModified:true` 表示可复用同版本缓存，或去掉 knownRevision 再读；`nextCursor` 表示仍需续读，`truncated` / `textTruncated` 表示当前文字不完整。manifest 的 `slides.length` 只是当前返回的页数，不能覆盖总页数。

```javascript
const reply = await tools.courseware_read({ coursewareId, query: { kind: "manifest" } });
if (!Array.isArray(reply.data?.slides) || !Number.isInteger(reply.data.slideCount))
	throw new Error("Manifest data.slides/slideCount missing; do not report zero pages");
text({
	total: reply.data.slideCount,
	returned: reply.data.slides.length,
	slides: reply.data.slides,
	revision: reply.revision,
	nextCursor: reply.nextCursor,
});
```

目标页文字按实际元素读取；`coursewareId` 与 `slideId` 均承接可信回执：

```javascript
const reply = await tools.courseware_read({ coursewareId, query: { kind: "slide", slideId } });
if (!Array.isArray(reply.data?.elements)) throw new Error("Slide data.elements missing; do not report empty text");
text({
	slideId,
	texts: reply.data.elements
		.filter((element) => typeof element.text === "string")
		.map((element) => ({
			elementId: element.elementId,
			text: element.text,
			textTruncated: element.textTruncated === true,
		})),
	truncated: reply.truncated === true || reply.data.truncated === true,
	nextCursor: reply.nextCursor,
});
```

整页重设计：读取完整目标内容 → 根据当前内容组合新布局 → 按每批 3–4 页创建本次全部候选页，insertSlideLayout 的 anchor 使用 after 和原页 slideId → 全部候选页创建完成后分批核对内容及截图、修复问题 → 单独删除已验证候选对应的原页。删除前再次读取原页，确认自开始设计以来未被改动；有变化则保留两页，先重新核对。不先删原页，也不删除到零页；候选插入和原页删除是不同 Undo 事务。

源页含动画、音视频、活动、未知元素或不能可靠恢复身份的原图时，优先原位编辑，不做有损整页替换。若原图无法通过可用能力重新登记，就保留原图而不是用相似新图代替。图片替换可能产生新元素 ID，后续使用回执或重新读取的 ID。

修改后只针对用户反馈的实际问题复查。纯改字不强制全篇截图；没有实际改善时换具体布局方法，不靠反复加边框或换色。

纯文字修复先比较实际元素文字与目标文字。相同则不写入；建议每批 3–4 页，将同一页或多页互不依赖的 setText 合在一次 tools.courseware_edit 中提交，遵循工具数量和大小限制。已有课件修改在全部目标修改完成后分批回读；创建后的集中修复按当前修复批次用 elements 定向回读，已与目标一致就结束，不重复发送相同 setText。回执未知或回读不一致时先核对实际内容，不盲重试；只有换行、遮挡或其他版面问题才额外截图。需要最终视觉验收时仍遵循 [检查与交付](review.md) 的新鲜截图要求。

动画编辑按 [教学动画](animations.md) 读取当前步骤及版本后原位修改。普通内容修改保留动画，新增内容默认静态；动画与页面内容分别撤销。

setText 接收真实换行字符；编辑器将段落转换成 EN 原生分隔符，保留空段和尾换行。它是纯文本整体替换，沿用原段落的默认样式；混合字体和强调的局部修改应先核对样式，不能假定整段替换会保留所有 run 的格式。只因换行问题，不删除重建原元素。

内容编辑数组仅包含当前修改需要的普通操作，不混入独占动画操作：

显式提供外层 `operationId` 时，必须同时提供 `expected:{editorInstanceId,revision}`；版本来自最近一次可信读取或成功写入回执，不能只给 operationId。连续普通语义修改可承接上一批成功回执的新 revision，无需每批再读 manifest。带 animationPlan 的插页分内容和动画提交，动画成功后使用 `animation.receipt` 的 editorInstanceId/revision，不能复用顶层较早的内容版本；最后提交的完整版本缺失或动画结果未知时先读取当前版本。版本冲突、未知写入、重连或外部修改时重新核对实际文档；需要具体内容时仍定向读取，不能把旧内容当成当前状态。

```javascript
const edits = [{ kind: "setBounds", elementId: "真实元素ID", bounds: { width: 238 } }];
const reply = await tools.courseware_edit({ coursewareId, operations: edits });
if (!Array.isArray(reply.applied))
	throw new Error("Edit applied receipt missing; inspect operation-status before retrying");
const animations = [reply.animation, ...reply.applied.map((operation) => operation.animation)];
const status =
	reply.preparation?.status ??
	(animations.some((animation) => animation?.status === "unknown")
		? "unknown"
		: animations.some((animation) => animation?.status === "notApplied")
			? "failed"
			: "completed");
text({
	status,
	contentStatus: reply.contentStatus,
	preparation: reply.preparation,
	applied: reply.applied,
	animation: reply.animation,
	revision: reply.revision,
	syncState: reply.syncState,
});
```

codemode 对声明了输出结构的工具直接返回 `structuredContent`；即使业务结果为失败，Promise 也可能正常 resolve，不能仅凭未抛错打印“成功”。上例的 `status` 是从回执计算的消费摘要，原 DTO 不新增此字段。`contentStatus:"notApplied"` 和 `preparation.status:"failed"` 表示 Host 已确认本次内容未提交，保留 `code` / `message` 中的修复诊断，在次数限制内修改源稿；failed/cancelled/unknown 均停止当前批次。内容已写入但动画失败/未知时保留内容回执，只修动画，不重插整页。提交后的超时、断连或未知错误先用原 operationId 查 operation-status 并读取实际页面；不能把所有 INVALID_OPERATION 都当成未写入，也不能用新 ID 重放未知操作。

纯文字和样式修复后复用回执或定向回读；确有视觉风险时只截图相关问题页。不要每次修复都调用 review/status，它可能触发后台截图。需要复用既有视觉结论或用户要求全面验收时再查状态；pending/stale 不等于页面有缺陷，也不要求将未抽查页全部补拍。旧证据的 revision 不能自行修改。

只调整重点标注时保留当前原文和元素ID，用setRichText局部修改目标文本框，不重建整页；不使用setStyle把整段全加粗。需要原有run细节时只定向读取目标元素，不回读全篇。

混合字体、强调和分段修改使用 `setRichText:{elementId,paragraphs,style?}`，段落/run 结构与 TSX 的 `text.paragraphs` 相同。未指定 style 时从当前文本取默认格式；需要保持某个 run 的强调时在 paragraphs 中显式保留。

科学图或矢量图读回含 `generatedSource.status:"ready"` 才可按source.kind使用 `regenerateDiagram:{elementId,diagram}` 或 `regenerateVector:{elementId,vector}`。先读取当前版本，再以独占操作、稳定 operationId 和 expected 提交；运行时保留来源中的渲染尺寸与原生对象当前边界。来源缺失、损坏、版本不支持或图已替换时不能猜测参数。普通 replaceImage 清除原来源。重生成后定向回读，按抽查策略检查变更页；不为每个对象新增截图。矢量标签是独立原生文本，源重生成不会自动移动标签，若几何关系改变需同步局部修改标签。

重点标注修改沿用同一个setRichText，不用patchElementRaw拼接整个EN对象。目标文字原有格式不确定时，定向读取`query:{kind:"elements",view:"raw",elementIds:[id],fields:["richText"]}`；语义摘要只显示整体文字/首run样式，不能据此判断所有标注。原生run的background.color、decoration（Underline/None）、fontVariants（Normal/Superscript/Subscript）分别对应backgroundColor、underline、baseline；保留未修改run及段落属性，再提交目标文本框。复杂原生扩展或混合字号无法用当前run合同无损表达时，不用全量setRichText覆盖。

setRichText使用已解析的实际颜色（如`#F0DFD6`），不直接传布局主题token。取消强调可显式使用透明backgroundColor、underline:false、baseline:"normal"。这些是run属性，不向setStyle传入underline/baseline。改动后只回读目标richText核对文字和样式；上/下标或换行发生变化时，在既有代表页抽查内检查高度，不重拍全篇。

## 箭头与图形标注

addShape与insertSlideLayout的shape使用相同shapeType和direction合同，详见[原生箭头与标注图形](layout.md#原生箭头与标注图形)。已创建图形用setStyle原位调整strokeColor/strokeWidth/strokeDash，solid可清除虚线；setBounds调整位置、大小或rotation，保留原生对象身份。direction是创建参数，不传给setStyle/setBounds。已有对象改指向优先旋转、移动与缩放；没有自动吸附和随动，不宣称调整关联文字后箭头会自动重连。

核对箭头或描边时只读取目标元素的raw字段geometry、line、lineType、penSetting、foreground、thickness。EN描边在foreground，虚线在penSetting.dashStyle；语义摘要不是完整图形格式。局部修复后回读这些字段，必要时纳入既有代表页抽查，不为每个箭头增加截图。

## 互动页改稿

同一 Session 中的受管 HTML 互动页，按 [互动课件页](interactive.md) 修改源稿并调用 updateHtmlPage；保持源路径和 slideId，外层提供新 operationId 与当前 manifest 版本。不要对整页截图执行文字修改，也不要删除旧页后重插。
