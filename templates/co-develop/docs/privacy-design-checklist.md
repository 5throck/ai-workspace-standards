# Privacy Design Checklist — Personal-Data Consulting Deliverables

*privacy-design-checklist.md version: 1.0 — promoted 2026-09-06 from the harness-assessment privacy ADRs (ADR-0002/-0003/-0008/-0009)
<!-- Generalized from the harness-assessment engagement's privacy ADRs -->
<!-- (ADR-0002 encrypted persistence / anonymized admin, ADR-0003 email-ID +
     approval-code bootstrap + reset-only credentials, ADR-0008 activation/admin
     identity separation, ADR-0009 auth hardening + masked identifier surfacing).
     App-specific mechanics were removed; the invariants below are the
     template-grade residue. Apply at design review time, before implementation. -->

Threat model in one line: **a leaked database must reveal nothing, and an
administrator must not be able to look up a specific person's result.**

## Design Principles (checklist)

### 1. Data at rest

- [ ] Personal fields (name, email, company, department, free-text answers) are
      **encrypted at rest** with an authenticated cipher (e.g. AES-256-GCM).
- [ ] The encryption master key lives **outside the database** (env var or key
      file with restrictive permissions) and is **backed up with the database** —
      key loss means permanent data loss; document this for operators.
- [ ] Fields that must be looked up (e.g. login by email) use a **keyed hash
      (HMAC) column** — never plaintext, never searchable ciphertext.
- [ ] Passwords/secrets are stored as **slow hashes with per-record salt**
      (scrypt/argon2/bcrypt) and compared in constant time.

### 2. Identity minimization

- [ ] The login identifier is the **minimum durable identifier** needed (in the
      source engagement: the participant's email — everything else is profile
      data, not credentials).
- [ ] No hard-coded default or initial credential exists anywhere in the system.
- [ ] Every privileged role is bootstrapped through an **out-of-band approval
      channel** (e.g. one-time emailed code, HMAC-stored with short TTL,
      single-use), so identity is anchored in a channel the person controls.

### 3. Administrator vs. participant visibility

- [ ] **Activation and administration are separated**: whoever provisions or
      resets accounts cannot see assessment content or individual results.
- [ ] Participants appear to admins as **pseudonymous codes**; personal
      identifiers never leave the server unsurfaced.
- [ ] Per-person results are **not admin-visible**; breakdowns apply
      **k-anonymity** (small groups suppressed, k ≥ 5).
- [ ] When an identifier must be surfaced for account management, it is
      **masked server-side** (e.g. `a***e@domain`) and never rendered in full.

### 4. Credential lifecycle

- [ ] Admins can **reset but never view or choose** participant credentials.
- [ ] Temporary credentials are random, delivered **directly to the
      participant's channel** (email) — they must not transit the admin API.
- [ ] One-time codes/credentials are stored only as keyed hashes with short
      TTLs and are invalidated after use; a reset **invalidates existing
      sessions**.
- [ ] Disclosure-channel fallback (no SMTP/mail relay configured) is a
      documented manual step, never an API response.

### 5. Integrity & validation

- [ ] Scoring/aggregation runs **server-side**; every client-submitted item is
      re-validated (ID existence, value range) before persistence.
- [ ] Sensitive values never appear in logs; the log file is audited with the
      same checklist as the database.

## Review Protocol

1. Run this checklist at **design review** (before implementation starts), at
   every security-audit pass, and before client-facing delivery.
2. Every unchecked item needs a written justification or a follow-up ticket —
   silence is not approval.
3. Schema changes touching personal fields re-trigger item 1 (Zod/contract
   gates per `docs/co-develop.context.md` lifecycle table apply).

## Provenance

Distilled 2026-09-06 from `Projects/co-develop/deliverables/harness-assessment/docs/adr/`
(ADR-0002, -0003, -0008, -0009) per the ADR-0031 backport review: engagement
mechanics stayed in the project; these invariants are the reusable residue.
