# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2026-03-27

#### Group-Based Filtering
- **bet.routes.ts**: Accept `group_id` query param in all bet handlers (`getAllBets`, `getTotalAmount`, `getTotalPrize`, `getAmountsByTicket`). When present and user is not CASHIER, overrides `organization_ids` to `[group_id]` to scope queries to that group only. Ownership validated against descendant org list.
- **ticket.route.ts**: Accept `group_id` query param in `getAllTicketHandler` and `getAllTicketNumberHandler`. When present, overrides `organization_id` to `group_id` after validating it is a descendant of the user's org.
- **current-account.route.ts**: Accept `group_id` query param in `getAllCurrentAccountHandler`. When present, overrides `organization_id` to `group_id` after validating ownership.

### Changed - 2026-03-27

#### Bet Aggregates – Pagination & Query Optimization
- **`getAllBets()` in `api/src/bet/controller/bet.controller.ts`**: Modified to compute `totalAmount` and `totalPrize` aggregates **only on page 1** instead of recalculating on every page load. Pages 2+ omit the `aggregates` field from the response since the values don't change between pagination — frontend retrieves first page aggregates via `data?.pages?.[0]?.aggregates` (TanStack Query infinite query pattern).

- **`getTotalAmount()` and `getTotalPrize()` in `api/src/bet/repository/bet.repository.ts`**: Replaced RPC-based queries with direct Supabase `.select('*.sum()')` queries. Eliminates network overhead and reduces query execution time by avoiding stored procedure overhead. Archive-aware via `getTableName()` helper.

- **`getAllBetsGrouped()` pagination in `api/src/bet/repository/bet.repository.ts` and `api/src/bet/controller/bet.controller.ts`**: Added pagination support (limit/offset) to grouped bets query. Prevents loading all grouped results into memory during frontend grouped view infinite scroll.

- **`getAmountsByTicket()` optimization in `api/src/bet/repository/bet.repository.ts`**: Changed to fetch the ticket's organization first, then query bets by that single org. Reduces N RPC calls (one per org) down to 1-2 queries total. Significantly reduces latency when resolving amounts by ticket number.

- **Performance Impact**: Pagination prevents unbounded result sets; direct sum queries and org pre-fetch eliminate repeated RPC overhead during data loading operations.
### Added - 2026-03-26

#### Eliminar usuarios de grupos

- **`user.repository.ts`**: `getParentOrganizationId(orgId)` — consulta `parent_organization_id` de una organización
- **`user.repository.ts`**: `removeFromGroup(userId, currentGroupId, parentOrgId)` — mueve al usuario de vuelta a la org padre
- **`user.controller.ts`**: `removeUserFromGroup(userId, groupId, adminOrgId, adminUserType)` — valida permisos, verifica que el usuario esté en el grupo, obtiene org padre y ejecuta la remoción
- **`user.route.ts`**: `POST /api/private/user/remove-from-group` — handler con validación de `user_id` y `group_id`

### Fixed - 2026-03-01

#### Groups Feature – Network-Aware Visibility

Fixed multiple bugs where users with network-wide roles (OWNER, CAPITALIST, ADMIN in root org) could not see users, current accounts, or bets belonging to cashiers assigned to sub-organizations (groups).

**User List (`api/src/user/`)**

- **OWNER in `user.repository.ts`**: Changed from `.eq('organization_id', org_id)` to `getOrganizationDescendants()` + `.in()`, so OWNER now sees users across all sub-orgs in the network.
- **ADMIN in `user.repository.ts`**: Added `isSubOrganization()` check. ADMIN in root org now uses `getOrganizationDescendants()` + `.in()` to see cashiers in all groups; ADMIN in a sub-org still sees only their group.
- **`getUserHandler`, `updateUserHandler`, `deleteUserHandler` in `user.route.ts`**: For CAPITALIST/OWNER, these now call `getByIdFromNetwork()` to resolve the target user's real `organization_id` (may be in a sub-org) before getting, updating, or deleting.
- **`getByIdFromNetwork()` in `user.controller.ts`**: New method that validates the target user belongs to the caller's network and returns the user with their `organization_id`.

**Permissions (`api/src/user/route/user.route.ts`)**

- **ADMIN cannot create users**: Added a `ForbiddenError` check in `newUserhandler` to block ADMIN and CASHIER from creating new users.

**Current Account (`api/src/current-account/controller/current-account.controller.ts`)**

- **`getAllCurrentAccountNetworkHandler`**: Changed condition from `(include_network && user_type === CAPITALIST)` to always use the network query for CAPITALIST and OWNER, and also for SUPERADMIN/ADMIN in root org (uses `isSubOrganization()` to determine). The `include_network` flag is preserved for backward compatibility but no longer controls behavior for CAPITALIST/OWNER.

**Bets (`api/src/bet/`)**

- **`bet.repository.ts`**: Changed all methods (`getAllBets`, `getAllBetsGrouped`, `getTotalAmount`, `getTotalPrize`, `getAmountsByTicket`) to accept `organization_ids: string[]` instead of `organization_id: string`.
  - `getAllBets`: uses `.in('organization_id', organization_ids)` for direct query.
  - `getTotalAmount`, `getTotalPrize`: replaced RPC calls with direct Supabase queries using `.in()` (archive-aware via `getTableName`).
  - `getAllBetsGrouped`: calls the `get_grouped_bets_for_parse` RPC per org, then merges results by grouping key (summing amounts/prizes/hits).
  - `getAmountsByTicket`: calls `get_ticket_sums` RPC per org and aggregates.
- **`bet.controller.ts`**: Updated all method signatures to use `organization_ids: string[]`.
- **`bet.routes.ts`**: Added `getOrgIds()` helper that resolves the full network of org IDs via `UserRepository.getOrganizationDescendants()`. All handlers now call this before invoking the controller. CASHIERs are still restricted to their own org only.

### Fixed - 2026-02-23

#### Archive Routing: Today's Bets Not Returned
- **Problem**: `getLastActiveDays` retornaba `[{date: 'YYYY-MM-DD'}, ...]` (objetos) en vez de `['YYYY-MM-DD', ...]` (strings) porque el SP usa `RETURNS TABLE(date DATE)`. Esto hacía que `isArchiveDate` siempre devolviera `true` (cualquier string < `'[object Object]'` en comparación léxica), ruteando **todas** las fechas a `bets_archive`, incluyendo hoy.
- **Solution**: Mapeado correcto del resultado del RPC en `ActivityDaysRepository.getLastActiveDays`
  - Archivo: `api/src/activity/repository/activity-days.repository.ts`

#### Archive Table FK Constraints
- **Problem**: `bets_archive` had no FK constraints to `lotteries` or `schedules`, causing PostgREST to throw `PGRST200` when using `.select('*, lotteries(*), schedules(*)')` on archived dates
- **Solution**: Added FK constraints matching the main `bets` table
  - Migration: `api/supabase/migrations/20260223191427_add_fk_constraints_bets_archive.sql`
  - `fk_bets_archive_lottery`: `lottery_id → lotteries(lottery_id) ON DELETE SET NULL`
  - `fk_bets_archive_schedule`: `schedule_id → schedules(schedule_id) ON DELETE SET NULL`
  - `fk_bets_archive_user`: `user_id → users(user_id) ON DELETE SET NULL`

### Added - 2026-02-12

#### Database Performance - Current Accounts Indexes
- **Problem**: `calculate_current_account` timing out with full table scans
  - Issue: Missing indexes on `current_accounts` table
  - Impact: Queries scanning 1M+ rows to find previous balances
  - Symptoms: Timeout errors when calculating accounts for dates with large history
  - Root cause: No indexes for common query patterns (date ranges, org filtering, user lookups)

- **Solution**: Added strategic indexes to eliminate full scans
  - Migration: `api/supabase/migrations/20260212170504_add_current_accounts_indexes.sql`
  - Uses `CREATE INDEX CONCURRENTLY` to avoid table locks during creation

  **Indexes Added**:
  1. `idx_current_accounts_org_user_date_desc (organization_id, user_id, date DESC)`
     - Optimizes `previous_state` query (most expensive)
     - Pattern: `WHERE date < v_date AND organization_id = X ORDER BY user_id, date DESC`
     - Before: Full table scan (1M+ rows)
     - After: Index scan (only relevant rows per user)
     - Expected improvement: 100x-1000x faster

  2. `idx_current_accounts_date_org (date, organization_id)`
     - Optimizes `existing_day` query
     - Pattern: `WHERE date = v_date AND organization_id = X`
     - Before: Full table scan
     - After: Index scan (~100 users)
     - Expected improvement: 100x-1000x faster

  3. `idx_current_accounts_user_date_desc (user_id, date DESC)`
     - Optimizes user-specific account history queries
     - Pattern: User balance history in descending order
     - Useful for frontend account history views

  **Performance Impact**:
  - `calculate_current_account` should complete in <1 second
  - `generate_winners_and_calculate_accounts` should no longer timeout
  - Overall system responsiveness improved for historical data queries

  **Verification**:
  - Includes statistics update (ANALYZE) after index creation
  - Logs index count and table size
  - Reports expected improvements

### Changed - 2026-02-10

#### Archive System - Architecture Refactoring
- **Problem**: Code duplication and inconsistent architecture
  - `/admin/route/archive.route.ts` + `/admin/controller/archive.controller.ts` (not registered, dead code)
  - `/archive/route/archive.route.ts` (registered but no controller pattern)
  - Duplicate endpoints: stats, trigger/run, cron-status
  - Lost functionality: activity-days endpoints only in dead code

- **Solution**: Unified architecture following project patterns
  - **Created**: `api/src/archive/controller/archive.controller.ts`
    - Renamed from `ArchiveAdminController` to `ArchiveController`
    - Updated import paths (relative to archive module)
    - Added `triggerArchive()` method (uses cron service)
    - Added `runArchive()` method (returns detailed results)
    - Merged all 5 endpoints into single controller

  - **Updated**: `api/src/archive/route/archive.route.ts`
    - Changed from direct service calls to controller pattern
    - All routes now use `archiveController` methods
    - Maintains same URL structure: `/api/private/archive/*`
    - Added documentation for all 6 endpoints

  - **Removed**: `api/src/admin/` directory (dead code)
    - Deleted `admin/route/archive.route.ts` (never registered)
    - Deleted `admin/controller/archive.controller.ts` (never used)

  - **New Endpoints Available**:
    - `GET /api/private/archive/activity-days` - View activity days
    - `POST /api/private/archive/update-activity` - Update activity counts
    - `POST /api/private/archive/run` - Get detailed archive results

  - **Architecture Benefits**:
    - Single source of truth for archive routes
    - Follows controller pattern like other modules (bet, user, lottery, etc.)
    - No code duplication
    - All functionality in one place

### Fixed - 2026-02-10

#### Archive System - Schema Type Mismatch
- **Problem**: Archive failing with type conversion error
  - Error: "column 'ticket_number' is of type integer but expression is of type text"
  - Root cause: bets table has ticket_number as TEXT (updated Jun 2025)
  - Archive table still has ticket_number as INTEGER (old schema)
  - Stored procedure fails when trying to INSERT TEXT into INTEGER column

- **Solution**: Align column types between main and archive
  - Migration: `api/supabase/migrations/20260210190000_fix_archive_schema_mismatch.sql`
  - ALTER bets_archive.ticket_number: INTEGER → TEXT
  - ALTER tickets_archive.ticket_number: INTEGER → TEXT (if needed)
  - Reports any remaining type mismatches between tables

#### Archive System - Date Type Handling
- **Problem**: cutoffDate sometimes returns Date object instead of string
  - Error persists: "invalid input syntax for type date: '[object Object]'"
  - Supabase .lt('date', cutoffDate) expects string, gets object
  - Causes fallback implementation to fail

- **Solution**: Explicit date string conversion
  - File: `api/src/archive/service/archive.service.ts`
  - Convert cutoffDate to string before using in queries
  - Handle both string and Date object returns from getCutoffDate
  - Applied to both archiveOldBetsManual() and archiveOldTicketsManual()
  - Updated ALL uses: SELECT queries, DELETE queries, and return values
  - Ensures consistent string format (YYYY-MM-DD) throughout

#### Archive System - Constraint Mismatch
- **Problem**: Archive cron failing with check constraint violation
  - Error: "new row for relation 'bets_archive' violates check constraint 'chk_archive_borratina_number_with_length'"
  - Root cause: bets_archive table has outdated constraints (expects BORRATINA length=8)
  - Main bets table was updated June 2025 to require BORRATINA length=10
  - Archiving fails when trying to move BORRATINA bets from main to archive

- **Solution**: Update archive constraints to match main table
  - Migration: `api/supabase/migrations/20260210180000_fix_archive_constraints_match_main_table.sql`
  - Drops old constraints from bets_archive
  - Updates existing BORRATINA records (LPAD 8-char to 10-char)
  - Adds new constraints matching main bets table:
    * Number lengths: 1, 2, 3, 4, 10 (was 1, 2, 3, 4, 8)
    * BORRATINA: length=10 (was length=8)
  - Handles both old ('number') and new ('bet_number') column names

#### Archive System - Error Handling
- **Problem**: Fallback TypeScript implementation showing cryptic errors
  - Error: "invalid input syntax for type date: '[object Object]'"
  - Supabase error objects sometimes have non-string message properties

- **Solution**: Robust error formatting in ArchiveService
  - File: `api/src/archive/service/archive.service.ts`
  - Check if error.message is string before using it
  - Use JSON.stringify() as fallback for object messages
  - Applied to all error handling: select, insert, delete operations
  - Both archiveOldBetsManual() and archiveOldTicketsManual()

### Fixed - 2026-02-10

#### Generate Winners Timeout
- **Problem**: `generate_winners_and_calculate_accounts` timing out with error code 57014
  - Issue: Heavy RPC with complex CTEs, JOINs, and UPDATEs exceeding statement timeout
  - Affected users: CAPITALIST, SUPERADMIN when generating winners for 2026-02-09

- **Solution Migration 1**: Increase timeout and add indexes
  - Migration: `api/supabase/migrations/20260210120000_fix_generate_winners_timeout.sql`
  - Set statement_timeout to 5 minutes (300 seconds) for generate_winners functions
  - Added indexes on bets(schedule_id, date, organization_id)
  - Added indexes on results(lottery_id, schedule_id, date, organization_id)
  - Added indexes on ticket_prizes_by_turn(date, schedule_id, organization_id)
  - Added indexes on tickets(date, organization_id)
  - Added corresponding indexes on archive tables for consistency
  - Runs ANALYZE on all affected tables to update query planner statistics

- **Solution Migration 2**: Add archive validation
  - Migration: `api/supabase/migrations/20260210120001_add_archive_validation_generate_winners.sql`
  - Validates data exists in MAIN tables before processing
  - Checks ARCHIVE tables if not found in main
  - Raises `BETS_ARCHIVED` error if data is in archive (read-only, cannot UPDATE)
  - Raises `NO_BETS_FOUND` error if data doesn't exist anywhere
  - Prevents silent failures and provides clear error messages
  - Generate winners only works for active dates (last N days in main tables)

- **Documentation**: Created `GENERATE_WINNERS_TIMEOUT_ANALYSIS.md`
  - Comprehensive analysis of root cause
  - Performance bottlenecks identified
  - Impact of archive system explained
  - Multiple solution approaches documented
  - Testing and monitoring guidelines

### Added - 2026-02-10

#### Archive System - Backfill and Management
- **Activity Days Backfill Migration**: Populates activity_days with historical data
  - Migration: `api/supabase/migrations/20260210060000_backfill_activity_days.sql`
  - Counts all bets and tickets by date from main tables
  - Populates activity_days table with historical dates
  - Required for archive system to determine cutoff dates
  - Prints verification report showing total days, oldest/newest dates

- **Archive Management Routes**: Admin endpoints for managing archive system
  - File: `api/src/archive/route/archive.route.ts`
  - `POST /api/private/archive/trigger`: Manually trigger archive job
  - `GET /api/private/archive/stats`: Get archive statistics (main vs archive table sizes)
  - `GET /api/private/archive/cron-status`: Get cron job status
  - Protected with private authentication middleware
  - Registered in main router: `api/src/router.ts`

- **Admin-Only Middleware**: Middleware to restrict access to non-cashier users
  - File: `api/middlewares/admin-only.middleware.ts`
  - `requireNonCashier`: Blocks CASHIER users from accessing routes
  - `requireAdmin`: Alias for requireNonCashier with semantic naming
  - Applied to all archive management endpoints
  - Returns 403 Forbidden for cashier users

### Fixed - 2026-02-09

#### TypeScript Type Errors
- **User Repository**: Added explicit return type annotations to all methods
  - Files: `api/src/user/repository/user.repository.ts`
  - Methods: `getById`, `getByIdWithoutOrgRestriction`, `getByUsernameAndOrganization`, `getAll`, `create`, `update`, `delete`
  - Issue: Supabase `GenericStringError` union type incompatibility
  - Solution: Added `Promise<IUserEntityBack>` return types and `as unknown as` type assertions
  - Why: Supabase client without type generation returns union types that don't overlap with our entity types

- **Bet Repository**: Fixed type checking for ticket sums
  - File: `api/src/bet/repository/bet.repository.ts`
  - Issue: TypeScript couldn't infer properties on RPC response data
  - Solution: Cast to `TicketSums` type before accessing properties

- **Archive Route**: Fixed route handler syntax
  - File: `api/src/admin/route/archive.route.ts`
  - Issue: Arrow function expression incorrectly called instead of passed as callback
  - Solution: Changed to arrow function with block body

### Added - 2026-02-09

#### Archive Query System - Smart Table Routing
- **Archive Helper Utilities**: Created in-memory cache system for query routing
  - File: `api/src/archive/helper/archive-helper.ts`
  - `isArchiveDate(date)`: Determines if date should query archive tables (cached check)
  - `getTableName(date, baseTable)`: Returns correct table name ('bets' or 'bets_archive')
  - `getRpcName(date, baseRpcName)`: Returns correct RPC name (with '_archive' suffix if needed)
  - `initializeActiveDaysCache()`: Initializes cache on server startup
  - `refreshActiveDaysCache()`: Updates cache after archiving (called by cron job)
  - Uses `ARCHIVE_DAYS_TO_KEEP` env variable (defaults to 2 active days)
  - Cache updated only when cron runs (the only time data moves between tables)

- **Archive RPCs for Tickets**: Duplicate RPCs for querying archive tables
  - Migration: `api/supabase/migrations/20260209211210_create_ticket_archive_rpcs.sql`
  - `ticket_full_json_plpgsql_archive`: Queries tickets_archive + bets_archive
  - `get_ticket_sums_archive`: Calculates sums from bets_archive
  - Identical logic to main RPCs but query archive tables

- **Archive RPCs for Bets**: Duplicate RPCs for querying archive tables
  - Migration: `api/supabase/migrations/20260209211211_create_bets_archive_rpcs.sql`
  - `get_grouped_bets_for_parse_archive`: Groups bets from archive
  - `bets_total_amount_archive`: Calculates total amount from archive
  - `bets_total_prize_archive`: Calculates total prize from archive
  - Identical logic to main RPCs but query bets_archive table

### Changed - 2026-02-09

#### BetRepository - Archive-Aware Queries
- **File**: `api/src/bet/repository/bet.repository.ts`
- **getAllBets()**: Uses `getTableName()` to query correct table based on date
- **getAllBetsGrouped()**: Uses `getRpcName()` to call correct RPC (_archive suffix if needed)
- **getTotalAmount()**: Routes to archive RPC for old dates
- **getTotalPrize()**: Routes to archive RPC for old dates
- **getWinnerBets()**: Queries archive table for old dates
- **getAmountsByTicket()**: Searches main table first (more indexes), then archive if not found
- Zero changes needed in controllers or frontend

#### TicketRepository - Archive-Aware Queries
- **File**: `api/src/ticket/repository/ticket.repository.ts`
- **getById()**: Searches main table first, then archive (no date parameter)
- **getByNumber()**: Searches main table first, then archive (no date parameter)
- **getAll()**: Uses `getTableName()` to query correct table based on date
- **getAllTicketNumber()**: Routes to archive table for old dates
- **getAllDeletedTickets()**: Routes to archive table for old dates
- **delete()**, **update()**, **payTicket()**: Only work on main table (archive is read-only)

#### BetController - Simplified Error Handling
- **File**: `api/src/bet/controller/bet.controller.ts`
- **getAmountsByTicket()**: Removed fallback comments, repository handles archive search
- Cleaner error handling with repository managing archive lookup

#### TicketController - Enhanced Archive Error Messages
- **File**: `api/src/ticket/controller/ticket.controller.ts`
- **get()**: Removed fallback comments, repository handles archive search
- **paid()**: Better error message for archived tickets ("TICKET_ARCHIVED" instead of "TICKET_TOO_OLD")
- Repository handles searching both tables, controller focuses on business logic

#### CronService - Cache Refresh Integration
- **File**: `api/src/cron/service/cron.service.ts`
- Added `refreshActiveDaysCache()` call after successful archiving
- Ensures query routing cache stays synchronized with archive operations
- Cache refresh is Step 5 in daily archive job (before stats collection)

#### Server Initialization - Archive Cache Setup
- **File**: `api/src/index.ts`
- Added `initializeActiveDaysCache()` on server startup
- Cache loaded before cron job starts to ensure correct query routing from first request
- Async initialization in server listen callback

### Performance Impact - 2026-02-09
- **Main tables**: Dramatically smaller (only last 2 active days), faster queries
- **Query routing**: O(1) cache lookup, zero database overhead
- **Archive queries**: Slower than main (fewer indexes) but rare (only for old dates)
- **No frontend changes**: Complete transparency, zero impact on user experience
- **Fallback searches**: Main table first (fast), archive only if needed (slower but correct)

### Added - 2026-01-28

#### E2E Test Suite for Winners, Results and Current Account (Updated)
- **Comprehensive Integration Tests**: Created complete E2E test suite for validating the critical betting flow with 0-20 hits scenarios
  - Files:
    - `api/__tests__/setup.ts` - Jest global setup
    - `api/__tests__/integration/winners-results-account.test.ts` - Main E2E test
    - `api/__tests__/fixtures/users.fixture.ts` - Test users (1 owner + 6 cashiers)
    - `api/__tests__/fixtures/schedules.fixture.ts` - 5 schedules × 5 lotteries × 6 days
    - `api/__tests__/fixtures/results/no-winners.fixture.ts` - Results guaranteeing 0 hits
    - `api/__tests__/fixtures/results/one-hit.fixture.ts` - Results guaranteeing 1 hit per bet type
    - `api/__tests__/fixtures/results/max-hits.fixture.ts` - Results guaranteeing maximum hits
    - `api/__tests__/fixtures/bets/generate-bets.fixture.ts` - Bet generator for all scenarios
    - `api/__tests__/helpers/test-database.helper.ts` - Database setup/cleanup utilities
    - `api/__tests__/helpers/test-auth.helper.ts` - JWT token generation for tests
    - `api/__tests__/helpers/calculate-expected.helper.ts` - Expected value calculators
    - `api/__tests__/helpers/assertions.helper.ts` - Custom assertions for tests
  - Test scenarios (8 cashiers covering 0-20 hits):
    - HITS_0: All losing bets, 0 hits (validates revenue = pass - commission, successes = 0)
    - HITS_1_TO_5: 1-5 hits distributed across schedules/lotteries (validates low hit ranges)
    - HITS_6_TO_10: 6-10 hits using TEN place (validates medium hit ranges)
    - HITS_11_TO_20: 11-20 hits using TWENTY place (validates high hit ranges and maximum hits)
  - Coverage: Tests all bet types (ONE, DOUBLE, TERN, QUATERN, BORRATINA, REDOUBLE) with strategic place selection
  - Results strategy: Uses simple repeated numbers (1111, 9999) for predictable hit patterns
  - Hit distribution: 5 schedules × 5 lotteries = 25 unique combinations mapping to 0-20 hits
  - Test environment configuration:
    - **Isolated local Supabase:** Tests run on separate ports (54331/54332) to avoid touching development data
    - **Security validations:** Tests enforce NODE_ENV=test and SUPABASE_ENVIROMENT=LOCAL
    - **Automated setup:** Scripts for Windows (PowerShell) and Linux/Mac (Bash)
  - New files:
    - `api/__tests__/fixtures/results/hits-by-schedule-lottery.fixture.ts` - Maps schedule-lottery to hit count
    - `api/__tests__/fixtures/bets/generate-bets-simple.fixture.ts` - Generates bets with simple numbers
    - `api/TESTING-LOCAL-SETUP.md` - Complete guide for setting up second local Supabase for tests
    - `api/TESTING-SETUP.md` - Alternative test environment options (remote, same project)
    - `api/QUICK-TEST-START.md` - Quick start guide (3 minutes setup)
    - `api/.env.test.example` - Template for test environment variables
    - `api/scripts/setup-test-env.ps1` - Automated setup script (Windows)
    - `api/scripts/setup-test-env.sh` - Automated setup script (Linux/Mac)
    - `api/scripts/verify-test-env.ts` - Environment verification script
  - Updated dependencies: Added `dotenv-cli@^11.0.0` for .env.test support
  - Updated npm scripts:
    - `test`, `test:watch`, `test:coverage` - Now use .env.test automatically
    - `test:verify` - Verify test environment configuration
    - `supabase:test:start` - Start test Supabase instance
    - `supabase:test:stop` - Stop test Supabase instance
    - `supabase:test:reset` - Reset test database
    - `supabase:test:status` - Check test Supabase status
  - Validates:
    - Winner calculation via `generate_winners_and_calculate_accounts` RPC
    - Current account calculation (pass, successes, revenue, commission, drag, leave)
    - Drag accumulation for cashiers with fee_plus > 0
    - Leave calculation and drag reset after month-end
  - Jest configuration: `api/jest.config.js` with ESM support and ts-jest
  - Added test scripts to `api/package.json`:
    - `npm test` - Run all tests
    - `npm run test:watch` - Watch mode
    - `npm run test:coverage` - Coverage report
  - Dependencies: jest@^29.7.0, @types/jest@^29.5.11, ts-jest@^29.1.1, supertest@^6.3.3

### Fixed - 2026-01-27

#### Current Account Liquidation - Drag Reset After Month-End Leave Calculation
- **Drag Reset After Leave Calculation**: Fixed bug where drag (arrastre) was not resetting to 0 the day after calculating leave (deje) at month-end
  - File: `api/supabase/migrations/20260127230728_fix_leave_drag_reset.sql`
  - Root cause: The RPC function `calculate_current_account` was only resetting drag when `p_calculate_leave=true` (the current day), but it should reset when `previous_leave > 0` (the previous day had leave calculated)
  - Impact: After month-end liquidation with `leave=true` and `drag > 0`, the next day (first day of new month) now correctly starts with `drag=0` instead of carrying forward the previous drag
  - Business rule: Leave is only calculated on the last playable day of the month. If Day N had `leave > 0` and `drag > 0`, then Day N+1 starts with `previous_drag=0`
  - Changes to drag reset logic (lines 83-104): Removed `p_calculate_leave AND` condition from both `prev_drag_eff_hist` and `prev_drag_eff_chosen` calculations, leaving only the check for `previous_leave > 0 AND previous_drag_raw > 0`
  - Affects endpoints:
    - POST `/api/private/current-account/calculate` (when called the day after month-end liquidation)
    - POST `/api/private/current-account/liquidate` (when `leave=true` on last day of month)
    - POST `/api/private/current-account/liquidate/network` (when `leave=true` on last day of month)
    - PUT `/api/private/current-account/bulk` (when `leave=true` on last day of month)

### Changed - 2026-01-21

#### CSRF Protection via SameSite Cookie Policy
- **Session Cookie Configuration**: Changed default `COOKIE_SAME_SITE` from `'none'` to `'lax'` in `api/src/config/session.config.ts`
  - Provides automatic CSRF protection without requiring additional middleware
  - Works correctly with Vercel proxy architecture (frontend and API share same domain from browser perspective)
  - Still configurable via `COOKIE_SAME_SITE` environment variable if needed
  - Resolves CI/CD security warning about missing CSRF middleware

- **CodeQL Suppression**: Added documentation comment in `api/src/index.ts:98` with `lgtm[js/missing-token-validation]` marker
  - Suppresses CodeQL false positive about missing CSRF middleware
  - Includes explanation of why sameSite='lax' is sufficient protection

**Security context**: With `sameSite: 'lax'`, browsers automatically prevent cookies from being sent in cross-site POST requests, effectively blocking CSRF attacks. This is sufficient protection when using the Vercel proxy pattern where the browser only communicates with the same domain.

### Added - 2026-01-15

#### User Last Activity in List Endpoint
- **Last Activity Inclusion**: Updated `GET /api/private/user` endpoint to support `?include_session=true` parameter
  - Returns users with their most recent session's `last_activity_at`
  - Only includes the most recent active session (not all sessions)
  - Modified `api/src/user/repository/user.repository.ts`:
    - Explicit field selection instead of `SELECT *` for better performance and security
    - Created `allUserFields` constant to avoid field duplication
    - Joins with sessions table when requested, ordering by `last_activity_at DESC` and limiting to 1
    - Uses left join so users without sessions are still included
  - Modified `api/src/user/route/user.route.ts` to parse `include_session` query parameter

- **New Types**: Added session-related types in `@helper/types/user.type.ts`
  - `ILastSessionInfo`: Contains only `last_activity_at` (the only field needed)
  - `IUserWithSessionFront`: User entity extended with optional `last_session` (singular)

- **Enhanced parseUser**: Updated `api/src/user/helper/parseUser.ts`
  - Now handles users with sessions from Supabase joins
  - Automatically includes `last_session` in response when present
  - **Security**: Explicitly omits sensitive fields (`password_hash`, `password_changed_at`, `password_reset_required`)
  - Only includes safe Phase 5 fields (`failed_login_attempts`, `locked_until`, `last_login_at`, `last_login_ip`)
  - Type-safe: returns `IUserEntityFront` or `IUserWithSessionFront` based on input

**Use case**: Allows administrators to see when each user was last active in the system, useful for monitoring inactive users and detecting unusual activity patterns.

#### Rate Limiting
- **Rate Limit Configuration**: Created `api/src/config/rate-limit.config.ts`
  - Configurable limits for login (5/15min), auth (10/15min), public (100/15min), private (200/15min)
  - Environment variable overrides: RATE_LIMIT_*_WINDOW_MS, RATE_LIMIT_*_MAX, RATE_LIMIT_*_MESSAGE
  - Spanish error messages matching app language

- **Rate Limit Middleware**: Created `api/src/middlewares/rate-limit.middleware.ts`
  - Factory function for creating rate limiters with consistent error format
  - Four exported limiters: loginRateLimiter, authRateLimiter, publicApiRateLimiter, privateApiRateLimiter
  - Returns 429 with RATE_LIMIT_EXCEEDED error code
  - Standard RateLimit-* headers for client consumption
  - Integrated with Morgan logging via res.locals.errorInfo

- **Main App Integration**: Updated `api/src/index.ts`
  - Applied rate limiters to all endpoint types
  - Layered protection: IP-based rate limiting + existing account lockout
  - IPs automatically freed after time window expires

- **Dependencies**: Added express-rate-limit@^6.x for IP-based rate limiting

**Use case**: Prevent brute force attacks on login endpoint and general API abuse. Works alongside existing account lockout system for two-layer security.

#### Account Unlock Feature
- **Unlock Account Method**: Added `unlockAccount()` to `api/src/auth/repository/auth.repository.ts`
  - Resets `locked_until` and `failed_login_attempts` fields
  - Allows administrators to manually unlock blocked user accounts

- **Unlock Controller**: Added `unlockAccount()` method to `api/src/user/controller/user.controller.ts`
  - Permission check: Only non-cashier users (ADMIN, SUPERADMIN, CAPITALIST, OWNER) can unlock
  - Hierarchical permissions: Admins can only unlock users below their level
  - Audit logging: Logs unlock events with admin details

- **Unlock Route**: Added `POST /api/private/user/unlock/:id` to `api/src/user/route/user.route.ts`
  - Protected route (requires authentication)
  - Returns success message on unlock

**Use case**: Allows administrators to manually unlock user accounts that were blocked due to failed login attempts, without requiring database access.

### Changed - 2026-01-15

#### Enhanced Login Error Messages
- **Auth Controller**: Updated `loginWithSession()` in `api/src/auth/controller/auth.controller.ts`
  - Wrong password now shows remaining attempts: "Contraseña incorrecta. Te quedan X intentos."
  - Account lock message improved: "Cuenta bloqueada por múltiples intentos fallidos. Por favor, contacta al administrador para desbloquear tu cuenta."
  - Removed auto-unlock time reference (now requires manual admin unlock)

**Use case**: Provides better user feedback during login attempts and clear instructions when account is locked.

### Changed - 2026-01-15

#### HTTP Error Logging Enhancement - Morgan Custom Token
**Goal:** Improve visibility of error details in production logs (Vercel dashboard)

**Problem:**
- Morgan HTTP logs only showed status codes (401, 404, etc.) without context
- Error messages were logged to Winston JSON files but not visible in Vercel logs
- When users got blocked by failed login attempts, logs showed `POST /api/auth/login 401` without explaining why
- Frontend received descriptive errors but backend logs were cryptic

**Solution:**
- Created custom Morgan token `error-info` that includes error code and message in HTTP logs
- Modified error handler to store error details in `res.locals.errorInfo` before responding
- Updated 404 handler to also include error info

**Changes:**

1. **Error Middleware** (`api/src/middlewares/error.middleware.ts`):
   - All error types now set `res.locals.errorInfo` with `code`, `message`, and `statusCode`
   - Applies to: ZodError, AppError, PostgrestError, and unexpected errors
   - Error info is set before `res.status().json()` so Morgan can read it

2. **Index Server Setup** (`api/src/index.ts`):
   - Registered custom Morgan token `error-info` that reads `res.locals.errorInfo`
   - Token truncates messages to 100 chars for log readability
   - Custom format string includes `:error-info` token after status code
   - 404 handler now sets `res.locals.errorInfo` for consistent logging

**Log Format Examples:**

**Before:**
```
100.52.219.255 - - [15/Jan/2026:15:19:17 +0000] "POST /api/auth/login HTTP/1.1" 401 25 "https://quini-app.vercel.app/make-plays" "Mozilla/5.0..."
```

**After:**
```
100.52.219.255 - - [15/Jan/2026:15:19:17 +0000] "POST /api/auth/login HTTP/1.1" 401 25 [UNAUTHORIZED: Cuenta bloqueada por múltiples intentos fallidos. Intenta nuevamente después de...] "https://quini-app.vercel.app/make-plays" "Mozilla/5.0..."
```

**Benefits:**
- Errors are immediately visible in Vercel logs without checking Winston files
- Faster debugging: see error reason directly in HTTP log line
- Better incident response: understand issue without reading application logs
- No performance impact: token only executes on error responses (4xx/5xx)

### Fixed - 2026-01-06

#### User Repository - Error Handling Improvement
**Fix:** Improved error handling in user repository to show meaningful error messages instead of "Error: null"

**Changes in `api/src/user/repository/user.repository.ts`:**
- Updated all `throw new Error(error.details)` to `throw new Error(error.details || error.message || JSON.stringify(error))`
- Affected methods: `getById`, `getByUsername`, `getAll`, `update`, `delete`, and related methods
- **Why:** When Supabase returns an error where `error.details` is null or undefined, it was throwing "Error: null" which is not helpful for debugging. Now it will try `error.details` first, then `error.message`, then stringify the entire error object to provide useful debugging information.

**User Experience:**
- Error messages in API responses are now more descriptive
- Developers can better diagnose issues when database queries fail
- Logs contain actionable error information

### Added - 2026-01-03

#### User Group Query Filter
**Feature:** Added ability to query users by group_id for OWNER and CAPITALIST

**Files Modified:**
1. **`api/src/user/route/user.route.ts`**
   - Added `group_id` query parameter to `getAllUserHandler`
   - OWNER and CAPITALIST can query users from any group in their network
   - Validates group belongs to user's organization network

2. **`api/src/user/controller/user.controller.ts`**
   - Added `getNetworkOrgIds()` method to get all org IDs in the hierarchy

### Added - 2026-01-02

#### Groups/Sub-Organizations Feature - Hierarchical Organization Structure
**Feature:** Complete backend support for hierarchical organizations and CAPITALIST user type

**Database Migrations:**
1. **`20260102100000_add_parent_org_id_to_organizations.sql`**
   - Added `parent_organization_id` column to organizations table
   - Allows creating sub-organizations (groups) that belong to a parent
   - Index for efficient hierarchy queries

2. **`20260102100001_add_org_hierarchy_functions.sql`**
   - `get_organization_descendants(org_id)` - Recursive function to get all sub-orgs
   - `get_organization_ancestors(org_id)` - Get parent chain
   - `is_organization_descendant(org_id, potential_ancestor)` - Check hierarchy membership

3. **`20260102130646_capitalist_user_type.sql`**
   - Added CAPITALIST enum value to user_type

4. **`20260102130647_migrate_superadmin_to_capitalist.sql`**
   - Migrated existing SUPERADMIN users to CAPITALIST
   - Updated constraints to include CAPITALIST

5. **`20260102130827_rpc_inherit_organization_config.sql`**
   - `inherit_organization_config(parent_id, child_id)` - Copy lotteries, schedules, schedule_lotteries from parent to new sub-org

6. **`20260102140000_rpc_current_account_network.sql`**
   - `calculate_current_account_network(date, leave, liquidated, org_id)` - Calculate accounts for entire network
   - `get_current_accounts_network_summary(org_id, date)` - Aggregated totals per org

**User Module Updates:**
- `src/user/repository/user.repository.ts`
  - Added `getOrganizationDescendants()` and `isSubOrganization()` methods
  - Updated `getAll()` with visibility logic for CAPITALIST and SUPERADMIN
- `src/user/controller/user.controller.ts`
  - Added USER_HIERARCHY constant and `canManageUser()` function
  - Renamed `validateSuperAdmin` to `validateCapitalist`
- `src/user/route/user.route.ts`
  - Changed `/validate-superadmin` to `/validate-capitalist`
  - Updated permission checks to include CAPITALIST
- `src/user/helper/userBase.ts`
  - Added CAPITALIST to shouldNumberBeNull check
- `src/user/helper/parseUser.ts`
  - Updated comments for CAPITALIST

**Organization Module Updates:**
- `src/organization/repository/organization.repository.ts`
  - Added `getChildren()`, `getDescendants()`, `createSubOrganization()`, `inheritConfiguration()`
- `src/organization/controller/organization.controller.ts`
  - Updated `create()` to use CAPITALIST instead of SUPERADMIN
  - Added `createSubOrganization()` with config inheritance
  - Added `getChildren()`
- `src/organization/route/organization.route.ts`
  - Added routes: `GET /:id/children`, `POST /:id/sub`
  - Changed superAdmin to capitalist in createHandler
- `src/organization/helper/parseOrganization.ts`
  - Added `parent_organization_id` to parsed output

**Current Account Module Updates:**
- `src/current-account/repository/current-account.repository.ts`
  - Added `getOrganizationNetworkIds()`, `calculateCurrentAccountNetworkHandler()`, `getAllCurrentAccountNetworkHandler()`, `getNetworkSummaryHandler()`
- `src/current-account/controller/current-account.controller.ts`
  - Added `calculateCurrentAccountNetworkHandler()`, `getAllCurrentAccountNetworkHandler()`, `getNetworkSummaryHandler()`
- `src/current-account/route/current-account.route.ts`
  - Added routes: `GET /network/summary`, `POST /calculate/network`, `POST /liquidate/network`
  - Updated `getAllCurrentAccountHandler` to support `include_network` query param

**New User Hierarchy:** OWNER → CAPITALIST → SUPERADMIN → ADMIN → CASHIER
### Fixed - 2026-01-02

#### ticket_full_json_plpgsql - Group by bet_order
**Fix:** Updated `ticket_full_json_plpgsql` to group bets by `bet_order` instead of by `number/amount/place/with/position`

**Problem:**
- Function was grouping bets by field values, causing bets with same number but different amounts to merge incorrectly
- Example: `1234 $10 HEAD` and `1234 $100 HEAD` would show as single entry

**Solution:**
- Changed grouping logic to use `bet_order` column as unique identifier
- Updated DISTINCT ON clause to use `(ticket_id, bet_order, schedule_id, lottery_id)`
- Added `bet_order` to JSON output for frontend use as React key

**File:**
- `supabase/migrations/20260102194200_fix_ticket_full_json_group_by_bet_order.sql`