# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - 2025-12-24

#### Delete Ticket Endpoint - Response Format
**Fix:** Changed response from plain text to JSON format
**File:** `api/src/ticket/route/ticket.route.ts:181-187`

**Problem:** DELETE `/api/private/ticket/:id` endpoint was using `res.sendStatus(200)` which sends HTTP status code with plain text "OK". Frontend expects all responses to be JSON with `APIResponse<T>` structure, causing "Invalid response format: text/plain" error.

**Solution:** Replaced `res.sendStatus(200)` with `res.status(200).json(response)` including proper `APIResponse` structure:
```typescript
const response: APIResponse<{ success: boolean }> = {
  data: { success: true }
};
res.status(200).json(response);
```

**Impact:** Consistent JSON responses across all endpoints. Frontend can properly handle delete ticket success/error states.

### Added - 2025-12-20

#### Schedule Lottery Atomic Transactions
- **PostgreSQL RPC Function**: Created RPC function for atomic schedule lottery saves
  - File: `api/supabase/migrations/20251220085729_add_save_schedule_lottery_rpc.sql`
  - Function `save_schedule_lottery(p_schedule_lottery jsonb, p_organization_id uuid)`
  - Ensures all delete+insert operations happen in a single database transaction
  - Prevents partial updates if something fails during save
  - Handles day key to day number conversion (MONDAY → 1, etc.)
  - Validates day keys and raises exception for invalid values
  - Use case: Data consistency for schedule lottery configuration

- **Performance Indexes**: Added indexes for schedule_lotteries table
  - File: `api/supabase/migrations/20251220085730_add_schedule_lottery_indexes.sql`
  - `idx_schedule_lotteries_org_day_schedule`: Optimizes delete operations in RPC function
  - `idx_schedule_lotteries_org_day`: Optimizes queries filtering by organization and day
  - `idx_schedule_lotteries_org_schedule`: Optimizes queries filtering by organization and schedule
  - Use case: Faster query performance for schedule lottery operations

- **Day Filtering for Lotteries**: Added `?day=MONDAY` query parameter to GET /api/lotteries
  - Files:
    - `api/src/lottery/route/lottery.route.ts`
    - `api/src/lottery/controller/lottery.controller.ts`
    - `api/src/schedule-lottery/controller/schedule-lottery.controller.ts`
    - `api/src/schedule-lottery/repository/schedule-lottery.repositroy.ts`
  - Returns only lotteries configured for specified day based on schedule_lotteries table
  - Can combine with `active_only=true` to get active lotteries for a day
  - Validates day parameter against SCHEDULE_DAY enum
  - Returns 400 for invalid day values with clear error message
  - Cache-Control: `public, max-age=60, must-revalidate` for day-filtered queries
  - Use case: Optimizes make plays page to fetch only relevant lotteries

- **Day Filtering for Schedules**: Added `?day=MONDAY&with_lotteries=true` to GET /api/schedules
  - Files:
    - `api/src/shcedule/route/schedule.route.ts`
    - `api/src/shcedule/controller/schedule.controller.ts`
  - Returns only schedules that have lotteries configured for specified day
  - When `with_lotteries=true`, includes lottery_ids array in response for each schedule
  - Validates day parameter against SCHEDULE_DAY enum
  - Returns 400 for invalid day values
  - Cache-Control: `public, max-age=60, must-revalidate` for day-filtered queries
  - Use case: Single request in make plays to get schedules with their lotteries for a specific day

- **Schedule Lottery Helper Methods**: Added utility methods to ScheduleLotteryController
  - File: `api/src/schedule-lottery/controller/schedule-lottery.controller.ts`
  - `getLotteryIdsForDay(organization_id, day)`: Returns unique lottery IDs for a day
  - `getScheduleIdsForDay(organization_id, day)`: Returns unique schedule IDs for a day
  - `getLotteryIdsByScheduleAndDay(organization_id, schedule_id, day)`: Returns lottery IDs for specific schedule and day
  - Used by lotteries and schedules endpoints for day filtering
  - Use case: Reusable logic for day-based filtering across multiple endpoints

### Changed - 2025-12-20

#### Schedule Lottery Backend Robustness
- **Simplified Architecture**: Moved business logic from route handler to controller
  - Files:
    - `api/src/schedule-lottery/controller/schedule-lottery.controller.ts`
    - `api/src/schedule-lottery/route/schedule-lottery.route.ts`
  - Added `saveScheduleLottery()` method to controller that orchestrates the save
  - Route handler now calls controller method instead of manual loops
  - Better separation of concerns and easier to test
  - Code reduction: ~60% fewer lines in route handler (80 → 30 lines)
  - Use case: Cleaner architecture following controller pattern

- **RPC-Based Save**: Repository now uses PostgreSQL RPC function for atomic saves
  - File: `api/src/schedule-lottery/repository/schedule-lottery.repositroy.ts`
  - Added `saveScheduleLottery()` method that calls `save_schedule_lottery` RPC function
  - Keeps existing methods for backwards compatibility
  - Proper error handling for RPC calls
  - Use case: Atomic transactions prevent data corruption

### Added - 2025-12-20

#### Database Integrity Improvements
- **Organization Foreign Key**: Added foreign key constraint for organization_id in schedule_lotteries
  - File: `api/supabase/migrations/20251220133625_add_schedule_lotteries_org_fk.sql`
  - Ensures referential integrity with organizations table
  - ON DELETE CASCADE: Automatically cleans up schedule_lotteries when organization is deleted
  - Prevents orphaned records
  - Use case: Maintains data consistency when organizations are removed

### Fixed - 2025-12-20

#### Cookie Logout Fix
- **Environment-Based Cookie Security**: Fixed logout not clearing cookies correctly in development
  - File: `api/src/auth/route/auth.route.ts`
  - Added `IS_PRODUCTION` constant based on `process.env.IS_LOCAL`
  - Development (HTTP): `secure: false` and `sameSite: 'lax'`
  - Production (HTTPS): `secure: true` and `sameSite: 'none'`
  - Fixed both login and logout handlers to use matching cookie parameters
  - Issue: Cookies with `secure: true` don't work on HTTP (localhost), preventing proper logout
  - Solution: Cookie parameters now match exactly between set and clear operations
  - Use case: Logout now correctly clears session cookies in all environments

#### Schedule Lottery Data Consistency
- **Transaction Handling**: All delete+insert operations now wrapped in database transaction
  - File: `api/supabase/migrations/20251220085729_add_save_schedule_lottery_rpc.sql`
  - RPC function ensures atomicity - either all changes succeed or none do
  - Prevents partial updates if operation fails midway
  - Use case: Data integrity for schedule lottery configuration

- **Request Validation**: Added comprehensive validation layer for schedule lottery save requests
  - File: `api/src/schedule-lottery/route/schedule-lottery.route.ts`
  - Validates scheduleLottery is an object
  - Validates day keys are valid SCHEDULE_DAY enum values (SUNDAY, MONDAY, etc.)
  - Validates schedule_id and lottery_id are valid UUIDs using regex pattern
  - Validates lotteries arrays are actually arrays
  - Returns 400 with clear error messages for invalid data
  - Use case: Prevents invalid data from reaching database

### Added - 2025-12-19

#### Standardized Error Handling System
- **Error Middleware**: Created centralized error handling middleware
  - File: `api/src/middlewares/error.middleware.ts`
  - `errorHandler`: Centralized error handler with 4 parameters (Express requirement)
  - `asyncHandler`: Wrapper to eliminate try-catch boilerplate in route handlers
  - Handles ZodError, AppError, PostgrestError, and unexpected errors automatically
  - Uses Winston logger for structured error logging
  - Returns consistent APIResponse format with error codes
  - Hides sensitive details in production
  - Use case: Eliminates 60-70% of manual error handling code across all routes

- **Winston Logger**: Professional structured logging system
  - File: `api/src/utils/logger.ts`
  - Logs to `logs/error.log` and `logs/combined.log`
  - Console output in development with colors
  - Automatic log rotation (5MB max, 5 files)
  - Structured JSON format for production
  - Use case: Better debugging and error tracking

### Changed - 2025-12-19

#### User Module - Error System Migration
- **User Controller**: Migrated to typed errors
  - File: `api/src/user/controller/user.controller.ts`
  - Removed all try-catch blocks
  - Throws `InternalServerError` for Supabase auth failures
  - Cleaner code without manual error handling
  - Code reduction: ~19% fewer lines

- **User Routes**: Applied asyncHandler pattern
  - File: `api/src/user/route/user.route.ts`
  - All 5 handlers wrapped with `asyncHandler`
  - Uses `BadRequestError` and `ForbiddenError` for validation
  - Eliminated manual error responses
  - Code reduction: 65% fewer lines (387 → 135 lines)
  - Use case: Consistent error handling across all user endpoints

#### Auth Module - Error System Migration
- **Auth Repository**: Security improvement
  - File: `api/src/auth/repository/auth.repository.ts`
  - Throws `UnauthorizedError` with same message for non-existent users and wrong passwords
  - Use case: Prevents user enumeration attacks

- **Auth Controller**: Migrated to typed errors
  - File: `api/src/auth/controller/auth.controller.ts`
  - Throws `UnauthorizedError` instead of generic Error
  - Removed console.error statements (middleware logs now)

- **Auth Routes**: Applied asyncHandler pattern
  - File: `api/src/auth/route/auth.route.ts`
  - All handlers wrapped with `asyncHandler`
  - Uses `loginSchema.parse()` for automatic validation
  - Eliminated manual try-catch blocks
  - Code reduction: ~50% fewer lines

- **Auth Middleware**: Applied asyncHandler pattern
  - File: `api/middlewares/auth.middleware.ts`
  - `isAuthenticated` wrapped with `asyncHandler`
  - Throws `UnauthorizedError` instead of manual responses
  - Code reduction: 44% fewer lines (32 → 18 lines)

#### Ticket Module - Error System Migration
- **Ticket Controller**: Migrated to typed errors
  - File: `api/src/ticket/controller/ticket.controller.ts`
  - Removed all try-catch blocks
  - Uses `NotFoundError` and `InvalidDeleteTimeError`
  - Code reduction: 19% fewer lines (214 → 173 lines)

- **Ticket Routes**: Applied asyncHandler pattern
  - File: `api/src/ticket/route/ticket.route.ts`
  - All 8 handlers wrapped with `asyncHandler`
  - Uses `newTicketSchema.parse()` for validation
  - Eliminated manual error handling
  - Code reduction: 62% fewer lines (541 → 204 lines)
  - Use case: Massive simplification of ticket endpoints

### Fixed - 2025-12-19

#### Error Handler Recognition
- **Error Middleware Signature**: Fixed Express error handler not being recognized
  - File: `api/src/middlewares/error.middleware.ts`
  - Added `next: NextFunction` as 4th parameter (Express requirement)
  - Previously returned HTML instead of JSON for errors
  - Use case: Backend now correctly returns JSON error responses

### Dependencies - 2025-12-19

#### Logging
- **winston**: Added for professional structured logging
  - Version: Latest
  - Use case: Production-grade error logging and monitoring
