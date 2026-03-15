# Talent Intelligence Service API

## Base URL

Local default:

```text
http://127.0.0.1:8788
```

## Version note

This document describes the **workflow-runner-oriented backend contract for v0.4 planning**.

In the current local service skeleton, live responses still expose `apiVersion: "v0.3"` because the runtime constant has not been bumped yet. The important behavior already matches the v0.4 docs shape:
- requests resolve through a workflow runner boundary
- success responses include `run`, `engine`, `metadata`, and `orchestration`
- `reportMarkdown` is returned inline
- persistence to `state/` is controlled by the caller/CLI, not automatically by the HTTP service

## Endpoints

### `GET /health`
Returns service health, request metadata, and the current execution catalog.

Canonical example: `examples/health-response.json`

Key fields exposed under `execution`:
- `mode`
- `workflowId`
- `defaultRunnerId`
- `supportedRequestModes`
- `supportedRunnerIds`
- `runners`

### `GET /api/talent-intelligence/schema`
Returns supported templates, endpoints, the execution catalog, plus success/error response shapes.

Canonical example: `examples/schema-response.json`

### `POST /api/talent-intelligence/run`
Runs one talent-intelligence workflow request.

## Persistence behavior

The backend returns the generated markdown in-band as `reportMarkdown`.

It does **not** automatically write a file into `state/`. In the packaged skill flow, the CLI persists the returned markdown only when `--out <path>` is supplied. That separation is intentional:
- backend owns execution + response metadata
- caller owns file persistence policy

## Canonical example files

These sample payloads are kept in `examples/` and should stay aligned with the documented contract:

- `examples/health-response.json`
- `examples/schema-response.json`
- `examples/run-request.json`
- `examples/run-response.json`
- `examples/error-invalid-template.json`
- `examples/error-missing-role-title.json`
- `examples/error-invalid-json.json`

## Request contract

Top-level shape:

```json
{
  "templateId": "sourcing_strategy_cn",
  "searchContext": { "...": "..." },
  "runtime": { "...": "..." }
}
```

### Request behavior

- `templateId` may be supplied at the top level or inside `searchContext.templateId`.
- If omitted, `templateId` defaults to `search_plan_cn`.
- `searchContext` may be nested under `searchContext` **or** sent as a flat top-level object; the server normalizes both.
- Arrays such as `targetCompanies`, `mustHaveSkills`, `targetFunctions`, `offLimits`, and related list fields accept either:
  - a JSON array of strings, or
  - a single string, which will be normalized into a one-item array.
- `runtime` is optional; missing values fall back to defaults.
- A request id is generated automatically, or can be supplied through the `X-Request-Id` header.
- `searchContext.roleTitle` is required after trimming. Missing, empty, or whitespace-only values trigger `MISSING_ROLE_TITLE`.

### Search-context fields currently recognized

The current normalizer accepts these fields under `searchContext`:

- `projectName`
- `roleTitle`
- `clientName`
- `searchType`
- `mandateType`
- `companyContext`
- `companyStage`
- `businessModel`
- `teamStage`
- `hiringBrief`
- `objective`
- `targetIndustry`
- `targetCompanies`
- `location`
- `targetGeographies`
- `salaryRange`
- `compensationMix`
- `equity`
- `reportingLine`
- `level`
- `headcount`
- `urgency`
- `searchReason`
- `successProfile`
- `successMetrics`
- `marketSignals`
- `stakeholderBrief`
- `mustHaveSkills`
- `niceToHaveSkills`
- `dealBreakers`
- `targetFunctions`
- `targetBackgrounds`
- `offLimits`
- `sourceChannels`
- `interviewProcess`
- `interviewPanel`
- `processConstraints`
- `candidateName`
- `candidateSummary`
- `candidateHighlights`
- `candidateConcerns`
- `interviewerNotes`

### Runtime fields currently recognized

- `mode` — defaults to `openai`; accepted request modes still resolve through the local workflow runner in this build
- `executionMode`
- `runner`
- `runnerId`
- `baseUrl`
- `apiKey`
- `model` — defaults to `process.env.TALENT_INTEL_DEFAULT_MODEL` or `bailian/qwen3.5-plus`
- `temperature` — defaults to `0.4`
- `maxTokens` — defaults to `5000`
- `timeoutMs` — defaults to `120000`

## Example request

From `examples/run-request.json`:

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
    "companyStage": "Series C",
    "businessModel": "Enterprise SaaS + AI infrastructure",
    "teamStage": "Scaling from 8 to 20 product team members",
    "hiringBrief": "Find a product leader who can unify platform roadmap and enterprise customer requirements",
    "objective": "Output search strategy and target-company map",
    "targetIndustry": "Enterprise software, cloud, AI infrastructure",
    "targetCompanies": ["Huawei Cloud", "Alibaba Cloud", "Volcano Engine", "Tencent Cloud"],
    "location": "Shanghai",
    "targetGeographies": ["Shanghai", "Hangzhou", "Shenzhen"],
    "salaryRange": "Base 150-220k RMB/month"
  },
  "runtime": {
    "mode": "openai",
    "runner": "local-template",
    "baseUrl": "http://127.0.0.1:8999/v1",
    "apiKey": "test-key",
    "model": "bailian/qwen3.5-plus",
    "temperature": 0.4,
    "maxTokens": 5000,
    "timeoutMs": 120000
  }
}
```

## Success response contract

From `examples/run-response.json`:

```json
{
  "ok": true,
  "requestId": "req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "mode": "template-renderer",
  "templateId": "sourcing_strategy_cn",
  "run": {
    "id": "run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "status": "completed",
    "templateId": "sourcing_strategy_cn",
    "mode": "template-renderer",
    "runnerId": "local-template"
  },
  "engine": {
    "kind": "local-template-engine",
    "version": "v0.4",
    "provider": "local",
    "adapter": "template-renderer",
    "runnerId": "local-template",
    "executionMode": "local-template",
    "requestedMode": "openai",
    "requestedRunner": "local-template",
    "requestedModel": "bailian/qwen3.5-plus",
    "resolvedMode": "template-renderer",
    "implementationStatus": "active",
    "resolutionSource": "runner",
    "fallbackReason": "Local template runner is the executable backend bundled with this local-only service."
  },
  "summary": {
    "projectName": "Confidential Client - VP Product Search",
    "roleTitle": "VP Product",
    "templateId": "sourcing_strategy_cn"
  },
  "reportMarkdown": "# 人才寻访策略报告｜VP Product\n...",
  "metadata": {
    "requestId": "req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "runId": "run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "apiVersion": "v0.4",
    "startedAt": "2026-03-15T00:00:00.000Z",
    "completedAt": "2026-03-15T00:00:00.000Z",
    "durationMs": 1,
    "workflowId": "talent-intelligence.local-template-render",
    "workflowVersion": "v0.4",
    "runnerId": "local-template",
    "executionMode": "local-template",
    "executionStatus": "completed",
    "requestedMode": "openai",
    "requestedRunner": "local-template",
    "resolvedMode": "template-renderer"
  },
  "orchestration": {
    "requestId": "req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "runId": "run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "workflow": {
      "id": "talent-intelligence.local-template-render",
      "version": "v0.4",
      "executionMode": "local-template",
      "runnerId": "local-template",
      "futureHook": "workflowRunner.execute"
    },
    "execution": {
      "status": "completed",
      "runnerId": "local-template",
      "boundary": "local-only",
      "stepCount": 1,
      "steps": [
        {
          "id": "render-template",
          "kind": "template-render",
          "runnerId": "local-template",
          "status": "completed",
          "startedAt": "2026-03-15T00:00:00.000Z",
          "completedAt": "2026-03-15T00:00:00.000Z",
          "durationMs": 0,
          "output": {
            "renderer": "renderTemplate",
            "templateId": "sourcing_strategy_cn"
          }
        }
      ],
      "result": {
        "renderer": "renderTemplate",
        "templateId": "sourcing_strategy_cn"
      }
    },
    "selection": {
      "requestedMode": "openai",
      "requestedRunner": "local-template",
      "resolvedRunnerId": "local-template",
      "strategy": "requested-runner",
      "fallbackApplied": false,
      "fallbackReason": "Local template runner is the executable backend bundled with this local-only service."
    }
  }
}
```

### Success response notes

- `requestId` is stable across the response envelope and metadata.
- `run.id` and `metadata.runId` refer to the same execution run.
- `run.runnerId`, `engine.runnerId`, and `metadata.runnerId` identify the concrete backend runner that executed the request.
- `reportMarkdown` contains the generated report body returned by the backend.
- Persistence is external to the HTTP contract: the CLI may write `reportMarkdown` to `state/`, but the service does not promise a server-side file write.
- `mode` is the public response mode; `engine.executionMode` and `orchestration.workflow.executionMode` show the internal execution path.
- `orchestration.selection` records how request mode/runner selection resolved.

## Error contract

### Invalid template

From `examples/error-invalid-template.json`:

```json
{
  "ok": false,
  "requestId": "req_2fd1f9b2-3ad1-4d69-a6f2-50cbb2b6d709",
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
  },
  "metadata": {
    "requestId": "req_2fd1f9b2-3ad1-4d69-a6f2-50cbb2b6d709",
    "apiVersion": "v0.4",
    "status": 400,
    "timestamp": "2026-03-15T00:00:00.000Z"
  }
}
```

### Missing role title

From `examples/error-missing-role-title.json`:

```json
{
  "ok": false,
  "requestId": "req_0c9f7f72-e79b-41de-b0fd-f1cec4e0fe28",
  "error": {
    "code": "MISSING_ROLE_TITLE",
    "message": "searchContext.roleTitle is required.",
    "details": {
      "field": "searchContext.roleTitle"
    }
  },
  "metadata": {
    "requestId": "req_0c9f7f72-e79b-41de-b0fd-f1cec4e0fe28",
    "apiVersion": "v0.4",
    "status": 400,
    "timestamp": "2026-03-15T00:00:00.000Z"
  }
}
```

### Invalid JSON

From `examples/error-invalid-json.json`:

```json
{
  "ok": false,
  "requestId": "req_f64c1f72-e79b-41de-b0fd-f1cec4e0fe28",
  "error": {
    "code": "INVALID_JSON",
    "message": "Request body must be valid JSON.",
    "details": {
      "raw": "{\"templateId\": }"
    }
  },
  "metadata": {
    "requestId": "req_f64c1f72-e79b-41de-b0fd-f1cec4e0fe28",
    "apiVersion": "v0.4",
    "status": 400,
    "timestamp": "2026-03-15T00:00:00.000Z"
  }
}
```

### Error response notes

- Error payloads use `metadata.status`, not a top-level `status` field.
- Unknown routes return `NOT_FOUND` with HTTP 404 and the same error envelope pattern.
- The HTTP status code and `metadata.status` should match.

## Curl examples

### Health

```bash
curl http://127.0.0.1:8788/health
```

### Schema

```bash
curl http://127.0.0.1:8788/api/talent-intelligence/schema
```

### Run with example payload

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data @examples/run-request.json
```

### Supply your own request id

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  -H 'X-Request-Id: req_demo_manual_id' \
  --data @examples/run-request.json
```

### Trigger invalid-template error

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data '{"templateId":"bad_template","searchContext":{"roleTitle":"VP Product"}}'
```

### Trigger missing-role-title error

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data '{"templateId":"sourcing_strategy_cn","searchContext":{"roleTitle":"   "}}'
```

## Notes

- Current engine is a **local workflow runner** with a template-render execution step.
- The service returns reports inline and leaves persistence policy to the caller.
- Future backend implementations should preserve this request/response envelope unless there is an intentional version bump.
