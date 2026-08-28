---
status: "Accepted"
---

# ADR-0003: On-Rails Multi-Provider AI Copilot Without LLM SDKs

**Status**: Accepted
**Date**: 2026-08-25
**Deciders**: pm, lead-architect, core-engine-dev, security-auditor

## Context

The consulting evolution (v10.1) requires an AI copilot that interprets simulation
results and advises on pricing. Two hard constraints shape the design:

1. **Financial integrity**: LLMs are probabilistic; this platform's credibility rests
   on deterministic, auditable numbers (double-entry engine, `[Ref:]` harness).
   Industry practice for regulated financial AI ("on-rails" architectures) is
   unanimous: the model never computes figures — a deterministic engine does, and
   generated text must cite only engine-produced values.
2. **Minimal dependency surface**: the project values small audit scope; adding
   heavyweight SDKs increases supply-chain risk (cf. workspace security policy).

Multi-provider resilience was also required: claude, gemini, codex, z.ai, and
deepseek, with automatic failover.

## Decision

### Transport: self-built adapter, zero new dependencies
`src/lib/ai/*` implements a provider registry over plain `fetch`:
- Per-provider config namespaced as `PRICE_{P}_API_KEY|MODEL|BASE_URL`
  (`PRICE_PROVIDER`, `PRICE_FALLBACK_PROVIDERS` chain), Zod-validated at load.
- OpenAI-compatible wire format reused for codex/zai/deepseek; native adapters for
  Anthropic Messages API and Google Generative Language API.
- Ordered failover with per-provider **circuit breaker** (closed/open/half-open,
  `Retry-After` respected), error taxonomy (Config/Transient/Contract/Stream),
  end-to-end deadline budgeting, capability contracts for structured output,
  and abort propagation. Failover only before first streamed byte.

### Integrity: on-rails principles
- **Computation ledger**: every engine figure gets a `calc_id`; the copilot prompt
  receives the ledger menu, never raw authority to invent numbers.
- **Critic gate**: post-generation check blocks any response citing untraceable
  numbers; one regeneration, then fail.
- **Prompt-injection defense**: simulation state injected strictly as delimited data.
- **Language guard**: diagnostic register, certainty-overstatement banned,
  disclaimers mandatory; client-facing artifacts pass a human gate.
- **servedBy metadata** on every response; keys are never logged.

## Alternatives Considered

- **Vercel AI SDK**: fastest to build, but adds framework lock-in and dependency
  weight against project principles ("Simplicity First").
- **Official per-vendor SDKs ×3+**: triples audit surface and maintenance drift.
- **LLM-computes-everything chatbot**: rejected — unacceptable in a financial
  advisory context (fabricated figures read exactly as fluently as correct ones).

## Consequences

- ~6 focused modules + SSE parsing to own (~few hundred lines) in exchange for a
  minimal, fully auditable transport.
- New providers join by config (baseURL/model/key), not code — deepseek-class
  OpenAI-compatible vendors require no logic changes.
- Verification skill `copilot-onrails-audit` owns fallback drills, ledger
  trace-rate checks, and injection vectors.
