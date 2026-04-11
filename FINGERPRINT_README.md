# 浏览器环境配置文档入口

> 迁移说明：本文件保留旧文件名以兼容历史引用。当前正式能力为 `BrowserEnvironmentConfig`，旧“指纹”术语仅作迁移背景，不再作为产品目标语义。

## 当前定位

浏览器环境配置用于已授权站点测试中的环境复现与审计，当前只支持以下白名单字段：

- `UA`
- `UA-CH`
- `locale`
- `timezone`
- `viewport`
- `screen`
- `geolocation`
- 浏览器版本

每条配置都必须具备：

- 来源标记
- 审批状态
- 审批说明
- 方案级绑定
- 运行回显
- 审计留痕

## 当前实现状态

- 已完成：SQLite 资源模型、后端 CRUD、方案绑定、运行前 Fail Fast、运行详情回显、产物侧回显、导出工具白名单化
- 进行中：历史文档总治理

## 当前入口

- 控制台配置页：`Config Center -> 浏览器环境`
- 运行页回显：`Runs`
- 产物页回显：`Artifacts`
- OpenSpec change：
  - `openspec/changes/rename-browser-environment-diagnostic-config/`

## 相关文档

- [快速开始](docs/guides/fingerprint-config-quickstart.md)
- [使用指南](docs/guides/fingerprint-config-guide.md)
- [设计说明](docs/implementation/fingerprint-config-design.md)
- [实现说明](docs/implementation/fingerprint-config-implementation.md)
- [项目总览](docs/implementation/fingerprint-config-overview.md)
- [交付报告](docs/implementation/fingerprint-config-delivery-report.md)
- [历史索引](docs/implementation/fingerprint-config-index.md)
- [OpenSpec Tasks](openspec/changes/rename-browser-environment-diagnostic-config/tasks.md)

## 历史资产说明

- `tools/fingerprint-exporter.html` 与 `tools/fingerprint-collector.js` 已改为浏览器环境导出工具，但保留旧文件名以兼容历史链接
- `config/fingerprint-presets/` 中的文件保留旧目录名，当前应被视为历史模板迁移输入或兼容资产

## 验收口径

浏览器环境配置的正式验收必须以以下信息为主：

- 授权站点测试结果
- 人工接续状态
- 配置回显
- 审计记录

任何外部检测站结果都只能作为补充诊断材料，不能作为主评分链路。
