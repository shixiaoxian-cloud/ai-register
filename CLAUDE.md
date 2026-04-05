# Claude AI 协作指南

本文档为 Claude AI 提供项目上下文和协作规范。

## 项目概述

这是一个基于 Playwright 的自动化测试框架，用于验证目标站点的保护机制（CAPTCHA、短信验证、设备挑战等）是否正常工作。

**核心原则：** 只验证保护机制，不提供任何绕过手段。

## 项目结构

```
ai-register/
├── docs/                  # 技术文档（统一管理）
│   ├── README.md          # 文档索引
│   ├── INDEX.md           # 快速索引
│   ├── ARCHITECTURE.md    # 架构说明
│   ├── CONTRIBUTING.md    # 贡献指南
│   ├── guides/            # 使用指南（8篇）
│   ├── troubleshooting/   # 故障排除（9篇）
│   ├── implementation/    # 实现总结（12篇）
│   └── analysis/          # 技术分析（8篇）
├── config/                # 配置文件
│   ├── target-site.json   # 目标站点配置
│   └── temp-mail.json     # 临时邮箱配置
├── scripts/               # 工具脚本
│   ├── config-server.mjs  # 配置服务器
│   └── verify-tempmail-api.sh
├── src/                   # 源代码
│   ├── config/            # 配置加载
│   ├── config-ui/         # 配置界面
│   ├── email/             # 邮箱验证模块
│   ├── stealth/           # 隐身技术
│   ├── utils/             # 工具函数
│   ├── env.ts             # 环境变量
│   ├── protection.ts      # 保护检测
│   ├── target.profile.ts  # 目标配置
│   └── types.ts           # 类型定义
├── tests/                 # 测试用例
│   ├── protection-validation.spec.ts
│   └── debug-tempmail.spec.ts
├── .env                   # 环境变量（不提交）
├── .editorconfig          # 编辑器配置
├── package.json           # 项目依赖
├── playwright.config.ts   # Playwright 配置
└── README.md              # 项目说明
```

## 技术栈

- **测试框架**: Playwright
- **语言**: TypeScript
- **邮箱服务**: IMAP / 临时邮箱 API
- **配置管理**: JSON + .env
- **Web UI**: Express + 原生 HTML/CSS/JS

## 核心模块

### 1. 配置层
- `.env` - 环境变量（敏感信息）
- `config/*.json` - JSON 配置文件
- `src/target.profile.ts` - 目标站点配置

### 2. 测试引擎
- `tests/protection-validation.spec.ts` - 主测试流程
- `playwright.config.ts` - 浏览器配置

### 3. 保护检测
- `src/protection.ts` - 检测 CAPTCHA、短信、设备挑战、阻断页

### 4. 邮箱验证
- `src/email/` - IMAP 和临时邮箱 API 集成
- 验证码提取和正则匹配

### 5. 隐身技术
- `src/stealth/` - 降低自动化检测特征
- 注意：用于降低误报，不是绕过保护

## 协作规范

### 代码修改

1. **阅读现有代码** - 修改前先用 Read 工具阅读相关文件
2. **保持安全边界** - 不添加任何绕过保护机制的代码
3. **类型安全** - 使用 TypeScript 类型定义
4. **配置驱动** - 通过配置文件控制行为，避免硬编码
5. **模块化** - 保持功能独立，易于测试和维护

### 文档管理

**重要：所有技术文档必须放在 `docs/` 目录下，不要在根目录创建新的 markdown 文件。**

#### 文档分类规则

- **docs/guides/** - 使用指南、配置说明、操作教程
- **docs/troubleshooting/** - 问题诊断、错误修复、FAQ
- **docs/implementation/** - 功能实现、技术决策、开发总结
- **docs/analysis/** - 深度分析、性能测试、安全研究

#### 添加新文档流程

1. 确定文档类型，选择合适的子目录
2. 使用清晰的文件名（小写，连字符分隔）
3. 在 `docs/README.md` 中添加链接
4. 提交时使用描述性的 commit message

详见 [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)

### Git 提交规范

```
类型: 简短描述

详细说明（可选）
```

**类型：**
- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档变更
- `refactor:` - 代码重构
- `test:` - 测试相关
- `chore:` - 构建/工具变更

**示例：**
```
docs: 添加临时邮箱配置指南

在 docs/guides/ 中新增 temp-mail-config.md，
详细说明如何配置和使用临时邮箱功能。
```

### 安全考虑

1. **敏感信息** - 不要在代码或文档中包含真实的邮箱、密码、API 密钥
2. **配置验证** - 验证所有用户输入和配置
3. **错误处理** - 避免在日志中泄露敏感信息
4. **权限最小化** - 只请求必要的浏览器权限

## 常见任务

### 添加新的保护检测

在 `src/protection.ts` 中添加检测函数：

```typescript
export async function detectNewProtection(page: Page): Promise<boolean> {
  // 实现检测逻辑
  return false;
}
```

### 添加新的邮箱服务

在 `src/email/` 中创建新模块：

```typescript
export class NewEmailService {
  async getVerificationCode(): Promise<string | null> {
    // 实现获取逻辑
  }
}
```

### 修改目标站点配置

编辑 `src/target.profile.ts`：

```typescript
export const targetProfile: TargetProfile = {
  selectors: {
    emailField: 'input[name="email"]',
    // ...
  },
  expectedOutcomes: ['success'],
  // ...
}
```

## 调试技巧

1. **有头模式** - `npm run test:headed` 查看浏览器行为
2. **UI 模式** - `npm run test:ui` 使用 Playwright UI
3. **截图和 trace** - 失败时自动保存在 `test-results/`
4. **日志** - 查看控制台输出和 `journey-summary.json`

## 参考文档

- [项目架构](docs/ARCHITECTURE.md) - 系统架构和模块设计
- [项目结构](PROJECT-STRUCTURE.md) - 目录组织说明
- [文档索引](docs/README.md) - 完整文档列表
- [快速索引](docs/INDEX.md) - 按主题/角色查找
- [常见问题](docs/troubleshooting/general.md) - FAQ

## 注意事项

### 禁止操作

- ❌ 不要添加绕过 CAPTCHA 的代码
- ❌ 不要添加绕过短信验证的代码
- ❌ 不要添加伪装设备指纹的代码
- ❌ 不要在根目录创建新的 markdown 文件
- ❌ 不要提交 `.env` 文件到 git

### 推荐操作

- ✅ 使用配置文件控制行为
- ✅ 保持代码模块化和可测试
- ✅ 编写清晰的文档和注释
- ✅ 使用 TypeScript 类型定义
- ✅ 遵循现有的代码风格

## 项目目标

这个项目的目标是：

1. **验证保护机制** - 检测目标站点的保护是否正常触发
2. **测试流程完整性** - 验证人工完成保护后能否继续
3. **提供可观测性** - 生成详细的测试报告和日志
4. **保持安全边界** - 不提供任何绕过手段

## 联系方式

遇到问题时：

1. 查看 [常见问题](docs/troubleshooting/general.md)
2. 查看相关的故障排除文档
3. 使用 [调试工具](docs/guides/debug-tools.md)

---

**最后更新**: 2026-04-05
**文档版本**: 1.0
