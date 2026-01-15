
# Propuesta de Migración: Autenticación JWT con Gestión de Sesiones

**Fecha:** 2025-12-09
**Estado:** Propuesta para Evaluación
**Autor:** Sistema de Autenticación QuiniApp

---

## 📋 Resumen Ejecutivo

Esta propuesta detalla la migración del sistema de autenticación actual (Supabase Auth) a un sistema de autenticación JWT independiente con gestión de sesiones basada en actividad del usuario. El objetivo es obtener mayor control sobre los usuarios, sesiones y políticas de seguridad.

### Objetivos Principales

1. **Independencia de Supabase Auth** - Mantener solo la base de datos PostgreSQL
2. **Control Total de Sesiones** - Gestión de sesiones con TTL y sliding window
3. **Seguridad Mejorada** - Refresh tokens, rotación de tokens, detección de anomalías
4. **Configurabilidad** - Variables de entorno para todos los parámetros de sesión
5. **Trazabilidad** - Registro completo de sesiones y actividad de usuarios

---

## 🔍 Análisis de la Situación Actual

### Arquitectura Actual

```
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │ POST /api/auth/login { username, password }
       │
┌──────▼───────────────────────────────────────────────┐
│  Backend API                                          │
│  1. Valida con Supabase.auth.signInWithPassword()   │
│  2. Consulta tabla users                             │
│  3. Crea 2 cookies:                                  │
│     - access_token (Supabase JWT)                    │
│     - user_token (Custom JWT con user data)          │
└──────────────────────────────────────────────────────┘
```

### Dependencias de Supabase

- ✅ **Base de datos PostgreSQL** - Mantener
- ❌ **Supabase Auth (signInWithPassword)** - Eliminar
- ❌ **Supabase JWT tokens** - Eliminar
- ❌ **Supabase admin.signOut()** - Eliminar

### Problemas Identificados

1. **Doble dependencia de tokens** - `access_token` (Supabase) + `user_token` (Custom)
2. **Sin control de sesiones** - No hay TTL ni expiración real en backend
3. **Sin refresh tokens** - Tokens no se pueden renovar
4. **Passwords en Supabase Auth** - No se gestionan localmente
5. **Sin tracking de sesiones** - No se registran login/logout
6. **Hardcoded cookie config** - No hay variables de entorno para tiempos
7. **Sin sliding sessions** - Sesión no se extiende con actividad

---

## 🎯 Propuesta de Arquitectura de Sesiones

### Modelo de Datos

#### Tabla: `sessions`

```sql
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Tokens
  refresh_token TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL, -- bcrypt hash para validación

  -- Metadatos de sesión
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,

  -- Control de tiempo
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Índices para búsquedas rápidas
  INDEX idx_sessions_user_id (user_id),
  INDEX idx_sessions_refresh_token (refresh_token),
  INDEX idx_sessions_expires_at (expires_at),
  INDEX idx_sessions_is_active (is_active)
);

-- Limpieza automática de sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET is_active = FALSE,
      revoked_at = NOW(),
      revoked_reason = 'expired'
  WHERE expires_at < NOW()
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ejecutar limpieza periódicamente (via pg_cron o llamadas manuales)
```

#### Modificación Tabla: `users`

```sql
ALTER TABLE users
  ADD COLUMN password_hash TEXT NOT NULL,
  ADD COLUMN failed_login_attempts INT DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ,
  ADD COLUMN last_login_at TIMESTAMPTZ,
  ADD COLUMN password_changed_at TIMESTAMPTZ DEFAULT NOW();

-- Eliminar dependencia de Supabase Auth
-- Los usuarios se crearán localmente con bcrypt
```

---

## 🔐 Sistema de Tokens JWT

### Tipos de Tokens

#### 1. Access Token (Corta duración)
- **Propósito:** Acceso a recursos protegidos
- **Duración:** 15 minutos (configurable)
- **Almacenamiento:** Cookie httpOnly
- **Payload:**
```typescript
{
  user_id: string;
  username: string;
  user_type: USER_TYPE;
  session_id: string;
  iat: number;
  exp: number;
  type: 'access';
}
```

#### 2. Refresh Token (Larga duración)
- **Propósito:** Renovar access tokens
- **Duración:** 7 días (configurable)
- **Almacenamiento:**
  - Cookie httpOnly (valor del token)
  - Base de datos (hash bcrypt para validación)
- **Payload:**
```typescript
{
  user_id: string;
  session_id: string;
  iat: number;
  exp: number;
  type: 'refresh';
}
```

### Rotación de Refresh Tokens

Cada vez que se usa un refresh token para obtener un nuevo access token:
1. Se invalida el refresh token anterior
2. Se genera un nuevo refresh token
3. Se actualiza el hash en la base de datos
4. Se detecta uso de tokens ya utilizados (posible ataque)

---

## ⚙️ Variables de Entorno

### Configuración Propuesta

```bash
# =====================================
# JWT Configuration
# =====================================
JWT_SECRET_ACCESS=<256-bit-secret-here>
JWT_SECRET_REFRESH=<256-bit-secret-here-different>

# Access Token Duration (15 minutes default)
JWT_ACCESS_TOKEN_EXPIRATION=15m

# Refresh Token Duration (7 days default)
JWT_REFRESH_TOKEN_EXPIRATION=7d

# =====================================
# Session Management
# =====================================

# Session Activity Timeout (inactividad absoluta)
# Tiempo máximo sin actividad antes de cerrar sesión
# Default: 30 minutes
SESSION_INACTIVITY_TIMEOUT=30m

# Session Sliding Window (tiempo de extensión por actividad)
# Cuánto tiempo se extiende la sesión con cada interacción
# Default: 15 minutes
SESSION_SLIDING_WINDOW=15m

# Session Absolute Timeout (tiempo máximo de sesión)
# Tiempo máximo de una sesión sin importar la actividad
# Default: 8 hours
SESSION_ABSOLUTE_TIMEOUT=8h

# Session Cleanup Interval (limpieza de sesiones expiradas)
# Default: 1 hour
SESSION_CLEANUP_INTERVAL=1h

# =====================================
# Security Configuration
# =====================================

# Maximum failed login attempts before lockout
# Default: 5
MAX_FAILED_LOGIN_ATTEMPTS=5

# Account lockout duration after max failed attempts
# Default: 15 minutes
ACCOUNT_LOCKOUT_DURATION=15m

# Bcrypt rounds for password hashing
# Default: 12 (higher = more secure but slower)
BCRYPT_ROUNDS=12

# Maximum concurrent sessions per user
# Default: 3 (0 = unlimited)
MAX_CONCURRENT_SESSIONS=3

# =====================================
# Cookie Configuration
# =====================================

# Cookie domain (for multi-subdomain support)
COOKIE_DOMAIN=.quiniapp.io

# Cookie secure flag (true in production)
COOKIE_SECURE=true

# Cookie sameSite policy
COOKIE_SAME_SITE=none

# =====================================
# Database Configuration (mantener existentes)
# =====================================
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
# (Solo para PostgreSQL, no para Auth)
```

### Valores por Defecto (en código)

```typescript
// api/src/config/session.config.ts

export const SESSION_CONFIG = {
  // JWT
  JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_TOKEN_EXPIRATION || '15m',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_TOKEN_EXPIRATION || '7d',

  // Session timeouts (en milisegundos)
  INACTIVITY_TIMEOUT: parseTime(process.env.SESSION_INACTIVITY_TIMEOUT || '30m'),
  SLIDING_WINDOW: parseTime(process.env.SESSION_SLIDING_WINDOW || '15m'),
  ABSOLUTE_TIMEOUT: parseTime(process.env.SESSION_ABSOLUTE_TIMEOUT || '8h'),
  CLEANUP_INTERVAL: parseTime(process.env.SESSION_CLEANUP_INTERVAL || '1h'),

  // Security
  MAX_FAILED_ATTEMPTS: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5'),
  LOCKOUT_DURATION: parseTime(process.env.ACCOUNT_LOCKOUT_DURATION || '15m'),
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '3'),

  // Cookies
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || 'none',
};

// Helper para parsear tiempos (15m, 2h, 7d, etc.)
function parseTime(timeStr: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}
```

---

## 🔄 Sliding Sessions (Sesiones Deslizantes)

### Concepto

Una **sliding session** extiende automáticamente el tiempo de expiración con cada actividad del usuario, hasta un límite absoluto.

### Ejemplo de Flujo

```
Usuario inicia sesión a las 10:00 AM
├─ Session expires_at: 10:30 AM (INACTIVITY_TIMEOUT = 30m)
├─ Session absolute_end: 6:00 PM (ABSOLUTE_TIMEOUT = 8h)
│
├─ 10:15 AM - Usuario hace petición
│  ├─ last_activity_at actualizado a 10:15 AM
│  └─ expires_at extendido a 10:45 AM (10:15 + 30m)
│
├─ 10:40 AM - Usuario hace petición
│  ├─ last_activity_at actualizado a 10:40 AM
│  └─ expires_at extendido a 11:10 AM (10:40 + 30m)
│
├─ ... (usuario activo todo el día)
│
├─ 5:45 PM - Usuario hace petición
│  ├─ last_activity_at actualizado a 5:45 PM
│  └─ expires_at = 6:00 PM (no puede exceder absolute_end)
│
└─ 6:00 PM - Sesión expira (ABSOLUTE_TIMEOUT alcanzado)
```

### Implementación

```typescript
// api/src/middlewares/session.middleware.ts

export const updateSessionActivity = async (
  sessionId: string
): Promise<void> => {
  const now = new Date();
  const session = await getSessionById(sessionId);

  if (!session || !session.is_active) {
    throw new Error('Invalid session');
  }

  // Calcular nueva expiración con sliding window
  const newExpiry = new Date(now.getTime() + SESSION_CONFIG.INACTIVITY_TIMEOUT);

  // Respetar absolute timeout
  const absoluteEnd = new Date(
    session.created_at.getTime() + SESSION_CONFIG.ABSOLUTE_TIMEOUT
  );

  const finalExpiry = newExpiry > absoluteEnd ? absoluteEnd : newExpiry;

  // Actualizar sesión
  await updateSession(sessionId, {
    last_activity_at: now,
    expires_at: finalExpiry,
  });
};
```

### Middleware de Sesión

```typescript
// api/src/middlewares/auth.middleware.ts (NUEVO)

export const validateSession: RequestHandler = async (req, res, next) => {
  try {
    const accessToken = req.cookies.access_token;

    if (!accessToken) {
      return res.status(401).json({ error: 'No access token' });
    }

    // Verificar access token
    const decoded = verifyAccessToken(accessToken);

    // Verificar sesión en DB
    const session = await SessionRepository.getById(decoded.session_id);

    if (!session || !session.is_active) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Verificar expiración
    if (new Date() > session.expires_at) {
      await SessionRepository.revoke(session.session_id, 'expired');
      return res.status(401).json({ error: 'Session expired' });
    }

    // Actualizar actividad (sliding session)
    await SessionRepository.updateActivity(session.session_id);

    // Adjuntar usuario a request
    req.user = {
      user_id: decoded.user_id,
      username: decoded.username,
      user_type: decoded.user_type,
      session_id: decoded.session_id,
    };

    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
};
```

---

## 🔒 Flujo de Autenticación Completo

### 1. Login

```typescript
// POST /api/auth/login
{
  username: string;
  password: string;
  remember_me?: boolean; // opcional para sesiones más largas
}
```

**Flujo:**
1. Validar credenciales (username + password hash con bcrypt)
2. Verificar cuenta no bloqueada (`locked_until`)
3. Verificar límite de sesiones concurrentes
4. Crear nueva sesión en tabla `sessions`
5. Generar access token (15m)
6. Generar refresh token (7d)
7. Guardar hash de refresh token en DB
8. Establecer cookies:
   - `access_token` (httpOnly, secure, sameSite)
   - `refresh_token` (httpOnly, secure, sameSite)
9. Actualizar `last_login_at` en tabla `users`
10. Resetear `failed_login_attempts`
11. Retornar datos del usuario

**Respuesta:**
```typescript
{
  user: IUserEntityFront;
  session: {
    session_id: string;
    expires_at: Date;
  }
}
```

### 2. Refresh Token

```typescript
// POST /api/auth/refresh
// (Sin body, lee cookies automáticamente)
```

**Flujo:**
1. Leer `refresh_token` de cookies
2. Verificar JWT del refresh token
3. Buscar sesión en DB por `session_id`
4. Validar hash del refresh token con bcrypt
5. Verificar sesión activa y no expirada
6. **Rotar refresh token** (generar nuevo, invalidar anterior)
7. Generar nuevo access token
8. Actualizar `last_activity_at`
9. Establecer nuevas cookies
10. Detectar reuso de refresh token (posible ataque)

**Detección de Ataque:**
```typescript
// Si un refresh token ya usado es presentado de nuevo:
if (session.refresh_token_hash !== hashedToken) {
  // Posible ataque - revocar TODAS las sesiones del usuario
  await SessionRepository.revokeAllUserSessions(
    user_id,
    'suspicious_activity'
  );
  throw new Error('Token reuse detected');
}
```

### 3. Logout

```typescript
// POST /api/private/auth/logout
{
  logout_all?: boolean; // cerrar todas las sesiones
}
```

**Flujo:**
1. Obtener `session_id` del access token
2. Marcar sesión como inactiva (`is_active = false`)
3. Registrar `revoked_at` y `revoked_reason = 'user_logout'`
4. Si `logout_all = true`, revocar todas las sesiones del usuario
5. Limpiar cookies

### 4. Validación de Sesión

```typescript
// GET /api/private/auth/validate
```

**Flujo:**
1. Middleware `validateSession` ejecuta automáticamente
2. Actualiza `last_activity_at` (sliding session)
3. Retorna datos de usuario y sesión

---

## 🛡️ Seguridad

### 1. Password Hashing

```typescript
import bcrypt from 'bcrypt';

// Crear usuario
const passwordHash = await bcrypt.hash(password, SESSION_CONFIG.BCRYPT_ROUNDS);

// Validar login
const isValid = await bcrypt.compare(password, user.password_hash);
```

### 2. Protección contra Brute Force

```typescript
// En login, si falla:
await UserRepository.incrementFailedAttempts(username);

if (user.failed_login_attempts >= SESSION_CONFIG.MAX_FAILED_ATTEMPTS) {
  const lockUntil = new Date(Date.now() + SESSION_CONFIG.LOCKOUT_DURATION);
  await UserRepository.lockAccount(user.user_id, lockUntil);
  throw new Error('Account locked due to multiple failed attempts');
}

// En login exitoso:
await UserRepository.resetFailedAttempts(user.user_id);
```

### 3. Sesiones Concurrentes

```typescript
// Al crear nueva sesión:
const activeSessions = await SessionRepository.countActiveSessions(user_id);

if (activeSessions >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
  // Revocar la sesión más antigua
  await SessionRepository.revokeOldestSession(user_id);
}
```

### 4. CSRF Protection

```typescript
// Usar tokens CSRF para formularios
import { doubleCsrf } from 'csrf-csrf';

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  },
});

app.use(doubleCsrfProtection);
```

### 5. Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: 'Too many login attempts, please try again later',
});

router.post('/login', loginLimiter, loginHandler);
```

---

## 📊 Monitoring y Auditoría

### Tabla de Auditoría

```sql
CREATE TABLE auth_audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  session_id UUID REFERENCES sessions(session_id),

  event_type TEXT NOT NULL, -- login, logout, refresh, failed_login, etc.
  ip_address INET,
  user_agent TEXT,

  success BOOLEAN NOT NULL,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_audit_user_id (user_id),
  INDEX idx_audit_event_type (event_type),
  INDEX idx_audit_created_at (created_at)
);
```

### Eventos a Registrar

- ✅ Login exitoso / fallido
- ✅ Logout (user / automatic)
- ✅ Refresh token usado
- ✅ Token reuse detectado
- ✅ Cuenta bloqueada
- ✅ Sesión expirada
- ✅ Cambio de contraseña

---

## 🚀 Plan de Migración

### Fase 1: Preparación (Sin Breaking Changes)

1. ✅ Crear tablas `sessions` y `auth_audit_log`
2. ✅ Agregar columnas a tabla `users` (`password_hash`, etc.)
3. ✅ Implementar `SessionRepository` y `SessionController`
4. ✅ Implementar nuevos helpers JWT (access + refresh)
5. ✅ Crear configuración de sesiones (`session.config.ts`)
6. ✅ Implementar bcrypt para passwords
7. ✅ Agregar variables de entorno

### Fase 2: Implementación Backend (Modo Dual)

8. ✅ Crear nuevo endpoint `POST /api/auth/login-v2` (JWT puro)
9. ✅ Crear nuevo endpoint `POST /api/auth/refresh`
10. ✅ Crear nuevo middleware `validateSession`
11. ✅ Implementar limpieza automática de sesiones
12. ✅ Migrar passwords de usuarios existentes:
    - Script para copiar users de Supabase Auth a local
    - Forzar cambio de contraseña en primer login
13. ✅ Testing exhaustivo de nuevos endpoints

### Fase 3: Migración Frontend

14. ✅ Actualizar AuthProvider para usar nuevos endpoints
15. ✅ Implementar refresh token automático
16. ✅ Implementar detección de sesión expirada
17. ✅ Testing de flujos completos

### Fase 4: Deprecación de Supabase Auth

18. ✅ Cambiar `/api/auth/login` a usar lógica nueva
19. ✅ Eliminar dependencias de `supabase.auth.*`
20. ✅ Eliminar cookies `access_token` (Supabase)
21. ✅ Mantener solo `access_token` y `refresh_token` (nuevos JWT)
22. ✅ Eliminar variables de entorno de Supabase Auth

### Fase 5: Limpieza Final

23. ✅ Eliminar código legacy de Supabase Auth
24. ✅ Actualizar documentación
25. ✅ Actualizar CHANGELOGs
26. ✅ Monitoreo post-migración

---

## 🧪 Testing

### Unit Tests

```typescript
describe('SessionService', () => {
  it('should create session with correct expiration', async () => {
    const session = await SessionService.create(userId);
    expect(session.expires_at).toBeGreaterThan(new Date());
  });

  it('should update activity and extend expiration', async () => {
    const session = await SessionService.create(userId);
    const originalExpiry = session.expires_at;

    await delay(1000);
    await SessionService.updateActivity(session.session_id);

    const updated = await SessionService.getById(session.session_id);
    expect(updated.expires_at).toBeGreaterThan(originalExpiry);
  });

  it('should not exceed absolute timeout', async () => {
    const session = await SessionService.create(userId);
    const absoluteEnd = new Date(
      session.created_at.getTime() + SESSION_CONFIG.ABSOLUTE_TIMEOUT
    );

    // Simular múltiples actualizaciones
    for (let i = 0; i < 100; i++) {
      await SessionService.updateActivity(session.session_id);
    }

    const updated = await SessionService.getById(session.session_id);
    expect(updated.expires_at).toBeLessThanOrEqual(absoluteEnd);
  });
});
```

### Integration Tests

```typescript
describe('Auth Flow', () => {
  it('should login and create session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.user).toBeDefined();
  });

  it('should refresh access token', async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    const cookies = loginRes.headers['set-cookie'];

    // Refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.headers['set-cookie']).toBeDefined();
  });

  it('should detect refresh token reuse', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });

    const cookies = loginRes.headers['set-cookie'];

    // First refresh (válido)
    await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    // Second refresh con mismo token (ataque)
    const reusedRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);

    expect(reusedRes.status).toBe(401);
    expect(reusedRes.body.error).toContain('Token reuse');
  });
});
```

---

## 📈 Métricas y Monitoreo

### KPIs de Sesiones

- **Total de sesiones activas**
- **Promedio de duración de sesión**
- **Sesiones expiradas por inactividad vs. logout manual**
- **Intentos de login fallidos (por usuario, global)**
- **Cuentas bloqueadas**
- **Refresh tokens utilizados**
- **Detecciones de ataques (token reuse)**

### Queries Útiles

```sql
-- Sesiones activas por usuario
SELECT
  u.username,
  COUNT(*) as active_sessions,
  MAX(s.last_activity_at) as last_activity
FROM sessions s
JOIN users u ON s.user_id = u.user_id
WHERE s.is_active = TRUE
GROUP BY u.user_id, u.username
ORDER BY active_sessions DESC;

-- Sesiones próximas a expirar (próximos 5 minutos)
SELECT
  u.username,
  s.session_id,
  s.expires_at,
  (s.expires_at - NOW()) as time_remaining
FROM sessions s
JOIN users u ON s.user_id = u.user_id
WHERE s.is_active = TRUE
  AND s.expires_at <= NOW() + INTERVAL '5 minutes'
ORDER BY s.expires_at ASC;

-- Intentos de login fallidos recientes
SELECT
  user_id,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt
FROM auth_audit_log
WHERE event_type = 'failed_login'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) >= 3;
```

---

## ✅ Checklist de Implementación

### Backend

- [ ] Crear tabla `sessions`
- [ ] Crear tabla `auth_audit_log`
- [ ] Modificar tabla `users` (agregar `password_hash`, etc.)
- [ ] Implementar `SessionRepository`
- [ ] Implementar `SessionController`
- [ ] Crear `session.config.ts` con valores por defecto
- [ ] Implementar helpers JWT (access + refresh)
- [ ] Implementar bcrypt para passwords
- [ ] Crear middleware `validateSession`
- [ ] Implementar sliding sessions
- [ ] Implementar rotación de refresh tokens
- [ ] Implementar detección de token reuse
- [ ] Implementar rate limiting en `/login`
- [ ] Implementar protección brute force
- [ ] Implementar limpieza automática de sesiones
- [ ] Implementar auditoría de eventos
- [ ] Crear script de migración de passwords
- [ ] Unit tests
- [ ] Integration tests

### Frontend

- [ ] Actualizar `AuthProvider` para nuevos endpoints
- [ ] Implementar auto-refresh de access token
- [ ] Implementar detección de sesión expirada
- [ ] Mostrar tiempo restante de sesión (opcional)
- [ ] Implementar logout de todas las sesiones
- [ ] Testing E2E

### DevOps

- [ ] Agregar variables de entorno en producción
- [ ] Configurar secretos JWT en entornos
- [ ] Configurar pg_cron para limpieza de sesiones (opcional)
- [ ] Configurar monitoreo de sesiones activas
- [ ] Configurar alertas (cuentas bloqueadas, ataques)

### Documentación

- [ ] Actualizar `api/CHANGELOG.md`
- [ ] Actualizar `web/CHANGELOG.md`
- [ ] Documentar endpoints de autenticación
- [ ] Documentar flujo de refresh token
- [ ] Crear guía de troubleshooting

---

## 🔮 Futuras Mejoras

### Corto Plazo

1. **Multi-Factor Authentication (MFA)**
   - TOTP (Google Authenticator, Authy)
   - SMS / Email verification

2. **Gestión de Dispositivos**
   - Ver dispositivos activos
   - Revocar sesiones por dispositivo

3. **Notificaciones de Seguridad**
   - Login desde nueva ubicación
   - Cambio de contraseña
   - Sesiones revocadas

### Mediano Plazo

4. **OAuth2 / Social Login** (opcional)
   - Google, Facebook, etc.
   - Solo si hay necesidad de negocio

5. **Roles y Permisos Granulares**
   - RBAC (Role-Based Access Control)
   - Permissions por endpoint

6. **Geolocalización y Anomalías**
   - Detectar login desde países inusuales
   - Detectar cambios bruscos de IP

---

## 📚 Referencias y Recursos

### Estándares y Best Practices

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [RFC 7519 - JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
- [NIST Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)

### Librerías Recomendadas

- `jsonwebtoken` - JWT signing/verification
- `bcrypt` - Password hashing
- `express-rate-limit` - Rate limiting
- `csrf-csrf` - CSRF protection
- `helmet` - Security headers

---

## 🎓 Conclusión

Esta propuesta ofrece un sistema de autenticación robusto, seguro y totalmente controlado, eliminando la dependencia de Supabase Auth mientras mantiene la base de datos PostgreSQL.

Las **sesiones deslizantes** proporcionan una experiencia de usuario fluida, manteniendo la sesión activa mientras el usuario interactúa, pero cerrándola automáticamente tras inactividad.

La arquitectura propuesta sigue **mejores prácticas de seguridad** (OWASP, NIST) y permite **configurabilidad completa** mediante variables de entorno.

### Próximos Pasos Sugeridos

1. **Revisar y validar** esta propuesta con el equipo
2. **Definir valores definitivos** para variables de entorno
3. **Priorizar fases** de implementación
4. **Iniciar Fase 1** (preparación sin breaking changes)

---

**¿Preguntas o ajustes necesarios?** Este documento es base para discusión y puede ajustarse según necesidades específicas del proyecto.
