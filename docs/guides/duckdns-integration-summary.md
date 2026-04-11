# DuckDNS 免费域名服务已集成

已为项目添加 DuckDNS 免费域名自动化注册功能。

## 已创建的文件

1. **配置文件**
   - [config/domain-providers.json](config/domain-providers.json) - 域名提供商配置

2. **脚本文件**
   - [scripts/duckdns-register.mjs](scripts/duckdns-register.mjs) - Node.js 版本（推荐）
   - [scripts/duckdns-register.sh](scripts/duckdns-register.sh) - Bash 版本（Linux/macOS）
   - [scripts/duckdns-register.bat](scripts/duckdns-register.bat) - Windows 批处理版本

3. **文档**
   - [docs/guides/duckdns-domain-guide.md](docs/guides/duckdns-domain-guide.md) - 完整使用指南

4. **环境变量**
   - 已更新 [.env.example](.env.example) 添加 DuckDNS 配置

## 快速开始

### 1. 获取 Token

访问 https://www.duckdns.org/ 并登录获取 token

### 2. 配置环境变量

在 `.env` 文件中添加：

```bash
DUCKDNS_TOKEN=your-token-here
DUCKDNS_DOMAIN=mytest
```

### 3. 注册域名

```bash
# 使用 npm scripts（推荐）
npm run domain:register mytest

# 或直接运行脚本
node scripts/duckdns-register.mjs register mytest

# Bash 版本
./scripts/duckdns-register.sh register mytest

# Windows 批处理版本
scripts\duckdns-register.bat register mytest
```

## NPM Scripts

已添加以下 npm scripts：

- `npm run domain:register [domain]` - 注册或更新域名
- `npm run domain:update [domain]` - 更新域名（同 register）
- `npm run domain:verify [domain]` - 验证域名解析
- `npm run domain:clear [domain]` - 清除域名 IP
- `npm run domain:info [domain]` - 显示域名信息

## 功能特性

✅ 自动获取公网 IPv4 和 IPv6 地址
✅ 支持域名注册、更新、验证、清除
✅ 自动验证 DNS 解析
✅ 跨平台支持（Node.js/Bash/Windows）
✅ 完整的错误处理和日志输出
✅ Token 安全管理（环境变量）

## DuckDNS 服务特点

- 完全免费
- 每账户最多 5 个子域名
- 支持 IPv4 和 IPv6
- 支持通配符子域名
- 永久有效，无需续费
- 简单的 HTTP API

## 详细文档

查看完整使用指南：[docs/guides/duckdns-domain-guide.md](docs/guides/duckdns-domain-guide.md)

## 在测试中使用

```typescript
// 示例：在测试中使用临时域名
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test('with temporary domain', async () => {
  const domain = `test-${Date.now()}`;
  
  // 注册域名
  await execAsync(`npm run domain:register ${domain}`);
  
  try {
    // 使用域名进行测试
    const fullDomain = `${domain}.duckdns.org`;
    console.log(`Testing with domain: ${fullDomain}`);
    // ... 测试逻辑
  } finally {
    // 清理（可选）
    await execAsync(`npm run domain:clear ${domain}`);
  }
});
```

## 安全注意事项

- Token 已通过环境变量管理
- 不要将 `.env` 文件提交到 Git
- 脚本不会在日志中输出 token
- 如 token 泄露，立即在 DuckDNS 网站重新生成
