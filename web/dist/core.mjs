// Browser-local Event QA engine. No requests are sent by this module.
export const VERSION = '1.0.0';
export const normalize = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]/g, '');
export const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const secret = /^(authorization|cookie|set-cookie|password|passwd|access_token|refresh_token|token|api_key|apikey|email|phone|phone_number|mobile|full_name|fullname|client_id|user_id|cid|uid|sid)$/i;
export function redact(value, depth = 0) {
  if (depth > 30) return '[ĐỘ SÂU VƯỢT GIỚI HẠN]';
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, secret.test(k) ? '[ĐÃ ẨN]' : redact(v, depth + 1)]));
  if (typeof value === 'string') return value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL ĐÃ ẨN]');
  return value;
}
export function safeUrl(input) {
  try { const u = new URL(input); u.username = ''; u.password = ''; u.hash = ''; for (const [k] of u.searchParams) if (secret.test(k) || /token|password|secret|auth|email|phone/i.test(k)) u.searchParams.set(k, '[ĐÃ ẨN]'); return String(redact(u.href)); }
  catch { return ''; }
}
export function get(object, path) {
  const parts = String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let value = object;
  for (const key of parts) { if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return {exists:false}; value = value[key]; }
  return {exists:true, value};
}
const queryObject = s => Object.fromEntries(new URLSearchParams(s));
function decodeBase64(s) { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); }
function parseBody(input, mime = '') {
  const raw = String(input ?? '').trim();
  if (!raw) return {parts:[{}], parsed:true};
  try { const d = JSON.parse(raw); return {parts:Array.isArray(d) ? d : [d], parsed:true}; } catch {}
  if (/^ey[JW]/.test(raw)) { try { const d = JSON.parse(decodeBase64(raw)); return {parts:Array.isArray(d)?d:[d], parsed:true}; } catch {} }
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length > 1) { try { return {parts:lines.flatMap(x => JSON.parse(x)), parsed:true}; } catch {} }
  if (/urlencoded/i.test(mime) || /^[\w.%~-]+=/.test(raw)) return {parts:lines.map(queryObject), parsed:true};
  return {parts:[{}], parsed:false};
}
function vendorOf(u, query) {
  const hp = u.hostname + u.pathname;
  if (/\.(js|mjs|css|png|jpe?g|gif|svg|ico|woff2?|map)$/i.test(u.pathname)) return null;
  if (/google-analytics\.com\//i.test(hp) || /analytics\.google\.com\//i.test(hp) || /\/g\/(s\/)?collect\/?$/i.test(u.pathname) || query.en) return 'GA4';
  if (/useinsider\.com\//i.test(hp) && /\/api\/event|\/hit\/?$/.test(u.pathname)) return 'INSIDER';
  if (/(^|\.)facebook\.com$/i.test(u.hostname) && /^\/tr\/?$/.test(u.pathname)) return 'META';
  if (/tiktok\.com$/i.test(u.hostname) && /pixel/i.test(u.pathname)) return 'TIKTOK';
  if (/(googleadservices|doubleclick)\.(com|net)/i.test(u.hostname) && /conversion|activity|pagead/.test(u.pathname)) return 'GOOGLE_ADS';
  if (/clarity\.ms$/i.test(u.hostname) && /collect/.test(u.pathname)) return 'CLARITY';
  if (/(?:^|[/._-])(?:track(?:ing)?|events?|collect|beacon|analytics|telemetry|pixel|ingest|hit)(?:$|[/._-])/i.test(hp)) return 'CUSTOM';
  return null;
}
function ga4(input) {
  const out = {};
  const itemNames = {id:'item_id', nm:'item_name', br:'item_brand', ca:'item_category', c2:'item_category2', c3:'item_category3', va:'item_variant', pr:'price', qt:'quantity', ds:'discount', cp:'coupon', li:'item_list_id', ln:'item_list_name', lp:'index'};
  const items = [];
  for (const [k,v] of Object.entries(input)) {
    if (k.startsWith('epn.')) out[k.slice(4)] = String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v;
    else if (k.startsWith('ep.')) out[k.slice(3)] = v;
    else if (/^pr\d+$/.test(k)) { const item = {}; for (const x of String(v).split('~')) { const key = x.slice(0,2), val = x.slice(2); if (itemNames[key]) item[itemNames[key]] = ['pr','qt','ds','lp'].includes(key) && val !== '' && Number.isFinite(+val) ? +val : val; } items[Number(k.slice(2))-1] = item; }
    else if (k === 'en') out.event = v;
    else out[k] = v;
  }
  if (items.length) { out.items = items.filter(Boolean); out.ecommerce = {items:out.items}; }
  if (input.cu) out.currency ??= input.cu;
  return out;
}
export function parseHar(har, filename = 'capture.har') {
  if (!har?.log || !Array.isArray(har.log.entries)) throw new Error('File không đúng định dạng HAR: thiếu log.entries.');
  const events = [], warnings = [];
  let trackingRequests = 0, ignored = 0;
  const pages = Object.fromEntries((har.log.pages ?? []).map(p => [p.id, p.title]));
  for (let index = 0; index < har.log.entries.length; index++) {
    const entry = har.log.entries[index], req = entry.request ?? {};
    let url; try { url = new URL(req.url); } catch { ignored++; continue; }
    if (req.method === 'OPTIONS') { ignored++; continue; }
    const query = {...queryObject(url.search), ...Object.fromEntries((req.queryString ?? []).map(x => [x.name, x.value]))};
    const vendor = vendorOf(url, query);
    if (!vendor) { ignored++; continue; }
    trackingRequests++;
    const post = req.postData ?? {}, mime = post.mimeType ?? '';
    const body = post.text ?? (Array.isArray(post.params) ? new URLSearchParams(post.params.map(x => [x.name,x.value ?? ''])).toString() : '');
    const parsed = parseBody(body, mime);
    const referer = (req.headers ?? []).find(x => /^referer$/i.test(x.name))?.value;
    let partIndex = 0;
    for (const part of parsed.parts) {
      const merged = {...query, ...(part && typeof part === 'object' ? part : {value:part})};
      let entries = Array.isArray(merged.events) ? merged.events.map(x => ({...Object.fromEntries(Object.entries(merged).filter(([k]) => k !== 'events')), ...x})) : [merged];
      // Some pixels use a data array containing individual events.
      if (vendor === 'TIKTOK' && Array.isArray(merged.data)) entries = merged.data;
      for (const rawPayload of entries) {
        const payload = vendor === 'GA4' ? ga4(rawPayload) : rawPayload;
        const name = payload.event ?? payload.event_name ?? payload.name ?? payload.ev ?? payload.type ?? (vendor === 'CLARITY' ? 'clarity_request' : parsed.parsed ? 'tracking_request' : 'UNPARSED');
        events.push({id:`${filename}:${index+1}:${++partIndex}`, file:filename, requestIndex:index+1, name:typeof name === 'string' ? name : 'tracking_request', vendor,
          layer:'TRACKING_REQUEST', time:entry.startedDateTime ?? '', timestamp:Date.parse(entry.startedDateTime) || 0,
          status:Number(entry.response?.status ?? 0), duration:Math.max(0, Number(entry.time) || 0), method:req.method ?? 'GET',
          endpoint:url.hostname + url.pathname, url:safeUrl(url.href), page:safeUrl(payload.dl ?? payload.page_location ?? referer ?? pages[entry.pageref] ?? ''),
          payload:redact(payload), decoded:parsed.parsed, issues:[]});
      }
    }
    if (!parsed.parsed) warnings.push(`Request #${index+1}: chưa giải mã được body tại ${url.hostname + url.pathname}.`);
  }
  events.sort((a,b) => a.timestamp-b.timestamp);
  return {events, warnings, requests:har.log.entries.length, trackingRequests, ignored};
}
// A small data-literal parser: comments, quoted/unquoted keys and trailing commas.
// It never evaluates expressions, functions or code from a spreadsheet.
export function parseLiteral(input) {
  const source = String(input).trim().replace(/^```(?:json|js|javascript)?\s*/i, '').replace(/```\s*$/, '');
  let p = 0, depth = 0;
  const skip = () => { while (p < source.length) { if (/\s/.test(source[p])) p++; else if (source.slice(p,p+2) === '//') { while (p < source.length && source[p] !== '\n') p++; } else if (source.slice(p,p+2) === '/*') { const end = source.indexOf('*/',p+2); if (end < 0) throw new Error('Comment chưa đóng.'); p = end+2; } else break; } };
  function string() { const q=source[p++]; let s=''; while (p < source.length) { let c=source[p++]; if (c===q) return s; if (c==='\\') { c=source[p++]; const m={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}; if (c==='u') { const hex=source.slice(p,p+4); if (!/^[a-f0-9]{4}$/i.test(hex)) throw new Error('Unicode escape không hợp lệ.'); s+=String.fromCharCode(parseInt(hex,16));p+=4; } else s+=m[c]??c; } else s+=c; } throw new Error('Chuỗi chưa đóng.'); }
  function value() {
    skip(); if (++depth > 40) throw new Error('Sample quá sâu.');
    let out, c=source[p];
    if (c==='"' || c==="'") out=string();
    else if (c==='{' || c==='[') { const array=c==='[', end=array?']':'}'; p++;out=array?[]:Object.create(null);skip(); while (source[p]!==end) { if (p>=source.length) throw new Error('Sample chưa đóng.'); if (array) out.push(value()); else {skip(); const key=(source[p]==='"'||source[p]==="'")?string():source.slice(p).match(/^[A-Za-z_$][\w$.-]*/)?.[0];if(!key)throw new Error('Tên trường không hợp lệ.'); if(source[p-1]!== '"' && source[p-1]!=="'")p+=key.length;skip();if(source[p++]!==':')throw new Error('Thiếu dấu hai chấm.');Object.defineProperty(out,key,{value:value(),enumerable:true,writable:true,configurable:true});} skip(); if(source[p]===','){p++;skip();}else if(source[p]!==end)throw new Error('Thiếu dấu phẩy.'); }p++; }
    else { const token=source.slice(p).match(/^(?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|true\b|false\b|null\b)/)?.[0];if(!token)throw new Error('Sample chứa biểu thức không được hỗ trợ.');p+=token.length;out=token==='true'?true:token==='false'?false:token==='null'?null:Number(token); }
    depth--;return out;
  }
  const out=value();skip();if(p!==source.length)throw new Error('Sample có nội dung sau giá trị dữ liệu.');return out;
}
export function extractSample(input) {
  const str=String(input ?? '');
  if(!str.trim())return null;
  try{return parseLiteral(str);}catch{}
  const start=str.indexOf('{');if(start<0)throw new Error('Không tìm thấy object sample.');
  let depth=0,quote=null;
  for(let i=start;i<str.length;i++){const c=str[i];if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}'&&!--depth)return parseLiteral(str.slice(start,i+1));}
  throw new Error('Sample bị cắt hoặc chưa đóng object.');
}
function sourceOf(input) { const s=normalize(input);return s.includes('insider')?'INSIDER':/ga4|gtm|googleanalytics|datalayer/.test(s)?'GA4':s.includes('tiktok')?'TIKTOK':s.includes('meta')||s.includes('facebook')?'META':null; }
function flattenSample(object,prefix='',fields={}) {
  if(!object||typeof object!=='object')return fields;
  for(const [key,v] of Object.entries(object)){
    const path=prefix?`${prefix}.${key}`:key;
    if(key.startsWith('gtm.')||key.startsWith('gtag.')||key==='processed')continue;
    if(v&&typeof v==='object'&&!Array.isArray(v))flattenSample(v,path,fields);
    else if(Array.isArray(v)&&v.length&&v[0]&&typeof v[0]==='object'){fields[path]={op:'type',value:'array'};flattenSample(v[0],`${path}.0`,fields);}
    else fields[path]={op:v===null?'exists':'type',...(v===null?{}:{value:typeOf(v)})};
  }return fields;
}
const aliases = {event:['eventname','tenevent','event'],source:['nentang','platform','source','vendor'],flow:['luong','flow','service'],description:['eventdescription','description','mota','trigger'],sample:['datalayersample','sample','payloadsample','payload','insiderqueuesample'],note:['note','notes','ghichu'],id:['stt','id','testcaseid']};
export function specFromRows(rows, file, sheet='') {
  let header=-1,columns={};
  for(let i=0;i<Math.min(60,rows.length);i++){const c={};rows[i].forEach((v,j)=>{for(const[k,list]of Object.entries(aliases))if(list.includes(normalize(v)))c[k]=j;});if(c.event!==undefined){header=i;columns=c;break;}}
  if(header<0)throw new Error('Không tìm thấy cột Event Name / Tên event trong sheet đã chọn.');
  const specs=[],warnings=[];
  let carriedSource='',carriedFlow='';
  for(let i=header+1;i<rows.length;i++){
    const row=rows[i];const read=k=>String(row[columns[k]]??'').trim();
    if(read('source'))carriedSource=read('source');if(read('flow'))carriedFlow=read('flow');
    const name=read('event');if(!name||name.startsWith('//'))continue;
    let sample=null,parseWarning='';try{sample=extractSample(read('sample'));}catch(e){parseWarning=e.message;warnings.push(`Dòng ${i+1} · ${name}: ${e.message}`);}
    const vendor=sourceOf(carriedSource);
    let ruleSample=sample;
    if(vendor==='INSIDER'&&Array.isArray(sample?.value))ruleSample=sample.value.find(x=>x?.event_name===name)??sample.value.find(x=>x?.event_name)??sample;
    if(Array.isArray(sample?.events))ruleSample=sample.events.find(x=>x?.event_name===name)??sample.events[0]??sample;
    specs.push({id:`${sheet||file}:${i+1}`,name,vendor,flow:carriedFlow,description:read('description'),note:read('note'),sample:sample?redact(sample):null,
      rules:[{event_name:name,layer:'TRACKING_REQUEST',fields:ruleSample?flattenSample(redact(ruleSample)): {}}],inferred:true,parseWarning,provenance:{file,sheet,row:i+1}});
  }
  if(!specs.length)throw new Error('Sheet không có dòng event hợp lệ.');
  return{specs,warnings};
}
export function specFromJSON(input,file='rules.json'){
  const list=Array.isArray(input)?input:input.cases??input.events??input.specs;
  if(!Array.isArray(list)||!list.length)throw new Error('Đặc tả JSON cần là mảng hoặc chứa cases / events.');
  const specs=list.map((c,i)=>{
    const name=c.name??c.event_name??c.event??c.rules?.[0]?.event_name;
    if(!name||typeof name!=='string')throw new Error(`Dòng JSON ${i+1} thiếu tên event.`);
    let rules=c.rules;if(!rules)rules=[{event_name:c.event_name??c.event??name,layer:'TRACKING_REQUEST',fields:c.fields??flattenSample(c.sample??{})}];
    if(!Array.isArray(rules))throw new Error(`Rule của ${name} phải là mảng.`);
    for(const rule of rules){if(!rule.event_name||typeof rule.fields!=='object'||!rule.fields)throw new Error(`Rule của ${name} thiếu event_name / fields.`);for(const ruleField of Object.values(rule.fields)){if(!['exists','not_exists','type','eq','one_of','range','regex','ignore','ref','subset'].includes(ruleField.op))throw new Error(`Phép kiểm không được hỗ trợ: ${ruleField.op}`);}}
    return{id:String(c.id??`JSON-${i+1}`),name,vendor:sourceOf(c.source??c.vendor),flow:c.flow??'',description:c.description??'',note:c.note??'',rules:redact(rules),inferred:!c.rules&&!c.fields,parseWarning:'',provenance:{file,row:i+1},needs_review:c.needs_review===true};
  });if(new Set(specs.map(s=>s.id)).size!==specs.length)throw new Error('Đặc tả JSON có ID bị trùng.');return{specs,warnings:[]};
}
export function parseCSV(text) {
  const first=String(text).replace(/^\uFEFF/,'').split(/\r?\n/)[0];const separator=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quote=false;const s=String(text).replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quote&&s[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(!quote&&c===separator){row.push(cell);cell='';}else if(!quote&&(c==='\n'||c==='\r')){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
  if(quote)throw new Error('CSV có dấu ngoặc kép chưa đóng.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
function payloadLookup(payload,path,vendor){
  path=path.replace(/^payload\./,'').replace(/\[(\d+)\]/g,'.$1');
  const direct=get(payload,path);if(direct.exists)return direct;
  if(vendor==='GA4'){
    const simple=path.replace(/^ecommerce\./,'').replace(/^(custom_parameters|default_parameters)\./,'');
    const found=get(payload,simple);if(found.exists)return found;
  }
  if(vendor==='INSIDER'){
    const clean=path.replace(/^value\.0\./,'').replace(/^(event_parameters|event_params)\./,'').replace(/^(custom_parameters|default_parameters)\./,'').replace(/^(custom|default)\./,'');
    const paths=[`value.0.${path}`,`value.0.event_parameters.custom.${clean}`,`value.0.event_parameters.default.${clean}`,clean,`event_params.${clean}`,`event_parameters.${clean}`,`event_parameters.custom.${clean}`,`event_parameters.default.${clean}`,`custom_parameters.${clean}`,`default_parameters.${clean}`,`event_params.c_${clean}`,`event_params.custom.${clean}`,`event_params.default.${clean}`];
    for(const p of paths){const found=get(payload,p);if(found.exists)return found;}
  }
  return{exists:false};
}
function equal(a,b){if(typeOf(a)!==typeOf(b))return false;if(a&&typeof a==='object'){if(Array.isArray(a))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}return Object.is(a,b);}
function subset(expected,actual){if(expected&&typeof expected==='object'){if(!actual||typeof actual!=='object')return false;return Object.entries(expected).every(([k,v])=>Object.hasOwn(actual,k)&&subset(v,actual[k]));}return equal(expected,actual);}
function expectedLabel(rule){const m={exists:'Có mặt',not_exists:'Không có mặt',eq:'Bằng',type:'Kiểu',regex:'Khớp regex',one_of:'Thuộc',range:'Trong khoảng',ref:'Theo context',subset:'Chứa cấu trúc',ignore:'Bỏ qua'};return`${m[rule.op]??rule.op}${Object.hasOwn(rule,'value')?' '+JSON.stringify(rule.value):''}`;}
function testField(rule,actual){
  if(rule.op==='ignore')return'IGNORE';if(rule.optional&&!actual.exists)return'IGNORE';
  if(rule.op==='not_exists')return actual.exists?'FAIL':'PASS';if(!actual.exists)return'FAIL';
  if(typeof actual.value==='string'&&actual.value.includes('ĐÃ ẨN'))return rule.op==='exists'?'PASS':'REVIEW';
  const value=actual.value;
  switch(rule.op){case'exists':return'PASS';case'eq':return equal(value,rule.value)?'PASS':'FAIL';case'type':return[].concat(rule.value).some(t=>t==='integer'?Number.isInteger(value):typeOf(value)===t)?'PASS':'FAIL';case'one_of':return Array.isArray(rule.value)&&rule.value.some(v=>equal(v,value))?'PASS':'FAIL';case'range':return typeof value==='number'&&value>=(rule.value?.min??-Infinity)&&value<=(rule.value?.max??Infinity)?'PASS':'FAIL';case'subset':return subset(rule.value,value)?'PASS':'FAIL';case'ref':return'REVIEW';case'regex':return'REVIEW';default:return'REVIEW';}
}
export function inspectEvents(events,duplicateMs=1000){
  const seen=new Map();
  for(const e of events){e.issues=[];if(e.status===0||e.status>=400)e.issues.push({code:'HTTP_ERROR',message:e.status?`Request trả HTTP ${e.status}.`:'Request thất bại hoặc không có HTTP status.'});if(!e.decoded)e.issues.push({code:'UNPARSED',message:'Body chưa được giải mã; cần kiểm tra thủ công.'});
    const clean={...e.payload};for(const k of ['_s','_p','_et','sid','sct','tfd'])delete clean[k];
    const signature=JSON.stringify([e.vendor,e.name,e.endpoint,e.page,clean]);const prev=seen.get(signature);
    if(prev&&e.timestamp&&e.timestamp-prev.timestamp<=duplicateMs&&e.id!==prev.id&&(e.file!==prev.file||e.requestIndex!==prev.requestIndex)){const issue={code:'POSSIBLE_DUPLICATE',message:`Có request cùng event và payload trong ${duplicateMs} ms. Cần xác nhận nghiệp vụ.`};e.issues.push(issue);if(!prev.issues.some(x=>x.code==='POSSIBLE_DUPLICATE'))prev.issues.push(issue);}
    seen.set(signature,e);
  }return events;
}
export function compare(events,specs,{live=false}={}){
  const used=new Set(),rows=[];
  for(const spec of specs){for(const [ruleIndex,rule] of spec.rules.entries()){
    const vendor=sourceOf(rule.source)??spec.vendor;
    const candidates=events.filter(e=>e.name===rule.event_name&&(!vendor||e.vendor===vendor)&&(!live||e.layer===rule.layer));
    const base={id:`${spec.id}:${ruleIndex}`,spec,name:rule.event_name,vendor:vendor??'ANY',flow:spec.flow,matches:candidates.length,eventIds:candidates.map(e=>e.id),issues:[],checks:[],inferred:spec.inferred};
    candidates.forEach(e=>used.add(e.id));
    if(rule.layer==='JS_QUEUE'&&!live){rows.push({...base,status:'REVIEW',issues:['HAR không quan sát được JS_QUEUE / dataLayer / InsiderQueue.']});continue;}
    if(spec.parseWarning||spec.needs_review){rows.push({...base,status:'REVIEW',issues:[spec.parseWarning||'Rule chưa được duyệt trong file đặc tả.']});continue;}
    if(!candidates.length){rows.push({...base,status:rule.count?.min===0?'PASS':'MISSING',issues:rule.count?.min===0?[]:[live?'Chưa quan sát thấy trong phạm vi phiên đang chọn. Chỉ xác nhận lỗi khi đã thực hiện luồng tương ứng.':'Chưa quan sát thấy trong HAR đã nhập. Chỉ xác nhận lỗi khi đã thực hiện luồng tương ứng.']});continue;}
    if(spec.flow){const possibleSameName=specs.filter(s=>s!==spec&&s.rules.some(r=>r.event_name===rule.event_name)&&(!spec.vendor||!s.vendor||spec.vendor===s.vendor)&&s.flow!==spec.flow);if(possibleSameName.length){const flowToken=normalize(spec.flow);const matchingFlow=candidates.filter(e=>normalize(JSON.stringify(e.payload)+' '+e.page).includes(flowToken));if(matchingFlow.length)base.eventIds=matchingFlow.map(e=>e.id);else{rows.push({...base,status:'REVIEW',issues:['Tên event dùng ở nhiều luồng; chưa xác định được luồng từ payload hoặc URL.']});continue;}}}
    const selected=candidates.filter(e=>base.eventIds.includes(e.id));base.matches=selected.length;
    if(rule.count&&(selected.length<rule.count.min||selected.length>rule.count.max))base.issues.push(`Số lần ${selected.length} ngoài khoảng ${rule.count.min}–${rule.count.max}.`);
    let needsReview=false;
    for(const e of selected){
      if(live&&e.layer==='TRACKING_REQUEST'&&e.status===null){needsReview=true;base.issues.push(`${e.id}: Đang chờ phản hồi mạng.`);}
      if(!e.decoded){needsReview=true;base.issues.push(`${e.id}: body chưa được giải mã.`);}
      if((!live||e.layer==='TRACKING_REQUEST')&&(e.status===0||e.status>=400))base.issues.push(`${e.id}: HTTP ${e.status||'không có phản hồi'}.`);
      for(const[path,field]of Object.entries(rule.fields??{})){
        const actual=payloadLookup(e.payload,path,e.vendor),status=testField(field,actual);
        base.checks.push({eventId:e.id,path,expected:expectedLabel(field),actual:actual.exists?actual.value:'[THIẾU]',status});
        if(status==='FAIL')base.issues.push(`${path}: ${actual.exists?'Giá trị / kiểu dữ liệu không khớp.':'Thiếu trường.'}`);if(status==='REVIEW')needsReview=true;
      }
    }
    if(rule.after||rule.within_ms!==undefined){needsReview=true;base.issues.push(live?'Rule thứ tự / thời gian theo bước cần kiểm tra thủ công trong phiên web.':'Rule có thứ tự / thời gian theo bước; HAR không có mốc bắt đầu bước để xác nhận.');}
    const fieldCount=Object.keys(rule.fields??{}).length;if(!fieldCount){needsReview=true;base.issues.push('Đặc tả chưa có trường để đối chiếu; mới xác nhận được tên event.');}
    base.issues=[...new Set(base.issues)];rows.push({...base,status:base.issues.some(s=>s.includes('HTTP ')||s.includes('ngoài khoảng')||s.includes('Thiếu trường')||s.includes('không khớp'))?'FAIL':needsReview?'REVIEW':'PASS'});
  }}
  if(specs.length)for(const e of events)if((!live||specs.some(s=>s.rules.some(r=>r.layer===e.layer)))&&!used.has(e.id))rows.push({id:`extra:${e.id}`,name:e.name,vendor:e.vendor,flow:'',status:'EXTRA',matches:1,eventIds:[e.id],checks:[],issues:['Event chưa có dòng đối chiếu trong đặc tả đã nhập.'],inferred:false});
  return rows;
}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=typeof v==='object'?JSON.stringify(v):String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return'"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
export function reportData(events,comparisons,meta={}){return{schema_version:VERSION,generated_at:new Date().toISOString(),scope:'HAR tracking requests only; HTTP success does not confirm vendor ingestion.',...meta,events,comparisons};}
export function bugMarkdown(rows,{live=false}={}){const bugs=rows.filter(r=>r.status==='FAIL');return'# Event Tracking QA · Báo cáo sai lệch\n\n'+(bugs.length?bugs.map((r,i)=>`## BUG-${String(i+1).padStart(3,'0')} · ${r.name}\n\n- Nền tảng: ${r.vendor}\n- Luồng: ${r.flow||'Chưa chỉ định'}\n- Đặc tả: ${r.spec?.provenance?.file??'—'}, dòng ${r.spec?.provenance?.row??'—'}\n- Evidence: ${r.eventIds.join(', ')}\n\n${r.issues.map(x=>'- '+x).join('\n')}\n`).join('\n'):'Chưa có sai lệch được xác nhận.\n')+'\n## Phạm vi\n\nChưa thấy event không tự động được tính là lỗi. '+(live?'Bằng chứng JS queue và request được thu từ trình duyệt test trên máy chủ. HTTP thành công không xác nhận vendor ingestion.\n':'HAR không chứng minh event đã được vendor tiếp nhận và không quan sát được JS queue.\n');}
