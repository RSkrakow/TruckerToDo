import {workspace} from '@/lib/data';
import {Shell} from '@/components/shell';
import {UploadForm} from '@/components/upload-form';
export default async function NewNote(){const{profile,areas}=await workspace();return <Shell profile={profile} areas={areas}><h1 className="text-3xl font-bold">Dodaj nową notatkę</h1><p className="mb-7 mt-2 text-sm text-muted-foreground">Zachowaj źródło. Wydobądź zadania i ustalenia.</p><UploadForm/></Shell>;}
