# 项目文档目录

本目录包含项目的所有技术文档，按类别组织。

## 核心文档

- [项目架构说明](ARCHITECTURE.md) - 系统架构、模块设计、数据流
- [文档贡献指南](CONTRIBUTING.md) - 如何编写和组织文档

## 目录结构

- **00_MEMORY/** - AI PM 项目记忆（事实快照、会话日志）
- **01_STRATEGY/** - 业务决策和范围沉淀
- **02_PRD/** - Framework PRD 和 feature PRD
- **03_DESIGN/** - 设计稿、原型和交付说明
- **04_RESOURCES/** - 调研和外部参考
- **guides/** - 使用指南和配置说明
- **troubleshooting/** - 问题诊断和解决方案
- **implementation/** - 功能实现总结
- **analysis/** - 技术分析报告

## 主要文档索引

### 使用指南
- [前端热重载开发](guides/dev-hot-reload.md) - 新版控制台开发模式和生产入口
- [Chrome 设置指南](guides/chrome-setup.md)
- [临时邮箱使用指南](guides/temp-mail.md)
- [前端临时邮箱集成](guides/frontend-tempmail.md)
- [邮箱保留功能](guides/keep-mailbox.md)
- [快速邮箱保留](guides/quick-keep-mailbox.md)
- [自动生成指南](guides/auto-generation.md)
- [密码流程说明](guides/password-flow.md)
- [调试工具指南](guides/debug-tools.md)
- [实时日志指南](guides/realtime-log.md)
- [日志查看器指南](guides/log-viewer.md)
- [快速参考](guides/quick-reference.md)
- [Token 提取指南](guides/token-extraction.md)
- [Sub2Api 文件聚合](guides/sub2api-aggregation.md)

### 故障排除
- [403 错误诊断](troubleshooting/403-diagnosis.md)
- [403 修复指南](troubleshooting/403-fix-guide.md)
- [403 解决方案](troubleshooting/403-solution.md)
- [验证码调试](troubleshooting/debug-verification-code.md)
- [调试就绪指南](troubleshooting/debug-ready.md)
- [密码环境变量修复](troubleshooting/fix-password-env-issue.md)
- [快速修复建议](troubleshooting/quick-fix-recommendations.md)
- [快速修复](troubleshooting/quick-fix.md)
- [常见问题](troubleshooting/general.md)
- [配置界面故障排除](troubleshooting/config-ui.md)
- [测试启动修复](troubleshooting/test-launch-fix.md)

### 实现总结
- [ai-pm × OpenSpec 联合工作流](implementation/ai-pm-openspec-joint-workflow.md)
- [平台控制台基础实现](implementation/platform-console-foundation.md) - React/Vite 控制台、SQLite 平台资源、Runs 与 Artifacts 工作区
- [自动化功能总结](implementation/automation-summary.md)
- [验证码自动化](implementation/auto-verification-code.md)
- [验证码更新](implementation/verification-code-update.md)
- [动态流程检测](implementation/dynamic-flow-detection.md)
- [全名生日功能](implementation/fullname-birthday.md)
- [邮箱保留实现](implementation/mailbox-retention.md)
- [密码生成器更新](implementation/password-generator-update.md)
- [时序优化](implementation/timing-optimization.md)
- [最终修复](implementation/final-fix.md)
- [配置总结](implementation/configuration-summary.md)
- [实现总结（中文）](implementation/summary-cn.md)
- [实现总结（英文）](implementation/summary-en.md)
- [日志查看器集成](implementation/log-viewer-integration.md)
- [实时日志完成总结](implementation/realtime-log-complete.md)
- [Token 保存实现](implementation/token-save-implementation.md)
- [功能实现完成](implementation/implementation-complete.md)
- [实现报告](implementation/IMPLEMENTATION-REPORT.md)
- [工作区名称自动填写](implementation/workspace-name-auto-fill.md)
- [注册后处理模块化重构](implementation/refactor-post-registration-handler.md)
- [Sub2Api 文件聚合实现](implementation/sub2api-aggregation-implementation.md)
- [Sub2Api 文件聚合完成](implementation/sub2api-aggregation-complete.md)

### 技术分析
- [历史策略研究](analysis/anti-detection.md)
- [历史策略研究（英文）](analysis/anti-detection-en.md)
- [高级隐身技术](analysis/advanced-stealth.md)
- [遥测分析](analysis/telemetry.md)
- [专家分析报告](analysis/expert-report.md)
- [专家最终解决方案](analysis/expert-solution-final.md)
- [顶级解决方案](analysis/top-tier-solution.md)
- [测试分析报告](analysis/test-report.md)

## 快速导航

### 新手入门
1. 阅读 [README.md](../README.md) 了解项目概况
2. 查看 [ARCHITECTURE.md](ARCHITECTURE.md) 理解系统架构
3. 参考 [平台控制台基础实现](implementation/platform-console-foundation.md) 理解新版入口与 SQLite 真源
4. 参考 [前端热重载开发](guides/dev-hot-reload.md) 启动开发或生产控制台
5. 遇到问题查看 [常见问题](troubleshooting/general.md)

### 开发者
1. 阅读 [ARCHITECTURE.md](ARCHITECTURE.md) 了解架构设计
2. 查看 [实现总结](implementation/) 了解功能实现
3. 参考 [CONTRIBUTING.md](CONTRIBUTING.md) 贡献文档

### 问题排查
1. 先查看 [常见问题](troubleshooting/general.md)
2. 针对性查看具体问题的故障排除文档
3. 使用 [调试工具指南](guides/debug-tools.md) 进行深度调试

## 文档统计

- 使用指南：13 篇
- 故障排除：11 篇
- 实现总结：21 篇
- 技术分析：8 篇
- **总计：53 篇技术文档**
- 另含产品协作工作区：`00_MEMORY/`、`01_STRATEGY/`、`02_PRD/`、`03_DESIGN/`、`04_RESOURCES/`
