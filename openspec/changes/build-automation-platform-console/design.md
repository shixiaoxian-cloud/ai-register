## Context

当前项目已经具备可运行的本地控制能力，但配置和产物仍然分散在多个文件与目录中：站点配置在 `config/`，token 输出在 `output_tokens/`，运行时任务结构散落在 `runtime/control-plane/tasks/` 与 `artifacts/tasks/`，报告与调试数据又落在 `playwright-report/` 和 `test-results/`。这套方式能支撑单次排查，但当平台要支持多站点、多方案、多任务和结果中心时，文件路径本身已经开始承担“资源模型”的职责，难以继续扩展。

产品方向已经明确为“自动化测试平台”，需要支持针对不同站点制定不同测试方案，并围绕站点资源、方案资源、任务、运行记录和结果产物建立统一控制台。当前实现必须同时满足两个约束：一是保留现有 Playwright 执行能力和项目安全边界，二是把本地平台的数据源正式收敛为 SQLite，让前端、API 和归档下载围绕一套稳定的领域模型演进，而不是继续直接耦合目录结构。

## Goals / Non-Goals

**Goals:**
- 引入独立的 React 18 + TypeScript + Vite 前端应用，承接统一平台控制台。
- 将前端信息架构切换为资源中心型后台，围绕 `Overview`、`Config Center`、`Runs`、`Artifacts`、`System` 建立路由与共享壳层。
- 为 `Site`、`Plan`、`Target Profile`、`Mail Config`、`Task`、`Case`、`Run`、`Artifact` 建立可扩展的资源视图与 API 组织方式。
- 保留现有 Node/Playwright 作为执行引擎，并通过适配层向新前端暴露稳定接口。
- 以本地 SQLite 作为统一持久化层，承接配置、任务、运行与产物归档。
- 支持按任务聚合并下载报告、日志、trace、媒体和 token 等产物。
- 支持从现有文件配置与目录产物平滑导入到数据库模型，而不打断现有运行链路。

**Non-Goals:**
- 不重写 Playwright 核心执行流程或保护检测逻辑。
- 不在本次变更中引入远程数据库、对象存储、用户系统或多角色权限控制。
- 不在本次变更中实现任何越过项目安全边界的自动化规避能力。

## Decisions

### 1. 前端采用独立的 React/Vite 应用，而不是继续扩展原生 HTML 页面

- Decision:
  - 新建独立的前端应用目录，承载 React 18 + TypeScript + Vite 控制台。
  - 现有 `src/config-ui/index.html` 与 `public/log-viewer.html` 退出运行链路，新前端成为唯一入口。
- Why:
  - 当前页面已经包含多块职责：配置、运行、日志、报告。继续堆叠原生脚本会让状态同步、模块复用和视觉升级越来越困难。
  - 平台化后台需要路由、共享布局、组件系统和类型化数据流，原生页面难以承接。
- Alternatives considered:
  - 继续增强原生 HTML/JS：短期成本低，但无法支撑平台级页面树和组件复用。
  - 直接在现有目录中局部嵌入 React：迁移路径混乱，容易形成双栈前端。

### 2. 保留 Node 本地服务为 API/BFF 层，前端通过适配接口接入

- Decision:
  - 继续以现有本地 Node 服务承载运行控制、配置读写、报告/产物访问。
  - 本地服务新增 SQLite repository 层和 artifact archive 层，作为统一数据访问入口。
  - 为 React 前端补充资源化接口和统一响应结构，而不是立即拆分独立后端服务。
  - 开发阶段使用 Vite dev server + API 代理；构建后由现有本地服务托管静态产物或保留明确部署脚本。
- Why:
  - 当前系统本质上仍是本地测试控制台，直接拆服务会放大范围。
  - 现有 `scripts/config-server.mjs` 已经具备配置读写、运行控制、报告访问等基础能力，适合继续做 BFF。
  - SQLite 是嵌入式数据库，能在不增加独立服务部署的情况下提供可查询、可关联、可事务化的数据模型。
- Alternatives considered:
  - 立刻拆成前后端两个独立服务：更“标准”，但当前并不需要这种复杂度。
  - 前端直接继续读取散落 JSON/HTML：无法建立稳定的资源模型。

### 3. SQLite 作为平台资源与归档的统一真源

- Decision:
  - SQLite 作为 `Site`、`Plan`、`Target Profile`、`Mail Config`、`Task`、`Case`、`Run`、`Artifact` 的统一真源。
  - 现有 `config/*.json`、`output_tokens/`、`runtime/control-plane/tasks/`、`artifacts/tasks/`、`playwright-report/`、`test-results/` 在迁移期只作为导入源或兼容回退，不再作为前端直接依赖的持久化边界。
  - API 与前端统一围绕平台资源模型工作，不再暴露底层目录结构给界面层。
- Why:
  - 当前需求已经明确包含“配置入库”“token 入库”“按任务下载”，文件模型本身不再适合作为长期真源。
  - SQLite 可以提供跨资源关联、事务更新、按任务聚合查询和更稳定的 API 语义。
- Alternatives considered:
  - 延续单一 `target-site.json` + `temp-mail.json`：无法支撑多站点、多方案。
  - SQLite 仅存元数据、文件继续落盘：下载和归档链路仍会长期绑定目录结构，不符合本次已确认方向。

### 4. 信息架构采用 Resource-Centric Operations Hub

- Decision:
  - 一级导航优先体现平台资源与运营视角，而不是围绕单次运行组织。
  - `Config Center` 作为资源入口，负责站点、方案、画像和邮箱配置；`Artifacts` 作为独立一级工作区承接跨运行结果浏览。
- Why:
  - 用户已经明确产品会走向“根据站点制定不同测试方案”的自动化测试平台。
  - 这要求“站点”和“方案”成为长期核心对象，而不只是某次运行的附属配置。
- Alternatives considered:
  - Run-Centric Mission Control：更适合当前单次运行排查，但不适合作为平台长期骨架。

### 5. 任务作为下载和归档的聚合边界，运行作为执行细粒度视图

- Decision:
  - `Task` 作为一次平台发起的工作单元，允许其下包含一个或多个 `Case`；`Run` 作为具体执行记录保留在 `Runs` 视图中。
  - `Artifacts` 既支持按 `Run` / `Case` 查看，也支持按 `Task` 聚合下载。
  - 任务下载默认输出一个按类别组织的压缩包，包含该任务下所有被授权保留的报告、日志、trace、媒体和 token 产物。
- Why:
  - 用户明确提出“按任务下载”，而当前产物模型又天然存在 `task -> case -> token/artifact` 的目录层级。
  - 任务聚合边界适合操作员交付、复盘和外部归档，不必强迫用户逐条运行手动下载。
- Alternatives considered:
  - 只支持按单次运行下载：满足不了批量任务复盘和交付。
  - 只保留全局 Artifacts 视图：缺少一个稳定的下载聚合边界。

### 6. 结构化产物与二进制产物统一归档到 SQLite，按需物化

- Decision:
  - token、journey summary、结构化日志等结构化产物以 JSON 或文本形式存入 SQLite。
  - HTML 报告、截图、视频、trace 等二进制产物以 BLOB 或压缩包形式统一归档到 SQLite，并保存内容哈希、大小、MIME 类型和所属资源元数据。
  - 前端列表接口优先返回元数据与脱敏摘要；查看或下载时再由服务端从数据库物化为临时文件流或压缩包响应。
- Why:
  - 用户已经明确选择 SQLite 统一归档仓，而不是“数据库 + 文件仓”混合真源。
  - 将敏感 token payload 和二进制产物都放进统一归档层，可以避免后续 API 长期暴露目录结构。
- Alternatives considered:
  - 二进制产物继续长期落盘，仅在数据库里记录路径：这会把 SQLite 降格为索引层，不符合本次确认方案。
  - 在列表接口直接返回完整 token payload：会放大敏感信息暴露面。

### 7. 运行与产物保持对现有执行引擎兼容，并显式暴露人工介入状态

- Decision:
  - 新控制台必须保留运行状态、阶段、日志、报告和人工介入提示的可见性。
  - 对于需要人工完成挑战的场景，前端应显示可理解的等待态和下一步说明，而不是只透传原始日志。
  - Playwright 执行阶段可以继续生成临时文件，但在任务收尾时必须归档到 SQLite 并登记关联关系。
- Why:
  - 当前项目核心价值之一就是验证保护是否触发、是否拦截、人工完成后是否可继续，人工介入状态不能在平台化过程中丢失。
  - 平台化之后，运行过程的可观察性仍然是核心价值，不应因为存储重构被削弱。
- Alternatives considered:
  - 只保留“运行中/已完成”粗粒度状态：会破坏现有排查能力。

## Data Model Sketch

```text
Site 1 ── * Plan 1 ── 1 TargetProfile
                  └── 1 MailConfig

Task 1 ── * Case 1 ── * Run
Run  1 ── * Artifact
Task 1 ── * Artifact

Artifact
  - owner_type: task | case | run
  - category: report | log | media | trace | token | summary
  - storage_kind: json | text | blob | zip
  - blob/content stored in SQLite
```

`Runs` 工作区默认聚焦执行记录；`Artifacts` 工作区默认聚焦归档资产；`Task` 则是下载、交付和跨 case 聚合的边界。

## Risks / Trade-offs

- [Risk] 新前端应用与 SQLite 存储层同时迁移，容易出现接口和状态模型不同步。 -> Mitigation: 先定义 schema、repository 和统一 DTO，再逐页替换旧入口。
- [Risk] 大量报告、trace 和视频进入 SQLite 后，数据库体积会快速增长。 -> Mitigation: 对大产物启用压缩、内容哈希和归档策略，并为下载走流式读取而不是整包读入内存。
- [Risk] token 等敏感 payload 进入数据库后，列表接口或日志可能泄露原文。 -> Mitigation: 列表接口只返回脱敏摘要，原始 payload 仅在显式下载或受控详情接口返回，且日志禁止打印明文。
- [Risk] 多站点、多方案模型可能与当前单文件配置结构不完全匹配。 -> Mitigation: 提供一次性导入和受控 fallback，迁移后统一以数据库记录为准。
- [Risk] `Target Profile` 的代码型逻辑不容易完全落入表单配置。 -> Mitigation: 在 v1 中允许 profile 采用“资源记录 + 受控代码/模板适配”方式，不强求完全低代码化。
- [Risk] `Artifacts` 独立一级导航后，用户可能在运行详情、任务详情和资产中心之间迷失。 -> Mitigation: 保持 `Run Detail -> Artifact`、`Task Detail -> Download Bundle` 的强链接，并支持按任务与运行双维过滤。

## Migration Plan

1. 定义 SQLite schema、数据库位置、repository 边界和 artifact archive 读写规范。
2. 为 `config/*.json`、`output_tokens/`、`runtime/control-plane/tasks/`、`artifacts/tasks/`、`playwright-report/`、`test-results/` 编写导入与兼容逻辑。
3. 在本地服务中补齐基于 SQLite 的资源读写、运行查询、归档写入、任务下载和脱敏列表接口，并保持现有运行命令兼容。
4. 优先落地统一壳层、Overview 和 Config Center，使平台先具备站点/方案与数据库资源视图。
5. 再迁移 Runs 与 Artifacts，确保运行执行、日志、任务下载和历史归档路径被新前端覆盖。
6. 完成迁移后，将旧原生页面和旧文件路径移出运行链路，仅保留必要导入源，并在文档中标注弃用边界。

Rollback strategy:
- 导入过程中不立即删除原始文件目录；数据库写入稳定后再逐步收敛到单一真源。
- 新接口优先采用向后兼容方式，不破坏现有 Playwright 运行命令。

## Open Questions

- `Config Center` 在 UI 上是单一聚合页还是后续拆成多个一级导航，目前仍保留产品层待定。
- `Target Profile` 是否最终应成为独立资源，还是收敛进 `Plan` 模型，需要在实体定义和实现复杂度之间再平衡。
- `Plan` 的可配置边界要做到多细，是否允许一部分高级规则继续保留为代码配置，当前尚未完全确认。
- token 等敏感产物是否需要在本地 SQLite 基础上追加可选加密层，当前先按“脱敏展示 + 显式下载”处理，后续可再决策。
