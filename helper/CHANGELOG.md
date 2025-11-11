# Changelog - Helper (Shared)

All notable changes to the shared helper workspace will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-11-11

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
