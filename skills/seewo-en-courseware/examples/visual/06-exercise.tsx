// 练习反馈：保留实际作答空间；答案另页或绑定真实元素分步揭示。
text({
	schemaVersion: 2,
	theme: "bright",
	title: "谁可以分在同一组？",
	root: (
		<PageFrame key="page" title="谁可以分在同一组？" theme="bright">
			<flex key="activity" direction="row" gap={34} box={{ grow: 1 }}>
				<ImagePanel
					key="animals"
					assetId="example-animals"
					height={380}
					box={{ grow: 1.25, basis: 0 }}
					caption="AI 情境插画，供观察特征，不作为物种鉴定依据。"
				/>
				<flex key="work" box={{ grow: 1, basis: 0 }} gap={20}>
					<text key="task" style={{ bold: true }}>
						找出图中有羽毛的动物，把它们分在一组。
					</text>
					<ConclusionBand key="write" label="说清楚你的理由">
						<text key="sentence">我把 ______ 和 ______ 分在一组，因为它们 ______ 。</text>
					</ConclusionBand>
					<text key="challenge">蝴蝶也有翅膀，它能按“有羽毛”这个标准分入这一组吗？</text>
				</flex>
			</flex>
		</PageFrame>
	),
});
