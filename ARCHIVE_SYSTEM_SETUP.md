# Guía de Configuración del Sistema de Archive

## Estado Actual

✅ **Código deployed en develop**
✅ **Migraciones de schema aplicadas** (archive tables, RPCs)
❌ **Tabla activity_days vacía** - Por eso el cron dice "Not enough active days yet"
❌ **Datos históricos sin archivar** - Todo sigue en tablas main

## Problema Identificado

El sistema de archive necesita la tabla `activity_days` poblada para saber qué fechas archivar. El cron intentó correr pero encontró:

```
[CronService] Cutoff date: Not enough active days yet
[CronService] Not enough active days to perform archiving. Skipping.
```

## Solución: 3 Pasos

### Paso 1: Aplicar Migración de Backfill

Aplicar en develop:
```
api/supabase/migrations/20260210060000_backfill_activity_days.sql
```

**Qué hace:**
- Lee todas las fechas únicas de la tabla `bets`
- Cuenta cuántos bets y tickets hay por fecha
- Popula `activity_days` con estos datos históricos
- Muestra un reporte de verificación

**Output esperado:**
```
NOTICE: Activity Days Backfill Complete
NOTICE: Total days in activity_days: 15
NOTICE: Days with activity: 15
NOTICE: Oldest date: 2026-01-22
NOTICE: Newest date: 2026-02-09
```

### Paso 2: Verificar el Backfill

Ejecutar en DB para confirmar:
```sql
-- Ver días activos
SELECT date, has_activity, bets_count, tickets_count
FROM activity_days
WHERE has_activity = true
ORDER BY date DESC
LIMIT 20;

-- Contar días
SELECT COUNT(*) as total_days,
       COUNT(*) FILTER (WHERE has_activity = true) as active_days,
       MIN(date) as oldest_date,
       MAX(date) as newest_date
FROM activity_days;
```

### Paso 3: Triggear Archive Manualmente

**Opción A: Usando el endpoint (Recomendado)**

1. Reiniciar el servidor develop para que cargue las nuevas rutas
2. Hacer request autenticado:

```bash
# Usando curl (requiere cookie de sesión válida)
curl -X POST http://localhost:3000/api/private/archive/trigger \
  -H "Cookie: session=tu-cookie-aqui" \
  -H "Content-Type: application/json"

# Response esperado:
{
  "success": true,
  "message": "Archive job completed. Check server logs for details."
}
```

O desde el frontend/Postman con sesión activa:
```
POST /api/private/archive/trigger
```

**Opción B: Esperar al Cron Automático**

El cron corre diariamente a las 3:00 AM Argentina Time. Después del backfill, el próximo cron archivará automáticamente.

### Paso 4: Verificar Resultados

**Ver logs del servidor:**
```
[CronService] Starting daily archive job
[CronService] Timestamp: 2026-02-10T09:00:00.033Z
[CronService] Updating activity counts for 2026-02-09...
[CronService] Cutoff date: 2026-02-07  ← ¡Ahora tiene cutoff!
[CronService] Getting stats before archiving...
[CronService] Stats before:
  - Main bets: 5000
  - Main tickets: 1200
[CronService] Archiving old data...
[CronService] Refreshing active days cache...
[ArchiveHelper] Cache refreshed with 2 active days: ["2026-02-09", "2026-02-08"]

BETS:
  - Archived: 4200
  - Deleted from main: 4200
  - Cutoff date: 2026-02-07

TICKETS:
  - Archived: 1000
  - Deleted from main: 1000
  - Cutoff date: 2026-02-07

STATS AFTER:
  - Main bets: 800 (↓ 84% compression!)
  - Main tickets: 200 (↓ 83% compression!)
  - Archive bets: 4200
  - Archive tickets: 1000
```

**Verificar con endpoints:**
```bash
# Ver estadísticas
GET /api/private/archive/stats

# Ver estado del cron
GET /api/private/archive/cron-status
```

**Verificar en DB:**
```sql
-- Contar registros en main vs archive
SELECT
  (SELECT COUNT(*) FROM bets WHERE deleted_at IS NULL) as main_bets,
  (SELECT COUNT(*) FROM bets_archive WHERE deleted_at IS NULL) as archive_bets,
  (SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL) as main_tickets,
  (SELECT COUNT(*) FROM tickets_archive WHERE deleted_at IS NULL) as archive_tickets;
```

## Comportamiento Post-Archive

### Queries por Fecha
- **Fechas recientes** (últimos 2 días activos): Query a `bets`, `tickets`
- **Fechas viejas**: Query a `bets_archive`, `tickets_archive`
- **Transparente**: El código rutea automáticamente usando `getTableName()`

### Queries sin Fecha (por ID/ticket_number)
1. Busca primero en tabla main (más rápida, tiene más índices)
2. Si no encuentra, busca en archive
3. Retorna el resultado de donde lo encuentre

### Operaciones de Escritura
- **Create/Update/Delete/Pay**: Solo funcionan en tablas main
- **Tickets archivados**: Si intentas pagar, sale error `TICKET_ARCHIVED`

## Cache de Active Days

El cache se actualiza automáticamente en 2 momentos:

1. **Server startup**: `initializeActiveDaysCache()`
   ```
   [ArchiveHelper] Cache initialized with 2 active days: ["2026-02-09", "2026-02-08"]
   ```

2. **Después del cron**: `refreshActiveDaysCache()`
   ```
   [ArchiveHelper] Cache refreshed with 2 active days: ["2026-02-10", "2026-02-09"]
   ```

El cache es in-memory y se usa para routing O(1):
- `isArchiveDate(date)` → true/false
- `getTableName(date, 'bets')` → 'bets' o 'bets_archive'

## Endpoints de Admin Disponibles

### POST /api/private/archive/trigger
Ejecuta el job de archive manualmente (para testing).

**Request:**
```bash
curl -X POST http://localhost:3000/api/private/archive/trigger \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Archive job completed. Check server logs for details."
}
```

### GET /api/private/archive/stats
Muestra estadísticas de tablas main vs archive.

**Response:**
```json
{
  "success": true,
  "stats": {
    "main_tables": {
      "bets_count": 800,
      "tickets_count": 200
    },
    "archive_tables": {
      "bets_count": 4200,
      "tickets_count": 1000
    },
    "compression_ratio": {
      "bets": 84.0,
      "tickets": 83.3
    }
  }
}
```

### GET /api/private/archive/cron-status
Muestra el estado del cron job.

**Response:**
```json
{
  "success": true,
  "status": {
    "running": true,
    "daysToKeep": 2,
    "schedule": "0 3 * * * (Daily at 3:00 AM)",
    "timezone": "America/Argentina/Buenos_Aires (UTC-3)"
  }
}
```

## Testing E2E

Ver plan completo en `api/TODO.md`, pero un resumen:

1. ✅ Aplicar backfill migration
2. ✅ Triggear archive manual
3. ✅ Verificar logs y stats
4. 🧪 Probar frontend:
   - Buscar tickets viejos (22 enero) → debe encontrarlos en archive
   - Buscar tickets recientes (9 febrero) → debe encontrarlos en main
   - Intentar pagar ticket archivado → debe dar error descriptivo
5. 🧪 Probar performance: queries en main deben ser mucho más rápidas

## Variables de Entorno

```bash
# Días activos a mantener en tablas main (default: 2)
ARCHIVE_DAYS_TO_KEEP=2
```

Cambiar este valor requiere:
1. Actualizar env variable
2. Reiniciar servidor
3. Próximo cron respetará el nuevo valor

## Troubleshooting

### "Not enough active days yet"
- **Causa**: `activity_days` vacía o con muy pocos registros
- **Solución**: Aplicar migration de backfill

### "column 'X' does not exist"
- **Causa**: Archive tables no tienen todas las columnas
- **Solución**: Ya aplicado en migration `20260209210000_fix_archive_tables_add_missing_columns.sql`

### Cache no se actualiza
- **Verificar**: Logs deben mostrar `[ArchiveHelper] Cache refreshed...`
- **Causa**: Cron no está corriendo o falló
- **Solución**: Ver logs del cron, verificar timezone

### Queries fallan en archive tables
- **Verificar**: RPCs `_archive` existen
- **Solución**: Aplicar migrations `20260209211210` y `20260209211211`

## Monitoreo en Producción

Después de deploy a producción, monitorear:

1. **Server startup logs**: Cache initialization
   ```
   [ArchiveHelper] Cache initialized with X active days: [...]
   ```

2. **Cron execution logs** (daily 3 AM):
   ```
   [CronService] Archive job completed successfully
   ```

3. **Archive statistics** (via endpoint o DB):
   - Compression ratios
   - Main table sizes should stay small
   - Archive tables should grow

4. **Performance metrics**:
   - Query times en main tables (debe ser rápido)
   - Query times en archive tables (puede ser más lento, menos frecuente)

## Rollback Plan

Si algo sale mal:

1. **Desactivar cron temporalmente**: Stop server o comentar línea en `index.ts`
2. **No borrar datos**: Las migrations solo agregan, no eliminan
3. **Mover datos de vuelta**: Si es necesario, crear migration inversa que mueva de archive a main
4. **Cache siempre tiene fallback**: Si está vacío, usa tabla main por defecto

## Resumen de Commits

Commit history en branch `develop`:
```
1d889a8 feat: add activity_days backfill and archive management endpoints
0c76cfa chore: rename migration files to correct timestamp order
d13b280 fix: add missing columns to archive tables and update get_ticket_sums
9a4a007 feat: implement smart archive query routing system
37dc1b8 change archive system to keep last 2 active days
ad02bb3 feat: implement database archive system for performance optimization
```

## Próximos Pasos

1. ✅ **AHORA**: Aplicar migration de backfill en develop
2. ✅ **AHORA**: Triggear archive manual vía endpoint
3. ✅ **AHORA**: Verificar logs y stats
4. 🧪 **DESPUÉS**: Testing E2E siguiendo plan en TODO.md
5. 🚀 **DESPUÉS**: Deploy a producción y monitorear

---

**Nota**: Todos los endpoints de admin (`/api/private/archive/*`) requieren autenticación. En producción, considerar agregar un check adicional de rol admin si es necesario.
