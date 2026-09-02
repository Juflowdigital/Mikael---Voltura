alter table public.organization_settings
  add column if not exists document_models jsonb not null default '[]'::jsonb,
  add column if not exists approval_rules jsonb not null default '[]'::jsonb;
