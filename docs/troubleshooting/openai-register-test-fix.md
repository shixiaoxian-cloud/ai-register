# OpenAI 注册自动化测试问题诊断与解决

## 问题诊断

### 根本原因
临时邮箱服务 `http://114.215.173.42:63355/` 返回错误：
```json
{"error":"no active domains available"}
```

服务后端没有配置可用的邮箱域名，导致无法创建临时邮箱。

### 测试失败日志
```
Error: Failed to create mailbox: Service Unavailable
at TempMailService.createMailbox (E:\shichenwei\ai-register\src\email\temp-mail.ts:135:13)
```

## 解决方案

### 方案 1：使用固定邮箱测试（最快）

我已经创建了两个测试脚本：

**Windows:**
```bash
test-with-fixed-email.bat your-email@example.com
```

**Linux/Mac:**
```bash
./test-with-fixed-email.sh your-email@example.com
```

**特点：**
- 自动生成随机密码
- 开启有头模式（可以看到浏览器）
- 允许手动输入验证码
- 绕过临时邮箱服务

**使用步骤：**
1. 准备一个真实邮箱（Gmail、Outlook 等）
2. 运行脚本：`test-with-fixed-email.bat test@gmail.com`
3. 浏览器会自动打开并填写邮箱
4. 当需要验证码时，手动检查邮箱
5. 在浏览器中输入验证码
6. 回到终端按回车继续

### 方案 2：修复临时邮箱服务

需要联系服务管理员，在后端添加可用域名配置。

**服务端需要配置：**
```json
{
  "domains": [
    "temp-mail.example.com",
    "disposable.example.com"
  ]
}
```

### 方案 3：切换到 IMAP 真实邮箱

在配置中心切换邮件配置：

1. 打开配置中心：`npm run config:ui`
2. 访问：http://localhost:3200
3. 进入"邮箱"标签页
4. 点击"新建邮箱"
5. 选择"IMAP 模式"
6. 填写配置：
   ```
   名称：Gmail IMAP
   模式：IMAP
   IMAP 服务器：imap.gmail.com
   端口：993
   用户名：your-email@gmail.com
   密码：your-app-password
   ```
7. 保存并激活
8. 重新运行测试：`npm test`

**Gmail 应用专用密码获取：**
1. 访问：https://myaccount.google.com/apppasswords
2. 创建新的应用专用密码
3. 复制密码并填入配置

### 方案 4：使用其他临时邮箱 API

可选的公开服务：
- Mailinator
- Guerrilla Mail
- 10 Minute Mail

需要修改 `src/email/temp-mail.ts` 适配新的 API。

## 快速测试

### 使用固定邮箱（推荐）

```bash
# Windows
test-with-fixed-email.bat your-email@gmail.com

# Linux/Mac
./test-with-fixed-email.sh your-email@gmail.com
```

### 手动设置环境变量

```bash
# 设置邮箱和密码
export TARGET_EMAIL="your-email@gmail.com"
export TARGET_PASSWORD="YourPassword123!"

# 允许手动完成验证
export CONTINUE_AFTER_PROTECTED_CHALLENGE=true

# 开启有头模式（可以看到浏览器）
export HEADED=true

# 运行测试
npm test
```

## 相关文件

- 测试脚本（Windows）：[test-with-fixed-email.bat](../test-with-fixed-email.bat)
- 测试脚本（Linux/Mac）：[test-with-fixed-email.sh](../test-with-fixed-email.sh)
- 临时邮箱服务实现：[src/email/temp-mail.ts](../src/email/temp-mail.ts)
- 配置读取：[src/env.ts](../src/env.ts)
- 详细排查文档：[temp-mail-service-unavailable.md](./temp-mail-service-unavailable.md)

## 验证修复

运行测试脚本后，应该看到：
1. 浏览器自动打开
2. 自动填写邮箱地址
3. 等待验证码输入
4. 手动输入验证码后继续
5. 测试成功完成

## 下一步

选择一个方案并执行：
- **快速测试**：使用 `test-with-fixed-email.bat`
- **长期方案**：配置 IMAP 真实邮箱
- **修复服务**：联系临时邮箱服务管理员
