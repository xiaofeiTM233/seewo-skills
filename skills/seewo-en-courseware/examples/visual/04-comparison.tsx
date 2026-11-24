// 同维对照：相同维度对齐，不把未经讨论的判断提前写成唯一答案。
text({
	schemaVersion: 2,
	theme: "navy",
	title: "两个空间中的童年生活",
	root: (
		<PageFrame key="page" title="两个空间中的童年生活" theme="navy">
			<flex key="compare" direction="row" gap={28}>
				<flex
					key="garden-side"
					box={{ grow: 1, basis: 0 }}
					gap={20}
					padding={24}
					style={{ backgroundColor: "$surface" }}
				>
					<text key="garden-label" role="title" group="objects" style={{ color: "$accent", bold: true }}>
						百草园
					</text>
					<text
						key="garden-observe"
						paragraphs={[{ runs: [{ text: "观察对象  ", bold: true }, { text: "自然景物、虫鸟与季节变化。" }] }]}
					/>
					<text
						key="garden-action"
						paragraphs={[{ runs: [{ text: "主要活动  ", bold: true }, { text: "寻找、倾听、游戏与探索。" }] }]}
					/>
					<text key="garden-proof">找一处细节，说明“趣味”怎样被写出来。</text>
				</flex>
				<flex
					key="school-side"
					box={{ grow: 1, basis: 0 }}
					gap={20}
					padding={24}
					style={{ backgroundColor: "$surface" }}
				>
					<text key="school-label" role="title" group="objects" style={{ color: "$accent", bold: true }}>
						三味书屋
					</text>
					<text
						key="school-observe"
						paragraphs={[{ runs: [{ text: "观察对象  ", bold: true }, { text: "先生、同窗与读书生活。" }] }]}
					/>
					<text
						key="school-action"
						paragraphs={[{ runs: [{ text: "主要活动  ", bold: true }, { text: "学习、提问，以及课间游戏。" }] }]}
					/>
					<text key="school-proof">找一处细节，检验“书屋只有束缚”的说法。</text>
				</flex>
			</flex>
			<ConclusionBand key="discuss" label="把证据放在一起">
				<text key="discuss-body">
					结合《从百草园到三味书屋》全文讨论：两处空间有哪些不同？儿童的好奇心有哪些相通之处？
				</text>
			</ConclusionBand>
		</PageFrame>
	),
});
