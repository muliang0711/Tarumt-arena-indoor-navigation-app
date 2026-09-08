import {FileBlob,PresentationFile} from '@oai/artifact-tool';
const p=await PresentationFile.importPptx(await FileBlob.load('/Users/puihockyang/Downloads/TEMPLETE 1_2/Poster Template A1 size (Project 2).pptx'));
console.log(p.help('*',{search:'slide.tables|slide.charts|deleteAll|remove',include:['index','examples','notes'],maxChars:6500}).ndjson);
