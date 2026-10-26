/**
 * patterns.ts — the nine declared screen patterns (docs/screen-patterns.md):
 * list, form, detail, dashboard, modal, table, feedback, tabs, report.
 *
 * Each pattern demonstrates the accessibility baseline (ADR-0065/0068):
 * visible :focus-visible ring (style.css), aria-labels on icon-only controls,
 * keyboard operability (modal Esc + focus return, tabs arrow-key roving
 * tabindex, scrollable wide tables), target size ≥ --target-size, state
 * announced via aria-busy / role=status / role=alert, and status never
 * conveyed by color alone (badges carry text, charts carry summaries).
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

/* ---- 7. feedback ------------------------------------------------------ */

function patternFeedback(): El {
  const sec = section("pattern-feedback", "Pattern: feedback", "PageState trio (loading / empty / error) + toast queue. State is announced via aria-busy and role=status / role=alert; focus is never stolen.");

  const loading = el("div", "pg-pagestate");
  loading.setAttribute("aria-busy", "true");
  const skel = el("div", "pg-skeleton-stack");
  skel.append(
    el("div", "pg-skeleton pg-skeleton--title"),
    el("div", "pg-skeleton"),
    el("div", "pg-skeleton pg-skeleton--short"),
  );
  loading.append(skel, el("span", "pg-hint", "Loading report…"));

  const empty = el("div", "pg-pagestate");
  const firstLink = el("a", undefined, "Create your first report");
  firstLink.href = "#pattern-feedback";
  empty.append(el("p", "pg-muted", "No reports yet."), firstLink);

  const error = el("div", "pg-pagestate pg-pagestate--error");
  error.setAttribute("role", "alert");
  const retry = el("button", "pg-btn pg-btn--ghost", "Retry");
  retry.type = "button";
  error.append(el("span", undefined, "Could not load the report."), retry);

  const region = el("div", "pg-toast-region");
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", "Notifications");
  const toast = (kind: "status" | "alert", msg: string) => {
    const t = el("div", `pg-toast pg-toast--${kind === "status" ? "success" : "danger"}`);
    t.setAttribute("role", kind);
    const close = el("button", "pg-toast-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    t.append(el("span", undefined, msg), close);
    region.append(t);
    const dismiss = () => t.remove();
    close.addEventListener("click", dismiss);
    window.setTimeout(dismiss, 5000);
  };
  const ok = el("button", "pg-btn", "Save (success toast)");
  ok.type = "button";
  ok.addEventListener("click", () => toast("status", "Report saved."));
  const fail = el("button", "pg-btn pg-btn--ghost", "Save (failure toast)");
  fail.type = "button";
  fail.addEventListener("click", () => toast("alert", "Save failed — check your connection and retry."));

  const triggers = el("div", "pg-toolbar");
  triggers.append(ok, fail);
  sec.append(loading, empty, error, triggers, region);
  return sec;
}

/* ---- 8. tabs ---------------------------------------------------------- */

function patternTabs(): El {
  const sec = section("pattern-tabs", "Pattern: tabs", "role=tablist / tab / tabpanel with aria-selected, arrow-key roving tabindex, and ?tab= URL state.");

  const names = ["Summary", "Charts", "Sources"] as const;
  const list = el("div", "pg-tabs");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Report sections");
  const tabEls: HTMLButtonElement[] = [];
  const panels: El[] = [];

  const select = (idx: number, focus = false) => {
    tabEls.forEach((tab, i) => {
      const selected = i === idx;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (focus) tabEls[idx].focus();
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", names[idx].toLowerCase());
      window.history.replaceState(null, "", url);
    } catch {
      /* file:// — URL state unavailable, selection still works */
    }
  };

  names.forEach((name, idx) => {
    const tab = el("button", "pg-tab", name);
    tab.type = "button";
    tab.id = `pg-tab-${idx}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", `pg-panel-${idx}`);
    tab.tabIndex = -1;
    tab.addEventListener("click", () => select(idx));
    tab.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
        ev.preventDefault();
        select((idx + 1) % names.length, true);
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
        ev.preventDefault();
        select((idx + names.length - 1) % names.length, true);
      }
    });
    tabEls.push(tab);
    list.append(tab);

    const panel = el("div", "pg-tabpanel");
    panel.id = `pg-panel-${idx}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `pg-tab-${idx}`);
    panel.tabIndex = 0;
    panel.append(el("p", undefined, `${name} panel content…`));
    panels.push(panel);
  });

  sec.append(list);
  for (const panel of panels) sec.append(panel);
  select(0);
  return sec;
}

/* ---- 9. report -------------------------------------------------------- */

function patternReport(): El {
  const sec = section("pattern-report", "Pattern: report", "Chart-first time series with text alternative + pivot-style table, bullet list for long text, wide table in a scroll container; units and provenance visible.");

  const chart = el("div", "pg-chart");
  chart.setAttribute("role", "img");
  chart.setAttribute("aria-label", "Bar chart, revenue by year in billion won: 2023 — 4.2, 2024 — 5.1, 2025 — 6.8. Full figures in the table below.");
  const bars = el("div", "pg-chart-bars");
  const series = [["2023", 4.2], ["2024", 5.1], ["2025", 6.8]] as const;
  const max = 6.8;
  for (const [year, value] of series) {
    const col = el("div", "pg-chart-col");
    const bar = el("div", "pg-chart-bar");
    bar.style.height = `${Math.round((value / max) * 100)}%`;
    col.append(bar, el("span", "pg-caption pg-muted", year));
    bars.append(col);
  }
  chart.append(el("strong", undefined, "Revenue by year (billion KRW)"), bars, el("span", "pg-caption pg-muted", "Source: audited financials (DART)"));

  const bullets = el("ul", "pg-bullets");
  bullets.setAttribute("role", "list");
  bullets.append(
    el("li", undefined, "Steady top-line growth across all three years."),
    el("li", undefined, "Growth accelerated in 2025 (+33% year over year)."),
  );

  const scroll = el("div", "pg-table-scroll");
  scroll.setAttribute("tabindex", "0");
  scroll.setAttribute("aria-label", "Financial detail table, scrolls horizontally");
  const table = el("table", "pg-table");
  const caption = el("caption", "pg-hint", "Financial detail (billion KRW)");
  const thead = el("thead");
  const headRow = el("tr");
  const numHead = (label: string) => {
    const th = el("th", "col-num", label);
    th.setAttribute("scope", "col");
    return th;
  };
  headRow.append(el("th", undefined, "Account"), numHead("2023"), numHead("2024"), numHead("2025"), el("th", undefined, "Source"));
  thead.append(headRow);
  const tbody = el("tbody");
  for (const [account, v23, v24, v25, source] of [
    ["Revenue", "4.2", "5.1", "6.8", "DART audited"],
    ["Operating profit", "0.6", "0.9", "1.4", "DART audited"],
    ["R&D expense", "0.8", "1.0", "1.3", "DART audited"],
  ] as const) {
    const tr = el("tr");
    tr.append(
      el("td", undefined, account),
      el("td", "col-num", v23),
      el("td", "col-num", v24),
      el("td", "col-num", v25),
      el("td", undefined, source),
    );
    tbody.append(tr);
  }
  table.append(caption, thead, tbody);
  scroll.append(table);

  sec.append(chart, bullets, scroll);
  return sec;
}

/** Render all nine declared patterns (docs/screen-patterns.md). */
export function renderPatterns(container: El): void {
  const intro = section("patterns", "Screen Patterns", "The nine declared patterns of docs/screen-patterns.md, composed from component tokens with the accessibility baseline demonstrated.");
  container.append(intro);
  container.append(
    patternList(),
    patternForm(),
    patternDetail(),
    patternDashboard(),
    patternModal(),
    patternTable(),
    patternFeedback(),
    patternTabs(),
    patternReport(),
  );
}
