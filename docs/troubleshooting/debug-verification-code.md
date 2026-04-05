# 验证码获取调试指南

## 问题现象

页面到达验证码输入界面后卡住，需要排查：
1. 是否成功获取到验证码邮件
2. 是否成功提取验证码
3. 是否成功填写验证码
4. 后续流程是否继续执行

## 调试步骤

### 1. 查看控制台日志

运行测试时，查看详细的日志输出：

```bash
npm test
```

**关键日志标识：**

```
[TempMail] Created temporary email: xxx@xxx.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Mailbox ID: mb_xxx
[TempMail] Mailbox Address: xxx@xxx.com
[TempMail] Timeout: 180000ms
[TempMail] Poll Interval: 5000ms
[TempMail] Starting email polling...
[TempMail] Polling attempt 1 (elapsed: 0ms / 180000ms)
[TempMail] Fetching latest email via /api/latest...
```

### 2. 检查邮件获取

#### 成功获取邮件的日志：
```
[TempMail] ✓ Got latest email: from=no-reply@openai.com, subject=Your verification code
[TempMail] Checking email from: no-reply@openai.com, subject: Your verification code
[TempMail] No filter, accepting email
[TempMail] ✓ Found matching email!
[TempMail] ✓ Received email from: no-reply@openai.com
[TempMail] ✓ Subject: Your verification code
[TempMail] ✓ Text body preview: Your verification code is: 123456...
```

#### 未获取到邮件的日志：
```
[TempMail] No email found yet
[TempMail] Waiting 5000ms before next attempt... (175000ms remaining)
[TempMail] Polling attempt 2 (elapsed: 5000ms / 180000ms)
```

#### 超时的日志：
```
[TempMail] ✗ Timeout waiting for email after 180000ms (36 attempts)
Error: Timeout waiting for email after 180000ms in mailbox mb_xxx
```

### 3. 检查验证码提取

#### 成功提取的日志：
```
[TempMail] ✓ Extracted verification code: 123456
[Flow] Filling verification code: 123456
```

#### 提取失败的日志：
```
[TempMail] ✗ Failed to extract code from email
[TempMail] Email subject: Your verification code
[TempMail] Email text: ...
Error: Failed to extract verification code from email: Your verification code
```

### 4. 检查验证码填写

#### 成功填写的日志：
```
[Flow] Filling verification code: 123456
[Flow] ✓ Verification code filled
[Flow] Clicking verification code submit button
[Flow] ✓ Submit button clicked
[Flow] Waiting after verification code submission...
```

## 常见问题排查

### 问题 1: 邮件一直获取不到

**可能原因：**
1. 邮件发送延迟
2. API 连接问题
3. 邮箱地址错误

**排查方法：**

```bash
# 手动测试 API
BASE="http://114.215.173.42:888"
KEY="tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"

# 从日志中获取邮箱地址
EMAIL_ADDR="xxx@xxx.com"

# 查询最新邮件
curl -s "$BASE/api/latest?address=$EMAIL_ADDR" \
  -H "Authorization: Bearer $KEY" | python3 -m json.tool
```

**解决方案：**
- 增加超时时间：修改 `.env` 中的 `EMAIL_TIMEOUT_MS=300000`（5分钟）
- 减少轮询间隔：修改 `EMAIL_POLL_INTERVAL_MS=3000`（3秒）
- 检查网络连接

### 问题 2: 邮件获取到但提取不到验证码

**可能原因：**
1. 邮件格式不匹配
2. 验证码正则表达式不正确

**排查方法：**

查看日志中的邮件内容：
```
[TempMail] ✗ Failed to extract code from email
[TempMail] Email subject: Your verification code
[TempMail] Email text: ...
```

手动查看邮件内容：
```bash
# 获取邮箱 ID（从日志中）
MB_ID="mb_xxx"

# 获取邮件列表
curl -s "$BASE/api/mailboxes/$MB_ID/emails" \
  -H "Authorization: Bearer $KEY" | python3 -m json.tool

# 获取具体邮件
EMAIL_ID="email_xxx"
curl -s "$BASE/api/mailboxes/$MB_ID/emails/$EMAIL_ID" \
  -H "Authorization: Bearer $KEY" | python3 -m json.tool
```

**解决方案：**
- 检查邮件内容格式
- 调整 `extractVerificationCode` 方法中的正则表达式
- 添加自定义的验证码模式

### 问题 3: 验证码填写后没有反应

**可能原因：**
1. 选择器不正确
2. 按钮点击失败
3. 页面加载延迟

**排查方法：**

检查选择器是否匹配：
```typescript
// 在浏览器控制台测试
document.querySelector('input[name="code"]')
document.querySelector('button[type="submit"]')
```

**解决方案：**
- 更新 `target.profile.ts` 中的选择器
- 增加等待时间
- 检查是否有 iframe 或 shadow DOM

### 问题 4: 邮件过滤器过滤掉了邮件

**可能原因：**
1. `senderFilter` 或 `subjectFilter` 配置不正确
2. 邮件发件人或主题不匹配

**排查方法：**

查看日志：
```
[TempMail] Checking email from: no-reply@openai.com, subject: Your verification code
[TempMail] Sender filter "openai": true
[TempMail] ✓ Found matching email!
```

或者：
```
[TempMail] Checking email from: noreply@example.com, subject: Verify your email
[TempMail] Sender filter "openai": false
[TempMail] No emails passed the filter
```

**解决方案：**

修改 `target.profile.ts` 中的过滤器：
```typescript
emailVerification: {
  enabled: true,
  senderFilter: "openai",  // 修改为实际的发件人关键词
  subjectFilter: "verification"  // 或使用主题过滤
}
```

或者临时禁用过滤器（接受所有邮件）：
```typescript
emailVerification: {
  enabled: true,
  // 不设置 senderFilter 和 subjectFilter
}
```

## 调试技巧

### 1. 保留临时邮箱

```bash
KEEP_TEMP_MAILBOX=true npm test
```

测试结束后，邮箱不会被删除，可以手动查看：
```
[TempMail] Keeping temporary mailbox: xxx@xxx.com
[TempMail] Mailbox ID: mb_xxx
```

### 2. 手动测试邮件接收

```bash
#!/bin/bash
BASE="http://114.215.173.42:888"
KEY="tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"

# 创建邮箱
MB=$(curl -s -X POST $BASE/api/mailboxes \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{}')

MB_ID=$(echo $MB | python3 -c "import sys,json; print(json.load(sys.stdin)['mailbox']['id'])")
MB_ADDR=$(echo $MB | python3 -c "import sys,json; print(json.load(sys.stdin)['mailbox']['full_address'])")

echo "邮箱地址: $MB_ADDR"
echo "邮箱 ID: $MB_ID"
echo ""
echo "请向该邮箱发送测试邮件，然后按回车继续..."
read

# 查询邮件
echo "查询邮件..."
curl -s "$BASE/api/latest?address=$MB_ADDR" \
  -H "Authorization: Bearer $KEY" | python3 -m json.tool
```

### 3. 截图调试

在测试中添加截图：
```typescript
// 在验证码输入前截图
await activePage.screenshot({
  path: testInfo.outputPath("before-code-input.png"),
  fullPage: true
});

// 在验证码输入后截图
await activePage.screenshot({
  path: testInfo.outputPath("after-code-input.png"),
  fullPage: true
});
```

### 4. 增加等待时间

如果怀疑是时间问题，可以临时增加等待时间：
```typescript
// 在验证码输入后增加等待
await humanDelay(5000, 8000);  // 等待 5-8 秒
```

## 完整的调试日志示例

### 成功的流程：
```
[TempMail] Created temporary email: test123@example.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Mailbox ID: mb_abc123
[TempMail] Mailbox Address: test123@example.com
[TempMail] Starting email polling...
[TempMail] Polling attempt 1 (elapsed: 0ms / 180000ms)
[TempMail] Fetching latest email via /api/latest...
[TempMail] No email found yet
[TempMail] Waiting 5000ms before next attempt...
[TempMail] Polling attempt 2 (elapsed: 5000ms / 180000ms)
[TempMail] ✓ Got latest email: from=no-reply@openai.com, subject=Your verification code
[TempMail] New email found: email_xyz789
[TempMail] Applying filter to email from: no-reply@openai.com
[TempMail] No filter, accepting email
[TempMail] ✓ Found matching email!
[TempMail] ✓ Received email from: no-reply@openai.com
[TempMail] ✓ Subject: Your verification code
[TempMail] ✓ Extracted verification code: 123456
[Flow] Filling verification code: 123456
[Flow] ✓ Verification code filled
[Flow] Clicking verification code submit button
[Flow] ✓ Submit button clicked
[Flow] Waiting after verification code submission...
```

## 快速检查清单

- [ ] 临时邮箱是否创建成功？
- [ ] 邮箱地址是否正确填写到表单？
- [ ] 是否检测到验证码输入框？
- [ ] 是否开始轮询邮件？
- [ ] 是否收到验证码邮件？
- [ ] 是否成功提取验证码？
- [ ] 是否成功填写验证码？
- [ ] 是否点击了提交按钮？
- [ ] 后续流程是否继续？

## 联系支持

如果以上方法都无法解决问题，请提供：
1. 完整的控制台日志
2. 截图（如果有）
3. `.env` 配置（隐藏敏感信息）
4. 邮箱地址和邮箱 ID（从日志中获取）
