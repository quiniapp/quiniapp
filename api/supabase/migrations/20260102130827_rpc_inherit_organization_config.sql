-- Migration: Add function to inherit organization configuration when creating sub-organizations
-- When a CAPITALIST creates a group (sub-organization), it inherits lotteries, schedules, and schedule_lotteries

CREATE OR REPLACE FUNCTION inherit_organization_config(
  p_parent_org_id UUID,
  p_new_org_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lottery RECORD;
  v_new_lottery_id UUID;
  v_schedule RECORD;
  v_new_schedule_id UUID;
  v_schedule_lottery RECORD;
  v_lottery_mapping JSONB := '{}';
  v_schedule_mapping JSONB := '{}';
BEGIN
  -- Step 1: Copy lotteries from parent to new organization
  FOR v_lottery IN
    SELECT * FROM lotteries
    WHERE organization_id = p_parent_org_id
      AND deleted_at IS NULL
  LOOP
    INSERT INTO lotteries (
      name,
      code,
      position,
      disabled,
      organization_id,
      created_at,
      edited_at
    )
    VALUES (
      v_lottery.name,
      v_lottery.code,
      v_lottery.position,
      v_lottery.disabled,
      p_new_org_id,
      NOW(),
      NOW()
    )
    RETURNING lottery_id INTO v_new_lottery_id;

    -- Store mapping of old -> new lottery_id
    v_lottery_mapping := v_lottery_mapping || jsonb_build_object(
      v_lottery.lottery_id::text,
      v_new_lottery_id::text
    );
  END LOOP;

  -- Step 2: Copy schedules from parent to new organization
  FOR v_schedule IN
    SELECT * FROM schedules
    WHERE organization_id = p_parent_org_id
      AND deleted_at IS NULL
  LOOP
    INSERT INTO schedules (
      name,
      start_time,
      end_time,
      is_active,
      organization_id,
      created_at,
      edited_at
    )
    VALUES (
      v_schedule.name,
      v_schedule.start_time,
      v_schedule.end_time,
      v_schedule.is_active,
      p_new_org_id,
      NOW(),
      NOW()
    )
    RETURNING schedule_id INTO v_new_schedule_id;

    -- Store mapping of old -> new schedule_id
    v_schedule_mapping := v_schedule_mapping || jsonb_build_object(
      v_schedule.schedule_id::text,
      v_new_schedule_id::text
    );
  END LOOP;

  -- Step 3: Copy schedule_lotteries with updated references
  FOR v_schedule_lottery IN
    SELECT * FROM schedule_lotteries
    WHERE organization_id = p_parent_org_id
      AND deleted_at IS NULL
  LOOP
    -- Only copy if both lottery and schedule exist in mappings
    IF v_lottery_mapping ? v_schedule_lottery.lottery_id::text
       AND v_schedule_mapping ? v_schedule_lottery.schedule_id::text
    THEN
      INSERT INTO schedule_lotteries (
        schedule_id,
        lottery_id,
        organization_id,
        created_at,
        edited_at
      )
      VALUES (
        (v_schedule_mapping ->> v_schedule_lottery.schedule_id::text)::UUID,
        (v_lottery_mapping ->> v_schedule_lottery.lottery_id::text)::UUID,
        p_new_org_id,
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;

END;
$$;

COMMENT ON FUNCTION inherit_organization_config(UUID, UUID) IS 'Copies lotteries, schedules, and schedule_lotteries from parent organization to new sub-organization';
