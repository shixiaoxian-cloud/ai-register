## Why

当前项目前端仍以分散的原生 HTML 工具页为主，能完成配置、运行和日志查看，但还不是一套可持续扩展的自动化测试平台控制台。随着产品方向明确为“面向多站点、多测试方案的自动化测试平台”，现在不仅需要统一后台入口，还需要把分散在 `config/`、`output_tokens/`、`runtime/`、`artifacts/` 等目录中的配置和测试产物收敛为可查询、可下载、可关联的本地平台数据层。

## What Changes

- 将当前以 `src/config-ui/index.html` 和 `public/log-viewer.html` 为主的前端入口升级为基于 React 18 + TypeScript + Vite 的统一平台控制台。
- 采用资源中心型后台信息架构，提供 `Overview`、`Config Center`、`Runs`、`Artifacts`、`System` 等一级工作区。
- 新增平台级资源管理能力，支持围绕 `Site`、`Plan`、`Target Profile`、`Mail Config` 组织测试配置，而不是只围绕单次运行组织页面。
- 为运行执行和结果查看提供统一的列表、详情、阶段追踪、日志、报告和产物入口，替代当前分散页面和命令式入口。
- 将本地平台存储切换为 SQLite，作为 `Site`、`Plan`、`Target Profile`、`Mail Config`、`Task`、`Case`、`Run` 和 `Artifact` 的统一持久化来源。
- 将测试输出中的结构化产物和二进制产物统一归档到 SQLite，包括 token、journey summary、日志、报告包、截图、视频和 trace，并通过元数据关联到任务、用例和运行记录。
- 扩展现有本地 Node/Playwright 服务层，增加基于 SQLite 的资源读写、产物归档、任务级下载打包和兼容导入能力，使前端可以围绕多站点、多方案、多任务进行读取、编辑、执行和下载。
- 保持项目安全边界不变：本次变更只重构平台控制台和配置/执行体验，不引入任何绕过 CAPTCHA、短信验证或设备挑战的能力。
- 非目标：
  - 不在本次变更中重写 Playwright 执行引擎本身。
  - 不在本次变更中引入多角色权限或完整用户管理系统。
  - 不在本次变更中引入远程数据库、分布式对象存储或独立的云后端服务。
  - 不在本次变更中扩大为多租户协作平台或权限系统工程。

## Capabilities

### New Capabilities
- `platform-console-shell`: 提供统一的 React/Vite 平台控制台壳层、一级导航、总览页和共享设计令牌基础。
- `site-plan-management`: 提供站点、测试方案、目标画像和邮箱配置的资源中心式管理体验。
- `run-artifact-operations`: 提供运行执行、阶段追踪、日志查看、报告访问和结果产物管理体验。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `package.json` 与前端构建脚本
  - `scripts/config-server.mjs` 及相关 API / 静态资源服务逻辑
  - `src/config-ui/` 与 `public/log-viewer.html` 的现有入口职责
  - 新的 React 18 + TypeScript + Vite 前端应用目录与共享样式/组件结构
  - 平台存储层、SQLite schema、repository / migration / artifact archive 相关模块
  - `config/`、`output_tokens/`、`runtime/control-plane/tasks/`、`artifacts/tasks/`、`playwright-report/`、`test-results/` 到统一数据库模型的导入与兼容方式
- Affected systems:
  - 本地配置与运行控制台
  - 本地 SQLite 平台存储与任务/产物归档链路
  - 运行状态查询和日志查看路径
  - 报告、截图、trace、token 等产物访问与任务级下载方式
- Dependencies:
  - React 18
  - Vite
  - TypeScript 前端构建配置
  - SQLite Node 驱动与数据库迁移能力
