// @version 1.0.0
import * as fs from 'node:fs';
import * as path from 'node:path';
import { $ } from 'bun';

// Color constants
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// Configuration
const HEALTH_FILE = path.join('scripts', '.pm-gateway-health.json');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

// Define types
type FailureType = 'llm-api' | 'script-execution' | 'pm-logic' | 'combined' | null;
type Execution = {
  timestamp: string;
  success: boolean;
  failureType: FailureType;
  workflow: string;
  errorMessage?: string;
};

type HealthData = {
  trackingStart: string;
  executions: {
    total: number;
    success: number;
    failures: number;
  };
  failureTypes: Record<string, number>;
  failureRate: number;
  last30Days: {
    total: number;
    failures: number;
    failureRate: number;
  };
  recentExecutions: Execution[];
};

// Command line arguments
const args = process.argv.slice(2);
const resetFlag = args.includes('--reset');
const verboseFlag = args.includes('--verbose');

// Helper functions
function createHealthData(): HealthData {
  const now = new Date().toISOString();
  return {
    trackingStart: now,
    executions: {
      total: 0,
      success: 0,
      failures: 0
    },
    failureTypes: {
      'llm-api': 0,
      'script-execution': 0,
      'pm-logic': 0,
      'combined': 0
    },
    failureRate: 0,
    last30Days: {
      total: 0,
      failures: 0,
      failureRate: 0
    },
    recentExecutions: []
  };
}

function loadHealthData(): HealthData {
  try {
    if (!fs.existsSync(HEALTH_FILE)) {
      return createHealthData();
    }

    const data = fs.readFileSync(HEALTH_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`${RED}Error loading health data: ${error}${RESET}`);
    return createHealthData();
  }
}

function saveHealthData(data: HealthData): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(HEALTH_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(HEALTH_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`${RED}Error saving health data: ${error}${RESET}`);
  }
}

function cleanupOldEntries(data: HealthData): HealthData {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  // Filter recent executions to only include last 30 days
  const recentExecutions = data.recentExecutions.filter(
    exec => exec.timestamp >= thirtyDaysAgo
  );

  // Recalculate last 30 days statistics
  const last30DaysTotal = recentExecutions.length;
  const last30DaysFailures = recentExecutions.filter(exec => !exec.success).length;
  const last30DaysFailureRate = last30DaysTotal > 0 ? (last30DaysFailures / last30DaysTotal) * 100 : 0;

  return {
    ...data,
    last30Days: {
      total: last30DaysTotal,
      failures: last30DaysFailures,
      failureRate: last30DaysFailureRate
    },
    recentExecutions
  };
}

function logExecution(data: HealthData, execution: Execution): HealthData {
  const updatedData = { ...data };

  // Update overall statistics
  updatedData.executions.total++;
  if (execution.success) {
    updatedData.executions.success++;
  } else {
    updatedData.executions.failures++;

    // Update failure type count
    if (execution.failureType) {
      updatedData.failureTypes[execution.failureType]++;
    }
  }

  // Update failure rate
  updatedData.failureRate = (updatedData.executions.failures / updatedData.executions.total) * 100;

  // Add to recent executions (keep last 100)
  updatedData.recentExecutions.push(execution);
  if (updatedData.recentExecutions.length > 100) {
    updatedData.recentExecutions = updatedData.recentExecutions.slice(-100);
  }

  return cleanupOldEntries(updatedData);
}

function getHealthStatus(failureRate: number): { status: string; emoji: string; color: string } {
  if (failureRate < 1) {
    return { status: 'HEALTHY', emoji: '✅', color: GREEN };
  } else if (failureRate <= 2) {
    return { status: 'WARNING', emoji: '⚠️', color: YELLOW };
  } else {
    return { status: 'CRITICAL', emoji: '❌', color: RED };
  }
}

function generateReport(data: HealthData): string {
  const overallStatus = getHealthStatus(data.failureRate);
  const last30DaysStatus = getHealthStatus(data.last30Days.failureRate);

  let report = `## PM Gateway Health Report\n\n`;
  report += `**Generated**: ${new Date().toISOString()}\n`;
  report += `**Tracking Period**: Last 30 days\n`;
  report += `**Data Source**: ${HEALTH_FILE}\n\n`;

  // Overall Statistics
  report += `### Overall Statistics\n\n`;
  report += `- **Total Executions**: ${data.executions.total}\n`;
  report += `- **Successful**: ${data.executions.success}\n`;
  report += `- **Failed**: ${data.executions.failures}\n`;
  report += `- **Failure Rate**: ${data.failureRate.toFixed(2)}%\n\n`;

  // Status
  report += `### Status\n\n`;
  report += `${overallStatus.color}${overallStatus.emoji} **${overallStatus.status}**`;
  if (overallStatus.status === 'CRITICAL') {
    report += ` (Enhanced Alternative C trigger)`;
  }
  report += ` (overall: ${data.failureRate.toFixed(2)}%)\n`;
  report += `${last30DaysStatus.color}${last30DaysStatus.emoji} **${last30DaysStatus.status}** (last 30 days: ${data.last30Days.failureRate.toFixed(2)}%)\n\n`;

  // Failure Breakdown
  report += `### Failure Breakdown\n\n`;
  report += `- **LLM API Failures**: ${data.failureTypes['llm-api']}\n`;
  report += `- **Script Execution Failures**: ${data.failureTypes['script-execution']}\n`;
  report += `- **PM Logic Failures**: ${data.failureTypes['pm-logic']}\n`;
  report += `- **Combined Failures**: ${data.failureTypes['combined']}\n\n`;

  // Recommendations
  report += `### Recommendations\n\n`;
  if (data.failureRate < 1) {
    report += `✅ Current performance is excellent. Continue monitoring.\n`;
  } else if (data.failureRate <= 2) {
    report += `⚠️ Monitor closely as failure rate is approaching critical threshold.\n`;
    report += `Consider investigating recurring failure patterns.\n`;
  } else {
    report += `❌ Critical threshold exceeded. Implement Enhanced Alternative C (distributed hooks architecture).\n`;
    report += `Immediate investigation of failure causes required.\n`;
  }

  return report;
}

function printSummary(data: HealthData): void {
  const overallStatus = getHealthStatus(data.failureRate);
  const last30DaysStatus = getHealthStatus(data.last30Days.failureRate);

  console.log(`${CYAN}=== PM Gateway Health Summary ===${RESET}`);
  console.log(`Total Executions: ${data.executions.total}`);
  console.log(`Success Rate: ${((data.executions.success / data.executions.total) * 100).toFixed(2)}%`);
  console.log(`Failure Rate: ${data.failureRate.toFixed(2)}%`);
  console.log(`${overallStatus.color}Overall Status: ${overallStatus.status}${RESET}`);
  console.log(`${last30DaysStatus.color}Last 30 Days: ${last30DaysStatus.status}${RESET}`);
}

function printDetailedBreakdown(data: HealthData): void {
  console.log(`${CYAN}=== Detailed Failure Breakdown ===${RESET}`);
  console.log(`LLM API Failures: ${data.failureTypes['llm-api']} (${((data.failureTypes['llm-api'] / data.executions.total) * 100).toFixed(2)}%)`);
  console.log(`Script Execution Failures: ${data.failureTypes['script-execution']} (${((data.failureTypes['script-execution'] / data.executions.total) * 100).toFixed(2)}%)`);
  console.log(`PM Logic Failures: ${data.failureTypes['pm-logic']} (${((data.failureTypes['pm-logic'] / data.executions.total) * 100).toFixed(2)}%)`);
  console.log(`Combined Failures: ${data.failureTypes['combined']} (${((data.failureTypes['combined'] / data.executions.total) * 100).toFixed(2)}%)`);

  // Show recent failures
  const recentFailures = data.recentExecutions.filter(exec => !exec.success).slice(0, 10);
  if (recentFailures.length > 0) {
    console.log(`${CYAN}=== Recent Failures ===${RESET}`);
    recentFailures.forEach((exec, index) => {
      console.log(`${index + 1}. ${exec.timestamp} - ${exec.failureType || 'unknown'} - ${exec.errorMessage || 'No error message'}`);
    });
  }
}

function simulateSampleData(): Execution[] {
  return [
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      success: true,
      failureType: null,
      workflow: 'code-writer dispatch'
    },
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
      success: false,
      failureType: 'llm-api',
      workflow: 'test-runner dispatch',
      errorMessage: 'Rate limit exceeded'
    },
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 70).toISOString(),
      success: true,
      failureType: null,
      workflow: 'architect dispatch'
    },
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
      success: false,
      failureType: 'script-execution',
      workflow: 'automation dispatch',
      errorMessage: 'Script timeout'
    },
    {
      timestamp: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
      success: true,
      failureType: null,
      workflow: 'docs-writer dispatch'
    }
  ];
}

async function main(): Promise<void> {
  if (resetFlag) {
    console.log(`${YELLOW}Resetting PM Gateway health data...${RESET}`);
    const newData = createHealthData();
    saveHealthData(newData);
    console.log(`${GREEN}Health data reset successfully.${RESET}`);
    return;
  }

  let data = loadHealthData();

  // If no data exists, create sample data for demonstration
  if (data.executions.total === 0) {
    console.log(`${YELLOW}No existing data found. Creating sample data for demonstration...${RESET}`);
    const sampleExecutions = simulateSampleData();
    sampleExecutions.forEach(execution => {
      data = logExecution(data, execution);
    });
    saveHealthData(data);
  }

  // Load current data again (in case we just created sample data)
  data = loadHealthData();

  // Print summary
  printSummary(data);

  if (verboseFlag) {
    console.log(); // Empty line
    printDetailedBreakdown(data);

    console.log(); // Empty line
    console.log(`${CYAN}=== Full Report ===${RESET}`);
    console.log(generateReport(data));
  } else {
    console.log(); // Empty line
    console.log(`${CYAN}Use --verbose for detailed breakdown${RESET}`);
    console.log(`${CYAN}Use --reset to clear tracking data${RESET}`);
  }

  // Check for critical thresholds
  if (data.last30Days.failureRate > 2) {
    console.log(`${RED}❌ CRITICAL: Failure rate exceeds 2% threshold! Enhanced Alternative C should be implemented.${RESET}`);
    process.exit(1);
  } else if (data.last30Days.failureRate > 1) {
    console.log(`${YELLOW}⚠️ WARNING: Failure rate exceeds 1% threshold. Monitor closely.${RESET}`);
  }
}

// Export functions for external use
export { logExecution, getHealthStatus, cleanupOldEntries, createHealthData };

// Run the script
if (import.meta.main) {
  main().catch(error => {
    console.error(`${RED}Script execution failed: ${error}${RESET}`);
    process.exit(1);
  });
}