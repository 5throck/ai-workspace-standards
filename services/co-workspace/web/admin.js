/* Admin console (design 2026-11-09-gw-admin-console-design §9). Hash-routed panels over the
 * /admin API. Every non-GET request sends x-requested-with. Destructive actions re-confirm the
 * operator password: it is sent as x-admin-password for that one request and never stored. */

import {
  LOOP_SCOPE_KEYS,
  createUpgradeFlow,
  esc,
  prepareDonutSlices,
  validateLoopConfigJson,
  validateLoopWindowsClient,
  validateTenantId,
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
  loop_group_readonly: "Loop groups are managed in Tenant Loop",
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
  const generalGroups = usersState.groups.filter((g) => g.kind === "general");
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
      <select id="uGroup" aria-label="Filter by group">${[option("", "all groups", usersState.group), ...usersState.groups.map((g) => option(g.groupId, `${g.name} (${g.kind})`, usersState.group))].join("")}</select>
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
      <select id="bulkGroup" aria-label="General group">${generalGroups.length ? generalGroups.map((g) => option(g.groupId, g.name)).join("") : '<option value="">no general groups</option>'}</select>
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

/** Row drawer (design §9.3): details, groups, effective policy, owned tenants, and the
 * rename and reset-password actions kept from the old panel. */
async function openUserDrawer(id, live) {
  let user = usersState.rows.get(id);
  if (!user) {
    const { data } = await api("/admin/users?size=200");
    user = (data.users ?? []).find((u) => u.id === id);
  }
  if (!live()) return;
  if (!user) return flash("User not found in the current listing.");
  const enc = encodeURIComponent(user.id);
  const [policyRes, tenantsRes] = await Promise.all([
    api(`/admin/users/${enc}/effective-policy`),
    api(`/admin/tenants?owner=${encodeURIComponent(user.principal)}&size=200`),
  ]);
  if (!live()) return;
  const pol = policyRes.data ?? {};
  const tenants = tenantsRes.data?.tenants ?? [];
  const policyRows = POLICY_NUMERIC.map(([key, label]) => {
    const v = pol[key];
    return `<tr><td>${esc(label)}</td><td>${v ? fmtCount(v) : '<span class="hint">unlimited</span>'}</td><td class="hint">${esc((pol.sources?.[key] ?? []).join(", ") || "—")}</td></tr>`;
  }).join("") +
    `<tr><td>Allowed variants</td><td>${pol.allowedVariants ? esc(pol.allowedVariants.join(", ")) : '<span class="hint">any configured variant</span>'}</td><td class="hint">${esc((pol.sources?.allowedVariants ?? []).join(", ") || "—")}</td></tr>`;
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
    <h3>Effective policy</h3>
    <table><thead><tr><th>Limit</th><th>Value</th><th>Set by</th></tr></thead><tbody>${policyRows}</tbody></table>
    <h3>Owned tenants (${fmtCount(tenants.length)})</h3>
    ${tenants.length
      ? `<table><thead><tr><th>Tenant</th><th>Variant</th><th>Status</th><th class="num">Sessions</th></tr></thead><tbody>` +
        tenants.map((t) => `<tr><td>${esc(t.tenantId)}${t.name ? `<div class="hint">${esc(t.name)}</div>` : ""}</td><td>${esc(t.variant)}</td><td>${t.archivedAt ? badge("archived") : badge("active")}</td><td class="num">${fmtCount(t.sessions)}</td></tr>`).join("") +
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

// ── Groups ──
const groupsState = { kind: "", list: [] };

async function renderGroups(args, live) {
  if (args[0]) return renderGroupDetail(args[0], args[1] === "policy" ? "policy" : "members", live);
  const { res, data } = await api(`/admin/groups${groupsState.kind ? `?kind=${groupsState.kind}` : ""}`);
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`);
  groupsState.list = data.groups ?? [];
  paint(`
    <div class="toolbar">
      <select id="gKind" aria-label="Filter by kind">${[["", "all kinds"], ["general", "general"], ["loop", "loop"]].map(([v, l]) => option(v, l, groupsState.kind)).join("")}</select>
      <span class="spacer"></span>
      <button id="gNew" type="button">New group</button>
    </div>
    <table>
      <thead><tr><th>Name</th><th>Group id</th><th>Kind</th><th class="num">Members</th><th>Policy</th><th>Actions</th></tr></thead>
      <tbody>${groupsState.list.map((g) => {
        const loop = g.kind === "loop";
        const why = loop ? 'title="Loop groups are edited in Tenant Loop"' : "";
        const enc = encodeURIComponent(g.groupId);
        return `<tr><td>${esc(g.name)}${g.description ? `<div class="hint">${esc(g.description)}</div>` : ""}</td>` +
          `<td><code>${esc(g.groupId)}</code></td><td>${badge(g.kind, g.kind)}</td>` +
          `<td class="num">${fmtCount(g.memberCount)}</td><td>${policySummary(g.policy)}</td>` +
          `<td style="white-space:nowrap;"><a class="linkish" href="#/groups/${enc}/members">Members</a> · <a class="linkish" href="#/groups/${enc}/policy">Policy</a> · ` +
          `<button class="ghost" type="button" data-edit="${esc(g.groupId)}"${loop ? ` disabled ${why}` : ""}>Edit</button> ` +
          `<button class="danger" type="button" data-delete="${esc(g.groupId)}"${loop ? ` disabled ${why}` : ""}>Delete</button></td></tr>`;
      }).join("") || '<tr><td colspan="6" class="hint">No groups yet</td></tr>'}</tbody>
    </table>`);
  view.querySelector("#gKind").addEventListener("change", (e) => {
    groupsState.kind = e.target.value;
    refresh();
  });
  view.querySelector("#gNew").addEventListener("click", () => createGroupFlow());
  for (const btn of view.querySelectorAll("[data-edit]")) {
    btn.addEventListener("click", () => editGroupFlow(groupsState.list.find((g) => g.groupId === btn.dataset.edit)));
  }
  for (const btn of view.querySelectorAll("[data-delete]")) {
    btn.addEventListener("click", () => deleteGroupFlow(btn.dataset.delete));
  }
}

function policySummary(policy) {
  if (!policy) return '<span class="hint">—</span>';
  return Object.entries(policy)
    .map(([k, v]) => `<span class="chip">${esc(k)}=${esc(Array.isArray(v) ? v.join("|") : v)}</span>`)
    .join("");
}

async function createGroupFlow() {
  const v = await promptModal({
    title: "New group",
    fields: [
      { name: "groupId", label: "Group id (a-z, 0-9, hyphen; 2-40 chars)", placeholder: "team-a", required: true },
      { name: "name", label: "Name (1-80 chars)", required: true },
      { name: "description", label: "Description (optional, up to 500 chars)" },
    ],
    confirmLabel: "Create",
  });
  if (!v) return;
  const groupId = v.groupId.trim();
  const { res, data } = await api("/admin/groups", {
    method: "POST",
    body: { groupId, name: v.name.trim(), description: v.description.trim() || undefined },
  });
  if (!res.ok) return flash(errorText(res, data));
  notify(`Group ${groupId} created.`, true);
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
    "Every membership in this group is removed and the group's policy stops applying. The users are kept. This cannot be undone.",
  );
  if (password === null) return;
  const { res, data } = await api(`/admin/groups/${encodeURIComponent(groupId)}`, { method: "DELETE", password });
  if (!res.ok) return flash(errorText(res, data));
  notify(`Group ${groupId} deleted.`, true);
}

async function renderGroupDetail(groupId, tab, live) {
  const { res, data: group } = await api(`/admin/groups/${encodeURIComponent(groupId)}`);
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, group))}</div><a class="linkish" href="#/groups">← Groups</a>`);
  const variants = tab === "policy" ? await loadVariants() : [];
  if (!live()) return;
  const enc = encodeURIComponent(group.groupId);
  const members = group.members ?? [];
  const head = `<div class="toolbar"><a class="linkish" href="#/groups">← Groups</a><h2 style="margin:0">${esc(group.name)}</h2>${badge(group.kind, group.kind)}<span class="hint"><code>${esc(group.groupId)}</code></span></div>` +
    `<nav class="tabs"><a href="#/groups/${enc}/members" class="${tab === "members" ? "active" : ""}">Members (${fmtCount(members.length)})</a><a href="#/groups/${enc}/policy" class="${tab === "policy" ? "active" : ""}">Policy</a></nav>`;
  if (tab === "policy") {
    paint(head + policyFormHtml(group, variants));
    bindPolicyForm(group);
    return;
  }
  const isLoop = group.kind === "loop";
  paint(head + (isLoop
    ? `<div class="card"><div class="hint">Loop group membership is managed through the group loop config in Tenant Loop. Shown read-only here.</div></div>`
    : `<div class="card wide"><h3 style="margin-top:0">Add members</h3>` +
      `<div class="toolbar"><input id="gmSearch" type="search" placeholder="Search users by login ID or name" aria-label="Search users to add" style="width:300px"></div>` +
      `<div id="gmResults"></div>` +
      `<h3>Paste a list</h3><div class="hint">Login IDs separated by commas, spaces or new lines. Up to 500 per request.</div>` +
      `<textarea id="gmPaste" rows="4" spellcheck="false" aria-label="Login IDs to add"></textarea>` +
      `<div class="toolbar"><button id="gmPasteGo" type="button">Add pasted list</button></div></div>`) +
    `<h3>Members</h3>` +
    `<table><thead><tr><th>Login ID</th>${isLoop ? "" : "<th></th>"}</tr></thead><tbody>` +
    (members.map((p) => `<tr><td>${esc(p)}</td>${isLoop ? "" : `<td class="num"><button class="ghost" type="button" data-remove="${esc(p)}">Remove</button></td>`}</tr>`).join("") ||
      `<tr><td colspan="2" class="hint">No members yet</td></tr>`) +
    `</tbody></table>`);
  if (!isLoop) bindMembers(group, members);
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

function policyFormHtml(group, variants) {
  const p = group.policy ?? {};
  const restrict = Array.isArray(p.allowedVariants);
  return `<div class="card wide"><h3 style="margin-top:0">Policy</h3>` +
    `<div class="hint">Policies only tighten. A member's effective limit is the strictest of the gateway baseline and every group they belong to. Leave a field empty to leave it unset.</div><br>` +
    POLICY_NUMERIC.map(([key, label, hint]) =>
      `<div class="field"><label for="pol-${key}">${esc(label)} — ${esc(hint)}</label>` +
      `<input id="pol-${key}" type="number" min="1" step="1" value="${esc(p[key] ?? "")}" placeholder="not set" style="max-width:220px"></div>`).join("") +
    `<div class="field"><label class="betaPick"><input type="checkbox" id="pol-restrict"${restrict ? " checked" : ""}> Restrict provisioning to selected variants</label>` +
    `<div>${variants.map((v) => `<label class="betaPick"><input type="checkbox" data-variant value="${esc(v)}"${restrict && p.allowedVariants.includes(v) ? " checked" : ""}> ${esc(v)}</label>`).join("") || '<span class="hint">no variants reported</span>'}</div></div>` +
    `<div class="toolbar"><button id="pol-save" type="button">Save policy</button><button id="pol-clear" type="button" class="ghost">Clear policy</button></div>` +
    `<div class="formErr" id="pol-err" role="alert"></div></div>`;
}

function bindPolicyForm(group) {
  const enc = encodeURIComponent(group.groupId);
  const err = (msg) => {
    view.querySelector("#pol-err").textContent = `⚠ ${msg}`;
  };
  const save = async (policy) => {
    const password = await askPassword(`Save policy for ${group.groupId}`, "The limits apply to every member on their next request.");
    if (password === null) return;
    const { res, data } = await api(`/admin/groups/${enc}/policy`, { method: "PUT", body: policy, password });
    if (!res.ok) return err(errorText(res, data));
    notify(policy ? `Policy saved for ${group.groupId}.` : `Policy cleared for ${group.groupId}.`, true);
  };
  view.querySelector("#pol-save").addEventListener("click", () => {
    const body = {};
    for (const [key, label] of POLICY_NUMERIC) {
      const raw = view.querySelector(`#pol-${key}`).value.trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) return err(`${label} must be a positive whole number`);
      body[key] = n;
    }
    if (view.querySelector("#pol-restrict").checked) {
      const list = [...view.querySelectorAll("[data-variant]:checked")].map((c) => c.value);
      if (!list.length) return err("Select at least one variant, or turn the restriction off.");
      body.allowedVariants = list;
    }
    save(Object.keys(body).length ? body : null);
  });
  view.querySelector("#pol-clear").addEventListener("click", () => save(null));
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

// ── Policies (read-only matrix) ──
async function renderPolicies(_args, live) {
  const { res, data } = await api("/admin/groups");
  if (!live()) return;
  if (!res.ok) return paint(`<div class="flash err">⚠ ${esc(errorText(res, data))}</div>`);
  const groups = data.groups ?? [];
  paint(`
    <div class="hint">Read-only. Each group's limits, with the members' effective limit being the strictest across the groups they belong to and the gateway baseline. Edit a group's policy from Groups. The gateway baseline itself (the <code>CO_WORKSPACE_TENANT_*</code> values) is not exposed by this API.</div><br>
    <table>
      <thead><tr><th>Group</th><th>Kind</th>${POLICY_NUMERIC.map(([, label]) => `<th class="num">${esc(label)}</th>`).join("")}<th>Allowed variants</th></tr></thead>
      <tbody>${groups.map((g) => {
        const p = g.policy ?? {};
        return `<tr><td><a class="linkish" href="#/groups/${encodeURIComponent(g.groupId)}/policy">${esc(g.name)}</a> <span class="hint"><code>${esc(g.groupId)}</code></span></td>` +
          `<td>${badge(g.kind, g.kind)}</td>` +
          POLICY_NUMERIC.map(([key]) => `<td class="num">${p[key] ? fmtCount(p[key]) : '<span class="hint">—</span>'}</td>`).join("") +
          `<td>${Array.isArray(p.allowedVariants) ? esc(p.allowedVariants.join(", ")) : '<span class="hint">—</span>'}</td></tr>`;
      }).join("") || '<tr><td colspan="7" class="hint">No groups yet</td></tr>'}</tbody>
    </table>`);
}

// ── Tenant Loop (moved unchanged from web/index.html; the DOM root is now #tl-root) ──
function tenantLoopMarkup() {
  return `<div class="tlBanner gws-hidden" id="tl-banner" role="alert">Tenant loop is disabled via CO_WORKSPACE_TENANT_LOOP_DISABLED — every tenant-loop route answers 403 and the registry export marks every tenant suspended.</div>` +
    `<div id="tl-body" style="display:flex; flex-direction:column; gap:12px;">` +
    `<div class="card wide" id="tl-registry"><h2 style="display:flex; align-items:center; justify-content:space-between; gap:8px;">Gateway registry export` +
    `<button id="tl-refresh" type="button" class="ghost" style="font-size:.74rem;">↻ Refresh</button></h2>` +
    `<div class="hint" id="tl-fresh"></div><div class="hint" id="tl-empty" style="margin-top:6px;">loading…</div>` +
    `<div id="tl-table-wrap" class="gws-hidden" style="overflow-x:auto; margin-top:6px;">` +
    `<table><thead><tr><th>id</th><th>principal</th><th>variant</th><th>status</th><th>scopes</th><th>windows</th><th>git remote</th><th>actions</th></tr></thead><tbody id="tl-rows"></tbody></table></div></div>` +
    `<div class="card" id="tl-register"><h2>Register tenant</h2>` +
    `<div class="field"><label for="tl-reg-pick">Existing tenant (id · variant · owner)</label><select id="tl-reg-pick"><option value="">pick a tenant…</option></select></div>` +
    `<div class="hint" id="tl-reg-meta" style="min-height:1em;"></div>` +
    `<div class="field"><label for="tl-reg-id">Tenant id</label><input id="tl-reg-id" placeholder="gw-0123456789ab" autocomplete="off"></div>` +
    `<div class="field"><label for="tl-reg-group">Loop group (optional — default "default")</label><input id="tl-reg-group" placeholder="default" autocomplete="off"></div>` +
    `<div class="field">Scopes (per-tenant overrides — unset keys inherit the group defaults)` +
    `<label class="betaPick" style="margin-top:2px;"><input type="checkbox" id="tl-reg-scope-upgrade" style="width:auto"> upgrade</label>` +
    `<label class="betaPick"><input type="checkbox" id="tl-reg-scope-upstreamFile" style="width:auto"> upstreamFile</label>` +
    `<label class="betaPick"><input type="checkbox" id="tl-reg-scope-backportReview" style="width:auto"> backportReview</label>` +
    `<label class="betaPick"><input type="checkbox" id="tl-reg-scope-nightlyFleet" style="width:auto"> nightlyFleet</label></div>` +
    `<div class="field"><label for="tl-reg-tz">Window time zone (IANA)</label><input id="tl-reg-tz" value="Asia/Seoul" autocomplete="off"></div>` +
    `<div class="field">Window days (0 = Sunday)` +
    TL_DAY_NAMES.map((d, i) => `<label class="betaPick" style="display:inline-flex; margin-right:8px;"><input type="checkbox" id="tl-reg-day-${i}" checked style="width:auto"> ${d}</label>`).join("") +
    `</div>` +
    `<div class="field" style="flex-direction:row; gap:8px;"><span style="flex:1;"><label for="tl-reg-start">Start (HH:MM, inclusive)</label><input id="tl-reg-start" value="00:00" autocomplete="off"></span>` +
    `<span style="flex:1;"><label for="tl-reg-end">End (HH:MM, exclusive)</label><input id="tl-reg-end" value="23:59" autocomplete="off"></span></div>` +
    `<div class="field"><label for="tl-reg-remote">git remote (backup branch safety net)</label><select id="tl-reg-remote"><option value="local-only">local-only</option><option value="url">url</option></select></div>` +
    `<div class="field gws-hidden" id="tl-reg-url-row"><label for="tl-reg-url">Remote URL</label><input id="tl-reg-url" placeholder="https://git.example.team/team/project.git" autocomplete="off"></div>` +
    `<div style="display:flex; gap:8px; margin-top:8px;"><button id="tl-reg-submit" type="button">Register</button></div>` +
    `<div class="formErr" id="tl-reg-err" role="alert"></div></div>` +
    `<div class="card" id="tl-config"><h2>Group loop config</h2>` +
    `<div class="field"><label for="tl-config-json">loop_config JSON — group id, designatedUsers, scope/window defaults</label>` +
    `<textarea id="tl-config-json" rows="8" spellcheck="false"></textarea></div>` +
    `<div style="display:flex; gap:8px; margin-top:8px;">` +
    `<button id="tl-config-validate" type="button" class="ghost">Validate</button>` +
    `<button id="tl-config-save" type="button">Save to group</button></div>` +
    `<div class="formErr" id="tl-config-err" role="status"></div></div>` +
    `<div class="formErr" id="tl-status" role="status"></div></div>`;
}

function renderTenantLoop() {
  paint(`<div id="tl-root">${tenantLoopMarkup()}</div>`);
  const root = view.querySelector("#tl-root");
  // ── Tenant loop (design 2026-11-08-gw-tenant-loop-and-hardening-design §4, admin UI):
  // registry export preview, register/suspend/deregister, dry-run→confirm upgrade, and
  // the group loop-config editor. Kill switch first: ANY response carrying the typed
  // code "tenant_loop_disabled" (403) replaces the whole section with a persistent
  // banner — the forms cannot work while CO_WORKSPACE_TENANT_LOOP_DISABLED is set. ──
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

  // Server errors surface verbatim (message + typed code when present).
  function tlErrText(res, body) {
    return `⚠ ${body?.error ?? `HTTP ${res.status}`}${body?.code ? ` (${body.code})` : ""}`;
  }

  function tlScopesHtml(scopes) {
    const short = { upgrade: "upg", upstreamFile: "file", backportReview: "backport", nightlyFleet: "fleet" };
    return LOOP_SCOPE_KEYS.map((k) => {
      const on = scopes?.[k] === true;
      return `<span class="tlScope ${on ? "on" : "off"}" title="${esc(k)}: ${on ? "on" : "off"}">${short[k] ?? k} ${on ? "✓" : "✗"}</span>`;
    }).join("");
  }

  function tlWindowsHtml(w) {
    if (!w || typeof w !== "object") return "";
    const days = Array.isArray(w.days) ? w.days.map((d) => TL_DAY_NAMES[d] ?? d).join(",") : "?";
    return `${esc(String(w.tz ?? "?"))} · ${esc(days)} · ${esc(String(w.start ?? "?"))}–${esc(String(w.end ?? "?"))}`;
  }

  function tlPost(tenantId, op, bodyOut) {
    return fetch(`/admin/tenant-loop/tenants/${encodeURIComponent(tenantId)}/${op}`, { method: "POST", headers: authHeaders, body: JSON.stringify(bodyOut ?? {}) });
  }

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
      empty.textContent = "no registry export — the gateway writes it here after config changes; readers treat absence as zero tenants";
      return;
    }
    empty.textContent = "";
    wrap.classList.remove("gws-hidden");
    root.querySelector("#tl-rows").innerHTML = rows.map((t) =>
      `<tr><td>${esc(String(t.id))}</td><td>${esc(String(t.principal))}</td><td>${esc(String(t.variant))}</td>` +
      `<td><span class="tlBadge ${esc(String(t.status))}">${esc(String(t.status))}</span></td>` +
      `<td>${tlScopesHtml(t.scopes)}</td><td>${tlWindowsHtml(t.windows)}</td><td>${esc(String(t.gitRemote ?? ""))}</td>` +
      `<td style="white-space:nowrap;">` +
      `<button class="ghost" data-tl-suspend="${esc(String(t.id))}">suspend</button> ` +
      `<button class="danger" data-tl-dereg="${esc(String(t.id))}">deregister</button> ` +
      `<button class="ghost" data-tl-upgrade="${esc(String(t.id))}">upgrade</button></td></tr>`).join("");
    for (const btn of root.querySelectorAll("[data-tl-suspend]")) btn.addEventListener("click", () => tlSuspend(btn.getAttribute("data-tl-suspend")));
    for (const btn of root.querySelectorAll("[data-tl-dereg]")) btn.addEventListener("click", () => tlDeregister(btn.getAttribute("data-tl-dereg")));
    for (const btn of root.querySelectorAll("[data-tl-upgrade]")) btn.addEventListener("click", () => tlUpgrade(btn.getAttribute("data-tl-upgrade")));
  }
  root.querySelector("#tl-refresh").addEventListener("click", () => tlLoadRegistry());

  function tlSuspend(tenantId) {
    const wrap = showModal({ title: `Suspend ${tenantId}`, bodyHtml: `
      <div class="field">The registry export marks the tenant suspended — the gateway and every workspace reader treat it as out of the loop until it is re-registered. The tenant itself and its files are untouched.</div>
      <div class="formErr" id="tl-sus-err" role="alert"></div>
      <div class="row"><span class="spacer"></span><button id="tl-sus-cancel" type="button" class="ghost">Cancel</button><button id="tl-sus-go">Suspend</button></div>` });
    wrap.querySelector("#tl-sus-cancel").addEventListener("click", () => wrap.remove());
    wrap.querySelector("#tl-sus-go").addEventListener("click", async () => {
      const res = await tlPost(tenantId, "suspend");
      const body = await res.json().catch(() => ({}));
      if (tlDisabled(body)) { wrap.remove(); return; }
      if (!res.ok) { wrap.querySelector("#tl-sus-err").textContent = tlErrText(res, body); return; }
      wrap.remove();
      tlNote(`✔ ${tenantId} suspended`, true);
      tlLoadRegistry();
    });
  }

  function tlDeregister(tenantId) {
    const wrap = showModal({ title: `Deregister ${tenantId}`, bodyHtml: `
      <div class="field">This ends the tenant's loop participation (§4.4): its loop group, scope/window overrides and git remote are cleared from the gateway registry. The tenant itself, its project files and its chat history are kept.</div>
      <div class="formErr" id="tl-drg-err" role="alert"></div>
      <div class="row"><span class="spacer"></span><button id="tl-drg-cancel" type="button" class="ghost">Cancel</button><button id="tl-drg-go" class="danger">Deregister</button></div>` });
    wrap.querySelector("#tl-drg-cancel").addEventListener("click", () => wrap.remove());
    wrap.querySelector("#tl-drg-go").addEventListener("click", async () => {
      const res = await tlPost(tenantId, "deregister");
      const body = await res.json().catch(() => ({}));
      if (tlDisabled(body)) { wrap.remove(); return; }
      if (!res.ok) { wrap.querySelector("#tl-drg-err").textContent = tlErrText(res, body); return; }
      wrap.remove();
      tlNote(`✔ ${tenantId} deregistered — the tenant itself is kept`, true);
      tlLoadRegistry();
    });
  }

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

  // Register form. Tenant picker: a password-set admin sees ALL tenants (GET /tenants) —
  // picking one fills the id and shows variant · owner; manual entry stays possible.
  (async () => {
    const pick = root.querySelector("#tl-reg-pick");
    const meta = root.querySelector("#tl-reg-meta");
    try {
      const res = await fetch("/tenants");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = ((await res.json()).tenants ?? []).slice().reverse();
      pick.innerHTML = `<option value="">pick a tenant…</option>` +
        list.map((t) => `<option value="${esc(String(t.tenantId))}" data-variant="${esc(String(t.variant))}" data-owner="${esc(String(t.ownerPrincipal ?? "anonymous"))}">${esc(String(t.tenantId))} · ${esc(String(t.variant))} · ${esc(String(t.ownerPrincipal ?? "anonymous"))}</option>`).join("");
      pick.addEventListener("change", () => {
        const opt = pick.selectedOptions[0];
        root.querySelector("#tl-reg-id").value = pick.value;
        meta.textContent = opt?.dataset.variant ? `variant: ${opt.dataset.variant} · owner: ${opt.dataset.owner}` : "";
      });
    } catch {
      pick.innerHTML = `<option value="">tenant list unavailable — enter the id below</option>`;
    }
  })();

  root.querySelector("#tl-reg-remote").addEventListener("change", () => {
    root.querySelector("#tl-reg-url-row").classList.toggle("gws-hidden", root.querySelector("#tl-reg-remote").value !== "url");
  });

  root.querySelector("#tl-reg-submit").addEventListener("click", async () => {
    const err = root.querySelector("#tl-reg-err");
    err.textContent = "";
    const id = root.querySelector("#tl-reg-id").value.trim();
    const group = root.querySelector("#tl-reg-group").value.trim();
    const scopes = Object.fromEntries(LOOP_SCOPE_KEYS.map((k) => [k, root.querySelector(`#tl-reg-scope-${k}`).checked]));
    const windows = {
      tz: root.querySelector("#tl-reg-tz").value.trim(),
      days: TL_DAY_NAMES.map((_, i) => i).filter((i) => root.querySelector(`#tl-reg-day-${i}`).checked),
      start: root.querySelector("#tl-reg-start").value.trim(),
      end: root.querySelector("#tl-reg-end").value.trim(),
    };
    // Client-side validation mirrors the gateway's write-time rules (app-helpers.js,
    // unit-tested); the server re-validates authoritatively and its errors surface
    // verbatim in the form below.
    const idErr = validateTenantId(id);
    if (idErr) { err.textContent = `⚠ ${idErr}`; return; }
    const winErr = validateLoopWindowsClient(windows);
    if (winErr) { err.textContent = `⚠ ${winErr}`; return; }
    let gitRemote = "local-only";
    if (root.querySelector("#tl-reg-remote").value === "url") {
      gitRemote = root.querySelector("#tl-reg-url").value.trim();
      if (!gitRemote) { err.textContent = "⚠ a remote URL is required when git remote is 'url'"; return; }
    }
    err.textContent = "registering…";
    const res = await tlPost(id, "register", { scopes, windows, gitRemote, ...(group ? { group } : {}) });
    const body = await res.json().catch(() => ({}));
    if (tlDisabled(body)) return;
    if (!res.ok) { err.textContent = tlErrText(res, body); return; }
    err.textContent = "";
    tlNote(`✔ ${id} registered (group ${body.loopGroup ?? "?"}, export ${body.export?.ok ? `written, ${body.export.tenants} tenant(s)` : "FAILED"})`, true);
    tlLoadRegistry();
  });

  // Config editor: JSON textarea preflight-validated client-side, saved via
  // PUT /admin/tenant-loop/config (the server is authoritative; its validation errors
  // surface verbatim).
  const tlConfigTa = root.querySelector("#tl-config-json");
  tlConfigTa.value = JSON.stringify({
    group: "default",
    designatedUsers: [],
    scopes: { upgrade: false, upstreamFile: false, backportReview: false, nightlyFleet: false },
    windows: { tz: "Asia/Seoul", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
  }, null, 2);
  const tlConfigErr = root.querySelector("#tl-config-err");
  root.querySelector("#tl-config-validate").addEventListener("click", () => {
    tlConfigErr.style.color = "";
    const parsed = validateLoopConfigJson(tlConfigTa.value);
    tlConfigErr.textContent = parsed.ok ? "✔ JSON valid — fields check out (the server re-validates on save)" : `⚠ ${parsed.error}`;
    if (parsed.ok) tlConfigErr.style.color = "#3fb950";
  });
  root.querySelector("#tl-config-save").addEventListener("click", async () => {
    tlConfigErr.style.color = "";
    tlConfigErr.textContent = "";
    const parsed = validateLoopConfigJson(tlConfigTa.value);
    if (!parsed.ok) { tlConfigErr.textContent = `⚠ ${parsed.error}`; return; }
    tlConfigErr.textContent = "saving…";
    const res = await fetch("/admin/tenant-loop/config", { method: "PUT", headers: authHeaders, body: JSON.stringify(parsed.value) });
    const body = await res.json().catch(() => ({}));
    if (tlDisabled(body)) return;
    if (!res.ok) { tlConfigErr.textContent = tlErrText(res, body); return; }
    tlConfigErr.style.color = "#3fb950";
    tlConfigErr.textContent = `✔ group "${body.group?.groupId ?? "?"}" saved — export ${body.export?.ok ? `written (${body.export.tenants} tenant(s), ${body.export.skipped} skipped)` : `FAILED: ${body.export?.error ?? "?"}`}`;
    tlLoadRegistry();
  });

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
