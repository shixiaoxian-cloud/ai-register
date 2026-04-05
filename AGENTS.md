# AGENTS Guide

本文件为仓库级代理说明，适用于进入本项目协作的各类 AI agent。

## Mission

这是一个基于 Playwright 的自动化测试框架，用于验证已获授权目标站点的保护流程是否正常触发、是否拦截，以及在人工完成保护步骤后能否继续。

核心边界：

- 只验证保护机制，不提供任何绕过手段
- 不实现 CAPTCHA 绕过
- 不实现短信验证绕过
- 不实现设备指纹伪装或机器人规避

## Source Of Truth

代理执行任务时，按以下优先级理解上下文：

1. 用户当前指令
2. 本文件 `AGENTS.md`
3. [CLAUDE.md](/e:/shichenwei/ai-register/CLAUDE.md)
4. `openspec/` 中的 active changes 和 specs
5. `docs/` 下的项目文档与产品资产
6. 现有代码与测试

如多个来源冲突，以最新的用户明确指令为准；若涉及安全边界，宁可停下来澄清，也不要猜。

## ai-pm × OpenSpec Workflow

本项目采用双引擎协作：

- `ai-pm` 负责价值判断、范围澄清、PRD、流程、实体、设计交付和项目记忆
- `openspec-explore` 负责技术探索和 change 级别的方案澄清，不直接写业务代码
- `openspec-propose` 负责把稳定需求固化为 `proposal.md`、`design.md`、`tasks.md`
- `openspec-apply-change` 负责按 change 执行实现并同步任务状态
- `openspec-archive-change` 负责完成后的归档

默认路由：

- 讨论价值、场景、MVP、PRD、页面、交互、实体时，优先走 `ai-pm`
- 讨论技术取舍、架构路线、可行性分析且不应直接编码时，优先走 `openspec-explore`
- 需求已稳定，且用户已在两套候选方案中明确做出选择后，才走 `openspec-propose`
- 用户要求实现、继续开发、修复某条变更时，走 `openspec-apply-change`
- 任务全部完成后，走 `openspec-archive-change`

串联顺序建议：

`ai-pm` -> `openspec-explore` -> `openspec-propose` -> `openspec-apply-change` -> `openspec-archive-change`

方案选择约束：

- 只要进入“给方案”阶段，无论是产品方案、流程方案还是技术方案，默认必须先给出 2 套可选方案
- 两套方案都要说明适用场景、主要优点、主要代价或风险，方便用户直接比较
- 方案输出默认使用中文；除非用户明确要求英文或其他语言，否则不要切换输出语言
- 未经用户明确选择，不进入 `openspec-propose`
- 如果用户只说“你定”，也要先给出两套方案并标明推荐项，再等待用户确认推荐方案

## Product Memory And Docs

与产品判断和长期记忆相关的内容，放在 `docs/` 体系：

- `docs/00_MEMORY/CONTEXT_SNAPSHOT.md`
  - 记录用户原话、硬约束、纠偏信息
- `docs/00_MEMORY/SESSION_MEMORY.md`
  - 记录会话结论、关键取舍和演化过程
- `docs/TODO.md`
  - 记录未决问题、跨会话待办
- `docs/01_STRATEGY/DECISIONS.md`
  - 仅记录用户已明确确认的业务决策
- `docs/02_PRD/`
  - 存放 Framework PRD 和 feature PRD
- `docs/03_DESIGN/`
  - 存放 UI/UX 文档、原型、设计稿、handoff
- `docs/04_RESOURCES/`
  - 存放竞品、调研、外部参考

规则：

- 新的技术文档默认放在 `docs/` 下，不要随意在根目录新增 markdown
- `AGENTS.md` 是仓库级例外，用于统一代理入口说明
- 新增重要文档后，更新 [docs/README.md](/e:/shichenwei/ai-register/docs/README.md) 和必要的索引

## OpenSpec Operating Rules

OpenSpec 用于管理“单次变更”：

- 查看当前 change：`openspec list --json`
- 查看某条变更状态：`openspec status --change "<name>" --json`
- 创建新变更：`openspec new change "<name>"`
- 获取 apply 指令：`openspec instructions apply --change "<name>" --json`

执行原则：

- 在实现前，优先读取 proposal、design、tasks 和相关 specs
- 若上游 PRD / 决策 / 记忆已经存在，应引用这些资产，而不是重新发明一套平行定义
- 实现过程中发现需求本身有问题，应暂停 `apply`，回到 `ai-pm` 或 `openspec-explore`
- 任务完成后及时更新 `tasks.md` 勾选状态

## Repository Map

关键目录：

- `src/`：核心源代码
- `tests/`：Playwright 测试
- `config/`：站点与服务配置
- `scripts/`：开发和调试脚本
- `docs/`：技术文档、产品记忆和产品资产
- `openspec/`：变更管理与规格资产
- `runtime/`：运行时产物，通常不作为手改源文件
- `artifacts/`：任务和输出产物，通常不作为手改源文件

除非用户明确要求，否则不要优先修改 `runtime/`、`artifacts/`、`test-results/` 这类生成目录。

## Coding Rules

- 修改前先阅读相关代码和配置
- 保持 TypeScript 类型安全
- 优先通过配置驱动行为，不要硬编码站点特例
- 保持模块边界清晰，避免把多种职责揉进同一个文件
- 所有用户输入、配置输入和外部接口返回都要做基本校验
- 日志中不要泄露敏感信息、邮箱凭据、API key 或 token
- 不提交 `.env`
- 不增加任何越过项目安全边界的实现

## Validation

常用命令：

```bash
npm install
npm run pw:install
npm run typecheck
npm test
npm run test:headed
npm run test:ui
npm run test:report
npm run config:ui
```

建议：

- 改 TypeScript 逻辑后，至少运行 `npm run typecheck`
- 改测试主流程后，优先运行相关 Playwright 用例
- 只改文档时，可不跑测试，但要在结果里明确说明

## Documentation Categories

- `docs/guides/`：使用指南、配置说明、操作教程
- `docs/troubleshooting/`：问题诊断、错误修复、FAQ
- `docs/implementation/`：实现总结、技术决策、开发记录
- `docs/analysis/`：深度分析、安全研究、性能观察

## Quick Task Heuristics

如果任务是：

- “帮我想方案 / 定 PRD / 定页面 / 定实体”
  - 先看 `docs/00_MEMORY/`、`docs/01_STRATEGY/`、`docs/02_PRD/`
  - 先产出两套候选方案，等用户选定后再进入后续固化
- “分析某条 change 技术上怎么做”
  - 先看 `openspec/changes/<name>/`
  - 先给两套技术路径，再等待选择
- “继续实现 / 修复某条 change”
  - 先看 `openspec status --change "<name>" --json` 和相关 `tasks.md`
- “补文档 / 复盘 / 交付说明”
  - 先决定放 `docs/implementation/`、`docs/03_DESIGN/` 还是 `docs/01_STRATEGY/`

## When In Doubt

- 优先保持安全边界
- 优先复用已有文档和 change 资产
- 优先做小而可验证的改动
- 优先把产品判断和实现判断分开
