# Talent Intelligence backend service

This folder now contains a **real local service skeleton**, not just a single mock file.

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

## Endpoints

- `GET /health`
- `GET /api/talent-intelligence/schema`
- `POST /api/talent-intelligence/run`

## Current architecture

- `routes.mjs` handles HTTP
- `schema.mjs` validates and normalizes input
- `service.mjs` is the future integration point for a real workflow engine
- `templates.mjs` provides the current local rendering implementation

The point of this split is simple: keep the API stable while swapping out the execution engine later.
