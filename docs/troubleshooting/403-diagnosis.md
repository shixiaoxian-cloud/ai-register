# 403 错误诊断 - 资源被拦截

## 问题现象

页面主体加载成功（200），但是很多资源返回 403：
- `finalize` - 403
- `p` - 403
- `t` (多个) - 403
- `favicon.ico` - 403
- `countries` - 403
- `challenge` - 403

## 原因分析

### 1. Cloudflare 部分拦截
- 主页面通过验证（200）
- 但后续的 API 请求被拦截（403）
- 可能是因为请求头不一致

### 2. CORS 问题
- 某些资源可能有跨域限制
- 自动化浏览器的请求头可能触发 CORS 拦截

### 3. 速率限制
- 请求过快触发限流
- 需要增加延迟

## 已实施的修复

### 1. ✅ 移除激进的浏览器参数
移除了可能导致问题的参数：
- `--disable-web-security`
- `--disable-features=IsolateOrigins,site-per-process`
- `--allow-running-insecure-content`
- `--disable-extensions`
- `--disable-sync`

### 2. ✅ 条件性 Cloudflare 绕过
只对 ChatGPT/OpenAI 域名启用 Cloudflare 绕过，其他站点直接访问。

### 3. ✅ 增加等待时间
- 页面加载后等待 `networkidle`
- 额外延迟 2-3 秒确保 JS 执行完成

## 测试步骤

### 1. 重新运行测试

```bash
npm test
```

### 2. 观察日志

应该看到：
```
[Cloudflare] Visiting homepage first: https://chatgpt.com
[Cloudflare] cf_clearance: ✓ Found
[Navigation] Going to target URL: ...
[Navigation] Waiting for page to be fully loaded...
[Navigation] Page fully loaded
```

### 3. 检查 Network 面板

在可视模式下（`npm run test:headed`）：
1. 打开 DevTools (F12)
2. 切换到 Network 标签
3. 观察哪些资源返回 403

## 如果仍然有 403

### 方案 1：使用真实 Chrome（强烈推荐）

在 `.env` 中：
```bash
LOCAL_BROWSER_NAME=chrome
```

**为什么有效：**
- 真实 Chrome 的 TLS 指纹
- 真实的 HTTP/2 指纹
- 完整的浏览器特征

### 方案 2：忽略非关键资源的 403

如果只是 `favicon.ico`、`countries` 等非关键资源 403，可以忽略：

```typescript
// 在测试中添加
page.on('response', response => {
  if (response.status() === 403) {
    const url = response.url();
    const isNonCritical = url.includes('favicon') || 
                          url.includes('countries') ||
                          url.match(/\/t$/); // 遥测请求
    
    if (!isNonCritical) {
      console.log(`[403] Critical resource blocked: ${url}`);
    }
  }
});
```

### 方案 3：禁用遥测拦截

如果 `TELEMETRY_MODE=block` 导致问题，尝试：

```bash
# .env
TELEMETRY_MODE=allow
```

### 方案 4：增加更多延迟

```typescript
// 在页面加载后
await humanDelay(5000, 8000); // 5-8 秒
```

## 判断是否影响功能

### 关键问题：邮箱输入框是否出现？

**如果出现：**
- ✅ 403 不影响核心功能
- ✅ 可以继续测试
- 只是一些非关键资源被拦截

**如果不出现：**
- ❌ 403 影响了页面渲染
- ❌ 需要进一步修复
- 可能是关键 JS 文件被拦截

## 调试命令

### 1. 查看所有 403 资源

```typescript
const blocked403 = [];
page.on('response', response => {
  if (response.status() === 403) {
    blocked403.push(response.url());
  }
});

// 测试结束后
console.log('Blocked resources:', blocked403);
```

### 2. 对比正常浏览器

在正常浏览器中：
1. 打开 DevTools
2. 访问同样的页面
3. 查看 Network 面板
4. 对比哪些资源在正常浏览器中是 200

### 3. 检查关键资源

```typescript
// 检查邮箱输入框的 JS 是否加载
const scripts = await page.evaluate(() => {
  return Array.from(document.scripts).map(s => s.src);
});
console.log('Loaded scripts:', scripts);
```

## 最可能的解决方案

根据你的截图，最可能的问题是：

1. **使用真实 Chrome** - 90% 的情况下能解决
2. **增加延迟** - 让页面有足够时间加载
3. **检查是否是非关键资源** - 如果邮箱框能出现，就忽略这些 403

## 下一步

1. 确认 `.env` 中设置了 `LOCAL_BROWSER_NAME=chrome`
2. 重新运行测试
3. 观察邮箱输入框是否出现
4. 如果出现，忽略非关键资源的 403
5. 如果不出现，提供更多日志信息

---

**关键指标：** 邮箱输入框是否正常显示  
**如果显示：** 403 不是问题  
**如果不显示：** 需要使用真实 Chrome
