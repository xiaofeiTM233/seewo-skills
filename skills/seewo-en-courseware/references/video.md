# 原生视频

用户已提供本地文件或可直接下载的 HTTPS 视频时，在 STORY 中按教学需要选用，记录观察任务、放置页和播放方式。播放区间须有用户说明或真实内容分析依据；只有元数据时不编造剧情或时间点，优先完整播放。没有素材时说明缺口，不自行搜索或生成视频，不用封面或网页卡片冒充视频。

## 新增

直接通过 `tools.courseware_edit` 的 `addVideo` 或 `insertSlideLayout` 创建视频。编辑操作内部读取素材、解码并准备封面，再由现有 SDK 创建原生对象；不需要独立导入工具或素材 ID。首期接收可解码 MP4，上限为 50 MiB、30 分钟、3840×2160 总像素。解码或准备失败时不插入元素，不用占位框代替成功。视频和封面随课件原有同步流程保存，插入成功不代表云端保存完成。

```ts
await tools.courseware_edit({
	coursewareId,
	operationId: "insert-experiment-video-01",
	expected: { editorInstanceId, revision }, // 来自最新可信回读
	operations: [
		{
			kind: "addVideo",
			slideId,
			source: { kind: "file", path: "materials/experiment.mp4" },
			bounds: { x: 80, y: 140, width: 640, height: 360 },
			playback: { autoPlay: false, loop: false, volume: 0.5 },
		},
	],
});
```

直链写 `source:{kind:"url",url:用户提供的HTTPS视频文件地址}`，不要使用网页观看地址、直播或 HLS/DASH 清单。来源读取继续遵循当前文件和网络权限，不携带 EN 登录 Cookie。内部固定素材字节，持久保存采用原生资源引用，不能依赖原路径或直链继续有效。

TSX `<video>` 编译为 EN 原生 Video，仍随 `insertSlideLayout` 提交；含视频的编辑必须提供稳定 `operationId` 和当前 `expected`。

```tsx
<video
	key="experiment"
	source={{ kind: "file", path: "materials/experiment.mp4" }}
	box={{ width: 640, height: 360 }}
	playback={{ autoPlay: false, loop: false, volume: 0.5 }}
/>
```

尺寸按素材比例设置。图注、边框用相邻原生文字或形状；视频不接受通用 style。默认点击播放、不循环、音量 0.5、完整播放。音量范围 0–1，0 表示静音。可指定 `range:{startSeconds,endSeconds}`，须满足 `0 <= startSeconds < endSeconds <= durationSeconds`；省略或 `null` 表示整片，不裁切原文件。没有可信时间点时不要臆测区间。

封面默认取播放起点，可指定 `poster:{kind:"frame",atSeconds}` 或 `poster:{kind:"image",assetId}`；图片仍须按图片流程登记。所有配置仅在创建时设置。

## 删除与新增替换

已有视频只允许读取和 `deleteElements`，不支持原位改来源、位置/大小、封面或播放参数，`setBounds/setStyle/patchElementRaw` 也不能绕过。

新增视频的批次不能混入 deleteElements/deleteSlides。替换分两次提交：先新增候选，确认成功回执并读取新元素，再以最新版本删除旧元素。新增失败或未知时保留旧元素。新视频使用新 ID，不自动继承动画、层级或扩展字段；需要的配置显式放入新增操作。删除沿用动画引用保护，必要时先处理引用。两次操作分别进入撤销历史；删除失败时报告新旧并存，不能再次新增。

## 状态恢复与验收

准备和写入共用原 `operationId`，查询方式仍为：

```ts
await tools.courseware_read({
	coursewareId,
	query: { kind: "operation-status", operationId: "insert-experiment-video-01" },
});
```

- `phase:"preparation", contentStatus:"notApplied"` 表示尚未写入页面。`prepared` 只说明来源就绪，可以使用原 ID 和原参数继续候选准备及提交；`failed/cancelled` 按原因处理，不能宣称已插入。
- `unknown` 先核对原操作和实际页面；不能改 operationId 重传或重插。实际写入结果未知时不能盲目重插。准备句柄仅在原编辑器有效，过期时页面仍未写入，可以用原参数和原 operationId 重新准备；明确失败/取消后按原因使用新操作重试。
- `completed` 附带原写入回执。即使原文件已移走，也可恢复已完成结果；不再次插入。同步 pending/failed 时保留已插入的视频，核对并重试课件同步；不能换 operationId 再新增。

`VIDEO_LEASE_READ_FAILED` 表示编辑器读取已准入素材时的本地传输失败，不是视频编码不兼容；不要反复转码、裁短或换文件名试错。用原 operationId 核对是否尚未写入并如实报告传输故障；仅收到通用 `VIDEO_PREPARATION_FAILED` 时也不能据此断言格式有问题。

读回 `type:"media",mediaKind:"video",video` 核对时长、尺寸、配置和封面。截图只证明布局与封面，需要实际播放抽查关键素材。准备、编辑回执和云同步分别报告；真实云保存重开不能用截图或本地快照代替。
