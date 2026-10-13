import {session} from '@/lib/supabase/server';
import {check} from '@/lib/validation';
import type {Area,Profile} from '@/lib/types';
export async function workspace(){const{client,user}=await session();const[profile,areas]=await Promise.all([client.from('profiles').select('*').eq('id',user.id).single(),client.from('areas').select('*').order('name')]);return {client,user,profile:check(profile) as Profile,areas:check(areas) as Area[]};}
