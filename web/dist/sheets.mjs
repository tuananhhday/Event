// Minimal OOXML reader/writer, browser-native and dependency-free.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const xmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function xml(str){const d=new DOMParser().parseFromString(str,'application/xml');if(d.getElementsByTagName('parsererror').length)throw new Error('XML trong Excel không hợp lệ.');return d;}
const nodes=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
function text(node){return nodes(node,'t').map(n=>n.textContent).join('');}
async function unzip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(view.getUint32(p,true)===0x06054b50){end=p;break;}
 if(end<0)throw new Error('File XLSX không phải ZIP hợp lệ.');
 const count=view.getUint16(end+10,true);let p=view.getUint32(end+16,true);const entries=new Map();let total=0;
 if(count>3000)throw new Error('Excel có quá nhiều thành phần. Hãy xuất riêng sheet cần kiểm tra.');
 for(let i=0;i<count;i++){
  if(p+46>bytes.length||view.getUint32(p,true)!==0x02014b50)throw new Error('Mục lục XLSX bị hỏng.');
  const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),compressed=view.getUint32(p+20,true),size=view.getUint32(p+24,true),nl=view.getUint16(p+28,true),el=view.getUint16(p+30,true),cl=view.getUint16(p+32,true),offset=view.getUint32(p+42,true),name=decoder.decode(bytes.subarray(p+46,p+46+nl));
  total+=size;if(size>60*1024*1024||total>180*1024*1024)throw new Error('Excel sau giải nén quá lớn. Hãy giữ lại sheet đặc tả.');
  entries.set(name,{method,compressed,size,offset,flags});p+=46+nl+el+cl;
 }
 return async name=>{
  const item=entries.get(name);if(!item)return null;if(item.flags&1)throw new Error('Excel có mật khẩu. Hãy dùng bản không mã hóa.');
  const at=item.offset;if(at+30>bytes.length||view.getUint32(at,true)!==0x04034b50)throw new Error('Nội dung ZIP bị hỏng.');
  const start=at+30+view.getUint16(at+26,true)+view.getUint16(at+28,true);if(start+item.compressed>bytes.length)throw new Error('File XLSX bị cắt.');
  let data=bytes.subarray(start,start+item.compressed);
  if(item.method===8){
   if(typeof DecompressionStream==='undefined')throw new Error('Trình duyệt chưa hỗ trợ đọc XLSX. Hãy dùng Chrome/Edge mới hoặc xuất CSV.');
   try{const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));data=new Uint8Array(await new Response(stream).arrayBuffer());}catch{throw new Error('Không giải nén được XLSX. Hãy dùng Chrome/Edge mới hoặc xuất CSV.');}
  }else if(item.method!==0)throw new Error('Kiểu nén Excel không được hỗ trợ.');
  if(data.length!==item.size)throw new Error('Kích thước thành phần Excel không khớp.');return decoder.decode(data);
 };
}
function columnIndex(ref){let out=0;for(const c of ref.match(/^[A-Z]+/i)?.[0]??'A')out=out*26+c.toUpperCase().charCodeAt(0)-64;return out-1;}
export async function readXLSX(buffer){
 const read=await unzip(buffer);const wb=await read('xl/workbook.xml'),relationships=await read('xl/_rels/workbook.xml.rels');
 if(!wb||!relationships)throw new Error('Không tìm thấy workbook trong XLSX.');
 const rels=Object.fromEntries(nodes(xml(relationships),'Relationship').map(n=>[n.getAttribute('Id'),n.getAttribute('Target')]));
 const ss=await read('xl/sharedStrings.xml'),shared=ss?nodes(xml(ss),'si').map(text):[];
 const sheets=nodes(xml(wb),'sheet').map(n=>({name:n.getAttribute('name'),id:n.getAttribute('r:id')??n.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')}));
 return{names:sheets.map(x=>x.name),async rows(name){
  const sheet=sheets.find(x=>x.name===name)??sheets[0];if(!sheet)throw new Error('Workbook không có sheet.');
  const target=rels[sheet.id];if(!target)throw new Error('Không tìm thấy sheet.');
  const segments=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),parts=[];for(const s of segments){if(s==='..')parts.pop();else if(s!=='.')parts.push(s);}
  const data=await read(parts.join('/'));if(!data)throw new Error('Không đọc được dữ liệu sheet.');
  const doc=xml(data),out=[];
  for(const r of nodes(doc,'row')){const index=Number(r.getAttribute('r')||out.length+1)-1;if(index>100000)throw new Error('Sheet quá nhiều dòng. Hãy xuất sheet đặc tả riêng.');const row=[];for(const c of nodes(r,'c')){const idx=columnIndex(c.getAttribute('r')??'A');if(idx>2000)continue;const type=c.getAttribute('t'),value=nodes(c,'v')[0]?.textContent??'';row[idx]=type==='s'?(shared[Number(value)]??''):type==='inlineStr'?text(c):type==='b'?(value==='1'):type==='str'?value:value!==''&&Number.isFinite(Number(value))?Number(value):value;}out[index]=row;}
  for(let i=0;i<out.length;i++)out[i]??=[];
  // Fill merged source/flow cells, like Excel's visible repeated values.
  for(const merge of nodes(doc,'mergeCell')){const [a,b]=(merge.getAttribute('ref')??'').split(':');if(!a||!b)continue;const col=columnIndex(a),colEnd=columnIndex(b),from=Number(a.match(/\d+/)?.[0]??1)-1,to=Number(b.match(/\d+/)?.[0]??1)-1;if(col===colEnd&&to-from<5000&&to<out.length){const val=out[from]?.[col];for(let r=from+1;r<=to;r++)if(out[r][col]===undefined)out[r][col]=val;}}
  return out;
 }};
}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(files){
 const chunks=[],central=[];let offset=0;
 for(const[name,value]of Object.entries(files)){
  const data=encoder.encode(value),file=encoder.encode(name),crc=crc32(data),head=new Uint8Array(30+file.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,file.length,true);head.set(file,30);chunks.push(head,data);
  const dir=new Uint8Array(46+file.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,file.length,true);d.setUint32(42,offset,true);dir.set(file,46);central.push(dir);offset+=head.length+data.length;
 }
 const size=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function col(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
export function writeXLSX(sheets){
 const files={};const names=Object.keys(sheets);
 files['[Content_Types].xml']='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>';
 files['_rels/.rels']='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 files['xl/workbook.xml']='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+names.map((name,i)=>`<sheet name="${xmlEscape(name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>';
 files['xl/_rels/workbook.xml.rels']='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${names.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 files['xl/styles.xml']='<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17243F"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 names.forEach((name,i)=>{const rows=sheets[name];files[`xl/worksheets/sheet${i+1}.xml`]='<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="30" width="28" customWidth="1"/></cols><sheetData>'+rows.map((row,r)=>`<row r="${r+1}"${r===0?' ht="26" customHeight="1"':''}>`+row.map((v,c)=>{const ref=col(c)+(r+1),style=r===0?' s="1"':'';return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"${style}><v>${v}</v></c>`:`<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape((typeof v==='object'?JSON.stringify(v):String(v??'')).slice(0,32000))}</t></is></c>`;}).join('')+'</row>').join('')+'</sheetData>'+(rows.length?`<autoFilter ref="A1:${col(Math.max(0,rows[0].length-1))}${rows.length}"/>`:'')+'</worksheet>';});return zip(files);
}
