# Authorized Protection Validation Harness

这个项目是一个安全边界明确的浏览器测试骨架，用来验证已获授权目标站点的保护流程是否触发、是否拦截、以及在人工完成保护步骤后能否继续。

## 新功能：Token 自动保存 ✨

注册成功后，自动提取并保存 token 到本地：
- **CPA 格式**：适用于 CPA/CLI 管理接口
- **Sub2Api 格式**：适用于 Sub2Api 账号管理系统

详见：[Token 提取与保存指南](docs/guides/token-extraction.md)

## 核心功能

它支持：

- Playwright 浏览器自动化
- 真实邮箱 IMAP 轮询并提取验证码
- 临时邮箱 API 集成（推荐用于自动化）
- 检测 `CAPTCHA`、短信挑战、设备安全挑战、阻断页
- 保护出现后直接结束，或人工完成后继续执行
- 截图、trace、录像、HTML 报告
- **Token 自动提取与保存**（新增）

它不提供：

- 绕过 CAPTCHA
- 绕过短信验证
- 以规避为目的的设备挑战伪装策略
- 把浏览器环境配置用作自动化规避手段

## 1. 安装

```bash
npm install
npm run pw:install
```

## 2. 配置

1. 首次使用前运行 `npm run console:build`
2. 运行 `npm run config:ui`
3. 在浏览器打开 `http://127.0.0.1:3200`
4. 在新版平台控制台的 `Config Center` 中配置站点、测试方案、目标画像和邮箱配置
5. 在 `Runs` 工作区选择测试方案并启动运行
6. 开发前端时可运行 `npm run dev`，再访问 `http://127.0.0.1:5173` 使用 Vite 热重载

### Token 保存配置（可选）

如果需要保存注册成功后的 token，在 `.env` 中配置：

```bash
# Token 输出目录
TOKEN_OUTPUT_DIR=./output_tokens
```

注册成功后，token 会自动保存到：
- `output_tokens/cpa/` - CPA 格式
- `output_tokens/sub2api/` - Sub2Api 格式

详见：[Token 提取与保存指南](docs/guides/token-extraction.md)

默认已按中文环境运行：

- 浏览器语言：`zh-CN`
- 时区：`Asia/Shanghai`
- 请求头：`Accept-Language: zh-CN,zh;q=0.9`

如果目标站点支持多语言，通常会优先显示中文页面。你也可以在 `.env` 里修改 `BROWSER_LOCALE`、`BROWSER_TIMEZONE` 和 `ACCEPT_LANGUAGE`。

浏览器启动默认会优先使用本机已安装的 Chromium 系浏览器：

- 优先 `Chrome`
- 其次 `Edge`
- 如果你想手动指定，可在 `.env` 中设置 `LOCAL_BROWSER_NAME=chrome|msedge`
- 如果你想指定精确路径，可设置 `BROWSER_EXECUTABLE_PATH`

测试入口、方案、画像和邮箱配置现在由新版平台控制台管理，并持久化到本地 SQLite 平台库。旧的 `config/*.json` 文件只作为迁移导入来源或运行时兼容输入，不再是控制台读写的长期真源。

新版平台控制台现在支持并记录 `浏览器环境配置` 资源：

- 在 `Runs` 工作区直接启动 `Playwright` 测试
- 切换无头 / 可视运行模式
- 查看运行阶段、人工介入提示和日志
- 停止当前测试任务
- 通过 `Artifacts` 工作区浏览报告、trace、媒体和 token 产物
- 按任务下载归档产物包

`expectedOutcomes` 的典型配置：

- 想验证自动化是否会被拦截：设为 `["captcha", "sms_challenge", "device_challenge", "blocked"]`
- 想验证人工完成挑战后能否继续：设为 `["success"]`，并把 `CONTINUE_AFTER_PROTECTED_CHALLENGE=true`

## 3. 运行

推荐通过平台控制台的 `Runs` 工作区直接运行测试。

如果你仍然想用命令行，也可以：

```bash
npm test
```

或打开 Playwright 自带 UI：

```bash
npm run test:ui
```

## 4. 邮箱验证码

如果目标流程会把验证码发到你的真实邮箱：

- 配置 IMAP 连接信息
- 在 `emailVerification` 中设置发件人或主题过滤
- 调整 `EMAIL_CODE_REGEX` 匹配验证码格式

## 5. 输出结果

测试失败时会保留：

- 截图
- trace
- 视频
- `journey-summary.json`

说明：

- 我们自己的测试提示、结果文案和用例标题已经改成中文
- Playwright 自带的 HTML 报告框架界面大多仍是英文，这是工具本身的表现

## 6. 文档

详细的技术文档已整理到 [docs/](docs/) 目录：

- **[使用指南](docs/guides/)** - Chrome 设置、临时邮箱、密码流程等
- **[故障排除](docs/troubleshooting/)** - 403 错误、验证码调试、常见问题
- **[实现总结](docs/implementation/)** - 自动化功能、动态检测、配置说明
- **[技术分析](docs/analysis/)** - 历史研究资料、隐身实现背景、专家报告

**快速导航：**
  - [文档索引](docs/README.md) - 完整文档列表
  - [快速索引](docs/INDEX.md) - 按主题/角色查找
  - [项目架构](docs/ARCHITECTURE.md) - 系统架构设计
  - [项目结构](docs/PROJECT-STRUCTURE.md) - 目录组织说明

## 浏览器环境配置

本项目当前以开放式的“浏览器环境配置”资源能力支撑授权站点验证。该能力仅允许 `UA`、`UA-CH`、`locale`、`timezone`、`viewport`、`screen`、`geolocation` 和浏览器版本等可审计字段，且必须记录来源、方案绑定与审批信息。仓库内保留的旧命名内容只作为历史资料，新的审计链路必须以授权站点结果、人工接续状态、配置回显与审计记录为核心，外部诊断网站结果仅作为补充素材。
