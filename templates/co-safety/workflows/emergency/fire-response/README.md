# fire-response Workflow

## 1. Objective
화재/폭발 사고 대응. 산업안전보건법 제54조("중대재해 발생 시 조치")에 근거한 즉시 대응 프로토콜 — E-01 시나리오 코드 (see `agents/_shared/emergency-agent.md` classification table).

## 2. Workflow Steps
1. **Discovery** (`emergency-agent`) — Initial detection and reporting of the fire incident.
2. **Evacuation** (`emergency-agent`) — Safe evacuation of all personnel from the affected area.
3. **Initial Suppression** (`emergency-agent`) — Attempt to extinguish the fire using local fire extinguishers if safe to do so.
4. **Professional Team Support** (`compliance-agent`) — Coordination with local fire departments (119) and emergency services, ensuring compliance with external reporting requirements.
5. **Scene Preservation** (`audit-agent`) — Securing the incident scene for post-incident investigation, evidence traceability, and auditing.

## 3. Handoff
Once `response_status` reaches `contained`/`resolved`, dispatch to `incident-investigation-agent` for post-incident root cause analysis per `agents/_shared/emergency-agent.md` §Handoff Protocols.

## 4. Evidence Record
Generate `emergency-fire-response-record.json`.
