# Verified Mass-Rewrite Technique — Bounded Chunks + Independent Verification

From co-deck's lecture-v4 narration rewrite (T-20261007-009; source: co-deck
design D7, PR #164, `storyline.md` v4.2 header). Any mass text edit —
localization passes, tone tuning, terminology sweeps — inherits the failure
mode that a rewrite silently destroys structure or meaning. This technique
makes that detectable before apply.

## The technique

1. **Bounded chunks.** Rewrite in per-document-section chunks (co-deck: one
   slide narration per chunk), never a whole-file prompt.
2. **Independent pre-apply verification per chunk** — asserted by a checker
   script, not by re-reading the model's output:
   - **Markers intact**: section markers/count identical to the source
     (slide markers survived the rewrite).
   - **Token multisets identical** for invariant classes: digits and Latin
     tokens per section must match the source exactly (the rewrite may not
     invent, drop, or translate numbers and identifiers).
   - **Bounded diff**: no section changes more than a set ceiling
     (co-deck: 30%; actual average 1.2%) — a huge per-section delta means
     the chunk was replaced, not rewritten.
3. **Deliberately excluded surfaces stay excluded**: titles/bullets were not
   rewritten (the verification would reject them anyway — their token
   multiset IS the content).

## Why not prompt-only QA

The checker is deterministic: it fails on structure/number drift regardless
of how plausible the rewritten text reads. Prompt-side instructions ("keep
the numbers") are advisory; the multiset assertion is a gate.

## Filing

Reusable-skill candidate noted in T-20261007-009; until promoted, this guide
is the reference implementation description.
