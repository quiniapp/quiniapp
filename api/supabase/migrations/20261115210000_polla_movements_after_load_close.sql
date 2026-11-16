-- Cobros, pagos y reclamos solo con la carga cerrada.
--
-- La web carga movimientos solo en las ediciones de la lista (carga cerrada),
-- pero `POST /edition_account/:id/movements` no lo controlaba: llamando a la
-- API directo se podía cargar uno en una edición todavía abierta. Ahora la
-- base lo rechaza (`POLLA_EDITION_LOAD_OPEN`), al cargar y al editar. Dar de
-- baja un movimiento sigue andando siempre.
--
-- Igual que en 20261114140711_polla_edition_accounts.sql; se agrega el control
-- del cierre de carga (`polla_edition_load_close`, 20261115124454).

CREATE OR REPLACE FUNCTION polla_validate_edition_account_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_edition polla_editions;
BEGIN
  SELECT * INTO v_edition
  FROM polla_editions
  WHERE polla_edition_id = NEW.polla_edition_id
    AND polla_organization_id = NEW.polla_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLLA_EDITION_NOT_FOUND';
  END IF;

  IF NOT v_edition.account_by_edition THEN
    RAISE EXCEPTION 'POLLA_EDITION_ACCOUNT_DISABLED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM polla_users
    WHERE polla_user_id = NEW.polla_user_id
      AND polla_organization_id = NEW.polla_organization_id
      AND user_type = 'CASHIER'
  ) THEN
    RAISE EXCEPTION 'POLLA_ACCOUNT_USER_NOT_CASHIER';
  END IF;

  -- Con la carga abierta no hay cuenta que mover (la baja sí pasa).
  IF NEW.deleted_at IS NULL AND polla_now() < polla_edition_load_close(v_edition) THEN
    RAISE EXCEPTION 'POLLA_EDITION_LOAD_OPEN';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.edited_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- ROLLBACK:
-- Volver a crear `polla_validate_edition_account_movement` con su definición
-- anterior (sin el control del cierre de carga):
-- 20261114140711_polla_edition_accounts.sql.
