// 图解探究。精确曲线在正式生成中使用 diagram；样例PNG由同目录脚本确定性绘制。
text({
	schemaVersion: 2,
	theme: "academic",
	title: "从一个周期观察正弦函数",
	root: (
		<PageFrame key="page" title="从一个周期观察正弦函数" theme="academic">
			<flex key="explore" direction="row" gap={30} box={{ grow: 1 }}>
				<ImagePanel
					key="plot"
					assetId="example-sine"
					height={360}
					caption="y = sin x，图中标出一周期的五个关键点；观察区间 [0, 2π]，定义域为实数集。"
					box={{ grow: 1.5, basis: 0 }}
				/>
				<flex key="questions" gap={24} box={{ grow: 1, basis: 0 }}>
					<StepMarker key="q1" number="1" title="找关键位置">
						<text key="q1-body">标出零点、最大值与最小值对应的位置。</text>
					</StepMarker>
					<StepMarker key="q2" number="2" title="沿曲线观察">
						<text key="q2-body">哪些区间的函数值增大？哪些区间减小？</text>
					</StepMarker>
					<ConclusionBand key="predict" label="继续探究">
						<text key="prediction">再画一个周期，看看哪些位置重复。</text>
					</ConclusionBand>
				</flex>
			</flex>
		</PageFrame>
	),
});
