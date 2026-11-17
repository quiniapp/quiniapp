# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo for QuiniApp, a lottery/betting application with the following workspaces:
- `api/` - Express.js backend with TypeScript
- `web/` - React frontend with Vite, TypeScript, and Tailwind CSS
- `helper/` - Shared utility functions and types across workspaces

## Common Development Commands

### Root Level Commands
- `npm install` - Install all workspace dependencies
- `npm run api-install` - Install API workspace dependencies only
- `npm run web-install` - Install web workspace dependencies only
- `npm run api` - Run API development server
- `npm run web` - Run web development server
- `npm run lint` - Run ESLint on all workspaces
- `npm run format` - Run Prettier on all workspaces
- `npm run build` - Build all workspaces

### API Workspace (api/)
- `npm run dev` - Start development server with tsx watch (runs on port 3000)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Run ESLint on API source files
- `npm run format` - Format API source files with Prettier

### Web Workspace (web/)
- `npm run dev` - Start Vite development server (proxies /api to localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint on web source files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format all files with Prettier

## Architecture Overview

### Backend API (api/)
- **Framework**: Express.js with TypeScript
- **Database**: Uses Supabase for data persistence and PostgreSQL
- **Authentication**: JWT-based auth with cookie storage, middleware in `middlewares/auth.middleware.ts`
- **Structure**: Feature-based modules (auth, bet, lottery, user, etc.) each with:
  - `controller/` - HTTP request handlers
  - `repository/` - Database access layer
  - `route/` - Express route definitions
  - `helper/` - Module-specific utilities
- **Entry point**: `src/index.ts` sets up Express server with CORS, routing, and middleware
- **Routing**: Two main routers:
  - `/api` - Public routes (no auth required)
  - `/api/private` - Protected routes (requires authentication)

### Frontend Web (web/)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: React Router DOM with browser router
- **State Management**:
  - Zustand for global state
  - TanStack Query for server state and caching
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with custom styling
- **Entry point**: `src/main.tsx` renders the main App component
- **Structure**:
  - `pages/` - Route components/pages
  - `components/` - Reusable UI components
  - `providers/` - React context providers (Auth, Theme, Modal, Clock)
  - `auth/` - Authentication utilities and API calls

### Shared Helper (helper/)
- Shared utilities, types, and functions used across API and web workspaces
- Contains validation schemas, parsing functions, and common business logic
- TypeScript modules with no build step (consumed directly by other workspaces)

## Key Technologies
- **TypeScript**: Used throughout all workspaces with shared base config
- **Zod**: Schema validation across frontend and backend
- **ESLint + Prettier**: Code linting and formatting with shared configuration
- **Husky + lint-staged**: Git hooks for code quality
- **Express + CORS**: Backend with proper CORS configuration for multiple environments
- **Supabase**: Database and authentication services
- **TanStack Query**: Data fetching and caching on frontend
- **Tailwind CSS**: Utility-first CSS framework with custom design system

## Development Workflow
1. Start API server: `npm run api` (port 3000)
2. Start web dev server: `npm run web` (Vite will proxy API calls)
3. Web dev server automatically proxies `/api` requests to the backend
4. Both servers support hot reloading during development

## Code Quality: Up-to-date Syntax

**CRITICAL**: Before writing or modifying code that uses any library or framework (React, Express, Zod, TanStack Query, Supabase, Tailwind, etc.), **always consult Context7 MCP** to retrieve the latest documentation and ensure the code uses current, non-deprecated APIs and syntax.

### When to use Context7 MCP
- Before implementing any feature that relies on a third-party library
- When writing hooks, queries, or mutations with TanStack Query
- When using Supabase client methods or RPC calls
- When using Zod schemas, React patterns, or Express middleware
- When unsure whether a library API has changed

### How to use it
Use the Context7 MCP tool to look up the relevant library before writing code. For example:
- "Get latest docs for TanStack Query v5 useQuery"
- "Get latest docs for Supabase JS client"
- "Get latest docs for Zod v4"

This ensures generated code is correct, idiomatic, and avoids deprecated patterns.

## Database Migrations

**CRITICAL RULES:**
- **NEVER edit existing migration files** that have been applied to the database
- Editing applied migrations causes inconsistencies between environments and breaks migration history
- Always create **NEW migration files** for any schema, function, or data changes
- Use descriptive timestamps and names for migration files (format: `YYYYMMDDHHmmss_description.sql`)

### Migration Workflow
1. **Create new migration**: Generate timestamp with `date +%Y%m%d%H%M%S` and create file in `api/supabase/migrations/`
2. **Write changes**: Include `DROP FUNCTION IF EXISTS` or similar cleanup before creating/replacing objects
3. **Test locally**: Apply migration to local Supabase instance
4. **Document**: Update `api/CHANGELOG.md` with migration details
5. **Deploy**: Migration will be automatically applied in deployment pipeline

### Example Migration File
```sql
-- File: 20260127230728_fix_leave_drag_reset.sql
DROP FUNCTION IF EXISTS calculate_current_account(TEXT, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION calculate_current_account(...)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
-- Function implementation
$$;
```

### Why This Matters
- **Immutability**: Applied migrations are part of the database history and must remain unchanged
- **Consistency**: All environments (dev, staging, prod) must have identical migration sequences
- **Rollback safety**: Migration history allows safe rollbacks and auditing
- **Team coordination**: Other developers depend on stable migration files

## SQL Performance (indexes & queries)

**Apply these rules whenever you write or review a query, an RPC, a migration that touches indexes, or a paginated endpoint.** Full reference (Winand, *SQL Performance Explained*): `docs/rendimiento-sql-conceptos.md` (`§n` refers to its sections). Active plan and measurements: `docs/plan-rendimiento-sql.md`, `docs/rendimiento-sql-baseline.md`.

### Principle
- Indexing is a development task: design indexes from **how the app accesses the data**.
- A "slow index" is never broken: it walks too many leaf nodes or fetches too many table rows. Fix the index or the query, don't "rebuild" it. Hardware does not fix a bad index.

### WHERE clauses
- No functions, casts, math or implicit type conversions on indexed columns (`DATE(col)`, `col::text`, `a + 1 = 10`). Rewrite, or create an expression index on the exact same expression (`IMMUTABLE` functions only).
- Dates: half-open ranges (`col >= :d AND col < :d + 1`). Never compare dates as strings.
- **No "smart logic" `(p_x IS NULL OR col = p_x)`** in RPCs over hot tables (`bets`, `tickets`, `*_archive`, `polla_bets`): the plan must serve every case and ends up entering by the wrong index. Use plpgsql dynamic SQL that adds only the received filters: `EXECUTE format('… %I …', tbl) USING p1, p2` (identifiers via `%I`, values **always** via `USING`).
- `LIKE`/`ilike`: only the part before the first wildcard is an access predicate. No leading `%` over large scopes → dedicated column (generated `STORED`) + equality; `pg_trgm` + GIN only if measured.
- Partial indexes are used only if the query repeats the index predicate (e.g. `deleted_at IS NULL`).

### Index design
- Column order: **equality columns → range column → ORDER BY columns → unique tiebreaker**. A range column in the middle turns the rest into filter predicates.
- Choose the order that serves the most queries, not "most selective first". One concatenated index beats several single-column ones (and index merges).
- Mixed `ASC`/`DESC` in `ORDER BY` → define the index with the same mixed order.
- Before adding an index, list the table's existing ones (`pg_indexes`) and check prefixes: unify instead of piling up. Every index slows `INSERT` and prevents HOT updates on its columns; don't repeat frequently-updated columns (`hits`, statuses) in several indexes.
- Covering indexes (`INCLUDE`) / index-only scans: only for critical queries where `EXPLAIN` shows table access dominates.
- `ANALYZE` the table after creating expression indexes or bulk loads.
- **Large tables** (`bets`, `bets_archive`, `tickets`, `tickets_archive`, `polla_bets`): use `CREATE INDEX CONCURRENTLY IF NOT EXISTS` as the **only statement of its migration file** (the Supabase CLI runs each file as a pipeline: two or more statements with `CONCURRENTLY` fail and leave partial state), or create it by hand with psql before `db push` and keep a plain `IF NOT EXISTS` in the migration. Afterwards check `pg_index.indisvalid`.

### Pagination, partial results and totals
- Always `LIMIT` in the database; never fetch everything and slice in the app.
- Lists that grow (infinite scroll, feeds) use **keyset**, not `OFFSET`. Deterministic order with a unique tiebreaker (`…, id`), and an index = equality columns + ORDER BY columns + tiebreaker.
  - SQL/RPC: row values `(a, id) < ($1, $2)` (same direction for every column).
  - PostgREST (no row values): redundant access predicate + OR tiebreak, e.g. `.lte('a', A).or('a.lt.A,and(a.eq.A,id.lt.ID)')`. If `EXPLAIN` still shows a large `Rows Removed by Filter`, move the list to an RPC with row values.
  - Filter the index's equality columns with `.eq()`, not `.in()` with a single value: `= ANY(array)` stops the index from delivering the order and the database sorts the whole range again (measured: 0.1 ms → 40 ms).
  - Cursor: opaque base64url, validated (invalid → 400), shared helper `api/src/utils/keyset.ts` (reference implementation today: `api/src/polla/bet/repository/polla-bet.repository.ts`). Keep timestamps as the raw DB string (microseconds), never through `Date`.
  - `hasMore`: fetch `limit + 1` rows, don't count.
- **Totals contract:** totals shown next to a paginated list (amounts, prizes, "N de M", counts) always cover the **whole filtered set**, are computed server-side **only on the first request** (no cursor / page 1), never depend on the cursor, and keep their current semantics. `count: 'exact'` only when the UI reads it, and only on the first request.
- `OFFSET` only for small, bounded lists; leave a comment saying why.

### Joins, round-trips and columns
- No N+1: no per-row queries or `Promise.all(ids.map(rpc))`; write one RPC that takes arrays or joins in the database.
- No `select('*')` or `(*)` embeds in listings: list the columns actually used (less I/O, enables index-only scans, smaller hash joins).
- Nested loops need an index on the inner join columns; hash joins benefit from indexes on independent filters, not on the join columns.

### Writes
- `UPDATE` only the columns that changed (unchanged indexed columns still cost, and kill HOT updates).
- Bulk loads: consider dropping and recreating indexes.

### Verify (mandatory for index changes and hot queries)
- `EXPLAIN (ANALYZE, BUFFERS)`; wrap DML in `BEGIN; … ROLLBACK;`; for parameterized queries use `PREPARE` / `EXPLAIN EXECUTE`. Locally, RPC internals show up via `auto_explain` (`SET auto_explain.log_min_duration = 0; SET auto_explain.log_nested_statements = on; SET auto_explain.log_analyze = on; SET client_min_messages = log;`).
- Red flags: `Seq Scan` on a large table; `Sort` under `Limit` (missing aligned index); `Filter` with high `Rows Removed by Filter` (those columns should be access predicates); estimated vs actual rows far apart (statistics → `ANALYZE` / `CREATE STATISTICS`); deep-page buffers ≫ page 1.
- Measure with volume (`api/supabase/scripts/seed_perf.sql` + `perf_explain_local.sql`, local only) and think 10x/100x, never "it works with 50 rows". Production is inspected read-only (`perf_baseline.sql`, `npx supabase inspect db …`).

### Review checklist (SQL in PRs)
1. Bind parameters everywhere (no string-built values)?
2. Functions, casts, math or type conversions on columns in WHERE/JOIN?
3. Dates filtered with half-open ranges?
4. Smart logic `(p IS NULL OR col = p)`? → dynamic SQL.
5. `LIKE '%…'`? → another strategy.
6. Is there an index whose prefix covers the equality columns, followed by the range column?
7. In the plan, which conditions are access and which are filter? High `Rows Removed by Filter`?
8. Estimated vs actual rows match?
9. Avoidable `Sort` (index aligned with ORDER BY, incl. mixed ASC/DESC)?
10. Top-N with `LIMIT`? Deep `OFFSET` → keyset?
11. Joins done in the database (no N+1)? Join columns indexed for nested loops?
12. Unnecessary `select('*')` / `(*)` embeds?
13. Is an index-only scan worth it for this critical query?
14. How many indexes does the table already have? Can the new one replace others?
15. How does it scale with 10x/100x the data?

## Documentation & Change Management

### CHANGELOGs
Each workspace maintains its own CHANGELOG to track all modifications, additions, and fixes:

- **`web/CHANGELOG.md`** - Frontend changes (components, hooks, pages, styling, routing)
- **`api/CHANGELOG.md`** - Backend changes (controllers, routes, repositories, middleware)
- **`helper/CHANGELOG.md`** - Shared code changes (types, utilities, configurations, schemas)

### Change Documentation Guidelines

**IMPORTANT**: When making changes to any workspace, you MUST update the corresponding CHANGELOG.md file.

#### Format
CHANGELOGs follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]

### Added - YYYY-MM-DD
- New features and functionality

### Changed - YYYY-MM-DD
- Modifications to existing functionality

### Fixed - YYYY-MM-DD
- Bug fixes and corrections

### Removed - YYYY-MM-DD
- Removed features or deprecated code
```

#### What to Document
- ✅ New features, components, or endpoints
- ✅ Changes to existing functionality or behavior
- ✅ Bug fixes
- ✅ Breaking changes (with migration guide)
- ✅ Configuration changes
- ✅ Dependency updates (if significant)
- ✅ Database schema changes
- ✅ API endpoint modifications
- ❌ Trivial changes (typo fixes, code formatting)
- ❌ Work-in-progress commits

#### Entry Structure
Each entry should include:
1. **Category** (Added/Changed/Fixed/Removed)
2. **Date** (YYYY-MM-DD)
3. **Clear description** of what changed
4. **File path** or component name
5. **Why** the change was made (if not obvious)
6. **Migration notes** (for breaking changes)

#### Example Entry
```markdown
### Added - 2025-11-11

#### Session Management
- **Session Configuration File**: Created centralized session config in `@helper/config/session.config.ts`
  - `SESSION_DURATION_MS`: 3 hours session timeout from last activity
  - Use case: Unified session management across frontend and backend
```

### Workspace-Specific Guidelines

#### Web CHANGELOG (`web/CHANGELOG.md`)
Document:
- Component additions/modifications
- Hook changes (mutations, queries)
- Route additions
- Context/Provider changes
- UI/UX improvements
- State management updates

#### API CHANGELOG (`api/CHANGELOG.md`)
Document:
- New endpoints
- Route modifications
- Controller/Repository changes
- Middleware updates
- Database queries/RPC changes
- Authentication/Authorization changes

#### Helper CHANGELOG (`helper/CHANGELOG.md`)
Document:
- New types/interfaces
- Shared utility functions
- Configuration files
- Validation schemas
- Cross-workspace constants

### Best Practices
1. **Update CHANGELOGs immediately** when making changes
2. **Group related changes** under the same date/section
3. **Be specific** - include file paths and function names
4. **Explain the why** - context helps future developers
5. **Note breaking changes** prominently
6. **Include migration guides** for breaking changes
7. **Keep entries concise** but informative