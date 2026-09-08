# Template execution contract

## References and evidence
Originals remain in /Users/puihockyang/Downloads/TEMPLETE 1_2 and are never overwritten.
Package SHA256 inventories, exact paragraph XML, section geometry and styles are in template-audit.json.
Report SHA256 60dc7235f12843fbaa2b49cc314643e008e4feab4ef5b298a80eaf7874f116d5; 28 rendered pages and 14 sections.
Abstract SHA256 3f70f753f5807cdc103e6d3f69f3403fcc656beba9dc3b11f6ff5381f4e92007; one page and section.
Keywords SHA256 0f62c70373de555575deaf580735f00b13cda6abcb448f010c0024f774f9f0af; one page and section.
Reference renders are reference-report, reference-abstract, reference-keywords. All pages inspected.

## Page system and typography
Report: portrait A4 7562215 by 10689590 EMU, all margins 914400 EMU, header/footer 457200 EMU. Preserve all 14 sectPr, first-page flags, section types and page numbering. Source chapter separator pages remain. Chapters expand through cloned content paragraphs; remove template instruction-only overflow and redundant trailing blanks, including printed back-cover instruction. Retain unsigned declaration.
Abstract and keywords: Letter 7772400 by 10058400 EMU, top/bottom 914400, left/right 1143000 EMU, header/footer 457200. Preserve table grids and title placement.
Report roles: Heading1 Arial bold 18 pt, before12/after6 pt; Heading2 Arial bold14 pt before24/after6 pt; Heading3 Arial bold12 pt before12/after6 pt. Body Times New Roman12 pt with source paragraph indentation and 1.5 line spacing. Clone real roles; manually number new headings to align with contents. Preserve styles.xml, numbering.xml and themes byte for byte. Title style Arial14 bold centered is used with cover slot direct size24 pt to fit the longer title; cover blank spacers can be shortened within the same page to preserve the logo and institution block.
Headers retain rules and section labels; replace Project Title with Campus Navigator. Footers preserve PAGE field and rule; replace unconfirmed template course code BMCS3413 with Software Engineering. No new decorative rules.

## Slots and package boundaries
word/document.xml body direct paragraph indices in template-audit.json are stable locators before any edits. Cover p4/p37 title; p13/p41/p87 name; p44 supervisor; p51/p88 course; p89 registration. p91 Abstract and p100 Acknowledgement retain headings, replace only following content. Preserve section properties even where attached to instruction paragraphs.
Chapter content ranges: p117..152,167..183,197..206,220..234,248..278,292..306,325..340. Exact end selected by the next sectPr in body. Replace instructional content and sample table/chart with genuine backend/admin prose, tables and shared map figure. Keep chapter separators outside those ranges unchanged except Chapter6 applicability label and blue color.
References p343..347 becomes actual sources. Appendices p351 onwards become user/developer guides, preserving final section properties. No passwords or private tokens.
The TOC is a rich-text SDT. Preserve its SDT properties, paragraph/run structure, bookmarks and field instructions. Only update cached text nodes using existing slots; blank unused cached entries, preserve field controls and set updateFields. If Word refresh is unavailable, require user update on opening; do not save through LibreOffice. Cached page numbers derived from rendered document where possible, never retain template page2 values without correction.
Abstract table right cells contain title and author; replace /* */ slot with unheaded abstract <=300 words. Keywords row1 becomes confirmed identity/title and five alphabetical keywords; remove illustrative row2. Preserve table formatting and widths; left align editable prose to avoid justified gaps.
Editable package parts: document.xml; settings.xml updateFields; header/footer text only; document relationships and content types only when adding real figures. All other parts, including customXml, numbering, styles, theme, logo media and opaque metadata, preserve byte for byte. Unused template chart/media may remain packaged but never display.

## Workbook and poster
XLSX retains Sheet1 A1:C46, chapter grouping and three columns. Replace contents and metadata with matching report outline; row heights may expand for wrapping.
PPTX retains one A1 portrait slide, existing masters/layouts, logo, colors, seven section frames and headers. Replace Construction and Testing with System Features. Remove example table/chart, insert shared map image and actual feature descriptions within that frame. No synthetic screenshots or fabricated results. Shape identities are recorded in reference-poster-0.json.

## Content authority and gates
Confirmed Pui Hock Yang,24WMR01790,Software Engineering,Prof. Ts. Dr. Tew Yiqi. Academic year2025/26 retained from template. Title Campus Navigator: Backend System and Web-Based Administration Client.
Reference chapter outline is fyp_docs_only/modify; implementation evidence is services, admin-web, deploy and dev. Local 100 simulated sessions verified in prior implementation work, not100 real participants. Current documentation capture finds localhost3100 offline; do not fabricate fresh screenshots or a fresh test run. Google Cloud deployment remains planned, scripts locally checked only.
Render final documents and all slides, inspect every page, check overflow and placeholder text, validate package preservation and unchanged reference hashes. Deliver only five requested editable artifacts.
