# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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