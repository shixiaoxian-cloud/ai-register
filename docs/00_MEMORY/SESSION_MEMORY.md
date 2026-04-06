# Project Session Log

## 2026-04-05 · ai-pm × OpenSpec 协作方案
- **Discussion**: 定义项目内产品工作流与变更执行工作流的衔接方式。
- **Evidence**: 基于 [CNT-001] 的要求，以及当前仓库已存在 `openspec/` 但缺少 `docs/00_MEMORY/` 的现状。
- **Outcome**:
  - 初始化 `docs/00_MEMORY/`、`docs/TODO.md` 和 `docs/01_STRATEGY/` 到 `docs/04_RESOURCES/` 的基础骨架。
  - 将自动路由规则写入 `CLAUDE.md`，让技能按意图自动切换。
  - 为 `openspec/config.yaml` 增加项目上下文和产物规则，让 OpenSpec 默认吸收产品文档与安全边界。
  - 新增联合工作流说明文档，作为后续协作的顶层约定。

## 2026-04-05 · 双方案选择闸门
- **Discussion**: 收紧从方案讨论进入 OpenSpec propose 的前置条件。
- **Evidence**: 基于 [CNT-002] 的用户约束。
- **Outcome**:
  - 所有方案阶段默认先给出 2 套可选方案。
  - 两套方案必须说明收益、代价和适用前提，并允许标注推荐项。
  - 只有在用户明确完成选择后，才能进入 `openspec-propose`。

## 2026-04-05 · 前端升级方向确认
- **Discussion**: 用户提出使用 React 18 + TypeScript + Vite 升级前端界面，并参考后台控制台风格图片；在两套升级路径中明确选择“产品化后台重构”。
- **Evidence**: [CNT-003] 明确提出技术栈与界面升级目标；用户在方案分支中确认选择 `B`。
- **Outcome**:
  - 将本次前端升级定义为“产品化后台重构”，而不是单纯替换现有原生 HTML 页面。
  - 前端目标定位从“本地工具页”升级为“内部测试控制台产品”。
  - 后续分析、PRD、设计和实现将围绕统一控制台、模块化页面树、组件系统和设计令牌展开。

## 2026-04-05 · 信息架构选择切换为资源中心型后台
- **Discussion**: 在两套信息架构中，用户未采用 Run-Centric 方案，而是明确要求按 Resource-Centric Operations Hub 推进。
- **Evidence**: [CNT-004] 指出该产品将继续演进为“可针对不同站点制定不同测试方案”的自动化测试平台。
- **Outcome**:
  - 一级导航从“运行中心优先”切换为“配置资源中心优先”。
  - 产品主线调整为：站点管理 → 测试方案管理 → 运行执行 → 结果产物。
  - 后续页面和实体设计将优先支持多站点、多方案、多次运行的扩展性，而不是只围绕单次运行工作流组织。

## 2026-04-05 · 平台存储选择切换为 SQLite 统一归档仓
- **Discussion**: 针对“配置入库、token 入库、按任务下载”的需求，在两套存储方案中，用户没有采用“SQLite 元数据 + 文件仓”的混合路线，而是明确选择“SQLite 统一归档仓”。
- **Evidence**: [CNT-005] 代表用户确认选择方案 2。
- **Outcome**:
  - 平台持久化方向从 file-backed resource model 调整为 SQLite 统一真源。
  - `Site / Plan / Target Profile / Mail Config / Task / Case / Run / Artifact` 将围绕本地 SQLite 建模。
  - token、日志、summary、报告、trace、媒体等产物将进入统一归档层，并补出按任务下载能力。
  - 现有 `config/`、`output_tokens/`、`runtime/`、`artifacts/` 路径降级为迁移导入源或兼容回退边界。

## 2026-04-05 · 方案输出语言约束
- **Discussion**: 用户要求所有“方案”类输出统一使用中文，减少中英混写带来的理解成本。
- **Evidence**: 基于 [CNT-006] 的用户约束。
- **Outcome**:
  - 后续产品方案、流程方案、技术方案默认使用中文输出。
  - 只有在用户明确要求英文或其他语言时，才切换方案输出语言。

## 2026-04-06 · 授权浏览器环境配置成为正式验收能力
- **Discussion**: 用户明确保留“浏览器环境配置”能力，但要求其严格限定在已授权站点测试与可审计环境复现范围内，并将允许项/禁止项整体提升为验收门槛。
- **Evidence**: [CNT-007] 明确给出允许项、禁止项和“否则项目无法验收”的约束。
- **Outcome**:
  - 能力语义从“设备指纹伪装 / 反检测”收敛为“授权浏览器环境配置”。
  - 允许范围锁定为 `UA / UA-CH / locale / timezone / viewport / screen / geolocation / 浏览器版本` 等可审计、可解释、与测试环境一致的配置，以及方案级绑定、来源追踪、审批标记、审计留痕、运行报告回显。
  - 明确禁止 `stealthMode`、Canvas/WebGL/Audio 噪声注入、插件伪造、`navigator` 深度篡改、随机轮换，以及“降低检测率”“规避机器人检测”“绕过保护”等目标表述。
  - 明确禁止把 `bot.sannysoft.com` 等检测站作为“有效性评分”主链路；后续验证应基于授权站点测试结果、配置回显和审计记录。
