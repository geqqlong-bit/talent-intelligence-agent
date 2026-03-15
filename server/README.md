# Talent Intelligence backend service

This folder contains the local HTTP service skeleton that the CLI can call today.

## Structure

```text
server/
├── index.mjs              # HTTP server entry
├── mock-backend.mjs       # compatibility entry for existing demo scripts
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

- `examples/run-request.json`
- `examples/run-response.json`
- `examples/error-invalid-template.json`
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

What to expect from the live v0.2 contract:

- every response includes a `requestId`
- success responses include `run`, `engine`, `metadata`, and `orchestration`
- error responses place HTTP status info in `metadata.status`

## Current architecture

- `routes.mjs` handles HTTP routing and response codes
- `schema.mjs` validates and normalizes input
- `service.mjs` is the integration seam for a future real workflow engine
- `templates.mjs` provides the current local rendering implementation

The point of this split is simple: keep the HTTP contract stable while swapping out the execution engine later.
