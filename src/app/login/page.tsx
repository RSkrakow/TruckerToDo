import {LoginForm} from '@/components/login-form';
import {configured} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export default async function Login(){if(!configured())redirect('/setup');return <main className="grid min-h-screen place-items-center p-6"><LoginForm/></main>;}
