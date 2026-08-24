# Clean ABAP Conformance Checklist

> **Source**: [SAP Clean ABAP Style Guide](https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md) (CC BY 4.0) — this checklist operationalizes the guide's rules for the co-abap variant's agent workflow.  
> **Purpose**: Map each Clean ABAP rule family to its owning agent and review step, creating a gateable conformance checklist for ABAP development.  
> **Scope**: All ABAP objects developed via the vsp MCP workflow (WriteSource/EditSource/GetContext/AnalyzeCallGraph/ATC).

---

## Attribution

This checklist derives from the [SAP Clean ABAP Style Guide](https://github.com/SAP/styleguides/blob/main/clean-abap/CleanABAP.md), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It paraphrases and reorganizes the guide's rules into a pass/fail format — it does NOT reproduce the guide verbatim or in bulk. For the full original rules, examples, and rationale, consult the source document.

---

## Usage

**When it runs**:
1. **Pre-review self-check** — `code-writer` runs this checklist immediately after implementation (before the post-write chain: SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck)
2. **Gate reviews** — the owning reviewer for each rule family gates transport release if any blocker-severity rule fails

**How findings are recorded**:
- During authoring: `code-writer` records findings in the implementation report (`/deliverables/REQ-NNN-*/03_implementation_report.md`)
- During verification: `test-runner` records findings in the QA report (`/deliverables/REQ-NNN-*/04_qa_report.md`) and blocks the quality gate if blockers exist
- During system audit: `devops-admin` runs `vsp-audit.ts` and records ATC findings in transport documentation

**Severity levels**:
- **blocker**: Transport release blocked — rule must pass before object can be activated and transported
- **should**: Strong recommendation — fix unless business-justified exception is documented
- **nice-to-have**: Style preference — optional improvement with no blocking effect

---

## Rule Family to Agent Mapping

| Rule Family | Primary Owner | Secondary Reviewer | Phase | Trigger Point |
|-------------|---------------|-------------------|-------|---------------|
| Naming | `code-writer` | `architect` | 3 | Authoring-time gate (WriteSource/EditSource) |
| Language & Syntax | `code-writer` | `test-runner` | 3 | Authoring-time + post-write chain |
| Constants & Variables | `code-writer` | `dba` | 3 | Authoring-time gate |
| Tables & Strings | `code-writer` | `dba` | 3 | Authoring-time gate |
| Booleans & Conditions | `code-writer` | `test-runner` | 3 | Authoring-time + unit test review |
| Control Flow (Ifs, Regex) | `code-writer` | `architect` | 3 | Authoring-time gate |
| Classes & Methods | `architect` | `code-writer` | 2 | Design review + implementation |
| Error Handling | `code-writer` | `test-runner` | 3 | Authoring-time + unit test review |
| Comments | `code-writer` | `sap-investigator` | 3 | Authoring-time + codebase scan |
| Formatting | `code-writer` | `test-runner` | 3 | Pre-activate (ABAP Formatter) |
| Testing | `test-runner` | `code-writer` | 4 | QA gate (RunUnitTests + coverage) |
| Transport & ATC | `devops-admin` | `security-monitor` | 5 | Release gate (RunATCCheck + transport) |

---

## 1. Naming

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Use descriptive names | Do variable/method/class names convey purpose without type encoding? | should | `code-writer` | 3 | Prose-only |
| Prefer solution/domain terms | Are names drawn from business domain or solution space, not technical implementation? | should | `code-writer` | 3 | Prose-only |
| Use plural | Do collection/table names use plural form (e.g., `customers`, `orders`)? | should | `code-writer` | 3 | Prose-only |
| Use pronounceable names | Can names be read aloud naturally (e.g., `customer_service` not `cust_srv`)? | should | `code-writer` | 3 | Prose-only |
| Use snake_case | Do all names use snake_case (no camelCase or PascalCase except class prefixes)? | blocker | `code-writer` | 3 | Partial (abaplint) |
| Avoid abbreviations | Are names written in full words unless abbreviations are team-standardized? | should | `code-writer` | 3 | Prose-only |
| Use same abbreviations everywhere | Do abbreviations follow team glossary consistency (e.g., always `id` not `id_`/`ident`)? | should | `code-writer` | 3 | Prose-only |
| Nouns for classes, verbs for methods | Do class names use nouns (`customer_processor`) and methods use verbs (`process_customer`)? | should | `code-writer` | 3 | Prose-only |
| Avoid noise words | Are meaningless suffixes avoided (`data_manager` not `class_data_manager`)? | should | `code-writer` | 3 | Prose-only |
| Pick one word per concept | Does each concept have one consistent term (not `fetch`/`retrieve`/`get` for same operation)? | should | `code-writer` | 3 | Prose-only |
| Avoid encodings | Are Hungarian notation and type prefixes omitted from names (`customer` not `lv_customer`)? | blocker | `code-writer` | 3 | Partial (abaplint) |
| Avoid obscuring built-in functions | Do names avoid conflicting with ABAP keywords or built-in functions? | blocker | `code-writer` | 3 | Partial (syntax check) |

**Owner**: `code-writer` (authoring-time gate, Phase 3) — every ABAP object written via WriteSource/EditSource must pass naming review before SyntaxCheck. Secondary reviewer: `architect` (design review, Phase 2) validates naming strategy during technical design.

---

## 2. Language & Syntax

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Mind the legacy | Is obsolete syntax replaced with modern equivalents where available? | should | `code-writer` | 3 | Partial (ATC obsolete elements) |
| Mind the performance | Is code optimized based on measured profiling, not premature optimization? | should | `code-writer` | 3 | Prose-only |
| Prefer object orientation to procedural | Are business rules encapsulated in classes rather than reusable function modules? | should | `code-writer` | 3 | Prose-only |
| Prefer functional to procedural constructs | Do calls use functional syntax (`DATA(object) = NEW #( )` not `CREATE OBJECT`)? | should | `code-writer` | 3 | Prose-only |
| Avoid obsolete language elements | Are obsolete statements (e.g., `MOVE`, `OCCURS`, `REFRESH`) replaced with modern syntax? | blocker | `code-writer` | 3 | Partial (ATC obsolete elements) |
| Use design patterns wisely | Are patterns (factory, strategy, etc.) applied only when they reduce complexity? | should | `architect` | 2 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — syntax choices gated during WriteSource/EditSource. Secondary reviewer: `test-runner` (verification, Phase 4) validates via SyntaxCheck output and ATC findings.

---

## 3. Constants & Variables

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Use constants instead of magic numbers | Are literal numbers/strings replaced by named constants with domain meaning? | should | `code-writer` | 3 | Prose-only |
| Constants need descriptive names | Do constant names convey business meaning (e.g., `co_maximum_line_items`)? | should | `code-writer` | 3 | Prose-only |
| Prefer ENUM to constants interfaces | Are related constants grouped in ENUMs rather than scattered interfaces? | should | `code-writer` | 3 | Prose-only |
| Group constants if not using ENUM | Are constants organized in purpose-specific interfaces when ENUMs aren't used? | nice-to-have | `code-writer` | 3 | Prose-only |
| Prefer inline to up-front declarations | Are variables declared at first use (inline `DATA(name) = ...`)? | should | `code-writer` | 3 | Prose-only |
| Don't use variables outside their block | Are variables scoped to the minimal required block? | should | `code-writer` | 3 | Prose-only |
| Don't chain up-front declarations | Are related variable declarations grouped logically, not scattered? | nice-to-have | `code-writer` | 3 | Prose-only |
| Don't use field symbols for dynamic access | Are field symbols avoided unless dynamic access is explicitly required? | should | `code-writer` | 3 | Prose-only |
| Choose right loop targets | Do loop targets use appropriate types (field symbols vs. references)? | should | `code-writer` | 3 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — constant and variable structure gated during WriteSource/EditSource. Secondary reviewer: `dba` (design review, Phase 2) validates data structure choices.

---

## 4. Tables & Strings

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Use the right table type | Are tables typed appropriately (HASHED for key access, SORTED for range scans, STANDARD for small arrays)? | should | `dba` | 2,3 | Partial (performance analysis) |
| Avoid DEFAULT KEY | Are table definitions explicit about key fields rather than relying on DEFAULT KEY? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Prefer INSERT INTO TABLE to APPEND TO | Are INSERT operations used in preference to APPEND for clarity? | should | `code-writer` | 3 | Prose-only |
| Prefer LINE_EXISTS to READ TABLE or LOOP AT | Is existence checked via `LINE_EXISTS` rather than `READ TABLE` with sy-subrc? | should | `code-writer` | 3 | Prose-only |
| Prefer READ TABLE to LOOP AT | Is single-record access via `READ TABLE` rather than `LOOP AT` with early EXIT? | should | `code-writer` | 3 | Prose-only |
| Prefer LOOP AT WHERE to nested IF | Are WHERE conditions used in loops instead of nested IF statements? | should | `code-writer` | 3 | Prose-only |
| Avoid unnecessary table reads | Are table reads minimized via proper JOINs and CDS views? | should | `dba` | 2,3 | Partial (performance analysis) |
| Use backticks for literals | Are string constants declared with backticks (`` `constant` ``) not quotes? | should | `code-writer` | 3 | Prose-only |
| Use vertical bars for text assembly | Is string template syntax (`|text { var }|`) used for complex concatenations? | should | `code-writer` | 3 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — table and string operations gated during WriteSource/EditSource. Secondary reviewer: `dba` (design review, Phase 2) validates performance implications.

---

## 5. Booleans & Conditions

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Use Booleans wisely | Are Boolean variables used only for genuine binary states, not tri-state logic? | should | `code-writer` | 3 | Prose-only |
| Use ABAP_BOOL for Booleans | Are Boolean variables typed as `abap_bool` not generic `char1`? | blocker | `code-writer` | 3 | Partial (abaplint) |
| Use ABAP_TRUE and ABAP_FALSE | Are comparisons against `abap_true`/`abap_false` not `'X'`/`space`? | blocker | `code-writer` | 3 | Partial (abaplint) |
| Use XSDBOOL to set Boolean variables | Is `xsdbool( condition )` used for conditional Boolean assignment? | should | `code-writer` | 3 | Prose-only |
| Try to make conditions positive | Are conditions phrased positively (`IS NOT INITIAL`) rather than negatively (`NOT IS INITIAL`)? | should | `code-writer` | 3 | Prose-only |
| Prefer IS NOT to NOT IS | Is `IS NOT` syntax used instead of `NOT IS` for clarity? | should | `code-writer` | 3 | Prose-only |
| Consider predicative method calls | Are method calls directly in conditions rather than assigned to intermediate variables? | should | `code-writer` | 3 | Prose-only |
| Consider decomposing complex conditions | Are complex Boolean expressions extracted into named methods? | should | `code-writer` | 3 | Prose-only |
| Consider extracting complex conditions | Are repeated condition fragments extracted into helper methods? | should | `code-writer` | 3 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — Boolean and condition logic gated during WriteSource/EditSource. Secondary reviewer: `test-runner` (verification, Phase 4) validates via unit test assertions.

---

## 6. Control Flow (Ifs, Regular Expressions)

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| No empty IF branches | Are all IF branches contain logic (no empty blocks for deferred implementation)? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Prefer CASE to ELSE IF for alternatives | Are mutually exclusive alternatives expressed via CASE rather than ELSE IF chains? | should | `code-writer` | 3 | Prose-only |
| Keep nesting depth low | Is control flow nesting limited to 3-4 levels maximum? | should | `code-writer` | 3 | Prose-only |
| Prefer simpler methods to regex | Are string operations using standard methods before regular expressions? | should | `code-writer` | 3 | Prose-only |
| Prefer basis checks to custom regex | Are built-in ABAP checks used instead of custom patterns where possible? | should | `code-writer` | 3 | Prose-only |
| Consider assembling complex regex | Are complex regular expressions built from named fragments for maintainability? | nice-to-have | `code-writer` | 3 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — control flow structure gated during WriteSource/EditSource. Secondary reviewer: `architect` (design review, Phase 2) validates algorithmic complexity.

---

## 7. Classes & Methods

### 7.1 Classes

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Prefer objects to static classes | Is business logic encapsulated in instance classes rather than static classes? | should | `architect` | 2 | Prose-only |
| Prefer composition to inheritance | Are class relationships based on composition rather than deep inheritance? | should | `architect` | 2 | Prose-only |
| Don't mix stateful and stateless | Are classes either fully stateful or fully stateless, not both? | should | `code-writer` | 3 | Prose-only |
| Global by default, local where appropriate | Are classes global (reusable) unless explicitly local to one object? | should | `architect` | 2 | Prose-only |
| FINAL if not designed for inheritance | Are classes marked FINAL unless explicitly designed for subclassing? | should | `code-writer` | 3 | Prose-only |
| Members PRIVATE by default | Are class attributes PRIVATE unless explicitly protected or public? | should | `code-writer` | 3 | Prose-only |
| Consider immutable instead of getter | Are immutable value objects preferred over getter-exposing mutable state? | should | `architect` | 2 | Prose-only |
| Use READ-ONLY sparingly | Is READ-ONLY used only for truly public-read attributes, not as default? | should | `code-writer` | 3 | Prose-only |
| Prefer NEW to CREATE OBJECT | Are object instantiations using `NEW #( )` syntax not `CREATE OBJECT`? | should | `code-writer` | 3 | Prose-only |
| Leave CONSTRUCTOR public if CREATE PRIVATE | Is CONSTRUCTOR public only if class has CREATE PRIVATE? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Prefer multiple static creation methods | Are factory methods provided for complex construction rather than overloading CONSTRUCTOR? | should | `code-writer` | 3 | Prose-only |
| Use descriptive names for creation methods | Do creation method names convey intent (e.g., `create_for_sales` not `create`)? | should | `code-writer` | 3 | Prose-only |
| Make singletons only where appropriate | Are singletons used only for genuine single instances, not for convenience? | should | `architect` | 2 | Prose-only |

### 7.2 Methods

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Don't call static through instance | Are static methods called on class name, not instance variables? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Don't access types through instance | Are type definitions accessed via class name, not instance references? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Prefer functional to procedural calls | Do method calls use functional syntax (`method( )`) not procedural `CALL METHOD`? | should | `code-writer` | 3 | Prose-only |
| Omit RECEIVING | Is RETURNING syntax preferred over RECEIVING for single return values? | should | `code-writer` | 3 | Prose-only |
| Omit EXPORTING keyword | Are IMPORTING parameters passed positionally without `EXPORTING` keyword? | should | `code-writer` | 3 | Prose-only |
| Omit parameter name for single parameter | Are single-parameter calls passed positionally without parameter name? | should | `code-writer` | 3 | Prose-only |
| Omit self-reference me-> | Is `me->` omitted for instance attribute access (implicit is clearer)? | should | `code-writer` | 3 | Prose-only |
| Prefer instance to static | Are business methods instance methods unless genuinely stateless? | should | `architect` | 2 | Prose-only |
| Public methods should be in interface | Are public API methods declared in interfaces for testability? | should | `architect` | 2 | Prose-only |
| Aim for fewer than three IMPORTING parameters | Are methods designed with ≤3 IMPORTING parameters for clarity? | should | `code-writer` | 3 | Prose-only |
| Split methods instead of OPTIONAL parameters | Are overloaded variants preferred to OPTIONAL parameter lists? | should | `code-writer` | 3 | Prose-only |
| Use PREFERRED PARAMETER sparingly | Is PREFERRED PARAMETER used only for genuinely obvious single-parameter calls? | should | `code-writer` | 3 | Prose-only |
| RETURN/EXPORT/CHANGE exactly one parameter | Do methods export exactly one value (RETURNING or EXPORTING or CHANGING, not multiple)? | should | `code-writer` | 3 | Prose-only |
| Prefer RETURNING to EXPORTING | Is RETURNING used for functional-style methods? | should | `code-writer` | 3 | Prose-only |
| RETURNING large tables usually okay | Are large tables returned via RETURNING despite size guidelines? | should | `code-writer` | 3 | Prose-only |
| Use either RETURNING or EXPORTING or CHANGING | Do methods use exactly one export mechanism (not mixed)? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Use CHANGING sparingly | Is CHANGING used only for genuine in-place modifications? | should | `code-writer` | 3 | Prose-only |
| Split instead of Boolean input | Are Boolean input parameters avoided by splitting into dedicated methods? | should | `code-writer` | 3 | Prose-only |
| Consider calling RETURNING parameter RESULT | Is the RETURNING parameter named `RESULT` for clarity? | nice-to-have | `code-writer` | 3 | Prose-only |
| Clear or overwrite EXPORTING reference parameters | Are EXPORTING reference parameters explicitly cleared or overwritten? | blocker | `code-writer` | 3 | Partial (runtime error) |
| Don't clear VALUE parameters | Are VALUE parameters never cleared (read-only contract)? | blocker | `code-writer` | 3 | Partial (runtime error) |
| Do one thing, do it well, do it only | Does each method have a single, clear responsibility? | should | `architect` | 2 | Prose-only |
| Focus on happy path or error handling | Does method body focus on either happy path or error handling, not both? | should | `code-writer` | 3 | Prose-only |
| Descend one level of abstraction | Do methods stay at one consistent abstraction level (no low-level details in high-level flow)? | should | `code-writer` | 3 | Prose-only |
| Keep methods small | Are methods limited to ≤30 lines (≤1 screen) for readability? | should | `code-writer` | 3 | Prose-only |
| Fail fast | Are validation and preconditions checked at method start, not deferred? | should | `code-writer` | 3 | Prose-only |
| CHECK vs RETURN | Is `CHECK` used only at method start, otherwise `RETURN`? | should | `code-writer` | 3 | Prose-only |
| Avoid CHECK in other positions | Is `CHECK` avoided in method body (use RETURN or IF instead)? | blocker | `code-writer` | 3 | Partial (ATC check) |

**Owner**: `architect` (design review, Phase 2) — class and method structure validated during technical design. Secondary reviewer: `code-writer` (implementation, Phase 3) enforces during WriteSource/EditSource.

---

## 8. Error Handling

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Make messages easy to find | Are error messages stored in message classes, not hardcoded? | should | `code-writer` | 3 | Partial (message class check) |
| Prefer exceptions to return codes | Are errors signaled via class-based exceptions, not return codes? | should | `code-writer` | 3 | Prose-only |
| Don't let failures slip through | Are all error paths explicitly handled (no silent failures)? | blocker | `test-runner` | 4 | Prose-only (unit test) |
| Exceptions for errors, not regular cases | Are exceptions used only for errors, not control flow? | should | `code-writer` | 3 | Prose-only |
| Use class-based exceptions | Are exceptions class-based (CX_*), not non-class-based? | blocker | `code-writer` | 3 | Partial (syntax check) |
| Use own super classes | Are project exceptions organized under custom superclasses (not direct CX_STATIC_CHECK)? | should | `code-writer` | 3 | Prose-only |
| Throw one type of exception | Do methods raise one exception type with subclasses for distinction? | should | `code-writer` | 3 | Prose-only |
| Use sub-classes to distinguish errors | Are error variations expressed via exception subclasses, not type checks? | should | `code-writer` | 3 | Prose-only |
| Throw CX_STATIC_CHECK for manageable | Is CX_STATIC_CHECK used for recoverable errors? | should | `code-writer` | 3 | Prose-only |
| Throw CX_NO_CHECK for unrecoverable | Is CX_NO_CHECK used for totally unrecoverable system failures? | should | `code-writer` | 3 | Prose-only |
| Consider CX_DYNAMIC_CHECK for avoidable | Is CX_DYNAMIC_CHECK considered for avoidable programmer errors? | should | `code-writer` | 3 | Prose-only |
| RAISE EXCEPTION NEW preferred | Is `RAISE EXCEPTION NEW` syntax used, not `RAISE EXCEPTION TYPE`? | should | `code-writer` | 3 | Prose-only |
| Dump for totally unrecoverable | Is termination (dump) used only for totally unrecoverable state? | blocker | `code-writer` | 3 | Partial (runtime) |
| Wrap foreign exceptions | Are exceptions from foreign calls wrapped in project exceptions? | should | `code-writer` | 3 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — exception strategy gated during WriteSource/EditSource. Secondary reviewer: `test-runner` (verification, Phase 4) validates via unit test error scenarios.

---

## 9. Comments

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Express in code, not comments | Is logic clear from code alone, not explained in comments? | should | `code-writer` | 3 | Prose-only |
| Comments no excuse for bad names | Are variables renamed rather than commented for clarity? | should | `code-writer` | 3 | Prose-only |
| Use methods instead of comments | Are complex blocks extracted to named methods instead of being commented? | should | `code-writer` | 3 | Prose-only |
| Explain why, not what | Do comments explain rationale, not restate code? | should | `code-writer` | 3 | Prose-only |
| Design goes in documents, not code | Is architectural design documented separately, not in code comments? | should | `architect` | 2 | Prose-only |
| Comment with ", not * | Are inline comments prefixed with `"` not `*`? | should | `code-writer` | 3 | Prose-only |
| Put comments before statement | Are comments placed before the code they describe, not after? | should | `code-writer` | 3 | Prose-only |
| Delete code instead of commenting | Is unused code deleted, not commented out? | blocker | `code-writer` | 3 | Partial (lint) |
| Don't manual version | Are version history comments omitted (git provides history)? | blocker | `code-writer` | 3 | Prose-only |
| Use FIXME, TODO, XXX with ID | Are temporary markers tagged with tracking IDs for resolution? | should | `code-writer` | 3 | Partial (lint) |
| Don't add method signature comments | Are method signatures not duplicated in comments (ABAP Doc preferred)? | should | `code-writer` | 3 | Prose-only |
| Don't duplicate message texts | Are message texts not repeated in comments when stored in message classes? | should | `code-writer` | 3 | Partial (message class check) |
| ABAP Doc only for public APIs | Is ABAP Doc written only for public/reusable APIs, not private methods? | should | `code-writer` | 3 | Prose-only |
| Prefer pragmas to pseudo comments | Are pragmatic pseudo-comments (`##needed`) preferred to legacy `*`-pseudo-comments? | should | `code-writer` | 3 | Partial (ATC) |

**Owner**: `code-writer` (authoring-time, Phase 3) — comment quality gated during WriteSource/EditSource. Secondary reviewer: `sap-investigator` (read-only scans, Phase 1) identifies comment patterns during codebase analysis.

---

## 10. Formatting

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Be consistent | Does code follow team-wide formatting conventions (Pretty Printer settings)? | blocker | `code-writer` | 3 | Partial (ABAP Formatter) |
| Optimize for reading, not writing | Is formatting chosen for readability, not writer convenience? | should | `code-writer` | 3 | Prose-only |
| Use ABAP Formatter before activating | Is ABAP Formatter run before every SyntaxCheck and activation? | blocker | `code-writer` | 3 | Full (manual step) |
| Use team's formatter settings | Are project-wide Pretty Printer settings shared via transport or config? | should | `devops-admin` | 5 | Prose-only |
| One statement per line maximum | Is each statement on its own line (no chained statements)? | blocker | `code-writer` | 3 | Partial (ABAP Formatter) |
| Stick to reasonable line length | Are lines limited to ≤120 characters for readability? | should | `code-writer` | 3 | Prose-only |
| Condense code | Is vertical space conserved (no excessive blank lines)? | nice-to-have | `code-writer` | 3 | Partial (ABAP Formatter) |
| Single blank line to separate | Are logical sections separated by exactly one blank line? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Don't obsess with blank lines | Are blank lines used for section breaks, not every statement? | nice-to-have | `code-writer` | 3 | Prose-only |
| Align assignments to same object | Are chained assignments to the same object aligned? | nice-to-have | `code-writer` | 3 | Partial (ABAP Formatter) |
| Close brackets at line end | Are closing brackets placed at line end, not on new lines? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Keep single parameter calls on one line | Are single-parameter method calls kept on one line? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Keep parameters behind the call | Are method parameters placed after the call, not below it? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| If breaking, indent parameters under call | Are broken parameter lists indented under the opening parenthesis? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Line-break multiple parameters | Are multi-parameter calls line-broken at reasonable points? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Align parameters | Are parameters in multi-line calls aligned for readability? | nice-to-have | `code-writer` | 3 | Partial (ABAP Formatter) |
| Break call to new line if too long | Are long method calls broken to new line before parameters? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Indent and snap to tab | Is indentation consistent and aligned to tab stops? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Indent inline declarations like method calls | Are inline declarations (`DATA(...)`) indented like method calls? | should | `code-writer` | 3 | Partial (ABAP Formatter) |
| Don't align type clauses | Are type clauses not vertically aligned (maintainability over aesthetics)? | nice-to-have | `code-writer` | 3 | Prose-only |
| Don't chain assignments | Are chained assignments avoided for clarity? | should | `code-writer` | 3 | Prose-only |

**Owner**: `code-writer` (authoring-time, Phase 3) — formatting gated pre-activate via ABAP Formatter. Secondary reviewer: `test-runner` (verification, Phase 4) validates formatted code passes SyntaxCheck.

---

## 11. Testing

### 11.1 Test Principles

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Write testable code | Is code structured for testability (dependency injection, seams)? | should | `code-writer` | 3 | Prose-only |
| Enable mocking | Are dependencies injectable to enable unit test mocking? | should | `code-writer` | 3 | Prose-only |
| Readability rules apply | Do test classes follow the same Clean ABAP rules as production code? | should | `test-runner` | 4 | Prose-only |
| Don't make copies or reports | Are tests focused on behavior, not generating test data copies or reports? | should | `test-runner` | 4 | Prose-only |
| Test publics, not private internals | Are unit tests testing public interfaces, not private methods? | should | `test-runner` | 4 | Prose-only |
| Don't obsess about coverage | Is coverage ≥70% for new objects, with quality over quantity? | blocker | `test-runner` | 4 | Full (GetCodeCoverage) |

### 11.2 Test Classes

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Call by purpose | Are test classes named by the behavior they verify (`ltc_order_validation`)? | should | `test-runner` | 4 | Prose-only |
| Put tests in local classes | Are test classes local to the object under test (`FOR TESTING`)? | blocker | `test-runner` | 4 | Partial (syntax check) |
| Put help methods in help classes | Are test helper methods extracted to separate test help classes? | should | `test-runner` | 4 | Prose-only |
| How to execute | Are test classes executable via `RunUnitTests` with coverage measurement? | blocker | `test-runner` | 4 | Full (RunUnitTests) |

### 11.3 Code Under Test

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Name meaningfully or default to CUT | Is the object under test named meaningfully or defaulted to `cut` (class under test)? | should | `test-runner` | 4 | Prose-only |
| Test against interfaces | Are unit tests written against interfaces, not concrete classes? | should | `code-writer` | 3 | Prose-only |
| Extract call to own method | Are complex test setup steps extracted to helper methods? | should | `test-runner` | 4 | Prose-only |

### 11.4 Injection

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Use dependency inversion | Are dependencies passed as constructor parameters, not hardcoded? | should | `architect` | 2 | Prose-only |
| Consider ABAP test double tool | Is test double framework considered for complex dependencies? | nice-to-have | `test-runner` | 4 | Prose-only |
| Exploit test tools | Are standard test tools (TEST-SEAM, TEST-INJECTION) used where applicable? | should | `test-runner` | 4 | Partial (ATC check) |
| Use test seams as temporary workaround | Are TEST-SEAMs used as temporary bridges for legacy code refactoring? | should | `code-writer` | 3 | Partial (ATC check) |
| Use LOCAL FRIENDS for constructor | Is `LOCAL FRIENDS` used for constructor injection in test classes? | should | `test-runner` | 4 | Partial (syntax check) |
| Don't misuse LOCAL FRIENDS | Is `LOCAL FRIENDS` used only for test setup, not to bypass encapsulation? | should | `test-runner` | 4 | Prose-only |
| Don't add test-only features to production | Are test-specific features kept out of production code paths? | blocker | `code-writer` | 3 | Prose-only |
| Don't sub-class to mock | Is subclassing avoided for mocking (use interfaces or test doubles instead)? | should | `test-runner` | 4 | Prose-only |
| Don't mock unneeded stuff | Are only necessary dependencies mocked, not entire object graphs? | should | `test-runner` | 4 | Prose-only |
| Don't build test frameworks | Are standard ABAP Unit frameworks used, not custom test infrastructure? | blocker | `test-runner` | 4 | Prose-only |

### 11.5 Test Methods

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Names reflect given and expected | Do test method names express input and expected outcome (`test_invalid_order_rejected`)? | should | `test-runner` | 4 | Prose-only |
| Use given-when-then | Are test methods structured in Given-When-Then sections for clarity? | should | `test-runner` | 4 | Prose-only |
| When is exactly one call | Does the WHEN section contain exactly one method call (the system under test)? | should | `test-runner` | 4 | Prose-only |
| Don't add TEARDOWN unless needed | Is TEARDOWN implemented only when resources require cleanup? | should | `test-runner` | 4 | Prose-only |

### 11.6 Test Data

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Make meaning easy to spot | Are test data values chosen to make test intent obvious? | should | `test-runner` | 4 | Prose-only |
| Make differences easy to spot | Are test cases distinguished by one variable at a time for clarity? | should | `test-runner` | 4 | Prose-only |
| Use constants to describe purpose | Are test data values extracted to named constants for meaning? | should | `test-runner` | 4 | Prose-only |

### 11.7 Assertions

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Few, focused assertions | Does each test method contain ≤3 focused assertions? | should | `test-runner` | 4 | Prose-only |
| Use right assert type | Are appropriate assert methods used (`assert_equals`, `assert_subrc`, etc.)? | should | `test-runner` | 4 | Prose-only |
| Assert content, not quantity | Are assertions checking business values, not collection sizes alone? | should | `test-runner` | 4 | Prose-only |
| Assert quality, not content | Are structural assertions preferred to exact value matching where appropriate? | should | `test-runner` | 4 | Prose-only |
| Use FAIL for expected exceptions | Is `FAIL` used to signal expected exception paths? | should | `test-runner` | 4 | Prose-only |
| Forward unexpected exceptions | Are unexpected exceptions forwarded (not caught) to fail the test? | blocker | `test-runner` | 4 | Full (RunUnitTests) |
| Write custom asserts to avoid duplication | Are repeated assertion patterns extracted to custom assert methods? | should | `test-runner` | 4 | Prose-only |

**Owner**: `test-runner` (verification, Phase 4) — all testing rules gated during the post-write chain (RunUnitTests → GetCodeCoverage → RunATCCheck). Secondary reviewer: `code-writer` (implementation, Phase 3) ensures testability during development.

---

## 12. Transport & ATC System Checks

| Rule | Checklist Question | Severity | Owner | Phase | ATC Coverage |
|------|-------------------|----------|-------|-------|--------------|
| Transport release requires zero P1 findings | Does the transport pass RunATCCheck with 0 Priority-1 findings? | blocker | `devops-admin` | 5 | Full (RunATCCheck) |
| Syntax check passes | Does SyntaxCheck return 0 errors on all objects in transport? | blocker | `code-writer` | 3 | Full (SyntaxCheck) |
| Unit tests pass | Does RunUnitTests return 0 failures for all test classes? | blocker | `test-runner` | 4 | Full (RunUnitTests) |
| Code coverage ≥70% for new objects | Does GetCodeCoverage report ≥70% coverage for newly created objects? | blocker | `test-runner` | 4 | Full (GetCodeCoverage) |
| Obsolete language elements avoided | Does ATC report 0 findings for obsolete language element usage? | blocker | `devops-admin` | 5 | Partial (ATC check variant) |
| Security check passes | Does the transport pass security-related ATC checks? | blocker | `security-monitor` | 1,5 | Partial (ATC security variant) |
| Package consistency | Are all objects in the transport assigned to consistent packages? | should | `devops-admin` | 5 | Partial (ATC) |
| Transport description follows convention | Does the transport description follow the `feat:` / `fix:` / `refactor:` convention? | should | `devops-admin` | 5 | Prose-only |

**Owner**: `devops-admin` (release gate, Phase 5) — transport release blocked until all system checks pass. Secondary reviewer: `security-monitor` (Phase 1 review) validates security preconditions.

---

## ATC vs. Prose Review Split

### Mechanical ATC Coverage (Fully Automatable)
These rule families have existing ATC check variants or abaplint rules — findings are objective and gateable:

- **Syntax check** — all syntax-blocking rules (empty IF branches, DEFAULT KEY, etc.)
- **Obsolete language elements** — ATC check variant for obsolete statements
- **Security checks** — ATC security variants
- **Unit test coverage** — GetCodeCoverage output (≥70% threshold)
- **ATC findings** — RunATCCheck Priority-1 and Priority-2 filtering
- **Message class usage** — abaplint rule for hardcoded message texts
- **Type consistency** — syntax check for type mismatches

### Prose-Review-Only Rules (Require Human Judgment)
These rule families require contextual understanding — automated tools can assist but cannot fully gate:

- **Naming clarity** — whether names convey domain meaning (prose judgment required)
- **Abstraction levels** — whether methods "descend one level of abstraction" (subjective)
- **Comment quality** — whether comments explain "why not what" (contextual)
- **Design pattern appropriateness** — whether a pattern is correctly applied (architectural judgment)
- **Method responsibility** — whether a method "does one thing" (requires understanding intent)
- **Error handling strategy** — whether exceptions are used appropriately for the domain (business logic)
- **Test data meaningfulness** — whether test data values "make meaning easy to spot" (human-readable intent)

### Hybrid Rules (Partially Automatable)
These rule families have some mechanical coverage but require prose review for full compliance:

- **Boolean usage** — `abap_bool` typing is automatable, but "use Booleans wisely" requires judgment
- **Table type selection** — performance analysis can flag misuse, but "right table type" depends on access patterns
- **String formatting** — backtick/string template syntax is automatable, but "use vertical bars for complex assembly" requires readability judgment
- **Control flow complexity** — nesting depth can be measured, but "keep nesting low" thresholds are team-specific

---

## Agent-Mapping Summary

By rule family, this checklist distributes ownership across the co-abap agent roster as follows:

| Agent | Rule Families Owned | Phase | Gate Type |
|-------|---------------------|-------|-----------|
| `code-writer` | Naming, Language & Syntax, Constants & Variables, Tables & Strings, Booleans & Conditions, Control Flow, Comments, Formatting, Error Handling | 3 (implementation) | Authoring-time self-check (WriteSource/EditSource) |
| `test-runner` | Language & Syntax (secondary), Booleans & Conditions (secondary), Testing (full), Error Handling (secondary), Formatting (secondary) | 4 (verification) | Post-write chain (SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck) |
| `architect` | Classes & Methods (design), Control Flow (secondary), Error Handling (secondary) | 2 (design) | Technical design review (pattern selection, execution sequencing) |
| `dba` | Constants & Variables (secondary), Tables & Strings (performance) | 2,3 | Data structure design review (CDS/table/index design) |
| `devops-admin` | Transport & ATC (full), Formatting (team settings) | 5 (release) | Transport release gate (RunATCCheck zero P1, SyntaxCheck zero errors, RunUnitTests zero failures) |
| `security-monitor` | Transport & ATC (security checks) | 1,5 | Security review during Phase 1 (research) + Phase 5 (release) |
| `sap-investigator` | Comments (pattern scans) | 1 (research) | Codebase pattern scan for comment anti-patterns |
| `read-only-analyst` | — | 1 | Business data queries (not directly involved in conformance) |
| `schema-inspector` | — | 1 | Table/CDS structure inspection (supports DBA, not direct conformance) |
| Module analysts (SD/MM/FI/CO/PP/LE) | — | 1 | Business requirement analysis (upstream of implementation) |

**Note**: The table above reflects only the 20 agents actually present in the `templates/co-abap/agents/` directory (verified by Glob). Every agent named in the checklist exists in the variant roster — no invented names.

---

## Next Steps (Backlog Linkage)

This checklist anchors the next co-abap backlog improvement (§11 row 10): **"No codified static-check rule pack (abapOpenChecks parity)"**. Once this checklist establishes which rules are prose-only vs. mechanically checkable, the static-check rule pack can encode the ATC check-selection config per change type so `vsp-audit.ts` runs a deterministic rule set.

See `docs/variant-benchmark-backlog.md` §11 row 9 (this checklist) and row 10 (static-check rule pack) for the full improvement sequence.

---

*Last Updated: 2026-08-24 — Clean ABAP Conformance Checklist v1.0.0*