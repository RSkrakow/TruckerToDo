import Link from 'next/link';
import {workspace} from '@/lib/data';
import {check} from '@/lib/validation';
import {date} from '@/lib/utils';
import {Shell} from '@/components/shell';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Card} from '@/components/ui/card';
export default async function Notes(){const{client,profile,areas}=await workspace();const notes=check(await client.from('notes_history').select('*').order('created_at',{ascending:false}).limit(200));const names:Record<string,string>={uploaded:'Czeka na analizę',processing:'Analiza w toku',review:'Do weryfikacji',approved:'Zatwierdzona',failed:'Błąd analizy'};return <Shell profile={profile} areas={areas}><div className="mb-7 flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-bold">Historia notatek</h1><p className="mt-2 text-sm text-muted-foreground">Źródła ustaleń i propozycje czekające na Twoją decyzję.</p></div><Button asChild><Link href="/notes/new">Dodaj notatkę</Link></Button></div><div className="grid gap-3">{notes.map(n=><Link key={n.id} href={`/notes/${n.id}`}><Card className="flex flex-wrap justify-between gap-3 hover:border-primary"><div><h2 className="font-semibold">{n.title}</h2><p className="mt-2 text-xs text-muted-foreground">{n.source_type.toUpperCase()} · {date(n.created_at)}{n.meeting_key?` · ${n.meeting_key}`:''}</p></div><Badge>{names[n.processing_state]}</Badge></Card></Link>)}</div>{!notes.length&&<Card className="text-center text-sm text-muted-foreground">Nie masz jeszcze notatek. Dodaj pierwszą, aby utworzyć zadania.</Card>}{notes.length===200&&<p className="mt-3 text-xs text-muted-foreground">Wyświetlono 200 najnowszych notatek.</p>}</Shell>;}
