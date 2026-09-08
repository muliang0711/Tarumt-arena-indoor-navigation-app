from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E
from copy import deepcopy as C
import json,hashlib

ROOT=Path('/Users/puihockyang/Downloads/TEMPLETE 1_2')
OUT=Path('../../outputs/fyp-backend-admin-20260907')
D=json.loads(Path('content.json').read_text())
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ns={'w':W}
def q(n): return '{'+W+'}'+n
def sub(el,n,**attrs):
 x=E.SubElement(el,q(n))
 for k,v in attrs.items(): x.set(q(k),str(v))
 return x
def settext(el,text):
 ts=el.findall('.//w:t',ns)
 if not ts:
  target=el if el.tag==q('p') else el.find('w:p',ns)
  if target is None:target=sub(el,'p')
  ts=[sub(sub(target,'r'),'t')]
 ts[0].text=text; ts[0].set('{http://www.w3.org/XML/1998/namespace}space','preserve')
 for t in ts[1:]: t.text=''
def pr(p):
 x=p.find('w:pPr',ns)
 if x is None: x=E.Element(q('pPr'));p.insert(0,x)
 return x
def prop(p,n,**attrs):
 pp=pr(p);old=pp.find('w:'+n,ns)
 if old is not None: pp.remove(old)
 return sub(pp,n,**attrs)
def format_runs(p,size=None,font=None):
 for r in p.findall('.//w:r',ns):
  rp=r.find('w:rPr',ns)
  if rp is None:rp=E.Element(q('rPr'));r.insert(0,rp)
  for n,attrs in [('color',{'val':'000000'})]+([('sz',{'val':size*2}),('szCs',{'val':size*2})] if size else [])+([('rFonts',{'ascii':font,'hAnsi':font})] if font else []):
   for x in rp.findall('w:'+n,ns):rp.remove(x)
   sub(rp,n,**attrs)
def xml(root): return E.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
def load(name):
 with ZipFile(ROOT/name) as z:return {n:z.read(n) for n in z.namelist()}
def save(parts,name,source):
 OUT.mkdir(parents=True,exist_ok=True)
 with ZipFile(OUT/name,'w',ZIP_DEFLATED) as z:
  for n,b in parts.items():z.writestr(n,b)
 original=load(source)
 changed=[n for n in parts if parts[n]!=original.get(n)]
 allowed=lambda n:n=='word/document.xml' or n=='word/settings.xml' or n.startswith('word/header') or n.startswith('word/footer')
 assert all(allowed(n) for n in changed),changed
 print(name,'changed parts',changed)

source='FYP Report Template (updated 2.7.25).docx'
parts=load(source);root=E.fromstring(parts['word/document.xml']);body=root.find('w:body',ns);ps=body.findall('w:p',ns)
body_proto=C(ps[117]);h2_proto=C(ps[119])
def para(text,style=None):
 p=C(body_proto);p.attrib.clear()
 for x in list(p):
  if x.tag!=q('pPr'):p.remove(x)
 pp=pr(p)
 for x in list(pp):
  if x.tag in [q('sectPr'),q('numPr'),q('rPr'),q('pBdr')]:pp.remove(x)
 r=sub(p,'r');rp=sub(r,'rPr');sub(rp,'rFonts',ascii='Times New Roman',hAnsi='Times New Roman');sub(rp,'sz',val=22);sub(rp,'color',val='000000');sub(r,'t').text=text
 prop(p,'ind',left=432);prop(p,'spacing',after=120,line=360,lineRule='auto')
 if style:
  prop(p,'pStyle',val=style);prop(p,'ind',left=0);prop(p,'keepNext',val=1);prop(p,'keepLines',val=1);prop(p,'spacing',before=240,after=120)
  format_runs(p,14 if style=='Heading2' else 12,'Arial');sub(rp,'b')
 return p
def replace_range(start,end,nodes):
 a=body.index(start);b=body.index(end)
 sections=[C(s) for el in list(body)[a:b+1] for s in el.findall('.//w:sectPr',ns)]
 assert len(sections)<=1
 if sections:pr(nodes[-1]).append(sections[0])
 for el in list(body)[a:b+1]:body.remove(el)
 for i,node in enumerate(nodes):body.insert(a+i,node)
def table(rows,widths):
 t=E.Element(q('tbl'));tp=sub(t,'tblPr');sub(tp,'tblW',w=sum(widths),type='dxa');b=sub(tp,'tblBorders')
 for edge in ['top','left','bottom','right','insideH','insideV']:sub(b,edge,val='single',sz=4,color='BFBFBF')
 mar=sub(tp,'tblCellMar')
 for edge in ['top','left','bottom','right']:sub(mar,edge,w=90,type='dxa')
 grid=sub(t,'tblGrid')
 for width in widths:sub(grid,'gridCol',w=width)
 for i,row in enumerate(rows):
  tr=sub(t,'tr');trp=sub(tr,'trPr');sub(trp,'cantSplit')
  if i==0:sub(trp,'tblHeader')
  for val,width in zip(row,widths):
   tc=sub(tr,'tc');tcp=sub(tc,'tcPr');sub(tcp,'tcW',w=width,type='dxa');sub(tcp,'vAlign',val='center')
   if i==0:sub(tcp,'shd',fill='E7E6E6')
   p=para(val);prop(p,'ind',left=0);prop(p,'jc',val='left');prop(p,'spacing',after=0,line=240,lineRule='auto');format_runs(p,10)
   if i==0:sub(p.find('w:r/w:rPr',ns),'b')
   tc.append(p)
 return t
def caption(text):
 p=para(text);prop(p,'jc',val='center');prop(p,'keepNext');prop(p,'ind',left=0);format_runs(p,10);return p

# Confirmed identity and retained cover furniture.
for i,text in {4:D['title'],37:D['title'],13:D['name'],41:D['name'],87:D['name'],44:'Supervisor: '+D['supervisor'],51:D['course'],88:D['course'],89:'ID: '+D['id'],288:'Chapter 6'}.items():settext(ps[i],text);format_runs(ps[i])
for i in [4,37]:prop(ps[i],'pStyle',val='Title');format_runs(ps[i],22 if i==4 else 18,'Arial')
format_runs(ps[44],14)
# Recover room for the multi-line title within original cover slots.
for i in list(range(0,4))+list(range(5,9))+list(range(34,37)):
 if not ''.join(ps[i].itertext()).strip() and not ps[i].findall('.//w:br',ns):prop(ps[i],'spacing',before=0,after=0,line=100,lineRule='exact')
format_runs(ps[290],26,'Arial')
replace_range(ps[92],ps[99],[para(D['abstract'])])
replace_range(ps[101],ps[101],[para('I acknowledge Prof. Ts. Dr. Tew Yiqi as the supervisor of this project and thank the Faculty of Computing and Information Technology at Tunku Abdul Rahman University of Management and Technology for the academic setting in which this work is presented. I also acknowledge the maintainers of the open-source tools and the shared Campus Navigator resources used by this implementation. Their contributions are identified where relevant in this report.')])

ranges=[(117,152),(167,183),(197,206),(220,234),(248,278),(292,306),(325,341)]
heading_indices=[116,166,196,219,247,291,324]
toc=[('Abstract',0),('Acknowledgement',0)]
for ci,(chapter,(a,b),hi) in enumerate(zip(D['chapters'],ranges,heading_indices),1):
 settext(ps[hi],str(ci)+'  '+chapter['title']);prop(ps[hi],'numPr');sub(pr(ps[hi]).find('w:numPr',ns),'numId',val=0)
 toc.append((str(ci)+'  '+chapter['title'],0));nodes=[para(chapter['intro'])]
 for si,s in enumerate(chapter['sections'],1):
  heading=f'{ci}.{si}  '+s['title'];toc.append((heading,1));nodes.append(para(heading,'Heading2'))
  nodes.extend(para(p) for p in s['body'])
  if ci==4 and si==1:
   nodes.extend([para('Table 4.1 summarises the responsibility and data boundary of each main component.'),caption('Table 4.1  Responsibilities of the main components'),table([['Component','Responsibility','Data boundary'],['Presence Gateway','Sessions and live snapshots','Current eligible actors'],['Trajectory Worker','Stream consumption and insertion','Events in transit'],['Analytics API','Period summaries and rankings','Historical journey records'],['Admin web','Two pages and same-origin proxies','Read-only presentation']],[2200,3500,2800])])
  if ci==5 and si==5:
   nodes.extend([para('Table 5.1 separates the recorded local outcomes from the checks that remain outstanding.'),caption('Table 5.1  Verification scope and recorded outcomes'),table([['Case','Expected behaviour','Recorded outcome'],['Live population','100 unique named sessions','Verified locally'],['Movement','Positions change between reads','Verified locally'],['Display limits','10 / 20 / 30 / All markers','Verified locally'],['Coordinates','Shared origin and interpolation','Three checks passed'],['Web pages','Both administration routes render','Two checks passed'],['Cloud release','DNS, TLS and public APIs work','Not yet executed'],['Field accuracy','Compare with physical ground truth','Not evaluated']],[1800,4000,2700])])
 replace_range(ps[a],ps[b],nodes)

replace_range(ps[343],ps[349],[para(x) for x in D['references']])
appendix=[para('Appendix A  Local Operator Guide','Heading2'),para('From the repository tarumt-nav-app directory, run bash dev/admin-local.sh up. With the stack running, execute node dev/verify-admin-local.mjs. Docker must be available, and the required local ports must be free. These commands start the demonstration and verify backend data; they are not cloud deployment commands.'),para('Open http://localhost:3100 for the dashboard and http://localhost:3100/live for the map. On the dashboard, choose today or this week and interpret totals as navigation starts, not distinct people. On the map, choose 10, 20, 30 or All, then pan or zoom as needed. A smaller display limit does not stop the other sessions from reporting.'),para('The demonstration uses synthetic Walker names and has no administrator password. If the interface shows a backend error, inspect the local container logs and service configuration rather than treating the screen as an empty but healthy dataset. Stop the local stack using the documented dev/admin-local.sh command when it is no longer required.'),para('Appendix B  Developer and Deployment Guide','Heading2'),para('The service entry points are services/presence-gateway, services/trajectory-worker and services/analytics-api. The administration code is in admin-web. Coordinate behaviour is isolated in app/map-coordinates.mjs, and scripts/sync-campus.mjs generates the shared catalog and surface metadata. Tests are located in admin-web/tests and the service test files.'),para('The web server requires PRESENCE_API_BASE_URL and ANALYTICS_API_BASE_URL. In Docker these resolve to the private service addresses described in Chapter 6. Do not put database credentials or DNS tokens in browser code. Do not replace the real proxy handlers with static sample responses for a deployment demonstration.'),para('For Google Cloud, use docs/operations/google-cloud-deployment.md and deploy/FRONTEND-GCP.md. The frontend entry point is deploy/gcp/deploy-frontend.sh. Its --plan option previews the intended operation. The actual run needs an already deployed backend, an owned DuckDNS name, the reserved IP and the token supplied securely at the prompt.'),para('Appendix C  Evidence and Scope Notes','Heading2'),para('The chapter structure is adapted from the project documentation in fyp_docs_only/modify. Technical descriptions are grounded in the Go services, administration source, map resources, Compose definitions and verification scripts. The local outcomes in Chapter 5 refer to the earlier implementation verification, not a new benchmark performed while preparing this report. No participant survey, cloud public address, measured positioning accuracy or maximum supported user count is asserted.')]
last=body[-1]
settext(appendix[-1],'The outline follows fyp_docs_only/modify. Implementation evidence comes from the service source, administration code, Compose definitions and verification scripts. Chapter 5 records earlier local synthetic checks, not a new benchmark. No real-participant study, cloud address, physical accuracy result or maximum capacity is asserted.')
for p in appendix:
 if pr(p).find('w:pStyle',ns) is None:prop(p,'spacing',after=100,line=300,lineRule='auto')
replace_range(ps[351],body[-2],appendix)
toc.extend([('References',0),('Appendices',0)])

# Preserve the rich TOC control and all field/run structure; update cache text only.
sdt=body.find('w:sdt',ns);entries=sdt.findall('.//w:sdtContent/w:p',ns)
cache=[]
for p in entries:
 ts=p.findall('.//w:t',ns)
 if ts:cache.append((p,ts))
print('TOC slots',len(cache),'entries',len(toc))
assert len(toc)<=len(cache)
for i,(p,ts) in enumerate(cache):
 for t in ts:t.text=''
 if i<len(toc):
  label,level=toc[i];ts[0].text=label
  if len(ts)>1:ts[-1].text=''
  prop(p,'spacing',before=0,after=40,line=260,lineRule='auto');prop(p,'ind',left=240 if level else 0,hanging=0);prop(p,'keepNext',val=0)
  for r in p.findall('.//w:r',ns):
   rp=r.find('w:rPr',ns)
   if rp is None:rp=sub(r,'rPr')
   for x in rp.findall('w:b',ns):rp.remove(x)
   sub(rp,'b',val=0 if level else 1)
  format_runs(p,11,'Times New Roman')
 # Keep rich SDT structure unchanged; Word will rebuild the field cache.
Path('toc-entries.json').write_text(json.dumps(toc))

assert len(root.findall('.//w:sectPr',ns))==14
# Canonical property order keeps Word and the packaged renderer consistent.
order=['pStyle','keepNext','keepLines','pageBreakBefore','framePr','widowControl','numPr','suppressLineNumbers','pBdr','shd','tabs','suppressAutoHyphens','kinsoku','wordWrap','overflowPunct','topLinePunct','autoSpaceDE','autoSpaceDN','bidi','adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents','suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap','outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange']
for pp in root.findall('.//w:pPr',ns):
 pp[:]=sorted(pp,key=lambda x:order.index(E.QName(x).localname) if E.QName(x).localname in order else 99)
parts['word/document.xml']=xml(root)
settings=E.fromstring(parts['word/settings.xml']);old=settings.find('w:updateFields',ns)
if old is None:sub(settings,'updateFields',val='true')
else:old.set(q('val'),'true')
parts['word/settings.xml']=xml(settings)
for n,b in list(parts.items()):
 if n.startswith(('word/header','word/footer')) and n.endswith('.xml'):
  r=E.fromstring(b);changed=False
  for t in r.findall('.//w:t',ns):
   if t.text and ('Project Title'in t.text or 'BMCS3413'in t.text):t.text=t.text.replace('Project Title','Campus Navigator').replace('BMCS3413 Project II','Software Engineering');changed=True
  if changed:parts[n]=xml(r)
save(parts,'FYP Report.docx',source)

source='AbstractTemplate (Project 2).docx';parts=load(source);r=E.fromstring(parts['word/document.xml']);b=r.find('w:body',ns);rows=b.find('w:tbl',ns).findall('w:tr',ns)
for row,value in zip(rows,[D['title'],D['name']]):
 tc=row.findall('w:tc',ns)[2];settext(tc,value)
 for p in tc.findall('w:p',ns):format_runs(p,12,'Times New Roman')
pps=b.findall('w:p',ns)
for p in pps:
 text=''.join(p.findall('.//w:t',ns)[0].itertext()) if p.findall('.//w:t',ns) else ''
 if text.strip()=='/*':
  settext(p,D['abstract']);format_runs(p,12,'Times New Roman');prop(p,'jc',val='both');prop(p,'spacing',after=120,line=300,lineRule='auto')
  for rp in p.findall('.//w:rPr',ns):
   for bb in rp.findall('w:b',ns):rp.remove(bb)
   sub(rp,'b',val=0)
 if text.strip()=='*/':settext(p,'')
parts['word/document.xml']=xml(r);save(parts,'Abstract.docx',source)

source='KeywordsTemplate(Project 2).docx';parts=load(source);r=E.fromstring(parts['word/document.xml']);t=r.find('.//w:tbl',ns);rows=t.findall('w:tr',ns)
values=['1.',D['name'],D['id'],D['title'],', '.join(D['keywords'])]
for tc,value in zip(rows[1].findall('w:tc',ns),values):
 settext(tc,value)
 for p in tc.findall('w:p',ns):prop(p,'jc',val='left');format_runs(p,12,'Times New Roman')
t.remove(rows[2]);parts['word/document.xml']=xml(r);save(parts,'Keywords.docx',source)
print('Abstract words',len(D['abstract'].split()))
