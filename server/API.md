# Talent Intelligence Service API

## Base URL

Local default:

```text
http://127.0.0.1:8788
```

## Version note

The live server currently returns `apiVersion: "v0.11"`.

What changed in the backend is the addition of **trusted candidate assessment validation** on top of the existing parallel worker pool. In other words:
- the public HTTP envelope is now v0.11
- candidate assessment can request structured JSON for evidence-first trusted assessment validation
- the local mock-provider path now validates rubric + evidence + confidence markers end-to-end
- batch candidate assessment via `searchContext.candidates` and `runtime.maxConcurrency` remains available
- token usage and performance metrics are still aggregated across parallel evaluations when batch mode is used

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
Runs one talent-intelligence workflow request.

Canonical request/response examples:
- `examples/run-request.json`
- `examples/run-response.json`
- `examples/run-response-remote-success.json` - Example with detailed LLM metrics and token usage

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

There are **two separate persistence layers**:

1. **HTTP server persistence** — automatic on every successful run
   - writes `request.json`, `response.json`, `report.md`, and `events.log`
   - location: `state/runs/YYYY/MM/DD/run_*`
   - returned in the response as `artifacts.rootDir` and `artifacts.files.*`

2. **CLI persistence** — optional extra write when `--out <path>` is supplied
   - writes a caller-chosen markdown file
   - independent from the server-managed `state/runs/...` artifacts

So `reportMarkdown` is always returned inline, and successful HTTP runs also persist run artifacts server-side.

## Canonical example files

These sample payloads are kept in `examples/` and should stay aligned with the documented contract:

- `examples/health-response.json`
- `examples/schema-response.json`
- `examples/run-request.json`
- `examples/run-response.json`
- `examples/run-response-remote-success.json`
- `examples/run-request-batch-candidates.json` - NEW in v0.9: Example request with multiple candidates for parallel processing
- `examples/run-request-trusted-assessment.json` - NEW in v0.11: trusted candidate-assessment request
- `examples/run-response-trusted-assessment.json` - NEW in v0.11: trusted candidate-assessment response
- `examples/run-response-batch-candidates.json` - NEW in v0.9: Example response from parallel candidate assessment
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

Important runtime notes:
- A remote call is attempted only when the request explicitly selects the remote adapter (`openai-chat`, `openai`, `llm`, or `remote`) **and** outbound remote execution is enabled via `runtime.allowRemote=true`, `runtime.remoteEnabled=true`, or `TALENT_INTEL_ENABLE_REMOTE_RUNNER=1`.
- Server-side fallback/readiness logic uses `TALENT_INTEL_REMOTE_BASE_URL`, `TALENT_INTEL_REMOTE_API_KEY`, `TALENT_INTEL_REMOTE_PATH`, `TALENT_INTEL_REMOTE_ORG`, and `TALENT_INTEL_REMOTE_PROJECT`.
- If remote execution is allowed but the call fails at runtime, the service falls back to `local-template` unless `remoteRequired=true`.

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

## Success response contract

From `examples/run-response.json`:

### Multi-Stage LLM Pipeline and Structured JSON Output

The v0.8 backend implements a comprehensive multi-stage execution pipeline with structured JSON output for all processing stages:

#### Execution Stages
The system now processes requests through 4 distinct stages:

1. **ingest-request** - Captures and normalizes the incoming request
2. **build-brief** - Constructs the structured workflow brief
3. **llm-generation** - Executes LLM processing (when using `openai-chat` runner) or template rendering (when using `local-template` runner)
4. **finalize-response** - Packages the final response and artifacts

#### Structured JSON Output Capabilities
Each stage now produces structured JSON output with:

- Stage-level metrics and timing information
- Step-by-step execution tracking
- Artifact lineage with dependencies between stages
- Comprehensive token usage tracking across all stages
- Detailed performance metrics at each execution phase

#### Enhanced Orchestration Data
The response now includes detailed orchestration information in `orchestration.execution`:

- `stages[]` - Array of all execution stages with status, timing, and dependencies
- `steps[]` - Detailed step-by-step execution with metrics and output tracking
- `artifacts[]` - Complete artifact lineage showing all intermediate and final outputs
- `metrics` - Aggregated performance metrics across all stages

#### LLM Prompt/Generation Phase and Metrics

When using the `openai-chat` runner (remote LLM execution), the response includes comprehensive metrics about the LLM interaction:

- `remoteInfo` object contains:
  - `attempted`: boolean indicating if remote call was attempted
  - `succeeded`: boolean indicating if remote call succeeded
  - `baseUrl`: the LLM provider endpoint used
  - `path`: the API path called
  - `model`: the model used for generation
  - `startedAt`: ISO timestamp when the request started
  - `completedAt`: ISO timestamp when the request completed
  - `durationMs`: total round-trip time in milliseconds
  - `responseId`: the provider's unique response identifier
  - `finishReason`: how the generation completed (e.g., "stop", "length", "content_filter")
  - `usage`: token usage statistics with:
    - `prompt_tokens`: number of tokens in the input prompt
    - `completion_tokens`: number of tokens in the generated response
    - `total_tokens`: total tokens consumed (input + output)

#### v0.11 Trusted Assessment Structure

The `candidate_assessment_cn` template in v0.11 includes enhanced structured assessment data in the `candidateAssessment` field:

- `assessmentType`: `"trusted_assessment"` for v0.11+ structured assessments
- `confidence`: Object containing:
  - `score`: Numerical confidence score (0.0-1.0)
  - `label`: Text label (e.g., "low", "medium", "high", "medium-high")
  - `rationale`: Explanation of confidence level
- `dimensions`: Array of assessment rubric dimensions, each containing:
  - `key`: Unique identifier for the assessment dimension
  - `label`: Display label for the dimension
  - `judgement`: The assessment judgment for this dimension
  - `confidence`: Confidence level for this specific dimension
  - `evidenceQuotes`: Array of direct quotes from candidate materials supporting the assessment
  - `evidenceStatus`: Status of evidence (e.g., "证据充分", "证据有限", "信息不足")
  - `missingInformation`: Array of information gaps identified
- `evidence`: Array of evidence claims with:
  - `claim`: The assessment claim made
  - `support`: Supporting evidence from candidate materials
  - `quality`: Quality rating of the evidence
- `overallRisks`: Array of overall risks identified during assessment
- `followUpQuestions`: Specific questions to validate assessment conclusions
- `strengths` and `concerns`: Organized lists of candidate strengths and concerns

#### Structured Artifact Tracking
All execution paths now include comprehensive artifact tracking:

- `artifacts[]` in `orchestration.execution` tracks all intermediate and final outputs
- Each artifact includes metadata about its producer, dependencies, and content preview
- Artifact lineage enables traceability from initial request to final output
- Structured metadata includes type, MIME type, stage association, and production details

#### Parallel Worker Pool and Batch Candidate Processing (NEW in v0.9)
The v0.9 backend introduces a parallel worker pool for concurrent candidate assessments:

##### Batch Candidate Submission
- Submit an array of candidates using the `searchContext.candidates` field
- Each candidate in the array is processed concurrently using the parallel worker pool
- Significantly reduces total processing time for batch evaluations compared to sequential processing
- Default maximum concurrency is 5 workers; configurable via `runtime.maxConcurrency`

##### Example Candidates Array
```json
{
  "searchContext": {
    "roleTitle": "Senior Software Engineer",
    "candidates": [
      {
        "name": "Candidate A",
        "summary": "10 years experience with React and Node.js",
        "experience": "Lead developer at Tech Corp",
        "skills": ["JavaScript", "React", "Node.js", "MongoDB"],
        "highlights": ["Led team of 5 developers", "Reduced load time by 40%"],
        "concerns": ["Limited Python experience"]
      },
      {
        "name": "Candidate B", 
        "summary": "8 years experience with Python and Django",
        "experience": "Senior engineer at Startup Inc",
        "skills": ["Python", "Django", "PostgreSQL", "AWS"],
        "highlights": ["Built microservices architecture", "Improved deployment speed"],
        "concerns": ["Limited frontend experience"]
      }
    ]
  }
}
```

##### Performance Benefits
- Concurrent processing of multiple candidates
- Configurable worker pool size via `maxConcurrency`
- Aggregated metrics and token usage across all evaluations
- Reduced wall-clock time for batch assessments

### Local Template Runner

When using the `local-template` runner, the response follows the same multi-stage structure but with template rendering instead of LLM generation, maintaining consistent structured JSON output across all execution modes.

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
    "runnerId": "local-template",
    "stageCount": 4,
    "stepCount": 4,
    "artifactCount": 4,
    "finalArtifactId": "report-markdown"
  },
  "engine": {
    "kind": "local-template-engine",
    "version": "v0.8",
    "provider": "local",
    "adapter": "template-renderer",
    "runnerId": "local-template",
    "executionMode": "local-template",
    "requestedMode": "openai",
    "requestedRunner": "openai-chat",
    "preferredRunnerId": "openai-chat",
    "requestedModel": "bailian/qwen3.5-plus",
    "resolvedMode": "template-renderer",
    "implementationStatus": "standby",
    "resolutionSource": "runner",
    "fallbackApplied": true,
    "fallbackKind": "runner-unavailable",
    "fallbackReason": "Requested runner openai-chat is not callable for this request; using local-template instead. Remote runner configuration exists, but outbound calls remain disabled until explicitly enabled.",
    "boundary": "local-only",
    "remote": {
      "readiness": "configured-but-disabled",
      "enabled": false,
      "configured": true,
      "callable": false,
      "required": false,
      "explicitRemoteRequest": true,
      "baseUrl": "http://127.0.0.1:8999/v1",
      "path": "/chat/completions",
      "model": "bailian/qwen3.5-plus"
    }
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
    "apiVersion": "v0.8",
    "startedAt": "2026-03-15T00:00:00.000Z",
    "completedAt": "2026-03-15T00:00:00.000Z",
    "durationMs": 3,
    "workflowId": "talent-intelligence.local-template-render",
    "workflowVersion": "v0.8",
    "runnerId": "local-template",
    "executionMode": "local-template",
    "executionStatus": "completed",
    "requestedMode": "openai",
    "requestedRunner": "openai-chat",
    "preferredRunnerId": "openai-chat",
    "resolvedMode": "template-renderer",
    "fallbackApplied": true,
    "fallbackKind": "runner-unavailable",
    "fallbackReason": "Requested runner openai-chat is not callable for this request; using local-template instead. Remote runner configuration exists, but outbound calls remain disabled until explicitly enabled.",
    "stageCount": 4,
    "stepCount": 4,
    "artifactCount": 4,
    "finalArtifactId": "report-markdown"
  },
  "orchestration": {
    "requestId": "req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "runId": "run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "workflow": {
      "id": "talent-intelligence.local-template-render",
      "version": "v0.8",
      "executionMode": "local-template",
      "runnerId": "local-template",
      "futureHook": "workflowRunner.execute"
    },
    "execution": {
      "status": "completed",
      "runnerId": "local-template",
      "boundary": "local-only",
      "stageCount": 4,
      "stepCount": 4,
      "finalArtifactId": "report-markdown",
      "result": {
        "renderer": "renderTemplate",
        "templateId": "sourcing_strategy_cn",
        "artifactId": "report-markdown",
        "finalizationArtifactId": "run-summary"
      }
    },
    "selection": {
      "requestedMode": "openai",
      "requestedRunner": "openai-chat",
      "preferredRunnerId": "openai-chat",
      "resolvedRunnerId": "local-template",
      "resolvedMode": "template-renderer",
      "resolutionSource": "runner",
      "strategy": "requested-runner",
      "fallbackApplied": true,
      "fallbackKind": "runner-unavailable",
      "fallbackReason": "Requested runner openai-chat is not callable for this request; using local-template instead. Remote runner configuration exists, but outbound calls remain disabled until explicitly enabled."
    }
  },
  "artifacts": {
    "rootDir": "/absolute/path/to/state/runs/YYYY/MM/DD/run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "files": {
      "request": "/absolute/path/to/state/runs/YYYY/MM/DD/run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/request.json",
      "response": "/absolute/path/to/state/runs/YYYY/MM/DD/run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/response.json",
      "reportMarkdown": "/absolute/path/to/state/runs/YYYY/MM/DD/run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/report.md",
      "events": "/absolute/path/to/state/runs/YYYY/MM/DD/run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/events.log"
    }
  }
}
```

### Success response notes

- `requestId` is stable across the response envelope and metadata.
- `run.id` and `metadata.runId` refer to the same execution run.
- `run.runnerId`, `engine.runnerId`, and `metadata.runnerId` identify the concrete backend runner that executed the request.
- `reportMarkdown` contains the generated report body returned by the backend.
- `artifacts.*` points to the server-persisted run files.
- `mode` is the public response mode; `engine.executionMode` and `orchestration.workflow.executionMode` show the internal execution path.
- `orchestration.selection` records how request mode/runner selection resolved, including fallback.

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
    "apiVersion": "v0.8",
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
    "apiVersion": "v0.8",
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
    "apiVersion": "v0.8",
    "status": 400,
    "timestamp": "2026-03-15T00:00:00.000Z"
  }
}
```

### Error response notes

- Error payloads use `metadata.status`, not a top-level `status` field.
- Unknown routes return `NOT_FOUND` with HTTP 404 and the same error envelope pattern.
- Additional tightened validation/runtime errors include `INVALID_RUNNER`, `INVALID_RUNTIME_MODE`, `INVALID_REQUEST`, `REQUEST_READ_ERROR`, `UNSUPPORTED_EXECUTION_RUNNER`, and `REMOTE_RUNNER_REQUIRED_BUT_UNAVAILABLE`.
- Failed runs are also persisted under `state/runs/...`, with `error.json` and `events.log`.
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

## Testing and Validation

### Trusted Assessment Validation

Validate the v0.11 trusted assessment flow with mock provider:

```bash
# Basic validation
bash demo/validate-trusted-assessment.sh

# Comprehensive validation with local script
node scripts/validate-trusted-assessment-local.mjs

# Full end-to-end test with detailed output
bash scripts/test-trusted-assessment-flow.sh
```

These scripts validate that the full rubric + evidence + confidence flow works correctly with mock providers.

## Notes

- Current executable engine is the **local workflow runner** with a template-render execution path.
- The published `openai-chat` adapter is a real harness, but it is gated: it runs only when remote execution is explicitly enabled and configured.
- When remote execution is not callable, normal requests fall back to `local-template`; strict requests can opt out of fallback with `remoteRequired=true`.
- Future backend implementations should preserve this request/response envelope unless there is an intentional version bump.
