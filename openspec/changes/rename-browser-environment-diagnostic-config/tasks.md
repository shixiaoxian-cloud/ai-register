## 1. 文档真值与命名治理

- [x] 1.1 更新 `README.md`、`FINGERPRINT_README.md`、`docs/implementation/fingerprint-config-*.md`、`docs/guides/fingerprint-config-*.md` 与相关 PRD/OpenSpec 文档，将“指纹配置 / 反检测 / 设备指纹伪装 / 检测站评分”统一改写为“浏览器环境配置”或显式的历史迁移说明（验证方式：运行 `rg -n -S "反检测|伪装设备指纹|降低检测率|规避机器人检测|绕过保护|stealthMode" README.md FINGERPRINT_README.md docs openspec`，确认只剩允许保留的规则或迁移上下文）。
- [x] 1.2 重写 `tools/fingerprint-exporter.html` 与 `tools/fingerprint-collector.js` 的产品语义、字段说明和导出结构，使其只导出白名单字段与来源元数据，不再输出禁止字段或规避导向文案（验证方式：运行 `node --check tools/fingerprint-collector.js`，并人工打开工具确认界面文案与导出 JSON 都符合新语义）。

## 2. 数据模型、迁移与后端校验

- [x] 2.1 在 `scripts/platform-store.mjs` 中新增 `BrowserEnvironmentConfig` 资源模型、SQLite schema、引用计数和 `Plan` 绑定字段，并加入审批/来源/审计元数据（验证方式：运行 `node --check scripts/platform-store.mjs`，并通过本地 store 读写 smoke test 确认 CRUD 与引用阻断生效）。
- [x] 2.2 在 `scripts/platform-store.mjs` 中实现历史 `fingerprint` 资产迁移适配：白名单字段可映射时生成浏览器环境配置，命中禁止字段或不可映射内容时 Fail Fast 并记录迁移原因（验证方式：准备允许/禁止两类样例 JSON，分别验证成功迁移与明确阻断）。
- [x] 2.3 在 `scripts/config-server.mjs` 中新增浏览器环境配置 CRUD、方案绑定、审批信息读写和输入校验接口，并确保后端拒绝 `stealthMode`、噪声注入、插件伪造、`navigator` 深度篡改、随机轮换及其他白名单外字段（验证方式：运行 `node --check scripts/config-server.mjs`，并对新增接口做手工或自动化 `4xx` 校验测试）。

## 3. 前端控制台与方案绑定

- [x] 3.1 在 `frontend/src/lib/types.ts` 与 `frontend/src/lib/api.ts` 中新增浏览器环境配置类型、API 方法和方案绑定字段，删除或隔离旧 `fingerprint` 语义（验证方式：运行 `npm run typecheck`）。
- [x] 3.2 在 [ConfigCenterPage.tsx](e:/shichenwei/ai-register/frontend/src/pages/ConfigCenterPage.tsx) 增加“浏览器环境配置”资源页，支持列表、详情、白名单字段编辑、来源/审批信息展示、迁移结果反馈和引用关系查看（验证方式：运行 `npm run typecheck`，并在本地控制台手工验证创建/编辑/删除/阻断流）。
- [x] 3.3 在方案编辑器中增加浏览器环境配置绑定入口，并在引用存在时禁用删除、在运行前清晰展示当前绑定与审批状态（验证方式：本地手工验证方案保存、切换绑定和删除阻断行为）。

## 4. 运行前应用、日志与报告回显

- [x] 4.1 在 `src/env.ts`、运行准备链路和相关运行时代码中实现白名单适配层，只将允许字段应用到浏览器上下文、请求头或等价受控入口，并在配置不完整、审批不满足或字段冲突时 Fail Fast（验证方式：运行相关类型检查/测试，并手工验证“成功应用”和“启动前阻断”两条路径）。
- [x] 4.2 清理或隔离 `src/stealth/*.ts` 中与 `stealthMode`、噪声注入、插件伪造、`navigator` 深度篡改、随机轮换相关的主链路接入点，确保浏览器环境配置不会复用这些违规实现（验证方式：运行 `rg -n -S "stealthMode|noise|plugin spoof|navigator" src` 并结合代码审查确认主链路已切断）。
- [x] 4.3 在运行详情、报告摘要和产物元数据中回显浏览器环境配置名称、版本、来源、审批状态、方案绑定关系、人工接续状态和实际生效字段摘要（验证方式：执行一次本地测试任务，检查 UI/API/报告输出是否完整回显）。

## 5. 验收链路、测试与一致性审计

- [x] 5.1 为后端校验、历史迁移、方案绑定、运行前阻断、报告回显和禁止项拒绝新增或补齐自动化测试（验证方式：运行受影响测试命令；若无现成测试框架覆盖，则至少补充可重复执行的脚本化验证步骤）。
- [x] 5.2 用授权站点测试结果、人工接续状态、配置回显和审计记录定义新的验收摘要输出，确保检测站结果不再作为通过/失败主链路（验证方式：执行一次完整运行并人工核对验收摘要字段）。
- [x] 5.3 完成仓库级一致性审计、更新 `docs/optimization_logs/<yyyy>/<MM>/OPTIMIZATION_LOG_yyyyMMdd.md`，并记录已执行测试、未执行测试、阻塞原因与后续动作（验证方式：交付前运行统一检索审计，并补齐优化日志与最终测试回执）。
