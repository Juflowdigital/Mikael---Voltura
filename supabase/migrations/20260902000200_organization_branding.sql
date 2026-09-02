alter table public.organizations
  add column if not exists logo_path text,
  add column if not exists address text,
  add column if not exists branches text;

insert into public.organization_settings (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;
