create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'viewer',
  job_title text,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid references public.profiles,
  accepted_by uuid references public.profiles,
  created_at timestamptz not null default now(),
  unique(organization_id,email,status)
);

alter table public.organization_invitations enable row level security;
create policy invitations_select on public.organization_invitations for select to authenticated using(public.has_org_role(organization_id,array['admin']::public.app_role[]) or email=(select auth.jwt()->>'email'));
create policy invitations_insert on public.organization_invitations for insert to authenticated with check(public.has_org_role(organization_id,array['admin']::public.app_role[]));
create policy invitations_update on public.organization_invitations for update to authenticated using(public.has_org_role(organization_id,array['admin']::public.app_role[])) with check(public.has_org_role(organization_id,array['admin']::public.app_role[]));

create or replace function public.accept_organization_invitation(invitation_token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.organization_invitations; current_email text;
begin
  current_email := lower(coalesce((select auth.jwt()->>'email'),''));
  select * into inv from public.organization_invitations where token=invitation_token and status='pending' and expires_at>now() and lower(email)=current_email for update;
  if inv.id is null then raise exception 'Convite inválido, expirado ou destinado a outro e-mail'; end if;
  insert into public.organization_members(organization_id,user_id,role,job_title,active) values(inv.organization_id,(select auth.uid()),inv.role,inv.job_title,true)
  on conflict(organization_id,user_id) do update set role=excluded.role,job_title=excluded.job_title,active=true;
  update public.organization_invitations set status='accepted',accepted_by=(select auth.uid()) where id=inv.id;
  return inv.organization_id;
end $$;
revoke all on function public.accept_organization_invitation(uuid) from public;
grant execute on function public.accept_organization_invitation(uuid) to authenticated;
