import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTitle,exactDuplicate,validateFile,validateMagic} from '../src/lib/domain.mjs';
test('duplicate suggestions match whitespace/case but never cross areas or task/info',()=>{
 const candidate={title:'  Zamówić   części  ',area_id:'workshop',type:'task'};
 const items=[{id:'finance',title:'zamówić części',area_id:'finance',type:'task'},{id:'information',title:'zamówić części',area_id:'workshop',type:'info'},{id:'correct',title:'ZAMÓWIĆ CZĘŚCI',area_id:'workshop',type:'task'}];
 assert.equal(exactDuplicate(candidate,items)?.id,'correct');assert.equal(exactDuplicate({...candidate,title:'Nowe zadanie'},items),null);
 assert.equal(normalizeTitle('  Spotkanie\n\tzespołu '),'spotkanie zespołu');
});
test('MIME masquerading cannot upload HTML as an image or PDF',async()=>{
 await assert.rejects(validateMagic(new Blob(['<html>payload</html>'],{type:'image/png'})));
 await assert.rejects(validateMagic(new Blob(['<script>alert(1)</script>'],{type:'application/pdf'})));
 await validateMagic(new Blob([new Uint8Array([255,216,255,224,0,16])],{type:'image/jpeg'}));
 await validateMagic(new Blob(['%PDF-1.7\n'],{type:'application/pdf'}));
});
test('uploads reject empty, oversized, and unapproved document types',()=>{
 assert.equal(validateFile({type:'image/jpeg',size:15*1024*1024}),'jpg');
 assert.equal(validateFile({type:'application/pdf',size:1024}),'pdf');
 for(const file of [{type:'image/jpeg',size:0},{type:'image/png',size:15*1024*1024+1},{type:'text/html',size:200},{type:'image/svg+xml',size:200},{type:'application/msword',size:200}])assert.throws(()=>validateFile(file));
});
