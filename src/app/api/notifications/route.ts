import {timingSafeEqual} from 'node:crypto';
import {dispatchNotifications} from '@/lib/teams';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){const expected=process.env.CRON_SECRET;const supplied=request.headers.get('authorization')||'';const target=`Bearer ${expected}`;if(!expected || Buffer.byteLength(supplied)!==Buffer.byteLength(target) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(target)))return Response.json({error:'Unauthorized'},{status:401});try{return Response.json(await dispatchNotifications());}catch{return Response.json({error:'Notification delivery failed'},{status:503});}}
