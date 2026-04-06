# AGENT_RULES.md

本文件是 `ai-register` 的 project overlay。共享 baseline 由 `docs/baseline/BASELINE_AGENT_RULES.md`、`openspec/specs/platform-core/spec.md` 与 `openspec/specs/spec-authoring/spec.md` 提供；本文件只补充当前仓库的项目目标、安全边界、文档入口、默认工作流和验证命令。

## 加载顺序

1. 先读取当前代理入口文件 `AGENTS.md` 或 `CLAUDE.md`。
2. 再读取本文件。
3. 立即继续读取 `docs/baseline/BASELINE_AGENT_RULES.md`。
4. 再读取 baseline-managed 核心规范：
   - `openspec/specs/platform-core/spec.md`
   - `openspec/specs/spec-authoring/spec.md`
5. 按当前任务继续加载相关 change、项目文档和项目私有 capability。

## 项目目标与安全边界

- 项目目标：基于 Playwright 验证已获授权目标站点的保护流程是否触发、是否拦截，以及在人工完成保护步骤后能否继续。
- 安全边界：只验证保护机制，不提供任何绕过手段。
- 明确禁止：CAPTCHA 绕过、短信验证绕过、设备指纹伪装、机器人规避实现。
- 实现导向：优先通过显式配置驱动站点差异，避免把站点特例或敏感参数硬编码到流程里。

## 项目真值入口

- 用户当前指令优先级最高。
- 仓库入口文件：`AGENTS.md`、`CLAUDE.md`
- 项目记忆：`docs/00_MEMORY/CONTEXT_SNAPSHOT.md`、`docs/00_MEMORY/SESSION_MEMORY.md`、`docs/TODO.md`
- 产品与策略：`docs/01_STRATEGY/DECISIONS.md`、`docs/02_PRD/framework-prd.md`、`docs/03_DESIGN/README.md`、`docs/04_RESOURCES/README.md`
- 技术参考：`docs/README.md`、`docs/ARCHITECTURE.md`、`docs/guides/`、`docs/implementation/`、`docs/analysis/`、`docs/troubleshooting/`
- 工程真值：`openspec/changes/`、`openspec/specs/`、现有代码与测试

## 默认工作流

- 讨论价值、场景、MVP、PRD、页面、交互、实体时，优先使用 `ai-pm`。
- 讨论技术取舍、架构路线、可行性且不应直接编码时，优先使用 `openspec-explore`。
- 需求已稳定，且用户已在候选方案中明确做出选择后，再进入 `openspec-propose`。
- 用户要求实现、继续开发、修复某条变更时，进入 `openspec-apply-change`。
- change 全部完成后，使用 `openspec-archive-change` 归档。
- 只要进入方案阶段，默认先给出 2 套可选方案；未经用户明确选择，不进入 `openspec-propose`。

## 仓库边界与目录职责

- 技术栈：TypeScript、Playwright、Node.js、React、Vite、Express、JSON 配置。
- 核心源码：`src/`
- 自动化测试：`tests/`
- 项目配置：`config/`
- 工具脚本：`scripts/`
- 产品与技术文档：`docs/`
- 变更与规格资产：`openspec/`
- 生成目录：`runtime/`、`artifacts/`、`test-results/` 默认不作为优先手改目标。
- 当前仓库尚未定义 project-owned capability spec；如后续新增，统一放在 `openspec/specs/<capability>/spec.md`，并与上述文档真值保持一致。

## 编码与验证补充

- 修改前先阅读相关代码和配置，保持 TypeScript 类型安全。
- 所有用户输入、配置输入和外部接口返回都要做基本校验。
- 日志中不得泄露邮箱凭据、API key、token 或其他敏感信息。
- 不提交 `.env` 等敏感文件；如历史材料提及环境变量，仅可作为迁移背景，不得作为新增真值来源。
- 改 TypeScript 逻辑后，至少运行 `npm run typecheck`。
- 改 Playwright 主流程后，优先运行相关用例；常用命令：
  - `npm run typecheck`
  - `npm test`
  - `npm run test:headed`
  - `npm run test:ui`
  - `npm run test:report`
  - `npm run config:ui`
  - `npm run console:typecheck`
  - `npm run console:build`
