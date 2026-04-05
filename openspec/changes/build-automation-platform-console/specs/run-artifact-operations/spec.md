## ADDED Requirements

### Requirement: Run Workspace For Execution Records
The system SHALL provide a dedicated `Runs` workspace that lists execution records and allows users to open a run detail view.

#### Scenario: Browse recent runs
- **WHEN** the user opens `Runs`
- **THEN** the system SHALL show recent run records with enough metadata to identify the related site, plan, task, status, and execution time

#### Scenario: Open a run detail view
- **WHEN** the user selects a run record
- **THEN** the system SHALL display a run detail view with stage, status, and related artifact links

### Requirement: Surface Stage And Intervention State
The system SHALL show stage progression and any required manual intervention state for a run.

#### Scenario: Show stage progression
- **WHEN** a run emits stage updates or a final outcome
- **THEN** the run detail view SHALL show the latest known stage and outcome in a human-readable form

#### Scenario: Show manual intervention guidance
- **WHEN** a run is waiting on manual challenge completion or similar human action
- **THEN** the run detail view SHALL surface that waiting state and the next expected user action

### Requirement: Live Run Logs
The system SHALL provide access to live or latest run logs from within the run detail experience.

#### Scenario: View log stream for an active run
- **WHEN** the selected run is still active
- **THEN** the system SHALL display new log entries without requiring the user to leave the run detail workspace

#### Scenario: View logs for a completed run
- **WHEN** the selected run has completed
- **THEN** the system SHALL provide the captured logs associated with that run

### Requirement: Archive Run Artifacts In SQLite
The system SHALL archive structured and binary run artifacts in the platform SQLite store so that the console does not depend on raw filesystem paths as its primary source.

#### Scenario: Archive token and summary outputs
- **WHEN** a run produces token outputs, journey summaries, or structured logs
- **THEN** the system SHALL persist those artifacts in SQLite with metadata that associates them to the related task, case, and run

#### Scenario: Archive report and media outputs
- **WHEN** a run produces reports, screenshots, trace data, video, or similar binary outputs
- **THEN** the system SHALL persist those artifacts in SQLite with metadata describing category, content type, size, and ownership

### Requirement: Artifact Center Across Runs
The system SHALL provide an `Artifacts` workspace that allows users to browse reports and output artifacts across runs.

#### Scenario: Browse artifacts by type
- **WHEN** the user opens `Artifacts`
- **THEN** the system SHALL allow browsing reports, logs, media, trace data, and token outputs as separate artifact categories

#### Scenario: Filter artifacts by task or run
- **WHEN** the user selects or filters by a specific task or run
- **THEN** the artifact workspace SHALL narrow the displayed artifacts to those produced by that task or run

### Requirement: Task-Scoped Artifact Download
The system SHALL allow operators to download the archived outputs for a task as a single bundled package.

#### Scenario: Download all artifacts for a task
- **WHEN** the user triggers download for a completed task
- **THEN** the system SHALL generate and return a downloadable package containing the archived reports, logs, media, trace data, and token outputs associated with that task

#### Scenario: Preserve task grouping in downloaded package
- **WHEN** the system builds a task download package
- **THEN** the package SHALL preserve enough structure or metadata for the operator to identify which task, case, and run each artifact came from
