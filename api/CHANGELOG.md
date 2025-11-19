# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
