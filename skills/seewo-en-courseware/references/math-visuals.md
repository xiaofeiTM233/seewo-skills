# 理科确定性绘图

本节用于纯数学函数、几何与精确坐标图，不是专业学科绘图的通用替代入口。先按 [学科专业技能接入](subject-integration.md) 判定：seewo-physics-illustration 覆盖的静态物理图（包括物理曲线/数据图）执行其真实生成流程，不能因为 diagram 能画曲线就绕过。只有按 [物理图接入](physics-integration.md) 受阻并获用户明确同意替代时，才将其作为该物理图的替代实现并记录实际来源。纯数学图在当前 diagram 能准确表达时使用 `diagram` 节点，由课件生产模块的 JSXGraph → SVG → resvg PNG → 图片资产登记链路生成。

不要用大量 EN line/shape 分段拟合 sin/cos/tan、圆弧或几何关系，也不要向用户课件插入测试线段来探索方向；模型声明数学对象，绘图引擎处理采样、投影、坐标和标注。普通容器边框、分隔线和简单流程箭头仍可用原生形状。AI 生图仅用于情境插画，不能代替精确数学图。

`diagram` 节点的数据字段必须叫 `diagram`，不是 `plot`。独立变量可用 `const spec: CoursewareDiagram = {...}` 保留 kind 和 tuple 类型。polygon 超出12个顶点会在工具入参校验时拒绝；查看顶点数量，不要反复换标签名或 labelOffset 探索。圆和切线等用对应数学对象，不能靠增加多边形采样点规避限制。

## 三角函数：直接提交本页

```tsx
const root = (
	<flex key="page" padding={40} gap={20}>
		<text key="title" role="title">
			观察正弦与余弦函数的图像
		</text>
		<diagram
			key="curves"
			box={{ width: 1200, height: 450 }}
			diagram={{
				domain: [-6.4, 6.4, -1.6, 1.6],
				objects: [
					{ id: "sin", kind: "function", expression: "sin(x)", label: "y=sin(x)" },
					{ id: "cos", kind: "function", expression: "cos(x)", label: "y=cos(x)", emphasis: true },
				],
			}}
		/>
		<text key="question">比较两条曲线的周期、最大值和零点，结合图像说明。</text>
	</flex>
);
await tools.courseware_edit({
	coursewareId: "真实ID",
	operations: [
		{
			kind: "insertSlideLayout",
			anchor: { kind: "end" },
			page: { schemaVersion: 2, title: "正弦与余弦函数", theme: "academic", root },
		},
	],
});
```

节点通过 box 支持 x/y/width/height/grow，与图片一样占据一个区域。`diagram` 是绘图参数，不填 source、assetId、fit 或 children。工具自动生成并登记 PNG，以 contain 保留完整标注；一页可放多个 diagram（最多 8 个）。无需 Bash、安装依赖、手工转图片或登记，也不需要先单独生成一页试图。

## 表达式与几何对象

`domain` 为 `[xmin,xmax,ymin,ymax]`，默认等比例坐标。选能看到教学对象的范围；函数超出视口是正常情况。表达式支持 x、PI/E、四则、^、括号以及 sin/cos/tan/sqrt/abs/exp/log/ln/floor/ceil；参数放 parameters，例如 `expression:"a*sin(x)"`、`parameters:{"a":2}`。不是 JavaScript，不写 Math.sin、赋值、属性访问或自定义代码。

objects 按依赖顺序，最多 40 个：

| kind               | 主要参数                                   |
| ------------------ | ------------------------------------------ |
| function           | expression，可选 parameters/label/emphasis |
| point              | at:[x,y]，可选 label                       |
| segment / midpoint | from/to 引用点 ID                          |
| circle             | center 引用点 ID，radius                   |
| glider             | at:[x,y]，on 引用圆或曲线                  |
| tangent            | at 引用 glider                             |
| perpendicular      | line、point 引用                           |
| intersection       | first/second 引用，index:0或1              |
| polygon            | vertices 为3–12个点 ID 列表                |

例如几何图使用 `objects:[{id:"O",kind:"point",at:[0,0]},{id:"A",kind:"point",at:[2,0]},{id:"c",kind:"circle",center:"O",radius:2},{id:"r",kind:"segment",from:"O",to:"A"}]`，无需计算屏幕像素坐标。

仅遇到真实标签重叠时调整 labelOffset:[dx,dy]（每项绝对值不超过100），或适度改视口。不要为避让而改变函数或原题条件。基础立体对象、数值系数与向量的完整语法按需要查 [数学对象说明](math-objects.md) 和 [数值绘图说明](scientific-diagrams.md)，参数统一放在 diagram 节点中。

绘图失败时根据错误修当前 diagram，不退回分段线条拟合；能力不支持的图明确说明。输出在 EN 中是可移动缩放的图片，不能逐个编辑图中曲线或当作交互画板。图的结构化源随原生对象保存；read elements 的 generatedSource 返回恢复状态与源。读取最新 manifest 后，通过单个 regenerateDiagram 操作、operationId 和 expected 版本重新生成，保留对象位置与其他课件内容。来源 unavailable 时明确说明，不臆造原始参数。跨设备云端往返仍须在目标环境验收。

全部页面创建完成后，在分批验收中按实际页面尺寸检查坐标、必要点、标签与图文关系，并集中修复问题；创建过程中只处理导致图像或页面无法生成的调用错误。绘图成功证明产生了确定性图片，不证明题目结论或投影可读性。

理科不必全篇 diagram：生活情境、实验场景与封面可用 AI 生图；仅精确数学关系使用本节绘图。摩天轮插画与高度曲线可以先后呈现，详见 [配图选择](design.md)。
