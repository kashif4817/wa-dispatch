create extension if not exists pgcrypto;

create table if not exists campaigns (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  finished_at     timestamptz,
  name            text,
  message_text    text,
  image_paths     text[] default '{}',
  total           int default 0,
  sent            int default 0,
  failed          int default 0,
  skipped         int default 0,
  status          text default 'pending',
  options         jsonb default '{}'::jsonb
);

create table if not exists send_logs (
  id              bigserial primary key,
  campaign_id     uuid references campaigns(id) on delete cascade,
  number          text not null,
  name            text,
  status          text not null,
  error           text,
  sent_at         timestamptz default now()
);

create index if not exists send_logs_campaign_id_idx on send_logs (campaign_id);

create table if not exists templates (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  name            text not null,
  message_text    text,
  image_paths     text[] default '{}'
);

create table if not exists recipient_lists (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  name            text not null,
  recipients      jsonb not null default '[]'::jsonb
);

create table if not exists notes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  title           text not null,
  body            text,
  campaign_name   text
);

create table if not exists opt_outs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  number          text not null unique,
  reason          text,
  source          text default 'manual'
);

create table if not exists pins (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  label           text default 'Default PIN',
  pin             text not null,
  active          boolean not null default true,
  constraint pins_four_digit_pin check (pin ~ '^[0-9]{4}$')
);

create table if not exists app_settings (
  key             text primary key,
  value           jsonb not null default 'null'::jsonb,
  updated_at      timestamptz default now()
);

insert into pins (label, pin, active)
select 'Default PIN', '1234', true
where not exists (select 1 from pins where active = true);

insert into app_settings (key, value)
values ('save_attachments_to_history', 'false'::jsonb)
on conflict (key) do nothing;

insert into app_settings (key, value)
values
  ('default_country_code', '"92"'::jsonb),
  ('min_delay_seconds', '8'::jsonb),
  ('max_delay_seconds', '25'::jsonb)
on conflict (key) do nothing;

alter table campaigns enable row level security;
alter table send_logs enable row level security;
alter table templates enable row level security;
alter table recipient_lists enable row level security;
alter table notes enable row level security;
alter table opt_outs enable row level security;
alter table pins enable row level security;
alter table app_settings enable row level security;

drop policy if exists "open" on campaigns;
drop policy if exists "open" on send_logs;
drop policy if exists "open" on templates;
drop policy if exists "open" on recipient_lists;
drop policy if exists "open" on notes;
drop policy if exists "open" on opt_outs;
drop policy if exists "open" on pins;
drop policy if exists "open" on app_settings;

create policy "open" on campaigns for all using (true) with check (true);
create policy "open" on send_logs for all using (true) with check (true);
create policy "open" on templates for all using (true) with check (true);
create policy "open" on recipient_lists for all using (true) with check (true);
create policy "open" on notes for all using (true) with check (true);
create policy "open" on opt_outs for all using (true) with check (true);
create policy "open" on pins for all using (true) with check (true);
create policy "open" on app_settings for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values
  ('campaign-images', 'campaign-images', true),
  ('template-images', 'template-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "campaign images open read" on storage.objects;
drop policy if exists "campaign images open write" on storage.objects;
drop policy if exists "campaign images open update" on storage.objects;
drop policy if exists "campaign images open delete" on storage.objects;
drop policy if exists "template images open read" on storage.objects;
drop policy if exists "template images open write" on storage.objects;
drop policy if exists "template images open update" on storage.objects;
drop policy if exists "template images open delete" on storage.objects;

create policy "campaign images open read"
on storage.objects for select
using (bucket_id = 'campaign-images');

create policy "campaign images open write"
on storage.objects for insert
with check (bucket_id = 'campaign-images');

create policy "campaign images open update"
on storage.objects for update
using (bucket_id = 'campaign-images')
with check (bucket_id = 'campaign-images');

create policy "campaign images open delete"
on storage.objects for delete
using (bucket_id = 'campaign-images');

create policy "template images open read"
on storage.objects for select
using (bucket_id = 'template-images');

create policy "template images open write"
on storage.objects for insert
with check (bucket_id = 'template-images');

create policy "template images open update"
on storage.objects for update
using (bucket_id = 'template-images')
with check (bucket_id = 'template-images');

create policy "template images open delete"
on storage.objects for delete
using (bucket_id = 'template-images');
