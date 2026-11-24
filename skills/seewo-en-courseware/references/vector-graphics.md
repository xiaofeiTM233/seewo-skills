# 矢量图解

用于关系示意、自由曲线和主题线稿。精确函数、几何和数值计算继续用 [diagram](math-visuals.md)。情感变化曲线注明“解释性示意”，不暗示测量数据。简单矩形、椭圆和直线优先原生shape，保持直接编辑；复杂组合用vector保存源重生成。

`vector`叶子节点传`vector:CoursewareVector`与明确的`box.width/height`（1–2560）；源包含`viewBox:[x,y,width,height]`及`shapes`。它经现有媒体准备链生成透明PNG，进入原生图片，fit固定contain。不能传任意SVG/XML、HTML、CSS、脚本、URL、图片引用或文字标签。

支持的shape参数：

| kind    | 几何参数                                                     |
| ------- | ------------------------------------------------------------ |
| path    | d：SVG路径命令M/L/H/V/C/S/Q/T/A/Z及其小写形式，必须以M/m起始 |
| rect    | x、y、width、height                                          |
| ellipse | cx、cy、rx、ry                                               |
| line    | x1、y1、x2、y2                                               |
| group   | translate?:[x,y]、children：上述原语，不再嵌套group          |

原语可选fill、stroke（只接受六位十六进制色或none，不接受主题token）、strokeWidth（0–128）、opacity（0–1）；默认无填充、#302C27描边、线宽2、不透明。坐标绝对值≤1e6，正尺寸≤10000。源JSON≤12000字符，总节点≤128（含group），单组≤64原语，单路径≤4096字符、≤256命令。每页diagram与vector合计≤8，输出最大边2560像素。错误定位当前节点key，修复该节点即可。

需要文字标注时可选`VectorGraphic`：必传key、width、height、vector；可选box、labels。每个label包含key、text、x、y、width，可选role与style；x/y/width使用viewBox坐标，组件按contain同一比例和居中偏移映射到图框。文字字号仍遵循主题与正文下限，不随viewBox缩小。label自动测量高度，需为换行留出空间。图形派生key为`${key}-graphic`，文字为`${key}-${label.key}`，不能重复；组件不接受children。

复杂图形是图片，标签是原生可编辑文字。图形与标签分别拥有稳定key，可用于教学动画。`read elements`获得真实elementId与generatedSource；来源ready且kind为vector才能独占提交regenerateVector，见[局部编辑](editing.md)。重生成保留图框和源尺寸；标签修改用setText/setBounds，几何变化后同步检查标注位置。成功重生成不证明云端保存或跨设备恢复已验证。

## 主题矢量图稿

本节适用于采用网格、线稿、剪影等可绘制背景的风格方向。先安放标题、教学图片和任务，再结合可用区域设计图稿。重复网格可由循环生成 line 图元，电路线等连续轮廓可用 path；预览和 EN 使用这一份几何数据。例如荷叶的缺口与放射叶脉、陋室窗棂与屋檐、作息手记里的翻页和手绘时间轨迹。根据材料选择画法；一个淡色椭圆即使取名“荷叶”也缺少辨识特征。教学主图的照片、精确钟面和数据图另有教学用途。用户指定净底、纯摄影背景或固定模板时遵循约定。

**展示前保存完整候选。** 在同一次 codemode 中，对使用矢量装饰的候选执行下列步骤。`motif` 是本课创作的矢量背景节点（`kind:"vector"`、唯一 key、画布坐标 box、viewBox 和 shapes）；`baseSpec` 保存色板、文字角色、强调规则及其他共用背景。每项用独立的本课草稿键，例如 `en-courseware/<实际课题>/style/B`。

```tsx
const spec: CoursewareDesignSpec = {
  ...baseSpec,
  backgroundElements: [...(baseSpec.backgroundElements ?? []), motif]
};
const design = createCoursewareDesign(spec);
const layer = design.motifSvg(motif.key);
store(draftKey, {spec, motifKey: motif.key});
// 把 layer 作为该候选的 .style-sample 背景图层，跟随卡片一次写入。
```

预览容器使用相对定位、16:9 和该候选的纸底；SVG 图层用绝对定位 inset:0、width:100%、height:100%、pointer-events:none，标题和正文样例放在上方。`motifSvg` 已按 1280×720 画布处理坐标、大小和节点透明度。风格图层和候选草稿来自同一个 spec。若工具报告缺节点，补齐候选的矢量源再展示。

**选择后读取原稿。** 用实际选定的候选键调用 load，保留图稿节点的 key、几何数据和默认构图。样卡对应的正文页直接使用取回的 spec；需要变体时由它派生。已明确风格或直接出稿时只保存最终方向。

```tsx
const {spec, motifKey} = load(draftKey);
const design = createCoursewareDesign(spec);
const page = design.apply(rawPage); // 用于安排了该背景的原生正文页
const layer = design.motifSvg(motifKey); // 按规划用于互动页同一背景位置
```

在 DESIGN 写明选中键、主题轮廓及使用它的正文页。净底或需独立构图的页可派生背景配置。使用实际的 `createCoursewareDesign(spec)` 创建对象后调用方法；旧运行时如果只有 `design.vectorSvg`，直接用同一节点的 vector 和 box 生成局部 SVG 并按画布比例定位，原生页仍应用完整 spec。遇到编译错误按诊断修正图稿。后续批次与恢复沿用选中源稿。
