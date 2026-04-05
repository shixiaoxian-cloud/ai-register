# ai-pm × OpenSpec 联合工作流

## 目标

把两类能力拆开又打通：

- `ai-pm` 负责把问题定义清楚，沉淀价值、范围、流程、实体、设计和决策。
- `OpenSpec` 负责把一次次改动管理清楚，沉淀 proposal、design、tasks、implementation progress 和 archive。

这套方案的关键不是“二选一”，而是让它们在正确的时点接棒。

## 各技能最佳职责

| 能力 | 最适合做什么 | 不应该主导什么 | 主要产物 |
|------|--------------|----------------|----------|
| `ai-pm` | 价值发现、范围判断、MVP、PRD、用户旅程、页面结构、实体定义、设计交付 | 具体代码实现任务跟踪 | `docs/00_MEMORY/`、`docs/01_STRATEGY/`、`docs/02_PRD/`、`docs/03_DESIGN/` |
| `openspec-explore` | 技术可行性探索、change 级问题澄清、方案对比 | 直接写业务代码 | 对话结论、必要时补变更产物 |
| `openspec-propose` | 生成一次 change 的 proposal/design/tasks | 替代上游产品判断 | `openspec/changes/<name>/proposal.md` 等 |
| `openspec-apply-change` | 依据 tasks 实施代码、更新任务勾选、同步状态 | 重新定义需求本身 | 代码变更、任务完成状态 |
| `openspec-archive-change` | 归档完成的 change，结束本轮变更 | 继续扩需求 | `openspec/changes/archive/` |

## 顶层串联方案

```text
用户问题 / 想法
  -> ai-pm
     价值、范围、流程、实体、设计收敛
  -> openspec-explore
     技术不确定性澄清（只在需要时）
  -> 双方案评审
     给出 2 套方案，等待用户选择
  -> openspec-propose
     固化 proposal / design / tasks
  -> openspec-apply-change
     按任务实施并验证
  -> openspec-archive-change
     归档变更
  -> ai-pm
     复盘、决策沉淀、方法升级（可选）
```

## 自动调用规则

默认不要求用户显式输入技能名，按意图自动路由：

1. 出现这些信号时，自动走 `ai-pm`
   - “帮我想想这个功能”
   - “定义 MVP / PRD / 用户流程 / 页面”
   - “这个需求值不值得做”
   - “实体怎么设计”
   - “这个页面应该长什么样”
2. 出现这些信号时，自动走 `openspec-explore`
   - “这条 change 的技术路线该怎么选”
   - “A 方案和 B 方案怎么权衡”
   - “先别写代码，帮我分析一下”
3. 当进入“给方案”阶段时，默认先输出 2 套候选方案
   - 每套方案都应说明适用前提、主要优点、主要代价
   - 方案默认使用中文输出；除非用户明确要求其他语言
   - 明确标出推荐方案，但仍然等待用户选择
   - 未经用户选择，不进入 `openspec-propose`
4. 出现这些信号时，且用户已经明确选定方案后，自动走 `openspec-propose`
   - “把这个需求变成一个 change”
   - “生成 proposal / design / tasks”
   - “需求已经定了，开始建变更”
5. 出现这些信号时，自动走 `openspec-apply-change`
   - “实现这个 change”
   - “继续做上一个变更”
   - “按 tasks 开发”
   - “修复这个 change 里的问题”
6. 出现这些信号时，自动走 `openspec-archive-change`
   - “归档这个 change”
   - “这个变更做完了，收尾吧”

## 双方案闸门

这是本项目的强约束：

- 每次需要给用户“方案”时，必须提供 2 套可选方案
- 两套方案都要可执行，不允许用 1 套认真方案加 1 套明显不可用方案凑数
- 两套方案至少说明 3 件事：适用场景、主要收益、主要代价或风险
- 方案默认使用中文输出；除非用户明确要求英文或其他语言
- 可以标注“推荐方案”，但不能跳过用户选择
- 只有用户明确说“选方案 A / 选方案 B / 按推荐方案来”，才进入 `openspec-propose`
- 如果用户继续补信息但尚未选定，继续停留在 `ai-pm` 或 `openspec-explore`

## 产物映射

`ai-pm` 和 `OpenSpec` 不应各写一套平行文档，而应做映射：

- `docs/00_MEMORY/CONTEXT_SNAPSHOT.md`
  - 作为 proposal 的事实依据和约束来源
- `docs/00_MEMORY/SESSION_MEMORY.md`
  - 作为 change 背景、关键取舍和演化记录
- `docs/01_STRATEGY/DECISIONS.md`
  - 作为 proposal / design 的已确认决策输入
- `docs/02_PRD/framework-prd.md`
  - 作为 design.md 和 tasks.md 的用户旅程与范围输入
- `docs/03_DESIGN/`
  - 作为实现前端、交互和 handoff 的产品输入
- `docs/TODO.md`
  - 作为跨会话待办池；当待办足够清晰后，再进入对应 change 的 tasks

## 协作边界

几个关键原则：

- 产品变化先更新 `ai-pm` 资产，再同步到 OpenSpec 变更。
- 纯实现性变化可以直接在 OpenSpec 里推进，不必回到 PRD。
- 如果实现过程中发现需求本身不成立，先暂停 `apply`，回到 `ai-pm` 或 `openspec-explore` 修正。
- `OpenSpec` 关注“一次变更”；`ai-pm` 关注“整个项目的持续认知”。
- 方案先比较、后定案；定案后才进入 change 固化。

## 本项目的推荐默认

针对 `ai-register`，建议采用以下默认分工：

- 内部平台能力、配置流程、控制台体验、多站点编排逻辑，用 `ai-pm` 先做范围和流程。
- 进入具体实现前，为每个独立改动建立一个 OpenSpec change。
- `openspec/config.yaml` 应始终携带项目安全边界：验证保护机制，不提供绕过手段。
- 已有技术说明仍保留在 `docs/guides/`、`docs/implementation/`、`docs/analysis/`、`docs/troubleshooting/`，不与产品资产混放。
