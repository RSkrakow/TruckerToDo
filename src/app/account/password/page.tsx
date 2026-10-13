'use client';
import {useState} from 'react';
import {browserDb} from '@/lib/supabase/client';
import {Card} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
export default function Password(){const[message,setMessage]=useState('');return <main className="mx-auto max-w-md p-6"><Card><h1 className="mb-5 text-xl font-bold">Nowe hasło</h1><form className="grid gap-4" onSubmit={async e=>{e.preventDefault();const password=String(new FormData(e.currentTarget).get('password'));const{error}=await browserDb().auth.updateUser({password});if(error)setMessage(error.message);else location.assign('/');}}><label>Hasło (minimum 8 znaków)<Input name="password" type="password" minLength={8} required autoComplete="new-password"/></label><Button>Zapisz hasło</Button>{message&&<p role="alert">{message}</p>}</form></Card></main>;}
