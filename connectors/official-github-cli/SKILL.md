---
name: official-github-cli
description: 通过 GitHub CLI 查询仓库并执行明确授权的操作。
displayName: GitHub CLI
---

# GitHub CLI

## 连接管理

读取业务说明后直接通过连接器执行命令，Host 会核验绑定账号，不需要在每次查询前重复检查。未就绪时引导用户到连接器界面安装、启用或连接。不要代替用户登录，也不要从全局 CLI 配置读取凭据。

## 使用现有业务说明

先阅读 [原有使用说明](references/github-cli/SKILL.md)，其余原始技能及资源按原目录保留在 references/ 下，按任务需要读取。原文中的 CLI 命令通过 tools.connectors_use({action:"execute", id:"github-cli", argv:[...]}) 执行：argv 不含程序名；不要改用 bash 绕过连接器的隔离与审批。原文中的登录、安装流程由客户端连接界面承接。写操作仍需用户明确授权。
