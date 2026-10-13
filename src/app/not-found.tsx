import Link from 'next/link';
export default function NotFound(){return <main className="p-10"><h1 className="text-2xl font-bold">Nie znaleziono wpisu</h1><p className="my-4">Wpis nie istnieje lub nie masz do niego dostępu.</p><Link href="/" className="text-primary">Wróć do Trackera</Link></main>;}
