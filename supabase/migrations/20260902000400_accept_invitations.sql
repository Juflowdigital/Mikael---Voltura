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
