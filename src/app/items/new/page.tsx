import {workspace} from '@/lib/data';
import {check} from '@/lib/validation';
import {Shell} from '@/components/shell';
import {ItemForm} from '@/components/item-form';
export default async function NewItem(){const{client,profile,areas}=await workspace();const[people,memberships]=await Promise.all([client.from('profiles').select('*'),client.from('area_members').select('*')]);return <Shell profile={profile} areas={areas}><h1 className="mb-2 text-3xl font-bold">Nowy wpis</h1><p className="mb-7 text-sm text-muted-foreground">Zapisz zadanie lub ustalenie bez notatki źródłowej.</p><div className="max-w-3xl"><ItemForm areas={areas} people={check(people)} memberships={check(memberships)}/></div></Shell>;}
