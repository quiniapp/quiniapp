-- Crear enums
create type user_type as enum ('ADMIN', 'CASHIER', 'CLIENT');
create type cashier_type as enum ('BRANCH', 'ONLINE');

create table public.users (
  user_id uuid primary key default gen_random_uuid(),
  number integer not null,
  user_type user_type not null,
  cashier_type cashier_type,
  name text,
  last_name text,
  address text,
  phone bigint,
  email text,
  fee numeric not null,
  fee_plus numeric not null,
  username text not null unique,
  password text not null,
  user_salt text not null,
  token text not null,
  disabled boolean not null default false,
  created_at timestamp with time zone default now(),
  edited_at timestamp with time zone default now(),
  deleted_at timestamp with time zone,

  -- Primera CHECK: cashier_type depende de user_type
  check (
    (user_type = 'CASHIER' and cashier_type is not null)
    or
    (user_type != 'CASHIER' and cashier_type is null)
  ),

  -- Segunda CHECK: email debe ser null o tener formato válido
  check (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    or email is null
  )
);
