---
name: api-documentation
description: >
  Creates comprehensive API documentation including endpoints, parameters, authentication,
  request/response schemas, and code examples. Use when: documenting REST APIs, GraphQL
  interfaces, SDKs, or developer-facing technical specifications.
version: 1.0.0
gemini-parity: skip
metadata:
  type: implementation
  triggers:
    - api documentation
    - document api
    - api reference
    - developer documentation
    - rest api docs
    - graphql docs
    - sdk documentation
---

## Overview

This skill provides systematic API documentation capabilities, creating comprehensive developer resources that enable API integration and adoption. It ensures documentation is accurate, complete, and developer-friendly.

## When to Use This Skill

**API Documentation**:
- Trigger: "Document the API" or "Create API reference"
- Use Case: Creating comprehensive documentation for REST/GraphQL APIs

**SDK Documentation**:
- Trigger: "Document SDK" or "Create library documentation"
- Use Case: Documenting software development kits and client libraries

**API Updates**:
- Trigger: "Update API docs for new endpoint" or "Document breaking changes"
- Use Case: Keeping documentation current with API changes

**Developer Resources**:
- Trigger: "Create developer guide" or "Write integration tutorial"
- Use Case: Helping developers integrate with APIs successfully

---

## Step 1: API Analysis and Structure

**Purpose**: Understand API structure and documentation requirements.

**API Analysis Process**:
1. **API Type Identification**:
   - REST API (resources, HTTP methods, status codes)
   - GraphQL API (schema, queries, mutations)
   - RPC/GraphQL (procedure calls)
   - WebSocket API (real-time communication)
   - SDK/Library (classes, methods, parameters)

2. **Endpoint/Operation Inventory**:
   - List all endpoints or operations
   - Group by resource or functionality
   - Identify authentication requirements
   - Note rate limiting or throttling

3. **Data Model Analysis**:
   - Request schemas and parameters
   - Response schemas and formats
   - Data types and validation rules
   - Error response formats

4. **Developer Use Cases**:
   - Common integration scenarios
   - Typical workflows and sequences
   - Authentication flows
   - Error handling examples

**Documentation Structure**:
```
1. Overview (getting started, authentication)
2. Quick Start (simple example)
3. API Reference (detailed endpoints)
4. Guides (tutorials, best practices)
5. SDK Reference (if applicable)
6. Error Handling (troubleshooting)
7. Changelog (version history)
```

---

## Step 2: Getting Started Documentation

**Purpose**: Help developers begin using the API quickly.

**Getting Started Components**:
1. **Overview Section**:
   - What the API does
   - Key features and capabilities
   - Use cases and benefits
   - Access requirements (API keys, OAuth)

2. **Authentication Guide**:
   - Authentication methods (API key, OAuth, JWT)
   - How to obtain credentials
   - How to include credentials in requests
   - Token refresh procedures

3. **Quick Start Example**:
   - Simple, working example
   - Minimal required parameters
   - Expected response
   - Language-specific examples (Python, JavaScript, cURL)

4. **Setup Instructions**:
   - Environment setup
   - Dependency installation
   - Configuration steps
   - First request walkthrough

**Quick Start Template**:
```markdown
## Quick Start

### 1. Get API Key
Register at [url] to get your API key

### 2. Make Your First Request
\`\`\`bash
curl -X GET "https://api.example.com/v1/users" \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

### 3. Expected Response
\`\`\`json
{
  "users": [...],
  "total": 10
}
\`\`\`
```

---

## Step 3: API Reference Documentation

**Purpose**: Create detailed documentation for each endpoint/operation.

**Endpoint Documentation Structure**:
1. **Endpoint Overview**:
   - HTTP method and path
   - Description of what it does
   - Use case example
   - Rate limiting info

2. **Request Parameters**:
   - Path parameters (required)
   - Query parameters (optional)
   - Request body schema
   - Headers required
   - Authentication requirements

3. **Response Documentation**:
   - Success response schema
   - Example responses
   - Status codes and meanings
   - Pagination info (if applicable)

4. **Error Responses**:
   - Error response format
   - Common error codes
   - Troubleshooting steps
   - Error examples

**Endpoint Template**:
```markdown
## Get Users

Retrieves a list of users with optional filtering.

### Request
\`GET /v1/users\`

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | integer | No | Number of results (1-100, default: 20) |
| offset | integer | No | Pagination offset (default: 0) |

### Response
\`\`\`json
{
  "users": [
    {
      "id": "user_123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
\`\`\`

### Errors
| Status | Description |
|--------|-------------|
| 400 | Invalid query parameter |
| 401 | Unauthorized (invalid API key) |
| 429 | Rate limit exceeded |
```

---

## Step 4: Request/Response Schema Documentation

**Purpose**: Document data structures and validation rules.

**Schema Documentation**:
1. **Request Schemas**:
   - JSON Schema or TypeScript interfaces
   - Required vs. optional fields
   - Validation rules
   - Constraints and ranges
   - Example requests

2. **Response Schemas**:
   - Response object structure
   - Field descriptions and types
   - Nullable fields
   - Enum values
   - Example responses

3. **Data Types**:
   - Primitives (string, integer, boolean)
   - Complex types (arrays, objects)
   - Date/time formats
   - Enumerations
   - Custom formats

**Schema Documentation Format**:
```markdown
### User Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | string | No | Unique user identifier |
| name | string | No | User's full name |
| email | string | No | User's email address |
| created_at | string (ISO 8601) | No | Account creation timestamp |
| updated_at | string (ISO 8601) | Yes | Last update timestamp |

**Example**
\`\`\`json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2026-05-26T12:00:00Z"
}
\`\`\`
```

---

## Step 5: Code Examples and SDKs

**Purpose**: Provide working code examples in multiple languages.

**Code Example Guidelines**:
1. **Language Coverage**:
   - JavaScript/Node.js (web developers)
   - Python (data scientists, backend)
   - Java/TypeScript (enterprise)
   - cURL (testing/debugging)
   - Popular frameworks (React, Vue, Django)

2. **Example Quality**:
   - Complete, runnable examples
   - Include error handling
   - Show authentication
   - Display response handling
   - Add comments explaining key steps

3. **SDK Documentation** (if applicable):
   - Installation instructions
   - Class/method documentation
   - Usage examples
   - Configuration options
   - Error handling patterns

**Code Example Template**:
```python
import requests

API_KEY = "your_api_key"
BASE_URL = "https://api.example.com/v1"

def get_users(limit=20, offset=0):
    """
    Retrieve a list of users.
    
    Args:
        limit: Number of results (1-100)
        offset: Pagination offset
    
    Returns:
        List of users
    
    Raises:
        ValueError: If parameters are invalid
        requests.HTTPError: If API request fails
    """
    url = f"{BASE_URL}/users"
    headers = {"Authorization": f"Bearer {API_KEY}"}
    params = {"limit": limit, "offset": offset}
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"API Error: {e}")
        raise
```

---

## Step 6: Error Handling and Troubleshooting

**Purpose**: Help developers handle errors effectively.

**Error Documentation**:
1. **HTTP Status Codes**:
   - Success codes (200, 201, 204)
   - Client errors (400, 401, 403, 404, 429)
   - Server errors (500, 502, 503)
   - Status code meanings and remedies

2. **Error Response Format**:
   - Error response structure
   - Error codes and types
   - Error messages
   - Debug information

3. **Common Issues**:
   - Authentication failures
   - Rate limiting
   - Invalid parameters
   - Network errors
   - Timeout issues

4. **Troubleshooting Guides**:
   - Step-by-step problem resolution
   - Debugging tips
   - Contact support info
   - Community resources

**Error Documentation Template**:
```markdown
## Error Handling

### HTTP Status Codes

| Status | Meaning | Resolution |
|--------|---------|------------|
| 400 | Bad Request | Fix request parameters |
| 401 | Unauthorized | Check API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Verify endpoint URL |
| 429 | Rate Limit | Wait and retry |

### Error Response Format
\`\`\`json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid value for 'limit' parameter",
    "details": {
      "parameter": "limit",
      "value": 999,
      "constraint": "1-100"
    }
  }
}
\`\`\`

### Common Issues

**Issue**: "401 Unauthorized"
**Solution**: Verify API key is correct and not expired

**Issue**: "429 Rate Limit Exceeded"
**Solution**: Implement exponential backoff, wait before retry
```

---

## Step 7: Versioning and Changelog

**Purpose**: Document API evolution and breaking changes.

**Versioning Strategy**:
1. **Semantic Versioning**:
   - MAJOR: Breaking changes
   - MINOR: New features, backward compatible
   - PATCH: Bug fixes

2. **URL Versioning**:
   - Include version in URL path (/v1/, /v2/)
   - Document deprecation timeline
   - Provide migration guides

3. **Header Versioning**:
   - Use Accept header for versioning
   - Document supported versions
   - Default version behavior

**Changelog Format**:
```markdown
## Changelog

### [Version] - [Date]

#### Added
- New endpoint description
- New parameter description

#### Changed
- Modified endpoint behavior
- Updated response format

#### Deprecated
- Endpoint deprecation notice

#### Removed
- Removed endpoint (include migration guide)
```

---

## Expected Outputs

**For REST API Documentation**:
- Complete API reference with all endpoints
- Authentication and security guide
- Request/response schema documentation
- Code examples in multiple languages
- Error handling and troubleshooting guide

**For GraphQL API Documentation**:
- Schema documentation with types
- Query and mutation reference
- Subscription documentation
- Example queries and mutations
- Integration guides

**For SDK Documentation**:
- Installation and setup guide
- Class/method reference
- Usage examples and patterns
- Configuration options
- Error handling patterns

---

## Best Practices

**Documentation Quality**:
✅ **Do**:
- Start with quick start for fast onboarding
- Provide working code examples
- Include error handling in examples
- Keep documentation up-to-date with API changes
- Use consistent formatting and structure
- Include pagination and filtering info
- Document rate limits and throttling

❌ **Don't**:
- Skip authentication documentation
- Use placeholder code that doesn't work
- Forget to document error responses
- Make examples too complex
- Ignore edge cases and errors
- Leave documentation outdated
- Use jargon without explanation

**Developer Experience**:
✅ **Do**:
- Write for busy developers
- Assume no prior API knowledge
- Provide copy-paste examples
- Include common workflows
- Link to related resources
- Make content searchable
- Support multiple languages

❌ **Don't**:
- Write like academic textbook
- Assume readers know your API
- Make examples too simple (unrealistic)
- Skip error scenarios
- Leave out important context
- Make content hard to navigate
- Focus on one language only

---

## Common Mistakes to Avoid

**Documentation Anti-Patterns**:
1. **Outdated Docs**: Documentation not synced with API changes
2. **Missing Examples**: Text-only without working code
3. **Poor Search**: Hard to find specific endpoints or info
4. **Inconsistent Structure**: Different formats across sections
5. **Missing Context**: Not explaining "why" or "when to use"

**Content Anti-Patterns**:
1. **Assumptions**: Assuming prior knowledge
2. **Ambiguity**: Unclear parameter descriptions
3. **Incomplete Info**: Missing required parameters
4. **No Error Handling**: Examples without error cases
5. **Dead Links**: References to non-existent resources

---

## Related Skills

- **documentation-writing**: For general documentation principles
- **technical-writing**: For technical communication best practices
- **code-review**: For validating code examples
- **developer-experience**: For overall developer portal design

---

## API Documentation Tools

**Static Site Generators**:
- **Docusaurus**: Facebook's React-based doc generator
- **MkDocs**: Python-based static site generator
- **VuePress**: Vue-powered documentation generator
- **GitBook**: Book-style documentation platform

**API Documentation Tools**:
- **Swagger/OpenAPI**: REST API specification
- **Postman**: API documentation and testing
- **Insomnia**: REST client and documentation
- **Stoplight**: API design and documentation

**Interactive API Explorers**:
- **Swagger UI**: OpenAPI specification visualization
- **ReDoc**: Beautiful OpenAPI documentation
- **GraphQL Playground**: Interactive GraphQL explorer
- **Postman**: API testing and documentation

**Code Examples Tools**:
- **Snippets**: Code snippet management
- **Carbon**: Beautiful code screenshots
- **APIary**: API design and documentation

---

## Documentation Quality Checklist

**Content Quality**:
- [ ] Quick start guide exists
- [ ] All endpoints documented
- [ ] Request parameters explained
- [ ] Response schemas documented
- [ ] Error responses documented
- [ ] Code examples work correctly
- [ ] Authentication documented
- [ ] Rate limits specified
- [ ] Pagination explained
- [ ] Versioning strategy clear

**Usability Quality**:
- [ ] Easy to navigate
- [ ] Searchable content
- [ ] Consistent formatting
- [ ] Mobile-friendly
- [ ] Print-friendly
- [ ] Cross-browser compatible
- [ ] Fast loading
- [ ] Accessible (WCAG AA)

**Maintainability Quality**:
- [ ] Version controlled
- [ ] Easy to update
- [ ] Clear change log
- [ ] Deprecation policy defined
- [ ] Migration guides provided
- [ ] Feedback mechanism exists
- [ ] Regularly reviewed and updated

---

## OpenAPI/Swagger Specification

**OpenAPI 3.0 Structure**:
```yaml
openapi: 3.0.0
info:
  title: API Name
  version: 1.0.0
  description: API description
servers:
  - url: https://api.example.com/v1
    description: Production server

paths:
  /users:
    get:
      summary: Get users
      description: Retrieve list of users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
          description: Number of results
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  users:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
```

---

## GraphQL Documentation

**GraphQL Documentation Components**:
1. **Schema Documentation**:
   - Types (objects, interfaces, enums)
   - Queries (read operations)
   - Mutations (write operations)
   - Subscriptions (real-time)

2. **Operation Documentation**:
   - Query/mutation signature
   - Parameters and arguments
   - Return type
   - Usage examples

3. **Example Queries**:
   - Simple queries
   - Complex nested queries
   - Mutations with inputs
   - Subscriptions setup

**GraphQL Documentation Format**:
```graphql
"""
User type definition
"""
type User {
  """
  Unique user identifier
  """
  id: ID!
  
  """
  User's full name
  """
  name: String!
  
  """
  User's email address
  """
  email: String!
  
  """
  Timestamp when user was created
  """
  createdAt: String!
}

"""
Query users
"""
type Query {
  """
  Get list of users
  """
  users(
    """
    Number of users to return
    """
    limit: Int = 20
    
    """
    Pagination offset
    """
    offset: Int = 0
  ): [User!]!
}
```
