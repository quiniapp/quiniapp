# Changelog - API Backend

All notable changes to the API backend will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
