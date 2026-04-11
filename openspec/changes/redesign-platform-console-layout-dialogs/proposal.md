## Why

当前新版控制台已经完成了“统一入口”和“统一数据表格”的第一阶段收口，但视觉层级、主次分区和交互方式仍然停留在工具页拼装阶段。页面文案已经在表达“左侧台账、右侧详情、统一后台工作台”，而实际布局仍以单列堆叠和原生确认框为主，导致配置、任务和系统页的首屏重点不清、主操作不够聚焦、危险操作体验不一致。

项目已经明确选择“产品化后台重构”路线，并且用户在两套改造方案中明确选择了更激进的 `B` 方案。因此现在需要继续向“资源中心型后台工作台”推进：重做共享壳层和页面骨架，建立统一的 Dialog / Drawer / Confirm 体系，并把首页、配置中心、任务中心和运行中心升级为更接近真实运营后台的工作台布局，同时继续保持授权测试、安全边界和人工接续可观测性不变。

## What Changes

- 重构平台控制台的共享壳层，升级侧栏、顶栏、工作区头部、内容容器和状态区的视觉层级，使页面从“工具页纵向堆叠”切换为“资源工作台 + 主次分区”布局。
- 重构首页信息架构，强化首屏总览、重点指标、最近动态和快捷操作之间的优先级，减少重复标题信息和空白稀释问题。
- 重构 `Config Center`、`Task Center`、`Runs`、`System` 的工作台布局，让桌面端具备明确的主列表/辅助详情/操作面板结构，移动端再回落为单列。
- 新增统一弹层能力，提供 Modal、Drawer、Confirm Dialog 三类共享组件，统一遮罩、层级、尺寸、关闭行为、焦点态和危险操作确认口径。
- 将现有删除确认从原生 `window.confirm` 替换为项目内统一确认弹窗，并为高频新建/编辑操作补充更顺手的弹层与侧滑编辑入口。
- 收敛全局设计令牌与控件样式，统一按钮、输入框、标签、卡片、空状态、操作栏、表格悬停与选中态，使其符合新的 UI 规范。
- 保持现有本地服务、资源 API、运行状态、日志回显和人工接续口径不变，不引入与保护绕过、验证码规避、短信绕过或设备伪装相关的新行为。
- 非目标：
  - 不重写 Playwright 运行引擎和后端资源模型。
  - 不在本轮引入新的组件库或大规模替换 React/Vite 技术栈。
  - 不新增多角色权限、远程协作或云端后端能力。

## Capabilities

### New Capabilities
- `platform-console-workbench`: 规定平台控制台共享壳层、工作台布局、响应式主次分区和页面信息层级的行为要求。
- `platform-console-dialogs`: 规定平台控制台统一模态框、抽屉、确认弹窗以及危险操作确认体验的行为要求。

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `frontend/src/styles.css`
  - `frontend/src/components/*`
  - `frontend/src/pages/OverviewPage.tsx`
  - `frontend/src/pages/ConfigCenterPage.tsx`
  - `frontend/src/pages/TaskCenterPage.tsx`
  - `frontend/src/pages/RunsPage.tsx`
  - `frontend/src/pages/SystemPage.tsx`
- Affected systems:
  - 平台控制台桌面端/移动端布局
  - 平台控制台危险操作确认链路
  - 配置、任务、运行和系统页的首屏工作台体验
- Dependencies:
  - 现有 React 18 + Vite 前端工程
  - 现有本地 API 服务与平台资源接口
- Write set boundary:
  - `owner_paths`: `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/styles.css`
  - `exclusive_files`: `frontend/src/styles.css`, `frontend/src/components/AppShell.tsx`, `frontend/src/pages/ConfigCenterPage.tsx`, `frontend/src/pages/TaskCenterPage.tsx`
  - `read_only_dependencies`: `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`, `scripts/config-server.mjs`
  - `conflicting_changes`: `build-automation-platform-console`、`rename-browser-environment-diagnostic-config` 已完成但尚未归档；本次不修改其 change 产物，只在前端工作台和弹层层面延续实现
  - `merge_order`: 先共享样式与弹层基础，再调整页面布局，最后统一删除确认与验证
