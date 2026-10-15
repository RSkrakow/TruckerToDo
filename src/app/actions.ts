'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {after} from 'next/server';
import {session} from '@/lib/supabase/server';
import {itemInput,decisionInput,check} from '@/lib/validation';
import {z} from 'zod';
import {dispatchNotifications} from '@/lib/teams';
function notifications(){after(async()=>{try{await dispatchNotifications();}catch{console.error('Notification dispatch failed; outbox will retry.');}});}
export async function signOut(){const{client}=await session();await client.auth.signOut();redirect('/login');}
export async function createManual(input:unknown){
 try{const data=itemInput.parse(input);const{client}=await session();const result=check(await client.from('items').insert({...data,status:'todo'}).select('id').single());notifications();revalidatePath('/');return {id:result.id};}catch(e){return {error:e instanceof Error?e.message:'Nie udało się zapisać wpisu.'};}
}
export async function approveNote(noteId:string,decisions:unknown){
 try{z.uuid().parse(noteId);const values=z.array(decisionInput).max(100).parse(decisions);const{client}=await session();for(const d of values){if(d.mode==='add'&&d.type){await client.from('items').update({type:d.type}).eq('id',d.id).eq('note_id',noteId);}}check(await client.rpc('approve_note',{p_note:noteId,p_decisions:values}));notifications();revalidatePath('/');revalidatePath('/notes');return {ok:true};}catch(e){return {error:e instanceof Error?e.message:'Akceptacja nie powiodła się.'};}
}
export async function updateItem(id:string,input:unknown){
 try{z.uuid().parse(id);const values=itemInput.extend({status:z.enum(['todo','in_progress','done','archived'])}).parse(input);const{client,user}=await session();const item=check(await client.from('items').select('*').eq('id',id).not('approved_at','is',null).single());const profile=check(await client.from('profiles').select('role').eq('id',user.id).single());const memberships=check(await client.from('area_members').select('area_id').eq('user_id',user.id));const manages=profile.role==='admin'||(profile.role==='manager'&&memberships.some(m=>m.area_id===item.area_id));const patch=manages?values:{status:values.status};const updated=check(await client.from('items').update(patch).eq('id',item.id).select('id').single());notifications();revalidatePath('/');revalidatePath(`/items/${id}`);return {id:updated.id};}catch(e){return {error:e instanceof Error?e.message:'Zmiana nie powiodła się.'};}
}
export async function adminUpdate(input:unknown){
 try{const values=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('role'),user_id:z.uuid(),role:z.enum(['admin','manager','member'])}),
 z.object({kind:z.literal('membership'),user_id:z.uuid(),area_id:z.uuid(),remove:z.boolean()}),
 z.object({kind:z.literal('area'),name:z.string().trim().min(1).max(100),description:z.string().max(1000).default(''),color_code:z.string().regex(/^#[0-9a-fA-F]{6}$/)}),
 z.object({kind:z.literal('update_area'),id:z.uuid(),name:z.string().trim().min(1).max(100),description:z.string().max(1000).optional(),color_code:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()}),
 z.object({kind:z.literal('delete_area'),id:z.uuid()})]).parse(input);
 const{client,user}=await session();const profile=check(await client.from('profiles').select('role').eq('id',user.id).single());if(profile.role!=='admin')throw new Error('Tylko administrator.');
 if(values.kind==='role'){if(values.user_id===user.id && values.role!=='admin')throw new Error('Nie możesz odebrać sobie roli admina.');check(await client.from('profiles').update({role:values.role}).eq('id',values.user_id).select('id').single());}
 if(values.kind==='membership'){if(values.remove)check(await client.from('area_members').delete().eq('user_id',values.user_id).eq('area_id',values.area_id));else check(await client.from('area_members').upsert({user_id:values.user_id,area_id:values.area_id}));}
 if(values.kind==='area')check(await client.from('areas').insert({name:values.name,description:values.description,color_code:values.color_code}));
 if(values.kind==='update_area'){check(await client.from('areas').update({name:values.name,...(values.description!==undefined?{description:values.description}:{}),...(values.color_code!==undefined?{color_code:values.color_code}:{})}).eq('id',values.id).select('id').single());}
 if(values.kind==='delete_area'){
  const {count}=await client.from('items').select('id',{count:'exact',head:true}).eq('area_id',values.id);
  if(count && count>0)throw new Error(`Nie można usunąć obszaru: posiada ${count} przypisanych wpisów.`);
  check(await client.from('areas').delete().eq('id',values.id));
 }
 revalidatePath('/admin');revalidatePath('/');return {ok:true};}catch(e){return {error:e instanceof Error?e.message:'Nie udało się zapisać ustawień.'};}
}
