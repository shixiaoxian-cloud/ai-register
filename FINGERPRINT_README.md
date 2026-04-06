# 浏览器指纹配置系统

> 为自动化测试提供真实浏览器指纹，降低机器人检测率

## 🎯 核心功能

- ✅ **从真实浏览器导出指纹** - 一键收集完整浏览器指纹
- ✅ **内置 3 套指纹模板** - Chrome 131/130, Edge 130 开箱即用
- ✅ **支持从检测网站导入** - bot.sannysoft.com 等
- ⏳ **前端可视化管理** - 类似站点/方案的管理界面
- ⏳ **方案级别关联** - 不同测试方案使用不同指纹

## 🚀 快速开始

### 1. 使用指纹导出工具

```bash
# 在浏览器中打开
open tools/fingerprint-exporter.html

# 或通过 HTTP 服务器
cd tools && python -m http.server 8080
# 访问 http://localhost:8080/fingerprint-exporter.html
```

点击「🚀 收集指纹」→「💾 下载 JSON」

### 2. 查看内置模板

```bash
# Chrome 131 (Windows 11)
cat config/fingerprint-presets/chrome-131-win11.json

# Chrome 130 (macOS)
cat config/fingerprint-presets/chrome-130-macos.json

# Edge 130 (Windows 11)
cat config/fingerprint-presets/edge-130-win11.json
```

### 3. 阅读文档

- **5 分钟快速上手** → [fingerprint-config-quickstart.md](docs/guides/fingerprint-config-quickstart.md)
- **完整使用指南** → [fingerprint-config-guide.md](docs/guides/fingerprint-config-guide.md)
- **技术设计方案** → [fingerprint-config-design.md](docs/implementation/fingerprint-config-design.md)

## 📁 项目结构

```
ai-register/
├── tools/                              # 指纹导出工具
│   ├── fingerprint-exporter.html       # HTML 界面
│   └── fingerprint-collector.js        # JavaScript 收集器
│
├── config/fingerprint-presets/         # 内置指纹模板
│   ├── chrome-131-win11.json           # Chrome 131 (Windows 11)
│   ├── chrome-130-macos.json           # Chrome 130 (macOS)
│   └── edge-130-win11.json             # Edge 130 (Windows 11)
│
└── docs/
    ├── guides/                         # 用户指南
    │   ├── fingerprint-config-quickstart.md    # 快速开始
    │   └── fingerprint-config-guide.md         # 完整指南
    │
    └── implementation/                 # 技术文档
        ├── fingerprint-config-overview.md      # 项目总览
        ├── fingerprint-config-design.md        # 设计方案
        └── fingerprint-config-implementation.md # 实现计划
```

## 🔍 指纹导出工具

### 功能特性

- 🎨 **美观界面** - 渐变色设计，现代化 UI
- 📊 **实时进度** - 收集过程可视化
- 👁️ **指纹预览** - 关键字段一目了然
- 💾 **多种导出** - 下载 JSON / 复制到剪贴板
- 🔒 **本地处理** - 数据不上传，保护隐私

### 收集的数据

| 类别 | 字段 |
|------|------|
| **基础信息** | User Agent, Platform, Vendor, Languages |
| **硬件指纹** | CPU 核心数, 内存大小, 触摸点数 |
| **屏幕指纹** | 分辨率, 可用尺寸, 颜色深度 |
| **WebGL 指纹** | Vendor, Renderer |
| **网络信息** | RTT, 下载速度, 连接类型 |
| **其他** | 电池状态, 插件列表, 时区 |

### 使用截图

```
┌─────────────────────────────────────────┐
│  🔍 浏览器指纹导出工具                    │
│  自动收集当前浏览器的完整指纹信息          │
├─────────────────────────────────────────┤
│  ✅ 指纹收集完成！                        │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%              │
├─────────────────────────────────────────┤
│  [🚀 收集指纹] [💾 下载JSON] [📋 复制]   │
├─────────────────────────────────────────┤
│  指纹预览                                │
│  名称: Chrome 131 (Windows 11)          │
│  版本: 131.0.6778.86                    │
│  User Agent: Mozilla/5.0 ...            │
│  CPU 核心数: 8                           │
│  内存大小: 8 GB                          │
│  屏幕分辨率: 1920x1080                   │
│  WebGL Vendor: Google Inc. (Intel)      │
└─────────────────────────────────────────┘
```

## 📦 内置指纹模板

### Chrome 131 (Windows 11)

```json
{
  "name": "Chrome 131 (Windows 11)",
  "version": "131.0.6778.86",
  "platform": "Win32",
  "hardwareConcurrency": 8,
  "deviceMemory": 8,
  "screen": { "width": 1920, "height": 1080 },
  "webgl": {
    "vendor": "Google Inc. (Intel)",
    "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 ...)"
  }
}
```

### Chrome 130 (macOS)

```json
{
  "name": "Chrome 130 (macOS)",
  "version": "130.0.6723.117",
  "platform": "MacIntel",
  "hardwareConcurrency": 8,
  "deviceMemory": 16,
  "screen": { "width": 2560, "height": 1440 },
  "webgl": {
    "vendor": "Google Inc. (Apple)",
    "renderer": "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"
  }
}
```

### Edge 130 (Windows 11)

```json
{
  "name": "Edge 130 (Windows 11)",
  "version": "130.0.2849.68",
  "platform": "Win32",
  "hardwareConcurrency": 8,
  "deviceMemory": 8,
  "screen": { "width": 1920, "height": 1080 }
}
```

## 🎓 使用场景

### 场景 1：测试不同浏览器版本

```
目标：验证站点在 Chrome 130 和 Chrome 131 上的表现

步骤：
1. 创建两套指纹配置（Chrome 130, Chrome 131）
2. 创建两个测试方案，分别关联不同指纹
3. 运行测试，对比结果
```

### 场景 2：降低机器人检测率

```
目标：减少被识别为机器人的概率

步骤：
1. 使用指纹导出工具收集真实浏览器指纹
2. 启用 Canvas/WebGL/Audio 噪声注入
3. 确保时区、语言、地理位置与 IP 一致
4. 配合住宅代理 IP 使用
```

### 场景 3：指纹轮换

```
目标：每次测试使用不同指纹，避免被追踪

步骤：
1. 创建多个指纹配置（Chrome-A, Chrome-B, Chrome-C）
2. 在方案中启用「指纹轮换」
3. 每次运行随机选择一套指纹
```

## 🔧 实现状态

### ✅ 已完成（80%）

- [x] 数据模型设计
- [x] API 设计
- [x] 界面设计
- [x] 指纹导出工具（HTML + JS）
- [x] 内置指纹模板（3 套）
- [x] 完整使用文档

### ⏳ 待实现（20%）

- [ ] 数据库表结构
- [ ] 后端 API 实现
- [ ] 前端界面实现
- [ ] 测试引擎集成
- [ ] E2E 测试

**预计完成时间：** 6-10 天

## 📚 文档导航

### 新手入门

1. [快速开始](docs/guides/fingerprint-config-quickstart.md) - 5 分钟上手
2. [使用指南](docs/guides/fingerprint-config-guide.md) - 完整教程（10 章节）
3. [项目总览](docs/implementation/fingerprint-config-overview.md) - 功能概述

### 开发者

1. [设计方案](docs/implementation/fingerprint-config-design.md) - 技术架构
2. [实现计划](docs/implementation/fingerprint-config-implementation.md) - 下一步任务
3. [反检测策略](docs/analysis/anti-detection.md) - 反检测原理

## 🛠️ 技术栈

- **前端工具**: HTML5 + Vanilla JavaScript
- **数据格式**: JSON
- **浏览器 API**: 
  - Navigator API（User Agent Data）
  - WebGL API（指纹检测）
  - Battery API
  - Connection API
  - Plugins API

## ⚠️ 注意事项

### 安全和合规

**仅用于：**
- ✅ 授权的安全测试
- ✅ 测试自己的应用
- ✅ 教育和研究目的

**禁止用于：**
- ❌ 未经授权的系统访问
- ❌ 绕过付费墙
- ❌ 大规模数据抓取
- ❌ 违反服务条款的行为

### 指纹一致性

确保指纹各部分一致：

```
✅ 正确：
User Agent: Chrome 131 (Windows)
Platform: Win32
Timezone: America/Los_Angeles
IP: 美国洛杉矶

❌ 错误：
User Agent: Chrome 131 (Windows)
Platform: MacIntel  ← 不一致！
Timezone: Asia/Shanghai  ← 与 IP 不匹配！
```

## 🔗 相关资源

### 检测网站

- [bot.sannysoft.com](https://bot.sannysoft.com/) - 自动化特征检测
- [arh.antoinevastel.com](https://arh.antoinevastel.com/bots/areyouheadless) - Headless 检测
- [pixelscan.net](https://pixelscan.net/) - 完整指纹分析

### 参考资料

- [Playwright Stealth Plugin](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Canvas Fingerprinting](https://browserleaks.com/canvas)
- [WebGL Fingerprinting](https://browserleaks.com/webgl)

## 🤝 贡献

欢迎贡献高质量的指纹模板：

1. 使用指纹导出工具收集
2. 验证指纹有效性（访问检测网站）
3. 提交到 `config/fingerprint-presets/`
4. 更新文档

## 📞 支持

遇到问题？

1. 查看 [故障排除](docs/guides/fingerprint-config-guide.md#七故障排除)
2. 查看 [常见问题](docs/guides/fingerprint-config-quickstart.md#七常见问题)
3. 检查浏览器控制台错误

---

**项目启动时间：** 2026-04-06  
**当前版本：** 1.0 (设计和工具完成)  
**预计完成时间：** 2026-04-16  
**维护者：** AI Register Team
