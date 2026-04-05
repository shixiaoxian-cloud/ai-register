# 快速使用指南：保留临时邮箱

## 问题
邮箱生成后，在 tempmail 后台看不到，因为测试结束后会**自动删除**。

## 解决方案（已实现）

### 步骤 1：修改 .env 文件

在你的 `.env` 文件中添加或修改：

```bash
# 保留临时邮箱（不删除）
KEEP_TEMP_MAILBOX=true
```

### 步骤 2：运行测试

```bash
npm test
```

### 步骤 3：查看日志

测试结束后，你会看到类似的日志：

```
[TempMail] Created temporary email: abc123xyz@temp-mail.io
[TempMail] Mailbox ID: 12345678-1234-1234-1234-123456789abc
...
[TempMail] Keeping temporary mailbox: abc123xyz@temp-mail.io
[TempMail] Mailbox ID: 12345678-1234-1234-1234-123456789abc
```

### 步骤 4：在 tempmail 后台查看

使用日志中的邮箱地址和 ID，通过 API 或 Web 界面查看邮件。

## 配置说明

| 配置值 | 效果 |
|--------|------|
| `KEEP_TEMP_MAILBOX=true` | 保留邮箱，不删除 |
| `KEEP_TEMP_MAILBOX=false` | 测试结束后自动删除（默认） |
| 不设置 | 默认自动删除 |

## 使用建议

- **调试时：** 设置为 `true`，方便查看邮件
- **自动化测试：** 设置为 `false`，避免邮箱堆积
- **记得清理：** 保留的邮箱会占用资源，定期手动清理

## 完整配置示例

```bash
# .env 文件
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:888
TEMP_MAIL_API_KEY=tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90
KEEP_TEMP_MAILBOX=true  # 添加这一行

TARGET_PASSWORD=your_password_here
```

---

**状态：** ✅ 已实现并可用
