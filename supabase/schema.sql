-- ProofVault schema
-- Run this once in the Supabase SQL editor for your project.
--
-- This script is idempotent: it is safe to re-run on an existing project to
-- pick up the newer sections (clients, acknowledgement + payment timestamps)
-- without touching data you already have.

create extension if not exists "pgcrypto";

-- ─── Clients ─────────────────────────────────────────────────────────────────
-- One row per client, per user. Client names are unique per user (case- and
-- whitespace-insensitive) so every project for the same client rolls up under
-- a single client record.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists clients_user_id_name_key
  on clients (user_id, lower(btrim(name)));

create index if not exists clients_user_id_idx on clients (user_id);

-- ─── Projects ────────────────────────────────────────────────────────────────

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_name text not null,
  platform text, -- e.g. "Upwork", "Fiverr", "Direct client"
  description text,
  agreed_amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

-- Link projects to their client. `client_name` is kept in sync by the trigger
-- below so every existing query that reads `projects.client_name` keeps working.
alter table projects
  add column if not exists client_id uuid references clients (id) on delete cascade;

-- ─── Deliverables ────────────────────────────────────────────────────────────

create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  file_key text,
  file_url text,
  file_name text,
  amount numeric(12, 2) not null default 0,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

-- Evidence fields used by the Dispute Assistant. All optional — a deliverable
-- logged before these existed simply reports "not recorded".
alter table deliverables
  add column if not exists paid_at timestamptz;
alter table deliverables
  add column if not exists acknowledged boolean not null default false;
alter table deliverables
  add column if not exists acknowledged_at timestamptz;
alter table deliverables
  add column if not exists acknowledgement_note text;

create index if not exists projects_user_id_idx on projects (user_id);
create index if not exists projects_client_id_idx on projects (client_id);
create index if not exists deliverables_project_id_idx on deliverables (project_id);
create index if not exists deliverables_user_id_idx on deliverables (user_id);

-- ─── Keep projects attached to a single client record ────────────────────────
-- Runs on insert and whenever client_name changes. Finds (or creates) the
-- client for this user, canonicalises `client_name` to that client's stored
-- spelling, and sets `client_id`. Existing inserts that only supply
-- `client_name` keep working untouched.

create or replace function proofvault_sync_project_client()
returns trigger
language plpgsql
as $$
declare
  v_name text;
  v_client_id uuid;
  v_canonical text;
begin
  v_name := btrim(coalesce(new.client_name, ''));

  if v_name = '' then
    raise exception 'client_name cannot be empty';
  end if;

  select id, name into v_client_id, v_canonical
  from clients
  where user_id = new.user_id
    and lower(btrim(name)) = lower(v_name);

  if v_client_id is null then
    insert into clients (user_id, name)
    values (new.user_id, v_name)
    on conflict (user_id, lower(btrim(name))) do nothing
    returning id, name into v_client_id, v_canonical;
  end if;

  -- Lost the race with a concurrent insert — read the winner back.
  if v_client_id is null then
    select id, name into v_client_id, v_canonical
    from clients
    where user_id = new.user_id
      and lower(btrim(name)) = lower(v_name);
  end if;

  new.client_id := v_client_id;
  new.client_name := coalesce(v_canonical, v_name);

  return new;
end;
$$;

drop trigger if exists projects_sync_client on projects;
create trigger projects_sync_client
  before insert or update of client_name, user_id on projects
  for each row execute function proofvault_sync_project_client();

-- ─── Backfill clients for projects created before this migration ─────────────

insert into clients (user_id, name)
select distinct on (p.user_id, lower(btrim(p.client_name)))
       p.user_id, btrim(p.client_name)
from projects p
where p.client_id is null
  and btrim(coalesce(p.client_name, '')) <> ''
order by p.user_id, lower(btrim(p.client_name)), p.created_at
on conflict (user_id, lower(btrim(name))) do nothing;

update projects p
set client_id = c.id,
    client_name = c.name
from clients c
where p.client_id is null
  and c.user_id = p.user_id
  and lower(btrim(c.name)) = lower(btrim(p.client_name));

-- ─── Row level security ──────────────────────────────────────────────────────

alter table clients enable row level security;
alter table projects enable row level security;
alter table deliverables enable row level security;

-- Clients: a user can only see and modify their own rows.
drop policy if exists "clients_select_own" on clients;
create policy "clients_select_own" on clients
  for select using (auth.uid() = user_id);
drop policy if exists "clients_insert_own" on clients;
create policy "clients_insert_own" on clients
  for insert with check (auth.uid() = user_id);
drop policy if exists "clients_update_own" on clients;
create policy "clients_update_own" on clients
  for update using (auth.uid() = user_id);
drop policy if exists "clients_delete_own" on clients;
create policy "clients_delete_own" on clients
  for delete using (auth.uid() = user_id);

-- Projects: a user can only see and modify their own rows.
drop policy if exists "projects_select_own" on projects;
create policy "projects_select_own" on projects
  for select using (auth.uid() = user_id);
drop policy if exists "projects_insert_own" on projects;
create policy "projects_insert_own" on projects
  for insert with check (auth.uid() = user_id);
drop policy if exists "projects_update_own" on projects;
create policy "projects_update_own" on projects
  for update using (auth.uid() = user_id);
drop policy if exists "projects_delete_own" on projects;
create policy "projects_delete_own" on projects
  for delete using (auth.uid() = user_id);

-- Deliverables: same ownership rule, keyed directly off user_id for speed
-- (kept in sync with the parent project's owner at insert time).
drop policy if exists "deliverables_select_own" on deliverables;
create policy "deliverables_select_own" on deliverables
  for select using (auth.uid() = user_id);
drop policy if exists "deliverables_insert_own" on deliverables;
create policy "deliverables_insert_own" on deliverables
  for insert with check (auth.uid() = user_id);
drop policy if exists "deliverables_update_own" on deliverables;
create policy "deliverables_update_own" on deliverables
  for update using (auth.uid() = user_id);
drop policy if exists "deliverables_delete_own" on deliverables;
create policy "deliverables_delete_own" on deliverables
  for delete using (auth.uid() = user_id);

-- Storage bucket for deliverable proof files (screenshots, documents).
-- Public so stored files are viewable via a plain URL (matches how
-- file_url is used elsewhere in the app); writes are still restricted
-- below to each user's own folder.
insert into storage.buckets (id, name, public)
values ('deliverable-proofs', 'deliverable-proofs', true)
on conflict (id) do nothing;

-- Files are stored under a path like "<user_id>/<project_id>/<filename>",
-- so (storage.foldername(name))[1] is the owning user's id.
drop policy if exists "deliverable_proofs_select" on storage.objects;
create policy "deliverable_proofs_select" on storage.objects
  for select using (bucket_id = 'deliverable-proofs');

drop policy if exists "deliverable_proofs_insert_own" on storage.objects;
create policy "deliverable_proofs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'deliverable-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "deliverable_proofs_delete_own" on storage.objects;
create policy "deliverable_proofs_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'deliverable-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
