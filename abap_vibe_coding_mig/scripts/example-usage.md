# PM Gateway Health Monitoring - Usage Examples

## Overview
This document demonstrates how to use the PM Gateway Health Monitoring system in your ABAP Vibe Coding migration project.

## Basic Usage

### 1. Import and Log Executions

```typescript
// In your PM Gateway implementation, import the logging functions
import { logExecution, createHealthData, saveHealthData } from './monitor-pm-gateway-health.ts';

// Get current health data
let healthData = createHealthData();

// Log a successful PM Gateway execution
const successExecution = {
  timestamp: new Date().toISOString(),
  success: true,
  failureType: null,
  workflow: 'code-writer dispatch'
};

healthData = logExecution(healthData, successExecution);

// Log a failed PM Gateway execution
const failedExecution = {
  timestamp: new Date().toISOString(),
  success: false,
  failureType: 'llm-api',
  workflow: 'test-runner dispatch',
  errorMessage: 'Rate limit exceeded'
};

healthData = logExecution(healthData, failedExecution);

// Save the updated health data
saveHealthData(healthData);
```

### 2. Integration Points

Add logging calls at these key points in your PM Gateway workflow:

#### PM Agent Dispatch
```typescript
// In agents/pm.ts or similar
const executePMGateway = async (task: Task) => {
  const execution = {
    timestamp: new Date().toISOString(),
    success: true,
    failureType: null,
    workflow: 'pm dispatch'
  };
  
  try {
    // Execute PM Gateway logic
    const result = await dispatchSpecialist(task);
    
    // Update execution result
    execution.success = true;
    
    // Log the execution
    let healthData = loadHealthData();
    healthData = logExecution(healthData, execution);
    saveHealthData(healthData);
    
    return result;
  } catch (error) {
    // Update execution result for failure
    execution.success = false;
    execution.failureType = 'pm-logic';
    execution.errorMessage = error.message;
    
    // Log the failure
    let healthData = loadHealthData();
    healthData = logExecution(healthData, execution);
    saveHealthData(healthData);
    
    throw error;
  }
};
```

#### LLM API Calls
```typescript
// In agent communication code
const callLLMAgent = async (prompt: string, agentName: string) => {
  const execution = {
    timestamp: new Date().toISOString(),
    success: true,
    failureType: null,
    workflow: `${agentName} communication`
  };
  
  try {
    const response = await callLLM(prompt);
    
    let healthData = loadHealthData();
    healthData = logExecution(healthData, execution);
    saveHealthData(healthData);
    
    return response;
  } catch (error) {
    execution.success = false;
    execution.failureType = 'llm-api';
    execution.errorMessage = error.message;
    
    let healthData = loadHealthData();
    healthData = logExecution(healthData, execution);
    saveHealthData(healthData);
    
    throw error;
  }
};
```

#### Script Execution
```typescript
// In dispatch scripts
const executeScript = async (scriptPath: string) => {
  const execution = {
    timestamp: new Date().toISOString(),
    success: true,
    failureType: null,
    workflow: 'script execution'
  };
  
  try {
    await $`bun ${scriptPath}`;
    
    let healthData = loadHealthData();
    healthData = logExecution(healthData, execution);
    saveHealthData(healthData);
  } catch (error) {
    execution.success = false;
    execution.failureType = 'script-execution';
    execution.errorMessage = error.message;
    
    let healthData = loadHealthData();
    healthData = logExecution(healthData, execution);
    saveHealthData(healthData);
    
    throw error;
  }
};
```

## Monitoring Commands

### Basic Health Check
```bash
bun scripts/monitor-pm-gateway-health.ts
```

### Detailed Analysis
```bash
bun scripts/monitor-pm-gateway-health.ts --verbose
```

### Reset Tracking
```bash
bun scripts/monitor-pm-gateway-health.ts --reset
```

## Expected Output Examples

### Healthy System (< 1% failure rate)
```
=== PM Gateway Health Summary ===
Total Executions: 1000
Success Rate: 99.50%
Failure Rate: 0.50%
✅ Overall Status: HEALTHY
✅ Last 30 Days: HEALTHY
```

### Warning System (1-2% failure rate)
```
=== PM Gateway Health Summary ===
Total Executions: 500
Success Rate: 98.50%
Failure Rate: 1.50%
⚠️ Overall Status: WARNING
⚠️ Last 30 Days: WARNING
```

### Critical System (> 2% failure rate)
```
=== PM Gateway Health Summary ===
Total Executions: 200
Success Rate: 95.00%
Failure Rate: 5.00%
❌ Overall Status: CRITICAL
❌ Last 30 Days: CRITICAL
❌ CRITICAL: Failure rate exceeds 2% threshold! Enhanced Alternative C should be implemented.
```

## Integration Strategy

### Phase 1: Baseline Collection
- Deploy monitoring without interventions
- Collect 30 days of baseline data
- Establish normal failure rates

### Phase 2: Threshold Monitoring
- Alert at 1% failure rate
- Investigate patterns
- Document root causes

### Phase 3: Enhanced Alternative C Trigger
- At 2% failure rate, implement distributed hooks
- Monitor during transition
- Continuously track improvement

## Data Persistence

The health data is stored in `scripts/.pm-gateway-health.json` with automatic cleanup of entries older than 30 days. The file maintains:
- Overall statistics since tracking started
- Last 30 days rolling window
- Recent execution history (last 100 executions)
- Detailed failure breakdown by type

## Best Practices

1. **Log immediately after execution** to ensure data consistency
2. **Capture detailed error messages** for root cause analysis
3. **Use the appropriate failure type** for accurate categorization
4. **Monitor regularly** to detect trends early
5. **Document interventions** when thresholds are breached