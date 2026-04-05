# Token 保存功能实现总结

## 概述

本次实现为 ai-register 项目添加了 token 自动保存功能，参考 gpt-register 项目的实现，支持 CPA 和 Sub2Api 两种标准格式。

## 实现内容

### 1. JWT 解码工具 (`src/utils/jwt-decoder.ts`)

**功能**：
- 解码 JWT token 的 payload 部分
- 提取账号信息（email、account_id、user_id 等）
- 处理 OpenAI 特定的 JWT claims

**核心函数**：
```typescript
- decodeJWTPayload(token: string): JWTPayload
- extractAuthInfo(accessToken: string): AuthInfo
- extractChatGPTAccountId(authData: any): string
```

**特点**：
- 完全兼容 gpt-register 的 JWT 解析逻辑
- 支持 Base64URL 解码
- 错误处理完善

### 2. Token 保存模块 (`src/utils/token-saver.ts`)

**功能**：
- 构建 CPA 格式 payload
- 构建 Sub2Api 格式 payload
- 保存 token 到本地文件
- 支持多格式同时保存

**核心函数**：
```typescript
- buildCPAPayload(tokenData: TokenData): CPAPayload | null
- buildSub2ApiPayload(tokenData: TokenData, options): Sub2ApiPayload | null
- saveTokenToFile(tokenData, outputDir, format): Promise<string | null>
- saveTokenToMultipleFormats(tokenData, baseOutputDir): Promise<{cpa, sub2api}>
```

**格式说明**：

#### CPA 格式
- 适用于 CPA/CLI 管理接口
- 包含完整的账号信息和 credentials
- 至少需要 access_token

#### Sub2Api 格式
- 适用于 Sub2Api 账号管理系统
- 包含账号配置（group_ids、concurrency、priority）
- **必须**包含 refresh_token

### 3. 测试用例更新 (`tests/protection-validation.spec.ts`)

**新增功能**：
- 注册成功后自动提取 token
- 从 localStorage 读取 access_token、refresh_token、id_token
- 调用 token 保存模块保存到本地
- 附加 token 信息到测试报告

**提取逻辑**：
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

### 4. 配置更新

#### 环境变量 (`.env.example`)
新增配置项：
```bash
# Token 输出目录
TOKEN_OUTPUT_DIR=./output_tokens
```

#### 文档更新
- 创建 `docs/guides/token-extraction.md` - Token 提取与保存指南
- 更新 `README.md` - 添加新功能说明

## 文件结构

```
ai-register/
├── src/utils/
│   ├── jwt-decoder.ts         # JWT 解码工具（新增）
│   └── token-saver.ts         # Token 保存模块（新增）
├── tests/
│   └── protection-validation.spec.ts  # 更新：添加 token 提取逻辑
├── docs/guides/
│   └── token-extraction.md    # Token 提取指南（新增）
├── output_tokens/             # Token 输出目录（新增）
│   ├── cpa/                   # CPA 格式
│   └── sub2api/               # Sub2Api 格式
├── .env.example               # 更新：添加 TOKEN_OUTPUT_DIR
└── README.md                  # 更新：添加新功能说明
```

## 工作流程

1. **测试运行** → 注册流程执行
2. **注册成功** → 检测到 `outcome.kind === "success"`
3. **Token 提取** → 从 localStorage 读取 token
4. **JWT 解码** → 解析 access_token 获取账号信息
5. **格式转换** → 构建 CPA 和 Sub2Api 格式
6. **文件保存** → 保存到 `output_tokens/` 目录
7. **报告附加** → 将 token 信息附加到测试报告

## 使用方法

### 基本使用

```bash
# 运行测试（自动保存 token）
npm test

# 查看保存的 token
ls output_tokens/cpa/
ls output_tokens/sub2api/
```

### 自定义输出目录

```bash
TOKEN_OUTPUT_DIR=./my_tokens npm test
```

### 查看 token 内容

```bash
# CPA 格式
cat output_tokens/cpa/user@example.com.json

# Sub2Api 格式
cat output_tokens/sub2api/user@example.com.sub2api.json
```

## 与 gpt-register 的对比

### 相同点

1. **Token 格式**：完全兼容 gpt-register 的 CPA 和 Sub2Api 格式
2. **JWT 解析**：使用相同的 JWT payload 提取逻辑
3. **文件组织**：采用相同的目录结构（cpa/ 和 sub2api/）
4. **字段映射**：所有字段名称和结构保持一致

### 不同点

| 特性 | gpt-register | ai-register |
|------|-------------|-------------|
| 语言 | Python | TypeScript |
| 框架 | requests + aiohttp | Playwright |
| 用途 | 批量注册 + 账号池管理 | 保护机制验证 |
| Token 来源 | OAuth 流程获取 | 页面 localStorage 提取 |
| 上传功能 | 支持上传到 CPA/Sub2Api | 仅本地保存 |
| 循环补号 | 支持 | 不支持 |

### 核心差异

**gpt-register**：
- 完整的账号注册和管理系统
- 支持批量注册、循环补号
- 自动上传到 CPA/Sub2Api 接口
- Python 生态，适合服务端部署

**ai-register**：
- 专注于保护机制验证
- 不提供批量注册功能
- 仅本地保存 token
- TypeScript + Playwright，适合测试场景

## 技术细节

### JWT 解码实现

```typescript
export function decodeJWTPayload(token: string): JWTPayload {
  const parts = token.split('.');
  const payload = parts[1];
  
  // Base64URL 解码
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(
    base64.length + (4 - base64.length % 4) % 4, 
    '='
  );
  
  const jsonString = Buffer.from(paddedBase64, 'base64').toString('utf8');
  return JSON.parse(jsonString);
}
```

### Token 提取策略

支持多种 localStorage key 名称：
- `accessToken` / `access_token`
- `refreshToken` / `refresh_token`
- `idToken` / `id_token`

### 错误处理

- JWT 解码失败 → 返回空对象，不中断流程
- 文件保存失败 → 记录错误日志，继续测试
- Token 未找到 → 输出警告信息

## 安全考虑

### 敏感信息保护

1. **不提交到 git**：
   - `output_tokens/` 已加入 `.gitignore`
   - `.env` 文件不提交

2. **文件权限**：
   - 建议设置 `output_tokens/` 目录权限为 700
   - 定期清理不再使用的 token

3. **日志脱敏**：
   - 测试日志中不输出完整 token
   - 仅显示 token 是否存在

### 使用限制

- 仅用于授权的测试场景
- 不用于未经授权的账号获取
- 遵守目标站点的服务条款

## 后续优化建议

### 功能增强

1. **支持更多提取方式**：
   - Cookie 提取
   - SessionStorage 提取
   - 网络请求拦截

2. **Token 验证**：
   - 验证 token 有效性
   - 检查过期时间
   - 测试 API 调用

3. **批量处理**：
   - 支持批量提取多个账号
   - 生成汇总报告

### 代码优化

1. **类型安全**：
   - 完善 TypeScript 类型定义
   - 添加运行时类型检查

2. **错误处理**：
   - 更详细的错误信息
   - 重试机制

3. **测试覆盖**：
   - 单元测试
   - 集成测试

## 参考资料

- [gpt-register 项目](https://github.com/example/gpt-register)
- [JWT 规范](https://jwt.io/)
- [Playwright 文档](https://playwright.dev/)
- [Sub2Api 文档](https://sub2api.example.com/docs)

## 总结

本次实现成功为 ai-register 项目添加了 token 自动保存功能，完全兼容 gpt-register 的格式标准，同时保持了项目的核心原则：**只验证保护机制，不提供绕过手段**。

Token 保存功能作为可选特性，不影响原有的保护机制验证流程，为用户提供了更完整的测试体验。

---

**实现日期**: 2026-04-05
**版本**: 1.0.0
