# Design: Acceptance-surface doctrine — every deliverable names the judgment that proves it is usable, and that judgment must exist in the chain

- **Spec ID**: 2026-11-07-acceptance-surface-doctrine-design
- **Date**: 2026-11-07
- **Status**: Draft — pending user gate
- **Origin**: Deck Quality Review #2 (Projects/co-work/memory/meeting-2026-11-06-deck-review-2.md), Proposal Q3 — owner technical-writer
- **Related design**: docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md (its D7 closes the PPTX instance of the general problem; this doc formalizes the general rule)
- **Owner**: technical-writer (PM Gateway dispatch)

## 1. Problem — the motivating incident

The deck delivery of 2026-11-05 failed in real PowerPoint **while every gate
in the chain passed**. The hand compiler produced eight classes of
PowerPoint-invalid output across three days; the compressed chronology:

1. Connector DrawingML malformed → repair prompt on every deck with lines (v1.4.1).
2–6. notesSlide GUID leak, placeholder `cNvPr id=0`, duplicate shape ids,
   missing `p:notesMasterIdLst`, incomplete notesSlide rels (v1.5.0).
7–8. theme namespace error, illegal `p:notesMasterId` attribute (v1.5.1).
   Terminal round: notesMaster `spTree` rebuilt to a python-pptx reference
   model (v1.6.0) — then the whole emitter was replaced by ppt-master (rebase design).

Every intermediate state passed every existing gate: ECMA-376 XSD-clean
(`xmllint --schema`), structural verifier 0/0, python-pptx open, and 100/100
visual acceptance of rendered previews. **None of these validated the real
acceptance surface — "does the receiving application open and use the
artifact."** All checks ran maker-side (structure / content / rendering
proxies); the receiver-side check count was zero. Golden tests compared the
compiler's output to the compiler's own expectations — self-review perfected.

The failure is a **perspective bias, not an absence of verification**: a
deliverable was called "delivered" on proxy evidence while the one judgment
that defines delivery had no check in the chain. Where automation was
impossible (PowerPoint automation is TCC-blocked here), the un-automatable
check was never converted into a human procedure — it was silently dropped.

**Anti-pattern (named)**: *maker-side proxy passing ≠ acceptance* —
well-formed + rendering correctly + visually accepted + yet unopenable.

## 2. Doctrine

For **every** deliverable type, the delivery chain MUST satisfy three rules:

### D1 — Define the acceptance surface

The chain must state the **acceptance surface**: the concrete judgment
"the receiving party can open, use, and consume the artifact" — stated in
receiving-party terms, never as a maker-side proxy. Proxies (schema checks,
structural verifiers, rendered previews, library opens) are useful
engineering evidence but are **not** the surface; "opens via repair" is not
acceptance (repair rebuilds the file and may damage native structures).

### D2 — Name the oracle

The chain must name the **oracle**: who or what performs the surface
judgment. Exactly three oracle kinds are recognized:

| Oracle kind | Description | Example |
|---|---|---|
| In-pipe validator | a deterministic tool run inside the pipeline | pptx_opc_validation + pptx_delivery_check |
| Automated harness | an external executing environment driven in CI or post-build | headless browser smoke test; open-with-library check |
| Human step | a named procedure performed by a person, recorded in the delivery checklist | "user opens in real PowerPoint" |

### D3 — Require the oracle in the chain

A deliverable whose acceptance surface has **no oracle in its delivery
chain is blocked from "delivered" status** — regardless of how many proxy
gates pass. Where automation is impossible, D3 requires converting the gap
into a named human step in the delivery checklist (procedure, not silence).
The default for any type not covered below, or for an oracle that cannot be
automated in this environment, is the **human step** — never an implicit skip.

### Initial deliverable-type table (extensible — add rows by design-doc amendment)

| Deliverable type | Acceptance surface | Oracle |
|---|---|---|
| PPTX deck | PowerPoint opens and renders without repair prompts | In-pipe: ppt-master `pptx_opc_validation` + `pptx_delivery_check`; final: human open in real PowerPoint (delivery checklist step; pptx-export skill Hard Boundaries) |
| PDF | Viewer opens; all pages render | In-pipe: generator postflight; final: human spot-check |
| Markdown report | Reader consumes it; links resolve | Link checker (automated); human read |
| Data file (xlsx / json) | Consuming tool parses without coercion errors | Open-with-library check (e.g. python-pptx / openpyxl / strict JSON parse) |
| Web / HTML | Browser renders; all assets load | Headless browser smoke test; human review |
| Skills / docs in repo | Validators pass; consumers (agents, loaders, links) resolve | Existing audit gates (`audit.ts`, `validate-templates.ts`, `validate-skills.ts`) |

The table is the doctrine's registry: a new deliverable type ships with a
row, or falls back to the D3 human-step default until one exists.

## 3. Integration points

| Touchpoint | Change | Owner |
|---|---|---|
| Delivery checklist (project-coordinator template) | Gains a mandatory **"acceptance surface confirmed"** field — the surface + oracle (D1/D2) and the oracle's result (D3). A delivery with the field empty or oracle-absent cannot be marked delivered. | project-coordinator |
| pptx-export skill | Already carries the human-open step (Hard Boundaries: final PowerPoint-open proof is the user-side manual open, standing no-Office-tooling policy) — cited as the working exemplar of D3. **No change in this spec**; the skill's parallel rebase work owns its own doc. | deck-builder (parallel; out of scope here) |
| Research / doc chains (report-render, xlsx-author, research-report families) | Cite this doctrine in their delivery steps: their surfaces are the table rows above; most already have in-pipe oracles and need only the checklist field. | technical-writer (follow-up documentation round) |
| Rebase design §6 / D7 | Unchanged — it is the PPTX instance of this doctrine and predates it; this doc references it, not vice versa. | — |

## 4. Verification plan

1. **Doc-reference audit** — each deliverable-producing skill (pptx-export,
   xlsx-author, report-render, research-report, and their per-domain mirrors)
   is checked to cite its acceptance surface + oracle per the table. A skill
   with no citation is a finding, filed and fixed in the follow-up
   documentation round (§3).
2. **Spot-check on next deliveries** — the next two real deliveries of any
   type must show a filled "acceptance surface confirmed" field in the
   delivery checklist; a blocked-status exercise is acceptable evidence if
   no delivery lands soon.
3. **Registry consistency** — the deliverable-type table here and the
   delivery-checklist template stay in sync; amendments to one cite the other.

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Doctrine drift — surface/oracle rows age as skills change | Verification item 1 re-run on the quarterly skill review (AGENTS.md §10 cadence); table amendments ride the same design-doc process |
| Oracle absence for exotic deliverable types (no validator, no harness, automation blocked) | D3 default: named human step in the delivery checklist — the gap becomes procedure, never a silent skip |
| Checklist field becomes a rubber stamp | The field must name the oracle AND record its result; project-coordinator blocks "delivered" status otherwise |
| Scope creep — doctrine re-litigates the PPTX fix already implemented | This doc is deliberately doctrine-only: no code, no gate scripts, no changes to scripts/deck/** or the pptx-export skill (owned by the parallel Phase 2 work) |

## 6. References

- Projects/co-work/memory/meeting-2026-11-06-deck-review-2.md (Proposal Q3, dissent record)
- docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md (D7 verification posture — the PPTX instance)
- Projects/co-work/.agents/skills/pptx-export/SKILL.md (Hard Boundaries — human-open exemplar)
- docs/adr/0074 (Design Gate), AGENTS.md §7 (source attribution, computational integrity)
