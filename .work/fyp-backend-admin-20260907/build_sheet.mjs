import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const d=JSON.parse(await fs.readFile('content.json','utf8'));
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('/Users/puihockyang/Downloads/TEMPLETE 1_2/Chapter Contents - Example.xlsx'));
const s=wb.worksheets.getItemAt(0);
s.getRange('A1').values=[[d.title]];
s.getRange('A2').values=[['Pui Hock Yang  24WMR01790  |  Software Engineering  |  Outline adapted from fyp_docs_only/modify']];
s.getRange('A1:C1').merge();s.getRange('A2:C2').merge();
s.getRange('A1:C2').format.wrapText=true;
s.getRange('A1:C3').format.borders={preset:'none'};
s.getRange('A1:C1').format.rowHeight=36;s.getRange('A2:C2').format.rowHeight=30;
s.getRange('A1:C2').format.font.color='#000000';
s.getRange('A1:C1').format.font.size=13;
s.getRange('A2:C2').format.font.size=10;
s.getRange('C5:C46').format.wrapText=true;
s.getRange('A5:C46').format.rowHeight=30;
s.getRange('A5:C46').format.verticalAlignment='center';
s.getRange('B5:B46').format.wrapText=true;
s.getRange('A:A').format.columnWidthPx=85;s.getRange('B:B').format.columnWidthPx=310;s.getRange('C:C').format.columnWidthPx=430;
const groups=[[5,10],[11,16],[17,21],[22,30],[31,36],[37,40],[41,46]];
d.chapters.forEach((ch,i)=>{
 const [a,b]=groups[i];
 s.getRange(`B${a}`).values=[[ch.title]];
 if(ch.sections.length!==b-a+1)throw Error('Outline mismatch');
 s.getRange(`C${a}:C${b}`).values=ch.sections.map((section,j)=>[`${i+1}.${j+1} ${section.title}`]);
});
console.log((await wb.inspect({kind:'table',range:'Sheet1!A1:C46',include:'values,formulas',tableMaxRows:46,tableMaxCols:3,maxChars:9000})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',options:{useRegex:true,maxResults:20}})).ndjson);
for(const [i,range] of ['A1:C21','A22:C46'].entries()){
 const blob=await wb.render({sheetName:s.name,range,scale:1.5,format:'png'});await fs.writeFile(`sheet-final-${i}.png`,new Uint8Array(await blob.arrayBuffer()));
}
await (await SpreadsheetFile.exportXlsx(wb)).save('../../outputs/fyp-backend-admin-20260907/Chapter Contents.xlsx');
