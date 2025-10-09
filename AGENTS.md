# Repository Guidelines

## language

Chinese

## Always using UTF-8 encoding for output

## Project Structure & Module Organization

Turborepo with pnpm workspaces under `apps/` (backend NestJS in `apps/backend`, admin console in `apps/admin-web`, Expo clients in `apps/mobile-user` and `apps/mobile-worker`). Shared utilities live in `packages/` (`web-ui`, `mobile-ui`, `utils`, `types`, and lint/tsconfig presets). Drizzle migrations reside in `apps/backend/drizzle/`, docs in `docs/`, and environment fragments in `env/` merged via `pnpm env:setup`.

## Build, Test, and Development Commands

Run `pnpm install` once to bootstrap workspaces. `pnpm dev` starts the Turbo graph; scope to a surface with `pnpm backend:dev`, `pnpm admin:dev`, or `pnpm mobile-user:dev`. Ship builds using `pnpm build`, then `pnpm backend:start` or `pnpm admin:start` for production smoke tests.

## Coding Style & Naming Conventions

Default indentation is 4 spaces with CRLF per `.editorconfig`; respect overrides such as `apps/backend/biome.json` (tabs, double quotes). Keep directories kebab-case, React/Nest symbols PascalCase, and functions camelCase. Run `pnpm lint`, `pnpm type-check`, and `pnpm format:check` before sharing changes.

## Testing Guidelines

Backend specs use Jest alongside sources (`apps/backend/src/**/*.spec.ts`); execute with `pnpm test --filter=backend` or `pnpm --filter backend test:e2e` for full coverage. Frontend teams add React/Expo Testing Library suites per feature folder and wire them to a `test` script. Reset mocks between cases and keep fixtures next to the unit under test.

## Commit & Pull Request Guidelines

Follow Conventional Commits with scopes, e.g., `feat(backend): add shift approval flow`. Keep subjects imperative and under 72 chars. PRs must summarize intent, attach screenshots or CLI output when UX or infra shifts, link issues, and confirm `pnpm lint`, `pnpm type-check`, plus targeted `pnpm test` runs.

## Security & Environment Tips

Generate per-app env files with `pnpm env:setup` and override secrets locally; never commit sensitive values. Use `dotenvx run -f apps/backend/.env.development -- <command>` for ad-hoc processes. `docker-compose.yaml` provisions shared services; stop stacks before pruning volumes and rotate API keys ahead of distributing builds or logs.
