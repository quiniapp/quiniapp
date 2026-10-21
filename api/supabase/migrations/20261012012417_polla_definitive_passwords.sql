-- Polla: las contraseñas que pone un superior son definitivas.
--
-- Nadie se cambia la contraseña a sí mismo: la pone (o la blanquea) un usuario
-- de rango superior y ya no se obliga a cambiarla al entrar. Quien tenía una
-- contraseña temporal pendiente la conserva como definitiva.
--
-- Única excepción: el OWNER del seed mientras siga con la contraseña inicial
-- (`polla2026`, publicada en 20260928100500_polla_seed_owner.sql). Esa sigue
-- obligando a cambiarla en el primer ingreso: si no, cualquiera que lea el
-- repositorio entra como OWNER.

UPDATE polla_users
SET password_reset_required = FALSE,
    edited_at = NOW()
WHERE password_reset_required
  AND password_hash IS DISTINCT FROM '$2b$12$BYExO1RGNiqeIbaQzAhvXOx2xTayRH2R7z98M97KULaqh4hGFdudO';
