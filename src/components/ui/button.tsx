import * as React from 'react';
import {Slot} from 'radix-ui';
import {cva,type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';
const variants=cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-4', {variants:{variant:{default:'bg-primary text-primary-foreground hover:opacity-90',outline:'border border-border bg-card hover:bg-accent',ghost:'hover:bg-accent',destructive:'bg-destructive text-white'},size:{default:'',sm:'h-8 px-3 text-xs',icon:'w-10 px-0'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,asChild=false,...props}:React.ComponentProps<'button'>&VariantProps<typeof variants>&{asChild?:boolean}){const Comp=asChild?Slot.Root:'button';return <Comp data-slot="button" className={cn(variants({variant,size,className}))} {...props}/>;}
