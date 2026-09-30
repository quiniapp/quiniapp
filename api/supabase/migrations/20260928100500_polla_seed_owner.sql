-- Bootstrap del sistema Polla: organización de sistema + usuario OWNER.
--
-- El OWNER necesita una polla_organization_id (igual que en QuiniApp), pero esa
-- organización es solo su casa: no corre ninguna Polla. A partir de acá el OWNER
-- crea, desde el panel, una organización por capitalist con su usuario CAPITALIST.
--
-- Credenciales iniciales: usuario `owner`, contraseña `polla2026`.
-- El hash bcrypt (cost 12) se generó localmente; password_reset_required = TRUE
-- fuerza el cambio en el primer login. CAMBIAR LA CONTRASEÑA APENAS SE DESPLIEGUE.

INSERT INTO polla_organizations (polla_organization_id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'Sistema')
ON CONFLICT DO NOTHING;

INSERT INTO polla_users (
  polla_user_id,
  user_type,
  name,
  username,
  password_hash,
  password_reset_required,
  polla_organization_id
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'OWNER',
  'Owner',
  'owner',
  '$2b$12$BYExO1RGNiqeIbaQzAhvXOx2xTayRH2R7z98M97KULaqh4hGFdudO',
  TRUE,
  '00000000-0000-4000-8000-000000000001'
)
ON CONFLICT DO NOTHING;
