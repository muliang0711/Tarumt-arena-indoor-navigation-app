from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from docx import Document
import json,hashlib
root=Path('/Users/puihockyang/Downloads/TEMPLETE 1_2')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
out={}
for path in root.glob('*'):
 if path.suffix not in ('.docx','.pptx','.xlsx'): continue
 with ZipFile(path) as z:
  item={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'parts':{n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}}
  if path.suffix=='.docx':
   d=Document(path)
   item['sections']=[{'width':s.page_width,'height':s.page_height,'margins':[s.top_margin,s.right_margin,s.bottom_margin,s.left_margin],'header':s.header_distance,'footer':s.footer_distance,'type':str(s.start_type)} for s in d.sections]
   item['paragraphs']=[{'i':i,'text':p.text,'style':p.style.name,'xml':p._p.xml} for i,p in enumerate(d.paragraphs)]
   item['styles']={s.name:s.element.xml for s in d.styles if s.name in ['Normal','Title','Heading 1','Heading 2','Heading 3','TOC 1','TOC 2']}
   item['body_elements']=[{'i':i,'tag':E.QName(el).localname,'text':''.join(el.xpath('.//w:t/text()',namespaces=ns))[:120],'section':bool(el.xpath('.//w:sectPr',namespaces=ns))} for i,el in enumerate(E.fromstring(z.read('word/document.xml')).find('w:body',ns))]
  out[path.name]=item
Path('template-audit.json').write_text(json.dumps(out,indent=2))
for k,v in out.items():
 print(k,v['sha256'])
 if 'sections'in v: print('SECTIONS',v['sections']);print('STYLES',v['styles']); print('BOUNDARIES',[x for x in v['body_elements'] if x['section'] or x['tag']!='p'])
