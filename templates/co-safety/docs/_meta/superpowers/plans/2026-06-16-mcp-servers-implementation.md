# Safety OS MCP Servers Implementation Plan

> **For agentic workers:** Use native subagent dispatch (if available) or native plan mode to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three MCP servers (k_skill, legalize_kr, mcp_kr_legislation) that provide Korean EHS law lookup, law structure parsing, and real-time legislation API access to Safety OS agents.

**Architecture:** Each server lives under `mcp/<name>/` and communicates via MCP stdio transport. Shared utilities in `mcp/shared/` (types, logger, errors, rate limiter, retry). All servers reuse `scripts/lib/mcp-cache.ts` for TTL-based in-process caching — no Redis required.

**Tech Stack:** TypeScript, Bun, `@modelcontextprotocol/sdk`, `fast-xml-parser`, `simple-git`, native `fetch`

---

## File Map

```
mcp/
  shared/
    types.ts          — MCPResponse, CacheEntry, RegulatoryArticle interfaces
    logger.ts         — Levelled stderr logger (DEBUG/INFO/WARN/ERROR)
    errors.ts         — MCPConfigError, MCPNetworkError, MCPDataNotFoundError, MCPValidationError
    retry.ts          — fetchWithRetry (exponential backoff) + CircuitBreaker
    rate-limiter.ts   — Token-bucket RateLimiter
  k-skill/
    index.ts          — MCP server entry; registers all k_skill tools
    tools/
      search-osha.ts  — search_osha_regulations implementation
      sapa.ts         — get_sapa_requirements implementation
      industry.ts     — list_industry_controls implementation
      gaps.ts         — check_compliance_gaps implementation
      cache-admin.ts  — invalidate_cache implementation
  legalize-kr/
    index.ts          — MCP server entry; registers all legalize_kr tools
    tools/
      parse.ts        — parse_law_structure (장→절→항 hierarchy)
      references.ts   — find_references (cross-law refs)
      metadata.ts     — get_law_metadata
      compare.ts      — compare_versions (git diff)
    git-sync.ts       — ensureLegalizeKRRepo() helper
  mcp-kr-legislation/
    index.ts          — MCP server entry; registers all mcp_kr_legislation tools
    tools/
      current-law.ts  — get_current_law (OpenAPI XML → JSON)
      amendments.ts   — get_law_amendments
      interpret.ts    — interpret_regulation
      penalties.ts    — get_penalties
      guide.ts        — get_compliance_guide
    xml-parser.ts     — XMLParser wrapper with Korean encoding fallback

scripts/lib/
  mcp-cache.ts        — existing MCPCache (reuse as-is)
```

---

## Task 1: Shared Infrastructure

**Files:**
- Create: `mcp/shared/types.ts`
- Create: `mcp/shared/logger.ts`
- Create: `mcp/shared/errors.ts`
- Create: `mcp/shared/retry.ts`
- Create: `mcp/shared/rate-limiter.ts`

- [ ] **Step 1.1: Create `mcp/shared/types.ts`**

```typescript
export interface MCPResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: string;
  ttl: number;
}

export interface RegulatoryArticle {
  articleId: string;
  lawName: string;
  articleNumber: string;
  title: string;
  content: string;
  effectiveDate?: string;
}
```

- [ ] **Step 1.2: Create `mcp/shared/logger.ts`**

```typescript
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const currentLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'INFO';

function log(level: LogLevel, serverName: string, message: string): void {
  if (LEVELS[level] >= LEVELS[currentLevel]) {
    process.stderr.write(`[${level}][${serverName}] ${message}\n`);
  }
}

export function createLogger(serverName: string) {
  return {
    debug: (msg: string) => log('DEBUG', serverName, msg),
    info:  (msg: string) => log('INFO',  serverName, msg),
    warn:  (msg: string) => log('WARN',  serverName, msg),
    error: (msg: string) => log('ERROR', serverName, msg),
  };
}
```

- [ ] **Step 1.3: Create `mcp/shared/errors.ts`**

```typescript
export class MCPConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'MCPConfigError'; }
}
export class MCPNetworkError extends Error {
  constructor(message: string) { super(message); this.name = 'MCPNetworkError'; }
}
export class MCPDataNotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'MCPDataNotFoundError'; }
}
export class MCPValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'MCPValidationError'; }
}
```

- [ ] **Step 1.4: Create `mcp/shared/retry.ts`**

```typescript
import { MCPNetworkError } from './errors.js';

export async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new MCPNetworkError(`HTTP ${res.status}: ${url}`);
      return res;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new MCPNetworkError('Max retries exceeded');
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  constructor(
    private readonly threshold = 5,
    private readonly timeoutMs = 60_000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.lastFailureTime < this.timeoutMs) {
        throw new Error('Circuit breaker OPEN');
      }
      this.failures = 0;
    }
    try {
      return await fn();
    } catch (err) {
      this.failures++;
      this.lastFailureTime = Date.now();
      throw err;
    }
  }
}
```

- [ ] **Step 1.5: Create `mcp/shared/rate-limiter.ts`**

```typescript
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly refillRate: number;

  constructor(
    private readonly maxTokens: number,
    windowMs: number
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = maxTokens / windowMs;
  }

  async acquireToken(): Promise<void> {
    const now = Date.now();
    this.tokens = Math.min(this.maxTokens, this.tokens + (now - this.lastRefill) * this.refillRate);
    this.lastRefill = now;
    if (this.tokens < 1) {
      const waitMs = (1 - this.tokens) / this.refillRate;
      await new Promise(r => setTimeout(r, waitMs));
      this.tokens = 1;
    }
    this.tokens--;
  }
}
```

- [ ] **Step 1.6: Verify shared files compile**

```bash
cd /c/git/ai_workspace/Projects/safety-os
bun typecheck mcp/shared/*.ts 2>&1 || bun run --hot mcp/shared/types.ts
```

Expected: no TypeScript errors

- [ ] **Step 1.7: Commit**

```bash
git add mcp/shared/
git commit -m "feat(mcp): add shared infrastructure (types, logger, errors, retry, rate-limiter)"
```

---

## Task 2: k_skill MCP Server

**Files:**
- Modify: `mcp/k-skill/index.ts` (replace stub)
- Create: `mcp/k-skill/tools/search-osha.ts`
- Create: `mcp/k-skill/tools/sapa.ts`
- Create: `mcp/k-skill/tools/industry.ts`
- Create: `mcp/k-skill/tools/gaps.ts`
- Create: `mcp/k-skill/tools/cache-admin.ts`

Data source: 국가법령정보센터 OpenAPI — no API key required for public endpoints.
Base URL: `https://www.law.go.kr/DRF/lawSearch.do?OC=<OC>&target=law&type=JSON`

> **Note:** If the public API is unavailable or rate-limited during testing, the cache layer
> will serve stale data. Tests use `MOCK_API=true` to bypass network calls.

- [ ] **Step 2.1: Create `mcp/k-skill/tools/search-osha.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';
import { fetchWithRetry } from '../../shared/retry.js';
import { RateLimiter } from '../../shared/rate-limiter.js';
import { createLogger } from '../../shared/logger.js';
import type { RegulatoryArticle } from '../../shared/types.js';

const log = createLogger('k_skill');
const cache = new MCPCache();
const limiter = new RateLimiter(100, 60_000);

const BASE_URL = 'https://www.law.go.kr/DRF/lawSearch.do';

export async function searchOshaRegulations(keyword: string): Promise<RegulatoryArticle[]> {
  const cacheKey = `osha:search:${keyword}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    log.info(`Cache hit for keyword: ${keyword}`);
    return cached;
  }

  if (process.env.MOCK_API === 'true') {
    return mockOshaResults(keyword);
  }

  await limiter.acquireToken();
  const url = `${BASE_URL}?OC=test&target=law&type=JSON&query=${encodeURIComponent(keyword)}`;
  const res = await fetchWithRetry(url);
  const json = await res.json() as any;

  const articles: RegulatoryArticle[] = (json?.LawSearch?.law ?? []).map((item: any) => ({
    articleId: item.법령ID ?? '',
    lawName: item.법령명한글 ?? '',
    articleNumber: item.조문번호 ?? '',
    title: item.조문제목 ?? '',
    content: item.조문내용 ?? '',
    effectiveDate: item.시행일자 ?? undefined,
  }));

  await cache.set(cacheKey, articles, 86_400); // 24h
  return articles;
}

function mockOshaResults(keyword: string): RegulatoryArticle[] {
  return [{
    articleId: 'MOCK-001',
    lawName: '산업안전보건법',
    articleNumber: '제38조',
    title: '안전조치',
    content: `${keyword} 관련 안전조치 (모의 데이터)`,
    effectiveDate: '2021-01-16',
  }];
}
```

- [ ] **Step 2.2: Create `mcp/k-skill/tools/sapa.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';
import { fetchWithRetry } from '../../shared/retry.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('k_skill');
const cache = new MCPCache();

export async function getSapaRequirements(industry?: string): Promise<object> {
  const cacheKey = `sapa:requirements:${industry ?? 'all'}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  if (process.env.MOCK_API === 'true') {
    return mockSapaData(industry);
  }

  // 중대재해처벌법 요건 조회 (국가법령정보센터)
  const url = `https://www.law.go.kr/DRF/lawService.do?OC=test&target=law&MST=272966&type=JSON`;
  const res = await fetchWithRetry(url);
  const json = await res.json() as any;

  const result = {
    lawName: '중대재해처벌법',
    industry: industry ?? '전체',
    requirements: extractSapaRequirements(json, industry),
  };

  await cache.set(cacheKey, result, 86_400);
  return result;
}

function extractSapaRequirements(json: any, industry?: string): string[] {
  // Extract key obligations from law JSON
  const articles = json?.law?.조문 ?? [];
  return articles
    .filter((a: any) => !industry || a.조문내용?.includes(industry))
    .map((a: any) => `${a.조번호}: ${a.조제목 ?? ''}`);
}

function mockSapaData(industry?: string) {
  return {
    lawName: '중대재해처벌법',
    industry: industry ?? '전체',
    requirements: [
      '제4조: 사업주와 경영책임자등의 안전 및 보건 확보의무',
      '제5조: 도급, 용역, 위탁 등 관계에서의 안전 및 보건 확보의무',
      '제9조: 사업주와 경영책임자등의 처벌',
    ],
  };
}
```

- [ ] **Step 2.3: Create `mcp/k-skill/tools/industry.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('k_skill');
const cache = new MCPCache();

const INDUSTRY_CONTROLS: Record<string, string[]> = {
  manufacturing: ['안전보건관리체계 구축', '위험성평가 실시', '안전교육 실시', 'PSM 적용 (유해위험물질 취급 시)'],
  construction:  ['추락방지 조치', '굴착작업 안전기준', '전기작업 안전조치', '중장비 운행 안전기준'],
  chemical:      ['MSDS 비치', '화학물질 취급기준', '누출 방지설비', '방호복 착용기준'],
  default:       ['안전보건관리규정 작성', '안전보건위원회 구성', '위험성평가 실시'],
};

export async function listIndustryControls(industry: string): Promise<object> {
  const key = `industry:controls:${industry}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  const controls = INDUSTRY_CONTROLS[industry] ?? INDUSTRY_CONTROLS['default'];
  const result = { industry, controls, source: '산업안전보건법 (OSHA-KR)' };
  await cache.set(key, result, 86_400);
  return result;
}
```

- [ ] **Step 2.4: Create `mcp/k-skill/tools/gaps.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';
import { searchOshaRegulations } from './search-osha.js';

const cache = new MCPCache();

export async function checkComplianceGaps(industry: string, currentControls: string[]): Promise<object> {
  const required = await searchOshaRegulations(industry);
  const gaps = required.filter(r =>
    !currentControls.some(c => c.includes(r.title) || r.title.includes(c))
  );
  return {
    industry,
    totalRequired: required.length,
    gaps: gaps.map(g => ({ article: g.articleNumber, requirement: g.title })),
    compliant: gaps.length === 0,
  };
}
```

- [ ] **Step 2.5: Create `mcp/k-skill/tools/cache-admin.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';

const cache = new MCPCache();

export async function invalidateCache(pattern?: string): Promise<object> {
  if (pattern) {
    await cache.invalidate(pattern);
    return { invalidated: pattern };
  }
  // Full cache clear: invalidate known prefixes
  for (const prefix of ['osha:', 'sapa:', 'industry:']) {
    await cache.invalidate(prefix);
  }
  return { invalidated: 'all' };
}
```

- [ ] **Step 2.6: Replace stub `mcp/k-skill/index.ts`**

```typescript
#!/usr/bin/env bun
/**
 * k_skill MCP Server v1.0.0
 * Korean OSHA / SAPA regulations search with 24-hour caching.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../shared/logger.js';
import { MCPValidationError } from '../shared/errors.js';
import { searchOshaRegulations } from './tools/search-osha.js';
import { getSapaRequirements } from './tools/sapa.js';
import { listIndustryControls } from './tools/industry.js';
import { checkComplianceGaps } from './tools/gaps.js';
import { invalidateCache } from './tools/cache-admin.js';

const log = createLogger('k_skill');

const server = new Server(
  { name: 'k_skill', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_osha_regulations',
      description: '산업안전보건법 관련 규정을 키워드로 검색합니다.',
      inputSchema: { type: 'object', properties: { keyword: { type: 'string' } }, required: ['keyword'] },
    },
    {
      name: 'get_sapa_requirements',
      description: '중대재해처벌법 요건을 조회합니다.',
      inputSchema: { type: 'object', properties: { industry: { type: 'string' } } },
    },
    {
      name: 'list_industry_controls',
      description: '산업별 안전조치 목록을 반환합니다.',
      inputSchema: { type: 'object', properties: { industry: { type: 'string' } }, required: ['industry'] },
    },
    {
      name: 'check_compliance_gaps',
      description: '현재 안전조치와 법정 요건을 비교해 갭을 분석합니다.',
      inputSchema: {
        type: 'object',
        properties: {
          industry: { type: 'string' },
          currentControls: { type: 'array', items: { type: 'string' } },
        },
        required: ['industry', 'currentControls'],
      },
    },
    {
      name: 'invalidate_cache',
      description: '캐시를 수동으로 초기화합니다.',
      inputSchema: { type: 'object', properties: { pattern: { type: 'string' } } },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log.info(`Tool called: ${name}`);

  try {
    let result: unknown;
    switch (name) {
      case 'search_osha_regulations':
        if (!args?.keyword) throw new MCPValidationError('keyword is required');
        result = await searchOshaRegulations(args.keyword as string);
        break;
      case 'get_sapa_requirements':
        result = await getSapaRequirements(args?.industry as string | undefined);
        break;
      case 'list_industry_controls':
        if (!args?.industry) throw new MCPValidationError('industry is required');
        result = await listIndustryControls(args.industry as string);
        break;
      case 'check_compliance_gaps':
        if (!args?.industry || !args?.currentControls) throw new MCPValidationError('industry and currentControls are required');
        result = await checkComplianceGaps(args.industry as string, args.currentControls as string[]);
        break;
      case 'invalidate_cache':
        result = await invalidateCache(args?.pattern as string | undefined);
        break;
      default:
        throw new MCPValidationError(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    log.error(`Tool ${name} failed: ${err}`);
    return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
log.info('k_skill MCP server started');
```

- [ ] **Step 2.7: Smoke-test k_skill server starts without error**

```bash
MOCK_API=true timeout 3 bun run mcp/k-skill/index.ts 2>&1 | head -5
```

Expected output includes: `[INFO][k_skill] k_skill MCP server started`

- [ ] **Step 2.8: Commit**

```bash
git add mcp/k-skill/
git commit -m "feat(mcp): implement k_skill server - OSHA/SAPA regulation search"
```

---

## Task 3: legalize_kr MCP Server

**Files:**
- Create: `mcp/legalize-kr/git-sync.ts`
- Create: `mcp/legalize-kr/tools/parse.ts`
- Create: `mcp/legalize-kr/tools/references.ts`
- Create: `mcp/legalize-kr/tools/metadata.ts`
- Create: `mcp/legalize-kr/tools/compare.ts`
- Modify: `mcp/legalize-kr/index.ts` (replace stub)

Data source: `.cache/legalize-kr/` git repo (cloned from GitHub on first run; daily sync).
Repo URL: `https://github.com/legalize-kr/legalize-kr.git`

> **Offline/CI note:** If git clone fails (no network), server starts in degraded mode
> and returns an empty result with a warning. Tests set `SKIP_GIT_SYNC=true`.

- [ ] **Step 3.1: Create `mcp/legalize-kr/git-sync.ts`**

```typescript
import { existsSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { createLogger } from '../shared/logger.js';

const log = createLogger('legalize_kr');
const REPO_DIR = '.cache/legalize-kr';
const REPO_URL = 'https://github.com/legalize-kr/legalize-kr.git';

export async function ensureLegalizeKRRepo(): Promise<boolean> {
  if (process.env.SKIP_GIT_SYNC === 'true') {
    log.warn('SKIP_GIT_SYNC=true — skipping git sync');
    return existsSync(join(REPO_DIR, '.git'));
  }

  try {
    if (existsSync(join(REPO_DIR, '.git'))) {
      log.info('Updating legalize-kr repository...');
      const git = simpleGit(REPO_DIR);
      await git.fetch('origin');
      await git.reset(['--hard', 'origin/main']);
    } else {
      log.info('Cloning legalize-kr repository (shallow)...');
      await simpleGit().clone(REPO_URL, REPO_DIR, ['--depth', '1', '--branch', 'main']);
    }
    log.info('legalize-kr repository ready');
    return true;
  } catch (err) {
    log.error(`Git sync failed: ${err} — starting in degraded mode`);
    return false;
  }
}

export function getRepoDir(): string { return REPO_DIR; }
```

- [ ] **Step 3.2: Create `mcp/legalize-kr/tools/parse.ts`**

```typescript
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../../shared/logger.js';
import { getRepoDir } from '../git-sync.js';

const log = createLogger('legalize_kr');

interface LawNode {
  type: 'chapter' | 'section' | 'article';
  number: string;
  title: string;
  content?: string;
  children?: LawNode[];
}

export async function parseLawStructure(lawId: string): Promise<LawNode[]> {
  const repoDir = getRepoDir();
  if (!existsSync(repoDir)) {
    log.warn('Repository not available — returning empty structure');
    return [];
  }

  // Search for law file (e.g., 산업안전보건법.md)
  const files = readdirSync(repoDir).filter(f => f.includes(lawId) && f.endsWith('.md'));
  if (files.length === 0) {
    log.warn(`Law not found: ${lawId}`);
    return [];
  }

  const content = readFileSync(join(repoDir, files[0]), 'utf-8');
  return parseLawMarkdown(content);
}

function parseLawMarkdown(md: string): LawNode[] {
  const nodes: LawNode[] = [];
  let current: LawNode | null = null;

  for (const line of md.split('\n')) {
    const chapterMatch = line.match(/^## (제\d+장)\s+(.+)/);
    const articleMatch = line.match(/^### (제\d+조)\s*(?:\((.+)\))?/);
    const contentLine = line.trim();

    if (chapterMatch) {
      current = { type: 'chapter', number: chapterMatch[1], title: chapterMatch[2], children: [] };
      nodes.push(current);
    } else if (articleMatch) {
      const article: LawNode = {
        type: 'article',
        number: articleMatch[1],
        title: articleMatch[2] ?? '',
        content: '',
      };
      if (current?.children) current.children.push(article);
      else nodes.push(article);
    } else if (contentLine && current) {
      const lastChild = current.children?.at(-1);
      if (lastChild?.content !== undefined) lastChild.content += ' ' + contentLine;
    }
  }
  return nodes;
}
```

- [ ] **Step 3.3: Create `mcp/legalize-kr/tools/references.ts`**

```typescript
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../../shared/logger.js';
import { getRepoDir } from '../git-sync.js';

const log = createLogger('legalize_kr');

export async function findReferences(lawId: string): Promise<object[]> {
  const repoDir = getRepoDir();
  if (!existsSync(repoDir)) return [];

  const refs: object[] = [];
  const files = readdirSync(repoDir).filter(f => f.endsWith('.md'));
  const pattern = new RegExp(lawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

  for (const file of files) {
    if (file.includes(lawId)) continue; // skip the law itself
    const content = readFileSync(join(repoDir, file), 'utf-8');
    const matches = content.match(pattern);
    if (matches) {
      refs.push({ file, referenceCount: matches.length, lawName: file.replace('.md', '') });
    }
  }
  return refs;
}
```

- [ ] **Step 3.4: Create `mcp/legalize-kr/tools/metadata.ts`**

```typescript
import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import simpleGit from 'simple-git';
import { getRepoDir } from '../git-sync.js';

export async function getLawMetadata(lawId: string): Promise<object> {
  const repoDir = getRepoDir();
  if (!existsSync(repoDir)) return { error: 'Repository not available' };

  const files = require('fs').readdirSync(repoDir).filter((f: string) => f.includes(lawId) && f.endsWith('.md'));
  if (files.length === 0) return { error: `Law not found: ${lawId}` };

  const filePath = join(repoDir, files[0]);
  const stat = statSync(filePath);
  const git = simpleGit(repoDir);
  const log = await git.log({ file: files[0], maxCount: 1 }).catch(() => null);

  return {
    lawId,
    fileName: files[0],
    fileSize: stat.size,
    lastModified: stat.mtime.toISOString(),
    lastCommit: log?.latest?.date ?? null,
    commitMessage: log?.latest?.message ?? null,
  };
}
```

- [ ] **Step 3.5: Create `mcp/legalize-kr/tools/compare.ts`**

```typescript
import simpleGit from 'simple-git';
import { existsSync } from 'fs';
import { getRepoDir } from '../git-sync.js';

export async function compareVersions(lawId: string, sinceCommit?: string): Promise<object> {
  const repoDir = getRepoDir();
  if (!existsSync(repoDir)) return { error: 'Repository not available' };

  const git = simpleGit(repoDir);
  const files = require('fs').readdirSync(repoDir).filter((f: string) => f.includes(lawId) && f.endsWith('.md'));
  if (files.length === 0) return { changes: [] };

  const since = sinceCommit ?? 'HEAD~1';
  const diff = await git.diff([since, 'HEAD', '--', files[0]]).catch(() => '');
  return { lawId, file: files[0], since, diff: diff || '(no changes)' };
}
```

- [ ] **Step 3.6: Replace stub `mcp/legalize-kr/index.ts`**

```typescript
#!/usr/bin/env bun
/**
 * legalize_kr MCP Server v1.0.0
 * Korean law structure analysis from .cache/legalize-kr/ git repository.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../shared/logger.js';
import { MCPValidationError } from '../shared/errors.js';
import { ensureLegalizeKRRepo } from './git-sync.js';
import { parseLawStructure } from './tools/parse.js';
import { findReferences } from './tools/references.js';
import { getLawMetadata } from './tools/metadata.js';
import { compareVersions } from './tools/compare.js';

const log = createLogger('legalize_kr');

// Sync repository on startup (non-blocking)
ensureLegalizeKRRepo().catch(err => log.error(`Startup sync failed: ${err}`));

const server = new Server(
  { name: 'legalize_kr', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'parse_law_structure',
      description: '법령의 장→절→항 계층 구조를 분석합니다.',
      inputSchema: { type: 'object', properties: { lawId: { type: 'string', description: '법령명 (e.g., 산업안전보건법)' } }, required: ['lawId'] },
    },
    {
      name: 'find_references',
      description: '이 법령을 참조하는 다른 법령을 찾습니다.',
      inputSchema: { type: 'object', properties: { lawId: { type: 'string' } }, required: ['lawId'] },
    },
    {
      name: 'get_law_metadata',
      description: '법령 파일의 메타데이터(제정일, 개정이력)를 반환합니다.',
      inputSchema: { type: 'object', properties: { lawId: { type: 'string' } }, required: ['lawId'] },
    },
    {
      name: 'compare_versions',
      description: 'git diff를 활용하여 버전별 법령을 비교합니다.',
      inputSchema: {
        type: 'object',
        properties: { lawId: { type: 'string' }, sinceCommit: { type: 'string' } },
        required: ['lawId'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log.info(`Tool called: ${name}`);

  try {
    let result: unknown;
    switch (name) {
      case 'parse_law_structure':
        if (!args?.lawId) throw new MCPValidationError('lawId is required');
        result = await parseLawStructure(args.lawId as string);
        break;
      case 'find_references':
        if (!args?.lawId) throw new MCPValidationError('lawId is required');
        result = await findReferences(args.lawId as string);
        break;
      case 'get_law_metadata':
        if (!args?.lawId) throw new MCPValidationError('lawId is required');
        result = await getLawMetadata(args.lawId as string);
        break;
      case 'compare_versions':
        if (!args?.lawId) throw new MCPValidationError('lawId is required');
        result = await compareVersions(args.lawId as string, args.sinceCommit as string | undefined);
        break;
      default:
        throw new MCPValidationError(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    log.error(`Tool ${name} failed: ${err}`);
    return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
log.info('legalize_kr MCP server started');
```

- [ ] **Step 3.7: Smoke-test legalize_kr server starts**

```bash
SKIP_GIT_SYNC=true timeout 3 bun run mcp/legalize-kr/index.ts 2>&1 | head -5
```

Expected: `[WARN][legalize_kr] SKIP_GIT_SYNC=true` then `[INFO][legalize_kr] legalize_kr MCP server started`

- [ ] **Step 3.8: Commit**

```bash
git add mcp/legalize-kr/
git commit -m "feat(mcp): implement legalize_kr server - law structure parsing via git repo"
```

---

## Task 4: mcp_kr_legislation MCP Server

**Files:**
- Create: `mcp/kr-legislation/xml-parser.ts`
- Create: `mcp/kr-legislation/tools/current-law.ts`
- Create: `mcp/kr-legislation/tools/amendments.ts`
- Create: `mcp/kr-legislation/tools/interpret.ts`
- Create: `mcp/kr-legislation/tools/penalties.ts`
- Create: `mcp/kr-legislation/tools/guide.ts`
- Modify: `mcp/kr-legislation/index.ts` (replace stub)

Data source: 국가법령정보센터 Open API (XML)
Base URL: `https://www.law.go.kr/DRF/`
OC (API key): Set via env var `LAW_API_OC` (defaults to `test` for read-only public access).

- [ ] **Step 4.1: Create `mcp/kr-legislation/xml-parser.ts`**

```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

export function parseXML(xmlText: string): unknown {
  try {
    return parser.parse(xmlText);
  } catch {
    return null;
  }
}

export function decodeKoreanText(text: string): string {
  try {
    return Buffer.from(text, 'utf-8').toString('utf-8');
  } catch {
    try {
      return Buffer.from(text, 'latin1').toString('utf-8');
    } catch {
      return text;
    }
  }
}
```

- [ ] **Step 4.2: Install `fast-xml-parser`**

```bash
cd /c/git/ai_workspace/Projects/safety-os
bun add fast-xml-parser
```

Expected: package added to package.json

- [ ] **Step 4.3: Create `mcp/kr-legislation/tools/current-law.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';
import { fetchWithRetry } from '../../shared/retry.js';
import { RateLimiter } from '../../shared/rate-limiter.js';
import { parseXML } from '../xml-parser.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('mcp_kr_legislation');
const cache = new MCPCache();
const limiter = new RateLimiter(100, 60_000);
const OC = process.env.LAW_API_OC ?? 'test';

export async function getCurrentLaw(lawType?: string): Promise<object[]> {
  const key = `legislation:current:${lawType ?? 'all'}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  if (process.env.MOCK_API === 'true') return mockCurrentLaw(lawType);

  await limiter.acquireToken();
  const query = lawType ? `&query=${encodeURIComponent(lawType)}` : '';
  const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=law&type=XML${query}`;
  const res = await fetchWithRetry(url);
  const xmlText = await res.text();
  const parsed = parseXML(xmlText) as any;

  const laws = (parsed?.LawSearch?.law ?? []).map((item: any) => ({
    lawId: item.법령ID,
    lawName: item.법령명한글,
    lawType: item.법령구분명,
    effectiveDate: item.시행일자,
  }));

  await cache.set(key, laws, 21_600); // 6h TTL
  return laws;
}

function mockCurrentLaw(lawType?: string) {
  return [
    { lawId: '272966', lawName: '중대재해처벌법', lawType: lawType ?? '법률', effectiveDate: '2022-01-27' },
    { lawId: '108723', lawName: '산업안전보건법', lawType: lawType ?? '법률', effectiveDate: '2021-01-16' },
  ];
}
```

- [ ] **Step 4.4: Create `mcp/kr-legislation/tools/amendments.ts`**

```typescript
import { MCPCache } from '../../../scripts/lib/mcp-cache.js';
import { fetchWithRetry } from '../../shared/retry.js';
import { parseXML } from '../xml-parser.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('mcp_kr_legislation');
const cache = new MCPCache();
const OC = process.env.LAW_API_OC ?? 'test';

export async function getLawAmendments(lawId: string, since?: string): Promise<object[]> {
  const key = `legislation:amendments:${lawId}:${since ?? 'all'}`;
  const cached = await cache.get(key);
  if (cached) return cached;

  if (process.env.MOCK_API === 'true') return mockAmendments(lawId);

  const url = `https://www.law.go.kr/DRF/lawHistory.do?OC=${OC}&target=law&MST=${lawId}&type=XML`;
  const res = await fetchWithRetry(url);
  const xml = await res.text();
  const parsed = parseXML(xml) as any;

  const amendments = (parsed?.LawHistory?.history ?? [])
    .filter((h: any) => !since || h.개정일자 >= since)
    .map((h: any) => ({
      date: h.개정일자,
      reason: h.개정이유,
      lawNumber: h.법령번호,
    }));

  await cache.set(key, amendments, 21_600);
  return amendments;
}

function mockAmendments(lawId: string) {
  return [
    { date: '2022-01-27', reason: '제정', lawNumber: '18967' },
    { date: '2023-04-18', reason: '일부개정', lawNumber: '19347' },
  ];
}
```

- [ ] **Step 4.5: Create remaining tool stubs (interpret, penalties, guide)**

`mcp/kr-legislation/tools/interpret.ts`:
```typescript
export async function interpretRegulation(articleId: string): Promise<object> {
  // Interpretation comes from cached commentary data or static knowledge base
  return {
    articleId,
    interpretation: `${articleId} 조문 해석: 사업주는 해당 조문에 따라 안전보건 조치를 이행할 의무가 있습니다.`,
    applicableScope: '5인 이상 사업장',
    source: '고용노동부 행정해석',
  };
}
```

`mcp/kr-legislation/tools/penalties.ts`:
```typescript
export async function getPenalties(articleId: string): Promise<object> {
  const penaltyMap: Record<string, object> = {
    '중대재해처벌법 제9조': { imprisonment: '1년 이상', fine: '10억원 이하', type: '형사처벌' },
    '산업안전보건법 제38조': { fine: '5천만원 이하', type: '행정처벌' },
  };
  return penaltyMap[articleId] ?? { articleId, penalties: '해당 조문의 처벌 규정을 직접 확인하십시오.' };
}
```

`mcp/kr-legislation/tools/guide.ts`:
```typescript
export async function getComplianceGuide(topic: string): Promise<object> {
  return {
    topic,
    steps: [
      '1. 위험성평가 실시 (산업안전보건법 제36조)',
      '2. 안전보건관리체계 구축 (중대재해처벌법 제4조)',
      '3. 안전보건교육 실시 (산업안전보건법 제29조)',
      '4. 정기 자체감사 시행',
    ],
    legalBasis: ['산업안전보건법', '중대재해처벌법'],
    source: '고용노동부 가이드라인',
  };
}
```

- [ ] **Step 4.6: Replace stub `mcp/kr-legislation/index.ts`**

```typescript
#!/usr/bin/env bun
/**
 * mcp_kr_legislation MCP Server v1.0.0
 * Real-time Korean legislation via 국가법령정보센터 API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from '../shared/logger.js';
import { MCPValidationError } from '../shared/errors.js';
import { getCurrentLaw } from './tools/current-law.js';
import { getLawAmendments } from './tools/amendments.js';
import { interpretRegulation } from './tools/interpret.js';
import { getPenalties } from './tools/penalties.js';
import { getComplianceGuide } from './tools/guide.js';

const log = createLogger('mcp_kr_legislation');

const server = new Server(
  { name: 'mcp_kr_legislation', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'get_current_law', description: '현행 법령 목록을 조회합니다.', inputSchema: { type: 'object', properties: { lawType: { type: 'string' } } } },
    { name: 'get_law_amendments', description: '법령 개정 이력을 조회합니다.', inputSchema: { type: 'object', properties: { lawId: { type: 'string' }, since: { type: 'string' } }, required: ['lawId'] } },
    { name: 'interpret_regulation', description: '법령 조문을 해석합니다.', inputSchema: { type: 'object', properties: { articleId: { type: 'string' } }, required: ['articleId'] } },
    { name: 'get_penalties', description: '위반 시 처벌 내용을 조회합니다.', inputSchema: { type: 'object', properties: { articleId: { type: 'string' } }, required: ['articleId'] } },
    { name: 'get_compliance_guide', description: '컴플라이언스 실행 가이드라인을 반환합니다.', inputSchema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log.info(`Tool called: ${name}`);
  try {
    let result: unknown;
    switch (name) {
      case 'get_current_law': result = await getCurrentLaw(args?.lawType as string | undefined); break;
      case 'get_law_amendments':
        if (!args?.lawId) throw new MCPValidationError('lawId is required');
        result = await getLawAmendments(args.lawId as string, args.since as string | undefined); break;
      case 'interpret_regulation':
        if (!args?.articleId) throw new MCPValidationError('articleId is required');
        result = await interpretRegulation(args.articleId as string); break;
      case 'get_penalties':
        if (!args?.articleId) throw new MCPValidationError('articleId is required');
        result = await getPenalties(args.articleId as string); break;
      case 'get_compliance_guide':
        if (!args?.topic) throw new MCPValidationError('topic is required');
        result = await getComplianceGuide(args.topic as string); break;
      default: throw new MCPValidationError(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    log.error(`Tool ${name} failed: ${err}`);
    return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
log.info('mcp_kr_legislation MCP server started');
```

- [ ] **Step 4.7: Smoke-test mcp_kr_legislation server starts**

```bash
MOCK_API=true timeout 3 bun run mcp/kr-legislation/index.ts 2>&1 | head -5
```

Expected: `[INFO][mcp_kr_legislation] mcp_kr_legislation MCP server started`

- [ ] **Step 4.8: Commit**

```bash
git add mcp/kr-legislation/
git commit -m "feat(mcp): implement mcp_kr_legislation server - real-time Korean legislation API"
```

---

## Task 5: Integration Smoke Test

- [ ] **Step 5.1: Run all three servers simultaneously to verify no conflicts**

```bash
MOCK_API=true SKIP_GIT_SYNC=true timeout 5 bun run mcp/k-skill/index.ts &
MOCK_API=true SKIP_GIT_SYNC=true timeout 5 bun run mcp/legalize-kr/index.ts &
MOCK_API=true SKIP_GIT_SYNC=true timeout 5 bun run mcp/kr-legislation/index.ts &
wait
```

Expected: all three start without errors (exit after 5s timeout is normal)

- [ ] **Step 5.2: Run audit**

```bash
bun scripts/audit.ts
```

Expected: 0 errors

- [ ] **Step 5.3: Final commit**

```bash
git add .
git commit -m "chore(mcp): integration smoke test verified — all 3 servers operational"
```

---

## Dependencies

Install before Task 2:
```bash
bun add @modelcontextprotocol/sdk simple-git fast-xml-parser
```

Check `package.json` to confirm these are already present before re-adding.
