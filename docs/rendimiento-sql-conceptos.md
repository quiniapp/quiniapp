# Rendimiento SQL explicado — Conceptos para aplicar

> Fuente: *Rendimiento SQL explicado* (Markus Winand). Resumen propio, organizado para convertirse en skills.
> Foco: índices B-tree y cómo escribir SQL que los aproveche. Notas específicas de **PostgreSQL** marcadas con 🐘.

---

## 0. Idea central

- SQL separa el **qué** del **cómo**, pero el rendimiento rompe esa abstracción: quien escribe la query tiene que saber cómo la va a ejecutar la base.
- **Indexar es una tarea de desarrollo**, no de DBA/infra. Lo que define un buen índice es *cómo la aplicación accede a los datos*, y eso lo conoce el developer.
- La mejor palanca para bajar tiempos de respuesta es **indexar bien** (explotar el crecimiento logarítmico del B-tree). Hardware y escalado horizontal no arreglan un mal índice.

---

## 1. Anatomía de un índice

### Estructuras
- **Nodos hoja**: lista doblemente enlazada de bloques (páginas) que mantiene las entradas ordenadas, independientemente del orden físico. Cada entrada = valor(es) indexados + referencia a la fila (ROWID / ctid 🐘).
- **B-tree (árbol balanceado)**: nodos rama sobre las hojas para llegar rápido a cualquier hoja. Profundidad igual para todas las hojas y crece logarítmicamente (4–5 niveles alcanzan para millones de filas).
- Cada INSERT/UPDATE/DELETE mantiene el índice → costo de escritura.

### Las 3 etapas de un acceso por índice
1. **Recorrido del árbol** — barato, acotado por la profundidad.
2. **Recorrido de la cadena de hojas** — puede ser largo si muchas entradas coinciden.
3. **Acceso a la tabla** — una lectura (potencialmente aleatoria) por cada fila encontrada.

### "Índices lentos" (mito del índice degenerado)
- Un índice casi nunca está "roto"/"desbalanceado". La lentitud viene de las etapas 2 y 3: recorrer muchas hojas y hacer muchos accesos a tabla.
- 🐘 Equivalencias: `Index Scan` = recorrido + acceso a tabla; `Index Only Scan` = sin tabla; `Bitmap Index Scan`+`Bitmap Heap Scan` = junta punteros y lee la tabla en orden físico.

**Regla:** cuando un índice "es lento", mirar cuántas filas recorre en hojas y cuántas va a buscar a la tabla, no reconstruir el índice.

---

## 2. El filtro WHERE (núcleo del libro)

### 2.1 Igualdad y clave primaria
- PK con igualdad → `INDEX UNIQUE SCAN`: recorrido del árbol y como mucho una fila. No hay riesgo de "índice lento".
- `INDEX RANGE SCAN` / 🐘 `Index Scan` con varias filas → riesgo en etapas 2 y 3.

### 2.2 Índices concatenados (multi-columna)
- Un solo índice con varias columnas, ordenado como una guía telefónica: primero por la 1ª columna, después por la 2ª, etc.
- **Sólo sirve para búsquedas que usen las columnas desde la izquierda** (prefijo). Un índice `(a, b)` no sirve para buscar sólo por `b` (salvo skip-scan en algunos motores).
- **La decisión más importante es el orden de las columnas.** Criterio: maximizar la cantidad de queries que pueden usar el índice, no "la columna más selectiva primero" (eso es un mito).
- Un buen índice concatenado puede reemplazar varios índices de una columna → menos índices = mejores escrituras.
- Truco para visualizar el índice: `SELECT <cols del índice> FROM t ORDER BY <cols del índice> LIMIT 100`.

### 2.3 El optimizador y las estadísticas
- Optimizador basado en costos (CBO) vs. reglas (RBO, obsoleto). El CBO depende de **estadísticas** (cardinalidad, valores distintos, histogramas).
- Estadísticas desactualizadas o ausentes → planes malos (p.ej. elige un índice que recorre muchas filas porque cree que son pocas).
- Siempre **comparar filas estimadas vs. reales** en el plan. 🐘 `EXPLAIN (ANALYZE, BUFFERS)` y `ANALYZE tabla`; estadísticas extendidas con `CREATE STATISTICS` para columnas correlacionadas o expresiones.

### 2.4 Funciones sobre columnas
- `WHERE UPPER(last_name) = 'X'` **no puede usar** un índice sobre `last_name`: para el optimizador la función es una caja negra.
- Solución: **índice basado en función/expresión** sobre exactamente la misma expresión. 🐘 `CREATE INDEX ON employees (UPPER(last_name));` (MySQL/SQL Server: columna generada + índice).
- Alternativa para case-insensitive: collation insensible. 🐘 `citext` o collations no deterministas.
- Ojo con ORMs que inyectan `LOWER()`/`UPPER()` sin avisar.
- **Funciones definidas por usuario**: sólo indexables si son deterministas (🐘 `IMMUTABLE`). No mentir: una función que depende del tiempo (p.ej. calcular edad con `now()`) declarada determinista da resultados incorrectos.
- Después de crear un índice de expresión, actualizar estadísticas.
- **Sobre-indexar** es un anti-patrón: preferir unificar el camino de acceso (un índice que sirva a varias queries) e indexar el dato original.

### 2.5 Bind parameters (variables de enlace / prepared statements)
- Ventajas: **seguridad** (anti SQL injection) y **rendimiento** (reutilizar planes en caché, evitar re-optimizar).
- Desventaja: el optimizador no ve el valor real; con distribuciones muy desiguales (histogramas) a veces un literal daría mejor plan. Son casos raros → **usar bind parameters por defecto**.
- Cuanto más compleja la query, más importa.
- No sirven para nombres de tablas/columnas (no cambian la estructura del SQL).
- 🐘 En node-postgres: `client.query('... WHERE id = $1', [id])`. PostgreSQL decide entre plan custom y genérico (`plan_cache_mode`).

### 2.6 Búsquedas por rango (`<`, `>`, `BETWEEN`)
- El mayor riesgo de rendimiento: el recorrido de hojas. **Mantener el rango escaneado lo más chico posible.**
- **Predicados de acceso vs. de filtro:**
  - *Acceso*: definen dónde empieza y termina el escaneo del índice → reducen el rango.
  - *Filtro de índice*: se evalúan mientras se recorren las hojas, **no** reducen el rango.
  - *Filtro de tabla*: columnas que no están en el índice; requieren ir a la tabla.
- **Regla de oro: en índices concatenados, primero las columnas con igualdad, después las de rango.** Una columna de rango en el medio convierte a las siguientes en predicados de filtro.
- 🐘 `Index Cond` mezcla acceso y filtro de índice: hay que comparar con la definición del índice para distinguirlos. `Filter` siempre es filtro a nivel de tabla.

### 2.7 LIKE
- Sólo la parte **antes del primer comodín** sirve como predicado de acceso.
- `LIKE 'WIN%D'` → acceso por `WIN`; `LIKE '%TERM'` → no puede acotar el índice (escaneo completo).
- Con bind parameters el optimizador asume que no hay comodín inicial.
- Para búsquedas de texto completo / sufijos usar otra herramienta (🐘 full text search, `pg_trgm` + GIN/GiST).
- 🐘 Con collation no-C, el índice B-tree necesita `text_pattern_ops` para que LIKE con prefijo lo use.

### 2.8 Combinar índices (index merge)
- En general **un índice concatenado le gana a dos índices separados**: un escaneo es más rápido que dos más la combinación.
- Al tener dos rangos independientes, elegir cuál va en el índice (el más selectivo) y dejar el otro como filtro.
- Índices bitmap (data warehouse): buenos para queries ad hoc, **inútiles en OLTP** por la concurrencia de escritura. 🐘 `BitmapAnd`/`BitmapOr` combina índices B-tree en memoria como plan B.

### 2.9 Índices parciales
- Indexar sólo las filas que importan: `CREATE INDEX ... ON messages (receiver) WHERE processed = 'N';`
- Ventajas: índice más chico, menos mantenimiento, el árbol puede ser menos profundo.
- Ideal para colas, "pendientes", soft-delete (`WHERE deleted_at IS NULL`). 🐘 soportado nativamente.
- La query debe incluir la condición del índice (de forma literal/compatible) para usarlo.

### 2.10 NULL (sobre todo Oracle)
- Oracle no indexa filas donde todas las columnas del índice son NULL → `IS NULL` no usa índice salvo que se agregue una columna NOT NULL (o una constante).
- Las restricciones `NOT NULL` le dan información al optimizador; sacarlas puede impedir el uso de índices.
- 🐘 PostgreSQL sí indexa NULL y soporta `IS NULL` con índice; se pueden usar índices parciales directamente.

### 2.11 Condiciones "ofuscadas" (anti-patrones que impiden usar índices)
- **Fechas**: no aplicar funciones a la columna (`TRUNC(sale_date)`, `to_char(...)`, `DATE(col)`). Escribir **rangos explícitos**, incluso para un solo día:
  `sale_date >= :dia AND sale_date < :dia + INTERVAL '1 day'`.
- No comparar fechas como strings.
- **Cadenas numéricas**: guardar números como tipos numéricos. `WHERE texto_num = 42` fuerza conversión de la columna → sin índice (al revés, `num = '42'` sí funciona porque convierte el literal).
- **Columnas combinadas** (fecha y hora separadas, concatenaciones): no buscar sobre la expresión combinada; agregar una condición redundante sobre la columna significativa o usar row values 🐘 `(a, b) > (?, ?)`.
- **Lógica "inteligente"** (`WHERE (:p IS NULL OR col = :p) AND ...`): el plan debe servir para todos los casos → termina en full scan. Solución: **SQL dinámico** que incluya sólo los filtros necesarios, siempre con bind parameters.
- **Matemáticas**: `WHERE a + 1 = 10` no usa índice sobre `a`; despejar la columna (`a = 9`) o usar índice de expresión.
- Tipos que no coinciden entre columna y parámetro → conversión implícita sobre la columna → sin índice.

---

## 3. Rendimiento y escalabilidad

- **Escalabilidad** = cómo cambia el rendimiento al crecer un factor (volumen de datos, carga). Un benchmark es un único punto de esa curva.
- Los **predicados de filtro son minas sin explotar**: con pocos datos no se notan; al crecer el volumen el tiempo crece linealmente. Revisar planes y predicados da más confianza que benchmarks superficiales.
- Desde el plan se puede reconstruir qué índice falta: las columnas que aparecen como filtro deberían ser de acceso.
- **Carga del sistema**: más hardware o más nodos no arreglan un índice malo; a lo sumo posponen el problema. Escalado horizontal (NoSQL/sharding) no mejora el tiempo de respuesta de una query mala.
- **Tiempo de respuesta vs. throughput**: hardware más rápido agrega throughput, no baja mucho la latencia. La latencia de disco/red se combate con **menos accesos** (índices correctos, menos round-trips).
- Menos round-trips entre app y DB (ver N+1).

---

## 4. Joins

- Las bases unen de a dos tablas (o resultados intermedios). El orden y el algoritmo los elige el optimizador; los bind parameters ayudan a cachear planes de joins complejos.

### Nested loops
- Por cada fila del lado "guía", busca en la otra tabla. Bueno si el lado guía devuelve pocas filas y **hay índice sobre las columnas de join** de la tabla interna.
- **Problema N+1 (ORMs)**: hacer el nested loop en la aplicación (una query por fila) multiplica las latencias de red. **Hacer los joins en la base**: eager fetching / joins explícitos en el ORM. Conocer cómo genera SQL el ORM que usás.
- JPA/Hibernate fetch joins devuelven el padre repetido por cada hijo (deduplicar).

### Hash join
- Carga un lado (el más chico) en una tabla hash en memoria y prueba cada fila del otro lado.
- **Indexar las columnas del join no ayuda** a un hash join. Lo que ayuda:
  - Indexar los **predicados independientes** del WHERE (filtros sobre cada tabla).
  - **Achicar la tabla hash**: menos filas (filtros) y **menos columnas** (evitar `SELECT *`). Si la tabla hash no entra en memoria, se va a disco.
- El orden del join no cambia cómo indexar un hash join.

### Sort merge
- Ordena ambos lados por la clave de join y los combina como un cierre. Útil si ambos ya vienen ordenados (p.ej. por índice) o en outer joins simétricos. Se indexa como el hash join (predicados independientes).

---

## 5. Agrupación (clustering) de datos — el "segundo poder" de los índices

- **Clustering** = guardar juntos los datos que se leen juntos → menos bloques leídos.
- **Predicados de filtro usados a propósito**: agregar columnas al índice (aunque sean filtro) para descartar filas antes de ir a la tabla. Ej.: índice para `LIKE '%x%'` que no se puede acotar, pero agregar la columna evita accesos a tabla.
- **Index-only scan (índice de cobertura)**: si el índice contiene todas las columnas que usa la query (WHERE + SELECT), no hay acceso a tabla.
  - Beneficio depende de cuántas filas se leen y del **clustering factor** (correlación entre orden del índice y orden de la tabla).
  - Es una estrategia agresiva: no hacerlo "por las dudas" (más tamaño y mantenimiento). Reservarlo para queries críticas.
  - Frágil: agregar una columna al SELECT rompe el index-only scan.
  - 🐘 `INCLUDE (col)` para columnas no clave; el index-only scan depende del *visibility map* (`VACUUM` al día).
  - Agregar agregaciones (`SUM`) sobre columnas del índice también puede quedar index-only.
- **Tablas organizadas por índice / índices agrupados** (Oracle IOT, SQL Server clustered, InnoDB): la tabla *es* el índice.
  - Los índices secundarios guardan la clave de agrupación, no un ROWID → acceder a la tabla vía índice secundario es caro (dos recorridos de árbol).
  - Regla: tablas con **un solo índice** → mejor organizadas por índice. Tablas con varios índices → mejor heap + index-only scans donde haga falta.
  - 🐘 PostgreSQL usa heap; `CLUSTER` reordena una vez (no se mantiene).

---

## 6. ORDER BY y GROUP BY

### ORDER BY en pipeline
- Si el orden del índice coincide con el ORDER BY, la base **evita el sort** y puede devolver filas apenas las encuentra (pipeline).
- El índice debe cubrir: columnas de igualdad del WHERE + columnas del ORDER BY en orden. Un rango en el WHERE seguido de otra columna rompe el orden.
- El costo estimado no siempre refleja el esfuerzo real (un índice con peor clustering factor puede parecer más caro).
- 🐘 en el plan: ausencia de nodo `Sort`.

### ASC / DESC / NULLS FIRST/LAST
- Las bases leen índices **en ambos sentidos**: `ORDER BY a DESC, b DESC` usa un índice `(a, b)`.
- Si se **mezclan** ASC y DESC (`ORDER BY a ASC, b DESC`), el índice debe definirse con ese mismo orden: `CREATE INDEX ... (a ASC, b DESC)`. Esto no afecta el uso del índice para el WHERE.
- Lo mismo con `NULLS FIRST/LAST` (🐘 soportado en la definición del índice).

### GROUP BY
- Dos algoritmos: **hash** (no necesita orden, materializa, 🐘 `HashAggregate`) y **sort/group** (🐘 `GroupAggregate`, en pipeline si el índice da el orden).
- Indexar para GROUP BY sigue las mismas reglas que ORDER BY; el sort/group en pipeline evita materializar y permite top-N.

---

## 7. Resultados parciales

### Top-N
- Decirle a la base desde el principio que sólo querés N filas: `FETCH FIRST n ROWS ONLY` / 🐘 `LIMIT n`. No traer todo y cortar en la app (ni usar cursores leyendo "sólo las primeras").
- **Top-N en pipeline**: con un índice que satisface el ORDER BY, no lee ni ordena toda la tabla; el tiempo depende de N, no del tamaño de la tabla.
- Sin índice adecuado: lee y ordena todo antes de entregar la primera fila.

### Paginación
- **Offset** (`LIMIT 10 OFFSET 1000`): fácil y permite saltar a cualquier página, pero lee y descarta todas las filas anteriores → se degrada con cada página; además, filas nuevas desplazan resultados (duplicados/saltos).
- **Método de búsqueda / keyset (seek)**: filtrar por los valores de la última fila de la página anterior.
  - Requiere **orden determinista** (agregar una columna única como desempate, p.ej. `id`).
  - 🐘 Usar **row values**: `WHERE (sale_date, sale_id) < (?, ?) ORDER BY sale_date DESC, sale_id DESC LIMIT 10` con índice `(sale_date, sale_id)`.
  - Alternativa lógica equivalente: `sale_date <= ? AND NOT (sale_date = ? AND sale_id >= ?)` (redundancia para que use el índice como acceso).
  - Contras: no permite saltar a página arbitraria, navegar hacia atrás requiere invertir comparaciones y orden. Ideal para **scroll infinito / "cargar más"** y APIs con cursor.
  - Rendimiento constante sin importar la profundidad de la página.

### Funciones de ventana
- `ROW_NUMBER() OVER (ORDER BY ...)` permite paginación con offset en pipeline si la base lo optimiza (Oracle, 🐘 desde PG15 `Run Condition` en `WindowAgg`). Útil para paginación más flexible (p.ej. por rangos lógicos).

---

## 8. Modificación de datos

- **INSERT**: no usa WHERE, no se beneficia de índices; **cada índice lo hace más lento** (el primero es el que más impacta). Mantener pocos índices. Para cargas masivas puede convenir borrar índices y recrearlos al final.
- **DELETE**: tiene WHERE → se beneficia de índices para encontrar filas, pero cada índice se debe mantener. Tiene plan de ejecución: revisarlo. `TRUNCATE` es más rápido pero (en Oracle/MySQL) hace commit implícito y no ejecuta triggers.
  - 🐘 MVCC: el DELETE sólo marca la fila; limpieza física en `VACUUM`. El costo del DELETE no depende del número de índices.
- **UPDATE**: ≈ DELETE + INSERT en cada índice afectado. Sólo cuesta en los índices que contienen columnas modificadas.
  - No actualizar columnas que no cambiaron (ORMs que hacen `UPDATE` de todas las columnas → tocan todos los índices).
  - 🐘 HOT updates: si no se modifica ninguna columna indexada y hay lugar en la página, no se tocan los índices.
- Conclusión: **usar índices con intención y moderación**; cada índice tiene costo de escritura, memoria y mantenimiento.

---

## 9. Planes de ejecución (Apéndice A)

### PostgreSQL 🐘
- `EXPLAIN` muestra costo inicial..costo total, filas estimadas, ancho.
- `EXPLAIN (ANALYZE, BUFFERS)` **ejecuta** la query → con INSERT/UPDATE/DELETE envolver en `BEGIN; ... ROLLBACK;`.
- Para queries con parámetros: `PREPARE stmt(...) AS ...; EXPLAIN EXECUTE stmt(...); DEALLOCATE stmt;`.
- Operaciones clave:
  | Operación | Significado |
  |---|---|
  | `Seq Scan` | tabla completa |
  | `Index Scan` | recorrido B-tree + hojas + acceso a tabla |
  | `Index Only Scan` | sin acceso a tabla (salvo visibilidad) |
  | `Bitmap Index Scan` / `Bitmap Heap Scan` | junta punteros, lee tabla en orden físico; `Recheck Cond` |
  | `Nested Loop` / `Hash Join`+`Hash` / `Merge Join` | algoritmos de join |
  | `Sort` (Sort Key) | ordenamiento materializado (no pipeline) |
  | `GroupAggregate` | agrupación en pipeline sobre datos ordenados |
  | `HashAggregate` | agrupación por hash, materializada |
  | `Limit` | top-N; ineficiente si debajo hay un `Sort` |
  | `WindowAgg` | funciones de ventana (`Run Condition` = top-N, PG15+) |
- Predicados:
  - `Index Cond` = acceso **o** filtro de índice (comparar con la definición del índice: columnas tras un rango son filtro).
  - `Filter` = filtro a nivel de tabla, aunque el nodo sea `Index Scan`.
  - `Rows Removed by Filter` alto = señal de índice mal diseñado.
- Comparar `rows` estimadas vs `actual rows` para detectar estadísticas malas.

### Otros motores (equivalencias rápidas)
- **Oracle**: `INDEX UNIQUE SCAN`, `INDEX RANGE SCAN`, `TABLE ACCESS BY INDEX ROWID`, `TABLE ACCESS FULL`; sección *Predicate Information* con `access` vs `filter`.
- **SQL Server**: `Index Seek` (con *Seek Predicates* = acceso; *Predicate* = filtro), `Index Scan`/`Table Scan`, `Key Lookup`/`RID Lookup`.
- **MySQL**: columna `type` (`const`, `ref`, `range`, `index`, `ALL`), `key`, `key_len` (cuántas columnas del índice se usan como acceso), `Extra` (`Using index`, `Using where`, `Using filesort`).

---

## 10. Checklist consolidada (para revisar una query)

1. ¿La query usa bind parameters?
2. ¿Hay funciones, casts, matemáticas o conversiones de tipo **sobre columnas** en el WHERE/JOIN? → reescribir o índice de expresión.
3. ¿Las fechas se filtran con rangos semiabiertos explícitos?
4. ¿Hay "lógica inteligente" `(:p IS NULL OR col = :p)`? → SQL dinámico.
5. ¿Hay `LIKE '%...'`? → otra estrategia (trigram/FTS).
6. ¿Existe un índice cuyo **prefijo** cubra las columnas de igualdad, seguido de las de rango?
7. En el plan: ¿qué condiciones son acceso y cuáles filtro? ¿`Rows Removed by Filter` alto?
8. ¿Estimadas vs reales coinciden? Si no → estadísticas.
9. ¿Hay `Sort` que se podría evitar con un índice alineado al ORDER BY (incl. ASC/DESC mixtos)?
10. ¿Se pide top-N con `LIMIT`/`FETCH FIRST`? ¿Paginación con offset profundo? → keyset.
11. ¿Joins hechos en la base (no N+1)? ¿Columnas de join indexadas para nested loops? ¿Filtros independientes indexados para hash joins?
12. ¿`SELECT *` innecesario? (rompe index-only scan y agranda hash joins).
13. ¿Vale la pena un index-only scan para esta query crítica?
14. ¿Cuántos índices tiene ya la tabla? ¿El nuevo índice puede reemplazar otros (unificar)?
15. ¿Se pensó cómo escala con 10x/100x de datos, no sólo el tiempo actual?

---

## 11. Propuesta de skills a derivar

| Skill | Disparador | Qué hace | Secciones base |
|---|---|---|---|
| `sql-index-design` | "qué índice creo", nueva tabla/feature, query lenta | Diseña índices concatenados: igualdad → rango → orden → columnas de cobertura; evalúa unificar índices, parciales, de expresión; estima costo de escritura | 1, 2.2, 2.6, 2.9, 5, 6, 8 |
| `sql-query-review` | revisar SQL/ORM en un PR, query lenta | Aplica la checklist (§10): detecta columnas ofuscadas, lógica inteligente, LIKE con comodín inicial, N+1, `SELECT *`, falta de bind params; propone reescrituras | 2.4–2.11, 4, 10 |
| `postgres-explain-reader` | pegan un `EXPLAIN`/`EXPLAIN ANALYZE` | Interpreta el plan: acceso vs filtro, estimadas vs reales, sorts evitables, joins, y propone índice/reescritura | 2.3, 2.6, 9 |
| `sql-pagination` | listados, endpoints paginados, scroll infinito | Implementa top-N y keyset pagination con row values + índice que lo soporte; cursores en API (Express) | 6, 7 |
| `orm-sql-performance` | código con Prisma/TypeORM/Sequelize/Knex | Detecta N+1, fetch eager/lazy, columnas parciales, updates de todas las columnas, LOWER implícitos | 2.4, 4, 5, 8 |
| `sql-write-performance` | tablas con alto volumen de escritura, cargas masivas | Auditar cantidad de índices, HOT updates, cargas bulk, DELETE/UPDATE con plan | 8 |

Cada skill debería incluir: reglas (de este documento), ejemplos antes/después en PostgreSQL + TypeScript (`pg`), y pasos para verificar con `EXPLAIN (ANALYZE, BUFFERS)` dentro de transacción con `ROLLBACK`.
