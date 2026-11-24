# 数值绘图

函数表达式、平面及基础三维对象见 [数学对象](math-objects.md)。本参考只描述 `diagram` 节点中 curves/points/segments 的数值格式；通过生产模块的受控媒体渲染器 生成 SVG、检查并渲染 PNG，注册后以 contain 图片写入 EN。模型无需执行脚本或安装依赖。

```json
{
	"kind": "diagram",
	"key": "scientific-figure",
	"diagram": {
		"domain": [-4, 4, -5, 5],
		"tickStep": 2,
		"curves": [{ "coefficients": [1, 0, -4], "label": "y = x² − 4" }],
		"points": [
			{ "at": [-2, 0], "label": "A" },
			{ "at": [2, 0], "label": "B" }
		]
	}
}
```

`domain` 顺序为 `[xmin,xmax,ymin,ymax]`。多项式系数从最高次到常数项，支持一次至四次，每图最多两条曲线。最多 8 个点、8 条线段、2 个圆。圆使用 `circles:[{center:[x,y],radius:r}]`；线段使用 `segments:[{from:[x,y],to:[x,y],arrow:true}]`，arrow 可省略。所有坐标有限且在范围内，圆完整位于视口内；不接收任意 JavaScript 或 expression，表达式使用对象格式。

只有曲线（可带点，没有圆或线段）的数值场景默认使用独立横纵比例；可指定 `axisScale:"equal"`。几何必须等比例，禁止用 independent 拉伸圆或改变角度、长度关系。`axes:false` 关闭坐标轴，`grid:false` 关闭网格；坐标轴要求原点在范围内，tickStep 为正且最多 24 个刻度。

图形按完整标注和旋转边界收紧白边，以 1600px 宽渲染；不能用 cover 裁掉标签。点标签尝试有限避让，仍重叠会报告具体错误，应缩短文字、调整视口或拆图，保留题目条件和必要标注。图完全在视口外或检查失败时不写入页面。

全部页面创建完成后，在分批验收中核对公式与系数、交点、单位、向量方向及实际 EN 尺寸下的可读性。PNG 是可移动缩放的图片，不是可逐点编辑的原生图元或交互画板；数学参数变化时分批创建候选页，全部候选页创建完成并核对后再删除对应原页。复杂隐函数、化学结构和电路自动布局尚未提供。
