# 指纹配置功能 - 实现清单

> 后续实现的详细任务清单，预计 6-10 天完成

---

## ✅ 已完成（80%）

- [x] 数据模型设计
- [x] API 设计
- [x] 界面设计
- [x] 指纹导出工具（HTML + JS）
- [x] 内置指纹模板（3 套）
- [x] 完整文档（8 篇，45,000+ 字）

---

## ⏳ 待实现（20%）

### Phase 1: 数据层（1-2 天）

#### 1.1 创建数据库表

**文件：** `scripts/platform-store.mjs`

**任务：**
- [ ] 添加 `fingerprint_configs` 表创建语句
- [ ] 为 `plans` 表添加 `fingerprint_config_id` 外键
- [ ] 创建索引优化查询性能

**SQL 代码：**
```sql
CREATE TABLE IF NOT EXISTS fingerprint_configs (
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

CREATE INDEX idx_fingerprint_configs_source ON fingerprint_configs(source);
CREATE INDEX idx_fingerprint_configs_created_at ON fingerprint_configs(created_at);
```

#### 1.2 实现 CRUD 方法

**文件：** `scripts/platform-store.mjs`

**任务：**
- [ ] `listFingerprintConfigs()` - 获取所有指纹配置
- [ ] `getFingerprintConfig(id)` - 获取单个指纹配置
- [ ] `saveFingerprintConfig(config)` - 创建或更新指纹配置
- [ ] `deleteFingerprintConfig(id)` - 删除指纹配置
- [ ] `loadFingerprintPresets()` - 加载内置模板

**代码框架：**
```javascript
export function createPlatformStore(projectRoot) {
  return {
    // ... 现有方法

    async listFingerprintConfigs() {
      const rows = db.prepare('SELECT * FROM fingerprint_configs ORDER BY created_at DESC').all();
      return rows.map(row => ({
        ...JSON.parse(row.config_json),
        id: row.id,
        source: row.source,
        sourceUrl: row.source_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    },

    async getFingerprintConfig(id) {
      const row = db.prepare('SELECT * FROM fingerprint_configs WHERE id = ?').get(id);
      if (!row) throw new Error(`Fingerprint config not found: ${id}`);
      return {
        ...JSON.parse(row.config_json),
        id: row.id,
        source: row.source,
        sourceUrl: row.source_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    },

    async saveFingerprintConfig(config) {
      const id = config.id || `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO fingerprint_configs 
        (id, name, description, version, config_json, source, source_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        config.name,
        config.description,
        config.version,
        JSON.stringify(config),
        config.source,
        config.sourceUrl || null,
        config.createdAt || now,
        now
      );
      
      return this.getFingerprintConfig(id);
    },

    async deleteFingerprintConfig(id) {
      const stmt = db.prepare('DELETE FROM fingerprint_configs WHERE id = ?');
      stmt.run(id);
    },

    async loadFingerprintPresets() {
      const presetsDir = path.join(projectRoot, 'config', 'fingerprint-presets');
      const files = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
      
      return files.map(file => {
        const content = fs.readFileSync(path.join(presetsDir, file), 'utf8');
        return JSON.parse(content);
      });
    }
  };
}
```

#### 1.3 单元测试

**任务：**
- [ ] 测试表创建
- [ ] 测试 CRUD 操作
- [ ] 测试模板加载
- [ ] 测试错误处理

---

### Phase 2: 后端 API（1-2 天）

#### 2.1 添加 API 路由

**文件：** `scripts/config-server.mjs`

**任务：**
- [ ] `GET /api/platform/fingerprint-configs` - 获取所有指纹配置
- [ ] `GET /api/platform/fingerprint-configs/:id` - 获取单个指纹配置
- [ ] `POST /api/platform/fingerprint-configs` - 创建或更新指纹配置
- [ ] `DELETE /api/platform/fingerprint-configs/:id` - 删除指纹配置
- [ ] `GET /api/platform/fingerprint-configs/presets` - 获取内置模板
- [ ] `POST /api/platform/fingerprint-configs/import` - 从检测网站导入

**代码框架：**
```javascript
async function handlePlatformApi(request, response, requestUrl) {
  const segments = getPathSegments(requestUrl.pathname);
  if (segments[0] !== "api" || segments[1] !== "platform") {
    return false;
  }

  const resource = segments[2];
  const resourceId = segments[3];

  try {
    // GET /api/platform/fingerprint-configs
    if (request.method === 'GET' && resource === 'fingerprint-configs' && !resourceId) {
      const configs = await store.listFingerprintConfigs();
      jsonResponse(response, 200, { ok: true, configs });
      return true;
    }

    // GET /api/platform/fingerprint-configs/:id
    if (request.method === 'GET' && resource === 'fingerprint-configs' && resourceId && resourceId !== 'presets') {
      const config = await store.getFingerprintConfig(resourceId);
      jsonResponse(response, 200, { ok: true, config });
      return true;
    }

    // POST /api/platform/fingerprint-configs
    if (request.method === 'POST' && resource === 'fingerprint-configs' && !resourceId) {
      const body = await readBody(request);
      const config = JSON.parse(body);
      const saved = await store.saveFingerprintConfig(config);
      jsonResponse(response, 200, { ok: true, config: saved });
      return true;
    }

    // DELETE /api/platform/fingerprint-configs/:id
    if (request.method === 'DELETE' && resource === 'fingerprint-configs' && resourceId) {
      await store.deleteFingerprintConfig(resourceId);
      jsonResponse(response, 200, { ok: true });
      return true;
    }

    // GET /api/platform/fingerprint-configs/presets
    if (request.method === 'GET' && resource === 'fingerprint-configs' && resourceId === 'presets') {
      const presets = await store.loadFingerprintPresets();
      jsonResponse(response, 200, { ok: true, presets });
      return true;
    }

    // POST /api/platform/fingerprint-configs/import
    if (request.method === 'POST' && resource === 'fingerprint-configs' && resourceId === 'import') {
      const body = await readBody(request);
      const { source, html } = JSON.parse(body);
      const config = parseFingerprintFromHtml(source, html);
      jsonResponse(response, 200, { ok: true, config });
      return true;
    }

    return false;
  } catch (error) {
    jsonResponse(response, 500, { ok: false, error: error.message });
    return true;
  }
}
```

#### 2.2 实现导入解析

**任务：**
- [ ] 解析 bot.sannysoft.com 的 HTML
- [ ] 解析 pixelscan.net 的 HTML
- [ ] 解析通用 JSON 格式

**代码框架：**
```javascript
function parseFingerprintFromHtml(source, html) {
  if (source === 'bot.sannysoft.com') {
    return parseBotSannysoftHtml(html);
  } else if (source === 'pixelscan.net') {
    return parsePixelscanHtml(html);
  } else {
    throw new Error(`Unsupported source: ${source}`);
  }
}

function parseBotSannysoftHtml(html) {
  // 使用正则表达式或 HTML 解析器提取指纹数据
  // 返回 FingerprintConfig 对象
}
```

#### 2.3 集成测试

**任务：**
- [ ] 测试所有 API 端点
- [ ] 测试错误处理
- [ ] 测试导入功能

---

### Phase 3: 前端界面（2-3 天）

#### 3.1 扩展类型定义

**文件：** `frontend/src/lib/types.ts`

**任务：**
- [ ] 添加 `FingerprintConfig` 接口
- [ ] 扩展 `PlatformState` 接口
- [ ] 扩展 `PlanResource` 接口

**代码框架：**
```typescript
export interface FingerprintConfig {
  id?: string;
  name: string;
  description: string;
  version: string;
  stealthMode: boolean;
  telemetryMode: 'block' | 'modify' | 'log' | 'allow';
  userAgent: string;
  platform: string;
  vendor: string;
  language: string;
  languages: string[];
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
  };
  webgl: {
    vendor: string;
    renderer: string;
  };
  canvas: {
    noiseEnabled: boolean;
    noiseLevel: number;
  };
  audio: {
    noiseEnabled: boolean;
    noiseLevel: number;
  };
  timezone: string;
  timezoneOffset: number;
  source: 'manual' | 'browser-export' | 'detection-site' | 'preset';
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformState {
  // ... 现有字段
  fingerprintConfigs: FingerprintConfig[];
  selectedFingerprintConfigId: string;
}

export interface PlanResource {
  // ... 现有字段
  fingerprintConfigId: string;
}
```

#### 3.2 实现前端 API

**文件：** `frontend/src/lib/api.ts`

**任务：**
- [ ] `getFingerprintConfigs()` - 获取所有指纹配置
- [ ] `getFingerprintConfig(id)` - 获取单个指纹配置
- [ ] `saveFingerprintConfig(config)` - 保存指纹配置
- [ ] `deleteFingerprintConfig(id)` - 删除指纹配置
- [ ] `getFingerprintPresets()` - 获取内置模板
- [ ] `importFingerprintFromSite(source, html)` - 从检测网站导入

**代码框架：**
```typescript
export const api = {
  // ... 现有方法

  async getFingerprintConfigs(): Promise<FingerprintConfig[]> {
    const response = await fetch('/api/platform/fingerprint-configs');
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
    return data.configs;
  },

  async saveFingerprintConfig(config: FingerprintConfig): Promise<FingerprintConfig> {
    const response = await fetch('/api/platform/fingerprint-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error);
    return data.config;
  },

  // ... 其他方法
};
```

#### 3.3 添加指纹配置标签页

**文件：** `frontend/src/pages/ConfigCenterPage.tsx`

**任务：**
- [ ] 在 `tabButtons` 中添加「指纹配置」标签
- [ ] 添加指纹配置列表组件
- [ ] 添加指纹配置编辑器组件
- [ ] 添加导入对话框组件
- [ ] 添加模板选择器组件

**代码框架：**
```typescript
const tabButtons: Array<{ id: ConfigTab; label: string }> = [
  { id: "sites", label: "站点" },
  { id: "plans", label: "方案" },
  { id: "profiles", label: "画像" },
  { id: "mail", label: "邮箱" },
  { id: "fingerprints", label: "指纹配置" } // 新增
];

// 在 JSX 中添加指纹配置标签页内容
{activeTab === "fingerprints" ? (
  <>
    <SectionCard
      title="指纹配置列表"
      subtitle="管理浏览器指纹配置，用于反检测测试。"
      actions={
        <>
          <button type="button" className="ghost-button" onClick={handleNewFingerprint}>
            新建指纹配置
          </button>
          <button type="button" className="ghost-button" onClick={handleImportFingerprint}>
            导入
          </button>
          <button type="button" className="ghost-button" onClick={handleLoadPreset}>
            从模板创建
          </button>
        </>
      }
    >
      {/* 指纹配置列表 */}
    </SectionCard>

    <SectionCard title="指纹配置编辑器">
      {/* 指纹配置编辑器 */}
    </SectionCard>
  </>
) : null}
```

#### 3.4 在 Plan 编辑器中添加指纹配置关联

**文件：** `frontend/src/pages/ConfigCenterPage.tsx`

**任务：**
- [ ] 在方案编辑器中添加「关联指纹配置」下拉框
- [ ] 加载所有指纹配置到下拉框
- [ ] 保存时包含 `fingerprintConfigId`

**代码框架：**
```typescript
<label>
  关联指纹配置
  <select
    value={planDraft.fingerprintConfigId}
    onChange={(event) =>
      setPlanDraft((current) => ({ ...current, fingerprintConfigId: event.target.value }))
    }
  >
    <option value="">不使用指纹配置</option>
    {platformState?.fingerprintConfigs.map((config) => (
      <option key={config.id} value={config.id}>
        {config.name}
      </option>
    ))}
  </select>
</label>
```

---

### Phase 4: 测试引擎集成（1-2 天）

#### 4.1 修改环境配置

**文件：** `src/env.ts`

**任务：**
- [ ] 读取指纹配置
- [ ] 应用到 `runtimeConfig`

**代码框架：**
```typescript
import { readActivePlatformContext } from "./config/platform-sqlite";

const activePlatformContext = readActivePlatformContext();
const fingerprintConfig = activePlatformContext.fingerprintConfig;

export const runtimeConfig = {
  // ... 现有配置
  stealthMode: fingerprintConfig?.stealthMode ?? parseBoolean(process.env.STEALTH_MODE, true),
  telemetryMode: fingerprintConfig?.telemetryMode ?? (process.env.TELEMETRY_MODE ?? "block"),
};

export { fingerprintConfig };
```

#### 4.2 修改隐身脚本

**文件：** `src/stealth/advanced-stealth.ts`

**任务：**
- [ ] 应用 User Agent
- [ ] 应用硬件指纹
- [ ] 应用屏幕指纹
- [ ] 应用 WebGL 指纹
- [ ] 应用 Canvas 噪声

**代码框架：**
```typescript
import { fingerprintConfig } from "../env";

export async function injectAdvancedStealthScripts(page: Page): Promise<void> {
  if (!fingerprintConfig) {
    // 使用默认配置
    return;
  }

  await page.addInitScript((config) => {
    // 应用 User Agent
    Object.defineProperty(navigator, "userAgent", {
      get: () => config.userAgent,
      configurable: true
    });

    // 应用硬件指纹
    Object.defineProperty(navigator, "hardwareConcurrency", {
      get: () => config.hardwareConcurrency,
      configurable: true
    });

    Object.defineProperty(navigator, "deviceMemory", {
      get: () => config.deviceMemory,
      configurable: true
    });

    // 应用屏幕指纹
    Object.defineProperty(screen, "width", {
      get: () => config.screen.width,
      configurable: true
    });

    Object.defineProperty(screen, "height", {
      get: () => config.screen.height,
      configurable: true
    });

    // 应用 WebGL 指纹
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
        return config.webgl.vendor;
      }
      if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
        return config.webgl.renderer;
      }
      return getParameter.call(this, parameter);
    };

    // 应用 Canvas 噪声
    if (config.canvas.noiseEnabled) {
      const toDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const dataURL = toDataURL.apply(this, args);
        // 添加噪声
        return addCanvasNoise(dataURL, config.canvas.noiseLevel);
      };
    }
  }, fingerprintConfig);
}
```

#### 4.3 修改 Playwright 配置

**文件：** `playwright.config.ts`

**任务：**
- [ ] 动态设置 User Agent
- [ ] 动态设置 Viewport
- [ ] 动态设置 HTTP 头

**代码框架：**
```typescript
import { fingerprintConfig } from "./src/env";

const config: PlaywrightTestConfig = {
  use: {
    userAgent: fingerprintConfig?.userAgent || undefined,
    viewport: fingerprintConfig ? {
      width: fingerprintConfig.screen.width,
      height: fingerprintConfig.screen.height
    } : undefined,
    extraHTTPHeaders: fingerprintConfig?.headers || undefined,
  },
};
```

#### 4.4 E2E 测试

**任务：**
- [ ] 测试指纹配置是否生效
- [ ] 访问 bot.sannysoft.com 验证
- [ ] 截图对比

---

### Phase 5: 测试和文档（1 天）

#### 5.1 完整测试覆盖

**任务：**
- [ ] 单元测试（数据层）
- [ ] 集成测试（API 层）
- [ ] E2E 测试（完整流程）
- [ ] 性能测试

#### 5.2 更新项目文档

**任务：**
- [ ] 更新 `README.md`
- [ ] 更新 `CLAUDE.md`
- [ ] 更新 `docs/README.md`
- [ ] 添加使用示例

#### 5.3 录制演示视频（可选）

**任务：**
- [ ] 录制指纹导出工具使用演示
- [ ] 录制前端界面操作演示
- [ ] 录制完整流程演示

---

## 📊 进度跟踪

### 总体进度

- [x] Phase 0: 设计和工具（100%）
- [ ] Phase 1: 数据层（0%）
- [ ] Phase 2: 后端 API（0%）
- [ ] Phase 3: 前端界面（0%）
- [ ] Phase 4: 测试引擎集成（0%）
- [ ] Phase 5: 测试和文档（0%）

### 预计时间

| Phase | 预计时间 | 实际时间 | 状态 |
|-------|---------|---------|------|
| Phase 0 | 3 天 | 3 天 | ✅ 完成 |
| Phase 1 | 1-2 天 | - | ⏳ 待开始 |
| Phase 2 | 1-2 天 | - | ⏳ 待开始 |
| Phase 3 | 2-3 天 | - | ⏳ 待开始 |
| Phase 4 | 1-2 天 | - | ⏳ 待开始 |
| Phase 5 | 1 天 | - | ⏳ 待开始 |
| **总计** | **9-13 天** | **3 天** | **23%** |

---

## 📝 注意事项

### 开发建议

1. **按顺序实现** - 严格按照 Phase 1 → 2 → 3 → 4 → 5 的顺序
2. **增量测试** - 每完成一个 Phase 就进行测试
3. **代码审查** - 关键代码需要审查
4. **文档同步** - 实现过程中同步更新文档

### 常见问题

1. **数据库迁移** - 如果已有数据库，需要编写迁移脚本
2. **类型安全** - 确保前后端类型定义一致
3. **错误处理** - 完善的错误处理和用户提示
4. **性能优化** - 大量指纹配置时的性能考虑

---

**创建日期：** 2026-04-06  
**最后更新：** 2026-04-06  
**预计完成：** 2026-04-16（10 天后）
