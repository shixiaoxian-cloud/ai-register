# Sub2Api 文件聚合功能

## 快速开始

```bash
# 聚合所有任务文件夹
npm run aggregate

# 聚合指定任务
npm run aggregate task-run-xxx
```

## 功能说明

将任务文件夹中的多个 sub2api 文件合并成一个汇总文件，所有 accounts 数组会被合并到一起。

## 输出示例

```
output_tokens/
└── task-run-xxx/
    ├── sub2api/
    │   ├── run-1__email1.sub2api.json  (1 个账号)
    │   └── run-2__email2.sub2api.json  (1 个账号)
    └── task-run-xxx.sub2api.json       (2 个账号，已聚合)
```

## 自动聚合

设置 `TASK_ID` 环境变量后，测试完成会自动生成汇总文件：

```bash
export TASK_ID="mnmbfv73-75fcci"
npm test
```

## 相关文档

- [完整使用指南](../guides/sub2api-aggregation.md)
- [实现总结](../implementation/sub2api-aggregation-implementation.md)
