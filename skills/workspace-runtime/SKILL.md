---
name: workspace-runtime
description: 本地任务需要 Node 或 Python 处理文件、数据或图片时，查询并使用产品随包运行时。
---

# 工作区运行时

需要执行脚本时，在 codemode 中调用无参数的 `tools.load_workspace_dependencies({})`。返回的 `node` 是产品 Node 启动器，`nodePackages` 描述可用的随包 Node 模块及其实际路径；`python` 是可选的 Python 解释器路径，`pythonPackages` 是可选的随包库目录，`pythonDistributions` 是部署记录的发行包版本映射。先检查实际字段和 `warnings`；记录的版本不等于当前任务已成功导入或执行。同一运行时未改变时复用查询结果。

根据任务选择可用解释器和库。例如 Python 标准库可处理 JSON、CSV 和路径，Pillow 可处理图片；需要 Office 或 PDF 读取、编辑或素材处理时参考 `office`。不假设随包有未列出的库，也不为默认流程搜索系统解释器、安装依赖或修改系统 PATH。组件缺失或导入失败时说明实际限制；用户明确指定其他环境时仍遵循其选择与现有权限。

把任务脚本和输出放在已授权工作区，运行时目录只读。使用实际返回的绝对路径，按当前 Shell 工具描述处理路径空格和转义。通过可用的 `bash` 或 `powershell` 执行，遵守当前“需要授权／完全访问”的文件边界、沙箱和审批；Windows 上工具名 `bash` 不代表实际使用 Bash，以工具声明的 Shell 为准。查询路径不授予执行能力。原生工具按需直接调用；只有需要脚本或其模块时才查询并运行相应解释器。

任务脚本不要命名为 `docx.py`、`pptx.py`、`openpyxl.py`、`inspect.py` 等依赖或标准库名称，以免遮蔽导入。

用户需要可下载或复用的最终本地文件时，完成相称验证后调用 `publish_file({path, summary})` 登记实际工作区文件；不要发布脚本、中间文件或未修改的输入。登记失败时保留文件并说明结果。
