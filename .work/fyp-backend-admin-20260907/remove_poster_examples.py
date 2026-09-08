from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
from pathlib import Path
src=Path('/Users/puihockyang/Downloads/TEMPLETE 1_2/Poster Template A1 size (Project 2).pptx')
ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main'}
with ZipFile(src) as z:parts={n:z.read(n) for n in z.namelist()}
r=E.fromstring(parts['ppt/slides/slide1.xml']);removed=[]
for el in r.findall('.//p:graphicFrame',ns):
 name=el.find('p:nvGraphicFramePr/p:cNvPr',ns).get('name')
 if name in ['Table 1','Chart 21']:removed.append(name);el.getparent().remove(el)
assert set(removed)=={'Table 1','Chart 21'}
parts['ppt/slides/slide1.xml']=E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True)
with ZipFile('poster-editable-base.pptx','w',ZIP_DEFLATED) as z:
 for n,b in parts.items():z.writestr(n,b)
p=E.fromstring(parts['ppt/presentation.xml']);size=p.find('p:sldSz',ns)
Path('poster-size.txt').write_text(size.get('cx')+','+size.get('cy'))
print('Removed only template example frames',removed,'dimensions',size.attrib)
