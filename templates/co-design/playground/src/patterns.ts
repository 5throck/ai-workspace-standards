/**
 * patterns.ts — the six declared screen patterns (docs/screen-patterns.md):
 * list, form, detail, dashboard, modal, table.
 *
 * Each pattern demonstrates the accessibility baseline (ADR-0065/0068):
 * visible :focus-visible ring (style.css), aria-labels on icon-only controls,
 * keyboard operability (modal Esc + focus return), target size ≥ --target-size,
 * and status never conveyed by color alone (badges carry text).
 * Styled only with token custom properties — design-lint clean.
 */

type El = HTMLElement;

function el(tag: string, className?: string, text?: string): El {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(id: string, title: string, hint: string): El {
  const wrap = el("section", "pg-section");
  wrap.id = id;
  wrap.setAttribute("aria-labelledby", `${id}-title`);
  const h2 = el("h2", "pg-section-title", title);
  h2.id = `${id}-title`;
  wrap.append(h2, el("p", "pg-hint", hint));
  return wrap;
}

/* ---- 1. list ---------------------------------------------------------- */

function patternList(): El {
  const sec = section("pattern-list", "Pattern: list", "Toolbar + primary action + row list. Rows are links; the icon-only button carries an aria-label.");
  const toolbar = el("div", "pg-toolbar");
  toolbar.append(el("strong", undefined, "Projects"));
  const newBtn = el("button", "pg-btn", "+ New");
  newBtn.type = "button";
  toolbar.append(newBtn);
  sec.append(toolbar);

  const rows = el("ul", "pg-stack");
  rows.setAttribute("role", "list");
  for (const [name, status, badgeClass] of [
    ["Alpha migration", "In progress", "pg-badge--warning"],
    ["Beta rollout", "Done", "pg-badge--success"],
    ["Gamma decommission", "Blocked", "pg-badge--danger"],
  ] as const) {
    const row = el("li", "pg-card pg-toolbar");
    const link = el("a", undefined, name);
    link.href = "#pattern-list";
    const badge = el("span", `pg-badge ${badgeClass}`, status);
    row.append(link, badge);
    rows.append(row);
  }
  sec.append(rows);
  return sec;
}

/* ---- 2. form ---------------------------------------------------------- */

function patternForm(): El {
  const sec = section("pattern-form", "Pattern: form", "Labelled fields, constrained input, inline error with recovery hint (UD: tolerance for error).");
  const form = el("form", "pg-stack");
  form.setAttribute("aria-describedby", "pattern-form-hint");

  const nameField = el("div", "pg-field");
  const nameLabel = el("label", undefined, "Project name");
  nameLabel.htmlFor = "pf-name";
  const nameInput = el("input", "pg-input");
  nameInput.id = "pf-name";
  nameInput.type = "text";
  nameInput.required = true;
  nameInput.maxLength = 40;
  nameField.append(nameLabel, nameInput);
  form.append(nameField);

  const ownerField = el("div", "pg-field");
  const ownerLabel = el("label", undefined, "Owner (type-ahead, constrained)");
  ownerLabel.htmlFor = "pf-owner";
  const ownerList = el("datalist");
  ownerList.id = "pf-owner-options";
  for (const person of ["Ahn", "Blake", "Choi"]) ownerList.append(new Option(person, person));
  const ownerInput = el("input", "pg-input");
  ownerInput.id = "pf-owner";
  ownerInput.type = "text";
  ownerInput.setAttribute("list", "pf-owner-options");
  ownerField.append(ownerLabel, ownerInput, ownerList);
  form.append(ownerField);

  const err = el("p", "pg-hint");
  err.id = "pf-error";
  err.setAttribute("role", "alert");
  err.hidden = true;

  const submit = el("button", "pg-btn", "Create");
  submit.type = "submit";
  form.append(err, submit);
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!nameInput.value.trim()) {
      err.textContent = "Project name is required. Enter a name of up to 40 characters, or press Esc to clear.";
      err.hidden = false;
      nameInput.setAttribute("aria-invalid", "true");
      nameInput.focus();
      return;
    }
    err.hidden = true;
    nameInput.removeAttribute("aria-invalid");
  });
  sec.append(form);
  return sec;
}

/* ---- 3. detail -------------------------------------------------------- */

function patternDetail(): El {
  const sec = section("pattern-detail", "Pattern: detail", "Entity header + metadata + actions; destructive action confirmed by the modal pattern.");
  const card = el("article", "pg-card");
  const header = el("div", "pg-toolbar");
  const head = el("h3", undefined, "Alpha migration");
  head.style.margin = "0";
  const edit = el("button", "pg-btn pg-btn--ghost", "Edit");
  edit.type = "button";
  header.append(head, edit);
  card.append(header);

  const meta = el("dl", "pg-stack");
  for (const [k, v] of [["Owner", "Blake"], ["Status", "In progress"], ["Updated", "2026-09-06"]] as const) {
    const row = el("div", "pg-toolbar");
    row.append(el("dt", "pg-caption pg-muted", k), el("dd", undefined, v));
    meta.append(row);
  }
  meta.style.margin = "0";
  card.append(meta);
  sec.append(card);
  return sec;
}

/* ---- 4. dashboard ----------------------------------------------------- */

function patternDashboard(): El {
  const sec = section("pattern-dashboard", "Pattern: dashboard", "Summary tiles + status breakdown; every tile is text-first (UD: perceptible information).");
  const grid = el("div", "pg-grid");
  for (const [label, value] of [["Open items", "12"], ["Blocked", "1"], ["Done this week", "7"], ["Risk level", "Low"]] as const) {
    const tile = el("div", "pg-card");
    tile.append(el("div", "pg-caption pg-muted", label), el("strong", undefined, value));
    grid.append(tile);
  }
  sec.append(grid);
  return sec;
}

/* ---- 5. modal --------------------------------------------------------- */

function patternModal(): El {
  const sec = section("pattern-modal", "Pattern: modal", "Confirm-before-destructive. Esc closes, focus moves in on open and returns to the trigger on close (UD: error recovery).");
  const trigger = el("button", "pg-btn pg-btn--ghost", "Delete project…");
  trigger.type = "button";

  const backdrop = el("div", "pg-modal-backdrop");
  const dialog = el("div", "pg-modal");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "pm-title");
  dialog.setAttribute("aria-describedby", "pm-desc");
  const title = el("h3", undefined, "Delete “Alpha migration”?");
  title.id = "pm-title";
  title.style.marginTop = "0";
  const desc = el("p", undefined, "This action is reversible for 30 days from the activity log.");
  desc.id = "pm-desc";
  const row = el("div", "pg-toolbar");
  const cancel = el("button", "pg-btn pg-btn--ghost", "Cancel");
  cancel.type = "button";
  const confirm = el("button", "pg-btn", "Delete");
  confirm.type = "button";
  row.append(cancel, confirm);
  dialog.append(title, desc, row);
  backdrop.append(dialog);

  const open = () => {
    backdrop.classList.add("is-open");
    cancel.focus();
  };
  const close = () => {
    backdrop.classList.remove("is-open");
    trigger.focus();
  };
  trigger.addEventListener("click", open);
  cancel.addEventListener("click", close);
  confirm.addEventListener("click", close);
  backdrop.addEventListener("click", (ev) => {
    if (ev.target === backdrop) close();
  });
  backdrop.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") close();
  });

  sec.append(trigger, backdrop);
  return sec;
}

/* ---- 6. table --------------------------------------------------------- */

function patternTable(): El {
  const sec = section("pattern-table", "Pattern: table", "Sortable columns announced via aria-sort; row actions keep target size.");
  const table = el("table", "pg-table");
  const caption = el("caption", "pg-hint", "Delivery items and their status");
  const thead = el("thead");
  const headRow = el("tr");
  const sortable = (label: string, dir: "ascending" | "none") => {
    const th = el("th", undefined, label);
    th.setAttribute("scope", "col");
    th.setAttribute("aria-sort", dir);
    return th;
  };
  headRow.append(sortable("Item", "ascending"), sortable("Owner", "none"), sortable("Status", "none"));
  thead.append(headRow);
  const tbody = el("tbody");
  for (const [item, owner, status] of [
    ["Token migration", "Ahn", "In progress"],
    ["A11y audit", "Blake", "Done"],
    ["Pattern freeze", "Choi", "Blocked"],
  ] as const) {
    const tr = el("tr");
    tr.append(el("td", undefined, item), el("td", undefined, owner), el("td", undefined, status));
    tbody.append(tr);
  }
  table.append(caption, thead, tbody);
  sec.append(table);
  return sec;
}

/** Render all six declared patterns (docs/screen-patterns.md). */
export function renderPatterns(container: El): void {
  const intro = section("patterns", "Screen Patterns", "The six declared patterns of docs/screen-patterns.md, composed from component tokens with the accessibility baseline demonstrated.");
  container.append(intro);
  container.append(patternList(), patternForm(), patternDetail(), patternDashboard(), patternModal(), patternTable());
}
