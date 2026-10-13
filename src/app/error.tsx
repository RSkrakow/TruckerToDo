'use client';
import {Button} from '@/components/ui/button';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="mx-auto max-w-xl p-10"><h1 className="text-2xl font-bold">Nie udało się załadować widoku</h1><p className="my-4 text-muted-foreground">Sprawdź połączenie i konfigurację bazy danych. Jeśli problem się powtarza, skontaktuj się z administratorem.</p><Button onClick={reset}>Spróbuj ponownie</Button></main>;}
