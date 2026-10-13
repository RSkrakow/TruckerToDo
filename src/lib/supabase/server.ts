import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export const configured = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export async function db() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>jar.getAll(),setAll(values){try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Proxy refreshes cookies for Server Components. */}}}
  });
}
export async function session() {
  if(!configured()) redirect('/setup');
  const client = await db();
  const {data:{user},error} = await client.auth.getUser();
  if(error || !user) redirect('/login');
  return {client,user};
}
