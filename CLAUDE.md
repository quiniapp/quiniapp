# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo for QuiniApp, a lottery/betting application with the following workspaces:
- `api/` - Express.js backend with TypeScript
- `web/` - React frontend with Vite, TypeScript, and Tailwind CSS
- `helper/` - Shared utility functions and types across workspaces

## Common Development Commands

### Root Level Commands
- `npm install` - Install all workspace dependencies
- `npm run api-install` - Install API workspace dependencies only
- `npm run web-install` - Install web workspace dependencies only
- `npm run api` - Run API development server
- `npm run web` - Run web development server
- `npm run lint` - Run ESLint on all workspaces
- `npm run format` - Run Prettier on all workspaces
- `npm run build` - Build all workspaces

### API Workspace (api/)
- `npm run dev` - Start development server with tsx watch (runs on port 3000)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Run ESLint on API source files
- `npm run format` - Format API source files with Prettier

### Web Workspace (web/)
- `npm run dev` - Start Vite development server (proxies /api to localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint on web source files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format all files with Prettier

## Architecture Overview

### Backend API (api/)
- **Framework**: Express.js with TypeScript
- **Database**: Uses Supabase for data persistence and PostgreSQL
- **Authentication**: JWT-based auth with cookie storage, middleware in `middlewares/auth.middleware.ts`
- **Structure**: Feature-based modules (auth, bet, lottery, user, etc.) each with:
  - `controller/` - HTTP request handlers
  - `repository/` - Database access layer
  - `route/` - Express route definitions
  - `helper/` - Module-specific utilities
- **Entry point**: `src/index.ts` sets up Express server with CORS, routing, and middleware
- **Routing**: Two main routers:
  - `/api` - Public routes (no auth required)
  - `/api/private` - Protected routes (requires authentication)

### Frontend Web (web/)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS with shadcn/ui components
- **Routing**: React Router DOM with browser router
- **State Management**:
  - Zustand for global state
  - TanStack Query for server state and caching
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with custom styling
- **Entry point**: `src/main.tsx` renders the main App component
- **Structure**:
  - `pages/` - Route components/pages
  - `components/` - Reusable UI components
  - `providers/` - React context providers (Auth, Theme, Modal, Clock)
  - `auth/` - Authentication utilities and API calls

### Shared Helper (helper/)
- Shared utilities, types, and functions used across API and web workspaces
- Contains validation schemas, parsing functions, and common business logic
- TypeScript modules with no build step (consumed directly by other workspaces)

## Key Technologies
- **TypeScript**: Used throughout all workspaces with shared base config
- **Zod**: Schema validation across frontend and backend
- **ESLint + Prettier**: Code linting and formatting with shared configuration
- **Husky + lint-staged**: Git hooks for code quality
- **Express + CORS**: Backend with proper CORS configuration for multiple environments
- **Supabase**: Database and authentication services
- **TanStack Query**: Data fetching and caching on frontend
- **Tailwind CSS**: Utility-first CSS framework with custom design system

## Development Workflow
1. Start API server: `npm run api` (port 3000)
2. Start web dev server: `npm run web` (Vite will proxy API calls)
3. Web dev server automatically proxies `/api` requests to the backend
4. Both servers support hot reloading during development