# Easinote Skill 格式

一个 Skill 是包含 `SKILL.md` 的目录，可按需加入以下内容：

```text
skill-name/
├── SKILL.md
├── agents/openai.yaml
├── scripts/
├── references/
└── assets/
```

`SKILL.md` frontmatter 必须包含：

- `name`：1–64 个字符，仅小写字母、数字和单连字符。
- `description`：说明 Skill 做什么，以及何时触发，最多 1024 字符。

`agents/openai.yaml` 可包含：

```yaml
interface:
  display_name: "面向用户的名称"
  short_description: "简短说明"
  default_prompt: "Use $skill-name to ..."
dependencies:
  tools:
    - type: "mcp"
      value: "server-id"
policy:
  allow_implicit_invocation: true
```

新建技能脚本支持 `.js`、`.mjs`、`.cjs`，使用应用内置 Node，不依赖用户安装 Python 或 Shell；只使用 Node 内置模块和技能内文件。测试由独立 Host 执行器运行，无网络，只允许写入草稿的 `test-output`（测试进程的 `HOME`）。实际使用由应用为 `node` 命令提供内置运行时。
