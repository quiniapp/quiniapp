-- ============================================================================
-- Migration: Fix ticket_full_json_plpgsql_archive to include bet_order
-- ============================================================================
-- Mirrors the fix applied to the regular RPC in 20260102194200.
-- The archive version was created without bet_order in the JSON output,
-- causing the repeat-ticket modal to key all bets as "undefined" and drop
-- all but the first bet for archived tickets.
-- Also aligns DISTINCT ON clause with the regular RPC.
-- ============================================================================

DROP FUNCTION IF EXISTS public.ticket_full_json_plpgsql_archive(UUID, UUID);

CREATE OR REPLACE FUNCTION public.ticket_full_json_plpgsql_archive(
  p_ticket_id UUID,
  p_organization_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH t AS (
    SELECT *
    FROM public.tickets_archive
    WHERE ticket_id = p_ticket_id
      AND organization_id = p_organization_id
  ),
  br AS (
    SELECT
      b.ticket_id,
      b.number,
      b.amount,
      b.place,
      b."with",
      b.position,
      b.bet_order,
      s.schedule_id,
      s."time" AS schedule_time,
      jsonb_build_object(
        'schedule_id', s.schedule_id,
        'name', s.name,
        'time', to_char(s."time", 'HH24:MI:SS')
      ) AS schedule_obj,
      l.lottery_id,
      l.created_at AS lottery_created_at,
      jsonb_build_object(
        'lottery_id', l.lottery_id,
        'name', l.name
      ) AS lottery_obj
    FROM public.bets_archive b
    JOIN public.schedules s ON s.schedule_id = b.schedule_id AND s.organization_id = p_organization_id
    JOIN public.lotteries l ON l.lottery_id = b.lottery_id AND l.organization_id = p_organization_id
    WHERE b.ticket_id = p_ticket_id
      AND b.organization_id = p_organization_id
  ),
  br_dedup AS (
    SELECT DISTINCT ON (
      ticket_id, bet_order, schedule_id, lottery_id
    )
      ticket_id, number, amount, place, "with", position,
      schedule_id, schedule_time, schedule_obj,
      lottery_id, lottery_created_at, lottery_obj,
      bet_order
    FROM br
    ORDER BY
      ticket_id, bet_order, schedule_id, lottery_id,
      lottery_created_at DESC
  ),
  bet_sched AS (
    SELECT
      bet_order,
      number, amount, place, "with", position,
      schedule_id, schedule_obj, schedule_time,
      jsonb_agg(lottery_obj ORDER BY lottery_created_at DESC) AS lotteries
    FROM br_dedup
    GROUP BY bet_order, number, amount, place, "with", position, schedule_id, schedule_obj, schedule_time
  ),
  bets_grouped AS (
    SELECT
      bet_order,
      number, amount, place, "with", position,
      jsonb_agg(
        jsonb_build_object(
          'schedule', schedule_obj,
          'lotteries', lotteries
        )
        ORDER BY schedule_time ASC
      ) AS scheduleLottery
    FROM bet_sched
    GROUP BY bet_order, number, amount, place, "with", position
  ),
  bets_json AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'bet_order', bet_order,
        'number', number,
        'amount', amount,
        'place', place,
        'with', "with",
        'position', position,
        'scheduleLottery', scheduleLottery
      )
      ORDER BY bet_order ASC
    ) AS bets
    FROM bets_grouped
  )
  SELECT
    jsonb_build_object(
      'ticket_id', t.ticket_id,
      'user_id', t.user_id,
      'user_name', t.user_name,
      'ticket_number', t.ticket_number,
      'date', t.date,
      'paid', t.paid,
      'winner', t.winner,
      'total', t.total,
      'total_prize', t.total_prize,
      'created_at', t.created_at,
      'deleted_at', t.deleted_at,
      'deleted_by', t.deleted_by,
      'hits', t.hits,
      'bets', coalesce(bj.bets, '[]'::jsonb)
    )
  INTO v_result
  FROM t
  CROSS JOIN bets_json bj;

  RETURN v_result;
END;
$$;
