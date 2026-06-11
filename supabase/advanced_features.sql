-- Optional advanced feature migration for WhatsApp Bulk Sender.
-- Keep supabase/schema.sql as the base install. Run this file after the base
-- schema when you want queue metadata, compliance controls, CRM fields, and
-- richer delivery analytics.

alter table campaigns
  add column if not exists queued_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists scheduled_for timestamptz,
  add column if not exists runner_status text default 'idle',
  add column if not exists queue_position int,
  add column if not exists quiet_hours jsonb default '{}'::jsonb,
  add column if not exists rate_profile jsonb default '{}'::jsonb,
  add column if not exists variant_summary jsonb default '{}'::jsonb,
  add column if not exists compliance jsonb default '{}'::jsonb;

alter table send_logs
  add column if not exists failure_category text,
  add column if not exists retry_count int not null default 0,
  add column if not exists variant_key text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists campaigns_runner_status_idx on campaigns (runner_status);
create index if not exists campaigns_scheduled_for_idx on campaigns (scheduled_for);
create index if not exists send_logs_number_status_idx on send_logs (number, status);
create index if not exists send_logs_failure_category_idx on send_logs (failure_category);

create table if not exists contact_profiles (
  number          text primary key,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  name            text,
  tags            text[] default '{}',
  lead_status     text default 'new',
  last_contacted_at timestamptz,
  last_campaign_id uuid references campaigns(id) on delete set null,
  total_sent      int not null default 0,
  total_failed    int not null default 0,
  total_skipped   int not null default 0,
  notes           text
);

create table if not exists campaign_variants (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid references campaigns(id) on delete cascade,
  created_at      timestamptz default now(),
  variant_key     text not null,
  message_text    text,
  recipients      int not null default 0,
  sent            int not null default 0,
  failed          int not null default 0,
  skipped         int not null default 0,
  unique (campaign_id, variant_key)
);

alter table contact_profiles enable row level security;
alter table campaign_variants enable row level security;

drop policy if exists "open" on contact_profiles;
drop policy if exists "open" on campaign_variants;

create policy "open" on contact_profiles for all using (true) with check (true);
create policy "open" on campaign_variants for all using (true) with check (true);

insert into app_settings (key, value)
values
  ('quiet_hours_enabled', 'false'::jsonb),
  ('quiet_hours_start', '"21:00"'::jsonb),
  ('quiet_hours_end', '"09:00"'::jsonb),
  ('daily_send_cap', '250'::jsonb),
  ('per_campaign_cap', '500'::jsonb),
  ('cooldown_hours', '24'::jsonb),
  ('warmup_mode', 'false'::jsonb),
  ('adaptive_delay_enabled', 'true'::jsonb),
  ('consent_check_required', 'true'::jsonb),
  ('unsubscribe_keywords', '["STOP","UNSUBSCRIBE","NO"]'::jsonb)
on conflict (key) do nothing;
