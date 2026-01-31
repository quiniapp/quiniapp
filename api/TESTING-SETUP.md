# Configuración de Entorno de Testing para QuiniApp

Guía completa para configurar un entorno de testing aislado sin necesidad de levantar una instancia local adicional de Supabase.

## Opciones de Configuración

### Opción 1: Usar Supabase Project Separado (Recomendado)

La forma más segura es usar un proyecto de Supabase completamente separado para tests.

#### Paso 1: Crear Proyecto de Test en Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Crea un nuevo proyecto llamado `quiniapp-test` o similar
3. Espera a que se complete el setup (~2 minutos)
4. Anota las credenciales del nuevo proyecto

#### Paso 2: Aplicar Migraciones al Proyecto de Test

```bash
cd api

# Configurar Supabase CLI para el proyecto de test
npx supabase link --project-ref <tu-test-project-ref>

# Aplicar todas las migraciones
npx supabase db push
```

#### Paso 3: Configurar Variables de Entorno

Crea o actualiza tu archivo `.env` en el directorio `api/`:

```env
# =====================================
# Environment Configuration
# =====================================
ENVIROMENT=TEST
NODE_ENV=test
SUPABASE_ENVIROMENT=REMOTE  # Usar proyecto remoto de test
FRONT_URL_ENVIROMENT=DEVELOP

# =====================================
# API Configuration
# =====================================
PORT=3000
URL=http://localhost

# =====================================
# Database Configuration - TEST PROJECT
# =====================================
# URL del proyecto de test
SUPABASE_URL=https://xxxxx.supabase.co

# Service role key del proyecto de test (Settings > API > service_role key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT secret del proyecto de test (Settings > API > JWT Settings > JWT Secret)
JWT_SECRET_SUPABASE=tu-jwt-secret-del-proyecto-test

# =====================================
# JWT Secrets (Custom Authentication)
# =====================================
JWT_SECRET_ACCESS=test_access_secret_256_bit_key_here
JWT_SECRET_REFRESH=test_refresh_secret_256_bit_key_here
JWT_ACCESS_TOKEN_EXPIRATION=15m
JWT_REFRESH_TOKEN_EXPIRATION=30d

# =====================================
# Session Management
# =====================================
SESSION_INACTIVITY_TIMEOUT=4h
SESSION_SLIDING_WINDOW=15m
SESSION_ABSOLUTE_TIMEOUT=30d
SESSION_CLEANUP_INTERVAL=1h

# =====================================
# Security Configuration
# =====================================
MAX_FAILED_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=15m
BCRYPT_ROUNDS=10
MAX_CONCURRENT_SESSIONS=0

# =====================================
# Cookie Configuration
# =====================================
COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

# =====================================
# Frontend URLs
# =====================================
FRONT_URL_PRODUCTION=http://localhost:5173
FRONT_URL_DEVELOP=http://localhost:5173
FRONT_URL_DEV=http://localhost:5173

# =====================================
# CORS Configuration
# =====================================
ALLOW_VERCEL_PREVIEWS=false
CORS_EXTRA_ORIGINS=

# =====================================
# Organization
# =====================================
# Dejar vacío - los tests crean sus propias organizaciones
DEFAULT_ORG_ID=
```

#### Paso 4: Ejecutar Tests

```bash
cd api
npm test
```

---

### Opción 2: Usar Mismo Proyecto con Prefijo de Test

Si prefieres usar el mismo proyecto de Supabase pero con datos separados.

#### Configuración

**⚠️ PRECAUCIÓN:** Esta opción requiere mucho cuidado para no mezclar datos de test con datos reales.

1. Usa las mismas credenciales de tu proyecto actual
2. Los tests crearán organizaciones con nombres únicos (prefijo `TEST_`)
3. El cleanup limpiará solo los datos creados por tests

#### Variables de Entorno

```env
# Usar mismas credenciales del proyecto actual
SUPABASE_URL=https://tu-proyecto-actual.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-actual
JWT_SECRET_SUPABASE=tu-jwt-secret-actual
```

#### Estrategia de Limpieza

Los tests usan `cleanTestDatabase()` que limpia todas las tablas. Para evitar eliminar datos reales:

**Opción 2a: Filtrar por timestamp**
El helper actual usa `gte('created_at', '1970-01-01')` que elimina TODO.

Para mayor seguridad, modifica `test-database.helper.ts`:

```typescript
export async function cleanTestDatabase() {
  // Solo eliminar datos creados en las últimas 24 horas
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const tables = [
    'current_accounts',
    'ticket_prices_by_turn',
    'results',
    'bets',
    'tickets',
    'schedule_lotteries',
    'schedules',
    'lotteries',
    'users',
    'organizations',
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .gte('created_at', oneDayAgo.toISOString());

    if (error && !error.message.includes('does not exist')) {
      console.warn(`Warning cleaning ${table}:`, error.message);
    }
  }
}
```

**⚠️ ADVERTENCIA:** Esta opción NO es recomendada para ambientes con datos reales.

---

### Opción 3: Usar Supabase Local con Docker

Si quieres un entorno completamente local y aislado.

#### Requisitos

- Docker Desktop instalado y corriendo
- Supabase CLI instalado

#### Paso 1: Inicializar Supabase Local

```bash
cd api

# Inicializar Supabase local (solo primera vez)
npx supabase init

# Iniciar servicios de Supabase en Docker
npx supabase start
```

Esto levantará:
- PostgreSQL en puerto 54322
- API Studio en http://localhost:54323
- Auth, Storage, Realtime, etc.

#### Paso 2: Aplicar Migraciones

```bash
# Las migraciones se aplican automáticamente al iniciar
# Si necesitas reaplicar:
npx supabase db reset
```

#### Paso 3: Configurar Variables de Entorno

```env
# =====================================
# Environment Configuration
# =====================================
ENVIROMENT=LOCAL
NODE_ENV=test
SUPABASE_ENVIROMENT=LOCAL
FRONT_URL_ENVIROMENT=DEVELOP

# =====================================
# Database Configuration - LOCAL
# =====================================
SUPABASE_URL_LOCAL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY_LOCAL=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
JWT_SECRET_SUPABASE_LOCAL=super-secret-jwt-token-with-at-least-32-characters-long

# JWT Secrets y resto de configuración igual que Opción 1
```

#### Paso 4: Ejecutar Tests

```bash
cd api
npm test
```

#### Comandos Útiles

```bash
# Detener Supabase local
npx supabase stop

# Ver logs
npx supabase logs

# Resetear base de datos (elimina todos los datos)
npx supabase db reset

# Acceder a Studio local
# http://localhost:54323
```

---

## Configuración de Scripts NPM

Agrega scripts específicos para testing en `api/package.json`:

```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS=--experimental-vm-modules jest --runInBand --detectOpenHandles",
    "test:watch": "cross-env NODE_OPTIONS=--experimental-vm-modules jest --watch --runInBand",
    "test:coverage": "cross-env NODE_OPTIONS=--experimental-vm-modules jest --coverage --runInBand",
    "test:local": "cross-env SUPABASE_ENVIROMENT=LOCAL npm test",
    "test:remote": "cross-env SUPABASE_ENVIROMENT=REMOTE npm test"
  }
}
```

Uso:

```bash
# Tests con configuración del .env
npm test

# Force usar Supabase local
npm run test:local

# Force usar Supabase remoto
npm run test:remote
```

---

## Verificación de Configuración

Antes de ejecutar tests, verifica que todo esté configurado correctamente:

### 1. Verificar Conexión a Supabase

```bash
cd api
node -e "
import('dotenv').then(dotenv => {
  dotenv.config();
  import('@supabase/supabase-js').then(({ createClient }) => {
    const url = process.env.SUPABASE_ENVIROMENT === 'LOCAL'
      ? process.env.SUPABASE_URL_LOCAL
      : process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ENVIROMENT === 'LOCAL'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL
      : process.env.SUPABASE_SERVICE_ROLE_KEY;

    const supabase = createClient(url, key);
    supabase.from('organizations').select('count').limit(1).then(({ error }) => {
      if (error) {
        console.error('❌ Error conectando:', error.message);
        process.exit(1);
      }
      console.log('✅ Conexión exitosa a Supabase');
    });
  });
});
"
```

### 2. Verificar Migraciones Aplicadas

```bash
# Para proyecto remoto
npx supabase migration list

# Para proyecto local
npx supabase db dump --schema public
```

### 3. Ejecutar Test Simple

Crea un archivo temporal `test-connection.test.ts`:

```typescript
import { describe, test, expect } from '@jest/globals';
import { supabase } from '../database/db.connection.js';

describe('Supabase Connection Test', () => {
  test('can connect to Supabase', async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('count')
      .limit(1);

    expect(error).toBeNull();
    console.log('✅ Connected successfully');
  });
});
```

---

## Troubleshooting

### Error: "Could not find the 'X' column"

**Causa:** Las migraciones no están aplicadas en el proyecto de test.

**Solución:**
```bash
npx supabase db push
```

### Error: "Connection refused" con Supabase Local

**Causa:** Docker no está corriendo o Supabase no está iniciado.

**Solución:**
```bash
# Verificar Docker
docker ps

# Iniciar Supabase
npx supabase start
```

### Tests muy lentos

**Causa:** Muchos inserts/deletes en base de datos remota.

**Solución:** Usa Supabase local (Opción 3) para tests más rápidos.

### Error: "duplicate key value violates unique constraint"

**Causa:** Cleanup no funcionó correctamente en ejecución anterior.

**Solución:**
```bash
# Si usas local:
npx supabase db reset

# Si usas remoto:
# Ejecutar el cleanup manualmente desde el código
```

---

## Mejores Prácticas

1. **Nunca uses datos de producción para tests**
   - Siempre usa un proyecto separado o local

2. **Ejecuta cleanup antes y después**
   - El `beforeAll` limpia automáticamente
   - Considera agregar cleanup en `afterAll` también

3. **Usa transacciones si es posible**
   - Supabase no soporta transacciones directas
   - Usa estrategia de cleanup robusta

4. **Monitorea uso de cuota**
   - Proyecto de test gratis tiene límites
   - Ejecuta cleanup regular

5. **Documenta qué datos son de test**
   - Usa prefijos claros (TEST_, DEV_)
   - Agrega comments en tablas si es necesario

---

## Configuración Recomendada por Ambiente

| Ambiente | Configuración | Ventajas | Desventajas |
|----------|--------------|----------|-------------|
| **CI/CD** | Opción 1 (Proyecto Remoto) | Aislado, reproducible | Consume cuota Supabase |
| **Desarrollo Local** | Opción 3 (Local Docker) | Rápido, ilimitado | Requiere Docker |
| **Quick Tests** | Opción 1 (Proyecto Remoto) | Setup simple | Más lento |

---

## Siguiente Paso

Una vez configurado el entorno, ejecuta:

```bash
cd api
npm test
```

Los tests crearán automáticamente:
- 1 organización de prueba
- 8 cashiers (4 con fee_plus=10, 4 con fee_plus=0)
- 5 schedules × 5 lotteries
- Jugadas y results para probar todos los escenarios de hits (0-20)
