---
name: image-materials
description: 为教学材料、网页、课件或知识卡搜索、生成和筛选图片素材，按画面内容与用途判断匹配度，检查并复用已登记的工作区图片。
displayName: 图片素材
description_cn: 搜索、生成和筛选适合教学的图片，核对后用于课件、教案和互动网页。
argument-hint: 帮我找几张适合课堂展示的图片，并挑选最合适的素材。
---

# 图片素材

## 选图原则

- 默认根据画面主体、内容与教学用途的匹配度选择图片，结合事实准确性、构图、清晰度、比例和遮挡判断；指出具体不符之处，不因“可能失真”推定某张图片不合格。
- 不因图片是 AI 生成或带“AI 生成”标识而单独排除、降级或继续搜索。保留原有标识；确实遮挡主体或影响阅读时，按实际影响处理。作者头像需核实人物身份，图片不能作为真实身份或史料的证据。
- 用户明确要求真实照片、实景、人物真实肖像或史料证据时，核验可取得的来源信息；图片看起来写实或来自素材库都不足以证明是实拍，来源无法确认时如实说明。用户后续明确调整要求时，以新的要求为准。
- 比例或分辨率不符时，结合实际用途判断能否通过裁切、留白或调整版式使用；裁切需保留关键内容和原有标识，不为掩盖标识而裁切。需要精确比例或尺寸时核对原图实际像素，不把搜索参数或返回的比例字段当成实测结果。
- 先复用用户指定及当前作品中合格的素材；新图写清主体、场景、构图、风格、留白、比例与教学用途，不按页面数量机械生图。

## 获取与核对

在原生 codemode 中通过 `tools` 调用图片工具，参数直接传结构化对象。需要发现或核对参数时，使用 `searchTools` / `describeTool`；已有适用声明时直接复用。领域工具直接返回业务 DTO。每次调用仍由 Host 校验授权、撤销和业务确认；结果未知时先查询或回读，不能重放已完成写入。

本地图片需要先登记供后续复用时，调用 `images_register({path})`。它按当前文件权限读取 PNG/JPEG/WebP/GIF（最多 20 MiB），保存稳定副本并返回真实 `assetId`、相对 `path` 与 `coursewareSource`；SVG 先转 PNG。后续课件插图直接使用返回的 `coursewareSource`，同一登记可用于多页。登记不搜索、不生图、不插入课件，也不证明已经看图；按下文核对后，需要对话预览再调用 `images_select`。ID 只能在当前 Session 工作区复用。

```javascript
const asset = await tools.images_register({ path: "materials/circuit.png" });
text({ assetId: asset.assetId, path: asset.path, coursewareSource: asset.coursewareSource });
```

参数包括 `prompt`、`mode`、`intent`、`aspect_ratio`、`style` 和 `purpose`，完整必填关系以参考为准。`mode` 支持 `search/generate/auto`；`intent` 支持 `factual/creative`；`aspect_ratio` 只支持 `1:1/4:3/16:9`。不传未声明的分辨率、质量档、输出目录或文件名参数。

- 需要搜索多张候选时使用 `images_search`，在 codemode 中用 `image(candidate.preview)` 投递预览、只输出元数据；下一次模型请求实际收到图片后再比较，并用真实 `assetId` 调用 `images_select` 展示选中的素材。搜索不会生成图片，部分失败查看 `issues`。
- 需要单张素材时可用 `images_create`。用户明确要求搜索或真实照片时使用 `search`。`auto` 会按 `intent` 选择搜索或生成，并可能在失败后切换。用户明确要求 AI 生成，或白板课件技能触发教学插画兜底时，使用 `generate` 直接生成。调用仍遵循产品权限。
- 搜索结果的 `source: library` 表示获取渠道，不代表原图一定是实拍或非 AI 生成；`generated` 表示本次生成渠道。不要将渠道当作画面内容、真实性或使用权已核验的证明。

```javascript
await tools.images_create({
	prompt: "适合课堂展示的森林生态插画，画面中央留白，不含文字",
	mode: "auto",
	intent: "creative",
	aspect_ratio: "16:9",
	purpose: "生态系统课件导入",
});
```

直接读取返回的业务字段；Host 下载、校验并登记资产。使用回执中的真实 `assetId` 和路径，不能自行拼造 ID，也不把纯路径当成已看图。EN 用登记资产引用；网页如何发布或内嵌由对应任务 Skill 决定。

预览不可用或未直接投递模型时，先用基础 read 读取回执中的真实图片路径。在后续模型请求实际看到图片后核对主体、文字、教学事实、构图与清晰度，再决定采用或修正；无法查看时如实说明，不声称已完成视觉核对。失败或结果未知时先检查已有产物，不能重复生成已完成图片；不承诺接口未返回的收费、固定分辨率或印刷品质。

`images_select` 回执中每张可展示图片带 `bodyRef`；最终回复用 `![说明](easinote-session-image:<bodyRef>)` 原样展示已选图片，一张或多张、集中或穿插由内容决定。只能引用回执返回的 `bodyRef`，不得拼造；`images_search` 的候选不写进正文；没有 `bodyRef`（预览不可用）时如实说明。

插入 EN 教案时，在 `teachingPlan_lifecycle` 创建或 `teachingPlan_edit` 局部编辑中声明 `images: [{ ref: "fig1", source: { kind: "asset", assetId } }]`，正文写 `![说明](image:fig1)`。Agent 自绘图先渲染为 PNG，再引用真实工作区路径。工具会复用 SDK 图片上传任务；上传失败后重试原节点，不再次生成或插入。只有保存完成才称为图片已进入云教案，独立图片成果卡不能替代正文插入。
