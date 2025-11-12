# Changelog - Web Frontend

All notable changes to the web frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-11-11

#### Session Management
- **Session Configuration File**: Created centralized session config in `@helper/config/session.config.ts`
  - `SESSION_DURATION_MS`: 3 hours session timeout from last activity
  - `VALIDATE_INTERVAL_MS`: 4 minutes periodic validation
  - `VISIBILITY_MIN_GAP_MS`: 10 minutes throttle for tab visibility checks
  - `USER_ACTIVITY_EVENTS`: Array of events that count as user activity
- **Session Behavior**:
  - Sessions now expire after 3 hours of inactivity
  - Activity detection on: mousemove, mousedown, keydown, scroll, touchstart, click
  - Sessions extend automatically with each user activity in the app
  - Session closes when browser is closed (session cookies)
  - Automatic logout on session expiration

#### Current Account - Calculate/Liquidate Separation
- **New Hook**: `useCalculateCurrentAccount` - Recalculates current account without liquidating
  - Path: `src/hooks/mutations/current-account/useCalculateCurrentAccount.ts`
  - Use case: Refresh/update button functionality
- **New Routes**: Added to `routes/routes.ts`
  - `current_account.calculate`: POST `/api/private/current_account/calculate`
  - `current_account.liquidate`: POST `/api/private/current_account/liquidate`
- **Results Page**: Added refresh functionality
  - Path: `src/features/results/index.tsx`
  - "Actualizar" button now uses `useCalculateCurrentAccount`
  - Recalculates current account data on click
- **Current Account Page**: Updated refresh logic
  - Path: `src/features/current-account/index.tsx`
  - "Actualizar" button uses new `useCalculateCurrentAccount` hook
  - Gets fresh data without triggering liquidation

#### Cache Invalidation
- **Winners Generation**: Enhanced cache invalidation in `useWinner.ts`
  - Now invalidates both `['winners']` and `['getCurrentAccount']` query keys
  - Ensures current account data refreshes when winners are generated

### Fixed - 2025-11-11

#### Plays and Hits - Infinite Scroll
- **IntersectionObserver Type Fix**: Changed triggerRef type from `HTMLTableRowElement` to `HTMLDivElement`
  - Path: `src/features/plays-and-hits/plays-and-hits-table.tsx:75`
  - Fixed issue where observer wasn't detecting intersection due to type mismatch
- **NaN Error Fix**: Added fallback values for totals aggregates
  - Path: `src/features/plays-and-hits/plays-and-hits-table.tsx:65-72`
  - Now uses `?? 0` to prevent NaN errors when aggregates are undefined
  - Ensures TextAmount component always receives valid numbers
- **Debug Logging**: Added console logs to track IntersectionObserver state
  - Helps debug infinite scroll behavior during development

#### Terminal Ticket - Total Counts Fix
- **Total Counts Display**: Fixed incorrect total counts in ticket tables
  - Path: `src/features/terminal-ticket/terminal-ticket-matches-table.tsx:76,118`
  - Path: `src/features/terminal-ticket/termina-ticket-play-table.tsx:76,118`
  - Now uses `totalWinnersCount` and `totalCount` from aggregates instead of array length
  - Displays correct totals even with pagination

### Changed - 2025-11-11

#### Session Management
- **AuthProvider**: Updated to use centralized session config
  - Path: `src/providers/AuthProvider.tsx`
  - Replaced hardcoded timeouts with imports from `@helper/config/session.config`
  - Changed `INACTIVITY_LOGOUT_MS` from 10 min to 3 hours (`SESSION_DURATION_MS`)
  - Activity events now sourced from `USER_ACTIVITY_EVENTS` constant

#### Current Account Hooks
- **Renamed Hook**: `useUpdateCurrentAccoutn` → `useLiquidateCurrentAccount`
  - Old path: `src/hooks/mutations/current-account/useUpdateCurrentAccoutn.ts`
  - New path: `src/hooks/mutations/current-account/useLiquidateCurrentAccount.ts`
  - Updated function names: `updateCurrentAccount` → `liquidateCurrentAccount`
  - Updated export: `useUpdateCurrentAcoount` → `useLiquidateCurrentAccount`
  - Now uses `/liquidate` endpoint instead of base endpoint
  - Parameters changed to object: `{ date, leave }` instead of separate args

### Fixed - 2025-11-11

#### Layout & Responsive Design
- **Make Plays Page**: Fixed `ResultsOverview` sticky positioning
  - Path: `src/features/make-plays/index.tsx`
  - Wrapped header, form, and table in flex-1 container
  - `ResultsOverview` now stays at bottom of viewport
  - Table scrolls independently while footer remains visible

### Changed - 2025-11-11

#### Make Plays - 1024x768 Optimization
Optimized all make-plays components for 1024x768px screens to display 7-10 rows in the table instead of just 1.

- **HeaderPlayDetail** (`src/features/make-plays/header-play-detail.tsx`):
  - Reduced gaps: `gap-3` → `lg:gap-2`
  - Reduced input heights: `h-9` → `lg:h-8`
  - Reduced font sizes: `text-sm` → `lg:text-xs`
  - Reduced select widths: `min-w-48` → `lg:min-w-32`
  - Compressed label widths for better space utilization

- **FillOutATicket** (`src/features/make-plays/fill-out-a-ticket.tsx`):
  - Reduced form container width: `lg:max-w-[350px]` → `lg:max-w-[260px]`
  - Reduced vertical spacing: `space-y-3` → `lg:space-y-1.5`
  - Reduced padding: `p-3` → `lg:p-2`
  - Reduced input heights: `h-10` → `lg:h-8`
  - Reduced font sizes: `text-base` → `lg:text-xs` (labels), `lg:text-sm` (inputs)
  - Reduced button gaps and widths: `max-w-[120px]` → `lg:max-w-[90px]`
  - Reduced button padding: `pt-2` → `lg:pt-1`

- **ResultsOverview** (`src/features/make-plays/results-overview.tsx`):
  - Reduced padding: `p-3` → `lg:p-1.5`
  - Reduced gaps: `gap-3` → `lg:gap-2`, `gap-4` → `lg:gap-2`
  - Reduced font sizes: `text-sm` → `lg:text-xs`, `text-base` → `lg:text-xs`
  - Reduced button widths: `min-w-[100px]` → `lg:min-w-[80px]`
  - Reduced icon margins: `mr-1` → `lg:mr-0.5`
  - Hidden RadioGroup on lg (1024px), shown on xl (1280px+): `lg:hidden xl:flex`

- **PlayDetailGameTable** (`src/features/make-plays/play-detail-game-table.tsx`):
  - Reduced container min-height: `min-h-40` → `lg:min-h-32`
  - Reduced header row height: added `lg:h-9`
  - Reduced header cell padding: `px-4` → `lg:px-2`, added `lg:py-1.5`
  - Reduced header font size: `text-sm` → `lg:text-xs`
  - Reduced body row height: added `lg:h-8`
  - Reduced body cell padding: `px-4` → `lg:px-2`, added `lg:py-1`
  - Reduced body font size: `text-sm` → `lg:text-xs`
  - Reduced line clamp: `line-clamp-2` → `lg:line-clamp-1` for last column

**Result**: Table now displays 7-10 bet rows on 1024x768px screens (previously only 1 row visible)

### Added - 2025-11-11

#### Code Refactoring & DRY Improvements
- **CheckboxSection Component** (`src/features/make-plays/components/CheckboxSection.tsx`):
  - New reusable wrapper component for checkbox sections
  - Consolidates common pattern: border, padding, rounded corners, title with icon
  - Accepts `title`, `icon`, and `children` props
  - Responsive padding: `p-2 sm:p-4 lg:p-1.5`
  - Responsive gap: `gap-2 lg:gap-1` (reduced title-to-content spacing on 1024px)

### Changed - 2025-11-11

#### Make Plays - Enhanced 1024x768 Compression (Round 2)
Further optimizations based on user feedback requesting MORE compression:

- **ScheduleCheckboxList** (`src/features/make-plays/schedules-checkbox-list.tsx`):
  - Refactored to use new `CheckboxSection` wrapper component
  - Eliminates code duplication with LotteriesCheckboxList
  - Reduced spacing between title and checkboxes via wrapper

- **LotteriesCheckboxList** (`src/features/make-plays/lotteries-checkbox-list.tsx`):
  - Refactored to use new `CheckboxSection` wrapper component
  - Eliminates code duplication with ScheduleCheckboxList
  - Reduced spacing between title and checkboxes via wrapper

- **GameTurns** (`src/features/make-plays/game-turns.tsx`):
  - Reduced horizontal gap: `gap-2` → `gap-2 lg:gap-1.5`
  - Tighter spacing between schedule and lottery sections on 1024px

- **HeaderPlayDetail** (`src/features/make-plays/header-play-detail.tsx`):
  - **More aggressive vertical compression**:
    - Reduced gaps: `lg:gap-2` → `lg:gap-1.5`
    - Reduced input heights: `lg:h-8` → `lg:h-7`
    - Reduced button heights: added `lg:h-7`
    - Reduced button padding: added `lg:px-2`
    - Reduced icon margins: `sm:mr-1` → `lg:mr-0.5`
    - Reduced button text: `sm:text-sm` → `lg:text-xs`

- **FillOutATicket** (`src/features/make-plays/fill-out-a-ticket.tsx`):
  - **More aggressive gap reduction** (user reported "too much gap"):
    - Vertical spacing: `lg:space-y-1.5` → `lg:space-y-1`
    - Container padding: `lg:p-2` → `lg:p-1.5`
    - Grid gaps: `lg:gap-1` → `lg:gap-0.5`
    - Button container gap: `lg:gap-1` → `lg:gap-0.5`
    - Button container padding: `lg:pt-1` → `lg:pt-0.5`
    - Button heights: added `lg:h-7`
    - Button text: added `lg:text-xs`
    - Icon margins: `sm:mr-1` → `lg:mr-0.5`
    - Text size: `lg:text-sm` and `lg:text-xs` → `lg:text-lg`
**Impact**: Significant vertical space savings on 1024x768px screens, allowing table to display more rows while maintaining readability.

### Added - 2025-11-11

#### Infinite Scroll & Pagination
- **Pagination Interfaces** (`helper/request/pagination.response.ts`):
  - Created `IPaginatedResponse<T>` generic interface for paginated responses
  - Created `IPaginationParams` for pagination request parameters
  - Created `IPaginatedBetsResponse<T>` extending pagination with aggregates (totalAmount, totalPrize)
  - Supports page, limit, totalCount, hasMore, currentPage, totalPages

- **Backend Pagination** - BetRepository (`api/src/bet/repository/bet.repository.ts`):
  - Added `page` and `limit` parameters to `getAllBets` method
  - Implemented `.range(from, to)` for offset-based pagination
  - Added `{count: 'exact'}` to get total count of records
  - Returns `{ data, count }` instead of just data
  - Default: 100 records per page

- **Backend Controller** (`api/src/bet/controller/bet.controller.ts`):
  - Updated `getAllBets` to return `IPaginatedBetsResponse<IBetEntityFront>`
  - Fetches `totalAmount` and `totalPrize` in parallel with bets using `Promise.all`
  - Calculates pagination metadata (totalPages, hasMore)
  - Returns aggregates in response for frontend consumption
  - Grouped queries maintain backward compatibility (no pagination)

- **Backend Routes** (`api/src/bet/route/bet.routes.ts`):
  - Added `page` and `limit` query parameters to getAllBets endpoint
  - Parses pagination params with defaults: page=1, limit=100
  - Response format changed from `{ bets: [] }` to pagination structure

- **Frontend Hook** - `useInfiniteBets` (`web/src/hooks/fetchs/plays/useInfiniteBets.ts`):
  - New hook using `useInfiniteQuery` from React Query
  - Automatically handles page fetching and caching
  - Supports all existing bet filters (date, schedule, lottery, cashier, etc.)
  - Returns flattened data from all pages
  - Provides `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`

- **Intersection Observer Hook** (`web/src/hooks/useIntersectionObserver.ts`):
  - Custom hook for detecting element visibility
  - Configurable threshold, root, rootMargin
  - Optional freeze once visible
  - Returns ref and isIntersecting boolean
  - Used to trigger infinite scroll loading

- **Infinite Scroll Table Component** (`web/src/components/table/InfiniteScrollTable.tsx`):
  - Generic reusable component for infinite scroll tables
  - Configurable trigger index (default: 60)
  - Shows loading indicators while fetching
  - Shows "end of list" message when no more data
  - Supports custom row and header rendering

- **Plays & Hits - Infinite Scroll** (`web/src/features/plays-and-hits/`):
  - Updated to use `useInfiniteBets` instead of `useBets`
  - Loads 100 records per page
  - Triggers next page load at row 60 (60% scroll)
  - Shows loading spinner while fetching more data
  - Displays total count at end of list
  - Gets `totalAmount` and `totalPrize` from first page aggregates
  - Eliminates need for separate `useTotalAmount` and `useTotalPrize` queries
  - Both desktop table and mobile cards support infinite scroll

**Benefits**:
- **Performance**: Only loads 100 records initially instead of all records
- **UX**: Seamless loading without user noticing (pre-fetches at 60%)
- **Network**: Reduces initial page load time significantly
- **Scalability**: Can handle thousands of records without performance issues

- **Terminal-Ticket - Infinite Scroll** (`web/src/features/terminal-ticket/`):
  - Backend pagination support added to tickets endpoint
  - Created `useInfiniteTickets` hook similar to `useInfiniteBets`
  - Updated `index.tsx` to use infinite query
  - Updated `table-terminal-ticket.tsx` with infinite scroll
  - Loads 100 tickets per page
  - Triggers next page load at row 60 (60% scroll)
  - Shows loading spinner while fetching more data
  - Displays total count at end of list
  - Both desktop and mobile views support infinite scroll

**Backend Changes for Tickets**:
- **TicketRepository** (`api/src/ticket/repository/ticket.repository.ts`):
  - Added `page` and `limit` parameters to `getAll` method
  - Implemented `.range(from, to)` for offset-based pagination
  - Added `{count: 'exact'}` to get total count of records
  - Returns `{ data, count }` instead of just data
  - Default: 100 records per page

- **TicketController** (`api/src/ticket/controller/ticket.controller.ts`):
  - Updated `getAll` to return `IPaginatedResponse<ITicketEntityFront>`
  - Calculates pagination metadata (totalPages, hasMore)
  - Returns structured pagination response

- **TicketRouter** (`api/src/ticket/route/ticket.route.ts`):
  - Added `page` and `limit` query parameters to getAllTicketHandler endpoint
  - Parses pagination params with defaults: page=1, limit=100
  - Response format changed to pagination structure for non-ticket_number queries

- **Ticket Details - Bets Infinite Scroll** (`web/src/features/terminal-ticket/`):
  - Created `useInfiniteBetsByTicketNumber` hook for paginated bets by ticket
  - Updated `TicketDetails.tsx` to use infinite queries for both jugadas and aciertos
  - Updated `termina-ticket-play-table.tsx` with infinite scroll support
  - Updated `terminal-ticket-matches-table.tsx` with infinite scroll support
  - Loads 100 bets per page for each table
  - Triggers next page load at row 60 (60% scroll)
  - Shows loading indicators while fetching more data
  - Displays total count at end of each list

### Fixed - 2025-11-11

#### Bug Fixes

- **Pagination Response Parsing** (`web/src/hooks/fetchs/plays/`):
  - Fixed `useBets.ts` to access `json.data.bets.data` instead of `json.data.bets`
  - Fixed `useGetBetysByTicketNumber.ts` to access `json.data.bets.data` instead of `json.data.bets`
  - Resolved "bets.map is not a function" error when clicking tickets in terminal-ticket
  - These hooks now correctly handle the new paginated response structure

- **TypeScript Type Errors**:
  - Made `useIntersectionObserver` generic to support different HTML element types
  - Fixed type errors in `plays-and-hits-table.tsx` by specifying `HTMLTableRowElement` type
  - Fixed type errors in `table-terminal-ticket.tsx` by specifying `HTMLTableRowElement` type
  - Fixed `APIResponse` type errors in `bet.routes.ts` by wrapping response in `{ bets: result }`
  - Fixed `APIResponse` type errors in `ticket.route.ts` by wrapping response in `{ ticket: result }`

- **Infinite Scroll Query Location - Final Fix** (`web/src/features/plays-and-hits/`):
  - **Problem**: IntersectionObserver was in child component but query was in parent, preventing infinite scroll from triggering
  - **Solution**: Moved queries to the same components where IntersectionObserver is used
  - **PlaysAndHitsTable** (`plays-and-hits-table.tsx`):
    - Query `useInfiniteBets` now lives in the table component itself
    - Reads filters directly from `useSearchParams` hook
    - Uses `useMemo` to flatten pages: `data?.pages.flatMap((page) => page.data)`
    - Implements `IntersectionObserver` with trigger at row 60
    - Added `onTotalsUpdate` callback to pass aggregates back to parent
    - Shows loading spinner, infinite scroll indicators, and end-of-list messages
    - Table now manages its own infinite scroll state internally
  - **PlaysAndHitsContent** (`plays-and-hits/index.tsx`):
    - Removed all query logic
    - Only passes `onTotalsUpdate` callback to table
    - Receives totals via `useState` and passes them to `TotalAmountPlayAndHits`
    - Simplified to pure layout component
  - **TotalAmountPlayAndHits** (`total-amount-play-and-hits.tsx`):
    - Receives `totalPlaysAmount` and `totalHitsAmount` as props
    - No changes needed, already prepared to receive props
  - **Result**: Infinite scroll now works correctly in plays-and-hits, loading pages as user scrolls
- **MakePlaysProvider** (`src/features/make-plays/provider/MakePlaysProvider.tsx`):
  - Fixed cashier state not clearing when non-existent user number is entered
  - Changed useEffect logic from simple `if (cashierByNumber)` to `if...else if...else`
  - Now properly sets `setCashier(undefined)` when user number exists but no user is found
  - Previously: entering "2" (exists) then "22" (doesn't exist) would keep showing user "2"
  - Now: entering non-existent user number correctly clears the displayed cashier name

- **FillOutATicket** (`src/features/make-plays/fill-out-a-ticket.tsx`):
  - Fixed invalid HTML input types: `type={'string'}` → `type="text"`
  - Added numeric validation function `handleNumericInput()` that strips non-digit characters
  - Applied validation to inputs that should only accept numbers (0-9):
    - `number` input: now validates and rejects invalid characters like 'n', '*', '+'
    - `with` input: now validates and rejects invalid characters
  - Valid examples: "0001", "123", "00"
  - Invalid (now rejected): "00n", "00*", "11+", "abc"
  - Changed `value={bet.number ?? undefined}` → `value={bet.number ?? ''}` for controlled inputs
  - Changed `value={bet.with}` → `value={bet.with ?? ''}` for controlled inputs

- **ResultsOverview** (`src/features/make-plays/results-overview.tsx`):
  - Fixed footer positioning from `sticky` to `fixed`
  - Changed `sticky bottom-0` → `fixed bottom-0 left-0 right-0`
  - Now stays at bottom of viewport regardless of scroll position
  - Prevents footer from moving up and covering UI during vertical scroll

- **Make Plays Page** (`src/features/make-plays/index.tsx`):
  - Added responsive padding-bottom to main content container
  - Changed `pb-24 sm:pb-28 lg:pb-20` → `pb-32 1440:pb-40` for proper spacing with ResultsOverview + global footer
  - Content area now has proper spacing to account for both fixed ResultsOverview and global footer height

- **ResultsOverview Positioning** (`src/features/make-plays/results-overview.tsx`):
  - Fixed positioning to sit above global footer (clock display)
  - Changed `bottom-0` → `bottom-[60px] 1440:bottom-[90px]` to account for footer height
  - Added responsive horizontal margins to match main layout container width
  - `left-2 right-2 sm:left-4 sm:right-4 md:left-6 md:right-6 lg:left-8 lg:right-8`
  - ResultsOverview now stays fixed above footer, respects container width, doesn't cover UI on scroll

- **FillOutATicket - Controlled Inputs** (`src/features/make-plays/fill-out-a-ticket.tsx`):
  - Fixed "Agregar" button not working due to input type mismatches
  - Changed `place` input: `value={bet.place ?? undefined}` → `value={bet.place ?? ''}`
  - Changed `position` input: `value={bet.position}` → `value={bet.position ?? ''}`
  - All inputs now properly controlled with fallback to empty string

- **FillOutATicket - Amount Parsing** (`src/features/make-plays/fill-out-a-ticket.tsx`):
  - Fixed amount input type handling
  - `handleBet` now parses 'amount' values to number: `Number(value)` or `undefined` if empty
  - Input displays value correctly: `value={bet?.amount?.toString() ?? ''}`
  - Validation `bet.amount > 0` now works correctly with numeric comparison
  - Fixes issue where button was disabled despite valid input

## Notes

### Breaking Changes
- Session timeout changed from 10 minutes to 3 hours
- Hook `useUpdateCurrentAccoutn` renamed to `useLiquidateCurrentAccount` with signature change
- Components using old hook need to be updated

### Migration Guide
If you were using `useUpdateCurrentAcoount`:
```typescript
// Before
import { useUpdateCurrentAcoount } from '@/hooks/mutations/current-account/useUpdateCurrentAccoutn';
const { mutate } = useUpdateCurrentAcoount();
mutate(date);

// After - For liquidation
import { useLiquidateCurrentAccount } from '@/hooks/mutations/current-account/useLiquidateCurrentAccount';
const { mutate } = useLiquidateCurrentAccount();
mutate({ date, leave: false });

// After - For refresh/calculate only
import { useCalculateCurrentAccount } from '@/hooks/mutations/current-account/useCalculateCurrentAccount';
const { mutate } = useCalculateCurrentAccount();
mutate(date);
```
