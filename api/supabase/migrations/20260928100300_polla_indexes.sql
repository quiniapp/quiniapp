-- Índices del esquema Polla. Misma disciplina que el resto del repo: parciales
-- sobre `deleted_at IS NULL`, compuestos con igualdad primero y el sort al
-- final, nada redundante, ANALYZE al cierre.
--
-- Toda consulta de jugadas arranca por edición y la edición pertenece a una
-- sola organización, así que polla_edition_id es el prefijo natural: no hace
-- falta repetir polla_organization_id en esos índices.

-- ---- polla_bets -------------------------------------------------------------

-- Feed principal (keyset pagination).
CREATE INDEX idx_polla_bets_feed
  ON polla_bets (polla_edition_id, created_at DESC, polla_bet_id DESC)
  WHERE deleted_at IS NULL;

-- Ranking de aciertos / tablero de la edición.
CREATE INDEX idx_polla_bets_edition_hits
  ON polla_bets (polla_edition_id, hits DESC)
  WHERE deleted_at IS NULL;

-- Filtros del feed.
CREATE INDEX idx_polla_bets_edition_cashier
  ON polla_bets (polla_edition_id, cashier_polla_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_bets_edition_user
  ON polla_bets (polla_edition_id, polla_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_bets_edition_group
  ON polla_bets (polla_edition_id, polla_group_id)
  WHERE deleted_at IS NULL;

-- Procesamiento diario de aciertos: solo las jugadas pendientes.
CREATE INDEX idx_polla_bets_edition_pending
  ON polla_bets (polla_edition_id)
  WHERE winner = FALSE AND deleted_at IS NULL;

-- Liquidación: pases del día y premios del día, por pasador.
CREATE INDEX idx_polla_bets_cashier_load_date
  ON polla_bets (cashier_polla_user_id, load_date)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_bets_cashier_hit_date
  ON polla_bets (cashier_polla_user_id, hit_date)
  WHERE winner = TRUE AND deleted_at IS NULL;

-- ---- ediciones, resultados, créditos, cuenta corriente, usuarios ------------

CREATE INDEX idx_polla_editions_org_start
  ON polla_editions (polla_organization_id, start_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_editions_org_status
  ON polla_editions (polla_organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_results_org_date
  ON polla_results (polla_organization_id, date, polla_schedule_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_credit_movements_user
  ON polla_credit_movements (polla_user_id, created_at DESC);

CREATE INDEX idx_polla_credit_movements_cashier
  ON polla_credit_movements (cashier_polla_user_id, created_at DESC);

CREATE INDEX idx_polla_current_accounts_org_user_date
  ON polla_current_accounts (polla_organization_id, polla_user_id, date DESC);

CREATE INDEX idx_polla_current_accounts_date_org
  ON polla_current_accounts (date, polla_organization_id);

CREATE INDEX idx_polla_users_org_type
  ON polla_users (polla_organization_id, user_type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_users_group
  ON polla_users (polla_group_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_users_parent
  ON polla_users (parent_polla_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_polla_sessions_user_active
  ON polla_sessions (polla_user_id, is_active);

CREATE INDEX idx_polla_sessions_expires
  ON polla_sessions (expires_at)
  WHERE is_active;

-- Stats del planner al día sin esperar al autovacuum.
ANALYZE polla_bets;
ANALYZE polla_editions;
ANALYZE polla_results;
ANALYZE polla_users;
ANALYZE polla_credit_movements;
ANALYZE polla_current_accounts;
