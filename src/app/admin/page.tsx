import {redirect} from 'next/navigation';
import {workspace} from '@/lib/data';
import {check} from '@/lib/validation';
import {Shell} from '@/components/shell';
import {AdminPanel} from '@/components/admin-panel';
export default async function Admin(){const{client,profile,areas}=await workspace();if(profile.role!=='admin')redirect('/');const[people,memberships]=await Promise.all([client.from('profiles').select('*').order('created_at'),client.from('area_members').select('*')]);return <Shell profile={profile} areas={areas}><h1 className="text-3xl font-bold">Zespół i obszary</h1><p className="mb-7 mt-2 text-sm text-muted-foreground">Zarządzaj dostępem do zadań i informacji.</p><AdminPanel people={check(people)} areas={areas} memberships={check(memberships)}/></Shell>;}
