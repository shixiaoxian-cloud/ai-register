## ADDED Requirements

### Requirement: Unified Platform Shell
The system SHALL provide a single platform console shell with persistent primary navigation for `Overview`, `Config Center`, `Runs`, `Artifacts`, and `System`.

#### Scenario: Navigate between primary workspaces
- **WHEN** the user selects a primary navigation item
- **THEN** the console SHALL load the corresponding workspace within the same application shell

#### Scenario: Show the active workspace
- **WHEN** the user is viewing a workspace
- **THEN** the console SHALL visually indicate which primary navigation item is active

### Requirement: Platform Overview
The system SHALL provide an overview workspace that summarizes platform health across sites, plans, recent runs, artifacts, and email configuration readiness.

#### Scenario: Render overview summary cards
- **WHEN** the user opens `Overview`
- **THEN** the console SHALL display summary information for available sites, configured plans, recent run outcomes, and key platform alerts

#### Scenario: Offer actionable shortcuts from overview
- **WHEN** the overview detects recent activity or missing configuration
- **THEN** the console SHALL provide direct links to the relevant configuration, run, or artifact workspace

### Requirement: Shared Console Presentation Baseline
The system SHALL render the platform through a shared presentation baseline so that all primary workspaces use a consistent layout, navigation behavior, and status language.

#### Scenario: Reuse shared layout rules
- **WHEN** the user moves from one workspace to another
- **THEN** the console SHALL preserve consistent page chrome, spacing, navigation placement, and status component behavior

#### Scenario: Preserve usability on common operator screens
- **WHEN** the console is rendered on a standard desktop or laptop viewport
- **THEN** the primary navigation, page title area, and main content area SHALL remain usable without relying on the legacy standalone pages
