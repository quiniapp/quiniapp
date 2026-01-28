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