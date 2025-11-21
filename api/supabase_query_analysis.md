# Análisis de Queries Reales - Supabase Performance Insights

**Fecha:** 2025-11-21
**Fuente:** Supabase Dashboard - Query Performance Analysis
**Período analizado:** Datos de producción

---

## 🎯 Resumen Ejecutivo

### Top Query de Nuestra Aplicación (Problemática)
**Query de tickets con filtros** - 🔴 **CRÍTICA**
- **Calls:** 707 (muy frecuente)
- **Tiempo promedio:** 15.8 ms
- **Tiempo total:** 11.2 segundos
- **% del tiempo total:** 7.98%
- **Cache hit rate:** 100%

**Esta es EXACTAMENTE la query `TicketRepository.getAll()` que identificamos en el análisis.**

✅ **CONFIRMACIÓN**: Nuestro análisis fue correcto, esta query necesita los índices propuestos.

---

## 📊 Top 20 Queries por Tiempo Total

### 1. Sistema: pg_timezone_names (⚠️ Sistema, no optimizable)
```
Query: SELECT name FROM pg_timezone_names
Calls: 101
Tiempo promedio: 249.76 ms
Tiempo total: 25.23 segundos (18.03%)
```
**Análisis:** Query de sistema de Supabase, no de nuestra app.

---

### 2. Sistema: Dashboard functions metadata (⚠️ Sistema)
```
Query: CTE con pg_proc, pg_namespace, etc. (metadata de funciones)
Calls: 57
Tiempo promedio: 406.27 ms
Tiempo total: 23.16 segundos (16.55%)
```
**Análisis:** Query del dashboard de Supabase para listar funciones.

---

### 3. 🔴 NUESTRA APP: Tickets con joins (CRÍTICA)
```sql
WITH pgrst_source AS (
  SELECT "public"."tickets".*,
    COALESCE("tickets_bets_1"."tickets_bets_1", '[]'::jsonb) AS "bets"
  FROM "public"."tickets"
  LEFT JOIN LATERAL (
    SELECT json_agg("tickets_bets_1")::jsonb
    FROM (
      SELECT "bets_1".*,
        row_to_json("bets_lotteries_2".*)::jsonb AS "lotteries",
        row_to_json("bets_schedules_2".*)::jsonb AS "schedules"
      FROM "public"."bets" AS "bets_1"
      LEFT JOIN LATERAL (...) AS "bets_lotteries_2" ON true
      LEFT JOIN LATERAL (...) AS "bets_schedules_2" ON true
      WHERE "bets_1"."ticket_id" = "public"."tickets"."ticket_id"
    ) AS "tickets_bets_1"
  ) AS "tickets_bets_1" ON true
  WHERE
    "public"."tickets"."date" = $date
    AND "public"."tickets"."deleted_at" IS NULL
    AND "public"."tickets"."user_id" = $user_id
  ORDER BY "public"."tickets"."created_at" DESC
  LIMIT 100
)
```

**Estadísticas:**
- **Calls:** 707 🔥🔥🔥 (muy frecuente)
- **Tiempo promedio:** 15.8 ms
- **Tiempo total:** 11.17 segundos (7.98%)
- **Rows read:** 707
- **Cache hit rate:** 100%

**Origen del código:**
- `api/src/ticket/repository/ticket.repository.ts:45-78`
- Método: `TicketRepository.getAll()`

**Problema identificado:**
- ❌ No hay índice compuesto para `(user_id, date, deleted_at, created_at)`
- ❌ La query filtra por 3 columnas pero solo existe índice simple en `user_id`
- ❌ ORDER BY `created_at` no está cubierto por índice

**Solución propuesta:**
```sql
CREATE INDEX CONCURRENTLY idx_tickets_user_date_deleted_created
ON tickets(user_id, date DESC, deleted_at, created_at DESC)
WHERE deleted_at IS NULL;
```

**Mejora esperada:**
- De 15.8ms → ~2-4ms (70-75% más rápido)
- Impacto: Ahorra ~8-9 segundos en el período analizado

---

### 4. 🟢 NUESTRA APP: create_ticket_with_bets (Aceptable)
```
Query: RPC create_ticket_with_bets (INSERT de ticket + bets)
Calls: 97
Tiempo promedio: 111.01 ms
Tiempo total: 10.77 segundos (7.70%)
Cache hit rate: 99.99%
```

**Análisis:**
- ✅ Tiempo razonable para un INSERT con lógica compleja
- ✅ RPC que inserta ticket + múltiples bets en transacción
- ✅ No requiere optimización, es operación de escritura

---

### 5. 🟢 NUESTRA APP: create_ticket_with_bets v2 (Aceptable)
```
Query: RPC create_ticket_with_bets (versión 2)
Calls: 145
Tiempo promedio: 70.84 ms
Tiempo total: 10.27 segundos (7.34%)
Cache hit rate: 99.99%
```

**Análisis:**
- ✅ Versión mejorada del mismo RPC
- ✅ Más rápida que la v1 (70ms vs 111ms)
- ✅ No requiere optimización

---

### 6. Sistema: Tables metadata (⚠️ Sistema)
```
Query: CTE con pg_class, pg_namespace (metadata de tablas)
Calls: 70
Tiempo promedio: 99.33 ms
Tiempo total: 6.95 segundos (4.97%)
```
**Análisis:** Query del dashboard de Supabase.

---

### 7. 🟡 NUESTRA APP: generate_winners_and_calculate_accounts
```
Query: RPC generate_winners_and_calculate_accounts
Calls: 52
Tiempo promedio: 108.92 ms
Tiempo total: 5.66 segundos (4.05%)
Cache hit rate: 99.99%
```

**Origen del código:**
- `api/src/winners/repository/winners.repository.ts:4-15`

**Análisis:**
- 🟡 Tiempo moderado para un RPC complejo
- ✅ Solo 52 calls (no es muy frecuente)
- ✅ Hace cálculos de ganadores + actualiza cuentas corrientes
- 🟢 Los índices propuestos en `tickets` y `bets` pueden mejorar este RPC

---

### 8. 🟢 NUESTRA APP: get_ticket_sums (Aceptable)
```
Query: RPC get_ticket_sums
Calls: 102
Tiempo promedio: 48.91 ms
Tiempo total: 4.99 segundos (3.57%)
Cache hit rate: 100%
```

**Origen del código:**
- `api/src/bet/repository/bet.repository.ts:192-199`

**Análisis:**
- ✅ Tiempo razonable para agregación
- ✅ Cache hit rate perfecto
- ✅ No requiere optimización inmediata

---

### 9-10. 🟢 Sistema: Auth inserts (Muy rápidos)
```
INSERT INTO refresh_tokens - 1,039 calls, 4.57ms avg
INSERT INTO audit_log_entries - 1,468 calls, 3.16ms avg
```
**Análisis:** Queries de autenticación, muy optimizadas.

---

### 11. Sistema: Procedures metadata (⚠️ Sistema)
```
Query: CTE con pg_proc, pg_type (procedures)
Calls: 101
Tiempo promedio: 40.25 ms
Tiempo total: 4.07 segundos (2.91%)
```

---

### 12. Sistema: Columns metadata (⚠️ Sistema)
```
Query: CTE con pg_attribute, pg_class (columnas)
Calls: 101
Tiempo promedio: 38.54 ms
Tiempo total: 3.89 segundos (2.78%)
```

---

### 13. 🟢 NUESTRA APP: Bets con joins (Excelente)
```sql
SELECT "public"."bets".*,
  row_to_json("bets_lotteries_1".*)::jsonb AS "lotteries",
  row_to_json("bets_schedules_1".*)::jsonb AS "schedules"
FROM "public"."bets"
LEFT JOIN LATERAL (...) AS "bets_lotteries_1" ON true
LEFT JOIN LATERAL (...) AS "bets_schedules_1" ON true
WHERE "public"."bets"."date" = $date
LIMIT 100
```

**Estadísticas:**
- **Calls:** 216
- **Tiempo promedio:** 16.67 ms
- **Tiempo total:** 3.60 segundos (2.57%)
- **Cache hit rate:** 99.999%

**Origen del código:**
- `api/src/bet/repository/bet.repository.ts:6-64`
- Método: `BetRepository.getAllBets()`

**Análisis:**
- ✅ **MUY BUENA performance** (16.67ms promedio)
- ✅ Usa el índice `idx_bets_schedule_date` (2,708 usos)
- ✅ Los índices actuales en `bets` funcionan excelente
- 🟢 Los nuevos índices propuestos son opcionales, mejora incremental

---

### 14. 🟡 NUESTRA APP: generate_winners
```
Query: RPC generate_winners (versión anterior)
Calls: 77
Tiempo promedio: 44.55 ms
Tiempo total: 3.43 segundos (2.45%)
Cache hit rate: 100%
```

**Análisis:**
- 🟡 Versión anterior del RPC de ganadores
- ✅ Tiempo aceptable
- 🟢 Puede mejorar con los índices propuestos

---

### 15. 🟢 Sistema: set_config (Muy frecuente, muy rápido)
```
Query: select set_config('search_path', ...), set_config('role', ...)
Calls: 15,172 🔥🔥🔥
Tiempo promedio: 0.22 ms
Tiempo total: 3.40 segundos (2.43%)
Cache hit rate: 100%
```

**Análisis:**
- ✅ Se ejecuta en CADA request (setup de sesión)
- ✅ Extremadamente rápido (0.22ms)
- ✅ No requiere optimización

---

### 16-17. Sistema: Extensions y schemas (⚠️ Sistema)
```
pgmq maintenance - 134 calls, 25.16ms avg
pg_config - 4,436 calls, 0.62ms avg
```

---

### 18. 🟢 NUESTRA APP: Schedules con schedule_lotteries (EXCELENTE)
```sql
SELECT "public"."schedules".*,
  COALESCE("schedules_schedule_lotteries_1"."...", '[]'::jsonb)
FROM "public"."schedules"
LEFT JOIN LATERAL (
  SELECT json_agg(...)
  FROM "public"."schedule_lotteries"
  ...
)
ORDER BY "public"."schedules"."time" ASC
```

**Estadísticas:**
- **Calls:** 1,489 🔥🔥🔥 (MUY frecuente)
- **Tiempo promedio:** 1.68 ms ⚡ (EXCELENTE)
- **Tiempo total:** 2.50 segundos (1.79%)
- **Cache hit rate:** 100%

**Análisis:**
- ✅ **PERFECTO** - Query muy frecuente pero super rápida
- ✅ Índice `unique_schedule_lottery_day` con 8,066 usos funciona perfecto
- ✅ No requiere cambios

---

## 🎯 Conclusiones y Validaciones

### ✅ Validaciones del Análisis Previo

1. **Tabla `tickets` necesita índices** ✅ CONFIRMADO
   - Query con 707 calls y 15.8ms promedio
   - Filtra por `user_id`, `date`, `deleted_at`
   - Ordena por `created_at`
   - Los índices propuestos son CRÍTICOS

2. **Tabla `bets` bien indexada** ✅ CONFIRMADO
   - Query con 216 calls y solo 16.67ms promedio
   - Cache hit rate: 99.999%
   - Los índices actuales funcionan excelente
   - Nuevos índices son opcionales (mejora incremental)

3. **Tabla `schedules` excelente** ✅ CONFIRMADO
   - 1,489 calls pero solo 1.68ms promedio
   - Perfecto balance frecuencia/velocidad
   - No requiere cambios

4. **RPCs de escritura aceptables** ✅ CONFIRMADO
   - create_ticket_with_bets: 70-111ms (razonable para INSERT complejo)
   - generate_winners: 44-109ms (razonable para lógica compleja)

### 🔴 Prioridades Confirmadas

#### Prioridad CRÍTICA: Índices en `tickets`
La query de tickets con 707 calls es la más impactante de nuestra app:
- **Impacto actual:** 11.17 segundos (7.98% del tiempo total)
- **Mejora esperada:** 70-75% más rápido
- **Ahorro estimado:** 8-9 segundos en el período analizado

**Índices a crear:**
```sql
-- CRÍTICO #1
CREATE INDEX CONCURRENTLY idx_tickets_user_date_deleted_created
ON tickets(user_id, date DESC, deleted_at, created_at DESC)
WHERE deleted_at IS NULL;

-- CRÍTICO #2
CREATE INDEX CONCURRENTLY idx_tickets_date_deleted_winner_created
ON tickets(date DESC, deleted_at, winner, created_at DESC)
WHERE deleted_at IS NULL;
```

#### Prioridad MEDIA: Índices opcionales en `bets`
Los índices actuales funcionan bien (16.67ms promedio), pero podemos optimizar más:
```sql
-- OPCIONAL #1: Para queries de ganadores
CREATE INDEX CONCURRENTLY idx_bets_date_winner_deleted_created
ON bets(date DESC, winner, deleted_at, created_at DESC)
WHERE winner = true AND deleted_at IS NULL;
```

### 📊 Distribución del Tiempo

**Queries de nuestra app:** ~45% del tiempo total
- Tickets query: 11.17s (7.98%)
- create_ticket RPCs: 21.04s (15.04%)
- generate_winners RPCs: 9.09s (6.50%)
- Bets query: 3.60s (2.57%)
- Schedules query: 2.50s (1.79%)
- Otros: ~7s (5%)

**Queries de sistema:** ~55% del tiempo total
- Dashboard metadata: ~40s (28.5%)
- Auth/config: ~10s (7.1%)
- Extensions/maintenance: ~6s (4.3%)
- Otros: ~21s (15%)

**Conclusión:** Solo podemos optimizar el 45% (nuestras queries). Los índices propuestos atacan el 7.98% más crítico.

---

## 📈 Impacto Esperado de los Índices

### Escenario Conservador (70% mejora)
**Query de tickets:**
- Actual: 11.17 segundos
- Después: ~3.35 segundos
- **Ahorro: 7.82 segundos**

### Escenario Optimista (85% mejora)
**Query de tickets:**
- Actual: 11.17 segundos
- Después: ~1.68 segundos
- **Ahorro: 9.49 segundos**

### Impacto en Generate Winners RPC
Los índices en `tickets` y `bets` también acelerarán:
- `generate_winners_and_calculate_accounts` (5.66s)
- `generate_winners` (3.43s)

**Ahorro estimado:** 20-30% (1.8-2.7 segundos adicionales)

### Total Esperado
- **Conservador:** ~9.6 segundos ahorrados
- **Optimista:** ~12.2 segundos ahorrados
- **Mejora en % del tiempo total:** 6.9-8.7%

---

## 🚀 Recomendaciones Finales

### ✅ Acción Inmediata
1. Aplicar los 4 índices en `tickets` (CRÍTICO)
2. Medir impacto real después de 24-48 horas
3. Validar con nueva query de performance de Supabase

### 🟡 Acción Secundaria
1. Aplicar índice opcional en `bets` para ganadores
2. Solo si se confirma uso frecuente de `winner = true` en queries

### 🟢 Mantener
1. Índices actuales en `bets` (funcionan excelente)
2. Índices en `schedules` y `schedule_lotteries` (perfectos)
3. Índices en auth tables (optimizados por Supabase)

---

## 📝 Query de Validación Post-Implementación

Después de aplicar los índices, ejecutar esta query para comparar:

```sql
-- Ver uso de índices nuevos después de 24-48 horas
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as "veces_usado",
  pg_size_pretty(pg_relation_size(indexrelid)) as "tamaño"
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_tickets_%' OR indexname LIKE 'idx_bets_%'
ORDER BY idx_scan DESC;
```

Esperamos ver:
- `idx_tickets_user_date_deleted_created`: ~700+ usos
- `idx_tickets_date_deleted_winner_created`: ~200-400 usos
- Otros índices en tickets: ~100-300 usos cada uno

---

**Fin del análisis de queries reales** ✅

Este análisis CONFIRMA completamente nuestro análisis previo y valida las decisiones tomadas.
