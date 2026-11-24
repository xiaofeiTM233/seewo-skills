// 情境导入。example-garden 只供样例验收；实际创作先登记图片并替换 assetId。
const page = {
	schemaVersion: 2,
	theme: "ink",
	title: "走进百草园",
	root: (
		<PageFrame key="page" title="走进百草园" theme="ink">
			<flex key="hero" direction="row" gap={36} box={{ grow: 1 }}>
				<flex key="intro" gap={24} justify="center" box={{ grow: 1, basis: 0 }}>
					<text key="display" role="title" group="display" style={{ fontSize: 54, bold: true }}>
						一座园子，{"\n"}怎样成为乐园？
					</text>
					<text key="lead">从颜色、声音与动作出发，寻找儿童眼中的趣味。</text>
					<ConclusionBand key="opening-task" label="带着问题阅读">
						<text key="opening-question">圈出最吸引你的一个细节，用原文说明理由。</text>
					</ConclusionBand>
				</flex>
				<ImagePanel
					key="garden"
					box={{ width: 510 }}
					assetId="example-garden"
					height={400}
					fit="cover"
					caption="鲁迅《从百草园到三味书屋》· 情境插画为 AI 生成"
				/>
			</flex>
		</PageFrame>
	),
};
text(page);
