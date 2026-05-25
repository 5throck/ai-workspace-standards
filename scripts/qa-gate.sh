#!/bin/bash
# QA Gate Automation - Phase 5
# Run by Consistency Auditor to verify workspace standards

echo "🔬 QA Gate - Phase 5"
echo "===================="

# 1. Workspace audit
echo "Step 1: Workspace standards audit..."
bash scripts/audit.sh
if [ $? -ne 0 ]; then
    echo "❌ FAIL: audit.sh failed"
    exit 1
fi

# 2. Project-specific tests (if package.json exists)
if [ -f "package.json" ]; then
    echo "Step 2: Running project tests..."
    if grep -q '"test"' package.json; then
        npm test
        if [ $? -ne 0 ]; then
            echo "❌ FAIL: Tests failed"
            exit 1
        fi
    else
        echo "⚠️  SKIP: No test script found in package.json"
    fi
fi

# 3. Documentation consistency checks
echo "Step 3: Checking documentation consistency..."

# Check AGENTS.md exists
if [ ! -f "AGENTS.md" ]; then
    echo "❌ FAIL: AGENTS.md not found"
    exit 1
fi

# Check README.md has Korean pair (for templates only)
if [ -f "templates/README.md" ] && [ ! -f "templates/README_ko.md" ]; then
    echo "❌ FAIL: templates/README.md exists but templates/README_ko.md missing"
    exit 1
fi

echo "✅ QA PASS"
echo "==========="
exit 0