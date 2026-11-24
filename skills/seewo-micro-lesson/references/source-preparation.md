# 希沃一刻的微课选材与教学设计

本参考只用于希沃一刻。先确定或准备教学内容，再执行共享 Skill 的微课生成闭环；不把用户的“制作微课”改成制作课件，不调用无来源的创建请求探测能力。

## 宿主课程要求自动选择与提交

用户已授权制作微课且未要求中途选择时，使用 `approval_policy: autonomous`，由平台按当前素材的推荐配置推进课程要求与大纲；将用户明确提出的补充要求放入 `supplemental_requirements.extra_instruction`，不能丢弃。用户明确要求选择或确认时使用 `interactive`，复用下述真实预览与表单提交流程；未填写项使用平台默认值，不为可选项反复询问。用户明确拒绝、取消或要求停止时遵从用户选择。

到 `awaiting_teaching_design` 时，读取同一 operation 的真实 `generation_preview`，确认当前仍处于该阶段且 `teaching_design.default_submission` 可用。以它为基础，结合用户已提出的教学对象、目标和互动要求，只调整现有表单字段；焦点和问题 ID 从本次预览的候选中选择，不能编造字段或候选，也不能用默认值覆盖用户明确要求。

提交前在对话正文中直接用 Markdown 说明“本次将采用”的目标、重点和要求，便于用户在生成过程中快速浏览。使用三级标题 `### 本次微课目标与要求`，按实际内容用加粗标签区分学习目标、教学重点、互动与练习，再用短列表逐项展示；多个目标或重点分别列出，每项尽量一句，不拼成一大段，不包在代码块里。分类之间留空行，不使用一级、二级标题或大表格；缺少对应内容时省略分类，不为凑格式补造要求。只描述实际选入 `teaching_design_payload` 的内容，不输出 ID、完整表单或候选全集。

随后调用 `confirm_generation`，携带 `stage: teaching_design`、`expected_state: awaiting_teaching_design` 和同一份 payload。仅在用户明确要求选择或确认时使用 `ask_user` 等待答复，否则直接推进，不为可选项追问，也不声称“用户已确认”。只有提交成功或回读证明该阶段已推进，才继续读取并展示真实 Markdown 大纲；用户要求确认大纲时等待答复，否则自动提交 `lesson_plan` 阶段并持续跟踪生成。大纲排版与完成条件沿用共享流程。

预览缺失、operation 不匹配或阶段变化时，先查询原 operation，不沿用旧预览跨阶段提交。提交失败、取消、权限拒绝或结果未知都不是成功；先按实际错误和原任务状态恢复，不重复创建、盲目重试或重放已生效的阶段。用户要求停止时沿用既有停止流程。其他未声明此宿主合同的入口仍遵循共享流程；选材缺少必要信息时，继续使用下文既有的 `ask_user`。

## 最终产物与过程文件

本轮交付生成的互动微课。用户另外要求独立教案时，教案沿用自身交付规则。作为生成输入的微课设计可直接在对话中审阅。复用已有课件或教案只是在准备输入，不将它们登记为本轮新成果。

课程要求表单、大纲、选材摘要、请求文件、状态记录、素材、截图和校验记录均为过程材料；落盘后属于过程文件，需要时可提供普通文件预览链接，不调用 `publish_file` 将其登记为最终产物。

`fully_ready` 表示全课完成。`partially_ready` 表示本轮生成已结束。服务端确认可播放并返回工作区交付地址时，交付「打开微课」卡片，并说明有几个可选互动页待修复。缺少交付地址时，按回执说明成功和失败页数，提示用户在已有预览中重试失败页。预览入口和后续操作遵循[创作流程](../SKILL.md#创作流程)。

已经独立交付的教学设计或教案应保留。后续微课失败或停止时，分别说明已交付的成果和微课当前状态。

## 微课可用的来源

按教学目标和学段检索现成微课及同主题教案、课件。已有完全匹配的微课可供直接复用，需要新建时按下文选择生成方式。可引用的素材是课件和教案。忽略检索返回的独立互动网页或仿真实验，不打开、不列为建议选项，也不送入生成。只有标题或关键词相关而教学目标不同的素材视为未匹配。

## 使用用户已有素材

- 用户已选中附件或明确指定资源时，核对真实资源 ID、类型与当前版本，优先使用，不受自动推荐的版本门槛限制。匹配多个资源时只围绕同一主题澄清。
- 用户指定主题时，使用实际提供的课件查询和 `teachingPlans_search` 检索同主题素材；不先遍历微课工作区，也不为了满足版本条件推荐其他主题。仅有标题相关仍需按需核对内容，不能只凭词语相近判断适合。
- 用户让你自由选材时，读取课件与教案目录的摘要；自动推荐仅选 `version >= 3` 且有有效 `updated_at` 的普通资源。按更新时间降序，不把接口第一页第一条当作全局最新。目录和搜索能力通过对应的课件/教案管理 Skill 按需读取，不依赖本机 CLI 身份。
- 每种资源最多查询两页、每页最多 50 项，不展开整棵目录或所有正文；已有上下文可复用。查询失败不当作空空间。达到预算时说明“本次查询范围内”，可以转用户选材，不继续无界检索。文件夹不作为素材。真实全局排序需要查询层支持，不能仅凭局部列表承诺。

## 用离线助手排序

完整摘要留在执行环境，整理为新任务文件，只回显结果摘要：

```json
{
	"coverage": "partial",
	"batches": [
		{ "kind": "courseware", "items": [] },
		{ "kind": "teaching_plan", "items": [] }
	]
}
```

`items` 使用真实查询项的 `id/name/type/version/updated_at`，不编造缺失字段。教案普通项 `type=plan`，课件普通项 `type=courseware`。`coverage` 只有确认全部范围均已查询才填 `complete`；任一查询失败填 `failed`，否则填 `partial`。有主题时只传经过相关性核对的候选，不混入其他主题来凑推荐。

```sh
node '<本次Skill目录>/scripts/select-source.mjs' '<摘要JSON文件>'
```

助手只做本地筛选、跨类型排序、去重，最多返回 5 个候选；不查网络、不读取凭据、不创建课程。`no_eligible` 表示有资源但不符合推荐条件，`empty` 只表示完整查询确实为空，`incomplete` 不得声称为空。版本号是推荐线索，不是质量保证。返回候选后按下文决定弹窗选项。用户明确指定素材时直接核对该素材。

## 确定生成方式


用户已指定课件或教案时直接核对并使用，不依赖设计直传探测。需要在“参考素材”和“重新做微课设计”之间选择，或只给主题、明确要求重新设计时，在 codemode 核对当前会话能力。优先使用结构化预检工具。只有该工具未暴露时，才读取旧客户端的原生工具声明：

```javascript
let result = { state: "unknown", fields: {} };
if ("mcp_input_capabilities" in tools) {
	result = await tools
		.mcp_input_capabilities({ operation: "microFlux.generate", action: "start_generation" })
		.catch(() => result);
} else if (typeof describeTool === "function") {
	const toolName = ["mcp__company_capabilities__micro_flux_generate", "microFlux_generate"].find(
		(name) => name in tools,
	);
	const declaration = toolName ? await describeTool(toolName).catch(() => "") : "";
	const match =
		typeof declaration === "string"
			? declaration.match(/^declare const tools: \{ (\w+)\(args: (\{[\s\S]*?^\})\):/m)
			: undefined;
	const args = match?.[1] === toolName ? match?.[2] : undefined;
	const start = args?.split(/^\} \| \{$/m).find((branch) => /^  action: "start_generation";$/m.test(branch));
	if (start) {
		result = {
			state: "supported",
			toolName,
			fields: { lesson_design: /^  lesson_design\??: /m.test(start) ? "supported" : "unsupported" },
		};
	}
}
text(result);
```

有匹配素材且用户尚未指定生成方式时，用 `ask_user` 弹窗。若 `state` 与 `fields.lesson_design` 均为 `supported` 且返回了 `toolName`，列出“重新做微课设计（推荐）”。若尚未核实，使用“先做微课设计，提交前核实”。列出“参考《实际资源名》生成”的选项。已明确不支持时仅列可用素材。

`state` 或 `fields.lesson_design` 明确为 `unsupported` 时，说明当前入口无法按设计直传，可请用户选择可用素材，或先提供设计稿审阅。用户已选重新设计时，等用户同意后才可改用素材。返回 `unknown`、能力工具缺失或调用失败只表示暂未核实。用户已选重新设计，或主题明确且没有匹配素材时，除非已明确不支持，否则按[一刻微课设计策略](yike-design-strategy.md)和它引用的共享基线编制 `lesson_design`。已有素材流程不依赖探测，按当前工具目录核对实际生成工具。

设计完成后，把本次实际 `start_generation` 参数完整放入 codemode 的 `input` 对象，包括本次设计、工作区、课程要求、审批策略和幂等键。如果初次查询已确认 `state` 与 `fields.lesson_design` 均为 `supported` 且返回了 `toolName`，用该工具提交这份 `input` 一次。使用旧客户端声明时，提交的字段以 `start_generation` 分支为准。能力未核实或缺少工具名时，有结构化工具就先对这份请求做一次只读预检：

```javascript
const preflight =
	"mcp_input_capabilities" in tools
		? await tools
				.mcp_input_capabilities({
					operation: "microFlux.generate",
					action: "start_generation",
					input,
				})
				.catch(() => ({ requestState: "unknown" }))
		: { requestState: "unknown" };
text(preflight);
```

走结构化预检路径时，仅当 `requestState` 为 `supported` 且返回 `toolName`，才使用该工具原样提交同一份 `input` 一次。旧客户端没有结构化预检且首次未能核实时，提交前只再读一次上述工具声明，确认 `start_generation` 支持 `lesson_design` 后提交一次。若已知拒绝，保留设计稿并说明当前请求未通过校验。若仍未核实能力或真实工具名，保留设计稿并说明原因。需要改用素材时由用户决定。预检不会启动微课；若提交后结果未知，沿用原任务的只读恢复流程，避免重复创建。

**使用已有素材时：** 命中课件或教案时，只在弹窗列出可引用的候选；用户已指定素材时直接使用。没有匹配项时可请用户从云空间选材。已确认不支持设计直传且用户明确要求按主题重新设计时，可以先提供设计稿供审阅，并说明也可选择课件或已保存教案生成。沿素材路径提交时省略 `lesson_design`；只有用户明确要求独立云教案时才进入教案工具。通过当前工具目录确认缺少生成工具后，说明此次会话暂时无法启动生成。

用户选择已有素材时，若已选定唯一候选，直接核对并引用；需自行挑选时使用 `ask_user` 的 `library` 选择器，标题为“选择用于制作微课的教案或课件”。等到真实引用后核对类型、归属和当前版本。取消时结束选材。

用户明确要求指定或选择配音、HTML 生成模型且当前会话有 `mcp_input_capabilities` 时，先核对 `microFlux.generate` 的 `start_generation` 对应字段（`selected_voice_id` 或 `html_generation_model`），以及 `microFlux.query` 的 `generation_options` 动作。两项均确认支持时，按查询实际返回的 `toolName` 和声明读取当前候选，提交实际返回的选项 ID。未指定时使用平台默认值，不读取可选目录。缺少结构化工具、能力未知、目录不可用或没有匹配候选时，说明对应设置暂无法确认，用户有明确要求时由其决定是否接受默认值。

云空间确实为空且没有主题时，结合已知年级、学科、教材与当前日期提出主题建议；日期只作线索，不断言具体教学章节。缺少关键教学信息集中询问一次；有资源但低版本、查询不完整或失败不等于空空间。已有明确主题不再猜进度。课程要求按本节宿主自动选择合同推进，复用已知信息，不虚构用户确认。

查询和选材只准备输入，不属于微课已启动；对话使用中文简述关键阶段，不播报读 Skill、查工具等内部准备。明确输入拒绝不称为鉴权失败或写入结果未知；只有请求确已发出而无法确认结果时才先回读原任务。
