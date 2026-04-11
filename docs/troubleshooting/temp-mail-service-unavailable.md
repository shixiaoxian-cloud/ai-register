# 临时邮箱服务不可用问题排查

## 问题现象

测试执行时报错：
```
Error: Failed to create mailbox: Service Unavailable
```

实际 API 返回：
```json
{"error":"no active domains available"}
```

## 根本原因

临时邮箱服务 `http://114.215.173.42:63355/` 后端没有配置可用的邮箱域名，导致无法创建新邮箱。

## 解决方案

### 方案 1：切换到 IMAP 真实邮箱（推荐）

使用真实邮箱接收验证码，更稳定可靠。

1. 准备一个真实邮箱（Gmail、Outlook 等）
2. 在配置中心切换邮件配置模式为 IMAP
3. 配置 IMAP 连接信息

**优点**：
- 稳定可靠，不依赖第三方临时邮箱服务
- 可以保留邮件记录
- 支持所有邮件服务商

**缺点**：
- 需要真实邮箱账号
- 需要配置 IMAP 凭据

### 方案 2：修复临时邮箱服务

联系临时邮箱服务管理员，添加可用域名。

服务端需要配置至少一个可用域名，例如：
- `temp-mail.example.com`
- `disposable.example.com`

### 方案 3：使用其他临时邮箱服务

切换到其他公开的临时邮箱 API 服务：

**可选服务**：
- [Mailinator](https://www.mailinator.com/) - 公开 API
- [Guerrilla Mail](https://www.guerrillamail.com/) - 有 API
- [10 Minute Mail](https://10minutemail.com/) - 需要自己抓包
- 自建临时邮箱服务

### 方案 4：禁用临时邮箱，使用固定邮箱

如果只是测试流程，可以：

1. 在配置中心禁用邮件配置
2. 手动设置 `TARGET_EMAIL` 环境变量为固定邮箱
3. 手动输入验证码（需要开启 `CONTINUE_AFTER_PROTECTED_CHALLENGE=true`）

## 快速修复步骤

### 使用 IMAP 真实邮箱（最快）

```bash
# 1. 打开配置中心
npm run config:ui

# 2. 在"邮件配置"页面：
#    - 切换模式为 IMAP
#    - 填写 IMAP 服务器信息
#    - 保存并激活

# 3. 重新运行测试
npm test
```

### 临时禁用邮箱验证

```bash
# 设置固定邮箱
export TARGET_EMAIL="your-email@example.com"

# 允许手动完成验证
export CONTINUE_AFTER_PROTECTED_CHALLENGE=true

# 运行测试（需要手动输入验证码）
npm test
```

## 验证修复

```bash
# 测试 IMAP 连接
node -e "
const imap = require('imap');
const client = new imap({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  user: 'your-email@gmail.com',
  password: 'your-app-password'
});
client.once('ready', () => {
  console.log('✓ IMAP connection successful');
  client.end();
});
client.once('error', (err) => {
  console.error('✗ IMAP connection failed:', err.message);
});
client.connect();
"
```

## 相关文件

- 临时邮箱服务实现：[src/email/temp-mail.ts](../../src/email/temp-mail.ts)
- 邮件配置：[src/env.ts](../../src/env.ts)
- 配置中心：`npm run config:ui`
