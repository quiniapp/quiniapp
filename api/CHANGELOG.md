# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - 2025-11-21

#### Database Index Optimization - Days 1 & 2 Completed
- **Index Audit Completed**: Comprehensive analysis of database indices
  - **Files created:**
    - `db_index_analysis.md` - Day 1 audit results
    - `day2_query_analysis.md` - Query pattern analysis
    - `db_migration_indexes.sql` - Migration script ready to execute
    - `resumen_para_manana.md` - Summary and next steps
  - **Key findings:**
    - 4 unused indices identified (64 KB wasted space)
    - `tickets` table critically under-indexed
    - `bets` table well-indexed (2,708 uses on primary index)
    - No `winners` table exists (uses `winner` column in tickets/bets)
  - **Tables analyzed:**
    - `tickets`: 13 columns, 104 KB total, 4 critical indices needed
    - `bets`: 23 columns, 6.9 MB total, 3 optional indices proposed
    - `ticket_prizes_by_turn`: PK with 0 uses (requires investigation)
    - `results`: Well optimized, possible redundancy detected
  - **Repository queries analyzed:**
    - `WinnerRepository.getAllWinners()` - Full table scan (500-1000ms)
    - `TicketRepository.getAll()` - Missing composite indices (200-500ms)
    - `TicketRepository.getAllTicketNumber()` - Same as getAll()
    - `BetRepository.getWinnerBets()` - Partial index scan (80-150ms)
    - `BetRepository.getAllBets()` - Uses existing indices well
  - **Proposed indices (7 new, 1 to drop):**
    - **Priority HIGH - tickets (4 indices):**
      - `idx_tickets_date_deleted_winner_created` - 60-80% improvement
      - `idx_tickets_user_date_deleted_created` - 70-90% improvement
      - `idx_tickets_winner_deleted_created` - 80-95% improvement
      - `idx_tickets_winner_user_deleted_created` - 85-95% improvement
    - **Priority MEDIUM - bets (3 indices):**
      - `idx_bets_date_winner_deleted_created` - 40-60% improvement
      - `idx_bets_date_schedule_winner_deleted` - 50-70% improvement
      - `idx_bets_user_date_deleted` - 30-50% improvement
    - **To drop:**
      - `idx_tpt_ticket` on `ticket_prizes_by_turn` (0 uses)
  - **Expected impact:**
    - 60-95% faster queries on tickets by date/user/winner
    - 40-70% faster queries on winner bets
    - Minimal impact on INSERTs (5-10% slower, acceptable trade-off)
    - +140-280 KB disk space (negligible)
  - **Validation with Production Data:**
    - Analyzed Supabase Performance Insights from production
    - **CONFIRMED**: Tickets query is #1 most problematic
      - 707 calls, 15.8ms average, 11.17 seconds total (7.98% of total time)
      - Filters by user_id, date, deleted_at
      - Orders by created_at DESC
      - Exactly matches `TicketRepository.getAll()` identified in analysis
    - **CONFIRMED**: Bets table well-indexed
      - 216 calls, 16.67ms average (excellent performance)
      - Cache hit rate: 99.999%
      - Current indices working perfectly
    - **CONFIRMED**: Schedules query excellent
      - 1,489 calls but only 1.68ms average (super fast)
      - No changes needed
    - **CONFIRMED**: Write RPCs acceptable
      - create_ticket_with_bets: 70-111ms (reasonable for complex INSERT)
      - generate_winners: 44-109ms (reasonable for complex logic)
    - **Expected impact validated:**
      - Conservative: 70% improvement on tickets query → saves ~7.8 seconds
      - Optimistic: 85% improvement → saves ~9.5 seconds
      - Additional 20-30% improvement on generate_winners RPCs (~1.8-2.7s)
      - Total: 6.9-8.7% improvement in total query time
    - File: `supabase_query_analysis.md`
  - **Next steps (Day 3):**
    - Execute EXPLAIN ANALYZE benchmarks BEFORE
    - Apply indices in development environment
    - Measure specific improvements
    - Validate no INSERT/UPDATE degradation
    - Prepare production deployment
  - **Technical decisions:**
    - All indices use partial indexes (`WHERE deleted_at IS NULL`)
    - Column order optimized (equality → range → order)
    - Using `CONCURRENTLY` for production safety
    - Rollback plan documented in SQL script

### Added - 2025-11-20

#### Action Plan for TODOs Implementation
- **Strategic Action Plan**: Created comprehensive prioritized action plan
  - Path: `ACTION_PLAN.md`
  - Prioritization criteria:
    - Performance impact (Critical → Low)
    - Business value (Critical → Low)
    - Implementation complexity (High → Low)
  - **4 Phases planned:**
    - **Phase 1 - Quick Wins** (1 week): Database indices + purge ticket_prizes_by_turn
    - **Phase 2 - Essential Reports** (1-2 weeks): Basic tickets, bets, and financial reports
    - **Phase 3 - Statistics Features** (1 week): Delayed numbers and hot numbers
    - **Phase 4 - Advanced** (Future): Data archiving system and advanced reports
  - Immediate priorities (P0):
    - Database indices audit and optimization (3-4 days)
    - 30-50% expected performance improvement on main queries
  - High priorities (P1):
    - Purge non-winner prizes (1 day, ~80% row reduction)
    - Basic reports system (1-2 weeks, critical for business)
  - Timeline: 3-4 weeks for Phases 1-3
  - Success metrics clearly defined for each phase
  - Rollback plans and security considerations included

#### Reports and Analytics System TODO
- **Reports System Planning**: Added comprehensive TODO for reports and analytics system
  - Path: `TODO.md` - Section "Sistema de Reportes y Estadísticas"
  - Planned features:
    - **Tickets Reports**: Quantity per day, averages, trends
    - **Bets Reports**: Quantity per day, average per ticket, distribution by lottery
    - **Financial Reports**: Income vs prizes, unpaid prizes, RTP (Return to Player)
    - **User Reports**: Top users by volume, behavior analysis, winners
    - **Lottery Reports**: Most popular lotteries, analysis by schedule, top numbers
    - **Trend Reports**: Weekly/monthly trends, peak hours
    - **Dashboard**: Summary metrics with real-time updates
    - **Export**: CSV and PDF export capabilities
  - Technical approach:
    - New module: `api/src/reports/`
    - Stored procedures for complex calculations
    - Caching with CacheManager (5-15 min TTL)
    - Materialized views for heavy calculations
    - Pre-aggregated daily summaries table
  - Endpoints planned:
    - `/api/private/reports/tickets/*`
    - `/api/private/reports/bets/*`
    - `/api/private/reports/financial/*`
    - `/api/private/reports/users/*`
    - `/api/private/reports/lotteries/*`
    - `/api/private/reports/trends/*`
    - `/api/private/reports/dashboard/*`
    - `/api/private/reports/export/*`
  - Estimated: 6-8 weeks of full development
  - Priority: High (important for business analytics)

### Added - 2025-11-19

#### Cache Management System
- **CacheManager Class**: Created centralized cache management system
  - Path: `src/cache/CacheManager.ts`
  - Features:
    - Multiple cache instances identified by unique keys
    - Optional TTL (time-to-live) configuration per cache
    - Three ETag generation strategies: counter, timestamp, hash
    - Statistics tracking: size, access count, uptime, last access
    - Automatic invalidation support
    - Inflight request deduplication to prevent duplicate DB queries
  - Benefits:
    - Eliminates code duplication across route files
    - Centralized cache monitoring and management
    - Easy to query cache state (size, age, hit rate)
    - Consistent caching behavior across all endpoints

#### Database Optimization TODO
- **Database Indices Review**: Added comprehensive TODO in `TODO.md`
  - Detailed plan for auditing and optimizing database indices
  - Recommendations for indices on all major tables
  - Performance testing methodology
  - Integration with CacheManager for maximum performance
  - Estimated 3-4 days of work for full implementation

### Changed - 2025-11-19

#### Lottery Routes - Cache Refactoring
- **lottery.route.ts**: Migrated to use CacheManager
  - Path: `src/lottery/route/lottery.route.ts`
  - Removed local cache implementation (Map, helper functions)
  - Now uses `globalCacheManager.getOrLoad()` with timestamp ETag strategy
  - Cache keys: `lotteries:all=true` and `lotteries:all=false`
  - Automatic invalidation on create/update/delete operations
  - Reduced code from ~45 lines to ~20 lines of cache logic
  - Maintains ETag/304 support for bandwidth optimization

#### Schedule-Lottery Routes - Cache Refactoring
- **schedule-lottery.route.ts**: Migrated to use CacheManager
  - Path: `src/schedule-lottery/route/schedule-lottery.route.ts`
  - Removed local cache implementation with TTL
  - Now uses `globalCacheManager.getOrLoad()` with hash ETag strategy
  - Cache key: `schedule-lotteries:all`
  - TTL: 24 hours (configurable)
  - Automatic invalidation on POST operations
  - Reduced code complexity and improved maintainability

#### Schedule Routes - Cache Refactoring
- **schedule.route.ts**: Migrated to use CacheManager
  - Path: `src/shcedule/route/schedule.route.ts`
  - Removed local cache with counter-based ETag
  - Now uses `globalCacheManager.getOrLoad()` with counter ETag strategy
  - Cache key: `schedules:all`
  - No TTL (cache persists until invalidation)
  - Automatic invalidation on create/update/delete operations
  - Removed manual inflight request handling (now managed by CacheManager)

### Added - 2025-11-13

#### Winners - Unified Transaction for Consistency
- **New RPC `generate_winners_and_calculate_accounts`**: Unified function
  - Migration: `20251113181041_sp_generate_winners_and_calculate_current_account.sql`
  - Executes `generate_winners` + `calculate_current_account` in single transaction
  - Guarantees data consistency: current accounts always reflect latest winners
  - Returns combined result with statistics from both operations
  - Use case: Ensures cuenta corriente updates immediately after generating winners

### Changed - 2025-11-13

#### Winners Repository - Simplified Flow
- **`generateWinners` now uses unified RPC**: Simplified implementation
  - Path: `src/winners/repository/winners.repository.ts:5-16`
  - Changed from calling 2 separate RPCs to 1 unified RPC
  - Removed manual date formatting (handled by stored procedure)
  - Removed `dayjs` dependency from this file
  - Returns JSONB result with statistics instead of boolean
  - Fixes race condition: cuenta corriente now updates reliably on first run

#### Database RPC - `generate_winners` Return Type
- **`generate_winners` now returns JSONB**: Breaking change for direct callers
  - Migration: `20251113181041_sp_generate_winners_and_calculate_current_account.sql`
  - Changed from `RETURNS VOID` to `RETURNS JSONB`
  - Returns: `{success, schedule_id, date, affected_tickets, winner_tickets}`
  - Forces PostgreSQL to complete transaction before returning
  - Improves observability: can now see how many tickets were affected
  - Note: Application code updated to use new unified RPC instead

### Added - 2025-11-11

#### Bet Aggregates - Enhanced Pagination Response
- **Total Counts in Aggregates**: Added `totalCount` and `totalWinnersCount` to bet aggregates
  - Path: `src/bet/controller/bet.controller.ts:75-113`
  - When filtering by `ticket_number`, uses `getAmountsByTicket` RPC
  - Returns `totalCount` (total plays) and `totalWinnersCount` (winning plays)
  - Ensures accurate totals even with pagination
  - Backend now distinguishes between ticket-specific and general totals

#### Database RPC
- **get_ticket_sums Enhancement**: Modified to return play counts
  - Migration: `20251111131145_sp_sum_amount_by_ticket_number.sql` (modified)
  - Now returns: `total_amount`, `total_prize`, `total_count`, `total_winners_count`
  - Allows accurate count of total plays and winners per ticket
  - Supports paginated display with correct totals

#### Authentication
- **Session Cookies Documentation**: Added comments explaining cookie behavior
  - Path: `src/auth/route/auth.route.ts` (lines 60-61)
  - Documented that cookies are session cookies (no `maxAge`)
  - Noted that 3-hour timeout is managed by frontend `AuthProvider`

#### Current Account - New Endpoints
- **POST /api/private/current_account/calculate**: New calculate-only endpoint
  - Path: `src/current-account/route/current-account.route.ts` (line 26)
  - Handler: `calculateCurrentAccountHandler` (lines 84-133)
  - Parameters: `date` (query string)
  - Behavior: Recalculates current account WITHOUT liquidating
  - Sets `leave = false` and `liquidated = false`
  - Use case: Refresh/update button functionality

- **POST /api/private/current_account/liquidate**: New liquidation endpoint
  - Path: `src/current-account/route/current-account.route.ts` (line 27)
  - Handler: `liquidateCurrentAccountHandler` (lines 135-184)
  - Parameters: `date`, `leave` (query strings)
  - Behavior: Liquidates current account, can mark as leave
  - Sets `liquidated = true`
  - Use case: Official liquidation generation

### Changed - 2025-11-11

#### Current Account Routes
- **Route Organization**: Restructured current account routes
  - Path: `src/current-account/route/current-account.route.ts`
  - `/calculate` → Calculate only (no liquidation)
  - `/liquidate` → Full liquidation with leave option
  - `/` (base) → Maintained for backward compatibility, uses calculate logic

#### Current Account Handler
- **calculateCurrentAccountHandler**: Modified behavior
  - Path: `src/current-account/route/current-account.route.ts` (lines 84-133)
  - Previously accepted `leave` parameter from query
  - Now hardcoded to `leave = false` and `liquidated = false`
  - Only recalculates values without marking as liquidated
  - Used by both `/calculate` endpoint and legacy `/` endpoint

### Documentation - 2025-11-11

#### Controller Method Signature
The underlying controller method remains unchanged:
```typescript
calculateCurrentAccountHandler(
  date?: string,
  leave?: boolean,
  liquidated?: boolean
)
```

#### Endpoint Behavior Matrix
| Endpoint | leave | liquidated | Use Case |
|----------|-------|-----------|----------|
| POST /calculate | false | false | Refresh/Update |
| POST /liquidate | from query | true | Official Liquidation |
| POST / (legacy) | false | false | Backward compatibility |

#### RPC Function
All endpoints use the same RPC: `calculate_current_account`
```sql
calculate_current_account(
  p_date_text: text,
  p_calculate_leave: boolean,
  p_liquidated: boolean
)
```

## Notes

### Breaking Changes
- None - All changes are additive or internal refactoring
- Legacy `POST /current_account` endpoint maintained for compatibility

### Backward Compatibility
- Existing clients using `POST /current_account` continue to work
- Behavior unchanged: recalculates without liquidating
- No migration required for existing integrations

### Frontend Integration
These backend changes support the frontend separation of:
- "Actualizar" button → Uses `/calculate` (refresh only)
- "Generar Liquidación" button → Uses `/liquidate` (official liquidation)

### Future Improvements
Consider:
- Adding response type indicators (calculated vs liquidated)
- Audit logging for liquidation operations
- Transaction support for bulk updates + liquidation
