# 浏览器环境配置项目总览

> 迁移说明：本文件保留旧文件名以兼容历史引用。当前项目主线已切换到浏览器环境配置能力。

## 当前状态

- 主链路实现：已完成
- 历史文档治理：进行中

## 当前能力边界

允许：

- 导出并管理浏览器环境配置
- 绑定到测试方案
- 审批与来源追踪
- 运行前校验
- 运行与产物回显

禁止：

- 深层浏览器伪装
- 外部诊断网站驱动验收
- 任意白名单外字段透传

## 当前入口

- 控制台：`Config Center -> 浏览器环境`
- 运行回显：`Runs`
- 产物回显：`Artifacts`

## 当前实现结构

- 平台资源层：`scripts/platform-store.mjs`
- API 层：`scripts/config-server.mjs`
- 运行时：`src/config/platform-sqlite.ts`、`src/env.ts`、`playwright.config.ts`
- 前端：`frontend/src/pages/ConfigCenterPage.tsx`

## 当前验收依据

- 授权站点结果
- 人工接续状态
- 配置回显
- 审计记录

## 相关文档

- [设计说明](fingerprint-config-design.md)
- [实现说明](fingerprint-config-implementation.md)
- [交付报告](fingerprint-config-delivery-report.md)
- [OpenSpec Change](../../openspec/changes/rename-browser-environment-diagnostic-config/proposal.md)
