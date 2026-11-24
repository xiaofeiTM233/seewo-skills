// 原文精读：原文与分析就近对应，完整段落按真实教材核对后替换。
text({
	schemaVersion: 2,
	theme: "ink",
	title: "让景物有颜色，也有触感",
	root: (
		<PageFrame key="page" title="让景物有颜色，也有触感" theme="ink">
			<flex key="reading" direction="row" gap={28} box={{ grow: 1 }}>
				<flex key="evidence" gap={22} box={{ grow: 1.65, basis: 0 }}>
					<QuotePanel key="excerpt" source="鲁迅《从百草园到三味书屋》">
						<text
							key="quote"
							group="quote"
							paragraphs={[
								{
									runs: [
										{ text: "不必说" },
										{ text: "碧绿", color: "$accent", bold: true },
										{ text: "的菜畦，" },
										{ text: "光滑", color: "$accent", bold: true },
										{ text: "的石井栏，" },
										{ text: "高大", color: "$accent", bold: true },
										{ text: "的皂荚树，" },
										{ text: "紫红", color: "$accent", bold: true },
										{ text: "的桑椹；" },
									],
									lineSpacing: 1.5,
								},
							]}
						/>
					</QuotePanel>
					<ConclusionBand key="read-task" label="再读一次">
						<text key="task">重读画出的词语：哪些让你“看见”颜色，哪些让你感到触摸与仰望？</text>
					</ConclusionBand>
					<text key="reflection">联系自己的生活经验，说说你最想走近哪一种景物。</text>
				</flex>
				<flex key="notes" gap={24} box={{ grow: 1, basis: 0 }}>
					<StepMarker key="note-color" number="1" title="颜色让画面鲜明">
						<text key="color-body">碧绿、紫红：先读出色彩，再想象景物之间的映衬。</text>
					</StepMarker>
					<StepMarker key="note-sense" number="2" title="感官让景物可亲">
						<text key="sense-body">光滑、高大：从触感与视角体会观察的细致。</text>
					</StepMarker>
					<shape key="notes-rule" shapeType="rect" box={{ height: 2 }} style={{ backgroundColor: "$line" }} />
					<text key="notes-question" style={{ bold: true, color: "$accent" }}>
						这些词语，能随意交换吗？
					</text>
				</flex>
			</flex>
		</PageFrame>
	),
});
