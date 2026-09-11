#!/usr/bin/env bun
/**
 * ecos-fetch.ts — self-contained fetch client + CLI for the Bank of Korea ECOS Open API.
 *
 * Skill-local asset (travels with the k-ecos skill directory into L1/L3 copies):
 * intentionally imports NOTHING from the workspace root so it keeps working in
 * scaffolded projects. Runtime: bun (ADR-0036).
 *
 * Handles the pitfalls documented in SKILL.md:
 *  - Korean path segments (용어/데이터명) percent-encoded per segment
 *  - 1-based row-range pagination (요청시작건수/요청종료건수) via --max
 *  - exponential backoff on ERROR-602 (rate limit) and HTTP 5xx (3 attempts)
 *  - error-envelope normalization: {"RESULT":{CODE,MESSAGE}} -> {ok:false,...}
 *
 * Usage:
 *   bun ecos-fetch.ts --service StatisticSearch --table 722Y001 --cycle M \
 *     --from 202401 --to 202412 [--items 0101000] [--lang kr] [--format json|md] [--max 1000]
 *   bun ecos-fetch.ts --service KeyStatisticList [--max 101]
 *   bun ecos-fetch.ts --service StatisticTableList [--table 722Y001]
 *   bun ecos-fetch.ts --service StatisticItemList --table 722Y001
 *   bun ecos-fetch.ts --service StatisticWord --term 소비자동향지수
 *   bun ecos-fetch.ts --service StatisticMeta --data 경제심리지수
 *
 * Key resolution: --sample (public demo key, ≤10 rows/request) | $ECOS_API_KEY.
 */

const BASE = "https://ecos.bok.or.kr/api";
const SAMPLE_KEY = "sample";
const WINDOW_SIZE = 1000; // rows per request when paging with a personal key
// Sample-key cap is (요청종료건수 - 요청시작건수) < 10, i.e. ≤10 rows per window
// starting at ≥1 — verified live 2026-09-11 (1/10, 11/20 pass; 0/10 fails).
const SAMPLE_WINDOW_SIZE = 10;
const MAX_ATTEMPTS = 3;
const RETRYABLE_CODES = new Set(["ERROR-602", "ERROR-400"]);

interface EcosSuccess {
  ok: true;
  service: string;
  total: number;
  rows: Record<string, string | null>[];
  notice?: string;
}
interface EcosFailure {
  ok: false;
  code: string;
  message: string;
}
export type EcosResult = EcosSuccess | EcosFailure;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function enc(segment: string): string {
  // Korean path segments (용어, 데이터명) must be percent-encoded; literal
  // UTF-8 in the path was observed to 404 (see SKILL.md Response Policy).
  return encodeURIComponent(segment);
}

function isRetryable(code: string | undefined, httpStatus: number): boolean {
  return httpStatus >= 500 || (code !== undefined && RETRYABLE_CODES.has(code));
}

/** Fetch one positional-path request; returns parsed JSON or a normalized failure. */
async function requestOnce(url: string): Promise<{ status: number; body: unknown } | EcosFailure> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { accept: "application/json" } });
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        return { ok: false, code: "NETWORK", message: `fetch failed: ${(err as Error).message}` };
      }
      await sleep(2 ** attempt * 500);
      continue;
    }
    if (isRetryable(undefined, res.status) && attempt < MAX_ATTEMPTS) {
      await sleep(2 ** attempt * 500);
      continue;
    }
    const text = await res.text();
    try {
      return { status: res.status, body: JSON.parse(text) };
    } catch {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(2 ** attempt * 500);
        continue;
      }
      return {
        ok: false,
        code: `HTTP-${res.status}`,
        message: `non-JSON response: ${text.slice(0, 200)}`,
      };
    }
  }
  return { ok: false, code: "NETWORK", message: "unreachable" }; // unreachable
}

function normalize(
  service: string,
  body: unknown,
): { rows: Record<string, string | null>[]; total: number; notice?: string } | EcosFailure {
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    const result = obj.RESULT as { CODE?: string; MESSAGE?: string } | undefined;
    const envelope = obj[service] as
      | { list_total_count?: number; row?: Record<string, string | null>[] }
      | undefined;
    if (result && !envelope) {
      const code = result.CODE ?? "UNKNOWN";
      if (code.startsWith("INFO")) {
        // e.g. INFO-200 해당하는 데이터가 없습니다 — legitimate empty result
        return { rows: [], total: 0, notice: `${code} ${result.MESSAGE ?? ""}`.trim() };
      }
      return { ok: false, code, message: result.MESSAGE ?? "unspecified API error" };
    }
    if (envelope) {
      return {
        rows: envelope.row ?? [],
        total: envelope.list_total_count ?? (envelope.row?.length ?? 0),
      };
    }
  }
  return { ok: false, code: "UNPARSABLE", message: "response matched neither success nor error envelope" };
}

export interface FetchOptions {
  key: string;
  service: string;
  lang?: "kr" | "en";
  /** Extra positional path segments after {service}/{key}/{format}/{lang}. */
  segments: string[];
  /** Fetch at most this many rows across paginated windows (default 1000). */
  maxRows?: number;
  /** 1-based row to start from (default 1) — lets callers page manually. */
  startRow?: number;
  format?: "json" | "xml";
}

/** Fetch one ECOS service, auto-paginating the row range. */
export async function fetchEcos(opts: FetchOptions): Promise<EcosResult> {
  const { key, service, segments, maxRows = 1000, lang = "kr", format = "json", startRow = 1 } = opts;
  const windowSize = key === SAMPLE_KEY ? SAMPLE_WINDOW_SIZE : WINDOW_SIZE;
  const all: Record<string, string | null>[] = [];
  let total = 0;
  let notice: string | undefined;
  let cursor = startRow - 1;

  for (;;) {
    const remaining = maxRows - all.length;
    if (remaining <= 0) break;
    const end = cursor + Math.min(windowSize, remaining);
    const url = `${BASE}/${enc(service)}/${enc(key)}/${format}/${lang}/${cursor + 1}/${end}${segments.map((s) => "/" + enc(s)).join("")}`;
    const res = await requestOnce(url);
    if ("ok" in res) return res;
    const page = normalize(service, res.body);
    if ("ok" in page) return page;
    total = page.total;
    notice = page.notice;
    all.push(...page.rows);
    if (all.length >= total || page.rows.length === 0) break;
    // Advance by rows actually received (the server may cap a window, e.g. the
    // 10-row sample-key limit), keeping the window absolute-positioned.
    cursor += page.rows.length;
  }
  return { ok: true, service, total, rows: all, notice };
}

// ---------------------------------------------------------------- CLI ----

function usage(): never {
  console.error(`Usage: bun ecos-fetch.ts --service <name> [options]

Services & required options:
  StatisticSearch    --table <code> --cycle <A|S|Q|M|SM|D> --from <date> --to <date> [--items c1,c2,c3,c4]
  KeyStatisticList   (none)
  StatisticTableList [--table <code>]
  StatisticItemList  --table <code>
  StatisticWord      --term <한국어 용어>
  StatisticMeta      --data <한국어 데이터명>

Common options:
  --lang kr|en      response language (default kr)
  --format json|md  output format (default json)
  --max <n>         fetch at most n rows (default 1000)
  --sample          use the public demo key (≤10 rows/request) instead of $ECOS_API_KEY`);
  process.exit(2);
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) usage();
    const key = a.slice(2);
    if (key === "sample" || key === "help") {
      args[key] = true;
    } else {
      const val = argv[++i];
      if (val === undefined) usage();
      args[key] = val;
    }
  }
  return args;
}

function toMd(rows: Record<string, string | null>[]): string {
  if (rows.length === 0) return "_no rows_\n";
  const cols = [
    "TIME",
    ...Array.from({ length: 4 }, (_, i) => `ITEM_NAME${i + 1}`).filter((c) => c in rows[0]),
    "DATA_VALUE",
    "UNIT_NAME",
  ].filter((c) => c in rows[0]);
  const head = `| ${cols.join(" | ")} |`;
  const rule = `|${cols.map(() => "---").join("|")}|`;
  const body = rows
    .map((r) => `| ${cols.map((c) => r[c] ?? "").join(" | ")} |`)
    .join("\n");
  return `${head}\n${rule}\n${body}\n`;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage();
  const service = String(args.service ?? "");
  if (!service) usage();
  const key = args.sample === true ? SAMPLE_KEY : process.env.ECOS_API_KEY;
  if (!key) {
    console.error("ECOS_API_KEY is not set (or pass --sample for the ≤10-row demo key).");
    return 1;
  }
  const lang = args.lang === "en" ? "en" : "kr";
  const format = args.format === "md" ? "json" : (args.format as "json" | "xml") ?? "json";
  const segments: string[] = [];
  switch (service) {
    case "StatisticSearch": {
      for (const k of ["table", "cycle", "from", "to"] as const) {
        if (typeof args[k] !== "string") usage();
      }
      segments.push(String(args.table), String(args.cycle), String(args.from), String(args.to));
      if (typeof args.items === "string") {
        segments.push(...args.items.split(",").map((s) => s.trim()).filter(Boolean));
      }
      break;
    }
    case "StatisticItemList":
    case "StatisticTableList":
      if (typeof args.table === "string") segments.push(String(args.table));
      break;
    case "StatisticWord":
      if (typeof args.term !== "string") usage();
      segments.push(String(args.term));
      break;
    case "StatisticMeta":
      if (typeof args.data !== "string") usage();
      segments.push(String(args.data));
      break;
    case "KeyStatisticList":
      break;
    default:
      console.error(`unknown service: ${service}`);
      return 1;
  }
  const result = await fetchEcos({
    key,
    service,
    lang,
    segments,
    maxRows: typeof args.max === "string" ? Number(args.max) : 1000,
    format,
  });
  if (!result.ok) {
    console.error(`${result.code}: ${result.message}`);
    return 1;
  }
  if (result.notice) console.error(`notice: ${result.notice}`);
  if (args.format === "md") {
    process.stdout.write(toMd(result.rows));
  } else {
    process.stdout.write(
      `${JSON.stringify({ service: result.service, list_total_count: result.total, row: result.rows }, null, 2)}\n`,
    );
  }
  return 0;
}

if (import.meta.main) process.exit(await main());
