# Talent Intelligence Service API - v0.11

## Base URL

Local default:

```text
http://127.0.0.1:8788
```

## Version note

The live server currently returns `apiVersion: "v0.11"`.

What changed in the backend is the addition of **trusted candidate assessment output** on top of the existing async job support. In other words:
- the public HTTP envelope is now v0.11
- trusted assessment requests can validate an evidence-first result shape for candidate assessment workflows
- local mock-provider validation now covers rubric + evidence + confidence
- new async endpoints `/api/talent-intelligence/jobs` and `/api/talent-intelligence/jobs/{jobId}` are available
- support for webhook notifications when jobs complete via the `webhookUrl` parameter
- improved scalability for long-running operations with background job processing
- the existing synchronous `/api/talent-intelligence/run` endpoint remains available for immediate processing needs

## Endpoints

### `GET /health`
Returns service health, request metadata, and the current execution catalog.

Canonical example: `examples/health-response.json`

Key fields exposed under `execution`:
- `mode`
- `workflowId`
- `defaultRequestMode`
- `defaultRunnerId`
- `defaultPublicMode`
- `supportedRequestModes`
- `supportedRunnerIds`
- `plannedRunnerIds`
- `runners`

### `GET /api/talent-intelligence/schema`
Returns supported templates, endpoints, the execution catalog, plus success/error response shapes.

Canonical example: `examples/schema-response.json`

### `POST /api/talent-intelligence/run`
Runs one talent-intelligence workflow request synchronously.

Canonical request/response examples:
- `examples/run-request.json`
- `examples/run-response.json`
- `examples/run-response-remote-success.json` - Example with detailed LLM metrics and token usage

### `POST /api/talent-intelligence/jobs`
Creates a new asynchronous job for talent intelligence processing. This endpoint allows long-running operations to be processed in the background.

Request body format:
```json
{
  "templateId": "sourcing_strategy_cn",
  "searchContext": { "...": "..." },
  "runtime": { "...": "..." },
  "webhookUrl": "https://your-domain.com/webhook/endpoint"
}
```

The `webhookUrl` parameter is optional and specifies where completion notifications should be sent.

Response:
```json
{
  "ok": true,
  "requestId": "req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "jobId": "job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "pending",
  "createdAt": "2026-03-15T00:00:00.000Z",
  "webhookUrl": "https://your-domain.com/webhook/endpoint"
}
```

### `GET /api/talent-intelligence/jobs/{jobId}`
Retrieves the status and result of a specific asynchronous job.

Path parameter:
- `jobId`: The unique identifier of the job to retrieve

Response:
```json
{
  "ok": true,
  "jobId": "job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "completed", // pending, processing, completed, failed
  "progress": 100, // percentage complete (0-100)
  "result": { /* same format as synchronous response */ },
  "error": null, // populated if status is "failed"
  "createdAt": "2026-03-15T00:00:00.000Z",
  "updatedAt": "2026-03-15T00:05:00.000Z",
  "completedAt": "2026-03-15T00:05:00.000Z" // only present when status is completed or failed
}
```

## Webhook Notification

When a `webhookUrl` is provided during job creation, the service will send a POST request to that URL upon job completion. The webhook payload contains:

```json
{
  "jobId": "job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "completed", // completed or failed
  "result": { /* same format as GET /api/talent-intelligence/jobs/{jobId} result */ },
  "error": null, // populated if status is "failed"
  "completedAt": "2026-03-15T00:05:00.000Z"
}
```

The service expects a 2xx HTTP response from the webhook endpoint to consider the notification successful. Retry logic is not currently implemented.

## Execution and fallback semantics

The server publishes two runners today:

- `local-template` — executable now
- `openai-chat` — executable only when the remote runner is explicitly enabled and configured

Resolution rules in `server/app/execution.mjs`:

1. If `runtime.runner` or `runtime.runnerId` matches a known runner, that match wins.
2. Otherwise the server tries to resolve by `runtime.executionMode` or `runtime.mode`.
3. If the chosen runner is unavailable and `runtime.remoteRequired !== true`, the server falls back to `local-template`.
4. If the chosen remote runner is unavailable and `runtime.remoteRequired === true`, the server returns `REMOTE_RUNNER_REQUIRED_BUT_UNAVAILABLE` with HTTP 503.
5. The response records the outcome in both:
   - `engine.*`
   - `orchestration.selection.*`

Typical fallback example:
- request: `runtime.mode = "openai"`, `runtime.runner = "openai-chat"`
- resolved runner: `local-template`
- resolved public mode: `template-renderer`
- `fallbackApplied = true`
- `fallbackKind = "runner-unavailable"`
- `fallbackReason = "Requested runner openai-chat is not callable for this request; using local-template instead. Remote runner is disabled by default; set runtime.allowRemote=true or TALENT_INTEL_ENABLE_REMOTE_RUNNER=1 to allow outbound calls."`

## Persistence behavior

There are **three persistence layers**:

1. **HTTP server persistence** — automatic on every successful run
   - writes `request.json`, `response.json`, `report.md`, and `events.log`
   - location: `state/runs/YYYY/MM/DD/run_*`
   - returned in the response as `artifacts.rootDir` and `artifacts.files.*`

2. **Async job persistence** — automatic for all async jobs
   - stores job status, progress, and results in memory (in production, this would use a database)
   - retention: 30 days for completed jobs

3. **CLI persistence** — optional extra write when `--out <path>` is supplied
   - writes a caller-chosen markdown file
   - independent from the server-managed `state/runs/...` artifacts

So `reportMarkdown` is always returned inline for synchronous requests, and successful HTTP runs also persist run artifacts server-side.

## Canonical example files

These sample payloads are kept in `examples/` and should stay aligned with the documented contract:

- `examples/health-response.json`
- `examples/schema-response.json`
- `examples/run-request.json`
- `examples/run-response.json`
- `examples/run-response-remote-success.json`
- `examples/run-request-batch-candidates.json` - NEW in v0.9: Example request with multiple candidates for parallel processing
- `examples/run-response-batch-candidates.json` - NEW in v0.9: Example response from parallel candidate assessment
- `examples/error-invalid-template.json`
- `examples/error-missing-role-title.json`
- `examples/error-invalid-json.json`
- `examples/run-request-trusted-assessment.json` - NEW in v0.11: Candidate trusted-assessment request for local validation
- `examples/run-response-trusted-assessment.json` - NEW in v0.11: Candidate trusted-assessment response captured from local mock-provider validation
- `examples/job-create-request.json` - NEW in v0.10: Example request for creating an async job
- `examples/job-create-response.json` - NEW in v0.10: Example response from job creation
- `examples/job-status-response.json` - NEW in v0.10: Example response from job status query
- `examples/webhook-notification.json` - NEW in v0.10: Example webhook payload

## Request contract

Top-level shape for both sync and async endpoints:

```json
{
  "templateId": "sourcing_strategy_cn",
  "searchContext": { "...": "..." },
  "runtime": { "...": "..." },
  "webhookUrl": "https://your-domain.com/webhook/endpoint" // only for async jobs
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
- `candidates` - **NEW in v0.9**: An array of candidate objects for batch processing. When provided, enables parallel worker pool execution for concurrent candidate assessments. Each candidate object should contain fields like `name`, `summary`, `experience`, `skills`, `highlights`, `concerns`, etc.

### Runtime fields currently recognized

- `mode` — defaults to `openai`
- `executionMode`
- `runner`
- `runnerId`
- `baseUrl`
- `apiKey`
- `path`
- `organization`
- `project`
- `allowRemote`
- `remoteEnabled`
- `remoteRequired`
- `model` — defaults to `process.env.TALENT_INTEL_DEFAULT_MODEL` or `bailian/qwen3.5-plus`
- `temperature` — defaults to `0.4`
- `maxTokens` — defaults to `5000`
- `timeoutMs` — defaults to `120000`
- `responseFormat` — specifies the desired response format (e.g., `{ type: "json_object" }` for JSON)
- `jsonMode` — when true, forces JSON object response format
- `maxConcurrency` — **NEW in v0.9**: Maximum number of concurrent worker threads for parallel candidate processing (defaults to 5)

### Async Job fields

- `webhookUrl` — **NEW in v0.10**: Optional URL to receive completion notifications when the job finishes processing
- `jsonMode` / `responseFormat={"type":"json_object"}` — use this on `candidate_assessment_cn` to validate trusted assessment output locally

Important runtime notes:
- A remote call is attempted only when the request explicitly selects the remote adapter (`openai-chat`, `openai`, `llm`, or `remote`) **and** outbound remote execution is enabled via `runtime.allowRemote=true`, `runtime.remoteEnabled=true`, or `TALENT_INTEL_ENABLE_REMOTE_RUNNER=1`.
- Server-side fallback/readiness logic uses `TALENT_INTEL_REMOTE_BASE_URL`, `TALENT_INTEL_REMOTE_API_KEY`, `TALENT_INTEL_REMOTE_PATH`, `TALENT_INTEL_REMOTE_ORG`, and `TALENT_INTEL_REMOTE_PROJECT`.
- If remote execution is allowed but the call fails at runtime, the service falls back to `local-template` unless `remoteRequired=true`.

## Example requests

### Synchronous request

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
    "runner": "openai-chat",
    "baseUrl": "http://127.0.0.1:8999/v1",
    "apiKey": "test-key",
    "allowRemote": false,
    "model": "bailian/qwen3.5-plus",
    "temperature": 0.4,
    "maxTokens": 5000,
    "timeoutMs": 120000
  }
}
```

### Asynchronous job creation

From `examples/job-create-request.json`:

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
    "runner": "openai-chat",
    "baseUrl": "http://127.0.0.1:8999/v1",
    "apiKey": "test-key",
    "allowRemote": true,
    "model": "bailian/qwen3.5-plus",
    "temperature": 0.4,
    "maxTokens": 5000,
    "timeoutMs": 120000
  },
  "webhookUrl": "https://your-app.com/webhooks/talent-intel-completed"
}
```

## Success response contract

### Synchronous Response

Same as v0.9 response format (documented above).

### Asynchronous Job Creation Response

From `examples/job-create-response.json`:

```json
{
  "ok": true,
  "requestId": "req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "jobId": "job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "pending",
  "createdAt": "2026-03-15T00:00:00.000Z",
  "webhookUrl": "https://your-app.com/webhooks/talent-intel-completed"
}
```

### Job Status Query Response

From `examples/job-status-response.json`:

```json
{
  "ok": true,
  "jobId": "job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "completed",
  "progress": 100,
  "result": {
    // Same structure as synchronous response when completed
  },
  "error": null,
  "createdAt": "2026-03-15T00:00:00.000Z",
  "updatedAt": "2026-03-15T00:05:00.000Z",
  "completedAt": "2026-03-15T00:05:00.000Z"
}
```

### Webhook Notification Payload

From `examples/webhook-notification.json`:

```json
{
  "jobId": "job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "completed",
  "result": {
    // Same structure as synchronous response
  },
  "error": null,
  "completedAt": "2026-03-15T00:05:00.000Z"
}
```

## Curl examples

### Health

```bash
curl http://127.0.0.1:8788/health
```

### Schema

```bash
curl http://127.0.0.1:8788/api/talent-intelligence/schema
```

### Synchronous run with example payload

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data @examples/run-request.json
```

### Create async job

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/jobs \
  -H 'Content-Type: application/json' \
  --data @examples/job-create-request.json
```

### Check async job status

```bash
curl http://127.0.0.1:8788/api/talent-intelligence/jobs/job_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Supply your own request id

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  -H 'X-Request-Id: req_demo_manual_id' \
  --data @examples/run-request.json
```

### Run trusted candidate assessment (v0.11)

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data @examples/run-request-trusted-assessment.json
```

### Run with batch candidate assessment (v0.9 parallel worker pool)

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data @examples/run-request-batch-candidates.json
```

### Create async job with webhook

```bash
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/jobs \
  -H 'Content-Type: application/json' \
  --data '{
    "templateId": "sourcing_strategy_cn",
    "searchContext": {
      "roleTitle": "VP Product",
      "companyContext": "AI startup",
      "hiringBrief": "Find product leader for scaling team"
    },
    "webhookUrl": "https://your-app.com/webhooks/talent-intel-completed"
  }'
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

- Current executable engine is the **local workflow runner** with a template-render execution path.
- The published `openai-chat` adapter is a real harness, but it is gated: it runs only when remote execution is explicitly enabled and configured.
- When remote execution is not callable, normal requests fall back to `local-template`; strict requests can opt out of fallback with `remoteRequired=true`.
- The new async API endpoints (`/api/talent-intelligence/jobs`) allow long-running operations to be processed in the background with optional webhook notifications.
- The synchronous `/api/talent-intelligence/run` endpoint remains available for immediate processing needs.
- Future backend implementations should preserve this request/response envelope unless there is an intentional version bump.