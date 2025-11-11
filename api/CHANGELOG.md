# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-11-11

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
