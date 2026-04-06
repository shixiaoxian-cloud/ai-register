# Spec Authoring Specification

## Purpose

本规范定义仓库内 OpenSpec 开发规范的编写与使用方式，确保代理在进入任务、输出方案、生成 OpenSpec 产物和完成交付时遵守统一加载顺序、方案前置决策、测试映射与日志留痕要求。

## Requirements

### Requirement: 规则加载顺序与职责分层

代理在开始任何分析、规划、编码或评审前 MUST 按入口文件、共享规则、OpenSpec 主规范、专题说明与技能文档的顺序加载上下文；当任一必需规则缺失、不可读或冲突时 MUST 立即告知用户并回退到已知可用规则。

#### Scenario: 开始一个新的仓库任务

- **WHEN** 代理准备进入分析、规划、编码或评审流程
- **THEN** 代理必须先读取入口文件与 `docs/AGENT_RULES.md`
- **AND** 默认继续读取 `platform-core` 与 `spec-authoring` 两个 OpenSpec 主规范
- **AND** 遇到前端职责、请求策略或项目专属资源归属相关任务时，必须继续加载对应专题规范
- **AND** 若规则文件缺失、不可读或冲突，代理必须立即告知用户并说明采用的兜底约束

### Requirement: 多方案前置决策

对于多文件修改或预计超过 20 行的改动，代理在进入 proposal 前 MUST 先给出至少 2 套可比较方案，并等待用户完成选择后再推进后续产物。方案选择 MUST 在 proposal 阶段前完成；在用户尚未明确选择方案前，代理不得进入 proposal 或编码。每套方案都 MUST 具备完整的影响评估、验收要求与测试映射，避免用户在缺少关键信息时被动进入编码阶段。用户一旦明确选择方案，代理 MUST 立即进入 proposal（propose）阶段，创建或更新与已选方案对应的 proposal，并继续推进后续 OpenSpec 产物；不得再次要求“是否进入 propose”或停留在等待式确认状态。

#### Scenario: 准备执行较大范围改动

- **WHEN** 代理判断本次修改涉及多文件或预计超过 20 行
- **THEN** 代理必须先提供至少 2 套方案，并等待用户明确选择
- **AND** 方案选择必须在 proposal 阶段前完成，未完成选择前不得进入 proposal 或编码
- **AND** 每套方案都必须包含影响面、可行性、主要改动范围、主要风险与成本、验收要求、测试要求、回滚或兼容策略与推荐意见
- **AND** 每套方案都必须提供“验收要求 -> 测试项/测试命令”映射，便于用户选择后直接进入验证

#### Scenario: 用户已明确完成方案选择

- **WHEN** 代理已经提供可比较方案，且用户明确选择了其中一套方案
- **THEN** 代理必须自动进入 proposal（propose）阶段，创建或更新与已选方案对应的 proposal
- **AND** 代理不得再次要求“是否进入 propose”“是否继续 proposal”或其他语义等价的重复确认

#### Scenario: 用户尚未选择方案

- **WHEN** 代理已输出多套方案，但用户尚未明确选定其中之一
- **THEN** 代理不得创建 proposal、不得进入编码，也不得把 proposal 当作继续收集选择意见的替代载体

### Requirement: Bug 修复必须优先关联现有 change

当任务目标是修复 bug、回归缺陷、线上异常或已交付能力的行为偏差时，代理在创建新的 proposal 前 MUST 先检索当前进行中的 change 与已归档 change，并优先复用或关联最匹配的 change 上下文。只有在当前 change 与 archived change 都不存在合适匹配项时，代理才可以自动创建新的 proposal；若存在多个同等可行候选，代理 MUST 先展示候选并等待用户选择，不得自行武断归属。

#### Scenario: 存在匹配的当前进行中 change

- **WHEN** 代理在 bugfix 场景下检索到与当前问题域、影响模块和目标结果一致的 active change
- **THEN** 代理必须优先在该 change 上继续推进 proposal、design、tasks 或实现，而不得直接新建平行 proposal

#### Scenario: 仅存在匹配的 archived change

- **WHEN** 代理未检索到合适的 active change，但发现 archived change 覆盖同一问题域或历史决策上下文
- **THEN** 代理必须先把该 archived change 作为 proposal 的关联上下文或复用依据，而不得跳过历史 change 直接按全新问题域处理

#### Scenario: 当前与归档 change 都没有匹配项

- **WHEN** 代理完成当前 change 与 archived change 检索后，仍无法找到可复用或可关联的 change
- **THEN** 代理必须在已明确方案选择的前提下自动创建新的 proposal，不得再次停留在等待式确认

#### Scenario: 存在多个同等可行的 change 候选

- **WHEN** bugfix 检索同时命中多个 current 或 archived change，且这些候选都可能承载本次修复
- **THEN** 代理必须向用户展示候选差异并等待选择，在用户未完成选择前不得进入 proposal 或编码

### Requirement: 并行 active change 必须显式声明写集边界并治理冲突归属

当仓库内同时存在多条 active change，且代理准备新建、更新或继续推进其中任意一条 change 时，proposal 或 design MUST 显式声明该 change 的写集边界与冲突候选，至少覆盖 `owner_paths`、`exclusive_files`、`read_only_dependencies`、`conflicting_changes` 与 `merge_order` 或等价信息。系统 MUST 保持“同一文件同一时刻只能由一条 active change 持有写权限”的单写者原则；当新 change 与既有 active change 在独占文件、热点主文件、共享底座、跨模块边界或统一门禁文件上出现写集重叠时，代理 MUST 在进入编码前先升级为复用已有 change、拆分前置 change，或按波次串行推进，而不得默认并行编码。

#### Scenario: 新 change 准备与其他 active change 并行推进

- **WHEN** 代理准备创建或继续推进一条将与其他 active change 并行存在的 change
- **THEN** proposal 或 design 必须写明该 change 的负责目录、独占写入文件、只读依赖、已知冲突候选与主线整合顺序
- **AND** 这些信息必须足以让后续任务判断哪些文件允许并行推进、哪些文件必须避免重叠写入

#### Scenario: 新 change 与既有 active change 触达同一独占文件

- **WHEN** 代理发现新 change 计划修改的文件已被另一条 active change 声明为独占写入文件
- **THEN** 代理必须在进入 proposal 或编码前改为复用已有 change、拆出前置 change 或等待对方收口后再继续
- **AND** 在用户未完成相关方案选择前，代理不得让两条 change 同时修改该文件

#### Scenario: 高冲突边界治理仍处于 active change 主链中

- **WHEN** 某条 change 涉及热点主文件拆分、共享底座调整、跨模块边界治理或其他高冲突改动，而相关 active change 仍未收口
- **THEN** 代理必须默认延后该高冲突改动
- **AND** 只有在 proposal 或 design 已证明写集互斥且统一验证门禁明确时，才允许继续并行推进

### Requirement: OpenSpec 产物必须继承仓库规范

仓库内任何 proposal、specs、design、tasks 产物都 MUST 继承 `openspec/config.yaml` 中的项目上下文与 artifact 规则，使用 capability 拆分方式表达需求，并避免与入口文档或共享规则形成第二套真值。对于需要方案选择的改动，proposal MUST 只记录用户已明确选择的方案，而不是承担方案决策过程。

#### Scenario: 生成或修改 OpenSpec 产物

- **WHEN** 代理创建或更新 proposal、specs、design 或 tasks
- **THEN** 代理必须遵守 `openspec/config.yaml` 中的 context 与对应 artifact 规则
- **AND** 若本次改动需要先做方案选择，代理只能在用户完成选择后创建或更新 proposal，且 proposal 只记录已选方案
- **AND** 产物内容必须使用可验证、可追溯、可测试的表述，而不是模糊描述“功能正常”或“基本可用”
- **AND** OpenSpec 产物应沉淀结构化开发规范，不应与入口文件或共享规则大段重复而失去职责边界

### Requirement: 说明性输出必须使用中文

除 OpenSpec 固定结构关键字、代码、命令、路径、配置键、接口字段、类名、函数名、变量名、标识符以及用户明确要求保留原文的引用外，代理输出的说明性内容 MUST 使用中文，避免在同一份产物中混入无必要的英文叙述。

#### Scenario: 生成面向用户或面向规范的文本内容

- **WHEN** 代理输出 proposal、specs、design、tasks、分析结论、测试回执、审计结论或修改日志
- **THEN** 说明性文本必须使用中文
- **AND** 只有代码、命令、路径、配置键、接口字段、标识符、OpenSpec 固定结构关键字或用户明确要求保留原文的引用可以保留原样
- **AND** 若存在必须保留的英文原文，代理必须以中文语境解释其用途，避免直接输出大段未经说明的英文内容

### Requirement: 命令执行说明必须使用中文并明确目的

代理在执行终端、脚本、构建、测试、检索或审计命令前 MUST 先输出与当前步骤直接对应的中文说明，明确该命令为什么现在要执行、预期得到什么结果，或要验证哪个结论；不得把命令作为缺少上下文的原始动作直接抛给用户。

#### Scenario: 准备执行一个或多个命令

- **WHEN** 代理准备执行终端、脚本、构建、测试、检索或审计命令
- **THEN** 必须先用中文说明该命令的目的、预期产出或验证点
- **AND** 若连续执行多个命令，必须按步骤分别说明，避免把不同目的合并成笼统表述
- **AND** 说明必须与当前任务直接相关，不得只写“看一下”“跑一下”等不透明描述

### Requirement: 测试回执与修改日志留痕

每次完成方案执行后，代理 MUST 先执行可自动化测试，再在最终回复与优化日志中同步记录测试回执，保证交付结果能够被复核、回归与审计。

#### Scenario: 交付结果包含部分无法自动化验证的项目

- **WHEN** 代理完成实现但存在无法执行的测试、构建或验证项
- **THEN** 最终回复与 `docs/optimization_logs/<yyyy>/<MM>/OPTIMIZATION_LOG_yyyyMMdd.md` 必须同时记录 `已执行测试`、`未执行测试`、`阻塞原因`、`后续动作`
- **AND** 代理必须说明替代验证方式或后续补测安排
- **AND** 测试回执必须与先前方案中的验收映射保持一致，如有偏离必须说明原因与风险

#### Scenario: 多条并行 change 需要整合到同一主线

- **WHEN** 两条或多条并行 active change 需要在同一工作树、主分支或发布批次内整合
- **THEN** 代理必须在主线整合前执行一次跨 change 的统一验证，至少覆盖受影响域的类型检查、构建、专项测试或等价一致性检查
- **AND** 若统一验证因环境、依赖、权限、工作树状态或外部服务限制无法完整执行，代理必须在最终回复与 `docs/optimization_logs/<yyyy>/<MM>/OPTIMIZATION_LOG_yyyyMMdd.md` 中记录 `未执行测试`、`阻塞原因`、`替代验证方式` 与 `后续动作`

### Requirement: OpenSpec 产物必须显式对齐脚本与测试落位

当 proposal、design、tasks、Impact、测试回执或审计结论提到迁移脚本、回填脚本、巡检脚本、自动化测试、测试文件或验证命令时，代理 MUST 使用与仓库目录职责一致的路径口径：一次性运维入口写入 `scripts/`，自动化断言型测试写入 `tests/`；不得在 OpenSpec 产物中把 `app/` 记述为迁移或测试入口目录。

#### Scenario: proposal 或 design 涉及迁移与测试

- **WHEN** 代理在 proposal 或 design 中描述迁移方案、回填方案、巡检方案或测试方案
- **THEN** 迁移/回填/巡检入口必须写成 `scripts/...`
- **AND** 自动化测试文件必须写成 `tests/...`
- **AND** 不得在说明性文本中把 `app/...` 写成一次性迁移或测试入口的最终落位

#### Scenario: tasks 与测试回执映射验收

- **WHEN** 代理在 tasks、最终回复或优化日志中写入“验收要求 -> 测试项/测试命令”映射
- **THEN** 自动化测试命令必须优先指向 `tests/` 下的测试文件
- **AND** 若存在人工运维脚本验证，必须明确标注其为 `scripts/` 下的运维入口，而不是把它等同于自动化测试

### Requirement: 当前变更范围发现错位时必须清理或显式说明

若代理在当前 change 范围内发现一次性迁移/运维入口错误落在 `app/`，或自动化测试错误落在 `scripts/`，则 MUST 在 tasks、测试回执和修改日志中把该问题纳入交付范围：要么迁移到正确目录，要么明确记录阻塞原因、替代验证方式与后续清理动作；不得在明知错位的情况下继续把错误路径写进 proposal、tasks 或最终回执。

#### Scenario: 本次改动范围内存在错位文件

- **WHEN** 代理在当前修改范围内发现一次性迁移或自动化测试文件落位错误
- **THEN** 代理必须把迁移/清理动作写入 tasks 并在交付时说明验证结果
- **AND** 若因用户并行改动、历史分支状态或其他阻塞暂时无法迁移，代理必须在最终回执与优化日志中明确说明

#### Scenario: 本次改动范围内未发现错位文件

- **WHEN** 代理在当前修改范围内完成目录一致性审计且未发现错位文件
- **THEN** 代理仍必须在测试回执或审计结论中记录“已完成目录一致性检查”
- **AND** 不得跳过这条约束的验证留痕

### Requirement: 超限文件治理必须在 OpenSpec 产物中显式留痕

当某个 change 触达已超出适用阈值的前后端源码文件，或预计新增文件在本轮改动后会超过适用阈值时，proposal、design 与 tasks MUST 显式记录适用阈值、当前或预计行数、拆分策略，或无法当场达标时的临时例外原因与后续收敛动作。代理不得把单文件行数问题视为“实现细节”而跳过产物记录。

#### Scenario: proposal 或 design 涉及已超限文件

- **WHEN** 某个 proposal 或 design 涉及修改已超出适用阈值的 `app/` 或 `frontend/src/` 源文件
- **THEN** 对应产物必须写明该文件适用的行数阈值、当前规模、计划中的拆分方向或临时例外原因
- **AND** 不得只描述功能变更而完全省略超限文件治理安排

#### Scenario: tasks 涉及新增或继续修改大文件

- **WHEN** tasks 中包含新增大文件、继续扩展已超限文件，或本轮只完成部分拆分的工作项
- **THEN** tasks 必须写明对应的收敛任务、验证动作或补测计划
- **AND** 若本轮只能保留临时例外，tasks 必须同步记录后续动作，而不是把问题留给隐式未来

### Requirement: 行数治理结果必须进入测试回执与优化日志

change 完成后，最终回复与 `docs/optimization_logs/<yyyy>/<MM>/OPTIMIZATION_LOG_yyyyMMdd.md` MUST 记录本轮已核对的关键文件、对应行数结果、是否满足适用阈值，以及未完成拆分项的阻塞原因与后续动作。若本轮未执行自动化行数审计命令，代理 MUST 说明原因并给出替代验证方式。

#### Scenario: 交付包含单文件行数治理

- **WHEN** 某次交付涉及新增文件行数校验、超限文件收敛或临时例外说明
- **THEN** 最终回复与优化日志必须同步记录已核对文件、行数结果、通过/未通过状态与后续动作
- **AND** 若未执行自动化统计命令，必须说明阻塞原因与替代验证方式
