# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed - 2025-12-31

#### update_current_account_recompute - Soporte para previous_balance y previous_drag
**Fix:** El stored procedure `update_current_account_recompute` ahora acepta `previous_balance` y `previous_drag` desde el JSON `p_props`

**Problema:**
- El SP ignoraba los campos `previous_balance` y `previous_drag` enviados en `p_props`
- Siempre calculaba estos valores desde la fila anterior en la base de datos
- Esto impedía actualizar manualmente estos campos para una cuenta corriente específica

**Solución:**
- Agregados flags `has_previous_balance` y `has_previous_drag` para detectar si vienen en el JSON
- Si `previous_balance` viene en `p_props`, usa ese valor en lugar del calculado
- Si `previous_drag` viene en `p_props`, usa ese valor directamente y resetea `v_prev_leave` para evitar interferencias

**Archivo:**
- `supabase/migrations/20251231173925_fix_update_current_account_recompute_prev_fields.sql`

### Fixed - 2025-12-29

#### TypeScript Compilation Errors Resolution
**Fix:** Fixed all TypeScript compilation errors in API routes and auth modules

**Files Modified:**

1. **`src/user/route/user.route.ts`** (3 errors fixed)
   - Line 189-193: `resetPasswordHandler` - Fixed `APIResponse` type
     - Changed: `APIResponse<{ password: string }>` → `APIResponse<string>`
     - Fixed data structure to match `{ [key: string]: T }` format
   - Line 222-226: `changePasswordHandler` - Fixed `APIResponse` type
     - Changed: `APIResponse<{ success: boolean }>` → `APIResponse<boolean>`
   - Line 263-267: `validateSuperAdminHandler` - Fixed `APIResponse` type
     - Changed: `APIResponse<{ user_id: string }>` → `APIResponse<string>`

2. **`src/auth/route/auth.route.ts`** (1 error fixed)
   - Line 115-119: `refreshHandler` - Fixed `APIResponse` type
     - Changed: `APIResponse<{ success: boolean }>` → `APIResponse<boolean>`

3. **`src/ticket/route/ticket.route.ts`** (1 error fixed)
   - Line 182-186: Handler - Fixed `APIResponse` type
     - Changed: `APIResponse<{ success: boolean }>` → `APIResponse<boolean>`

4. **`src/auth/controller/auth.controller.ts`** (1 error fixed)
   - Line 95: Fixed possibly undefined `failed_login_attempts`
     - Changed: `userData?.failed_login_attempts + 1`
     - Fixed: `(userData.failed_login_attempts ?? 0) + 1`
     - Prevents `undefined + 1 = NaN`

5. **`src/auth/repository/auth.repository.ts`** (1 error fixed)
   - Lines 64-84: `incrementFailedAttempts()` fallback
     - Removed invalid `supabase.sql` usage (doesn't exist in JS client)
     - Implemented fetch-then-update pattern:
       1. Fetch current `failed_login_attempts`
       2. Increment locally: `(value ?? 0) + 1`
       3. Update in database
     - Maintains robust fallback if RPC function unavailable

6. **`src/session/repository/session.repository.ts`** (16 errors fixed)
   - Lines 243-260: `mapToSession()` method
     - Added type assertions for all `unknown` values from database:
       - `data.session_id as string`
       - `data.user_id as string`
       - `data.organization_id as string`
       - `data.refresh_token_hash as string`
       - `data.refresh_token_version as number`
       - `data.ip_address as string || null`
       - `data.user_agent as string || null`
       - `data.device_fingerprint as string || null`
       - `data.created_at as string` → `new Date(...)`
       - `data.last_activity_at as string` → `new Date(...)`
       - `data.expires_at as string` → `new Date(...)`
       - `data.is_active as boolean`
       - `data.revoked_at as string || null` → `new Date(...) || null`
       - `data.revoked_reason as string || null`

**Root Cause Analysis:**

**APIResponse Type Structure:**
```typescript
type APIResponse<T> = {
  data: {
    [key: string]: T;  // ← Data must be object with string keys
  };
};
```

**Incorrect Usage:**
```typescript
const response: APIResponse<{ success: boolean }> = {
  data: { success: true },  // Type: { success: boolean }
  // Expected: { [key: string]: { success: boolean } }
};
```

**Correct Usage:**
```typescript
const response: APIResponse<boolean> = {
  data: { success: true },  // Type: { success: boolean }
  // Matches: { [key: string]: boolean }
};
```

**Impact:**
- ✅ All TypeScript compilation errors resolved (0 errors)
- ✅ Type safety improved across authentication and user management
- ✅ Proper handling of nullable/undefined values
- ✅ Consistent API response format
- ✅ Ready for production deployment

**Testing:**
- `npx tsc --noEmit` passes with 0 errors
- `npx eslint "src/**/*.ts" --max-warnings=0` passes

---

#### ESLint Type Safety Improvements
**Fix:** Replaced all `any` types with proper TypeScript types to pass ESLint checks

**Files Modified:**

1. **`src/auth/route/auth.route.ts`**
   - Removed unused variable `IS_PRODUCTION` (no-unused-vars)
   - Now uses `SESSION_CONFIG.COOKIE_SECURE` directly

2. **`src/cache/CacheManager.ts`**
   - Changed `CacheManager<T = any>` → `CacheManager<T = unknown>`
   - Changed `Promise<CacheEntry<any>>` → `Promise<CacheEntry<unknown>>`
   - Changed `CacheEntry<any>` → `CacheEntry<unknown>>`
   - Changed `estimateSize(data: any)` → `estimateSize(data: unknown)`
   - **Why:** `unknown` is type-safe (requires type checking before use), `any` bypasses type safety

3. **`src/user/repository/user.repository.ts`**
   - Changed `update(id, payload: any, ...)` → `update(id, payload: IUpdateUserEntity, ...)`
   - **Benefit:** Prevents updating auth fields through general update endpoint

4. **`src/lottery/repository/lottery.repository.ts`**
   - Changed `update(id, payload: any, ...)` → `update(id, payload: IUpdateLotteryEntity, ...)`
   - **Benefit:** Type-safe lottery updates

5. **`src/results/repository/results.repository.ts`**
   - Added import: `IResultsBase` type
   - Changed `create(payload: any)` → `create(payload: Omit<IResultsBase, 'results_id' | 'created_at' | 'edited_at' | 'deleted_at'>)`
   - Changed `update(id, payload: any, ...)` → `update(id, payload: Partial<IResultsBase>, ...)`
   - **Benefit:** Type-safe results CRUD operations

6. **`src/shcedule/repository/schedule.repository.ts`**
   - Added import: `IScheduleEntityBack` and `IUpdateScheduleEntity` types
   - Changed `create(payload: any)` → `create(payload: Omit<IScheduleEntityBack, 'schedule_id' | 'created_at' | 'edited_at' | 'schedule_lotteries'>)`
   - Changed `update(id, payload: any, ...)` → `update(id, payload: IUpdateScheduleEntity, ...)`
   - **Benefit:** Type-safe schedule CRUD operations

**Impact:**
- ✅ All ESLint warnings and errors resolved
- ✅ Passes `npm run lint` with `--max-warnings=0`
- ✅ Ready for commit and GitHub Actions CI/CD
- ✅ Improved type safety across all repositories
- ✅ Better IDE autocomplete and error detection

**Testing:** `npx eslint "src/**/*.ts" --max-warnings=0` passes with no errors

---

### Changed - 2025-12-29

#### User CRUD Migration to Custom Authentication System
**Change:** Fully migrated user creation to custom authentication system, removing dependency on Supabase Auth

**Files Modified:**
- `api/src/user/helper/userBase.ts` - `buildUserForDB()` function
  - **Added:** Password hashing for all users except STREET cashiers
  - **Added:** Custom authentication fields initialization:
    - `password_hash`: bcrypt hashed password (12 rounds)
    - `password_changed_at`: timestamp of password creation
    - `password_reset_required`: false (users can login immediately)
    - `failed_login_attempts`: 0 (initial value)
    - `locked_until`: null
    - `last_login_at`: null
    - `last_login_ip`: null
  - **Validation:** Throws error if password not provided for users that need it
  - **Logic:** STREET cashiers don't need password (no username/email)

**Type Definitions Updated:**
- `helper/request/user.request.ts`
  - **`INewUserEntity`**: Excluded auto-generated auth fields from creation payload
    - Removed: `password_hash`, `password_changed_at`, `password_reset_required`
    - Removed: `failed_login_attempts`, `locked_until`, `last_login_at`, `last_login_ip`
    - Added: `password` field (plain text - hashed by backend)
  - **`IUpdateUserEntity`**: Excluded auth fields from update payload
    - Prevents updating auth fields through general update endpoint
    - Auth fields only updated through dedicated password/auth endpoints

**User Flow:**
1. Frontend sends `INewUserEntity` with plain text password
2. Backend `buildUserForDB()` hashes password with bcrypt
3. Backend initializes all auth fields with secure defaults
4. User is created in database with full custom auth support
5. User can login immediately (no password reset required)

**Security:**
- ✅ All passwords hashed with bcrypt (12 rounds)
- ✅ Auth fields cannot be set/updated through general CRUD endpoints
- ✅ STREET cashiers don't have passwords (consistent with no username/email)
- ✅ Type safety ensures auth fields are not accidentally exposed

**Impact:** User creation now fully independent of Supabase Auth - Phase 5 cutover complete for user CRUD

---

### Added - 2025-12-28

#### Hierarchical Password Reset Permissions
**Feature:** Implemented granular permission controls for password reset functionality

**User Repository Enhancement:**
- `api/src/user/repository/user.repository.ts`
  - Added `getByIdWithoutOrgRestriction()` method
  - Used for OWNER to reset SUPERADMIN passwords across organizations
  - Returns user without organization constraint

**Permission Rules Implemented:**
1. **OWNER:**
   - Can reset SUPERADMIN passwords from ANY organization
   - Can reset ADMIN/CASHIER passwords from OWN organization only
   - Cannot reset other OWNER passwords

2. **SUPERADMIN:**
   - Can reset ADMIN/CASHIER passwords from OWN organization only
   - Cannot reset OWNER or other SUPERADMIN passwords

3. **ADMIN:**
   - Can reset CASHIER passwords from OWN organization only
   - Cannot reset OWNER, SUPERADMIN, or other ADMIN passwords

4. **CASHIER:**
   - Cannot reset any passwords (use `changePassword` endpoint instead)

**Controller Changes:**
- `api/src/user/controller/user.controller.ts:resetPassword()`
  - Added hierarchical permission validation with detailed error messages
  - Uses `getByIdWithoutOrgRestriction()` for OWNER to allow cross-org SUPERADMIN resets
  - Validates target user type against admin user type
  - Enhanced audit logging with target user type metadata
  - Changed `password_reset_required` to `false` (users can login immediately)

**Error Messages:**
- "No puedes resetear la contraseña de otro OWNER"
- "Solo puedes resetear contraseñas de usuarios de tu organización"
- "No puedes resetear la contraseña de un OWNER o SUPERADMIN" (for SUPERADMIN)
- "Solo puedes resetear contraseñas de cajeros" (for ADMIN)

**Security:**
- Organization isolation enforced (except OWNER → SUPERADMIN cross-org)
- All sessions revoked on password reset
- Audit trail includes admin user ID, type, and target user type

**Use Case:** Prevents unauthorized password resets while allowing proper administrative hierarchy

---

### Added - 2025-12-28

#### 🚨 Emergency Owner Password Reset Script
**Purpose:** Emergency script to reset OWNER password when locked out after migration

**Script Created:**
- `api/scripts/reset-owner-password.ts` - Emergency password reset for OWNER users
  - Requires `OWNER_ID` and `OWNER_PASSWORD` environment variables
  - Only works for OWNER user type (security)
  - Validates password strength (non-empty)
  - Hashes password with bcrypt
  - Updates password in database
  - Resets failed login attempts and unlocks account
  - Revokes all existing sessions for security
  - Creates audit log entry
  - Run with: `OWNER_ID=<uuid> OWNER_PASSWORD=<password> npx tsx scripts/reset-owner-password.ts`

**Documentation Created:**
- `api/scripts/README.md` - Comprehensive guide for emergency scripts
  - Step-by-step instructions to get OWNER_ID from database
  - Multiple execution methods (PowerShell, Git Bash, CMD)
  - Examples for different deployment scenarios
  - Security best practices
  - Troubleshooting guide
  - Post-reset verification queries

**Environment Variables:**
- `api/.env.example` - Added emergency owner access section
  - `OWNER_ID` - Owner user ID from database
  - `OWNER_PASSWORD` - Temporary password for reset (comment out after use)

**Use Case:** After migration to custom auth, all users need password reset. Only admins can reset passwords. If OWNER is locked out, no one can reset anyone's password. This script solves that chicken-egg problem.

**Security:**
- Only works for OWNER user type
- Requires direct database access
- Creates audit trail
- Should only be used in emergencies
- Password should not be committed to version control

---

### Changed - 2025-12-28

#### Password Validation Simplification
**Change:** Simplified password strength requirements to only check for non-empty passwords

**Files Modified:**
- `api/helper/password.ts` - `validatePasswordStrength()` function
  - **Old:** Required 8+ characters, uppercase, lowercase, number
  - **New:** Only requires non-empty password
  - **Validation:** `password.trim().length > 0`
  - **Error:** "La contraseña no puede estar vacía"

- `api/scripts/reset-owner-password.ts` - Updated error messages
  - Removed complexity requirements from console output
  - Only mentions "Password cannot be empty"

- `api/scripts/README.md` - Updated documentation
  - Step 2: Any non-empty text is valid (admin, 123456, etc.)
  - Troubleshooting: Removed complexity requirements section
  - Support: Changed "cumpla los requisitos" to "no esté vacía"

**Reason:** Application does not require password complexity rules per user feedback

**Impact:** Users can set simple passwords like "admin" or "123456" if desired

---

### Fixed - 2025-12-28

#### Login Handler Legacy Code Removal
**Fix:** Removed remaining Supabase Auth code from login handler

**File:** `api/src/auth/route/auth.route.ts`

**Problem:** After Phase 5 cutover, login handler still had imports and code referencing deleted legacy functions:
- Importing `signUserToken` (deleted in Phase 5)
- Importing `supabase` (no longer using Supabase Auth)
- Importing `generateEmail` (no longer needed)
- Error: "SyntaxError: The requested module 'api/helper/JWT' does not provide an export named 'signUserToken'"

**Solution:** Completely rewrote `loginHandler` to use new session system:
1. Removed legacy imports (`signUserToken`, `supabase`, `generateEmail`)
2. Changed to use `loginWithSession()` controller method
3. Set `access_token` cookie (15 minutes, httpOnly, secure)
4. Set `refresh_token` cookie (30 days, httpOnly, secure)
5. Return user data in `APIResponse` format

**Impact:** Login endpoint now fully uses custom JWT session management

---

#### TypeScript Type Error in Session Cleanup Job
**Fix:** Fixed `NodeJS.Timeout` type error in session cleanup job

**File:** `api/src/utils/session-cleanup.job.ts`

**Problem:** TypeScript error "'NodeJS' is not defined" for interval ID type
- Using `NodeJS.Timeout` requires @types/node to be available
- Not portable across different TypeScript configurations

**Solution:** Changed type to `ReturnType<typeof setInterval>`
```typescript
// Before (ERROR):
let cleanupIntervalId: NodeJS.Timeout | null = null;

// After (FIXED):
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
```

**Impact:** More portable TypeScript code, no external type dependencies

---

#### Module Resolution Error in Reset Script
**Fix:** Fixed import path resolution in emergency reset script

**File:** `api/scripts/reset-owner-password.ts`

**Problem:** Import using alias `@helper/types/user.type` failed
- TypeScript path aliases don't work from `scripts/` folder
- Error: "Cannot find module '@helper/types/user.type'"

**Solution:** Changed to relative path
```typescript
// Before (ERROR):
import { USER_TYPE } from '@helper/types/user.type';

// After (FIXED):
import { USER_TYPE } from '../../helper/types/user.type';
```

**Impact:** Script can be executed with `npx tsx` without additional TypeScript configuration

---

### Added - 2025-12-28

#### 🔐 Custom JWT Session Management System (Migration Complete)
**Major Feature:** Migrated from Supabase Auth to custom JWT-based session management with database tracking

**Migration Phases Completed:** All 5 phases (Database, Auth Endpoints, Password Management, Frontend Integration, Cutover)

---

##### Phase 1: Database & Infrastructure

**SQL Migrations Created:**
- `20260101000001_create_sessions_table.sql` - Session tracking with refresh tokens
- `20260101000002_alter_users_for_custom_auth.sql` - Password management fields
- `20260101000003_create_auth_audit_log.sql` - Security audit logging
- `20260101000004_initial_data_migration.sql` - Mark users for password reset

**Configuration Files:**
- `api/src/config/session.config.ts` - Centralized session configuration
  - Access token: 15 minutes
  - Refresh token: 30 days
  - Inactivity timeout: 4 hours (sliding window)
  - Absolute timeout: 30 days
  - Max failed attempts: 5
  - Account lockout: 15 minutes
  - BCrypt rounds: 12

**Helper Functions:**
- `api/helper/password.ts` - BCrypt password hashing utilities
  - `hashPassword()` - Hash password with 12 rounds
  - `comparePassword()` - Verify password securely
  - `generateRandomPassword()` - Generate random passwords
  - `validatePasswordStrength()` - Validate password is non-empty

**JWT Helpers Updated:**
- `api/helper/JWT.ts` - Access and refresh token functions
  - `signAccessToken()` - Generate 15-min access tokens
  - `verifyAccessToken()` - Validate access tokens
  - `signRefreshToken()` - Generate 30-day refresh tokens
  - `verifyRefreshToken()` - Validate refresh tokens

**Repositories Created:**
- `api/src/session/repository/session.repository.ts` - Session CRUD and lifecycle
  - `create()` - Create new session with refresh token hash
  - `getById()` - Get active session by ID
  - `updateActivity()` - Implement sliding window (extends expiration)
  - `revoke()` - Mark session inactive
  - `revokeAllUserSessions()` - Security measure for password changes
  - `rotateRefreshToken()` - Update token and increment version
  - `cleanupExpiredSessions()` - Periodic cleanup job
  - `countActiveSessions()` - Check concurrent sessions
  - `revokeOldestSession()` - Enforce session limit

- `api/src/audit/repository/audit.repository.ts` - Security event logging
  - `log()` - Create audit entries
  - `getRecentFailedAttempts()` - Brute force detection
  - `getUserLogs()` - User activity history
  - `getSessionLogs()` - Session activity history

**Dependencies Added:**
```bash
npm install bcrypt @types/bcrypt
```

---

##### Phase 2: Authentication Endpoints

**Auth Repository Enhanced:**
- `api/src/auth/repository/auth.repository.ts`
  - `getUserByUsername()` - Login lookup
  - `getUserById()` - Session validation
  - `incrementFailedAttempts()` - Brute force tracking
  - `resetFailedAttempts()` - Clear counter on success
  - `lockAccount()` - Temporary lockout
  - `updateLoginMetadata()` - Track last login
  - `updatePassword()` - Update password hash

**Auth Controller Rewritten:**
- `api/src/auth/controller/auth.controller.ts`

**New Method:** `loginWithSession()`
1. Fetch user from database by username
2. Check if account is locked
3. Verify password hash exists
4. Verify password with bcrypt
5. Check concurrent sessions limit
6. Create session with refresh_token_hash
7. Generate access + refresh tokens
8. Update user login metadata
9. Reset failed attempts
10. Log successful login

**New Method:** `refreshToken()`
1. Verify refresh token JWT
2. Get session from database
3. Check if session expired
4. Verify refresh token hash (detect token reuse)
5. Get user data
6. Generate new tokens (rotate refresh token)
7. Update session with new refresh token hash
8. Update activity (sliding window)
9. Log successful refresh

**New Method:** `logoutSession()`
- Revoke single session or all user sessions
- Create audit log entry

**Auth Routes Updated:**
- `api/src/auth/route/auth.route.ts`
  - `POST /api/auth/login` - Login with username/password
  - `POST /api/auth/refresh` - Refresh access token (NEW)
  - `POST /api/private/auth/logout` - Logout current session
  - `POST /api/private/auth/logout-all` - Logout all sessions (NEW)
  - `GET /api/private/auth/validate` - Validate session

**Cookie Configuration:**
- Access token: httpOnly, secure, sameSite=none, 15 min
- Refresh token: httpOnly, secure, sameSite=none, 30 days

---

##### Phase 3: Password Management

**User Controller Enhanced:**
- `api/src/user/controller/user.controller.ts`

**New Method:** `resetPassword()` (Admin-only)
- OWNER, SUPERADMIN, ADMIN can reset any user's password
- Generates random password if not provided
- Validates password strength
- Hashes password with bcrypt
- Revokes all user sessions (security)
- Creates audit log entry
- Returns plaintext password for admin to share

**New Method:** `changePassword()` (Self-service)
- Any authenticated user can change own password
- Verifies current password
- Validates new password strength
- Checks new password is different
- Hashes new password
- Revokes all user sessions (security)
- Creates audit log entry

**User Routes Updated:**
- `api/src/user/route/user.route.ts`
  - `POST /api/private/user/reset-password/:id` - Admin reset password
  - `POST /api/private/user/change-password` - User change password

**Migration Script Created:**
- `api/scripts/migrate-users-to-custom-auth.ts`
  - Marks all users without password_hash as requiring password reset
  - Creates audit log entry
  - Run with: `npx tsx scripts/migrate-users-to-custom-auth.ts`

---

##### Phase 4: Middleware & Cleanup Job

**Auth Middleware Replaced:**
- `api/middlewares/auth.middleware.ts` (COMPLETELY REWRITTEN)

**Old Behavior (Removed):**
- Only validated `user_token` cookie (custom JWT)
- Ignored `access_token` (Supabase JWT never validated) ⚠️ Security issue
- No session tracking in database
- No expiration checking in backend
- No sliding window

**New Behavior:**
1. Validates `access_token` cookie (15-min JWT)
2. Verifies session in database (is_active, expires_at)
3. Updates last_activity_at (sliding window → +4h)
4. Gets fresh user data from database
5. Attaches user and session info to request

**Request Object Updated:**
```typescript
req.user = {
  user: IUserEntityFront,
  session_id: string,
  organization_id: string
}
```

**Session Cleanup Job Created:**
- `api/src/utils/session-cleanup.job.ts`
  - Runs every 1 hour
  - Calls `cleanup_expired_sessions()` PostgreSQL function
  - Marks expired sessions as inactive
  - Logs cleanup results
  - Started automatically in `api/src/index.ts`

**Server Initialization Updated:**
- `api/src/index.ts`
  - Starts session cleanup job on server start
  - Logs session configuration on startup

---

##### Phase 5: Legacy Code Removal

**Removed from JWT Helper:**
- `api/helper/JWT.ts`
  - ❌ `signUserToken()` (deprecated, replaced by `signAccessToken()`)
  - ❌ `verifyUserToken()` (deprecated, replaced by `verifyAccessToken()`)

**Removed from Auth Controller:**
- `api/src/auth/controller/auth.controller.ts`
  - ❌ `login()` (deprecated, replaced by `loginWithSession()`)
  - ❌ `logout()` (deprecated, replaced by `logoutSession()`)
  - ❌ `refresh()` (deprecated, replaced by `refreshToken()`)

**Removed Imports:**
- ❌ `supabase` (no longer using Supabase Auth)
- ❌ `generateEmail()` (no longer needed)
- ❌ `IAuthLogout` (replaced by session-based logout)

**Removed File:**
- ❌ `api/middlewares/auth.middleware.new.ts` (merged into main middleware)

---

##### Security Features Implemented

**Password Security:**
- BCrypt hashing with 12 rounds
- Password strength validation (non-empty only)
- Secure comparison with timing attack protection
- Password change requires current password verification
- All sessions revoked on password change

**Brute Force Protection:**
- Failed login attempts tracking
- Account lockout after 5 failed attempts
- Lockout duration: 15 minutes
- Audit logging of failed attempts

**Token Security:**
- Refresh token rotation (each use generates new token)
- Token reuse detection → revokes ALL user sessions
- Access token: 15 minutes (short-lived)
- Refresh token: 30 days (long-lived, stored as bcrypt hash)
- Tokens include type validation ('access' vs 'refresh')

**Session Security:**
- Sliding window: Session extends with activity (4h inactivity timeout)
- Absolute timeout: Maximum 30 days regardless of activity
- Session tracking in database (IP, user agent)
- Session revocation on security events (password change, token reuse)
- Concurrent session limit (configurable, default: unlimited)

**Audit Logging:**
- All auth events logged (login, logout, refresh, failures)
- Failed login attempts with username and IP
- Account lockouts
- Password changes/resets
- Token reuse detections
- System migrations

---

##### Environment Variables Required

Add to `.env`:
```bash
# JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET_ACCESS=<256_BIT_SECRET_HERE>
JWT_SECRET_REFRESH=<DIFFERENT_256_BIT_SECRET_HERE>
```

See `api/.env.example` for full configuration.

---

##### Breaking Changes

**⚠️ All existing sessions will be invalidated**
- Users must re-login after deployment
- Supabase Auth sessions no longer work
- Old `user_token` cookie replaced with `access_token` and `refresh_token`

**Migration Steps:**
1. Deploy database migrations
2. Deploy backend code
3. Run migration script: `npx tsx scripts/migrate-users-to-custom-auth.ts`
4. Admins reset user passwords via API or frontend
5. Users login with new passwords

---

##### Performance Improvements

**Database Queries:**
- Indexed session lookups by `session_id`, `user_id`, `expires_at`
- PostgreSQL function for efficient session cleanup
- Single query to update session activity

**Caching:**
- User data cached in session (refreshed on each request)
- No need for repeated user lookups within same session

**Token Validation:**
- JWT validation is fast (cryptographic signature check)
- Session lookup by ID is O(1) with index

---

##### Monitoring & Observability

**Logs:**
- Session cleanup results (every hour)
- Failed login attempts
- Account lockouts
- Token reuse detections
- Session creation/revocation

**Audit Table:**
- Query for security events
- Track user activity
- Detect suspicious patterns
- Generate security reports

---

**Files Modified:**
- Database: 4 SQL migrations
- Config: `session.config.ts`, `envs.ts`, `.env.example`
- Helpers: `password.ts`, `JWT.ts`
- Repositories: `session.repository.ts`, `audit.repository.ts`, `auth.repository.ts`
- Controllers: `auth.controller.ts`, `user.controller.ts`
- Routes: `auth.route.ts`, `user.route.ts`
- Middleware: `auth.middleware.ts`
- Utils: `session-cleanup.job.ts`
- Server: `index.ts`
- Scripts: `migrate-users-to-custom-auth.ts`

**Lines of Code:**
- Added: ~2,500 lines
- Modified: ~500 lines
- Removed: ~200 lines

**Dependencies:**
- Added: `bcrypt`, `@types/bcrypt`

---

### Added - 2025-12-26

#### Current Account - User Type Access Control
**Added:** Access restrictions for CASHIER and ADMIN users on current account modification endpoints
**File:** `api/src/current-account/route/current-account.route.ts`

**Implementation:** Added validation checks in POST and PUT handlers to prevent CASHIER and ADMIN users from:
- POST `/api/private/current-account/calculate` - Calculating current accounts
- POST `/api/private/current-account/liquidate` - Liquidating current accounts
- POST `/api/private/current-account/` - Legacy calculate endpoint
- PUT `/api/private/current-account/:id` - Updating individual current accounts
- PUT `/api/private/current-account/bulk` - Bulk updating current accounts

**Access Control:**
- Allowed: `USER_TYPE.OWNER` and `USER_TYPE.SUPERADMIN`
- Denied: `USER_TYPE.CASHIER` and `USER_TYPE.ADMIN` (returns 403 Forbidden)

**Response:** Returns HTTP 403 with error message: "Access denied: CASHIER and ADMIN users cannot perform this action"

**Use case:** Prevents unauthorized users from modifying financial calculations and liquidations that should only be performed by owners or superadmins.

### Fixed - 2025-12-26

#### REDOUBLE Bet Calculation - Same Number Payout Adjustment
**Fix:** Adjusted payout calculation when `number` and `with` are the same in REDOUBLE bets
**File:** `api/supabase/migrations/20251226143157_sp_calc_redouble_fix_payout_equal_number_with.sql`

**Problem:** When `number` equals `with` and the number appears multiple times, the payout was calculated incorrectly. Since both "slots" of the bet are used for the same number, we need 2 occurrences as minimum and should only pay for additional occurrences beyond those 2.

**Example:**
- Bet: number="05", with="05" (same number)
- Results: "05" appears 3 times
- Old logic: pays for 3 hits
- New logic: pays for 3-1 = 2 hits (because you need the first 2 to meet the minimum)

**Solution:** Modified hits calculation in section 6:
- If `number = with`: `hits = GREATEST(number_hits, with_hits) - 1`
- If `number ≠ with`: `hits = GREATEST(number_hits, with_hits)` (original logic)

**Impact:** Correct payout calculation for REDOUBLE bets when the same number is used for both positions.

#### REDOUBLE Bet Calculation - Same Number Validation
**Fix:** Added validation for when `number` and `with` are the same in REDOUBLE bets
**File:** `api/supabase/migrations/20251226140710_sp_calc_redouble_fix.sql`

**Problem:** The `calculate_redouble_payout` function was incorrectly paying out when `number` and `with` were the same and only appeared once in the results. When betting on the same number twice (number = with), the number must appear at least 2 times to win.

**Solution:** Added conditional logic to check if `number` equals `with`:
- If they're equal: requires at least 2 occurrences of the number
- If they're different: each number must appear at least once (original logic)

**Impact:** Correct validation for REDOUBLE bets minimum requirements.

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
