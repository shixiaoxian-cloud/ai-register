# Sub2Api 文件聚合功能实现总结

## 概述

实现了 Sub2Api 文件聚合功能，可以将任务文件夹中的多个 sub2api 文件合并成一个汇总文件，方便批量管理和导入账号数据。

## 实现内容

### 1. 核心模块

**文件**: `src/utils/sub2api-aggregator.ts`

提供两个主要函数：

- `aggregateSub2ApiFiles(taskDir)` - 聚合单个任务文件夹
- `aggregateAllTaskDirs(baseOutputDir)` - 聚合所有任务文件夹

功能特性：
- 自动扫描 `sub2api/` 目录下的所有 `.sub2api.json` 文件
- 提取并合并所有 `accounts` 数组
- 生成统一格式的汇总文件
- 详细的日志输出和错误处理

### 2. 命令行脚本

**文件**: `scripts/aggregate-sub2api.mjs`

独立的 Node.js 脚本，支持：

```bash
# 聚合所有任务文件夹
node scripts/aggregate-sub2api.mjs

# 聚合指定任务文件夹
node scripts/aggregate-sub2api.mjs task-run-xxx
```

特性：
- 无需 TypeScript 编译，直接运行
- 支持命令行参数
- 友好的输出格式
- 错误处理和边界情况处理

### 3. 测试集成

**文件**: `tests/protection-validation.spec.ts`

添加 `test.afterAll()` 钩子：

```typescript
test.afterAll(async () => {
  const outputDir = process.env.TOKEN_OUTPUT_DIR || './output_tokens';
  const taskId = process.env.TASK_ID;

  if (taskId) {
    const taskDir = `${outputDir}/task-run-${taskId}`;
    console.log(`\n[Aggregator] 开始聚合任务文件夹: ${taskDir}`);
    await aggregateSub2ApiFiles(taskDir);
  } else {
    console.log('[Aggregator] 未设置 TASK_ID，跳过聚合');
  }
});
```

当设置 `TASK_ID` 环境变量时，测试完成后自动生成汇总文件。

### 4. NPM 脚本

**文件**: `package.json`

添加快捷命令：

```json
{
  "scripts": {
    "aggregate": "node scripts/aggregate-sub2api.mjs"
  }
}
```

使用方式：

```bash
npm run aggregate                    # 聚合所有
npm run aggregate task-run-xxx       # 聚合指定任务
```

### 5. 文档

**文件**: `docs/guides/sub2api-aggregation.md`

完整的使用指南，包括：
- 功能说明
- 三种使用方法（自动/手动全部/手动指定）
- 文件结构说明
- 环境变量配置
- 常见问题解答
- 技术实现说明

## 文件结构

```
ai-register/
├── src/utils/
│   └── sub2api-aggregator.ts          # TypeScript 核心模块
├── scripts/
│   └── aggregate-sub2api.mjs          # 命令行脚本
├── tests/
│   └── protection-validation.spec.ts  # 测试集成（afterAll 钩子）
├── docs/guides/
│   └── sub2api-aggregation.md         # 使用文档
└── package.json                       # NPM 脚本配置
```

## 使用场景

### 场景 1: 批量测试后自动聚合

```bash
export TASK_ID="mnmbfv73-75fcci"
npm test
# 测试完成后自动生成汇总文件
```

### 场景 2: 手动聚合所有任务

```bash
npm run aggregate
```

输出示例：
```
找到 4 个任务文件夹

处理: task-run-mnmbfv73-75fcci
找到 2 个 sub2api 文件，开始聚合...
  - run-1__email1.sub2api.json: 1 个账号
  - run-2__email2.sub2api.json: 1 个账号
✓ Sub2Api 汇总文件已生成
  总计: 2 个账号

✓ 完成! 共生成 4 个汇总文件
```

### 场景 3: 聚合特定任务

```bash
npm run aggregate task-run-mnmbfv73-75fcci
```

## 输出格式

生成的汇总文件格式：

```json
{
  "proxies": [],
  "accounts": [
    {
      "name": "email1@example.com",
      "platform": "openai",
      "type": "oauth",
      "credentials": { ... },
      "extra": { ... },
      "group_ids": [2],
      "concurrency": 10,
      "priority": 1
    },
    {
      "name": "email2@example.com",
      ...
    }
  ]
}
```

## 技术特点

1. **灵活性**: 支持自动、手动全部、手动指定三种方式
2. **健壮性**: 完善的错误处理和边界情况处理
3. **可观测性**: 详细的日志输出，便于调试
4. **易用性**: 简单的命令行接口和 NPM 脚本
5. **文档完善**: 详细的使用指南和故障排除

## 环境变量

- `TOKEN_OUTPUT_DIR`: 输出目录（默认: `./output_tokens`）
- `TASK_ID`: 任务 ID，用于自动聚合

## 相关文档

- [Token 保存指南](../guides/token-extraction.md)
- [Sub2Api 聚合指南](../guides/sub2api-aggregation.md)
- [配置管理](../guides/configuration.md)

## 测试验证

已验证功能：
- ✅ 聚合单个任务文件夹
- ✅ 聚合所有任务文件夹
- ✅ 命令行参数解析
- ✅ NPM 脚本集成
- ✅ 文件格式正确性
- ✅ 错误处理

## 后续优化建议

1. 支持增量聚合（避免重复处理）
2. 添加去重功能（基于 email 或 account_id）
3. 支持自定义输出文件名
4. 添加统计信息（总账号数、有效期等）
5. 支持导出为其他格式（CSV、Excel）

---

**实现日期**: 2026-04-06  
**版本**: 1.0.0
