-- Vista previa del corte de la liquidación por edición (Polla). SOLO LECTURA.
--
-- Para qué
--   La migración 20261114140711_polla_edition_accounts.sql deja por días (solo
--   consulta) las ediciones que terminaron (`end_date` anterior a hoy) y no
--   tienen días sin liquidar; todas las demás, incluidas las que están en carga
--   o en sorteo, pasan a liquidarse por edición. Este script muestra, antes de
--   aplicarla en develop y en prod:
--   * Parte 1: las ediciones que pasarían a liquidarse POR EDICIÓN y por qué.
--     Las que no salen acá quedan por días. Es la misma regla que
--     `polla_edition_account_cutover`, escrita acá para no depender de la
--     migración.
--   * Parte 2: para esas ediciones, un renglón por edición y pasador cuando el
--     pasador ya tiene tickets de la edición cubiertos por su última
--     liquidación por días. La cuenta por edición vuelve a contar esos tickets
--     (toma todos los de la edición, sin importar el día), así que hay que
--     descontarlos a mano con un reclamo negativo.
--
-- Cómo correrlo
--   Son solo SELECT: no escribe nada. Corre igual con o sin la migración
--   aplicada (no usa nada que ella cree; después de aplicarla, la regla se
--   evalúa con la fecha de hoy y no con la del día del corte).
--   * psql, con la sesión en solo lectura:
--       PGOPTIONS='-c default_transaction_read_only=on' psql "<url de la base>" \
--         -f api/supabase/scripts/polla_edition_account_cutover_preview.sql
--   * Editor SQL de Supabase: pegarlo y correr cada parte por separado
--     (seleccionar el texto de la parte y "Run"): el editor muestra solo el
--     resultado de la última sentencia.
--   Las ediciones borradas (`polla_editions.deleted_at`) no se listan: no
--   aparecen en ninguna lista de la cuenta corriente.
--
-- Ajuste a mano (decisión del usuario del 14/11)
--   Por cada renglón de la parte 2, después de aplicar la migración y ANTES de
--   liquidar esa edición:
--   1. Cuenta corriente > Pasadores > la edición > el pasador > Movimientos.
--   2. Cargar un "Reclamo" por `reclamo_sugerido` (un monto negativo), con una
--      nota del estilo "Ya liquidado por días hasta DD/MM/AAAA".
--   3. Liquidar la edición como siempre.
--   Por qué el reclamo es neto de la comisión: la cuenta por edición calcula
--   la comisión sobre el pase, y un reclamo negativo no baja el pase (resta del
--   subtotal, sin comisión). Ese pase ya le pagó comisión al pasador en la
--   liquidación por días; si el reclamo fuera por el pase completo, la
--   comisión de esos tickets se le pagaría dos veces. Con
--   reclamo = -(pase_ya_liquidado - comision_ya_liquidada) el subtotal de la
--   edición queda igual a lo que todavía no se liquidó por días.
--   La comisión se calcula con el `fee` de hoy del pasador; si cambió desde
--   esa liquidación, revisar el monto contra el Historial por fechas.
--
-- Los cobros, pagos y reclamos ya cargados en días sin liquidar NO se migran:
-- hay que volver a cargarlos a mano en cada edición.

-- ============================================================
-- Parte 1: ediciones que pasan a liquidarse por edición
-- ============================================================

WITH last_liq AS (
  SELECT polla_user_id, MAX(date) AS last_date
  FROM polla_current_accounts
  WHERE is_liquidated
  GROUP BY polla_user_id
),
pending AS (
  SELECT
    b.polla_edition_id,
    BOOL_OR(ll.last_date IS NULL) AS never_liquidated
  FROM polla_bets b
  LEFT JOIN last_liq ll ON ll.polla_user_id = b.cashier_polla_user_id
  WHERE b.load_date > COALESCE(ll.last_date, '-infinity'::DATE)
     OR b.deducted_on > COALESCE(ll.last_date, '-infinity'::DATE)
  GROUP BY b.polla_edition_id
)
SELECT
  o.name AS organization,
  e.polla_edition_id AS edition_id,
  e.name AS edition,
  e.start_date,
  e.end_date,
  CASE
    WHEN e.end_date >= polla_today() THEN 'en carga o sorteo'
    WHEN p.never_liquidated THEN 'pasador nunca liquidado'
    ELSE 'tickets sin liquidar'
  END AS motivo
FROM polla_editions e
JOIN polla_organizations o ON o.polla_organization_id = e.polla_organization_id
LEFT JOIN pending p ON p.polla_edition_id = e.polla_edition_id
WHERE e.deleted_at IS NULL
  AND (e.end_date >= polla_today() OR p.polla_edition_id IS NOT NULL)
ORDER BY o.name, e.start_date, e.name;

-- ============================================================
-- Parte 2: pase ya liquidado por días y reclamo sugerido
-- ============================================================

-- Tickets que cuentan: los mismos que la cuenta por edición
-- (`deleted_at IS NULL OR deducted_on IS NOT NULL`). Ya liquidado por días:
-- los cargados hasta la última liquidación del pasador, menos los que se
-- descontaron (borrados) hasta esa fecha.
WITH last_liq AS (
  SELECT polla_user_id, MAX(date) AS last_date
  FROM polla_current_accounts
  WHERE is_liquidated
  GROUP BY polla_user_id
),
pending AS (
  SELECT DISTINCT b.polla_edition_id
  FROM polla_bets b
  LEFT JOIN last_liq ll ON ll.polla_user_id = b.cashier_polla_user_id
  WHERE b.load_date > COALESCE(ll.last_date, '-infinity'::DATE)
     OR b.deducted_on > COALESCE(ll.last_date, '-infinity'::DATE)
),
by_edition AS (
  SELECT e.*
  FROM polla_editions e
  WHERE e.deleted_at IS NULL
    AND (e.end_date >= polla_today()
         OR e.polla_edition_id IN (SELECT polla_edition_id FROM pending))
),
already AS (
  SELECT
    b.polla_edition_id,
    b.cashier_polla_user_id,
    ll.last_date,
    COALESCE(SUM(b.amount) FILTER (WHERE b.load_date <= ll.last_date), 0)
      - COALESCE(SUM(b.amount) FILTER (WHERE b.deducted_on <= ll.last_date), 0) AS pase
  FROM polla_bets b
  JOIN by_edition e ON e.polla_edition_id = b.polla_edition_id
  JOIN last_liq ll ON ll.polla_user_id = b.cashier_polla_user_id
  WHERE b.deleted_at IS NULL OR b.deducted_on IS NOT NULL
  GROUP BY b.polla_edition_id, b.cashier_polla_user_id, ll.last_date
)
SELECT
  o.name AS organization,
  e.polla_edition_id AS edition_id,
  e.name AS edition,
  e.start_date,
  e.end_date,
  u.number AS cashier_number,
  u.name AS cashier,
  u.fee,
  a.last_date AS ultima_liquidacion_por_dias,
  a.pase AS pase_ya_liquidado,
  ROUND(a.pase * COALESCE(u.fee, 0) / 100, 2) AS comision_ya_liquidada,
  -(a.pase - ROUND(a.pase * COALESCE(u.fee, 0) / 100, 2)) AS reclamo_sugerido
FROM already a
JOIN by_edition e ON e.polla_edition_id = a.polla_edition_id
JOIN polla_organizations o ON o.polla_organization_id = e.polla_organization_id
JOIN polla_users u ON u.polla_user_id = a.cashier_polla_user_id
WHERE a.pase <> 0
ORDER BY o.name, e.start_date, e.name, u.number, u.name;
