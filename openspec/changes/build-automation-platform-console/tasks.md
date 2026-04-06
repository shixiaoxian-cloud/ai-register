## 1. Frontend Foundation

- [x] 1.1 Create the React 18 + TypeScript + Vite console workspace and add npm scripts for local development and production build (`platform-console-shell`).
- [x] 1.2 Implement the shared application shell, primary routing, and typed API client for `Overview`, `Config Center`, `Runs`, `Artifacts`, and `System` (`platform-console-shell`).
- [x] 1.3 Establish shared design tokens, status cards, navigation, and layout primitives that replace the legacy standalone page chrome (`platform-console-shell`).

## 2. SQLite Platform Persistence

- [x] 2.1 Design and implement the SQLite schema and repository layer for `Site`, `Plan`, `Target Profile`, `Mail Config`, `Task`, `Case`, `Run`, and `Artifact`, including content metadata and blob storage strategy (`site-plan-management`, `run-artifact-operations`).
- [x] 2.2 Build bootstrap / migration adapters that can import existing `config/*.json`, `output_tokens/`, `runtime/control-plane/tasks/`, `artifacts/tasks/`, `playwright-report/`, and `test-results/` into the SQLite platform store.
- [x] 2.3 Add server-side validation and masking rules that reject unsupported bypass-oriented configuration inputs, prevent raw token leakage in list APIs, and preserve the existing safe mission boundary (`site-plan-management`, `run-artifact-operations`).

## 3. Overview And Config Center

- [x] 3.1 Extend the local Node service with SQLite-backed resource-oriented read/write endpoints for sites, plans, profiles, mail configuration, and overview summary metrics (`platform-console-shell`, `site-plan-management`).
- [x] 3.2 Build the `Overview` workspace with platform summary cards, recent activity, storage health, and direct links into configuration, execution, and artifact flows (CUJ-01, CUJ-03).
- [x] 3.3 Build `Config Center` views for site and plan management, including create/edit flows for multiple plans per site and persistence to SQLite (CUJ-06).
- [x] 3.4 Build target profile and mail configuration editors with persisted save, load, readiness feedback, and legacy-import visibility states (CUJ-04, CUJ-06).

## 4. Runs And Artifacts Experience

- [x] 4.1 Build the `Runs` workspace with task/case/run execution lists, run detail view, and human-readable stage/status presentation (CUJ-01, CUJ-02, CUJ-05).
- [x] 4.2 Integrate live/latest log viewing and manual intervention guidance into the run detail experience, and archive the captured logs into SQLite on completion (`run-artifact-operations`).
- [x] 4.3 Build the SQLite-backed artifact ingestion pipeline for reports, logs, media, trace data, summaries, and token outputs, including metadata association to task, case, and run (`run-artifact-operations`).
- [x] 4.4 Build the `Artifacts` workspace for browsing reports, logs, media, trace data, and token outputs, including filtering by task, case, and run (CUJ-03).
- [x] 4.5 Add task-scoped download endpoints and UI actions that bundle the selected task's archived artifacts, including token exports, into a downloadable package (`run-artifact-operations`).

## 5. Migration And Verification

- [x] 5.1 Wire the built console and SQLite store into the local service runtime, remove legacy entrypoints from the operator flow, and make the new console the only supported UI entry.
- [x] 5.2 Update the relevant design and implementation docs to reflect the new platform console structure, storage model, routing model, and operator workflow.
- [x] 5.3 Validate the new console with typecheck/build and smoke-test the config, run, log, report, token archive, and task download flows against the local Playwright service.
