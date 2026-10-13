import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export const statusNames: Record<string,string> = {pending_approval:'Do akceptacji',todo:'Do zrobienia',in_progress:'W trakcie',done:'Zakończone',archived:'Archiwum'};
export function date(value: string | null) { return value ? new Intl.DateTimeFormat('pl-PL',{dateStyle:'medium',timeZone:'Europe/Warsaw'}).format(new Date(value)) : '—'; }
export function timestamp(value:string){return new Intl.DateTimeFormat('pl-PL',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Warsaw'}).format(new Date(value));}
