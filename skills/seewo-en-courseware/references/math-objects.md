# 数学配图

只在当前页需要函数或几何图时读取。模型确定教学对象与要观察的关系，JSXGraph 负责绘制；不为排版方便反复更换已选函数、系数或题目。

## 常用声明

在布局的 `kind:"diagram"` 节点的 `diagram` 字段中填写 objects：

```json
{
	"objects": [
		{ "id": "f", "kind": "function", "expression": "x^2", "label": "y=x²" },
		{ "id": "A", "kind": "point", "at": [1, 1], "label": "A" }
	]
}
```

纯函数图（仅 function/point）默认按图框使用独立轴比例；包含几何对象时保持等比例。需要比较角度或单位长度的函数图显式使用 axisScale:"equal"。需要展示已知点或指定区间时才写 domain:[xmin,xmax,ymin,ymax]，例如 [-4,4,-2,10]。函数延伸出有限坐标范围是正常的；禁止裁掉整张图片的标注，不等于必须将无限函数全部装入视口。

表达式支持四则、^幂、括号、x、PI/E 和 sin/cos/tan/sqrt/abs/exp/log/ln/floor/ceil；数值参数放 parameters。用普通表达式即可，不反复替换等价写法。不是 JavaScript，不写赋值、属性访问或自定义函数。

| kind          | 参数                                       |
| ------------- | ------------------------------------------ |
| function      | expression、可选 parameters/label/emphasis |
| point         | at:[x,y]，可选 label                       |
| segment       | from/to 引用点，可选 dashed                |
| midpoint      | from/to 引用点                             |
| circle        | center 引用点、radius                      |
| glider        | at:[x,y]、on 引用圆或曲线                  |
| tangent       | at 引用 glider                             |
| perpendicular | line 与 point 引用                         |
| intersection  | first/second 引用，index:0或1              |
| polygon       | vertices 为点 ID 列表                      |

对象按依赖顺序写，最多40个。标签默认位置先使用；实际遮挡时才加 labelOffset:[dx,dy]（1280×720 课件的逻辑像素，正 x 向右、正 y 向上，每项绝对值不超过100）。对比曲线用 emphasis 区分重点，不靠反复改函数来避开重叠。

基础立体图增加 dimension:3、ranges:[[xmin,xmax],[ymin,ymax],[zmin,zmax]]；point 改为三维坐标，segment 仍引用点；polyhedron 使用 vertices:[[x,y,z],...] 和 faces:[[顶点索引,...],...]。只做固定平行投影，不承诺自动截面计算、隐藏棱判断或 EN 内交互。

## 看结果再修

全部页面创建完成后，在分批验收中检查曲线/对象、必要点和标注是否正确可读；有问题再批量调整范围和标签。创建过程中不逐页截图返工，也不要在没有图像时反复设想所有重叠。对比页保持相同坐标尺度，以免制造错误的开口比较。

输出在 EN 中是图片，可移动缩放，不是交互画板。数学图片使用 contain，保留完整坐标和标注。普通实景素材由 tools.images_create 等能力获取并登记，再以 source:{kind:"asset",assetId} 引用；不能用生图插画冒充精确函数图。

数值系数与向量参数见 [数值绘图](scientific-diagrams.md)。

绘图器先获取布局分配的实际宽高，再设置刻度和标签；公式位于独立标题区。关键点可设置 emphasis:true 突出显示。图片按目标尺寸的两倍像素导出，字体和线宽不依赖导出倍率。视口应围绕本页关注的根、顶点或几何关系设置，不改变函数或题目来迁就排版。
