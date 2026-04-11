# OPTIMIZATION_LOG_20260407

## 平台控制台旧库迁移卡死修复

- 时间：2026-04-07
- 背景：本地 `config/platform.sqlite` 仍包含旧版 `plans` / `runs` / `selection_state` schema。访问 `/api/platform/overview` 时，页面表现为 `{"ok":false,"message":"测试方案必须关联一个浏览器环境配置。"}`，但根因并不只是业务数据缺失，还包含旧库迁移顺序错误。
- 根因：
  - `scripts/platform-store.mjs` 的 `createSchemaSql()` 会在旧表补列前直接创建 `idx_plans_browser_environment_config_id` 与 `idx_runs_browser_environment_config_id`。
  - 旧库中的 `plans` / `runs` 尚未存在 `browser_environment_config_id` 列时，SQLite 会在 schema 初始化阶段直接报 `no such column: browser_environment_config_id`，导致后续 `ensureColumnExists()`、默认浏览器环境种子和方案回填逻辑无法正常完成。
  - 当旧服务实例或旧数据状态继续被读取时，接口层最终只暴露出“测试方案必须关联一个浏览器环境配置”的业务错误，掩盖了前面的迁移阻断。
- 修复：
  - 从 `createSchemaSql()` 中移除依赖新增列的两个索引创建语句。
  - 删除 `getDatabase()` 中重复的 `database.exec(createSchemaSql())`，统一由 `ensureSchemaMigrations()` 执行 schema 初始化与补列。
  - 保留 `ensureSchemaMigrations()` 中“先补列，再创建依赖新列索引”的顺序，确保旧库能够自动升级。
- 影响文件：
  - `scripts/platform-store.mjs`
- 验证回执：
  - `node --check scripts/platform-store.mjs`
  - `node --check scripts/config-server.mjs`
  - 内联 Node 验证：对当前仓库 `createPlatformStore(...).readState()` 成功读取状态，并自动补齐默认浏览器环境、方案绑定和选择状态。
  - 内联 Node 验证：对旧库副本 `C:/Users/admin/AppData/Local/Temp/ai-register-store-debug-8f0bd3d0-2bb5-433e-999d-f09b9c3851ce` 执行 `createPlatformStore(...).readState()` 成功，证明补丁可覆盖历史 schema。
  - HTTP smoke test：`http://127.0.0.1:3200/api/platform/overview` 已返回 `200`，总览数据恢复正常。
- 未执行项：
  - 未运行 `npm run typecheck` / Playwright 全量测试；本次改动集中在 Node `mjs` 的 SQLite 迁移顺序，当前以语法校验、旧库迁移复现和接口 smoke test 作为替代验证。

## OpenAI 注册自动化测试问题诊断与修复

- 时间：2026-04-07
- 背景：用户反馈 OpenAI register 方案无法正常执行任务，测试失败并报错 `Failed to create mailbox: Service Unavailable`。
- 根因：
  - 临时邮箱服务 `http://114.215.173.42:63355/` 后端没有配置可用的邮箱域名。
  - API 返回错误：`{"error":"no active domains available"}`
  - 测试在创建临时邮箱时失败，导致整个注册流程无法继续。
  - 配置中心显示邮箱配置正常（模式：临时邮箱 API，已启用），但服务端实际不可用。
- 诊断过程：
  - 运行 `npm test` 发现所有 3 次重试均失败，错误发生在 `src/email/temp-mail.ts:135`。
  - 使用 `curl` 测试临时邮箱 API：`curl -X POST http://114.215.173.42:63355/api/mailboxes` 返回 `{"error":"no active domains available"}`。
  - 确认服务本身可访问（返回 200），但创建邮箱的 API 端点不可用。
  - 检查配置数据库，确认邮箱配置正确读取，问题在于外部服务不可用。
- 解决方案：
  - **方案 1（快速）**：创建测试脚本使用固定邮箱绕过临时邮箱服务。
  - **方案 2（长期）**：在配置中心切换到 IMAP 真实邮箱模式。
  - **方案 3（修复）**：联系临时邮箱服务管理员添加可用域名配置。
  - **方案 4（替代）**：切换到其他公开临时邮箱 API 服务。
- 实施内容：
  - 创建 `test-with-fixed-email.bat`（Windows）和 `test-with-fixed-email.sh`（Linux/Mac）测试脚本。
  - 脚本功能：接受邮箱地址参数，自动生成随机密码，设置环境变量，开启有头模式和手动验证模式。
  - 创建详细修复文档：`docs/troubleshooting/openai-register-test-fix.md`。
  - 创建问题排查文档：`docs/troubleshooting/temp-mail-service-unavailable.md`。
- 影响文件：
  - 新增：`test-with-fixed-email.bat`
  - 新增：`test-with-fixed-email.sh`
  - 新增：`docs/troubleshooting/openai-register-test-fix.md`
  - 新增：`docs/troubleshooting/temp-mail-service-unavailable.md`
- 验证方式：
  - 用户可运行 `test-with-fixed-email.bat your-email@gmail.com` 使用固定邮箱测试。
  - 测试会打开浏览器，自动填写邮箱，等待用户手动输入验证码。
  - 绕过临时邮箱服务，直接使用真实邮箱接收验证码。
- 未执行项：
  - 未实际运行完整测试流程（需要用户提供真实邮箱）。
  - 未修改临时邮箱服务后端配置（需要服务管理员权限）。
  - 未在配置中心添加 IMAP 邮箱配置（等待用户选择方案）。
