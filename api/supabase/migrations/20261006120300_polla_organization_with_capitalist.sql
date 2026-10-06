-- Polla: alta de una organización junto con su capitalista, como en QuiniApp.
--
-- Una organización sin capitalista no la puede operar nadie más que el OWNER,
-- así que se crean juntos y en una sola transacción: si el usuario no se puede
-- crear (por ejemplo, el nombre de usuario ya existe), tampoco queda la
-- organización. La contraseña llega hasheada desde la API.

DROP FUNCTION IF EXISTS polla_create_organization_with_capitalist(TEXT, JSONB);

CREATE FUNCTION polla_create_organization_with_capitalist(
  p_name TEXT,
  p_capitalist JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_organization polla_organizations;
  v_user_id UUID;
BEGIN
  INSERT INTO polla_organizations (name)
  VALUES (p_name)
  RETURNING * INTO v_organization;

  INSERT INTO polla_users (
    user_type,
    name,
    last_name,
    username,
    email,
    phone,
    password_hash,
    password_changed_at,
    polla_organization_id
  ) VALUES (
    'CAPITALIST',
    p_capitalist->>'name',
    NULLIF(p_capitalist->>'last_name', ''),
    p_capitalist->>'username',
    NULLIF(p_capitalist->>'email', ''),
    (p_capitalist->>'phone')::BIGINT,
    p_capitalist->>'password_hash',
    NOW(),
    v_organization.polla_organization_id
  )
  RETURNING polla_user_id INTO v_user_id;

  RETURN jsonb_build_object(
    'organization', to_jsonb(v_organization),
    'capitalist_polla_user_id', v_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION polla_create_organization_with_capitalist(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION polla_create_organization_with_capitalist(TEXT, JSONB) TO service_role;
