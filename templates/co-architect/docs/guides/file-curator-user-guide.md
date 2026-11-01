# File Curator User Guide

## Installation

### Prerequisites

- Python 3.11 or higher
- pip (Python package manager)

### Step-by-Step Installation

1. **Install dependencies**
   ```bash
   pip install watchdog python-dotenv
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your paths
   ```

3. **Verify installation**
   ```bash
   python -m file_curator.main --help
   ```

## Configuration

Edit `.env` file:

```bash
# Directories to monitor
MONITORED_PATHS=/path/to/projects,/path/to/another

# Backup storage location
BACKUP_ROOT=/path/to/backups

# File patterns to monitor
FILE_PATTERNS=*.dwg,*.DWF,*.DXF

# Version naming format
VERSION_FORMAT={project_name}_{timestamp}

# Lock timeout (seconds)
LOCK_TIMEOUT=30
```

## Usage

### Starting the Service

```bash
python -m file_curator.main
```

### Recovering Files

```python
from file_curator.main import FileCuratorService
from pathlib import Path

service = FileCuratorService()

# Recover latest version
service.recover_latest(Path("project.dwg"))

# List available versions
versions = service.list_versions("project")
for version in versions:
    print(f"{version.name} - {version.stat().st_mtime}")
```

## Backup Structure

```
backups/
├── apartment_design_202506151430.dwg    # Latest version
├── office_tower_202506151445.dwg
└── archive/
    ├── apartment_design/
    │   ├── apartment_design_202506151420_archived_202506151430.dwg
    │   └── ...
    └── office_tower/
        └── ...
```

## Troubleshooting

### File not being backed up
- Check file matches pattern in `FILE_PATTERNS`
- Verify path is in `MONITORED_PATHS`
- Check file permissions

### Recovery fails
- Verify backup exists in `BACKUP_ROOT`
- Check file is not locked by ZWCAD
- Review logs for specific error messages

### High memory usage
- Reduce number of monitored paths
- Check for file system errors
- Verify watchdog is functioning correctly

### Permission errors
- Ensure write access to backup directory
- Check file system permissions
- Run with appropriate user privileges

## Advanced Features

### Custom File Patterns

Configure specific file patterns in `.env`:

```bash
FILE_PATTERNS=*.dwg,*.DWG,*.DXF,*.dxf
```

### Multiple Project Directories

Monitor multiple project paths:

```bash
MONITORED_PATHS=/projects/apartment,/projects/office,/projects/retail
```

### Programmatic Access

```python
from file_curator.main import FileCuratorService
from pathlib import Path

# Create service with custom configuration
service = FileCuratorService(
    monitored_paths=[Path("/custom/path")],
    backup_root=Path("/custom/backup")
)

# Start monitoring
service.start()

# Recover specific file
service.recover_latest(Path("drawing.dwg"))

# List all versions
versions = service.list_versions("drawing")
```

## Best Practices

### 1. Regular Backup Verification
- Test recovery procedures regularly
- Verify backup integrity
- Check storage space availability

### 2. Configuration Management
- Keep `.env` file backed up
- Document custom configurations
- Test configuration changes before deployment

### 3. Monitoring Setup
- Start service during work hours
- Monitor logs for errors
- Verify file creation/modification events

### 4. Storage Management
- Monitor backup storage usage
- Clean up old archives periodically
- Ensure sufficient disk space

### 5. Integration with Workflow
- Start service automatically when beginning work
- Stop service gracefully when finished
- Coordinate with team backup procedures

## Technical Details

### File Change Detection

The system uses SHA-256 hashing to detect actual file changes:

```python
# Only backs up when file content actually changes
# Not just metadata modifications (timestamps, permissions)
```

### Version Naming

Automatic timestamp-based versioning:

```python
# Format: {project_name}_{timestamp}{extension}
# Example: apartment_design_202506151430.dwg
```

### Archive Organization

Previous versions automatically archived:

```python
# Current: backups/project_202506151430.dwg
# Archive: backups/archive/project/project_202506151420_archived_202506151430.dwg
```

## API Reference

### FileCuratorService

#### Constructor
```python
FileCuratorService(monitored_paths=None, backup_root=None)
```

#### Methods
- `start()`: Start file monitoring service
- `stop()`: Stop file monitoring service
- `recover_latest(file_path: Path)`: Recover latest backup
- `list_versions(project_name: str)`: List all available versions

### Configuration

#### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MONITORED_PATHS` | Directories to monitor | Current directory | Yes |
| `BACKUP_ROOT` | Backup storage location | `./backups` | No |
| `FILE_PATTERNS` | File patterns to monitor | `*.dwg,*.DWG,*.DXF` | No |
| `VERSION_FORMAT` | Version naming format | `{project_name}_{timestamp}` | No |
| `LOCK_TIMEOUT` | File lock timeout (seconds) | `30` | No |

## System Requirements

### Minimum Requirements
- Python 3.11+
- 100MB free disk space for backups
- File system monitoring permissions

### Recommended Configuration
- Python 3.11+
- 1GB free disk space for backups
- SSD storage for better performance
- Dedicated backup directory

## Limitations

### Known Limitations
- Requires file system access (not network-based)
- No real-time collaboration features
- No conflict resolution for simultaneous edits
- Backup size limited by available disk space

### Future Enhancements
- Network file sharing support
- Cloud backup integration
- Conflict detection and resolution
- Web-based management interface

## Support

### Getting Help
- Check logs for error messages
- Verify configuration in `.env` file
- Test file permissions and access
- Review system requirements

### Common Issues Resolution

1. **Service won't start**
   - Check Python version (3.11+ required)
   - Verify all dependencies installed
   - Check configuration file syntax

2. **Files not being backed up**
   - Verify file patterns match your files
   - Check monitored paths are correct
   - Ensure file system permissions

3. **Recovery failures**
   - Verify backup exists in backup directory
   - Check file is not locked by ZWCAD
   - Review error messages in logs

4. **Performance issues**
   - Reduce number of monitored directories
   - Check system resources availability
   - Verify file system performance