# 反检测配置说明

## 概述

本项目已集成反自动化检测功能，用于减少 Playwright 测试被目标站点识别为机器人的风险。

## 已实施的反检测措施

### 1. Playwright 配置层 (`playwright.config.ts`)

✅ **User Agent 覆盖**
- 使用真实的 Chrome 131 User Agent
- 避免使用未来版本号

✅ **启动参数**
- `--disable-blink-features=AutomationControlled` - 隐藏自动化控制特征
- `--disable-dev-shm-usage` - 优化共享内存使用
- `--no-sandbox` - 禁用沙箱（仅在必要时使用）

### 2. JavaScript 注入层 (`src/stealth/anti-detection.ts`)

✅ **navigator.webdriver 隐藏**
- 将 `navigator.webdriver` 设置为 `undefined`
- 这是最常见的自动化检测点

✅ **navigator.plugins 伪造**
- 添加真实的 Chrome 插件列表（PDF Viewer, Native Client 等）
- 使浏览器看起来像正常的 Chrome

✅ **navigator.languages 修改**
- 设置为 `["zh-CN", "zh", "en-US", "en"]`
- 与浏览器 locale 配置保持一致

✅ **chrome.runtime 覆盖**
- 删除 Chrome 扩展 API 检测点

✅ **Permissions API 修改**
- 修复自动化浏览器中的权限查询行为

✅ **Battery API 伪造**
- 添加电池状态 API（自动化浏览器通常缺失）

✅ **Connection API 修改**
- 设置真实的网络延迟值 (RTT: 50ms)

### 3. 遥测拦截层

提供 4 种模式处理 ChatGPT 的遥测请求：

#### `block` 模式（默认，推荐）
- 完全阻止发往 `/ces/v1/t` 的请求
- 防止发送任何指纹数据
- 最安全但可能被检测到缺少遥测

#### `modify` 模式
- 拦截请求并移除敏感字段：
  - `transferSizeBytes`
  - `encodedBodySizeBytes`
  - `decodedBodySizeBytes`
- 允许其他遥测数据通过
- 平衡安全性和隐蔽性

#### `log` 模式
- 记录所有遥测请求到控制台
- 不修改或阻止请求
- 用于调试和分析

#### `allow` 模式
- 允许所有遥测请求
- 不做任何拦截
- 用于测试基线行为

## 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# 启用反检测脚本（默认: true）
STEALTH_MODE=true

# 遥测处理模式（默认: block）
# 可选值: block | modify | log | allow
TELEMETRY_MODE=block
```

## 使用方法

### 基础使用

1. 复制 `.env.example` 到 `.env`
2. 配置 `STEALTH_MODE=true` 和 `TELEMETRY_MODE=block`
3. 运行测试：`npm test`

### 调试模式

如果需要查看遥测数据内容：

```bash
STEALTH_MODE=true
TELEMETRY_MODE=log
```

运行测试后，控制台会输出所有遥测请求的 JSON 内容。

### 测试不同配置

```bash
# 完全隐身模式
STEALTH_MODE=true
TELEMETRY_MODE=block

# 修改指纹模式
STEALTH_MODE=true
TELEMETRY_MODE=modify

# 无保护模式（用于对比）
STEALTH_MODE=false
TELEMETRY_MODE=allow
```

## 验证反检测效果

### 方法 1: 浏览器控制台检查

在测试运行时，打开浏览器控制台（需要 `HEADED=true`），运行：

```javascript
// 应该返回 undefined（而不是 true）
console.log(navigator.webdriver);

// 应该显示插件列表
console.log(navigator.plugins);

// 应该显示语言列表
console.log(navigator.languages);
```

### 方法 2: 使用检测网站

访问 https://bot.sannysoft.com/ 查看自动化特征检测结果。

### 方法 3: 观察 ChatGPT 行为

- 如果仍然频繁触发 CAPTCHA/设备验证，可能需要额外措施
- 检查是否使用了商业 IP（数据中心 IP）
- 考虑使用住宅代理

## 已知限制

### ⚠️ 无法解决的指纹

1. **IP 地理位置不匹配**
   - 如果 IP 在美国但浏览器语言是中文，仍会被标记
   - 解决方案：使用匹配地理位置的代理

2. **商业 IP 检测**
   - 数据中心/云服务器 IP 会被标记为 `is_business_ip2: true`
   - 解决方案：使用住宅代理服务（Bright Data, Oxylabs 等）

3. **行为模式检测**
   - 鼠标移动、键盘输入的时间模式可能暴露自动化
   - 解决方案：添加随机延迟和人类化操作

4. **Canvas/WebGL 指纹**
   - 当前未实施 Canvas 指纹伪造
   - 如果目标站点使用此技术，需要额外配置

## 性能影响

- 反检测脚本注入：< 10ms
- 遥测请求拦截：< 5ms per request
- 对整体测试时间影响：可忽略不计

## 安全性说明

这些反检测措施仅用于：
- ✅ 授权的安全测试
- ✅ 自有系统的自动化测试
- ✅ 教育和研究目的

**禁止用于：**
- ❌ 未经授权的系统访问
- ❌ 绕过付费墙或访问限制
- ❌ 大规模数据抓取
- ❌ 任何违反服务条款的行为

## 故障排除

### 问题：仍然被检测为机器人

1. 检查 `STEALTH_MODE` 是否启用
2. 验证 `navigator.webdriver` 是否为 `undefined`
3. 检查 IP 地理位置是否匹配浏览器语言
4. 尝试使用住宅代理
5. 添加随机延迟模拟人类行为

### 问题：测试失败或页面加载异常

1. 尝试 `TELEMETRY_MODE=allow` 查看是否是拦截导致
2. 检查控制台是否有 JavaScript 错误
3. 使用 `HEADED=true` 观察浏览器行为
4. 临时禁用 `STEALTH_MODE` 对比

### 问题：遥测请求未被拦截

1. 确认 `.env` 文件已正确加载
2. 检查 `runtimeConfig.telemetryMode` 的值
3. 查看测试日志确认拦截器已注册

## 参考资料

- [Playwright Stealth Plugin](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Bot Detection Techniques](https://bot.sannysoft.com/)
- [Canvas Fingerprinting](https://browserleaks.com/canvas)
- [WebRTC Leak Test](https://browserleaks.com/webrtc)

## 更新日志

### 2026-04-04
- ✅ 添加基础反检测配置
- ✅ 实现 navigator.webdriver 隐藏
- ✅ 添加遥测请求拦截（4 种模式）
- ✅ 更新 User Agent 到 Chrome 131
- ✅ 添加环境变量配置支持
