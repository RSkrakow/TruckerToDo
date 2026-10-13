import {z} from 'zod';
export const itemInput=z.object({title:z.string().trim().min(1).max(300),description:z.string().max(10000).default(''),type:z.enum(['task','info']),area_id:z.uuid(),assigned_to:z.union([z.uuid(),z.literal(''),z.null()]).transform(v=>v||null),due_date:z.union([z.iso.date(),z.literal(''),z.null()]).transform(v=>v||null)});
export const decisionInput=itemInput.omit({type:true}).extend({id:z.uuid(),mode:z.enum(['add','link','skip']),duplicate_id:z.union([z.uuid(),z.literal(''),z.null()]).transform(v=>v||null)});
export const aiCandidate=itemInput.extend({duplicate_id:z.uuid().nullable(),duplicate_reason:z.string().max(1000).nullable()});
export function check<T>(result:{data:T;error:{message:string}|null}):NonNullable<T> {if(result.error)throw new Error(result.error.message);return result.data as NonNullable<T>;}
