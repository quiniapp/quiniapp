-- Refactor archive to process one day at a time for timeout resilience.
-- Each RPC call is scoped to a single date, so no single call can exceed
-- the statement timeout regardless of total data volume.
-- Replaces archive_old_bets, archive_old_tickets, archive_old_data.

DROP FUNCTION IF EXISTS archive_old_bets(INTEGER);
DROP FUNCTION IF EXISTS archive_old_tickets(INTEGER);
DROP FUNCTION IF EXISTS archive_old_data(INTEGER);

-- Keep tickets_archive in sync with tickets (client_request_id was added in 20260414090510)
ALTER TABLE tickets_archive ADD COLUMN IF NOT EXISTS client_request_id UUID NULL;

-- Returns all distinct dates that have bets or tickets older than the cutoff,
-- sorted oldest first so the TypeScript loop archives in chronological order.
CREATE OR REPLACE FUNCTION get_dates_to_archive(p_cutoff_date DATE)
RETURNS DATE[]
LANGUAGE sql
STABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT date
    FROM (
      SELECT date FROM bets    WHERE date < p_cutoff_date
      UNION
      SELECT date FROM tickets WHERE date < p_cutoff_date
    ) combined
    ORDER BY date ASC
  );
$$;

-- Archives all bets and tickets for a single date in one transaction.
-- Bets are moved first because they hold the FK reference to tickets.
-- Processes in batches of 5000 to stay well within per-statement timeouts
-- (a single day has orders of magnitude fewer rows than the full table).
CREATE OR REPLACE FUNCTION archive_data_by_date(p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_bets_archived     INTEGER := 0;
  v_tickets_archived  INTEGER := 0;
  v_batch_size        INTEGER := 5000;
  v_batch_count       INTEGER;
BEGIN
  -- 1. Archive bets (must come before tickets due to FK bets.ticket_id → tickets.ticket_id)
  --
  -- INSERT target lists columns in the same order as the `bets` table, with
  -- archived_at appended at the end. This lets the SELECT side stay as
  -- `b.*, NOW()` — when a new column is added to bets/bets_archive, only the
  -- target list below needs updating (not the SELECT).
  --
  -- Current bets column order (prod):
  --   bet_id, bet_type, ticket_id, user_id, number, amount, place, "with",
  --   position, date, winner, paid, lottery_id, schedule_id, created_at,
  --   edited_at, deleted_at, prize, ticket_number, cashier_name, hits,
  --   bet_order, organization_id
  LOOP
    WITH to_archive AS (
      SELECT bet_id FROM bets WHERE date = p_date LIMIT v_batch_size
    ),
    inserted AS (
      INSERT INTO bets_archive (
        bet_id, bet_type, ticket_id, user_id, number, amount, place, "with",
        position, date, winner, paid, lottery_id, schedule_id, created_at,
        edited_at, deleted_at, prize, ticket_number, cashier_name, hits,
        bet_order, organization_id,
        archived_at
      )
      SELECT b.*, NOW()
      FROM bets b
      WHERE b.bet_id IN (SELECT bet_id FROM to_archive)
      ON CONFLICT (bet_id) DO NOTHING
    )
    DELETE FROM bets WHERE bet_id IN (SELECT bet_id FROM to_archive);

    GET DIAGNOSTICS v_batch_count = ROW_COUNT;
    v_bets_archived := v_bets_archived + v_batch_count;
    EXIT WHEN v_batch_count = 0;
  END LOOP;

  -- 2. Archive tickets (bets referencing them are already gone)
  --
  -- Same pattern: target lists tickets columns in tickets order, archived_at last.
  --
  -- Current tickets column order (prod + dev):
  --   ticket_id, user_id, user_name, ticket_number, date, paid, winner, total,
  --   created_at, deleted_at, deleted_by, total_prize, hits, organization_id,
  --   client_request_id
  LOOP
    WITH to_archive AS (
      SELECT ticket_id FROM tickets WHERE date = p_date LIMIT v_batch_size
    ),
    inserted AS (
      INSERT INTO tickets_archive (
        ticket_id, user_id, user_name, ticket_number, date, paid, winner, total,
        created_at, deleted_at, deleted_by, total_prize, hits, organization_id,
        client_request_id,
        archived_at
      )
      SELECT t.*, NOW()
      FROM tickets t
      WHERE t.ticket_id IN (SELECT ticket_id FROM to_archive)
      ON CONFLICT (ticket_id) DO NOTHING
    )
    DELETE FROM tickets WHERE ticket_id IN (SELECT ticket_id FROM to_archive);

    GET DIAGNOSTICS v_batch_count = ROW_COUNT;
    v_tickets_archived := v_tickets_archived + v_batch_count;
    EXIT WHEN v_batch_count = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'success',           true,
    'date',              p_date,
    'bets_archived',     v_bets_archived,
    'tickets_archived',  v_tickets_archived
  );
END;
$$;
