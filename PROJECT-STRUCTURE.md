# 项目结构说明

## 目录组织

```
ai-register/
├── config/              # 配置文件
│   ├── target-site.json # 目标站点配置
│   └── temp-mail.json   # 临时邮箱配置
├── docs/                # 技术文档（统一管理）
│   ├── guides/          # 使用指南
│   ├── troubleshooting/ # 故障排除
│   ├── implementation/  # 实现总结
│   └── analysis/        # 技术分析
├── scripts/             # 工具脚本
│   ├── config-server.mjs      # 配置服务器
│   └── verify-tempmail-api.sh # 临时邮箱 API 验证
├── src/                 # 源代码
│   ├── config/          # 配置加载模块
│   ├── config-ui/       # 配置界面
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
- **src/config-ui/** - Web 配置界面
- **scripts/config-server.mjs** - 配置服务器

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
- **config/target-site.json** - 目标站点 URL
- **config/temp-mail.json** - 临时邮箱配置
- **playwright.config.ts** - 测试框架配置

## 运行模式

1. **配置界面模式**: `npm run config:ui` → 浏览器配置
2. **命令行模式**: `npm test` → 直接运行测试
3. **UI 模式**: `npm run test:ui` → Playwright UI

## 设计原则

- **安全边界明确**: 只验证保护机制，不绕过
- **配置驱动**: 通过配置文件和环境变量控制行为
- **模块化**: 功能独立，易于维护和扩展
- **文档完善**: 所有技术细节都有对应文档
