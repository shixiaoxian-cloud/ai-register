# 指纹配置系统设计方案

## 概述

为项目添加独立的「指纹配置」资源类型，支持从真实浏览器导出、从检测网站导入、以及使用内置模板。

## 一、数据模型

### 1.1 FingerprintConfig 资源类型

```typescript
interface FingerprintConfig {
  id?: string;
  name: string;
  description: string;
  version: string; // 如 "Chrome 131.0.6778.86"
  
  // 基础配置
  stealthMode: boolean;
  telemetryMode: 'block' | 'modify' | 'log' | 'allow';
  
  // 浏览器指纹
  userAgent: string;
  platform: string;
  vendor: string;
  language: string;
  languages: string[];
  
  // User Agent Data (高熵值)
  uaData: {
    brands: Array<{ brand: string; version: string }>;
    mobile: boolean;
    platform: string;
    architecture: string;
    bitness: string;
    model: string;
    platformVersion: string;
    fullVersionList: Array<{ brand: string; version: string }>;
  };
  
  // 硬件指纹
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  
  // 屏幕指纹
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
  };
  
  // WebGL 指纹
  webgl: {
    vendor: string;
    renderer: string;
  };
  
  // Canvas 指纹配置
  canvas: {
    noiseEnabled: boolean;
    noiseLevel: number; // 0.001 = 0.1%
  };
  
  // Audio 指纹配置
  audio: {
    noiseEnabled: boolean;
    noiseLevel: number;
  };
  
  // 时区和地理位置
  timezone: string;
  timezoneOffset: number;
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  
  // 网络指纹
  connection?: {
    effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
    rtt: number;
    downlink: number;
  };
  
  // 电池 API
  battery?: {
    charging: boolean;
    level: number;
    chargingTime: number;
    dischargingTime: number;
  };
  
  // Plugins
  plugins: Array<{
    name: string;
    description: string;
    filename: string;
    mimeTypes: Array<{
      type: string;
      suffixes: string;
      description: string;
    }>;
  }>;
  
  // HTTP 头配置
  headers: {
    'Accept': string;
    'Accept-Encoding': string;
    'Accept-Language': string;
    'Sec-CH-UA': string;
    'Sec-CH-UA-Mobile': string;
    'Sec-CH-UA-Platform': string;
    'Sec-Fetch-Dest': string;
    'Sec-Fetch-Mode': string;
    'Sec-Fetch-Site': string;
    'Sec-Fetch-User': string;
  };
  
  // 元数据
  source: 'manual' | 'browser-export' | 'detection-site' | 'preset';
  sourceUrl?: string; // 如果从检测网站导入
  createdAt?: string;
  updatedAt?: string;
}
```

### 1.2 Plan 资源扩展

```typescript
interface PlanResource {
  // ... 现有字段
  fingerprintConfigId: string; // 新增：关联指纹配置
}
```

## 二、功能模块

### 2.1 指纹配置管理页面

在配置中心添加第 5 个标签页：**指纹配置**

**功能：**
- 列表展示所有指纹配置
- 创建/编辑/删除指纹配置
- 预览指纹详情
- 测试指纹有效性

### 2.2 指纹导出工具（浏览器扩展/书签工具）

**方案 A：从真实浏览器导出**

创建一个 HTML 页面 + JavaScript 工具：

```html
<!-- fingerprint-exporter.html -->
<!DOCTYPE html>
<html>
<head>
  <title>指纹导出工具</title>
</head>
<body>
  <h1>浏览器指纹导出工具</h1>
  <button onclick="collectFingerprint()">收集指纹</button>
  <button onclick="downloadJSON()">下载 JSON</button>
  <pre id="output"></pre>
  
  <script src="fingerprint-collector.js"></script>
</body>
</html>
```

**核心功能：**
- 自动检测所有 navigator 属性
- 收集 Canvas/WebGL/Audio 指纹
- 检测 HTTP 头（通过发送测试请求）
- 生成标准 JSON 格式

### 2.3 指纹导入功能

**方案 B：从检测网站导入**

支持从以下网站导入：
- bot.sannysoft.com
- arh.antoinevastel.com/bots/areyouheadless
- pixelscan.net

**实现方式：**
1. 用户访问检测网站
2. 复制页面 HTML 或 JSON 结果
3. 粘贴到前端导入框
4. 系统解析并转换为 FingerprintConfig

### 2.4 内置指纹模板

**方案 C：预设模板**

内置常见浏览器指纹：
- Chrome 131 (Windows 11)
- Chrome 130 (macOS)
- Edge 130 (Windows 11)
- Firefox 120 (Windows 11)
- Safari 17 (macOS)

**模板存储位置：**
```
config/fingerprint-presets/
  ├── chrome-131-win11.json
  ├── chrome-130-macos.json
  ├── edge-130-win11.json
  ├── firefox-120-win11.json
  └── safari-17-macos.json
```

## 三、数据库设计

### 3.1 SQLite 表结构

```sql
CREATE TABLE fingerprint_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  config_json TEXT NOT NULL, -- 完整的 FingerprintConfig JSON
  source TEXT NOT NULL, -- 'manual' | 'browser-export' | 'detection-site' | 'preset'
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 为 plans 表添加外键
ALTER TABLE plans ADD COLUMN fingerprint_config_id TEXT REFERENCES fingerprint_configs(id);
```

## 四、API 设计

### 4.1 后端 API

```typescript
// GET /api/platform/fingerprint-configs
// 获取所有指纹配置列表

// GET /api/platform/fingerprint-configs/:id
// 获取单个指纹配置详情

// POST /api/platform/fingerprint-configs
// 创建或更新指纹配置
// Body: FingerprintConfig

// DELETE /api/platform/fingerprint-configs/:id
// 删除指纹配置

// GET /api/platform/fingerprint-configs/presets
// 获取所有内置模板

// POST /api/platform/fingerprint-configs/import
// 从检测网站导入
// Body: { source: 'bot.sannysoft.com', html: '...' }

// POST /api/platform/fingerprint-configs/test
// 测试指纹配置有效性
// Body: { fingerprintConfigId: string }
```

### 4.2 前端 API

```typescript
// frontend/src/lib/api.ts
export const api = {
  // ... 现有方法
  
  // 指纹配置相关
  async getFingerprintConfigs(): Promise<FingerprintConfig[]>,
  async getFingerprintConfig(id: string): Promise<FingerprintConfig>,
  async saveFingerprintConfig(config: FingerprintConfig): Promise<FingerprintConfig>,
  async deleteFingerprintConfig(id: string): Promise<void>,
  async getFingerprintPresets(): Promise<FingerprintConfig[]>,
  async importFingerprintFromSite(source: string, html: string): Promise<FingerprintConfig>,
  async testFingerprintConfig(id: string): Promise<{ success: boolean; message: string }>,
};
```

## 五、前端界面设计

### 5.1 配置中心 - 指纹配置标签页

**左侧：指纹配置列表**
```
┌─────────────────────────────────┐
│ 指纹配置列表                      │
│ [新建指纹配置] [导入] [从模板创建] │
├─────────────────────────────────┤
│ ● Chrome 131 (Windows 11)       │
│   来源：内置模板                  │
│   2 个方案使用                    │
├─────────────────────────────────┤
│   Edge 130 (Windows 11)         │
│   来源：浏览器导出                │
│   1 个方案使用                    │
├─────────────────────────────────┤
│   自定义指纹 A                    │
│   来源：手动创建                  │
│   0 个方案使用                    │
└─────────────────────────────────┘
```

**右侧：指纹配置编辑器**
```
┌─────────────────────────────────┐
│ 指纹配置编辑器                    │
├─────────────────────────────────┤
│ 基础信息                          │
│ 名称: [Chrome 131 (Windows 11)] │
│ 版本: [131.0.6778.86]           │
│ 描述: [标准 Chrome 131 指纹]     │
├─────────────────────────────────┤
│ 反检测配置                        │
│ ☑ 启用隐身模式                    │
│ 遥测模式: [阻止 ▼]               │
├─────────────────────────────────┤
│ 浏览器指纹                        │
│ User Agent: [Mozilla/5.0...]    │
│ Platform: [Win32]               │
│ Vendor: [Google Inc.]           │
│ Languages: [en-US, en]          │
├─────────────────────────────────┤
│ 硬件指纹                          │
│ CPU 核心数: [8]                  │
│ 内存大小: [8 GB]                 │
│ 触摸点数: [0]                    │
├─────────────────────────────────┤
│ Canvas/WebGL 噪声                │
│ ☑ 启用 Canvas 噪声               │
│ 噪声级别: [0.001] (0.1%)        │
│ ☑ 启用 WebGL 伪造                │
│ Vendor: [Intel Inc.]            │
│ Renderer: [Intel Iris OpenGL]  │
├─────────────────────────────────┤
│ [保存配置] [测试指纹] [导出JSON]  │
└─────────────────────────────────┘
```

### 5.2 指纹导入对话框

```
┌─────────────────────────────────┐
│ 导入指纹配置                      │
├─────────────────────────────────┤
│ 选择导入方式：                    │
│ ○ 从浏览器导出文件导入            │
│   [选择文件...]                   │
│                                  │
│ ○ 从检测网站导入                  │
│   检测网站: [bot.sannysoft.com ▼]│
│   粘贴 HTML 或 JSON:             │
│   [                            ] │
│   [                            ] │
│                                  │
│ ○ 从内置模板创建                  │
│   [Chrome 131 Win11 ▼]          │
│                                  │
│ [取消] [导入]                     │
└─────────────────────────────────┘
```

## 六、实现步骤

### Phase 1: 数据层（1-2 天）
1. ✅ 定义 TypeScript 类型
2. ✅ 创建 SQLite 表结构
3. ✅ 实现 platform-store.mjs 中的 CRUD 方法
4. ✅ 准备 5 套内置指纹模板

### Phase 2: 后端 API（1-2 天）
1. ✅ 实现 config-server.mjs 中的 API 路由
2. ✅ 实现指纹配置的增删改查
3. ✅ 实现模板加载功能
4. ✅ 实现导入解析功能

### Phase 3: 指纹收集工具（1 天）
1. ✅ 创建 fingerprint-exporter.html
2. ✅ 实现 fingerprint-collector.js
3. ✅ 测试在真实浏览器中收集指纹
4. ✅ 生成标准 JSON 格式

### Phase 4: 前端界面（2-3 天）
1. ✅ 在 ConfigCenterPage 添加「指纹配置」标签页
2. ✅ 实现指纹配置列表和编辑器
3. ✅ 实现导入对话框
4. ✅ 实现模板选择器
5. ✅ 集成到 Plan 编辑器

### Phase 5: 测试引擎集成（1-2 天）
1. ✅ 修改 src/env.ts 读取指纹配置
2. ✅ 修改 src/stealth/*.ts 应用指纹配置
3. ✅ 修改 playwright.config.ts 动态配置
4. ✅ 端到端测试

## 七、技术难点

### 7.1 动态应用指纹配置

**挑战：** Playwright 的 launchOptions 在启动时就固定了

**解决方案：**
- User Agent / Viewport 通过 `page.setViewportSize()` 动态设置
- HTTP 头通过 `context.setExtraHTTPHeaders()` 动态设置
- JavaScript 指纹通过 `page.addInitScript()` 注入

### 7.2 指纹一致性验证

**挑战：** 确保配置的指纹在实际运行中生效

**解决方案：**
- 提供「测试指纹」功能
- 访问 bot.sannysoft.com 并截图
- 解析检测结果，显示哪些指纹生效

### 7.3 指纹模板版本管理

**挑战：** 浏览器版本更新快，模板容易过时

**解决方案：**
- 模板文件包含 `version` 和 `createdAt` 字段
- 前端显示模板年龄（如"3 个月前"）
- 提供「更新模板」功能（从官方仓库拉取）

## 八、安全考虑

1. **敏感信息保护**
   - 指纹配置不包含真实的地理位置
   - 导出时提示用户检查敏感信息

2. **使用限制**
   - 在配置页面显示使用声明
   - 仅用于授权测试

3. **数据验证**
   - 导入时验证 JSON 格式
   - 检查必填字段完整性

## 九、未来扩展

1. **指纹库共享**
   - 支持导出/导入指纹配置包
   - 社区共享常用指纹模板

2. **智能指纹推荐**
   - 根据目标站点推荐最佳指纹
   - 分析失败日志，建议调整指纹

3. **指纹轮换**
   - 支持为一个方案配置多套指纹
   - 每次运行随机选择一套

4. **指纹有效性监控**
   - 定期测试指纹是否仍然有效
   - 自动标记过时的指纹配置

---

**最后更新：** 2026-04-06  
**设计版本：** 1.0  
**预计工作量：** 6-10 天
