# 浏览器环境配置使用指南

> 迁移说明：本文件保留旧文件名以兼容历史引用。当前实践请统一使用 `BrowserEnvironmentConfig` 的能力定义。

## 1. 使用场景

浏览器环境配置用于：

- 复现组织批准的浏览器环境
- 将环境与测试方案绑定
- 在授权站点测试中保留配置回显与审计记录

不用于：

- 规避保护
- 改写深层浏览器特征
- 使用外部诊断网站结果作为通过标准

## 2. 创建方式

### 2.1 通过导出工具创建

1. 打开 `tools/fingerprint-exporter.html`
2. 采集当前浏览器的白名单字段
3. 下载 JSON
4. 在控制台 `Config Center -> 浏览器环境` 中新建或导入

### 2.2 通过批准模板创建

1. 在控制台进入 `Config Center -> 浏览器环境`
2. 新建配置
3. 填写模板来源、审批状态、版本和字段
4. 保存后绑定到测试方案

### 2.3 通过历史资产迁移

1. 在浏览器环境详情页粘贴历史 JSON
2. 系统仅迁移白名单字段
3. 命中禁止字段时会 Fail Fast 并返回明确原因

## 3. 允许字段

- `UA`
- `UA-CH`
- `locale`
- `timezone`
- `viewport`
- `screen`
- `geolocation`
- 浏览器版本

## 4. 审批与来源

每条浏览器环境配置都应填写：

- 来源类型
- 来源标签
- 审批状态
- 批准人
- 批准时间

未通过审批的配置不能用于执行测试。

## 5. 绑定到方案

1. 打开 `Config Center -> 方案`
2. 选择目标方案
3. 在“关联浏览器环境”中绑定配置
4. 保存方案

运行前会检查：

- 是否已绑定配置
- 配置是否已批准
- 白名单字段是否完整

## 6. 运行回显

执行后可以在以下位置查看浏览器环境回显：

- `Runs` 详情页
- `Artifacts` 右侧详情
- `browser-environment-summary.json`
- `acceptance-summary.json`

## 7. 常见问题

### 7.1 为什么配置保存失败？

常见原因：

- 包含白名单外字段
- 审批信息缺失
- 关键字段不完整

### 7.2 为什么历史 JSON 导入失败？

常见原因：

- 历史资产中仍包含禁止字段
- 来源被识别为检测站主链路
- JSON 结构不合法

### 7.3 为什么运行前被阻断？

常见原因：

- 方案未绑定浏览器环境
- 浏览器环境未批准
- 必需字段缺失或互相冲突

## 8. 当前真值入口

- [设计说明](../implementation/fingerprint-config-design.md)
- [实现说明](../implementation/fingerprint-config-implementation.md)
- [项目总览](../implementation/fingerprint-config-overview.md)
- [OpenSpec Change](../../openspec/changes/rename-browser-environment-diagnostic-config/proposal.md)
