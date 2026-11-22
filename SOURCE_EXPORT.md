# Nawaratt System — Complete Source Export

Exported from the currently deployed Nawaratt Site source repository.

- Site version at export: **197**
- Source commit: `3d548be7ea01549365947333817efcc1f2ce3d6f`
- Source commit date: 2026-11-20 07:53:42 UTC
- Framework: Vinext / React / TypeScript
- Runtime: Cloudflare Workers
- Database: Cloudflare D1 with Drizzle ORM
- File storage: Cloudflare R2

## Included

- Complete application interface and workflow source under `app/`
- All API routes under `app/api/`
- Database schema under `db/`
- Database migrations under `drizzle/`
- Shared UI components under `components/`
- Business data definitions under `data/`
- Runtime and build source under `build/` and `scripts/`
- Public application assets under `public/`
- Dependency lockfile and package configuration
- Sites deployment manifest under `.openai/`

## Intentionally excluded

- Production database records
- Uploaded photos, Excel files, and other live R2 objects
- Passwords, tokens, environment secrets, and temporary credentials
- `node_modules/` dependencies
- Generated `.vinext/`, `dist/`, `.next/`, and local runtime files
- Git history and repository credentials

## Local setup

Requirements:

- Node.js 22.13 or newer
- pnpm 11.25.0

Install and run:

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Build:

```bash
pnpm run build
```

The application requires Cloudflare D1 and R2 bindings declared in
`.openai/hosting.json`. A new environment must apply the SQL migrations in
`drizzle/` in numerical order and configure its own authentication and runtime
secrets.

## Important

This archive is the complete reproducible source code, not a production data
backup. Export the live D1 database and R2 files separately when a full
operational backup or migration is required.
