# File Curator Agent Architecture

## Overview

File Curator Agent provides automated file management for ZWCAD .dwg files with real-time monitoring, version control, and backup recovery capabilities designed for architecture office workflow.

## System Architecture

```
┌─────────────────┐
│  ZWCAD Desktop  │
│  (User saves    │
│   .dwg file)    │
└────────┬────────┘
         │ File write event
         ↓
┌─────────────────┐
│  FileMonitor    │ ← watchdog-based file system observer
│  - Detects .dwg │   - Real-time change detection
│    file changes │   - SHA-256 hash verification
└────────┬────────┘
         │ Change event
         ↓
┌─────────────────┐
│ VersionManager │ ← Backup and version control
│  - Timestamped │   - Automatic backup creation
│    backups     │   - Archive previous versions
│  - Version      │   - Project-based organization
│    labeling     │
└────────┬────────┘
         │ Backup file
         ↓
┌─────────────────┐
│  Backup Storage │ ← File system storage
│  /backups/      │   - Current versions
│  /archive/      │   - Archived versions
└─────────────────┘

┌─────────────────┐
│ RecoveryManager │ ← On-demand recovery
│  - Restore      │   - Latest version recovery
│    operations   │   - Specific version recovery
└─────────────────┘
```

## Key Components

### FileMonitor
- Uses Python `watchdog` library for cross-platform file system monitoring
- SHA-256 hashing to detect actual file changes (not just metadata)
- Configurable file patterns (.dwg, .DXF, etc.)
- Thread-safe operations with threading.Lock()

### VersionManager
- Automatic timestamped version naming: `project_YYYYMMDDHHMM.dwg`
- Archive previous versions before creating new ones
- Project-based folder organization
- Query methods for latest backup and version listing

### RecoveryManager
- Restore latest backup with one command
- Restore specific historical versions
- Pre-restore emergency backup creation
- Integration with VersionManager

### Config
- Environment variable loading from .env file
- Configurable monitored paths and file patterns
- Automatic backup directory creation
- Type-safe configuration with pathlib.Path

## Data Flow

1. **User saves .dwg file in ZWCAD**
2. **FileMonitor detects file modification**
3. **SHA-256 hash verifies actual content change**
4. **VersionManager creates timestamped backup**
5. **Previous version moved to archive**
6. **User can recover any version via RecoveryManager**

## Technology Stack

- **Python 3.11+**: Core runtime environment
- **watchdog**: File system monitoring library
- **hashlib**: SHA-256 hashing for content verification
- **shutil**: File operations with metadata preservation
- **pathlib**: Cross-platform path handling
- **threading**: Thread-safe operations
- **python-dotenv**: Environment variable management

## Component Interactions

### FileMonitor → VersionManager
- Real-time file change events trigger automatic backups
- Callback-based architecture: `on_created_callback`, `on_modified_callback`
- SHA-256 hash verification prevents duplicate backups

### VersionManager ↔ RecoveryManager
- RecoveryManager uses VersionManager for backup queries
- VersionManager provides file version history
- Coordinated backup/restore operations

### Config → All Components
- Centralized configuration management
- Environment-based settings
- Type-safe path handling

## Error Handling

### File System Errors
- Permission issues handling
- Disk space monitoring
- File access error recovery

### Version Management Errors
- Hash computation failures
- Backup creation failures
- Archive operation errors

### Recovery Errors
- Missing backup files
- Restore operation failures
- Pre-restore backup creation

## Performance Considerations

### Memory Optimization
- Thread-safe hash tracking
- Efficient file operations with shutil.copy2
- Minimal memory footprint during monitoring

### Storage Optimization
- Automatic archiving of previous versions
- Project-based folder organization
- Efficient backup storage structure

### System Performance
- Real-time file system monitoring
- Asynchronous event processing
- Graceful shutdown with signal handlers

## Security Considerations

### Data Protection
- SHA-256 hash verification for file integrity
- Metadata preservation during file operations
- Pre-restore emergency backups

### Access Control
- File system permission handling
- Configurable monitored paths
- Safe backup/restore operations

## Integration Points

### ZWCAD Integration
- File system monitoring approach (no direct API)
- Works across ZWCAD versions
- Technology-agnostic implementation

### Environment Configuration
- .env file for easy configuration
- Environment variable support
- Development/production configuration flexibility

## History / Implementation Log

> Folded in from the original implementation plan (`docs/planning/plans/2026-06-15-file-curator-agent.md`, 2026-06-15) as part of the DOCS-001 docs/ taxonomy reorg. The plan predates the current `src/file_curator/` package that has since shipped; retained here as a historical record of the build sequence rather than a live checklist.

**Goal:** Build an automated file management system for ZWCAD .dwg files with version control, backup, and recovery capabilities.

**Tech Stack:** Python 3.11+, `watchdog` (file monitoring), `hashlib` (SHA-256), `shutil` (file operations), `pathlib` (path handling).

**Implementation sequence (TDD, test-first per task):**

1. **Project Setup and Infrastructure** — `src/file_curator/__init__.py`, `pyproject.toml` dependencies (`watchdog`, `python-dotenv`), `.env.example` configuration template, CHANGELOG entry.
2. **Configuration Management** — `src/file_curator/config.py` (`Config` class): loads `MONITORED_PATHS`, `BACKUP_ROOT`, `FILE_PATTERNS`, `VERSION_FORMAT`, `LOCK_TIMEOUT` from environment via `python-dotenv`; validated by `tests/test_config.py`.
3. **File System Monitoring** — `src/file_curator/monitor.py` (`FileMonitor` class): `watchdog`-based `FileSystemEventHandler` subclass; SHA-256 hash comparison (`_is_real_change`) to avoid false-positive events from metadata-only touches; configurable `on_created`/`on_modified` callbacks; validated by `tests/test_monitor.py` (creation, modification, non-`.dwg` file exclusion).
4. **Version Management and Backup** — `src/file_curator/version_manager.py` (`VersionManager` class): timestamped backup naming (`{project_name}_{timestamp}`), automatic archiving of superseded versions to `backups/archive/<project>/`, `get_latest_backup`/`list_versions` queries; validated by `tests/test_version_manager.py`.
5. **Recovery Procedures** — `src/file_curator/recovery.py` (`RecoveryManager` class): `restore_latest`/`restore_version`, with a pre-restore emergency backup (`_pre_restore_backup`) taken before any overwrite; validated by `tests/test_recovery.py`.
6. **Service Orchestration** — `src/file_curator/main.py` (`FileCuratorService` class): wires `Config` → `FileMonitor` → `VersionManager` → `RecoveryManager`, with `SIGINT`/`SIGTERM` graceful shutdown; validated by `tests/test_integration.py` (full monitor → backup → archive → recover workflow).
7. **Documentation** — original plan called for `docs/file_curator_architecture.md` and `docs/file_curator_user_guide.md`; these shipped as (and are now superseded by) this document (`docs/reference/file-curator-architecture.md`, formerly `docs/architecture/technical/file-curator-architecture.md`) and `docs/guides/file-curator-user-guide.md` respectively.
8. **Testing and Quality Assurance** — `tests/test_all.py` smoke-checks project layout and runs the full suite with coverage (`pytest --cov=src/file_curator`), target >80%.
9. **Final Integration and Cleanup** — full test suite + coverage report; documentation completeness check; final commit.

**Success criteria (as originally specified):** all tests passing; code coverage >80%; documentation complete; real-time `.dwg` monitoring; timestamped backups; version recovery; ready for pilot deployment.

**Post-implementation follow-ups noted in the original plan:** deploy to pilot project, monitor for two weeks, collect user feedback, plan Phase 2 rollout (Project Assistant). Current status of these follow-ups is tracked separately from this historical log — see `src/file_curator/` and `_file_curator_notify` usage in `src/cad_intelligence/cad_io/com_bridge.py` / `handlers/drawing.py` for the live integration.