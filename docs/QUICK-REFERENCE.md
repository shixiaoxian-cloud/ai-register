# Token 保存功能 - 快速参考

## 快速开始

### 1. 配置环境变量

```bash
# .env 文件
TOKEN_OUTPUT_DIR=./output_tokens
```

### 2. 运行测试

```bash
npm test
```

### 3. 查看保存的 token

```bash
# CPA 格式
ls output_tokens/cpa/

# Sub2Api 格式
ls output_tokens/sub2api/
```

## 文件格式

### CPA 格式示例

```json
{
  "type": "codex",
  "email": "user@example.com",
  "access_token": "eyJhbGc...",
  "refresh_token": "rt_MINeK4YD...",
  "account_id": "727181f8-a7a6-4b90-88de-807ffc82411b"
}
```

### Sub2Api 格式示例

```json
{
  "accounts": [{
    "name": "user@example.com",
    "credentials": {
      "access_token": "eyJhbGc...",
      "refresh_token": "rt_MINeK4YD..."
    }
  }]
}
```

## 常见问题

### Q: Token 未提取到？
A: 检查目标站点是否将 token 存储在 localStorage

### Q: 只有 CPA 格式，没有 Sub2Api？
A: Sub2Api 格式需要 refresh_token

### Q: 如何自定义输出目录？
A: 设置环境变量 `TOKEN_OUTPUT_DIR`

## 相关文档

- [完整指南](token-extraction.md)
- [实现说明](../implementation/token-save-implementation.md)

---

**参考项目**: gpt-register
