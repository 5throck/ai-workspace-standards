# LLMCFG-001 — Explicit CAD_LLM_* provider configuration

> Status: implemented — 2026-09-26
> Replaces: the multi-provider key auto-detection in `llm_client.py` (AI-001 §4.2 / AI-002 Part 4)

## Goal

Configure the LLM the way `co-newbiz` does: one explicit provider tuple instead of three per-provider API keys with auto-detection and self-healing fallback.

## Configuration contract

```dotenv
CAD_LLM_PROVIDER=anthropic   # openai-compatible | anthropic | gemini | custom | none
CAD_LLM_BASE_URL=            # [optional] endpoint override
CAD_LLM_API_KEY=...          # single key for the selected provider
CAD_LLM_MODEL=...            # [optional] else per-provider default
```

- `openai-compatible`/`custom` speak the OpenAI Chat Completions protocol at `CAD_LLM_BASE_URL` and route to `OpenAIClient`.
- `none` disables LLM calls (`resolve_llm_config()` returns an empty provider).
- Unknown provider values log a warning and fall back to `gemini`.
- Unset `CAD_LLM_PROVIDER` defaults to `gemini` (previous implicit default).

## Removed

- Provider key auto-detection (`_detect_default_provider` key probing, gemini → anthropic → openai) and the gemini→anthropic self-healing fallback.
- Legacy env reads: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `LLM_MODEL`.

V1 (`src/agent/cad_agent.py`) keeps its own provider logic untouched per the V1/V2/V3 versioning strategy (ADR-002 §1 / AI-002 §1).

## Changed files

| File | Change |
|------|--------|
| `src/cad_intelligence/ai/llm_client.py` | `resolve_llm_config()` + `_PROVIDER_ALIASES`/`_DEFAULT_BASE_URLS`; all three clients take `base_url` and read only the tuple |
| `src/cad_intelligence/cli/doctor.py` | API-key check looks at `CAD_LLM_API_KEY` |
| `tests/test_llm_client_v3.py` | detection/self-healing tests replaced by tuple-resolution tests (aliases, `none`, precedence, gateway URL building) |
| `.env.sample`, `.env` | LLM section reduced to the 4-tuple; local `.env` migrated |

## Acceptance criteria

1. `uv run python -m pytest tests/test_llm_client_v3.py` — all green (17 tests).
2. No source/test reference to the removed legacy env vars or helpers.
3. `.env.sample` documents only the tuple; no code reads the removed keys.

## Out of scope

- Registry/request-param provider selection (`draw_v3.py` unchanged).
- Adding new provider protocols beyond the three clients.
