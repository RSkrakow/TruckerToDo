import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {statusNames} from '@/lib/utils';
export async function dispatchNotifications(){
 if(!process.env.TEAMS_WEBHOOK_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)return {configured:false,sent:0,failed:0};
 const endpoint=new URL(process.env.TEAMS_WEBHOOK_URL);
 if(endpoint.protocol!=='https:')throw new Error('Teams webhook requires HTTPS');
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:jobs,error}=await client.rpc('claim_notifications');if(error)throw new Error('Cannot claim notifications');
 let sent=0,failed=0;
 for(const job of jobs||[]){
  const p=job.payload;
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',contentUrl:null,content:{$schema:'http://adaptivecards.io/schemas/adaptive-card.json',type:'AdaptiveCard',version:'1.4',body:[{type:'TextBlock',weight:'Bolder',text:`Tracker To Do · ${p.event}`},{type:'TextBlock',text:p.title,wrap:true},{type:'TextBlock',text:`Status: ${statusNames[p.status]||p.status} · Termin: ${p.due_date||'nie ustalono'}`,wrap:true},{type:'TextBlock',text:`Id zdarzenia: ${job.id}`,isSubtle:true,wrap:true}],actions:[{type:'Action.OpenUrl',title:'Otwórz zadanie',url:`${process.env.NEXT_PUBLIC_APP_URL}/items/${p.id}`}]} }]})});
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const {error:e}=await client.from('notification_outbox').update({delivered_at:new Date().toISOString(),lease_until:null,last_error:null}).eq('id',job.id);if(e)throw new Error('Delivery acknowledgement failed');sent++;
  }catch(err){failed++;await client.from('notification_outbox').update({lease_until:null,last_error:err instanceof Error?err.message.slice(0,160):'Delivery error',next_attempt_at:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts,7))).toISOString()}).eq('id',job.id);}
 }
 return {configured:true,sent,failed};
}
