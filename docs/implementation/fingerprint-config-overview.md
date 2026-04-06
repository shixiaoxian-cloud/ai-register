# 指纹配置功能 - 项目总览

## 📋 项目状态

**当前阶段：** 设计和工具完成 ✅  
**下一阶段：** 后端和前端实现  
**预计完整实现时间：** 6-10 天

---

## 🎯 功能概述

为项目添加独立的「指纹配置」资源类型，支持：

1. ✅ **从真实浏览器导出指纹** - 使用 HTML 工具一键收集
2. ✅ **从检测网站导入指纹** - 支持 bot.sannysoft.com 等
3. ✅ **使用内置指纹模板** - 3 套常见浏览器指纹开箱即用
4. ⏳ **前端界面管理** - 类似站点/方案/画像的管理方式
5. ⏳ **方案级别关联** - 不同测试方案使用不同指纹

---

## 📁 已创建的文件

### 1. 设计文档

| 文件 | 说明 | 状态 |
|------|------|------|
| [docs/implementation/fingerprint-config-design.md](docs/implementation/fingerprint-config-design.md) | 完整的系统设计方案 | ✅ 完成 |
| [docs/implementation/fingerprint-config-implementation.md](docs/implementation/fingerprint-config-implementation.md) | 实现总结和下一步计划 | ✅ 完成 |

### 2. 用户指南

| 文件 | 说明 | 状态 |
|------|------|------|
| [docs/guides/fingerprint-config-guide.md](docs/guides/fingerprint-config-guide.md) | 详细使用指南（10 章节） | ✅ 完成 |
| [docs/guides/fingerprint-config-quickstart.md](docs/guides/fingerprint-config-quickstart.md) | 5 分钟快速上手 | ✅ 完成 |

### 3. 指纹导出工具

| 文件 | 说明 | 状态 |
|------|------|------|
| [tools/fingerprint-exporter.html](tools/fingerprint-exporter.html) | 美观的 HTML 界面 | ✅ 完成 |
| [tools/fingerprint-collector.js](tools/fingerprint-collector.js) | JavaScript 收集器 | ✅ 完成 |

**功能特性：**
- 🎨 渐变色界面设计
- 📊 实时进度条显示
- 👁️ 指纹预览（关键字段）
- 📄 完整 JSON 输出
- 💾 下载 JSON 文件
- 📋 复制到剪贴板

**收集的指纹数据：**
- User Agent 和基础浏览器信息
- User Agent Data（高熵值）
- 硬件指纹（CPU、内存、触摸点）
- 屏幕指纹（分辨率、颜色深度）
- WebGL 指纹（Vendor、Renderer）
- 网络连接信息（RTT、下载速度）
- 电池 API
- 插件列表
- HTTP 头配置
- 时区和时区偏移

### 4. 内置指纹模板

| 文件 | 说明 | 状态 |
|------|------|------|
| [config/fingerprint-presets/chrome-131-win11.json](config/fingerprint-presets/chrome-131-win11.json) | Chrome 131 (Windows 11) | ✅ 完成 |
| [config/fingerprint-presets/chrome-130-macos.json](config/fingerprint-presets/chrome-130-macos.json) | Chrome 130 (macOS) | ✅ 完成 |
| [config/fingerprint-presets/edge-130-win11.json](config/fingerprint-presets/edge-130-win11.json) | Edge 130 (Windows 11) | ✅ 完成 |

---

## 🚀 快速开始

### 立即体验指纹导出工具

```bash
# 方式 1：直接在浏览器打开
open tools/fingerprint-exporter.html

# 方式 2：通过 HTTP 服务器
cd tools
python -m http.server 8080
# 访问 http://localhost:8080/fingerprint-exporter.html
```

### 查看内置模板

```bash
# 查看 Chrome 131 (Windows 11) 模板
cat config/fingerprint-presets/chrome-131-win11.json

# 查看所有模板
ls config/fingerprint-presets/
```

### 阅读文档

```bash
# 快速上手（5 分钟）
cat docs/guides/fingerprint-config-quickstart.md

# 完整指南（详细）
cat docs/guides/fingerprint-config-guide.md

# 设计方案（技术细节）
cat docs/implementation/fingerprint-config-design.md
```

---

## 📊 数据模型

### FingerprintConfig 核心字段

```typescript
interface FingerprintConfig {
  // 基础信息
  id: string;
  name: string;                    // 如 "Chrome 131 (Windows 11)"
  description: string;
  version: string;                 // 如 "131.0.6778.86"
  
  // 反检测配置
  stealthMode: boolean;            // 启用隐身模式
  telemetryMode: 'block' | 'modify' | 'log' | 'allow';
  
  // 浏览器指纹
  userAgent: string;
  platform: string;                // "Win32" | "MacIntel"
  vendor: string;                  // "Google Inc."
  languages: string[];             // ["en-US", "en"]
  
  // 硬件指纹
  hardwareConcurrency: number;     // CPU 核心数：4, 8, 12, 16
  deviceMemory: number;            // 内存大小：4, 8, 16 GB
  maxTouchPoints: number;          // 触摸点数：0（桌面）
  
  // 屏幕指纹
  screen: {
    width: number;                 // 1920, 2560, 3840
    height: number;                // 1080, 1440, 2160
    availWidth: number;
    availHeight: number;
    colorDepth: number;            // 24
    pixelDepth: number;            // 24
  };
  
  // WebGL 指纹
  webgl: {
    vendor: string;                // "Google Inc. (Intel)"
    renderer: string;              // "ANGLE (Intel, Intel(R) UHD Graphics 630 ...)"
  };
  
  // Canvas/Audio 噪声配置
  canvas: {
    noiseEnabled: boolean;
    noiseLevel: number;            // 0.001 = 0.1%
  };
  
  audio: {
    noiseEnabled: boolean;
    noiseLevel: number;            // 0.00005
  };
  
  // 时区和地理位置
  timezone: string;                // "America/Los_Angeles"
  timezoneOffset: number;          // -480 (UTC-8)
  geolocation?: {
    latitude: number;              // 34.0522
    longitude: number;             // -118.2437
    accuracy: number;              // 100
  };
  
  // 元数据
  source: 'manual' | 'browser-export' | 'detection-site' | 'preset';
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔧 实现计划

### Phase 1: 数据层（1-2 天）

**任务：**
- [ ] 创建 SQLite 表结构
- [ ] 实现 platform-store.mjs 中的 CRUD 方法
- [ ] 加载内置指纹模板

**SQL 表结构：**
```sql
CREATE TABLE fingerprint_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  config_json TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE plans ADD COLUMN fingerprint_config_id TEXT 
  REFERENCES fingerprint_configs(id);
```

### Phase 2: 后端 API（1-2 天）

**任务：**
- [ ] 在 config-server.mjs 中添加 API 路由
- [ ] 实现指纹配置的增删改查
- [ ] 实现模板加载功能
- [ ] 实现导入解析功能

**API 端点：**
```
GET    /api/platform/fingerprint-configs
POST   /api/platform/fingerprint-configs
DELETE /api/platform/fingerprint-configs/:id
GET    /api/platform/fingerprint-configs/presets
POST   /api/platform/fingerprint-configs/import
POST   /api/platform/fingerprint-configs/test
```

### Phase 3: 前端界面（2-3 天）

**任务：**
- [ ] 扩展 TypeScript 类型定义
- [ ] 实现前端 API 方法
- [ ] 在 ConfigCenterPage 添加「指纹配置」标签页
- [ ] 实现指纹配置列表和编辑器
- [ ] 实现导入对话框
- [ ] 实现模板选择器
- [ ] 在 Plan 编辑器中添加指纹配置关联

**界面结构：**
```
配置中心
├── 站点
├── 方案
├── 画像
├── 邮箱
└── 指纹配置 ← 新增
    ├── 指纹配置列表
    │   ├── [新建指纹配置]
    │   ├── [导入]
    │   └── [从模板创建]
    └── 指纹配置编辑器
        ├── 基础信息
        ├── 反检测配置
        ├── 浏览器指纹
        ├── 硬件指纹
        ├── Canvas/WebGL 噪声
        └── [保存配置] [测试指纹] [导出JSON]
```

### Phase 4: 测试引擎集成（1-2 天）

**任务：**
- [ ] 修改 src/env.ts 读取指纹配置
- [ ] 修改 src/stealth/*.ts 应用指纹配置
- [ ] 修改 playwright.config.ts 动态配置
- [ ] 端到端测试

**集成方式：**
```typescript
// src/env.ts
const fingerprintConfig = activePlatformContext.fingerprintConfig;

// src/stealth/advanced-stealth.ts
await page.addInitScript((config) => {
  Object.defineProperty(navigator, "userAgent", {
    get: () => config.userAgent
  });
  // ... 应用其他指纹配置
}, fingerprintConfig);
```

### Phase 5: 测试和文档（1 天）

**任务：**
- [ ] 单元测试（数据层）
- [ ] 集成测试（API 层）
- [ ] E2E 测试（完整流程）
- [ ] 更新 README.md
- [ ] 更新 CLAUDE.md

---

## 💡 使用场景

### 场景 1：测试不同浏览器版本

```
需求：验证站点在 Chrome 130 和 Chrome 131 上的表现

实现：
1. 创建两套指纹配置
   - Chrome 130 指纹
   - Chrome 131 指纹
2. 创建两个测试方案
   - 方案 A 关联 Chrome 130 指纹
   - 方案 B 关联 Chrome 131 指纹
3. 分别运行测试，对比结果
```

### 场景 2：降低检测率

```
需求：减少被识别为机器人的概率

实现：
1. 使用指纹导出工具收集真实浏览器指纹
2. 启用 Canvas/WebGL/Audio 噪声注入
3. 确保时区、语言、地理位置一致
4. 配合住宅代理 IP 使用
```

### 场景 3：指纹轮换

```
需求：每次测试使用不同的指纹，避免被追踪

实现：
1. 创建多个指纹配置（Chrome-A, Chrome-B, Chrome-C）
2. 在方案中启用「指纹轮换」
3. 每次运行随机选择一套指纹
```

---

## 🎓 学习资源

### 文档导航

**新手入门：**
1. [快速开始](docs/guides/fingerprint-config-quickstart.md) - 5 分钟上手
2. [使用指南](docs/guides/fingerprint-config-guide.md) - 完整教程

**开发者：**
1. [设计方案](docs/implementation/fingerprint-config-design.md) - 技术架构
2. [实现总结](docs/implementation/fingerprint-config-implementation.md) - 实现计划

**相关主题：**
1. [反检测策略](docs/analysis/anti-detection.md) - 反检测原理
2. [高级隐身技术](docs/analysis/advanced-stealth.md) - 完整特性对比

### 外部资源

**检测网站：**
- [bot.sannysoft.com](https://bot.sannysoft.com/) - 自动化特征检测
- [arh.antoinevastel.com](https://arh.antoinevastel.com/bots/areyouheadless) - Headless 检测
- [pixelscan.net](https://pixelscan.net/) - 完整指纹分析

**参考资料：**
- [Playwright Stealth Plugin](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Canvas Fingerprinting](https://browserleaks.com/canvas)
- [WebGL Fingerprinting](https://browserleaks.com/webgl)

---

## ⚠️ 注意事项

### 安全和合规

**仅用于：**
- ✅ 授权的安全测试
- ✅ 测试自己的应用
- ✅ 教育和研究目的
- ✅ 合法的自动化测试

**禁止用于：**
- ❌ 未经授权的系统访问
- ❌ 绕过付费墙或访问限制
- ❌ 大规模数据抓取
- ❌ 任何违反服务条款的行为

### 指纹一致性

**重要：** 确保指纹各部分一致

```
✅ 正确示例：
User Agent: Chrome 131 (Windows)
Platform: Win32
Timezone: America/Los_Angeles
IP: 美国洛杉矶

❌ 错误示例：
User Agent: Chrome 131 (Windows)
Platform: MacIntel  ← 不一致！
Timezone: Asia/Shanghai  ← 与 IP 不匹配！
IP: 美国洛杉矶
```

### 定期更新

浏览器版本更新快，建议：
- 每月检查一次内置模板
- 使用导出工具重新收集真实浏览器指纹
- 关注浏览器版本发布公告

---

## 📞 支持和反馈

### 遇到问题？

1. 查看 [故障排除](docs/guides/fingerprint-config-guide.md#七故障排除)
2. 检查 [常见问题](docs/guides/fingerprint-config-quickstart.md#七常见问题)
3. 查看浏览器控制台错误
4. 使用 `HEADED=true` 观察浏览器行为

### 贡献指纹模板

如果你收集了高质量的指纹配置，欢迎贡献：

1. 使用指纹导出工具收集
2. 验证指纹有效性（访问检测网站）
3. 提交到 `config/fingerprint-presets/`
4. 更新文档

---

## 📈 项目进度

```
[████████████████░░░░] 80% 完成

✅ 设计阶段（100%）
  ✅ 数据模型设计
  ✅ API 设计
  ✅ 界面设计
  ✅ 实现计划

✅ 工具开发（100%）
  ✅ 指纹导出工具
  ✅ 内置模板
  ✅ 使用文档

⏳ 后端实现（0%）
  ⏳ 数据库表结构
  ⏳ CRUD 方法
  ⏳ API 路由

⏳ 前端实现（0%）
  ⏳ 类型定义
  ⏳ API 方法
  ⏳ 界面组件

⏳ 集成测试（0%）
  ⏳ 测试引擎集成
  ⏳ E2E 测试
```

---

**项目启动时间：** 2026-04-06  
**当前状态：** 设计和工具完成  
**预计完成时间：** 2026-04-16（10 天后）  
**文档版本：** 1.0
