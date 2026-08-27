# MCP Server Design Document
**Date**: 2026-06-05
**Project**: Safety OS - 3 MCP Servers Implementation
**Status**: Revised (v1.1) - Ready for re-review

---

## 1. Architecture Overview

### 1.1 Directory Structure
```
Safety OS 프로젝트 (C:\git\Projects\safety-os\)
├── mcp/                          # MCP 서버 전용 디렉토리 (퍼스트파티)
│   ├── shared/                   # 공통 유틸리티
│   │   ├── types.ts             # 공통 타입 정의
│   │   ├── logger.ts            # 로깅 유틸리티
│   │   └── errors.ts            # 표준 에러 클래스
│   ├── k-skill/                  # k_skill MCP 서버
│   │   ├── index.ts             # 메인 서버 파일
│   │   └── tools/               # MCP 도구 구현
│   ├── legalize-kr/              # legalize_kr MCP 서버
│   │   ├── index.ts             # 메인 서버 파일
│   │   └── tools/               # MCP 도구 구현
│   └── kr-legislation/           # mcp_kr_legislation MCP 서버
│       ├── index.ts             # 메인 서버 파일
│       └── tools/               # MCP 도구 구현
├── scripts/lib/                   # 기존 캐시 라이브러리
│   └── mcp-cache.ts             # MCPCache 클래스 (재사용)
├── .cache/
│   ├── k-skill/                  # K-Skill 캐시 (24시간 TTL)
│   └── legalize-kr/              # 법령 git repository
└── .mcp.json                     # MCP 서버 등록
```

### 1.2 Communication Flow
```
k_skill MCP              → K-Skill OpenAPI (외부)           → 24시간 캐시
legalize_kr MCP          → .cache/legalize-kr/ (git)        → Read-only
mcp_mcp_kr_legislation MCP   → 국가법령정보센터 API             → 1-6시간 캐시
                         → 공공데이터포털 API
```

---

## 2. k_skill MCP Server

### 2.1 Purpose
산업안전보건 규정 데이터를 캐싱하여 제공하는 읽기 전용 MCP 서버

### 2.2 Core Functionality
- 키워드로 규정 검색
- 특정 조항 조회
- 산업별 적용 규정 목록
- 24시간 로컬 캐싱 (TTL)

### 2.3 MCP Tools
1. `search_osha_regulations` - 산업안전보건법 관련 규정 검색
2. `get_sapa_requirements` - 중대재해처벌법 요건 조회
3. `list_industry_controls` - 산업별 통제조치 목록
4. `check_compliance_gaps` - 컴플라이언스 갭 분석
5. `invalidate_cache` - 캐시 수동 초기화 (관리용)

### 2.4 Technical Stack
- 언어: TypeScript
- MCP SDK: `@modelcontextprotocol/sdk` (공식 TypeScript SDK)
- 캐시: `scripts/lib/mcp-cache.ts`의 `MCPCache` 클래스 재사용
- HTTP: fetch API
- 실행: `bun run ./mcp/k-skill/index.ts`

**MCP SDK Integration Template**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: "k_skill", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Tool registration
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_osha_regulations",
      description: "Search OSHA regulations",
      inputSchema: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Search keyword" }
        },
        required: ["keyword"]
      }
    }
    // ... other tools
  ]
}));

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_osha_regulations":
      // Implementation
      break;
    // ... other cases
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 2.5 Data Sources
- **Primary**: 국가법령정보센터 API (실시간)
- **Secondary**: K-Skill 프로젝트 패턴 참조

### 2.6 Caching Strategy
- 캐시 파일: JSON 형식
- TTL: 24시간
- 캐시 히트 시 로그 출력
- 캐시 만료 시 자동 갱신

---

## 3. legalize_kr MCP Server

### 3.1 Purpose
`.cache/legalize-kr/` git repository에 있는 한국 법령 데이터의 구조를 분석하고 쿼리

### 3.2 Core Functionality
- 법령의 계층 구조 파싱 (장→절→항)
- 관련 법령 간의 참조 관계 분석
- 법령 메타데이터 추출 (제정일, 개정이력)

### 3.3 MCP Tools
1. `parse_law_structure` - 법령의 계층 구조 분석
2. `find_references` - 관련 법령 간 참조 관계 찾기
3. `get_law_metadata` - 법령 메타데이터 추출
4. `compare_versions` - 버전별 법령 비교 (git diff 활용)

### 3.4 Technical Stack
- 언어: TypeScript
- Git 작업: `simple-git` 패키지
- 파싱: 정규표현식 + Markdown 파싱
- 실행: `bun run ./mcp/legalize-kr/index.ts`

### 3.5 Data Source
- `.cache/legalize-kr/` (read-only git repository)
- Markdown 형식의 법령 파일

### 3.6 Git Repository Synchronization Strategy
```typescript
import simpleGit from 'simple-git';

// Initial clone strategy
async function ensureLegalizeKRRepo(): Promise<void> {
  const repoDir = '.cache/legalize-kr';
  const repoUrl = 'https://github.com/legalize-kr/legalize-kr.git';

  // Check if repository exists
  if (existsSync(join(repoDir, '.git'))) {
    // Update existing repository
    const git = simpleGit(repoDir);
    await git.fetch('origin');
    await git.reset(['--hard', 'origin/main']);
  } else {
    // Clone new repository
    await simpleGit().clone(repoUrl, repoDir, ['--depth', '1', '--branch', 'main']);
  }
}

// Sync frequency: Daily cron or manual trigger via scripts/fetch-legalize.ts
// Conflict resolution: Use --depth 1 shallow clones to avoid conflicts
// Repository size: Limit to latest commit only (≈100MB)
```

---

## 4. mcp_kr_legislation MCP Server

### 4.1 Purpose
실시간 법령 업데이트 + 법령 해석 및 가이드를 제공

### 4.2 Core Functionality
- 실시간 법령 업데이트 (정부 OpenAPI)
- 법령 해석 및 적용 범위 제공
- 위반 시 처벌 내용 안내
- 실행 가이드라인 제공

### 4.3 MCP Tools
1. `get_current_law` - 현행 법령 목록 (국가법령정보센터 API)
2. `get_law_amendments` - 개정 이력 조회 (국가법령정보센터 API)
3. `interpret_regulation` - 법령 해석 및 적용 범위 설명
4. `get_penalties` - 위반 시 처벌 내용 조회
5. `get_compliance_guide` - 컴플라이언스 실행 가이드라인

### 4.4 Technical Stack
- 언어: TypeScript
- 데이터 소스: 정부 OpenAPI (국가법령정보센터, 법률 정보 포털)
- 캐싱: 실시간 업데이트용 별도 캐시 (단기 TTL: 1-6시간)
- 실행: `bun run ./mcp/kr-legislation/index.ts`

### 4.5 Data Flow
- 국가법령정보센터 API → XML → JSON 파싱 → 캐싱 → 응답
- 법률 정보 포털 → 해석 및 가이드라인 → 병합 → 응답

### 4.6 XML Parsing Strategy
- **Parser Library**: `fast-xml-parser` (supports Korean text, typed output)
- **Encoding Handling**: Try UTF-8 → CP949 → UTF-16 fallback chain
- **Validation**: XSD schema for legal XML structure
- **Error Recovery**: Skip malformed elements, log warnings

**Implementation Example**:
```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true
});

// Handle Korean encoding issues
function decodeKoreanText(text: string): string {
  try {
    return Buffer.from(text, 'utf-8').toString('utf-8');
  } catch {
    try {
      return Buffer.from(text, 'cp949').toString('utf-8');
    } catch {
      return Buffer.from(text, 'utf-16').toString('utf-8');
    }
  }
}
```

---

## 5. Shared Infrastructure

### 5.1 Common Utilities (`mcp/shared/`)

#### `types.ts`
```typescript
export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export interface CacheEntry {
  data: any;
  timestamp: string;
  ttl: number;
}
```

#### `logger.ts`
- 로그 레벨: DEBUG, INFO, WARN, ERROR
- stdout 출력 (Claude Code와 통합)

#### `errors.ts`
- `MCPConfigError` - 설정 오류
- `MCPNetworkError` - 네트워크 연결 실패
- `MCPDataNotFoundError` - 요청한 데이터 없음
- `MCPValidationError` - 입력 검증 실패

#### 캐시 관리 (`scripts/lib/mcp-cache.ts`)
- 기존 `MCPCache` 클래스 재사용
- 캐시 CRUD operations
- TTL 검사
- 자동 만료 처리

### 5.2 Error Handling Rules
- 네트워크 오류: 재시도 3회 (exponential backoff: 1s, 2s, 4s)
- 데이터 없음: 빈 결과 반환 + INFO 로그
- 설정 오류: 즉시 실패 + ERROR 로그
- 모든 에러는 사용자에게 명확한 메시지 제공

**복구 전략**:
```typescript
// Exponential backoff implementation
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Circuit breaker pattern for API failures
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.timeout) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.failures = 0; // Reset after timeout
    }

    try {
      return await fn();
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      throw error;
    }
  }
}
```

### 5.3 Logging Strategy
- 모든 MCP 서버는 `logger.ts`를 사용
- 로그 레벨: DEBUG, INFO, WARN, ERROR
- stdout 출력 (Claude Code와 통합)

---

## 6. .mcp.json Configuration

```json
{
  "mcpServers": {
    "codegraph_search": {
      "command": "node",
      "args": ["../../node_modules/.bin/codegraph", "search"],
      "env": {}
    },
    "codegraph_mutate": {
      "command": "node",
      "args": ["../../node_modules/.bin/codegraph", "mutate"],
      "env": {}
    },
    "k_skill": {
      "command": "bun",
      "args": ["run", "./mcp/k-skill/index.ts"],
      "env": {}
    },
    "legalize_kr": {
      "command": "bun",
      "args": ["run", "./mcp/legalize-kr/index.ts"],
      "env": {}
    },
    "mcp_kr_legislation": {
      "command": "bun",
      "args": ["run", "./mcp/kr-legislation/index.ts"],
      "env": {}
    }
  }
}
```

---

## 7. Implementation Phases

### Phase 1: Shared Infrastructure
- `mcp/shared/` 유틸리티 구현
- 공통 타입, 에러 핸들링, 로깅

### Phase 2: k_skill MCP
- 기본 MCP 서버 구조
- 캐싱 레이어 구현
- API 통합 (국가법령정보센터)

### Phase 3: legalize_kr MCP
- Git repository 기반 구조 분석
- Markdown 파싱
- 버전 비교 기능

### Phase 4: mcp_kr_legislation MCP
- XML → JSON 파싱
- API 키 관리
- 실시간 업데이트 기능

### Phase 5: Testing & Documentation
- 각 MCP 서버 테스트
- 통합 테스트
- 사용 가이드 작성

**Testing Framework**:
```bash
# Unit tests
bun test mcp/**/*.test.ts

# Integration tests (mock APIs)
MOCK_API=true bun test integration/

# E2E tests (live APIs)
E2E_TEST=true bun scripts/test-mcp-integration.ts

# Performance benchmarks
bun run benchmark:mcp-servers
```

**Test Coverage Requirements**:
- Unit tests: 80%+ coverage
- Integration tests: All MCP tools covered
- E2E tests: Critical paths (cache miss, API failure, git sync)

---

## 8. Security Considerations

### 8.1 API Key Management
- 환경변수로 API 키 저장
- `.env` 파일 (gitignore)
- 절대 코드에 하드코딩 금지

### 8.2 Network Security
- HTTPS only
- Certificate validation
- Rate limiting 준수

**Rate Limiting Implementation**:
```typescript
// Token bucket rate limiter for National Law Information Center API
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(maxRequests: number, windowMs: number) {
    this.maxTokens = maxRequests;
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.refillRate = maxRequests / windowMs;
  }

  async acquireToken(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 1;
    }
    this.tokens--;
  }
}

// Usage for National Law Information Center API (limit: 100 requests/minute)
const rateLimiter = new RateLimiter(100, 60000);
```

### 8.3 Data Privacy
- 민감한 데이터 로컬 캐시 금지
- 캐시 파일 암호화 고려 (향후)

---

## 9. Performance Optimization

### 9.1 Caching Strategy
- k_skill: 24시간 TTL (참고 데이터)
- kr_legislation: 1-6시간 TTL (실시간 데이터)

### 9.2 Request Optimization
- Batch API calls 가능 시 사용
- 결과 캐싱 최대화
- 불필요한 API 호출 방지

### 9.3 Performance Baselines
```yaml
targets:
  cache_hit_rate: 80%
  api_response_p95: 500ms
  startup_time: 200ms
  memory_limit: 100MB
```

---

## 10. Maintenance & Monitoring

### 10.1 Logging
- 모든 API 요청/응답 로깅
- 에러 발생 시 상세 로그
- 성능 메트릭 수집 (향후)

### 10.2 Health Checks
- 각 MCP 서버 상태 확인
- API 연결 상태 모니터링
- 캐시 상태 확인

---

## References

1. [국가법령정보 공동활용 OPEN API](https://open.law.go.kr/LSO/openApi/guideList.do)
2. [공공데이터포털](https://www.data.go.kr)
3. [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
4. [Public APIs for Korea - GitHub](https://github.com/yybmion/public-apis-4Kr)
5. Meeting transcript: `memory/meeting-2026-06-05-mcp-server-design.md`

---

**Document Status**: Ready for implementation planning
**Next Step**: Invoke writing-plans skill to create detailed implementation plan
