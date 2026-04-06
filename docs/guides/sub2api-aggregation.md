# Token 文件聚合指南

## 概述

本指南说明如何使用 Token 聚合功能，将任务文件夹中的多个 sub2api 和 cpa 文件合并成一个汇总文件。

## 功能说明

当运行多次测试任务时，每次成功注册都会在任务文件夹的 `sub2api/` 和 `cpa/` 目录下生成独立的文件。聚合功能会将这些文件中的所有 `accounts` 数组合并到一个文件中，方便批量导入和管理。

**支持的格式**:
- Sub2Api 格式 (`.sub2api.json`)
- CPA 格式 (`.cpa.json`)

## 文件结构

```
output_tokens/
├── task-run-xxx/
│   ├── cpa/
│   │   ├── run-1__email1.json
│   │   └── run-2__email2.json
│   ├── sub2api/
│   │   ├── run-1__email1.sub2api.json
│   │   └── run-2__email2.sub2api.json
│   └── task-run-xxx.sub2api.json  ← 聚合后的文件（包含 Sub2Api + CPA）
```

## 使用方法

### 方法 1: 自动聚合（推荐）

在运行测试时设置 `TASK_ID` 环境变量，测试完成后会自动生成汇总文件：

```bash
# 设置任务 ID
export TASK_ID="mnmbfv73-75fcci"

# 运行测试
npm test

# 测试完成后，会自动在 output_tokens/task-run-mnmbfv73-75fcci/ 
# 目录下生成汇总文件
```

### 方法 2: 手动聚合所有任务

聚合 `output_tokens/` 目录下的所有任务文件夹：

```bash
npm run aggregate
```

或直接运行脚本：

```bash
node scripts/aggregate-sub2api.mjs
```

输出示例：

```
正在聚合 4 个任务文件夹...

✓ task-run-mnmbfv73-75fcci: 2 个账号 (Sub2Api: 2, CPA: 0)
✓ task-run-mnmc6370-g2c80u: 3 个账号 (Sub2Api: 2, CPA: 1)
✓ task-run-mnmcqi68-yf5jkd: 1 个账号 (Sub2Api: 1, CPA: 0)
✓ task-run-mnmdqlk5-oyk6sb: 2 个账号 (Sub2Api: 1, CPA: 1)

✓ 完成! 共生成 4 个汇总文件
```

### 方法 3: 聚合指定任务

只聚合特定的任务文件夹：

```bash
node scripts/aggregate-sub2api.mjs task-run-mnmbfv73-75fcci
```

或者使用完整路径：

```bash
node scripts/aggregate-sub2api.mjs mnmbfv73-75fcci
```

## 汇总文件格式

生成的汇总文件格式如下：

```json
{
  "proxies": [],
  "accounts": [
    {
      "name": "email1@example.com",
      "notes": "",
      "platform": "openai",
      "type": "oauth",
      "credentials": {
        "access_token": "...",
        "refresh_token": "",
        "expires_in": 863999,
        "expires_at": 1776291151,
        "chatgpt_account_id": "...",
        "chatgpt_user_id": "...",
        "organization_id": "",
        "client_id": "...",
        "model_mapping": { ... }
      },
      "extra": {
        "email": "email1@example.com",
        "password": "..."
      },
      "group_ids": [2],
      "concurrency": 10,
      "priority": 1,
      "rate_multiplier": 1,
      "auto_pause_on_expired": true
    },
    {
      "name": "email2@example.com",
      ...
    }
  ]
}
```

## 环境变量

- `TOKEN_OUTPUT_DIR`: 指定输出目录（默认: `./output_tokens`）
- `TASK_ID`: 任务 ID，用于自动聚合

## 常见问题

### 1. 聚合文件为空

**原因**: sub2api 和 cpa 目录下没有对应的 JSON 文件

**解决**: 确保测试成功完成并生成了 token 文件

### 2. 找不到任务文件夹

**原因**: 任务文件夹名称不正确或不存在

**解决**: 检查 `output_tokens/` 目录下的实际文件夹名称

### 3. 聚合后账号数量不对

**原因**: 某些文件可能损坏或格式不正确

**解决**: 查看控制台输出，检查哪些文件读取失败

### 4. CPA 文件没有被聚合

**原因**: ~~CPA 文件扩展名不是 `.cpa.json`~~ 已修复

**解决**: 脚本已更新，现在会自动将 CPA 格式转换为 Sub2Api 格式并合并

## 技术实现

聚合功能由以下模块实现：

1. **TypeScript 模块**: `src/utils/sub2api-aggregator.ts`
   - 提供 `aggregateSub2ApiFiles()` 函数
   - 提供 `aggregateAllTaskDirs()` 函数

2. **命令行脚本**: `scripts/aggregate-sub2api.mjs`
   - 独立的 Node.js 脚本
   - 支持命令行参数

3. **测试钩子**: `tests/protection-validation.spec.ts`
   - `test.afterAll()` 钩子
   - 自动在测试完成后执行聚合

## 相关文档

- [Token 保存指南](./token-saving.md)
- [配置管理指南](./configuration.md)
- [故障排除](../troubleshooting/general.md)

---

**最后更新**: 2026-04-06
