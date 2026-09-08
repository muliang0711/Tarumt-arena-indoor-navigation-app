from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
from pypdf import PdfReader
import json,re
path=Path('../../outputs/fyp-backend-admin-20260907/FYP Report.docx')
pdf=PdfReader('report-v4/FYP Report.pdf')
entries=json.loads(Path('toc-entries.json').read_text())
norm=lambda s:' '.join(s.split())
pages={}
for i,page in enumerate(pdf.pages):
 lines=[norm(s) for s in page.extract_text().splitlines()]
 if any(s=='Table of Contents' or 'Table of Content' in s for s in lines):continue
 printed=next((re.search(r'Software Engineering\s+(\d+)$',s).group(1) for s in lines if re.search(r'Software Engineering\s+(\d+)$',s)),str(i-6) if i>7 else str(i))
 for label,level in entries:
  needle=norm(label)
  if any(needle==line or needle==norm(' '.join(lines[j:j+2])) for j,line in enumerate(lines)) and label not in pages:pages[label]=printed
assert len(pages)==len(entries),(len(pages),[x[0] for x in entries if x[0]not in pages])
with ZipFile(path) as z:parts={n:z.read(n) for n in z.namelist()}
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';ns={'w':W};q=lambda n:'{'+W+'}'+n
r=E.fromstring(parts['word/document.xml']);body=r.find('w:body',ns)
cache=[p for p in body.findall('.//w:sdtContent/w:p',ns) if p.findall('.//w:t',ns)]
for i,((label,level),p) in enumerate(zip(entries,cache)):
 ts=p.findall('.//w:t',ns)
 for t in ts:t.text=''
 if len(ts)>=3 and re.match(r'^\d',label):ts[0].text=label.split('  ',1)[0];ts[1].text=label.split('  ',1)[1]
 else:ts[0].text=label
 ts[-1].text=pages[label]
 for tab in p.findall('w:pPr/w:tabs/w:tab',ns):
  if tab.get(q('val'))=='right':tab.set(q('leader'),'dot');tab.set(q('pos'),'9000')
  else:tab.set(q('pos'),'600')
 # Fresh bookmarks repair cached links while the outer TOC field remains intact.
 target=next(p for p in body.findall('w:p',ns) if norm(''.join(p.xpath('.//w:t/text()',namespaces=ns)))==norm(label))
 name='FYPEntry'+str(i);start=E.Element(q('bookmarkStart'));start.set(q('id'),str(1000+i));start.set(q('name'),name);end=E.Element(q('bookmarkEnd'));end.set(q('id'),str(1000+i));target.insert(1,start);target.append(end)
 for link in p.findall('.//w:hyperlink',ns):link.set(q('anchor'),name)
parts['word/document.xml']=E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True)
with ZipFile(path,'w',ZIP_DEFLATED) as z:
 for n,b in parts.items():z.writestr(n,b)
Path('final-toc-pages.json').write_text(json.dumps(pages,indent=2));print('Updated',len(pages),'cached TOC entries and links')
