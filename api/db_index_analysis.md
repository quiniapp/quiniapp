# Análisis de Índices - Base de Datos QuiniApp

**Fecha:** 2025-11-21
**Objetivo:** Auditoría Día 1 - Identificar índices problemáticos y oportunidades de optimización

---

## 📊 Resumen Ejecutivo

### Hallazgos Clave
- ✅ **Tablas críticas bien indexadas**: `bets`, `results` tienen índices funcionales
- 🔥 **PKs más usadas**: `lotteries` (215k), `schedules` (202k), `tickets` (23k)
- ⚠️ **4 índices sin uso** ocupando 64KB (candidatos a eliminar)
- 🚨 **Tabla `tickets` necesita índices compuestos** para queries frecuentes
- ❓ **Tabla `winners` no aparece** en el análisis (verificar si existe)

### Métricas Generales
- **Tabla más grande**: `bets` (6.9 MB total, 4.7 MB datos + 2.2 MB índices)
- **Total índices sin uso**: 4 (64 KB desperdiciados)
- **Índices más usados**: `lotteries_pkey` (215k), `schedules_pkey` (202k)

---

## 🗂️ Análisis por Tabla

### 1. BETS (Tabla más grande: 6.9 MB)

**Tamaños:**
- Datos: 4.7 MB
- Índices: 2.2 MB (32% overhead)

**Índices existentes (✅ todos funcionan bien):**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `bets_pkey` | `bet_id` | 28 | ✅ PK |
| `idx_bets_schedule_date` | `date, schedule_id` | 2,708 | 🔥 MUY USADO |
| `idx_bets_ticket_id` | `ticket_id` | 1,709 | 🔥 MUY USADO |
| `idx_bets_user_id` | `user_id` | 636 | ✅ Bien |
| `idx_bets_lottery_id` | `lottery_id` | 459 | ✅ Bien |
| `idx_bets_ticket_order` | `ticket_id, bet_order` | 250 | ✅ Bien |

**Análisis:**
- ✅ La tabla `bets` está **muy bien indexada**
- ✅ Los índices más importantes (`schedule_date`, `ticket_id`) son los más usados
- ✅ No hay índices sin uso
- ✅ No se requieren cambios inmediatos

**Recomendaciones:**
- 🟢 Mantener índices actuales
- 🟡 Monitorear crecimiento (es la tabla más grande)

---

### 2. TICKETS (104 KB total, 24 KB datos + 80 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `tickets_pkey` | `ticket_id` | 23,417 | 🔥 MUY USADO |
| `idx_tickets_user_id` | `user_id` | 141 | ✅ Usado |
| `unique_ticket_number` | `ticket_number` | 203 | ✅ Usado |

**Problemas identificados:**
- 🚨 **FALTA índice compuesto** `(user_id, date DESC)` para queries tipo "tickets de un usuario en rango de fechas"
- 🚨 **FALTA índice compuesto** `(date DESC, winner, paid)` para búsquedas de ganadores por fecha
- 🚨 **FALTA índice simple** en `date` para queries generales por fecha
- ⚠️ **FALTA índice** en `(winner, paid)` para reportes de tickets ganadores no pagados

**Queries afectadas (probables):**
```sql
-- Tickets de un usuario por fecha (común en reportes)
SELECT * FROM tickets WHERE user_id = ? AND date BETWEEN ? AND ?;

-- Tickets ganadores no pagados (común en dashboard)
SELECT * FROM tickets WHERE winner = true AND paid = false;

-- Tickets del día
SELECT * FROM tickets WHERE date = CURRENT_DATE;
```

**Recomendaciones:**
- 🔴 **ALTA PRIORIDAD**: Agregar índice `(user_id, date DESC)`
- 🔴 **ALTA PRIORIDAD**: Agregar índice `(date DESC)`
- 🟡 **MEDIA PRIORIDAD**: Agregar índice `(winner, paid)` con filtro parcial

---

### 3. RESULTS (32 KB total, 8 KB datos + 24 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `idx_results_schedule_date` | `date, schedule_id` | 5,513 | 🔥 MUY USADO |
| `results_pkey` | `results_id` | 360 | ✅ PK |
| `idx_results_schedule_id_date` | `date, schedule_id` | 81 | ⚠️ Redundante? |
| `unique_lottery_schedule_date_active` | `date, lottery_id, schedule_id` | 73 | ✅ Constraint |
| `idx_lottery_results_lottery_id_date` | `date, lottery_id` | 54 | ✅ Usado |
| `idx_results_schedule_id` | `schedule_id` | 29 | ⚠️ Poco usado |
| `idx_results_lottery_id` | `lottery_id` | 21 | ⚠️ Poco usado |

**Problemas identificados:**
- ⚠️ **POSIBLE REDUNDANCIA**: `idx_results_schedule_date` vs `idx_results_schedule_id_date`
  - Ambos tienen las mismas columnas (date, schedule_id)
  - Uno tiene 5,513 usos, el otro solo 81 usos
  - **Acción**: Verificar si son idénticos y eliminar el menos usado

- ⚠️ **Índices simples poco usados**:
  - `idx_results_schedule_id` (29 usos) - posiblemente cubierto por índices compuestos
  - `idx_results_lottery_id` (21 usos) - posiblemente cubierto por índices compuestos

**Recomendaciones:**
- 🟡 **Investigar redundancia**: Comparar `idx_results_schedule_date` vs `idx_results_schedule_id_date`
- 🟢 Mantener `unique_lottery_schedule_date_active` (constraint de negocio)
- 🟡 Evaluar si los índices simples son necesarios o están cubiertos por compuestos

---

### 4. TICKET_PRIZES_BY_TURN (104 KB total, 8 KB datos + 96 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `ticket_prizes_by_turn_pkey` | `ticket_id, schedule_id, date` | 0 | 🚨 SIN USO |
| `idx_tpt_ticket` | `ticket_id` | 0 | 🚨 SIN USO |
| `idx_tpt_date_schedule` | `schedule_id, date` | 15 | ✅ Usado |
| `idx_tpt_date` | `date` | 15 | ✅ Usado |

**Problemas CRÍTICOS:**
- 🚨 **PK sin uso (0 usos)**: Muy extraño que la PK no se use
  - **Posible causa**: Se accede a la tabla siempre por índices secundarios
  - **Acción**: Investigar queries que acceden a esta tabla

- 🚨 **Índice sin uso**: `idx_tpt_ticket` nunca se usa
  - **Acción**: Eliminar este índice

**Contexto del negocio:**
- Esta tabla almacena premios por turno de cada ticket
- Según el plan, ~80% de las filas tienen `prize_turn = 0` (sin premio)
- Plan de FASE 1 incluye purga de estas filas

**Recomendaciones:**
- 🔴 **INMEDIATO**: Eliminar `idx_tpt_ticket` (sin uso, desperdicia espacio)
- 🔴 **INVESTIGAR**: Por qué la PK tiene 0 usos (podría indicar problema de diseño)
- 🟡 **Después de purga**: Re-evaluar índices (la tabla reducirá ~80% en tamaño)
- 🟢 Mantener `idx_tpt_date_schedule` y `idx_tpt_date` (son los que se usan)

---

### 5. USERS (64 KB total, 8 KB datos + 56 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `users_pkey` | `user_id` | 1 | ✅ PK |
| `unique_number_when_not_deleted` | ? | 0 | 🚨 SIN USO |
| `unique_username_not_deleted` | ? | 0 | 🚨 SIN USO |

**Problemas identificados:**
- 🚨 **2 índices únicos sin uso**: Ocupan 32 KB sin beneficio
  - Probablemente constraints de unicidad condicional (cuando deleted = false)
  - **Acción**: Verificar si son necesarios para integridad o se pueden eliminar

**Recomendaciones:**
- 🟡 **Investigar**: ¿Estos índices son para constraints de negocio?
- 🟡 Si son solo para unicidad y no se consultan: **Considerar eliminar**
- 🟢 Si son constraints críticos: **Mantener pero documentar**

---

### 6. LOTTERIES (32 KB total, 8 KB datos + 24 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `lotteries_pkey` | `lottery_id` | 215,484 | 🔥🔥🔥 CRÍTICO |

**Análisis:**
- ✅ **Índice más usado de toda la DB** (215k usos)
- ✅ Tabla pequeña, bien optimizada
- ✅ No requiere cambios

---

### 7. SCHEDULES (32 KB total, 8 KB datos + 24 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `schedules_pkey` | `schedule_id` | 202,755 | 🔥🔥🔥 CRÍTICO |

**Análisis:**
- ✅ **Segundo índice más usado** (202k usos)
- ✅ Tabla pequeña, bien optimizada
- ✅ No requiere cambios

---

### 8. CURRENT_ACCOUNTS (208 KB total, 88 KB datos + 120 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `current_accounts_pkey` | ? | 205 | ✅ PK |
| `current_accounts_user_date_uniq` | ? | 9,166 | 🔥 MUY USADO |

**Análisis:**
- ✅ Índice compuesto `user_date_uniq` muy bien usado (9k usos)
- ✅ Funcionando correctamente
- ✅ No requiere cambios

---

### 9. SCHEDULE_LOTTERIES (144 KB total, 32 KB datos + 112 KB índices)

**Índices existentes:**

| Índice | Columnas | Usos | Estado |
|--------|----------|------|--------|
| `schedule_lotteries_pkey` | ? | 9 | ✅ PK |
| `unique_schedule_lottery_day` | ? | 8,066 | 🔥 MUY USADO |

**Análisis:**
- ✅ Índice compuesto muy bien usado (8k usos)
- ✅ Funcionando correctamente
- ✅ No requiere cambios

---

### ❓ 10. WINNERS (NO APARECE EN ANÁLISIS)

**Problema:**
- La tabla `winners` no aparece en la Query 4
- Según el plan, esta tabla tiene queries pesadas con joins

**Acciones requeridas:**
- 🔴 **VERIFICAR**: ¿La tabla existe?
- 🔴 **INVESTIGAR**: ¿Qué índices tiene actualmente?
- 🔴 **Ejecutar query específica**:

```sql
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'winners' AND schemaname = 'public';
```

---

## 🎯 Resumen de Acciones Inmediatas

### 🔴 PRIORIDAD ALTA (Hacer esta semana)

#### 1. Agregar índices CRÍTICOS en `tickets`:
```sql
-- Índice compuesto para queries de usuario + fecha
CREATE INDEX CONCURRENTLY idx_tickets_user_date
ON tickets(user_id, date DESC);

-- Índice simple para queries generales por fecha
CREATE INDEX CONCURRENTLY idx_tickets_date
ON tickets(date DESC);

-- Índice para ganadores no pagados (con filtro parcial)
CREATE INDEX CONCURRENTLY idx_tickets_winner_paid
ON tickets(winner, paid)
WHERE winner = true;
```

#### 2. Eliminar índices sin uso:
```sql
-- Ticket prizes by turn
DROP INDEX IF EXISTS idx_tpt_ticket;

-- Users (verificar primero si son constraints necesarios)
-- DROP INDEX IF EXISTS unique_number_when_not_deleted;
-- DROP INDEX IF EXISTS unique_username_not_deleted;
```

#### 3. Investigar tabla `winners`:
- Verificar si existe
- Listar sus índices actuales
- Identificar necesidades de indexación

---

### 🟡 PRIORIDAD MEDIA (Próxima semana)

#### 1. Investigar redundancia en `results`:
```sql
-- Comparar estos dos índices
SELECT * FROM pg_indexes
WHERE indexname IN ('idx_results_schedule_date', 'idx_results_schedule_id_date');
```

#### 2. Evaluar índices poco usados en `results`:
- `idx_results_schedule_id` (29 usos)
- `idx_results_lottery_id` (21 usos)
- Verificar si están cubiertos por índices compuestos

---

### 🟢 PRIORIDAD BAJA (Futuro)

#### 1. Después de purga de `ticket_prizes_by_turn`:
- Re-evaluar todos los índices de esta tabla
- La tabla reducirá ~80% en tamaño
- Posiblemente necesite diferentes índices

#### 2. Monitorear crecimiento de `bets`:
- Es la tabla más grande (6.9 MB)
- Crecerá más rápido que otras
- Revisar índices cuando supere 10-20 MB

---

## 📈 Impacto Esperado

### Después de agregar índices en `tickets`:

**Query: Tickets de usuario por fecha**
```sql
-- ANTES: Full table scan
EXPLAIN ANALYZE
SELECT * FROM tickets WHERE user_id = 123 AND date BETWEEN '2024-01-01' AND '2024-12-31';

-- DESPUÉS: Index scan
-- Mejora esperada: 60-80% más rápido
```

**Query: Ganadores no pagados**
```sql
-- ANTES: Full table scan con filtros
EXPLAIN ANALYZE
SELECT * FROM tickets WHERE winner = true AND paid = false;

-- DESPUÉS: Index scan con partial index
-- Mejora esperada: 70-90% más rápido
```

### Después de eliminar índices sin uso:

- **Espacio liberado**: ~64 KB
- **INSERT/UPDATE más rápidos**: Menos índices que mantener
- **Limpieza del schema**: Más claro qué índices importan

---

## 📋 Checklist Día 1 (Completado)

- [x] Ejecutar queries de diagnóstico en Supabase
- [x] Analizar índices actuales por tabla
- [x] Identificar índices sin uso
- [x] Identificar índices faltantes críticos
- [x] Documentar findings en este archivo
- [ ] Validar con queries en repositories (DÍA 2)

---

## 🚀 Próximos Pasos (Día 2)

1. **Revisar repositories** para confirmar queries más frecuentes:
   - `api/src/ticket/repository`
   - `api/src/bet/repository`
   - `api/src/results/repository`
   - `api/src/winners/repository`

2. **Investigar tabla `winners`**:
   - ¿Existe?
   - ¿Qué índices tiene?
   - ¿Qué queries hace?

3. **Crear archivo de migración SQL** con todos los cambios

4. **Ejecutar EXPLAIN ANALYZE** en queries problemáticas para confirmar mejoras

---

**Fin del análisis Día 1** ✅
