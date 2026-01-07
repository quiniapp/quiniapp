-- Migration: Add recursive functions for organization hierarchy
-- These functions enable querying the organization tree structure

-- Function to get all descendant organizations (children, grandchildren, etc.)
CREATE OR REPLACE FUNCTION get_organization_descendants(p_org_id UUID)
RETURNS TABLE(organization_id UUID, depth INTEGER)
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE org_tree AS (
    -- Base case: the organization itself
    SELECT o.organization_id, 0 as depth
    FROM organizations o
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL

    UNION ALL

    -- Recursive case: all children
    SELECT o.organization_id, ot.depth + 1
    FROM organizations o
    INNER JOIN org_tree ot ON o.parent_organization_id = ot.organization_id
    WHERE o.deleted_at IS NULL
  )
  SELECT * FROM org_tree;
$$;

-- Function to get the root organization of any organization
CREATE OR REPLACE FUNCTION get_root_organization(p_org_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE org_path AS (
    -- Base case: start from the given organization
    SELECT o.organization_id, o.parent_organization_id
    FROM organizations o
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL

    UNION ALL

    -- Recursive case: go up to parent
    SELECT o.organization_id, o.parent_organization_id
    FROM organizations o
    INNER JOIN org_path op ON o.organization_id = op.parent_organization_id
    WHERE o.deleted_at IS NULL
  )
  SELECT organization_id
  FROM org_path
  WHERE parent_organization_id IS NULL
  LIMIT 1;
$$;

-- Function to get the depth of an organization in the tree
CREATE OR REPLACE FUNCTION get_organization_depth(p_org_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
  WITH RECURSIVE org_path AS (
    SELECT o.organization_id, o.parent_organization_id, 0 as depth
    FROM organizations o
    WHERE o.organization_id = p_org_id
      AND o.deleted_at IS NULL

    UNION ALL

    SELECT o.organization_id, o.parent_organization_id, op.depth + 1
    FROM organizations o
    INNER JOIN org_path op ON o.organization_id = op.parent_organization_id
    WHERE o.deleted_at IS NULL
  )
  SELECT MAX(depth) FROM org_path;
$$;

-- Function to check if an organization is a descendant of another
CREATE OR REPLACE FUNCTION is_organization_descendant(p_child_org_id UUID, p_parent_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM get_organization_descendants(p_parent_org_id) d
    WHERE d.organization_id = p_child_org_id
  );
$$;

-- Add comments for documentation
COMMENT ON FUNCTION get_organization_descendants(UUID) IS 'Returns all descendant organizations (including the org itself) with their depth level';
COMMENT ON FUNCTION get_root_organization(UUID) IS 'Returns the root organization (with parent_organization_id = NULL) for any organization';
COMMENT ON FUNCTION get_organization_depth(UUID) IS 'Returns how many levels deep an organization is (0 = root)';
COMMENT ON FUNCTION is_organization_descendant(UUID, UUID) IS 'Checks if first org is a descendant of second org';
