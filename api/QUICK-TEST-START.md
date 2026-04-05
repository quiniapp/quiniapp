# Inicio Rápido - Tests E2E

Configuración rápida en 3 minutos para ejecutar tests sin tocar tu entorno de desarrollo.

## 🚀 Setup Automático (Recomendado)

### Windows (PowerShell)

```powershell
cd api
.\scripts\setup-test-env.ps1
```

### Linux/Mac (Bash)

```bash
cd api
bash scripts/setup-test-env.sh
```

Esto configurará automáticamente:
- ✅ Segundo Supabase local en puertos 54331/54332
- ✅ Archivo .env.test con configuración correcta
- ✅ Migraciones copiadas y aplicadas
- ✅ Verificación de la configuración

**Tu Supabase de desarrollo (54321/54322) NO se tocará.**

---

## 📝 Setup Manual (Si prefieres hacerlo paso a paso)

### 1. Crear directorio y configurar Supabase de test

```bash
cd api
mkdir supabase-test
cd supabase-test
npx supabase init
```

### 2. Editar `supabase-test/config.toml`

Cambiar estos puertos:

```toml
[api]
port = 54331  # Cambiar de 54321 a 54331

[db]
port = 54332  # Cambiar de 54322 a 54332
shadow_port = 54333

[studio]
port = 54343

[inbucket]
port = 54334
smtp_port = 54335
pop3_port = 54336
```

### 3. Copiar migraciones

```bash
cd api
cp -r supabase/migrations/* supabase-test/migrations/
```

### 4. Crear .env.test

```bash
cp .env.test.example .env.test
```

El archivo `.env.test` ya está preconfigurado con los puertos correctos (54331/54332).

### 5. Iniciar Supabase de test

```bash
npm run supabase:test:start
```

### 6. Verificar configuración

```bash
npm run test:verify
```

---

## ✅ Ejecutar Tests

```bash
npm test
```

Los tests:
- Se conectan a **localhost:54331** (Supabase de test)
- Limpian todas las tablas al inicio
- Crean 8 cashiers con diferentes escenarios (0-20 hits)
- Validan winners, prizes y current accounts
- Limpian al finalizar

**Tu Supabase de desarrollo en localhost:54321 NO se afecta.**

---

## 📊 Comandos Útiles

```bash
# Ver estado del Supabase de test
npm run supabase:test:status

# Detener Supabase de test
npm run supabase:test:stop

# Resetear BD de test (borra todo y reaplica migraciones)
npm run supabase:test:reset

# Ejecutar tests en modo watch
npm run test:watch

# Ver cobertura
npm run test:coverage
```

---

## 🔍 Verificar Aislamiento

Para confirmar que tus datos de desarrollo están seguros:

```bash
# Antes de ejecutar tests
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT COUNT(*) FROM organizations"

# Ejecutar tests
npm test

# Después de tests (el número debe ser igual)
psql postgresql://postgres:postgres@localhost:54322/postgres -c "SELECT COUNT(*) FROM organizations"
```

---

## 🛠️ Troubleshooting

### Error: "Port already in use"

**Solución:**
```bash
# Detener Supabase de desarrollo temporalmente
cd api
npx supabase stop

# O cambiar los puertos en supabase-test/config.toml
```

### Error: "Cannot find .env.test"

**Solución:**
```bash
cp .env.test.example .env.test
```

### Tests se conectan a desarrollo

**Verificar:**
```bash
# Ver qué URL está usando
dotenv -e .env.test -- node -e "console.log(process.env.SUPABASE_URL_LOCAL)"

# Debe mostrar: http://localhost:54331
```

---

## 📖 Documentación Completa

- **Guía detallada:** `TESTING-LOCAL-SETUP.md` (Setup completo con explicaciones)
- **Arquitectura de tests:** `__tests__/README.md` (Estructura y escenarios)
- **Opciones alternativas:** `TESTING-SETUP.md` (Supabase remoto, etc.)

---

## 🎯 Resumen Visual

```
┌───────────────────────────────────────────────┐
│         TU COMPUTADORA                        │
├───────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────┐   ┌─────────────────┐  │
│  │   DESARROLLO    │   │      TESTS      │  │
│  │                 │   │                 │  │
│  │  :54321 :54322  │   │  :54331 :54332  │  │
│  │                 │   │                 │  │
│  │  Tus datos      │   │  Se limpia      │  │
│  │  permanentes    │   │  cada test      │  │
│  └─────────────────┘   └─────────────────┘  │
│          ↑                     ↑             │
│          │                     │             │
│        .env                .env.test         │
│                                               │
└───────────────────────────────────────────────┘
```

**Ambos Supabase corren en paralelo. Tests nunca tocan desarrollo. 🎉**
