# TypeScript Refactoring & Vitest Integration Plan

## Objective
Refactor existing core logic in `talent-intelligence-agent` from pure `.mjs` files to strictly typed TypeScript (`.ts`). Setup Vitest for testing, Biome for formatting/linting, and utilize `pnpm` as the package manager according to the core behavior guidelines.

## Phase 1: Environment & Tooling Setup
- [x] Initialize `pnpm` project and migrate dependencies from `npm`.
- [x] Install dev dependencies: `typescript`, `@types/node`, `vitest`, `@biomejs/biome`, `tsx`.
- [x] Create `tsconfig.json` (strict node configuration).
- [x] Create `biome.json` for linting and formatting.
- [x] Update `package.json` scripts (`typecheck`, `format`, `test`, `start` using `tsx` or Node `--experimental-strip-types`).

## Phase 2: Core Domain Refactoring (src/tia/)
Migrate and strongly type the core domain logic:
- [x] `src/tia/repository.ts` (Previously `.mjs`) - Define db types.
- [x] `src/tia/demo-repository.ts` - Implement db interfaces.
- [x] `src/tia/service-container.ts` - Type DI container.
- [x] `src/tia/browser-service.ts` - Type browser search/import interfaces.
- [x] Fix over-sized files: split code if it exceeds 300 lines limit.

## Phase 3: Core Tests Migration (tests/)
- [x] Move `tests/tia-services.test.mjs` to `tests/tia-services.test.ts` using Vitest format.
- [x] Setup `vitest.config.ts`.
- [x] Ensure all tests pass.

## Phase 4: Server API TypeScript Support (server/)
- [x] Rename `server/app/` files to `.ts`.
- [x] Type Express-like/Fastify endpoints in `tia-routes.ts`.
- [x] Verify `pnpm run typecheck` passes globally.
- [x] Commit meaningful milestones in small steps.
