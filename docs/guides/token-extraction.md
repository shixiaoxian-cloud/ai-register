# Token 提取与保存指南

本文档说明如何在注册成功后自动提取并保存 token。

## 功能概述

当测试用例检测到注册成功（`outcome.kind === "success"`）时，会自动：

1. 从浏览器页面中提取 token（localStorage）
2. 解析 JWT token 获取账号信息
3. 保存为两种格式：
   - **CPA 格式**：适用于 CPA/CLI 管理接口
   - **Sub2Api 格式**：适用于 Sub2Api 账号管理系统

## 配置

### 环境变量

在 `.env` 文件中配置输出目录：

```bash
# Token 输出目录
TOKEN_OUTPUT_DIR=./output_tokens
```

默认值：`./output_tokens`

### 目录结构

保存后的文件结构：

```
output_tokens/
├── cpa/
│   └── user@example.com.json          # CPA 格式
└── sub2api/
    └── user@example.com.sub2api.json  # Sub2Api 格式
```

## Token 格式说明

### CPA 格式

```json
{
  "type": "codex",
  "name": "user@example.com",
  "provider": "openai",
  "platform": "openai",
  "email": "user@example.com",
  "email_verified": true,
  "expired": "2026-04-12T10:25:30+08:00",
  "id_token": "eyJhbGc...",
  "account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
  "chatgpt_account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
  "chatgpt_user_id": "user-mqnyLX3moqwzVQpMkNjvzySo",
  "organization_id": "",
  "access_token": "eyJhbGc...",
  "refresh_token": "rt_MINeK4YD...",
  "credentials": {
    "access_token": "eyJhbGc...",
    "refresh_token": "rt_MINeK4YD...",
    "id_token": "eyJhbGc...",
    "expires_at": 1775960730,
    "expires_in": 863999,
    "chatgpt_account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
    "chatgpt_user_id": "user-mqnyLX3moqwzVQpMkNjvzySo",
    "organization_id": ""
  },
  "extra": {
    "email": "user@example.com",
    "account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
    "chatgpt_account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
    "chatgpt_user_id": "user-mqnyLX3moqwzVQpMkNjvzySo"
  },
  "token_info": {
    "access_token": "eyJhbGc...",
    "refresh_token": "rt_MINeK4YD...",
    "id_token": "eyJhbGc...",
    "account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
    "chatgpt_account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
    "chatgpt_user_id": "user-mqnyLX3moqwzVQpMkNjvzySo",
    "expires_at": 1775960730
  }
}
```

### Sub2Api 格式

```json
{
  "proxies": [],
  "accounts": [
    {
      "name": "user@example.com",
      "notes": "",
      "platform": "openai",
      "type": "oauth",
      "credentials": {
        "access_token": "eyJhbGc...",
        "refresh_token": "rt_MINeK4YD...",
        "expires_in": 863999,
        "expires_at": 1775960730,
        "chatgpt_account_id": "727181f8-a7a6-4b90-88de-807ffc82411b",
        "chatgpt_user_id": "user-mqnyLX3moqwzVQpMkNjvzySo",
        "organization_id": "",
        "client_id": "app_EMoamEEZ73f0CkXaXp7hrann",
        "model_mapping": {
          "gpt-5.1": "gpt-5.1",
          "gpt-5.1-codex": "gpt-5.1-codex",
          "gpt-5.1-codex-max": "gpt-5.1-codex-max",
          "gpt-5.1-codex-mini": "gpt-5.1-codex-mini",
          "gpt-5.2": "gpt-5.2",
          "gpt-5.2-codex": "gpt-5.2-codex",
          "gpt-5.3": "gpt-5.3",
          "gpt-5.3-codex": "gpt-5.3-codex",
          "gpt-5.4": "gpt-5.4",
          "gpt-5.4-mini": "gpt-5.4-mini"
        }
      },
      "extra": {
        "email": "user@example.com",
        "password": "GeneratedPassword123!"
      },
      "group_ids": [2],
      "concurrency": 10,
      "priority": 1,
      "rate_multiplier": 1,
      "auto_pause_on_expired": true
    }
  ]
}
```

## 工作流程

### 1. Token 提取

测试用例在注册成功后，会从浏览器页面中提取 token：

```typescript
const tokens = await page.evaluate(() => {
  const accessToken = localStorage.getItem('accessToken') || 
                     localStorage.getItem('access_token') || '';
  const refreshToken = localStorage.getItem('refreshToken') || 
                      localStorage.getItem('refresh_token') || '';
  const idToken = localStorage.getItem('idToken') || 
                 localStorage.getItem('id_token') || '';
  
  return { accessToken, refreshToken, idToken };
});
```

### 2. JWT 解码

使用 `jwt-decoder.ts` 解析 access_token，提取账号信息：

```typescript
import { extractAuthInfo } from '../src/utils/jwt-decoder';

const authInfo = extractAuthInfo(accessToken);
// 返回: { email, emailVerified, accountId, userId, organizationId, expiresAt }
```

### 3. 格式转换

使用 `token-saver.ts` 构建标准格式：

```typescript
import { buildCPAPayload, buildSub2ApiPayload } from '../src/utils/token-saver';

const cpaPayload = buildCPAPayload(tokenData);
const sub2apiPayload = buildSub2ApiPayload(tokenData);
```

### 4. 文件保存

```typescript
import { saveTokenToMultipleFormats } from '../src/utils/token-saver';

const savedPaths = await saveTokenToMultipleFormats(tokenData, outputDir);
// 返回: { cpa: 'path/to/cpa.json', sub2api: 'path/to/sub2api.json' }
```

## 使用示例

### 运行测试并保存 token

```bash
# 使用默认输出目录
npm run test

# 指定输出目录
TOKEN_OUTPUT_DIR=./my_tokens npm run test
```

### 查看保存的 token

```bash
# 查看 CPA 格式
cat output_tokens/cpa/user@example.com.json

# 查看 Sub2Api 格式
cat output_tokens/sub2api/user@example.com.sub2api.json
```

## 注意事项

### Token 提取限制

1. **仅在注册成功时提取**：只有当 `outcome.kind === "success"` 时才会尝试提取
2. **依赖 localStorage**：目前仅支持从 localStorage 提取，如果目标站点使用其他存储方式需要修改代码
3. **需要 access_token**：CPA 格式至少需要 access_token，Sub2Api 格式需要 refresh_token

### Sub2Api 格式要求

Sub2Api 格式**必须**包含 `refresh_token`，如果没有 refresh_token，将只保存 CPA 格式：

```typescript
if (!refreshToken) {
  console.warn('Sub2Api 格式需要 refresh_token');
  return null;
}
```

### 安全建议

1. **不要提交 token 文件**：确保 `output_tokens/` 在 `.gitignore` 中
2. **保护输出目录**：设置适当的文件权限
3. **定期清理**：及时删除不再使用的 token 文件

## 自定义配置

### 修改 Sub2Api 参数

在 `token-saver.ts` 中可以自定义 Sub2Api 参数：

```typescript
const payload = buildSub2ApiPayload(tokenData, {
  groupIds: [2],              // 账号分组 ID
  concurrency: 10,            // 并发数
  priority: 1,                // 优先级
  autoPauseOnExpired: true    // 过期自动暂停
});
```

### 添加其他格式

如需支持其他格式，可以在 `token-saver.ts` 中添加新的构建函数：

```typescript
export function buildCustomPayload(tokenData: TokenData): CustomPayload {
  // 自定义格式转换逻辑
}
```

## 故障排除

### Token 未提取到

**问题**：日志显示 "No access token found in page storage"

**解决方案**：
1. 检查目标站点是否将 token 存储在 localStorage
2. 使用浏览器开发者工具查看实际的存储位置
3. 修改 `protection-validation.spec.ts` 中的提取逻辑

### 文件保存失败

**问题**：日志显示 "Failed to extract or save tokens"

**解决方案**：
1. 检查输出目录是否有写入权限
2. 确保磁盘空间充足
3. 查看详细错误信息

### Sub2Api 格式未生成

**问题**：只生成了 CPA 格式，没有 Sub2Api 格式

**原因**：缺少 refresh_token

**解决方案**：
- 确认目标站点是否返回 refresh_token
- 检查 localStorage 中的 key 名称是否正确

## 相关文档

- [JWT 解码工具](../implementation/jwt-decoder.md)
- [Token 保存模块](../implementation/token-saver.md)
- [测试用例说明](../guides/test-cases.md)

---

**最后更新**: 2026-04-05
