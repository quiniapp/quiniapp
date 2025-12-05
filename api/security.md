# QuiniApp API - Auditoría de Seguridad

**Fecha:** 2025-11-30
**Auditoría realizada por:** Claude (Sonnet 4.5)
**Archivos analizados:** Todo el workspace api/src/
**Metodología:** Análisis estático de código + OWASP Top 10 2021

---

## RESUMEN EJECUTIVO

Auditoría exhaustiva del código del workspace API. Se identificaron **24 vulnerabilidades de seguridad**:

- **3 CRÍTICAS** - Requieren atención inmediata
- **8 HIGH** - Deben abordarse en 2 semanas
- **9 MEDIUM** - Abordar en el próximo mes
- **4 LOW** - Mejoras de calidad

**Nivel de Riesgo General: ALTO**

### Vulnerabilidades por Categoría

| Categoría | Críticas | High | Medium | Low | Total |
|-----------|----------|------|--------|-----|-------|
| Auth & Authorization | 2 | 4 | 2 | 0 | 8 |
| Input Validation | 1 | 1 | 3 | 0 | 5 |
| Information Disclosure | 1 | 1 | 3 | 2 | 7 |
| Configuration | 0 | 2 | 2 | 2 | 6 |
| **TOTAL** | **3** | **8** | **9** | **4** | **24** |

---

## VULNERABILIDADES CRÍTICAS

### 1. Sistema de Autenticación con Doble Token Inconsistente

**Archivos:**
- `api/src/middlewares/auth.middleware.ts:14-52`
- `api/src/auth/route/auth.route.ts`

**Severidad:** ⚠️ CRÍTICO
**OWASP:** A07:2021 - Identification and Authentication Failures

**Problema:**
El sistema usa DOS tokens simultáneamente pero solo valida uno:

```typescript
// api/src/middlewares/auth.middleware.ts:14-52
export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authToken = req.cookies.access_token;  // Token de Supabase
  const userToken = req.cookies.user_token;    // Token personalizado

  if (!authToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No access token' });
  }

  try {
    // ⚠️ PROBLEMA: Solo valida userToken, NUNCA valida authToken
    const userDecoded = verifyUserToken(userToken);

    req.user = {
      user: userDecoded,
      token: authToken,  // ⚠️ Almacena token SIN validar
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};
```

**Impacto:**
- ⚠️ **Bypass de autenticación** - Atacante puede proporcionar cualquier `access_token` + un `user_token` válido
- Sin correlación entre ambos tokens
- No hay verificación con Supabase
- Potencial escalada de privilegios

**Solución:**
```typescript
export const isAuthenticated = async (req, res, next) => {
  const accessToken = req.cookies.access_token;
  const userToken = req.cookies.user_token;

  if (!accessToken || !userToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Verificar token de Supabase
    const { data: { user: supabaseUser }, error: supabaseError } =
      await supabase.auth.getUser(accessToken);

    if (supabaseError || !supabaseUser) {
      throw new Error('Invalid Supabase token');
    }

    // 2. Verificar JWT personalizado
    const userDecoded = verifyUserToken(userToken);

    // 3. Verificar que ambos tokens coinciden
    if (userDecoded.user_id !== supabaseUser.id) {
      throw new Error('Token mismatch');
    }

    req.user = { user: userDecoded, token: accessToken };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
```

---

### 2. JWT Sin Expiración y Configuración Débil

**Archivo:** `api/src/helper/JWT.ts:3-12`
**Severidad:** ⚠️ CRÍTICO
**OWASP:** A02:2021 - Cryptographic Failures

**Problema:**
```typescript
// api/src/helper/JWT.ts
export const signUserToken = (payload: IUserEntityFront, options?: SignOptions): string => {
  return jwt.sign(payload, JWT_SECRET_USER, options);
};
```

**Problemas identificados:**
1. ❌ Sin tiempo de expiración por defecto
2. ❌ Sin especificación de algoritmo (vulnerable a ataques de confusión)
3. ❌ Payload incluye datos sensibles sin filtrar
4. ❌ Sin mecanismo de revocación de tokens
5. ❌ Tokens robados válidos indefinidamente

**Impacto:**
- Tokens robados nunca expiran
- Vulnerable a ataques de confusión de algoritmo (alg=none)
- No se puede revocar acceso de usuarios comprometidos

**Solución:**
```typescript
const JWT_ALGORITHM = 'HS256';
const TOKEN_EXPIRY = '3h';

export const signUserToken = (payload: IUserEntityFront): string => {
  // Filtrar payload - solo datos necesarios
  const safePayload = {
    user_id: payload.user_id,
    username: payload.username,
    user_type: payload.user_type,
    // NO incluir: balance, email, password hash, etc.
  };

  return jwt.sign(safePayload, JWT_SECRET_USER, {
    algorithm: JWT_ALGORITHM,
    expiresIn: TOKEN_EXPIRY,
    issuer: 'quiniapp-api',
    audience: 'quiniapp-web',
  });
};

export const verifyUserToken = (token: string): IUserEntityFront => {
  return jwt.verify(token, JWT_SECRET_USER, {
    algorithms: [JWT_ALGORITHM],
    issuer: 'quiniapp-api',
    audience: 'quiniapp-web',
  }) as IUserEntityFront;
};
```

---

### 3. Logging de Passwords y Credenciales

**Archivos:** Múltiples controladores
**Severidad:** ⚠️ CRÍTICO
**OWASP:** A09:2021 - Security Logging and Monitoring Failures

**Problema:**
```typescript
// api/src/auth/route/auth.route.ts
const { username, password } = req.body;
console.log('Login attempt:', { username, password });  // ⚠️ Password en logs

// También en catch blocks:
catch (error) {
  console.error('Error:', error);  // ⚠️ Puede incluir req.body completo
}
```

**Impacto:**
- Passwords almacenadas en logs de aplicación
- Credenciales expuestas si logs comprometidos
- Violación de regulaciones (GDPR, protección de datos)

**Solución:**
```typescript
// Función de sanitización
const sanitizeForLog = (obj: any): any => {
  const sensitive = ['password', 'token', 'secret', 'authorization'];
  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
};

// Uso:
console.log('Login attempt:', sanitizeForLog({ username, password }));
// Output: Login attempt: { username: 'user123', password: '[REDACTED]' }
```

---

## VULNERABILIDADES HIGH

### 4. Sin Rate Limiting

**Archivo:** `api/src/index.ts`
**Severidad:** 🔴 HIGH
**OWASP:** A01:2021 - Broken Access Control

**Problema:**
No existe ningún middleware de rate limiting configurado en toda la aplicación.

**Impacto:**
- Ataques de fuerza bruta en `/api/auth/login`
- Credential stuffing
- DoS/DDoS application-level
- Abuso de API (scraping, data extraction)

**Solución:**
```typescript
// api/src/index.ts
import rateLimit from 'express-rate-limit';

// Rate limiter global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para autenticación (más estricto)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true, // No cuenta logins exitosos
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
```

---

### 5. Sin Protección CSRF

**Archivo:** `api/src/index.ts`
**Severidad:** 🔴 HIGH
**OWASP:** A01:2021 - Broken Access Control

**Problema:**
```typescript
const corsMiddleware = cors({
  credentials: true,  // ✓ Permite cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // ⚠️ Pero SIN tokens CSRF
});
```

**Impacto:**
Atacante puede forjar requests desde navegador de víctima para:
- Crear/eliminar tickets
- Modificar usuarios
- Actualizar balances de cuenta corriente
- Cambiar configuraciones

**Solución:**
```typescript
import csrf from 'csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  }
});

// Aplicar a rutas que modifican estado
app.use('/api/private', csrfProtection);

// Endpoint para obtener token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

---

### 6. Headers de Seguridad Ausentes

**Archivo:** `api/src/index.ts`
**Severidad:** 🔴 HIGH
**OWASP:** A05:2021 - Security Misconfiguration

**Problema:**
No se configura Helmet ni headers de seguridad manuales.

**Headers faltantes:**
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security
- Content-Security-Policy
- Referrer-Policy

**Solución:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

### 7. Verificación de Autorización Insuficiente (IDOR)

**Archivo:** `api/src/bet/route/bet.routes.ts:218-265`
**Severidad:** 🔴 HIGH
**OWASP:** A01:2021 - Broken Access Control (IDOR)

**Problema:**
```typescript
// api/src/bet/route/bet.routes.ts:218
private getAmountsByTicket: RequestHandler = async (req, res) => {
  const { ticket_number } = req.query;

  //TODO : add cashir id to cashier only can see its own ticket
  // const { user } = req;  // ⚠️ Comentado!

  // ⚠️ Retorna totales del ticket SIN verificar ownership
  const total = await this.controller.getAmountsByTicket({
    ticket_number: ticket_number as string
  });

  return res.json({ total });
};
```

**Impacto:**
- Cualquier usuario autenticado puede ver datos financieros de CUALQUIER ticket
- CASHIER puede ver tickets de otros cajeros
- Violación de privacidad de datos
- Potencial fraude

**Solución:**
```typescript
private getAmountsByTicket: RequestHandler = async (req, res) => {
  const { ticket_number } = req.query;
  const { user } = req;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verificar ownership
  const ticket = await this.ticketController.getTicketByNumber(ticket_number);

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // Solo permitir si:
  // - Es ADMIN
  // - Es el CASHIER que creó el ticket
  const canAccess =
    user.user_type === 'ADMIN' ||
    (user.user_type === 'CASHIER' && ticket.cashier_id === user.user_id);

  if (!canAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const total = await this.controller.getAmountsByTicket({ ticket_number });
  return res.json({ total });
};
```

**También afecta:**
- `api/src/ticket/route/ticket.route.ts:96-143` - getTicketByNumber
- `api/src/user/route/user.route.ts:95-158` - getUserById

---

### 8. Validación de Entrada Deshabilitada

**Archivo:** `api/src/user/route/user.route.ts:50-62`
**Severidad:** 🔴 HIGH
**OWASP:** A03:2021 - Injection

**Problema:**
```typescript
// api/src/user/route/user.route.ts:50
/*
const result = UserSchema.safeParse(newUser);
if (!result.success) {
  return res.status(400).json({
    error: 'Validation error',
    details: result.error
  });
}
*/

// ⚠️ Validación Zod COMPLETAMENTE deshabilitada
try {
  const user = await this.controller.create(newUser);  // Sin validación!
  return res.status(201).json({ user });
```

**Impacto:**
- Datos malformados en base de datos
- Passwords débiles permitidas
- Payloads XSS en username/name
- Errores de BD por tipos incorrectos
- Bypass de reglas de negocio

**Solución:**
```typescript
// Habilitar validación
const result = UserSchema.safeParse(newUser);

if (!result.success) {
  return res.status(400).json({
    error: 'Validation error',
    details: result.error.flatten()
  });
}

const user = await this.controller.create(result.data);
return res.status(201).json({ user });
```

---

### 9. Configuración de Cookies Insegura

**Archivo:** `api/src/auth/route/auth.route.ts:53-82`
**Severidad:** 🔴 HIGH

**Problema:**
```typescript
res.cookie('access_token', access_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DURATION_MS,
  // ⚠️ Falta: sameSite
});
```

**Impacto:**
- Vulnerable a CSRF
- Cookies enviadas en requests cross-site

**Solución:**
```typescript
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: SESSION_DURATION_MS,
  path: '/',
};

res.cookie('access_token', access_token, cookieOptions);
res.cookie('user_token', user_token, cookieOptions);
```

---

### 10. Logout Incompleto

**Archivo:** `api/src/auth/route/auth.route.ts:103-119`
**Severidad:** 🔴 HIGH

**Problema:**
```typescript
// Solo limpia cookies del cliente
res.clearCookie('access_token');
res.clearCookie('user_token');

// ⚠️ Tokens siguen siendo válidos en servidor
// ⚠️ Si alguien interceptó el token, puede seguir usándolo
```

**Impacto:**
- Tokens robados siguen válidos después de logout
- No se puede revocar acceso

**Solución (con Redis):**
```typescript
import Redis from 'ioredis';
const redis = new Redis();

// En logout:
const token = req.cookies.user_token;
const decoded = jwt.decode(token);

// Blacklist token hasta su expiración natural
const ttl = decoded.exp - Math.floor(Date.now() / 1000);
await redis.setex(`blacklist:${token}`, ttl, '1');

res.clearCookie('access_token');
res.clearCookie('user_token');

// En middleware de auth:
const isBlacklisted = await redis.exists(`blacklist:${userToken}`);
if (isBlacklisted) {
  return res.status(401).json({ error: 'Token revoked' });
}
```

---

### 11. Reset de Password Inseguro

**Archivo:** `api/src/user/route/user.route.ts:219-247`
**Severidad:** 🔴 HIGH

**Problema:**
```typescript
// Sin verificación de token de reset
// Sin rate limiting
// Sin expiración de reset tokens
const { user_id } = req.body;
const { password } = req.body;

await this.controller.updatePassword({ user_id, password });
```

**Impacto:**
- Cualquiera puede resetear password de cualquier usuario conociendo el user_id
- Sin confirmación de email
- Sin verificación de identidad

**Solución:**
Implementar flujo completo de reset:
1. Generar token único con expiración
2. Enviar email con link
3. Verificar token antes de permitir cambio
4. Rate limiting en solicitud de reset

---

## VULNERABILIDADES MEDIUM

### 12. Mensajes de Error Verbosos

**Severidad:** 🟡 MEDIUM
**OWASP:** A04:2021 - Insecure Design

**Problema:**
```typescript
catch (error) {
  return res.status(500).json({
    error: error.message,  // ⚠️ Expone detalles internos
    stack: error.stack,    // ⚠️ Stack trace en producción
  });
}
```

**Solución:**
```typescript
catch (error) {
  console.error('Internal error:', error); // Log completo internamente

  return res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message,
  });
}
```

---

### 13. Sin Sanitización XSS

**Severidad:** 🟡 MEDIUM

**Problema:**
No hay sanitización de inputs que se almacenan en BD (username, name, etc.)

**Solución:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};
```

---

### 14-20. Otras Vulnerabilidades Medium

14. **Mass Assignment** - Actualización de campos sin whitelist
15. **Redirects No Validados** - En código comentado
16. **Ventana de Eliminación Insuficiente** - Solo 2 minutos para cajeros
17. **Sin Límites de Tamaño de Request** - 5MB permite DoS
18. **Lógica de Validación Comentada** - Crítica pero deshabilitada
19. **Códigos de Estado HTTP Inconsistentes**
20. **Sin Timeout en Requests**

---

## VULNERABILIDADES LOW

### 21. Console Logging en Producción

**Severidad:** 🟢 LOW

**Problema:**
61+ ocurrencias de `console.log`, `console.error` en código de producción.

**Solución:**
Implementar sistema de logging estructurado:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

---

### 22-24. Otras Vulnerabilidades Low

22. **Sin Validación de Variables de Entorno**
23. **Sin Versionado de API**
24. **Falta Documentación API** (Swagger/OpenAPI)

---

## HALLAZGOS POSITIVOS ✅

- ✅ Usa Supabase ORM (previene SQL Injection)
- ✅ Todas las queries parametrizadas
- ✅ Sin concatenación de strings en queries
- ✅ RPCs llamadas con objetos de parámetros
- ✅ Stack moderno (TypeScript, Express, Zod)
- ✅ Separación de rutas públicas y privadas
- ✅ Middleware de autenticación existe (aunque con issues)
- ✅ Schemas de validación Zod definidos (aunque deshabilitados)

---

## ANÁLISIS PERFORMANCE VS SEGURIDAD

| Fix | Impacto Seguridad | Overhead Performance | Recomendación |
|-----|-------------------|---------------------|---------------|
| Rate Limiting | ⚠️ Alto | <5ms/request | ✅ **IMPLEMENTAR** |
| Validación Zod | ⚠️ Alto | 1-3ms | ✅ **IMPLEMENTAR** (ya existe) |
| CSRF Tokens | ⚠️ Alto | ~2ms + request extra | ✅ **IMPLEMENTAR** |
| Security Headers | ⚠️ Alto | <1ms | ✅ **IMPLEMENTAR** |
| Token Blacklist (Redis) | 🟡 Medio | 5-10ms | ⚠️ Considerar con TTLs cortos |
| Validación Supabase | ⚠️ Alto | 20-50ms | ✅ **IMPLEMENTAR** con caché |
| Input Sanitization | 🟡 Medio | 2-5ms | ✅ **IMPLEMENTAR** |
| Logging Estructurado | 🟢 Bajo | 1-3ms | ✅ **IMPLEMENTAR** |

**Optimización recomendada:**
Cachear tokens Supabase válidos por 5 minutos para reducir overhead de 50ms a <1ms en requests subsecuentes.

```typescript
import NodeCache from 'node-cache';
const tokenCache = new NodeCache({ stdTTL: 300 }); // 5 min

const validateSupabaseToken = async (token: string) => {
  const cached = tokenCache.get(token);
  if (cached) return cached;

  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    tokenCache.set(token, data.user);
    return data.user;
  }

  throw new Error('Invalid token');
};
```

---

## PLAN DE REMEDIACIÓN PRIORIZADO

### Fase 1: Fixes Críticos (Semana 1) - 16-24h

**Prioridad:** ⚠️ INMEDIATO

1. **Arreglar implementación JWT** (4h)
   - Agregar expiración
   - Especificar algoritmo
   - Filtrar payload

2. **Validar tokens Supabase en middleware** (6h)
   - Implementar verificación dual
   - Correlacionar tokens
   - Agregar caché

3. **Remover logging de passwords** (2h)
   - Sanitizar logs
   - Auditar todos los console.log

4. **Implementar rate limiting** (3h)
   - Global limiter
   - Auth limiter específico

5. **Habilitar validación de inputs** (3h)
   - Descomentar validaciones Zod
   - Verificar todos los endpoints

**Esfuerzo:** 18 horas
**Impacto:** Elimina 3 vulnerabilidades CRÍTICAS

---

### Fase 2: Prioridad Alta (Semana 2) - 24-32h

**Prioridad:** 🔴 URGENTE

6. **Agregar protección CSRF** (4h)
7. **Implementar security headers (Helmet)** (2h)
8. **Arreglar checks de autorización** (8h)
   - Implementar RBAC consistente
   - Verificar ownership en todos los endpoints
9. **Sanitización de inputs** (6h)
10. **Arreglar seguridad de cookies** (3h)

**Esfuerzo:** 23 horas
**Impacto:** Elimina 5 vulnerabilidades HIGH

---

### Fase 3: Prioridad Media (Semanas 3-4) - 20-28h

11. Mensajes de error sanitizados
12. Implementar logging estructurado (Winston)
13. Arreglar IDOR en todos los endpoints
14. Mass assignment protection
15. Límites de tamaño de request

**Esfuerzo:** 24 horas
**Impacto:** Elimina 9 vulnerabilidades MEDIUM

---

### Fase 4: Baja Prioridad (Ongoing) - 16-24h

16. Versionado de API
17. Documentación OpenAPI/Swagger
18. Validación de variables de entorno
19. Code review process
20. Dependency audit automatizado

**Esfuerzo:** 20 horas

---

**Esfuerzo Total Estimado:** 80-100 horas de desarrollo

---

## CHECKLIST DE SEGURIDAD PARA DESARROLLO FUTURO

### Para cada nuevo endpoint:

- [ ] **Autenticación:** ¿Requiere auth? Middleware aplicado?
- [ ] **Autorización:** ¿Verifica ownership/permisos?
- [ ] **Validación de Input:** Schema Zod implementado y habilitado?
- [ ] **Rate Limiting:** Configurado apropiadamente?
- [ ] **Logging:** Sin datos sensibles en logs?
- [ ] **Status Codes:** HTTP codes apropiados (200, 401, 403, 404, 500)?
- [ ] **Mensajes de Error:** Sanitizados (no exponen internals)?
- [ ] **CSRF:** Protección habilitada si modifica estado?
- [ ] **Tests:** Incluyen escenarios de seguridad?

### Code Review Checklist:

- [ ] No hay passwords/secrets hardcodeados
- [ ] Queries son parametrizadas (no string concatenation)
- [ ] Sin eval() o ejecución dinámica de código
- [ ] Validación en backend (nunca confiar solo en frontend)
- [ ] Manejo de errores no expone stack traces
- [ ] Logs no contienen información sensible

---

## CÓDIGO DE EJEMPLO - IMPLEMENTACIÓN COMPLETA

### Middleware de Autenticación Seguro

```typescript
// api/src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '@/config/supabase';
import { verifyUserToken } from '@/helper/JWT';
import NodeCache from 'node-cache';

const tokenCache = new NodeCache({ stdTTL: 300 }); // 5 min cache

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accessToken = req.cookies.access_token;
  const userToken = req.cookies.user_token;

  if (!accessToken || !userToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authentication tokens'
    });
  }

  try {
    // 1. Verificar token de Supabase (con caché)
    let supabaseUser = tokenCache.get(accessToken);

    if (!supabaseUser) {
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error || !data.user) {
        throw new Error('Invalid Supabase token');
      }

      supabaseUser = data.user;
      tokenCache.set(accessToken, supabaseUser);
    }

    // 2. Verificar JWT personalizado
    const userDecoded = verifyUserToken(userToken);

    // 3. Verificar que ambos tokens coinciden
    if (userDecoded.user_id !== supabaseUser.id) {
      throw new Error('Token mismatch');
    }

    // 4. Verificar que el token no está en blacklist (si se implementa)
    // const isBlacklisted = await redis.exists(`blacklist:${userToken}`);
    // if (isBlacklisted) throw new Error('Token revoked');

    req.user = {
      user: userDecoded,
      token: accessToken,
    };

    next();
  } catch (error) {
    console.error('Auth error:', sanitizeForLog(error));

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
};

// Función auxiliar para sanitizar logs
const sanitizeForLog = (error: any): any => {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return error;
};
```

### Helper JWT Seguro

```typescript
// api/src/helper/JWT.ts
import jwt, { SignOptions } from 'jsonwebtoken';
import { IUserEntityFront } from '@helper/entities/user.entity';

const JWT_SECRET_USER = process.env.JWT_SECRET_USER!;
const JWT_ALGORITHM = 'HS256';
const TOKEN_EXPIRY = '3h';

export const signUserToken = (payload: IUserEntityFront): string => {
  // Filtrar payload - solo incluir datos necesarios
  const safePayload = {
    user_id: payload.user_id,
    username: payload.username,
    user_type: payload.user_type,
    user_number: payload.user_number,
    // NO incluir: balance, email, password, etc.
  };

  return jwt.sign(safePayload, JWT_SECRET_USER, {
    algorithm: JWT_ALGORITHM,
    expiresIn: TOKEN_EXPIRY,
    issuer: 'quiniapp-api',
    audience: 'quiniapp-web',
  });
};

export const verifyUserToken = (token: string): IUserEntityFront => {
  return jwt.verify(token, JWT_SECRET_USER, {
    algorithms: [JWT_ALGORITHM],
    issuer: 'quiniapp-api',
    audience: 'quiniapp-web',
  }) as IUserEntityFront;
};
```

### Configuración de Seguridad Completa

```typescript
// api/src/index.ts
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

// 1. Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// 2. Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts',
  skipSuccessfulRequests: true,
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);

// 3. CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

// 4. Body Parser con límites
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Cookie Parser
app.use(cookieParser());

// Resto de la configuración...
```

---

## DEPENDENCIAS RECOMENDADAS

```bash
# Instalar dependencias de seguridad
npm install helmet express-rate-limit node-cache winston

# Opcional para CSRF (si se implementa)
npm install csurf

# Opcional para sanitización
npm install isomorphic-dompurify

# Opcional para token blacklist
npm install ioredis
```

---

## TESTING DE SEGURIDAD

### Tests Automatizados

```typescript
// api/src/__tests__/security.test.ts
describe('Security Tests', () => {
  describe('Authentication', () => {
    it('should reject requests without tokens', async () => {
      const res = await request(app)
        .get('/api/private/users')
        .expect(401);

      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject mismatched tokens', async () => {
      // Test token mismatch scenario
    });

    it('should reject expired tokens', async () => {
      // Test expired token scenario
    });
  });

  describe('Rate Limiting', () => {
    it('should block after 5 failed login attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ username: 'test', password: 'wrong' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'wrong' })
        .expect(429);
    });
  });

  describe('Authorization', () => {
    it('should prevent cashier from seeing other tickets', async () => {
      // Test IDOR scenario
    });
  });
});
```

---

## MONITOREO Y ALERTAS

### Configurar Alertas

```typescript
// api/src/monitoring/security-alerts.ts
import winston from 'winston';

export const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'security.log',
      level: 'warn'
    }),
  ],
});

// Alertar en eventos sospechosos
export const logSuspiciousActivity = (event: string, details: any) => {
  securityLogger.warn('Suspicious activity detected', {
    event,
    details: sanitizeForLog(details),
    timestamp: new Date().toISOString(),
  });

  // TODO: Integrar con servicio de alertas (email, Slack, etc.)
};

// Uso:
if (failedLoginAttempts > 3) {
  logSuspiciousActivity('multiple_failed_logins', { username, ip });
}
```

---

## CONCLUSIONES Y PRÓXIMOS PASOS

### Fortalezas

✅ Stack moderno y bien estructurado
✅ ORM previene SQL Injection
✅ Arquitectura de middleware establecida
✅ Schemas de validación ya definidos

### Debilidades Críticas

⚠️ Autenticación (validación dual insuficiente)
⚠️ Autorización (checks de ownership faltantes)
⚠️ Validación (comentada/deshabilitada)
⚠️ Middleware protectivo (sin rate limiting, CSRF, headers)

### Recomendaciones Inmediatas

1. **ESTA SEMANA** - Implementar Fase 1 (Fixes Críticos)
2. **PRÓXIMAS 2 SEMANAS** - Implementar Fase 2 (High Priority)
3. **ESTE MES** - Testing de penetración por profesional
4. **ONGOING** - Implementar escaneo automatizado en CI/CD

### Recursos Adicionales

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**FIN DEL INFORME**

**Nota:** Esta auditoría se realizó mediante análisis estático de código. Se recomienda complementar con:
- Testing dinámico (penetration testing)
- Análisis de políticas de seguridad a nivel de base de datos
- Revisión de configuración de infraestructura (Supabase, hosting)
- Auditoría de dependencias (npm audit)
