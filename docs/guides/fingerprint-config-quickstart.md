# 浏览器环境配置快速开始

> 迁移说明：本文件保留旧文件名以兼容历史入口。当前请以浏览器环境配置能力为准。

## 5 分钟上手

### 1. 导出白名单字段

```bash
open tools/fingerprint-exporter.html
```

采集并导出以下字段：

- `UA`
- `UA-CH`
- `locale`
- `timezone`
- `viewport`
- `screen`
- `geolocation`
- 浏览器版本

### 2. 在控制台创建配置

1. 运行 `npm run config:ui`
2. 打开 `http://127.0.0.1:3200`
3. 进入 `Config Center -> 浏览器环境`
4. 新建配置或导入历史 JSON

### 3. 填写审批信息

最少需要：

- 来源标签
- 审批状态
- 批准人
- 批准时间

### 4. 绑定到方案

1. 打开 `Config Center -> 方案`
2. 选择目标方案
3. 绑定浏览器环境配置
4. 保存

### 5. 运行并检查回显

执行后查看：

- `Runs` 中的浏览器环境回显
- `Artifacts` 中的环境摘要
- `browser-environment-summary.json`
- `acceptance-summary.json`

## 快速判断是否正确

满足以下条件即为当前合规主链路：

- 配置只包含白名单字段
- 配置已批准
- 方案已绑定
- 运行详情可回显
- 验收摘要可看到环境信息

## 不再使用的旧做法

以下内容只属于历史背景，不再作为当前实践：

- 深层浏览器伪装
- 随机轮换
- 外部诊断网站驱动验收
- 以规避为目标的能力设计

## 下一步

- [完整指南](fingerprint-config-guide.md)
- [设计说明](../implementation/fingerprint-config-design.md)
- [实现说明](../implementation/fingerprint-config-implementation.md)
