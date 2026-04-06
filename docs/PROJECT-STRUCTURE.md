# 项目结构说明

## 目录组织

```
ai-register/
├── config/              # 配置文件
│   ├── platform.sqlite  # 平台控制台 SQLite 真源
│   ├── target-site.json # 旧站点配置导入 / 运行时兼容输入
│   ├── target-profile.json # 目标画像兼容输入
│   └── temp-mail.json   # 旧临时邮箱配置导入 / 运行时兼容输入
├── docs/                # 技术文档（统一管理）
│   ├── guides/          # 使用指南
│   ├── troubleshooting/ # 故障排除
│   ├── implementation/  # 实现总结
│   └── analysis/        # 技术分析
├── frontend/            # React + TypeScript + Vite 平台控制台
│   └── src/             # 控制台页面、组件、类型和 API 客户端
├── scripts/             # 工具脚本
│   ├── config-server.mjs      # 平台控制台本地服务
│   ├── platform-store.mjs     # SQLite schema、迁移和资源仓储
│   ├── platform-runner.mjs    # 运行控制和日志归档
│   └── verify-tempmail-api.sh # 临时邮箱 API 验证
├── src/                 # 源代码
│   ├── config/          # 配置加载模块
│   ├── config-ui/       # 旧配置界面源码，已退出受支持入口
│   ├── email/           # 邮箱处理模块
│   ├── stealth/         # 隐身技术模块
│   ├── utils/           # 工具函数
│   ├── env.ts           # 环境变量
│   ├── protection.ts    # 保护检测
│   ├── target.profile.ts # 目标配置
│   └── types.ts         # 类型定义
├── tests/               # 测试用例
│   ├── protection-validation.spec.ts # 主测试
│   └── debug-tempmail.spec.ts        # 临时邮箱调试
├── .env                 # 环境变量配置
├── package.json         # 项目依赖
├── playwright.config.ts # Playwright 配置
└── README.md            # 项目说明
```

## 核心模块

### 1. 配置系统
- **config/** - JSON 配置文件存储
- **src/config/** - 配置加载和验证
- **frontend/** - 新版平台控制台，负责站点、方案、画像、邮箱、运行和产物视图
- **scripts/config-server.mjs** - 本地平台服务，托管控制台和资源 API
- **scripts/platform-store.mjs** - SQLite 持久化真源和旧配置导入

### 2. 邮箱系统
- **src/email/** - 邮箱验证码提取
  - IMAP 邮箱支持
  - 临时邮箱 API 集成
  - 验证码正则匹配

### 3. 保护检测
- **src/protection.ts** - 检测 CAPTCHA、短信验证、设备挑战
- **src/stealth/** - 反检测和隐身技术

### 4. 测试框架
- **tests/** - Playwright 测试用例
- **playwright.config.ts** - 浏览器配置、截图、trace

## 文档组织原则

所有技术文档统一放在 `docs/` 目录，按功能分类：

1. **guides/** - 面向用户的使用指南和配置说明
2. **troubleshooting/** - 问题诊断和解决方案
3. **implementation/** - 功能实现细节和总结
4. **analysis/** - 深度技术分析和研究报告

每个子目录都有明确的职责，避免文档散落在项目根目录。

## 配置文件

- **.env** - 环境变量（不提交到 git）
- **config/platform.sqlite** - 新版平台控制台持久化真源
- **config/target-site.json** - 旧目标站点配置导入 / 运行时兼容输入
- **config/target-profile.json** - 目标画像兼容输入
- **config/temp-mail.json** - 旧临时邮箱配置导入 / 运行时兼容输入
- **playwright.config.ts** - 测试框架配置

## 运行模式

1. **平台控制台模式**: `npm run console:build` + `npm run config:ui` → 访问 `http://127.0.0.1:3200`
2. **前端开发模式**: `npm run dev` → 后端服务 + Vite 热重载，访问 `http://127.0.0.1:5173`
3. **命令行模式**: `npm test` → 直接运行测试
4. **Playwright UI 模式**: `npm run test:ui` → Playwright UI

## 设计原则

- **安全边界明确**: 只验证保护机制，不绕过
- **配置驱动**: 通过平台 SQLite 资源和显式配置文件控制行为
- **模块化**: 功能独立，易于维护和扩展
- **文档完善**: 所有技术细节都有对应文档
