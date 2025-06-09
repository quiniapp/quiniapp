-- 🔁 Paso 1: eliminar si existen
ALTER TABLE bets DROP CONSTRAINT IF EXISTS chk_number_allowed_lengths;
ALTER TABLE bets DROP CONSTRAINT IF EXISTS chk_borratina_number_with_length;

UPDATE bets
SET number = LPAD(number, 10, '0')
WHERE char_length(number) = 8;


-- ✅ Paso 2: agregar constraints corregidas
ALTER TABLE bets
ADD CONSTRAINT chk_number_allowed_lengths
  CHECK (char_length(number) IN (1, 2, 3, 4, 10));

ALTER TABLE bets
ADD CONSTRAINT chk_borratina_number_with_length
  CHECK (
    bet_type != 'BORRATINA' OR char_length(number) = 10
  );
