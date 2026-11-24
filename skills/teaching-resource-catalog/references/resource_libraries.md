# 检索入口与调用参考

按资源类型和用户指定的来源选择入口；不要把个人资源、希沃公共课件和教案、四类教学素材视为同一个范围。

| 需求 | 搜索 | 详情 | 主要区别 |
| --- | --- | --- | --- |
| 希沃公共课件或教案 | `seewo_resource_library_search` | `seewo_resource_library_get` | `type` 为 `courseware` 或 `teaching_plan`；搜索每页最多 5 条，按 `has_more` 续页 |
| 古诗文、微课、仿真实验、互动网页 | 目录或 `teachingResource.search` | `teachingResource.get` | 按 `resourceType` 区分；搜索按 `ended` 续页 |
| 个人课件 | `courseware_query` | 依个人课件工具合同选择 | 当前用户的云课件查询；具体范围以所选 action 的合同为准 |
| 个人教案 | `search_teaching_plans` | 依个人教案工具合同选择 | 搜索当前用户的教案摘要，不是公共资源库 |

例如，搜索公共课件时在 codemode 中按实际可用声明调用：

```js
const result = await tools.mcp__company_capabilities__seewo_resource_library_search({
  keyword: "岳阳楼记",
  type: "courseware",
  page: 1,
});
if (result.isError) {
  text(result.content);
} else {
  text(result.structuredContent);
}
```

公共库搜索返回 `items`、`page`、`total`、`has_more`；每项提供 `source`、`uid`、`type`、`name`、`thumbnail_url`、`author`、`download_count` 和 `chapter`。可空字段没有值时保留缺失，不推断其他数据。搜索不自动获取详情；确实需要详情时，用选中项的 `uid` 和 `type` 调用配套的 `seewo_resource_library_get`。

公共详情在通用字段之外返回学段、学科、年级、章节、简介、点赞量，以及课件的 `courseware_id` / `courseware_version` 或教案的 `teaching_plan_id` / `teaching_plan_version`。搜索和详情不提供独立教材版本字段，搜索也不提供独立年级字段；资源名、章节或简介若包含相关字样，只能作为上游文本，不能推断教材版本已核实。这些字段是元数据，不代表已读取正文；需要分析选中的公共课件内容时，可使用详情中的课件 ID 和版本调用 `courseware_parse`。非个人课件不能使用 `courseware_read`，即使已知公共资源 UID 或课件 ID；解析失败时如实说明，不改用该工具。

两个入口的结果必须保留来源，详情按来源配对；不同来源的同名条目不据名称自行合并。是否可以共享或打开，以实际返回的入口及产品能力为准，不根据 UID 拼接地址。
