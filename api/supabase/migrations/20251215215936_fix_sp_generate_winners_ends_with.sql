create or replace function public.ends_with(value text, ending text)
returns boolean
language plpgsql
immutable
as $$
begin
  return right(value, char_length(ending)) = ending;
end;
$$;
