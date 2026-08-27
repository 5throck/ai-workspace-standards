#!/usr/bin/env bun
// @version 1.0.2 (2026-08-26: stopped writing source_mcp — the mcp_kr_legislation
//   MCP server was removed; source_verification (method: k-law-live) is the
//   sole provenance field for v2 output.)
// Migrate regulations/KR/*.yaml from v1 (content-cache) to v2 (coordinate-registry) schema.
// Uses 법제처 Open API (lawSearch.do + lawService.do) for live article discovery.
// Requires LAW_API_OC env var (auto-loaded from .env by Bun).

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

const BASE_URL = 'https://www.law.go.kr/DRF/';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function log(msg: string) { console.log(msg); }
function info(msg: string) { log(`${CYAN}[INFO]${RESET} ${msg}`); }
function ok(msg: string) { log(`${GREEN}[OK]${RESET} ${msg}`); }
function warn(msg: string) { log(`${YELLOW}[WARN]${RESET} ${msg}`); }
function fail(msg: string) { log(`${RED}[FAIL]${RESET} ${msg}`); }

function today() { return new Date().toISOString().slice(0, 10); }
function in180Days() {
  const d = new Date();
  d.setDate(d.getDate() + 180);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let writeFlag = false;
  let outDir = '';
  let oc = process.env.LAW_API_OC || '';
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') { writeFlag = true; }
    else if (a === '--out' && i + 1 < argv.length) { outDir = argv[++i]; }
    else if (a === '--oc' && i + 1 < argv.length) { oc = argv[++i]; }
    else if (!a.startsWith('--')) { positional.push(a); }
  }
  return { file: positional[0], writeFlag, outDir, oc };
}

async function fetchJson(url: string): Promise<any> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return resp.json();
}

async function fetchWithRetry(baseUrl: string, params: Record<string, string>): Promise<any> {
  const url = new URL(baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    return await fetchJson(url.toString());
  } catch (e) {
    warn(`JSON fetch failed (${(e as Error).message}), retrying with XML...`);
    const xmlUrl = new URL(baseUrl);
    for (const [k, v] of Object.entries(params)) xmlUrl.searchParams.set(k, v === 'JSON' ? 'XML' : v);
    const resp = await fetch(xmlUrl.toString());
    if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${xmlUrl.toString()}`);
    const text = await resp.text();
    throw new Error(`XML fallback returned non-JSON. Raw length: ${text.length}. Original error: ${(e as Error).message}`);
  }
}

interface SearchResult {
  법령일련번호: string;
  법령ID: string;
  법령명한글: string;
  법령약칭명: string;
  법령구분명: string;
  소관부처명: string;
}

interface ArticleEntry {
  조문번호: string;
  조문제목: string;
  조문여부: string;
}

function extractLawName(data: any): string | null {
  if (data.primary_law?.name_ko) return data.primary_law.name_ko;
  if (data.law_name) return data.law_name;
  if (data.title_ko) return data.title_ko;
  return null;
}

function extractArticlesFromV1(data: any): { no: string; topic_ko: string }[] {
  const arts: { no: string; topic_ko: string }[] = [];
  if (data.primary_law?.articles) {
    for (const a of data.primary_law.articles) {
      if (a.article) arts.push({ no: a.article, topic_ko: a.topic_ko || '' });
    }
  }
  if (data.key_articles) {
    for (const a of data.key_articles) {
      if (a.article) arts.push({ no: a.article, topic_ko: a.topic_ko || '' });
    }
  }
  return arts;
}

function extractPreserveFields(data: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (data.abbreviation && typeof data.abbreviation === 'string') out.abbreviation = data.abbreviation;
  if (data.agency && typeof data.agency === 'string') out.agency = data.agency;
  if (data.regulator && typeof data.regulator === 'string') out.regulator = data.regulator;
  if (data.tier && typeof data.tier === 'number') out.tier = data.tier;
  if (data.framework && typeof data.framework === 'string') out.framework = data.framework;
  if (data.related_rule && typeof data.related_rule === 'object' && !Array.isArray(data.related_rule)) {
    out.related_rule = data.related_rule;
  }
  if (data.domain_sub_variants && Array.isArray(data.domain_sub_variants)) {
    out.domain_sub_variants = data.domain_sub_variants;
  }
  if (data.related_decree && typeof data.related_decree === 'object' && !Array.isArray(data.related_decree)) {
    out.related_decree = data.related_decree;
  }
  if (data.structure_note && typeof data.structure_note === 'string') {
    out.structure_note = data.structure_note;
  }
  return out;
}

async function lawSearch(oc: string, query: string): Promise<SearchResult | null> {
  const data = await fetchWithRetry(`${BASE_URL}lawSearch.do`, {
    OC: oc, target: 'law', type: 'JSON', query, display: '5',
  });
  const wrapper = data.LawSearch;
  if (!wrapper || wrapper.totalCnt === '0' || !wrapper.law) return null;
  const law = Array.isArray(wrapper.law) ? wrapper.law[0] : wrapper.law;
  return law as SearchResult;
}

async function lawDetail(oc: string, mst: string): Promise<ArticleEntry[]> {
  const data = await fetchWithRetry(`${BASE_URL}lawService.do`, {
    OC: oc, target: 'law', type: 'JSON', MST: mst,
  });
  const statute = data['법령'];
  if (!statute?.조문?.조문단위) return [];
  return (statute.조문.조문단위 as ArticleEntry[])
    .filter(e => e.조문여부 === '조문' && e.조문번호)
    .map(e => ({
      조문번호: e.조문번호,
      조문제목: e.조문제목 || '',
      조문여부: e.조문여부,
    }));
}

function parseArticleNo(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

function formatYaml(obj: any): string {
  return yaml.dump(obj, {
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
    indent: 2,
    sortKeys: false,
  });
}

function buildV2Output(opts: {
  lawName: string;
  mst: string;
  lawId: string;
  articles: ArticleEntry[];
  existing: any;
  date: string;
  framework: string;
}) {
  const { lawName, mst, lawId, articles, existing, date, framework } = opts;
  const preserved = extractPreserveFields(existing);

  const out: any = {
    schema_version: 2,
    mode: 'coordinates',
    jurisdiction: 'KR',
    framework: preserved.framework || framework,
    law_name: lawName,
    law_name_en: null,
    abbreviation: preserved.abbreviation || null,
    mst,
    enforced_from: null,
    agency: preserved.agency || null,
    tier: preserved.tier || 1,
  };

  if (preserved.regulator) out.regulator = preserved.regulator;

  out.articles = articles.map(a => ({
    no: parseArticleNo(a.조문번호),
    title: a.조문제목,
    checked_at: date,
  }));

  out.source_verification = {
    method: 'k-law-live',
    checked_at: date,
    next_review: in180Days(),
  };

  out.last_updated = date;

  if (preserved.related_rule) out.related_rule = preserved.related_rule;
  if (preserved.domain_sub_variants) out.domain_sub_variants = preserved.domain_sub_variants;
  if (preserved.related_decree) out.related_decree = preserved.related_decree;
  if (preserved.structure_note) out.structure_note = preserved.structure_note;

  return out;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.file) {
    fail('Usage: bun scripts/migrate-registry-to-coordinates.ts <file.yaml> [--write] [--out <dir>] [--oc <key>]');
    process.exit(1);
  }

  if (!args.oc) {
    fail('LAW_API_OC not set. Set env var or pass --oc <key>.');
    process.exit(1);
  }

  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) {
    fail(`File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = yaml.load(raw) as any;

  if (data?.schema_version === 2 && data?.mode === 'coordinates') {
    const artCount = data.articles?.length ?? 0;
    const mstStatus = data.mst ? `MST=${data.mst}` : 'MST=null (pending Phase 4 fill)';
    ok(`Already v2 (coordinates). ${artCount} articles, ${mstStatus}. Skipping.`);
    return;
  }

  const lawName = extractLawName(data);
  if (!lawName) {
    fail('Cannot extract law name from file. Need primary_law.name_ko, law_name, or title_ko.');
    process.exit(1);
  }

  info(`Law name: ${lawName}`);

  let searchResult = await lawSearch(args.oc, lawName);
  if (!searchResult) {
    const shortened = lawName.replace(/^(화학물질|고압가스|위험물)\s*/, '');
    if (shortened !== lawName) {
      warn(`No results for "${lawName}", retrying with "${shortened}"...`);
      searchResult = await lawSearch(args.oc, shortened);
    }
  }

  if (!searchResult) {
    fail(`No search results for "${lawName}". Aborting.`);
    process.exit(1);
  }

  const mst = searchResult.법령일련번호;
  const lawId = searchResult.법령ID;
  const apiLawName = searchResult.법령명한글;
  const apiAbbr = searchResult.법령약칭명 || '';
  const apiType = searchResult.법령구분명;

  ok(`Found: ${apiLawName} (${apiType}), MST=${mst}, ID=${lawId}`);

  await sleep(500);

  const articles = await lawDetail(args.oc, mst);
  info(`API returned ${articles.length} articles`);

  const existingArticles = extractArticlesFromV1(data);
  if (existingArticles.length > 0) {
    info(`Existing v1 file has ${existingArticles.length} article references`);
  }

  const frameworkGuess = path.basename(filePath, '.yaml');
  const v2 = buildV2Output({
    lawName: apiLawName,
    mst,
    lawId,
    articles,
    existing: data,
    date: today(),
    framework: frameworkGuess,
  });

  const header = [
    '# ── Registry schema v2 (mode: coordinates) ───────────────────────────────────',
    '# This file maps article numbers to official titles ONLY. Article content is',
    '# never cached here — fetch live from the 법제처 k-law API at point of use.',
    `# Migrated by migrate-registry-to-coordinates.ts on ${today()}`,
    '',
  ].join('\n');

  const yamlBody = formatYaml(v2);
  const fullOutput = header + yamlBody;

  const diffNotes: string[] = [];
  if (existingArticles.length > 0) {
    const v1Nos = new Set(existingArticles.map(a => a.no));
    const v2Nos = new Set(articles.map(a => parseArticleNo(a.조문번호)));
    const onlyInV1 = [...v1Nos].filter(n => !v2Nos.has(n));
    const onlyInV2 = [...v2Nos].filter(n => !v1Nos.has(n));
    if (onlyInV1.length) diffNotes.push(`Articles in v1 but NOT in API: ${onlyInV1.join(', ')}`);
    if (onlyInV2.length) diffNotes.push(`Articles in API but NOT in v1: ${onlyInV2.join(', ')} (expected — API has full statute)`);
  }

  if (args.writeFlag) {
    fs.writeFileSync(filePath, fullOutput, 'utf-8');
    ok(`Overwritten in-place: ${filePath}`);
  } else if (args.outDir) {
    const outPath = path.join(args.outDir, path.basename(filePath));
    fs.mkdirSync(args.outDir, { recursive: true });
    fs.writeFileSync(outPath, fullOutput, 'utf-8');
    ok(`Written to: ${outPath}`);
  } else {
    process.stdout.write(fullOutput);
  }

  log('');
  log('─── Summary ───');
  log(`  Law:       ${apiLawName} (${apiAbbr || 'no abbreviation'})`);
  log(`  MST:       ${mst}`);
  log(`  Type:      ${apiType}`);
  log(`  API arts:  ${articles.length}`);
  log(`  v1 refs:   ${existingArticles.length}`);
  if (diffNotes.length) {
    for (const n of diffNotes) info(`  ${n}`);
  }
  log(`  Output:    ${args.writeFlag ? 'in-place' : args.outDir ? path.join(args.outDir, path.basename(filePath)) : 'stdout'}`);
}

main().catch(e => {
  fail(`Fatal: ${(e as Error).message}`);
  process.exit(1);
});
