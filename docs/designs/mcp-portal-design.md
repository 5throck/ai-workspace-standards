# Design: `mcp-portal` — MCP Information Portal (Human + Agent + Registration)

- **Status**: Proposed
- **Author**: architect (L0 / Template Architect)
- **Date**: 2026-07-07
- **Variant**: co-develop (L2 project, scaffolded via `bun scripts/new-project.ts "mcp-portal" --variant co-develop --platform both`)
- **Scope**: New project-local Next.js app under `mcp-portal/` — no workspace-root or template changes (see Platform Impact)

## Problem

There is no single surface that serves all three MCP audiences at once:

1. **Humans** need a searchable directory to discover known MCP servers/tools (what they do, how to install them).
2. **AI agents** need to reach that same catalog *programmatically* — the portal must itself be an MCP server, so an agent can connect, search, and pull a ready-to-paste install config with no human in the loop.
3. **Contributors** need a low-friction way to register a new MCP server from an arbitrary link (GitHub repo, README, npm page), where an LLM does the structured-metadata extraction — but nothing is ever auto-published; a human must approve every entry.

The design below formalizes the already-decided architecture into a concrete, buildable specification: Prisma schema, MCP tool contracts, REST inventory, the submission→approval data flow, the SSRF guard, and the app's file layout.

## Summary

`mcp-portal` is a Next.js (App Router, TypeScript) application backed by Prisma + SQLite (file-based; `DATABASE_URL` swappable to Postgres later). It exposes **three coordinated surfaces over one catalog**:

- A **human web UI** (`/`, `/mcp/[slug]`) for search and detail browsing.
- An **agent-facing MCP server** mounted at `/api/mcp` (Streamable HTTP transport via `@modelcontextprotocol/sdk`) exposing four read-only tools: `search_mcp`, `get_mcp_details`, `get_install_config`, `list_categories`.
- A **registration + human-approval pipeline**: `POST /api/submit` performs an SSRF-guarded fetch of a submitted URL, calls Claude (`@anthropic-ai/sdk`) with a structured-extraction prompt, and writes a `PendingSubmission` row (never a published `McpEntry`). An `ADMIN_TOKEN`-gated `/admin` surface lets a human edit, approve (copy into `McpEntry`), or reject.

The two persisted tables are `McpEntry` (published, searchable) and `PendingSubmission` (unpublished queue). The published table is the only source both the human UI and the agent MCP tools read from — the pending table is write-only from the public submit path and read/write only from the token-gated admin path.

## Data model — Prisma schema

> **SQLite constraint (load-bearing):** Prisma's SQLite provider does **not** support the native `Json` scalar type or scalar-list arrays (`String[]`). The three "structured" fields the PM spec describes as a JSON array / JSON object (`tags`, `installArgs`, `installEnv`) are therefore stored as **`String` columns holding JSON-serialized text**, (de)serialized in a thin `lib/serialize.ts` helper at the repository boundary. When `DATABASE_URL` is later switched to Postgres, these can be migrated to native `Json`/`String[]` columns without changing the tool/route contracts (the API always presents parsed arrays/objects — the string encoding is a storage-layer detail). This is the single biggest concrete consequence of the "SQLite for MVP" decision and is called out again in Trade-offs.

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")   // e.g. "file:./dev.db"; swap to Postgres later
}

generator client {
  provider = "prisma-client-js"
}

model McpEntry {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique                 // URL-safe, drives /mcp/[slug]
  description    String
  repoUrl       String?
  homepage      String?
  category      String                            // single primary category (see list_categories)
  tags          String   @default("[]")           // JSON-encoded string[]  e.g. "[\"database\",\"search\"]"
  transportType String                            // "stdio" | "http" | "sse" (enforced in app layer)
  installCommand String?                          // e.g. "npx" (stdio) — null/ignored for remote
  installArgs   String   @default("[]")           // JSON-encoded string[]  e.g. "[\"-y\",\"@scope/pkg\"]"
  installEnv    String   @default("{}")           // JSON-encoded Record<string,string> e.g. "{\"API_KEY\":\"\"}"
  remoteUrl     String?                            // set when transportType is "http"/"sse"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([category])
  @@index([slug])
}

model PendingSubmission {
  id            String   @id @default(cuid())
  // --- same content fields as McpEntry (no slug/updatedAt; slug assigned at approval) ---
  name          String
  description    String
  repoUrl       String?
  homepage      String?
  category      String
  tags          String   @default("[]")           // JSON-encoded string[]
  transportType String
  installCommand String?
  installArgs   String   @default("[]")           // JSON-encoded string[]
  installEnv    String   @default("{}")           // JSON-encoded Record<string,string>
  remoteUrl     String?
  // --- submission-specific fields ---
  sourceUrl     String                            // the link the submitter provided
  status        String   @default("pending")       // "pending" | "approved" | "rejected"
  rawAnalysis   String                            // raw LLM output JSON (audit trail of what Claude returned)
  createdAt     DateTime @default(now())

  @@index([status])
}
```

**Notes on schema decisions**

- `transportType` and `status` are modeled as `String` (not Prisma `enum`) because the SQLite provider does not support native enums; the allowed values are enforced by a zod schema in the app layer (`lib/schemas.ts`) so there is a single validation source shared by REST routes, MCP tools, and the admin form.
- `slug` lives only on `McpEntry` — a pending submission is not yet URL-addressable. The slug is generated (slugify(name), de-duplicated with a numeric suffix on `@@unique` collision) at approval time.
- `rawAnalysis` preserves the exact LLM output for auditability even after an admin edits the structured fields — so a reviewer can always see what the model originally proposed vs. what a human changed.
- `remoteUrl` is added (not in the raw PM field list but implied by `get_install_config`'s "remote: url" branch and the `http|sse` transports) so a remote MCP server's endpoint can be stored and emitted in the install config. Flagged in Open Questions in case the PM intended `homepage` to double as this.

## MCP tool contracts (`/api/mcp`)

The MCP server is mounted at `/api/mcp` using `@modelcontextprotocol/sdk`'s **Streamable HTTP** server transport, wired into a Next.js Route Handler (`app/api/mcp/route.ts`). All four tools are **read-only** (no tool can mutate the catalog — registration is deliberately kept on the human REST/approval path, never exposed as an agent-writable tool). Input schemas are given zod-style; output shapes are the JSON returned in the tool result content.

### 1. `search_mcp`

```ts
input: z.object({
  query:    z.string().min(1),
  category: z.string().optional(),
})
```
```ts
// output: array of lightweight match records (NOT full entries)
Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];          // parsed from stored JSON string
}>
```
Semantics: case-insensitive substring match of `query` against `name`, `description`, and `tags`; if `category` is provided, results are additionally filtered to that category. Reads `McpEntry` only. Returns `[]` (not an error) on no match.

### 2. `get_mcp_details`

```ts
input: z.object({
  id: z.string().min(1),
})
```
```ts
// output: the full published entry (or a not-found error result)
{
  id: string;
  name: string;
  slug: string;
  description: string;
  repoUrl: string | null;
  homepage: string | null;
  category: string;
  tags: string[];
  transportType: "stdio" | "http" | "sse";
  installCommand: string | null;
  installArgs: string[];
  installEnv: Record<string, string>;
  remoteUrl: string | null;
  createdAt: string;   // ISO
  updatedAt: string;   // ISO
}
```
Semantics: fetch by `McpEntry.id`. If not found, return an MCP tool error result (`isError: true`) with a human-readable message — not a thrown 500.

### 3. `get_install_config`

```ts
input: z.object({
  id:     z.string().min(1),
  client: z.enum(["claude-desktop", "claude-code", "generic"]).optional().default("generic"),
})
```
```ts
// output: a ready-to-paste config block shaped for the requested client
{
  client: "claude-desktop" | "claude-code" | "generic";
  transportType: "stdio" | "http" | "sse";
  config: object;   // shape depends on transportType + client (see below)
}
```
Semantics: builds a paste-ready MCP client config for the entry.

- **stdio** entry → emits the standard `.mcp.json` / Claude Desktop `mcpServers` shape:
  ```json
  { "mcpServers": { "<slug>": { "command": "npx", "args": ["-y","@scope/pkg"], "env": { "API_KEY": "" } } } }
  ```
- **http / sse (remote)** entry → emits the remote form:
  ```json
  { "mcpServers": { "<slug>": { "url": "https://example.com/mcp" } } }
  ```
- `client` selects wrapper conventions where they differ (e.g. Claude Code's `.mcp.json` uses the same `mcpServers` key; `generic` returns the inner server object without the outer wrapper). Differences are handled in `lib/install-config.ts` so the mapping is centralized and unit-testable. Unknown/empty install fields degrade gracefully (empty `args`/`env` omitted rather than emitting `null`s).

### 4. `list_categories`

```ts
input: z.object({})   // no arguments
```
```ts
// output: distinct category strings currently present in published entries
Array<{ category: string; count: number }>
```
Semantics: `SELECT category, COUNT(*) ... GROUP BY category` over `McpEntry`, sorted by count desc then name asc. `count` is included so an agent can rank/triage without a second call.

## REST route inventory

All routes are Next.js App Router Route Handlers under `app/api/`. Request/response bodies are JSON. The two `/api/mcp-entries` and `/api/search` read paths are public; all `/api/admin/*` paths require the `ADMIN_TOKEN` bearer header.

| Path | Method | Auth | Purpose | Request | Response |
|------|--------|------|---------|---------|----------|
| `/api/search` | `GET` | public | Human-UI search (mirrors `search_mcp` for the browser) | query params `?q=<string>&category=<string?>&tag=<string?>` | `200 { results: Array<{ id, name, slug, description, category, tags[] }> }` |
| `/api/mcp-entries` | `GET` | public | List/browse published entries (paginated) | query params `?category=<string?>&tag=<string?>&cursor=<id?>&limit=<n?>` | `200 { entries: McpEntryDTO[], nextCursor: string \| null }` |
| `/api/mcp-entries/[slug]` | `GET` | public | Fetch one published entry for the detail page | path `slug` | `200 McpEntryDTO` / `404 { error }` |
| `/api/submit` | `POST` | public | Submit a URL for LLM extraction into the pending queue | `{ url: string }` | `202 { id, status: "pending" }` / `400 { error }` (bad/blocked URL) / `502 { error }` (fetch/LLM failure) |
| `/api/admin/pending` | `GET` | `ADMIN_TOKEN` | List pending submissions for review | query `?status=pending\|approved\|rejected` (default `pending`) | `200 { submissions: PendingSubmissionDTO[] }` / `401` |
| `/api/admin/pending/[id]` | `PATCH` | `ADMIN_TOKEN` | Edit a pending submission's structured fields before decision | partial `PendingSubmission` content fields | `200 PendingSubmissionDTO` / `401` / `404` |
| `/api/admin/pending/[id]/approve` | `POST` | `ADMIN_TOKEN` | Approve → create `McpEntry`, mark submission `approved` | `{}` (uses current, possibly-edited, submission fields) | `201 { entry: McpEntryDTO }` / `401` / `404` / `409` (already decided / slug collision unresolved) |
| `/api/admin/pending/[id]/reject` | `POST` | `ADMIN_TOKEN` | Reject → mark submission `rejected` (no `McpEntry` written) | `{ reason?: string }` | `200 { id, status: "rejected" }` / `401` / `404` |

**Notes**

- `McpEntryDTO` / `PendingSubmissionDTO` are the API-facing shapes where `tags`/`installArgs` are **parsed arrays** and `installEnv` a **parsed object** — the JSON-string storage encoding never crosses the API boundary.
- Auth is a constant-time comparison of the `Authorization: Bearer <ADMIN_TOKEN>` header against `process.env.ADMIN_TOKEN` in a shared `lib/auth.ts` guard used by every `/api/admin/*` handler. Missing/blank env var → all admin routes hard-fail closed (`401`), never open.
- `/api/submit` returns `202 Accepted` because the extraction is a multi-step (fetch + LLM) operation; for the MVP it runs synchronously within the request but the `202` + pending-row semantics leave room to move it to a background job later without a contract change.

## Data flow: submission → extraction → pending → approval → published

```
1. Contributor POSTs { url } to /api/submit.
2. lib/ssrf.ts validates the URL: scheme must be http/https; DNS-resolve the host;
   reject if ANY resolved IP is loopback / private / link-local / reserved (see SSRF section).
   → on reject: 400, nothing persisted.
3. Server fetches the page content (README / npm / repo HTML) with redirects re-validated
   through the same guard, a byte cap, and a timeout.
4. lib/extract.ts calls Claude via @anthropic-ai/sdk with a structured-extraction prompt:
   "given this page text, output JSON matching { name, description, repoUrl, homepage,
    category, tags[], transportType, installCommand, installArgs[], installEnv{}, remoteUrl }".
   Response is parsed + zod-validated against lib/schemas.ts.
5. Server writes a PendingSubmission row: status="pending", sourceUrl=<url>,
   rawAnalysis=<verbatim LLM JSON>, plus the parsed structured fields (arrays/object
   re-serialized to JSON strings for SQLite storage).
   → NEVER writes McpEntry here. Returns 202 { id, status:"pending" }.
6. Admin opens /admin (ADMIN_TOKEN-gated), GET /api/admin/pending lists the queue.
7. Admin optionally PATCHes /api/admin/pending/[id] to correct fields the LLM got wrong.
8a. Approve: POST /api/admin/pending/[id]/approve
    → generate unique slug, INSERT McpEntry from the (edited) fields,
      UPDATE submission.status="approved" (single transaction).
      The entry is now live: visible in / search UI AND returned by the MCP search tools.
8b. Reject: POST /api/admin/pending/[id]/reject
    → UPDATE submission.status="rejected". No McpEntry ever created.
```

The invariant that makes the whole design safe: **the public path can only ever create `pending` rows, and only the token-gated admin path can create `McpEntry` rows.** There is no code path from an unauthenticated request (human or agent) to a published entry.

## SSRF guard (`lib/ssrf.ts`)

The `/api/submit` endpoint fetches an attacker-controlled URL server-side, which is a classic SSRF vector. The guard runs **before every outbound fetch, including on each redirect hop**:

**Blocked / rejected:**
- Any scheme other than `http:` or `https:` (blocks `file:`, `ftp:`, `gopher:`, `data:`, etc.).
- Hostnames that resolve (via DNS) to any IP in a disallowed range:
  - IPv4 loopback `127.0.0.0/8`, `0.0.0.0/8`
  - IPv4 private `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
  - IPv4 link-local `169.254.0.0/16` (includes cloud metadata `169.254.169.254`)
  - IPv4 CGNAT `100.64.0.0/10`, and other reserved/broadcast ranges
  - IPv6 loopback `::1`, unique-local `fc00::/7`, link-local `fe80::/10`, and IPv4-mapped IPv6 (`::ffff:0:0/96`) re-checked against the IPv4 rules
- Non-standard ports may be restricted to `80`/`443` for the MVP (flagged in Open Questions — some legitimate repos/registries do not use non-standard ports, so a strict allowlist is low-cost).

**How:**
1. Parse URL; assert scheme ∈ {http, https}.
2. Resolve the hostname with DNS (`dns.lookup`, `{ all: true }`) and check **every** returned address against the block ranges — not just the first — to defeat DNS round-robin / multi-A-record bypasses.
3. Fetch with **manual redirect handling** (`redirect: "manual"`): on any 3xx, re-run steps 1–2 against the `Location` target before following. This defeats the "public URL 302-redirects to `169.254.169.254`" bypass.
4. Enforce a **response byte cap** (e.g. 2 MB) and a **request timeout** (e.g. 10 s) to bound resource use and slow-loris/large-body abuse.
5. TOCTOU note: DNS re-resolution between check and connect is an inherent residual risk of check-then-connect. For the MVP the check-then-fetch window is accepted and documented; a hardened version would pin the validated IP and connect to it directly (custom agent/lookup). Flagged in Open Questions.

## Directory / file layout

```
mcp-portal/
├─ prisma/
│  ├─ schema.prisma                 # McpEntry + PendingSubmission (above)
│  ├─ migrations/                   # prisma migrate output
│  └─ seed.ts                       # optional seed of a few known MCP servers
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                      # "/"  — search box + category/tag filters + results grid
│  ├─ mcp/
│  │  └─ [slug]/
│  │     └─ page.tsx                # "/mcp/[slug]" — entry detail page
│  ├─ admin/
│  │  └─ page.tsx                   # "/admin" — ADMIN_TOKEN-gated review/approve/reject UI
│  └─ api/
│     ├─ search/route.ts            # GET /api/search
│     ├─ mcp-entries/
│     │  ├─ route.ts                # GET /api/mcp-entries (list, paginated)
│     │  └─ [slug]/route.ts         # GET /api/mcp-entries/[slug]
│     ├─ submit/route.ts            # POST /api/submit (SSRF + LLM extraction)
│     ├─ mcp/route.ts               # the MCP server (Streamable HTTP transport, 4 tools)
│     └─ admin/
│        └─ pending/
│           ├─ route.ts             # GET /api/admin/pending
│           └─ [id]/
│              ├─ route.ts          # PATCH /api/admin/pending/[id]
│              ├─ approve/route.ts  # POST .../approve
│              └─ reject/route.ts   # POST .../reject
├─ lib/
│  ├─ db.ts                         # PrismaClient singleton (dev-hot-reload safe)
│  ├─ schemas.ts                    # zod schemas: entry content, transportType, status, tool I/O
│  ├─ serialize.ts                  # JSON <-> string helpers for tags/installArgs/installEnv (SQLite)
│  ├─ repository.ts                 # typed data-access: entries + submissions (returns DTOs)
│  ├─ ssrf.ts                       # URL validation + guarded fetch
│  ├─ extract.ts                    # Claude structured-extraction call (@anthropic-ai/sdk)
│  ├─ install-config.ts            # build get_install_config output per transport/client
│  ├─ mcp-tools.ts                  # the 4 tool definitions (shared by app/api/mcp/route.ts)
│  └─ auth.ts                       # ADMIN_TOKEN bearer guard
├─ components/
│  ├─ SearchBar.tsx
│  ├─ EntryCard.tsx
│  ├─ FilterChips.tsx               # category/tag filters
│  └─ admin/PendingRow.tsx          # editable pending-submission row
├─ .env.example                     # DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_TOKEN
├─ package.json
└─ (standard co-develop L2 scaffold files from new-project.ts)
```

The MCP tool definitions live in `lib/mcp-tools.ts` and read through the same `lib/repository.ts` the REST routes use, so `search_mcp`/`get_mcp_details` and `/api/search`/`/api/mcp-entries/[slug]` cannot drift in behavior — one query layer, two transports.

## Trade-offs considered

| # | Decision | Options | Choice | Rationale |
|---|----------|---------|--------|-----------|
| 1 | Database for MVP | (a) SQLite file; (b) Postgres from day 1 | **(a) SQLite** | Zero-ops, single-file, trivial local/dev + demo deploy. `DATABASE_URL` env means the swap to Postgres is a connection-string + `provider` change plus a JSON-column migration — no app-logic rewrite because DTOs already present parsed arrays/objects. Cost: no native `Json`/enum/`String[]` (see #2). Acceptable at MVP catalog scale. |
| 2 | Structured fields (`tags`, `installArgs`, `installEnv`) storage | (a) native `Json`/`String[]`; (b) JSON-encoded `String` columns | **(b) String** — forced by #1 | SQLite provider lacks `Json` and scalar lists. Encode/decode centralized in `lib/serialize.ts`; the API boundary always exposes parsed shapes. This is the concrete tax of choosing SQLite and is isolated to one helper + the repository layer, so a future Postgres migration to native `Json` is contained. |
| 3 | Admin auth for MVP | (a) shared `ADMIN_TOKEN` bearer; (b) full user accounts / OAuth | **(a) token** | The only privileged action is approve/reject on a small queue by (presumably) the operator. Full auth (sessions, user table, password reset, RBAC) is disproportionate for one trusted role at MVP. Token guard fails closed (blank env ⇒ 401). Explicitly a stepping stone; Open Questions notes the upgrade path. |
| 4 | `transportType` / `status` typing | (a) Prisma `enum`; (b) `String` + zod validation | **(b) String + zod** | SQLite has no native enums. A shared zod schema in `lib/schemas.ts` enforces the allowed set across REST, MCP tools, and the admin form — arguably better than a DB enum because validation is co-located with the app's single source of truth and reused by the LLM-output validator. |
| 5 | Can agents write to the catalog? | (a) expose a `submit`/`register` MCP tool; (b) keep all 4 MCP tools read-only, registration REST-only | **(b) read-only tools** | The core safety invariant is "no unauthenticated path to publish." Making the MCP tools read-only means even a connected agent cannot enqueue (let alone publish) content; registration stays on the auditable REST path that gates on human approval. Keeps the agent surface purely a *consumer* of vetted data. |
| 6 | Submit extraction execution | (a) synchronous in-request; (b) background job/queue | **(a) sync for MVP**, contract-compatible with (b) | One fetch + one LLM call is fast enough to run in-request. Returning `202 { status: "pending" }` (rather than `200` with the row inline) preserves the option to move extraction to a background worker later without changing the client contract. |
| 7 | SSRF hardening depth | (a) scheme+DNS+redirect re-check+caps (check-then-fetch); (b) additionally pin validated IP to close TOCTOU | **(a) for MVP**, (b) noted | (a) blocks the overwhelmingly common SSRF vectors (private-range hosts, metadata IP, redirect-to-internal). Full TOCTOU closure (connect to the exact validated IP) adds a custom fetch agent; deferred and documented rather than silently skipped. |

## Cross-platform considerations

- Pure TypeScript/Next.js/Node app; no OS-specific shell code. Runs on Windows (Git Bash per workspace §11), macOS, and Linux identically.
- SQLite file path in `DATABASE_URL` uses a relative `file:./prisma/dev.db` form that Prisma resolves cross-platform.
- `@modelcontextprotocol/sdk` Streamable HTTP transport and `@anthropic-ai/sdk` are platform-agnostic npm packages.
- All secrets (`ANTHROPIC_API_KEY`, `ADMIN_TOKEN`, `DATABASE_URL`) come from env / `.env` — no hard-coded paths or credentials.

## Platform Impact (MANDATORY)

| Platform | Impact | Files Affected / Justification |
|----------|--------|-------------------------------|
| Claude Code (CLAUDE.md) | **N/A — project-local change** | `mcp-portal/` is a new **L2 co-develop variant project** scaffolded under this repo; it is not a workspace-root governance, hook, gateway, slash-command, or agent-roster change. Nothing in the root `CLAUDE.md`, `.claude/settings.json`, `.claude/commands/`, or `agents/` is added or modified by building this app. The one *indirect* Claude Code touchpoint is downstream, not a workspace edit: once published, the portal's own `/api/mcp` server can be added to a developer's `.mcp.json` — but that is a consumer action outside this repo, not a change to this workspace's Claude Code config. |
| Antigravity (GEMINI.md) | **N/A — project-local change (explicitly justified, not "None")** | Per the architect constraint, a null Antigravity impact requires written justification rather than a bare "None". The `--platform both` scaffold flag means the *new project's own* `.gemini/` config is generated by `new-project.ts` for `mcp-portal/` — but the **workspace-root `GEMINI.md` and root `.gemini/` are untouched**. This task defines no new agent, skill, or command at the workspace level, so there is no agent-facing behavior for the root GEMINI.md to govern. Antigravity-side parity for the project's *internal* command/skill scaffolding is handled generically by `new-project.ts --platform both` (the scaffolding-expert's parallel task), not by any design decision here. Hence: no root-GEMINI.md edit is warranted, and the reason is "this is an L2 application project, not a platform-governance or agent-surface change," not "we forgot Antigravity." |
| `templates/common` (L1) | **N/A — no propagation** | Nothing in `mcp-portal/` is a shared script, skill, command, or agent that belongs in `templates/common`. This is a leaf application, not reusable workspace infrastructure. Per CLAUDE.md §9 (Workspace & Template Boundary Policy), building this project must not touch `templates/` at all, and there is no `propagation-map.json` domain that would carry app files into templates. If, later, some `lib/` helper (e.g. `ssrf.ts`) proves broadly reusable, promoting it to a shared script would be a *separate* L0→L1 task with its own design — out of scope here. |

## Acceptance criteria

**MCP tools (`/api/mcp`)**
- [ ] The portal is reachable as an MCP server over Streamable HTTP at `/api/mcp`; an MCP client can connect and list exactly the 4 tools.
- [ ] `search_mcp(query)` returns lightweight match records (`id, name, description, category, tags[]`) for substring matches on name/description/tags; `search_mcp(query, category)` additionally filters by category; no match returns `[]`, not an error.
- [ ] `get_mcp_details(id)` returns the full published entry with `tags`/`installArgs` as arrays and `installEnv` as an object; unknown `id` returns an MCP error result (`isError: true`), not a 500.
- [ ] `get_install_config(id)` returns a paste-ready config: `command/args/env` under `mcpServers.<slug>` for stdio entries, `{ url }` for http/sse entries; `client` selects the wrapper convention; empty install fields degrade gracefully.
- [ ] `list_categories()` returns distinct categories with counts, sorted count-desc then name-asc, over published entries only.
- [ ] No MCP tool can create, edit, or delete catalog data (all four are read-only).

**Human search UI**
- [ ] `/` renders a search box plus category and tag filters and a results grid backed by `/api/search`.
- [ ] `/mcp/[slug]` renders a detail page for a published entry backed by `/api/mcp-entries/[slug]`; an unknown slug renders a 404 state.
- [ ] `/api/search` and `/api/mcp-entries` never expose the raw JSON-string storage encoding (always parsed arrays/objects).

**Submission pipeline**
- [ ] `POST /api/submit { url }` with a valid public URL creates exactly one `PendingSubmission` row with `status="pending"`, `sourceUrl` set, and `rawAnalysis` holding the verbatim LLM JSON — and creates **zero** `McpEntry` rows.
- [ ] The SSRF guard rejects (`400`, nothing persisted) non-http(s) schemes and any URL whose host resolves to loopback/private/link-local/reserved ranges, including on a redirect hop to such a target and including the `169.254.169.254` metadata address.
- [ ] Submit enforces a response byte cap and a request timeout.
- [ ] LLM output is zod-validated against the entry content schema before persistence; malformed output does not create a partial/invalid pending row.

**Approval flow**
- [ ] `/admin` and every `/api/admin/*` route require a valid `Authorization: Bearer <ADMIN_TOKEN>`; a missing/blank `ADMIN_TOKEN` env fails all admin access closed (`401`).
- [ ] Admin can list pending submissions, PATCH-edit their structured fields, then approve or reject.
- [ ] Approve creates one `McpEntry` (with a unique generated slug) from the current/edited fields and marks the submission `approved` in a single transaction; the entry is thereafter visible in the human UI **and** returned by the MCP tools.
- [ ] Reject marks the submission `rejected` and creates no `McpEntry`.
- [ ] There is no code path from an unauthenticated request to a published `McpEntry`.

## Open questions

1. **`remoteUrl` vs `homepage`** — I added `remoteUrl` to both models to hold the endpoint for `http`/`sse` transports (needed by `get_install_config`'s remote branch). Confirm this is desired as a distinct field, or whether `homepage` was intended to double as the remote endpoint. Cheap to collapse to one field if so.
2. **Port allowlist in SSRF guard** — should the MVP restrict outbound fetches to ports 80/443 only? Legitimate repo/npm/README pages rarely need other ports, and an allowlist closes a class of internal-service SSRF (e.g. `:6379`, `:5432`) cheaply. Defaulting to "restrict to 80/443" unless the PM wants arbitrary ports.
3. **TOCTOU hardening** — MVP uses check-then-fetch (DNS re-resolution risk between validation and connect). Confirm accepting this documented residual risk for MVP vs. requiring validated-IP pinning now (adds a custom fetch agent). Recommending accept-for-MVP.
4. **Category taxonomy** — is `category` a free-form string the LLM assigns, or should there be a fixed controlled vocabulary (enforced in `lib/schemas.ts`) so `list_categories()` stays clean? Recommending a small seeded controlled list to avoid near-duplicate categories from LLM drift; needs the PM's preferred initial set.
5. **Which Claude model for extraction** — `lib/extract.ts` needs a model id; recommend a mid-tier model for cost, but the exact id should be confirmed against the current registry before implementation (this is an implementation-time detail, flagged so it isn't hard-coded blindly).
6. **Rate limiting on `POST /api/submit`** — the public submit endpoint triggers an outbound fetch + a paid LLM call per request, so it is a cost/abuse vector. Not specified in the brief; recommend at least a simple per-IP rate limit for MVP. Flagging as a likely fast-follow if out of MVP scope.
