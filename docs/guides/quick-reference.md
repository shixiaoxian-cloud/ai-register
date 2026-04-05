# 🚀 快速参考

## 一键启动实时日志

```bash
npm run log:watch
```

就这么简单！

---

## 所有可用命令

### 实时日志
```bash
npm run log:watch          # 命令行实时日志（推荐）⭐
npm run log:server         # Web 版服务器
npm run log:viewer         # 打开 Web 界面
```

### 调试工具
```bash
npm run debug:tempmail     # 测试临时邮箱 API
npm run debug:api          # 验证 API 连接
npm run debug:test         # 运行调试测试
```

### 测试命令
```bash
npm test                   # 运行测试
npm run test:headed        # 有头模式
npm run test:ui            # UI 模式
```

---

## 问题排查流程

### 1. 验证 API
```bash
npm run debug:api
```
✅ 所有步骤显示 ✓ → API 正常

### 2. 测试邮件接收
```bash
npm run debug:tempmail
```
向显示的邮箱发送测试邮件

### 3. 运行完整测试
```bash
npm run log:watch
```
查看实时日志，找到卡住的位置

---

## 日志关键标识

### 成功流程
```
[TempMail] Created temporary email: xxx@xxx.com
[Flow] Email verification code input detected
[TempMail] Waiting for verification email...
[TempMail] Polling attempt 1...
[TempMail] ✓ Got latest email
[TempMail] ✓ Extracted verification code: 123456
[Flow] ✓ Verification code filled
[Flow] ✓ Submit button clicked
```

### 常见问题

#### 卡在轮询
```
[TempMail] Polling attempt 10...
[TempMail] Polling attempt 11...
```
→ 邮件未到达，检查邮件发送

#### 提取失败
```
[TempMail] ✗ Failed to extract code
```
→ 邮件格式不匹配，查看邮件内容

#### 超时
```
[TempMail] ✗ Timeout waiting for email
```
→ 增加超时时间或检查 API

---

## 环境变量配置

### .env 文件
```bash
# 临时邮箱
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90

# 超时设置
EMAIL_TIMEOUT_MS=180000      # 3分钟
EMAIL_POLL_INTERVAL_MS=5000  # 5秒

# 调试
KEEP_TEMP_MAILBOX=false      # 保留邮箱
```

---

## 文档索引

| 文档 | 用途 |
|------|------|
| [实时日志指南](realtime-log.md) | 实时日志完整指南 ⭐ |
| [调试就绪指南](../troubleshooting/debug-ready.md) | 调试快速开始 |
| [调试工具指南](debug-tools.md) | 所有调试工具 |
| [验证码自动化](../implementation/auto-verification-code.md) | 验证码自动化 |
| [自动化功能总结](../implementation/automation-summary.md) | 功能总结 |

---

## 获取帮助

### 提供信息
1. 完整的日志输出
2. 最后几条日志
3. .env 配置（隐藏密钥）
4. 错误截图

### 运行诊断
```bash
npm run debug:api && npm run debug:tempmail
```

---

**现在就开始：**
```bash
npm run log:watch
```
