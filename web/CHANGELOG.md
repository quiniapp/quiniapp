# Changelog - Web Frontend

All notable changes to the web frontend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-12-03

#### Infinite Scroll Hook - Centralized Logic
- **useInfiniteScroll.ts**: Created centralized hook for infinite scroll functionality
  - Path: `web/src/hooks/useInfiniteScroll.ts`
  - **Features:**
    - Observes specific row index (default: 75) to trigger pagination
    - Returns callback ref (`setTriggerRef`) to assign to trigger element
    - Auto-loads when content doesn't fill viewport
    - Configurable trigger index and root margin
    - Automatic cleanup on unmount
  - **Benefits:**
    - Single source of truth for infinite scroll logic
    - Eliminates code duplication across table components
    - More predictable loading behavior (triggers at specific row)
    - Easier to adjust loading threshold globally

### Changed - 2025-12-03

#### Infinite Scroll Implementation - Table Components
- **plays-and-hits-table.tsx**: Migrated to useInfiniteScroll hook
  - Path: `web/src/features/plays-and-hits/plays-and-hits-table.tsx`
  - Removed manual IntersectionObserver setup
  - Removed sentinel element at end of list
  - Triggers pagination when row 75 is visible
  - Code reduction: ~40 lines

- **table-terminal-ticket.tsx**: Migrated to useInfiniteScroll hook
  - Path: `web/src/features/terminal-ticket/table-terminal-ticket.tsx`
  - Removed manual IntersectionObserver setup
  - Removed sentinel element at end of list
  - Triggers pagination when row 75 is visible
  - Code reduction: ~30 lines

- **termina-ticket-play-table.tsx**: Migrated to useInfiniteScroll hook
  - Path: `web/src/features/terminal-ticket/termina-ticket-play-table.tsx`
  - Removed manual IntersectionObserver setup
  - Removed sentinel element at end of list
  - Triggers pagination when row 75 is visible
  - Code reduction: ~30 lines

- **terminal-ticket-matches-table.tsx**: Migrated to useInfiniteScroll hook
  - Path: `web/src/features/terminal-ticket/terminal-ticket-matches-table.tsx`
  - Removed manual IntersectionObserver setup
  - Removed sentinel element at end of list
  - Triggers pagination when row 75 is visible
  - Code reduction: ~30 lines

- **ticket-table-row.tsx**: Enhanced with forwardRef support
  - Path: `web/src/features/terminal-ticket/ticket-table-row.tsx`
  - Added forwardRef to TicketTableRow component
  - Allows parent components to assign refs for intersection observation
  - Maintains backward compatibility with existing props

- **Refactor Summary:**
  - Before: Manual IntersectionObserver in each component with sentinel at end
  - After: Centralized hook with row-based trigger (row 75)
  - Total code reduction: ~130 lines
  - Consistent loading behavior across all tables
  - More predictable UX - always loads at row 75 instead of at the end

### Changed - 2025-11-21

#### Results Components - RadioGroupSection Refactor
- **RadioGroupSection.tsx**: Created reusable radio group component
  - Path: `web/src/features/results/components/RadioGroupSection.tsx`
  - **New Generic Component:**
    - Accepts generic `RadioItem` type with `id` and `label`
    - Props: `title`, `icon`, `items`, `onValueChange`, optional `keyboardRefs`, `getItemLabel`
    - Handles responsive icon sizing automatically
    - Configurable label formatter via `getItemLabel` function
  - **Benefits:**
    - Single source of truth for radio group UI
    - Type-safe with TypeScript generics
    - Eliminates code duplication

- **shifts.tsx**: Refactored to use RadioGroupSection
  - Path: `web/src/features/results/shifts.tsx`
  - **Changes:**
    - Removed JSX return markup (moved to RadioGroupSection)
    - Transforms schedules to `ShiftItem[]` with id/label
    - Uses `getItemLabel` to format labels with time and F-key shortcuts
    - Maintains keyboard shortcuts logic (F1-F10)
    - Passes keyboard refs to RadioGroupSection
  - Code reduction: ~30 lines

- **quini-check.tsx**: Refactored to use RadioGroupSection
  - Path: `web/src/features/results/quini-check.tsx`
  - **Changes:**
    - Removed JSX return markup (moved to RadioGroupSection)
    - Transforms lotteries to `QuiniItem[]` with id/label
    - Uses default label (lottery name)
    - No keyboard refs needed
  - Code reduction: ~25 lines

- **Refactor Summary:**
  - Before: Duplicate UI markup in both components
  - After: Shared RadioGroupSection component
  - Total code reduction: ~55 lines
  - Easier to maintain and update styling
  - Consistent UI behavior across both components

#### Results Components - Text Wrapping Fix
- **quini-check.tsx & shifts.tsx**: Prevent text wrapping in labels
  - Paths: `web/src/features/results/quini-check.tsx`, `web/src/features/results/shifts.tsx`
  - **Changes:**
    - Added `whitespace-nowrap` to prevent line breaks
    - Removed incomplete `text-` class from quini-check
    - Cleaned up extra spaces in class names
  - **Benefits:**
    - Labels stay on single line (no wrapping at spaces)
    - More consistent visual appearance
    - Better readability

#### Results Shifts Component - Layout Update
- **shifts.tsx**: Changed grid layout to horizontal row
  - Path: `web/src/features/results/shifts.tsx`
  - **Layout Changes:**
    - Before: `grid grid-flow-row` (vertical grid)
    - After: `flex flex-row flex-wrap` (horizontal row with wrapping)
    - Responsive gaps: `gap-2 md:gap-3 1440:gap-4`
  - **Benefits:**
    - Items display horizontally in a single row
    - Automatically wraps to next line when needed
    - More compact horizontal layout
    - Better space utilization

#### Aside Component - Responsive Typography & Icons
- **index.tsx**: Responsive text and icon sizing throughout sidebar
  - Path: `web/src/components/aside/index.tsx`
  - **Typography Changes:**
    - All menu items: `text-xs lg:text-base` (12px → 16px at lg breakpoint)
    - Parent items (collapsible triggers): Responsive text
    - Child items (nested menu): Responsive text
    - Single items (no children): Responsive text
    - Footer (logout button): `text-xs lg:text-base`
  - **Icon Size Changes:**
    - Menu icons: `w-3.5 h-3.5 lg:w-5 lg:h-5` (14px → 20px at lg breakpoint)
    - ChevronRight (collapsible indicator): `w-3.5 h-3.5 lg:w-4 lg:h-4`
    - Power icon (logout): `w-3.5 h-3.5 lg:w-5 lg:h-5`
    - Uses `[&>svg]` selector to target nested SVG icons
  - **Removed:** Fixed `!text-[14px]` classes
  - **Benefits:**
    - Icons scale proportionally with text size
    - Better visual balance between text and icons
    - More compact on small screens, comfortable on large screens
    - Consistent responsive pattern across all sidebar elements
    - Improved accessibility with scalable typography and iconography

#### SelectDayToSearch Component - Mobile Responsiveness
- **SelectDayToSearch.tsx**: Optimized for small screens
  - Path: `web/src/components/button/SelectDayToSearch.tsx`
  - **Mobile Improvements:**
    - Reduced max-width: `max-w-[180px]` on mobile vs `max-w-[240px]` on desktop
    - Smaller padding: `px-2 py-1.5` on mobile vs `px-4 py-2` on desktop
    - Smaller icon: `h-3.5 w-3.5` on mobile vs `h-4 w-4` on desktop
    - Reduced gap between icon and text: `gap-1` on mobile vs `gap-2` on desktop
  - **Date Format Changes:**
    - Mobile (< sm): Short format `dd/MM/yy` (e.g., "21/11/25")
    - Desktop (≥ sm): Full format `PPP` (e.g., "21 de noviembre de 2025")
    - Placeholder text: "Fecha" on mobile, "Seleccionar Fecha" on desktop
  - **Calendar Popover:** Smaller padding on mobile (`p-2` vs `p-3`)
  - Benefits: Saves horizontal space on mobile, better UX on small screens

#### Results Feature - Provider Pattern Refactor
- **ResultsContext.tsx**: Created centralized context for type safety
  - Path: `web/src/features/results/context/ResultsContext.tsx`
  - **Type Definitions:**
    - `ResultsState`: All state variables (results, selections, UI flags, refs)
    - `ResultsActions`: All handler functions (handleScheduleSelect, handleLotterySelect, etc.)
    - `ResultsContextType`: Combined type for full context
  - Custom hook: `useResults()` with error boundary check
  - Benefits: Type-safe access to context, clear separation of concerns

- **ResultsProvider.tsx**: Centralized state management and business logic
  - Path: `web/src/features/results/provider/ResultsProvider.tsx`
  - **Migrated State (10 state variables):**
    - `isOpen`, `isOpenDeleteResult` - Modal visibility
    - `results` - Array of 20 result strings
    - `selectedSchedule`, `selectedLottery`, `selectedDate` - User selections
    - `scheduleWinners` - Winner generation schedule
    - `onEdit` - Edit mode flag
    - `inputRefs` - Refs for input navigation
  - **Migrated Logic (5 handlers + 1 derived state):**
    - `handleScheduleSelect`, `handleLotterySelect` - Selection handlers
    - `handleGenerate` - Generate winners with toast notifications
    - `handleSave` - Create/update results with validation
    - `handleDeleteResult` - Delete results with confirmation
    - `canSave` - Computed flag for save button state
  - **Data Fetching:** All hooks moved to provider (useSchedules, useLotteries, useResults, mutations)
  - **Effects:** Syncs results state with fetched data, resets edit mode
  - Why: Single source of truth, eliminates prop drilling

- **index.tsx**: Simplified to pure presentation component
  - Path: `web/src/features/results/index.tsx`
  - **Removed:** ~130 lines of state, logic, and hook calls
  - **Now only contains:** UI rendering and layout structure
  - Uses `useResults()` hook to access all state/actions
  - Wrapped with `ResultsContentWithProvider` HOC
  - Benefits: Cleaner component tree, easier to test and maintain

- **quini-check.tsx**: Refactored to consume context
  - Path: `web/src/features/results/quini-check.tsx`
  - **Removed props:** `quini` array, `onLotterySelect` callback
  - **Now reads from context:** `lotteries`, `handleLotterySelect`
  - No longer needs props passed from parent
  - Simplified component signature: `const QuiniChecks = () => {}`
  - Benefits: Self-contained, no prop drilling

- **shifts.tsx**: Refactored to consume context
  - Path: `web/src/features/results/shifts.tsx`
  - **Removed props:** `schedules` array, `onScheduleSelect` callback
  - **Now reads from context:** `fetchSchedules`, `handleScheduleSelect`
  - Maintains keyboard shortcuts (F1-F10) for schedule selection
  - No longer needs props passed from parent
  - Simplified component signature: `const ResultShifts = () => {}`
  - Benefits: Self-contained, no prop drilling

- **Refactor Summary:**
  - Before: Props passed through 2-3 component levels
  - After: Direct context access in leaf components
  - Code reduction: ~150 lines eliminated across files
  - Maintenance: Single place to update business logic
  - Testing: Provider can be tested independently
  - Pattern consistency: Matches MakePlaysProvider pattern



#### Modal System - IconButton Integration & Mobile Responsiveness
- **All Modal Components**: Updated to use IconButton and improved mobile responsiveness
  - Paths: `web/src/components/modals/*.tsx`
  - **Modals Updated:**
    - `ResetPartialModal.tsx` - Replaced Button with IconButton, added responsive layout
    - `DeleteUsersModal.tsx` - IconButton integration with full-width mobile layout
    - `DeleteResultsModal.tsx` - IconButton with responsive text sizing
    - `DeleteTicketModal.tsx` - Dual IconButton layout (Delete + Cancel)
    - `generate-winners-modal.tsx` - IconButton with responsive radio group layout
    - `GenerateLiquitationModal.tsx` - IconButton with horizontal scroll for table on mobile
    - `UpdateUserModal.tsx` - IconButton with responsive form layout
    - `UserCurrentAccountModal.tsx` - Dual IconButton layout for actions
  - **Mobile Improvements:**
    - Responsive max-width: `!max-w-[90vw] sm:!max-w-[500px] md:!max-w-[600px]`
    - Responsive padding: `pt-4 sm:pt-6 md:pt-[36px]`, `px-2 sm:px-4`
    - Responsive text: `text-xs sm:text-sm`, `text-sm sm:text-base`
    - Buttons stack vertically on mobile: `flex-col sm:flex-row`
    - Full-width buttons on mobile: `className="w-full"`
    - Tables with horizontal scroll wrapper on small screens
  - **Consistency Benefits:**
    - Unified button styling across all modals
    - Consistent mobile/desktop responsive patterns
    - Better touch targets on mobile devices
    - Improved readability with responsive typography

#### Make Plays Feature - ResetPartialModal State Management Refactor
- **MakePlaysProvider.tsx**: Added centralized `openDeleteModal` state
  - Path: `web/src/features/make-plays/provider/MakePlaysProvider.tsx`
  - Added state: `const [openDeleteModal, setOpenDeleteModal] = useState<boolean>(false)`
  - Exposed via context: `openDeleteModal`, `setOpenDeleteModal`
  - Why: Eliminate duplicate state management across components

- **MakePlaysContext.tsx**: Extended context type with modal state
  - Path: `web/src/features/make-plays/context/MakePlaysContext.tsx`
  - Added to `PlayDetailsState` type: `openDeleteModal: boolean`, `setOpenDeleteModal`
  - Enables shared modal state across make-plays feature components

- **index.tsx**: Centralized ResetPartialModal rendering
  - Path: `web/src/features/make-plays/index.tsx`
  - Added lazy-loaded `ResetPartialModal` component
  - Moved modal rendering from child components to parent
  - Handles `handleResetPartial` logic centrally
  - Single source of truth for modal open/close state
  - Benefits: Eliminates code duplication, simplifies component tree

- **fill-out-a-ticket.tsx**: Removed duplicate modal, uses shared state
  - Path: `web/src/features/make-plays/fill-out-a-ticket.tsx`
  - Removed local `openModal` state
  - Removed `handleResetPartial` function
  - Removed duplicate `ResetPartialModal` component and Suspense wrapper
  - Uses `setOpenDeleteModal` from context for keyboard shortcut (*)
  - Removed unused `Suspense` import

- **results-overview.tsx**: Removed duplicate modal, uses shared state
  - Path: `web/src/features/make-plays/results-overview.tsx`
  - Removed local `openModal` state
  - Removed `handleResetPartial` function
  - Removed duplicate `ResetPartialModal` component and Suspense wrapper
  - Uses `setOpenDeleteModal` from context for button click
  - Removed unused `React`, `Suspense`, `useState` imports
  - Cleaner component with single responsibility

- **Migration Summary:**
  - Before: ResetPartialModal duplicated in 2 components
  - After: Single modal instance in parent, shared state in provider
  - Code reduction: Eliminated ~30 lines of duplicate code
  - Maintenance: Changes to modal now only need updates in one place
  - State management: Centralized in provider pattern

### Added - 2025-11-20

#### Frontend TODO System
- **Comprehensive TODO Documentation**: Created detailed TODO.md for frontend development
  - Path: `web/TODO.md`
  - **6 Major Categories:**
    1. **Atomic Design Migration**: Complete restructuring to atoms/molecules/organisms/templates
    2. **Componentization**: Reuse terminal-ticket table in current-account, create generic DataTable
    3. **Modal Optimization**: Unified modal system with base component, manager, and presets
    4. **UI Uniformization**: Typography system, responsive text patterns, button standardization, form elements
    5. **New Features**: WhatsApp Web export with PDF generation (desktop only)
    6. **Performance Optimization**: Code splitting, lazy loading, bundle optimization, Web Vitals monitoring
  - **Timeline:** 2-3 months for full implementation
  - **Priorities defined:** High (1-2 months), Medium (2-3 months), Low (Future)
  - **Recommended Action Plan:**
    - Month 1: Quick wins + Atomic Design foundations
    - Month 2: Core components + uniformization
    - Month 3: Features + migration
  - **Success Metrics:** Code reduction >30%, LCP <2.5s, 100% UI consistency
  - Detailed task breakdowns with time estimates for each section
  - Mobile-first approach emphasized throughout
  - Performance budgets defined

### Changed - 2025-11-20

#### Results Overview - IconButton Implementation & Mobile Layout
- **results-overview.tsx**: Refactored to use IconButton component and improved mobile layout
  - Path: `src/features/make-plays/results-overview.tsx`
  - Replaced three Button components with IconButton:
    - "Cerrar Ticket" button (no icon)
    - "Eliminar" button with Trash2Icon
    - "Reiniciar" button with TimerReset icon
  - Benefits: Consistent button styling and behavior across the app
  - Maintains all existing functionality and disabled states
  - Icons now hidden on mobile (< md) as per IconButton design
  - **Mobile Amount Display**: Redesigned amount display for mobile view
    - Mobile (< sm): Single row layout with two amounts side by side
    - Format: "Monto parcial: $ X,XXX" | "TOTAL: $ X,XXX"
    - Uses `toLocaleString('es-AR')` for proper number formatting
    - "Total" label appears in uppercase on mobile
    - Desktop (≥ sm): Maintains original two-column vertical layout

#### Terminal Ticket Table - Modularization and Column Width Improvements
- **TicketTableRow Components**: Created modular components for table rows and headers
  - Path: `src/features/terminal-ticket/ticket-table-row.tsx`
  - New components: `TicketTableHeader` and `TicketTableRow`
  - Benefits: Better code organization, reusability, and maintainability
- **TableTerminalTicket**: Refactored to use new modular components
  - Path: `src/features/terminal-ticket/table-terminal-ticket.tsx`
  - Replaced inline TableRow/TableHead with `TicketTableHeader` and `TicketTableRow`
  - Added responsive column widths to prevent data overlap:
    - Número: `min-w-40 w-[25%] sm:w-[30%]`
    - Pasador: `w-[25%] sm:w-[25%]`
    - Monto: `w-[20%] sm:w-[20%]`
    - Pagado: `w-[30%] sm:w-[25%]`
  - Fixes: Data overlap issue on mobile devices
  - Ensures all 4 columns are always visible with proper spacing

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
