# TODO - Optimización de Base de Datos

## Contexto

Este documento describe el plan para optimizar el rendimiento de la base de datos mediante la implementación de un sistema de archivado de datos antiguos.

### Problema Actual
- Las tablas de apuestas (bets), tickets y otras entidades se van indexando continuamente
- A medida que crecen, las queries se vuelven más lentas
- Necesitamos acceso rápido solo a los datos recientes (últimos 2 días con actividad)

### Solución Propuesta
- Crear tablas de archivo para datos antiguos (más de 2 días con actividad)
- Mantener indexados solo los registros frescos
- Los datos archivados siguen siendo accesibles pero sin índices
- Implementar borrado físico (no lógico) de datos muy antiguos

### Definición de "Días con Actividad"
**IMPORTANTE**: No son días corridos, sino días donde hubo actividad en el sistema.
- Un feriado o día sin actividad NO cuenta como día
- Solo cuentan días donde efectivamente hubo apuestas/tickets
- Debemos trackear cuáles fueron los últimos 2 días activos

## Tareas

### 1. Análisis Inicial
- [ ] Analizar tablas actuales (bets, tickets) y sus índices en Supabase
- [ ] Identificar impacto de performance actual
- [ ] Documentar volumen de datos por día
- [ ] Medir tiempos de queries en tablas actuales

### 2. Diseño de Sistema de Tracking de Actividad
- [ ] Diseñar esquema para tabla de 'días con actividad'
- [ ] Tabla debe registrar fecha + indicador de si hubo actividad
- [ ] Método para marcar un día como "activo"
- [ ] Query para obtener últimos 2 días con actividad

**Posible esquema:**
```sql
CREATE TABLE activity_days (
  date DATE PRIMARY KEY,
  has_activity BOOLEAN DEFAULT false,
  bets_count INTEGER DEFAULT 0,
  tickets_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Crear Tablas de Archivo
- [ ] Crear tabla `bets_archive` con mismo esquema que `bets`
- [ ] Crear tabla `tickets_archive` con mismo esquema que `tickets`
- [ ] Considerar otras tablas que necesiten archivado
- [ ] Decidir si las tablas de archivo tendrán índices (probablemente no)

**Consideraciones:**
- Mismo esquema que tablas principales
- Posible campo adicional: `archived_at TIMESTAMP`
- Sin índices o con índices mínimos para búsquedas específicas

### 4. Implementar Lógica de Días con Actividad
- [ ] Crear servicio/helper para determinar si un día tiene actividad
- [ ] Método para marcar día actual como activo al crear bet/ticket
- [ ] Query para identificar registros que pertenecen a días "viejos" (>2 días activos)

**Ubicación sugerida:** `api/src/activity/` o `api/src/shared/services/`

### 5. Servicio de Acceso Unificado a Datos
- [ ] Desarrollar repositorio que busque en tabla principal + archivo
- [ ] Métodos que automáticamente consulten ambas tablas si es necesario
- [ ] Considerar unión de resultados (UNION en queries)
- [ ] Mantener API consistente para no romper código existente

**Ejemplo:**
```typescript
class BetRepository {
  async findById(id: string): Promise<Bet | null> {
    // Buscar primero en tabla principal
    let bet = await supabase.from('bets').select('*').eq('id', id).single();

    // Si no está, buscar en archivo
    if (!bet.data) {
      bet = await supabase.from('bets_archive').select('*').eq('id', id).single();
    }

    return bet.data;
  }
}
```

### 6. Cron Job para Archivado Diario
- [ ] Crear cron job que se ejecute diariamente
- [ ] Identificar registros que pertenecen a días >2 días activos
- [ ] Mover esos registros de tabla principal a tabla de archivo
- [ ] Eliminar registros movidos de tabla principal
- [ ] Logging de cuántos registros se archivaron

**Consideraciones:**
- Ejecutar en horario de bajo tráfico
- Hacer operación en transacción (INSERT + DELETE atómico)
- Manejo de errores robusto
- Notificaciones si el proceso falla

**Ubicación sugerida:** `api/src/cron/` o similar

**Tecnologías posibles:**
- node-cron
- Supabase Edge Functions con cron
- Sistema de cron del servidor

### 7. Método de Borrado Físico
- [ ] Implementar método para borrado físico (DELETE) de datos muy antiguos
- [ ] Definir política de retención (ej: eliminar datos >30 días de archivo)
- [ ] Considerar borrado por lotes para no sobrecargar DB
- [ ] Logging de registros eliminados permanentemente

**IMPORTANTE:** Este es borrado real, no lógico (deleted_at). Los datos se pierden.

**Consideraciones:**
- Requerimientos legales de retención de datos
- Backup antes de eliminar (por seguridad)
- Confirmación/aprobación para ejecutar
- Posible interfaz de admin para controlar

### 8. Actualizar Queries Existentes
- [ ] Revisar todos los controllers que consultan bets/tickets
- [ ] Actualizar para usar nuevo servicio de acceso unificado
- [ ] Asegurar que queries sigan funcionando correctamente
- [ ] Tests para validar que no se rompa funcionalidad

**Archivos a revisar:**
- `api/src/bet/controller/`
- `api/src/bet/repository/`
- `api/src/ticket/controller/`
- `api/src/ticket/repository/`
- Cualquier otro módulo que consulte estas tablas

### 9. Optimizar Índices
- [ ] Optimizar índices en tablas principales (solo datos frescos)
- [ ] Remover o reducir índices en tablas de archivo
- [ ] Considerar índices parciales si es necesario
- [ ] Documentar estrategia de indexación

**Índices sugeridos para tablas principales:**
- Primary key
- Foreign keys necesarias
- Campos de búsqueda frecuente (user_id, created_at, status)

**Índices en tablas de archivo:**
- Minimal: quizás solo primary key
- Considerar índice en created_at si se hacen búsquedas por fecha

### 10. Logging y Monitoring
- [ ] Configurar logging para proceso de archivado
- [ ] Métricas: registros archivados, tiempo de ejecución, errores
- [ ] Alertas si el proceso falla
- [ ] Dashboard o endpoint para ver estado del archivado

### 11. Migraciones y Rollback
- [ ] Crear migraciones de base de datos para nuevas tablas
- [ ] Script para poblar activity_days con datos históricos
- [ ] Plan de rollback detallado
- [ ] Procedimiento para restaurar datos si algo sale mal

**Pasos de migración:**
1. Crear nuevas tablas (archive, activity_days)
2. Poblar activity_days con datos históricos
3. Opcionalmente pre-archivar datos antiguos
4. Activar cron job
5. Monitoring intensivo primeros días

### 12. Testing de Performance
- [ ] Benchmark de queries ANTES de implementar cambios
- [ ] Benchmark DESPUÉS de mover datos a archivo
- [ ] Validar que queries a datos frescos son más rápidas
- [ ] Validar que datos archivados siguen siendo accesibles
- [ ] Documentar mejoras de performance

**Métricas a medir:**
- Tiempo promedio de query a bets/tickets
- Tamaño de tablas principales vs archivo
- Uso de CPU/memoria durante queries
- Tiempo de ejecución del cron job

## Consideraciones Adicionales

### Impacto en Funcionalidad Existente
- Reportes históricos: necesitarán consultar ambas tablas
- Exportaciones: considerar datos archivados
- Búsquedas: el servicio unificado debe manejar esto

### Escalabilidad Futura
- Si las tablas de archivo crecen mucho, considerar:
  - Particionamiento por mes/año
  - Múltiples tablas de archivo
  - Compresión de datos antiguos

### Seguridad y Compliance
- Verificar requerimientos legales de retención de datos de apuestas
- Considerar encriptación de datos archivados
- Auditoría de borrados físicos

## Recursos Necesarios

- Acceso a Supabase con permisos de creación de tablas
- Ambiente de testing con datos similares a producción
- Tiempo estimado: 2-3 semanas de desarrollo + testing
- Posible downtime mínimo para migraciones iniciales

## Estado Actual

**Fecha de creación:** 2025-11-12
**Estado:** Pendiente de implementación
**Prioridad:** Media-Alta (performance improvement)

---

**Notas finales:**
Este es un proyecto de refactorización de infraestructura significativo. Se recomienda implementarlo en fases:
1. Fase 1: Crear tablas y sistema de tracking (sin mover datos aún)
2. Fase 2: Implementar servicio de acceso unificado y actualizar queries
3. Fase 3: Activar cron de archivado en modo dry-run
4. Fase 4: Activar archivado real con monitoring intensivo
5. Fase 5: Implementar borrado físico (después de validar todo lo anterior)

---

# TODO - Optimización de ticket_prizes_by_turn

## Contexto

La tabla `ticket_prizes_by_turn` almacena premios por turno para cada ticket, incluyendo tickets que no ganaron (prize_turn = 0). Esto es útil para trazabilidad y auditoría, pero puede crecer significativamente con el tiempo.

### Problema
- La tabla guarda filas para TODOS los tickets de cada turno procesado
- ~80% de las filas tienen `prize_turn = 0` (tickets sin premio)
- Estas filas son útiles para debugging pero no críticas después de X días
- Crecimiento estimado: ~100 tickets/día × 5 turnos × 365 días = 182,500 filas/año

### Solución Propuesta
Purgar filas con `prize_turn = 0` después de X días (ej: 30, 60 o 90 días), manteniendo:
- ✅ Todas las filas de ganadores (prize_turn > 0) indefinidamente
- ✅ Filas de no-ganadores recientes para debugging/auditoría
- ❌ Filas de no-ganadores antiguos (se pueden regenerar si es necesario)

## Tareas

### 1. Definir Política de Retención
- [ ] Decidir período de retención para filas con `prize_turn = 0` (recomendado: 60-90 días)
- [ ] Documentar política en documentación del proyecto
- [ ] Considerar requerimientos legales si aplican

### 2. Crear Stored Procedure de Purga
- [ ] Crear SP `purge_non_winner_prizes_by_turn(days_to_keep INT)`
- [ ] El SP debe eliminar filas donde:
  - `prize_turn = 0` AND `hits_turn = 0`
  - `date < (CURRENT_DATE - days_to_keep)`
- [ ] Retornar estadísticas: filas eliminadas, espacio liberado
- [ ] Incluir logging dentro del SP

**Ejemplo de implementación:**
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

### 3. Implementar Endpoint de Admin (Opcional)
- [ ] Crear endpoint protegido en backend: `POST /api/private/admin/purge-prizes`
- [ ] Solo accesible para usuarios ADMIN
- [ ] Permitir parámetro opcional `days_to_keep`
- [ ] Retornar resultado del SP
- [ ] Logging de quién ejecutó la purga

**Ubicación:** `api/src/admin/controller/admin.controller.ts`

### 4. Crear Cron Job Automático (Futuro)
- [ ] Cron job mensual que ejecute la purga automáticamente
- [ ] Configurar días de retención en variable de entorno
- [ ] Notificaciones/logging de ejecuciones
- [ ] Monitoreo de espacio liberado

**Consideraciones:**
- Ejecutar en horario de bajo tráfico (ej: 3 AM)
- Configuración: `PURGE_NON_WINNERS_DAYS=90`
- Alertas si falla o elimina cantidad anormal de filas

### 5. Testing y Validación
- [ ] Probar SP en ambiente de desarrollo
- [ ] Validar que solo elimina filas con `prize_turn = 0`
- [ ] Verificar que filas de ganadores nunca se eliminan
- [ ] Medir espacio liberado en disco
- [ ] Validar que `generate_winners` sigue funcionando correctamente

### 6. Documentación
- [ ] Documentar política de retención en README
- [ ] Agregar comentarios en migraciones
- [ ] Documentar cómo ejecutar purga manual si es necesario
- [ ] Actualizar CHANGELOG

## Consideraciones

### Impacto Mínimo
- Esta tabla es intermedia y se regenera con cada ejecución de `generate_winners`
- Eliminar filas antiguas de no-ganadores NO afecta funcionalidad
- Si se necesitan datos históricos, se pueden regenerar ejecutando `generate_winners` con fecha antigua

### Beneficios
- Reducción de ~80% en tamaño de tabla (después de primer purga)
- Queries más rápidas en `totals_per_day`
- Menor uso de espacio en disco e índices
- Costos reducidos en base de datos (si aplica)

### Riesgos
- **Mínimos**: La tabla se puede repoblar ejecutando `generate_winners` nuevamente
- Pérdida de trazabilidad histórica completa (pero solo de no-ganadores)
- Si hay bug en `generate_winners`, no se podrá comparar con histórico muy antiguo

## Estado Actual

**Fecha de creación:** 2025-11-13
**Estado:** Pendiente de implementación
**Prioridad:** Baja (optimización incremental)
**Dependencias:** Ninguna

## Estimación

- **Desarrollo:** 2-4 horas (SP + endpoint opcional)
- **Testing:** 1-2 horas
- **Documentación:** 1 hora
- **Total:** ~1 día de trabajo

---

# TODO - Números Atrasados (Delayed Numbers)

## Contexto

Los números atrasados son aquellos números que no han salido en los sorteos recientes de una lotería específica. Esta información es valiosa para los jugadores que buscan patrones o tendencias estadísticas.

### Definición
- **Número atrasado**: Un número que no ha aparecido en los últimos N sorteos
- Se calcula por:
  - Lotería (ej: Quiniela, Nacional, etc.)
  - Turno (Matutina, Vespertina, Nocturna, etc.)
  - Posición (Cabeza, 5 primeros, 10 primeros, 20 primeros)
  - Tipo de número (1 cifra, 2 cifras, 3 cifras, 4 cifras)

### Casos de Uso
1. **Frontend - Estadísticas**: Mostrar números atrasados en dashboard o sección de estadísticas
2. **Sugerencias de apuestas**: Ayudar a jugadores a identificar números "calientes" vs "fríos"
3. **Reportes**: Generar reportes de tendencias históricas
4. **Análisis**: Análisis estadístico de frecuencias

## Tareas

### 1. Diseñar Esquema de Respuesta
- [ ] Definir estructura de datos para respuesta
- [ ] Decidir parámetros de entrada (lottery_id, schedule_id, position, days_back, etc.)
- [ ] Definir formato de salida (JSON con número, días atrasado, última aparición, etc.)
- [ ] Considerar paginación si hay muchos números

**Ejemplo de estructura:**
```typescript
interface DelayedNumber {
  number: string;           // "45", "123", etc.
  days_delayed: number;     // Cantidad de días/sorteos sin salir
  last_appearance: string;  // Fecha de última aparición
  lottery_id: string;
  schedule_id: string;
  position: 'HEAD' | 'FIVE' | 'TEN' | 'TWENTY';
}
```

### 2. Crear RPC para Calcular Números Atrasados
- [ ] Crear SP `get_delayed_numbers(p_lottery_id, p_schedule_id, p_position, p_lookback_days, p_number_type)`
- [ ] El SP debe:
  - Obtener todos los resultados de los últimos N días para lottery/schedule/position
  - Generar lista de todos los números posibles según `number_type`
  - Comparar y encontrar números que NO aparecieron
  - Calcular cuántos días/sorteos llevan sin salir
  - Ordenar por días atrasados (descendente)
- [ ] Considerar performance: usar índices en tabla `results`
- [ ] Retornar JSONB array con números atrasados

**Ejemplo de implementación:**
```sql
CREATE OR REPLACE FUNCTION get_delayed_numbers(
  p_lottery_id UUID,
  p_schedule_id UUID,
  p_position TEXT DEFAULT 'TWENTY',  -- 'HEAD', 'FIVE', 'TEN', 'TWENTY'
  p_lookback_days INT DEFAULT 30,
  p_number_type TEXT DEFAULT 'DOUBLE'  -- 'ONE', 'DOUBLE', 'TERN', 'QUATERN'
)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_results JSONB[];
  v_cutoff_date DATE;
  v_position_limit INT;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_lookback_days;

  -- Determinar límite de posición
  v_position_limit := CASE p_position
    WHEN 'HEAD' THEN 1
    WHEN 'FIVE' THEN 5
    WHEN 'TEN' THEN 10
    WHEN 'TWENTY' THEN 20
    ELSE 20
  END;

  -- Lógica para calcular números atrasados
  -- (Implementación detallada aquí)

  RETURN v_results;
END;
$$;
```

### 3. Crear Endpoint en Backend
- [ ] Crear ruta: `GET /api/private/delayed-numbers`
- [ ] Parámetros query string:
  - `lottery_id` (requerido)
  - `schedule_id` (requerido)
  - `position` (opcional, default: 'TWENTY')
  - `lookback_days` (opcional, default: 30)
  - `number_type` (opcional, default: 'DOUBLE')
- [ ] Llamar al RPC `get_delayed_numbers`
- [ ] Retornar resultado parseado

**Ubicación sugerida:**
- Ruta: `api/src/stats/route/stats.route.ts` (nuevo módulo)
- Controller: `api/src/stats/controller/stats.controller.ts`
- Repository: `api/src/stats/repository/stats.repository.ts`

### 4. Optimizaciones
- [ ] Crear índices en tabla `results` para queries rápidas
- [ ] Considerar cacheo de resultados (ej: Redis, o cache en memoria)
- [ ] Cache TTL: 1 hora (los números atrasados no cambian constantemente)
- [ ] Implementar rate limiting si es endpoint público

**Índices recomendados:**
```sql
CREATE INDEX IF NOT EXISTS idx_results_lottery_schedule_date
  ON results(lottery_id, schedule_id, date DESC);
```

### 5. Frontend Integration (Futuro)
- [ ] Crear hook `useDelayedNumbers(lottery_id, schedule_id, options)`
- [ ] Componente para mostrar tabla/lista de números atrasados
- [ ] Visualización: gráfico de barras mostrando días atrasados
- [ ] Filtros interactivos: posición, tipo de número, rango de días

### 6. Testing
- [ ] Probar con diferentes combinaciones de parámetros
- [ ] Validar que números efectivamente están atrasados
- [ ] Performance testing con gran volumen de resultados
- [ ] Edge cases: sin resultados, todos los números salieron, etc.

### 7. Documentación
- [ ] Documentar endpoint en README o Swagger
- [ ] Comentarios en código explicando lógica
- [ ] Ejemplos de uso en documentación
- [ ] Actualizar CHANGELOG

## Consideraciones Técnicas

### Generación de Números Posibles
Dependiendo del `number_type`:
- **ONE**: 0-9 (10 números)
- **DOUBLE**: 00-99 (100 números)
- **TERN**: 000-999 (1000 números)
- **QUATERN**: 0000-9999 (10000 números)

### Cálculo de "Días Atrasado"
Dos opciones:
1. **Por días calendario**: Días corridos desde última aparición
2. **Por sorteos**: Cantidad de sorteos donde no salió

Recomendado: **Por sorteos** (más preciso para jugadores)

### Performance
- Con lookback de 30 días y posición TWENTY:
  - ~30 días × 1 resultado/día = 30 filas a procesar
  - Para DOUBLE (100 números): comparar 100 vs ~600 apariciones (30 días × 20 posiciones)
- Query debería ser muy rápida con índices apropiados

### Casos Especiales
- ¿Qué pasa si un número NUNCA salió?
  - Retornar con `days_delayed: NULL` o `days_delayed: Infinity`
  - Indicar "Sin registro" en frontend
- ¿Qué pasa si no hay suficientes datos (ej: solo 5 días de historial)?
  - Retornar solo con datos disponibles
  - Incluir metadata: `total_days_analyzed: 5`

## Estado Actual

**Fecha de creación:** 2025-11-13
**Estado:** Pendiente de implementación
**Prioridad:** Media (feature request)
**Dependencias:** Requiere datos históricos en tabla `results`

## Estimación

- **Diseño y RPC:** 4-6 horas
- **Endpoint backend:** 2-3 horas
- **Testing:** 2-3 horas
- **Optimización e índices:** 1-2 horas
- **Documentación:** 1 hora
- **Total:** ~2 días de trabajo

## Extensiones Futuras

### 1. Números "Calientes" (Opposite)
Crear endpoint complementario para números que MÁS salen:
- `GET /api/private/hot-numbers`
- Mismos parámetros
- Retorna números ordenados por frecuencia de aparición

### 2. Predicciones Estadísticas
- Probabilidad de que un número atrasado salga pronto
- Análisis de tendencias históricas
- Machine learning (muy futuro)

### 3. Notificaciones
- Alertar cuando un número muy atrasado finalmente sale
- Suscripciones por número favorito
