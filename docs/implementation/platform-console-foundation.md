# 平台控制台基础实现

## 背景

本次实现把原来分散的原生 HTML 配置页和日志页，升级为一套基于 `React 18 + TypeScript + Vite` 的平台控制台，同时保留现有 Node/Playwright 执行能力不变。

目标不是“换一套前端技术栈”，而是把项目从单次运行工具页，推进为面向多站点、多测试方案、多运行结果的资源中心型后台。

## 本次落地内容

### 1. 新前端工程

- 新增 `frontend/` 目录，使用 React 18 + TypeScript + Vite。
- 新增路由与应用壳层，主工作区包括：
  - `Overview`
  - `Config Center`
  - `Runs`
  - `Artifacts`
  - `System`
- 新增共享视觉基线和后台式布局，替代原先的独立工具页风格。

### 2. 平台资源模型

- 新增平台资源模型，围绕以下资源组织：
  - `Site`
  - `Plan`
  - `Profile`
  - `Mail Config`
- 通过 `config/platform.sqlite` 作为本地 SQLite 持久化真源。
- 首次启动会优先导入已有的 `config/platform-state.json`；若该文件不存在，再从旧的 `config/target-site.json`、`config/temp-mail.json` 和 `config/target-profile.json` 引导初始化。
- 迁移完成后，运行时直接从 SQLite 读取活动方案、站点、画像和邮箱配置，不再把状态写回旧 JSON / `.env`。

### 3. 兼容旧执行引擎

- 新增 `config/target-profile.json`，把目标画像从纯 TypeScript 常量中抽离为活动配置文件。
- `src/target.profile.ts` 改为读取当前活动画像 JSON，再和原有 `prepare` 钩子组合，继续兼容现有 Playwright 流程。
- 启动运行时，会将平台当前选择的站点、方案、画像、邮箱配置同步回旧执行链路使用的配置文件与环境变量。

### 4. 本地服务升级

- `scripts/config-server.mjs` 从“单页配置接口”扩展为“平台控制台服务入口”。
- 新增平台服务模块：
  - `scripts/platform-store.mjs`
  - `scripts/platform-runner.mjs`
  - `scripts/platform-artifacts.mjs`
- `scripts/platform-store.mjs` 现在负责 SQLite schema 初始化、旧配置导入，以及活动方案切换。
- 平台服务支持：
  - 资源管理接口
  - 运行记录接口
  - 结果产物接口

### 5. 运行与产物追踪

- 新增运行历史记录落盘：`artifacts/platform/run-history.json`
- 产物中心会扫描并聚合：
  - `playwright-report/`
  - `test-results/`
  - `output_tokens/`
  - `artifacts/` 中的 token 输出
- 新控制台支持按运行过滤产物。

## 新的开发命令

```bash
npm run config:ui
npm run console:dev
npm run console:build
npm run console:preview
npm run console:typecheck
```

说明：

- `npm run config:ui`：启动本地平台服务。
- `npm run console:dev`：启动 Vite 前端开发服务器。
- `npm run console:build`：构建新的平台控制台。
- `npm run console:typecheck`：仅检查新前端工程的 TypeScript 类型。

## 入口策略

- 访问 `/` 时只提供新版平台控制台。
- 如果没有构建产物，服务会返回“先构建新版控制台”的提示页。
- 旧版入口与旧版日志页不再作为受支持路径保留。

## 边界与说明

- 本次实现没有重写 Playwright 主流程。
- 本次实现已引入本地 SQLite，但仍未引入远程数据库或独立后端服务。
- 本次实现没有加入任何绕过 CAPTCHA、短信验证或设备挑战的能力。
- 当前根级 `npm run typecheck` 仍会受既有 `src/stealth/*.ts` 类型问题影响，因此新增了 `npm run console:typecheck` 作为前端工程独立检查命令。
