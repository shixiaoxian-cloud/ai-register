# 指纹配置功能使用指南

## 概述

指纹配置功能允许你自定义浏览器指纹，用于反检测测试。支持三种方式获取指纹：

1. **从真实浏览器导出** - 使用指纹导出工具收集真实浏览器指纹
2. **从检测网站导入** - 从 bot.sannysoft.com 等网站导入检测结果
3. **使用内置模板** - 选择预设的常见浏览器指纹

## 一、使用指纹导出工具

### 1.1 打开导出工具

在浏览器中打开：
```
file:///path/to/ai-register/tools/fingerprint-exporter.html
```

或者通过 HTTP 服务器访问：
```bash
cd tools
python -m http.server 8080
# 然后访问 http://localhost:8080/fingerprint-exporter.html
```

### 1.2 收集指纹

1. 点击「🚀 收集指纹」按钮
2. 等待收集完成（约 2-3 秒）
3. 查看指纹预览和完整 JSON

### 1.3 导出指纹

**方式 1：下载 JSON 文件**
- 点击「💾 下载 JSON」
- 文件会保存为 `fingerprint-{id}.json`

**方式 2：复制到剪贴板**
- 点击「📋 复制到剪贴板」
- 直接粘贴到配置中心

### 1.4 导入到系统

1. 打开前端配置中心
2. 切换到「指纹配置」标签页
3. 点击「导入」按钮
4. 选择「从浏览器导出文件导入」
5. 上传 JSON 文件或粘贴 JSON 内容

## 二、从检测网站导入

### 2.1 访问检测网站

推荐使用以下网站：
- https://bot.sannysoft.com/
- https://arh.antoinevastel.com/bots/areyouheadless
- https://pixelscan.net/

### 2.2 复制检测结果

**方式 1：复制整个页面 HTML**
```
右键 → 查看页面源代码 → 全选复制
```

**方式 2：复制 JSON 结果**（如果网站提供）
```
打开开发者工具 → Console → 复制 JSON 对象
```

### 2.3 导入到系统

1. 打开配置中心 → 指纹配置
2. 点击「导入」
3. 选择「从检测网站导入」
4. 选择检测网站类型
5. 粘贴 HTML 或 JSON
6. 点击「导入」

系统会自动解析并转换为标准格式。

## 三、使用内置模板

### 3.1 查看可用模板

系统内置以下模板：
- **Chrome 131 (Windows 11)** - 最新 Chrome，Windows 11 平台
- **Chrome 130 (macOS)** - Chrome 130，macOS Sonoma 平台
- **Edge 130 (Windows 11)** - Microsoft Edge 130，Windows 11 平台

### 3.2 从模板创建

1. 打开配置中心 → 指纹配置
2. 点击「从模板创建」
3. 选择模板
4. 修改名称和描述（可选）
5. 点击「保存」

### 3.3 自定义模板

基于模板创建后，可以修改：
- 硬件参数（CPU 核心数、内存大小）
- 屏幕分辨率
- 时区和地理位置
- WebGL 渲染器
- Canvas/Audio 噪声级别

## 四、配置指纹参数

### 4.1 基础配置

```
名称: Chrome 131 自定义
版本: 131.0.6778.86
描述: 用于测试站点 A 的指纹配置
```

### 4.2 反检测配置

```
☑ 启用隐身模式
遥测模式: [阻止 ▼]
  - 阻止：完全阻止遥测请求
  - 修改：移除敏感字段
  - 记录：记录但不阻止
  - 允许：允许所有遥测
```

### 4.3 浏览器指纹

```
User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Platform: Win32
Vendor: Google Inc.
Languages: en-US, en
```

### 4.4 硬件指纹

```
CPU 核心数: 8
内存大小: 8 GB
触摸点数: 0
```

**建议值：**
- CPU 核心数：4, 8, 12, 16（常见值）
- 内存大小：4, 8, 16 GB
- 触摸点数：0（桌面设备）

### 4.5 屏幕指纹

```
宽度: 1920
高度: 1080
可用宽度: 1920
可用高度: 1040
颜色深度: 24
```

**常见分辨率：**
- 1920x1080（Full HD）
- 2560x1440（2K）
- 3840x2160（4K）
- 1440x900（MacBook）

### 4.6 WebGL 指纹

```
☑ 启用 WebGL 伪造
Vendor: Google Inc. (Intel)
Renderer: ANGLE (Intel, Intel(R) UHD Graphics 630 ...)
```

**常见配置：**
- Intel UHD Graphics 630（常见集显）
- NVIDIA GeForce GTX 1660（常见独显）
- Apple M1 Pro（Mac）

### 4.7 Canvas/Audio 噪声

```
☑ 启用 Canvas 噪声
噪声级别: 0.001 (0.1%)

☑ 启用 Audio 噪声
噪声级别: 0.00005
```

**说明：**
- 噪声级别越高，指纹越独特
- 推荐值：0.001（0.1%）
- 人眼无法察觉

### 4.8 时区和地理位置

```
时区: America/Los_Angeles
时区偏移: -480 (UTC-8)

地理位置:
  纬度: 34.0522
  经度: -118.2437
  精度: 100
```

**重要：** 确保时区与 IP 地址地理位置匹配！

## 五、关联到测试方案

### 5.1 在方案中选择指纹配置

1. 打开配置中心 → 方案
2. 选择或创建方案
3. 在「关联指纹配置」下拉框中选择
4. 保存方案

### 5.2 测试指纹有效性

1. 选择指纹配置
2. 点击「测试指纹」按钮
3. 系统会启动浏览器访问 bot.sannysoft.com
4. 查看检测结果截图

**检查项：**
- ✅ WebDriver: false
- ✅ Chrome: present
- ✅ Plugins: 3 detected
- ✅ Canvas: unique fingerprint

## 六、高级技巧

### 6.1 指纹轮换

为同一个方案配置多套指纹：
1. 创建多个指纹配置（如 Chrome-A, Chrome-B, Chrome-C）
2. 在方案中启用「指纹轮换」
3. 每次运行随机选择一套

### 6.2 指纹一致性检查

确保指纹各部分一致：
- User Agent 中的版本号 = uaData.fullVersionList 中的版本
- Platform = uaData.platform
- 时区 = 地理位置对应的时区
- 语言 = 地理位置对应的常用语言

### 6.3 避免常见错误

❌ **错误示例：**
```
User Agent: Chrome 131 (Windows)
Platform: MacIntel  ← 不一致！
```

✅ **正确示例：**
```
User Agent: Chrome 131 (Windows)
Platform: Win32
```

### 6.4 定期更新指纹

浏览器版本更新快，建议：
- 每月检查一次内置模板
- 使用导出工具重新收集真实浏览器指纹
- 关注浏览器版本发布公告

## 七、故障排除

### 7.1 指纹导出工具无法收集

**问题：** 点击「收集指纹」后无响应

**解决方案：**
1. 检查浏览器控制台是否有错误
2. 确保使用现代浏览器（Chrome 90+, Edge 90+）
3. 尝试在无痕模式下打开
4. 检查是否被浏览器扩展拦截

### 7.2 导入的指纹无法使用

**问题：** 导入后测试失败

**解决方案：**
1. 检查 JSON 格式是否正确
2. 验证必填字段是否完整
3. 确保版本号格式正确（如 131.0.6778.86）
4. 检查 uaData.brands 数组是否为空

### 7.3 指纹仍然被检测

**问题：** 使用指纹配置后仍被识别为机器人

**可能原因：**
1. IP 地址与指纹地理位置不匹配
2. 使用数据中心 IP（非住宅 IP）
3. 行为模式不自然（速度过快）
4. 指纹配置过时

**解决方案：**
1. 使用住宅代理
2. 确保时区/语言/地理位置一致
3. 增加人类行为延迟
4. 更新到最新浏览器版本的指纹

### 7.4 Canvas 指纹不生效

**问题：** Canvas 噪声未注入

**检查方法：**
```javascript
// 在浏览器控制台运行
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.fillRect(0, 0, 10, 10);
console.log(canvas.toDataURL());
// 多次运行，结果应该略有不同
```

**解决方案：**
1. 确保 canvas.noiseEnabled = true
2. 检查 noiseLevel 是否 > 0
3. 验证 advanced-stealth.ts 是否正确注入

## 八、最佳实践

### 8.1 指纹命名规范

```
[浏览器] [版本] ([平台]) - [用途]

示例：
- Chrome 131 (Windows 11) - 生产环境
- Edge 130 (Windows 11) - 测试环境
- Chrome 130 (macOS) - 开发调试
```

### 8.2 指纹分类管理

按用途分类：
- **生产指纹** - 用于正式测试
- **测试指纹** - 用于开发调试
- **备用指纹** - 轮换使用

### 8.3 指纹版本控制

```
描述字段记录变更：
v1.0 - 初始版本，从真实浏览器导出
v1.1 - 调整 Canvas 噪声级别为 0.001
v1.2 - 更新时区为 America/New_York
```

### 8.4 安全注意事项

⚠️ **不要在指纹配置中包含：**
- 真实的地理位置（使用通用城市坐标）
- 个人身份信息
- 真实的设备序列号

✅ **推荐做法：**
- 使用常见的硬件配置
- 使用公开的地理位置
- 定期轮换指纹

## 九、API 参考

### 9.1 指纹配置数据结构

完整的 TypeScript 类型定义见：
- [fingerprint-config-design.md](fingerprint-config-design.md)

### 9.2 前端 API

```typescript
// 获取所有指纹配置
const configs = await api.getFingerprintConfigs();

// 保存指纹配置
const saved = await api.saveFingerprintConfig(config);

// 测试指纹配置
const result = await api.testFingerprintConfig(configId);
```

### 9.3 后端 API

```
GET    /api/platform/fingerprint-configs
POST   /api/platform/fingerprint-configs
DELETE /api/platform/fingerprint-configs/:id
GET    /api/platform/fingerprint-configs/presets
POST   /api/platform/fingerprint-configs/import
POST   /api/platform/fingerprint-configs/test
```

## 十、相关文档

- [指纹配置系统设计方案](fingerprint-config-design.md)
- [反检测策略](../analysis/anti-detection.md)
- [高级隐身技术](../analysis/advanced-stealth.md)

---

**最后更新：** 2026-04-06  
**文档版本：** 1.0
