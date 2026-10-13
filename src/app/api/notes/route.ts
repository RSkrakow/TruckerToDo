import {session} from '@/lib/supabase/server';
import {check} from '@/lib/validation';
import {z} from 'zod';
import {validateMagic} from '@/lib/domain.mjs';
export async function POST(request:Request){
 // Files upload directly to private Storage, avoiding Vercel's request-body limit.
 try{if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin'},{status:403});
 const{client,user}=await session();const body=z.object({title:z.string().trim().min(1).max(200),path:z.string().nullable(),mime:z.string().nullable(),manual_text:z.string().max(30000).nullable(),meeting_key:z.string().max(200).nullable()}).parse(await request.json());
 let source_type='manual';
 if(body.path){if(!body.path.startsWith(`${user.id}/`) || body.path.includes('..'))throw new Error('Nieprawidłowa ścieżka.');const file=check(await client.storage.from('notes').download(body.path));await validateMagic(file);source_type=file.type==='application/pdf'?'pdf':file.type.includes('wordprocessingml')?'docx':'image';}
 else if(!body.manual_text?.trim())throw new Error('Wprowadź treść notatki.');
 const note=check(await client.from('notes_history').insert({title:body.title,file_url:body.path,source_type,manual_text:body.manual_text,meeting_key:body.meeting_key}).select('id').single());return Response.json(note);
 }catch{return Response.json({error:'Nie udało się zapisać notatki. Sprawdź plik i uprawnienia.'},{status:400});}
}
