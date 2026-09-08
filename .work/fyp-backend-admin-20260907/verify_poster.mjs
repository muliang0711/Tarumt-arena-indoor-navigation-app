import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('../../outputs/fyp-backend-admin-20260907/A1 Poster.pptx'));
const s=p.slides.getItem(0);
const blob=await p.export({slide:s,format:'png',scale:1});
await fs.writeFile('poster-verified.png',new Uint8Array(await blob.arrayBuffer()));
console.log((await p.inspect({kind:'slide,textbox',maxChars:1000})).ndjson);
