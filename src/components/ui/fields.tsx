import type {ComponentProps,ReactNode} from 'react';
import {cn} from '@/lib/utils';
export function Select({className,...props}:ComponentProps<'select'>){return <select className={cn('h-10 w-full rounded-lg border border-input bg-background px-3 text-sm',className)} {...props}/>;}
export function Textarea({className,...props}:ComponentProps<'textarea'>){return <textarea className={cn('w-full min-h-24 rounded-lg border border-input bg-background p-3 text-sm',className)} {...props}/>;}
export function Field({label,children}: {label:string;children:ReactNode}){return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>;}
