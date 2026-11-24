---
name: session-management
description: 按用户要求创建新会话并执行任务，查询本账号的会话内容与模型用量，或提出分组与归档整理方案。
---

# 会话管理

用户明确要求把任务交给新会话时，使用 `tools.sessions_start({ requestId, title, task, context?, workspace?, model?, thinkingDepth?, permissionMode? })`。为这次交接生成稳定 requestId，重试沿用同一标识，只交接必要上下文。`accepted` 表示初始任务已接收，返回真实 sessionId/runId，后续通过目录和正文核对进展与成果。unknown 时先查询，不更换标识重建；启动失败但已返回 sessionId 时保留该会话并说明失败原因。

- `workspace` 缺省新建私有目录；`{ kind:"current" }` 沿用当前已授权的外部目录，私有目录不可跨会话共享；`{ kind:"select", path? }` 请求桌面选择目录，path 仅为提示。
- `model` 可传 `{ provider, modelId }` 或 `"current"`，缺省使用账号默认模型；`thinkingDepth` 可传 `low` / `medium` / `high` 或 `"current"`，缺省使用账号默认深度。
- `permissionMode` 可传 `guarded` / `full-access`，缺省使用用户已确认的默认权限。明确选择完全访问由 Host 另行确认，不传授权标记或目录凭证，不复制当前会话的临时权限。

接收任务后新会话独立运行，停止当前对话不会自动停止它；审批与补充问题在新会话处理。仅在用户要求新建会话时调用，不自行递归派发任务。

用量查询默认向模型返回汇总；需要逐条分析时传 `view:"rounds"` 并按 nextOffset 翻页。统计包含已记录请求、上下文压缩及其他 Pi 用量记录，缺失记录不是零；asOf 之后生成的回复尚未计入。Token 不是实际账单，未核对的网关价格、生图和检索费用不能填零。直接读取返回的业务字段，缺失统计不能计算为零。

在原生 codemode 中通过 `tools` 调用 `sessions_start`、`sessions_list`、`sessions_read`、`sessions_organize`、`sessions_usage`，参数直接传结构化对象。需要发现或核对参数时，在 codemode 内使用 `searchTools` / `describeTool`；已有适用声明时直接复用。领域工具直接返回业务 DTO，按实际字段和业务分页参数读取。每次调用仍由 Host 校验授权、撤销和业务确认；结果未知时先查询或回读，不能重放已完成写入。

- `tools.sessions_list({ query?, includeArchived?, limit? })`：查询目录，依据返回的真实 sessionId 选择目标。列表摘要不证明正文内容。
- `tools.sessions_read({ sessionId, before?, maxMessages?, includeTools?, maxCharsPerItem? })`：读取当前持久化分支。按 `hasMore/nextBefore` 继续；默认只读用户与助手正文，需要工具证据时显式开启 `includeTools`。
- `tools.sessions_usage({ sessionId, offset?, limit? })`：查询用量，区分总量与当前页，按实际结果解释 token、缓存和成本；缺失值不补零。
- `tools.sessions_organize(proposal)`：提交符合当前 schema 的整理方案。Host 生成预览并请求用户确认，然后报告 applied/partial/cancelled；不要把方案已暂存或预览已生成说成整理完成。

```javascript
await tools.sessions_list({ query: "教学设计", limit: 20 });
```

直接读取返回的业务 DTO，按该工具的业务分页字段继续读取。读取其他会话只获取当前账号获准的内容，不直接访问 Session JSONL、内部数据目录或别的账号；其产物引用不能当作当前会话新生成的成果发布。

仅依据用户要求整理；分组、归档或恢复必须使用真实 ID 和 Host 预览。后台分析只提出方案，不能代替用户确认。当前会话、运行中的会话及其他保护条件由 Host 校验，不尝试通过文件操作绕开。
