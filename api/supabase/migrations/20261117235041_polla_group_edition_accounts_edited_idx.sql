-- Parte diario de grupos por rango de fechas (17/11/2026): lee las
-- liquidaciones de grupo de una organización entre dos fechas de liquidación
-- (`edited_at`, que se pone al crear y al reliquidar), ordenadas por fecha y
-- con el id como desempate.
--
-- La tabla solo tenía la PK y el único (grupo, edición). Índice con la
-- igualdad (organización), el rango y orden (fecha) y el desempate (id), así
-- la consulta no ordena. La tabla es chica (grupos × ediciones): va sin
-- CONCURRENTLY.
CREATE INDEX IF NOT EXISTS idx_polla_group_edition_accounts_org_edited
  ON polla_group_edition_accounts (polla_organization_id, edited_at, polla_group_edition_account_id);
