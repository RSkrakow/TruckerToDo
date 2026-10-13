import type {Metadata,Viewport} from 'next';
import './globals.css';
import {Pwa} from '@/components/pwa';
export const metadata:Metadata={title:{default:'Tracker To Do',template:'%s · Tracker To Do'},description:'Zadania i ustalenia, które nie giną w notatkach.',appleWebApp:{capable:true,statusBarStyle:'default',title:'Tracker To Do'},icons:{apple:'/icons/icon-192.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#126958'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pl"><body>{children}<Pwa/></body></html>;}
