# 临时邮箱自动化功能文档

## 功能概述

已成功集成临时邮箱服务，实现完全自动化的邮箱注册流程：
1. ✅ 自动创建临时邮箱
2. ✅ 自动填充邮箱地址
3. ✅ 自动接收验证邮件
4. ✅ 自动提取验证码
5. ✅ 自动填充验证码
6. ✅ 自动清理邮箱

## 配置方法

### 1. 环境变量配置 (.env)

```bash
# 启用临时邮箱服务
USE_TEMP_MAIL=true

# 临时邮箱 API 配置
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90

# 如果使用临时邮箱，不需要配置 TARGET_EMAIL
# TARGET_EMAIL=  # 留空

# 密码仍需配置（如果目标站点需要）
TARGET_PASSWORD=your_password_here

# 验证码提取规则（可选，默认 6 位数字）
EMAIL_CODE_REGEX=\b(\d{6})\b

# 邮件等待超时（默认 3 分钟）
EMAIL_TIMEOUT_MS=180000

# 邮件轮询间隔（默认 5 秒）
EMAIL_POLL_INTERVAL_MS=5000
```

### 2. 传统 IMAP 方式（可选）

如果不使用临时邮箱，设置：

```bash
USE_TEMP_MAIL=false
TARGET_EMAIL=your_email@example.com
IMAP_HOST=imap.example.com
IMAP_USER=your_email@example.com
IMAP_PASS=your_password
```

## 工作流程

### 自动化流程

```
1. 测试开始
   ↓
2. 创建临时邮箱 (例: abc123@temp-mail.io)
   ↓
3. 访问目标网站
   ↓
4. 自动填充临时邮箱地址
   ↓
5. 提交表单
   ↓
6. 等待验证邮件到达
   ↓
7. 自动提取验证码
   ↓
8. 自动填充验证码
   ↓
9. 完成注册/登录
   ↓
10. 自动删除临时邮箱
```

### 日志输出示例

```
[TempMail] Created temporary email: abc123@temp-mail.io
[TempMail] Waiting for verification email...
[TempMail] Received email from: noreply@openai.com
[TempMail] Subject: Your verification code
[TempMail] Extracted verification code: 123456
[TempMail] Deleted temporary mailbox: abc123@temp-mail.io
```

## API 接口说明

### TempMailService 类

#### 创建邮箱
```typescript
const mailbox = await tempMailService.createMailbox();
// 返回: { id: "...", full_address: "abc@temp.io", ... }
```

#### 等待邮件
```typescript
const email = await tempMailService.waitForEmail(mailboxId, {
  timeout: 180000,      // 3 分钟超时
  interval: 5000,       // 每 5 秒轮询
  filter: (email) => {  // 可选过滤器
    return email.from.includes("noreply@openai.com");
  }
});
```

#### 提取验证码
```typescript
const code = tempMailService.extractVerificationCode(email);
// 返回: "123456"
```

#### 删除邮箱
```typescript
await tempMailService.deleteMailbox(mailboxId);
```

#### 一键完成流程
```typescript
const { code, mailbox, email } = await tempMailService.getVerificationCode({
  timeout: 180000,
  codePattern: /\b(\d{6})\b/,
  emailFilter: (email) => email.from.includes("noreply"),
  keepMailbox: false  // 自动删除
});
```

## 文件结构

### 新增文件
```
src/email/temp-mail.ts          # 临时邮箱服务模块
```

### 修改文件
```
tests/protection-validation.spec.ts  # 集成临时邮箱
src/env.ts                           # 添加配置项
.env.example                         # 更新配置模板
package.json                         # 添加 node-fetch 依赖
```

## 使用示例

### 完全自动化测试

```bash
# 1. 配置 .env
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
TARGET_PASSWORD=test123456

# 2. 运行测试
npm test

# 3. 观察日志
# 会自动创建邮箱、填充、接收验证码、完成注册
```

### 手动测试临时邮箱 API

创建测试脚本 `test-temp-mail.ts`:

```typescript
import { createTempMailService } from "./src/email/temp-mail";

async function test() {
  const service = createTempMailService();

  // 创建邮箱
  const mailbox = await service.createMailbox();
  console.log("邮箱地址:", mailbox.full_address);

  // 等待邮件（需要手动发送测试邮件到该地址）
  console.log("请发送测试邮件到:", mailbox.full_address);

  const email = await service.waitForEmail(mailbox.id, {
    timeout: 60000
  });

  console.log("收到邮件:", email.subject);
  console.log("邮件内容:", email.text_body);

  // 提取验证码
  const code = service.extractVerificationCode(email);
  console.log("验证码:", code);

  // 删除邮箱
  await service.deleteMailbox(mailbox.id);
  console.log("邮箱已删除");
}

test();
```

## 邮件过滤配置

在 `src/target.profile.ts` 中配置邮件过滤规则：

```typescript
emailVerification: {
  enabled: true,
  senderFilter: "noreply@openai.com",  // 发件人过滤
  subjectFilter: "verification",        // 主题过滤
  codePattern: /\b(\d{6})\b/           // 验证码正则
}
```

## 错误处理

### 超时错误
```
Error: Timeout waiting for email after 180000ms in mailbox abc123
```
**解决方案：**
- 增加 `EMAIL_TIMEOUT_MS`
- 检查邮件过滤规则是否正确
- 确认目标站点是否真的发送了邮件

### API 错误
```
Error: Failed to create mailbox: 401 Unauthorized
```
**解决方案：**
- 检查 `TEMP_MAIL_API_KEY` 是否正确
- 检查 `TEMP_MAIL_BASE_URL` 是否可访问

### 验证码提取失败
```
Error: Failed to extract verification code from email
```
**解决方案：**
- 检查 `EMAIL_CODE_REGEX` 是否匹配邮件内容
- 查看邮件原文，调整正则表达式

## 优势对比

| 功能 | 传统 IMAP | 临时邮箱 API |
|------|----------|-------------|
| 自动创建邮箱 | ❌ | ✅ |
| 无需真实邮箱 | ❌ | ✅ |
| 并发测试 | ❌ 受限 | ✅ 无限 |
| 配置复杂度 | 🟡 中等 | 🟢 简单 |
| 响应速度 | 🟡 较慢 | 🟢 快速 |
| 邮箱清理 | ❌ 手动 | ✅ 自动 |
| 适用场景 | 长期账号 | 临时测试 |

## 安全注意事项

⚠️ **重要提醒：**

1. **API Key 保护**
   - 不要将 API Key 提交到公共仓库
   - 使用 `.env` 文件（已在 .gitignore 中）

2. **临时邮箱限制**
   - 仅用于测试目的
   - 不要用于重要账号注册
   - 邮箱会自动删除，无法恢复

3. **合规使用**
   - 仅用于授权测试
   - 遵守目标站点服务条款
   - 不要用于批量注册

## 故障排除

### 问题：邮件一直收不到

**检查清单：**
1. ✅ 确认 `USE_TEMP_MAIL=true`
2. ✅ 确认 API 地址和 Key 正确
3. ✅ 确认目标站点已发送邮件（查看页面提示）
4. ✅ 检查邮件过滤规则是否过于严格
5. ✅ 增加超时时间

### 问题：验证码提取失败

**调试步骤：**
1. 设置 `keepMailbox: true` 保留邮箱
2. 手动访问邮箱查看邮件内容
3. 调整 `EMAIL_CODE_REGEX` 正则表达式
4. 测试正则：
   ```typescript
   const pattern = /\b(\d{6})\b/;
   const text = "Your code is 123456";
   console.log(text.match(pattern)); // ["123456", "123456"]
   ```

## 下一步

1. ✅ 安装依赖：`npm install`
2. ✅ 配置 `.env` 文件
3. ✅ 运行测试：`npm test`
4. ✅ 观察日志输出
5. ✅ 根据需要调整配置

---

**功能状态：** ✅ 完全可用  
**自动化程度：** 100%  
**配置难度：** 简单  
**推荐使用：** 是
