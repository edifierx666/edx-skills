# 安装与启动

1. 在 Orca Settings → General 注册 Orca CLI。
2. 打开 Orca Settings → Orchestration，完成相关 Skill 的安装/更新/检测，并按需设置嵌套 worker 深度。官方提交 [`ad269f4`](https://github.com/stablyai/orca/blob/ad269f471c7ca4532bd560ab547f964e5e5bf423/src/renderer/src/components/settings/OrchestrationPane.tsx#L99-L168) 的该面板没有全局启用开关；不要据此推断其他版本或面板的开关位置。目标版本的实际 UI 与 CLI 指南优先。
3. 用当前 CLI 安装 `orca-cli` 和 `orchestration` 官方 skills；安装本 skill 时复制整个 `edx-orca-multi-model-orchestrator/` 目录（含 `roles/`、`references/`、`scripts/`、`tests/`）到 `~/.claude/skills/edx-orca-multi-model-orchestrator/`。
4. 新开 Orca Claude Code terminal，加载本 skill，提供目标、交付物、repo/workspace、基线、数据/provider policy 和预算，然后确认拆解计划再启动 worker。

示例开工提示词：

```text
加载 edx-orca-multi-model-orchestrator。
用 Orca 多 agent 完成：<任务>
交付物：<代码 / 调研 / 文档 / PPT / PRD 审计>
工作区和基线：<repo / folder、ref/SHA；无 Git 时说明>
数据策略：<分类、允许 provider/family、网页/网络限制、脱敏要求>
并发：默认 shared-serial；独立章节文档可选 parallel-doc；代码并行需明确批准 parallel-worktree。
先给出角色、模型候选、authorFamilies 与每个审查 gate 的排除结果、Ownership、依赖、估算 dispatch 上限和验收计划；我确认后才能创建 Run 或启动 worker。
未经确认，不要 commit、push、开 PR、对外发布/分享、删除文件或删除 worktree。
```
