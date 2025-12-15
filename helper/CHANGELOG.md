# Changelog - Helper (Shared)

All notable changes to the shared helper workspace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - 2025-12-15

#### Request Files Renamed
- **File Extension Update**: Renamed all request type files from `.response.ts` to `.request.ts`
  - `helper/request/bet.response.ts` → `helper/request/bet.request.ts`
  - `helper/request/cashier.response.ts` → `helper/request/cashier.request.ts`
  - `helper/request/current_account.response.ts` → `helper/request/current_account.request.ts`
  - `helper/request/group.response.ts` → `helper/request/group.request.ts`
  - `helper/request/lottery.response.ts` → `helper/request/lottery.request.ts`
  - `helper/request/pagination.response.ts` → `helper/request/pagination.request.ts`
  - `helper/request/results.response.ts` → `helper/request/results.request.ts`
  - `helper/request/schedule.response.ts` → `helper/request/schedule.request.ts`
  - `helper/request/ticket.response.ts` → `helper/request/ticket.request.ts`
  - `helper/request/user.response.ts` → `helper/request/user.request.ts`
  - `helper/request/winner.response.ts` → `helper/request/winner.request.ts`
  - **Why:** Clarifies that `helper/request/*` contains types sent FROM frontend TO backend
  - **Impact:** All imports across web and api workspaces updated to use `.request` extension

### Added - 2025-12-15

#### Response Type Definitions
- **New Response Files**: Created standardized response type files for backend-to-frontend communication
  - `helper/response/user.response.ts` - User entity response types
    - `UserResponse`: Single user response type (alias for `IUserEntityFront`)
    - `ListUsersResponse`: Array of users response type
  - `helper/response/ticket.response.ts` - Ticket entity response types
    - `TicketResponse`: Single ticket response type
    - `ListTicketsResponse`: Array of tickets response type
  - `helper/response/bet.response.ts` - Bet entity response types
    - `BetResponse`: Single bet response type
    - `ListBetsResponse`: Array of bets response type
  - `helper/response/lottery.response.ts` - Lottery entity response types
    - `LotteryResponse`: Single lottery response type
    - `ListLotteriesResponse`: Array of lotteries response type
  - `helper/response/results.response.ts` - Results entity response types
    - `ResultResponse`: Single result response type
    - `ListResultsResponse`: Array of results response type
  - `helper/response/schedule.response.ts` - Schedule entity response types
    - `ScheduleResponse`: Single schedule response type
    - `ListSchedulesResponse`: Array of schedules response type
  - `helper/response/current_account.response.ts` - Current account response types
    - `CurrentAccountResponse`: Single current account response type
    - `ListCurrentAccountsResponse`: Array of current accounts response type
  - **Why:** Establishes clear separation between request types (front→back) and response types (back→front)
  - **Structure:** Each entity has both single and list response type aliases
  - **Future Use:** Provides standardized types for API controller return values

### Added - 2025-12-07

#### Error Messages - Ticket Payment Validation
- **New Error Constants**: Added ticket payment-related error messages
  - Path: `helper/types/errors.type.ts`
  - `TICKET_NOT_OWNED`: "El ticket no pertenece al usuario"
    - Used when a user tries to pay a ticket they didn't create
    - Returns 403 Forbidden status
  - `TICKET_ALREADY_PAID`: "El ticket ya fue pagado"
    - Prevents duplicate payment attempts
    - Returns 400 Bad Request status
  - `TICKET_NOT_WINNER`: "El ticket no es ganador"
    - Prevents paying tickets that have no winning bets
    - Returns 400 Bad Request status
  - `INVALID_USER_ID`: "ID de usuario inválido"
    - Validates user_id format (UUID) at database level
    - Returns 400 Bad Request status
  - **Why:** Improves security and user experience by providing clear, specific error messages for ticket payment operations

### Added - 2025-11-11

#### Type Enhancements
- **TicketSums Type**: Extended to include play counts
  - Path: `request/bet.response.ts:21-26`
  - Added `total_count: number` - Total number of plays in ticket
  - Added `total_winners_count: number` - Total number of winning plays in ticket
  - Previously only included `total_amount` and `total_prize`
  - Supports accurate pagination totals in frontend

- **IPaginatedBetsResponse**: Enhanced aggregates interface
  - Path: `request/pagination.response.ts:20-27`
  - Added `totalCount?: number` - Total count of plays
  - Added `totalWinnersCount?: number` - Total count of winning plays
  - Previously only included `totalAmount` and `totalPrize`
  - Allows frontend to display correct totals with infinite scroll

#### Session Configuration
- **New File**: `config/session.config.ts`
  - Centralized session management configuration
  - Shared between frontend (web) and backend (api)
  - Acts as environment-like configuration without .env files

  **Exports:**
  - `SESSION_DURATION_MS`: `3 * 60 * 60 * 1000` (3 hours)
    - Session expires after 3 hours of inactivity
    - Resets with each user activity

  - `VALIDATE_INTERVAL_MS`: `4 * 60 * 1000` (4 minutes)
    - Frequency of server-side session validation
    - Prevents excessive validation requests

  - `VISIBILITY_MIN_GAP_MS`: `10 * 60 * 1000` (10 minutes)
    - Minimum time between validations when returning to tab
    - Prevents validation spam on frequent tab switching

  - `VALIDATE_ON_VISIBILITY`: `true`
    - Enable/disable validation on tab visibility change
    - Set to false to disable visibility-based validation

  - `USER_ACTIVITY_EVENTS`: `readonly string[]`
    - Array of browser events considered as "user activity"
    - Events: `['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']`
    - Used to detect active user engagement
    - Activity in the app extends session duration

## Documentation - 2025-11-11

### Session Configuration Usage

#### Frontend (web/src/providers/AuthProvider.tsx)
```typescript
import {
  SESSION_DURATION_MS,
  VALIDATE_INTERVAL_MS,
  VALIDATE_ON_VISIBILITY,
  VISIBILITY_MIN_GAP_MS,
  USER_ACTIVITY_EVENTS,
} from '@helper/config/session.config';

// Use in timeout logic
setTimeout(() => logout(), SESSION_DURATION_MS);

// Use in validation intervals
setInterval(() => validate(), VALIDATE_INTERVAL_MS);

// Use for activity detection
USER_ACTIVITY_EVENTS.forEach(event =>
  window.addEventListener(event, handleActivity)
);
```

#### Backend (api/src/auth/)
Currently backend doesn't use these constants directly as session timeout is managed client-side. Backend validates session through cookies and JWT tokens.

Future integration points:
- Token expiration time could use `SESSION_DURATION_MS`
- Rate limiting could use `VALIDATE_INTERVAL_MS`

### Design Decisions

#### Why not use .env?
1. **Type Safety**: TypeScript constants provide compile-time checking
2. **Shared Values**: Same constants used across web and api workspaces
3. **No Build Complexity**: No need for env variable injection at build time
4. **Version Control**: Configuration is versioned with code
5. **IDE Support**: Better autocomplete and refactoring support

#### Session Duration Rationale
- **3 hours**: Balance between security and user convenience
  - Long enough for extended work sessions
  - Short enough to limit exposure if user forgets to logout
  - Industry standard for authenticated web applications

#### Activity-Based Extension
- Session extends automatically with user activity
- Only activity within the app counts (not other tabs)
- Prevents unexpected logouts during active work
- More user-friendly than fixed-duration sessions

### Configuration Modification Guidelines

To modify session timeout:
1. Update `SESSION_DURATION_MS` in `config/session.config.ts`
2. Test in development environment
3. Verify logout happens after configured time
4. Ensure activity extends session correctly
5. Update documentation/comments if needed

**Important**: Do NOT modify values without reviewing:
- `web/src/providers/AuthProvider.tsx` - Frontend session logic
- `api/src/auth/route/auth.route.ts` - Cookie configuration
- This CHANGELOG - Update with new values and rationale

## Notes

### Breaking Changes
None - This is a new addition to the helper workspace.

### Migration
No migration needed. This is a new feature that existing code can adopt gradually.

### Future Enhancements
Consider adding:
- `IDLE_WARNING_MS`: Time before showing "session about to expire" warning
- `REMEMBER_ME_DURATION_MS`: Extended duration for "remember me" feature
- `MAX_SESSION_DURATION_MS`: Absolute maximum session time (even with activity)
- `CONCURRENT_SESSION_LIMIT`: Max number of simultaneous sessions per user
