# 临时邮箱配置 - 故障排除指南

## 问题：接口不存在 /api/tempmail/config

### 错误截图
```
接口不存在：/api/tempmail/config
```

### 原因分析

这个错误表示配置服务器还在运行旧版本的代码，没有加载新增的 API 接口。

### 解决方案

#### 方法 1：重启配置服务器（推荐）

1. **停止当前服务器**
   - 在运行 `npm run config:ui` 的终端按 `Ctrl+C`
   - 等待进程完全停止

2. **重新启动服务器**
   ```bash
   npm run config:ui
   ```

3. **刷新浏览器**
   - 按 `F5` 或 `Ctrl+R` 刷新页面
   - 或者重新访问 http://127.0.0.1:3200

4. **重新测试**
   - 填写临时邮箱配置
   - 点击"测试连接"

#### 方法 2：清除浏览器缓存

如果重启后仍然报错：

1. **清除缓存**
   - Chrome: `Ctrl+Shift+Delete` → 清除缓存
   - 或者使用无痕模式：`Ctrl+Shift+N`

2. **硬刷新**
   - `Ctrl+F5` 或 `Ctrl+Shift+R`

#### 方法 3：检查端口占用

如果服务器无法启动：

```bash
# Windows
netstat -ano | findstr :3200

# 如果端口被占用，杀掉进程
taskkill /PID <进程ID> /F

# 重新启动
npm run config:ui
```

## 验证修复

### 1. 检查服务器日志

启动后应该看到：
```
配置界面已启动: http://127.0.0.1:3200
请在浏览器中打开该地址，配置站点并直接发起测试。
```

### 2. 测试 API 接口

在浏览器控制台（F12）运行：

```javascript
// 测试配置接口
fetch('/api/tempmail/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseUrl: 'http://114.215.173.42:888',
    apiKey: 'tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**预期响应：**
```json
{
  "ok": true,
  "message": "临时邮箱配置已保存。"
}
```

### 3. 检查文件是否更新

确认以下文件包含新代码：

```bash
# 检查是否有 tempmail 相关代码
grep -n "tempmail" scripts/config-server.mjs

# 应该看到多行匹配结果
```

## 常见问题

### Q1: 重启后还是报错？

**检查清单：**
- [ ] 确认终端中的服务器已完全停止
- [ ] 确认没有其他进程占用 3200 端口
- [ ] 确认 `scripts/config-server.mjs` 文件已保存
- [ ] 尝试清除浏览器缓存

### Q2: 服务器启动失败？

**可能原因：**
1. 端口被占用
2. Node.js 版本过低
3. 依赖未安装

**解决方案：**
```bash
# 1. 检查 Node.js 版本（需要 >= 14）
node --version

# 2. 重新安装依赖
npm install

# 3. 使用其他端口
CONFIG_UI_PORT=3201 npm run config:ui
```

### Q3: 测试连接时报错？

**错误：** `连接失败: API 返回错误: 401 Unauthorized`

**解决方案：**
- 检查 API Key 是否正确
- 确认 API 地址可访问
- 尝试在浏览器直接访问 API 地址

**测试 API 可用性：**
```bash
curl http://114.215.173.42:888/api/mailboxes \
  -X POST \
  -H "Authorization: Bearer tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 完整重启流程

如果遇到任何问题，按以下步骤完整重启：

```bash
# 1. 停止所有相关进程
# 按 Ctrl+C 停止配置服务器

# 2. 检查端口
netstat -ano | findstr :3200

# 3. 如果有占用，杀掉进程
taskkill /PID <进程ID> /F

# 4. 清理缓存（可选）
npm cache clean --force

# 5. 重新启动
npm run config:ui

# 6. 在浏览器中硬刷新
# Ctrl+Shift+R 或 Ctrl+F5
```

## 调试技巧

### 1. 查看服务器日志

服务器会输出所有请求：
```
GET / 200
GET /api/config 200
POST /api/tempmail/config 200
```

如果看到 `404`，说明接口不存在。

### 2. 使用浏览器开发者工具

1. 打开 DevTools（F12）
2. 切换到 Network 标签
3. 点击"保存临时邮箱配置"
4. 查看请求详情：
   - Request URL
   - Status Code
   - Response

### 3. 检查代码是否生效

在 `scripts/config-server.mjs` 中添加日志：

```javascript
if (method === "POST" && requestUrl.pathname === "/api/tempmail/config") {
  console.log("收到临时邮箱配置请求"); // 添加这行
  try {
    // ...
  }
}
```

重启后，点击保存应该看到日志输出。

## 成功标志

配置成功后，你应该看到：

1. **前端提示**
   ```
   ✓ 临时邮箱配置已保存，测试时会自动创建临时邮箱。
   ```

2. **文件创建**
   ```
   config/temp-mail.json  # 新建
   .env                   # 更新
   ```

3. **环境变量**
   ```bash
   USE_TEMP_MAIL=true
   TEMP_MAIL_BASE_URL=http://114.215.173.42:888
   TEMP_MAIL_API_KEY=tm_admin_...
   ```

## 需要帮助？

如果以上方法都无法解决问题：

1. 检查 Node.js 版本：`node --version`（需要 >= 14）
2. 检查依赖安装：`npm list node-fetch`
3. 查看完整错误日志
4. 提供以下信息：
   - 操作系统版本
   - Node.js 版本
   - 错误截图
   - 服务器日志

---

**最常见原因：** 服务器未重启  
**最快解决方案：** Ctrl+C 停止，重新运行 `npm run config:ui`
