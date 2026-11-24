// 重点结论：大字作为焦点，解释与应用仍保留。
text({
	schemaVersion: 2,
	theme: "red-gold",
	title: "让判断有据可依",
	root: (
		<PageFrame key="page" title="让判断有据可依" theme="red-gold">
			<flex key="focus" direction="row" gap={40} box={{ grow: 1 }}>
				<flex key="message" box={{ grow: 1.2, basis: 0 }} gap={24} justify="center">
					<text key="big" role="title" group="display" style={{ fontSize: 60, bold: true }}>
						先找证据，{"\n"}再说理解。
					</text>
					<text key="bridge">把一句笼统的“很有趣”，变成别人能够理解的具体理由。</text>
					<shape
						key="accent-rule"
						shapeType="rect"
						box={{ width: 100, height: 6 }}
						style={{ backgroundColor: "$decorative" }}
					/>
				</flex>
				<flex key="explanation" box={{ grow: 1, basis: 0 }} gap={24} justify="center">
					<QuotePanel key="sentence" source="课堂表达支架">
						<text key="sentence-text">我从 ______ 这个词/细节，感受到 ______ ，因为 ______ 。</text>
					</QuotePanel>
					<text key="application">选一个描写景物的句子，用这个句式表达。再听同伴的解释，看看证据是否支持判断。</text>
				</flex>
			</flex>
		</PageFrame>
	),
});
