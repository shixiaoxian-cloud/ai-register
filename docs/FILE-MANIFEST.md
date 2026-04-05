# 项目文件清单

## 新增文件

### 核心功能模块
- `src/utils/jwt-decoder.ts` - JWT token 解码工具
- `src/utils/token-saver.ts` - Token 保存模块（支持 CPA 和 Sub2Api 格式）

### 文档
- `docs/guides/token-extraction.md` - Token 提取与保存完整指南
- `docs/implementation/token-save-implementation.md` - 实现总结文档
- `docs/QUICK-REFERENCE.md` - 快速参考指南

## 修改文件

### 测试用例
- `tests/protection-validation.spec.ts` - 添加 token 自动提取和保存逻辑

### 配置文件
- `.env.example` - 添加 TOKEN_OUTPUT_DIR 配置项
- `README.md` - 更新项目说明，添加新功能介绍

## 输出目录

### Token 保存目录（运行时生成）
- `output_tokens/cpa/` - CPA 格式 token 文件
- `output_tokens/sub2api/` - Sub2Api 格式 token 文件

## 功能特性

### 1. JWT 解码 (`jwt-decoder.ts`)
- ✅ Base64URL 解码
- ✅ 提取 OpenAI JWT claims
- ✅ 解析账号信息（email, account_id, user_id）
- ✅ 错误处理

### 2. Token 保存 (`token-saver.ts`)
- ✅ 构建 CPA 格式 payload
- ✅ 构建 Sub2Api 格式 payload
- ✅ 文件保存（JSON 格式）
- ✅ 多格式同时保存
- ✅ 目录自动创建

### 3. 测试集成 (`protection-validation.spec.ts`)
- ✅ 注册成功检测
- ✅ localStorage token 提取
- ✅ 自动保存到本地
- ✅ 测试报告附加

### 4. 格式兼容性
- ✅ 完全兼容 gpt-register 的 CPA 格式
- ✅ 完全兼容 gpt-register 的 Sub2Api 格式
- ✅ 字段映射一致
- ✅ 目录结构一致

## 使用流程

```
测试运行
    ↓
注册成功 (outcome.kind === "success")
    ↓
提取 token (localStorage)
    ↓
JWT 解码 (jwt-decoder.ts)
    ↓
格式转换 (token-saver.ts)
    ↓
文件保存 (output_tokens/)
    ↓
报告附加 (tokens.json)
```

## 安全考虑

- ✅ `output_tokens/` 已加入 `.gitignore`
- ✅ 不提交敏感 token 文件
- ✅ 日志中不输出完整 token
- ✅ 仅在注册成功时提取

## 参考项目

本实现参考了 **gpt-register** 项目：
- Token 格式标准
- JWT 解码逻辑
- 文件组织结构

主要区别：
- 语言：TypeScript vs Python
- 用途：保护验证 vs 批量注册
- 范围：本地保存 vs 上传到服务器

---

**实现日期**: 2026-04-05
**版本**: 1.0.0
