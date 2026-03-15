# Talent Intelligence Service API

## Base URL

Local default:

```text
http://127.0.0.1:8788
```

## Endpoints

### `GET /health`
Returns service health.

Example response:

```json
{
  "ok": true,
  "service": "talent-intelligence-service",
  "version": "v0.1"
}
```

### `GET /api/talent-intelligence/schema`
Returns supported templates and high-level response shape.

### `POST /api/talent-intelligence/run`
Run one talent-intelligence workflow request.

## Request shape

```json
{
  "templateId": "sourcing_strategy_cn",
  "searchContext": {
    "projectName": "Confidential Client - VP Product Search",
    "roleTitle": "VP Product",
    "clientName": "Confidential Client",
    "searchType": "executive_search",
    "mandateType": "retained",
    "companyContext": "Series C AI infra company selling to enterprise customers",
    "hiringBrief": "Find a product leader who can unify platform roadmap and enterprise customer requirements",
    "objective": "Output search strategy and target-company map",
    "targetIndustry": "Enterprise software, cloud, AI infrastructure",
    "targetCompanies": ["Huawei Cloud", "Alibaba Cloud"],
    "location": "Shanghai",
    "salaryRange": "Base 150-220k RMB/month"
  },
  "runtime": {
    "mode": "openai",
    "baseUrl": "http://127.0.0.1:8999/v1",
    "apiKey": "test-key",
    "model": "bailian/qwen3.5-plus",
    "temperature": 0.4,
    "maxTokens": 5000,
    "timeoutMs": 120000
  }
}
```

## Response shape

```json
{
  "ok": true,
  "mode": "template-renderer",
  "templateId": "sourcing_strategy_cn",
  "engine": {
    "kind": "local-template-engine",
    "version": "v0.1"
  },
  "summary": {
    "projectName": "Confidential Client - VP Product Search",
    "roleTitle": "VP Product",
    "templateId": "sourcing_strategy_cn"
  },
  "reportMarkdown": "# ...",
  "metadata": {
    "startedAt": "2026-03-15T00:00:00.000Z",
    "completedAt": "2026-03-15T00:00:00.000Z"
  }
}
```

## Error shape

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_TEMPLATE",
    "message": "Unsupported templateId: bad_template",
    "details": {
      "allowed": [
        "jd_diagnosis_cn",
        "sourcing_strategy_cn",
        "candidate_assessment_cn",
        "search_plan_cn"
      ]
    }
  }
}
```

## Notes

- Current engine is a **local template renderer** behind a stable service interface.
- Next step is replacing `server/app/service.mjs` with a real workflow orchestrator while keeping the API contract stable.
