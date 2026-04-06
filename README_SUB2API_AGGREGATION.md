# Sub2Api 文件聚合功能

## 功能说明

每次任务完成后，在任务文件夹输出一个汇总的 sub2api 文件，格式为：

```json
{
  "proxies": [],
  "accounts": [
    // 所有子任务的 accounts 合并到这里
  ]
}
```

## 使用方法

### 方法 1: 自动聚合（推荐）

```bash
export TASK_ID="your-task-id"
npm test
# 测试完成后自动生成汇总文件
```

### 方法 2: 手动聚合所有任务

```bash
npm run aggregate
```

### 方法 3: 聚合指定任务

```bash
npm run aggregate task-run-xxx
```

## 输出位置

汇总文件生成在任务文件夹根目录：

```
output_tokens/task-run-xxx/task-run-xxx.sub2api.json
```

## 详细文档

查看 [docs/guides/sub2api-aggregation.md](docs/guides/sub2api-aggregation.md)
