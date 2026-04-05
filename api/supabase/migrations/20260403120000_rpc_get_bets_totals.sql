-- RPCs to get total amount and prize for bets, supporting multi-org and group_user_ids filters.
-- These replace the PostgREST aggregate select (.select('amount.sum()')) which is blocked by PGRST123
-- when db-aggregates-enabled is false.

-- ====== bets (main table) ======

CREATE OR REPLACE FUNCTION get_bets_total_amount(
  p_organization_ids uuid[],
  p_date            date,
  p_schedule_id     uuid    DEFAULT NULL,
  p_cashier_id      uuid    DEFAULT NULL,
  p_lottery_id      uuid    DEFAULT NULL,
  p_user_ids        uuid[]  DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM bets
  WHERE organization_id = ANY(p_organization_ids)
    AND date            = p_date
    AND deleted_at      IS NULL
    AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
    AND (p_cashier_id  IS NULL OR user_id     = p_cashier_id)
    AND (p_lottery_id  IS NULL OR lottery_id  = p_lottery_id)
    AND (p_user_ids    IS NULL OR user_id     = ANY(p_user_ids));
$$;

CREATE OR REPLACE FUNCTION get_bets_total_prize(
  p_organization_ids uuid[],
  p_date            date,
  p_schedule_id     uuid    DEFAULT NULL,
  p_cashier_id      uuid    DEFAULT NULL,
  p_lottery_id      uuid    DEFAULT NULL,
  p_user_ids        uuid[]  DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(prize), 0)
  FROM bets
  WHERE organization_id = ANY(p_organization_ids)
    AND date            = p_date
    AND winner          = true
    AND deleted_at      IS NULL
    AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
    AND (p_cashier_id  IS NULL OR user_id     = p_cashier_id)
    AND (p_lottery_id  IS NULL OR lottery_id  = p_lottery_id)
    AND (p_user_ids    IS NULL OR user_id     = ANY(p_user_ids));
$$;

-- ====== bets_archive ======

CREATE OR REPLACE FUNCTION get_bets_total_amount_archive(
  p_organization_ids uuid[],
  p_date            date,
  p_schedule_id     uuid    DEFAULT NULL,
  p_cashier_id      uuid    DEFAULT NULL,
  p_lottery_id      uuid    DEFAULT NULL,
  p_user_ids        uuid[]  DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM bets_archive
  WHERE organization_id = ANY(p_organization_ids)
    AND date            = p_date
    AND deleted_at      IS NULL
    AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
    AND (p_cashier_id  IS NULL OR user_id     = p_cashier_id)
    AND (p_lottery_id  IS NULL OR lottery_id  = p_lottery_id)
    AND (p_user_ids    IS NULL OR user_id     = ANY(p_user_ids));
$$;

CREATE OR REPLACE FUNCTION get_bets_total_prize_archive(
  p_organization_ids uuid[],
  p_date            date,
  p_schedule_id     uuid    DEFAULT NULL,
  p_cashier_id      uuid    DEFAULT NULL,
  p_lottery_id      uuid    DEFAULT NULL,
  p_user_ids        uuid[]  DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(prize), 0)
  FROM bets_archive
  WHERE organization_id = ANY(p_organization_ids)
    AND date            = p_date
    AND winner          = true
    AND deleted_at      IS NULL
    AND (p_schedule_id IS NULL OR schedule_id = p_schedule_id)
    AND (p_cashier_id  IS NULL OR user_id     = p_cashier_id)
    AND (p_lottery_id  IS NULL OR lottery_id  = p_lottery_id)
    AND (p_user_ids    IS NULL OR user_id     = ANY(p_user_ids));
$$;
