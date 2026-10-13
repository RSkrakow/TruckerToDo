-- Run once in a NEW Supabase project (SQL Editor), or copy into a CLI-generated migration.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, full_name text not null default '',
 role text not null default 'member' check(role in ('admin','manager','member')),
 created_at timestamptz not null default now()
);
create table public.areas (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 description text, color_code text not null default '#126958' check(color_code ~ '^#[0-9a-fA-F]{6}$')
);
create table public.area_members (
 area_id uuid references public.areas(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete cascade, primary key(area_id,user_id)
);
create table public.notes_history (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 200),
 source_type text not null check(source_type in ('image','pdf','docx','manual')),
 file_url text, manual_text text, meeting_key text,
 created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(),
 processing_state text not null default 'uploaded' check(processing_state in ('uploaded','processing','review','approved','failed')),
 approved_at timestamptz, processing_started_at timestamptz,
 check((source_type='manual' and file_url is null) or (source_type<>'manual' and file_url is not null))
);
create table public.items (
 id uuid primary key default gen_random_uuid(), note_id uuid references public.notes_history(id),
 area_id uuid not null references public.areas(id), title text not null check(length(title) between 1 and 300),
 description text, type text not null check(type in ('task','info')),
 assigned_to uuid references public.profiles(id), created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), due_date date, completed_at timestamptz,
 status text not null default 'pending_approval' check(status in ('pending_approval','todo','in_progress','done','archived')),
 approved_at timestamptz, suggested_duplicate_id uuid references public.items(id), duplicate_reason text,
 fingerprint text generated always as (lower(regexp_replace(trim(title),'\s+',' ','g'))) stored,
 check((status='done') = (completed_at is not null))
);
create unique index items_no_exact_duplicates on public.items(area_id,type,fingerprint) where approved_at is not null;
create index items_area_status on public.items(area_id,status);
create index items_assigned_to on public.items(assigned_to);
create index items_note_id on public.items(note_id);
create index area_members_user on public.area_members(user_id);
-- Multiple people may submit notes from one meeting: one item, multiple source links.
create table public.item_sources (
 item_id uuid references public.items(id) on delete cascade,
 note_id uuid references public.notes_history(id), linked_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), primary key(item_id,note_id)
);
create table public.item_history (
 id bigint generated always as identity primary key, item_id uuid not null references public.items(id) on delete cascade,
 changed_by uuid references public.profiles(id), field_changed text not null, old_value text, new_value text,
 changed_at timestamptz not null default now()
);
create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references public.items(id),
 payload jsonb not null, created_at timestamptz not null default now(), delivered_at timestamptz,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz, last_error text
);
create table public.analysis_runs (
 id uuid primary key default gen_random_uuid(), note_id uuid not null references public.notes_history(id),
 user_id uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);
create index analysis_runs_user_date on public.analysis_runs(user_id,created_at);
-- Helpers are private, fixed search_path, no metadata-based authorization.
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function private.in_area(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.area_members where area_id=a and user_id=auth.uid());
$$;
create function private.manages(a uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_admin() or (private.in_area(a) and exists(select 1 from public.profiles where id=auth.uid() and role='manager'));
$$;
create function private.read_item(a uuid,assignee uuid,creator uuid,approved timestamptz) returns boolean language sql stable security invoker set search_path='' as $$
 select private.is_admin() or (approved is null and creator=auth.uid()) or (approved is not null and (private.in_area(a) or assignee=auth.uid()));
$$;
revoke all on all functions in schema private from public;
grant execute on function private.is_admin(),private.in_area(uuid),private.manages(uuid),private.read_item(uuid,uuid,uuid,timestamptz) to authenticated;
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.area_members enable row level security;
alter table public.notes_history enable row level security;
alter table public.items enable row level security;
alter table public.item_sources enable row level security;
alter table public.item_history enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.analysis_runs enable row level security;
revoke all on public.analysis_runs from anon,authenticated;
grant select,insert on public.analysis_runs to authenticated;
create policy runs_read on public.analysis_runs for select to authenticated using(user_id=auth.uid());
create policy runs_insert on public.analysis_runs for insert to authenticated with check(user_id=auth.uid());
grant select on public.profiles,public.areas,public.area_members,public.notes_history,public.items,public.item_sources,public.item_history to authenticated;
grant insert,update on public.notes_history,public.items,public.item_sources to authenticated;
grant insert,update,delete on public.areas,public.area_members to authenticated;
grant update(role,full_name) on public.profiles to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke all on public.notification_outbox from anon,authenticated;
grant all on public.notification_outbox to service_role;
create policy profiles_read on public.profiles for select to authenticated using (
 id=auth.uid() or private.is_admin() or exists(select 1 from public.area_members m where m.user_id=profiles.id and private.in_area(m.area_id))
);
create policy profiles_admin on public.profiles for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy areas_read on public.areas for select to authenticated using(private.is_admin() or private.in_area(id) or exists(select 1 from public.items i where i.area_id=areas.id and i.assigned_to=auth.uid() and i.approved_at is not null));
create policy areas_admin on public.areas for all to authenticated using(private.is_admin()) with check(private.is_admin());
create policy members_read on public.area_members for select to authenticated using(private.is_admin() or private.in_area(area_id));
create policy members_admin on public.area_members for all to authenticated using(private.is_admin()) with check(private.is_admin());
-- A mixed-area source document is visible only to its owner or admin; item access does not grant document access.
create policy notes_read on public.notes_history for select to authenticated using(created_by=auth.uid() or private.is_admin());
create policy notes_insert on public.notes_history for insert to authenticated with check(created_by=auth.uid() and approved_at is null);
create policy notes_update on public.notes_history for update to authenticated using(created_by=auth.uid() or private.is_admin()) with check(created_by=auth.uid() or private.is_admin());
create policy items_read on public.items for select to authenticated using(private.read_item(area_id,assigned_to,created_by,approved_at));
create policy items_insert on public.items for insert to authenticated with check (
 created_by=auth.uid() and (private.in_area(area_id) or private.is_admin())
 and (note_id is null or exists(select 1 from public.notes_history n where n.id=note_id and (n.created_by=auth.uid() or private.is_admin()) and n.approved_at is null))
 and (assigned_to is null or exists(select 1 from public.area_members m where m.area_id=items.area_id and m.user_id=assigned_to))
);
create policy items_update on public.items for update to authenticated using(private.read_item(area_id,assigned_to,created_by,approved_at)) with check(private.read_item(area_id,assigned_to,created_by,approved_at));
create policy sources_read on public.item_sources for select to authenticated using(exists(select 1 from public.items i where i.id=item_id));
create policy sources_insert on public.item_sources for insert to authenticated with check(linked_by=auth.uid() and exists(select 1 from public.items i where i.id=item_id and i.approved_at is not null) and exists(select 1 from public.notes_history n where n.id=note_id and (n.created_by=auth.uid() or private.is_admin()) and n.approved_at is null));
create policy history_read on public.item_history for select to authenticated using(exists(select 1 from public.items i where i.id=item_id));
-- Immutable provenance and permission checks cover direct REST writes too.
create function private.guard_item() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.id<>old.id or new.note_id is distinct from old.note_id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Immutable provenance'; end if;
  if old.approved_at is not null and new.approved_at is distinct from old.approved_at then raise exception 'Immutable approval'; end if;
  if old.approved_at is not null and new.status='pending_approval' then raise exception 'Cannot unapprove'; end if;
  if old.approved_at is not null and not private.manages(old.area_id) and
   (to_jsonb(new)-array['status','completed_at','fingerprint']) is distinct from (to_jsonb(old)-array['status','completed_at','fingerprint']) then raise exception 'Only managers can edit details'; end if;
  if old.approved_at is not null and new.area_id<>old.area_id and not private.manages(new.area_id) then raise exception 'No rights to destination area'; end if;
  if old.approved_at is null and old.created_by<>auth.uid() and not private.is_admin() then raise exception 'Not your draft'; end if;
  if old.approved_at is null and not (private.in_area(new.area_id) or private.is_admin()) then raise exception 'No rights to area'; end if;
 end if;
 if new.assigned_to is not null and (TG_OP='INSERT' or new.assigned_to is distinct from old.assigned_to or new.area_id is distinct from old.area_id) and not exists(select 1 from public.area_members m where m.area_id=new.area_id and m.user_id=new.assigned_to) then raise exception 'Assignee must belong to area'; end if;
 if new.status='pending_approval' then new.approved_at:=null;
 elsif new.approved_at is null and new.status<>'archived' then new.approved_at:=now(); end if;
 new.completed_at:=case when new.status='done' then coalesce(new.completed_at,now()) else null end;
 return new;
end; $$;
create trigger guard_item before insert or update on public.items for each row execute function private.guard_item();
create function private.guard_note() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-array['processing_state','approved_at','processing_started_at']) is distinct from (to_jsonb(old)-array['processing_state','approved_at','processing_started_at']) then raise exception 'Immutable note source'; end if;
 if old.approved_at is not null and (new.approved_at is distinct from old.approved_at or new.processing_state<>'approved') then raise exception 'Immutable approved note'; end if;
 return new;
end; $$;
create trigger guard_note before update on public.notes_history for each row execute function private.guard_note();
create function private.audit_item() returns trigger language plpgsql security definer set search_path='' as $$
declare f text; before_json jsonb; after_json jsonb;
begin
 before_json:=case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end; after_json:=to_jsonb(new);
 foreach f in array array['title','description','type','area_id','assigned_to','due_date','status','completed_at','approved_at'] loop
  if before_json->f is distinct from after_json->f then insert into public.item_history(item_id,changed_by,field_changed,old_value,new_value) values(new.id,auth.uid(),f,before_json->>f,after_json->>f); end if;
 end loop;
 if new.type='task' and new.approved_at is not null and (TG_OP='INSERT' or before_json->>'approved_at' is null or before_json->>'status' is distinct from new.status) then
  insert into public.notification_outbox(item_id,payload) values(new.id,jsonb_build_object('id',new.id,'title',new.title,'status',new.status,'due_date',new.due_date,'event',case when before_json->>'approved_at' is null then 'Zatwierdzono zadanie' else 'Zmieniono status' end));
 end if;
 return new;
end; $$;
create trigger audit_item after insert or update on public.items for each row execute function private.audit_item();
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email,full_name) values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')); return new; end; $$;
create trigger auth_user_created after insert on auth.users for each row execute function private.new_profile();
revoke all on function private.guard_item(),private.guard_note(),private.audit_item(),private.new_profile() from public,anon,authenticated;
-- All review decisions commit in one transaction. Row lock serializes repeat clicks.
create function public.approve_note(p_note uuid,p_decisions jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare n public.notes_history; d jsonb; draft public.items; target public.items;
begin
 select * into n from public.notes_history where id=p_note for update;
 if not found or (n.created_by<>auth.uid() and not private.is_admin()) then raise exception 'Note unavailable'; end if;
 if n.approved_at is not null then return; end if;
 if n.processing_state<>'review' then raise exception 'Note not ready'; end if;
 if jsonb_typeof(p_decisions)<>'array' or jsonb_array_length(p_decisions)>100 then raise exception 'Invalid decisions'; end if;
 for d in select * from jsonb_array_elements(p_decisions) loop
  select * into draft from public.items where id=(d->>'id')::uuid and note_id=p_note and approved_at is null and status='pending_approval' for update;
  if not found then raise exception 'Invalid draft'; end if;
  if d->>'mode'='add' then
   update public.items set title=d->>'title',description=d->>'description',area_id=(d->>'area_id')::uuid,assigned_to=nullif(d->>'assigned_to','')::uuid,due_date=nullif(d->>'due_date','')::date,status='todo' where id=draft.id;
   insert into public.item_sources(item_id,note_id) values(draft.id,p_note) on conflict do nothing;
  elsif d->>'mode'='link' then
   select * into target from public.items where id=(d->>'duplicate_id')::uuid and approved_at is not null and type=draft.type;
   if not found then raise exception 'Duplicate unavailable'; end if;
   insert into public.item_sources(item_id,note_id) values(target.id,p_note) on conflict do nothing;
   update public.items set status='archived' where id=draft.id;
  elsif d->>'mode'='skip' then update public.items set status='archived' where id=draft.id;
  else raise exception 'Invalid review mode'; end if;
 end loop;
 if exists(select 1 from public.items where note_id=p_note and status='pending_approval') then raise exception 'Review all candidates'; end if;
 update public.notes_history set approved_at=now(),processing_state='approved' where id=p_note;
end; $$;
revoke all on function public.approve_note(uuid,jsonb) from public,anon;
grant execute on function public.approve_note(uuid,jsonb) to authenticated;
create function public.begin_analysis(p_note uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare n public.notes_history;
begin
 if auth.uid() is null then raise exception 'Unauthorized'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,0));
 select * into n from public.notes_history where id=p_note and (created_by=auth.uid() or private.is_admin()) for update;
 if not found or n.approved_at is not null or n.processing_state='review' then return false; end if;
 if n.processing_state='processing' and n.processing_started_at>now()-interval '3 minutes' then return false; end if;
 if (select count(*) from public.analysis_runs where user_id=auth.uid() and created_at>now()-interval '24 hours')>=30 then raise exception 'Limit 30 analiz w ciągu 24 godzin'; end if;
 insert into public.analysis_runs(note_id) values(p_note);
 update public.notes_history set processing_state='processing',processing_started_at=now() where id=p_note;
 return true;
end; $$;
revoke all on function public.begin_analysis(uuid) from public,anon;
grant execute on function public.begin_analysis(uuid) to authenticated;
-- Stage all suggestions and the note state atomically, avoiding partial AI retries.
create function public.stage_note(p_note uuid,p_candidates jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare n public.notes_history; c jsonb;
begin
 select * into n from public.notes_history where id=p_note and (created_by=auth.uid() or private.is_admin()) for update;
 if not found or n.processing_state<>'processing' or n.approved_at is not null then raise exception 'Not processing'; end if;
 if jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>40 then raise exception 'Invalid suggestions'; end if;
 for c in select * from jsonb_array_elements(p_candidates) loop
  insert into public.items(note_id,title,description,type,area_id,assigned_to,due_date,suggested_duplicate_id,duplicate_reason)
   values(p_note,c->>'title',c->>'description',c->>'type',(c->>'area_id')::uuid,nullif(c->>'assigned_to','')::uuid,nullif(c->>'due_date','')::date,nullif(c->>'duplicate_id','')::uuid,c->>'duplicate_reason');
 end loop;
 update public.notes_history set processing_state='review' where id=p_note;
end; $$;
revoke all on function public.stage_note(uuid,jsonb) from public,anon;
grant execute on function public.stage_note(uuid,jsonb) to authenticated;
create function public.claim_notifications() returns setof public.notification_outbox language sql security invoker set search_path='' as $$
 update public.notification_outbox set lease_until=now()+interval '5 minutes',attempts=attempts+1 where id in
 (select id from public.notification_outbox where delivered_at is null and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by created_at limit 5 for update skip locked) returning *;
$$;
revoke all on function public.claim_notifications() from public,anon,authenticated;
grant execute on function public.claim_notifications() to service_role;
insert into public.areas(name,color_code) values ('Dyspozytorzy','#126958'),('Warsztat i Dyspozytorzy','#397bb5'),('Finanse','#9b6c35'),('Strategia','#785bb0'),('Zarząd','#3e556e'),('Pomysły na rozbudowę','#bd5873');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('notes','notes',false,15728640,array['image/jpeg','image/png','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy files_insert on storage.objects for insert to authenticated with check(bucket_id='notes' and (storage.foldername(name))[1]=auth.uid()::text);
create policy files_read on storage.objects for select to authenticated using(bucket_id='notes' and ((storage.foldername(name))[1]=auth.uid()::text or private.is_admin()));
create policy files_delete on storage.objects for delete to authenticated using(bucket_id='notes' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.notes_history where file_url=name));
commit;
