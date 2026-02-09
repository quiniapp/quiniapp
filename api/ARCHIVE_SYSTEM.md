# Sistema de Archivado Automático - Documentación

## Visión General

El sistema de archivado mantiene las tablas principales (bets, tickets) optimizadas manteniendo solo los datos de los últimos **2 días con actividad** indexados. Los datos más antiguos se mueven automáticamente a tablas de archivo.

### Conceptos Clave

**Días con actividad**: NO son días de calendario, sino días donde efectivamente hubo apuestas/tickets creados.
- Un día feriado o sin actividad NO cuenta
- Solo cuentan días donde `bets_count > 0` O `tickets_count > 0`

**Cutoff Date**: La fecha del 3er día más reciente con actividad. Todo lo anterior a esta fecha se archiva.

**Importante sobre datos eliminados**: El sistema archiva y elimina TODAS las rows antiguas, incluyendo aquellas con `deleted_at != null` (eliminación lógica). Esto es intencional porque:
- Los datos lógicamente eliminados de días antiguos ya no son necesarios en la tabla principal
- Mantenerlos solo aumenta el tamaño de la tabla sin beneficio
- Se preservan en el archive para auditoría/histórico si es necesario

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    TABLAS PRINCIPALES                        │
│                 (últimos 2 días activos)                     │
├─────────────────────────────────────────────────────────────┤
│  • bets                                                      │
│  • tickets                                                   │
│  • Índices completos                                         │
│  • Queries rápidas                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │   CRON JOB DIARIO       │
              │   3:00 AM UTC-3         │
              └─────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TABLAS DE ARCHIVO                         │
│                   (datos históricos)                         │
├─────────────────────────────────────────────────────────────┤
│  • bets_archive                                             │
│  • tickets_archive                                          │
│  • Índices mínimos (solo lookups específicos)              │
│  • Acceso menos frecuente                                   │
└─────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Base de Datos

#### Tabla: `activity_days`
Trackea qué días tuvieron actividad de apuestas.

```sql
CREATE TABLE activity_days (
  date DATE PRIMARY KEY,
  has_activity BOOLEAN NOT NULL,
  bets_count INTEGER DEFAULT 0,
  tickets_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Stored Procedures Principales
- `mark_day_as_active(p_date)` - Marca un día como activo
- `update_activity_counts(p_date)` - Actualiza contadores para una fecha
- `get_last_active_days(p_limit)` - Obtiene últimos N días activos
- `should_archive_date(p_date, p_days_to_keep)` - Verifica si se debe archivar
- `archive_old_data(p_days_to_keep)` - Archiva bets y tickets en transacción
- `get_archive_stats()` - Obtiene estadísticas del archivo

**Comportamiento importante del archivado:**
- ✅ Archiva TODAS las rows antiguas (incluyendo `deleted_at IS NOT NULL`)
- ✅ Elimina TODAS las rows archivadas de la tabla principal
- Rationale: Los datos con eliminación lógica de días antiguos no necesitan estar en la tabla principal, solo aumentan el tamaño sin beneficio

### 2. Backend

#### ActivityDaysRepository
**Archivo:** `api/src/activity/repository/activity-days.repository.ts`

Gestiona el tracking de días activos.

**Métodos principales:**
- `markDayAsActive(date)` - Marca fecha como activa
- `updateActivityCounts(date)` - Cuenta bets/tickets para una fecha
- `getLastActiveDays(limit)` - Últimos N días activos
- `getCutoffDate(daysToKeep)` - Fecha límite para archivado

#### ArchiveService
**Archivo:** `api/src/archive/service/archive.service.ts`

Orquesta las operaciones de archivado.

**Métodos principales:**
- `archiveOldBets(daysToKeep)` - Archiva bets antiguas
- `archiveOldTickets(daysToKeep)` - Archiva tickets antiguos
- `archiveOldData(daysToKeep)` - Archiva ambos en una operación
- `getArchiveStats()` - Estadísticas (main vs archive, compression ratios)

**Implementación dual:**
1. Intenta usar stored procedures (más rápido)
2. Si falla, usa implementación TypeScript (fallback portable)

**Qué se archiva:**
- ✅ Bets y tickets con `deleted_at IS NULL` (datos activos)
- ✅ Bets y tickets con `deleted_at IS NOT NULL` (datos eliminados lógicamente)
- Todos los datos antiguos se mueven a archive y se eliminan de main

#### CronService
**Archivo:** `api/src/cron/service/cron.service.ts`

Ejecuta archivado automático diario.

**Características:**
- Corre diariamente a las 3:00 AM hora Argentina (UTC-3)
- Singleton: `getCronService(daysToKeep)`
- Auto-inicia al arrancar el servidor
- Logging detallado de cada ejecución

**Flujo del cron job:**
1. Actualiza contadores de actividad de ayer
2. Determina cutoff date (3er día activo más reciente)
3. Si no hay suficientes días activos, termina
4. Obtiene stats antes de archivar
5. Archiva bets y tickets antiguos
6. Obtiene stats después de archivar
7. Logguea resultados y tiempos de ejecución

#### Métodos Unificados en Repositorios

**BetRepository** (`api/src/bet/repository/bet.repository.ts`):
- `findBetById(betId)` - Busca en main + archive
- `findBetsByTicketId(ticketId)` - Combina ambas tablas
- `getTotalBetsCount(organizationId)` - Cuenta en ambas tablas

**TicketRepository** (`api/src/ticket/repository/ticket.repository.ts`):
- `findTicketById(ticketId)` - Busca en main + archive
- `findTicketByNumber(ticketNumber, orgId)` - Busca en ambas
- `findTicketsByUserId(userId, orgId, date?)` - Combina ambas tablas
- `getTotalTicketsCount(organizationId)` - Cuenta en ambas tablas

### 3. Admin Endpoints

**Base path:** `/api/private/admin/archive`

#### GET `/stats`
Obtiene estadísticas completas del sistema de archivo.

**Response:**
```json
{
  "success": true,
  "stats": {
    "main_tables": {
      "bets_count": 1500,
      "tickets_count": 300
    },
    "archive_tables": {
      "bets_count": 12000,
      "tickets_count": 2400
    },
    "activity": {
      "active_days_count": 30,
      "last_active_date": "2026-02-08"
    },
    "compression_ratio": {
      "bets": 88.89,
      "tickets": 88.89
    }
  },
  "active_days": ["2026-02-08", "2026-02-07", "2026-02-06"],
  "cron_status": {
    "running": true,
    "daysToKeep": 3,
    "schedule": "0 3 * * * (Daily at 3:00 AM)",
    "timezone": "America/Argentina/Buenos_Aires (UTC-3)"
  }
}
```

#### POST `/run`
Ejecuta archivado manualmente (para testing).

**Body:**
```json
{
  "days_to_keep": 3
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "bets": {
      "success": true,
      "message": "Bets archived successfully",
      "cutoff_date": "2026-02-05",
      "archived_count": 500,
      "deleted_count": 500,
      "days_kept": 3
    },
    "tickets": {
      "success": true,
      "message": "Tickets archived successfully",
      "cutoff_date": "2026-02-05",
      "archived_count": 100,
      "deleted_count": 100,
      "days_kept": 3
    },
    "execution_time_ms": 1234
  }
}
```

#### GET `/activity-days`
Obtiene todos los días de actividad registrados.

#### POST `/update-activity`
Actualiza contadores de actividad para una fecha específica.

**Body:**
```json
{
  "date": "2026-02-08"
}
```

#### GET `/cron-status`
Estado del cron job.

## Uso

### Primer Setup

1. **Aplicar migraciones:**
   ```bash
   # En Supabase Dashboard o CLI
   # Aplicar las 4 migraciones en orden:
   # 20260208122657_create_activity_days_table.sql
   # 20260208122658_create_bets_archive_table.sql
   # 20260208122659_create_tickets_archive_table.sql
   # 20260208122700_create_archive_stored_procedures.sql
   ```

2. **Poblar activity_days con datos históricos:**
   ```sql
   -- Para cada día en tu historial de bets/tickets
   SELECT update_activity_counts('2026-01-15');
   SELECT update_activity_counts('2026-01-16');
   -- ... etc
   ```

   O ejecutar script masivo:
   ```sql
   DO $$
   DECLARE
     day_record RECORD;
   BEGIN
     FOR day_record IN
       SELECT DISTINCT date FROM bets
       UNION
       SELECT DISTINCT date FROM tickets
     LOOP
       PERFORM update_activity_counts(day_record.date);
     END LOOP;
   END $$;
   ```

3. **Iniciar servidor:**
   ```bash
   npm run dev
   # El cron se inicia automáticamente
   ```

4. **Primer archivado manual (opcional):**
   ```bash
   curl -X POST http://localhost:3000/api/private/admin/archive/run \
     -H "Content-Type: application/json" \
     -d '{"days_to_keep": 3}'
   ```

### Operación Normal

El sistema funciona automáticamente:
- **Tracking de actividad:** Al crear bets/tickets, marcar el día como activo
- **Archivado automático:** Corre a las 3 AM todos los días
- **Acceso a datos:** Usar métodos unificados si necesitas buscar en archivo

### Monitoreo

**Ver estadísticas:**
```bash
curl http://localhost:3000/api/private/admin/archive/stats
```

**Ver logs del servidor:**
El cron logguea cada ejecución con detalles completos.

## Configuración

### Variables de Entorno

Actualmente el número de días se configura en código:

**En `api/src/index.ts`:**
```typescript
const daysToKeep = 3; // Cambiar aquí si necesitas más/menos días
const cronService = getCronService(daysToKeep);
```

Para hacer esto configurable vía ENV, agregar en `api/envs.ts`:
```typescript
export const ARCHIVE_DAYS_TO_KEEP = parseInt(process.env.ARCHIVE_DAYS_TO_KEEP || '3');
```

Y usar en index.ts:
```typescript
import { ARCHIVE_DAYS_TO_KEEP } from 'api/envs';
const cronService = getCronService(ARCHIVE_DAYS_TO_KEEP);
```

### Cambiar Horario del Cron

En `api/src/cron/service/cron.service.ts`:

```typescript
this.archiveTask = cron.schedule(
  '0 3 * * *', // Cambiar aquí: minuto hora * * *
  async () => { /* ... */ },
  {
    timezone: 'America/Argentina/Buenos_Aires', // UTC-3
  }
);
```

**Ejemplos:**
- `0 3 * * *` - 3:00 AM todos los días
- `0 2 * * *` - 2:00 AM todos los días
- `30 3 * * *` - 3:30 AM todos los días

## Performance

### Impacto Esperado

**Antes del archivado:**
- Main table: 100,000 bets (30 días de datos)
- Query time: ~500ms

**Después del archivado:**
- Main table: 10,000 bets (2 días activos)
- Archive table: 90,000 bets
- Query time on main: ~50ms (10x más rápido)

**Compression ratio:** ~90% de datos en archivo

### Optimizaciones

El sistema ya incluye:
- ✅ Stored procedures para operaciones masivas
- ✅ Transacciones atómicas (INSERT + DELETE)
- ✅ Índices mínimos en archivo (solo lookups)
- ✅ Índices completos en main (queries rápidas)

## Portabilidad

### Cambiar de Base de Datos

El sistema está diseñado para ser portable:

1. **Stored procedures opcionales:** Si tu DB no soporta PostgreSQL functions, el sistema usa fallback TypeScript
2. **Lógica en TypeScript:** Toda la lógica crítica está en el backend
3. **Abstraído en repositories:** Cambiar DB solo requiere actualizar repositories

### Ejemplo: Migrar a MySQL

1. Reescribir stored procedures a sintaxis MySQL (o eliminarlos)
2. Actualizar `supabase` import a cliente MySQL
3. Ajustar tipos de datos (JSONB → JSON, UUID → CHAR(36), etc.)
4. Todo el código TypeScript sigue funcionando sin cambios

## Troubleshooting

### El cron no está ejecutándose

**Verificar estado:**
```bash
curl http://localhost:3000/api/private/admin/archive/cron-status
```

**Revisar logs del servidor:**
```
[CronService] Archive cron job started - runs daily at 3:00 AM (Argentina Time, UTC-3)
```

**Forzar ejecución manual:**
```bash
curl -X POST http://localhost:3000/api/private/admin/archive/run
```

### No se están archivando datos

**Posibles causas:**

1. **Menos de 2 días activos:**
   - Verifica: `GET /api/private/admin/archive/activity-days`
   - Solución: Poblar activity_days con datos históricos

2. **activity_days no actualizada:**
   - Solución: Ejecutar `POST /api/private/admin/archive/update-activity` para fechas faltantes

3. **Stored procedures fallan:**
   - Revisa logs para errores
   - El sistema debería usar fallback TypeScript automáticamente

### Queries lentas después del archivado

**Posible causa:** Estás consultando datos archivados con queries normales.

**Solución:** Usar métodos unificados:
- `findBetById()` en lugar de consulta directa
- `findTicketByNumber()` en lugar de consulta directa

### Necesito restaurar datos del archivo

```sql
-- Ejemplo: Restaurar bets de un día específico
INSERT INTO bets
SELECT
  bet_id, bet_type, ticket_id, user_id, number, amount, place,
  "with", position, date, winner, paid, lottery_id, schedule_id,
  created_at, edited_at, deleted_at
FROM bets_archive
WHERE date = '2026-01-15';

-- Opcional: Eliminar del archivo después de restaurar
DELETE FROM bets_archive WHERE date = '2026-01-15';
```

## Próximas Mejoras

- [ ] Script automático para poblar activity_days con histórico
- [ ] Variable de entorno para configurar días de retención
- [ ] Dashboard visual en frontend
- [ ] Alertas por email/Slack si archivado falla
- [ ] Métricas en tiempo real (Prometheus/Grafana)
- [ ] Compresión de datos muy antiguos (>90 días)
- [ ] Purga automática de datos muy antiguos (configurable)

## Referencias

- **Migraciones:** `api/supabase/migrations/202602081226*`
- **Código:** `api/src/activity/`, `api/src/archive/`, `api/src/cron/`
- **CHANGELOG:** `api/CHANGELOG.md` - Sección "Added - 2026-02-08"
- **TODO:** `api/TODO.md` - Sección "Optimización de Base de Datos"
