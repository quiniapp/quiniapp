-- Migration: Add network-aware current account functions
-- Allows CAPITALIST to view/calculate current accounts across all sub-organizations

-- Function to calculate current accounts for a network (organization + descendants)
CREATE OR REPLACE FUNCTION calculate_current_account_network(
  p_date_text TEXT,
  p_calculate_leave BOOLEAN DEFAULT FALSE,
  p_liquidated BOOLEAN DEFAULT FALSE,
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_ids UUID[];
  v_results JSONB[] := '{}';
  v_org_id UUID;
  v_org_results JSONB[];
BEGIN
  -- Get all organization IDs in the network (parent + all descendants)
  SELECT ARRAY_AGG(organization_id)
  INTO v_org_ids
  FROM get_organization_descendants(p_organization_id);

  -- Add the parent organization itself
  v_org_ids := v_org_ids || p_organization_id;

  -- Calculate current account for each organization
  FOREACH v_org_id IN ARRAY v_org_ids
  LOOP
    v_org_results := calculate_current_account(
      p_date_text,
      p_calculate_leave,
      p_liquidated,
      v_org_id
    );
    v_results := v_results || v_org_results;
  END LOOP;

  RETURN v_results;
END;
$$;

-- Function to get current accounts for a network with aggregated totals
CREATE OR REPLACE FUNCTION get_current_accounts_network_summary(
  p_organization_id UUID,
  p_date DATE DEFAULT NULL
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  total_pass NUMERIC,
  total_successes NUMERIC,
  total_claims NUMERIC,
  total_collections NUMERIC,
  total_paid NUMERIC,
  total_balance NUMERIC,
  total_leave NUMERIC,
  total_drag NUMERIC,
  cashier_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH org_tree AS (
    SELECT d.organization_id
    FROM get_organization_descendants(p_organization_id) d
    UNION
    SELECT p_organization_id
  ),
  latest_accounts AS (
    SELECT DISTINCT ON (ca.user_id)
      ca.*,
      o.name as org_name
    FROM current_accounts ca
    JOIN org_tree ot ON ca.organization_id = ot.organization_id
    JOIN organizations o ON o.organization_id = ca.organization_id
    WHERE (p_date IS NULL OR ca.date = p_date)
    ORDER BY ca.user_id, ca.date DESC
  )
  SELECT
    la.organization_id,
    la.org_name::TEXT as organization_name,
    COALESCE(SUM(la.pass), 0) as total_pass,
    COALESCE(SUM(la.successes), 0) as total_successes,
    COALESCE(SUM(la.claims), 0) as total_claims,
    COALESCE(SUM(la.collections), 0) as total_collections,
    COALESCE(SUM(la.paid), 0) as total_paid,
    COALESCE(SUM(la.total), 0) as total_balance,
    COALESCE(SUM(la.leave), 0) as total_leave,
    COALESCE(SUM(la.drag), 0) as total_drag,
    COUNT(*)::INTEGER as cashier_count
  FROM latest_accounts la
  GROUP BY la.organization_id, la.org_name
  ORDER BY la.org_name;
END;
$$;

COMMENT ON FUNCTION calculate_current_account_network IS 'Calculates current accounts for an organization and all its sub-organizations (network)';
COMMENT ON FUNCTION get_current_accounts_network_summary IS 'Returns aggregated current account summary per organization in the network';
