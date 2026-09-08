import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile, PresentationFile } from '@oai/artifact-tool';
const root='/Users/puihockyang/Downloads/TEMPLETE 1_2/';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(root+'Chapter Contents - Example.xlsx'));
console.log('WORKBOOK', (await wb.inspect({kind:'workbook,sheet,table',maxChars:18000,tableMaxRows:70,tableMaxCols:8})).ndjson);
for(let i=0;i<wb.worksheets.items.length;i++) {
 const s=wb.worksheets.getItemAt(i);
 console.log('SHEET',s.name, JSON.stringify(s.getUsedRange().values));
 const image=await wb.render({sheetName:s.name,range:'A1:G30',scale:1,format:'png'});
 await fs.writeFile('reference-sheet-'+i+'.png',new Uint8Array(await image.arrayBuffer()));
}
const p=await PresentationFile.importPptx(await FileBlob.load(root+'Poster Template A1 size (Project 2).pptx'));
console.log('POSTER',(await p.inspect({kind:'slide,textbox,shape,image,layout',maxChars:18000})).ndjson);
for(let i=0;i<p.slides.items.length;i++) {
 const slide=p.slides.getItem(i);
 const im=await p.export({slide,format:'png',scale:.5});
 await fs.writeFile('reference-poster-'+i+'.png',new Uint8Array(await im.arrayBuffer()));
 await fs.writeFile('reference-poster-'+i+'.json',await (await slide.export({format:'layout'})).text());
}
