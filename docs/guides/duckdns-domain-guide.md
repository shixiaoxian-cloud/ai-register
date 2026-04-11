# DuckDNS 免费域名自动化注册

本文档介绍如何使用 DuckDNS 免费子域名服务进行自动化域名注册和管理。

## 什么是 DuckDNS？

DuckDNS 是一个完全免费的动态 DNS 服务，提供：
- ✅ 免费子域名（yourname.duckdns.org）
- ✅ 支持 IPv4 和 IPv6
- ✅ 支持通配符子域名
- ✅ 简单的 HTTP API
- ✅ 无需信用卡
- ✅ 永久有效（无需续费）
- ✅ 最多 5 个子域名

## 快速开始

### 1. 获取 DuckDNS Token

1. 访问 [https://www.duckdns.org/](https://www.duckdns.org/)
2. 使用 GitHub、Google、Reddit 或 Twitter 账号登录
3. 复制页面顶部显示的 token（格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）

### 2. 配置环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# DuckDNS 配置
DUCKDNS_TOKEN=your-token-here
DUCKDNS_DOMAIN=mytest
```

### 3. 注册域名

```bash
# 注册新域名（会自动获取公网 IP）
node scripts/duckdns-register.mjs register mytest

# 或使用环境变量中的默认域名
node scripts/duckdns-register.mjs register
```

输出示例：
```
🔍 Getting public IP addresses...
📍 IPv4: 203.0.113.42
📍 IPv6: 2001:db8::1

🚀 Updating DuckDNS domain: mytest.duckdns.org
✅ Domain updated successfully
   Domain: mytest.duckdns.org
   IPv4: 203.0.113.42
   IPv6: 2001:db8::1

⏳ Waiting for DNS propagation (5 seconds)...
🔍 Verifying domain resolution...
✅ Domain verified successfully!
```

## 命令参考

### register / update

注册或更新域名的 IP 地址（自动获取当前公网 IP）：

```bash
node scripts/duckdns-register.mjs register <domain>
node scripts/duckdns-register.mjs update <domain>
```

### verify

验证域名 DNS 解析是否正确：

```bash
node scripts/duckdns-register.mjs verify <domain>
```

### clear

清除域名的 IP 地址记录：

```bash
node scripts/duckdns-register.mjs clear <domain>
```

### info

显示域名信息：

```bash
node scripts/duckdns-register.mjs info <domain>
```

## API 使用示例

### 手动调用 API

使用 curl 直接调用 DuckDNS API：

```bash
# 更新域名（自动检测 IP）
curl "https://www.duckdns.org/update?domains=mytest&token=your-token&verbose=true"

# 指定 IPv4 地址
curl "https://www.duckdns.org/update?domains=mytest&token=your-token&ip=203.0.113.42&verbose=true"

# 同时指定 IPv4 和 IPv6
curl "https://www.duckdns.org/update?domains=mytest&token=your-token&ip=203.0.113.42&ipv6=2001:db8::1&verbose=true"

# 清除 IP 地址
curl "https://www.duckdns.org/update?domains=mytest&token=your-token&ip=&clear=true&verbose=true"
```

### 在测试中使用

```typescript
// tests/fixtures/domain-fixture.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function setupTemporaryDomain() {
  const domain = `test-${Date.now()}`;
  const token = process.env.DUCKDNS_TOKEN;

  if (!token) {
    throw new Error('DUCKDNS_TOKEN is required');
  }

  // 注册域名
  await execAsync(`node scripts/duckdns-register.mjs register ${domain}`);

  return {
    domain: `${domain}.duckdns.org`,
    cleanup: async () => {
      // DuckDNS 域名无需清理，会自动过期
      // 或者可以清除 IP 记录
      await execAsync(`node scripts/duckdns-register.mjs clear ${domain}`);
    }
  };
}

// 使用示例
test('with temporary domain', async () => {
  const { domain, cleanup } = await setupTemporaryDomain();
  
  try {
    // 使用域名进行测试
    console.log(`Testing with domain: ${domain}`);
    // ... 测试逻辑
  } finally {
    await cleanup();
  }
});
```

## 配置文件

域名提供商配置位于 `config/domain-providers.json`：

```json
{
  "providers": {
    "duckdns": {
      "type": "subdomain",
      "name": "DuckDNS",
      "apiEndpoint": "https://www.duckdns.org/update",
      "authType": "token",
      "free": true,
      "domains": ["duckdns.org"],
      "features": {
        "ipv4": true,
        "ipv6": true,
        "wildcard": true,
        "autoRenew": true
      },
      "limits": {
        "maxSubdomains": 5,
        "updateInterval": 300
      }
    }
  }
}
```

## 使用限制

1. **子域名数量**：每个账户最多 5 个子域名
2. **更新频率**：建议每 5 分钟更新一次（300 秒）
3. **域名格式**：只能使用字母、数字和连字符
4. **保持活跃**：域名会自动保持活跃，无需手动续费

## 常见问题

### Q: 域名多久会过期？

A: DuckDNS 域名永久有效，无需续费。只要你的账户存在，域名就会一直保留。

### Q: 可以使用通配符吗？

A: 是的，DuckDNS 支持通配符子域名。例如注册 `mytest.duckdns.org` 后，`*.mytest.duckdns.org` 也会自动解析到相同的 IP。

### Q: 如何更新 IP 地址？

A: 只需再次运行 `register` 或 `update` 命令，脚本会自动获取当前公网 IP 并更新。

### Q: DNS 解析需要多久生效？

A: 通常在 1-5 分钟内生效。脚本会等待 5 秒后自动验证。

### Q: 可以在 CI/CD 中使用吗？

A: 可以。将 `DUCKDNS_TOKEN` 添加到 CI/CD 环境变量中，然后在测试前运行注册脚本。

### Q: 如何删除域名？

A: 登录 [DuckDNS 网站](https://www.duckdns.org/)，在域名列表中点击删除按钮。

## 安全注意事项

1. **Token 保护**：
   - 不要将 token 提交到 Git 仓库
   - 使用 `.env` 文件管理 token
   - 在 CI/CD 中使用加密的环境变量

2. **日志脱敏**：
   - 脚本不会在日志中输出 token
   - 确保不要在其他地方打印 token

3. **访问控制**：
   - Token 可以管理你账户下的所有域名
   - 不要与他人共享 token
   - 如果 token 泄露，立即在 DuckDNS 网站重新生成

## 其他免费域名服务

如果 DuckDNS 不满足需求，可以考虑：

- **No-IP**：提供 3 个免费子域名，需要每 30 天确认一次
- **FreeDNS**：提供 50 个免费子域名，25,467+ 共享域名可选
- **Cloudflare**：需要拥有域名，但提供免费 DNS 管理

详细对比见 `config/domain-providers.json`。

## 参考资料

- [DuckDNS 官方网站](https://www.duckdns.org/)
- [DuckDNS API 文档](https://duckdns.org/spec.jsp)
- [调研报告](C:\Users\admin\.claude\plans\sleepy-questing-mccarthy.md)

## 故障排查

### 域名解析失败

```bash
# 检查域名是否注册成功
node scripts/duckdns-register.mjs verify mytest

# 手动查询 DNS
nslookup mytest.duckdns.org

# 使用在线工具
# https://www.whatsmydns.net/
```

### Token 无效

```bash
# 检查 token 格式（应该是 UUID 格式）
echo $DUCKDNS_TOKEN

# 重新登录 DuckDNS 网站获取新 token
```

### 公网 IP 获取失败

```bash
# 手动获取公网 IP
curl https://api.ipify.org

# 或使用其他服务
curl ifconfig.me
curl icanhazip.com
```

## 贡献

如需添加其他域名服务支持，请参考 `scripts/duckdns-register.mjs` 的实现。
