// Reproducible, dependency-free PNG assets for the PWA manifest.
import {deflateSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([name,data])),data.length+8);return out;}
function segment(x,y,ax,ay,bx,by){const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(x-(ax+t*(bx-ax)),y-(ay+t*(by-ay)));}
mkdirSync(new URL('../public/icons/',import.meta.url),{recursive:true});
for(const size of [192,512]){const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*(size*4+1)+1+x*4;const u=x/size,v=y/size;const tick=Math.min(segment(u,v,.25,.51,.43,.69),segment(u,v,.43,.69,.76,.32))<.043;raw[i]=tick?255:18;raw[i+1]=tick?255:105;raw[i+2]=tick?255:88;raw[i+3]=255;}const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;writeFileSync(new URL(`../public/icons/icon-${size}.png`,import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
