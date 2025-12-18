# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - 2025-12-16

#### Lottery Creation Order Handling
- **Automatic Order Assignment**: Fixed lottery creation to properly handle order field
  - File: `api/src/lottery/controller/lottery.controller.ts:14-25`
  - If order is not provided, automatically calculates next available order for organization
  - Prevents all lotteries from being created with order 0
  - Use case: Ensures proper lottery ordering when order field is omitted

- **Order Field Support**: Fixed lotteryBase to use provided order value
  - File: `api/src/lottery/helper/lotteryBase.ts:15`
  - Changed from hardcoded `order: 0` to `order: lottery.order ?? 0`
  - Allows manual specification of lottery position
  - Use case: Supports custom lottery ordering during creation

### Added - 2025-12-16

#### Lottery Order Calculation
- **getNextOrder Repository Method**: Added method to calculate next available order
  - File: `api/src/lottery/repository/lottery.repository.ts:61-78`
  - Queries highest order value for organization
  - Returns 0 for first lottery, increments for subsequent lotteries
  - Handles case when no lotteries exist (PGRST116 error)
  - Use case: Automatic sequential ordering of lotteries per organization

### Added - 2025-12-16

#### Ticket Validation for Active Schedules and Lotteries
- **RPC Validation Function**: Created `validate_active_schedules_lotteries()` function
  - File: `api/supabase/migrations/20251216152017_add_active_validation_to_ticket_rpcs.sql`
  - Parameters: `p_schedule_ids UUID[]`, `p_lottery_ids UUID[]`, `p_organization_id UUID`
  - Validates that all schedules and lotteries referenced in ticket operations are active
  - Returns void on success, raises exception with clear error messages on failure
  - Error codes: `P0001` (RAISE EXCEPTION)
  - Error messages include entity names for user clarity
  - Use case: Prevents ticket creation/editing with inactive schedules or lotteries

- **create_ticket_with_bets RPC Enhancement**: Added active status validation before ticket creation
  - File: `api/supabase/migrations/20251216152017_add_active_validation_to_ticket_rpcs.sql`
  - Extracts unique schedule_ids and lottery_ids from ticket JSON
  - Calls `validate_active_schedules_lotteries()` before inserting ticket
  - Prevents creating tickets with inactive schedules: "Cannot process ticket: Schedule(s) [names] are inactive"
  - Prevents creating tickets with inactive lotteries: "Cannot process ticket: Lottery(s) [names] are inactive"
  - Ensures data integrity at database level
  - Use case: Protects against frontend bugs or stale data when creating new tickets

- **edit_ticket_replace_bets RPC Enhancement**: Added active status validation before ticket editing
  - File: `api/supabase/migrations/20251216152017_add_active_validation_to_ticket_rpcs.sql`
  - Extracts unique schedule_ids and lottery_ids from updated bets JSON
  - Calls `validate_active_schedules_lotteries()` before updating bets
  - Same error messages as create operation for consistency
  - Prevents editing tickets with inactive schedules or lotteries
  - Ensures existing tickets can't be modified with newly deactivated entities
  - Use case: Protects data integrity when modifying existing tickets

### Changed - 2025-12-16

#### Username Unique Index Scoped by Organization
- **Database Migration**: Changed username uniqueness from global to per-organization
  - File: `api/supabase/migrations/20251216125154_alter_user_index_unique.sql`
  - Dropped global unique index `unique_username_not_deleted`
  - Created new partial unique index `unique_username_per_org_when_active`
  - Index: `UNIQUE (organization_id, username) WHERE deleted_at IS NULL`
  - Allows different organizations to have users with the same username
  - Example: Organization A can have user "admin" and Organization B can also have user "admin"
  - Use case: Multi-tenant system where each organization manages its own users independently

#### Schedule Lottery Constraint Scoped by Organization
- **Database Migration**: Updated schedule_lottery unique constraint to be per organization
  - File: `api/supabase/migrations/20251216120550_alter_schedule_lottery_constraint.sql`
  - Dropped global constraint `unique_schedule_lottery_day`
  - Created new constraint `unique_schedule_lottery_day_per_org`
  - New constraint includes `organization_id` in the uniqueness check
  - Constraint: `UNIQUE (organization_id, schedule_id, lottery_id, day)`
  - Allows each organization to have independent lottery schedule configurations
  - Use case: Organization A can have the same schedule-lottery-day combination as Organization B without conflicts

#### Organization Name Unique Constraint for Active Organizations Only
- **Database Migration**: Changed organization name uniqueness to partial index
  - File: `api/supabase/migrations/20251216115330_alter_org_name_constraint.sql`
  - Dropped global UNIQUE constraint on `name` column
  - Created partial unique index: `unique_organization_name_when_active`
  - Index only applies when `deleted_at IS NULL` (active organizations)
  - Allows reusing organization names after soft delete
  - Similar pattern to username and number fields in users table
  - Use case: Organizations can be recreated with the same name after deletion

### Changed - 2025-12-15

#### Organization Cascade Soft Delete
- **Organization Repository**: Implemented cascade soft delete for organizations
  - File: `api/src/organization/repository/organization.repository.ts`
  - When an organization is deleted, all related data is automatically soft-deleted:
    1. `ticket_prizes_by_turn` - Prize records
    2. `bets` - All bets
    3. `tickets` - All tickets
    4. `current_accounts` - Account statements
    5. `results` - Lottery results
    6. `schedule_lotteries` - Schedule-lottery associations
    7. `schedules` - Lottery schedules
    8. `lotteries` - Lottery configurations
    9. `users` - All users in the organization
    10. `organizations` - The organization itself
  - All deletions use the same timestamp for consistency
  - Only affects non-deleted records (`.is('deleted_at', null)`)
  - Provides detailed error messages for each step
  - Use case: Ensures data integrity and prevents orphaned records when deleting an organization

#### User Number Field Made Conditionally Nullable
- **Database Migration**: Made user number nullable for OWNER and SUPERADMIN users
  - File: `api/supabase/migrations/20251215234045_alter_user_number_nullable.sql`
  - Updated existing OWNER/SUPERADMIN users to have NULL numbers
  - Made `number` column nullable in users table
  - Replaced unique index with organization-scoped index: `unique_number_when_not_null_and_not_deleted`
  - Added CHECK constraint: `check_number_required_for_admin_cashier`
  - Constraint ensures number is NOT NULL for ADMIN and CASHIER, but allows NULL for OWNER and SUPERADMIN
  - Use case: OWNER and SUPERADMIN users don't need user numbers, only ADMIN and CASHIER do

- **User Creation Logic**: Updated to handle nullable numbers
  - File: `api/src/user/helper/userBase.ts`
  - `getBaseUserFields` now sets number to NULL for OWNER/SUPERADMIN users
  - Added validation in `buildUserForDB` to throw error if ADMIN/CASHIER has null number
  - Use case: Prevents invalid user creation at application level before database insertion

- **User Repository**: Added null safety for number filtering
  - File: `api/src/user/repository/user.repository.ts`
  - Updated `getAll` method to check for undefined/null before filtering by cashier_number
  - Use case: Prevents query errors when number is null

#### Organization Creation with Super Admin User
- **Organization Controller**: Updated to create organization and super admin user atomically
  - File: `api/src/organization/controller/organization.controller.ts`
  - Updated `create` method signature to accept `INewOrganizationEntity` and `INewUserEntity`
  - Creates organization first, then creates super admin user with the organization_id
  - Implements rollback: if super admin creation fails, the organization is deleted
  - Use case: Ensures every new organization has a super admin user automatically

- **Organization Route**: Updated to accept and validate super admin data
  - File: `api/src/organization/route/organization.route.ts`
  - Updated `createHandler` to extract both organization and superAdmin from request body
  - Added validation for super admin data presence
  - Passes both organization and superAdmin data to controller
  - Use case: API endpoint now requires super admin data when creating organizations

### Fixed - 2025-12-15

#### Type System Refactoring - Organization ID in JWT and Type Safety
- **Auth Middleware**: Fixed organization_id extraction from JWT token
  - File: `api/middlewares/auth.middleware.ts`
  - Changed from accessing `user.organization_id` to `userDecoded.organization_id`
  - Updated ITokenPayload to include organization_id at top level
  - Reason: IUserEntityFront no longer includes organization_id (removed to separate concerns)

- **JWT Token Management**: Updated token signing to include organization_id
  - File: `api/helper/JWT.ts`
  - Added organization_id parameter to signUserToken function
  - JWT payload now includes: user, token, and organization_id

- **Auth Controller**: Return organization_id separately from user object
  - File: `api/src/auth/controller/auth.controller.ts`
  - login method now returns `{ user: IUserEntityFront; organization_id: string }`
  - Organization ID extracted from database user object

- **Auth Route**: Updated to pass organization_id when signing user token
  - File: `api/src/auth/route/auth.route.ts`
  - Calls signUserToken with both user and organization_id

- **Helper Base Functions**: Added organization_id parameter to entity builders
  - `api/src/lottery/helper/lotteryBase.ts`: Added organization_id and order field
  - `api/src/shcedule/helper/scheduleBase.ts`: Added organization_id parameter
  - `api/src/user/helper/userBase.ts`: Added organization_id parameter to buildUserForDB
  - `api/src/results/helper/resultsBase.ts`: Added organization_id parameter
  - `api/src/ticket/helper/ticketBase.ts`: Changed return type to Omit organization_id (added in controller)

- **Parse Functions**: Added missing fields to entity parsers
  - `api/src/lottery/helper/parseLottery.ts`: Added order field to output

- **Repository Method Signatures**: Standardized parameter order (id, payload, organization_id)
  - `api/src/lottery/repository/lottery.repository.ts`: Fixed update method signature
  - `api/src/shcedule/repository/schedule.repository.ts`: Fixed update method signature
  - `api/src/user/repository/user.repository.ts`: Fixed update method signature
  - `api/src/results/repository/results.repository.ts`: Fixed update method signature

- **Controllers**: Updated to pass organization_id to base functions and repositories
  - Lottery: Pass organization_id to lotteryBase
  - Schedule: Pass organization_id to scheduleBase
  - User: Pass organization_id to buildUserForDB
  - Results: Pass organization_id to resultsBase and repository get method

- **Organization Route**: Fixed organization_id access
  - File: `api/src/organization/route/organization.route.ts`
  - Changed from `user?.user.organization_id` to `user?.organization_id`

- **Schedule-Lottery Route**: Added organization_id to insertData array
  - File: `api/src/schedule-lottery/route/schedule-lottery.route.ts`
  - insertData now includes organization_id for each item

- **Type Definitions**: Fixed import errors and added organization_id to request types
  - `helper/response/results.response.ts`: Fixed typo IResultEntityFront -> IResultsEntityFront
  - `helper/types/ticket.type.ts`: Fixed import path from ticket.response to ticket.request
  - `helper/request/ticket.request.ts`:
    - Fixed ITicketEntityFrontCompact to omit organization_id
    - Added organization_id to IPayTicketEntity
    - Added organization_id to IGetAllTicketEntity
  - `helper/request/current_account.request.ts`: Added organization_id to request types
  - `helper/types/auth.type.ts`: Added organization_id to ITokenPayload

### Changed - 2025-12-15

#### API Controllers and Routes - Organization ID Refactoring
- **Refactored all API modules**: Standardized organization_id parameter handling across 8 modules
  - **Pattern**: Controllers now accept `organization_id` as a separate parameter instead of including it in request props
  - **Benefits**:
    - Consistent signature across all controller methods
    - Clearer separation of concerns (business data vs context)
    - Matches pattern already established in lottery module
    - Easier to maintain and understand

  **Modules Updated:**

  1. **Schedule Module**
     - Controller: `api/src/shcedule/controller/schedule.controller.ts`
       - `create(props, organization_id)`
       - `get(props, organization_id)`
       - `update(id, props, organization_id)`
       - `delete(props, organization_id)`
     - Route: `api/src/shcedule/route/schedule.route.ts`
       - All handlers pass `req.organization_id!` as separate argument

  2. **Ticket Module**
     - Controller: `api/src/ticket/controller/ticket.controller.ts`
       - `create(props, organization_id)`
       - `get(props, organization_id)`
       - `update(props, organization_id)`
       - `delete(props, organization_id)`
     - Route: `api/src/ticket/route/ticket.route.ts`
       - All handlers pass `req.organization_id!` as separate argument

  3. **User Module**
     - Controller: `api/src/user/controller/user.controller.ts`
       - `get(props, organization_id)`
       - `update(user_id, props, organization_id)`
       - `delete(props, organization_id)`
     - Route: `api/src/user/route/user.route.ts`
       - All handlers pass `req.organization_id!` as separate argument

  4. **Results Module**
     - Controller: `api/src/results/controller/results.controller.ts`
       - `create(props, organization_id)`
       - `get(props, organization_id)`
       - `update(id, props, organization_id)`
     - Route: `api/src/results/route/results.route.ts`
       - All handlers pass `req.organization_id!` as separate argument

  5. **Winners Module**
     - Controller: `api/src/winners/controller/winners.controller.ts`
       - Already using correct pattern (organization_id as separate parameter)
     - Route: `api/src/winners/route/winners.route.ts`
       - Already using correct pattern

  6. **Bet Module**
     - Controller: `api/src/bet/controller/bet.controller.ts`
       - Already using correct pattern (organization_id as separate parameter in object destructuring)
     - Route: `api/src/bet/route/bet.routes.ts`
       - Already using correct pattern

  7. **Current-Account Module**
     - Controller: `api/src/current-account/controller/current-account.controller.ts`
       - Already using correct pattern
     - Route: `api/src/current-account/route/current-account.route.ts`
       - Fixed parameter order in `calculateCurrentAccountHandler` calls
       - Fixed `updateCurrentAccountHandler` to pass organization_id as separate parameter
       - Fixed `bulkUpdateCurrentAccountHandler` to pass organization_id as separate parameter

  8. **Schedule-Lottery Module**
     - Controller: `api/src/schedule-lottery/controller/schedule-lottery.controller.ts`
       - Already using correct pattern
     - Route: `api/src/schedule-lottery/route/schedule-lottery.route.ts`
       - Already using correct pattern

- **Repository Layer**: No changes required (repositories already accept organization_id as separate parameter)
- **Impact**: Breaking change for internal API, but improves code consistency and maintainability
- **Migration Notes**: All route handlers updated to extract organization_id from `req.organization_id!` and pass as separate argument

### Fixed - 2025-12-15

#### User Repository - Empty List Handling
- **Issue**: Repository could return null instead of empty array when no users found
- **Fix**: `api/src/user/repository/user.repository.ts:34`
  - Changed `return data;` to `return data || [];`
  - Ensures empty array is always returned when no users match criteria
  - Prevents null reference errors in frontend
- **Impact**: User list displays "No hay usuarios disponibles" instead of error

### Added - 2025-12-15

#### Database Migrations - Lotteries and Schedules Enhancement

##### Lotteries Order Column
- **Migration**: `api/supabase/migrations/20251215162729_alter_lotteries_add_order_column.sql`
- **New Column**: `order INTEGER NOT NULL DEFAULT 0`
  - Allows custom ordering of lotteries in UI
  - Indexed for better query performance
  - Default value 0 for backward compatibility
- **Repository Update**: `api/src/lottery/repository/lottery.repository.ts:24`
  - Changed ordering from `created_at` to `order` column
  - Lotteries now returned in user-defined order
- **Type Update**: `ILotteryEntityBack` now includes `order: number`
- **Request Types**: `INewLotteryEntity` and `IUpdateLotteryEntity` support `order` field

##### Schedules Active Column
- **Migration**: `api/supabase/migrations/20251215163544_alter_schedules_add_active_column.sql`
- **New Column**: `active BOOLEAN NOT NULL DEFAULT true`
  - Allows marking schedules as active/inactive
  - Indexed for better query performance
  - Default value true for backward compatibility
- **Repository Update**: `api/src/shcedule/repository/schedule.repository.ts:30-58`
  - Added `all` parameter to `getAll()` method
  - Filters by `active=true` by default (unless `all=true`)
  - Maintains ordering by `time` column
- **Controller Update**: `api/src/shcedule/controller/schedule.controller.ts:36`
  - Added `all` parameter support
- **Route Update**: `api/src/shcedule/route/schedule.route.ts:82-102`
  - Added `?all` query parameter support
  - Updated cache keys to differentiate active vs all schedules
  - Cache invalidation handles both variants
- **Type Update**: `IScheduleEntityBack` now includes `active: boolean`
- **Request Types**: `INewScheduleEntity` and `IUpdateScheduleEntity` support `active` field

#### CASHIER Access Control (Already Implemented)
- **Lottery Routes**: CASHIER users receive 403 Forbidden on create/update/delete
  - Paths: `api/src/lottery/route/lottery.route.ts:48,144,193`
- **Schedule Routes**: CASHIER users receive 403 Forbidden on create/update/delete
  - Paths: `api/src/shcedule/route/schedule.route.ts:40,134,180`
- **Security**: Only ADMIN, OWNER, and SUPERADMIN can modify lotteries and schedules

### Fixed - 2025-12-10

#### Authentication Middleware - Incorrect HTTP Status Code
**Issue:** Middleware returned 400 (Bad Request) when authentication token was missing
**Root Cause:** Missing token is an authentication issue, not a malformed request
**Solution:** Changed HTTP status code from 400 to 401 in `api/middlewares/auth.middleware.ts:29`
**Impact:**
- Frontend AuthProvider now correctly handles missing tokens
- Eliminates 400 errors in console during initial app load
- Proper REST API semantics (401 = Unauthorized, 400 = Bad Request)

---
