/* Admin console (design 2026-11-09-gw-admin-console-design §9, round-2 unit-model amendment:
 * docs/designs/2026-11-09-gw-admin-console-round2-plan.md). Hash-routed panels over the /admin
 * API. Every non-GET request sends x-requested-with. Destructive actions re-confirm the
 * operator password: it is sent as x-admin-password for that one request and never stored. */

import {
  LOOP_SCOPE_KEYS,
  POLICY_NUMERIC_KEYS,
  buildEnrollmentPayload,
  createUpgradeFlow,
  esc,
  prepareDonutSlices,
  validatePolicyLimits,
} from "./app-helpers.js";

const view = document.getElementById("view");
const pageTitle = document.getElementById("pageTitle");
const drawer = document.getElementById("drawer");
const PAGE_SIZE = 50;
const TURN_RUNTIMES = ["hermes", "claude", "codex", "antigravity"];
const TL_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const POLICY_NUMERIC = [
  ["maxTenants", "Max tenants owned", "tenants a member owns, archived included"],
  ["maxTurns", "Max turns per tenant", "per quota window"],
  ["maxTokens", "Max tokens per tenant", "per quota window"],
  ["maxPrincipalTokens", "Max lifetime tokens", "across every tenant a member owns"],
];
const TITLES = {
  dashboard: "Dashboard",
  users: "Users",
  groups: "Groups",
  tenants: "Tenants",
  policies: "Policies",
  "tenant-loop": "Tenant Loop",
  audit: "Audit Log",
  system: "System",
};
const ERROR_TEXT = {
  self_lockout: "You cannot suspend, delete or demote your own account",
  last_admin: "This would leave no active admin",
  payload_too_large: "The request is too large",
  invalid_request: "The request is invalid",
  invalid_policy: "The policy is invalid",
  not_found: "Not found",
  conflict: "Name already taken",
  login_taken: "Login ID already taken",
  invalid_login: "Login ID does not match the rule",
  invalid_name: "Name is invalid or looks like a formula",
  invalid_role: "Role must be user or admin",
  unknown_group: "Group is unknown or is a loop group",
  delete_failed: "Tenant data could not be deleted",
};

// ── theme (shared localStorage key with the chat page) ──
document.documentElement.dataset.theme = localStorage.getItem("gw-theme") ?? "dark";
document.getElementById("themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("gw-theme", next);
});

// ── transport and messages ──
async function api(path, { method = "GET", body, text, password } = {}) {
  const headers = {};
  if (method !== "GET") headers["x-requested-with"] = "co-workspace";
  if (password !== undefined) headers["x-admin-password"] = password;
  let payload;
  if (text !== undefined) {
    headers["content-type"] = "text/csv; charset=utf-8";
    payload = text;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  try {
    const res = await fetch(path, { method, headers, body: payload });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (err) {
    return { res: { ok: false, status: 0 }, data: { error: `network error: ${err.message}` } };
  }
}

function errorMessage(code) {
  return ERROR_TEXT[code] ?? code;
}

function errorText({ status }, data) {
  const code = data?.error ?? `HTTP ${status}`;
  return ERROR_TEXT[code] ? `${ERROR_TEXT[code]} (${code})` : code;
}

let pendingFlash = null;
let flashTimer = 0;

function flash(message, ok = false) {
  const box = document.getElementById("flash");
  if (!box) return;
  box.className = `flash ${ok ? "ok" : "err"}`;
  box.textContent = message;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => box.classList.add("gws-hidden"), 9000);
}

/** Paint the page body. Keeps focus and typed text of the focused field across re-renders, so
 * a debounced search does not drop the caret. */
function paint(html) {
  const active = document.activeElement;
  const keep = active && view.contains(active) && active.id
    ? { id: active.id, value: active.value, start: active.selectionStart, end: active.selectionEnd, text: active.tagName === "INPUT" && active.type !== "checkbox" }
    : null;
  view.innerHTML = `<div id="flash" class="flash gws-hidden" role="status"></div>${html}`;
  if (pendingFlash) {
    flash(pendingFlash.message, pendingFlash.ok);
    pendingFlash = null;
  }
  if (keep) {
    const el = view.querySelector(`#${CSS.escape(keep.id)}`);
    if (el) {
      if (keep.text) el.value = keep.value;
      el.focus();
      try {
        el.setSelectionRange(keep.start, keep.end);
      } catch {
        /* input types without selection support */
      }
    }
  }
}

/** Show a message on the next repaint (used when an action re-renders the page). */
function notify(message, ok = false) {
  pendingFlash = { message, ok };
  route();
}

function fmtBytes(b) {
  return b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b > 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`;
}

const fmtCount = (n) => Number(n ?? 0).toLocaleString("en-US");
const badge = (text, kind = text) => `<span class="badge ${esc(kind)}">${esc(text)}</span>`;
const option = (value, label, current = "") => `<option value="${esc(value)}"${String(value) === String(current) ? " selected" : ""}>${esc(label)}</option>`;

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ── modals and prompts ──
function showModal({ title, bodyHtml }) {
  const wrap = document.createElement("div");
  wrap.className = "modalWrap";
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3>${bodyHtml}</div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) wrap.remove();
  });
  return wrap;
}

/** Generic form prompt. Resolves with { [field.name]: value } or null on cancel. `intro` is HTML:
 * escape any user data placed in it. */
function promptModal({ title, intro = "", fields = [], confirmLabel = "OK", danger = false }) {
  return new Promise((resolve) => {
    const controls = fields
      .map((f) => {
        const id = `pm-${f.name}`;
        let control;
        if (f.type === "select") {
          control = `<select id="${id}">${f.options.map((o) => option(o.value, o.label, f.value ?? "")).join("")}</select>`;
        } else if (f.type === "textarea") {
          control = `<textarea id="${id}" rows="${f.rows ?? 6}" spellcheck="false">${esc(f.value ?? "")}</textarea>`;
        } else {
          control = `<input id="${id}" type="${esc(f.type ?? "text")}" value="${esc(f.value ?? "")}" placeholder="${esc(f.placeholder ?? "")}" autocomplete="off">`;
        }
        return `<div class="field"><label for="${id}">${esc(f.label)}</label>${control}</div>`;
      })
      .join("");
    const wrap = showModal({
      title,
      bodyHtml: `${intro ? `<div class="field">${intro}</div>` : ""}${controls}` +
        `<div class="formErr" id="pm-err" role="alert"></div>` +
        `<div class="row"><span class="spacer"></span><button class="ghost" id="pm-cancel" type="button">Cancel</button>` +
        `<button id="pm-ok" type="button"${danger ? ' class="danger"' : ""}>${esc(confirmLabel)}</button></div>`,
    });
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      wrap.remove();
      resolve(value);
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) done(null);
    });
    wrap.querySelector("#pm-cancel").addEventListener("click", () => done(null));
    wrap.querySelector("#pm-ok").addEventListener("click", () => {
      const out = {};
      for (const f of fields) {
        out[f.name] = wrap.querySelector(`#pm-${f.name}`).value;
        if (f.required && !String(out[f.name]).trim()) {
          wrap.querySelector("#pm-err").textContent = `⚠ ${f.label} is required`;
          return;
        }
      }
      done(out);
    });
    if (fields[0]) wrap.querySelector(`#pm-${fields[0].name}`).focus();
  });
}

/** session-hardening D7: destructive operations re-confirm the operator password. */
async function askPassword(title, intro) {
  const out = await promptModal({
    title,
    intro: `${intro} Re-authentication is required; the password is used for this request only.`,
    fields: [{ name: "password", label: "Your password", type: "password", required: true }],
    confirmLabel: "Confirm",
    danger: true,
  });
  return out ? out.password : null;
}

async function copyValue(value, statusEl) {
  try {
    await navigator.clipboard.writeText(value);
    statusEl.textContent = "Copied to clipboard.";
  } catch {
    statusEl.textContent = "Copy unavailable here — select the text and copy it manually.";
  }
}

// ── shared view pieces ──
function pagerHtml(total, page, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  return `<div class="pager"><span>${fmtCount(total)} total · page ${page} of ${pages}</span>` +
    `<button type="button" data-goto="${page - 1}"${page <= 1 ? " disabled" : ""}>‹ prev</button>` +
    `<button type="button" data-goto="${page + 1}"${page >= pages ? " disabled" : ""}>next ›</button></div>`;
}

function bindPager(onGoto) {
  for (const btn of view.querySelectorAll("[data-goto]")) {
    btn.addEventListener("click", () => onGoto(Number(btn.dataset.goto)));
  }
}

function summarizeBulk(label, data, nameOf = (id) => id) {
  return {
    label,
    ok: data.ok ?? 0,
    failed: (data.failed ?? []).map((f) => ({ name: nameOf(f.id), error: errorMessage(f.error) })),
  };
}

function bulkResultHtml(last) {
  if (!last) return "";
  const cls = last.failed.length ? "err" : "ok";
  return `<div class="resultBox"><div class="flash ${cls}">${esc(last.label)}: ${fmtCount(last.ok)} succeeded, ${fmtCount(last.failed.length)} failed</div>` +
    (last.failed.length
      ? `<ul class="failList">${last.failed.map((f) => `<li>${esc(f.name)} — ${esc(f.error)}</li>`).join("")}</ul>`
      : "") +
    `</div>`;
}

async function loadVariants() {
  try {
    const res = await fetch("/health");
    const body = await res.json();
    return Array.isArray(body.variants) ? body.variants : [];
  } catch {
    return [];
  }
}

// ── charts (Dashboard) ──
function barChart(rows, format = (v) => fmtCount(v)) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows
    .map(([label, val]) => `<div class="barRow"><div class="barLabel" title="${esc(label)}">${esc(label)}</div>` +
      `<div class="barTrack"><div class="barFill" style="width:${(val / max) * 100}%"></div></div>` +
      `<div class="barVal">${esc(format(val))}</div></div>`)
    .join("") || '<div class="hint">no data</div>';
}

/** Dependency-free SVG donut: top-7 slices plus "others", the legend carries the numbers. */
function donutChart(title, slices) {
  const { top, total } = prepareDonutSlices(slices);
  const colors = ["#58a6ff", "#3fb950", "#d29922", "#f778ba", "#bc8cff", "#39c5cf", "#ff7b72", "#6e7681"];
  let offset = 25;
  const segs = top.map((sl, i) => {
    const pct = (sl.value / (total || 1)) * 100;
    const seg = `<circle r="15.9" cx="21" cy="21" fill="none" stroke="${colors[i % colors.length]}" stroke-width="6" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${offset}"><title>${esc(sl.label)}: ${esc(sl.value)} (${pct.toFixed(0)}%)</title></circle>`;
    offset -= pct;
    return seg;
  });
  const legend = top
    .map((sl, i) => `<div class="legRow"><span class="dot" style="background:${colors[i % colors.length]}"></span>${esc(sl.label)} — <b>${esc(sl.value)}</b> · ${((sl.value / (total || 1)) * 100).toFixed(0)}%</div>`)
    .join("");
  return `<div class="donutBox"><h4>${esc(title)}</h4><div class="donut">` +
    `<svg viewBox="0 0 42 42" role="img" aria-label="${esc(`${title}: ${top.map((sl) => `${sl.label} ${sl.value}`).join(", ")}`)}">${segs.join("")}<text x="21" y="24" text-anchor="middle" class="donutTotal">${esc(total)}</text></svg>` +
    `<div class="legend">${legend || '<div class="legRow">no data</div>'}</div></div></div>`;
}

// ── routing ──
const PAGES = {
  dashboard: renderDashboard,
  users: renderUsers,
  groups: renderGroups,
  tenants: renderTenants,
  policies: renderPolicies,
  "tenant-loop": renderTenantLoop,
  audit: renderAudit,
  system: renderSystem,
};

let navSeq = 0;

async function route() {
  const seq = ++navSeq;
  const live = () => seq === navSeq;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(safeDecode);
  const name = parts[0] || "dashboard";
  const page = PAGES[name];
  if (!page) {
    location.hash = "#/dashboard";
    return;
  }
  for (const a of document.querySelectorAll("nav a[data-route]")) a.classList.toggle("active", a.dataset.route === name);
  pageTitle.textContent = TITLES[name];
  closeDrawer();
  try {
    await page(parts.slice(1), live);
  } catch (err) {
    if (live()) paint(`<div class="flash err">⚠ ${esc(err?.message ?? err)}</div>`);
  }
}

/** Re-render the current route (after a mutation or a filter change). */
function refresh() {
  return route();
}

window.addEventListener("hashchange", route);

// ── Dashboard ──
async function renderDashboard(_args, live) {
  const { res, data: stats } = await api("/admin/stats");
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, stats))}</div>`);
  const tenantTotal = Object.values(stats.tenants).reduce((a, b) => a + b, 0);
  const perUser = stats.perUser ?? [];
  paint(`
    <div class="statGrid">
      <div class="statBox"><div class="n">${fmtCount(stats.users.active)}</div><div class="l">active users</div></div>
      <div class="statBox"><div class="n">${fmtCount(stats.users.deleted)}</div><div class="l">deleted users</div></div>
      <div class="statBox"><div class="n">${fmtCount(tenantTotal)}</div><div class="l">tenants</div></div>
      <div class="statBox"><div class="n">${esc(fmtBytes(stats.diskBytes))}</div><div class="l">disk usage</div></div>
      <div class="statBox"><div class="n">${fmtCount(stats.turns.total)}</div><div class="l">turns</div></div>
      <div class="statBox"><div class="n">${fmtCount(stats.turns.inputTokens + stats.turns.outputTokens)}</div><div class="l">tokens (in + out)</div></div>
    </div>
    <div class="donutRow">
      ${donutChart("Tenants by status", Object.entries(stats.tenants).map(([label, value]) => ({ label, value })))}
      ${donutChart("Tenants by variant", (stats.tenantsPerVariant ?? []).map((r) => ({ label: r.variant, value: r.count })))}
      ${donutChart("Users by state", Object.entries(stats.users).map(([label, value]) => ({ label, value })))}
    </div>
    <h3>Tenants per user</h3>${barChart(perUser.map((u) => [u.principal, u.tenantCount]))}
    <h3>Disk usage per user</h3>${barChart(perUser.map((u) => [u.principal, u.diskBytes]), fmtBytes)}
  `);
}

// ── Users ──
const usersState = { q: "", group: "", status: "", role: "", page: 1, total: 0, selected: new Set(), rows: new Map(), groups: [], last: null };
const BULK_LABEL = { suspend: "Suspend", activate: "Activate", delete: "Delete", "set-role": "Set role", "add-group": "Add to group", "remove-group": "Remove from group" };

function usersQuery(extra = {}) {
  const p = new URLSearchParams();
  if (usersState.q) p.set("q", usersState.q);
  if (usersState.group) p.set("group", usersState.group);
  if (usersState.status) p.set("status", usersState.status);
  if (usersState.role) p.set("role", usersState.role);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

function setUserFilter(key, value) {
  usersState[key] = value;
  usersState.page = 1;
  usersState.selected.clear();
  refresh();
}

function updateUserSelectionUI() {
  const boxes = [...view.querySelectorAll("[data-select]")];
  for (const box of boxes) box.checked = usersState.selected.has(box.dataset.select);
  const all = view.querySelector("#uAll");
  if (all) all.checked = boxes.length > 0 && boxes.every((b) => b.checked);
  const count = usersState.selected.size;
  view.querySelector("#bulkBar").classList.toggle("gws-hidden", count === 0);
  view.querySelector("#bulkCount").textContent = String(count);
}

async function renderUsers(args, live) {
  const [groupsRes, listRes] = await Promise.all([
    api("/admin/groups"),
    api(`/admin/users?${usersQuery({ page: usersState.page, size: PAGE_SIZE })}`),
  ]);
  if (!live()) return;
  usersState.groups = groupsRes.res.ok ? groupsRes.data.groups ?? [] : [];
  if (!listRes.res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(listRes.res, listRes.data))}</div>`);
  const users = listRes.data.users ?? [];
  usersState.total = listRes.data.total ?? 0;
  usersState.rows = new Map(users.map((u) => [u.id, u]));
  const groupName = (id) => usersState.groups.find((g) => g.groupId === id)?.name ?? id;
  const selectedCount = usersState.selected.size;
  const allOnPage = users.length > 0 && users.every((u) => usersState.selected.has(u.id));

  const rows = users
    .map((u) => `<tr class="clickable" data-open="${esc(u.id)}">` +
      `<td><input type="checkbox" data-select="${esc(u.id)}" aria-label="select ${esc(u.loginId)}"${usersState.selected.has(u.id) ? " checked" : ""}></td>` +
      `<td>${esc(u.loginId)} ${u.role === "admin" ? badge("admin") : ""}</td>` +
      `<td>${esc(u.name)}</td>` +
      `<td>${badge(u.status)}</td>` +
      `<td>${u.groups.map((g) => `<span class="chip">${esc(groupName(g))}</span>`).join("") || '<span class="hint">—</span>'}</td>` +
      `<td class="num">${fmtCount(u.tenantCount)}</td>` +
      `<td class="num">${fmtCount(u.usage.input + u.usage.output)}</td>` +
      `<td>${esc(String(u.createdAt ?? "").slice(0, 10))}</td></tr>`)
    .join("");

  paint(`
    <div class="toolbar">
      <input id="uQ" type="search" placeholder="Search login ID or name" value="${esc(usersState.q)}" aria-label="Search users" style="width:240px">
      <select id="uGroup" aria-label="Filter by group">${[option("", "all groups", usersState.group), ...usersState.groups.map((g) => option(g.groupId, g.name, usersState.group))].join("")}</select>
      <select id="uStatus" aria-label="Filter by status">${[["", "any status"], ["active", "active"], ["pending", "pending"], ["suspended", "suspended"], ["deleted", "deleted"]].map(([v, l]) => option(v, l, usersState.status)).join("")}</select>
      <select id="uRole" aria-label="Filter by role">${[["", "any role"], ["user", "user"], ["admin", "admin"]].map(([v, l]) => option(v, l, usersState.role)).join("")}</select>
      <span class="spacer"></span>
      <button class="ghost" id="uExport" type="button">Export CSV</button>
      <button class="ghost" id="uImport" type="button">Import CSV…</button>
    </div>
    <div class="bulkBar${selectedCount ? "" : " gws-hidden"}" id="bulkBar">
      <span><b id="bulkCount">${selectedCount}</b> selected</span>
      <button class="ghost" type="button" data-bulk="suspend">Suspend</button>
      <button class="ghost" type="button" data-bulk="activate">Activate</button>
      <select id="bulkRole" aria-label="Role for set-role">${option("user", "user")}${option("admin", "admin")}</select>
      <button class="ghost" type="button" data-bulk="set-role">Set role</button>
      <select id="bulkGroup" aria-label="Group">${usersState.groups.length ? usersState.groups.map((g) => option(g.groupId, g.name)).join("") : '<option value="">no groups</option>'}</select>
      <button class="ghost" type="button" data-bulk="add-group">Add to group</button>
      <button class="ghost" type="button" data-bulk="remove-group">Remove from group</button>
      <button class="danger" type="button" data-bulk="delete">Delete…</button>
      <span class="spacer"></span>
      <button class="linkish" type="button" id="bulkClear">Clear selection</button>
    </div>
    ${bulkResultHtml(usersState.last)}
    <table>
      <thead><tr><th><input type="checkbox" id="uAll" aria-label="select all on this page"${allOnPage ? " checked" : ""}></th><th>Login ID</th><th>Name</th><th>Status</th><th>Groups</th><th class="num">Tenants</th><th class="num">Tokens</th><th>Created</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8" class="hint">No users match these filters</td></tr>'}</tbody>
    </table>
    ${pagerHtml(usersState.total, usersState.page, PAGE_SIZE)}
  `);

  let qTimer = 0;
  view.querySelector("#uQ").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      usersState.q = e.target.value.trim();
      usersState.page = 1;
      usersState.selected.clear();
      refresh();
    }, 300);
  });
  view.querySelector("#uGroup").addEventListener("change", (e) => setUserFilter("group", e.target.value));
  view.querySelector("#uStatus").addEventListener("change", (e) => setUserFilter("status", e.target.value));
  view.querySelector("#uRole").addEventListener("change", (e) => setUserFilter("role", e.target.value));
  view.querySelector("#uExport").addEventListener("click", () => exportUsersCsv());
  view.querySelector("#uImport").addEventListener("click", () => importUsersFlow());
  view.querySelector("#uAll").addEventListener("change", (e) => {
    for (const u of users) {
      if (e.target.checked) usersState.selected.add(u.id);
      else usersState.selected.delete(u.id);
    }
    updateUserSelectionUI();
  });
  for (const box of view.querySelectorAll("[data-select]")) {
    box.addEventListener("change", () => {
      if (box.checked) usersState.selected.add(box.dataset.select);
      else usersState.selected.delete(box.dataset.select);
      updateUserSelectionUI();
    });
  }
  for (const tr of view.querySelectorAll("tr[data-open]")) {
    tr.addEventListener("click", (e) => {
      if (e.target.closest("input,button,select,label")) return;
      location.hash = `#/users/${encodeURIComponent(tr.dataset.open)}`;
    });
  }
  for (const btn of view.querySelectorAll("[data-bulk]")) btn.addEventListener("click", () => bulkUsers(btn.dataset.bulk));
  view.querySelector("#bulkClear").addEventListener("click", () => {
    usersState.selected.clear();
    updateUserSelectionUI();
  });
  bindPager((page) => {
    usersState.page = page;
    usersState.selected.clear();
    refresh();
  });

  if (args[0]) await openUserDrawer(args[0], live);
}

async function bulkUsers(action) {
  const ids = [...usersState.selected];
  if (!ids.length) return;
  const body = { ids, action };
  let password;
  if (action === "set-role") {
    body.role = view.querySelector("#bulkRole").value;
  }
  if (action === "add-group" || action === "remove-group") {
    body.groupId = view.querySelector("#bulkGroup").value;
    if (!body.groupId) return flash("Create a general group under Groups first.");
  }
  if (action === "delete") {
    const choice = await promptModal({
      title: `Delete ${ids.length} user(s)`,
      intro: "Deletion soft-deletes the accounts, revokes their sessions and removes them from every group. Choose what happens to the tenants they own. The account deletion cannot be undone from this console.",
      fields: [
        {
          name: "disposition",
          label: "Tenant disposition",
          type: "select",
          value: "archive",
          options: [
            { value: "archive", label: "archive — keep tenant files" },
            { value: "delete", label: "delete — remove tenant files" },
          ],
        },
        { name: "password", label: "Your password", type: "password", required: true },
      ],
      confirmLabel: "Delete users",
      danger: true,
    });
    if (!choice) return;
    body.disposition = choice.disposition;
    password = choice.password;
  } else if (["suspend", "activate", "set-role", "remove-group"].includes(action)) {
    // Every action that changes sign-in or membership re-confirms the operator password (review M4).
    const intro = {
      suspend: "Suspended users cannot sign in and their sessions end immediately.",
      activate: "Activated users can sign in again.",
      "set-role": `The role changes for ${ids.length} user(s).`,
      "remove-group": "The selected users leave this group, and its policy stops applying to them.",
    }[action];
    password = await askPassword(`${BULK_LABEL[action]} ${ids.length} user(s)`, intro);
    if (password === null) return;
  }
  const { res, data } = await api("/admin/users/bulk", { method: "POST", body, password });
  if (!res.ok) return flash(errorText(res, data));
  usersState.last = summarizeBulk(BULK_LABEL[action], data, (id) => usersState.rows.get(id)?.loginId ?? id);
  usersState.selected.clear();
  refresh();
}

async function exportUsersCsv() {
  try {
    const res = await fetch(`/admin/users/export.csv?${usersQuery()}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return flash(errorText(res, data));
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "users.csv";
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    flash(`export failed: ${err.message}`);
  }
}

function skippedTable(skipped) {
  return `<table><thead><tr><th>row</th><th>login ID</th><th>reason</th></tr></thead><tbody>` +
    skipped.map((s) => `<tr><td>${esc(s.row)}</td><td>${esc(s.loginId)}</td><td>${esc(errorMessage(s.error))}</td></tr>`).join("") +
    `</tbody></table>`;
}

/** CSV import: a dry run must succeed before the import button arms, and the import itself
 * re-confirms the password. Temporary passwords are shown once and never stored. */
function importUsersFlow() {
  let csvText = null;
  let previewed = false;
  const wrap = showModal({
    title: "Import users from CSV",
    bodyHtml: `<div id="imp-body">
      <div class="field">Header row: <code>loginId,name,role,groups</code>. Separate groups with <code>;</code>. Accounts are created verified, with a one-time temporary password and a forced change at first sign-in. A dry run comes first.</div>
      <div class="field"><label for="imp-file">CSV file (up to 1 MB and 2000 rows)</label><input id="imp-file" type="file" accept=".csv,text/csv"></div>
      <div id="imp-preview"></div>
      <div class="formErr" id="imp-err" role="alert"></div>
      <div class="row"><span class="spacer"></span><button id="imp-close" type="button" class="ghost">Close</button><button id="imp-dry" type="button" class="ghost" disabled>Dry run</button><button id="imp-go" type="button" disabled>Import</button></div>
    </div>`,
  });
  const q = (sel) => wrap.querySelector(sel);
  q("#imp-close").addEventListener("click", () => wrap.remove());
  q("#imp-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    csvText = null;
    previewed = false;
    q("#imp-go").disabled = true;
    q("#imp-preview").innerHTML = "";
    q("#imp-err").textContent = "";
    q("#imp-dry").disabled = !file;
    if (!file) return;
    if (file.size > 1024 * 1024) {
      q("#imp-err").textContent = "⚠ file is larger than 1 MB";
      q("#imp-dry").disabled = true;
      return;
    }
    csvText = await file.text();
  });
  q("#imp-dry").addEventListener("click", async () => {
    if (csvText === null) return;
    const { res, data } = await api("/admin/users/import?dryRun=1", { method: "POST", text: csvText });
    if (!res.ok) {
      q("#imp-err").textContent = `⚠ ${errorText(res, data)}`;
      return;
    }
    previewed = true;
    const created = data.created ?? [];
    const skipped = data.skipped ?? [];
    q("#imp-preview").innerHTML = `<div class="flash ok">Dry run: ${fmtCount(created.length)} account(s) would be created, ${fmtCount(skipped.length)} row(s) skipped. Nothing has been written.</div>` +
      (skipped.length ? skippedTable(skipped) : "");
    q("#imp-go").disabled = created.length === 0;
  });
  q("#imp-go").addEventListener("click", async () => {
    if (!previewed || csvText === null) return;
    const choice = await promptModal({
      title: "Confirm import",
      intro: "Creates the accounts from the dry run. Temporary passwords are shown once, after the import.",
      fields: [{ name: "password", label: "Your password", type: "password", required: true }],
      confirmLabel: "Import accounts",
      danger: true,
    });
    if (!choice) return;
    q("#imp-go").disabled = true;
    const { res, data } = await api("/admin/users/import", { method: "POST", text: csvText, password: choice.password });
    if (!res.ok) {
      q("#imp-err").textContent = `⚠ ${errorText(res, data)}`;
      q("#imp-go").disabled = false;
      return;
    }
    q("#imp-body").innerHTML = `<div class="flash ok">Created ${fmtCount(data.created.length)} account(s); ${fmtCount(data.skipped.length)} row(s) skipped.</div>` +
      `<div class="field">Temporary passwords appear only here. Copy them before closing; they are not stored or logged.</div>` +
      `<table><thead><tr><th>login ID</th><th>temporary password</th></tr></thead><tbody>` +
      data.created.map((c) => `<tr><td>${esc(c.loginId)}</td><td><code>${esc(c.tempPassword)}</code></td></tr>`).join("") +
      `</tbody></table>` +
      (data.skipped.length ? skippedTable(data.skipped) : "") +
      `<div class="row"><span class="spacer"></span><button id="imp-done" type="button">Done</button></div>`;
    q("#imp-done").addEventListener("click", () => {
      wrap.remove();
      notify(`Imported ${data.created.length} account(s).`, true);
    });
  });
}

function showTempPassword(loginId, tempPassword) {
  const wrap = showModal({
    title: `Temporary password for @${loginId}`,
    bodyHtml: `<div class="field">Give this one-time password to the user. It expires in 15 minutes and must be changed at first sign-in.</div>` +
      `<div class="field"><input id="tp-val" readonly value="${esc(tempPassword)}" style="font-family: ui-monospace, monospace;"></div>` +
      `<div class="formErr" id="tp-status" role="status"></div>` +
      `<div class="row"><span class="spacer"></span><button id="tp-copy" type="button">Copy</button><button id="tp-close" type="button" class="ghost">Close</button></div>`,
  });
  const val = wrap.querySelector("#tp-val");
  val.focus();
  val.select();
  wrap.querySelector("#tp-copy").addEventListener("click", () => copyValue(val.value, wrap.querySelector("#tp-status")));
  wrap.querySelector("#tp-close").addEventListener("click", () => wrap.remove());
}

/** Row drawer (design §9.3, round-2 unit model): details, groups, the loop memberships the
 * user's groups carry, the effective policy with its contributing sources (read view —
 * policies attach to GROUPS ONLY, there is no per-user assignment UI), owned tenants, and
 * the rename and reset-password actions kept from the old panel. */
async function openUserDrawer(id, live) {
  let user = usersState.rows.get(id);
  if (!user) {
    const { data } = await api("/admin/users?size=200");
    user = (data.users ?? []).find((u) => u.id === id);
  }
  if (!live()) return;
  if (!user) return flash("User not found in the current listing.");
  const enc = encodeURIComponent(user.id);
  const [policyRes, tenantsRes, enrollRes] = await Promise.all([
    api(`/admin/users/${enc}/effective-policy`),
    api(`/admin/tenants?owner=${encodeURIComponent(user.principal)}&size=200`),
    api("/admin/tenant-loop/enrollments"),
  ]);
  if (!live()) return;
  const pol = policyRes.data ?? {};
  const tenants = tenantsRes.data?.tenants ?? [];
  const policyRows = POLICY_NUMERIC.map(([key, label]) => {
    const v = pol[key];
    return `<tr><td>${esc(label)}</td><td>${v ? fmtCount(v) : '<span class="hint">unlimited</span>'}</td></tr>`;
  }).join("") +
    `<tr><td>Allowed variants</td><td>${pol.allowedVariants ? esc(pol.allowedVariants.join(", ")) : '<span class="hint">any configured variant</span>'}</td></tr>`;
  // Sources are PolicySourceRef[] (policyId, policyName, via group) — the named policies
  // pulled in through the user's groups.
  const sourceChips = (pol.sources ?? [])
    .map((s) => `<span class="chip">${esc(s.policyName)} <span class="hint">via ${esc(s.via)}</span></span>`)
    .join("") || '<span class="hint">none — gateway baseline only</span>';
  // Loop membership: the (group, variant) enrollments of the user's groups.
  const memberGroups = new Set((pol.groups ?? []).map((g) => g.groupId));
  const loopChips = (enrollRes.res.ok ? enrollRes.data.enrollments ?? [] : [])
    .filter((e) => memberGroups.has(e.groupId))
    .map((e) => `<span class="chip"><code>${esc(e.groupId)}/${esc(e.variant)}</code> ${badge(e.status, e.status)}</span>`)
    .join("") || '<span class="hint">none</span>';
  drawer.innerHTML = `
    <div class="toolbar"><h2 style="margin:0">@${esc(user.loginId)}</h2><span class="spacer"></span><button class="ghost" type="button" data-close>Close</button></div>
    <h3>Details</h3>
    <table class="kv">
      <tr><td>Name</td><td>${esc(user.name)}</td></tr>
      <tr><td>Role</td><td>${badge(user.role, user.role)}</td></tr>
      <tr><td>Status</td><td>${badge(user.status)}</td></tr>
      <tr><td>Created</td><td>${esc(user.createdAt ?? "")}</td></tr>
      <tr><td>Suspended at</td><td>${esc(user.disabledAt ?? "—")}</td></tr>
      <tr><td>Tokens (in / out)</td><td>${fmtCount(user.usage.input)} / ${fmtCount(user.usage.output)}</td></tr>
    </table>
    <h3>Groups</h3>
    <div>${(pol.groups ?? []).map((g) => `<span class="chip">${esc(g.name)} <span class="hint">${esc(g.groupId)}</span></span>`).join("") || '<span class="hint">none</span>'}</div>
    <h3>Loop membership</h3>
    <div>${loopChips}</div>
    <h3>Effective policy</h3>
    <div class="hint">The strictest of the gateway baseline and every named policy assigned to the user's groups (group-only assignment — the unit model has no per-user targets).</div><br>
    <table><thead><tr><th>Limit</th><th>Value</th></tr></thead><tbody>${policyRows}</tbody></table>
    <h3>Contributing policies</h3>
    <div>${sourceChips}</div>
    <h3>Owned tenants (${fmtCount(tenants.length)})</h3>
    ${tenants.length
      ? `<table><thead><tr><th>Tenant</th><th>Variant</th><th>Status</th><th class="num">Sessions</th></tr></thead><tbody>` +
        tenants.map((t) => `<tr><td>${esc(t.tenantId)}${t.name ? `<div class="hint">${esc(t.name)}</div>` : ""}</td><td>${esc(t.variant)}</td><td>${t.archivedAt ? badge("archived") : badge("active")}${t.teamKind === "shared" ? " " + badge("shared") : ""}</td><td class="num">${fmtCount(t.sessions)}</td></tr>`).join("") +
        `</tbody></table>`
      : '<div class="hint">no tenants</div>'}
    <div class="row"><button class="ghost" type="button" data-rename>Rename</button><button class="ghost" type="button" data-reset>Reset password…</button></div>`;
  drawer.classList.remove("gws-hidden");
  drawer.querySelector("[data-close]").addEventListener("click", () => {
    location.hash = "#/users";
  });
  drawer.querySelector("[data-rename]").addEventListener("click", async () => {
    const v = await promptModal({
      title: `Rename @${user.loginId}`,
      fields: [{ name: "name", label: "Display name (1-80 chars)", value: user.name, required: true }],
      confirmLabel: "Save",
    });
    if (!v) return;
    const { res, data } = await api(`/admin/users/${enc}/name`, { method: "PATCH", body: { name: v.name.trim() } });
    if (!res.ok) return flash(errorText(res, data));
    notify("Renamed.", true);
  });
  drawer.querySelector("[data-reset]").addEventListener("click", async () => {
    const password = await askPassword(`Reset password for @${user.loginId}`, "Issues a one-time temporary password that expires in 15 minutes.");
    if (password === null) return;
    const { res, data } = await api(`/admin/users/${enc}/reset-password`, { method: "POST", password });
    if (!res.ok) return flash(errorText(res, data));
    showTempPassword(user.loginId, data.tempPassword);
  });
}

function closeDrawer() {
  drawer.classList.add("gws-hidden");
  drawer.innerHTML = "";
}

// ── Shared loop-enrollment pieces (round-2 unit model) — used by the Tenant Loop page and
// the group detail's Tenant-loop tab. Coverage is keyed (group_id, variant) with "*" = all
// variants; the per-tenant register/suspend/deregister surface is gone (410). ──
function scopesHtml(scopes) {
  const short = { upgrade: "upg", upstreamFile: "file", backportReview: "backport", nightlyFleet: "fleet" };
  return LOOP_SCOPE_KEYS.map((k) => {
    const on = scopes?.[k] === true;
    return `<span class="tlScope ${on ? "on" : "off"}" title="${esc(k)}: ${on ? "on" : "off"}">${short[k] ?? k} ${on ? "✓" : "✗"}</span>`;
  }).join("");
}

function windowsHtml(w) {
  if (!w || typeof w !== "object") return "";
  const days = Array.isArray(w.days) ? w.days.map((d) => TL_DAY_NAMES[d] ?? d).join(",") : "?";
  return `${esc(String(w.tz ?? "?"))} · ${esc(days)} · ${esc(String(w.start ?? "?"))}–${esc(String(w.end ?? "?"))}`;
}

/** The scopes/windows/gitRemote half of an enrollment form, ids prefixed with `p`. Every
 * control carries a for= label; checkboxes are wrapped. Shared by both enroll forms. */
function enrollmentFormHtml(p) {
  return `
    <div class="field">Scopes — a scope exports on only when EVERY covering enrollment has it on
      ${LOOP_SCOPE_KEYS.map((k) => `<label class="betaPick"><input type="checkbox" id="${p}-scope-${k}" style="width:auto"> ${esc(k)}</label>`).join("")}
    </div>
    <div class="field"><label for="${p}-tz">Window time zone (IANA)</label><input id="${p}-tz" value="Asia/Seoul" autocomplete="off"></div>
    <div class="field">Window days (0 = Sunday)
      ${TL_DAY_NAMES.map((d, i) => `<label class="betaPick" style="display:inline-flex; margin-right:8px;"><input type="checkbox" id="${p}-day-${i}" checked style="width:auto"> ${d}</label>`).join("")}
    </div>
    <div class="field" style="flex-direction:row; gap:8px;"><span style="flex:1;"><label for="${p}-start">Start (HH:MM, inclusive)</label><input id="${p}-start" value="00:00" autocomplete="off"></span>` +
    `<span style="flex:1;"><label for="${p}-end">End (HH:MM, exclusive)</label><input id="${p}-end" value="23:59" autocomplete="off"></span></div>
    <div class="field"><label for="${p}-remote">git remote (backup branch safety net)</label><select id="${p}-remote"><option value="local-only">local-only</option><option value="url">url</option></select></div>
    <div class="field gws-hidden" id="${p}-url-row"><label for="${p}-url">Remote URL</label><input id="${p}-url" placeholder="https://git.example.team/team/project.git" autocomplete="off"></div>`;
}

/** Read the fields rendered by enrollmentFormHtml(p) inside `root` into the PUT body half
 * (client-validated by buildEnrollmentPayload — the server re-validates authoritatively). */
function readEnrollmentForm(root, p) {
  const scopes = Object.fromEntries(LOOP_SCOPE_KEYS.map((k) => [k, root.querySelector(`#${p}-scope-${k}`).checked]));
  const windows = {
    tz: root.querySelector(`#${p}-tz`).value.trim(),
    days: TL_DAY_NAMES.map((_, i) => i).filter((i) => root.querySelector(`#${p}-day-${i}`).checked),
    start: root.querySelector(`#${p}-start`).value.trim(),
    end: root.querySelector(`#${p}-end`).value.trim(),
  };
  return buildEnrollmentPayload(scopes, windows, root.querySelector(`#${p}-remote`).value, root.querySelector(`#${p}-url`).value);
}

function bindRemoteToggle(root, p) {
  root.querySelector(`#${p}-remote`).addEventListener("change", () => {
    root.querySelector(`#${p}-url-row`).classList.toggle("gws-hidden", root.querySelector(`#${p}-remote`).value !== "url");
  });
}

/** PUT/DELETE one (group, variant) enrollment — admin + reauth (x-admin-password per
 * request, never stored). The PUT body must be COMPLETE: status + full scopes + windows. */
function enrollmentApi(groupId, variant, { method, body, password }) {
  return api(`/admin/tenant-loop/enrollments/${encodeURIComponent(groupId)}/${encodeURIComponent(variant)}`, { method, body, password });
}

/** Render a preview payload (GET /admin/tenant-loop/preview): covered tenants with their
 * resolved strictest-wins scopes/windows, plus any window_intersection_unrepresentable
 * reason row. not_covered rows are omitted — uncovered tenants need enrollment and never
 * appear in the registry. */
function previewPanelHtml(tenants) {
  const rows = tenants.filter((t) => t.covered || t.reason === "window_intersection_unrepresentable");
  const omitted = tenants.length - rows.length;
  if (!rows.length) return `<div class="hint">No covered tenants${omitted ? ` (${fmtCount(omitted)} uncovered omitted — they need enrollment)` : ""}.</div>`;
  return `<table><thead><tr><th>Tenant</th><th>Owner</th><th>Variant</th><th>Status</th><th>Scopes</th><th>Windows</th><th>Reason</th></tr></thead><tbody>` +
    rows.map((t) => t.covered
      ? `<tr><td><code>${esc(t.tenantId)}</code></td><td>${esc(t.owner)}</td><td>${esc(t.variant)}</td><td>${badge("covered", "active")}</td><td>${scopesHtml(t.scopes)}</td><td>${windowsHtml(t.windows)}</td><td></td></tr>`
      : `<tr><td><code>${esc(t.tenantId)}</code></td><td>${esc(t.owner)}</td><td>${esc(t.variant)}</td><td>${badge("uncovered", "suspended")}</td><td>—</td><td>—</td>` +
        `<td><span class="hint">${esc(t.reason)}: ${esc(t.detail)}</span></td></tr>`).join("") +
    `</tbody></table>` +
    (omitted ? `<div class="hint">${fmtCount(omitted)} uncovered tenant(s) omitted — they need enrollment.</div>` : "");
}

// ── Groups ──
const groupsState = { list: [] };

async function renderGroups(args, live) {
  if (args[0]) return renderGroupDetail(args[0], ["members", "policies", "loop"].includes(args[1]) ? args[1] : "members", live);
  const { res, data } = await api("/admin/groups");
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`);
  groupsState.list = data.groups ?? [];
  paint(`
    <div class="toolbar">
      <span class="hint">Groups carry members, named policies and loop enrollments — the loop/general split is gone.</span>
      <span class="spacer"></span>
      <button id="gNew" type="button">New group</button>
    </div>
    <table>
      <thead><tr><th>Name</th><th>Group id</th><th class="num">Members</th><th>Actions</th></tr></thead>
      <tbody>${groupsState.list.map((g) => {
        const enc = encodeURIComponent(g.groupId);
        return `<tr><td>${esc(g.name)}${g.description ? `<div class="hint">${esc(g.description)}</div>` : ""}</td>` +
          `<td><code>${esc(g.groupId)}</code></td>` +
          `<td class="num">${fmtCount(g.memberCount)}</td>` +
          `<td style="white-space:nowrap;"><a class="linkish" href="#/groups/${enc}/members">Members</a> · <a class="linkish" href="#/groups/${enc}/policies">Policies</a> · <a class="linkish" href="#/groups/${enc}/loop">Tenant loop</a> · ` +
          `<button class="ghost" type="button" data-edit="${esc(g.groupId)}">Edit</button> ` +
          `<button class="danger" type="button" data-delete="${esc(g.groupId)}">Delete</button></td></tr>`;
      }).join("") || '<tr><td colspan="4" class="hint">No groups yet</td></tr>'}</tbody>
    </table>`);
  view.querySelector("#gNew").addEventListener("click", () => createGroupFlow());
  for (const btn of view.querySelectorAll("[data-edit]")) {
    btn.addEventListener("click", () => editGroupFlow(groupsState.list.find((g) => g.groupId === btn.dataset.edit)));
  }
  for (const btn of view.querySelectorAll("[data-delete]")) {
    btn.addEventListener("click", () => deleteGroupFlow(btn.dataset.delete));
  }
}

/** New-group modal (round-2 group-create fix): name + description ONLY — the server
 * generates the id as an ASCII slug of the name. Errors come back as {error, field} and
 * render inline on the named field (never in a flash that disappears). Success opens the
 * new group's Members tab. */
function createGroupFlow() {
  const wrap = showModal({
    title: "New group",
    bodyHtml: `
      <div class="field"><label for="cg-name">Name (1-80 chars)</label><input id="cg-name" autocomplete="off"></div>
      <div class="formErr" id="cg-name-err" role="alert"></div>
      <div class="field"><label for="cg-desc">Description (optional, up to 500 chars)</label><input id="cg-desc" autocomplete="off"></div>
      <div class="formErr" id="cg-desc-err" role="alert"></div>
      <div class="formErr" id="cg-err" role="alert"></div>
      <div class="row"><span class="spacer"></span><button class="ghost" id="cg-cancel" type="button">Cancel</button><button id="cg-ok" type="button">Create</button></div>`,
  });
  wrap.querySelector("#cg-cancel").addEventListener("click", () => wrap.remove());
  wrap.querySelector("#cg-ok").addEventListener("click", async () => {
    for (const id of ["cg-name-err", "cg-desc-err", "cg-err"]) wrap.querySelector(`#${id}`).textContent = "";
    const name = wrap.querySelector("#cg-name").value.trim();
    const description = wrap.querySelector("#cg-desc").value.trim();
    if (!name) {
      wrap.querySelector("#cg-name-err").textContent = "⚠ Name is required";
      return;
    }
    // Slug-free payload: name + description only — no manual id field.
    const { res, data } = await api("/admin/groups", { method: "POST", body: { name, description: description || undefined } });
    if (!res.ok) {
      const slot = data?.field === "name" ? "#cg-name-err" : data?.field === "description" ? "#cg-desc-err" : "#cg-err";
      wrap.querySelector(slot).textContent = `⚠ ${errorText(res, data)}`;
      return;
    }
    wrap.remove();
    location.hash = `#/groups/${encodeURIComponent(data.groupId)}/members`;
  });
  wrap.querySelector("#cg-name").focus();
}

async function editGroupFlow(group) {
  if (!group) return;
  const v = await promptModal({
    title: `Edit ${group.groupId}`,
    fields: [
      { name: "name", label: "Name (1-80 chars)", value: group.name, required: true },
      { name: "description", label: "Description (up to 500 chars)", value: group.description ?? "" },
    ],
    confirmLabel: "Save",
  });
  if (!v) return;
  const { res, data } = await api(`/admin/groups/${encodeURIComponent(group.groupId)}`, {
    method: "PATCH",
    body: { name: v.name.trim(), description: v.description.trim() || null },
  });
  if (!res.ok) return flash(errorText(res, data));
  notify(`Group ${group.groupId} updated.`, true);
}

async function deleteGroupFlow(groupId) {
  const password = await askPassword(
    `Delete group ${groupId}`,
    "Every membership is removed, and the group's policy assignments and loop enrollments are cleaned up with it (its members' tenants may leave the loop registry). The users are kept. This cannot be undone.",
  );
  if (password === null) return;
  const { res, data } = await api(`/admin/groups/${encodeURIComponent(groupId)}`, { method: "DELETE", password });
  if (!res.ok) return flash(errorText(res, data));
  notify(`Group ${groupId} deleted.`, true);
}

/** Group detail with three tabs: Members (paste-list flow), Policies (assigned named
 * policies with assign/unassign under reauth), Tenant loop ((group, variant) enrollments
 * with enroll/suspend/activate/unenroll + the covered-tenants preview). */
async function renderGroupDetail(groupId, tab, live) {
  const { res, data: group } = await api(`/admin/groups/${encodeURIComponent(groupId)}`);
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, group))}</div><a class="linkish" href="#/groups">← Groups</a>`);
  const enc = encodeURIComponent(group.groupId);
  const members = group.members ?? [];
  const head = `<div class="toolbar"><a class="linkish" href="#/groups">← Groups</a><h2 style="margin:0">${esc(group.name)}</h2><span class="hint"><code>${esc(group.groupId)}</code></span></div>` +
    `<nav class="tabs">` +
    `<a href="#/groups/${enc}/members" class="${tab === "members" ? "active" : ""}">Members (${fmtCount(members.length)})</a>` +
    `<a href="#/groups/${enc}/policies" class="${tab === "policies" ? "active" : ""}">Policies</a>` +
    `<a href="#/groups/${enc}/loop" class="${tab === "loop" ? "active" : ""}">Tenant loop</a></nav>`;
  if (tab === "policies") return renderGroupPoliciesTab(group, head, live);
  if (tab === "loop") return renderGroupLoopTab(group, head, live);
  paint(head +
    `<div class="card wide"><h3 style="margin-top:0">Add members</h3>` +
    `<div class="toolbar"><input id="gmSearch" type="search" placeholder="Search users by login ID or name" aria-label="Search users to add" style="width:300px"></div>` +
    `<div id="gmResults"></div>` +
    `<h3>Paste a list</h3><div class="hint">Login IDs separated by commas, spaces or new lines. Up to 500 per request.</div>` +
    `<textarea id="gmPaste" rows="4" spellcheck="false" aria-label="Login IDs to add"></textarea>` +
    `<div class="toolbar"><button id="gmPasteGo" type="button">Add pasted list</button></div></div>` +
    `<h3>Members</h3>` +
    `<table><thead><tr><th>Login ID</th><th></th></tr></thead><tbody>` +
    (members.map((p) => `<tr><td>${esc(p)}</td><td class="num"><button class="ghost" type="button" data-remove="${esc(p)}">Remove</button></td></tr>`).join("") ||
      `<tr><td colspan="2" class="hint">No members yet</td></tr>`) +
    `</tbody></table>`);
  bindMembers(group, members);
}

/** Policies tab: the named policies assigned to this group (unassign under reauth) and the
 * assign picker. The API exposes assignments per policy, so the group's set resolves from
 * the per-policy detail views. */
async function renderGroupPoliciesTab(group, head, live) {
  const listRes = await api("/admin/policies");
  if (!live()) return;
  if (!listRes.res.ok) return paint(head + `<div class="flash err">⚠ ${esc(errorText(listRes.res, listRes.data))}</div>`);
  const policies = listRes.data.policies ?? [];
  const details = await Promise.all(policies.map((p) => api(`/admin/policies/${encodeURIComponent(p.policyId)}`)));
  if (!live()) return;
  const assigned = [];
  const unassigned = [];
  for (const d of details) {
    if (!d.res.ok) continue;
    ((d.data.assignments ?? []).some((a) => a.targetId === group.groupId) ? assigned : unassigned).push(d.data.policy);
  }
  paint(head +
    `<div class="card wide"><h3 style="margin-top:0">Assigned policies</h3>` +
    (assigned.length
      ? `<table><thead><tr><th>Policy</th><th>Limits</th><th></th></tr></thead><tbody>` +
        assigned.map((p) => `<tr><td>${esc(p.name)} <span class="hint"><code>${esc(p.policyId)}</code></span></td><td>${limitsSummary(p.limits)}</td>` +
          `<td class="num"><button class="ghost" type="button" data-unassign="${esc(p.policyId)}">Unassign</button></td></tr>`).join("") +
        `</tbody></table>`
      : '<div class="hint">No policies assigned — members get the gateway baseline.</div>') +
    `<h3>Assign a policy</h3>` +
    `<div class="toolbar"><select id="gp-pick" aria-label="Policy to assign">${unassigned.length ? unassigned.map((p) => option(p.policyId, p.name)).join("") : '<option value="">no unassigned policies</option>'}</select>` +
    `<button id="gp-assign" type="button"${unassigned.length ? "" : " disabled"}>Assign…</button></div>` +
    `<div class="hint">Assignment re-confirms the operator password. A member's effective limit is the strictest across their groups' policies and the gateway baseline.</div>` +
    `<div class="formErr" id="gp-err" role="alert"></div></div>`);
  const err = (msg) => {
    view.querySelector("#gp-err").textContent = `⚠ ${msg}`;
  };
  for (const btn of view.querySelectorAll("[data-unassign]")) {
    btn.addEventListener("click", async () => {
      const policyId = btn.dataset.unassign;
      const password = await askPassword(`Unassign a policy from ${group.groupId}`, "The policy stops applying to the group's members immediately; their limits fall back to the baseline.");
      if (password === null) return;
      const { res, data } = await api(`/admin/policies/${encodeURIComponent(policyId)}/assignments`, { method: "DELETE", body: { groupId: group.groupId }, password });
      if (!res.ok) return err(errorText(res, data));
      notify("Policy unassigned.", true);
    });
  }
  view.querySelector("#gp-assign").addEventListener("click", async () => {
    const policyId = view.querySelector("#gp-pick").value;
    if (!policyId) return;
    const password = await askPassword(`Assign a policy to ${group.groupId}`, "The strictest-wins limits apply to every member on their next request.");
    if (password === null) return;
    const { res, data } = await api(`/admin/policies/${encodeURIComponent(policyId)}/assignments`, { method: "POST", body: { groupId: group.groupId }, password });
    if (!res.ok) return err(errorText(res, data));
    notify("Policy assigned.", true);
  });
}

/** Tenant-loop tab: this group's (group, variant) enrollments with enroll /
 * suspend-activate / unenroll (all under reauth) and the covered-tenants preview. */
async function renderGroupLoopTab(group, head, live) {
  const [enrollRes, variants] = await Promise.all([api("/admin/tenant-loop/enrollments"), loadVariants()]);
  if (!live()) return;
  if (!enrollRes.res.ok) return paint(head + `<div class="flash err">⚠ ${esc(errorText(enrollRes.res, enrollRes.data))}</div>`);
  const rows = (enrollRes.data.enrollments ?? []).filter((e) => e.groupId === group.groupId);
  paint(head +
    `<div class="card wide"><h3 style="margin-top:0">Enrollments for <code>${esc(group.groupId)}</code></h3>` +
    (rows.length
      ? `<table><thead><tr><th>Variant</th><th>Status</th><th>Scopes</th><th>Windows</th><th>git remote</th><th>Actions</th></tr></thead><tbody>` +
        rows.map((e) => `<tr><td><code>${esc(e.variant)}</code></td><td>${badge(e.status, e.status)}</td><td>${scopesHtml(e.scopes)}</td><td>${windowsHtml(e.windows)}</td><td>${esc(e.gitRemote ?? "local-only")}</td>` +
          `<td style="white-space:nowrap;"><button class="ghost" type="button" data-en-toggle="${esc(e.variant)}">${e.status === "active" ? "Suspend" : "Activate"}</button> ` +
          `<button class="ghost" type="button" data-en-preview="${esc(e.variant)}">Covered tenants</button> ` +
          `<button class="danger" type="button" data-en-remove="${esc(e.variant)}">Unenroll</button></td></tr>`).join("") +
        `</tbody></table>`
      : '<div class="hint">Not enrolled — the members\' tenants are fail-closed out of the loop registry until this group is enrolled.</div>') +
    `<div class="formErr" id="gl-err" role="alert"></div></div>` +
    `<div class="card wide" id="gl-preview" style="display:none;"><h3 style="margin-top:0">Covered tenants — <span id="gl-preview-title"></span></h3><div id="gl-preview-body"></div></div>` +
    `<div class="card wide"><h3 style="margin-top:0">Enroll</h3>` +
    `<div class="field"><label for="gl-en-variant">Variant</label><select id="gl-en-variant">${option("*", "* (all variants)", "*")}${variants.map((v) => option(v, v)).join("")}</select></div>` +
    enrollmentFormHtml("gl-en") +
    `<div style="display:flex; gap:8px; margin-top:8px;"><button id="gl-en-submit" type="button">Enroll</button></div>` +
    `<div class="formErr" id="gl-en-err" role="alert"></div></div>`);
  bindRemoteToggle(view, "gl-en");
  const err = (msg) => {
    view.querySelector("#gl-err").textContent = `⚠ ${msg}`;
  };
  const byVariant = (variant) => rows.find((r) => r.variant === variant);
  for (const btn of view.querySelectorAll("[data-en-toggle]")) {
    btn.addEventListener("click", async () => {
      const variant = btn.dataset.enToggle;
      const e = byVariant(variant);
      const status = e.status === "active" ? "suspended" : "active";
      const password = await askPassword(`${status === "suspended" ? "Suspend" : "Activate"} ${group.groupId}/${variant}`, "The registry export refreshes immediately.");
      if (password === null) return;
      // The PUT body is complete — the stored scopes/windows are resent verbatim (no
      // default fill exists server-side).
      const { res, data } = await enrollmentApi(group.groupId, variant, { method: "PUT", body: { status, scopes: e.scopes, windows: e.windows, gitRemote: e.gitRemote }, password });
      if (!res.ok) return err(errorText(res, data));
      notify(`Enrollment ${group.groupId}/${variant} ${status}.`, true);
    });
  }
  for (const btn of view.querySelectorAll("[data-en-remove]")) {
    btn.addEventListener("click", async () => {
      const variant = btn.dataset.enRemove;
      const password = await askPassword(`Unenroll ${group.groupId}/${variant}`, "The group's members' covered tenants leave the registry export immediately.");
      if (password === null) return;
      const { res, data } = await enrollmentApi(group.groupId, variant, { method: "DELETE", password });
      if (!res.ok) return err(errorText(res, data));
      notify(`Unenrolled ${group.groupId}/${variant}.`, true);
    });
  }
  for (const btn of view.querySelectorAll("[data-en-preview]")) {
    btn.addEventListener("click", async () => {
      const variant = btn.dataset.enPreview;
      const panel = view.querySelector("#gl-preview");
      panel.style.display = "";
      view.querySelector("#gl-preview-title").textContent = `${group.groupId}/${variant}`;
      const bodyEl = view.querySelector("#gl-preview-body");
      bodyEl.textContent = "loading…";
      const { res, data } = await api(`/admin/tenant-loop/preview?groupId=${encodeURIComponent(group.groupId)}&variant=${encodeURIComponent(variant)}`);
      if (data?.code === "tenant_loop_disabled") { err(errorText(res, data)); return; }
      if (!res.ok) { bodyEl.innerHTML = `<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`; return; }
      bodyEl.innerHTML = previewPanelHtml(data.tenants ?? []);
    });
  }
  view.querySelector("#gl-en-submit").addEventListener("click", async () => {
    const errEl = view.querySelector("#gl-en-err");
    errEl.textContent = "";
    const variant = view.querySelector("#gl-en-variant").value;
    if (!variant) { errEl.textContent = "⚠ pick a variant"; return; }
    const parsed = readEnrollmentForm(view, "gl-en");
    if (!parsed.ok) { errEl.textContent = `⚠ ${parsed.error}`; return; }
    const password = await askPassword(`Enroll ${group.groupId}/${variant}`, "The group's members' covered tenants export with these scopes and windows immediately.");
    if (password === null) return;
    errEl.textContent = "enrolling…";
    const { res, data } = await enrollmentApi(group.groupId, variant, { method: "PUT", body: { status: "active", ...parsed.value }, password });
    if (!res.ok) { errEl.textContent = `⚠ ${errorText(res, data)}`; return; }
    notify(`Enrolled ${group.groupId}/${variant}.`, true);
  });
}

function bindMembers(group, members) {
  const enc = encodeURIComponent(group.groupId);
  let searchTimer = 0;
  view.querySelector("#gmSearch").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const term = e.target.value.trim();
      const results = view.querySelector("#gmResults");
      if (!term) {
        results.innerHTML = "";
        return;
      }
      const { res, data } = await api(`/admin/users?q=${encodeURIComponent(term)}&size=20`);
      if (!res.ok) {
        results.innerHTML = `<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`;
        return;
      }
      results.innerHTML = `<table><tbody>${(data.users ?? []).map((u) => {
        const already = members.includes(u.principal);
        return `<tr><td>${esc(u.loginId)} <span class="hint">${esc(u.name)}</span></td><td class="num">` +
          (already ? '<span class="hint">member</span>' : `<button class="ghost" type="button" data-add="${esc(u.principal)}">Add</button>`) +
          `</td></tr>`;
      }).join("") || '<tr><td class="hint">no matches</td></tr>'}</tbody></table>`;
      for (const btn of results.querySelectorAll("[data-add]")) {
        btn.addEventListener("click", () => addMembers(group, [btn.dataset.add], `Added ${btn.dataset.add}.`));
      }
    }, 300);
  });
  view.querySelector("#gmPasteGo").addEventListener("click", async () => {
    const list = [...new Set(view.querySelector("#gmPaste").value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
    if (!list.length) return flash("Paste at least one login ID.");
    const out = view.querySelector("#gmPaste");
    let added = 0;
    const unknown = [];
    for (let i = 0; i < list.length; i += 500) {
      const { res, data } = await api(`/admin/groups/${enc}/members`, { method: "POST", body: { principals: list.slice(i, i + 500) } });
      if (!res.ok) return flash(errorText(res, data));
      added += data.added ?? 0;
      unknown.push(...(data.unknown ?? []));
    }
    out.value = "";
    notify(`Added ${added} member(s).${unknown.length ? ` No live user for: ${unknown.join(", ")}.` : ""}`, unknown.length === 0);
  });
  for (const btn of view.querySelectorAll("[data-remove]")) {
    btn.addEventListener("click", async () => {
      const principal = btn.dataset.remove;
      const password = await askPassword(`Remove ${principal} from ${group.groupId}`, "The user leaves this group, and the group's policy stops applying to them.");
      if (password === null) return;
      const { res, data } = await api(`/admin/groups/${enc}/members`, { method: "DELETE", body: { principals: [principal] }, password });
      if (!res.ok) return flash(errorText(res, data));
      notify(`Removed ${principal}.`, true);
    });
  }
}

async function addMembers(group, principals, message) {
  const { res, data } = await api(`/admin/groups/${encodeURIComponent(group.groupId)}/members`, { method: "POST", body: { principals } });
  if (!res.ok) return flash(errorText(res, data));
  notify(data.unknown?.length ? `No live user for: ${data.unknown.join(", ")}.` : message, !data.unknown?.length);
}

// ── Tenants ──
const tenantsState = { owner: "", group: "", variant: "", status: "", page: 1, total: 0, selected: new Set(), last: null };

async function renderTenants(_args, live) {
  const [groupsRes, variants] = await Promise.all([api("/admin/groups"), loadVariants()]);
  const q = new URLSearchParams({ page: String(tenantsState.page), size: String(PAGE_SIZE) });
  for (const k of ["owner", "group", "variant", "status"]) if (tenantsState[k]) q.set(k, tenantsState[k]);
  const { res, data } = await api(`/admin/tenants?${q}`);
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`);
  const groups = groupsRes.res.ok ? groupsRes.data.groups ?? [] : [];
  const tenants = data.tenants ?? [];
  tenantsState.total = data.total ?? 0;
  const count = tenantsState.selected.size;
  const allOnPage = tenants.length > 0 && tenants.every((t) => tenantsState.selected.has(t.tenantId));
  paint(`
    <div class="toolbar">
      <input id="tOwner" type="search" placeholder="Owner principal" value="${esc(tenantsState.owner)}" aria-label="Filter by owner" style="width:200px">
      <select id="tGroup" aria-label="Filter by group">${[option("", "all groups", tenantsState.group), ...groups.map((g) => option(g.groupId, g.name, tenantsState.group))].join("")}</select>
      <select id="tVariant" aria-label="Filter by variant">${[option("", "all variants", tenantsState.variant), ...variants.map((v) => option(v, v, tenantsState.variant))].join("")}</select>
      <select id="tStatus" aria-label="Filter by archive status">${[["", "any status"], ["active", "active"], ["archived", "archived"]].map(([v, l]) => option(v, l, tenantsState.status)).join("")}</select>
    </div>
    <div class="bulkBar${count ? "" : " gws-hidden"}" id="bulkBar">
      <span><b id="bulkCount">${count}</b> selected</span>
      <button class="ghost" type="button" data-tbulk="archive">Archive</button>
      <button class="ghost" type="button" data-tbulk="restore">Restore</button>
      <button class="danger" type="button" data-tbulk="delete">Delete…</button>
      <span class="spacer"></span>
      <button class="linkish" type="button" id="bulkClear">Clear selection</button>
    </div>
    ${bulkResultHtml(tenantsState.last)}
    <table>
      <thead><tr><th><input type="checkbox" id="tAll" aria-label="select all on this page"${allOnPage ? " checked" : ""}></th><th>Tenant</th><th>Variant</th><th>Owner</th><th>Status</th><th class="num">Sessions</th><th class="num">Tokens</th><th>Created</th></tr></thead>
      <tbody>${tenants.map((t) => `<tr><td><input type="checkbox" data-tselect="${esc(t.tenantId)}" aria-label="select ${esc(t.tenantId)}"${tenantsState.selected.has(t.tenantId) ? " checked" : ""}></td>` +
        `<td>${esc(t.tenantId)}${t.name ? `<div class="hint">${esc(t.name)}</div>` : ""}</td><td>${esc(t.variant)}</td><td>${esc(t.ownerPrincipal)}</td>` +
        `<td>${t.archivedAt ? badge("archived") : badge("active")}</td><td class="num">${fmtCount(t.sessions)}</td>` +
        `<td class="num">${fmtCount(t.inputTokens + t.outputTokens)}</td><td>${esc(String(t.createdAt ?? "").slice(0, 10))}</td></tr>`).join("") ||
        '<tr><td colspan="8" class="hint">No tenants match these filters</td></tr>'}</tbody>
    </table>
    ${pagerHtml(tenantsState.total, tenantsState.page, PAGE_SIZE)}`);

  const setFilter = (key, value) => {
    tenantsState[key] = value;
    tenantsState.page = 1;
    tenantsState.selected.clear();
    refresh();
  };
  let ownerTimer = 0;
  view.querySelector("#tOwner").addEventListener("input", (e) => {
    clearTimeout(ownerTimer);
    ownerTimer = setTimeout(() => setFilter("owner", e.target.value.trim()), 300);
  });
  view.querySelector("#tGroup").addEventListener("change", (e) => setFilter("group", e.target.value));
  view.querySelector("#tVariant").addEventListener("change", (e) => setFilter("variant", e.target.value));
  view.querySelector("#tStatus").addEventListener("change", (e) => setFilter("status", e.target.value));
  const updateSelection = () => {
    for (const box of view.querySelectorAll("[data-tselect]")) box.checked = tenantsState.selected.has(box.dataset.tselect);
    const boxes = [...view.querySelectorAll("[data-tselect]")];
    view.querySelector("#tAll").checked = boxes.length > 0 && boxes.every((b) => b.checked);
    view.querySelector("#bulkBar").classList.toggle("gws-hidden", tenantsState.selected.size === 0);
    view.querySelector("#bulkCount").textContent = String(tenantsState.selected.size);
  };
  view.querySelector("#tAll").addEventListener("change", (e) => {
    for (const t of tenants) {
      if (e.target.checked) tenantsState.selected.add(t.tenantId);
      else tenantsState.selected.delete(t.tenantId);
    }
    updateSelection();
  });
  for (const box of view.querySelectorAll("[data-tselect]")) {
    box.addEventListener("change", () => {
      if (box.checked) tenantsState.selected.add(box.dataset.tselect);
      else tenantsState.selected.delete(box.dataset.tselect);
      updateSelection();
    });
  }
  view.querySelector("#bulkClear").addEventListener("click", () => {
    tenantsState.selected.clear();
    updateSelection();
  });
  for (const btn of view.querySelectorAll("[data-tbulk]")) btn.addEventListener("click", () => bulkTenants(btn.dataset.tbulk));
  bindPager((page) => {
    tenantsState.page = page;
    tenantsState.selected.clear();
    refresh();
  });
}

async function bulkTenants(action) {
  const ids = [...tenantsState.selected];
  if (!ids.length) return;
  const verb = { archive: "Archive", restore: "Restore", delete: "Delete" }[action];
  const password = await askPassword(
    `${verb} ${ids.length} tenant(s)`,
    action === "delete"
      ? "Deletion removes each tenant's project files and chat history permanently. It cannot be undone."
      : action === "archive"
        ? "Archived tenants reject new turns but still count toward the owner's tenant cap."
        : "Restored tenants accept turns again.",
  );
  if (password === null) return;
  const { res, data } = await api("/admin/tenants/bulk", { method: "POST", body: { ids, action }, password });
  if (!res.ok) return flash(errorText(res, data));
  tenantsState.last = summarizeBulk(verb, data);
  tenantsState.selected.clear();
  refresh();
}

// ── Policies (round-2 named-policy CRUD; group-only assignments per the unit model) ──
const policiesState = { list: [] };

function limitsSummary(limits) {
  const parts = POLICY_NUMERIC.filter(([key]) => limits?.[key] !== undefined)
    .map(([key]) => `<span class="chip">${esc(key)}=${fmtCount(limits[key])}</span>`);
  if (Array.isArray(limits?.allowedVariants) && limits.allowedVariants.length) {
    parts.push(`<span class="chip">allowedVariants=${esc(limits.allowedVariants.join("|"))}</span>`);
  }
  return parts.join("") || '<span class="hint">no limits set</span>';
}

async function renderPolicies(args, live) {
  if (args[0]) return renderPolicyDetail(args[0], live);
  const { res, data } = await api("/admin/policies");
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`);
  policiesState.list = data.policies ?? [];
  paint(`
    <div class="toolbar">
      <span class="hint">Named policies attach to GROUPS only; a member's effective limit is the strictest of the gateway baseline and every policy assigned to their groups. The gateway baseline itself (the <code>CO_WORKSPACE_TENANT_*</code> values) is not exposed by this API.</span>
      <span class="spacer"></span>
      <button id="pNew" type="button">New policy</button>
    </div>
    <table>
      <thead><tr><th>Name</th><th>Description</th><th>Limits</th><th class="num">Assignments</th><th>Actions</th></tr></thead>
      <tbody>${policiesState.list.map((p) => {
        const enc = encodeURIComponent(p.policyId);
        return `<tr><td>${esc(p.name)} <span class="hint"><code>${esc(p.policyId)}</code></span></td>` +
          `<td>${esc(p.description ?? "")}</td><td>${limitsSummary(p.limits)}</td><td class="num">${fmtCount(p.assignmentCount)}</td>` +
          `<td style="white-space:nowrap;"><a class="linkish" href="#/policies/${enc}">Detail</a> · ` +
          `<button class="ghost" type="button" data-edit="${esc(p.policyId)}">Edit</button> ` +
          `<button class="danger" type="button" data-delete="${esc(p.policyId)}">Delete</button></td></tr>`;
      }).join("") || '<tr><td colspan="5" class="hint">No policies yet</td></tr>'}</tbody>
    </table>`);
  view.querySelector("#pNew").addEventListener("click", () => policyModal(null));
  for (const btn of view.querySelectorAll("[data-edit]")) {
    btn.addEventListener("click", () => policyModal(policiesState.list.find((p) => p.policyId === btn.dataset.edit)));
  }
  for (const btn of view.querySelectorAll("[data-delete]")) {
    btn.addEventListener("click", () => deletePolicyFlow(btn.dataset.delete));
  }
}

/** Create/edit modal for a named policy: name, description and a field per limit — the 4
 * numeric fields plus the allowedVariants multi-select fed from the variant catalog. Form
 * errors render inline (never a flash). Create needs no reauth; PATCH re-confirms the
 * password. A create carrying inline assignments is refused 409 server-side — the UI never
 * sends one. */
async function policyModal(policy) {
  const editing = Boolean(policy);
  const variants = await loadVariants();
  const selected = new Set(editing && Array.isArray(policy.limits?.allowedVariants) ? policy.limits.allowedVariants : []);
  const wrap = showModal({
    title: editing ? `Edit policy ${policy.name}` : "New policy",
    bodyHtml: `
      <div class="field"><label for="pf-name">Name (1-80 chars, unique)</label><input id="pf-name" value="${esc(policy?.name ?? "")}" autocomplete="off"></div>
      <div class="formErr" id="pf-name-err" role="alert"></div>
      <div class="field"><label for="pf-desc">Description (optional, up to 500 chars)</label><input id="pf-desc" value="${esc(policy?.description ?? "")}" autocomplete="off"></div>
      <div class="field">Limits — leave a field empty to leave it unset (a policy only tightens)</div>
      ${POLICY_NUMERIC.map(([key, label, hint]) =>
        `<div class="field"><label for="pf-${key}">${esc(label)} — ${esc(hint)}</label>` +
        `<input id="pf-${key}" type="number" min="1" step="1" value="${esc(policy?.limits?.[key] ?? "")}" placeholder="not set" style="max-width:220px"></div>`).join("")}
      <div class="field"><label for="pf-variants">Allowed variants (multi-select; empty = any configured variant)</label>
        <select id="pf-variants" multiple size="${Math.max(2, variants.length)}" aria-label="Allowed variants">${variants.map((v) => `<option value="${esc(v)}"${selected.has(v) ? " selected" : ""}>${esc(v)}</option>`).join("") || '<option value="" disabled>no variants reported</option>'}</select></div>
      <div class="formErr" id="pf-err" role="alert"></div>
      <div class="row"><span class="spacer"></span><button class="ghost" id="pf-cancel" type="button">Cancel</button><button id="pf-ok" type="button">${editing ? "Save" : "Create"}</button></div>`,
  });
  wrap.querySelector("#pf-cancel").addEventListener("click", () => wrap.remove());
  wrap.querySelector("#pf-ok").addEventListener("click", async () => {
    for (const id of ["pf-name-err", "pf-err"]) wrap.querySelector(`#${id}`).textContent = "";
    const name = wrap.querySelector("#pf-name").value.trim();
    if (!name) {
      wrap.querySelector("#pf-name-err").textContent = "⚠ Name is required";
      return;
    }
    const numerics = Object.fromEntries(POLICY_NUMERIC_KEYS.map((key) => [key, wrap.querySelector(`#pf-${key}`).value]));
    const allowedVariants = [...wrap.querySelector("#pf-variants").selectedOptions].map((o) => o.value).filter(Boolean);
    const parsed = validatePolicyLimits(numerics, allowedVariants);
    if (!parsed.ok) {
      wrap.querySelector("#pf-err").textContent = `⚠ ${parsed.error}`;
      return;
    }
    const body = { name, description: wrap.querySelector("#pf-desc").value.trim() || null, limits: parsed.limits };
    let res, data;
    if (editing) {
      const password = await askPassword(`Save policy ${policy.name}`, "The tightened limits apply to every member on their next request.");
      if (password === null) return;
      ({ res, data } = await api(`/admin/policies/${encodeURIComponent(policy.policyId)}`, { method: "PATCH", body, password }));
    } else {
      ({ res, data } = await api("/admin/policies", { method: "POST", body }));
    }
    if (!res.ok) {
      const slot = data?.error === "invalid_name" ? "#pf-name-err" : "#pf-err";
      wrap.querySelector(slot).textContent = `⚠ ${errorText(res, data)}`;
      return;
    }
    wrap.remove();
    notify(`Policy ${data.policy.name} ${editing ? "updated" : "created"}.`, true);
  });
  wrap.querySelector("#pf-name").focus();
}

/** Delete a policy; the confirmation names the assignment count (assignments cascade).
 * `errSel` (optional) inlines the error on the detail page instead of the view flash. */
async function deletePolicyFlow(policyId, errSel) {
  const detail = await api(`/admin/policies/${encodeURIComponent(policyId)}`);
  if (!detail.res.ok) return flash(errorText(detail.res, detail.data));
  const policy = detail.data.policy;
  const count = (detail.data.assignments ?? []).length;
  const password = await askPassword(
    `Delete policy ${policy.name}`,
    `This policy is assigned to ${fmtCount(count)} group(s); deleting it removes those assignments and the members' limits fall back to the gateway baseline. This cannot be undone.`,
  );
  if (password === null) return;
  const { res, data } = await api(`/admin/policies/${encodeURIComponent(policyId)}`, { method: "DELETE", password });
  if (!res.ok) {
    const inline = errSel ? view.querySelector(errSel) : null;
    if (inline) inline.textContent = `⚠ ${errorText(res, data)}`;
    else flash(errorText(res, data));
    return;
  }
  notify(`Policy ${policy.name} deleted.`, true);
}

/** Policy detail: the stored limits (edit via the modal), and the assignments "tab" —
 * search groups, assign and unassign (both under reauth, inline errors). */
async function renderPolicyDetail(policyId, live) {
  const [detailRes, groupsRes] = await Promise.all([api(`/admin/policies/${encodeURIComponent(policyId)}`), api("/admin/groups")]);
  if (!live()) return;
  if (!detailRes.res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(detailRes.res, detailRes.data))}</div><a class="linkish" href="#/policies">← Policies</a>`);
  const policy = detailRes.data.policy;
  const assignments = detailRes.data.assignments ?? [];
  const groups = groupsRes.res.ok ? groupsRes.data.groups ?? [] : [];
  const groupName = (id) => groups.find((g) => g.groupId === id)?.name ?? id;
  const assignedIds = new Set(assignments.map((a) => a.targetId));
  const candidates = groups.filter((g) => !assignedIds.has(g.groupId));
  paint(`<div class="toolbar"><a class="linkish" href="#/policies">← Policies</a><h2 style="margin:0">${esc(policy.name)}</h2><span class="hint"><code>${esc(policy.policyId)}</code></span></div>` +
    `<div class="card wide"><h3 style="margin-top:0">Limits</h3>` +
    `<table class="kv"><tr><td>Description</td><td>${esc(policy.description ?? "—")}</td></tr>` +
    POLICY_NUMERIC.map(([key, label]) => `<tr><td>${esc(label)}</td><td>${policy.limits?.[key] ? fmtCount(policy.limits[key]) : '<span class="hint">not set</span>'}</td></tr>`).join("") +
    `<tr><td>Allowed variants</td><td>${Array.isArray(policy.limits?.allowedVariants) ? esc(policy.limits.allowedVariants.join(", ")) : '<span class="hint">any configured variant</span>'}</td></tr></table>` +
    `<div class="toolbar"><button id="pd-edit" type="button">Edit…</button><button id="pd-delete" type="button" class="danger">Delete…</button></div>` +
    `<div class="formErr" id="pd-err" role="alert"></div></div>` +
    `<div class="card wide"><h3 style="margin-top:0">Assignments (${fmtCount(assignments.length)})</h3>` +
    (assignments.length
      ? `<table><thead><tr><th>Group</th><th></th></tr></thead><tbody>` +
        assignments.map((a) => `<tr><td>${esc(groupName(a.targetId))} <span class="hint"><code>${esc(a.targetId)}</code></span></td>` +
          `<td class="num"><button class="ghost" type="button" data-unassign="${esc(a.targetId)}">Unassign</button></td></tr>`).join("") +
        `</tbody></table>`
      : '<div class="hint">Not assigned to any group.</div>') +
    `<h3>Assign to a group</h3>` +
    `<div class="toolbar"><input id="pa-search" type="search" placeholder="Filter groups" aria-label="Filter groups" style="width:200px">` +
    `<select id="pa-pick" aria-label="Group to assign">${candidates.length ? candidates.map((g) => option(g.groupId, g.name)).join("") : '<option value="">no unassigned groups</option>'}</select>` +
    `<button id="pa-assign" type="button"${candidates.length ? "" : " disabled"}>Assign…</button></div>` +
    `<div class="hint">Assignment re-confirms the operator password. Group-only targets — there is no per-user assignment in the unit model.</div>` +
    `<div class="formErr" id="pa-err" role="alert"></div></div>`);
  view.querySelector("#pd-edit").addEventListener("click", () => policyModal(policy));
  view.querySelector("#pd-delete").addEventListener("click", () => deletePolicyFlow(policy.policyId, "#pd-err"));
  const paErr = (msg) => {
    view.querySelector("#pa-err").textContent = `⚠ ${msg}`;
  };
  view.querySelector("#pa-search").addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    const pick = view.querySelector("#pa-pick");
    for (const opt of pick.options) {
      const group = groups.find((g) => g.groupId === opt.value);
      const hay = `${group?.name ?? ""} ${opt.value}`.toLowerCase();
      opt.hidden = Boolean(term) && !hay.includes(term);
    }
  });
  for (const btn of view.querySelectorAll("[data-unassign]")) {
    btn.addEventListener("click", async () => {
      const groupId = btn.dataset.unassign;
      const password = await askPassword(`Unassign from ${groupId}`, "The policy stops applying to the group's members immediately; their limits fall back to the baseline.");
      if (password === null) return;
      const { res, data } = await api(`/admin/policies/${encodeURIComponent(policy.policyId)}/assignments`, { method: "DELETE", body: { groupId }, password });
      if (!res.ok) return paErr(errorText(res, data));
      notify("Policy unassigned.", true);
    });
  }
  view.querySelector("#pa-assign").addEventListener("click", async () => {
    const groupId = view.querySelector("#pa-pick").value;
    if (!groupId) return;
    const password = await askPassword(`Assign to ${groupName(groupId)}`, "The strictest-wins limits apply to every member on their next request.");
    if (password === null) return;
    const { res, data } = await api(`/admin/policies/${encodeURIComponent(policy.policyId)}/assignments`, { method: "POST", body: { groupId }, password });
    if (!res.ok) return paErr(errorText(res, data));
    notify("Policy assigned.", true);
  });
}

// ── Tenant Loop (round-2 unit model: coverage is driven by (group, variant) ENROLLMENTS on
// general groups. The per-tenant register/suspend/deregister forms and the group config
// editor are REMOVED — their routes answer 410. The registry preview lists covered tenants
// only; uncovered tenants need enrollment. Kill switch first: ANY response carrying the
// typed code "tenant_loop_disabled" (403) replaces the whole section with a persistent
// banner. ──
function tenantLoopMarkup() {
  return `<div class="tlBanner gws-hidden" id="tl-banner" role="alert">Tenant loop is disabled via CO_WORKSPACE_TENANT_LOOP_DISABLED — every tenant-loop route answers 403 and the registry export marks every tenant suspended.</div>` +
    `<div id="tl-body" style="display:flex; flex-direction:column; gap:12px;">` +
    `<div class="card wide" id="tl-enroll"><h2 style="margin-top:0;">Enroll a group</h2>` +
    `<div class="field"><label for="tl-en-group">Group</label><select id="tl-en-group"><option value="">loading groups…</option></select></div>` +
    `<div class="field"><label for="tl-en-variant">Variant</label><select id="tl-en-variant"><option value="*">* (all variants)</option></select></div>` +
    enrollmentFormHtml("tl-en") +
    `<div style="display:flex; gap:8px; margin-top:8px;"><button id="tl-en-submit" type="button">Enroll</button></div>` +
    `<div class="formErr" id="tl-en-err" role="alert"></div></div>` +
    `<div class="card wide" id="tl-enrollments"><h2>Enrollments</h2>` +
    `<table><thead><tr><th>Group</th><th>Variant</th><th>Status</th><th>Scopes</th><th>Windows</th><th>git remote</th><th class="num">Covered tenants</th><th>Actions</th></tr></thead><tbody id="tl-en-rows"></tbody></table>` +
    `<div class="hint" id="tl-en-empty" style="min-height:1em;">loading…</div>` +
    `<div class="formErr" id="tl-en-status" role="alert"></div></div>` +
    `<div class="card wide" id="tl-preview" style="display:none;"><h2 style="margin-top:0;">Covered tenants — <span id="tl-preview-title"></span></h2><div id="tl-preview-body"></div></div>` +
    `<div class="card wide" id="tl-registry"><h2 style="display:flex; align-items:center; justify-content:space-between; gap:8px;">Gateway registry export` +
    `<button id="tl-refresh" type="button" class="ghost" style="font-size:.74rem;">↻ Refresh</button></h2>` +
    `<div class="hint" id="tl-fresh"></div><div class="hint" id="tl-empty" style="margin-top:6px;">loading…</div>` +
    `<div id="tl-table-wrap" class="gws-hidden" style="overflow-x:auto; margin-top:6px;">` +
    `<table><thead><tr><th>id</th><th>principal</th><th>variant</th><th>status</th><th>scopes</th><th>windows</th><th>git remote</th><th>actions</th></tr></thead><tbody id="tl-rows"></tbody></table></div></div>` +
    `<div class="formErr" id="tl-status" role="status"></div></div>`;
}

async function renderTenantLoop(_args, live) {
  const variants = await loadVariants();
  if (!live()) return;
  paint(`<div id="tl-root">${tenantLoopMarkup()}</div>`);
  const root = view.querySelector("#tl-root");
  const authHeaders = { "content-type": "application/json", "x-requested-with": "co-workspace" };
  const tlBanner = root.querySelector("#tl-banner");
  const tlBody = root.querySelector("#tl-body");
  const tlStatus = root.querySelector("#tl-status");
  const tlUpgradeFlow = createUpgradeFlow();

  function tlDisabled(body) {
    if (body?.code !== "tenant_loop_disabled") return false;
    tlBanner.classList.remove("gws-hidden");
    tlBody.classList.add("gws-hidden");
    return true;
  }

  function tlNote(text, ok = false) {
    tlStatus.style.color = ok ? "#3fb950" : "";
    tlStatus.textContent = text;
  }

  // Server errors surface verbatim (message + typed code when present) — including the
  // round-2 refusal reasons tenant_loop_not_covered (409) and
  // tenant_loop_window_unrepresentable (403) on the upgrade route.
  function tlErrText(res, body) {
    return `⚠ ${body?.error ?? `HTTP ${res.status}`}${body?.code ? ` (${body.code})` : ""}`;
  }

  // The upgrade POST (dry-run and confirm) — the only per-tenant op left post-v4.
  function tlPost(tenantId, op, bodyOut) {
    return fetch(`/admin/tenant-loop/tenants/${encodeURIComponent(tenantId)}/${op}`, { method: "POST", headers: authHeaders, body: JSON.stringify(bodyOut ?? {}) });
  }

  // ── Enrollments table: (group, variant) rows with status/scopes/windows/gitRemote and a
  // covered-tenant count resolved from the preview endpoint. ──
  async function tlLoadEnrollments() {
    const empty = root.querySelector("#tl-en-empty");
    const rows = root.querySelector("#tl-en-rows");
    const status = root.querySelector("#tl-en-status");
    empty.textContent = "loading…";
    rows.innerHTML = "";
    status.textContent = "";
    let res, body;
    try {
      res = await fetch("/admin/tenant-loop/enrollments");
      body = await res.json().catch(() => ({}));
    } catch (err) {
      empty.textContent = `⚠ ${err.message}`;
      return;
    }
    if (tlDisabled(body)) return;
    if (!res.ok) {
      empty.textContent = tlErrText(res, body);
      return;
    }
    const enrollments = body.enrollments ?? [];
    if (!enrollments.length) {
      empty.textContent = "no enrollments — enroll a group below or from a group's Tenant-loop tab; uncovered tenants are fail-closed out of the export";
      return;
    }
    empty.textContent = "";
    // Covered-tenant count per (group, variant): the preview's covered rows.
    const counts = await Promise.all(enrollments.map((e) =>
      fetch(`/admin/tenant-loop/preview?groupId=${encodeURIComponent(e.groupId)}&variant=${encodeURIComponent(e.variant)}`)
        .then((r) => r.json().catch(() => ({})))
        .then((b) => (Array.isArray(b.tenants) ? b.tenants.filter((t) => t.covered).length : null))
        .catch(() => null)));
    if (!live()) return;
    rows.innerHTML = enrollments.map((e, i) =>
      `<tr><td><code>${esc(e.groupId)}</code></td><td><code>${esc(e.variant)}</code></td><td>${badge(e.status, e.status)}</td>` +
      `<td>${scopesHtml(e.scopes)}</td><td>${windowsHtml(e.windows)}</td><td>${esc(e.gitRemote ?? "local-only")}</td>` +
      `<td class="num">${counts[i] === null ? '<span class="hint">?</span>' : fmtCount(counts[i])}</td>` +
      `<td style="white-space:nowrap;">` +
      `<button class="ghost" data-en-act="toggle" data-gid="${esc(e.groupId)}" data-variant="${esc(e.variant)}">${e.status === "active" ? "Suspend" : "Activate"}</button> ` +
      `<button class="ghost" data-en-act="preview" data-gid="${esc(e.groupId)}" data-variant="${esc(e.variant)}">Covered tenants</button> ` +
      `<button class="danger" data-en-act="unenroll" data-gid="${esc(e.groupId)}" data-variant="${esc(e.variant)}">Unenroll</button></td></tr>`).join("");
    for (const btn of root.querySelectorAll("[data-en-act]")) {
      const e = enrollments.find((en) => en.groupId === btn.dataset.gid && en.variant === btn.dataset.variant);
      btn.addEventListener("click", () => {
        if (!e) return;
        if (btn.dataset.enAct === "preview") tlPreview(e);
        else tlEnrollmentAction(e, btn.dataset.enAct);
      });
    }
  }

  // Suspend/activate (PUT resends the stored scopes/windows — the body must be complete)
  // and unenroll (DELETE). Both are admin + reauth: the password rides x-admin-password
  // for that one request and is never stored.
  async function tlEnrollmentAction(e, action) {
    const status = root.querySelector("#tl-en-status");
    status.textContent = "";
    let res, data;
    if (action === "unenroll") {
      const password = await askPassword(`Unenroll ${e.groupId}/${e.variant}`, "The group's members' covered tenants leave the registry export immediately.");
      if (password === null) return;
      ({ res, data } = await enrollmentApi(e.groupId, e.variant, { method: "DELETE", password }));
    } else {
      const next = e.status === "active" ? "suspended" : "active";
      const password = await askPassword(`${next === "suspended" ? "Suspend" : "Activate"} ${e.groupId}/${e.variant}`, "The registry export refreshes immediately.");
      if (password === null) return;
      ({ res, data } = await enrollmentApi(e.groupId, e.variant, { method: "PUT", body: { status: next, scopes: e.scopes, windows: e.windows, gitRemote: e.gitRemote }, password }));
    }
    if (tlDisabled(data)) return;
    if (!res.ok) {
      status.textContent = tlErrText(res, data);
      return;
    }
    tlNote(`✔ ${e.groupId}/${e.variant} ${action === "unenroll" ? "unenrolled" : `${data.enrollment?.status ?? "updated"}`}`, true);
    await Promise.all([tlLoadEnrollments(), tlLoadRegistry()]);
  }

  // Covered-tenants preview for ONE enrollment: tenants + resolved scopes/windows + any
  // window_intersection_unrepresentable reason row.
  async function tlPreview(e) {
    const panel = root.querySelector("#tl-preview");
    panel.style.display = "";
    root.querySelector("#tl-preview-title").textContent = `${e.groupId}/${e.variant}`;
    const bodyEl = root.querySelector("#tl-preview-body");
    bodyEl.textContent = "loading…";
    const { res, data } = await api(`/admin/tenant-loop/preview?groupId=${encodeURIComponent(e.groupId)}&variant=${encodeURIComponent(e.variant)}`);
    if (tlDisabled(data)) return;
    if (!res.ok) {
      bodyEl.innerHTML = `<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`;
      return;
    }
    bodyEl.innerHTML = previewPanelHtml(data.tenants ?? []);
  }

  // Group picker for the enroll form.
  (async () => {
    const pick = root.querySelector("#tl-en-group");
    const { res, data } = await api("/admin/groups");
    if (!live()) return;
    const groups = res.ok ? data.groups ?? [] : [];
    pick.innerHTML = groups.length
      ? `<option value="">pick a group…</option>` + groups.map((g) => `<option value="${esc(g.groupId)}">${esc(g.name)} (${esc(g.groupId)})</option>`).join("")
      : `<option value="">no groups — create one under Groups</option>`;
  })();
  root.querySelector("#tl-en-variant").innerHTML = option("*", "* (all variants)", "*") + variants.map((v) => option(v, v)).join("");
  bindRemoteToggle(root, "tl-en");

  root.querySelector("#tl-en-submit").addEventListener("click", async () => {
    const err = root.querySelector("#tl-en-err");
    err.textContent = "";
    const groupId = root.querySelector("#tl-en-group").value;
    const variant = root.querySelector("#tl-en-variant").value;
    if (!groupId) {
      err.textContent = "⚠ pick a group";
      return;
    }
    // Client-side validation mirrors the gateway's write-time rules (app-helpers.js,
    // unit-tested); the server re-validates authoritatively and its errors surface
    // verbatim in the form below.
    const parsed = readEnrollmentForm(root, "tl-en");
    if (!parsed.ok) {
      err.textContent = `⚠ ${parsed.error}`;
      return;
    }
    const password = await askPassword(`Enroll ${groupId}/${variant}`, "The group's members' covered tenants export with these scopes and windows immediately.");
    if (password === null) return;
    err.textContent = "enrolling…";
    const { res, data } = await enrollmentApi(groupId, variant, { method: "PUT", body: { status: "active", ...parsed.value }, password });
    if (tlDisabled(data)) {
      err.textContent = "";
      return;
    }
    if (!res.ok) {
      err.textContent = tlErrText(res, data);
      return;
    }
    err.textContent = "";
    tlNote(`✔ enrolled ${groupId}/${variant} — export ${data.export?.ok ? `written (${data.export.tenants} tenant(s), ${data.export.skipped} skipped)` : `FAILED: ${data.export?.error ?? "?"}`}`, Boolean(data.export?.ok));
    await Promise.all([tlLoadEnrollments(), tlLoadRegistry()]);
  });

  async function tlLoadRegistry() {
    const fresh = root.querySelector("#tl-fresh");
    const empty = root.querySelector("#tl-empty");
    const wrap = root.querySelector("#tl-table-wrap");
    empty.textContent = "loading…";
    wrap.classList.add("gws-hidden");
    let res, body;
    try {
      res = await fetch("/admin/tenant-loop/registry");
      body = await res.json().catch(() => ({}));
    } catch (err) {
      empty.textContent = `⚠ ${err.message}`;
      return;
    }
    if (tlDisabled(body)) return;
    if (!res.ok) { empty.textContent = tlErrText(res, body); return; }
    const reg = body.registry ?? {};
    const rows = Array.isArray(reg.tenants) ? reg.tenants : [];
    const written = reg.writtenAt ? new Date(reg.writtenAt) : null;
    const ageH = written ? (Date.now() - written.getTime()) / 3_600_000 : null;
    // §4.5: the workspace reader fails closed on an export older than 24h — say so here.
    const stale = ageH !== null && ageH >= 24;
    fresh.innerHTML = `source: ${esc(String(body.source ?? "?"))} · written ${written ? esc(written.toISOString().slice(0, 16).replace("T", " ")) + " UTC" : "?"} · ` +
      (ageH === null
        ? `<span class="tlStale">no timestamp</span>`
        : `<span class="${stale ? "tlStale" : "tlFresh"}">${stale ? `stale — ${Math.round(ageH)}h old (readers fail closed past 24h)` : "fresh"}</span>`);
    if (rows.length === 0) {
      empty.textContent = "no covered tenants in the export — the gateway rewrites it after enrollment, membership or tenant changes; readers treat absence as zero tenants. Uncovered tenants never appear here: enroll their owner's group.";
      return;
    }
    empty.textContent = "";
    wrap.classList.remove("gws-hidden");
    // Covered tenants only (the resolver omits uncovered ones — fail-closed). Per-tenant
    // suspend/deregister are gone (410): status is driven by the enrollments above.
    root.querySelector("#tl-rows").innerHTML = rows.map((t) =>
      `<tr><td>${esc(String(t.id))}</td><td>${esc(String(t.principal))}</td><td>${esc(String(t.variant))}</td>` +
      `<td><span class="tlBadge ${esc(String(t.status))}">${esc(String(t.status))}</span></td>` +
      `<td>${scopesHtml(t.scopes)}</td><td>${windowsHtml(t.windows)}</td><td>${esc(String(t.gitRemote ?? ""))}</td>` +
      `<td style="white-space:nowrap;">` +
      `<button class="ghost" data-tl-upgrade="${esc(String(t.id))}">upgrade</button></td></tr>`).join("");
    for (const btn of root.querySelectorAll("[data-tl-upgrade]")) btn.addEventListener("click", () => tlUpgrade(btn.getAttribute("data-tl-upgrade")));
  }
  root.querySelector("#tl-refresh").addEventListener("click", () => tlLoadRegistry());

  async function tlUpgrade(tenantId) {
    tlNote("");
    let res, body;
    try {
      // Step 1 of 2: dry-run — the gateway returns the plan (§4.4); nothing executes.
      res = await tlPost(tenantId, "upgrade", {});
      body = await res.json().catch(() => ({}));
    } catch (err) {
      tlNote(`⚠ ${err.message}`);
      return;
    }
    if (tlDisabled(body)) return;
    if (!res.ok) { tlNote(tlErrText(res, body)); return; }
    // Step 2 gate: the Confirm call is only wired after a dry-run plan rendered for
    // THIS tenant (createUpgradeFlow refuses non-plan payloads and cross-tenant confirms).
    if (!tlUpgradeFlow.offerPlan(tenantId, body)) { tlNote("⚠ dry-run did not return a plan — upgrade refused"); return; }
    const wrap = showModal({ title: `Upgrade ${tenantId} — dry-run plan`, bodyHtml: `
      <div class="hint">Step 1 of 2 — nothing has executed yet. Confirming creates the snapshot branch and runs the upgrade engine with the allowlisted env.</div>
      <details open style="margin-top:6px;"><summary style="cursor:pointer;">plan JSON</summary><pre class="preview">${esc(JSON.stringify(body, null, 2))}</pre></details>
      <div class="formErr" id="tl-up-err" role="alert"></div>
      <div class="row"><span class="spacer"></span><button id="tl-up-cancel" type="button" class="ghost">Cancel</button><button id="tl-up-confirm">Confirm upgrade</button></div>` });
    wrap.querySelector("#tl-up-cancel").addEventListener("click", () => wrap.remove());
    wrap.querySelector("#tl-up-confirm").addEventListener("click", async () => {
      // Structural gate: no confirm without a prior plan render for THIS tenant.
      if (!tlUpgradeFlow.confirmAllowed(tenantId)) return;
      const go = wrap.querySelector("#tl-up-confirm");
      go.disabled = true;
      const err = wrap.querySelector("#tl-up-err");
      err.textContent = "running…";
      let res2, body2;
      try {
        res2 = await tlPost(tenantId, "upgrade", { confirm: true });
        body2 = await res2.json().catch(() => ({}));
      } catch (e) {
        err.textContent = `⚠ ${e.message}`;
        go.disabled = false;
        return;
      }
      if (tlDisabled(body2)) { wrap.remove(); return; }
      if (!res2.ok) { err.textContent = tlErrText(res2, body2); go.disabled = false; return; }
      tlUpgradeFlow.consume(tenantId);
      wrap.remove();
      const ok = body2.exitCode === 0;
      tlNote(`✔ upgrade exit ${body2.exitCode} — snapshot: ${body2.snapshot?.detail ?? "?"}` +
        (body2.stdoutTail ? `\nstdout tail: ${body2.stdoutTail}` : "") +
        (body2.stderrTail ? `\nstderr tail: ${body2.stderrTail}` : ""), ok);
      tlLoadRegistry();
    });
  }

  tlLoadEnrollments();
  tlLoadRegistry();
}
// ── end Tenant loop ──

// ── Audit log ──
const auditState = { actor: "", action: "", page: 1 };

async function renderAudit(_args, live) {
  const q = new URLSearchParams({ page: String(auditState.page), size: String(PAGE_SIZE) });
  if (auditState.actor) q.set("actor", auditState.actor);
  if (auditState.action) q.set("action", auditState.action);
  const { res, data } = await api(`/admin/audit?${q}`);
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`);
  paint(`
    <div class="toolbar">
      <input id="auActor" placeholder="actor (exact match)" value="${esc(auditState.actor)}" aria-label="Filter by actor" style="width:220px">
      <input id="auAction" placeholder="action prefix, e.g. user." value="${esc(auditState.action)}" aria-label="Filter by action prefix" style="width:240px">
      <button id="auApply" type="button">Apply</button>
      <button id="auReset" class="ghost" type="button">Reset</button>
    </div>
    <table>
      <thead><tr><th>When (UTC)</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
      <tbody>${(data.entries ?? []).map((e) => `<tr><td>${esc(String(e.at).replace("T", " ").slice(0, 19))}</td><td>${esc(e.actor)}</td><td>${esc(e.action)}</td><td>${esc(e.target ?? "")}</td><td>${esc(e.detail ?? "")}</td></tr>`).join("") ||
        '<tr><td colspan="5" class="hint">No entries match these filters</td></tr>'}</tbody>
    </table>
    ${pagerHtml(data.total ?? 0, data.page ?? 1, data.size ?? PAGE_SIZE)}`);
  const apply = () => {
    auditState.actor = view.querySelector("#auActor").value.trim();
    auditState.action = view.querySelector("#auAction").value.trim();
    auditState.page = 1;
    refresh();
  };
  view.querySelector("#auApply").addEventListener("click", apply);
  view.querySelector("#auActor").addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
  view.querySelector("#auAction").addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
  view.querySelector("#auReset").addEventListener("click", () => {
    auditState.actor = "";
    auditState.action = "";
    auditState.page = 1;
    refresh();
  });
  bindPager((page) => {
    auditState.page = page;
    refresh();
  });
}

// ── System: turn-config and mail outbox ──
async function renderSystem(_args, live) {
  const [turnRes, outboxRes] = await Promise.all([api("/admin/turn-config"), api("/admin/mail-outbox")]);
  if (!live()) return;
  const turn = turnRes.data;
  const turnHtml = turnRes.res.ok
    ? `<div class="card wide"><h3 style="margin-top:0">Turn runtime</h3>` +
      `<table class="kv"><tr><td>Runtime</td><td>${esc(turn.runtime)}</td></tr><tr><td>Provider</td><td>${esc(turn.provider)}</td></tr>` +
      `<tr><td>Model</td><td>${esc(turn.model ?? "—")}</td></tr><tr><td>Base URL</td><td>${esc(turn.baseUrl ?? "—")}</td></tr>` +
      `<tr><td>API key</td><td><code>${esc(turn.apiKeyMasked ?? "—")}</code></td></tr><tr><td>Extra args</td><td>${esc((turn.extraArgs ?? []).join(" ") || "—")}</td></tr>` +
      `<tr><td>Credential gap</td><td>${esc(turn.credentialGap ? JSON.stringify(turn.credentialGap) : "none")}</td></tr></table>` +
      `<h3>Change</h3><div class="hint">${esc(turn.note ?? "")}</div><br>` +
      `<div class="field">Runtime<select id="tcRuntime">${TURN_RUNTIMES.map((r) => option(r, r, turn.runtime)).join("")}</select></div>` +
      `<div class="field">Provider<input id="tcProvider" value="${esc(turn.provider === "none" ? "" : turn.provider)}" autocomplete="off"></div>` +
      `<div class="field">Model<input id="tcModel" value="${esc(turn.model ?? "")}" autocomplete="off"></div>` +
      `<div class="field">Base URL<input id="tcBaseUrl" value="${esc(turn.baseUrl ?? "")}" autocomplete="off"></div>` +
      `<div class="field">Extra args (space separated)<input id="tcExtra" value="${esc((turn.extraArgs ?? []).join(" "))}" autocomplete="off"></div>` +
      `<div class="field">New API key (leave blank to keep the current one)<input id="tcKey" type="password" placeholder="${esc(turn.apiKeyMasked ?? "")}" autocomplete="new-password"></div>` +
      `<div class="toolbar"><button id="tcSave" type="button">Save turn config…</button></div>` +
      `<div class="formErr" id="tcErr" role="alert"></div></div>`
    : `<div class="flash err">⚠ ${esc(errorText(turnRes.res, turn))}</div>`;
  const outbox = outboxRes.data.outbox ?? [];
  const outboxHtml = `<div class="card wide"><div class="toolbar"><h3 style="margin:0">Mail outbox (latest 20)</h3><span class="spacer"></span><button class="ghost" id="moRefresh" type="button">Refresh</button></div>` +
    (outboxRes.res.ok
      ? (outbox.map((m) => `<details style="margin-bottom:6px;"><summary style="cursor:pointer;"><code>${esc(m.file)}</code></summary><pre class="preview">${esc(m.content)}</pre></details>`).join("") ||
        '<div class="hint">outbox is empty</div>')
      : `<div class="flash err">⚠ ${esc(errorText(outboxRes.res, outboxRes.data))}</div>`) +
    `</div>`;
  paint(turnHtml + outboxHtml);

  view.querySelector("#moRefresh").addEventListener("click", () => refresh());
  const saveBtn = view.querySelector("#tcSave");
  if (!saveBtn) return;
  saveBtn.addEventListener("click", async () => {
    const err = view.querySelector("#tcErr");
    err.textContent = "";
    const current = {
      runtime: turn.runtime,
      provider: turn.provider === "none" ? "" : turn.provider ?? "",
      model: turn.model ?? "",
      baseUrl: turn.baseUrl ?? "",
      extraArgs: (turn.extraArgs ?? []).join(" "),
    };
    const next = {
      runtime: view.querySelector("#tcRuntime").value,
      provider: view.querySelector("#tcProvider").value.trim(),
      model: view.querySelector("#tcModel").value.trim(),
      baseUrl: view.querySelector("#tcBaseUrl").value.trim(),
      extraArgs: view.querySelector("#tcExtra").value.trim(),
    };
    const patch = {};
    for (const key of Object.keys(next)) if (next[key] !== current[key]) patch[key] = next[key];
    const key = view.querySelector("#tcKey").value;
    if (key) patch.apiKey = key;
    if (Object.keys(patch).length === 0) {
      err.textContent = "No changes to save.";
      return;
    }
    const password = await askPassword("Save turn config", "Credential and runtime changes apply to new turns immediately and persist across restarts.");
    if (password === null) return;
    const { res, data } = await api("/admin/turn-config", { method: "PUT", body: patch, password });
    if (!res.ok) {
      err.textContent = errorText(res, data);
      return;
    }
    const warn = data.warnings?.length ? ` Warnings: ${data.warnings.join("; ")}` : "";
    notify(`Applied: ${(data.applied ?? []).join(", ") || "no fields"}.${warn}`, !data.warnings?.length);
  });
}

route();
