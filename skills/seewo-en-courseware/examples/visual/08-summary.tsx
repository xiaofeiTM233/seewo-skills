// 关系总结：用主线串联方法，以迁移任务收尾。
text({
	schemaVersion: 2,
	theme: "ink",
	title: "把阅读方法带到下一篇文章",
	root: (
		<PageFrame key="page" title="把阅读方法带到下一篇文章" theme="ink">
			<flex key="methods" direction="row" gap={28}>
				<flex key="observe" box={{ grow: 1, basis: 0 }} gap={18}>
					<text key="observe-title" role="title" group="method" style={{ color: "$accent", bold: true }}>
						观察
					</text>
					<shape key="observe-line" shapeType="rect" box={{ height: 3 }} style={{ backgroundColor: "$decorative" }} />
					<text key="observe-body">圈出颜色、声音和动作，让画面在头脑中出现。</text>
				</flex>
				<flex key="evidence" box={{ grow: 1, basis: 0 }} gap={18}>
					<text key="evidence-title" role="title" group="method" style={{ color: "$accent", bold: true }}>
						寻证
					</text>
					<shape key="evidence-line" shapeType="rect" box={{ height: 3 }} style={{ backgroundColor: "$decorative" }} />
					<text key="evidence-body">回到词句，寻找能够支持感受的具体细节。</text>
				</flex>
				<flex key="explain" box={{ grow: 1, basis: 0 }} gap={18}>
					<text key="explain-title" role="title" group="method" style={{ color: "$accent", bold: true }}>
						解释
					</text>
					<shape key="explain-line" shapeType="rect" box={{ height: 3 }} style={{ backgroundColor: "$decorative" }} />
					<text key="explain-body">把词句、生活经验与感受联系起来，说清理由。</text>
				</flex>
			</flex>
			<ConclusionBand key="transfer" label="迁移任务">
				<text key="transfer-body">
					读一段新的写景文字，选出一个最有表现力的词。先标出证据，再向同伴解释它为什么好。
				</text>
			</ConclusionBand>
			<text key="self-check">自查：我的判断有原文依据吗？解释与证据对应吗？</text>
		</PageFrame>
	),
});
