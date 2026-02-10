-- ============================================================================
-- Migration: Fix get_ticket_sums to return all required fields
-- ============================================================================
-- Updates get_ticket_sums to match TicketSums type definition which expects:
-- - total_amount, total_prize, total_count, total_winners_count
-- ============================================================================

-- Fix main table RPC
DROP FUNCTION IF EXISTS get_ticket_sums(TEXT, UUID);

CREATE OR REPLACE FUNCTION get_ticket_sums(
  p_ticket TEXT,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE(total_amount NUMERIC, total_prize NUMERIC, total_count INTEGER, total_winners_count INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(amount), 0) AS total_amount,
    COALESCE(SUM(prize), 0) AS total_prize,
    COALESCE(COUNT(*), 0)::INTEGER AS total_count,
    COALESCE(COUNT(*) FILTER (WHERE winner = true), 0)::INTEGER AS total_winners_count
  FROM bets
  WHERE ticket_number = p_ticket
    AND deleted_at IS NULL
    AND (p_organization_id IS NULL OR organization_id = p_organization_id);
$$;
