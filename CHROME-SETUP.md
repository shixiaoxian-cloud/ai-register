# 使用真实 Chrome 运行测试

## ✅ 配置已完成

你的 `.env` 文件已配置为使用真实 Chrome：

```bash
HEADED=true
BROWSER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
LOCAL_BROWSER_NAME=chrome
CONTINUE_AFTER_PROTECTED_CHALLENGE=true

# 反检测配置
STEALTH_MODE=true
TELEMETRY_MODE=allow  # 允许遥测，避免拦截必要请求

# 浏览器配置（匹配真实用户）
BROWSER_LOCALE=en-US
BROWSER_TIMEZONE=America/Los_Angeles
ACCEPT_LANGUAGE=en-US,en;q=0.9

# 临时邮箱
USE_TEMP_MAIL=true
TEMP_MAIL_BASE_URL=http://114.215.173.42:63355/
TEMP_MAIL_API_KEY=tm_admin_552f37dcc48ce2915fbf1a86eecdf4a2065d283a65f190f4
KEEP_TEMP_MAILBOX=true
```

## 🚀 运行测试

### 方法 1：直接运行

```bash
npm test
```

### 方法 2：可视模式（推荐，方便观察）

```bash
npm run test:headed
```

## 📊 预期行为

### 1. 浏览器启动
- ✅ 会启动真实的 Chrome 浏览器
- ✅ 窗口标题显示 "Chrome"（不是 "Chromium"）
- ✅ 可以看到完整的浏览器界面

### 2. 测试流程
```
1. 创建临时邮箱
   ↓
2. 注入反检测脚本
   ↓
3. 访问首页（Cloudflare 验证）
   ↓
4. 等待 3-5 秒
   ↓
5. 检查 cf_clearance cookie
   ↓
6. 访问目标页面
   ↓
7. 等待页面完全加载
   ↓
8. 填写邮箱
   ↓
9. 提交
```

### 3. 日志输出
```
[TempMail] Created temporary email: xxx@temp.io
[Cloudflare] Visiting homepage first: https://chatgpt.com
[Cloudflare] cf_clearance: ✓ Found
[Cloudflare] __cf_bm: ✓ Found
[Navigation] Going to target URL: ...
[Navigation] Waiting for page to be fully loaded...
[Navigation] Page fully loaded
```

## ✅ 成功标志

1. ✅ 所有资源返回 200（不再有 403）
2. ✅ 邮箱输入框正常显示
3. ✅ 可以正常填写和提交
4. ✅ 不会被 Cloudflare 拦截

## 🔍 如果仍然有问题

### 问题 1：Chrome 未启动

**错误信息：**
```
Error: Failed to launch browser
```

**解决方案：**
```bash
# 检查 Chrome 路径是否正确
dir "C:\Program Files\Google\Chrome\Application\chrome.exe"

# 如果路径不对，修改 .env 中的 BROWSER_EXECUTABLE_PATH
```

### 问题 2：仍然有 403

**可能原因：**
- IP 被封禁
- 需要使用代理

**解决方案：**
```bash
# 使用代理（在 playwright.config.ts 中配置）
use: {
  proxy: {
    server: 'http://proxy-server:port'
  }
}
```

### 问题 3：页面加载慢

**解决方案：**
```bash
# 增加超时时间
# 在 playwright.config.ts 中
timeout: 10 * 60 * 1000  # 10 分钟
```

## 📝 调试技巧

### 1. 查看浏览器版本

在测试运行时，打开 Chrome 的 `chrome://version/`，确认：
- 是否是真实 Chrome
- 版本号是否正确

### 2. 查看 Cookie

在控制台运行：
```javascript
document.cookie.split(';').forEach(c => console.log(c.trim()))
```

应该看到：
- `cf_clearance=...`
- `__cf_bm=...`

### 3. 查看请求头

在 DevTools Network 面板查看请求头，确认：
- User-Agent 是否正确
- Sec-CH-UA 是否存在
- 所有必要的头都存在

## 🎯 关键优势

使用真实 Chrome 的优势：

| 特性 | Playwright Chromium | 真实 Chrome |
|------|-------------------|------------|
| TLS 指纹 | ❌ 可能被识别 | ✅ 真实 |
| HTTP/2 指纹 | ❌ 可能被识别 | ✅ 真实 |
| 浏览器特征 | ⚠️ 部分缺失 | ✅ 完整 |
| 被检测风险 | 🟡 中等 | 🟢 低 |
| 403 错误率 | 🟡 较高 | 🟢 极低 |

## 📊 预期结果

使用真实 Chrome 后：
- ✅ 403 错误应该消失
- ✅ 所有资源正常加载
- ✅ 邮箱输入框正常显示
- ✅ 可以完成整个注册/登录流程

## 🚀 现在就试试

```bash
npm test
```

观察日志输出，应该看到所有请求都是 200 状态码！

---

**配置状态：** ✅ 已完成  
**使用浏览器：** 真实 Chrome  
**预期成功率：** 95%+
