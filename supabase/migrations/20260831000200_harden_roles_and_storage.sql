begin;

-- Restringe mutações por módulo; a simples participação na empresa não concede escrita.
do $$ declare t text; begin foreach t in array array[
 'clients','leads','crm_activities','budgets','proposals','proposal_versions','contracts','contract_signatures'
] loop
 execute format('drop policy %I on public.%I',t||'_insert',t); execute format('drop policy %I on public.%I',t||'_update',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''commercial'']::public.app_role[]))',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using(public.has_org_role(organization_id,array[''admin'',''commercial'']::public.app_role[])) with check(public.has_org_role(organization_id,array[''admin'',''commercial'']::public.app_role[]))',t||'_update',t);
 end loop; end $$;
do $$ declare t text; begin foreach t in array array[
 'homologations','documents','works','work_assignments','work_checklist_items','work_photos','field_checkins','suppliers','purchase_orders',
 'inventory_items','purchase_order_items','inventory_movements','assets','asset_maintenances','energy_generation','warranties'
] loop
 execute format('drop policy %I on public.%I',t||'_insert',t); execute format('drop policy %I on public.%I',t||'_update',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''engineering'',''installer'']::public.app_role[]))',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using(public.has_org_role(organization_id,array[''admin'',''engineering'',''installer'']::public.app_role[])) with check(public.has_org_role(organization_id,array[''admin'',''engineering'',''installer'']::public.app_role[]))',t||'_update',t);
 end loop; end $$;
do $$ declare t text; begin foreach t in array array[
 'financial_accounts','financial_transactions','installments','commissions'
] loop
 execute format('drop policy %I on public.%I',t||'_insert',t); execute format('drop policy %I on public.%I',t||'_update',t); execute format('drop policy %I on public.%I',t||'_select',t);
 execute format('create policy %I on public.%I for select to authenticated using(public.has_org_role(organization_id,array[''admin'',''finance'',''viewer'']::public.app_role[]))',t||'_select',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''finance'']::public.app_role[]))',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using(public.has_org_role(organization_id,array[''admin'',''finance'']::public.app_role[])) with check(public.has_org_role(organization_id,array[''admin'',''finance'']::public.app_role[]))',t||'_update',t);
 end loop; end $$;
do $$ declare t text; begin foreach t in array array['om_contracts','service_tickets','nps_responses'] loop
 execute format('drop policy %I on public.%I',t||'_insert',t); execute format('drop policy %I on public.%I',t||'_update',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'',''engineering'']::public.app_role[]))',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using(public.has_org_role(organization_id,array[''admin'',''engineering'']::public.app_role[])) with check(public.has_org_role(organization_id,array[''admin'',''engineering'']::public.app_role[]))',t||'_update',t);
 end loop; end $$;
do $$ declare t text; begin foreach t in array array['sales_goals','organization_settings'] loop
 execute format('drop policy %I on public.%I',t||'_insert',t); execute format('drop policy %I on public.%I',t||'_update',t);
 execute format('create policy %I on public.%I for insert to authenticated with check(public.has_org_role(organization_id,array[''admin'']::public.app_role[]))',t||'_insert',t);
 execute format('create policy %I on public.%I for update to authenticated using(public.has_org_role(organization_id,array[''admin'']::public.app_role[])) with check(public.has_org_role(organization_id,array[''admin'']::public.app_role[]))',t||'_update',t);
 end loop; end $$;
-- Auditoria é somente leitura no client; notificações só podem ser atualizadas pelo destinatário.
drop policy audit_logs_insert on public.audit_logs; drop policy audit_logs_update on public.audit_logs;
drop policy notifications_insert on public.notifications; drop policy notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated using(public.is_org_member(organization_id) and (user_id=(select auth.uid()) or user_id is null)) with check(public.is_org_member(organization_id) and (user_id=(select auth.uid()) or user_id is null));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('documents','documents',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']),
 ('work-photos','work-photos',false,15728640,array['image/jpeg','image/png','image/webp']),
 ('proposals','proposals',false,20971520,array['application/pdf'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- O primeiro diretório de cada objeto deve ser o UUID da organização.
create policy storage_org_read on storage.objects for select to authenticated using(
 bucket_id in ('documents','work-photos','proposals') and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy storage_org_insert on storage.objects for insert to authenticated with check(
 bucket_id in ('documents','work-photos','proposals') and public.has_org_role(((storage.foldername(name))[1])::uuid,array['admin','commercial','engineering','installer']::public.app_role[])
);
create policy storage_org_update on storage.objects for update to authenticated using(
 bucket_id in ('documents','work-photos','proposals') and public.has_org_role(((storage.foldername(name))[1])::uuid,array['admin','commercial','engineering']::public.app_role[])
) with check(public.has_org_role(((storage.foldername(name))[1])::uuid,array['admin','commercial','engineering']::public.app_role[]));
create policy storage_org_delete on storage.objects for delete to authenticated using(
 bucket_id in ('documents','work-photos','proposals') and public.has_org_role(((storage.foldername(name))[1])::uuid,array['admin']::public.app_role[])
);

commit;
