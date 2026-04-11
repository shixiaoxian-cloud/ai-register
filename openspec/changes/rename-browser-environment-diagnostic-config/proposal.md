## Why

当前仓库已经明确把“浏览器环境配置”保留为授权站点测试的正式验收能力，但实现和文档真值仍然严重分裂：项目规则禁止设备指纹伪装与机器人规避，历史设计和 README 却仍然使用“指纹配置”“stealthMode”“降低检测率”“检测站评分”等表述。与此同时，前端控制台、SQLite 平台资源、运行时应用链路和报告回显中还没有一条正式纳管的浏览器环境配置能力，导致授权测试所需的环境复现、审批标记、来源追踪和审计留痕无法形成闭环。

现在必须以完整治理方案收口这条能力：将历史“指纹配置”统一重定义为“浏览器环境配置”，只保留可审计、可解释、与测试环境一致的白名单字段，并将方案级绑定、运行时应用、审计回显、文档口径和迁移策略一起纳入同一条 OpenSpec change，作为后续实现和验收的唯一真值。

## What Changes

- 将仓库内历史“指纹配置 / 反检测 / 设备指纹伪装”语义统一治理为“浏览器环境配置”，并把这条能力限定为已授权站点测试中的环境复现与审计能力。
- 新增 `BrowserEnvironmentConfig` 平台资源，支持基于本地真实浏览器导出或组织批准模板创建/维护配置，并记录来源、审批标记、版本、更新时间和审计留痕。
- 只保留白名单字段：`UA`、`UA-CH`、`locale`、`timezone`、`viewport`、`screen`、`geolocation`、浏览器版本及其必要元数据；禁止保存或应用 `stealthMode`、Canvas/WebGL/Audio 噪声注入、插件伪造、`navigator` 深度篡改、随机轮换及其他绕过导向字段。
- 在 `Plan` 中增加浏览器环境配置绑定关系，并在配置中心、方案编辑器、运行详情和报告中展示绑定结果、来源和审批状态。
- 在运行前增加浏览器环境配置的 Fail Fast 校验，仅允许白名单字段进入运行时应用链路；当配置缺失、审批状态不满足、字段不一致或包含禁止项时，必须阻断执行并返回明确错误。
- 在运行记录、报告和产物元数据中增加浏览器环境配置回显、审批信息和审计摘要，确保验收链路以授权站点测试结果、人工接续状态、配置回显和审计记录为主，而不是依赖检测站评分。
- 增加对历史“指纹配置”模板、导出 JSON、文档和界面文案的迁移与治理路径：可映射的白名单字段迁入新模型，不可映射或包含禁止项的历史资产必须被阻断并留下迁移说明。
- **BREAKING**：仓库内与该能力相关的 UI、API、数据模型、报告文案和文档命名将从 `fingerprint`/`stealth` 语义切换为 `browser environment` 语义；历史包含禁止字段的配置不再允许保存、导入或执行。
- 非目标：
  - 不引入任何 CAPTCHA 绕过、短信验证绕过、设备挑战规避或机器人规避能力。
  - 不把 `bot.sannysoft.com` 等检测站作为验收评分或主链路依赖。
  - 不在本次变更中扩展随机轮换、深度浏览器伪装或无授权环境冒充能力。

## Capabilities

### New Capabilities
- `browser-environment-management`: 定义浏览器环境配置的资源模型、白名单字段、审批/来源元数据、配置中心管理能力和方案级绑定能力。
- `browser-environment-runtime-audit`: 定义浏览器环境配置在运行前的 Fail Fast 校验、运行时白名单应用、运行详情/报告回显和验收审计链路。
- `browser-environment-governance`: 定义历史“指纹配置”资产的迁移治理、仓库内统一命名口径，以及对禁止项和检测站评分语义的清理边界。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `scripts/platform-store.mjs`
  - `scripts/config-server.mjs`
  - `frontend/src/lib/types.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/pages/ConfigCenterPage.tsx`
  - `src/env.ts`
  - `src/stealth/*.ts`
  - 运行报告/运行详情相关前后端代码
- Affected data:
  - SQLite 平台资源模型需要新增浏览器环境配置表或等价持久化结构
  - `Plan` 需要新增浏览器环境配置绑定字段
  - 历史 `config/fingerprint-presets/` 与相关导出 JSON 需要迁移或受控淘汰
- Affected docs:
  - `README.md`
  - `docs/implementation/fingerprint-config-*.md`
  - `docs/guides/fingerprint-config-*.md`
  - `FINGERPRINT_README.md`
  - 相关 OpenSpec / PRD / 决策文档
- Affected systems:
  - 配置中心资源管理链路
  - 运行前配置解析与校验链路
  - 运行详情、报告、产物元数据和审计回显链路
  - 历史指纹配置资产的导入/迁移链路
