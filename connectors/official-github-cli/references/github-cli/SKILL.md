---
name: github-cli
description: 使用已安装的 GitHub CLI 连接器查询仓库、问题和拉取请求，或执行用户明确授权的 GitHub 操作。
---

## 本产品执行入口

本文中的 gh 命令通过 connector 工具执行：action=execute，id=github-cli，argv 为去掉程序名后的原生参数数组。不要用 bash 调用全局程序或读取账号目录。安装/配置/登录/退出使用 connector 管理动作，不把这些管理命令放入 execute。缺少权限时报告范围；高风险确认遵循原生规则和产品审批。

# GitHub CLI

在原生 codemode 中通过 `tools.connectors_use` 调用已安装连接器，参数直接传结构化对象。需要核对参数时，在 codemode 内使用 `searchTools` / `describeTool`；已有适用声明时直接复用。工具直接返回业务 DTO，按实际字段和分页参数读取。每次调用仍由 Host 校验授权、撤销和业务确认。

使用 `tools.connectors_use`，`action=execute`、`id=github-cli`，`argv` 为 gh 后的原生参数数组。先用子命令 `--help` 或 `gh api` 的明确 endpoint 核对参数，不通过全局 gh、shell 或环境变量切换账号。

例如读取仓库：`["repo", "view", "cli/cli", "--json", "name,description,url"]`。
需要登录时让用户在连接器管理中授权；只有用户明确要求安装才使用安装入口。不要读取全局凭据、调用 auth token 或配置别名/扩展。创建、修改、关闭或发送内容应符合原请求与产品审批；发生结果未知的写入先查结果，不直接重发。
