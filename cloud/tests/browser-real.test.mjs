import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudApp} from '../server.mjs';
import {RemoteBrowser,findProxy} from '../browser.mjs';

test('real Chromium session starts, displays the demo and captures a search',{
 skip:process.env.EVENTQA_REAL_BROWSER!=='1',timeout:30000
},async()=>{
 let browser;
 class Browser extends RemoteBrowser{constructor(options){super(options);browser=this;}}
 const app=createCloudApp({Browser});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${app.server.address().port}`;
 let cookie='';
 async function api(route,data){
  const res=await fetch(origin+'/api/'+route,{method:data===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));return result;
 }
 try{
  for(const mode of ['cdp',...(findProxy()?['proxy']:[])]){
   assert.equal((await api('start',{mode,demo:true})).active,true);
   assert.ok((await browser.frame()).data.length>1000);
   // Wait for the form, then perform the same action as the demo search button.
   let ready=false;
   for(let n=0;n<50;n++){
    ready=(await browser.control.send('Runtime.evaluate',{expression:'!!document.querySelector("#search")'})).result.value;
    if(ready)break;await new Promise(r=>setTimeout(r,100));
   }
   assert.ok(ready,'demo form loaded');
   await browser.control.send('Runtime.evaluate',{expression:'document.querySelector("#search").requestSubmit()'});
   let state;
   for(let n=0;n<50;n++){
    state=await api('state');
    if(state.events.some(e=>e.name==='search_submit'&&e.layer==='TRACKING_REQUEST'&&e.status===204))break;
    await new Promise(r=>setTimeout(r,100));
   }
   assert.ok(state.events.some(e=>e.name==='search_submit'&&e.layer==='TRACKING_REQUEST'&&e.status===204),`${mode}: search request received HTTP 204`);
   if(mode==='cdp')assert.ok(state.events.some(e=>e.name==='search_submit'&&e.layer==='JS_QUEUE'));
   assert.equal((await api('stop',{})).active,false);
  }
 }finally{await app.close();}
});
