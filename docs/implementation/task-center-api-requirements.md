# 任务中心 API 需求文档

## 概述

本文档描述任务中心前端所需的后端 API 接口和数据结构。

## 核心概念

```
Task（任务）
  ├── 用户点击"启动"创建
  ├── 包含多个 Case（执行实例）
  └── 聚合所有 Case 的产物

Case（执行实例）
  ├── Task 中的每一次独立执行
  ├── 可以重试（retryCount）
  ├── 包含多个 Run（Playwright 运行记录）
  └── 产生产物（Token、报告、截图等）

Run（运行记录）
  └── Playwright 的实际执行记录（现有数据结构）
```

## 数据结构

### TaskRecord

```typescript
interface TaskRecord {
  id: string;                    // 任务 ID
  name: string;                  // 任务名称
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  sourceKind: string;            // 来源类型
  sourceRef: string;             // 来源引用
  planId: string;                // 关联的方案 ID
  planName: string;              // 方案名称（冗余字段）
  siteName: string;              // 站点名称（冗余字段）
  runMode: 'headless' | 'headed';
  totalCases: number;            // 总执行次数（用户设置）
  completedCases: number;        // 已完成的 Case 数量
  successCases: number;          // 成功的 Case 数量
  failedCases: number;           // 失败的 Case 数量
  createdAt: string;             // ISO 8601 时间戳
  updatedAt: string;             // ISO 8601 时间戳
  startedAt?: string;            // 任务开始时间
  finishedAt?: string;           // 任务结束时间
  caseCount?: number;            // Case 总数（兼容字段）
  runCount?: number;             // Run 总数（兼容字段）
  artifactCount?: number;        // 产物总数（兼容字段）
  cases?: CaseRecord[];          // 包含的 Case 列表（可选）
  artifacts?: ArtifactSummary;   // 产物汇总（可选）
}

interface ArtifactSummary {
  token: number;                 // Token 数量
  report: number;                // 报告数量
  screenshot: number;            // 截图数量
  trace: number;                 // Trace 数量
  other: number;                 // 其他类型数量
}
```

### CaseRecord

```typescript
interface CaseRecord {
  id: string;                    // Case ID
  taskId: string;                // 所属 Task ID
  name: string;                  // Case 名称
  sequence: number;              // 序号（第几次执行，1-based）
  status: 'pending' | 'running' | 'retrying' | 'success' | 'failed';
  sourceKind: string;            // 来源类型
  sourceRef: string;             // 来源引用
  startedAt?: string;            // 开始时间
  finishedAt?: string;           // 结束时间
  retryCount: number;            // 已重试次数
  maxRetries: number;            // 最大重试次数
  exitCode?: number;             // 退出码
  errorType?: 'timeout' | 'protection' | 'network' | 'unknown';
  errorMessage?: string;         // 错误消息
  errorStack?: string;           // 错误堆栈
  createdAt: string;             // ISO 8601 时间戳
  updatedAt: string;             // ISO 8601 时间戳
  runCount?: number;             // Run 总数（兼容字段）
  artifactCount?: number;        // 产物总数（兼容字段）
  runs?: RunRecord[];            // 包含的 Run 列表（可选）
  artifacts?: ArtifactEntry[];   // 产物列表（可选）
  latestStage?: RunStageSnapshot; // 最新阶段（可选）
}
```

## API 接口

### 1. 获取任务列表

```
GET /api/platform/tasks
```

**响应：**
```json
{
  "ok": true,
  "tasks": [
    {
      "id": "task_001",
      "name": "测试任务 #1",
      "status": "running",
      "planId": "plan_001",
      "planName": "方案 A",
      "siteName": "目标站点 A",
      "runMode": "headless",
      "totalCases": 5,
      "completedCases": 3,
      "successCases": 2,
      "failedCases": 1,
      "startedAt": "2026-04-06T10:23:00Z",
      "createdAt": "2026-04-06T10:22:50Z",
      "updatedAt": "2026-04-06T10:25:30Z"
    }
  ]
}
```

### 2. 获取任务的 Case 列表

```
GET /api/platform/cases?taskId={taskId}
```

**响应：**
```json
{
  "ok": true,
  "cases": [
    {
      "id": "case_001",
      "taskId": "task_001",
      "name": "执行 #1",
      "sequence": 1,
      "status": "success",
      "startedAt": "2026-04-06T10:23:00Z",
      "finishedAt": "2026-04-06T10:24:00Z",
      "retryCount": 0,
      "maxRetries": 3,
      "exitCode": 0,
      "createdAt": "2026-04-06T10:23:00Z",
      "updatedAt": "2026-04-06T10:24:00Z",
      "runs": [
        {
          "id": "run_001",
          "status": "passed",
          "logs": [
            {
              "at": "2026-04-06T10:23:10Z",
              "stream": "stdout",
              "text": "开始执行测试..."
            }
          ]
        }
      ]
    },
    {
      "id": "case_002",
      "taskId": "task_001",
      "name": "执行 #2",
      "sequence": 2,
      "status": "failed",
      "startedAt": "2026-04-06T10:24:05Z",
      "finishedAt": "2026-04-06T10:25:30Z",
      "retryCount": 3,
      "maxRetries": 3,
      "exitCode": 1,
      "errorType": "timeout",
      "errorMessage": "页面加载超时",
      "createdAt": "2026-04-06T10:24:05Z",
      "updatedAt": "2026-04-06T10:25:30Z"
    }
  ]
}
```

### 3. 获取任务的产物列表

```
GET /api/platform/artifacts?taskId={taskId}
```

**响应：**
```json
{
  "ok": true,
  "artifacts": [
    {
      "id": "artifact_001",
      "taskId": "task_001",
      "caseId": "case_001",
      "type": "token",
      "name": "token_001.json",
      "href": "/api/platform/artifacts/artifact_001/download",
      "modifiedAt": "2026-04-06T10:24:00Z",
      "sizeBytes": 1024
    },
    {
      "id": "artifact_002",
      "taskId": "task_001",
      "caseId": "case_001",
      "type": "report",
      "name": "report_001.html",
      "href": "/api/platform/artifacts/artifact_002/download",
      "modifiedAt": "2026-04-06T10:24:00Z",
      "sizeBytes": 2048
    }
  ]
}
```

### 4. 下载任务的所有产物

```
GET /api/platform/tasks/{taskId}/download
```

**响应：** ZIP 文件（二进制流）

## 实现建议

### 后端需要做的调整

1. **Task 和 Case 的映射关系**
   - 当用户调用 `POST /api/platform/runs` 并设置 `runCount > 1` 时：
     - 创建 1 个 Task
     - 创建 N 个 Case（N = runCount）
     - 每个 Case 串行执行，失败时根据 `maxRetries` 重试

2. **状态同步**
   - Task 的状态根据 Case 的状态聚合：
     - 所有 Case 成功 → Task 状态 = `completed`
     - 任意 Case 失败 → Task 状态 = `failed`
     - 有 Case 运行中 → Task 状态 = `running`

3. **产物关联**
   - 产物需要同时关联 `taskId` 和 `caseId`
   - 前端通过 `taskId` 查询时，返回该 Task 下所有 Case 的产物

4. **兼容性**
   - 保留现有的 `/api/platform/runs` 接口（用于仪表盘的"最近运行"）
   - 新增 `/api/platform/tasks` 和 `/api/platform/cases` 接口

## 前端已完成的工作

1. ✅ 创建 `TaskCenterPage` 组件（三栏布局）
2. ✅ 实现任务列表（左侧栏）
3. ✅ 实现执行详情（中间栏）- 进度条和 Case 时间线
4. ✅ 实现产物面板（右侧栏）- 按类型分组
5. ✅ 更新路由配置（`/runs` → `/tasks`）
6. ✅ 更新侧边栏导航（"运行监控" → "任务中心"）
7. ✅ 更新仪表盘链接（指向 `/tasks`）
8. ✅ 扩展 TypeScript 类型定义

## 下一步

1. **后端实现**：按照本文档的 API 规范实现后端接口
2. **数据迁移**：将现有的 Run 数据映射到 Task/Case 结构
3. **测试**：启动前端开发服务器，验证界面和交互
4. **优化**：根据实际使用情况调整轮询频率和数据加载策略

---

**文档版本**: 1.0  
**最后更新**: 2026-04-06
