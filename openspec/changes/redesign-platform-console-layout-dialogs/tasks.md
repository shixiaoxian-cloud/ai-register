## 1. OpenSpec And Shared Baseline

- [x] 1.1 完成 `redesign-platform-console-layout-dialogs` 的 proposal、design、specs 产物，明确工作台布局与统一弹层的边界、能力和验证口径。
- [x] 1.2 复核现有前端文件与未提交改动，确认本轮写集集中在 `frontend/src/components/`、`frontend/src/pages/` 与新增 `frontend/src/styles/` 分片样式目录。

## 2. Shared Workbench Foundation

- [x] 2.1 重构共享壳层和全局样式入口，升级导航、顶栏、工作区头部、卡片、表格、操作栏、空状态和响应式布局。
- [x] 2.2 新增统一弹层基础组件，提供 Modal、Drawer 和 Confirm Dialog 的共享实现与样式。
- [x] 2.3 把公共按钮、输入、焦点态、危险态和遮罩动画收敛到统一 token 与 class 体系。

## 3. Page-Level Productization

- [x] 3.1 重构 `OverviewPage`，强化首屏层级、重点指标、最近动态和快捷入口的工作台编排。
- [x] 3.2 重构 `ConfigCenterPage` 的资源索引、资源台账和详情编辑布局，并接入统一删除确认与高频弹层入口。
- [x] 3.3 重构 `TaskCenterPage` 与 `RunsPage` 的主次分区、详情承接和日志/操作区布局，并替换危险操作确认。
- [x] 3.4 重构 `SystemPage` 的设置工作台布局，使其与共享壳层和详情区规则保持一致。

## 4. Verification And Delivery

- [x] 4.1 运行 `npm run console:typecheck` 与 `npm run typecheck`，验证前端与根级 TypeScript 检查通过。
- [x] 4.2 运行 `npm run console:build`，验证新版控制台可成功构建。
- [x] 4.3 更新 `docs/optimization_logs/2026/04/OPTIMIZATION_LOG_20260409.md`，记录本轮改动、测试回执、目录一致性检查和后续动作。
