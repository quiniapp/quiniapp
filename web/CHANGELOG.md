# Changelog - Web Frontend

All notable changes to the web frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-11-19

#### Modal Components
- **DeleteTicketModal Component**: Created confirmation modal for ticket deletion
  - Path: `src/components/modals/DeleteTicketModal.tsx`
  - Features:
    - Confirmation dialog to prevent accidental deletions
    - Displays ticket number being deleted
    - Warning message about irreversible action
    - Delete and Cancel buttons with loading state
    - Consistent styling with existing modals (DeleteResultsModal)
  - Purpose: Improve UX and prevent unintended ticket deletions

### Fixed - 2025-11-19

#### CheckboxWithLabel Component - Visibility, Click Behavior, and Ref Support
- **CheckboxWithLabel**: Fixed checkbox visibility, click area, F-key support, and double-click issue
  - Path: `src/components/button/CheckboxWithLabel.tsx`
  - Removed `hidden md:flex` from checkbox - now visible on all screen sizes
  - Added `forwardRef` support for F-key functionality compatibility
  - Removed `htmlFor` from Label and added `pointer-events-none` to both Checkbox and Label
  - Container `onClick` handler is now the single source of click events
  - Fixes: Clicking on label or space between checkbox and label now works correctly
  - Fixes: Checkbox is now visible on mobile devices
  - Fixes: F-key shortcuts now work properly in schedules-checkbox-list
  - Fixes: Double-click event eliminated - onClick now fires only once per click

#### RadioButtonWithLabel Component - Click Area Enhancement
- **RadioButtonWithLabel**: Added container-level click support and fixed double-click issue
  - Path: `src/components/button/RadioButtonWithLabel.tsx`
  - Added `onClick` handler to container Flex
  - Uses `useRef` and `useImperativeHandle` for proper ref forwarding
  - Removed `htmlFor` from Label and added `pointer-events-none` to Label
  - Maintains compatibility with existing F-key functionality
  - Fixes: Clicking anywhere in the container (label, space between) now selects the radio button
  - Fixes: Double-click event eliminated - onClick now fires only once per click
  - Benefits: Improved UX with larger click target area

#### Schedule Checkbox List - F-key Support Fixed
- **schedules-checkbox-list.tsx**: Fixed F-key shortcuts for schedule selection
  - Path: `src/features/make-plays/schedules-checkbox-list.tsx`
  - Changed refs from `HTMLButtonElement` to `HTMLDivElement` to match CheckboxWithLabel
  - Added `ref` prop to CheckboxWithLabel components
  - Changed from `onCheckedChange` to `onClick` for consistent behavior
  - Fixes: F1-F10 shortcuts now properly select schedules

#### Lotteries Checkbox List - Key Prop Added
- **lotteries-checkbox-list.tsx**: Added missing key prop to CheckboxWithLabel
  - Path: `src/features/make-plays/lotteries-checkbox-list.tsx`
  - Added `key={lot.lottery_id}` to prevent React warnings
  - Uses `onClick` for consistent checkbox behavior
  - Fixes: Proper React reconciliation and checkbox toggle behavior

### Changed - 2025-11-19

#### Terminal Ticket - Delete Confirmation
- **terminal-ticket/index.tsx**: Added confirmation modal for ticket deletion
  - Path: `src/features/terminal-ticket/index.tsx`
  - Changes:
    - Added `isOpenDeleteTicket` state to control modal visibility
    - "Eliminar Ticket" button now opens confirmation modal instead of deleting directly
    - Integrated DeleteTicketModal component
    - Modal closes automatically on successful deletion
    - Maintains toast notifications for success/error feedback
  - Benefits:
    - Prevents accidental ticket deletions
    - Better user experience with explicit confirmation
    - Follows same pattern as results deletion (DeleteResultsModal)

### Changed - 2025-11-19

#### Responsive Layout Improvements
- **results/index.tsx**: Updated main container to use flexbox layout
  - Changed from `grid grid-cols-1 lg:grid-cols-2` to `flex flex-col xl:flex-row`
  - Container now uses flex-col by default (mobile/tablet)
  - Switches to flex-row at xl breakpoint (1280px+) for better horizontal layout on large screens
  - Improves responsive behavior and content flow

- **terminal-ticket/form-header-filter.tsx**: Updated fieldsets layout for responsive design
  - Container uses `flex-col` by default, switches to `flex-row` at sm breakpoint
  - Both fieldsets now have `w-full sm:w-1/2` for equal width distribution
  - Mobile (< sm): Fieldsets stack vertically, each occupying 100% width
  - Desktop (≥ sm): Fieldsets display side-by-side, each occupying 50% width
  - Consistent spacing with `gap-1 sm:gap-3` between fieldsets
  - Better space utilization and balanced layout across all screen sizes

#### Button Components Migration
- **results/index.tsx**: Updated all buttons to use IconButton component
  - "Generar Ganadores" button: Now uses IconButton with success variant
  - "Borrar resultado" button: Now uses IconButton with TrashIcon and destructive variant
  - "Editar" button: Now uses IconButton with PencilIcon and outline variant
  - "Guardar Resultados" button: Now uses IconButton with SaveIcon and default variant
  - Icons hidden on screens smaller than md (768px), only text visible on mobile
  - Consistent responsive behavior across all action buttons
  - Improved accessibility with container-level click support

- **terminal-ticket/form-header-filter.tsx**: Updated filter buttons to use IconButton component
  - "Buscar" button: Now uses IconButton with SearchIcon
  - "Limpiar" button: Now uses IconButton with outline variant
  - Icons hidden on screens smaller than md (768px), only text visible on mobile
  - Better responsive behavior and consistent styling with the rest of the app

### Added - 2025-11-18

#### Reusable Components
- **CheckboxWithLabel Component**: Created centralized checkbox component in `src/components/button/CheckboxWithLabel.tsx`
  - Supports clicking on entire container (not just checkbox or label)
  - Shows cursor pointer on hover for better UX
  - Accepts ReactNode for labels to support complex content
  - Supports disabled state, custom styling, and both onClick and onCheckedChange handlers
  - Used across multiple features for consistent behavior
  - Checkbox hidden on screens smaller than `md` (768px), only label visible on mobile

- **RadioButtonWithLabel Component**: Created centralized radio button component in `src/components/button/RadioButtonWithLabel.tsx`
  - Container-level click support for better accessibility
  - Cursor pointer on hover
  - Supports forwardRef for external refs (F-key functionality)
  - Consistent styling across the app

- **IconButton Component**: Created flexible button component in `src/components/button/IconButton.tsx`
  - Accepts optional icon and label
  - Fully responsive (full-width on mobile, auto-width on desktop)
  - Supports all button variants
  - Prevents text/icon overflow with truncate
  - Icons hidden on screens smaller than `md` (768px), only text visible on mobile

- **SelectDayToSearch Component**: Moved from features to `src/components/select-day-to-search.tsx`
  - Now reusable across all features
  - Improved responsive behavior (full-width on mobile, fixed width on desktop)
  - Added flex-shrink-0 to icon to prevent squishing
  - Text truncation to prevent overflow

### Changed - 2025-11-18

#### Checkbox Components Migration
- **make-plays/lottery-checkbox-list.tsx**: Updated to use CheckboxWithLabel component
  - Simplified code from 30 lines to 23 lines
  - Better UX with container-level click support

- **make-plays/schedules-checkbox-list.tsx**: Updated desktop grid to use CheckboxWithLabel
  - Maintains F-key functionality with hidden button refs
  - Complex labels with colored F-key indicators

- **plays-and-hits/select-bet-type.tsx**: Updated to use CheckboxWithLabel component
  - Cleaner implementation for bet type selection
  - Improved accessibility

- **upcoming-lotteries/lottery-checkbox-list.tsx**: Updated to use CheckboxWithLabel component
  - Consistent checkbox behavior across the app

#### Radio Button Components Migration
- **upcoming-lotteries/schedules-list.tsx**: Updated to use RadioButtonWithLabel component
  - Simplified component structure
  - Better click targets

- **results/shifts.tsx**: Updated to use RadioButtonWithLabel component
  - Maintains F-key functionality with refs
  - Improved accessibility with container clicks

- **results/quini-check.tsx**: Updated to use RadioButtonWithLabel component
  - Consistent styling and behavior

#### Results Page Improvements
- **results/index.tsx**: Added comprehensive validations and responsive fixes
  - Input validation: only numbers (0-9) allowed, no letters or special characters
  - Range validation: 0000-9999 (4 digits required)
  - Save button now disabled until all 20 inputs have exactly 4 digits
  - Added min-width to inputs (60px mobile, 70px desktop) to always show 4 digits
  - Added text-center alignment for better number display
  - Toast error message when trying to save incomplete results
  - Added `canSave` computed value for button state

#### Mobile Responsiveness
- **fill-out-a-ticket.tsx**: Improved button display on mobile
  - Icons hidden on mobile (visible on sm+ screens)
  - Text "Agregar" and "Borrar" always visible
  - Better use of screen space on small devices

- **terminal-ticket/index.tsx**: Updated buttons to use IconButton component
  - Better responsive behavior with flex-col on mobile, flex-row on desktop
  - Added gap-2 for proper spacing
  - Buttons now stack vertically on mobile, horizontally on desktop

- **make-plays/header-play-detail.tsx**: Updated cashier buttons to use IconButton component
  - Replaced three Button components with IconButton for consistent behavior
  - "Repetir Ticket" with Repeat2Icon
  - "Reimprimir" with PrinterIcon
  - "Cancelar" button (no icon)
  - Icons hidden on screens smaller than md, simplified labels removed
  - Cleaner implementation with less conditional rendering

#### Component Location Changes
- **SelectDayToSearch**: Moved from `features/plays-and-hits/` to `components/`
  - Updated imports in 5 files:
    - features/results/index.tsx
    - features/current-account/CurrentAcoountByUserTable.tsx
    - features/terminal-ticket/form-header-filter.tsx
    - features/plays-and-hits/header-play-and-hits.tsx
    - components/filter-section/index.tsx

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

#### Make Plays - Button State
- **Close Ticket Button**: Prevent double-click during bet creation/edit
  - Path: `src/features/make-plays/results-overview.tsx:65`
  - Button now disabled when `isPendingCreate` or `isPendingEdit` are true
  - Prevents multiple submissions while fetching

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
