# Prompt Engineering Standard

## 1. Overview
The efficiency and reliability of Safety OS agents depend heavily on structured prompt engineering. All agent prompts and workflow instructions must adhere to the formal 3-section format to ensure deterministic behavior.

## 2. The 3-Section Format Details

### Section A: Context & Identity
This section defines *who* the agent is and *what* rules they operate under.
- **Role Assignment**: Explicitly state the agent's name and tier (e.g., "You are the compliance-agent, a Medium-tier specialist.").
- **Legal Basis Constraint**: State the regulatory boundary (e.g., "All your actions must align with OSHA-KR Article 44.").
- **Behavioral Directives**: Set the tone and constraints (e.g., "Be concise. Use English only. Never guess regulatory requirements.").

### Section B: Task Definition & Inputs
This section explains exactly what the agent needs to accomplish.
- **Objective**: A clear, single-sentence goal.
- **Input Data**: The structure of the data provided to the agent (e.g., incident logs, hazard reports).
- **Format Requirements**: How the agent should structure its output (e.g., JSON schema, Markdown artifact).

### Section C: Step-by-Step Execution Protocol
This section provides an algorithmic approach for the agent to follow.
1. **Analyze**: Instructions on what to look for in the input data.
2. **Validate**: Steps to check against the Legal Basis.
3. **Execute**: The actual tools to call or actions to perform.
4. **Report**: How to finalize the task and generate evidence (e.g., "Use write_to_file to create an evidence record in memory/").

## 3. Best Practices
- **Avoid Ambiguity**: Never use words like "maybe" or "try". Use "must", "always", and "never".
- **Tool Explicitly**: Tell the agent exactly which MCP tool to use for specific actions.
- **Failure Handling**: Include instructions on what the agent should do if it encounters an error or missing information (e.g., "Escalate to PM via send_message").
