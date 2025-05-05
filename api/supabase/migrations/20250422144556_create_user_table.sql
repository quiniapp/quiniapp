
create table if not exists public.users (
  user_id uuid primary key default gen_random_uuid(),
  number integer,
  user_type integer not null,
  name text,
  last_name text,
  address text,
  phone bigint,
  email text,
  username text not null,
  password text not null,
  user_salt text not null,
  token text not null,
  disabled boolean not null default false,
  group_id uuid,
  cashier_number integer,
  cashier_type integer,
  fee numeric,
  fee_plus numeric,
  created_at timestamp without time zone not null default now(),
  edited_at timestamp without time zone not null default now(),
  deleted_at timestamp without time zone
);

alter table public.users
  add constraint chk_cashier_fields
  check (
    (user_type = 2 and cashier_number is not null and cashier_type is not null)
    or
    (user_type <> 2 and cashier_number is null and cashier_type is null)
  );

