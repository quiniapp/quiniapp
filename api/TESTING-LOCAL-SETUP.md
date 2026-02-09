# Configuración de Supabase Local para Tests (Puerto Separado)

Guía para configurar un **segundo Supabase local** en puertos diferentes, dedicado exclusivamente a tests, sin afectar tu entorno de desarrollo.

## Por qué un Segundo Supabase Local

Tu Supabase local actual (desarrollo):
- Puerto PostgreSQL: `54322`
- Puerto API: `54321`
- Contiene datos de desarrollo que NO quieres perder

Supabase local para tests (nuevo):
- Puerto PostgreSQL: `54332` ← Diferente
- Puerto API: `54331` ← Diferente
- Se limpiará completamente en cada ejecución de tests

## Configuración Paso a Paso

### Paso 1: Crear Directorio para Tests

```bash
cd api
mkdir supabase-test
cd supabase-test
```

### Paso 2: Inicializar Supabase en el Nuevo Directorio

```bash
# Dentro de api/supabase-test/
npx supabase init
```

Esto crea:
```
api/supabase-test/
├── config.toml
├── seed.sql
└── ...
```

### Paso 3: Configurar Puertos en config.toml

Edita `api/supabase-test/config.toml`:

```toml
# Cambia los puertos para evitar conflictos

[api]
enabled = true
port = 54331              # ← Cambiar de 54321 a 54331
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54332              # ← Cambiar de 54322 a 54332
shadow_port = 54333       # ← Cambiar de 54320 a 54333
major_version = 15

[studio]
enabled = true
port = 54323              # ← Puedes dejarlo o cambiar a 54343
api_url = "http://localhost"

[inbucket]
enabled = true
port = 54334              # ← Cambiar de 54324 a 54334
smtp_port = 54335         # ← Cambiar de 54325 a 54335
pop3_port = 54336         # ← Cambiar de 54326 a 54336

# Resto de la configuración puedes dejarla igual
```

### Paso 4: Copiar Migraciones

```bash
# Desde api/supabase-test/
cp -r ../supabase/migrations ./migrations
```

Estructura final:
```
api/
├── supabase/              ← Tu Supabase de desarrollo (puertos 54321/54322)
│   ├── config.toml
│   └── migrations/
└── supabase-test/         ← Supabase para tests (puertos 54331/54332)
    ├── config.toml        (con puertos modificados)
    └── migrations/        (copia de las migraciones)
```

### Paso 5: Crear .env.test

Crea `api/.env.test` con las credenciales del Supabase de test:

```env
# =====================================
# Environment Configuration - TEST
# =====================================
ENVIROMENT=TEST
NODE_ENV=test
SUPABASE_ENVIROMENT=LOCAL
FRONT_URL_ENVIROMENT=DEVELOP

# =====================================
# API Configuration
# =====================================
PORT=3001
URL=http://localhost

# =====================================
# Database Configuration - SUPABASE LOCAL TEST
# =====================================
# IMPORTANTE: Estos puertos son del supabase-test, NO del supabase normal
SUPABASE_URL_LOCAL=http://localhost:54331
SUPABASE_SERVICE_ROLE_KEY_LOCAL=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
JWT_SECRET_SUPABASE_LOCAL=super-secret-jwt-token-with-at-least-32-characters-long

# NO necesitas SUPABASE_URL ni SUPABASE_SERVICE_ROLE_KEY (remotos)
# Los tests SOLO usarán LOCAL

# =====================================
# JWT Secrets (Custom Authentication)
# =====================================
JWT_SECRET_ACCESS=test_access_secret_for_local_testing_256_bits_long_key
JWT_SECRET_REFRESH=test_refresh_secret_for_local_testing_256_bits_long_key
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
DEFAULT_ORG_ID=
```

### Paso 6: Modificar Scripts de Test para Usar .env.test

Edita `api/package.json`:

```json
{
  "scripts": {
    "test": "cross-env NODE_ENV=test dotenv -e .env.test -- cross-env NODE_OPTIONS=--experimental-vm-modules jest --runInBand --detectOpenHandles",
    "test:watch": "cross-env NODE_ENV=test dotenv -e .env.test -- cross-env NODE_OPTIONS=--experimental-vm-modules jest --watch --runInBand",
    "test:coverage": "cross-env NODE_ENV=test dotenv -e .env.test -- cross-env NODE_OPTIONS=--experimental-vm-modules jest --coverage --runInBand",
    "test:verify": "dotenv -e .env.test -- tsx scripts/verify-test-env.ts",
    "supabase:test:start": "cd supabase-test && npx supabase start",
    "supabase:test:stop": "cd supabase-test && npx supabase stop",
    "supabase:test:reset": "cd supabase-test && npx supabase db reset"
  }
}
```

### Paso 7: Instalar dotenv-cli

```bash
cd api
npm install --save-dev dotenv-cli
```

## Uso Diario

### Iniciar Supabase de Test (Primera vez o después de reiniciar PC)

```bash
cd api
npm run supabase:test:start
```

Verás algo como:
```
Started supabase local development setup.

         API URL: http://localhost:54331
          DB URL: postgresql://postgres:postgres@localhost:54332/postgres
      Studio URL: http://localhost:54343
    Inbucket URL: http://localhost:54334
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGci...
service_role key: eyJhbGci...
```

**Importante:** Tu Supabase de desarrollo sigue corriendo en los puertos normales (54321/54322).

### Verificar Configuración

```bash
npm run test:verify
```

Deberías ver:
```
✅ ¡Entorno de testing configurado correctamente!
▶️  Puedes ejecutar los tests con: npm test
```

### Ejecutar Tests

```bash
npm test
```

Los tests:
1. Se conectan a `localhost:54331` (Supabase de test)
2. Limpian todas las tablas
3. Crean datos de prueba
4. Ejecutan validaciones
5. Limpian al finalizar

**Tu Supabase de desarrollo en 54321/54322 NO se toca.**

### Detener Supabase de Test

Cuando termines de trabajar:

```bash
npm run supabase:test:stop
```

### Resetear Base de Datos de Test

Si quieres empezar de cero:

```bash
npm run supabase:test:reset
```

Esto:
- Borra todos los datos
- Reaplica todas las migraciones
- Ejecuta seeds si existen

## Verificación de Aislamiento

Para confirmar que los tests NO tocan tu desarrollo:

### Antes de ejecutar tests:

```bash
# Conectarte a tu Supabase de desarrollo
psql postgresql://postgres:postgres@localhost:54322/postgres

# Contar organizaciones
SELECT COUNT(*) FROM organizations;
```

Anota el número.

### Ejecutar tests:

```bash
npm test
```

### Después de los tests:

```bash
# Volver a conectar a desarrollo
psql postgresql://postgres:postgres@localhost:54322/postgres

# Contar organizaciones nuevamente
SELECT COUNT(*) FROM organizations;
```

**El número debe ser el mismo** ✅

### Verificar Supabase de test:

```bash
# Conectar a Supabase de test
psql postgresql://postgres:postgres@localhost:54332/postgres

# Ver organizaciones (debería estar vacío después del cleanup)
SELECT * FROM organizations;
```

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────┐
│              TU COMPUTADORA                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────┐  ┌──────────────────┐  │
│  │ Supabase DESARROLLO│  │ Supabase TESTS   │  │
│  │                    │  │                  │  │
│  │ Puerto API: 54321  │  │ Puerto API: 54331│  │
│  │ Puerto DB:  54322  │  │ Puerto DB:  54332│  │
│  │                    │  │                  │  │
│  │ Datos permanentes  │  │ Se limpia c/test │  │
│  │ Para desarrollo    │  │ Solo para tests  │  │
│  └────────────────────┘  └──────────────────┘  │
│           ↑                       ↑             │
│           │                       │             │
│           │                       │             │
│    .env (desarrollo)      .env.test (tests)    │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Comandos Rápidos

```bash
# Iniciar ambos Supabase (desarrollo + test)
npx supabase start                    # En api/
npm run supabase:test:start           # Inicia test en api/

# Verificar estado
npx supabase status                   # Desarrollo
cd supabase-test && npx supabase status   # Test

# Detener ambos
npx supabase stop                     # Desarrollo
npm run supabase:test:stop            # Test

# Ver logs (útil para debugging)
cd supabase-test && npx supabase logs
```

## Troubleshooting

### Error: "Port already in use"

**Causa:** Ya tienes un Supabase corriendo en ese puerto.

**Solución:**
```bash
# Ver qué está usando el puerto
netstat -ano | findstr :54331

# O simplemente detener tu Supabase de desarrollo
npx supabase stop
```

### Error: "Cannot find module"

**Causa:** dotenv-cli no está instalado.

**Solución:**
```bash
npm install --save-dev dotenv-cli
```

### Tests se conectan a desarrollo

**Causa:** .env.test no está configurado correctamente.

**Verificación:**
```bash
# Ver qué .env se está usando
dotenv -e .env.test -- node -e "console.log(process.env.SUPABASE_URL_LOCAL)"

# Debería mostrar: http://localhost:54331
```

### Migraciones desactualizadas en test

**Solución:**
```bash
# Copiar migraciones actualizadas
cp -r api/supabase/migrations/* api/supabase-test/migrations/

# Resetear DB de test
npm run supabase:test:reset
```

## Ventajas de Esta Configuración

✅ **Aislamiento total** - Tests nunca tocan tu desarrollo
✅ **Rápido** - Todo en local, sin latencia de red
✅ **Ilimitado** - No consume cuota de Supabase
✅ **Reproducible** - Siempre parte de estado limpio
✅ **Paralelo** - Puedes desarrollar mientras corren tests
✅ **Offline** - No necesitas internet

## Archivo .gitignore

Asegúrate de que `api/.gitignore` tenga:

```gitignore
# Environment files
.env
.env.test
.env.local

# Supabase
.branches
.temp
supabase/.branches
supabase/.temp
supabase-test/.branches
supabase-test/.temp
```

## Resumen

1. ✅ Creas `api/supabase-test/` con puertos diferentes (54331/54332)
2. ✅ Creas `api/.env.test` apuntando a esos puertos
3. ✅ Modificas scripts de npm para usar `.env.test`
4. ✅ Instalas `dotenv-cli`
5. ✅ Ejecutas `npm run supabase:test:start`
6. ✅ Corres `npm test`

**Tu desarrollo queda intacto en 54321/54322** 🎉
