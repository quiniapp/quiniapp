-- ============================================================================
-- Migration: Add p_min_amount parameter to get_grouped_bets_for_parse RPCs
-- ============================================================================
-- When p_min_amount > 0, only return grouped bets whose total amount
-- is greater than or equal to p_min_amount.
-- Default is 0 to preserve existing behaviour (return all).
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_grouped_bets_for_parse(DATE, UUID, UUID, UUID, BOOLEAN, UUID, UUID[]);
DROP FUNCTION IF EXISTS public.get_grouped_bets_for_parse_archive(DATE, UUID, UUID, UUID, BOOLEAN, UUID, UUID[]);

-- ============================================================================
-- 1. get_grouped_bets_for_parse
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_grouped_bets_for_parse(
  p_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL,
  p_lottery_id UUID DEFAULT NULL,
  p_winners_only BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT 0
)
RETURNS TABLE (
  bet_id UUID,
  bet_type bet_type_enum,
  ticket_id UUID,
  user_id UUID,
  number TEXT,
  amount NUMERIC,
  place place_type_enum,
  "with" TEXT,
  "position" place_type_enum,
  date DATE,
  winner BOOLEAN,
  paid BOOLEAN,
  lottery_id UUID,
  schedule_id UUID,
  created_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  prize NUMERIC,
  ticket_number TEXT,
  cashier_name TEXT,
  hits INTEGER,
  lotteries JSONB,
  schedules JSONB
)
LANGUAGE sql
AS $$
  SELECT
    NULL::uuid AS bet_id,
    b.bet_type AS bet_type,
    NULL::uuid AS ticket_id,
    NULL::uuid AS user_id,
    b.number AS number,
    SUM(b.amount)::NUMERIC AS amount,
    b.place AS place,
    CASE WHEN b.bet_type = 'REDOUBLE' THEN b."with" ELSE NULL END AS "with",
    CASE WHEN b.bet_type = 'REDOUBLE' THEN b.position ELSE NULL END AS "position",
    b.date AS date,
    false AS winner,
    false AS paid,
    b.lottery_id AS lottery_id,
    b.schedule_id AS schedule_id,
    NULL::timestamptz AS created_at,
    NULL::timestamptz AS edited_at,
    NULL::timestamptz AS deleted_at,
    SUM(COALESCE(b.prize,0))::NUMERIC AS prize,
    ''::TEXT AS ticket_number,
    ''::TEXT AS cashier_name,
    SUM(COALESCE(b.hits,0))::INT AS hits,
    (SELECT to_jsonb(l2) FROM public.lotteries l2 WHERE l2.lottery_id = b.lottery_id AND (p_organization_id IS NULL OR l2.organization_id = p_organization_id)) AS lotteries,
    (SELECT to_jsonb(s2) FROM public.schedules s2 WHERE s2.schedule_id = b.schedule_id AND (p_organization_id IS NULL OR s2.organization_id = p_organization_id)) AS schedules
  FROM public.bets b
  WHERE b.date = p_date
    AND (p_schedule_id IS NULL OR b.schedule_id = p_schedule_id)
    AND (p_cashier_id IS NULL OR b.user_id = p_cashier_id)
    AND (p_lottery_id IS NULL OR b.lottery_id = p_lottery_id)
    AND (NOT p_winners_only OR b.winner IS TRUE)
    AND b.deleted_at IS NULL
    AND (
      p_user_ids IS NOT NULL AND b.user_id = ANY(p_user_ids)
      OR
      p_user_ids IS NULL AND (p_organization_id IS NULL OR b.organization_id = p_organization_id)
    )
  GROUP BY
    b.number, b.lottery_id, b.schedule_id, b.date, b.bet_type, b.place,
    CASE WHEN b.bet_type='REDOUBLE' THEN b."with" ELSE NULL END,
    CASE WHEN b.bet_type='REDOUBLE' THEN b.position ELSE NULL END
  HAVING SUM(b.amount) >= p_min_amount
  ORDER BY SUM(b.amount) DESC, b.number;
$$;

-- ============================================================================
-- 2. get_grouped_bets_for_parse_archive
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_grouped_bets_for_parse_archive(
  p_date DATE,
  p_schedule_id UUID DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL,
  p_lottery_id UUID DEFAULT NULL,
  p_winners_only BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL,
  p_user_ids UUID[] DEFAULT NULL,
  p_min_amount NUMERIC DEFAULT 0
)
RETURNS TABLE (
  bet_id UUID,
  bet_type bet_type_enum,
  ticket_id UUID,
  user_id UUID,
  number TEXT,
  amount NUMERIC,
  place place_type_enum,
  "with" TEXT,
  "position" place_type_enum,
  date DATE,
  winner BOOLEAN,
  paid BOOLEAN,
  lottery_id UUID,
  schedule_id UUID,
  created_at TIMESTAMPTZ,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  prize NUMERIC,
  ticket_number TEXT,
  cashier_name TEXT,
  hits INTEGER,
  lotteries JSONB,
  schedules JSONB
)
LANGUAGE sql
AS $$
  SELECT
    NULL::uuid AS bet_id,
    b.bet_type AS bet_type,
    NULL::uuid AS ticket_id,
    NULL::uuid AS user_id,
    b.number AS number,
    SUM(b.amount)::NUMERIC AS amount,
    b.place AS place,
    CASE WHEN b.bet_type = 'REDOUBLE' THEN b."with" ELSE NULL END AS "with",
    CASE WHEN b.bet_type = 'REDOUBLE' THEN b.position ELSE NULL END AS "position",
    b.date AS date,
    false AS winner,
    false AS paid,
    b.lottery_id AS lottery_id,
    b.schedule_id AS schedule_id,
    NULL::timestamptz AS created_at,
    NULL::timestamptz AS edited_at,
    NULL::timestamptz AS deleted_at,
    SUM(COALESCE(b.prize,0))::NUMERIC AS prize,
    ''::TEXT AS ticket_number,
    ''::TEXT AS cashier_name,
    SUM(COALESCE(b.hits,0))::INT AS hits,
    (SELECT to_jsonb(l2) FROM public.lotteries l2 WHERE l2.lottery_id = b.lottery_id AND (p_organization_id IS NULL OR l2.organization_id = p_organization_id)) AS lotteries,
    (SELECT to_jsonb(s2) FROM public.schedules s2 WHERE s2.schedule_id = b.schedule_id AND (p_organization_id IS NULL OR s2.organization_id = p_organization_id)) AS schedules
  FROM public.bets_archive b
  WHERE b.date = p_date
    AND (p_schedule_id IS NULL OR b.schedule_id = p_schedule_id)
    AND (p_cashier_id IS NULL OR b.user_id = p_cashier_id)
    AND (p_lottery_id IS NULL OR b.lottery_id = p_lottery_id)
    AND (NOT p_winners_only OR b.winner IS TRUE)
    AND b.deleted_at IS NULL
    AND (
      p_user_ids IS NOT NULL AND b.user_id = ANY(p_user_ids)
      OR
      p_user_ids IS NULL AND (p_organization_id IS NULL OR b.organization_id = p_organization_id)
    )
  GROUP BY
    b.number, b.lottery_id, b.schedule_id, b.date, b.bet_type, b.place,
    CASE WHEN b.bet_type='REDOUBLE' THEN b."with" ELSE NULL END,
    CASE WHEN b.bet_type='REDOUBLE' THEN b.position ELSE NULL END
  HAVING SUM(b.amount) >= p_min_amount
  ORDER BY SUM(b.amount) DESC, b.number;
$$;
