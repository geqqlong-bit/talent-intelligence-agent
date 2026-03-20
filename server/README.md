# Talent Intelligence backend service

This folder contains the local HTTP service skeleton that the CLI can call today.

## Structure

```text
server/
├── index.mjs              # HTTP server entry
├── mock-backend.mjs       # compatibility entry for existing demo scripts
├── mock-openai-provider.mjs # local OpenAI-compatible mock for offline remote-runner tests
├── API.md                 # request / response contract
└── app/
    ├── routes.mjs         # routing layer
    ├── schema.mjs         # request normalization + validation
    ├── service.mjs        # service orchestration boundary
    └── templates.mjs      # current local template engine
```

## Start

```bash
node server/index.mjs
```

Default port: `8788`

You can also override it with:

```bash
export TALENT_INTEL_PORT=8788
```

## Endpoints

- `GET /health`
- `GET /api/talent-intelligence/schema`
- `POST /api/talent-intelligence/run`

## Example files

Canonical request/response/error examples now live in the repo root `examples/` folder:

- `examples/health-response.json`
- `examples/schema-response.json`
- `examples/run-request.json`
- `examples/run-response.json`
- `examples/run-response-remote-success.json` - Example with detailed LLM metrics and token usage
- `examples/error-invalid-template.json`
- `examples/error-missing-role-title.json`
- `examples/error-invalid-json.json`

These are referenced from `server/API.md` and are intended to stay aligned with the live code contract.

## Quick manual validation

Start the service in one shell:

```bash
node server/index.mjs
```

Then in another shell:

```bash
curl http://127.0.0.1:8788/health
curl http://127.0.0.1:8788/api/talent-intelligence/schema
curl -X POST http://127.0.0.1:8788/api/talent-intelligence/run \
  -H 'Content-Type: application/json' \
  --data @examples/run-request.json
```

What to expect from the live v0.11 contract:

- every response includes a `requestId`
- `/health` and `/schema` expose the execution catalog and supported request modes
- success responses include `run`, `engine`, `metadata`, `orchestration`, and `artifacts`, with `runnerId` on run/engine/metadata
- each run is persisted locally under `state/runs/YYYY/MM/DD/<runId>/`
- persisted success artifacts include `request.json`, `response.json`, `report.md`, and `events.log`
- failed `/run` requests also write a local error record under the same dated tree
- error responses place HTTP status info in `metadata.status`
- whitespace-only `searchContext.roleTitle` requests return `MISSING_ROLE_TITLE`
- comprehensive performance metrics are included in `metadata.performance`, `orchestration.execution.metrics`, and step-level metrics
- token usage (prompt/completion/total) is tracked and reported for both local and remote execution paths
- duration metrics are captured at request, execution, and step levels
- LLM generation responses include detailed token usage, latency metrics, and generation statistics when using the `openai-chat` runner
- remote execution metrics are captured in `remoteInfo` with `responseId`, `finishReason`, `usage`, and timing details
- step-level metrics are available in `orchestration.execution.steps[].metrics` with duration and token usage where applicable
- v0.8 introduces a multi-stage execution pipeline with 4 distinct stages: ingest-request, build-brief, llm-generation, and finalize-response
- structured JSON output is provided consistently across all execution modes with detailed orchestration data
- comprehensive artifact tracking now includes complete lineage showing all intermediate and final outputs with dependencies between stages
- enhanced stage-by-stage metrics capture performance data throughout the entire multi-stage pipeline
- v0.9 introduces parallel candidate assessment capabilities with configurable concurrency via `runtime.maxConcurrency`
- v0.10 introduces asynchronous job processing endpoints (`POST /api/talent-intelligence/jobs`, `GET /api/talent-intelligence/jobs/{jobId}`) for long-running operations
- v0.11 adds trusted candidate-assessment validation via structured JSON output and local mock-provider coverage
- v0.10 adds webhook notification support via the `webhookUrl` parameter for event-driven completion notifications
- async jobs are stored in memory with automatic cleanup after 30 days

## Current architecture

- `routes.mjs` handles HTTP routing and response codes
- `schema.mjs` validates and normalizes input
- `service.mjs` builds request context and delegates execution to the runner boundary
- `execution.mjs` contains the local workflow runner registry, selection logic, and executable runner implementation
- `templates.mjs` provides the current local rendering implementation

The point of this split is simple: keep the HTTP contract stable while making the execution boundary real and swappable later.

## Offline remote-runner harness

To integration-test the `openai-chat` adapter without external internet:

For v0.11 trusted assessment validation:

```bash
bash demo/validate-trusted-assessment.sh
```

That test asserts the final report contains explicit rubric, evidence, and confidence markers.


```bash
bash demo/test-remote-harness.sh
```

That smoke test starts:
- `server/mock-openai-provider.mjs`
- `server/index.mjs` with `TALENT_INTEL_ENABLE_REMOTE_RUNNER=1`
- a POST run using `examples/run-request-remote-mock.json`

It then asserts that the backend stayed on runner `openai-chat`, remote execution succeeded, and no fallback to `local-template` occurred.
