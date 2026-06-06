# External Reference Library

This document tracks approved external references, repositories, and frameworks that enhance the capabilities of our AI agents and templates. These resources are intended to be statically ingested, referenced for prompt improvements, or utilized as knowledge bases.

## Agent Persona & Capabilities
- **[agency-agents](https://github.com/msitarzewski/agency-agents)**
  - **Description**: A collection of AI agent personas, specialized experts with processes and proven deliverables.
  - **Usage**: Used during the agent creation phase (`agent-creator.ts`) to supplement internal drafts with specialized prompt techniques and behavioral guidelines.

## Design & UI/UX (`co-design`)
- **[awesome-design-md](https://github.com/voltagent/awesome-design-md)**
  - **Description**: A curated collection of `DESIGN.md` analysis frameworks by developer-focused websites.
  - **Usage**: Statically integrated into the `co-design` template to enforce high-quality design specifications and structure UI/UX definitions.

## Engineering Workflows (`co-develop`)
- **[agent-skills](https://github.com/addyosmani/agent-skills)**
  - **Description**: Production-grade engineering skills for AI coding agents (TDD, refactoring, code review, etc.).
  - **Usage**: Converted into local `SKILL.md` format and statically added to the `co-develop/skills/` directory to provide robust engineering workflows.

## Security & DevSecOps (`co-security`)
- **[awesome-cyber-security](https://github.com/okhosting/awesome-cyber-security)**
  - **Description**: A comprehensive directory of cybersecurity tools, frameworks, and methodologies.
  - **Usage**: Used to power the `security-tool-advisor` skill, recommending vetted tools for specific security audits.
- **[cybersecurity-infosec](https://github.com/paulveillard/cybersecurity-infosec)**
  - **Description**: Deep conceptual guidelines covering cybersecurity architectures and infosec policies.
  - **Usage**: Serves as the static knowledge base for the `threat-model-generator` skill to formulate comprehensive security designs.
- **[awesome-cybersecurity-blueteam](https://github.com/fabacab/awesome-cybersecurity-blueteam)**
  - **Description**: Resources focused strictly on defense, incident response, threat hunting, and blue team monitoring.
  - **Usage**: Backs the `blue-team-defender` skill to propose safe, architectural defensive configurations (e.g., IDS/IPS rules).

> **Governance Note**: All external content from these repositories must be statically ingested and committed to our repository. Agents must not dynamically fetch or execute third-party scripts from these sources at runtime without explicit user review, ensuring compliance with the `qa-gate.ts` integrity checks.
