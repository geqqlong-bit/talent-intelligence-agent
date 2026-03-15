# Mock backend

This folder contains a minimal local backend for demo and wiring validation.

## Start

```bash
node server/mock-backend.mjs
```

Default port: `8788`

## Endpoints

- `GET /health`
- `POST /api/talent-intelligence/run`

The backend returns template-based markdown so the full local chain can be tested before a real multi-agent workflow engine exists.
