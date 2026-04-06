# Context Snapshots
> 事实快照库。记录关键的用户原始输入、硬约束和纠偏信息。追加写入，不回改历史。

## [CNT-001] 2026-04-05
> User: "项目中有ai-pm和openspec，给出顶级的联合使用方案。发挥每个技能的优点。并且技能可以自动调用。"
- **Tags**: #workflow #ai-pm #openspec #automation
- **Ref**: Session 2026-04-05 (Collaboration Design)

## [CNT-002] 2026-04-05
> User: "增加约束，每次给出方案时，给出2套方案供我选择，选择完以后再进入openspec propose阶段"
- **Tags**: #workflow #decision-gate #proposal-gate
- **Ref**: Session 2026-04-05 (Collaboration Constraint)

## [CNT-003] 2026-04-05
> User: "我使用 React 18 + TypeScript + Vite，并且对前端界面进行升级，可以去参考图片样式。请分析我的需求"
- **Tags**: #frontend #react18 #typescript #vite #ui-upgrade #reference-style
- **Ref**: Session 2026-04-05 (Frontend Upgrade Analysis)

## [CNT-004] 2026-04-05
> User: "按照方案2，因为后续这是一个自动化测试平台，可以实现根据站点制定不同的测试方案。"
- **Tags**: #frontend #platform #information-architecture #multi-site #test-plans
- **Ref**: Session 2026-04-05 (Platform-Oriented IA Decision)

## [CNT-005] 2026-04-05
> User: "2"
- **Tags**: #sqlite #storage #artifact-download #task-bundle
- **Ref**: Session 2026-04-05 (Selected SQLite Unified Archive Option)
- **Note**: 在“文件存储 vs SQLite 统一归档仓”两套技术方案中，用户明确选择方案 2：配置、token 和测试产物进入 SQLite，并支持按任务下载。

## [CNT-006] 2026-04-05
> User: "增加约束，对输出的方案使用中文"
- **Tags**: #workflow #language #chinese-output #proposal-format
- **Ref**: Session 2026-04-05 (Chinese Plan Output Constraint)

## [CNT-007] 2026-04-06
> User: "允许: 基于本地真实浏览器或组织批准模板，导出并应用“浏览器环境配置”，用于授权站点测试；允许: UA / UA-CH / locale / timezone / viewport / screen / geolocation / 浏览器版本 这类可审计、可解释、与测试环境一致的配置；允许: 方案级绑定、来源追踪、审批标记、审计留痕、运行报告回显；禁止: stealthMode；禁止: Canvas/WebGL/Audio 噪声注入、插件伪造、navigator 深度篡改、随机轮换；禁止: “降低检测率”“规避机器人检测”“绕过保护”这类目标表述；禁止: 以 bot.sannysoft.com 之类检测站作为“有效性评分”主链路。"
- **Tags**: #browser-environment-config #compliance #authorized-testing #acceptance-gate
- **Ref**: Session 2026-04-06 (Authorized Browser Environment Capability)
- **Note**: 上述允许项与禁止项被用户明确提升为验收前置条件；后续 OpenSpec、PRD、设计、实现和测试必须逐项可核对，不得以“反检测”或“设备指纹伪装”为目标表述。
