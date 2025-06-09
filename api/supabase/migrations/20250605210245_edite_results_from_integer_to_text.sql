-- 1. Crear columna temporal
ALTER TABLE results
ADD COLUMN results_text TEXT[] DEFAULT '{}';

-- 2. Copiar los datos convertidos
UPDATE results
SET results_text = ARRAY(
  SELECT elem::TEXT FROM unnest(results) AS elem
);

-- 3. Eliminar constraint antigua (si existe)
ALTER TABLE results
DROP CONSTRAINT IF EXISTS results_results_check;

-- 4. Eliminar columna original
ALTER TABLE results
DROP COLUMN results;

-- 5. Renombrar columna nueva
ALTER TABLE results
RENAME COLUMN results_text TO results;

-- 6. Volver a agregar constraint de longitud = 20
ALTER TABLE results
ADD CONSTRAINT results_results_check CHECK (array_length(results, 1) = 20);
