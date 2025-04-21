-- Actualizar user_type enum
alter type user_type rename to old_user_type;
create type user_type as enum ('OWNER', 'ADMIN');

-- Actualizar tabla users
alter table users
  alter column number drop not null,
  alter column fee drop not null,
  alter column fee_plus drop not null,
  drop column cashier_type;

-- Cambiar el tipo del campo user_type
alter table users
  alter column user_type type user_type using user_type::text::user_type;

-- Borrar los tipos viejos
drop type old_user_type;
drop type if exists cashier_type;
