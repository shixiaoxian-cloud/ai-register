## ADDED Requirements

### Requirement: Manage Site Resources
The system SHALL allow operators to create, view, update, and organize site resources that represent authorized target sites.

#### Scenario: Create a site resource
- **WHEN** the user submits a new site with a valid target address and identifier
- **THEN** the system SHALL save the site resource in the platform SQLite store and make it available within `Config Center`

#### Scenario: Reject invalid site configuration
- **WHEN** the user attempts to save a site resource with an invalid or unsupported target address
- **THEN** the system SHALL reject the save and explain what must be corrected

### Requirement: Manage Test Plans Per Site
The system SHALL allow operators to create and maintain one or more test plans for a site resource.

#### Scenario: Create a plan under a site
- **WHEN** the user creates a plan from a site resource
- **THEN** the system SHALL associate the new plan with that site in the platform SQLite store and expose it as a reusable configuration for future runs

#### Scenario: Distinguish plans for the same site
- **WHEN** a site has multiple plans
- **THEN** the system SHALL present them as separate reusable resources rather than overwriting a single site configuration

### Requirement: Configure Target Profiles And Mail Settings
The system SHALL allow operators to manage target profile settings and email-related settings from `Config Center`.

#### Scenario: Edit target profile settings
- **WHEN** the user updates selector, outcome, or flow-related profile data for a plan
- **THEN** the system SHALL persist those settings as part of the SQLite-backed platform configuration model

#### Scenario: Edit mail configuration settings
- **WHEN** the user updates temporary mail or IMAP-related settings
- **THEN** the system SHALL persist those settings in the platform SQLite store and expose their readiness state to the console

### Requirement: Bootstrap Legacy File Configuration Into SQLite
The system SHALL support importing the current single-site file configuration into the SQLite-backed platform model during migration.

#### Scenario: Import target-site and temp-mail config
- **WHEN** the platform starts with existing `config/target-site.json` or `config/temp-mail.json` files present
- **THEN** the system SHALL be able to import those values into SQLite-backed `Site`, `Plan`, or `Mail Config` resources without requiring the operator to re-enter them manually

#### Scenario: Prefer SQLite after import
- **WHEN** the legacy configuration has already been imported into SQLite
- **THEN** the system SHALL treat the SQLite-backed records as the primary source for subsequent console reads and writes

### Requirement: Enforce Safety-Bound Configuration
The system SHALL reject configuration changes that would move the project outside its stated safety boundary.

#### Scenario: Reject unsupported bypass-oriented settings
- **WHEN** the user attempts to save a configuration that explicitly encodes CAPTCHA bypass, SMS bypass, or device challenge bypass behavior
- **THEN** the system SHALL reject the configuration and keep the previous safe configuration intact
