/** Helpers shared by the admin route modules: bulk parsing and per-item results, bounded CSV
 * read/parse/write, and the self-lockout / last-admin guard (design §8.1, §10). */

import type { GatewayState } from "../../state";
import type { UserRecord } from "../../users";
import { HttpError } from "../../http";

export const BULK_MAX_IDS = 500;
export const MEMBER_MAX = 500;
export const CSV_MAX_BYTES = 1024 * 1024;
export const CSV_MAX_ROWS = 2000;
/** Non-dry-run imports create accounts and hash every temp password, so they take a smaller cap
 * (2026-11-09 review M5). The dry run validates up to CSV_MAX_ROWS and writes nothing. */
export const CSV_IMPORT_MAX_ROWS = 200;
export const PAGE_SIZE_MAX = 200;

export interface BulkFailure {
  id: string;
  error: string;
}

export interface BulkOutcome {
  ok: number;
  failed: BulkFailure[];
}

/** Validate a bulk `ids` array: non-empty strings, deduplicated, at most BULK_MAX_IDS. */
export function parseBulkIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && v.trim() !== "")) {
    throw new HttpError(400, "invalid_request");
  }
  const unique = [...new Set((value as string[]).map((v) => v.trim()))];
  if (unique.length > BULK_MAX_IDS) throw new HttpError(413, "payload_too_large");
  return unique;
}

/** Validate a member batch (principals) the same way as bulk ids, with the member limit. */
export function parsePrincipals(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && v.trim() !== "")) {
    throw new HttpError(400, "invalid_request");
  }
  const unique = [...new Set((value as string[]).map((v) => v.trim()))];
  if (unique.length > MEMBER_MAX) throw new HttpError(413, "payload_too_large");
  return unique;
}

/** A requested reference resolves by user id first, then by principal. Deleted users are not
 * resolvable (findById/findByPrincipal exclude them). */
export function resolveUserRef(state: GatewayState, ref: string): UserRecord | null {
  return state.users.findById(ref) ?? state.users.findByPrincipal(ref);
}

/** Read a request body as text, refusing anything over the byte limit (declared or actual). */
export async function readBoundedText(req: Request, maxBytes = CSV_MAX_BYTES): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new HttpError(413, "payload_too_large");
  const buffer = await req.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new HttpError(413, "payload_too_large");
  return new TextDecoder().decode(buffer);
}

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF rows; blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += ch === "\r" && s[i + 1] === "\n" ? 2 : 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (quoted) throw new HttpError(400, "invalid_request");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Characters that spreadsheet apps read as a formula when a cell starts with them. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function isFormulaLead(value: string): boolean {
  return FORMULA_LEAD.test(value);
}

/** CSV cell for export: formula-leading values get a `'` prefix (CSV injection guard), and
 * cells holding separators, quotes, or newlines are quoted with doubled inner quotes. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (isFormulaLead(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type LockoutAction = "suspend" | "delete" | "demote";

export interface LockoutItem {
  ref: string;
  user: UserRecord;
}

/** Per-item guard for actions that could lock the console out (design §10):
 * - the caller cannot target themselves → `self_lockout`;
 * - the batch cannot drop the active-admin count to zero → every admin target in the batch
 *   is rejected with `last_admin`, so a partial batch never leaves the system without an admin. */
export function guardAdminTargets(
  state: GatewayState,
  caller: UserRecord,
  items: LockoutItem[],
  action: LockoutAction,
): { allowed: LockoutItem[]; failed: BulkFailure[] } {
  const failed: BulkFailure[] = [];
  const others: LockoutItem[] = [];
  for (const item of items) {
    if (item.user.id === caller.id) failed.push({ id: item.ref, error: "self_lockout" });
    else others.push(item);
  }
  const losing = others.filter((item) => losesAdmin(item.user, action));
  const remaining = state.users.countActiveAdmins() - losing.length;
  if (losing.length > 0 && remaining < 1) {
    for (const item of losing) failed.push({ id: item.ref, error: "last_admin" });
    return { allowed: others.filter((item) => !losing.includes(item)), failed };
  }
  return { allowed: others, failed };
}

function losesAdmin(user: UserRecord, action: LockoutAction): boolean {
  if (user.role !== "admin") return false;
  if (action === "suspend") return !user.disabledAt;
  return true;
}
