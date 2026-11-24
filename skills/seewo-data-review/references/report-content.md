# 固定报告输入

写本轮 content.json，脚本自动转义所有文字，不接受 HTML、CSS 或远程资源。日期、数量、缺失原因和证据范围在分析时一次确定；渲染只负责展示，不取数或复核。没有证据的可选模块省略，不填示例或人为补零。

| 字段 | 结构与用途 |
|---|---|
| meta | 字符串数组；标题下学校/任教学科、回顾范围、截至日期，脚本添加字段分割线 |
| intro | 首屏无主语说明，简短交代实际范围 |
| memory | 可选 `{theme,points:[短句]}`；3–4条有据可查的经历 |
| metrics | `[{label,value,unit,note}]`；仅列已取得的大号统计数据，缺失可省略或 value 为“—”并注明原因 |
| timeline | `[{when,facts:[分点事实]}]`；年份或阶段按时间顺序，节点只呈现事实 |
| timelineNote | 年度代表作按最近更新时间归年等必要说明 |
| assets | `[{type,title,value,paragraphs:[事实短句]}]`；value可省略，paragraphs直接显示 |
| assetsNote | 云端与本地实际覆盖范围；没有本地资料时说明未纳入，不推断云端缺失 |
| recent | `{summary,complete,metrics,works:[{name,date}],months:[{label,value}],themes:[事实短句]}` |
| focus | `{summary,evidence:[事实短句]}`；概括与依据对应 |
| todos | `[{title,why}]`；复用同一组三条待办的标题与顺序供后续选择 |

`recent.complete` 直接沿用采集结果。仅为 true 时显示 months 图表；否则不提供半年总量或月度趋势，可在 summary 写清样本范围。metrics只用已知的统计范围与标签，不将不完整样本称为半年全部。资料名称是纯文本，不生成资源打开入口。

可选模块为空就不生成章节，序号自动连续。数字默认就是真实输入值，关闭脚本仍可阅读。正式文件名为“希沃一刻 · 我的沉淀.html”，每轮存放在新建的唯一目录，避免覆盖前次产物。
