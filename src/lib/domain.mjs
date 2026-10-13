export function normalizeTitle(title){return title.trim().toLowerCase().replace(/\s+/g,' ');}
export function exactDuplicate(candidate,items){return items.find(item=>item.area_id===candidate.area_id && item.type===candidate.type && normalizeTitle(item.title)===normalizeTitle(candidate.title)) || null;}
export function validateFile(file){
 const types={'image/jpeg':'jpg','image/png':'png','application/pdf':'pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx'};
 if(!types[file.type])throw new Error('Obsługiwane pliki: JPG, PNG, PDF i DOCX.');
 if(file.size>15*1024*1024 || file.size===0)throw new Error('Plik musi mieć od 1 bajta do 15 MB.');
 return types[file.type];
}
export async function validateMagic(file){
 validateFile(file);
 const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
 const starts=(expected)=>expected.every((b,i)=>bytes[i]===b);
 const valid=file.type==='image/jpeg'?starts([255,216,255]):file.type==='image/png'?starts([137,80,78,71,13,10,26,10]):file.type==='application/pdf'?starts([37,80,68,70,45]):starts([80,75,3,4]);
 if(!valid)throw new Error('Zawartość pliku nie odpowiada wybranemu formatowi.');
}
