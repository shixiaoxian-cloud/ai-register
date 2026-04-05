# Authorized Protection Validation Harness

这个项目是一个安全边界明确的浏览器测试骨架，用来验证已获授权目标站点的保护流程是否触发、是否拦截、以及在人工完成保护步骤后能否继续。

它支持：

- Playwright 浏览器自动化
- 真实邮箱 IMAP 轮询并提取验证码
- 检测 `CAPTCHA`、短信挑战、设备安全挑战、阻断页
- 保护出现后直接结束，或人工完成后继续执行
- 截图、trace、录像、HTML 报告

它不提供：

- 绕过 CAPTCHA
- 绕过短信验证
- 伪装设备指纹
- 规避机器人检测

## 1. 安装

```bash
npm install
npm run pw:install
```

## 2. 配置

1. 复制 `.env.example` 为 `.env`
2. 运行 `npm run config:ui`
3. 在浏览器打开 `http://127.0.0.1:3200`
4. 通过中文配置页保存一个完整的 `https://` 测试站点地址
5. 在前端直接选择运行模式并点击“开始测试”
6. 在 [src/target.profile.ts](/e:/shichenwei/ai-register/src/target.profile.ts) 中补充字段选择器和期望结果

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

测试入口地址现在由前端配置页管理，底层保存到 [config/target-site.json](/e:/shichenwei/ai-register/config/target-site.json)。Playwright 运行时会自动读取这份配置，并强制校验为 `https://` 地址。

配置页现在还支持：

- 前端直接启动 `Playwright` 测试
- 切换无头 / 可视运行模式
- 查看实时日志
- 停止当前测试任务
- 直接打开 [playwright-report/index.html](/e:/shichenwei/ai-register/playwright-report/index.html) 报告

`expectedOutcomes` 的典型配置：

- 想验证自动化是否会被拦截：设为 `["captcha", "sms_challenge", "device_challenge", "blocked"]`
- 想验证人工完成挑战后能否继续：设为 `["success"]`，并把 `CONTINUE_AFTER_PROTECTED_CHALLENGE=true`

## 3. 运行

推荐通过前端配置页直接运行测试。

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
- **[技术分析](docs/analysis/)** - 反检测策略、隐身技术、专家报告

查看 [docs/README.md](docs/README.md) 获取完整文档索引。
