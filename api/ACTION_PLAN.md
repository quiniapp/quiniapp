# Plan de Acción - Optimización y Features QuiniApp API

**Fecha de creación:** 2025-11-20
**Objetivo:** Priorizar TODOs por impacto en rendimiento y valor de negocio

---

## 🎯 Criterios de Priorización

### Impacto en Rendimiento (Performance)
- **Crítico**: Afecta directamente la velocidad de queries principales
- **Alto**: Mejora notable en tiempo de respuesta
- **Medio**: Optimización incremental
- **Bajo**: Mejora marginal

### Valor de Negocio
- **Crítico**: Bloquea operaciones o causa problemas graves
- **Alto**: Feature clave para análisis y toma de decisiones
- **Medio**: Mejora experiencia pero no es bloqueante
- **Bajo**: Nice-to-have

### Complejidad
- **Alta**: 2-3 semanas
- **Media**: 3-7 días
- **Baja**: 1-2 días

---

## 📊 Matriz de Priorización

| TODO | Performance | Negocio | Complejidad | Prioridad Final | Tiempo |
|------|-------------|---------|-------------|-----------------|--------|
| **Índices DB** | Crítico | Alto | Media | **P0 - URGENTE** | 3-4 días |
| **Purga ticket_prizes_by_turn** | Alto | Bajo | Baja | **P1 - Alta** | 1 día |
| **Reportes Básicos** | Medio | Crítico | Media | **P1 - Alta** | 1-2 semanas |
| **Números Atrasados** | Bajo | Medio | Baja | **P2 - Media** | 2 días |
| **Archivado de Datos** | Alto | Medio | Alta | **P3 - Futura** | 2-3 semanas |
| **Reportes Avanzados** | Medio | Alto | Alta | **P3 - Futura** | 4-6 semanas |

---

## 🚀 FASE 1: Quick Wins de Performance (1 semana)

### **P0 - Revisión y Optimización de Índices** ⚡
**Impacto:** Crítico en rendimiento
**Tiempo:** 3-4 días
**Razón:** Es la mejora de performance más rápida y con mayor impacto inmediato

#### Día 1: Auditoría
- [ ] Ejecutar queries de diagnóstico en Supabase
- [ ] Listar todos los índices actuales por tabla
- [ ] Identificar índices faltantes críticos
- [ ] Identificar índices redundantes o no utilizados
- [ ] Documentar findings en spreadsheet

**Queries a ejecutar:**
```sql
-- Índices no utilizados
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Tamaño de índices
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Queries lentas
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;
```

#### Día 2: Análisis de Queries
- [ ] Revisar queries más frecuentes en repositories
- [ ] Ejecutar EXPLAIN ANALYZE en queries problemáticas
- [ ] Identificar columnas sin índices en WHERE/ORDER BY
- [ ] Priorizar índices por impacto esperado
- [ ] Crear lista de índices a agregar/eliminar

**Módulos prioritarios:**
1. `ticket/repository` (queries más frecuentes)
2. `bet/repository` (volumen alto)
3. `results/repository` (queries complejas)
4. `winners/repository` (joins pesados)

#### Día 3: Implementación
- [ ] Crear archivo de migración SQL con índices
- [ ] Benchmark ANTES: medir tiempos actuales
- [ ] Aplicar índices en ambiente de desarrollo
- [ ] Medir impacto en queries específicas
- [ ] Validar que no hay degradación en INSERTs

**Índices críticos a crear (ejemplo):**
```sql
-- Tickets: queries más frecuentes
CREATE INDEX CONCURRENTLY idx_tickets_user_date_status
  ON tickets(user_id, date DESC, winner, paid);

-- Bets: búsquedas por ticket y fecha
CREATE INDEX CONCURRENTLY idx_bets_ticket_date
  ON bets(ticket_id, date DESC);

-- Results: crítico para generación de ganadores
CREATE INDEX CONCURRENTLY idx_results_lottery_schedule_date
  ON results(lottery_id, schedule_id, date DESC);

-- Winners: búsquedas de no pagados
CREATE INDEX CONCURRENTLY idx_winners_paid_date
  ON winners(paid, date DESC) WHERE paid = false;
```

#### Día 4: Testing y Deploy
- [ ] Benchmark DESPUÉS: comparar con baseline
- [ ] Documentar mejoras específicas por query
- [ ] Preparar plan de rollback
- [ ] Aplicar en producción en horario de bajo tráfico
- [ ] Monitorear performance post-deploy

**Métricas a medir:**
- Tiempo de respuesta de `/api/private/tickets` (esperado: -30-50%)
- Tiempo de `generate_winners` RPC (esperado: -20-40%)
- Tiempo de queries a `results` (esperado: -40-60%)

---

### **P1 - Purga de ticket_prizes_by_turn** 🧹
**Impacto:** Alto en rendimiento, bajo en riesgo
**Tiempo:** 1 día (después de índices)
**Razón:** Quick win, reduce ~80% de filas, mínimo riesgo

#### Mañana: Desarrollo
- [ ] Crear stored procedure `purge_non_winner_prizes_by_turn`
- [ ] Implementar con período de retención de 60 días
- [ ] Agregar logging y estadísticas de retorno
- [ ] Crear endpoint opcional para admin (si hay tiempo)

**SQL:**
```sql
CREATE OR REPLACE FUNCTION purge_non_winner_prizes_by_turn(
  p_days_to_keep INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INT;
  v_cutoff_date DATE;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_days_to_keep;

  DELETE FROM ticket_prizes_by_turn
  WHERE prize_turn = 0
    AND hits_turn = 0
    AND date < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_rows', v_deleted_count,
    'cutoff_date', v_cutoff_date,
    'days_kept', p_days_to_keep
  );
END;
$$;
```

#### Tarde: Testing y Ejecución
- [ ] Probar en ambiente dev con datos de test
- [ ] Validar que solo elimina `prize_turn = 0`
- [ ] Ejecutar una vez manualmente en producción
- [ ] Medir espacio liberado
- [ ] Documentar resultados

**Resultado esperado:**
- Reducción de ~80% en filas de tabla
- Queries a `totals_per_day` más rápidas (~20-30%)
- Espacio liberado en disco

---

## 📈 FASE 2: Reportes Esenciales (1-2 semanas)

### **P1 - Reportes Básicos de Tickets y Financieros** 📊
**Impacto:** Crítico para negocio, medio en performance
**Tiempo:** 1-2 semanas
**Razón:** Necesario para toma de decisiones y análisis del negocio

#### Semana 1: Backend Foundation
**Días 1-2: Setup y estructura**
- [ ] Crear módulo `api/src/reports/`
- [ ] Estructura de carpetas: controller, repository, route, types
- [ ] Configurar rutas base `/api/private/reports`
- [ ] Integrar CacheManager para reportes (TTL: 5-15 min)

**Día 3: Reportes de Tickets**
- [ ] RPC `get_tickets_per_day(start_date, end_date, user_id)`
- [ ] Endpoint `GET /api/private/reports/tickets/per-day`
- [ ] RPC `get_daily_average_ticket(start_date, end_date)`
- [ ] Endpoint `GET /api/private/reports/tickets/average-per-day`

**Día 4: Reportes de Bets**
- [ ] RPC `get_bets_per_day(start_date, end_date, user_id)`
- [ ] Endpoint `GET /api/private/reports/bets/per-day`
- [ ] RPC `get_average_bets_per_ticket(start_date, end_date)`
- [ ] Endpoint `GET /api/private/reports/bets/average-per-ticket`

**Día 5: Reportes Financieros**
- [ ] RPC `get_financial_report(start_date, end_date)`
- [ ] Endpoint `GET /api/private/reports/financial/summary`
- [ ] RPC `get_unpaid_prizes_report()`
- [ ] Endpoint `GET /api/private/reports/financial/unpaid-prizes`

#### Semana 2: Dashboard y Frontend
**Días 1-2: Dashboard Backend**
- [ ] RPC `get_dashboard_summary()` (métricas del día)
- [ ] Endpoint `GET /api/private/reports/dashboard/summary`
- [ ] Caché agresivo (TTL: 5 min)
- [ ] Incluir comparación con día anterior

**Métricas del dashboard:**
```typescript
interface DashboardSummary {
  today: {
    total_tickets: number;
    total_income: number;
    total_prizes: number;
    net_profit: number;
    tickets_pending_payment: number;
  };
  yesterday: { /* same structure */ };
  change_percentage: {
    tickets: number;
    income: number;
    profit: number;
  };
}
```

**Días 3-4: Frontend Integration**
- [ ] Crear hooks: `useTicketsPerDay()`, `useFinancialReport()`
- [ ] Hook `useDashboardSummary()` con auto-refresh
- [ ] Componente básico `<DashboardCard>` para métricas
- [ ] Componente `<ReportTable>` reutilizable

**Día 5: Testing y Optimización**
- [ ] Tests de performance con datos reales
- [ ] Validar cálculos contra DB directamente
- [ ] Optimizar queries lentas
- [ ] Documentar endpoints

---

## 🎲 FASE 3: Features de Estadísticas (1 semana)

### **P2 - Números Atrasados (Delayed Numbers)** 🔢
**Impacto:** Medio en negocio, bajo en performance
**Tiempo:** 2 días
**Razón:** Feature solicitada, valor para usuarios, implementación sencilla

#### Día 1: Backend
- [ ] Crear módulo `api/src/stats/`
- [ ] RPC `get_delayed_numbers(lottery_id, schedule_id, position, lookback_days, number_type)`
- [ ] Endpoint `GET /api/private/stats/delayed-numbers`
- [ ] Implementar caché (TTL: 1 hora)
- [ ] Crear índice en `results` si falta

**Lógica del RPC:**
1. Obtener todos los resultados de últimos N días
2. Generar array de números posibles (00-99 para DOUBLE)
3. Comparar y encontrar números no aparecidos
4. Calcular cuántos sorteos llevan sin salir
5. Ordenar por días atrasados (DESC)

#### Día 2: Frontend y Testing
- [ ] Hook `useDelayedNumbers(lottery_id, schedule_id, options)`
- [ ] Componente simple para mostrar lista
- [ ] Testing con diferentes combinaciones
- [ ] Validar performance con lookback de 30-90 días
- [ ] Documentación

**Extensión opcional (si hay tiempo):**
- [ ] Feature de "números calientes" (opposite logic)
- [ ] Endpoint `GET /api/private/stats/hot-numbers`

---

## 🔮 FASE 4: Optimizaciones Avanzadas (Futuro)

### **P3 - Sistema de Archivado de Datos** 🗄️
**Impacto:** Alto en performance a largo plazo, media complejidad
**Tiempo:** 2-3 semanas
**Razón:** Inversión a futuro, necesario cuando volumen crezca

**Recomendación:** Implementar cuando:
- Tabla `tickets` supere 100k filas
- Tabla `bets` supere 500k filas
- Queries empiecen a degradarse notablemente

#### Roadmap de Implementación (cuando llegue el momento)

**Semana 1: Fundación**
- Crear tablas `activity_days`, `bets_archive`, `tickets_archive`
- Implementar lógica de tracking de días activos
- Crear servicio de acceso unificado (busca en main + archive)

**Semana 2: Cron y Migración**
- Implementar cron job de archivado diario
- Migrar datos históricos inicialmente
- Testing exhaustivo

**Semana 3: Refinamiento**
- Actualizar todos los repositories
- Optimizar índices en tablas principales
- Monitoring y ajustes

---

### **P3 - Reportes Avanzados** 📈
**Impacto:** Alto en negocio, alto en complejidad
**Tiempo:** 4-6 semanas
**Razón:** Valor alto pero no urgente, construir sobre reportes básicos

**Features a implementar (gradual):**

**Mes 1: Reportes de Usuarios y Loterías**
- Top usuarios por volumen
- Análisis de comportamiento
- Loterías más populares
- Análisis por turno

**Mes 2: Tendencias y Exportación**
- Tendencias semanales/mensuales
- Horas pico
- Exportación a CSV
- Exportación a PDF (opcional)

**Mes 3: Dashboard Avanzado y Visualizaciones**
- Página completa de reportes en frontend
- Gráficos interactivos (Chart.js o similar)
- Filtros avanzados
- Sistema de alertas

---

## 📋 Checklist de Inicio Inmediato

### Esta Semana (Prioridad Máxima)
- [ ] **HOY**: Ejecutar queries de diagnóstico de índices
- [ ] **Mañana**: Analizar findings y crear lista de índices
- [ ] **Día 3**: Implementar índices críticos en dev
- [ ] **Día 4**: Testing y deploy de índices a producción
- [ ] **Día 5**: Implementar purga de ticket_prizes_by_turn

### Próximas 2 Semanas
- [ ] Semana 2: Reportes básicos backend (tickets, bets, financials)
- [ ] Semana 3: Dashboard y frontend integration

### Mes Siguiente
- [ ] Números atrasados (stats)
- [ ] Reportes de usuarios y loterías
- [ ] Optimizaciones adicionales según métricas

---

## 🎯 Métricas de Éxito

### Después de Fase 1 (Índices + Purga)
- [ ] Reducción >30% en tiempo de respuesta de endpoints principales
- [ ] Reducción >80% en filas de `ticket_prizes_by_turn`
- [ ] Queries a `results` <500ms en promedio

### Después de Fase 2 (Reportes)
- [ ] Dashboard funcional con métricas en tiempo real
- [ ] 5+ endpoints de reportes operativos
- [ ] Caché funcionando (hit rate >60%)

### Después de Fase 3 (Stats)
- [ ] Feature de números atrasados disponible
- [ ] Feedback positivo de usuarios
- [ ] Performance estable con datos de 90 días

---

## 🚨 Consideraciones Importantes

### Performance
1. **Siempre hacer benchmark antes y después**
2. **Usar índices CONCURRENTLY en producción** (no bloquea tabla)
3. **Monitorear espacio en disco** después de agregar índices
4. **Cache invalidation** cuando se crean tickets/bets

### Seguridad
1. **Reportes solo para ADMIN** (excepto reportes propios)
2. **Rate limiting** en endpoints de reportes
3. **Validación de parámetros** (fechas, user_ids)
4. **No exponer datos sensibles** de otros usuarios

### Rollback Plans
1. **Índices**: DROP INDEX IF EXISTS en orden inverso
2. **Reportes**: Feature flags para desactivar si hay problemas
3. **Purga**: No hay rollback (backup antes de ejecutar)

---

## 📅 Timeline Visual

```
Semana 1: ⚡ Performance Boost
├── Día 1-4: Índices de DB
└── Día 5: Purga ticket_prizes_by_turn

Semana 2-3: 📊 Reportes Básicos
├── Backend: Tickets, Bets, Financials
├── Dashboard Backend
└── Frontend Integration

Semana 4: 🎲 Estadísticas
├── Números Atrasados
└── Testing y Refinamiento

Futuro (2-3 meses):
├── Sistema de Archivado (si es necesario)
└── Reportes Avanzados (gradual)
```

---

## 🎬 Próximos Pasos Inmediatos

1. **Ejecutar queries de diagnóstico de índices** (30 min)
2. **Revisar logs de queries lentas** en Supabase (30 min)
3. **Crear branch** `feature/db-optimization` (5 min)
4. **Comenzar con Día 1 del Plan** ☝️

---

**¡Manos a la obra!** 🚀
