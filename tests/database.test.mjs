import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const user={admin:'00000000-0000-4000-8000-000000000001',manager:'00000000-0000-4000-8000-000000000002',member:'00000000-0000-4000-8000-000000000003',other:'00000000-0000-4000-8000-000000000004'};
test('PostgreSQL permissions, provenance, atomic approval and notification outbox',async t=>{
 const db=new PGlite();await db.waitReady;
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
 await db.exec(readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 for(const[name,id]of Object.entries(user))await db.query('insert into auth.users(id,email) values($1,$2)',[id,`${name}@example.test`]);
 await db.exec(`update public.profiles set role='admin' where id='${user.admin}'; update public.profiles set role='manager' where id='${user.manager}';`);
 const areas=(await db.query('select id,name from public.areas order by name')).rows;
 const a=areas[0].id,b=areas[1].id;
 await db.query('insert into public.area_members(area_id,user_id) values($1,$2),($1,$3),($2,$4)',[a,user.member,user.manager,user.other]);
 async function as(name){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user[name]]);await db.exec('set role authenticated');}
 await as('admin');
 const itemA=(await db.query("insert into public.items(area_id,title,type,status) values($1,'Zadanie A','task','todo') returning id",[a])).rows[0].id;
 const itemB=(await db.query("insert into public.items(area_id,title,type,status,assigned_to) values($1,'Zadanie B','task','todo',$2) returning id",[b,user.other])).rows[0].id;
 const ownNote=(await db.query("insert into public.notes_history(title,source_type,manual_text) values('Poufne spotkanie','manual','Obszary A i B') returning id")).rows[0].id;
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['notes',`${user.admin}/photo.jpg`]);
 await t.test('member sees only their area, cannot escalate role or read mixed source',async()=>{
  await as('member');assert.deepEqual((await db.query('select id from public.items order by title')).rows.map(r=>r.id),[itemA]);
  await db.query("update public.profiles set role='admin' where id=$1",[user.member]);assert.equal((await db.query('select role from public.profiles where id=$1',[user.member])).rows[0].role,'member');
  assert.equal((await db.query('select * from public.notes_history where id=$1',[ownNote])).rows.length,0);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(db.query("update public.items set title='Przejęcie' where id=$1",[itemA]));
  await assert.rejects(db.query("insert into public.items(area_id,title,type,status) values($1,'Nie mój obszar','task','todo')",[b]));
 });
 await t.test('status change timestamps completion, creates immutable audit and queues Teams',async()=>{
  await as('member');await db.query("update public.items set status='done' where id=$1",[itemA]);
  const i=(await db.query('select status,completed_at from public.items where id=$1',[itemA])).rows[0];assert.equal(i.status,'done');assert.ok(i.completed_at);
  assert.ok((await db.query("select * from public.item_history where item_id=$1 and field_changed='status' and new_value='done'",[itemA])).rows.length);
  await assert.rejects(db.query('insert into public.item_history(item_id,field_changed) values($1,$2)',[itemA,'fake']));
  await assert.rejects(db.query('select * from public.notification_outbox'));
  await db.query("update public.items set status='in_progress' where id=$1",[itemA]);assert.equal((await db.query('select completed_at from public.items where id=$1',[itemA])).rows[0].completed_at,null);
 });
 await t.test('manager can edit own area but cannot move records to another area',async()=>{
  await as('manager');await db.query("update public.items set title='Zadanie A poprawione' where id=$1",[itemA]);
  await assert.rejects(db.query('update public.items set area_id=$1 where id=$2',[b,itemA]));
  assert.equal((await db.query('select * from public.items where id=$1',[itemB])).rows.length,0);
 });
 await t.test('approval rolls back all rows on a failing decision and repeated clicks are idempotent',async()=>{
  await as('member');const note=(await db.query("insert into public.notes_history(title,source_type,manual_text,processing_state) values('Notatka','manual','Tekst','review') returning id")).rows[0].id;
  const first=(await db.query("insert into public.items(note_id,area_id,title,type) values($1,$2,'Pierwsze','task') returning id",[note,a])).rows[0].id;
  const second=(await db.query("insert into public.items(note_id,area_id,title,type) values($1,$2,'Drugie','info') returning id",[note,a])).rows[0].id;
  const make=(id,title)=>({id,title,mode:'add',area_id:a,description:'',assigned_to:null,due_date:null});
  await assert.rejects(db.query('select public.approve_note($1,$2::jsonb)',[note,JSON.stringify([make(first,'Pierwsze'),make(second,'')])]));
  assert.equal((await db.query('select status from public.items where id=$1',[first])).rows[0].status,'pending_approval');
  await as('manager');assert.equal((await db.query('select * from public.items where id=$1',[first])).rows.length,0);
  await as('member');const decisions=JSON.stringify([make(first,'Pierwsze'),make(second,'Drugie')]);
  await db.query('select public.approve_note($1,$2::jsonb)',[note,decisions]);await db.query('select public.approve_note($1,$2::jsonb)',[note,decisions]);
  assert.equal((await db.query('select * from public.item_sources where note_id=$1',[note])).rows.length,2);
  await assert.rejects(db.query("insert into public.items(area_id,title,type,status) values($1,'  PIERWSZE  ','task','todo')",[a]));
  await assert.rejects(db.query("update public.items set status='pending_approval' where id=$1",[first]));
 });
 await t.test('service-role claims each queued event once while members cannot call dispatcher',async()=>{
  await as('member');await assert.rejects(db.query('select * from public.claim_notifications()'));
  await db.exec('reset role;set role service_role;');const jobs=(await db.query('select * from public.claim_notifications()')).rows;assert.ok(jobs.length>=3);assert.equal((await db.query('select * from public.claim_notifications()')).rows.length,0);
 });
 }finally{await db.close();}
});
