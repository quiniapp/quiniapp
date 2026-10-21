-- Polla: la liquidación no tiene deje. Se levanta la polla y se liquida pase,
-- premios y comisión del pasador, sin arrastre ni recargo.
--
-- Las funciones de cuenta corriente ya dejan drag y leave en 0 cuando el
-- pasador tiene fee_plus = 0, así que alcanza con fijarlo en 0. La API lo
-- fuerza en el alta y la edición de pasadores. El historial no se toca.

UPDATE polla_users
SET fee_plus = 0,
    edited_at = NOW()
WHERE user_type = 'CASHIER'
  AND fee_plus <> 0;
