// 过程推导：步骤纵向串联，公式在右侧形成稳定焦点。
text({
	schemaVersion: 2,
	theme: "academic",
	title: "从弧长建立弧度的概念",
	root: (
		<PageFrame key="page" title="从弧长建立弧度的概念" theme="academic">
			<flex key="process" direction="row" gap={44} box={{ grow: 1 }}>
				<flex key="steps" box={{ grow: 1.7, basis: 0 }} gap={28}>
					<StepMarker key="step1" number="1" title="选定同一个圆心角">
						<text key="step1-body">改变半径，观察这个角所对弧长怎样变化。</text>
					</StepMarker>
					<StepMarker key="step2" number="2" title="比较弧长与半径">
						<text key="step2-body">半径变为两倍，所对弧长也变为两倍。</text>
					</StepMarker>
					<StepMarker key="step3" number="3" title="用不变的比值描述角">
						<text key="step3-body">弧度数 = l/r；当 l=r 时，对应 1 弧度。</text>
					</StepMarker>
				</flex>
				<flex
					key="formula"
					box={{ grow: 1, basis: 0 }}
					padding={30}
					gap={24}
					justify="center"
					style={{ backgroundColor: "$accentSoft" }}
				>
					<text key="formula-title" style={{ bold: true, color: "$accent" }}>
						把长度关系写成式子
					</text>
					<text key="formula-main" role="title" group="formula" style={{ fontSize: 54, bold: true }}>
						α = l / r
					</text>
					<shape
						key="formula-rule"
						shapeType="rect"
						box={{ height: 3, width: 72 }}
						style={{ backgroundColor: "$decorative" }}
					/>
					<text key="formula-conditions">{"l 为弧长，r 为半径，r > 0；α 为非负圆心角的弧度数。"}</text>
					<text key="formula-case">当 l = r 时，α = 1。</text>
					<text key="formula-prompt">试想：整圈对应多少弧度？</text>
				</flex>
			</flex>
		</PageFrame>
	),
});
