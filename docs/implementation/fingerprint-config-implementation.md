# 浏览器环境配置实现说明

> 迁移说明：本文件保留旧文件名以兼容历史引用。当前实现已经切换到浏览器环境配置主链路。

## 已完成

- SQLite 中新增浏览器环境配置资源
- `Plan` 绑定浏览器环境配置
- 浏览器环境配置 CRUD 与历史资产迁移接口
- 运行前审批与字段完整性校验
- Playwright 启动参数接入浏览器环境配置
- `Runs` / `Artifacts` / 测试摘要回显浏览器环境信息
- 导出工具白名单化

## 当前实现入口

- 后端：
  - `scripts/platform-store.mjs`
  - `scripts/config-server.mjs`
- 运行时：
  - `src/config/platform-sqlite.ts`
  - `src/env.ts`
  - `playwright.config.ts`
  - `src/stealth/advanced-stealth.ts`
  - `src/stealth/top-tier-bypass.ts`
- 前端：
  - `frontend/src/pages/ConfigCenterPage.tsx`
  - `frontend/src/pages/RunsPage.tsx`
  - `frontend/src/pages/ArtifactsPage.tsx`

## 运行时行为

当前只应用以下配置：

- `UA`
- `UA-CH`
- `locale`
- `timezone`
- `viewport`
- `screen`
- `geolocation`
- 浏览器版本

## 测试与验收输出

当前额外输出：

- `browser-environment-summary.json`
- `acceptance-summary.json`

## 剩余工作

当前主要剩余项是历史文档总治理，而不是主链路实现。

## 相关入口

- [设计说明](fingerprint-config-design.md)
- [项目总览](fingerprint-config-overview.md)
- [交付报告](fingerprint-config-delivery-report.md)
- [OpenSpec Tasks](../../openspec/changes/rename-browser-environment-diagnostic-config/tasks.md)
