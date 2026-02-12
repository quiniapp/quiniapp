# Análisis: Timeout en Generate Winners

## El Problema

**Error**: `statement timeout (code 57014)`
**Fecha afectada**: 2026-02-09
**Operación**: POST /api/private/winners/f131fadd-ae72-4946-b0ac-807aacf1f4b6?date=2026-02-09

## Causa Raíz

El RPC `generate_winners_and_calculate_accounts` NO es compatible con el sistema de archive. Aquí está por qué:

### 1. **Queries Directas a Tablas Main**

El RPC hace esto:

```sql
-- En generate_winners()
FROM bets b
JOIN results r ON ...
WHERE b.schedule_id = target_id
  AND b.date = bet_date
  AND b.deleted_at IS NULL

UPDATE bets b
SET prize = cp.payout, hits = cp.hits, winner = (cp.payout > 0)
...

UPDATE tickets t
SET total_prize = ..., hits = ..., winner = ...
```

**Problema**: Query directo a `bets` y `tickets` sin considerar `bets_archive` / `tickets_archive`.

### 2. **No Tiene Versión Archive**

Otros RPCs tienen versiones `_archive`:
- ✅ `ticket_full_json_plpgsql` → `ticket_full_json_plpgsql_archive`
- ✅ `get_ticket_sums` → `get_ticket_sums_archive`
- ❌ `generate_winners` → **NO TIENE versión archive**

### 3. **Operaciones de Escritura (UPDATE)**

Este RPC hace `UPDATE` en `bets` y `tickets`, lo cual:
- ❌ **NO puede funcionar en archive tables** (son read-only)
- ✅ **Solo debe funcionar en main tables**

### 4. **Por Qué el Timeout**

#### Escenario A: Archive NO corrió todavía (más probable)

```
┌─────────────────────────────────────────┐
│ Main Tables (SIN archive todavía)      │
├─────────────────────────────────────────┤
│ bets:    5,000+ registros               │
│ tickets: 1,200+ registros               │
│                                         │
│ Incluye: 22-ene, 31-ene, 5-feb, 9-feb  │
└─────────────────────────────────────────┘

Problema:
- Tablas MUY grandes
- Query con múltiples CTEs (Common Table Expressions)
- JOINs complejos con LATERAL
- Cálculos de premios (calculate_one_payout, calculate_double_payout, etc.)
- Agregaciones por ticket
- UPDATEs masivos

→ Excede el statement_timeout
```

#### Escenario B: Archive corrió y movió los datos (menos probable)

```
┌─────────────────────────────────────────┐
│ Main Tables (después del archive)      │
├─────────────────────────────────────────┤
│ bets:    800 registros                  │
│ tickets: 200 registros                  │
│ Solo: 9-feb, 10-feb                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Archive Tables                          │
├─────────────────────────────────────────┤
│ bets_archive:    4,200 registros        │
│ tickets_archive: 1,000 registros        │
│ Incluye: 22-ene, 31-ene, 5-feb, etc.   │
└─────────────────────────────────────────┘

Problema:
- RPC busca en main table (9-feb está ahí)
- Encuentra los datos PERO...
- Puede estar buscando datos relacionados que ya están en archive
- O el query plan está mal optimizado
```

### 5. **Operaciones Costosas en el RPC**

```sql
-- 1. JOIN con results
FROM bets b
JOIN results r ON (4 condiciones)

-- 2. LATERAL join con 6 UNIONs
LEFT JOIN LATERAL (
  SELECT ... FROM calculate_one_payout(b, r.results)
  UNION ALL
  SELECT ... FROM calculate_double_payout(b, r.results)
  UNION ALL
  SELECT ... FROM calculate_tern_payout(b, r.results)
  UNION ALL
  SELECT ... FROM calculate_quatern_payout(b, r.results)
  UNION ALL
  SELECT ... FROM calculate_borratina_payout(b, r.results)
  UNION ALL
  SELECT ... FROM calculate_redouble_payout(b, r.results)
) cp ON TRUE

-- 3. Múltiples CTEs anidados
WITH calculated_payouts AS (...),
     up_bets AS (UPDATE ...),
     per_ticket_turn AS (...),
     deleted_turn AS (DELETE ...),
     affected_tickets AS (...),
     inserted_turn AS (INSERT ...),
     previous_turns AS (...),
     totals_per_day AS (...),
     updated_tickets AS (UPDATE ...)

-- 4. Después llama a calculate_current_account
-- que hace OTRO query pesado a bets/tickets
```

## Por Qué Solo Afecta a CAPITALIST/SUPERADMIN

**Teoría**: Es posible que:
1. Los usuarios ADMIN/OWNER probaron esto antes cuando había menos datos
2. O hay alguna diferencia en los datos que consultan
3. O los CAPITALIST/SUPERADMIN tienen más datos en su organización

**Necesitamos verificar**: ¿Los ADMIN pueden generar ganadores sin timeout?

## Soluciones

### Solución 1: Aumentar statement_timeout (Temporal)

```sql
-- En el RPC, al inicio:
CREATE OR REPLACE FUNCTION generate_winners_and_calculate_accounts(...)
AS $$
BEGIN
  -- Aumentar timeout para esta operación (5 minutos)
  PERFORM set_config('statement_timeout', '300000', true);

  -- ... resto del código
END;
$$;
```

**Pros**:
- Rápido de implementar
- No requiere cambios en lógica

**Contras**:
- No resuelve la causa raíz
- Query sigue siendo lento
- Puede fallar con más datos

### Solución 2: Optimizar el RPC (Recomendado)

#### 2.1. Agregar índices faltantes

```sql
-- Verificar si existen estos índices
CREATE INDEX IF NOT EXISTS idx_bets_schedule_date_org
  ON bets(schedule_id, date, organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_results_lookup
  ON results(lottery_id, schedule_id, date, organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_prizes_lookup
  ON ticket_prizes_by_turn(ticket_id, date, organization_id);
```

#### 2.2. Simplificar el query

- Eliminar CTEs innecesarios
- Hacer las operaciones en batches más pequeños
- Cachear resultados intermedios

### Solución 3: Validar que Data Esté en Main Table (Crítico)

**IMPORTANTE**: `generate_winners` SOLO puede funcionar en datos que estén en las **main tables**, porque hace UPDATEs.

Agregar validación al inicio del RPC:

```sql
CREATE OR REPLACE FUNCTION generate_winners(...)
AS $$
DECLARE
  v_bets_count INT;
BEGIN
  -- Verificar que existen bets en MAIN table para esta fecha
  SELECT COUNT(*) INTO v_bets_count
  FROM bets
  WHERE schedule_id = target_id
    AND date = bet_date
    AND organization_id = p_organization_id
    AND deleted_at IS NULL;

  IF v_bets_count = 0 THEN
    -- Verificar si están en archive (no se puede generar winners)
    SELECT COUNT(*) INTO v_bets_count
    FROM bets_archive
    WHERE schedule_id = target_id
      AND date = bet_date
      AND organization_id = p_organization_id
      AND deleted_at IS NULL;

    IF v_bets_count > 0 THEN
      RAISE EXCEPTION 'BETS_ARCHIVED: No se pueden generar ganadores para fechas archivadas. Los datos están en archive (read-only).';
    ELSE
      RAISE EXCEPTION 'NO_BETS_FOUND: No hay apuestas para esta fecha/schedule.';
    END IF;
  END IF;

  -- Continuar con la generación normal...
END;
$$;
```

### Solución 4: Política de Uso (Documentación)

**Regla clara**: `generate_winners` solo funciona para fechas en main tables (últimos 2 días activos).

Para fechas archivadas:
1. ❌ NO se pueden generar ganadores
2. ✅ Solo se pueden consultar (read-only)
3. ⚠️ Si necesitas regenerar, primero hay que mover de archive a main

## Recomendación Inmediata

### Paso 1: Verificar Estado Actual

```sql
-- ¿Los datos del 9-feb están en main o archive?
SELECT
  COUNT(*) as main_bets,
  (SELECT COUNT(*) FROM bets_archive
   WHERE date = '2026-02-09' AND deleted_at IS NULL) as archive_bets
FROM bets
WHERE date = '2026-02-09' AND deleted_at IS NULL;

-- ¿Cuántos días activos hay en main?
SELECT DISTINCT date
FROM bets
WHERE deleted_at IS NULL
ORDER BY date DESC
LIMIT 5;
```

### Paso 2: Aumentar Timeout (Temporal)

Crear migration:

```sql
-- 20260210120000_increase_timeout_generate_winners.sql
ALTER FUNCTION generate_winners_and_calculate_accounts(UUID, DATE, UUID)
SET statement_timeout = '300000'; -- 5 minutos
```

### Paso 3: Agregar Índices (Si Faltan)

```sql
-- Verificar índices existentes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('bets', 'results', 'ticket_prizes_by_turn');
```

### Paso 4: Monitorear Query

```sql
-- Ver queries lentos en tiempo real
SELECT pid, now() - query_start as duration, state, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query LIKE '%generate_winners%'
ORDER BY duration DESC;
```

## Testing

Después de aplicar fixes:

```bash
# 1. Probar con fecha reciente (debe estar en main)
POST /api/private/winners/SCHEDULE_ID?date=2026-02-10

# 2. Medir tiempo de respuesta
# Debería ser < 30 segundos con índices y timeout aumentado

# 3. Verificar logs
# No debe haber timeout
```

## Impacto del Sistema de Archive

El sistema de archive **amplifica este problema**:

### Antes del Archive
```
Main tables: 5,000 bets (todos los días)
Query: Lento pero funciona (60-90 segundos)
```

### Después del Archive
```
Main tables: 800 bets (últimos 2 días)
Archive tables: 4,200 bets (históricos)

Problema:
- Si fecha está en main → Query más rápido (menos datos)
- Si fecha está en archive → ERROR (no se puede UPDATE)
- Si hay mal query plan → Timeout
```

## Conclusión

El timeout NO es culpa del sistema de archive directamente, sino que:

1. **El RPC siempre fue pesado** (operación compleja)
2. **Archive expone el problema** al mover datos
3. **Falta optimización** (índices, timeout, validaciones)
4. **No hay manejo de archived data** (falla silenciosamente si data está en archive)

### Acción Requerida

1. ✅ **AHORA**: Aumentar statement_timeout a 5 minutos
2. ✅ **AHORA**: Agregar índices faltantes
3. ✅ **PRONTO**: Validar que data esté en main antes de generar winners
4. 🔮 **FUTURO**: Considerar refactorizar el RPC para mejor performance
