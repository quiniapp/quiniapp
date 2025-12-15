-- Migrate existing data to a default organization
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create default organization for existing data
  INSERT INTO organizations (name)
  VALUES ('Leo Chimento')
  RETURNING organization_id INTO v_org_id;

  -- Update all tables with the default organization
  UPDATE users SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE lotteries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE schedules SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE schedule_lotteries SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE results SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE tickets SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE bets SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE current_accounts SET organization_id = v_org_id WHERE organization_id IS NULL;
  UPDATE ticket_prizes_by_turn SET organization_id = v_org_id WHERE organization_id IS NULL;

  RAISE NOTICE 'Migrated all existing data to organization: %', v_org_id;
END $$;
