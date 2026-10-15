'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Pencil,Trash2,X,Check} from 'lucide-react';
import type {Area,Profile} from '@/lib/types';
import {adminUpdate} from '@/app/actions';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Badge} from '@/components/ui/badge';
import {Field,Select} from '@/components/ui/fields';

export function AdminPanel({people,areas,memberships}:{people:Profile[];areas:Area[];memberships:{area_id:string;user_id:string}[]}){
 const router=useRouter();
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const[editingArea,setEditingArea]=useState<{id:string;name:string;description:string;color_code:string}|null>(null);

 async function save(input:unknown){
  setBusy(true);
  setError('');
  const result=await adminUpdate(input);
  if(result.error){
   setError(result.error);
  }else{
   setEditingArea(null);
   router.refresh();
  }
  setBusy(false);
 }

 return (
  <div className="grid gap-6">
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-destructive">{error}</p>}

   <Card>
    <h2 className="mb-5 font-semibold">Członkowie zespołu</h2>
    <p className="mb-5 text-sm text-muted-foreground">Nowi użytkownicy muszą najpierw utworzyć konto lub zalogować się przez Microsoft.</p>
    <div className="grid gap-6">
     {people.map(p=>(
      <div key={p.id} className="border-t border-border pt-4">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
         <h3 className="text-sm font-semibold">{p.full_name||p.email}</h3>
         <p className="mt-1 text-xs text-muted-foreground">{p.email}</p>
        </div>
        <Select className="max-w-44" aria-label={`Rola ${p.full_name||p.email}`} value={p.role} disabled={busy} onChange={e=>save({kind:'role',user_id:p.id,role:e.target.value})}>
         <option value="member">Member</option>
         <option value="manager">Manager</option>
         <option value="admin">Admin</option>
        </Select>
       </div>
       <div className="mt-3 flex flex-wrap gap-3">
        {areas.map(a=>(
         <label key={a.id} className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={memberships.some(m=>m.area_id===a.id&&m.user_id===p.id)} disabled={busy} onChange={e=>save({kind:'membership',user_id:p.id,area_id:a.id,remove:!e.target.checked})}/>
          <span className="h-2 w-2 rounded-full" style={{background:a.color_code}}/>
          {a.name}
         </label>
        ))}
       </div>
      </div>
     ))}
    </div>
   </Card>

   <Card>
    <div className="mb-4 flex items-center justify-between">
     <div>
      <h2 className="font-semibold">Lista obszarów</h2>
      <p className="mt-1 text-sm text-muted-foreground">Możesz edytować nazwę lub usunąć obszar (jeśli nie zawiera przypisanych zadań).</p>
     </div>
     <Badge>{areas.length} obszarów</Badge>
    </div>

    <div className="divide-y divide-border">
     {areas.map(a=>{
      const isEditing = editingArea?.id === a.id;
      const count = memberships.filter(m => m.area_id === a.id).length;
      return (
       <div key={a.id} className="py-3">
        {isEditing ? (
         <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_90px_auto] sm:items-end"
          onSubmit={e=>{
           e.preventDefault();
           save({
            kind: 'update_area',
            id: a.id,
            name: editingArea.name,
            description: editingArea.description,
            color_code: editingArea.color_code
           });
          }}
         >
          <Field label="Nazwa obszaru">
           <Input
            value={editingArea.name}
            onChange={e=>setEditingArea({...editingArea, name: e.target.value})}
            required
            maxLength={100}
            disabled={busy}
           />
          </Field>
          <Field label="Opis">
           <Input
            value={editingArea.description}
            onChange={e=>setEditingArea({...editingArea, description: e.target.value})}
            maxLength={1000}
            disabled={busy}
           />
          </Field>
          <Field label="Kolor">
           <Input
            type="color"
            value={editingArea.color_code}
            onChange={e=>setEditingArea({...editingArea, color_code: e.target.value})}
            disabled={busy}
           />
          </Field>
          <div className="flex gap-2">
           <Button type="submit" size="sm" disabled={busy || !editingArea.name.trim()}>
            <Check size={14} className="mr-1"/> Zapisz
           </Button>
           <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>setEditingArea(null)}>
            <X size={14} className="mr-1"/> Anuluj
           </Button>
          </div>
         </form>
        ) : (
         <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
           <span className="h-3 w-3 rounded-full shrink-0" style={{background: a.color_code}}/>
           <div>
            <div className="flex items-center gap-2">
             <h3 className="text-sm font-semibold">{a.name}</h3>
             <span className="text-xs text-muted-foreground">({count} {count===1?'osoba':'osób'})</span>
            </div>
            {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
           </div>
          </div>
          <div className="flex items-center gap-2">
           <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={()=>setEditingArea({id: a.id, name: a.name, description: a.description||'', color_code: a.color_code})}
           >
            <Pencil size={13} className="mr-1"/> Zmień nazwę
           </Button>
           <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-red-50"
            disabled={busy}
            onClick={()=>{
             if(window.confirm(`Czy na pewno chcesz usunąć obszar "${a.name}"?`)){
              save({kind: 'delete_area', id: a.id});
             }
            }}
           >
            <Trash2 size={13} className="mr-1"/> Usuń
           </Button>
          </div>
         </div>
        )}
       </div>
      );
     })}
     {!areas.length && (
      <p className="py-4 text-center text-sm text-muted-foreground">Brak utworzonych obszarów.</p>
     )}
    </div>
   </Card>

   <Card>
    <h2 className="mb-5 font-semibold">Dodaj nowy obszar</h2>
    <form
     className="grid gap-4 sm:grid-cols-[1fr_1fr_100px_auto]"
     onSubmit={e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget);
      const formEl=e.currentTarget;
      save({
       kind:'area',
       name:String(f.get('name')),
       description:String(f.get('description')||''),
       color_code:String(f.get('color')||'#126958')
      });
      formEl.reset();
     }}
    >
     <Field label="Nazwa"><Input name="name" required maxLength={100}/></Field>
     <Field label="Opis"><Input name="description" maxLength={1000}/></Field>
     <Field label="Kolor"><Input name="color" type="color" defaultValue="#126958"/></Field>
     <Button disabled={busy} className="self-end">Dodaj obszar</Button>
    </form>
   </Card>
  </div>
 );
}
