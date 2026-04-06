# CLAUDE.md

本文件是 `ai-register` 面向 Claude-compatible agent 的补充入口。

## 入口规则

1. 在开始任何分析、规划、编码、评审之前，必须先读取 `docs/AGENT_RULES.md`。
2. `docs/AGENT_RULES.md` 必须继续加载 `docs/baseline/BASELINE_AGENT_RULES.md`、`openspec/specs/platform-core/spec.md` 和 `openspec/specs/spec-authoring/spec.md`，再补充当前仓库的 project overlay。
3. 用户当前指令优先于本文件；若与项目安全边界冲突，必须停止并澄清，不得猜测执行。
4. 本文件只保留 Claude 入口约束；项目专属规范统一维护在 `docs/AGENT_RULES.md`、`openspec/config.yaml` 与项目私有 `openspec/specs/*/spec.md`。
5. 若 `AGENTS.md` 与本文件同时存在，两者应视为等价入口，不得维护分叉规则。
