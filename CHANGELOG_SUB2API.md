# Sub2Api 聚合功能更新日志

## [1.0.0] - 2026-04-06

### 新增功能
- ✅ 实现 Sub2Api 和 CPA 文件聚合功能
- ✅ 自动将 CPA 格式转换为 Sub2Api 格式
- ✅ 支持三种使用方式（自动/手动全部/手动指定）
- ✅ 添加 `npm run aggregate` 命令
- ✅ 测试完成后自动聚合（通过 TASK_ID 环境变量）

### 文件变更
- 新增: `src/utils/sub2api-aggregator.ts`
- 新增: `scripts/aggregate-sub2api.mjs`
- 修改: `tests/protection-validation.spec.ts` (添加 afterAll 钩子)
- 修改: `package.json` (添加 aggregate 脚本)

### 文档
- 新增: `docs/guides/sub2api-aggregation.md`
- 新增: `docs/guides/sub2api-aggregation-quick.md`
- 新增: `docs/implementation/sub2api-aggregation-implementation.md`
- 新增: `docs/implementation/sub2api-aggregation-complete.md`
- 更新: `docs/README.md`

### 使用示例
```bash
# 聚合所有任务
npm run aggregate

# 聚合指定任务
npm run aggregate task-run-xxx

# 自动聚合
export TASK_ID="your-task-id"
npm test
```

### 输出格式
```json
{
  "proxies": [],
  "accounts": [
    // Sub2Api 格式的账号（来自 sub2api/ 和 cpa/）
  ]
}
```

### 技术特性
- 智能识别 Sub2Api 和 CPA 两种格式
- 自动格式转换和统一
- 详细的日志输出
- 健壮的错误处理
- 支持批量处理

### 验证状态
- ✅ 功能测试通过
- ✅ 格式转换正确
- ✅ 文档完整
- ✅ 命令行工具正常

---

查看完整文档: [docs/guides/sub2api-aggregation.md](docs/guides/sub2api-aggregation.md)
