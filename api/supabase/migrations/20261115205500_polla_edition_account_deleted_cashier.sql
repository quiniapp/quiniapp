-- Pasador eliminado (soft delete) en la cuenta por edición: sigue apareciendo
-- en lo histórico.
--
-- Antes, un pasador con `deleted_at` entraba en la cuenta de una edición solo
-- si tenía tickets o movimientos ahí. Si además le habían borrado todos los
-- tickets (sin descontar), desaparecía de la lista junto con su liquidación
-- vigente. Ahora también entra si tiene una liquidación en la edición.
--
-- Igual que en 20261114141228_polla_edition_account_functions.sql; cambia
-- solo el CTE `cashiers`.

CREATE OR REPLACE FUNCTION polla_edition_account_base(
  p_organization_id UUID,
  p_edition_id UUID,
  p_group_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  polla_user_id UUID,
  user_name TEXT,
  user_number INTEGER,
  polla_group_id UUID,
  fee NUMERIC,
  bets_pass NUMERIC,
  deleted_pass NUMERIC,
  claims NUMERIC,
  pass NUMERIC,
  cashier_commission NUMERIC,
  subtotal NUMERIC,
  collections NUMERIC,
  paid NUMERIC,
  total NUMERIC,
  live_group_id UUID,
  live_fee NUMERIC,
  live_bets_pass NUMERIC,
  live_deleted_pass NUMERIC,
  live_pass NUMERIC,
  live_cashier_commission NUMERIC,
  live_subtotal NUMERIC,
  live_total NUMERIC,
  differs BOOLEAN,
  liquidation_id UUID,
  liquidation_created_at TIMESTAMPTZ,
  liquidation_created_by_name TEXT,
  liquidation_total NUMERIC,
  liquidation_kept_previous_tickets BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH cashiers AS (
    SELECT u.polla_user_id AS uid, u.name AS uname, u.number AS unumber,
           u.polla_group_id AS ugroup, u.fee AS ufee
    FROM polla_users u
    WHERE u.polla_organization_id = p_organization_id
      AND u.user_type = 'CASHIER'
      AND (p_user_id IS NULL OR u.polla_user_id = p_user_id)
      AND (
        u.deleted_at IS NULL
        OR EXISTS (
          SELECT 1 FROM polla_bets b
          WHERE b.polla_edition_id = p_edition_id
            AND b.cashier_polla_user_id = u.polla_user_id
            AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
        )
        OR EXISTS (
          SELECT 1 FROM polla_edition_account_movements m
          WHERE m.polla_edition_id = p_edition_id
            AND m.polla_user_id = u.polla_user_id
            AND m.deleted_at IS NULL
        )
        -- Eliminado pero liquidado en la edición: queda en lo histórico.
        OR EXISTS (
          SELECT 1 FROM polla_edition_liquidations l
          WHERE l.polla_edition_id = p_edition_id
            AND l.polla_user_id = u.polla_user_id
        )
      )
  ),
  tickets AS (
    SELECT b.cashier_polla_user_id AS uid,
           SUM(b.amount) AS bets,
           COALESCE(SUM(b.amount) FILTER (WHERE b.deducted_on IS NOT NULL), 0) AS deleted
    FROM polla_bets b
    WHERE b.polla_edition_id = p_edition_id
      AND b.polla_organization_id = p_organization_id
      AND (b.deleted_at IS NULL OR b.deducted_on IS NOT NULL)
    GROUP BY b.cashier_polla_user_id
  ),
  movs AS (
    SELECT m.polla_user_id AS uid,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'CLAIM'), 0) AS claims_all,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'CLAIM' AND m.amount > 0), 0) AS claims_pos,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'CLAIM' AND m.amount < 0), 0) AS claims_neg,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'COLLECTION'), 0) AS cols,
           COALESCE(SUM(m.amount) FILTER (WHERE m.type = 'PAYMENT'), 0) AS pays
    FROM polla_edition_account_movements m
    WHERE m.polla_edition_id = p_edition_id
      AND m.polla_organization_id = p_organization_id
      AND m.deleted_at IS NULL
    GROUP BY m.polla_user_id
  ),
  liqs AS (
    SELECT DISTINCT ON (l.polla_user_id)
           l.polla_user_id AS uid, l.polla_edition_liquidation_id AS lid, l.created_at AS lcreated,
           cb.name AS lby, l.total AS ltotal, l.kept_previous_tickets AS lkept,
           l.bets_pass AS lbets, l.deleted_pass AS ldeleted, l.fee AS lfee
    FROM polla_edition_liquidations l
    LEFT JOIN polla_users cb ON cb.polla_user_id = l.created_by
    WHERE l.polla_edition_id = p_edition_id
      AND l.polla_organization_id = p_organization_id
    ORDER BY l.polla_user_id, l.created_at DESC, l.polla_edition_liquidation_id DESC
  ),
  raw AS (
    SELECT c.uid, c.uname, c.unumber, c.ugroup, c.ufee,
           COALESCE(t.bets, 0) AS live_bets, COALESCE(t.deleted, 0) AS live_deleted,
           COALESCE(m.claims_all, 0) AS claims_all, COALESCE(m.claims_pos, 0) AS claims_pos,
           COALESCE(m.claims_neg, 0) AS claims_neg, COALESCE(m.cols, 0) AS cols, COALESCE(m.pays, 0) AS pays,
           q.lid, q.lcreated, q.lby, q.ltotal, q.lkept,
           CASE WHEN q.lid IS NULL THEN COALESCE(t.bets, 0) ELSE q.lbets END AS e_bets,
           CASE WHEN q.lid IS NULL THEN COALESCE(t.deleted, 0) ELSE q.ldeleted END AS e_deleted,
           CASE WHEN q.lid IS NULL THEN c.ufee ELSE q.lfee END AS e_fee
    FROM cashiers c
    LEFT JOIN tickets t ON t.uid = c.uid
    LEFT JOIN movs m ON m.uid = c.uid
    LEFT JOIN liqs q ON q.uid = c.uid
  ),
  calc AS (
    SELECT r.*,
           r.e_bets - r.e_deleted + r.claims_pos AS e_pass,
           ROUND((r.e_bets - r.e_deleted + r.claims_pos) * COALESCE(r.e_fee, 0) / 100, 2) AS e_comm,
           r.live_bets - r.live_deleted + r.claims_pos AS l_pass,
           ROUND((r.live_bets - r.live_deleted + r.claims_pos) * COALESCE(r.ufee, 0) / 100, 2) AS l_comm
    FROM raw r
  ),
  fin AS (
    SELECT k.*,
           k.e_pass - k.e_comm + k.claims_neg AS e_sub,
           k.l_pass - k.l_comm + k.claims_neg AS l_sub
    FROM calc k
  )
  SELECT f.uid, f.uname, f.unumber,
         CASE WHEN f.lid IS NULL THEN f.ugroup ELSE (
           SELECT l.polla_group_id FROM polla_edition_liquidations l WHERE l.polla_edition_liquidation_id = f.lid
         ) END,
         f.e_fee,
         f.e_bets::NUMERIC(12,2), f.e_deleted::NUMERIC(12,2), f.claims_all::NUMERIC(12,2),
         f.e_pass::NUMERIC(12,2), f.e_comm::NUMERIC(12,2), f.e_sub::NUMERIC(12,2),
         f.cols::NUMERIC(12,2), f.pays::NUMERIC(12,2), (f.e_sub - f.cols + f.pays)::NUMERIC(12,2),
         f.ugroup, f.ufee,
         f.live_bets::NUMERIC(12,2), f.live_deleted::NUMERIC(12,2),
         f.l_pass::NUMERIC(12,2), f.l_comm::NUMERIC(12,2), f.l_sub::NUMERIC(12,2),
         (f.l_sub - f.cols + f.pays)::NUMERIC(12,2),
         f.lid IS NOT NULL AND (f.live_bets, f.live_deleted, f.ufee) IS DISTINCT FROM (f.e_bets, f.e_deleted, f.e_fee),
         f.lid, f.lcreated, f.lby, f.ltotal, f.lkept
  FROM fin f
  WHERE p_group_id IS NULL OR (
    CASE WHEN f.lid IS NULL THEN f.ugroup ELSE (
      SELECT l.polla_group_id FROM polla_edition_liquidations l WHERE l.polla_edition_liquidation_id = f.lid
    ) END
  ) = p_group_id
  ORDER BY 4 NULLS LAST, f.unumber;
END;
$$;

REVOKE ALL ON FUNCTION polla_edition_account_base(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_edition_account_base(UUID, UUID, UUID, UUID) TO service_role;

-- ROLLBACK:
-- Volver a crear `polla_edition_account_base` con su definición anterior
-- (sin la liquidación en el CTE `cashiers`):
-- 20261114141228_polla_edition_account_functions.sql.
