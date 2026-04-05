# TODO - API Backend

## Testing Pendiente

### Testing End-to-End del Sistema de Archive 🔄 **PRIORITARIO**

**Objetivo:** Validar que el sistema de archive query routing funciona correctamente en todos los flujos.

#### Contexto
Se implementó un sistema de archive automático que divide datos entre tablas principales (`bets`, `tickets`) y tablas de archivo (`bets_archive`, `tickets_archive`) basándose en días activos. El sistema usa cache en memoria para routing de queries y se sincroniza con el cron job de archivado.

#### Tareas de Testing

##### 1. Preparación del Ambiente de Testing
- [ ] Verificar que `ARCHIVE_DAYS_TO_KEEP=2` en variables de entorno
- [ ] Verificar que el servidor inicia correctamente y muestra logs del cache:
  ```
  [ArchiveHelper] Cache initialized with N active days: [...]
  ```
- [ ] Verificar que el cron job está configurado (check logs de inicio)

##### 2. Crear Datos de Prueba
- [ ] Crear tickets y bets para fechas antiguas (>2 días activos atrás)
  - Ejemplo: Si hoy es 10/02, crear datos para 05/02, 04/02, 03/02
- [ ] Insertar directamente en la BD usando SQL o scripts de migración
- [ ] Marcar esas fechas en `activity_days` con `has_activity = true`

##### 3. Ejecutar Archivado Manual
- [ ] Ejecutar cron de archivado manualmente (endpoint o método `runArchiveJobManual()`)
- [ ] Verificar logs del proceso de archivado:
  - Cutoff date calculado correctamente
  - Cantidad de registros archivados
  - Cache actualizado después del archivado
- [ ] Verificar que datos antiguos están en tablas `_archive`
- [ ] Verificar que datos recientes permanecen en tablas principales

##### 4. Testing de Queries del Frontend

**Pages a probar:**
- [ ] `@web/src/features/plays-and-hits/` - Consultas de apuestas por día
  - Probar consulta de día reciente (debe ir a tabla main)
  - Probar consulta de día archivado (debe ir a tabla archive)
  - Verificar que los totales se calculan correctamente
  - Verificar que los filtros (lottery, schedule, cashier) funcionan en ambas tablas

- [ ] `@web/src/features/terminal-ticket/` - Consultas de tickets
  - Probar consulta de ticket reciente por número
  - Probar consulta de ticket archivado por número
  - Verificar que `getTicketByNumber` busca en ambas tablas (main → archive)
  - Verificar que los detalles del ticket se cargan correctamente

- [ ] `@web/src/features/current-account/` - Cuenta corriente
  - Probar cálculo de cuenta corriente con fechas archivadas
  - Verificar que los RPCs de totales funcionan con archive

##### 5. Testing de Casos Edge

- [ ] **Buscar ticket sin fecha (por número)**
  - Debe buscar primero en main (rápido)
  - Debe buscar en archive si no encuentra (fallback)
  - Verificar orden correcto de búsqueda (main → archive)

- [ ] **Intentar pagar ticket archivado**
  - Debe retornar error específico: "TICKET_ARCHIVED"
  - No debe permitir el pago
  - Mensaje de error claro para el usuario

- [ ] **Días inactivos intermedios**
  - Crear datos: Lunes (activo), Domingo (inactivo), Sábado (activo)
  - Verificar que tabla main contiene todos 3 días
  - Verificar que próximo cron limpia correctamente

- [ ] **Consulta de fecha futura**
  - Debe ir a tabla main (no está en cache pero no es < cutoff)
  - No debe generar errores

##### 6. Verificación de Performance

- [ ] Medir tamaño de tabla `bets` antes y después de archivar
- [ ] Medir tamaño de tabla `tickets` antes y después de archivar
- [ ] Verificar que tabla `bets_archive` crece correctamente
- [ ] Verificar que tabla `tickets_archive` crece correctamente
- [ ] Confirmar que queries a tabla main son más rápidos

##### 7. Testing del Cache

- [ ] Verificar que cache se inicializa al arrancar servidor
- [ ] Verificar que cache se actualiza después de cron
- [ ] Probar reinicio del servidor (cache debe recargarse)
- [ ] Verificar logs de cache refresh:
  ```
  [ArchiveHelper] Cache refreshed with N active days: [...]
  ```

##### 8. Rollback y Recuperación

- [ ] Probar qué pasa si el cron falla
- [ ] Verificar que el cache mantiene valores anteriores en caso de error
- [ ] Probar recuperación después de un error de archivado

#### Comandos Útiles

```sql
-- Ver estado de activity_days
SELECT * FROM activity_days ORDER BY date DESC LIMIT 10;

-- Contar registros en main vs archive
SELECT COUNT(*) FROM bets;
SELECT COUNT(*) FROM bets_archive;
SELECT COUNT(*) FROM tickets;
SELECT COUNT(*) FROM tickets_archive;

-- Ver últimos días activos
SELECT * FROM get_last_active_days(2);

-- Verificar cutoff date
SELECT * FROM activity_days WHERE has_activity = true ORDER BY date DESC OFFSET 1 LIMIT 1;
```

#### Resultado Esperado

✅ Todos los endpoints funcionan correctamente con datos archivados
✅ Performance mejorada en tabla main
✅ Cache se mantiene sincronizado
✅ Errores específicos para operaciones no permitidas en archive
✅ Cero cambios necesarios en el frontend

---

## Features Nuevas

### Endpoint Específico para Reorder 🔄

**Objetivo:** Crear un endpoint dedicado para manejar operaciones de reordenamiento de elementos.

#### Contexto
Se necesita un endpoint específico para manejar el reorder de elementos (tickets, apuestas, loterías, turnos, o cualquier entidad que requiera ordenamiento personalizado).

#### Tareas

##### 1. Diseño del Endpoint
- [ ] Definir qué entidades necesitan reordenamiento (tickets, bets, lotteries, schedules, etc.)
- [ ] Diseñar estructura de request y response
- [ ] Definir reglas de negocio para reordenamiento
- [ ] Documentar casos de uso específicos

**Posible estructura:**
```typescript
// Request
interface ReorderRequest {
  entity_type: 'tickets' | 'bets' | 'lotteries' | 'schedules' | string;
  items: {
    id: string;
    new_position: number;
  }[];
  user_id?: string;  // Para validación de permisos
}

// Response
interface ReorderResponse {
  success: boolean;
  updated_count: number;
  items: {
    id: string;
    position: number;
  }[];
}
```

##### 2. Implementación Backend
- [ ] Crear endpoint `POST /api/private/reorder`
- [ ] Implementar controller en módulo correspondiente
- [ ] Crear repository method para actualizar posiciones
- [ ] Validación de permisos (usuario puede reordenar estos items?)
- [ ] Validación de ownership (items pertenecen al usuario?)
- [ ] Manejo de errores y transacciones atómicas

**Ubicación sugerida:**
- Si es genérico: `api/src/shared/controller/reorder.controller.ts`
- Si es específico: en el módulo correspondiente (ej: `api/src/lottery/controller/lottery.controller.ts`)

##### 3. Base de Datos
- [ ] Agregar columna `position` o `order` a tablas que lo necesiten
- [ ] Crear índice en columna de posición
- [ ] Migración para columna de ordenamiento
- [ ] Definir valor por defecto (ej: created_at order inicial)

**Ejemplo de migración:**
```sql
-- Agregar columna de posición a tabla
ALTER TABLE lotteries
ADD COLUMN position INTEGER DEFAULT 0;

-- Inicializar posiciones basado en created_at
UPDATE lotteries
SET position = row_number() OVER (ORDER BY created_at);

-- Crear índice
CREATE INDEX idx_lotteries_position ON lotteries(position);
```

##### 4. Lógica de Reordenamiento
- [ ] Implementar algoritmo de reordenamiento eficiente
- [ ] Manejar colisiones de posición
- [ ] Actualizar posiciones en batch (transacción)
- [ ] Logging de cambios de orden

**Consideraciones:**
- Reordenamiento por drag-and-drop requiere actualizar múltiples registros
- Usar transacciones para asegurar atomicidad
- Considerar locks si hay concurrencia

##### 5. Validación y Seguridad
- [ ] Validar que usuario tiene permisos para reordenar
- [ ] Validar que IDs existen
- [ ] Validar que posiciones son válidas (>= 0, sin gaps)
- [ ] Rate limiting para prevenir abuse
- [ ] Logging de quien hizo el reorder y cuándo

##### 6. Testing
- [ ] Tests unitarios para lógica de reordenamiento
- [ ] Tests de integración para endpoint
- [ ] Tests de permisos (unauthorized access)
- [ ] Tests de edge cases (posiciones negativas, duplicadas, etc.)
- [ ] Tests de performance con múltiples items

##### 7. Documentación
- [ ] Documentar endpoint en README o Swagger
- [ ] Ejemplos de uso del endpoint
- [ ] Documentar reglas de negocio
- [ ] Actualizar CHANGELOG

#### Consideraciones Técnicas

**Estrategias de Reordenamiento:**

1. **Simple Position Update:**
   - Cada item tiene un `position: integer`
   - Reordenar actualiza todos los positions
   - Pros: Simple, fácil de entender
   - Contras: Puede requerir actualizar muchos registros

2. **Fractional Indexing:**
   - Posiciones como strings o decimales entre items
   - Solo actualiza el item movido
   - Pros: Menos updates
   - Contras: Más complejo, puede requerir rebalanceo

3. **Linked List:**
   - Cada item apunta al siguiente
   - Pros: Reorden rápido
   - Contras: Queries más complejas, difícil de mantener

**Recomendación:** Empezar con **Simple Position Update** por simplicidad.

#### Ejemplo de Implementación

```typescript
// Controller
export const reorderItems = async (req: Request, res: Response) => {
  const { entity_type, items } = req.body;
  const user_id = req.user?.id;

  // Validar permisos
  if (!canUserReorder(user_id, entity_type)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Reordenar en transacción
  const result = await supabase.rpc('reorder_items', {
    p_entity_type: entity_type,
    p_items: items,
    p_user_id: user_id,
  });

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  return res.json({
    success: true,
    updated_count: result.data.updated_count,
    items: result.data.items,
  });
};

// RPC en Supabase
CREATE OR REPLACE FUNCTION reorder_items(
  p_entity_type TEXT,
  p_items JSONB,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_item JSONB;
  v_updated_count INT := 0;
BEGIN
  -- Iterar items y actualizar posiciones
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Actualizar posición según entity_type
    -- (Implementación específica por entidad)
    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count
  );
END;
$$;
```

#### Estado Actual
- **Prioridad:** Media (depende del caso de uso específico)
- **Estimación:** 2-3 días
- **Dependencias:** Definición de qué entidades necesitan reordenamiento
- **Bloqueantes:** Especificar scope exacto (qué se va a reordenar)

---

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

---

# TODO - Revisión y Optimización de Índices de Base de Datos

## Contexto

Con la implementación del nuevo sistema de caché centralizado (CacheManager) y el crecimiento continuo de datos, es necesario revisar y optimizar los índices de la base de datos para asegurar el mejor rendimiento posible en las consultas.

### Problema Actual
- Posibles índices faltantes en tablas críticas
- Índices redundantes o innecesarios que consumen espacio
- Consultas lentas en tablas con gran volumen de datos
- Falta de índices compuestos para queries comunes

### Solución Propuesta
Realizar una auditoría completa de índices en todas las tablas principales y optimizarlos según los patrones de uso reales.

## Tareas

### 1. Auditoría de Índices Actuales
- [ ] Listar todos los índices existentes en Supabase
- [ ] Identificar índices duplicados o redundantes
- [ ] Medir tamaño de cada índice
- [ ] Documentar índices actuales por tabla

**Tablas prioritarias:**
- `lottery`
- `schedule`
- `schedule_lottery`
- `bets`
- `tickets`
- `ticket_prizes_by_turn`
- `results`
- `winners`
- `current_account`

### 2. Análisis de Query Patterns
- [ ] Revisar queries más frecuentes en cada módulo
- [ ] Identificar queries lentas usando `EXPLAIN ANALYZE`
- [ ] Documentar filtros y ordenamientos comunes
- [ ] Identificar oportunidades para índices compuestos

**Módulos a revisar:**
- `api/src/lottery/repository/`
- `api/src/schedule/repository/`
- `api/src/schedule-lottery/repository/`
- `api/src/bet/repository/`
- `api/src/ticket/repository/`
- `api/src/results/repository/`
- `api/src/winners/repository/`

### 3. Índices Recomendados por Tabla

#### lottery
```sql
-- Verificar índices existentes
CREATE INDEX IF NOT EXISTS idx_lottery_active ON lottery(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_lottery_name ON lottery(name);
```

#### schedule
```sql
-- Verificar índices existentes
CREATE INDEX IF NOT EXISTS idx_schedule_active ON schedule(active) WHERE active = true;
```

#### schedule_lottery
```sql
-- Índices para queries frecuentes por día/schedule/lottery
CREATE INDEX IF NOT EXISTS idx_schedule_lottery_day ON schedule_lottery(day);
CREATE INDEX IF NOT EXISTS idx_schedule_lottery_schedule ON schedule_lottery(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_lottery_lottery ON schedule_lottery(lottery_id);
CREATE INDEX IF NOT EXISTS idx_schedule_lottery_composite
  ON schedule_lottery(day, schedule_id, lottery_id);
```

#### bets
```sql
-- Índices para búsquedas por usuario, ticket, fecha
CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_ticket ON bets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_bets_date ON bets(date DESC);
CREATE INDEX IF NOT EXISTS idx_bets_lottery ON bets(lottery_id);
CREATE INDEX IF NOT EXISTS idx_bets_schedule ON bets(schedule_id);
-- Índice compuesto para queries comunes
CREATE INDEX IF NOT EXISTS idx_bets_user_date
  ON bets(user_id, date DESC);
```

#### tickets
```sql
-- Índices para búsquedas por usuario, número, fecha, estado
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets(date DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(paid, winner);
-- Índice compuesto para terminal-ticket queries
CREATE INDEX IF NOT EXISTS idx_tickets_user_date_status
  ON tickets(user_id, date DESC, winner, paid);
```

#### results
```sql
-- Índices para búsquedas por lotería, turno, fecha
CREATE INDEX IF NOT EXISTS idx_results_lottery ON results(lottery_id);
CREATE INDEX IF NOT EXISTS idx_results_schedule ON results(schedule_id);
CREATE INDEX IF NOT EXISTS idx_results_date ON results(date DESC);
-- Índice compuesto crítico
CREATE INDEX IF NOT EXISTS idx_results_lottery_schedule_date
  ON results(lottery_id, schedule_id, date DESC);
```

#### winners
```sql
-- Índices para búsquedas de ganadores
CREATE INDEX IF NOT EXISTS idx_winners_date ON winners(date DESC);
CREATE INDEX IF NOT EXISTS idx_winners_lottery ON winners(lottery_id);
CREATE INDEX IF NOT EXISTS idx_winners_schedule ON winners(schedule_id);
CREATE INDEX IF NOT EXISTS idx_winners_paid ON winners(paid);
```

#### ticket_prizes_by_turn
```sql
-- Índices para cálculos de premios
CREATE INDEX IF NOT EXISTS idx_prizes_ticket ON ticket_prizes_by_turn(ticket_id);
CREATE INDEX IF NOT EXISTS idx_prizes_date ON ticket_prizes_by_turn(date DESC);
CREATE INDEX IF NOT EXISTS idx_prizes_schedule ON ticket_prizes_by_turn(schedule_id);
-- Índice parcial solo para ganadores
CREATE INDEX IF NOT EXISTS idx_prizes_winners
  ON ticket_prizes_by_turn(date DESC, schedule_id)
  WHERE prize_turn > 0;
```

### 4. Implementación de Índices
- [ ] Crear migraciones SQL para nuevos índices
- [ ] Ejecutar en ambiente de desarrollo primero
- [ ] Medir impacto en performance (antes/después)
- [ ] Monitorear uso de espacio en disco
- [ ] Aplicar en producción en horario de bajo tráfico

### 5. Índices a Considerar Eliminar
- [ ] Identificar índices no utilizados (ver pg_stat_user_indexes)
- [ ] Índices redundantes (ej: índice en columna A cuando existe índice en A,B)
- [ ] Índices en tablas pequeñas que no justifican el overhead
- [ ] Documentar razones para eliminación

### 6. Índices Parciales y Especiales
- [ ] Índices parciales para queries con WHERE frecuentes
- [ ] Índices de texto completo si hay búsquedas de texto
- [ ] Considerar GiST o GIN para tipos especiales
- [ ] Evaluar índices de expresión si hay cálculos frecuentes

**Ejemplos de índices parciales:**
```sql
-- Solo tickets activos (no eliminados)
CREATE INDEX idx_tickets_active
  ON tickets(date DESC)
  WHERE deleted_at IS NULL;

-- Solo ganadores pagados
CREATE INDEX idx_winners_paid
  ON winners(date DESC)
  WHERE paid = true;
```

### 7. Performance Testing
- [ ] Benchmark queries ANTES de agregar índices
- [ ] Benchmark queries DESPUÉS de agregar índices
- [ ] Medir tiempo de INSERT/UPDATE (puede degradarse con más índices)
- [ ] Validar que cache + índices mejoran performance general
- [ ] Documentar mejoras específicas por query

**Métricas a medir:**
- Tiempo de respuesta promedio por endpoint
- Query execution time (pg_stat_statements)
- Index usage statistics (pg_stat_user_indexes)
- Tamaño total de índices vs tablas

### 8. Mantenimiento de Índices
- [ ] Configurar VACUUM ANALYZE automático
- [ ] Monitorear bloat de índices
- [ ] Programar REINDEX periódico si es necesario
- [ ] Alertas si índices crecen anormalmente

### 9. Documentación
- [ ] Documentar todos los índices por tabla
- [ ] Explicar razón de cada índice (qué query optimiza)
- [ ] Guía de cuándo agregar nuevos índices
- [ ] Actualizar CHANGELOG

### 10. Integración con CacheManager
- [ ] Revisar que índices complementen estrategia de caché
- [ ] Índices en columnas usadas por cache keys
- [ ] Optimizar queries de carga de cache (getAll, etc.)
- [ ] Documentar relación cache-índices

## Consideraciones

### Trade-offs de Índices
- **Ventajas:**
  - Queries de lectura más rápidas
  - Mejor performance en JOINs y WHERE clauses
  - Soporte para UNIQUE constraints
- **Desventajas:**
  - Espacio en disco adicional
  - Inserts/Updates/Deletes más lentos
  - Overhead de mantenimiento

### Reglas Generales
1. Indexar columnas en WHERE clauses frecuentes
2. Indexar foreign keys para JOINs
3. Indexar columnas en ORDER BY
4. Considerar índices compuestos para queries multi-columna
5. No indexar columnas con baja cardinalidad (ej: boolean en tabla grande)
6. No crear índice si tabla tiene <1000 filas

### Análisis de Impacto
Para cada índice propuesto, documentar:
- Query que optimiza
- Frecuencia de uso del query
- Mejora esperada (estimada con EXPLAIN)
- Costo en espacio y writes

## Estado Actual

**Fecha de creación:** 2025-11-19
**Estado:** Pendiente de implementación
**Prioridad:** Alta (performance optimization)
**Dependencias:** Sistema de CacheManager implementado

## Estimación

- **Auditoría inicial:** 4-6 horas
- **Análisis de queries:** 4-6 horas
- **Diseño de índices:** 3-4 horas
- **Implementación y testing:** 6-8 horas
- **Documentación:** 2-3 horas
- **Total:** ~3-4 días de trabajo

## Recursos Útiles

### Queries de Diagnóstico
```sql
-- Ver índices no utilizados
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelname NOT LIKE 'pg_toast%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Ver tamaño de índices
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

---

**Notas finales:**
Esta optimización debe hacerse en conjunto con el CacheManager para maximizar el performance general. Los índices optimizan lecturas de DB mientras el cache reduce la frecuencia de esas lecturas. Ambos sistemas son complementarios.

---

# TODO - Sistema de Reportes y Estadísticas

## Contexto

Implementar un sistema completo de reportes que permita analizar el comportamiento del negocio, patrones de apuestas, y métricas clave para la toma de decisiones.

### Objetivo
Proveer endpoints y funcionalidad para generar reportes detallados sobre:
- Tickets por día
- Jugadas (bets) por día
- Promedios de apuestas
- Tickets promedio
- Tendencias y patrones
- Análisis por usuario, lotería, turno, etc.

### Casos de Uso
1. **Dashboard de Admin**: Visualizar métricas clave del negocio
2. **Reportes Financieros**: Análisis de ingresos, premios pagados, ganancias netas
3. **Análisis de Usuarios**: Comportamiento de pasadores, tickets más activos
4. **Tendencias**: Identificar patrones en apuestas y loterías populares
5. **Optimización**: Detectar horarios pico, turnos más jugados, etc.

## Tareas

### 1. Reportes Básicos de Tickets

#### 1.1 Cantidad de Tickets por Día
- [ ] Crear RPC `get_tickets_per_day(p_start_date, p_end_date, p_user_id)`
- [ ] Retornar cantidad de tickets por día en el rango especificado
- [ ] Incluir filtros opcionales: usuario, estado (pagado/no pagado, ganador/perdedor)
- [ ] Agrupar por fecha con totales diarios

**Estructura de respuesta:**
```typescript
interface TicketsPerDay {
  date: string;
  total_tickets: number;
  winner_tickets: number;
  paid_tickets: number;
  unpaid_tickets: number;
  total_amount: number;
  total_prizes: number;
}
```

#### 1.2 Cantidad de Jugadas por Día
- [ ] Crear RPC `get_bets_per_day(p_start_date, p_end_date, p_user_id)`
- [ ] Retornar cantidad de jugadas (bets) por día
- [ ] Incluir totales por tipo de apuesta (head, double, tern, etc.)
- [ ] Agrupar por lotería y turno

**Estructura de respuesta:**
```typescript
interface BetsPerDay {
  date: string;
  total_bets: number;
  by_lottery: {
    lottery_id: string;
    lottery_name: string;
    bet_count: number;
    total_amount: number;
  }[];
  by_type: {
    bet_type: string;  // 'HEAD', 'DOUBLE', 'TERN', etc.
    count: number;
    total_amount: number;
  }[];
}
```

#### 1.3 Promedio de Jugadas por Ticket
- [ ] Crear RPC `get_average_bets_per_ticket(p_start_date, p_end_date)`
- [ ] Calcular promedio de jugadas por ticket
- [ ] Incluir desglose por usuario
- [ ] Identificar usuarios con más/menos jugadas promedio

**Cálculo:**
```sql
AVG(bets_per_ticket) = SUM(total_bets) / SUM(total_tickets)
```

#### 1.4 Ticket Promedio (Monto)
- [ ] Crear RPC `get_average_ticket_amount(p_start_date, p_end_date)`
- [ ] Calcular monto promedio por ticket
- [ ] Incluir mediana y moda
- [ ] Desglose por usuario, día, turno

**Métricas:**
- Ticket promedio general
- Ticket promedio por usuario
- Ticket promedio por día de la semana
- Ticket promedio por turno

#### 1.5 Ticket Promedio por Día
- [ ] Crear RPC `get_daily_average_ticket(p_start_date, p_end_date)`
- [ ] Calcular monto promedio de tickets para cada día
- [ ] Comparar con promedio histórico
- [ ] Identificar días atípicos (outliers)

**Estructura:**
```typescript
interface DailyAverageTicket {
  date: string;
  avg_ticket_amount: number;
  total_tickets: number;
  min_ticket: number;
  max_ticket: number;
  median_ticket: number;
}
```

### 2. Reportes Financieros

#### 2.1 Reporte de Ingresos vs Premios
- [ ] Crear RPC `get_financial_report(p_start_date, p_end_date)`
- [ ] Calcular ingresos totales (sum de tickets)
- [ ] Calcular premios pagados (sum de winners)
- [ ] Calcular ganancia neta (ingresos - premios)
- [ ] Desglose por día, turno, lotería

**Estructura:**
```typescript
interface FinancialReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_income: number;
    total_prizes: number;
    net_profit: number;
    profit_margin: number;  // (net_profit / total_income) * 100
  };
  by_day: DailyFinancials[];
  by_lottery: LotteryFinancials[];
}
```

#### 2.2 Reporte de Premios Pendientes de Pago
- [ ] Crear RPC `get_unpaid_prizes_report()`
- [ ] Listar todos los winners con `paid = false`
- [ ] Agrupar por usuario, fecha, lotería
- [ ] Calcular total pendiente de pago
- [ ] Identificar premios más antiguos sin pagar

#### 2.3 Tasa de Retorno (RTP - Return to Player)
- [ ] Calcular porcentaje de premios respecto a ingresos
- [ ] Comparar RTP por lotería
- [ ] Análisis de RTP por turno
- [ ] Tendencias de RTP en el tiempo

**Fórmula:**
```
RTP = (Total Prizes / Total Income) * 100
```

### 3. Reportes de Usuarios

#### 3.1 Top Usuarios por Volumen
- [ ] Crear RPC `get_top_users_by_volume(p_start_date, p_end_date, p_limit)`
- [ ] Ranking de usuarios por cantidad de tickets
- [ ] Ranking por monto total apostado
- [ ] Ranking por cantidad de jugadas

#### 3.2 Análisis de Comportamiento de Usuarios
- [ ] Frecuencia de apuestas por usuario
- [ ] Horarios preferidos de apuesta
- [ ] Loterías y turnos más apostados por usuario
- [ ] Tipos de apuesta favoritos

#### 3.3 Usuarios Ganadores
- [ ] Top usuarios con más premios ganados
- [ ] Usuarios con mejor tasa de aciertos
- [ ] Análisis de "suerte" por usuario

### 4. Reportes de Loterías y Turnos

#### 4.1 Loterías Más Populares
- [ ] Ranking de loterías por cantidad de apuestas
- [ ] Loterías por monto apostado
- [ ] Tendencias de popularidad en el tiempo

#### 4.2 Análisis por Turno
- [ ] Comparación de turnos (Matutina, Vespertina, Nocturna)
- [ ] Turnos más apostados por día de semana
- [ ] Rentabilidad por turno

#### 4.3 Números Más Apostados
- [ ] Top números más jugados por lotería
- [ ] Top números más jugados por posición (cabeza, 5 primeros, etc.)
- [ ] Comparar con números más salidos (resultados)

### 5. Reportes de Tendencias

#### 5.1 Tendencias Semanales
- [ ] Análisis de comportamiento por día de la semana
- [ ] Identificar días pico y días bajos
- [ ] Patrones recurrentes

#### 5.2 Tendencias Mensuales
- [ ] Comparación mes a mes
- [ ] Crecimiento o decrecimiento
- [ ] Estacionalidad

#### 5.3 Horas Pico
- [ ] Análisis de actividad por hora del día
- [ ] Identificar horarios con más tickets
- [ ] Optimización de horarios de cierre

### 6. Dashboards y Visualización

#### 6.1 Dashboard Principal
- [ ] Métricas clave del día actual
- [ ] Comparación con día anterior
- [ ] Gráficos de tendencias
- [ ] Alertas de anomalías

**Métricas del dashboard:**
- Tickets del día
- Ingresos del día
- Premios pagados
- Ganancia neta
- Tickets pendientes de pago
- Usuarios activos

#### 6.2 Gráficos y Visualizaciones
- [ ] Gráfico de líneas: Ingresos en el tiempo
- [ ] Gráfico de barras: Loterías más apostadas
- [ ] Gráfico de torta: Distribución por turno
- [ ] Heatmap: Actividad por día/hora

### 7. Exportación de Reportes

#### 7.1 Exportar a CSV
- [ ] Endpoint para exportar reportes a CSV
- [ ] Incluir todos los reportes principales
- [ ] Formato compatible con Excel

#### 7.2 Exportar a PDF
- [ ] Generar reportes en formato PDF
- [ ] Incluir gráficos y tablas
- [ ] Header con logo y fecha

#### 7.3 Reportes Programados
- [ ] Sistema de reportes automáticos vía email
- [ ] Configuración de frecuencia (diario, semanal, mensual)
- [ ] Suscripción a reportes específicos

### 8. Endpoints de Backend

#### 8.1 Crear Módulo de Reportes
- [ ] Crear módulo `api/src/reports/`
- [ ] Controllers: `reports.controller.ts`
- [ ] Repositories: `reports.repository.ts`
- [ ] Routes: `reports.route.ts`
- [ ] Types: `reports.type.ts`

#### 8.2 Endpoints Principales
```typescript
// Tickets
GET /api/private/reports/tickets/per-day
GET /api/private/reports/tickets/average
GET /api/private/reports/tickets/average-per-day

// Bets
GET /api/private/reports/bets/per-day
GET /api/private/reports/bets/average-per-ticket

// Financials
GET /api/private/reports/financial/summary
GET /api/private/reports/financial/unpaid-prizes
GET /api/private/reports/financial/rtp

// Users
GET /api/private/reports/users/top-by-volume
GET /api/private/reports/users/behavior
GET /api/private/reports/users/winners

// Lotteries
GET /api/private/reports/lotteries/popular
GET /api/private/reports/lotteries/by-schedule
GET /api/private/reports/lotteries/top-numbers

// Trends
GET /api/private/reports/trends/weekly
GET /api/private/reports/trends/monthly
GET /api/private/reports/trends/peak-hours

// Dashboard
GET /api/private/reports/dashboard/summary
GET /api/private/reports/dashboard/today

// Export
GET /api/private/reports/export/csv
GET /api/private/reports/export/pdf
```

#### 8.3 Parámetros Comunes
Todos los endpoints deberían aceptar:
- `start_date`: Fecha inicio (opcional, default: hace 30 días)
- `end_date`: Fecha fin (opcional, default: hoy)
- `user_id`: Filtrar por usuario (opcional)
- `lottery_id`: Filtrar por lotería (opcional)
- `schedule_id`: Filtrar por turno (opcional)

### 9. Optimización y Performance

#### 9.1 Cacheo de Reportes
- [ ] Implementar caché para reportes frecuentes
- [ ] TTL de 5-15 minutos según el reporte
- [ ] Invalidar caché al crear nuevos tickets/bets

#### 9.2 Tablas Materializadas
- [ ] Considerar vistas materializadas para cálculos pesados
- [ ] Refresh automático con triggers o cron
- [ ] Vistas para reportes más solicitados

#### 9.3 Pre-agregación de Datos
- [ ] Tabla de resúmenes diarios pre-calculados
- [ ] Actualizar con trigger al insertar tickets/bets
- [ ] Reducir cálculos en tiempo real

**Ejemplo de tabla de agregación:**
```sql
CREATE TABLE daily_summaries (
  date DATE PRIMARY KEY,
  total_tickets INT,
  total_bets INT,
  total_income DECIMAL,
  total_prizes DECIMAL,
  net_profit DECIMAL,
  avg_ticket_amount DECIMAL,
  avg_bets_per_ticket DECIMAL,
  -- ... más métricas
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 10. Testing y Validación

#### 10.1 Tests Unitarios
- [ ] Tests para cada RPC
- [ ] Tests para controllers
- [ ] Validar cálculos matemáticos

#### 10.2 Tests de Performance
- [ ] Benchmark con gran volumen de datos
- [ ] Validar que queries no excedan 2-3 segundos
- [ ] Optimizar queries lentas

#### 10.3 Validación de Datos
- [ ] Verificar que reportes coincidan con datos reales
- [ ] Comparar totales manualmente
- [ ] Validar edge cases (sin datos, fechas inválidas, etc.)

### 11. Frontend Integration

#### 11.1 Hooks de Reportes
- [ ] `useTicketsPerDay()`
- [ ] `useBetsPerDay()`
- [ ] `useFinancialReport()`
- [ ] `useDashboardSummary()`

#### 11.2 Componentes de Visualización
- [ ] `<ReportChart>` para gráficos
- [ ] `<ReportTable>` para tablas de datos
- [ ] `<DashboardCard>` para métricas clave
- [ ] `<ExportButton>` para exportaciones

#### 11.3 Página de Reportes
- [ ] Crear página `/reports` en frontend
- [ ] Filtros interactivos (fechas, usuarios, loterías)
- [ ] Gráficos responsivos
- [ ] Exportación desde UI

### 12. Documentación

- [ ] Documentar todos los endpoints en README o Swagger
- [ ] Explicar cálculos y fórmulas usadas
- [ ] Ejemplos de uso de cada reporte
- [ ] Actualizar CHANGELOG

## Estado Actual

**Fecha de creación:** 2025-11-20
**Estado:** Pendiente de implementación
**Prioridad:** Alta (feature importante para análisis de negocio)
**Dependencias:** Sistema de caché, optimización de índices

## Estimación

- **Diseño de esquema y RPCs:** 1-2 semanas
- **Backend endpoints:** 1-2 semanas
- **Testing y optimización:** 1 semana
- **Frontend integration:** 1-2 semanas
- **Documentación:** 2-3 días
- **Total:** ~6-8 semanas de desarrollo completo

## Consideraciones

### Privacidad y Seguridad
- Solo usuarios ADMIN deben acceder a reportes generales
- Usuarios regulares solo ven sus propios reportes
- No exponer datos sensibles de otros usuarios

### Performance
- Reportes complejos pueden ser costosos computacionalmente
- Implementar paginación para reportes grandes
- Considerar procesamiento en background para reportes pesados
- Rate limiting en endpoints de reportes

### Escalabilidad
- Sistema diseñado para crecer con volumen de datos
- Considerar particionamiento de tablas históricas
- Archivado de reportes antiguos si es necesario

## Extensiones Futuras

### Machine Learning
- Predicción de tendencias futuras
- Detección de anomalías automática
- Recomendaciones personalizadas

### Integraciones
- Webhooks para alertas automáticas
- API pública para partners
- Integración con sistemas de contabilidad

### Análisis Avanzado
- Análisis de cohortes de usuarios
- Lifetime value (LTV) por usuario
- Churn analysis
- A/B testing framework

---

## 📚 Referencias y Documentación Relacionada

### Database Optimization
Para información detallada sobre la optimización de índices completada, ver:
- **[action_plan_database_optimization.md](./action_plan_database_optimization.md)** - Plan completo de optimización de base de datos (Fases 1-2 ✅ completadas)
  - **Estado:** ~80% completado
  - **Completado:** Índices optimizados para tickets y bets (Fases 1-2)
  - **Pendiente:** Fases 3-5 (otras tablas)
  - **Resultados:** Mejora del 85.7% en performance de queries críticas

### Security & Data Integrity
Para planes de seguridad y validaciones de integridad de datos, ver:
- **[PLAN_VALIDACIONES_OWNER.md](./PLAN_VALIDACIONES_OWNER.md)** - Plan de validaciones de OWNER y protección de organización
  - **Objetivo:** Implementar validaciones para garantizar un único OWNER en el sistema y proteger su organización
  - **Estado:** Pendiente de implementación ⏳
  - **Prioridad:** Alta (seguridad y integridad de datos)
  - **Estimación:** 2-3 días de desarrollo
  - **Fases:**
    1. Tipos de error y mensajes (helper)
    2. Métodos de repositorio para validaciones de OWNER
    3. Validaciones en controllers (user + organization)
    4. Manejo de errores en routes
    5. Database constraints (índice UNIQUE)
    6. Actualización de CHANGELOGs
  - **Validaciones implementadas:**
    - ✅ Solo 1 OWNER en todo el sistema
    - ✅ OWNER no se puede eliminar (excepto con acceso directo a BD)
    - ✅ Organización del OWNER no se puede eliminar
    - ✅ Organización del OWNER no se envía al frontend

### Features Futuras
Para planes de implementación de features futuras, ver:
- **[../group.md](../group.md)** - Plan de implementación del sistema de grupos
  - **Prerequisito:** Implementar DESPUÉS de completar sistema de organizaciones
  - **Objetivo:** Sistema de grupos dentro de cada organización para mejor organización de usuarios (principalmente cashiers)
  - **Estado:** Pendiente de implementación
  - **Estimación:** TBD

---
