# 指纹配置功能 - 快速开始

## 概述

本文档提供指纹配置功能的快速上手指南，帮助你在 5 分钟内开始使用。

## 一、立即体验（无需编码）

### 方式 1：使用指纹导出工具

**步骤：**

1. **打开导出工具**
   ```bash
   # 在浏览器中打开
   file:///你的路径/ai-register/tools/fingerprint-exporter.html
   ```

2. **收集指纹**
   - 点击「🚀 收集指纹」按钮
   - 等待 2-3 秒完成收集
   - 查看指纹预览

3. **导出指纹**
   - 点击「💾 下载 JSON」
   - 文件保存为 `fingerprint-{id}.json`

**收集到的数据示例：**
```json
{
  "name": "Chrome 131 (Windows 11)",
  "version": "131.0.6778.86",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...",
  "hardwareConcurrency": 8,
  "deviceMemory": 8,
  "screen": {
    "width": 1920,
    "height": 1080
  },
  "webgl": {
    "vendor": "Google Inc. (Intel)",
    "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 ...)"
  }
}
```

### 方式 2：使用内置模板

**可用模板：**

1. **Chrome 131 (Windows 11)** - `config/fingerprint-presets/chrome-131-win11.json`
2. **Chrome 130 (macOS)** - `config/fingerprint-presets/chrome-130-macos.json`
3. **Edge 130 (Windows 11)** - `config/fingerprint-presets/edge-130-win11.json`

**查看模板：**
```bash
cat config/fingerprint-presets/chrome-131-win11.json
```

## 二、核心概念

### 什么是浏览器指纹？

浏览器指纹是浏览器暴露的一组特征，包括：
- User Agent（浏览器标识）
- 硬件信息（CPU 核心数、内存大小）
- 屏幕分辨率
- WebGL 渲染器
- Canvas 指纹
- 时区和语言

### 为什么需要指纹配置？

**问题：** 自动化测试容易被检测为机器人

**原因：**
- `navigator.webdriver = true`
- 缺少真实浏览器的插件
- Canvas/WebGL 指纹过于一致
- 硬件参数不真实

**解决方案：** 使用指纹配置伪造真实浏览器特征

## 三、指纹配置结构

### 最小配置

```json
{
  "name": "我的指纹",
  "version": "131.0.6778.86",
  "stealthMode": true,
  "telemetryMode": "block",
  "userAgent": "Mozilla/5.0 ...",
  "platform": "Win32",
  "hardwareConcurrency": 8,
  "deviceMemory": 8
}
```

### 完整配置

完整配置包含 20+ 个字段，详见：
- [fingerprint-config-design.md](../implementation/fingerprint-config-design.md)

## 四、常见使用场景

### 场景 1：测试不同浏览器版本

```
目标：验证站点在 Chrome 130 和 Chrome 131 上的表现

方案：
1. 创建两套指纹配置
   - Chrome 130 指纹
   - Chrome 131 指纹
2. 创建两个测试方案
   - 方案 A 关联 Chrome 130 指纹
   - 方案 B 关联 Chrome 131 指纹
3. 分别运行测试
```

### 场景 2：模拟不同地理位置

```
目标：测试站点在美国和欧洲的行为差异

方案：
1. 创建两套指纹配置
   - 美国指纹（时区 America/Los_Angeles）
   - 欧洲指纹（时区 Europe/London）
2. 配合代理 IP 使用
3. 验证地理位置相关功能
```

### 场景 3：降低检测率

```
目标：减少被识别为机器人的概率

方案：
1. 使用指纹导出工具收集真实浏览器指纹
2. 启用 Canvas/WebGL/Audio 噪声注入
3. 确保时区、语言、地理位置一致
4. 使用住宅代理 IP
```

## 五、关键参数说明

### 1. stealthMode（隐身模式）

```json
"stealthMode": true
```

**作用：** 启用所有反检测措施
- 隐藏 `navigator.webdriver`
- 伪造 Chrome 对象
- 修复 Permissions API
- 添加 Battery API

**建议：** 始终设置为 `true`

### 2. telemetryMode（遥测模式）

```json
"telemetryMode": "block"
```

**可选值：**
- `block` - 完全阻止遥测请求（推荐）
- `modify` - 移除敏感字段
- `log` - 记录但不阻止（调试用）
- `allow` - 允许所有遥测

**建议：** 生产环境使用 `block`

### 3. hardwareConcurrency（CPU 核心数）

```json
"hardwareConcurrency": 8
```

**常见值：** 4, 8, 12, 16

**注意：** 不要设置过高（如 32），容易被识别为服务器

### 4. deviceMemory（内存大小）

```json
"deviceMemory": 8
```

**常见值：** 4, 8, 16 GB

**注意：** 与 CPU 核心数匹配（8 核通常配 8-16 GB）

### 5. canvas.noiseLevel（Canvas 噪声级别）

```json
"canvas": {
  "noiseEnabled": true,
  "noiseLevel": 0.001
}
```

**说明：**
- `0.001` = 0.1% 像素随机化
- 人眼无法察觉
- 使每次 Canvas 指纹略有不同

**建议：** 0.001 - 0.002

### 6. timezone（时区）

```json
"timezone": "America/Los_Angeles",
"timezoneOffset": -480
```

**重要：** 必须与 IP 地址地理位置匹配！

**常见时区：**
- `America/Los_Angeles` (UTC-8) - 洛杉矶
- `America/New_York` (UTC-5) - 纽约
- `Europe/London` (UTC+0) - 伦敦
- `Asia/Shanghai` (UTC+8) - 上海

## 六、快速测试

### 测试指纹是否生效

**方法 1：访问检测网站**

```bash
# 使用有头模式运行测试
HEADED=true npm test
```

在浏览器中手动访问：
- https://bot.sannysoft.com/
- https://arh.antoinevastel.com/bots/areyouheadless

**检查项：**
- ✅ WebDriver: false
- ✅ Chrome: present
- ✅ Plugins: 3 detected
- ✅ User Agent: 正确的版本

**方法 2：浏览器控制台检查**

```javascript
// 在测试运行时打开控制台
console.log(navigator.webdriver); // 应该是 undefined
console.log(navigator.hardwareConcurrency); // 应该是配置的值
console.log(navigator.deviceMemory); // 应该是配置的值
console.log(screen.width); // 应该是配置的值
```

## 七、常见问题

### Q1: 指纹导出工具无法打开？

**A:** 使用 HTTP 服务器打开：
```bash
cd tools
python -m http.server 8080
# 访问 http://localhost:8080/fingerprint-exporter.html
```

### Q2: 收集的指纹数据不完整？

**A:** 确保使用现代浏览器（Chrome 90+, Edge 90+）

### Q3: 指纹配置后仍被检测？

**A:** 检查以下几点：
1. IP 地址是否为住宅 IP（非数据中心 IP）
2. 时区是否与 IP 地理位置匹配
3. 是否启用了 stealthMode
4. 行为是否过于机械（增加延迟）

### Q4: Canvas 噪声如何验证？

**A:** 在控制台运行：
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.fillRect(0, 0, 10, 10);
console.log(canvas.toDataURL());
// 多次运行，结果应该略有不同
```

## 八、下一步

### 学习更多

- [完整使用指南](fingerprint-config-guide.md) - 详细的配置说明
- [设计文档](../implementation/fingerprint-config-design.md) - 技术实现细节
- [反检测策略](../analysis/anti-detection.md) - 反检测原理

### 实现后端和前端

当前已完成：
- ✅ 设计文档
- ✅ 指纹导出工具
- ✅ 内置模板
- ✅ 使用指南

待实现：
- ⏳ 数据库表结构
- ⏳ 后端 API
- ⏳ 前端界面
- ⏳ 测试引擎集成

预计工作量：6-10 天

### 贡献指纹模板

如果你收集了高质量的指纹配置，欢迎贡献：

1. 使用指纹导出工具收集
2. 验证指纹有效性
3. 提交到 `config/fingerprint-presets/`
4. 更新文档

## 九、资源链接

### 工具

- [指纹导出工具](../../tools/fingerprint-exporter.html) - 收集真实浏览器指纹
- [bot.sannysoft.com](https://bot.sannysoft.com/) - 检测自动化特征
- [pixelscan.net](https://pixelscan.net/) - 完整指纹分析

### 文档

- [指纹配置设计](../implementation/fingerprint-config-design.md)
- [指纹配置指南](fingerprint-config-guide.md)
- [实现总结](../implementation/fingerprint-config-implementation.md)

### 模板

- [Chrome 131 (Windows 11)](../../config/fingerprint-presets/chrome-131-win11.json)
- [Chrome 130 (macOS)](../../config/fingerprint-presets/chrome-130-macos.json)
- [Edge 130 (Windows 11)](../../config/fingerprint-presets/edge-130-win11.json)

---

**最后更新：** 2026-04-06  
**适用版本：** v1.0+  
**预计阅读时间：** 5 分钟
