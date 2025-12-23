# QuiniApp

Sistema de gestión de quiniela multi-tenancy con soporte para múltiples organizaciones.

## 👥 Developers
* **[@sudacadev](https://github.com/sudacadev)**
* **[@agustineze](https://github.com/agustineze)**

---

## 📋 Project Overview

QuiniApp es una aplicación monorepo que permite la gestión completa de quinielas, incluyendo:
- ✅ Sistema multi-tenancy (organizaciones)
- ✅ Gestión de tickets y apuestas
- ✅ Resultados y liquidaciones
- ✅ Cuenta corriente de usuarios
- ✅ Roles y permisos (OWNER, SUPERADMIN, ADMIN, CASHIER)
- ✅ Optimización de performance (code splitting, lazy loading, cache)

---

## 🏗️ Project Structure

```
quiniapp/
├── api/              # Backend - Express.js + TypeScript
├── web/              # Frontend - React + Vite + Tailwind
├── helper/           # Shared types and utilities
├── CLAUDE.md         # Instructions for Claude Code
└── README.md         # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- PostgreSQL (via Supabase)
- Git

### Installation

#### 1. Clone the repository
```bash
git clone https://github.com/quiniapp/quiniapp.git
cd quiniapp
```

#### 2. Install dependencies

**Root level (installs all workspaces):**
```bash
npm install
```

**Or install workspaces individually:**
```bash
# API only
npm run api-install

# Web only
npm run web-install
```

#### 3. Required dependencies

**For Drag & Drop functionality (lotteries reordering):**
```bash
cd web
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

These packages are used in `web/src/features/lotteries/index.tsx` for lottery reordering via drag & drop.

**Documentation:** https://docs.dndkit.com/

#### 4. Environment variables

Create `.env` files in both `api/` and `web/` directories:

**api/.env:**
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
```

**web/.env:**
```env
VITE_API_URL=http://localhost:3000
```

#### 5. Run development servers

**Option A: Run both servers (recommended):**
```bash
# Terminal 1 - API
npm run api

# Terminal 2 - Web
npm run web
```

**Option B: Run from root:**
```bash
# Requires terminal multiplexer or run in separate terminals
npm run api
npm run web
```

The web dev server automatically proxies `/api` requests to `localhost:3000`.

---

## 📦 Available Scripts

### Root Level
- `npm install` - Install all workspace dependencies
- `npm run api-install` - Install API dependencies only
- `npm run web-install` - Install web dependencies only
- `npm run api` - Run API development server
- `npm run web` - Run web development server
- `npm run lint` - Lint all workspaces
- `npm run format` - Format all workspaces with Prettier
- `npm run build` - Build all workspaces

### API Workspace (`api/`)
- `npm run dev` - Start development server with tsx watch (port 3000)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Lint API source files
- `npm run format` - Format API files with Prettier

### Web Workspace (`web/`)
- `npm run dev` - Start Vite dev server (proxies /api to localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint web source files
- `npm run lint:fix` - Lint with auto-fix
- `npm run format` - Format web files with Prettier

---

## 🧪 Testing

Currently no automated tests are configured. Manual testing workflow:

1. Start both servers (`npm run api` + `npm run web`)
2. Navigate to `http://localhost:5173`
3. Test critical flows:
   - Login/Logout
   - Create ticket
   - Make plays
   - View results
   - Check current account

---

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Instructions for Claude Code (development guidelines)
- **[api/TODO.md](./api/TODO.md)** - Backend pending tasks and features
- **[web/TODO.md](./web/TODO.md)** - Frontend pending tasks and features
- **[api/CHANGELOG.md](./api/CHANGELOG.md)** - Backend change history
- **[web/CHANGELOG.md](./web/CHANGELOG.md)** - Frontend change history
- **[helper/CHANGELOG.md](./helper/CHANGELOG.md)** - Shared code change history

---

## 🚢 Pre-Deploy Checklist

Before deploying to production, ensure:

### Environment & Configuration
- [ ] All `.env` variables are set correctly in production
- [ ] `VITE_API_URL` points to production API
- [ ] `JWT_SECRET` is strong and unique
- [ ] CORS is configured for production domain
- [ ] Supabase RLS policies are enabled

### Code Quality
- [ ] Run `npm run lint` - No errors
- [ ] Run `npm run build` - Build succeeds
- [ ] Check bundle size (web): < 1.5 MB
- [ ] No `console.log` statements in production code
- [ ] No `TODO` or `FIXME` comments critical for launch

### Database
- [ ] All migrations executed
- [ ] Indices created (see `api/action_plan_database_optimization.md`)
- [ ] RLS policies tested
- [ ] Backup strategy in place
- [ ] Soft delete implemented for all entities

### Security
- [ ] Authentication flow tested
- [ ] Authorization/permissions verified
- [ ] API endpoints validate `organization_id` from JWT
- [ ] No sensitive data exposed in frontend
- [ ] Rate limiting configured
- [ ] HTTPS enabled

### Performance
- [ ] Lazy loading routes implemented ✅
- [ ] Code splitting configured ✅
- [ ] React.memo on heavy components ✅
- [ ] TanStack Query cache optimized ✅
- [ ] Images optimized
- [ ] INP < 100ms ✅
- [ ] LCP < 2.5s ✅

### User Experience
- [ ] All critical flows tested on mobile
- [ ] Responsive design verified (320px - 2560px)
- [ ] Loading states consistent
- [ ] Error messages clear and actionable
- [ ] Success feedback on all mutations

### Monitoring
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Performance monitoring setup
- [ ] Database query performance monitored
- [ ] API response times logged

---

## 🏛️ Architecture

### Backend (API)
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** JWT with HTTP-only cookies
- **Structure:** Feature-based modules
  - `auth/` - Authentication
  - `bet/` - Plays/bets
  - `lottery/` - Lotteries
  - `ticket/` - Tickets
  - `user/` - User management
  - `results/` - Results and winners
  - `current_account/` - Current account

### Frontend (Web)
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Routing:** React Router DOM
- **State Management:**
  - Zustand (global state)
  - TanStack Query (server state + cache)
- **Forms:** React Hook Form + Zod validation

### Shared (Helper)
- **Types:** TypeScript interfaces shared across workspaces
- **Utilities:** Parsing, validation, config
- **No build step:** Consumed directly by API and Web

---

## 🔐 Multi-Tenancy

QuiniApp implements organization-based multi-tenancy:

- Each user belongs to **one organization**
- All data is scoped by `organization_id`
- JWT includes `organization_id` from authenticated user
- Backend middleware automatically filters data by organization
- **Frontend never sends `organization_id`** - it's extracted from JWT

See `web/org.md` for frontend implementation details (pending).

---

## 🤝 Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Update CHANGELOGs
4. Test locally
5. Create a Pull Request to `develop`

**Branch naming:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

---

## 📄 License

TBD

---

## 📞 Support

For questions or issues, contact the development team:
- [@sudacadev](https://github.com/sudacadev)
- [@agustineze](https://github.com/agustineze)
