#!/usr/bin/env bun
/**
 * verify-terms.ts — live drift check for k-ecos references/terms-ko.json.
 *
 * Skill-local asset (travels with the skill directory): imports only its
 * sibling ecos-fetch.ts and no workspace-root code. Runtime: bun (ADR-0036).
 *
 * Checks that table/item codes recorded in terms-ko.json still resolve against
 * the live API (StatisticItemList). Uses ≤10-row request windows so the public
 * `sample` demo key works; set $ECOS_API_KEY to page without that cap.
 *
 * Usage:
 *   bun verify-terms.ts [--include-unverified] [--file ../references/terms-ko.json]
 *
 * Exit code 0 = all checked entries PASS; 1 = at least one FAIL.
 */

import { join } from "node:path";
import { fetchEcos } from "./ecos-fetch.ts";

const DEFAULT_FILE = join(import.meta.dir, "..", "references", "terms-ko.json");
const WINDOW = 10; // sample-key cap
const MAX_WINDOWS_PER_TABLE = 20;

interface MapsTo {
  tableCode?: string;
  itemCode?: string;
  unit?: string;
  source?: string;
}
interface ItemEntry {
  en?: string;
  verified?: boolean;
  mapsTo?: MapsTo;
}
interface TableEntry {
  en?: string;
  verified?: boolean;
  mapsTo?: MapsTo;
  items?: Record<string, ItemEntry>;
}
interface TermsFile {
  version?: string;
  verified?: string;
  tables?: Record<string, TableEntry>;
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--include-unverified") args.includeUnverified = true;
    else if (argv[i] === "--file") args.file = argv[++i];
  }
  return args;
}

/** Does the table exist (and optionally contain itemCode)? Pages through the
 *  item list in ≤10-row windows because one table can list dozens of items. */
async function tableAndItemExist(
  key: string,
  tableCode: string,
  itemCode: string | undefined,
): Promise<{ found: boolean; total: number; checked: number }> {
  let seen = 0;
  let total = 0;
  for (let window = 0; window < MAX_WINDOWS_PER_TABLE; window++) {
    const startRow = window * WINDOW + 1;
    const res = await fetchEcos({
      key,
      service: "StatisticItemList",
      segments: [tableCode],
      startRow,
      maxRows: WINDOW,
    });
    if (!res.ok) throw new Error(`${res.code}: ${res.message}`);
    total = res.total;
    const itemCodes = res.rows.map((r) => r["ITEM_CODE"]).filter(Boolean) as string[];
    seen += itemCodes.length;
    if (itemCode === undefined) {
      if (total > 0) return { found: true, total, checked: seen };
    } else if (itemCodes.includes(itemCode)) {
      return { found: true, total, checked: seen };
    }
    if (seen >= total || res.rows.length === 0) break;
  }
  return { found: false, total, checked: seen };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const file = typeof args.file === "string" ? args.file : DEFAULT_FILE;
  const terms = JSON.parse(await Bun.file(file).text()) as TermsFile;
  const key = process.env.ECOS_API_KEY ?? "sample";
  const includeUnverified = args.includeUnverified === true;

  console.log(
    `verify-terms: ${file} (version ${terms.version ?? "?"}, file verified ${terms.verified ?? "?"})`,
  );
  console.log(`key: ${key === "sample" ? "sample (≤10 rows/request)" : "ECOS_API_KEY"}\n`);

  let pass = 0;
  let fail = 0;
  let skip = 0;

  for (const [tableName, entry] of Object.entries(terms.tables ?? {})) {
    const tableCode = entry.mapsTo?.tableCode;
    if (!tableCode) continue;
    if (entry.verified === false && !includeUnverified) {
      skip++;
      console.log(`SKIP  ${tableCode} ${tableName} (marked verified:false)`);
      continue;
    }
    try {
      const top = await tableAndItemExist(key, tableCode, undefined);
      if (!top.found) {
        fail++;
        console.log(`FAIL  ${tableCode} ${tableName} — table returned no rows`);
        continue;
      }
      const items = Object.entries(entry.items ?? {});
      let tableOk = true;
      for (const [itemName, item] of items) {
        const itemCode = item.mapsTo?.itemCode;
        if (!itemCode) continue;
        const probe = await tableAndItemExist(key, tableCode, itemCode);
        if (probe.found) {
          console.log(`PASS    item ${itemCode} ${itemName} (unit ${item.mapsTo?.unit ?? "?"})`);
        } else {
          tableOk = false;
          fail++;
          console.log(
            `FAIL    item ${itemCode} ${itemName} — not among ${probe.checked}/${probe.total} listed items`,
          );
        }
      }
      if (tableOk) {
        pass++;
        console.log(`PASS  ${tableCode} ${tableName} (${top.total} items)`);
      }
    } catch (err) {
      fail++;
      console.log(`FAIL  ${tableCode} ${tableName} — ${(err as Error).message}`);
    }
  }

  console.log(`\nsummary: ${pass} pass, ${fail} fail, ${skip} skipped`);
  if (fail === 0 && pass > 0) {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`all checks passed — consider refreshing "verified" in terms-ko.json to ${today}.`);
  }
  return fail > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(await main());
