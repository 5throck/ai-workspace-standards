# Connector Schemas

## Purpose

The connector schemas provide reusable workflow connector contracts for coordination automations. This is the Single Source of Truth (SSOT) for trigger/event and action node contracts per integration (n8n-style node typing) that project-coordinator must cite when proposing any coordination automation in Phase 4.

This registry achieves benchmark parity with workflow automation platforms that maintain connector catalogs describing event payloads and action signatures. By declaring contracts as planning artifacts, scaffolded projects can bind these definitions to their chosen automation platform (n8n, Zapier, Make, or custom runners) without committing to a specific execution engine in the template.

**Decision record**: Closes `docs/variant-benchmark-backlog.md` section 8 "No workflow connector schema library" (gap closed 2026-08-25).

## Schema

The registry is a JSON document with the following structure:

### Root Fields

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | string | SemVer version string (e.g., "1.0.0") |
| `description` | string | Human-readable purpose statement |
| `conventions` | object | Naming and semantic rules for the pack |
| `connectors` | array of object | List of connector definitions |

### Conventions Object

| Key | Value Format | Description |
|-----|--------------|-------------|
| `node_id_format` | string | Pattern for node IDs: `<connector>.<event-or-action>` in kebab-case |
| `contract_semantics` | string | Contracts are planning artifacts, not executables |
| `auth` | string | Every connector declares an auth envelope placeholder |

### Connector Entry

Each object under `connectors` represents an integration category (e.g., "email", "calendar", "chat") and contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Connector identifier in kebab-case (e.g., "issue-tracker") |
| `name` | string | Human-readable connector name |
| `category` | string | Functional category (communication, coordination, project-management, etc.) |
| `auth` | object | Auth envelope placeholder definition |
| `triggers` | array of object | Event triggers this connector can emit |
| `actions` | array of object | Actions this connector can perform |
| `notes` | string | One-sentence usage context for co-work |

### Trigger Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Trigger node ID: `<connector>.<event-name>` in kebab-case |
| `description` | string | One-sentence description of when the trigger fires |
| `emits` | object | Payload shape with `fields` array listing emitted data |

### Action Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Action node ID: `<connector>.<action-name>` in kebab-case |
| `description` | string | One-sentence description of what the action does |
| `inputs` | object | Input specification with `required` and `optional` field arrays |
| `outputs` | object | Output shape with `fields` array listing returned data |

### Auth Envelope Object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Auth type: always "credentials-envelope" for planning artifacts |
| `fields` | array of string | Placeholder field names for credential binding |

## Connector Overview

| Connector | Category | Triggers | Actions | Use Case |
|-----------|----------|----------|---------|----------|
| Email | communication | 1 | 2 | Stakeholder notifications, review coordination |
| Calendar | coordination | 2 | 3 | Meeting schedules, milestone reviews |
| Chat | communication | 1 | 3 | Rapid team communication, status broadcasts |
| Issue Tracker | project-management | 2 | 3 | Action items, blockers from reviews |
| Forms | data-collection | 1 | 3 | Structured feedback collection |
| File Storage | content-management | 2 | 3 | Document drafts, deliverables, review artifacts |

## Per-Connector Contracts

### Email

| Type | ID | Description | Payload / Inputs / Outputs |
|------|----|----|----|
| **Trigger** | `email.message-received` | Fires when a message lands in the monitored mailbox | **Emits**: message_id, from, subject, received_at, body_excerpt |
| **Action** | `email.send` | Sends an email message | **Inputs Required**: to, subject, body <br> **Inputs Optional**: cc, attachments <br> **Outputs**: message_id, status |
| **Action** | `email.fetch-thread` | Retrieves conversation thread for a message | **Inputs Required**: message_id <br> **Outputs**: thread_id, messages, participants |

**Auth Envelope**: smtp_host, account_ref

### Calendar

| Type | ID | Description | Payload / Inputs / Outputs |
|------|----|----|----|
| **Trigger** | `calendar.event-started` | Fires when a calendar event begins | **Emits**: event_id, title, start_time, attendees, location |
| **Trigger** | `calendar.event-updated` | Fires when an event is modified | **Emits**: event_id, change_type, updated_fields, modified_by |
| **Action** | `calendar.create-event` | Creates a new calendar event | **Inputs Required**: title, start_time, end_time <br> **Inputs Optional**: attendees, location, description <br> **Outputs**: event_id, status, calendar_url |
| **Action** | `calendar.list-busy-slots` | Queries availability for scheduling | **Inputs Required**: participants, window_start, window_end <br> **Inputs Optional**: meeting_duration <br> **Outputs**: available_slots, conflicts, timezone |
| **Action** | `calendar.send-invite` | Sends calendar invitation to attendees | **Inputs Required**: event_id, attendee_list <br> **Inputs Optional**: message_body <br> **Outputs**: invite_id, response_status |

**Auth Envelope**: calendar_api, account_ref

### Chat

| Type | ID | Description | Payload / Inputs / Outputs |
|------|----|----|----|
| **Trigger** | `chat.message-posted` | Fires when a message is sent to a monitored channel | **Emits**: message_id, channel, author, timestamp, content |
| **Action** | `chat.post-message` | Posts a message to a channel | **Inputs Required**: channel, content <br> **Inputs Optional**: thread_parent, mentions <br> **Outputs**: message_id, timestamp, permalink |
| **Action** | `chat.create-channel` | Creates a new communication channel | **Inputs Required**: channel_name, purpose <br> **Inputs Optional**: members, private <br> **Outputs**: channel_id, invite_link, member_count |
| **Action** | `chat.add-reminder` | Sets a reminder for a message or deadline | **Inputs Required**: target, reminder_time <br> **Inputs Optional**: reminder_text <br> **Outputs**: reminder_id, scheduled_at |

**Auth Envelope**: workspace_api, channel_scope

### Issue Tracker

| Type | ID | Description | Payload / Inputs / Outputs |
|------|----|----|----|
| **Trigger** | `issue-tracker.issue-created` | Fires when a new issue is filed | **Emits**: issue_id, title, priority, reporter, labels |
| **Trigger** | `issue-tracker.issue-updated` | Fires when an issue changes state or fields | **Emits**: issue_id, change_type, old_value, new_value, changed_by |
| **Action** | `issue-tracker.create-issue` | Creates a new issue or work item | **Inputs Required**: title, description <br> **Inputs Optional**: priority, assignee, labels, due_date <br> **Outputs**: issue_id, status, web_url |
| **Action** | `issue-tracker.comment` | Adds a comment to an existing issue | **Inputs Required**: issue_id, comment_body <br> **Outputs**: comment_id, posted_at |
| **Action** | `issue-tracker.transition-status` | Moves an issue to a new workflow state | **Inputs Required**: issue_id, new_status <br> **Inputs Optional**: transition_comment <br> **Outputs**: issue_id, previous_status, current_status |

**Auth Envelope**: tracker_api, project_scope

### Forms

| Type | ID | Description | Payload / Inputs / Outputs |
|------|----|----|----|
| **Trigger** | `forms.response-submitted` | Fires when a form response is received | **Emits**: response_id, form_id, submitted_at, responses |
| **Action** | `forms.create-form` | Creates a new data collection form | **Inputs Required**: form_title, fields <br> **Inputs Optional**: description, confirmation_message <br> **Outputs**: form_id, form_url, field_count |
| **Action** | `forms.fetch-responses` | Retrieves all responses for a form | **Inputs Required**: form_id <br> **Inputs Optional**: filters, date_range <br> **Outputs**: response_count, responses, export_url |
| **Action** | `forms.send-reminder` | Sends reminder to incomplete respondents | **Inputs Required**: form_id, recipient_list <br> **Inputs Optional**: reminder_message, deadline <br> **Outputs**: reminder_id, sent_count, failed_recipients |

**Auth Envelope**: forms_api, form_scope

### File Storage

| Type | ID | Description | Payload / Inputs / Outputs |
|------|----|----|----|
| **Trigger** | `file-storage.file-created` | Fires when a file is uploaded or created | **Emits**: file_id, file_name, uploader, size_bytes, mime_type |
| **Trigger** | `file-storage.folder-updated` | Fires when folder contents change | **Emits**: folder_id, change_type, file_count, modified_by |
| **Action** | `file-storage.upload` | Uploads a file to storage | **Inputs Required**: file_path, destination_folder <br> **Inputs Optional**: permissions, metadata <br> **Outputs**: file_id, download_url, size_bytes |
| **Action** | `file-storage.share-link` | Creates a shareable link for a file or folder | **Inputs Required**: resource_id <br> **Inputs Optional**: expiration, access_level, password <br> **Outputs**: share_url, access_token, expires_at |
| **Action** | `file-storage.move` | Moves a file to a different location | **Inputs Required**: file_id, target_folder <br> **Inputs Optional**: new_name <br> **Outputs**: file_id, previous_path, new_path |

**Auth Envelope**: storage_api, bucket_scope

## Consumption Contract

### project-coordinator Usage

When proposing any coordination automation in Phase 4 (Iterative Stakeholder Review), project-coordinator MUST:

1. **Cite the contract**: Specify the connector id and node id from this pack (e.g., "email.message-received trigger → chat.post-message action")
2. **Explain the flow**: Describe how the trigger event feeds into the action inputs
3. **Declare placeholder binding**: Acknowledge that credentials are bound in the scaffolded project, not in the template
4. **Obtain PM approval**: Proposals without contract citations are rejected at PM review

**Example proposal format**:
```
Automation: Stakeholder review reminder
- Trigger: calendar.event-started (connector: calendar, event_id: review_meeting)
- Action: chat.post-message (channel: #stakeholder-updates, content: "Review meeting starting now")
- Auth: Bound via workspace_api and calendar_api in scaffolded project
```

### Planning-Artifact Boundary

These contracts are **planning artifacts**, not execution code:

- The template ships NO automation runner or workflow engine
- Contracts describe trigger event payload shapes and action input/output shapes
- Scaffolded projects bind contracts to their chosen automation platform
- n8n node typing is the parity target for the contract structure
- Credentials are never stored in the template; projects bind via environment

### Extending the Registry

To add new connectors or modify existing ones:

1. **New connector**: Add a new object under `connectors` with a unique `id` in kebab-case
2. **New trigger/action**: Extend the `triggers` or `actions` array for an existing connector
3. **Additive changes**: Bump the minor version (e.g., "1.0.0" → "1.1.0")
4. **Breaking changes**: Bump the major version (e.g., "1.0.0" → "2.0.0") and record in project CHANGELOG
5. **Domain rationale**: New connectors require PM approval documenting the workplace-collaboration use case

### Version Governance

The schema version lives in the JSON `schema_version` field. Changes follow the standard PR flow via `/sync`:

- **Minor version bumps**: Additive changes (new connectors, new triggers/actions, new optional fields)
- **Major version bumps**: Breaking changes (removed IDs, renamed fields, incompatible schema changes, removed required fields)

All changes must pass validation (`bun scripts/validate-templates.ts`) and language checks (`bun scripts/validate-md-language.ts`) before merging.
