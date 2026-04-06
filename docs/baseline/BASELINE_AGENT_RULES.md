# BASELINE_AGENT_RULES.md

本文件由共享 skill `openspec-shared-baseline` 管理，作为 consumer 项目的共享 OpenSpec baseline 规则入口。项目专属约束必须写入项目自己的 `docs/AGENT_RULES.md` 或项目私有 capability，不得直接修改本文件作为旁路。

## 适用范围与真值边界

- 入口文件 `AGENTS.md` / `CLAUDE.md` 负责当前仓库的最小入口说明。
- `docs/AGENT_RULES.md` 负责当前仓库的 project overlay、可选 capability 与项目级文档加载顺序。
- 本文件负责共享 baseline 级别的加载顺序、自动化工作流和硬约束。
- baseline-managed 核心规范默认包括：
  - `openspec/specs/platform-core/spec.md`
  - `openspec/specs/spec-authoring/spec.md`
- `openspec/changes/*` 与 `openspec/specs/*` 承载工程真相；产品真值、设计资产和参考资料继续由 consumer 仓库自己的项目文档承载。

## 默认加载顺序

1. 先读取当前代理入口文件 `AGENTS.md` 或 `CLAUDE.md`。
2. 再读取当前仓库的 `docs/AGENT_RULES.md`。
3. 继续读取本文件。
4. 默认继续读取 baseline-managed 核心规范：
   - `openspec/specs/platform-core/spec.md`
   - `openspec/specs/spec-authoring/spec.md`
5. 如当前任务仍需项目私有 capability、产品文档或专题说明，由 consumer 仓库的 `docs/AGENT_RULES.md` 决定继续加载哪些内容。
6. 当本文件或 baseline-managed 核心规范缺失、不可读或冲突时，必须立即告知用户，并退回入口文件与 project overlay 的可用兜底约束。

## 共享自动化工作流

1. 多文件修改或预计超过 20 行的改动，必须先给出至少 2 套候选方案，并在进入 proposal 前完成方案选择；用户未明确选择前，不得进入 proposal 或编码。
2. 修复 bug 时，在创建新的 proposal 前，必须先检索当前进行中的 change 与已归档 change；优先复用或关联最匹配的 change。
3. 编码过程中，必须持续遵守 baseline-managed 核心规范中的配置管理、日志规范、安全合规、确定性约束、中文编码与交付验证要求。
4. 执行每一步命令前，必须先以中文说明当前目的、预期结果与验证点；连续多个命令时必须分别说明。
5. 方案执行成功后，必须优先执行可自动化测试、构建或验证命令；若受环境或依赖限制无法执行，必须显式记录阻塞原因、替代验证方式和后续动作。
6. 编码完成后，必须追加记录到 `docs/optimization_logs/<yyyy>/<MM>/OPTIMIZATION_LOG_yyyyMMdd.md`。
7. 大规模修改（3+ 文件或 100+ 行）时，必须执行一次一致性检查或审计，并在最终回复中说明结果。

## 共享硬约束

- 配置必须来自显式配置文件；禁止使用 `process.env`、`os.environ`、`.env`、`dotenv`；配置错误必须 Fail Fast。
- 禁止使用 `print()`、`console.log()`、`fmt.Println()` 作为正式日志能力；必须使用统一日志模块，且不得输出敏感信息。
- 产品真值文档与工程真值文档必须单向衔接，不得把 proposal 兼作 PRD，也不得让 PRD 直接承担实现任务清单。
- 一次性运维脚本必须放在 `scripts/`；自动化断言型测试必须放在 `tests/`；运行时代码不得反向依赖这两个目录。
- 编码必须优先修复根因，保持改动聚焦，避免为了局部实现引入第二套配置语义、权限语义或数据真值。
- 所有新增或修改的中文文本文件默认使用 UTF-8；如发现乱码，必须在交付前修复。
