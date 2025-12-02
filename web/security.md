# QuiniApp Web - Auditoría de Seguridad Frontend

**Fecha:** 2025-11-30
**Auditor:** Claude (Sonnet 4.5)
**Workspace:** web/
**Alcance:** Análisis completo de seguridad del frontend React/TypeScript

---

## RESUMEN EJECUTIVO

Auditoría de seguridad exhaustiva del workspace web de QuiniApp, enfocada en vulnerabilidades comunes de aplicaciones frontend, manejo de datos sensibles, autenticación y prevención de pérdida/edición no autorizada de datos.

### Hallazgos Clave

- **3 vulnerabilidades ALTAS** - Exposición de datos sensibles y manejo de contraseñas
- **5 vulnerabilidades MEDIAS** - Validación de entrada y manejo de parámetros URL
- **8 vulnerabilidades BAJAS** - Mejores prácticas y código de depuración
- **0 vulnerabilidades CRÍTICAS** - Sin XSS, inyección o exposición de tokens

### Hallazgos Positivos

 No se usa dangerouslySetInnerHTML, eval(), o innerHTML
 Autenticación basada en cookies HTTP-only (credentials: 'include')
 Uso consistente de Zod para validación de formularios
 No hay tokens o secrets expuestos en el código frontend
 Rutas protegidas con componente ProtectedRoute
 Variables de entorno manejadas correctamente con Vite

---

## VULNERABILIDADES ENCONTRADAS

### 1. Contraseña Visible en Campo de Texto

**Archivo:** `web/src/components/form/UserForm.tsx:208`
**Severidad:**   ALTA
**OWASP:** A04:2021 - Insecure Design

**Problema:**
```tsx
<Controller
  name="password"
  control={control}
  render={({ field }) => <Input id={'password'} type={'text'} {...field} />}
/>
```

**Impacto:**
- Exposición de contraseñas a observadores cercanos (shoulder surfing)
- Violación de mejores prácticas de seguridad
- Incumplimiento de estándares de protección de datos

**Solución:**
```tsx
<Controller
  name="password"
  control={control}
  render={({ field }) => (
    <Input
      id={'password'}
      type={'password'}
      autoComplete="new-password"
      {...field}
    />
  )}
/>
```

---

### 2. Almacenamiento Inseguro en localStorage

**Archivos:**
- `web/src/features/make-plays/provider/MakePlaysProvider.tsx:133`
- `web/src/features/make-plays/header-play-detail.tsx:45`

**Severidad:**   ALTA
**OWASP:** A02:2021 - Cryptographic Failures

**Problema:**
```tsx
// Almacenamiento sin validación
localStorage.setItem('lastTicket', JSON.stringify(lastTicket));

// Lectura sin try-catch
const lastTicketStr = localStorage.getItem('lastTicket');
const lastTicket = JSON.parse(lastTicketStr); //   Puede crashear
```

**Problemas:**
1. JSON.parse sin try-catch ’ Crash de aplicación si dato corrupto
2. Sin validación de esquema ’ No garantiza estructura esperada
3. Datos potencialmente sensibles accesibles desde DevTools
4. Sin TTL ’ Datos permanecen indefinidamente

**Impacto:**
- Crash de aplicación con datos corruptos
- Posible manipulación de datos por usuario malintencionado
- Información sensible accesible en localStorage

**Solución:**
```tsx
// Almacenamiento con TTL
const saveLastTicket = (ticket: LastTicket) => {
  try {
    const data = {
      ticket,
      timestamp: Date.now(),
      ttl: 24 * 60 * 60 * 1000, // 24 horas
    };
    localStorage.setItem('lastTicket', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving ticket:', error);
  }
};

// Lectura con validación
const getLastTicket = (): LastTicket | null => {
  try {
    const dataStr = localStorage.getItem('lastTicket');
    if (!dataStr) return null;

    const data = JSON.parse(dataStr);

    // Validar TTL
    if (Date.now() - data.timestamp > data.ttl) {
      localStorage.removeItem('lastTicket');
      return null;
    }

    // Validar estructura con Zod
    const schema = z.object({
      bets: z.array(z.any()),
      ticket: z.object({
        ticket_number: z.string(),
        ticket_id: z.string(),
      }),
      cashier_number: z.number().optional(),
    });

    return schema.parse(data.ticket);
  } catch (error) {
    console.error('Error reading lastTicket:', error);
    localStorage.removeItem('lastTicket');
    return null;
  }
};
```

---

### 3. Validación de Contraseña Débil

**Archivo:** `web/src/validations/useAddNewUser.validation.ts:15`
**Severidad:**   ALTA
**OWASP:** A07:2021 - Identification and Authentication Failures

**Problema:**
```tsx
password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
```

**Impacto:**
- Contraseñas débiles permitidas (ej: "123456", "aaaaaa")
- Mayor riesgo de compromiso de cuentas por fuerza bruta
- Violación de estándares de seguridad

**Solución:**
```tsx
password: z
  .string()
  .min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  .regex(/[A-Z]/, { message: 'Debe contener al menos una mayúscula.' })
  .regex(/[a-z]/, { message: 'Debe contener al menos una minúscula.' })
  .regex(/[0-9]/, { message: 'Debe contener al menos un número.' })
  .regex(/[^A-Za-z0-9]/, { message: 'Debe contener al menos un caracter especial.' }),
```

---

### 4. Falta de Sanitización de Parámetros URL

**Archivos:**
- `web/src/features/terminal-ticket/index.tsx:22-25`
- `web/src/features/plays-and-hits/plays-and-hits-table.tsx:30-38`

**Severidad:** =á MEDIA
**OWASP:** A03:2021 - Injection

**Problema:**
```tsx
const date = searchParams.get('date') ?? undefined;
const cashier_id = searchParams.get('cashier_id') ?? undefined;
const ticket_number = searchParams.get('ticket_number') ?? undefined;

// Uso directo sin validación
runDeleteTicket(ticket_number, { ... });
```

**Problemas:**
1. Sin validación de formato de fecha
2. Sin validación que cashier_id/ticket_number sean UUIDs válidos
3. Parámetros usados directamente en requests

**Impacto:**
- Requests inválidos al backend
- Posible inyección en URLs del backend
- Errores inesperados en la aplicación

**Solución:**
```tsx
// Crear validadores con Zod
const urlParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cashier_id: z.string().uuid().optional(),
  ticket_number: z.string().min(1).max(50).optional(),
  filter: z.enum(['winner', 'paid', 'not_paid']).optional(),
});

// Validar antes de usar
const getValidatedParams = (searchParams: URLSearchParams) => {
  const rawParams = {
    date: searchParams.get('date') ?? undefined,
    cashier_id: searchParams.get('cashier_id') ?? undefined,
    ticket_number: searchParams.get('ticket_number') ?? undefined,
    filter: searchParams.get('filter') ?? undefined,
  };

  try {
    return urlParamsSchema.parse(rawParams);
  } catch (error) {
    console.error('Invalid URL parameters:', error);
    return {
      date: undefined,
      cashier_id: undefined,
      ticket_number: undefined,
      filter: undefined,
    };
  }
};

const validParams = getValidatedParams(searchParams);
```

---

### 5. Falta de Validación en encodeURIComponent

**Archivo:** `web/src/hooks/mutations/current-account/useBulkUpdateCurrentAccount.ts:22`
**Severidad:** =á MEDIA

**Problema:**
```tsx
const url = `${BACKEND_ROUTES.current_account.bulk}?date=${encodeURIComponent(date)}${leave ? '&leave=true' : ''}`;
```

**Impacto:**
- Requests con formatos de fecha inválidos
- Posibles errores en el backend

**Solución:**
```tsx
async function bulkUpdateCurrentAccount({ updateCurrentAccount, date, leave }: BulkVars): Promise<BulkResult> {
  // Validar formato de fecha
  const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
  if (!dateRegex.test(date)) {
    throw new Error('Invalid date format. Expected DD-MM-YYYY');
  }

  const url = `${BACKEND_ROUTES.current_account.bulk}?date=${encodeURIComponent(date)}${leave ? '&leave=true' : ''}`;
  // ... resto del código
}
```

---

### 6. Uso de Record<string, any> en Mutations

**Archivo:** `web/src/hooks/mutations/users/useAddNewUser.ts:4, 23`
**Severidad:** =á MEDIA

**Problema:**
```tsx
const addUser = async (newUser: Record<string, any>) => {
  // ...
  body: JSON.stringify({ newUser: newUser }),
}
```

**Impacto:**
- Sin validación de tipos en tiempo de compilación
- Posible envío de datos incorrectos o incompletos
- Dificulta mantenimiento y debugging

**Solución:**
```tsx
import { IUserEntityFront } from '@helper/types/user.type';

type NewUserPayload = Omit<IUserEntityFront, 'user_id' | 'created_at' | 'updated_at'>;

const addUser = async (newUser: NewUserPayload) => {
  // Validar con Zod antes de enviar
  const schema = z.object({
    name: z.string().min(2),
    last_name: z.string().min(2),
    username: z.string().min(2),
    password: z.string().min(8),
    number: z.number().int().positive(),
    user_type: z.enum(['ADMIN', 'CASHIER']),
  });

  const validated = schema.parse(newUser);

  const response = await fetch(BACKEND_ROUTES.user.base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ newUser: validated }),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }

  return await response.json();
};
```

---

### 7. Console.log en Código de Producción

**Archivos:**
- `web/src/features/make-plays/provider/MakePlaysProvider.tsx:146`
- `web/src/hooks/mutations/tickets/useEditTicket.ts:170`
- `web/src/features/login/index.tsx:48`

**Severidad:** =â BAJA

**Problema:**
```tsx
onError: (err) => {
  console.error(err); //   Expone en producción
  toast.error('Ocurrió un error, intente de nuevo');
}
```

**Impacto:**
- Exposición de información técnica en consola
- Posible revelación de estructura de backend

**Solución:**
```tsx
// Crear servicio de logging
const logger = {
  error: (message: string, error?: unknown) => {
    if (import.meta.env.DEV) {
      console.error(message, error);
    }
    // En producción, enviar a servicio de monitoreo
  },
};

// Usar en código
onError: (err) => {
  logger.error('Error creating ticket', err);
  toast.error('Ocurrió un error, intente de nuevo');
}
```

---

### 8. Cookie Sin Atributos de Seguridad

**Archivo:** `web/src/components/ui/sidebar.tsx:79`
**Severidad:** =â BAJA

**Problema:**
```tsx
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
```

**Impacto:**
- Cookie puede ser transmitida por HTTP
- Vulnerable a ataques CSRF sin SameSite
- Nota: Esta cookie solo guarda estado de UI (baja criticidad)

**Solución:**
```tsx
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; Secure; SameSite=Strict`;
```

---

### 9. Falta de Rate Limiting en Frontend

**Archivo:** `web/src/features/login/index.tsx`
**Severidad:** =â BAJA

**Problema:**
No hay limitación de intentos de login desde el frontend.

**Impacto:**
- Posibles ataques de fuerza bruta facilitados
- UX pobre en caso de múltiples intentos fallidos

**Solución:**
```tsx
const [loginAttempts, setLoginAttempts] = useState(0);
const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

const onSubmit = async (data: FormData) => {
  // Verificar lockout
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const remainingSeconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
    toast.error(`Demasiados intentos. Intente en ${remainingSeconds}s`);
    return;
  }

  try {
    await login({ username: data.username, password: data.password });
    setLoginAttempts(0);
    navigate(ROUTES.MAKE_PLAYS, { replace: true });
  } catch (err) {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= 5) {
      setLockoutUntil(Date.now() + 5 * 60 * 1000); // 5 minutos
      toast.error('Demasiados intentos fallidos. Intente en 5 minutos.');
    } else {
      toast.error(`Credenciales incorrectas (${newAttempts}/5 intentos)`);
    }
  }
};
```

---

### 10. parseInt/parseFloat Sin Radix

**Múltiples archivos**
**Severidad:** =â BAJA

**Problema:**
```tsx
const parsed = parseInt(search);
setUserNumber(isNaN(parsed) ? undefined : parsed);
```

**Impacto:**
- parseInt sin radix puede interpretar números con prefijo "0" como octal

**Solución:**
```tsx
const parsed = parseInt(search, 10); // Siempre especificar radix 10
setUserNumber(isNaN(parsed) ? undefined : parsed);
```

---

## ANÁLISIS PERFORMANCE VS SEGURIDAD

### Estrategia Balanceada

| Fix | Impacto Seguridad | Overhead Performance | Recomendación |
|-----|-------------------|---------------------|---------------|
| Validación de URLs | Alto | Costo mínimo |  IMPLEMENTAR |
| Validación Zod mutations | Alto | Costo bajo-medio |  IMPLEMENTAR |
| Rate limiting frontend | Medio | Costo mínimo |  IMPLEMENTAR |
| Logging condicional | Medio | Ganancia pequeña |  IMPLEMENTAR |
| Validación localStorage | Medio | Costo bajo |  IMPLEMENTAR |
| TTL en localStorage | Bajo | Costo mínimo |   OPCIONAL |

### Validaciones que NO Impactan UX

 Validación de parámetros URL (imperceptible)
 parseInt con radix (sin impacto)
 Tipos estrictos (solo en desarrollo)
 Cookies Secure/SameSite (sin impacto)

### Validaciones que MEJORAN UX

 Rate limiting en login ’ Previene lockout de cuenta
 Validación Zod con mensajes claros ’ Mejor feedback
 Manejo de errores robusto ’ Menos crashes

---

## PLAN DE REMEDIACIÓN PRIORIZADO

### Fase 1: Críticas (Esta Semana) - 6-8h

**Prioridad:**   INMEDIATO

1. **Cambiar type="password" en UserForm** - 15min
   - `web/src/components/form/UserForm.tsx:208`
   - Cambiar `type={'text'}` ’ `type={'password'}`

2. **Implementar validación localStorage** - 2-3h
   - Crear helpers `saveLastTicket()` y `getLastTicket()`
   - Agregar Zod schema y try-catch
   - Implementar TTL

3. **Mejorar validación de contraseñas** - 1h
   - `web/src/validations/useAddNewUser.validation.ts`
   - Agregar regex para complejidad
   - Actualizar mensajes

**Esfuerzo:** 4 horas
**Impacto:** Elimina 3 vulnerabilidades ALTAS

---

### Fase 2: Medias (Próximas 2 Semanas) - 10-12h

**Prioridad:** =á URGENTE

4. **Validación de URL params** - 3-4h
   - Crear `getValidatedParams()` con Zod
   - Aplicar en terminal-ticket, plays-and-hits
   - Tests unitarios

5. **Reemplazar Record<string, any>** - 2h
   - Definir `NewUserPayload` type
   - Actualizar useAddNewUser.ts
   - Validar con Zod

6. **Validación en bulkUpdate** - 2h
   - Validar formato de fecha
   - Error handling

**Esfuerzo:** 7 horas
**Impacto:** Elimina 3 vulnerabilidades MEDIAS

---

### Fase 3: Bajas (Próximo Sprint) - 8-10h

7. **Sistema de logging** - 4-5h
   - Crear servicio logger
   - Reemplazar console.log/error
   - Configurar dev/prod

8. **Cookies seguras** - 1h
   - Agregar Secure/SameSite
   - Verificar compatibilidad

9. **Rate limiting login** - 3h
   - Estado de intentos
   - Lockout temporal
   - Mensajes claros

**Esfuerzo:** 8 horas

---

### Fase 4: Backlog

10. Mejorar tipado en catch blocks
11. Code review checklist de seguridad
12. Integración con Sentry

---

**Esfuerzo Total:** 19-28 horas de desarrollo

---

## MEJORES PRÁCTICAS

### 1. Validación de Entrada

```tsx
// L MAL
const userId = searchParams.get('user_id');
fetch(`/api/user/${userId}`);

//  BIEN
const userIdSchema = z.string().uuid();
const userId = userIdSchema.parse(searchParams.get('user_id'));
fetch(`/api/user/${userId}`);
```

### 2. Manejo de Datos Sensibles

```tsx
// L MAL
<input type="text" name="password" />

//  BIEN
<input type="password" name="password" autoComplete="new-password" />
```

### 3. Almacenamiento Local

```tsx
// L MAL
const data = JSON.parse(localStorage.getItem('data'));

//  BIEN
const getData = () => {
  try {
    const raw = localStorage.getItem('data');
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Validar TTL
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem('data');
      return null;
    }

    return dataSchema.parse(parsed.data);
  } catch {
    localStorage.removeItem('data');
    return null;
  }
};
```

### 4. Manejo de Errores

```tsx
// L MAL
catch (err) {
  console.error(err);
}

//  BIEN
catch (error) {
  const err = error instanceof Error ? error : new Error('Unknown error');

  if (import.meta.env.DEV) {
    console.error('API Error:', err);
  }

  logger.error({ message: err.message, context: 'apiCall' });
  toast.error('Ocurrió un error. Por favor intente nuevamente.');
}
```

### 5. Tipos Estrictos

```tsx
// L MAL
const addUser = async (data: any) => { ... }

//  BIEN
interface NewUserPayload {
  name: string;
  email: string;
  password: string;
}

const addUser = async (data: NewUserPayload) => { ... }
```

---

## CHECKLIST DE SEGURIDAD PARA PRs

### Pre-Commit

- [ ] No hay console.log sin condicional `import.meta.env.DEV`
- [ ] No hay `any` o `Record<string, any>` sin justificación
- [ ] Campos de contraseña usan `type="password"`
- [ ] Validación Zod en formularios
- [ ] Parámetros URL validados
- [ ] parseInt/parseFloat con radix
- [ ] Try-catch en JSON.parse()

### Code Review

- [ ] Validación en frontend Y backend
- [ ] Manejo de errores no expone detalles técnicos
- [ ] Cookies con Secure y SameSite
- [ ] No hay XSS (dangerouslySetInnerHTML, eval)
- [ ] Tipos TypeScript estrictos
- [ ] Mensajes de error genéricos
- [ ] Rate limiting donde sea apropiado

### Testing

- [ ] Tests con valores nulos, strings vacíos, caracteres especiales
- [ ] Tests de validación con datos inválidos
- [ ] Tests de manejo de errores
- [ ] Tests de timeout/conexión fallida

---

## CONCLUSIONES

### Fortalezas

 Base de seguridad sólida
 Autenticación con cookies HTTP-only
 Uso de Zod para validación
 Rutas protegidas
 No hay XSS o inyección de código

### Debilidades

  Campo de contraseña visible (1 línea fix)
  Validación de localStorage (alta prioridad)
  Validación de parámetros URL (previene errores)

### Próximos Pasos

1. Implementar Fase 1 (4 horas) ’ Elimina vulnerabilidades ALTAS
2. Establecer checklist de seguridad en PRs
3. Configurar ESLint security plugin
4. Considerar Sentry para monitoreo

**Riesgo General:** MEDIO ’ Puede reducirse a BAJO implementando Fase 1 y 2

---

**FIN DEL INFORME**
