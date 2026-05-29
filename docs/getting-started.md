# Getting Started

> **Prerequisites and installation guide for AI Workspace Standards**

This guide covers the software you need to install before using this workspace effectively.

---

## 🔧 Essential Software (Must-Have)

> **Required for all users**: Git and Bun are mandatory for workspace functionality and project creation.

### 1. Git

**Purpose**: Version control, git hooks automation

**Installation**:
```bash
# Windows (winget - recommended)
winget install Git.Git

# Windows (manual installer)
https://git-scm.com/download/win

# macOS
brew install git

# Linux (Ubuntu/Debian)
sudo apt install git

# Linux (Fedora/RHEL)
sudo dnf install git
```

**Verification**:
```bash
git --version
# Expected output: git version 2.x.x or higher
```

**Post-install**:
```bash
# Activate workspace git hooks
git config core.hooksPath .githooks
```

---

### 2. Bun ⭐ (REQUIRED - Breaking Change)

**Purpose**: TypeScript helper script execution, project creation, validation

**Installation**:
```bash
# All platforms
curl -fsSL https://bun.sh/install | bash

# Or use PowerShell (Windows)
powershell -c "irm bun.sh/install.ps1 | iex"

# Or use the automated install script
bash scripts/install-bun.sh      # Unix/Linux/macOS
pwsh scripts/install-bun.ps1      # Windows
```

**Verification**:
```bash
bun --version
# Expected output: 1.x.x or higher
```

**Why Required**: As of the latest update, all Python inline code and PowerShell native code have been replaced with TypeScript helper scripts. Bun is now required for:
- Project creation (`new-project.sh/ps1`)
- Template validation
- Placeholder substitution
- All workspace automation scripts

---

## 🎯 Optional Software (Recommended)

> **Install as needed**: These tools are not required for basic workspace functionality but enhance the experience.

### 1. GitHub CLI (gh)

**Purpose**: Script execution

**By Platform**:
- **Windows**: PowerShell 5.1+ (built-in) or PowerShell 7+
- **macOS/Linux**: Bash (built-in)
- **Windows Git Bash**: Included with Git for Windows

**PowerShell 7 (Optional Upgrade)**:
```bash
# Windows: winget install Microsoft.PowerShell
# macOS: brew install --cask powershell
# Linux: https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux
```

---

## 🎯 Optional Software (Recommended)

### 5. GitHub CLI (gh)

**Purpose**: PR creation/management, GitHub workflow automation

**Installation**:
```bash
# Windows: winget install GitHub.cli
# macOS: brew install gh
# Linux (Ubuntu/Debian): sudo apt install gh
# Linux (Fedora/RHEL): sudo dnf install gh
# Or: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

**Verification**:
```bash
gh --version
# Expected output: gh version 2.x.x or higher
```

**Post-install**:
```bash
# Authenticate with GitHub
gh auth login
```

---

### 2. Python 3 (Project-Specific)

**Purpose**: Required **only** when creating Python projects

**When You Need It**:
- Creating Python projects
- Running `scripts/setup.sh` for Python projects
- Python project dependency management

**Installation** (if creating Python projects):
```bash
# Windows: https://www.python.org/downloads/
# macOS: brew install python@3
# Linux (Ubuntu/Debian): sudo apt install python3 python3-pip
```

**Verification**:
```bash
python3 --version
# Expected output: Python 3.8 or higher
```

### 3. uv (Python Package Manager - Optional)

**Purpose**: Faster Python dependency management (alternative to pip)

**Installation**:
```bash
# All platforms
curl -LsSf https://astral.sh/uv/install.sh | sh
# or
pip install uv
```

**Verification**:
```bash
uv --version
```

---

## 📋 Project-Specific Tools

> **Install as needed**: These tools are required only when creating projects of specific types.

Depending on the type of project you create, additional tools may be required:

| Project Type | Required Tools | Installation |
|-------------|---------------|--------------|
| **Node.js** | Node.js + npm | [nodejs.org](https://nodejs.org/) |
| **Python** | Python 3 + pip or uv | See Python 3 above |
| **.NET** | .NET SDK | [dotnet.microsoft.com](https://dotnet.microsoft.com/download) |
| **Rust** | Rust toolchain | `rustup` (rust-lang.org) |
| **Go** | Go toolchain | [go.dev](https://go.dev/dl/) |
| **Java/Maven** | JDK + Maven | [openjdk.org](https://openjdk.org/) |
| **Java/Gradle** | JDK + Gradle | [gradle.org](https://gradle.org/install/) |
| **Ruby** | Ruby + Bundler | [ruby-lang.org](https://www.ruby-lang.org/) |
| **Elixir** | Elixir + Mix | [elixir-lang.org](https://elixir-lang.org/) |
| **C/C++** | CMake | [cmake.org](https://cmake.org/download/) |

> **Note**: The `scripts/setup.sh/ps1` script will automatically detect and install dependencies for your project type.

---

## 📋 Pre-Installation Checklist

Run this checklist to verify your essential tools:

```bash
#!/usr/bin/env bash
# Environment verification script

echo "=== AI Workspace Standards - Pre-Installation Checklist ==="
echo ""

# Git
if command -v git &>/dev/null; then
  echo "✅ Git: $(git --version)"
else
  echo "❌ Git not installed"
  echo "   Install from: https://git-scm.com/downloads"
fi

# Bun
if command -v bun &>/dev/null; then
  echo "✅ Bun: $(bun --version)"
else
  echo "❌ Bun not installed"
  echo "   Run: curl -fsSL https://bun.sh/install | bash"
  echo "   Or: bash scripts/install-bun.sh"
fi

echo ""
echo "=== Essential Tools Complete ==="
echo ""
echo "Optional tools (install as needed):"
echo "  - Python 3 (for Python projects)"
echo "  - GitHub CLI (for PR automation)"
echo "  - uv (for faster Python package management)"
```

**Full verification script** (includes optional tools):
```bash
# Check all tools including optional
check-env-full.sh
```

Save this as `check-environment.sh`, make it executable, and run:
```bash
chmod +x check-environment.sh
./check-environment.sh
```

---

## 🚀 Quick Start Guide

### 1. Clone Workspace

```bash
# Windows
git clone https://github.com/5throck/ai-workspace-standards.git C:\git
cd C:\git

# macOS/Linux
git clone https://github.com/5throck/ai-workspace-standards.git ~/git
cd ~/git
```

### 2. Install Essential Software

```bash
# 1. Install Git (if not installed)
# See instructions above

# 2. Activate git hooks
git config core.hooksPath .githooks

# 3. Install Bun (REQUIRED)
bash scripts/install-bun.sh
# or Windows: pwsh scripts/install-bun.ps1

# 4. Verify installation
git --version
bun --version
```

### 3. (Optional) Install GitHub CLI

```bash
# Install gh
# See instructions above

# Authenticate
gh auth login
```

### 4. Create Your First Project

```bash
# Default (latest template, co-develop variant)
bash scripts/new-project.sh "my-project-name"

# Or specify variant
bash scripts/new-project.sh "my-project-name" --variant co-design

# Windows PowerShell
.\scripts\new-project.ps1 "my-project-name"
```

### 5. Move to Project and Start AI Session

```bash
cd "my-project-name"
claude    # or agy for Gemini
```

---

## 💡 Installation Tips

### Windows Users
1. Install **Git for Windows** first (includes Git Bash)
2. Install **PowerShell 7** for better scripting experience
3. Run scripts in **Git Bash** or **PowerShell** (not CMD)

### macOS Users
1. Install [Homebrew](https://brew.sh/) for easy package management
2. Use Homebrew to install most tools: `brew install git python3`

### Linux Users
1. Use your distribution's package manager
2. Ubuntu/Debian: `sudo apt install git python3`
3. Fedora/RHEL: `sudo dnf install git python3`

---

## 🔍 Troubleshooting

### "bun: command not found"
- **Cause**: Bun not installed or not in PATH
- **Solution**: 
  ```bash
  # Reinstall Bun
  curl -fsSL https://bun.sh/install | bash
  # Or use the automated script
  bash scripts/install-bun.sh
  ```

### "python3: command not found"
- **Cause**: Python 3 not installed or not in PATH
- **Solution**: Install Python 3 from python.org or your package manager

### "git hooks not working"
- **Cause**: `core.hooksPath` not configured
- **Solution**:
  ```bash
  git config core.hooksPath .githooks
  ```

### PowerShell scripts blocked on Windows
- **Cause**: Execution policy restriction
- **Solution**:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## 📚 Next Steps

After completing the installation:

1. 📖 Read [README.md](../README.md) for project overview
2. 🚀 Create your first project using `scripts/new-project.sh/ps1`
3. 🤖 Start an AI session in your new project directory
4. 📋 Configure project-specific tools using `scripts/setup.sh/ps1`

---

## 🆘 Need Help?

- **Installation Issues**: Check [Troubleshooting](#-troubleshooting) section
- **Usage Questions**: See [README.md](../README.md) or [CONSTITUTION.md](../CONSTITUTION.md)
- **Bug Reports**: Open an issue on GitHub
- **Community**: Join discussions in GitHub Issues

---

**Last Updated**: 2026-05-29
