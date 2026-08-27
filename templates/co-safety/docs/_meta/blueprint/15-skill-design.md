# Skill Design Standard

## 1. Overview
The skill design standard dictates the structure and requirements for all skills implemented within Safety OS. All skills must adhere to a strict 3-section format to ensure consistency, discoverability, and functional reliability when invoked by agents.

## 2. 3-Section Format Standard

### Section A: Metadata & Triggers
Every skill must begin with a YAML frontmatter block that defines:
- **name**: Unique identifier for the skill.
- **description**: A brief summary of what the skill accomplishes.
- **triggers**: A list of natural language phrases or keywords that indicate when the skill should be invoked.
- **owner**: The primary agent responsible for executing this skill.

### Section B: Execution Context
The execution context provides the necessary background for the agent. It includes:
- **Legal Basis**: Applicable regulatory references (e.g., OSHA-KR, SAPA articles).
- **Prerequisites**: Tools, permissions, or system state required before execution.
- **Inputs**: Expected parameters from the user or invoking agent.

### Section C: Operational Protocol
This section details the step-by-step instructions the agent must follow.
- **Step 1**: Initial validation and setup.
- **Step 2**: Core execution logic.
- **Step 3**: Post-execution reporting and evidence generation.

## 3. Compliance and Auditing
Skills are continuously monitored by the `audit-agent` to ensure adherence to the 3-section format. Non-compliant skills will fail pre-commit hooks and cannot be merged into the main branch.
